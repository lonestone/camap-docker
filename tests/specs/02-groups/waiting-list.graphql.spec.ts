/**
 * The waiting list of a group through GraphQL: who sees it, approving, refusing and moving members
 * back (specs/02-groups/waiting-list.md; camap-ts groups/resolvers/waitingLists.resolver.ts and
 * userLists.resolver.ts, reached through the hx origin).
 * The hx side (asking, leaving, the mail on a new request, the member-sheet link) is in
 * waiting-list.forms.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';

const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;
const waiting = (userId: number, groupId: number) => query<{ message: string }>('SELECT message FROM WaitingList WHERE userId = ? AND amapId = ?', [userId, groupId]);

/** A group with a waiting list and `Nina Nonmembre` waiting. */
async function scenario() {
  const s = await make.amapScenario({ group: { regOption: 'WaitingList' } });
  await make.waitingList({ group: s.group, user: s.users.nonMember, message: 'Je voudrais des légumes' });
  return s;
}

async function adminWithoutMembershipRight(s: make.AmapScenario) {
  const u = await make.user({ firstName: 'Alex', lastName: 'Adminseul', email: 'adminseul@camap.test' });
  await make.userGroup({ user: u, group: s.group, rights: [Right.GroupAdmin()] });
  return u;
}

const refusedWho = [
  ['a plain member', 'member'],
  ['a catalog coordinator', 'coordinator'],
  ['a messages manager', 'messagesManager'],
  ['a person outside the group', 'vendor'],
] as const;

test.describe('seeing the waiting list', () => {
  test('a membership manager sees who waits, with their message', { tag: ['@GRP-WAI-004'] }, async ({ app, as }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.of(m.request, s.group.id);

    expect(res.errors).toBeNull();
    const [entry, ...others] = res.data!.getWaitingListsOfGroup;
    expect(others).toEqual([]);
    expect(entry).toMatchObject({ amapId: s.group.id, userId: s.users.nonMember.id, message: 'Je voudrais des légumes', user: { id: s.users.nonMember.id, firstName: 'Nina', lastName: 'Nonmembre' } });
  });

  test('a visitor who is not logged in gets nothing', { tag: ['@GRP-WAI-004'] }, async ({ app, anon }) => {
    const s = await scenario();

    const res = await app.api.waitingList.of(anon.request, s.group.id);

    expect(res.data).toBeNull();
    expect(res.errors?.length).toBeGreaterThan(0);
  });

  test('any logged-in user sees it, whatever their rights (UND-029, characterised: the query checks no right)', { tag: ['@GRP-WAI-004'] }, async ({ app, as }) => {
    const s = await scenario();
    const outsider = await as(s.users.vendor); // not a member of the group

    const res = await app.api.waitingList.of(outsider.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.getWaitingListsOfGroup.map((w) => w.userId)).toEqual([s.users.nonMember.id]);
  });
});

test.describe('the waiting list as a list of the members page', () => {
  test('it is counted among the lists of the group', { tag: ['@GRP-WAI-013'] }, async ({ app, as }) => {
    const s = await scenario();
    await make.waitingList({ group: s.group, user: await make.user() });
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.lists(m.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.getUserLists.find((l) => l.type === 'waitingList')?.count).toBe(2);
  });

  test('its people are the people who wait, not the members', { tag: ['@GRP-WAI-013'] }, async ({ app, as }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.listUsers(m.request, { listType: 'waitingList', groupId: s.group.id });

    expect(res.errors).toBeNull();
    expect(res.data!.getUserListInGroupByListType.map((u) => u.id)).toEqual([s.users.nonMember.id]);
  });

  test('the people of the whole-group list do not include them', { tag: ['@GRP-WAI-013'] }, async ({ app, as }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.members.listUsers(m.request, { listType: 'all', groupId: s.group.id });

    expect(res.data!.getUserListInGroupByListType.map((u) => u.id)).not.toContain(s.users.nonMember.id);
  });
});

test.describe('approving a request', () => {
  test('the person becomes a member and leaves the waiting list', { tag: ['@GRP-WAI-005'] }, async ({ app, as }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.approve(m.request, s.group.id, s.users.nonMember.id);

    expect(res.errors).toBeNull();
    expect(res.data!.approveRequest).toEqual({ groupId: s.group.id, userId: s.users.nonMember.id });
    expect(await query('SELECT balance, rights FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.nonMember.id, s.group.id])).toEqual([{ balance: 0, rights: null }]);
    expect(await waiting(s.users.nonMember.id, s.group.id)).toEqual([]);
  });

  test('the person is told, and so are the other membership managers (not the one who approved)', { tag: ['@GRP-WAI-005'] }, async ({ app, as, mails }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);
    const mark = await mails.mark();

    await app.api.waitingList.approve(m.request, s.group.id, s.users.nonMember.id);

    const toPerson = await mails.to(s.users.nonMember.email, mark);
    expect(toPerson.map((x) => x.title)).toEqual(["Demande d'adhésion acceptée."]);
    expect(toPerson[0].htmlBody).toContain('AMAP des Tests');
    const toAdmin = await mails.to(s.users.groupAdmin.email, mark);
    expect(toAdmin).toHaveLength(1);
    expect(toAdmin[0].title).toContain('a été acceptée par');
    expect(await mails.to(s.users.membershipManager.email, mark)).toEqual([]);
    // people who cannot manage members are not told
    expect(await mails.to(s.users.coordinator.email, mark)).toEqual([]);
    expect(await mails.to(s.users.messagesManager.email, mark)).toEqual([]);
    expect(await mails.to(s.users.member.email, mark)).toEqual([]);
  });

  test('a superadmin can approve too', { tag: ['@GRP-WAI-005'] }, async ({ app, as }) => {
    const s = await scenario();
    const admin = await as(s.users.superadmin);

    const res = await app.api.waitingList.approve(admin.request, s.group.id, s.users.nonMember.id);

    expect(res.errors).toBeNull();
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(1);
  });

  test('someone who is not on the waiting list cannot be approved', { tag: ['@GRP-WAI-005'] }, async ({ app, as, mails }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.waitingList.approve(m.request, s.group.id, s.users.vendor.id);

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toMatch(/not in waiting list/);
    expect(await memberOf(s.users.vendor.id, s.group.id)).toBe(0);
    expect(await mails.since(mark)).toEqual([]);
  });

  test('the waiting list of another group does not count', { tag: ['@GRP-WAI-005'] }, async ({ app, as }) => {
    const s = await scenario();
    const other = await make.group({ name: 'Autre AMAP', regOption: 'WaitingList', contact: await make.user() });
    await make.waitingList({ group: other, user: s.users.vendor });
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.approve(m.request, s.group.id, s.users.vendor.id);

    expect(res.data).toBeNull();
    expect(await waiting(s.users.vendor.id, other.id)).toHaveLength(1);
  });

  test('a person who is already a member gets no second membership; the request is still cleared', { tag: ['@GRP-WAI-012'] }, async ({ app, as }) => {
    const s = await scenario();
    await make.waitingList({ group: s.group, user: s.users.member, message: 'oups' });
    await query('UPDATE UserGroup SET balance = 12 WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.approve(m.request, s.group.id, s.users.member.id);

    expect(res.errors).toBeNull();
    expect(await query('SELECT balance FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id])).toEqual([{ balance: 12 }]);
    expect(await waiting(s.users.member.id, s.group.id)).toEqual([]);
  });
});

test.describe('refusing a request', () => {
  test('the request disappears and the person does not join', { tag: ['@GRP-WAI-006'] }, async ({ app, as }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.refuse(m.request, s.group.id, s.users.nonMember.id);

    expect(res.errors).toBeNull();
    expect(res.data!.cancelRequest).toEqual({ amapId: s.group.id, userId: s.users.nonMember.id });
    expect(await waiting(s.users.nonMember.id, s.group.id)).toEqual([]);
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
  });

  test('the person receives an email', { tag: ['@GRP-WAI-006'] }, async ({ app, as, mails }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);
    const mark = await mails.mark();

    await app.api.waitingList.refuse(m.request, s.group.id, s.users.nonMember.id);

    const toPerson = await mails.to(s.users.nonMember.email, mark);
    expect(toPerson.map((x) => x.title)).toEqual(["Demande d'adhésion refusée."]);
    expect(toPerson[0].htmlBody).toContain('AMAP des Tests');
    expect(toPerson[0].htmlBody).toContain('refusée');
  });

  test('the other membership managers are told one by one, not the one who refused (beyond the spec)', { tag: ['@GRP-WAI-006'] }, async ({ app, as, mails }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);
    const mark = await mails.mark();

    await app.api.waitingList.refuse(m.request, s.group.id, s.users.nonMember.id);

    // the mutation does not wait for these mails: poll
    await expect.poll(async () => (await mails.to(s.users.groupAdmin.email, mark)).length).toBe(1);
    const toAdmin = await mails.to(s.users.groupAdmin.email, mark);
    expect(toAdmin[0].title).toContain('a été refusée par');
    expect(await mails.to(s.users.membershipManager.email, mark)).toEqual([]);
    expect(await mails.to(s.users.messagesManager.email, mark)).toEqual([]);
  });

  test('someone who is not on the waiting list cannot be refused', { tag: ['@GRP-WAI-006'] }, async ({ app, as, mails }) => {
    const s = await scenario();
    const m = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.waitingList.refuse(m.request, s.group.id, s.users.vendor.id);

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toMatch(/not in waiting list/);
    expect(await mails.since(mark)).toEqual([]);
  });
});

test.describe('without the membership right', () => {
  for (const [label, who] of refusedWho) {
    test(`${label} cannot approve or refuse`, { tag: ['@GRP-WAI-008'] }, async ({ app, as, mails }) => {
      const s = await scenario();
      const u = await as(s.users[who]);
      const mark = await mails.mark();

      const approve = await app.api.waitingList.approve(u.request, s.group.id, s.users.nonMember.id);
      const refuse = await app.api.waitingList.refuse(u.request, s.group.id, s.users.nonMember.id);

      for (const res of [approve, refuse]) {
        expect(res.data).toBeNull();
        expect(res.errors?.[0].message).toMatch(/cannot access membership/);
      }
      expect(await waiting(s.users.nonMember.id, s.group.id)).toHaveLength(1);
      expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
      expect(await mails.since(mark)).toEqual([]);
    });

    test(`${label} cannot move members back`, { tag: ['@GRP-WAI-008'] }, async ({ app, as }) => {
      const s = await scenario();
      const u = await as(s.users[who]);

      const res = await app.api.waitingList.moveBack(u.request, s.group.id, [s.users.member2.id], 'non');

      expect(res.data).toBeNull();
      expect(res.errors?.[0].message).toMatch(/cannot access membership management/);
      expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
      expect(await waiting(s.users.member2.id, s.group.id)).toEqual([]);
    });
  }

  test('a group admin without the membership right cannot approve, refuse or move back', { tag: ['@GRP-WAI-008'] }, async ({ app, as }) => {
    const s = await scenario();
    const a = await as(await adminWithoutMembershipRight(s));

    const approve = await app.api.waitingList.approve(a.request, s.group.id, s.users.nonMember.id);
    const refuse = await app.api.waitingList.refuse(a.request, s.group.id, s.users.nonMember.id);
    const move = await app.api.waitingList.moveBack(a.request, s.group.id, [s.users.member.id], 'non');

    for (const res of [approve, refuse, move]) {
      expect(res.data).toBeNull();
      expect(res.errors?.length).toBeGreaterThan(0);
    }
    expect(await waiting(s.users.nonMember.id, s.group.id)).toHaveLength(1);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('a manager of another group has no say here', { tag: ['@GRP-WAI-008'] }, async ({ app, as }) => {
    const s = await scenario();
    const other = await make.group({ name: 'Autre AMAP', contact: await make.user() });
    const stranger = await make.user();
    await make.userGroup({ user: stranger, group: other, rights: [Right.Membership()] });
    const u = await as(stranger);

    const res = await app.api.waitingList.approve(u.request, s.group.id, s.users.nonMember.id);

    expect(res.data).toBeNull();
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
  });
});

test.describe('moving members back to the waiting list (GraphQL)', () => {
  test('the members leave the group and wait with the message', { tag: ['@GRP-WAI-007', '@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.moveBack(m.request, s.group.id, [s.users.member.id, s.users.member2.id], "Remis en liste d'attente par Adèle");

    expect(res.errors).toBeNull();
    expect(res.data!.moveBackToWaitingList.errors).toEqual([]);
    expect(res.data!.moveBackToWaitingList.success.map((w) => w.userId).sort()).toEqual([s.users.member.id, s.users.member2.id].sort());
    for (const u of [s.users.member, s.users.member2]) {
      expect(await memberOf(u.id, s.group.id)).toBe(0);
      expect(await waiting(u.id, s.group.id)).toEqual([{ message: "Remis en liste d'attente par Adèle" }]);
    }
  });

  test('the manager cannot put themselves back, the others still move', { tag: ['@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.moveBack(m.request, s.group.id, [s.users.membershipManager.id, s.users.member.id], 'msg');

    expect(res.errors).toBeNull();
    expect(res.data!.moveBackToWaitingList.errors).toEqual([{ userId: s.users.membershipManager.id, message: 'cannotSetSelfToWaitingList' }]);
    expect(await memberOf(s.users.membershipManager.id, s.group.id)).toBe(1);
    expect(await waiting(s.users.membershipManager.id, s.group.id)).toEqual([]);
    expect(await waiting(s.users.member.id, s.group.id)).toHaveLength(1);
  });

  test('a group admin cannot be put back', { tag: ['@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.moveBack(m.request, s.group.id, [s.users.groupAdmin.id], 'msg');

    expect(res.data!.moveBackToWaitingList.success).toEqual([]);
    expect(res.data!.moveBackToWaitingList.errors).toEqual([{ userId: s.users.groupAdmin.id, message: 'cannotSetAdminToWaitingLIst' }]);
    expect(await memberOf(s.users.groupAdmin.id, s.group.id)).toBe(1);
    expect(await waiting(s.users.groupAdmin.id, s.group.id)).toEqual([]);
  });

  test('someone who is not a member of the group cannot be put back', { tag: ['@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.moveBack(m.request, s.group.id, [s.users.nonMember.id], 'msg');

    expect(res.data!.moveBackToWaitingList.success).toEqual([]);
    expect(res.data!.moveBackToWaitingList.errors).toEqual([{ userId: s.users.nonMember.id, message: 'userNotInGroup' }]);
    expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
  });

  test('a member who already waits loses the membership and keeps one entry, with the new message (UND-034, characterised: no duplicate check)', { tag: ['@GRP-WAI-007'] }, async ({ app, as }) => {
    // hx's own move-back link refuses this case (waiting-list.forms.spec.ts); the Nest mutation does not check
    const s = await make.amapScenario();
    await make.waitingList({ group: s.group, user: s.users.member, message: 'ancien' });
    const m = await as(s.users.membershipManager);

    const res = await app.api.waitingList.moveBack(m.request, s.group.id, [s.users.member.id], 'nouveau');

    // the response itself fails ("Cannot return null for non-nullable field WaitingList.amapId"), the changes are kept
    expect(res.status).toBe(200);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
    expect(await waiting(s.users.member.id, s.group.id)).toEqual([{ message: 'nouveau' }]);
  });
});
