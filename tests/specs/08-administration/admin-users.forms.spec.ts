/**
 * User administration actions of a superadmin: delete an account, log in as a user, move the data of
 * the deleted user (specs/08-administration/admin-users.md; controller/admin/User.hx doDelete,
 * controller/Member.hx doLoginas, controller/Subscriptions.hx doReattribute).
 *
 * The deletion itself is done by Nest (`/bridge/auth/delete-user/:id`); its rules are the self-deletion
 * rules of 01-accounts (ACC-DEL-002 to ACC-DEL-004), tested in 01-accounts/profile-account.graphql.spec.ts.
 * What is specific here is the entry point: a plain link of the back-office, with no confirmation or
 * security token on the server side, which never shows why a deletion is refused (UND-022, undecided).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { execute, query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const DELETE_ACCOUNT = `mutation($id: Int!, $password: String!) { deleteAccount(userId: $id, password: $password) }`;

const exists = async (userId: number) => (await query('SELECT id FROM User WHERE id = ?', [userId])).length === 1;
const deletedId = async () => (await queryOne<{ id: number }>("SELECT id FROM User WHERE email = 'deleted@camap.tld'"))!.id;
/** A member allowed to be deleted: balance zero (and orders, if any, made long ago). */
async function deletable(userId: number) {
  await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [userId]);
  await execute("UPDATE UserOrder SET date = '2020-01-01 10:00:00' WHERE userId = ? OR userId2 = ?", [userId, userId]);
}

test.describe('deleting an account from the back-office', () => {
  test('a superadmin deletes a member: the account and the memberships are gone, and the back-office user page is shown', { tag: ['@ADM-USR-003', '@ADM-TLS-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await deletable(s.users.member.id);
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.deleteUser(admin.request, s.users.member.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/admin/user');
    expect(await exists(s.users.member.id)).toBe(false);
    expect(await query('SELECT userId FROM UserGroup WHERE userId = ?', [s.users.member.id])).toEqual([]);
    // the other accounts are untouched
    expect(await exists(s.users.member2.id)).toBe(true);
  });

  test('the data of the account stays under the deleted user', { tag: ['@ADM-USR-003'] }, async ({ app, as }) => {
    // ACC-DEL-004: subscriptions, orders, non-zero operations move; zero-amount operations are deleted
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    const paid = await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 12, name: 'Chèque' });
    const zero = await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 0, name: 'Zéro' });
    await deletable(s.users.member.id);
    const deleted = await deletedId();
    const admin = await as(s.users.superadmin);

    await app.actions.admin.deleteUser(admin.request, s.users.member.id);

    expect(await exists(s.users.member.id)).toBe(false);
    expect((await queryOne<{ userId: number }>('SELECT userId FROM Subscription WHERE id = ?', [sub.id]))!.userId).toBe(deleted);
    expect(await query('SELECT DISTINCT userId FROM UserOrder WHERE subscriptionId = ?', [sub.id])).toEqual([{ userId: deleted }]);
    expect((await queryOne<{ userId: number }>('SELECT userId FROM Operation WHERE id = ?', [paid.id]))!.userId).toBe(deleted);
    expect(await query('SELECT id FROM Operation WHERE id = ?', [zero.id])).toEqual([]);
  });

  test('a link is enough: no password, no security token, no confirmation is asked by the server', { tag: ['@ADM-USR-003'] }, async ({ app, as }) => {
    // Characterised as it is today (finding): a plain GET deletes an account, so any page the superadmin
    // is led to open (an image link, a redirect) can delete users.
    const s = await make.amapScenario();
    await deletable(s.users.nonMember.id);
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.deleteUser(admin.request, s.users.nonMember.id);

    expect(res.status).toBe(302);
    expect(await exists(s.users.nonMember.id)).toBe(false);
  });

  test('an account with an order placed in the last two months is kept, and no reason is shown (UND-022, characterised)', { tag: ['@ADM-USR-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await subscribeConst(app, member.request, s, s.users.member.id);
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]); // orders are recent
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.deleteUser(admin.request, s.users.member.id);

    expect(await exists(s.users.member.id)).toBe(true);
    // UND-022: today the refusal is swallowed and the redirect is the same as for a success
    expect(res.status).toBe(302);
    expect(res.location).toBe('/admin/user');
    expect(res.flash).toBeNull();
  });

  test('an account with a negative balance is kept', { tag: ['@ADM-USR-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await execute('UPDATE UserGroup SET balance = -12 WHERE userId = ?', [s.users.member.id]);
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.deleteUser(admin.request, s.users.member.id);

    expect(res.location).toBe('/admin/user');
    expect(await exists(s.users.member.id)).toBe(true);
    expect(await query('SELECT userId FROM UserGroup WHERE userId = ?', [s.users.member.id])).toHaveLength(1);
  });

  test('only a superadmin can delete an account', { tag: ['@ADM-USR-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await deletable(s.users.member2.id);

    for (const who of [await as(s.users.groupAdmin), await as(s.users.member), await as('anon')]) {
      const res = await app.actions.admin.deleteUser(who.request, s.users.member2.id);
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
    }
    expect(await exists(s.users.member2.id)).toBe(true);
  });

  test('the deleted placeholder itself cannot be deleted', { tag: ['@ADM-USR-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const deleted = await deletedId();
    const admin = await as(s.users.superadmin);

    await app.actions.admin.deleteUser(admin.request, deleted);

    expect(await exists(deleted)).toBe(true);
  });
});

test.describe('the placeholder "deleted" user is missing (DECISION UND-110)', () => {
  test('a superadmin who deletes an account is told it failed, and the account stays', { tag: ['@ADM-USR-006'] }, async ({ app, as }) => {
    deviation('UND-110');
    const s = await make.amapScenario();
    await deletable(s.users.member.id);
    await execute("DELETE FROM User WHERE email = 'deleted@camap.tld'");
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.deleteUser(admin.request, s.users.member.id);

    // nothing is deleted today either...
    expect(await exists(s.users.member.id)).toBe(true);
    // ...but the decided behaviour is a loud failure, today the redirect is silent
    expect(res.flash?.kind).toBe('error');
  });

  test('a user deleting their own account gets an error and the account stays', { tag: ['@ADM-USR-006'] }, async ({ app, as }) => {
    // already the decided behaviour on this path: the GraphQL mutation fails
    const s = await make.amapScenario();
    await deletable(s.users.member.id);
    await execute("DELETE FROM User WHERE email = 'deleted@camap.tld'");
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, DELETE_ACCOUNT, { id: s.users.member.id, password: s.users.member.password });

    expect(await exists(s.users.member.id)).toBe(true);
    expect(res.errors?.length).toBeGreaterThan(0);
  });

  test('a failed self-deletion neither logs the user out nor tells the group admins', { tag: ['@ADM-USR-006'] }, async ({ app, as, mails }) => {
    deviation('CODE-056'); // ACC-DEL-005 / ACC-DEL-008
    const s = await make.amapScenario();
    await deletable(s.users.member.id);
    await execute("DELETE FROM User WHERE email = 'deleted@camap.tld'");
    const member = await as(s.users.member);
    const mark = await mails.mark();

    await app.graphql(member.request, DELETE_ACCOUNT, { id: s.users.member.id, password: s.users.member.password });

    expect((await app.graphql(member.request, 'query { me { id } }')).data?.me?.id).toBe(s.users.member.id);
    expect(await mails.to(s.users.groupAdmin.email, mark)).toEqual([]);
  });
});

test.describe('logging in as a user', () => {
  test('a superadmin opens the session of a user from the user sheet, without a current group', { tag: ['@ADM-USR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const sheet = await app.views.admin.user(admin.request, s.users.member.id);
    expect(sheet.offers.loginAs).toBe(true);

    const res = await app.actions.members.loginAs(admin.request, s.users.member.id);

    expect(res.sessionUserId).toBe(s.users.member.id);
    // the session is now the member's: the back-office is closed, and the group has to be chosen again
    const dashboard = await app.views.admin.dashboard(admin.request);
    expect(dashboard.status).toBe(302);
    expect(dashboard.location).toBe('/');
    const home = await app.views.groups.homeAlerts(admin.request);
    expect(home.location).toBe('/user/choose');
  });

  test('a superadmin can log in as a user who belongs to several groups', { tag: ['@ADM-USR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    const admin = await as(s.users.superadmin);

    const res = await app.actions.members.loginAs(admin.request, s.users.member.id);

    expect(res.sessionUserId).toBe(s.users.member.id);
  });

  test('a superadmin can log in as a user who belongs to no group', { tag: ['@ADM-USR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.actions.members.loginAs(admin.request, s.users.nonMember.id);

    expect(res.sessionUserId).toBe(s.users.nonMember.id);
  });
});

test.describe('moving the data of the deleted user', () => {
  test('all the orders and baskets of the subscription follow it, and other subscriptions stay where they are', { tag: ['@ADM-USR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const deleted = await deletedId();
    await make.userGroup({ user: { id: deleted }, group: s.group, rights: [] });
    const coordinator = await as(s.users.coordinator);
    const orphan = await subscribeConst(app, coordinator.request, s, deleted);
    const member = await as(s.users.member);
    const mine = await subscribeConst(app, member.request, s, s.users.member.id);
    const orphanOrders = await query<{ id: number }>('SELECT id FROM UserOrder WHERE subscriptionId = ?', [orphan.id]);
    expect(orphanOrders.length).toBeGreaterThan(1);
    const admin = await as(s.users.superadmin);

    const res = await app.actions.subscriptionAdmin.reattribute(admin.request, orphan.id, s.users.member2.id);

    expect(res.location).toBe(`/contractAdmin/subscriptions/edit/${orphan.id}`);
    expect(await query('SELECT DISTINCT userId FROM UserOrder WHERE subscriptionId = ?', [orphan.id])).toEqual([{ userId: s.users.member2.id }]);
    expect(await query('SELECT DISTINCT b.userId FROM Basket b JOIN UserOrder o ON o.basketId = b.id WHERE o.subscriptionId = ?', [orphan.id])).toEqual([{ userId: s.users.member2.id }]);
    expect((await queryOne<{ userId: number }>('SELECT userId FROM Subscription WHERE id = ?', [mine.id]))!.userId).toBe(s.users.member.id);
    expect(await query('SELECT DISTINCT userId FROM UserOrder WHERE subscriptionId = ?', [mine.id])).toEqual([{ userId: s.users.member.id }]);
  });

  test('a visitor cannot reattribute', { tag: ['@ADM-USR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const deleted = await deletedId();
    await make.userGroup({ user: { id: deleted }, group: s.group, rights: [] });
    const coordinator = await as(s.users.coordinator);
    const orphan = await subscribeConst(app, coordinator.request, s, deleted);
    const visitor = await as('anon');

    await app.actions.subscriptionAdmin.reattribute(visitor.request, orphan.id, s.users.member.id);

    expect((await queryOne<{ userId: number }>('SELECT userId FROM Subscription WHERE id = ?', [orphan.id]))!.userId).toBe(deleted);
  });
});
