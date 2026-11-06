/**
 * Maintenance mode, installation and diagnostics (specs/08-administration/maintenance-install.md;
 * controller/Main.hx doDefault / doPing / doTos / doCssdemo, controller/Install.hx).
 *
 * Elsewhere: the installation on an empty database and the account it creates (ADM-MNT-002, ADM-MNT-003) are in
 * install.forms.spec.ts; the stored settings (ADM-MNT-009, ADM-MNT-010) in platform-settings.views.spec.ts.
 *
 * Not testable from here:
 *  - ADM-MNT-005 / ADM-MNT-006: the Nest side (`/ping`, `/health`) is not routed through the hx origin (only /graphql,
 *    /neostatic/ and /locales/ are proxied), so only the hx version can be read. UND-113 (one version number) needs
 *    both: the Nest ping would need a published port on nest-test.
 *  - ADM-MNT-004 "warn about a missing access-control file" and "creates the folders": the effects are
 *    on the web server's disk.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, execute } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const MAINTENANCE = 'Site en maintenance';
const setMaintenance = (v: string) => execute("INSERT INTO `Variable` (name, value) VALUES ('maintain', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [v]);

test.describe('maintenance mode', () => {
  // UND-111 is undecided: the switch is a row of the Variable table, set by hand
  test('with maintenance on, a visitor and a member see the maintenance page instead of the home page', { tag: ['@ADM-MNT-001', '@NAV-HOM-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setMaintenance('1');

    for (const who of [await as('anon'), await as(s.users.member), await as(s.users.groupAdmin)]) {
      const res = await app.views.platform.home(who.request);

      expect(res.status).toBe(200);
      expect(res.location).toBeNull();
      expect(res.text).toContain(MAINTENANCE);
    }
  });

  test('a superadmin bypasses the maintenance page', { tag: ['@ADM-MNT-001', '@NAV-HOM-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setMaintenance('1');
    const admin = await as(s.users.superadmin);

    const res = await app.views.platform.home(admin.request);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/home');
    expect(res.text).not.toContain(MAINTENANCE);
  });

  test('with maintenance off (or never set), the home page is served as usual', { tag: ['@ADM-MNT-001'] }, async ({ app, as }) => {
    await make.amapScenario();
    const visitor = await as('anon');

    const unset = await app.views.platform.home(visitor.request);
    await setMaintenance('0');
    const off = await app.views.platform.home(visitor.request);

    for (const res of [unset, off]) {
      expect(res.status).toBe(302);
      expect(res.location).toBe('/home');
    }
  });
});

test.describe('first installation', () => {
  test('on a database that already has users, the installation is refused', { tag: ['@ADM-MNT-002'] }, async ({ app, as, errors }) => {
    errors.expect(/CAMAP est déjà installé/);
    await make.amapScenario();
    const before = await query('SELECT id FROM `Group`');
    const visitor = await as('anon');

    const page = await app.views.platform.install(visitor.request);
    const post = await app.actions.install.run(visitor.request, { amapName: 'Intruders', firstName: 'Eve', lastName: 'Evil' });

    expect(page.text).toContain('CAMAP est déjà installé');
    expect(post.body).toContain('CAMAP est déjà installé');
    expect(await query('SELECT id FROM `Group`')).toEqual(before);
    expect(await query('SELECT id FROM `User` WHERE firstName = ?', ['Eve'])).toEqual([]);
  });
});

test.describe('diagnostics', () => {
  test('a superadmin can run the installation diagnostics', { tag: ['@ADM-MNT-004'] }, async ({ app, as, errors }) => {
    // In the test image the web server user may be unable to create the missing folders: hx then logs the failure
    // (sys_create_dir) and shows its error page. Whether it does depends on the container, so errors are tolerated;
    // what is characterised is that a superadmin is let in (no redirect).
    errors.expect();
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.platform.diagnostics(admin.request);

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
  });

  for (const who of ['anon', 'member', 'groupAdmin'] as const) {
    test(`a ${who === 'anon' ? 'visitor' : who} is refused`, { tag: ['@ADM-MNT-004'] }, async ({ app, as, errors }) => {
      // UND-107 (decided): diagnostics are for superadmins only. hx has no check at all (CODE-026).
      deviation('UND-107');
      errors.expect();
      const s = await make.amapScenario();
      const user = await as(who === 'anon' ? 'anon' : s.users[who]);

      const res = await app.views.platform.diagnostics(user.request);

      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
    });
  }
});

test.describe('public platform pages', () => {
  test('a visitor reads the platform version', { tag: ['@ADM-MNT-005', '@ADM-MNT-006'] }, async ({ app, as }) => {
    // hx only: the Nest ping/health are not reachable from the hx origin. UND-113: today the version is hard-coded in hx.
    const visitor = await as('anon');

    const res = await app.views.platform.ping(visitor.request);

    expect(res.status).toBe(200);
    expect(res.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('a visitor is redirected to the terms of service of the platform theme', { tag: ['@ADM-MNT-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const visitor = await as('anon');
    const admin = await as(s.users.superadmin);

    const byDefault = await app.views.platform.termsOfService(visitor.request);
    expect(byDefault.status).toBe(302);
    expect(byDefault.location).toMatch(/^https?:\/\//);

    // the link comes from the theme: change it and the redirect follows
    const theme = JSON.parse((await app.views.admin.themeSettings(admin.request)).settings!);
    theme.terms.termsOfServiceLink = 'https://example.test/our-terms';
    await app.actions.admin.setTheme(admin.request, JSON.stringify(theme));

    const changed = await app.views.platform.termsOfService(visitor.request);
    expect(changed.status).toBe(302);
    expect(changed.location).toBe('https://example.test/our-terms');
  });

  test('the style guide page does not exist', { tag: ['@ADM-MNT-007'] }, async ({ app, as }) => {
    // UND-107 (decided): /cssdemo is removed. hx serves it to everybody (CODE-026).
    deviation('UND-107');
    const visitor = await as('anon');

    const res = await app.views.platform.styleGuide(visitor.request);

    expect(res.status).toBe(404);
  });
});
