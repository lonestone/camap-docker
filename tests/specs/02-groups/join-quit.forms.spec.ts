/**
 * Joining a group and the quit links of the email footers (specs/02-groups/join-quit.md;
 * camap-hx controller/User.hx doJoingroup, doQuitGroup, doQuitGroupFromMessage).
 *
 * The quit itself is a GraphQL mutation (join-quit.graphql.spec.ts): the hx pages here only
 * check the key, the orders and the balance, then hand the ids to the quit widget.
 * Already covered elsewhere: the join of an open group (group-settings.forms GRP-SET-003,
 * group-public-page.views GRP-PUB-005), the waiting list (GRP-SET-003).
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query } from '../../src/db/client.js';
import { md5Password } from '../../src/encodings/passwords.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;

test.describe('joining an open group', () => {
  test('a logged-in user joins the open group they looked at and lands on the home page', { tag: ['@GRP-JOI-001'] }, async ({ app, as }) => {
    const g = await make.group({ name: 'AMAP ouverte', regOption: 'Open', contact: await make.user() });
    await make.place({ group: g });
    const user = await make.user();
    const s = await as(user);
    await app.views.groups.page(s.request, g.id); // the open group is remembered by the session

    const res = await app.actions.group.join(s.request);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(await query('SELECT balance, rights FROM UserGroup WHERE userId = ? AND groupId = ?', [user.id, g.id])).toEqual([{ balance: 0, rights: null }]);
  });

  test('joining a group again does not duplicate the membership', { tag: ['@GRP-JOI-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await app.views.groups.page(m.request, s.group.id);

    const res = await app.actions.group.join(m.request);

    expect(res.status).toBe(302);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('the contact of the group is not mailed when a newcomer joins (spec says it is: the check runs after the membership is created)', { tag: ['@GRP-JOI-002'] }, async ({ app, as, mails }) => {
    // doJoingroup creates the UserGroup, then tests `!isMemberOf(group)`, which is always false by then
    const s = await make.amapScenario();
    const n = await as(s.users.nonMember);
    await app.views.groups.page(n.request, s.group.id);
    const mark = await mails.mark();

    await app.actions.group.join(n.request);

    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(1);
    expect(await mails.to(s.users.groupAdmin.email, mark)).toEqual([]);
  });

  test('a closed group cannot be joined by the user themselves', { tag: ['@GRP-JOI-003'] }, async ({ app, as, errors }) => {
    errors.expect(/not open|no group selected/);
    const g = await make.group({ name: 'AMAP fermée', regOption: 'Closed', contact: await make.user() });
    await make.place({ group: g });
    const user = await make.user();
    const s = await as(user);
    await app.views.groups.page(s.request, g.id);

    const res = await app.actions.group.join(s.request);

    expect(res.status).not.toBe(302);
    expect(await memberOf(user.id, g.id)).toBe(0);
  });
});

test.describe('quit link of an email footer (personal key)', () => {
  test('a visitor with the right key gets the quit confirmation, without logging in', { tag: ['@GRP-JOI-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const u = s.users.member;

    const res = await app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: u.id, key: app.actions.group.quitKey(s.group.id, u.id) });

    expect(res.status).toBe(200);
    expect(res.offered).toEqual({ groupId: s.group.id, userId: u.id });
  });

  test('a wrong key, or the key of another member, is refused', { tag: ['@GRP-JOI-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const wrong = await app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: s.users.member.id, key: 'deadbeef' });
    const other = await app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: s.users.member.id, key: app.actions.group.quitKey(s.group.id, s.users.member2.id) });

    for (const res of [wrong, other]) {
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(res.offered).toBeNull();
    }
  });

  test('a legacy md5 key is still accepted (hx only)', { tag: ['@GRP-JOI-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const u = s.users.member;

    const res = await app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: u.id, key: md5Password(`${s.group.id}${u.id}`) });

    expect(res.status).toBe(200);
    expect(res.offered).toEqual({ groupId: s.group.id, userId: u.id });
  });

  test('a negative balance refuses the quit', { tag: ['@GRP-JOI-007'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const u = s.users.member;
    await execute('UPDATE UserGroup SET balance = -5 WHERE userId = ? AND groupId = ?', [u.id, s.group.id]);

    const res = await app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: u.id, key: app.actions.group.quitKey(s.group.id, u.id) });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.offered).toBeNull();
  });

  test('orders in an active catalog refuse the quit (UND-027, characterised: the Haxe rule looks at distributions)', { tag: ['@GRP-JOI-008'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id);
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]); // only the orders must refuse the quit
    // even an old order counts, as long as the catalog is active
    await execute("UPDATE UserOrder SET date = '2020-01-01 10:00:00' WHERE userId = ?", [s.users.member.id]);

    const res = await app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: s.users.member.id, key: app.actions.group.quitKey(s.group.id, s.users.member.id) });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.offered).toBeNull();
  });

  test('orders of another member do not refuse the quit', { tag: ['@GRP-JOI-008'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member2);
    await subscribeConst(app, m.request, s, s.users.member2.id);

    const res = await app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: s.users.member.id, key: app.actions.group.quitKey(s.group.id, s.users.member.id) });

    expect(res.status).toBe(200);
  });

  test('orders in a catalog ended for more than a month no longer refuse the quit (UND-027, characterised)', { tag: ['@GRP-JOI-008'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id);
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);
    const ended = async (days: number) => {
      await execute(`UPDATE Catalog SET endDate = DATE_SUB(NOW(), INTERVAL ${days} DAY) WHERE id IN (?, ?)`, [s.constCatalog.id, s.varCatalog.id]);
      return app.actions.group.openQuitLink(anon.request, { groupId: s.group.id, userId: s.users.member.id, key: app.actions.group.quitKey(s.group.id, s.users.member.id) });
    };

    const recent = await ended(10);
    const old = await ended(45);

    expect(recent.status).toBe(302); // ended less than a month ago: still counts
    expect(old.status).toBe(200);
  });
});

test.describe('quit link of a group message footer', () => {
  test('a visitor is sent to log in first, then the same link shows the quit confirmation for them', { tag: ['@GRP-JOI-006'] }, async ({ app, anon, as }) => {
    const s = await make.amapScenario();
    const key = app.actions.group.quitKeyFromMessage(s.group.id);

    const visitor = await app.actions.group.openQuitLinkFromMessage(anon.request, { groupId: s.group.id, key });
    const member = await as(s.users.member);
    const res = await app.actions.group.openQuitLinkFromMessage(member.request, { groupId: s.group.id, key });

    expect(visitor.status).toBe(302);
    expect(visitor.location).toContain('__redirect=');
    expect(visitor.offered).toBeNull();
    expect(res.status).toBe(200);
    expect(res.offered).toEqual({ groupId: s.group.id, userId: s.users.member.id });
  });

  test('a wrong key is refused', { tag: ['@GRP-JOI-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.actions.group.openQuitLinkFromMessage(member.request, { groupId: s.group.id, key: app.actions.group.quitKey(s.group.id, s.users.member.id) });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.offered).toBeNull();
  });

  test('a negative balance refuses the quit', { tag: ['@GRP-JOI-006', '@GRP-JOI-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await execute('UPDATE UserGroup SET balance = -5 WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);

    const res = await app.actions.group.openQuitLinkFromMessage(member.request, { groupId: s.group.id, key: app.actions.group.quitKeyFromMessage(s.group.id) });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.offered).toBeNull();
  });

  test('orders in an active catalog refuse the quit (UND-027, characterised)', { tag: ['@GRP-JOI-006', '@GRP-JOI-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await subscribeConst(app, member.request, s, s.users.member.id);
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);

    const res = await app.actions.group.openQuitLinkFromMessage(member.request, { groupId: s.group.id, key: app.actions.group.quitKeyFromMessage(s.group.id) });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.offered).toBeNull();
  });
});
