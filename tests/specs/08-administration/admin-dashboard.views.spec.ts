/**
 * Back-office access and home (specs/08-administration/admin-dashboard.md;
 * controller/admin/Admin.hx, controller/Main.hx doAdmin / doDb, templates admin/*.mtt).
 *
 * Every back-office route is `@admin`: anyone who is not a superadmin (a visitor included) is
 * redirected to "/".
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test.describe('back-office home', () => {
  test('a superadmin opens the back-office home', { tag: ['@ADM-DSH-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.dashboard(admin.request);

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(res.text).toContain("Console d'administration");
  });

  for (const who of ['member', 'groupAdmin', 'vendor', 'nonMember'] as const) {
    test(`a ${who} is sent to the home page`, { tag: ['@ADM-DSH-001'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);

      const res = await app.views.admin.dashboard(u.request);

      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(res.text).not.toContain("Console d'administration");
    });
  }

  test('a visitor is sent to the home page', { tag: ['@ADM-DSH-001'] }, async ({ app, as }) => {
    await make.amapScenario();
    const visitor = await as('anon');

    const res = await app.views.admin.dashboard(visitor.request);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
  });

  test('every back-office page is closed to a non-superadmin', { tag: ['@ADM-DSH-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);

    for (const res of [
      await app.views.admin.theme(admin.request),
      await app.views.admin.superadmins(admin.request),
      await app.views.admin.groups(admin.request),
      await app.views.admin.group(admin.request, s.group.id),
      await app.views.admin.database(admin.request),
    ]) {
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
    }
  });

  test('a superadmin reloads the theme and is told so', { tag: ['@ADM-DSH-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.reloadTheme(admin.request);

    expect(res.status).toBe(302);
    expect(res.location).toMatch(/\/admin\/?$/);
    expect(res.flash).toEqual({ kind: 'ok', text: 'Theme reloaded' });
  });

  test('a member cannot reload the theme', { tag: ['@ADM-DSH-001', '@ADM-DSH-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.actions.admin.reloadTheme(member.request);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.flash?.text).not.toBe('Theme reloaded');
  });
});

test.describe('back-office sidebar', () => {
  test('the sidebar links to errors, emails, the three messages, groups and users', { tag: ['@ADM-DSH-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.dashboard(admin.request);

    expect([...res.sidebar].sort()).toEqual(['emails', 'errors', 'groupAdminMessage', 'groupMessage', 'groups', 'homeMessage', 'users']);
  });

  test('the theme and superadmin pages exist but the sidebar does not link them: only the home page buttons do', { tag: ['@ADM-DSH-004'] }, async ({ app, as }) => {
    // UND-112 is undecided: this is today's behaviour (the suggestion would link them in the sidebar)
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const home = await app.views.admin.dashboard(admin.request);
    const theme = await app.views.admin.theme(admin.request);
    const superadmins = await app.views.admin.superadmins(admin.request);

    expect(home.sidebar).not.toContain('theme');
    expect(home.sidebar).not.toContain('superadmins');
    expect(home.shortcuts).toEqual(expect.arrayContaining(['theme', 'reloadTheme', 'superadmins']));
    expect(theme.status).toBe(200);
    expect(theme.location).toBeNull();
    expect(superadmins.status).toBe(200);
  });
});

test.describe('superadmins list', () => {
  test('a superadmin lists all the superadmins and only them', { tag: ['@ADM-DSH-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.user({ firstName: 'Odile', lastName: 'Opérateur', email: 'odile@camap.test', superadmin: true });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.superadmins(admin.request);

    expect(res.status).toBe(200);
    const ids = res.users.map((u) => u.id);
    // the seeded admin@camap.tld, the scenario superadmin and the one added here
    expect(ids).toEqual(expect.arrayContaining([s.users.superadmin.id, other.id]));
    expect(ids).not.toContain(s.users.member.id);
    expect(ids).not.toContain(s.users.groupAdmin.id);
    expect(res.users.find((u) => u.id === other.id)).toEqual({ id: other.id, lastName: 'Opérateur', firstName: 'Odile', email: 'odile@camap.test' });
    expect(res.users.map((u) => u.email)).toContain('admin@camap.tld');
  });

  test('a member cannot list the superadmins', { tag: ['@ADM-DSH-005', '@ADM-DSH-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.views.admin.superadmins(member.request);

    expect(res.status).toBe(302);
    expect(res.users).toEqual([]);
  });
});

test.describe('raw database administration tool', () => {
  test('the sidebar has no link to it, and a member cannot open it', { tag: ['@ADM-DSH-006'] }, async ({ app, as }) => {
    // UND-114 is undecided: the link is commented out in the sidebar template, the route stays open to superadmins
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const member = await as(s.users.member);

    const home = await app.views.admin.dashboard(admin.request);
    const refused = await app.views.admin.database(member.request);

    expect(home.sidebar).not.toContain('database');
    expect(refused.status).toBe(302);
    expect(refused.location).toBe('/');
  });

  test('a superadmin can open it', { tag: ['@ADM-DSH-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.database(admin.request);

    // UND-114: today the route answers (with the table list, and an error about the MySQL 8 column types)
    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(res.text).toContain('Tables');
  });
});
