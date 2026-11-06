/**
 * The home page (specs/09-navigation/home.md; camap-hx controller/Main.hx doHome, doDefault, views home.mtt).
 *
 * Checked elsewhere, with the same pages:
 * - NAV-HOM-003 (member of a disabled group): 02-groups/group-disabled.spec.ts, GRP-DSB-001.
 * - NAV-HOM-005 (platform and admin announcements on the home page): 08-administration/announcements.forms.spec.ts,
 *   ADM-ANN-001, ADM-ANN-002.
 * - NAV-HOM-007 (maintenance mode, superadmin bypass): 08-administration/maintenance-install.views.spec.ts, ADM-MNT-001.
 */
import { test, expect } from '../../src/fixtures.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';

test.describe('who is sent where', () => {
  test('a visitor without a selected group is sent to the login page', { tag: ['@NAV-HOM-001'] }, async ({ app, anon }) => {
    await make.amapScenario();

    const home = await app.views.groups.home(anon.request);

    expect(home.status).toBe(302);
    expect(home.location).toBe(app.urls.login());
  });

  test('a visitor who opened the page of an open group sees that group home page', { tag: ['@NAV-HOM-001'] }, async ({ app, anon }) => {
    const s = await make.amapScenario({ group: { regOption: 'Open' } });

    await app.views.groups.page(anon.request, s.group.id);
    const home = await app.views.groups.homeOpenOrders(anon.request);

    expect(home.status).toBe(200);
    expect(home.catalogs.map((c) => c.id)).toEqual([s.constCatalog.id, s.varCatalog.id]);
  });

  test('a logged-in user with no group is sent to the group chooser', { tag: ['@NAV-HOM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    for (const user of [s.users.nonMember, s.users.member]) {
      const session = await as(user);
      const home = await app.views.groups.home(session.request);

      expect(home.status).toBe(302);
      expect(home.location).toBe('/user/choose');
    }
  });
});

test.describe('open orders', () => {
  test('a member sees the open orders of the group, by name, each linking to the subscription page of its catalog', { tag: ['@NAV-HOM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeOpenOrders(member.request);

    expect(home.status).toBe(200);
    expect(home.catalogs).toEqual([
      { id: s.constCatalog.id, name: s.constCatalog.name },
      { id: s.varCatalog.id, name: s.varCatalog.name },
    ]);
    expect(home.subscribedIds).toEqual([]);
  });

  test('a catalog closed to orders is not listed, nor one of another group', { tag: ['@NAV-HOM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { flags: 0 });
    const other = await make.group({ name: 'AMAP voisine' });
    await make.catalog({ group: other, vendor: s.vendor, name: 'Contrat voisin' });
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeOpenOrders(member.request);

    expect(home.catalogs.map((c) => c.id)).toEqual([s.constCatalog.id]);
  });

  test('a catalog I have a subscription to is marked', { tag: ['@NAV-HOM-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: addDaysWall(now, -7), endDate: addDaysWall(now, 60) });
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeOpenOrders(member.request);

    expect(home.catalogs.map((c) => c.id)).toEqual([s.constCatalog.id, s.varCatalog.id]);
    expect(home.subscribedIds).toEqual([s.constCatalog.id]);
  });
});

test.describe('reminders about missing details', () => {
  const PHONE = /Les membres de ce groupe doivent fournir un numéro de téléphone/;
  const ADDRESS = /Les membres de ce groupe doivent fournir leur adresse/;

  test('a group that requires them reminds a member without phone and address to give both', { tag: ['@NAV-HOM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { flags: flags(GroupFlag, 'PhoneRequired', 'AddressRequired') } });
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeAlerts(member.request);

    expect(home.status).toBe(200);
    expect(home.alerts.map((a) => a.text)).toEqual([expect.stringMatching(PHONE), expect.stringMatching(ADDRESS)]);
    expect(home.alerts.every((a) => a.kind === 'error')).toBe(true);
  });

  test('only the missing detail is asked for', { tag: ['@NAV-HOM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { flags: flags(GroupFlag, 'PhoneRequired', 'AddressRequired') } });
    const withPhone = await make.user({ phone: '0612345678' });
    await make.userGroup({ user: withPhone, group: s.group });
    const member = await as(withPhone);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeAlerts(member.request);

    expect(home.alerts.map((a) => a.text)).toEqual([expect.stringMatching(ADDRESS)]);
  });

  test('a group that does not require them shows no reminder', { tag: ['@NAV-HOM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeAlerts(member.request);

    expect(home.alerts).toEqual([]);
  });
});

test.describe('unknown paths', () => {
  test('a path with no matching page leads to the home page', { tag: ['@NAV-HOM-008'] }, async ({ app, anon }) => {
    const page = await app.views.platform.unknownPath(anon.request, 'une-page-qui-nexiste-pas');

    expect(page.status).toBe(302);
    expect(page.location).toBe(app.urls.home());
  });

  test('the platform address itself leads to the home page', { tag: ['@NAV-HOM-008'] }, async ({ app, anon }) => {
    const page = await app.views.platform.home(anon.request);

    expect(page.status).toBe(302);
    expect(page.location).toBe(app.urls.home());
  });
});

test.describe('disagreeing login cookies', () => {
  test('a user whose platform session has closed while the other login cookies remain is logged out and sent to the login page', { tag: ['@NAV-HOM-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);
    expect((await app.views.groups.home(member.request)).status).toBe(200);
    await app.auth.endPlatformSession(member.request);

    const home = await app.views.groups.home(member.request);
    // follow the chain of redirects by hand, up to the login page (the test stack cannot clear the cookies)
    const hops: string[] = [];
    for (let next = home.location; next && hops.length < 6 && hops.at(-1) !== app.urls.login(); ) {
      hops.push(next);
      next = (await member.request.get(next, { maxRedirects: 0 })).headers()['location'] ?? null;
    }

    expect(home.status).toBe(302);
    expect(hops[0]).toBe('/user/logout');
    expect(hops.at(-1)).toBe(app.urls.login());
  });
});
