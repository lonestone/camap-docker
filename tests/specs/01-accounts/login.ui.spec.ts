/**
 * Login through the real form (specs/01-accounts/login.md).
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

test.describe('login form', () => {
  test(
    'a visitor logs in with email and password and lands on the home page',
    { tag: ['@ACC-LOG-001', '@ACC-LOG-006'] },
    async ({ app, anon }) => {
      const u = await make.user({ firstName: 'Lucie', lastName: 'Laforêt' });
      expect((await queryOne('SELECT ldate FROM `User` WHERE id = ?', [u.id]))?.ldate).toBeNull();

      const login = app.pages.login(anon.page);
      await login.goto();
      await login.submit(u.email, u.password);

      await app.pages.home(anon.page).expectGreeting('Lucie');

      // ACC-LOG-006: last login date recorded
      const row = await queryOne<{ ldate: string | null }>('SELECT ldate FROM `User` WHERE id = ?', [u.id]);
      expect(row?.ldate).not.toBeNull();
    },
  );

  test('a wrong password shows an error and does not log in', { tag: ['@ACC-LOG-004'] }, async ({ app, anon }) => {
    const u = await make.user();

    const login = app.pages.login(anon.page);
    await login.goto();
    await login.submit(u.email, 'not-the-password');

    await login.expectWrongCredentials();
    expect((await queryOne('SELECT ldate FROM `User` WHERE id = ?', [u.id]))?.ldate).toBeNull();
    expect(await queryOne('SELECT COUNT(*) AS n FROM `Session` WHERE uid IS NOT NULL')).toEqual({ n: 0 });
  });

  test('an unknown email shows the same error', { tag: ['@ACC-LOG-004'] }, async ({ app, anon }) => {
    const login = app.pages.login(anon.page);
    await login.goto();
    await login.submit('nobody@camap.test', 'whatever1');

    await login.expectWrongCredentials();
  });
});
