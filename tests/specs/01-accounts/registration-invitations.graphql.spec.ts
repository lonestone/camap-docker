/**
 * What registration and invitations leave open (specs/01-accounts/registration.md, invitations.md,
 * password-reset.md; camap-ts auth.resolver.ts register, users.resolver.ts getInvitedUserToRegister,
 * group-previews-members.resolver.ts, behind the hx origin). Login, registration and invitation links
 * are otherwise in auth.graphql.spec.ts and impersonation-invitations.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';

const REGISTER = `mutation($input: RegisterInput!) { register(input: $input) { id email } }`;
const LOGIN = `mutation($input: LoginInput!) { login(input: $input) { id } }`;
const INVITED = `query($email: String!) { getInvitedUserToRegister(email: $email) { email firstName lastName phone zipCode city address1 } }`;

const registration = (sid: string, over: Record<string, unknown> = {}) => ({
  email: 'nouvelle@camap.test',
  password: 'Secret123!',
  confirmPassword: 'Secret123!',
  firstName: 'Nina',
  lastName: 'Nouvelle',
  tos: true,
  sid,
  ...over,
});
const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;
const userByEmail = (email: string) => queryOne<{ id: number }>('SELECT id FROM User WHERE email = ?', [email]);

const NEO = { firstName: 'Neo', lastName: 'Nouveau', email: 'neo@camap.test', phone: '0601020304', zipCode: '44000', city: 'Nantes', address1: '1 rue des Lilas' };

test.describe('registering', () => {
  test('a group that requires a phone number or an address is not asked for it by the server (UND-003, characterised)', { tag: ['@ACC-REG-003'] }, async ({ app, anon }) => {
    const g = await make.group({ regOption: 'Open', flags: flags(GroupFlag, 'PhoneRequired', 'AddressRequired') });
    const sid = await app.auth.sid(anon.request);

    const res = await app.graphql(anon.request, REGISTER, { input: registration(sid, { invitedGroupId: g.id }) });

    expect(res.errors).toBeNull(); // the rule lives in the registration form only
    const created = await userByEmail('nouvelle@camap.test');
    expect(created).toBeDefined();
    expect(await memberOf(created!.id, g.id)).toBe(1);
  });

  test('no confirmation email is sent (UND-001, characterised)', { tag: ['@ACC-REG-007'] }, async ({ app, anon, mails }) => {
    const sid = await app.auth.sid(anon.request);
    const mark = await mails.mark();

    const res = await app.graphql(anon.request, REGISTER, { input: registration(sid) });

    expect(res.errors).toBeNull();
    expect(await mails.since(mark)).toEqual([]);
  });

  test('a visitor can be added to a group that is closed to new members (UND-006, characterised)', { tag: ['@ACC-REG-012', '@ACC-INV-004'] }, async ({ app, anon }) => {
    // The server adds the new account to `invitedGroupId` without looking at the join option or at any invitation.
    const g = await make.group({ regOption: 'Closed' });
    const sid = await app.auth.sid(anon.request);

    const res = await app.graphql(anon.request, REGISTER, { input: registration(sid, { invitedGroupId: g.id }) });

    expect(res.errors).toBeNull();
    expect(await memberOf((await userByEmail('nouvelle@camap.test'))!.id, g.id)).toBe(1);
  });
});

test.describe('a password with spaces around it (UND-005, characterised)', () => {
  const SPACED = '  Espaces1234  ';
  const canLogin = async (app: any, request: any, email: string, password: string) => {
    const sid = await app.auth.sid(request);
    return !(await app.graphql(request, LOGIN, { input: { email, password, sid } })).errors;
  };

  test('registered with edge spaces, it logs in exactly as typed', { tag: ['@ACC-REG-010'] }, async ({ app, anon }) => {
    const sid = await app.auth.sid(anon.request);
    await app.graphql(anon.request, REGISTER, { input: registration(sid, { password: SPACED, confirmPassword: SPACED }) });

    expect(await canLogin(app, anon.request, 'nouvelle@camap.test', SPACED)).toBe(true);
  });

  test('set through a reset, only the trimmed text logs in: the reset trims, the login does not', { tag: ['@ACC-REG-010'] }, async ({ app, anon, mails }) => {
    const u = await make.user();
    const mark = await mails.mark();
    await app.actions.account.forgotPassword(anon.request, u.email);
    const sent = await mails.to(u.email, mark);
    const path = /\/user\/forgottenPassword\/[0-9a-f]+\/\d+/.exec(sent[0].htmlBody ?? '')![0];

    await app.actions.account.setNewPassword(anon.request, path, { pass1: SPACED, pass2: SPACED });

    expect(await canLogin(app, anon.request, u.email, SPACED)).toBe(false);
    expect(await canLogin(app, anon.request, u.email, SPACED.trim())).toBe(true);
  });
});

test.describe('inviting people', () => {
  test('a membership manager invites by email: each person gets a personal link, and no account is created', { tag: ['@ACC-INV-001'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.invite(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

    expect(res.errors).toBeNull();
    expect(await userByEmail(NEO.email)).toBeUndefined();
    const sent = await mails.to(NEO.email, mark);
    expect(sent).toHaveLength(1);
    expect(sent[0].htmlBody).toContain(`/invite/${app.actions.invitations.hashFor(NEO.email)}/${NEO.email}/${s.group.id}`);
  });

  test('anyone can read the data a manager typed for an invited email, by giving that email (UND-017, characterised)', { tag: ['@ACC-INV-006'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    await app.api.members.invite(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

    const asked = await app.graphql(anon.request, INVITED, { email: NEO.email });
    const other = await app.graphql(anon.request, INVITED, { email: 'autre@camap.test' });

    expect(asked.errors).toBeNull();
    expect(asked.data.getInvitedUserToRegister).toMatchObject({ email: NEO.email, firstName: 'Neo', lastName: 'Nouveau', phone: '0601020304', city: 'Nantes' });
    expect(other.data.getInvitedUserToRegister).toBeNull();
  });
});

test.describe('a member added by a manager', () => {
  test('gets an email with a link to create a password, and the page says "create", not "reset"', { tag: ['@ACC-PWD-010'] }, async ({ app, as, anon, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

    const sent = await mails.to(NEO.email, mark);
    expect(sent).toHaveLength(1);
    const link = /href="[^"]*(\/user\/forgottenPassword\/[^/\"]+\/\d+\/true)/.exec(sent[0].htmlBody ?? '');
    expect(link).not.toBeNull();
    const token = /forgottenPassword\/([^/]+)\//.exec(link![1])![1];
    const [cache] = await query<{ seconds: number }>('SELECT TIMESTAMPDIFF(SECOND, cdate, expire) AS seconds FROM Cache WHERE name = ?', [token]);
    expect(cache.seconds).toBe(14 * 24 * 3600);

    const page = await app.actions.account.openResetLink(anon.request, link![1]);
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/Définissez un mot de passe pour votre compte/);
    expect(page.text).not.toMatch(/Changement de mot de passe/);
  });
});
