/**
 * Sessions, renewal of the login and logout through the platform page
 * (specs/01-accounts/sessions-tokens.md, login.md, logout.md; camap-ts auth.service.ts and
 * gql-auth-abstract-guard.ts, camap-hx controller/User.hx doLogin/doLogout, behind the hx origin).
 */
import { request as pwRequest } from '@playwright/test';
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { env } from '../../src/env.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';

const LOGIN = `mutation($input: LoginInput!) { login(input: $input) { id email } }`;
const ME = `query { me { id email } }`;
const PUBLIC = `query { isEmailRegistered(email: "personne@camap.test") }`;

const clears = (setCookies: string[], name: string) => setCookies.some((c) => new RegExp(`^${name}=;`).test(c) && /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c));

test.describe('the anonymous session', () => {
  test('any page opens an anonymous session, and it remembers the group the visitor opened', { tag: ['@ACC-SES-001'] }, async ({ app, anon }) => {
    const contact = await make.user();
    const g = await make.group({ regOption: 'Open', flags: flags(GroupFlag, 'PhoneRequired'), contact });
    await make.place({ group: g });
    expect(await query('SELECT sid FROM Session')).toEqual([]);

    await app.views.platform.home(anon.request); // not the login page: any page
    const rows = await query<{ sid: string; uid: number | null }>('SELECT sid, uid FROM Session');
    expect(rows).toHaveLength(1);
    expect(rows[0].uid).toBeNull();

    // the same session is kept from page to page, and remembers the group of the page opened
    await app.views.groups.page(anon.request, g.id);
    expect(await query('SELECT sid FROM Session')).toEqual([{ sid: rows[0].sid }]);
    expect((await app.views.groups.loginPageRequirements(anon.request)).phoneRequired).toBe(true);
    expect(await query('SELECT sid FROM Session')).toEqual([{ sid: rows[0].sid }]);
  });
});

test.describe('renewal of the login', () => {
  test('with the short-lived token gone, the long-lived one silently gives a new one', { tag: ['@ACC-LOG-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const ctx = await app.auth.tamper(m.request, 'dropAccessToken');

    const res = await app.graphql(ctx, ME);

    expect(res.errors).toBeNull();
    expect(res.data.me.id).toBe(s.users.member.id);
    expect(res.setCookies.some((c: string) => c.startsWith('Authentication=') && !c.startsWith('Authentication=;'))).toBe(true);
    expect(res.setCookies.some((c: string) => c.startsWith('Refresh=') && !c.startsWith('Refresh=;'))).toBe(true);
    // the new short-lived token now works alone
    expect((await app.graphql(ctx, ME)).data.me.id).toBe(s.users.member.id);
    await ctx.dispose();
  });

  test('when neither token is valid the user is treated as logged out, and the session and cookies are dropped', { tag: ['@ACC-LOG-007', '@ACC-SES-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const ctx = await app.auth.tamper(m.request, 'invalidateTokens');
    expect((await query('SELECT sid FROM Session WHERE uid = ?', [s.users.member.id]))).toHaveLength(1);

    const res = await app.graphql(ctx, ME);

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(clears(res.setCookies, 'Authentication')).toBe(true);
    expect(clears(res.setCookies, 'Refresh')).toBe(true);
    expect(await query('SELECT sid FROM Session WHERE uid = ?', [s.users.member.id])).toEqual([]);
    expect((await queryOne<{ t: string | null }>('SELECT currentRefreshToken AS t FROM User WHERE id = ?', [s.users.member.id]))!.t).toBeNull();
    // what is open to everyone stays available to the same client
    const open = await app.graphql(ctx, PUBLIC);
    expect(open.errors).toBeNull();
    expect(open.data.isEmailRegistered).toBe(false);
    await ctx.dispose();
  });
});

test.describe('login state out of sync between the platform and the API', () => {
  test('a client whose two session cookies disagree is logged out by the API', { tag: ['@ACC-SES-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const ctx = await app.auth.tamper(m.request, 'desyncSession');

    const res = await app.graphql(ctx, ME);

    expect(res.errors?.length).toBeGreaterThan(0); // the "logged state sync" error is internal: the client only gets a refusal
    expect(clears(res.setCookies, 'Authentication')).toBe(true);
    expect(clears(res.setCookies, 'Refresh')).toBe(true);
    expect((await app.graphql(ctx, ME)).errors?.length).toBeGreaterThan(0);
    await ctx.dispose();
  });

  test('the platform logs out a visitor whose two session cookies disagree and sends them to the login page', { tag: ['@ACC-LOG-009', '@ACC-OUT-003'] }, async ({ app, anon }) => {
    await app.auth.sid(anon.request);
    const ctx = await app.auth.tamper(anon.request, 'desyncSession');

    const res = await ctx.get(app.urls.login(), { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toMatch(/\/user\/logout$/);

    const out = await app.actions.account.logout(ctx);
    expect(out.finalLocation).toMatch(/\/user\/login$/);
    await ctx.dispose();
  });
});

test.describe('logging out through the platform page', () => {
  test('all three login cookies are cleared, the renewal token is invalidated and the session is closed', { tag: ['@ACC-OUT-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    expect((await queryOne<{ t: string | null }>('SELECT currentRefreshToken AS t FROM User WHERE id = ?', [s.users.member.id]))!.t).not.toBeNull();

    const out = await app.actions.account.logout(m.request);

    expect(out.finalLocation).toMatch(/\/user\/login$/);
    for (const name of ['Refresh', 'Authentication', 'Auth_sid']) {
      expect(out.setCookies.some((c) => new RegExp(`^${name}=;`).test(c) && /Max-Age=0/.test(c)), `${name} is cleared`).toBe(true);
    }
    expect((await queryOne<{ t: string | null }>('SELECT currentRefreshToken AS t FROM User WHERE id = ?', [s.users.member.id]))!.t).toBeNull();
    expect(await query('SELECT sid FROM Session WHERE uid = ?', [s.users.member.id])).toEqual([]);
  });
});

test.describe('who logged in, and the language, at login', () => {
  test('logging in with the secondary email does not switch the page to the second person (UND-014, characterised)', { tag: ['@ACC-LOG-011'] }, async ({ app, anon }) => {
    // The TS login leaves the "which person" marker of the session unset (TODO in auth.service.ts login):
    // the greeting stays on the first person.
    const u = await make.user({ email: 'prim@camap.test', email2: 'second@camap.test', firstName: 'Paul', firstName2: 'Sylvie' });
    const sid = await app.auth.sid(anon.request);

    const res = await app.graphql(anon.request, LOGIN, { input: { email: 'second@camap.test', password: u.password, sid } });
    expect(res.errors).toBeNull();

    const chooser = await app.views.groups.chooser(anon.request);
    expect(chooser.text).toContain('Bonjour Paul');
    expect(chooser.text).not.toContain('Bonjour Sylvie');
  });

  test('the language of the user is not copied into the session at login (UND-014, characterised)', { tag: ['@ACC-LOG-010'] }, async ({ app, anon }) => {
    const u = await make.user();
    await query("UPDATE User SET lang = 'en' WHERE id = ?", [u.id]);
    const sid = await app.auth.sid(anon.request);
    const before = (await queryOne<{ lang: string }>('SELECT lang FROM Session WHERE sid = ?', [sid]))!.lang;

    const res = await app.graphql(anon.request, LOGIN, { input: { email: u.email, password: u.password, sid } });

    expect(res.errors).toBeNull();
    expect((await queryOne<{ lang: string }>('SELECT lang FROM Session WHERE sid = ?', [sid]))!.lang).toBe(before);
  });

  test('a login needs a session the platform already opened (UND-021, characterised)', { tag: ['@ACC-LOG-012'] }, async ({ app, anon }) => {
    const u = await make.user();

    const res = await app.graphql(anon.request, LOGIN, { input: { email: u.email, password: u.password, sid: 'x'.repeat(32) } });

    expect(res.errors?.[0].message).toMatch(/Session not found/);
    expect(res.setCookies.filter((c: string) => /^Authentication=/.test(c))).toEqual([]);
    expect(await query('SELECT sid FROM Session WHERE uid IS NOT NULL')).toEqual([]);
  });
});

test.describe('blocked clients', () => {
  test('a client identifying as "python" is not refused: the guard has no caller (UND-020, characterised)', { tag: ['@ACC-SES-008'] }, async ({ app }) => {
    const ctx = await pwRequest.newContext({ baseURL: env.baseUrl, userAgent: 'python-requests/2.31.0' });

    const res = await app.graphql(ctx, PUBLIC);

    expect(res.status).toBe(200);
    expect(res.errors).toBeNull();
    expect(res.data.isEmailRegistered).toBe(false);
    await ctx.dispose();
  });
});
