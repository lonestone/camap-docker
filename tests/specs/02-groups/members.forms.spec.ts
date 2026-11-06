/**
 * Removing a member from the group with the link of the member sheet
 * (specs/02-groups/members.md; camap-hx controller/Member.hx doDelete).
 * The same removal through GraphQL is in members.graphql.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';

const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;

/** One order (quantity 1) of `user` on the first distribution of the variable catalog. */
async function orderOf(s: make.AmapScenario, user: { id: number }, quantity = 1) {
  const basket = await make.basket({ user, multiDistrib: s.multiDistribs[0] });
  await make.userOrder({ user, product: s.products.var[0], distribution: s.distributions[0].var, basket, quantity });
}

test.describe('removing a member', () => {
  test('a membership manager removes a member: only the membership of this group is deleted', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.member.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/member');
    expect(res.flash?.kind).toBe('ok');
    expect(res.flash?.text).toContain('Martine');
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
    expect(await memberOf(s.users.member.id, other.id)).toBe(1);
    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
    expect(await query('SELECT id FROM User WHERE id = ?', [s.users.member.id])).toHaveLength(1); // the account stays
  });

  test('a membership manager cannot remove themself', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.membershipManager.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/member/view/${s.users.membershipManager.id}`);
    expect(res.flash?.kind).toBe('error');
    expect(await memberOf(s.users.membershipManager.id, s.group.id)).toBe(1);
  });

  test('a group admin can be removed from the sheet: only GraphQL protects admins (characterised)', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    // The spec says an admin cannot be removed (checked by the GraphQL mutation, members.graphql.spec.ts);
    // the hx link only refuses to remove oneself.
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.groupAdmin.id);

    expect(res.status).toBe(302);
    expect(res.flash?.kind).toBe('ok');
    expect(await memberOf(s.users.groupAdmin.id, s.group.id)).toBe(0);
  });

  test('a person who is not in the group cannot be removed', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.nonMember, group: other });
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);
    const res = await app.actions.members.remove(m.request, s.users.nonMember.id);

    expect(res.status).toBe(302);
    expect(res.flash?.kind).toBe('error');
    expect(await memberOf(s.users.nonMember.id, other.id)).toBe(1);
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} cannot remove a member`, { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);
      await app.actions.group.select(u.request, s.group.id);

      const res = await app.actions.members.remove(u.request, s.users.member2.id, { token: 'f'.repeat(32) });

      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
    });
  }

  test('a group admin without the membership right cannot remove a member', { tag: ['@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await make.user();
    await make.userGroup({ user: admin, group: s.group, rights: [Right.GroupAdmin()] });
    const a = await as(admin);
    await app.actions.group.select(a.request, s.group.id);

    const res = await app.actions.members.remove(a.request, s.users.member2.id, { token: 'f'.repeat(32) });

    expect(res.location).toBe('/');
    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
  });
});

test.describe('removing a member who has orders (UND-028)', () => {
  test('the removal asks for a confirmation and nothing is deleted', { tag: ['@GRP-MEM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await orderOf(s, s.users.member);
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.member.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/member/view/${s.users.member.id}`);
    expect(res.flash?.kind).toBe('error');
    expect(res.flash?.text).toMatch(/commandes/);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('the member is removed once the manager confirms', { tag: ['@GRP-MEM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await orderOf(s, s.users.member);
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.member.id, { confirm: true });

    expect(res.location).toBe('/member');
    expect(res.flash?.kind).toBe('ok');
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
  });

  test('an order of quantity 0 does not count', { tag: ['@GRP-MEM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await orderOf(s, s.users.member, 0);
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.member.id);

    expect(res.flash?.kind).toBe('ok');
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
  });

  test('the confirmation does not skip the other checks: nobody removes themself', { tag: ['@GRP-MEM-006', '@GRP-MEM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.membershipManager.id, { confirm: true });

    expect(res.flash?.kind).toBe('error');
    expect(await memberOf(s.users.membershipManager.id, s.group.id)).toBe(1);
  });
});

test.describe('the security token of a removal', () => {
  test('a removal without a token is refused and the member stays', { tag: ['@GRP-MEM-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.member.id, { token: false });

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/member/view/${s.users.member.id}`);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('a removal with a wrong token is refused', { tag: ['@GRP-MEM-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.remove(m.request, s.users.member.id, { token: '0123456789abcdef0123456789abcdef' });

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/member/view/${s.users.member.id}`);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('the token of the session works: the same removal then succeeds', { tag: ['@GRP-MEM-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const refused = await app.actions.members.remove(m.request, s.users.member.id, { token: false });
    const done = await app.actions.members.remove(m.request, s.users.member.id);

    expect(refused.flash).toBeNull();
    expect(done.flash?.kind).toBe('ok');
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
  });
});
