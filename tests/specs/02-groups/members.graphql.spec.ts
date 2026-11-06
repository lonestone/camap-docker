/**
 * The member lists, the member data and the removal of members through GraphQL
 * (specs/02-groups/members.md; camap-ts userLists.resolver.ts, userGroups.resolver.ts,
 * group-previews-members.resolver.ts, reached through the hx origin).
 * The hx pages are in members.views.spec.ts and members.forms.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';

const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;
const countOf = (lists: { type: string; count: number | null }[], type: string) => lists.find((l) => l.type === type)?.count;

async function orderOf(s: make.AmapScenario, user: { id: number }) {
  const basket = await make.basket({ user, multiDistrib: s.multiDistribs[0] });
  await make.userOrder({ user, product: s.products.var[0], distribution: s.distributions[0].var, basket });
}

async function adminWithoutMembershipRight(s: make.AmapScenario) {
  const u = await make.user({ firstName: 'Alex', lastName: 'Adminseul' });
  await make.userGroup({ user: u, group: s.group, rights: [Right.GroupAdmin()] });
  return u;
}

test.describe('the preview of the group for the member managers', () => {
  test('a membership manager gets the preview of their group', { tag: ['@GRP-MEM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 15 } });
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.preview(m.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.groupPreviewMembers).toEqual({ id: s.group.id, name: 'AMAP des Tests', hasMembership: true, membershipFee: 15 });
  });

  test('a superadmin gets it too', { tag: ['@GRP-MEM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.api.members.preview(admin.request, s.group.id);

    expect(res.data!.groupPreviewMembers).toMatchObject({ id: s.group.id, hasMembership: false });
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
    ['a person outside the group', 'nonMember'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} is refused`, { tag: ['@GRP-MEM-004'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);

      const res = await app.api.members.preview(u.request, s.group.id);

      expect(res.data).toBeNull();
      expect(res.errors?.[0].message).toMatch(/membership right/);
    });
  }

  test('a group admin without the membership right is refused', { tag: ['@GRP-MEM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(await adminWithoutMembershipRight(s));

    const res = await app.api.members.preview(a.request, s.group.id);

    expect(res.data).toBeNull();
    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

test.describe('the lists of members (UND-029: the lists are not protected by a right, characterised)', () => {
  test('the lists of the whole group, with their counts', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await orderOf(s, s.users.member);
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.lists(m.request, s.group.id);

    expect(res.errors).toBeNull();
    const lists = res.data!.getUserLists;
    expect(countOf(lists, 'all')).toBe(6);
    expect(countOf(lists, 'admins')).toBe(4); // everybody who holds a right
    expect(countOf(lists, 'hasOrders')).toBe(1);
    expect(countOf(lists, 'hasNoOrders')).toBe(5);
    expect(countOf(lists, 'waitingList')).toBe(0);
  });

  test('the whole group list gives the people', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.listUsers(m.request, { listType: 'all', groupId: s.group.id });

    expect(res.errors).toBeNull();
    const ids = res.data!.getUserListInGroupByListType.map((u) => u.id).sort((a, b) => a - b);
    expect(ids).toEqual([s.users.member, s.users.member2, s.users.coordinator, s.users.membershipManager, s.users.messagesManager, s.users.groupAdmin].map((u) => u.id).sort((a, b) => a - b));
  });

  test('the list of people with orders and the list of people without', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await orderOf(s, s.users.member);
    const m = await as(s.users.membershipManager);

    const withOrders = await app.api.members.listUsers(m.request, { listType: 'hasOrders', groupId: s.group.id });
    const without = await app.api.members.listUsers(m.request, { listType: 'hasNoOrders', groupId: s.group.id });

    expect(withOrders.data!.getUserListInGroupByListType.map((u) => u.id)).toEqual([s.users.member.id]);
    expect(without.data!.getUserListInGroupByListType.map((u) => u.id)).not.toContain(s.users.member.id);
    expect(without.data!.getUserListInGroupByListType).toHaveLength(5);
  });

  test('one list per active catalog, with the people who ordered in it', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await orderOf(s, s.users.member); // variable catalog
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.listsByCatalog(m.request, s.group.id);

    expect(res.errors).toBeNull();
    const lists = res.data!.getContractsUserLists;
    expect(lists).toHaveLength(2);
    const byCatalog = Object.fromEntries(lists.map((l) => [JSON.parse(l.data!).id, l.count]));
    expect(byCatalog).toEqual({ [s.constCatalog.id]: 0, [s.varCatalog.id]: 1 });
    const people = await app.api.members.listUsers(m.request, { listType: 'contractSubscribers', groupId: s.group.id, data: String(s.varCatalog.id) });
    expect(people.data!.getUserListInGroupByListType.map((u) => u.id)).toEqual([s.users.member.id]);
  });

  test('one list per distribution of the next two weeks, with the people who ordered in it', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await orderOf(s, s.users.member);
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.listsByDistribution(m.request, s.group.id);

    expect(res.errors).toBeNull();
    const lists = res.data!.getDistributionsUserLists;
    expect(lists).toHaveLength(4); // 2 catalogs x the 2 days within 2 weeks
    const byDistribution = Object.fromEntries(lists.map((l) => [JSON.parse(l.data!).id, l.count]));
    expect(byDistribution[s.distributions[0].var.id]).toBe(1);
    expect(byDistribution[s.distributions[0].const.id]).toBe(0);
    const people = await app.api.members.listUsers(m.request, { listType: 'withProductToGetOnDistribution', groupId: s.group.id, data: String(s.distributions[0].var.id) });
    expect(people.data!.getUserListInGroupByListType.map((u) => u.id)).toEqual([s.users.member.id]);
  });

  test('a group with memberships has the lists with and without a valid membership', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
    await make.membership({ group: s.group, user: s.users.member });
    const m = await as(s.users.membershipManager);

    const lists = (await app.api.members.lists(m.request, s.group.id)).data!.getUserLists;
    const valid = await app.api.members.listUsers(m.request, { listType: 'membership', groupId: s.group.id });
    const expired = await app.api.members.listUsers(m.request, { listType: 'noMembership', groupId: s.group.id });

    expect(countOf(lists, 'membership')).toBe(1);
    expect(countOf(lists, 'noMembership')).toBe(5);
    expect(valid.data!.getUserListInGroupByListType.map((u) => u.id)).toEqual([s.users.member.id]);
    expect(expired.data!.getUserListInGroupByListType.map((u) => u.id)).not.toContain(s.users.member.id);
    expect(expired.data!.getUserListInGroupByListType).toHaveLength(5);
  });

  test('the membership list is empty when nobody paid', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
    const m = await as(s.users.membershipManager);

    const lists = (await app.api.members.lists(m.request, s.group.id)).data!.getUserLists;
    const valid = await app.api.members.listUsers(m.request, { listType: 'membership', groupId: s.group.id });

    expect(countOf(lists, 'membership')).toBe(0);
    expect(valid.data!.getUserListInGroupByListType).toEqual([]);
  });

  test('a group without memberships has no membership lists', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: false } });
    const m = await as(s.users.membershipManager);

    const lists = (await app.api.members.lists(m.request, s.group.id)).data!.getUserLists;
    const valid = await app.api.members.listUsers(m.request, { listType: 'membership', groupId: s.group.id });
    const expired = await app.api.members.listUsers(m.request, { listType: 'noMembership', groupId: s.group.id });

    expect(lists.map((l) => l.type)).not.toContain('membership');
    expect(lists.map((l) => l.type)).not.toContain('noMembership');
    expect(valid.data!.getUserListInGroupByListType).toEqual([]);
    expect(expired.data!.getUserListInGroupByListType).toEqual([]);
  });

  test('a plain member and a person outside the group can read the lists, emails included (UND-029, characterised)', { tag: ['@GRP-MEM-002'] }, async ({ app, as }) => {
    // SUGGESTION of the spec: require the membership right. Today only a login is required.
    const s = await make.amapScenario();
    const plain = await as(s.users.member);
    const outsider = await as(s.users.nonMember);

    const a = await app.api.members.listUsers(plain.request, { listType: 'all', groupId: s.group.id });
    const b = await app.api.members.listUsers(outsider.request, { listType: 'all', groupId: s.group.id });
    const c = await app.api.members.lists(outsider.request, s.group.id);

    expect(a.errors).toBeNull();
    expect(a.data!.getUserListInGroupByListType).toHaveLength(6);
    expect(a.data!.getUserListInGroupByListType.map((u) => u.email)).toContain('groupadmin@camap.test');
    expect(b.data!.getUserListInGroupByListType).toHaveLength(6);
    expect(countOf(c.data!.getUserLists, 'all')).toBe(6);
  });

  test('a visitor cannot read the lists', { tag: ['@GRP-MEM-002'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.members.listUsers(anon.request, { listType: 'all', groupId: s.group.id });

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

test.describe('the data of one member', () => {
  const allowed = [
    ['a group admin', 'groupAdmin'],
    ['a catalog coordinator', 'coordinator'],
    ['a membership manager', 'membershipManager'],
  ] as const;
  for (const [label, who] of allowed) {
    test(`${label} reads the data of a member of the group`, { tag: ['@GRP-MEM-009'] }, async ({ app, as }) => {
      const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
      await query('UPDATE UserGroup SET balance = 12.5 WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);
      const u = await as(s.users[who]);

      const res = await app.api.members.get(u.request, s.group.id, s.users.member.id);

      expect(res.errors).toBeNull();
      expect(res.data!.userGroup).toEqual({ groupId: s.group.id, userId: s.users.member.id, balance: 12.5, hasValidMembership: false });
    });
  }

  test('a member with a valid membership is flagged', { tag: ['@GRP-MEM-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
    await make.membership({ group: s.group, user: s.users.member });
    // the flag needs a renewal date on the group (without one it is always false)
    await query('UPDATE `Group` SET membershipRenewalDate = ? WHERE id = ?', [`${clock.now().getFullYear()}-01-01`, s.group.id]);
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.get(m.request, s.group.id, s.users.member.id);

    expect(res.data!.userGroup!.hasValidMembership).toBe(true);
  });

  test('a person who is not in the group gives nothing', { tag: ['@GRP-MEM-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.get(m.request, s.group.id, s.users.nonMember.id);

    expect(res.errors).toBeNull();
    expect(res.data!.userGroup).toBeNull();
  });

  const refused = [
    ['a plain member', 'member'],
    ['a messages manager', 'messagesManager'],
    ['a person outside the group', 'nonMember'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} cannot read it`, { tag: ['@GRP-MEM-009'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);

      const res = await app.api.members.get(u.request, s.group.id, s.users.member2.id);

      expect(res.data!.userGroup).toBeNull();
      expect(res.errors?.[0].message).toMatch(/authorization/);
    });
  }
});

test.describe('removing members (GraphQL)', () => {
  test('a membership manager removes members: their membership of the group is deleted', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.remove(m.request, s.group.id, [s.users.member.id]);

    expect(res.errors).toBeNull();
    expect(res.data!.removeUsersFromGroup).toEqual({ success: [{ groupId: s.group.id, userId: s.users.member.id }], errors: [] });
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
  });

  test('a manager cannot remove themself', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.remove(m.request, s.group.id, [s.users.membershipManager.id]);

    expect(res.data!.removeUsersFromGroup.success).toEqual([]);
    expect(res.data!.removeUsersFromGroup.errors).toEqual([{ userId: s.users.membershipManager.id, message: 'cannotRemoveSelfFromGroup' }]);
    expect(await memberOf(s.users.membershipManager.id, s.group.id)).toBe(1);
  });

  test('a group admin cannot be removed', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.remove(m.request, s.group.id, [s.users.groupAdmin.id]);

    expect(res.data!.removeUsersFromGroup.success).toEqual([]);
    expect(res.data!.removeUsersFromGroup.errors).toEqual([{ userId: s.users.groupAdmin.id, message: 'cannotRemoveAdmin' }]);
    expect(await memberOf(s.users.groupAdmin.id, s.group.id)).toBe(1);
  });

  test('a member with orders is removed without any confirmation (UND-028, characterised)', { tag: ['@GRP-MEM-005', '@GRP-MEM-006'] }, async ({ app, as }) => {
    // The hx link asks for a confirmation (members.forms.spec.ts); this mutation does not.
    const s = await make.amapScenario();
    await orderOf(s, s.users.member);
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.remove(m.request, s.group.id, [s.users.member.id]);

    expect(res.errors).toBeNull();
    expect(res.data!.removeUsersFromGroup.success).toHaveLength(1);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} cannot remove anybody`, { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);

      const res = await app.api.members.remove(u.request, s.group.id, [s.users.member2.id]);

      expect(res.errors?.[0].message).toMatch(/membership right/);
      expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
    });
  }

  test('a visitor cannot remove anybody', { tag: ['@GRP-MEM-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.members.remove(anon.request, s.group.id, [s.users.member2.id]);

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
  });

  test('a manager of another group cannot remove members of this one', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    const manager = await make.user();
    await make.userGroup({ user: manager, group: other, rights: [Right.Membership()] });
    const u = await as(manager);

    const res = await app.api.members.remove(u.request, s.group.id, [s.users.member2.id]);

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
  });
});

test.describe('removing several members at once (UND-028)', () => {
  test('every member of the list is removed', { tag: ['@GRP-MEM-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.remove(m.request, s.group.id, [s.users.member.id, s.users.member2.id, s.users.coordinator.id]);

    expect(res.errors).toBeNull();
    expect(res.data!.removeUsersFromGroup.success.map((u) => u.userId).sort()).toEqual([s.users.member.id, s.users.member2.id, s.users.coordinator.id].sort());
    expect(res.data!.removeUsersFromGroup.errors).toEqual([]);
    expect(await query('SELECT userId FROM UserGroup WHERE groupId = ?', [s.group.id])).toHaveLength(3);
  });

  test('the admins and the caller of the list are reported, the others are removed', { tag: ['@GRP-MEM-007', '@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.remove(m.request, s.group.id, [s.users.member.id, s.users.groupAdmin.id, s.users.membershipManager.id, s.users.coordinator.id]);

    const r = res.data!.removeUsersFromGroup;
    expect(r.success.map((u) => u.userId).sort()).toEqual([s.users.member.id, s.users.coordinator.id].sort());
    expect(r.errors).toEqual(expect.arrayContaining([
      { userId: s.users.membershipManager.id, message: 'cannotRemoveSelfFromGroup' },
      { userId: s.users.groupAdmin.id, message: 'cannotRemoveAdmin' },
    ]));
    expect(await memberOf(s.users.groupAdmin.id, s.group.id)).toBe(1);
    expect(await memberOf(s.users.membershipManager.id, s.group.id)).toBe(1);
  });

  test('a person who is not in the group makes the whole request fail and nobody is removed (characterised)', { tag: ['@GRP-MEM-007'] }, async ({ app, as }) => {
    // The spec says such a person is reported in the result. The resolver collects the "userNotInGroup" error
    // but still deletes the missing membership (TypeError, internal error), so the transaction is rolled back.
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.remove(m.request, s.group.id, [s.users.nonMember.id, s.users.member.id]);

    expect(res.data).toBeNull();
    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });
});

test.describe('members who never logged in (UND-036)', () => {
  test('the new members are those whose last-login date is empty', { tag: ['@GRP-MEM-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const returning = await make.user({ firstName: 'Revenu', ldate: addDaysWall(clock.now(), -3) });
    await make.userGroup({ user: returning, group: s.group });
    const m = await as(s.users.membershipManager); // logging in sets the date for this one

    const lists = (await app.api.members.lists(m.request, s.group.id)).data!.getUserLists;
    const res = await app.api.members.listUsers(m.request, { listType: 'newUsers', groupId: s.group.id });

    const ids = res.data!.getUserListInGroupByListType.map((u) => u.id);
    expect(ids.sort((a, b) => a - b)).toEqual([s.users.member, s.users.member2, s.users.coordinator, s.users.messagesManager, s.users.groupAdmin].map((u) => u.id).sort((a, b) => a - b));
    expect(ids).not.toContain(returning.id);
    expect(ids).not.toContain(s.users.membershipManager.id);
    expect(countOf(lists, 'newUsers')).toBe(5);
  });

  test('a member who logs in leaves the list', { tag: ['@GRP-MEM-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    expect((await app.api.members.listUsers(m.request, { listType: 'newUsers', groupId: s.group.id })).data!.getUserListInGroupByListType.map((u) => u.id)).toContain(s.users.member.id);

    await as(s.users.member);

    const after = await app.api.members.listUsers(m.request, { listType: 'newUsers', groupId: s.group.id });
    expect(after.data!.getUserListInGroupByListType.map((u) => u.id)).not.toContain(s.users.member.id);
  });
});
