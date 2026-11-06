/**
 * Catalog settings (specs/03-catalogs/catalog-edit.md; controller/ContractAdmin.hx doEdit/doUpdatePrices,
 * service/CatalogService.hx getForm/checkFormData/updateFutureDistribsStartEndOrdersDates, db/Catalog.hx).
 * The edit form is the same as the creation form (catalog-creation.forms.spec.ts) once the catalog exists.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { addDaysWall, addMs, atWallTime, fromSqlDateTime, toSqlDateTime } from '../../src/encodings/dates.js';
import { CatalogFlag, flags, hasFlag } from '../../src/encodings/flags.js';
import { decodeRights, Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A logged-in actor with the scenario group as current group. */
async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'coordinator') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

type CatalogRow = Record<string, any> & {
  id: number;
  name: string;
  userId: number | null;
  flags: number;
  description: string | null;
  orderStartDaysBeforeDistrib: number | null;
  orderEndHoursBeforeDistrib: number | null;
  distribMinOrdersTotal: number;
  catalogMinOrdersTotal: number;
  absentDistribsMaxNb: number;
  absencesStartDate: string | null;
  absencesEndDate: string | null;
};
const catalogRow = async (id: number) => (await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE id = ?', [id]))!;

type DistribRow = { id: number; date: string; orderStartDate: string; orderEndDate: string };
const distribRows = (catalogId: number) => query<DistribRow>('SELECT id, date, orderStartDate, orderEndDate FROM Distribution WHERE catalogId = ? ORDER BY date', [catalogId]);
const stamp = (d: Date) => toSqlDateTime(d);

const rightsOf = async (userId: number, groupId: number) =>
  decodeRights((await queryOne<{ rights: string | null }>('SELECT rights FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId]))!.rights);

test.describe('who can edit a catalog', () => {
  test('the coordinator of the catalog edits its settings', { tag: ['@CAT-CED-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.editForm(a.request, s.varCatalog.id);
    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { name: 'Œufs bio', description: 'Œufs de poules en plein air' });

    expect(form.status).toBe(200);
    expect(res.status).toBe(302);
    expect(res.location).toContain(app.urls.catalogDashboard(s.varCatalog.id));
    const row = await catalogRow(s.varCatalog.id);
    expect(row.name).toBe('Œufs bio');
    expect(row.description).toBe('Œufs de poules en plein air');
  });

  test('the group admin, who coordinates all catalogs, edits too', { tag: ['@CAT-CED-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.edit(a.request, s.constCatalog.id, { name: 'Légumes 2' });

    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await catalogRow(s.constCatalog.id)).name).toBe('Légumes 2');
  });

  test('a member and a coordinator of another catalog cannot edit it', { tag: ['@CAT-CED-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ firstName: 'Boris', lastName: 'Boulanger', email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });
    const stored = await catalogRow(s.constCatalog.id);

    for (const who of [await actor(app, as, s, 'member'), await as(baker)]) {
      await app.actions.group.select(who.request, s.group.id);
      const form = await app.actions.catalogs.editForm(who.request, s.constCatalog.id);
      const res = await app.actions.catalogs.edit(who.request, s.constCatalog.id, { name: 'Piraté' });

      expect(form.status).toBe(302);
      expect(form.location).not.toContain('/contractAdmin/edit');
      expect(res.location ?? '').not.toContain(app.urls.catalogDashboard(s.constCatalog.id));
    }
    expect(await catalogRow(s.constCatalog.id)).toEqual(stored);
  });
});

test.describe('constant orders: minimum delay before a distribution', () => {
  test('the form shows the closing delay but not the opening delay nor the minimum amounts', { tag: ['@CAT-CED-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const constant = await app.actions.catalogs.editForm(a.request, s.constCatalog.id);
    const variable = await app.actions.catalogs.editForm(a.request, s.varCatalog.id);

    expect(constant.offers).toEqual({ openingDelay: false, closingDelay: true, distribMinimum: false, catalogMinimum: false });
    expect(variable.offers).toEqual({ openingDelay: true, closingDelay: true, distribMinimum: true, catalogMinimum: true });
  });

  test('the delay entered is kept', { tag: ['@CAT-CED-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { closingDelayHours: 48 });

    expect((await catalogRow(s.constCatalog.id)).orderEndHoursBeforeDistrib).toBe(48);
    expect((await app.actions.catalogs.editForm(a.request, s.constCatalog.id)).closingDelayHours).toBe(48);
  });

  test('an empty delay becomes 72 hours, with a warning', { tag: ['@CAT-CED-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.edit(a.request, s.constCatalog.id, { closingDelayHours: null });

    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await catalogRow(s.constCatalog.id)).orderEndHoursBeforeDistrib).toBe(72);
    expect(res.alerts?.some((m) => m.text.includes('72h'))).toBe(true);
  });

  test('a delay of 0 becomes 72 hours too', { tag: ['@CAT-CED-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.constCatalog.id, { orderEndHoursBeforeDistrib: 24 });
    const a = await actor(app, as, s);

    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { closingDelayHours: 0 });

    expect((await catalogRow(s.constCatalog.id)).orderEndHoursBeforeDistrib).toBe(72);
  });
});

test.describe('variable orders: when ordering opens', () => {
  test('a number of days is kept', { tag: ['@CAT-CED-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { openingDelayDays: 5 });

    expect(res.location).toContain(app.urls.catalogDashboard(s.varCatalog.id));
    expect((await catalogRow(s.varCatalog.id)).orderStartDaysBeforeDistrib).toBe(5);
    expect((await app.actions.catalogs.editForm(a.request, s.varCatalog.id)).openingDelayDays).toBe(5);
  });

  test('0 days is refused and nothing is saved', { tag: ['@CAT-CED-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { orderStartDaysBeforeDistrib: 5 });
    const a = await actor(app, as, s);
    const stored = await catalogRow(s.varCatalog.id);

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { name: 'Autre nom', openingDelayDays: 0 });

    expect(res.flash?.kind).toBe('error');
    expect(res.flash?.text).toContain('ne peut pas être à zéro');
    expect(await catalogRow(s.varCatalog.id)).toEqual(stored);
  });

  test('an empty field falls back on the distribution cycle default', { tag: ['@CAT-CED-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { orderStartDaysBeforeDistrib: 5 });
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { openingDelayDays: null });

    expect(res.location).toContain(app.urls.catalogDashboard(s.varCatalog.id));
    expect((await catalogRow(s.varCatalog.id)).orderStartDaysBeforeDistrib).toBeNull();
  });
});

// UND-054 (Undecided): characterised as hx does today, a changed delay overwrites the order dates of all future distributions
test.describe('changing a delay updates the order window of the future distributions (UND-054, characterised)', () => {
  test('a new opening delay moves the opening of every future distribution, even a customised one', { tag: ['@CAT-CED-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [d1] = await distribRows(s.varCatalog.id);
    await query('UPDATE Distribution SET orderStartDate = ? WHERE id = ?', ['2030-01-01 08:00:00', d1.id]); // customised by hand
    const before = await distribRows(s.varCatalog.id);
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { openingDelayDays: 5 });

    const after = await distribRows(s.varCatalog.id);
    expect(after).toHaveLength(4);
    after.forEach((d, i) => {
      expect(d.orderStartDate).toBe(stamp(addMs(fromSqlDateTime(d.date), -5 * DAY)));
      expect(d.orderEndDate).toBe(before[i].orderEndDate); // the closing delay did not change
    });
    expect(res.flash?.text).toContain('écrasées');
  });

  test('a new closing delay moves the closing of every future distribution', { tag: ['@CAT-CED-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const before = await distribRows(s.varCatalog.id);
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { closingDelayHours: 36 });

    const after = await distribRows(s.varCatalog.id);
    after.forEach((d, i) => {
      expect(d.orderEndDate).toBe(stamp(addMs(fromSqlDateTime(d.date), -36 * HOUR)));
      expect(d.orderStartDate).toBe(before[i].orderStartDate);
    });
    expect(res.flash?.text).toContain('écrasées');
  });

  test('applies to a constant catalog too, and only to its own distributions', { tag: ['@CAT-CED-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const otherBefore = await distribRows(s.varCatalog.id);
    const a = await actor(app, as, s);

    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { closingDelayHours: 48 });

    (await distribRows(s.constCatalog.id)).forEach((d) => expect(d.orderEndDate).toBe(stamp(addMs(fromSqlDateTime(d.date), -48 * HOUR))));
    expect(await distribRows(s.varCatalog.id)).toEqual(otherBefore);
  });

  test('distributions already held are left alone', { tag: ['@CAT-CED-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const past = atWallTime(addDaysWall(clock.now(), -3), 18);
    const md = await make.multiDistrib({ group: s.group, place: s.place, start: past });
    const old = await make.distribution({ catalog: s.varCatalog, multiDistrib: md });
    const stored = (await distribRows(s.varCatalog.id)).find((d) => d.id === old.id)!;
    const a = await actor(app, as, s);

    await app.actions.catalogs.edit(a.request, s.varCatalog.id, { openingDelayDays: 5, closingDelayHours: 36 });

    expect((await distribRows(s.varCatalog.id)).find((d) => d.id === old.id)).toEqual(stored);
  });

  test('saving without changing a delay leaves the distributions alone', { tag: ['@CAT-CED-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { orderStartDaysBeforeDistrib: 5, orderEndHoursBeforeDistrib: 36 });
    const [d1] = await distribRows(s.varCatalog.id);
    await query('UPDATE Distribution SET orderStartDate = ?, orderEndDate = ? WHERE id = ?', ['2030-01-01 08:00:00', '2030-01-02 08:00:00', d1.id]);
    const stored = await distribRows(s.varCatalog.id);
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { name: 'Nouveau nom' });

    expect(res.location).toContain(app.urls.catalogDashboard(s.varCatalog.id));
    expect(await distribRows(s.varCatalog.id)).toEqual(stored);
    expect(res.flash?.text ?? '').not.toContain('écrasées');
  });
});

test.describe('variable orders: minimum order totals', () => {
  test('a minimum per distribution and a minimum for the catalog are kept', { tag: ['@CAT-CED-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { distribMinimum: 12.5, catalogMinimum: 150 });

    expect(res.location).toContain(app.urls.catalogDashboard(s.varCatalog.id));
    const row = await catalogRow(s.varCatalog.id);
    expect(row.distribMinOrdersTotal).toBe(12.5);
    expect(row.catalogMinOrdersTotal).toBe(150);
  });

  test('the minimums are not offered on a constant catalog and a post cannot set them', { tag: ['@CAT-CED-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.editForm(a.request, s.constCatalog.id);
    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { distribMinimum: 10, catalogMinimum: 100 });

    expect(form.offers.distribMinimum || form.offers.catalogMinimum).toBe(false);
    const row = await catalogRow(s.constCatalog.id);
    expect([row.distribMinOrdersTotal, row.catalogMinOrdersTotal]).toEqual([0, 0]);
  });

  test('a minimum of 0 per distribution clears the absence settings', { tag: ['@CAT-CED-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, {
      distribMinOrdersTotal: 10,
      absentDistribsMaxNb: 2,
      absencesStartDate: toSqlDateTime(s.multiDistribs[0].distribStartDate),
      absencesEndDate: toSqlDateTime(s.multiDistribs[3].distribStartDate),
    });
    const a = await actor(app, as, s);

    await app.actions.catalogs.edit(a.request, s.varCatalog.id, { distribMinimum: 0 });

    const row = await catalogRow(s.varCatalog.id);
    expect(row.absentDistribsMaxNb).toBe(0);
    expect(row.absencesStartDate).toBeNull();
    expect(row.absencesEndDate).toBeNull();
  });

  test('a positive minimum per distribution keeps the absence settings', { tag: ['@CAT-CED-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const start = toSqlDateTime(s.multiDistribs[0].distribStartDate);
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 10, absentDistribsMaxNb: 2, absencesStartDate: start, absencesEndDate: toSqlDateTime(s.multiDistribs[3].distribStartDate) });
    const a = await actor(app, as, s);

    await app.actions.catalogs.edit(a.request, s.varCatalog.id, { distribMinimum: 20 });

    const row = await catalogRow(s.varCatalog.id);
    expect(row.absentDistribsMaxNb).toBe(2);
    expect(row.absencesStartDate).toBe(start);
  });

  test('a catalog minimum above 0 comes with a warning about leaving distributions open', { tag: ['@CAT-CED-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const withMin = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { catalogMinimum: 150 });
    const without = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { catalogMinimum: 0 });

    expect(withMin.alerts?.some((m) => m.text.includes('Pensez à laisser suffisamment de distributions ouvertes') && m.text.includes('150'))).toBe(true);
    expect(without.alerts?.some((m) => m.text.includes('Pensez à laisser'))).toBe(false);
  });
});

test.describe('notifications when orders close', () => {
  test('a variable catalog does not offer the vendor notification, a constant one does', { tag: ['@CAT-CED-006', '@CAT-CED-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const variable = await app.actions.catalogs.editForm(a.request, s.varCatalog.id);
    const constant = await app.actions.catalogs.editForm(a.request, s.constCatalog.id);

    expect(variable.flags.offered).not.toContain('notifyVendor');
    expect(variable.flags.offered).toContain('notifyContact');
    expect(constant.flags.offered).toEqual(expect.arrayContaining(['notifyVendor', 'notifyContact']));
  });

  test('the vendor of a variable catalog is notified when orders close, whatever the flags', { tag: ['@CAT-CED-006'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    await app.actions.catalogs.edit(a.request, s.varCatalog.id, { flags: ['usersCanOrder'] });
    expect(hasFlag((await catalogRow(s.varCatalog.id)).flags, CatalogFlag.NotifyVendorOnOrderEnd)).toBe(false);
    clock.set(new Date(s.multiDistribs[0].orderEndDate.getTime() + 90 * 60_000));
    const mark = await mails.mark();

    await cron.run('hour');

    const sent = (await mails.to('ferme@camap.test', mark)).filter((m) => m.title.includes('Œufs'));
    expect(sent).toHaveLength(1);
  });

  test('a coordinator chooses to notify the vendor and the contact of a constant catalog', { tag: ['@CAT-CED-008'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { flags: ['usersCanOrder', 'notifyVendor', 'notifyContact'] });

    const row = await catalogRow(s.constCatalog.id);
    expect(row.flags).toBe(flags(CatalogFlag, 'UsersCanOrder', 'NotifyVendorOnOrderEnd', 'NotifyContactOnOrderEnd'));
    // (saving also gave the empty closing delay its 72 hours, which moved the closing of the distributions)
    const [first] = await distribRows(s.constCatalog.id);
    clock.set(new Date(fromSqlDateTime(first.orderEndDate).getTime() + 90 * 60_000));
    const mark = await mails.mark();
    await cron.run('hour');
    expect((await mails.to('ferme@camap.test', mark)).filter((m) => m.title.includes('Légumes'))).toHaveLength(1);
    expect((await mails.to(s.users.coordinator.email, mark)).filter((m) => m.title.includes('Commandes mises à jour'))).toHaveLength(1);
  });

  test('the box can be unticked again', { tag: ['@CAT-CED-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.constCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'NotifyVendorOnOrderEnd', 'NotifyContactOnOrderEnd') });
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.editForm(a.request, s.constCatalog.id);
    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { flags: ['usersCanOrder'] });

    expect(form.flags.checked).toEqual(['usersCanOrder', 'notifyVendor', 'notifyContact']);
    expect((await catalogRow(s.constCatalog.id)).flags).toBe(flags(CatalogFlag, 'UsersCanOrder'));
  });
});

test.describe('display and ordering options', () => {
  test('a coordinator can show the product prices on the group page', { tag: ['@CAT-CED-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.editForm(a.request, s.varCatalog.id);
    await app.actions.catalogs.edit(a.request, s.varCatalog.id, { flags: ['usersCanOrder', 'displayPrices'] });

    expect(form.flags.offered).toContain('displayPrices');
    expect(form.flags.checked).not.toContain('displayPrices');
    expect(hasFlag((await catalogRow(s.varCatalog.id)).flags, CatalogFlag.DisplayPricesOnGroupPage)).toBe(true);
  });

  test('a coordinator can enable stock management', { tag: ['@CAT-CED-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.editForm(a.request, s.constCatalog.id);
    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { flags: ['usersCanOrder', 'stockManagement'] });

    expect(form.flags.offered).toContain('stockManagement');
    expect(form.flags.checked).not.toContain('stockManagement');
    expect(hasFlag((await catalogRow(s.constCatalog.id)).flags, CatalogFlag.StockManagement)).toBe(true);
  });

  test('a coordinator can switch off user ordering, and the catalog leaves the shop', { tag: ['@CAT-CED-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const member = await actor(app, as, s, 'member');
    const listed = async () => (await app.views.shop.home(member.request)).text;
    expect(await listed()).toContain(s.constCatalog.name);

    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { flags: [] });

    expect(hasFlag((await catalogRow(s.constCatalog.id)).flags, CatalogFlag.UsersCanOrder)).toBe(false);
    expect(await listed()).not.toContain(s.constCatalog.name);
  });

  test('user ordering can be switched back on', { tag: ['@CAT-CED-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.constCatalog.id, { flags: 0 });
    const a = await actor(app, as, s);
    const member = await actor(app, as, s, 'member');
    expect((await app.views.shop.home(member.request)).text).not.toContain(s.constCatalog.name);

    await app.actions.catalogs.edit(a.request, s.constCatalog.id, { flags: ['usersCanOrder'] });

    expect((await app.views.shop.home(member.request)).text).toContain(s.constCatalog.name);
  });
});

test.describe('changing the catalog contact', () => {
  test('the new contact gets the coordinator right on this catalog, with the messages and membership rights', { tag: ['@CAT-CED-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.edit(a.request, s.varCatalog.id, { contactId: s.users.member2.id });

    expect(res.location).toContain(app.urls.catalogDashboard(s.varCatalog.id));
    expect((await catalogRow(s.varCatalog.id)).userId).toBe(s.users.member2.id);
    const rights = await rightsOf(s.users.member2.id, s.group.id);
    expect(rights).toContainEqual({ right: 'ContractAdmin', params: [String(s.varCatalog.id)] });
    expect(rights).toContainEqual({ right: 'Messages', params: null });
    expect(rights).toContainEqual({ right: 'Membership', params: null });
  });

  test('the old contact loses the right on this catalog only, and keeps the rest', { tag: ['@CAT-CED-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    await app.actions.catalogs.edit(a.request, s.varCatalog.id, { contactId: s.users.member2.id });

    const rights = await rightsOf(s.users.coordinator.id, s.group.id);
    expect(rights).not.toContainEqual(Right.ContractAdmin(s.varCatalog.id));
    expect(rights).toContainEqual(Right.ContractAdmin(s.constCatalog.id));
  });

  test('the new contact can then edit the catalog, the old one cannot', { tag: ['@CAT-CED-007', '@CAT-CED-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');
    await app.actions.catalogs.edit(admin.request, s.varCatalog.id, { contactId: s.users.member2.id });
    const newContact = await actor(app, as, s, 'member2');
    const oldContact = await actor(app, as, s, 'coordinator');

    const asNew = await app.actions.catalogs.editForm(newContact.request, s.varCatalog.id);
    const asOld = await app.actions.catalogs.editForm(oldContact.request, s.varCatalog.id);

    expect(asNew.status).toBe(200);
    expect(asOld.status).toBe(302);
  });

  test('saving with the same contact does not touch the rights', { tag: ['@CAT-CED-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const before = await rightsOf(s.users.coordinator.id, s.group.id);
    const a = await actor(app, as, s, 'groupAdmin');

    await app.actions.catalogs.edit(a.request, s.varCatalog.id, { name: 'Autre nom' });

    expect(await rightsOf(s.users.coordinator.id, s.group.id)).toEqual(before);
    expect(await rightsOf(s.users.member2.id, s.group.id)).toEqual([]);
  });
});

test.describe('refreshing the prices of the existing orders', () => {
  /** An order on the first distribution, bought at 1.00 while the product now costs 3.00. */
  async function orderedAtOldPrice(s: Scenario, catalog: 'var' | 'const') {
    const product = s.products[catalog][0];
    const distribution = s.distributions[0][catalog];
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    const order = await make.userOrder({ user: s.users.member, product: { id: product.id, price: 1 }, distribution, basket, quantity: 2 });
    await make.setProduct(product.id, { price: 3 });
    return { order, distribution, product };
  }
  const priceOf = async (orderId: number) => (await queryOne<{ productPrice: number }>('SELECT productPrice FROM UserOrder WHERE id = ?', [orderId]))!.productPrice;

  test('puts the current product price on the orders of a distribution of a variable catalog', { tag: ['@CAT-CED-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { order, distribution } = await orderedAtOldPrice(s, 'var');
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.updatePrices(a.request, s.varCatalog.id, distribution.id);

    expect(res.status).toBe(302);
    expect(res.location).toContain(`/contractAdmin/orders/${s.varCatalog.id}`);
    expect(await priceOf(order.id)).toBe(3);
  });

  test('only the orders of the chosen distribution are refreshed', { tag: ['@CAT-CED-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { order, distribution } = await orderedAtOldPrice(s, 'var');
    const basket2 = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[1] });
    const other = await make.userOrder({ user: s.users.member, product: { id: s.products.var[0].id, price: 1 }, distribution: s.distributions[1].var, basket: basket2 });
    const a = await actor(app, as, s);

    await app.actions.catalogs.updatePrices(a.request, s.varCatalog.id, distribution.id);

    expect(await priceOf(order.id)).toBe(3);
    expect(await priceOf(other.id)).toBe(1);
  });

  test('a variable catalog without a chosen distribution redirects to the distribution choice', { tag: ['@CAT-CED-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { order } = await orderedAtOldPrice(s, 'var');
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.updatePrices(a.request, s.varCatalog.id);

    expect(res.status).toBe(302);
    expect(res.location).toContain(`/contractAdmin/selectDistrib/${s.varCatalog.id}`);
    expect(await priceOf(order.id)).toBe(1);
  });

  test('is refused to somebody who does not manage the catalog', { tag: ['@CAT-CED-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { order, distribution } = await orderedAtOldPrice(s, 'var');
    const member = await actor(app, as, s, 'member');

    const res = await app.actions.catalogs.updatePrices(member.request, s.varCatalog.id, distribution.id);

    expect(res.status).toBe(302);
    expect(res.location).not.toContain('/contractAdmin/orders');
    expect(await priceOf(order.id)).toBe(1);
  });

  // The action is a plain GET with no security token: a link is enough to rewrite the prices (documented in CAT-CED-012).
  test('runs from a plain link, with no confirmation token', { tag: ['@CAT-CED-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { order, distribution } = await orderedAtOldPrice(s, 'var');
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.updatePrices(a.request, s.varCatalog.id, distribution.id);

    expect(res.location).not.toContain('token');
    expect(await priceOf(order.id)).toBe(3);
  });

  // UND-050 (Undecided): the spec says the page fails after the prices are updated. hx in fact fails before touching any order:
  // Catalog.getOrders(null) throws "This type of contract must have a delivery" (Catalog.hx:271, called from ContractAdmin.hx:767).
  test('a constant catalog fails with an error and no order is refreshed (UND-050, characterised)', { tag: ['@CAT-CED-012', '@CAT-CED-013'] }, async ({ app, as, errors }) => {
    errors.expect(/must have a delivery/);
    const s = await make.amapScenario();
    const { order, distribution } = await orderedAtOldPrice(s, 'const');
    const a = await actor(app, as, s);

    const withoutDistrib = await app.actions.catalogs.updatePrices(a.request, s.constCatalog.id);
    const withDistrib = await app.actions.catalogs.updatePrices(a.request, s.constCatalog.id, distribution.id);

    expect([withoutDistrib.status, withDistrib.status]).not.toContain(302);
    expect(await errors.newRows()).toHaveLength(2);
    expect(await priceOf(order.id)).toBe(1);
  });
});
