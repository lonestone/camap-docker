/**
 * Deleting any account as a superadmin (specs/01-accounts/account-deletion.md ACC-DEL-009;
 * camap-hx controller/admin/User.hx doDelete). The rules of the deletion are in profile-account.graphql.spec.ts,
 * the back-office side in 08-administration/admin-users.forms.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const exists = async (userId: number) => (await query('SELECT id FROM User WHERE id = ?', [userId])).length === 1;

test.describe('a superadmin deletes an account', () => {
  test('any account that may be deleted is deleted', { tag: ['@ACC-DEL-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);
    const admin = await as(s.users.superadmin);

    await app.actions.admin.deleteUser(admin.request, s.users.member.id);

    expect(await exists(s.users.member.id)).toBe(false);
  });

  test('a refusal is not explained to the admin: same redirect, no message (UND-022, characterised)', { tag: ['@ACC-DEL-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await subscribeConst(app, member.request, s, s.users.member.id); // an order of the last two months
    await execute('UPDATE UserGroup SET balance = 0 WHERE userId = ?', [s.users.member.id]);
    await execute('UPDATE UserGroup SET balance = -5 WHERE userId = ?', [s.users.member2.id]); // a negative balance
    const admin = await as(s.users.superadmin);

    const recentOrder = await app.actions.admin.deleteUser(admin.request, s.users.member.id);
    const negative = await app.actions.admin.deleteUser(admin.request, s.users.member2.id);

    expect(await exists(s.users.member.id)).toBe(true);
    expect(await exists(s.users.member2.id)).toBe(true);
    for (const res of [recentOrder, negative]) {
      expect(res.status).toBe(302);
      expect(res.location).toBe('/admin/user');
      expect(res.flash).toBeNull(); // UND-022: the reason is printed to nowhere
    }
  });
});
