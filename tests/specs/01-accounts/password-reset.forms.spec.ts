/**
 * Password reset by email (specs/01-accounts/password-reset.md; camap-hx controller/User.hx
 * doForgottenPassword).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const LOGIN = `mutation($input: LoginInput!) { login(input: $input) { id } }`;
const canLogin = async (app: any, request: any, email: string, password: string) => {
  const sid = await app.auth.sid(request);
  const res = await app.graphql(request, LOGIN, { input: { email, password, sid } });
  return !res.errors;
};

/** Ask for a reset link and return its path from the email. */
async function requestLink(app: any, anon: any, mails: any, email: string) {
  const mark = await mails.mark();
  await app.actions.account.forgotPassword(anon.request, email);
  const sent = await mails.to(email, mark);
  expect(sent).toHaveLength(1);
  const m = /(https?:\/\/[^"'\s<]+)(\/user\/forgottenPassword\/[0-9a-f]+\/\d+)/.exec(sent[0].htmlBody ?? '');
  expect(m).not.toBeNull();
  return { path: m![2], absolute: m![1] + m![2], mail: sent[0] };
}

test.describe('password reset', () => {
  test('a visitor asks for a reset link and receives a personal one by email', { tag: ['@ACC-PWD-001', '@ACC-PWD-002', '@ACC-PWD-011'] }, async ({ app, anon, mails }) => {
    const u = await make.user({ email: 'oublie@camap.test' });

    const link = await requestLink(app, anon, mails, u.email);

    expect(link.path).toMatch(new RegExp(`/user/forgottenPassword/[0-9a-f]{32}/${u.id}$`));
  });

  test('the link uses plain http and the site host (UND-011, characterised)', { tag: ['@ACC-PWD-012'] }, async ({ app, anon, mails }) => {
    const u = await make.user();

    const link = await requestLink(app, anon, mails, u.email);

    expect(link.absolute.startsWith('http://')).toBe(true);
  });

  test('an unknown email is reported', { tag: ['@ACC-PWD-001'] }, async ({ app, anon, mails }) => {
    const mark = await mails.mark();

    const res = await app.actions.account.forgotPassword(anon.request, 'personne@camap.test');

    expect(res.flash?.kind).toBe('error');
    expect(await mails.since(mark)).toEqual([]);
  });

  test('the secondary email of a household works too', { tag: ['@ACC-PWD-001'] }, async ({ app, anon, mails }) => {
    const u = await make.user({ email: 'prim@camap.test', email2: 'sec@camap.test' });

    const mark = await mails.mark();
    await app.actions.account.forgotPassword(anon.request, 'sec@camap.test');

    expect(await mails.to('sec@camap.test', mark)).toHaveLength(1);
    void u;
  });

  test('a valid link shows the form with two password fields; an invalid one says "Invalid request"', { tag: ['@ACC-PWD-003', '@ACC-PWD-004'] }, async ({ app, anon, mails }) => {
    const u = await make.user();
    const link = await requestLink(app, anon, mails, u.email);

    const ok = await app.actions.account.openResetLink(anon.request, link.path);
    const bad = await app.actions.account.openResetLink(anon.request, `/user/forgottenPassword/${'0'.repeat(32)}/${u.id}`);

    expect(ok.status).toBe(200);
    expect(ok.text).not.toMatch(/Invalid request|Requête invalide/i);
    expect(bad.text).toMatch(/Invalid request|Requête invalide|invalide/i);
  });

  test('the new password is set only when both fields match', { tag: ['@ACC-PWD-005'] }, async ({ app, anon, mails }) => {
    const u = await make.user();
    const link = await requestLink(app, anon, mails, u.email);

    await app.actions.account.setNewPassword(anon.request, link.path, { pass1: 'Nouveau1234', pass2: 'Different1234' });
    expect(await canLogin(app, anon.request, u.email, 'Nouveau1234')).toBe(false);

    await app.actions.account.setNewPassword(anon.request, link.path, { pass1: 'Nouveau1234', pass2: 'Nouveau1234' });
    expect(await canLogin(app, anon.request, u.email, 'Nouveau1234')).toBe(true);
  });

  test('after a reset only the new password logs in, and a confirmation email is sent', { tag: ['@ACC-PWD-009', '@ACC-PWD-008'] }, async ({ app, anon, mails }) => {
    const u = await make.user();
    const link = await requestLink(app, anon, mails, u.email);
    const mark = await mails.mark();

    await app.actions.account.setNewPassword(anon.request, link.path, { pass1: 'Nouveau1234', pass2: 'Nouveau1234' });

    expect(await canLogin(app, anon.request, u.email, 'Nouveau1234')).toBe(true);
    expect(await canLogin(app, anon.request, u.email, u.password)).toBe(false);
    const confirm = await mails.to(u.email, mark);
    expect(confirm).toHaveLength(1);
    expect(confirm[0].title).toMatch(/New password confirmed|Nouveau mot de passe/i);
  });

  test('a reset link stops working once used', { tag: ['@ACC-PWD-007'] }, async ({ app, anon, mails }) => {
    const u = await make.user();
    const link = await requestLink(app, anon, mails, u.email);
    await app.actions.account.setNewPassword(anon.request, link.path, { pass1: 'Nouveau1234', pass2: 'Nouveau1234' });

    const again = await app.actions.account.openResetLink(anon.request, link.path);

    expect(again.text).toMatch(/Invalid request|Requête invalide|invalide/i);
  });

  test('the link of one account sets the password of another account (UND-009, characterised)', { tag: ['@ACC-PWD-006'] }, async ({ app, anon, mails }) => {
    // The new-password form posts the account id as a hidden field, and the server trusts it.
    const attacker = await make.user({ email: 'attaquant@camap.test' });
    const victim = await make.user({ email: 'victime@camap.test' });
    const link = await requestLink(app, anon, mails, attacker.email);

    await app.actions.account.setNewPassword(anon.request, link.path, { pass1: 'Pirate1234', pass2: 'Pirate1234', userId: victim.id });

    expect(await canLogin(app, anon.request, victim.email, 'Pirate1234')).toBe(true);
    expect(await canLogin(app, anon.request, attacker.email, attacker.password)).toBe(true); // the attacker's own account is untouched
  });
});
