/**
 * Quitting a group (specs/02-groups/join-quit.md; camap-ts groups.resolver.ts quitGroup,
 * quitGroupByControlKey). The hx quit pages only check and hand over to these mutations
 * (join-quit.forms.spec.ts). profile-account.graphql.spec.ts does not cover quitGroup.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;

test.describe('quitting from the account page (logged in)', () => {
  test('a member quits a group: they are no longer a member of it, and only of it', { tag: ['@GRP-JOI-004', '@GRP-JOI-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    const m = await as(s.users.member);

    const res = await app.api.groups.quit(m.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.quitGroup).toEqual({ userId: s.users.member.id, groupId: s.group.id });
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
    expect(await memberOf(s.users.member.id, other.id)).toBe(1);
    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
  });

  test('a visitor cannot quit with this mutation', { tag: ['@GRP-JOI-004'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.groups.quit(anon.request, s.group.id);

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('a user cannot quit a group they are not a member of', { tag: ['@GRP-JOI-004', '@GRP-JOI-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const n = await as(s.users.nonMember);

    const res = await app.api.groups.quit(n.request, s.group.id);

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('a user cannot quit a group that does not exist', { tag: ['@GRP-JOI-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.api.groups.quit(m.request, s.group.id + 1000);

    expect(res.errors?.length).toBeGreaterThan(0);
  });

  test('a member who quit cannot quit twice', { tag: ['@GRP-JOI-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await app.api.groups.quit(m.request, s.group.id);

    const again = await app.api.groups.quit(m.request, s.group.id);

    expect(again.errors?.length).toBeGreaterThan(0);
  });

  test('a negative balance refuses the quit', { tag: ['@GRP-JOI-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await execute('UPDATE UserGroup SET balance = -0.5 WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);

    const res = await app.api.groups.quit(m.request, s.group.id);

    expect(res.errors?.[0].message).toMatch(/unableToQuitGroupNegativeBalance/);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('a zero or positive balance does not refuse the quit', { tag: ['@GRP-JOI-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await execute('UPDATE UserGroup SET balance = 12 WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);
    const m = await as(s.users.member);

    const res = await app.api.groups.quit(m.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
  });
});

test.describe('quitting with the key of an email footer (no login)', () => {
  test('a visitor with the personal key quits the group', { tag: ['@GRP-JOI-005', '@GRP-JOI-009'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const u = s.users.member;

    const res = await app.api.groups.quitByControlKey(anon.request, { groupId: s.group.id, userId: u.id, controlKey: app.actions.group.quitKey(s.group.id, u.id) });

    expect(res.errors).toBeNull();
    expect(res.data!.quitGroupByControlKey).toEqual({ userId: u.id, groupId: s.group.id });
    expect(await memberOf(u.id, s.group.id)).toBe(0);
    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
  });

  test('a wrong key, the key of another member or of another group is refused', { tag: ['@GRP-JOI-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    const u = s.users.member;
    const keys = ['not-the-key', app.actions.group.quitKey(s.group.id, s.users.member2.id), app.actions.group.quitKey(other.id, u.id), app.actions.group.quitKeyFromMessage(s.group.id)];

    for (const controlKey of keys) {
      const res = await app.api.groups.quitByControlKey(anon.request, { groupId: s.group.id, userId: u.id, controlKey });
      expect(res.errors?.length).toBeGreaterThan(0);
    }
    expect(await memberOf(u.id, s.group.id)).toBe(1);
  });

  test('a valid key of a user who is not a member is refused', { tag: ['@GRP-JOI-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const u = s.users.nonMember;

    const res = await app.api.groups.quitByControlKey(anon.request, { groupId: s.group.id, userId: u.id, controlKey: app.actions.group.quitKey(s.group.id, u.id) });

    expect(res.errors?.length).toBeGreaterThan(0);
  });

  test('a negative balance refuses the quit', { tag: ['@GRP-JOI-005', '@GRP-JOI-007'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const u = s.users.member;
    await execute('UPDATE UserGroup SET balance = -5 WHERE userId = ? AND groupId = ?', [u.id, s.group.id]);

    const res = await app.api.groups.quitByControlKey(anon.request, { groupId: s.group.id, userId: u.id, controlKey: app.actions.group.quitKey(s.group.id, u.id) });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await memberOf(u.id, s.group.id)).toBe(1);
  });

  test('a logged-in member who opened a message footer link quits with the ids the page hands over', { tag: ['@GRP-JOI-006'] }, async ({ app, as }) => {
    // the message footer link has no user id: the hx page gives the widget the id of the logged-in user,
    // and the widget quits with the personal key of that user
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const page = await app.actions.group.openQuitLinkFromMessage(m.request, { groupId: s.group.id, key: app.actions.group.quitKeyFromMessage(s.group.id) });

    const res = await app.api.groups.quitByControlKey(m.request, { groupId: page.offered!.groupId, userId: page.offered!.userId!, controlKey: app.actions.group.quitKey(s.group.id, s.users.member.id) });

    expect(res.errors).toBeNull();
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
  });
});

test.describe('recent orders (UND-027, undecided: characterised as the TS mutation does it)', () => {
  const mutations = ['quit', 'quitByControlKey'] as const;

  for (const how of mutations) {
    test(`an order made less than a month ago refuses the quit (${how})`, { tag: ['@GRP-JOI-008'] }, async ({ app, as, anon }) => {
      const s = await make.amapScenario();
      const m = await as(s.users.member);
      await subscribeConst(app, m.request, s, s.users.member.id);
      await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);

      const res =
        how === 'quit'
          ? await app.api.groups.quit(m.request, s.group.id)
          : await app.api.groups.quitByControlKey(anon.request, { groupId: s.group.id, userId: s.users.member.id, controlKey: app.actions.group.quitKey(s.group.id, s.users.member.id) });

      expect(res.errors?.[0].message).toMatch(/commandes trop récentes/);
      expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
    });
  }

  test('an order dated more than a month ago does not refuse the quit, even in an active catalog (the Haxe link page would refuse)', { tag: ['@GRP-JOI-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id);
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);
    await execute("UPDATE UserOrder SET date = '2020-01-01 10:00:00' WHERE userId = ?", [s.users.member.id]);

    const res = await app.api.groups.quit(m.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
  });

  test('recent orders in another group do not refuse the quit', { tag: ['@GRP-JOI-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id); // recent orders in the scenario group only

    const res = await app.api.groups.quit(m.request, other.id);

    expect(res.errors).toBeNull();
    expect(await memberOf(s.users.member.id, other.id)).toBe(0);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('orders of another member do not refuse the quit', { tag: ['@GRP-JOI-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m2 = await as(s.users.member2);
    await subscribeConst(app, m2.request, s, s.users.member2.id);
    const m = await as(s.users.member);

    const res = await app.api.groups.quit(m.request, s.group.id);

    expect(res.errors).toBeNull();
  });
});

test.describe('the group identity (UND-027, undecided: characterised as the TS mutation does it)', () => {
  test('group 16936 cannot be quit, whatever the balance and the orders (hard-coded in camap-ts)', { tag: ['@GRP-JOI-010'] }, async ({ app, as }) => {
    const user = await make.user();
    const g = await make.group({ name: 'Groupe protégé' });
    await execute('UPDATE `Group` SET id = 16936 WHERE id = ?', [g.id]);
    await make.userGroup({ user, group: { id: 16936 } });
    const m = await as(user);

    const res = await app.api.groups.quit(m.request, 16936);

    expect(res.errors?.[0].message).toMatch(/Vous ne pouvez pas quitter ce groupe/);
    expect(await memberOf(user.id, 16936)).toBe(1);
  });

  test('a member of any other group quits it whatever its name or joining mode', { tag: ['@GRP-JOI-010'] }, async ({ app, as }) => {
    const user = await make.user();
    const g = await make.group({ regOption: 'Closed' });
    await make.userGroup({ user, group: g });
    const m = await as(user);

    const res = await app.api.groups.quit(m.request, g.id);

    expect(res.errors).toBeNull();
    expect(await memberOf(user.id, g.id)).toBe(0);
  });
});
