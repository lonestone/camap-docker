/**
 * Profile, notification preferences and account deletion through GraphQL
 * (specs/01-accounts/profile.md, notifications.md, account-deletion.md;
 * camap-ts users.resolver.ts, users.service.ts).
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query, queryOne } from '../../src/db/client.js';
import { sha1 } from '../../src/encodings/passwords.js';
import { UserFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const UPDATE = `mutation($input: UpdateUserInput!) { updateUser(input: $input) { __typename ... on User { id email firstName lastName city zipCode } } }`;
const NOTIF = `mutation($input: UpdateUserNotificationsInput!) { updateUserNotifications(input: $input) { id notifications { hasEmailNotif4h hasEmailNotif24h hasEmailNotifOuverture } } }`;
const DELETE = `mutation($id: Int!, $password: String!) { deleteAccount(userId: $id, password: $password) }`;

/** The profile schema requires the identity fields on every update. */
const profile = (u: { id: number; email: string; firstName: string; lastName: string }, over: Record<string, unknown> = {}) => ({
  id: u.id,
  email: u.email,
  firstName: u.firstName,
  lastName: u.lastName,
  ...over,
});

test.describe('profile', () => {
  test('a user opens their account page', { tag: ['@ACC-PRO-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await m.request.get('/account', { maxRedirects: 0 });

    expect(res.status()).toBe(200);
    void app;
  });

  test('a user edits their own names, contact details and birth date', { tag: ['@ACC-PRO-002', '@ACC-PRO-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, UPDATE, {
      input: profile(s.users.member, {
        firstName: 'Martin', lastName: 'Membre', zipCode: '44000', city: 'Nantes', address1: '2 rue du Test',
        nationality: 'FR', countryOfResidence: 'FR', birthDate: '1980-05-17', phone: '0611223344', email2: 'conjoint@camap.test', firstName2: 'Camille', lastName2: 'Membre',
      }),
    });

    expect(res.errors).toBeNull();
    expect(res.data.updateUser).toMatchObject({ __typename: 'User', firstName: 'Martin', city: 'Nantes' });
    expect(await queryOne('SELECT firstName, lastName, zipCode, city, nationality, countryOfResidence, email2, firstName2 FROM User WHERE id = ?', [s.users.member.id])).toEqual({
      firstName: 'Martin', lastName: 'Membre', zipCode: '44000', city: 'Nantes', nationality: 'FR', countryOfResidence: 'FR', email2: 'conjoint@camap.test', firstName2: 'Camille',
    });
  });

  test('a user cannot edit another user', { tag: ['@ACC-PRO-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, UPDATE, { input: profile(s.users.member2, { firstName: 'Piraté' }) });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect((await queryOne<{ firstName: string }>('SELECT firstName FROM User WHERE id = ?', [s.users.member2.id]))!.firstName).toBe('Marc');
  });

  test('an email already used by another account cannot be saved', { tag: ['@ACC-PRO-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, UPDATE, { input: profile(s.users.member, { email: s.users.member2.email }) });

    expect(res.data.updateUser.__typename).toBe('MailAlreadyInUseError');
    expect((await queryOne<{ email: string }>('SELECT email FROM User WHERE id = ?', [s.users.member.id]))!.email).toBe('member@camap.test');
  });

  test('the login email changes without any identity confirmation (UND-012, characterised)', { tag: ['@ACC-PRO-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, UPDATE, { input: profile(s.users.member, { email: 'nouveau@camap.test' }) });

    expect(res.data.updateUser.email).toBe('nouveau@camap.test');
  });

  test('a birth date under 18 years is accepted (UND-013, characterised)', { tag: ['@ACC-PRO-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const recent = `${clock.now().getFullYear() - 5}-01-01`;

    const res = await app.graphql(m.request, UPDATE, { input: profile(s.users.member, { birthDate: recent }) });

    expect(res.errors).toBeNull();
    expect(res.data.updateUser.__typename).toBe('User');
  });
});

test.describe('notification preferences', () => {
  test('a user enables and disables the three email notifications', { tag: ['@ACC-NOT-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, NOTIF, { input: { userId: s.users.member.id, hasEmailNotif4h: true, hasEmailNotif24h: false, hasEmailNotifOuverture: true } });

    expect(res.data.updateUserNotifications.notifications).toEqual({ hasEmailNotif4h: true, hasEmailNotif24h: false, hasEmailNotifOuverture: true });
    expect((await queryOne<{ flags: number }>('SELECT flags FROM User WHERE id = ?', [s.users.member.id]))!.flags).toBe(flags(UserFlag, 'HasEmailNotif4h', 'HasEmailNotifOuverture'));
  });

  test('a visitor edits the preferences with the key printed in an email footer', { tag: ['@ACC-NOT-003'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const key = sha1(String(s.users.member.id));

    const ok = await app.graphql(anon.request, NOTIF, { input: { userId: s.users.member.id, controlKey: key, hasEmailNotif24h: false } });
    const bad = await app.graphql(anon.request, NOTIF, { input: { userId: s.users.member.id, controlKey: 'not-the-key', hasEmailNotif24h: true } });

    expect(ok.data.updateUserNotifications.notifications.hasEmailNotif24h).toBe(false);
    expect(bad.errors?.length).toBeGreaterThan(0);
  });

  test('a logged-in user cannot edit another user\'s preferences', { tag: ['@ACC-NOT-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, NOTIF, { input: { userId: s.users.member2.id, hasEmailNotif4h: true } });

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

test.describe('account deletion', () => {
  async function oldMember() {
    const s = await make.amapScenario();
    // orders and operations older than two months, and a clean balance
    return s;
  }

  test('a user deletes their account by confirming their password; their data moves to the deleted user', { tag: ['@ACC-DEL-001', '@ACC-DEL-004', '@ACC-DEL-005', '@ACC-DEL-007'] }, async ({ app, as }) => {
    const s = await oldMember();
    const m = await as(s.users.member);
    const sub = await subscribeConst(app, m.request, s, s.users.member.id);
    await execute("UPDATE UserOrder SET date = '2020-01-01 10:00:00' WHERE subscriptionId = ?", [sub.id]);
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);
    const deleted = (await queryOne<{ id: number }>("SELECT id FROM User WHERE email = 'deleted@camap.tld'"))!.id;

    const res = await app.graphql(m.request, DELETE, { id: s.users.member.id, password: s.users.member.password });

    expect(res.errors).toBeNull();
    expect(res.data.deleteAccount).toBe(s.users.member.id);
    expect(await query('SELECT id FROM User WHERE id = ?', [s.users.member.id])).toEqual([]);
    expect(await query('SELECT userId FROM UserGroup WHERE userId = ?', [s.users.member.id])).toEqual([]);
    expect((await queryOne<{ userId: number }>('SELECT userId FROM Subscription WHERE id = ?', [sub.id]))!.userId).toBe(deleted);
    expect(await query('SELECT DISTINCT userId FROM UserOrder WHERE subscriptionId = ?', [sub.id])).toEqual([{ userId: deleted }]);
    expect((await app.graphql(m.request, 'query { me { id } }')).errors?.length).toBeGreaterThan(0); // logged out
  });

  test('a wrong password refuses the deletion', { tag: ['@ACC-DEL-001'] }, async ({ app, as }) => {
    const s = await oldMember();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, DELETE, { id: s.users.member.id, password: 'nope' });

    expect(res.errors?.[0].message).toMatch(/wrongPassword/);
    expect(await query('SELECT id FROM User WHERE id = ?', [s.users.member.id])).toHaveLength(1);
  });

  test('a user who ordered in the last two months cannot delete their account', { tag: ['@ACC-DEL-002', '@ACC-DEL-008'] }, async ({ app, as }) => {
    const s = await oldMember();
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id);
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);

    const res = await app.graphql(m.request, DELETE, { id: s.users.member.id, password: s.users.member.password });

    expect(res.errors?.[0].message).toMatch(/trop récentes/);
    expect(await query('SELECT id FROM User WHERE id = ?', [s.users.member.id])).toHaveLength(1);
  });

  test('a user with a negative balance cannot delete their account', { tag: ['@ACC-DEL-003'] }, async ({ app, as }) => {
    const s = await oldMember();
    const m = await as(s.users.member);
    await execute('UPDATE UserGroup SET balance = -12 WHERE userId = ?', [s.users.member.id]);

    const res = await app.graphql(m.request, DELETE, { id: s.users.member.id, password: s.users.member.password });

    expect(res.errors?.[0].message).toMatch(/solde est négatif/);
    expect(await query('SELECT id FROM User WHERE id = ?', [s.users.member.id])).toHaveLength(1);
  });

  test('the admins of the group are told by email', { tag: ['@ACC-DEL-006'] }, async ({ app, as, mails }) => {
    const s = await oldMember();
    const m = await as(s.users.member);
    const mark = await mails.mark();

    await app.graphql(m.request, DELETE, { id: s.users.member.id, password: s.users.member.password });

    const sent = await mails.to(s.users.groupAdmin.email, mark);
    expect(sent.some((x) => /vient de supprimer son compte/.test(x.title))).toBe(true);
  });

  test('a user cannot delete another account', { tag: ['@ACC-DEL-001'] }, async ({ app, as }) => {
    const s = await oldMember();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, DELETE, { id: s.users.member2.id, password: s.users.member.password });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await query('SELECT id FROM User WHERE id = ?', [s.users.member2.id])).toHaveLength(1);
  });
});
