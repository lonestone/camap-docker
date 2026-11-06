/**
 * Choosing the current group (specs/09-navigation/group-selection.md; camap-hx controller/User.hx doChoose,
 * Account.hx doQuitGroup, App.hx getCurrentGroup, views user/choose.mtt).
 *
 * NAV-SEL-007 (the platform message on the chooser page) is checked under ADM-ANN-003
 * (specs/08-administration/announcements.forms.spec.ts).
 * Not checked (NAV-SEL-001): "any pending order is cleared" (the session never holds a pending order in hx:
 * `session.data.order` is only ever reset, never set) and "the new-group flag is cleared" (it is only set by a
 * successful group creation; group creation works since the Mapbox stub (tests/stack/curl-stub.sh), so this
 * can be added from 08-administration/group-lifecycle.forms.spec.ts).
 */
import { test, expect } from '../../src/fixtures.js';
import { env } from '../../src/env.js';
import * as make from '../../src/factories/index.js';

/** A second group the scenario's users do not belong to. */
const otherGroup = async (name = 'AMAP des Voisins') => {
  const g = await make.group({ name, regOption: 'Open' });
  await make.place({ group: g });
  return g;
};

test.describe('the chooser page', () => {
  test('it lists the groups I belong to and the waiting lists I joined, and no other group', { tag: ['@NAV-SEL-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const second = await otherGroup('AMAP du Second');
    const stranger = await otherGroup('AMAP Inconnue');
    const waiting = await make.group({ name: 'AMAP en Attente', regOption: 'WaitingList' });
    await make.userGroup({ user: s.users.member, group: second });
    await make.waitingList({ group: waiting, user: s.users.member });
    const member = await as(s.users.member);

    const page = await app.views.groups.chooser(member.request);

    expect(page.status).toBe(200);
    expect(page.text).toContain(s.group.name);
    expect(page.text).toContain('AMAP du Second');
    expect(page.text).toContain('AMAP en Attente');
    expect(page.text).not.toContain(stranger.name);
  });

  test('a user without group sees an empty list, and no waiting list', { tag: ['@NAV-SEL-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const nobody = await as(s.users.nonMember);

    const page = await app.views.groups.chooser(nobody.request);

    expect(page.status).toBe(200);
    expect(page.text).not.toContain(s.group.name);
  });

  test('a visitor cannot open the chooser', { tag: ['@NAV-SEL-001'] }, async ({ app, anon }) => {
    const page = await app.views.groups.chooser(anon.request);

    expect(page.status).toBe(302);
    expect(page.location).not.toBeNull();
    expect(page.text).not.toContain('Vous êtes membre des');
  });

  test('a vendor sees the vendor widget, a plain member does not', { tag: ['@NAV-SEL-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const vendor = await as(s.users.vendor);
    const member = await as(s.users.member);

    expect((await app.views.groups.chooser(vendor.request)).offersVendorWidget).toBe(true);
    expect((await app.views.groups.chooser(member.request)).offersVendorWidget).toBe(false);
  });
});

test.describe('choosing a group', () => {
  test('without a current group the home page sends me to the chooser; choosing opens the group home page', { tag: ['@NAV-SEL-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const before = await app.views.groups.home(member.request);

    const chosen = await app.actions.group.select(member.request, s.group.id);
    const after = await app.views.groups.home(member.request);

    expect(before.status).toBe(302);
    expect(before.location).toBe('/user/choose');
    expect(chosen.status).toBe(302);
    expect(chosen.location).toBe(app.urls.home());
    expect(after.status).toBe(200);
    expect(after.text).toContain(s.group.name);
  });

  test('a redirect target given with the group replaces the home page', { tag: ['@NAV-SEL-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const chosen = await app.actions.group.select(member.request, s.group.id, { redirect: '/amap' });

    expect(chosen.status).toBe(302);
    expect(chosen.location).toBe('/amap');
  });

  test('I can choose a group I do not belong to: its home page opens with its open catalogs', { tag: ['@NAV-SEL-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const outsider = await as(s.users.nonMember);

    const chosen = await app.actions.group.select(outsider.request, s.group.id);
    const home = await app.views.groups.homeOpenOrders(outsider.request);

    expect(chosen.status).toBe(302);
    expect(chosen.location).toBe(app.urls.home());
    expect(home.status).toBe(200);
    expect(home.catalogs.map((c) => c.id)).toEqual([s.constCatalog.id, s.varCatalog.id]);
  });

  test('in a group I do not belong to, the components that check rights stay closed', { tag: ['@NAV-SEL-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const outsider = await as(s.users.nonMember);
    await app.actions.group.select(outsider.request, s.group.id);

    const dashboard = await app.views.groupAdmin.dashboard(outsider.request);
    const catalogs = await app.views.catalogs.list(outsider.request);
    const members = await app.views.member.list(outsider.request);

    for (const page of [dashboard, catalogs, members]) {
      expect(page.status).toBe(302);
    }
  });

  test('a superadmin has full rights in any group he chooses', { tag: ['@NAV-SEL-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await app.actions.group.select(admin.request, s.group.id);

    const dashboard = await app.views.groupAdmin.dashboard(admin.request);
    const settings = await app.views.groupAdmin.section(admin.request, 'settings');
    const rights = await app.views.groupAdmin.rights(admin.request);
    const catalogs = await app.views.catalogs.list(admin.request);

    expect(dashboard.status).toBe(200);
    expect(settings.status).toBe(200);
    expect(rights.status).toBe(200);
    // hx finding: not every area honours the superadmin's rights. The catalog list asks for the
    // ContractAdmin right through the user's membership (`canManageAllContracts`), which a
    // superadmin who is not a member does not have.
    expect(catalogs.status).toBe(302);
    expect(catalogs.location).toBe('/');
  });
});

test.describe('the current group over the session', () => {
  test('it is remembered from one page to the next', { tag: ['@NAV-SEL-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    for (let i = 0; i < 3; i++) {
      const home = await app.views.groups.home(member.request);
      expect(home.status).toBe(200);
      expect(home.location).toBeNull();
    }
    const list = await app.views.groups.catalogList(member.request);
    expect(list.status).toBe(200);
    expect(list.catalogs.map((c) => c.id)).toEqual([s.constCatalog.id, s.varCatalog.id]);
    expect((await app.views.groups.home(member.request)).status).toBe(200);
  });

  test('it is not shared with another session of the same user', { tag: ['@NAV-SEL-005'] }, async ({ app, as, playwright }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);
    const elsewhere = await playwright.request.newContext({ baseURL: env.baseUrl });
    await app.auth.login(elsewhere, s.users.member);

    const there = await app.views.groups.home(elsewhere);
    const here = await app.views.groups.home(member.request);
    await elsewhere.dispose();

    expect(there.status).toBe(302);
    expect(there.location).toBe('/user/choose');
    expect(here.status).toBe(200);
  });

  test('with several groups, I switch from one to the other at any time', { tag: ['@NAV-SEL-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const second = await otherGroup('AMAP du Second');
    const cat = await make.catalog({ group: second, vendor: s.vendor, name: 'Pains du second' });
    await make.userGroup({ user: s.users.member, group: second });
    const member = await as(s.users.member);

    const names = [];
    for (const id of [s.group.id, second.id, s.group.id]) {
      await app.actions.group.select(member.request, id);
      names.push((await app.views.groups.homeOpenOrders(member.request)).catalogs.map((c) => c.name));
    }

    expect(names[0]).toEqual([s.constCatalog.name, s.varCatalog.name]);
    expect(names[1]).toEqual([cat.name]);
    expect(names[2]).toEqual(names[0]);
  });
});

test.describe('quitting a group', () => {
  test('it clears the current group when it was that one', { tag: ['@NAV-SEL-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    await app.actions.group.forgetAfterQuit(member.request, s.group.id);
    const home = await app.views.groups.home(member.request);

    expect(home.status).toBe(302);
    expect(home.location).toBe('/user/choose');
  });

  test('it keeps the current group when it was another one', { tag: ['@NAV-SEL-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await otherGroup();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    await app.actions.group.forgetAfterQuit(member.request, other.id);
    const home = await app.views.groups.home(member.request);

    expect(home.status).toBe(200);
  });
});
