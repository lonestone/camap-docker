/**
 * The group administration dashboard and the pages around it (specs/02-groups/group-settings.md;
 * controller/AmapAdmin.hx, controller/Amap.hx doDefault, service/UserService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';
import * as make from '../../src/factories/index.js';
import type { GroupAdminSection } from '../../src/targets/types.js';

test.describe('the group administration dashboard', () => {
  test('a group admin opens the dashboard: the group, its members and its active catalogs', { tag: ['@GRP-SET-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    const page = await app.views.groupAdmin.dashboard(a.request);

    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
    expect(page.text).toContain('AMAP des Tests');
    expect(page.memberCount).toBe(6);
    expect(page.catalogCount).toBe(2);
  });

  test('the dashboard counts only the active catalogs', { tag: ['@GRP-SET-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    await make.catalog({ group: s.group, vendor: s.vendor, name: 'Terminé', startDate: addDaysWall(now, -90), endDate: addDaysWall(now, -10) });
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    expect((await app.views.groupAdmin.dashboard(a.request)).catalogCount).toBe(2);
  });

  const refused: ['member' | 'membershipManager' | 'coordinator' | 'messagesManager', string][] = [
    ['member', 'a plain member'],
    ['membershipManager', 'a membership manager'],
    ['coordinator', 'a catalog coordinator'],
    ['messagesManager', 'a messages manager'],
  ];
  for (const [who, label] of refused) {
    test(`${label} is sent back to the home page`, { tag: ['@GRP-SET-001'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);
      await app.actions.group.select(u.request, s.group.id);

      const page = await app.views.groupAdmin.dashboard(u.request);

      expect(page.status).toBe(302);
      expect(page.location).toBe('/');
      // (the explanation is lost: "/" itself redirects)
      expect(page.text).not.toContain('membres.');
    });
  }
});

test.describe('the settings reachable from the dashboard', () => {
  test('the dashboard links to the group settings, VAT rates, currency, payment types, volunteers, documents and media', { tag: ['@GRP-SET-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    const page = await app.views.groupAdmin.dashboard(a.request);

    expect(page.sections).toEqual(expect.arrayContaining(['settings', 'vatRates', 'currency', 'payments', 'volunteers', 'documents', 'media']));
    // the dashboard also links to rights, memberships and places, described in their own domain
    expect(page.sections).toEqual(expect.arrayContaining(['rights', 'membership', 'places']));
  });

  const sections: GroupAdminSection[] = ['settings', 'vatRates', 'currency', 'payments', 'volunteers', 'documents', 'media'];
  for (const section of sections) {
    test(`a group admin opens the "${section}" settings`, { tag: ['@GRP-SET-009'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await as(s.users.groupAdmin);
      await app.actions.group.select(a.request, s.group.id);

      const page = await app.views.groupAdmin.section(a.request, section);

      expect(page.status).toBe(200);
      expect(page.location).toBeNull();
    });

    if (section === 'settings') continue; // refused with an error page: see group-settings.forms.spec.ts
    test(`a plain member cannot open the "${section}" settings`, { tag: ['@GRP-SET-009'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const m = await as(s.users.member);
      await app.actions.group.select(m.request, s.group.id);

      const page = await app.views.groupAdmin.section(m.request, section);

      expect(page.status).toBe(302);
      expect(page.location).toBe('/');
    });
  }
});

test.describe('the catalogs on the group page', () => {
  test('a member sees the current catalogs of the group, sorted by name, and none of another group', { tag: ['@GRP-SET-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    await make.catalog({ group: other, vendor: s.vendor, name: 'Catalogue étranger' });
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const page = await app.views.groups.catalogList(m.request);

    expect(page.status).toBe(200);
    expect(page.catalogs.map((c) => c.name)).toEqual(['Légumes (contrat AMAP)', 'Œufs (contrat variable)']);
    expect(page.catalogs.map((c) => c.id).sort()).toEqual([s.constCatalog.id, s.varCatalog.id].sort());
  });

  test('a catalog that has not started yet is listed', { tag: ['@GRP-SET-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    await make.catalog({ group: s.group, vendor: s.vendor, name: 'À venir', startDate: addDaysWall(now, 20), endDate: addDaysWall(now, 200) });
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const page = await app.views.groups.catalogList(m.request);

    expect(page.catalogs.map((c) => c.name)).toContain('À venir');
  });

  test('an ended catalog is not listed, whether it ended last week or long ago', { tag: ['@GRP-SET-010'] }, async ({ app, as }) => {
    // The spec statement says "current and ended catalogs": hx drops the ended ones (Amap.hx doDefault
    // asks for those ended less than a month ago, then removes every catalog whose end date is past).
    const s = await make.amapScenario();
    const now = clock.now();
    await make.catalog({ group: s.group, vendor: s.vendor, name: 'Terminé récemment', startDate: addDaysWall(now, -90), endDate: addDaysWall(now, -7) });
    await make.catalog({ group: s.group, vendor: s.vendor, name: 'Terminé il y a longtemps', startDate: addDaysWall(now, -400), endDate: addDaysWall(now, -200) });
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const page = await app.views.groups.catalogList(m.request);

    expect(page.catalogs.map((c) => c.name)).toEqual(['Légumes (contrat AMAP)', 'Œufs (contrat variable)']);
  });
});

test.describe('what registration and login ask for', () => {
  const cases: [string, number, boolean, boolean][] = [
    ['nothing', 0, false, false],
    ['a phone number', flags(GroupFlag, 'PhoneRequired'), true, false],
    ['an address', flags(GroupFlag, 'AddressRequired'), false, true],
    ['a phone number and an address', flags(GroupFlag, 'PhoneRequired', 'AddressRequired'), true, true],
  ];
  for (const [label, groupFlags, phone, address] of cases) {
    test(`the group page asks a visitor for ${label}`, { tag: ['@GRP-SET-006'] }, async ({ app, anon }) => {
      const contact = await make.user();
      const g = await make.group({ regOption: 'Open', flags: groupFlags, contact });
      await make.place({ group: g });

      const page = await app.views.groups.groupPageRequirements(anon.request, g.id);

      expect(page.status).toBe(200);
      expect(page.buttons).toBeGreaterThan(0);
      expect(page.phoneRequired).toBe(phone);
      expect(page.addressRequired).toBe(address);
    });

    test(`the login form shows the same requirement (${label}) for the group the visitor opened`, { tag: ['@GRP-SET-006'] }, async ({ app, anon }) => {
      const contact = await make.user();
      const g = await make.group({ regOption: 'Open', flags: groupFlags, contact });
      await make.place({ group: g });
      await app.views.groups.page(anon.request, g.id); // the open group is remembered by the session

      const page = await app.views.groups.loginPageRequirements(anon.request);

      expect(page.status).toBe(200);
      expect(page.buttons).toBeGreaterThan(0);
      expect(page.phoneRequired).toBe(phone);
      expect(page.addressRequired).toBe(address);
    });
  }

  test('the waiting-list registration of a group asks for them too', { tag: ['@GRP-SET-006'] }, async ({ app, anon }) => {
    const contact = await make.user();
    const g = await make.group({ regOption: 'WaitingList', flags: flags(GroupFlag, 'PhoneRequired', 'AddressRequired'), contact });
    await make.place({ group: g });

    const page = await app.views.groups.groupPageRequirements(anon.request, g.id);

    expect(page.buttons).toBeGreaterThan(1); // registration and login
    expect(page.phoneRequired).toBe(true);
    expect(page.addressRequired).toBe(true);
  });

  test('a visitor with no group in the session sees no requirement on the login form', { tag: ['@GRP-SET-006'] }, async ({ app, anon }) => {
    await make.group({ regOption: 'Open', flags: flags(GroupFlag, 'PhoneRequired', 'AddressRequired') });

    const page = await app.views.groups.loginPageRequirements(anon.request);

    expect(page.status).toBe(200);
    expect(page.phoneRequired).toBe(false);
    expect(page.addressRequired).toBe(false);
  });
});
