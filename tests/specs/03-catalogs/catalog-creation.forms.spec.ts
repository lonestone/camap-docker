/**
 * Catalog creation (specs/03-catalogs/catalog-creation.md; controller/Contract.hx,
 * service/CatalogService.hx, db/Catalog.hx, service/VolunteerService.hx).
 * A catalog is started from the vendor search, then created from a form.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne, update } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { CatalogFlag, CatalogType, hasFlag } from '../../src/encodings/flags.js';
import { decodeRights } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** A logged-in actor with the scenario group as current group. */
async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'groupAdmin') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

type CatalogRow = {
  id: number;
  name: string;
  type: number;
  userId: number | null;
  groupId: number;
  vendorId: number;
  startDate: string;
  endDate: string;
  flags: number;
  distributorNum: number;
};
const catalogsAfter = (id: number) => query<CatalogRow>('SELECT * FROM Catalog WHERE id > ? ORDER BY id', [id]);
const lastCatalogId = async () => (await queryOne<{ id: number | null }>('SELECT MAX(id) AS id FROM Catalog'))?.id ?? 0;
const day = (clock: { now(): Date }, n: number) => make.parisDate(addDaysWall(clock.now(), n));

test.describe('starting a catalog: vendor search', () => {
  test('only a coordinator of all catalogs can search for a vendor', { tag: ['@CAT-CCR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const all = await actor(app, as, s);
    const oneCatalogOnly = await actor(app, as, s, 'coordinator'); // ContractAdmin on two catalogs, not on all
    const member = await actor(app, as, s, 'member');

    expect((await app.actions.catalogs.findVendors(all.request, { name: 'Ferme' })).status).toBe(200);
    expect((await app.actions.catalogs.findVendors(oneCatalogOnly.request, { name: 'Ferme' })).status).toBe(302);
    expect((await app.actions.catalogs.findVendors(member.request, { name: 'Ferme' })).status).toBe(302);
  });

  test('searches the name words, ignoring filler words', { tag: ['@CAT-CCR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const soleil = await make.vendor({ name: 'Ferme du Soleil' });
    const miel = await make.vendor({ name: 'Miel Soleil' });
    const lune = await make.vendor({ name: 'Les Jardins de la Lune' });
    const a = await actor(app, as, s);

    const bySun = await app.actions.catalogs.findVendors(a.request, { name: 'Soleil' });
    const byFiller = await app.actions.catalogs.findVendors(a.request, { name: 'Ferme du Soleil' }); // "ferme" and "du" are dropped
    const byTwoWords = await app.actions.catalogs.findVendors(a.request, { name: 'soleil lune' }); // any word matches

    expect(bySun.vendorIds.sort()).toEqual([soleil.id, miel.id].sort());
    expect(byFiller.vendorIds.sort()).toEqual([soleil.id, miel.id].sort());
    expect(byTwoWords.vendorIds.sort()).toEqual([soleil.id, miel.id, lune.id].sort());
  });

  test('searches by profession, main or secondary ones', { tag: ['@CAT-CCR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const bee = await make.vendor({ name: 'Rucher A' });
    const secondary = await make.vendor({ name: 'Rucher B' });
    const other = await make.vendor({ name: 'Rucher C' });
    await update('Vendor', { id: bee.id }, { profession: 1 });
    await update('Vendor', { id: secondary.id }, { profession: 2, production2: 1 });
    await update('Vendor', { id: other.id }, { profession: 2 });
    const a = await actor(app, as, s);

    const found = await app.actions.catalogs.findVendors(a.request, { profession: 1 });

    expect(found.vendorIds.sort()).toEqual([bee.id, secondary.id].sort());
  });

  test('searches near the group\'s main place, nearest first, skipping vendors with no position', { tag: ['@CAT-CCR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await update('Place', { id: s.place.id }, { lat: 47.2, lng: -1.55 });
    const near = await make.vendor({ name: 'Proche' });
    const mid = await make.vendor({ name: 'Moyen' });
    const far = await make.vendor({ name: 'Lointain' });
    await update('Vendor', { id: mid.id }, { lat: 47.5, lng: -1.4 });
    await update('Vendor', { id: far.id }, { lat: 48.85, lng: 2.35 });
    await update('Vendor', { id: near.id }, { lat: 47.21, lng: -1.56 });
    const a = await actor(app, as, s);

    const found = await app.actions.catalogs.findVendors(a.request, { geoloc: true });

    // the scenario vendor has no position: it is left out
    expect(found.vendorIds).toEqual([near.id, mid.id, far.id]);
  });

  test('shows at most 30 results', { tag: ['@CAT-CCR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    for (let i = 0; i < 35; i++) await make.vendor({ name: `Maraicher ${i}` });
    const a = await actor(app, as, s);

    const found = await app.actions.catalogs.findVendors(a.request, { name: 'Maraicher' });

    expect(found.vendorIds).toHaveLength(30);
  });
});

test.describe('creating a vendor', () => {
  test('the new-vendor form asks for the personal-data consent', { tag: ['@CAT-CCR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.vendorForm(a.request);

    expect(form.status).toBe(200);
    expect(form.offersGdprConsent).toBe(true);
  });
});

test.describe('choosing the vendor and the catalog type', () => {
  test('a disabled vendor cannot be picked for a new catalog', { tag: ['@CAT-CCR-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const disabled = await make.vendor({ name: 'Producteur banni', disabled: 2 });
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.typeChoices(a.request, disabled.id);

    expect(res.status).toBe(302);
    expect(res.flash?.kind).toBe('error');
    expect(res.types).toEqual([]);
  });

  // Finding: only the type-choice page checks the vendor; the creation form itself, reached by its URL, accepts a disabled vendor.
  test('a disabled vendor still gets a catalog when the creation form is opened directly (characterised)', { tag: ['@CAT-CCR-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const disabled = await make.vendor({ name: 'Producteur banni', disabled: 2 });
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    const res = await app.actions.catalogs.create(a.request, disabled.id, 'variable', { contactId: s.users.member.id });

    expect(res.flash?.kind).toBe('ok');
    const [created] = await catalogsAfter(before);
    expect(created.vendorId).toBe(disabled.id);
  });

  test('offers constant and variable orders; an enabled vendor is accepted', { tag: ['@CAT-CCR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.typeChoices(a.request, s.vendor.id);

    expect(res.status).toBe(200);
    expect(res.types.sort()).toEqual(['constant', 'variable']);
  });

  test('variable orders are the default type, constant orders can be chosen', { tag: ['@CAT-CCR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    const byDefault = await app.actions.catalogs.create(a.request, s.vendor.id, undefined, { name: 'Par défaut', contactId: s.users.member.id });
    const constant = await app.actions.catalogs.create(a.request, s.vendor.id, 'constant', { name: 'Classique', contactId: s.users.member.id });
    const variable = await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { name: 'Variable', contactId: s.users.member.id });

    // (a constant catalog with no order deadline also flashes a warning, so the flash is not compared)
    expect([byDefault.status, constant.status, variable.status]).toEqual([302, 302, 302]);
    const rows = await catalogsAfter(before);
    expect(Object.fromEntries(rows.map((r) => [r.name, r.type]))).toEqual({
      'Par défaut': CatalogType.VariableOrders,
      Classique: CatalogType.ConstantOrders,
      Variable: CatalogType.VariableOrders,
    });
  });
});

test.describe('the creation form', () => {
  test('is pre-filled with a default name, today as start date and one year later as end date', { tag: ['@CAT-CCR-005'] }, async ({ app, as, clock }) => {
    clock.set('2026-11-10 12:00:00');
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const variable = await app.actions.catalogs.creationForm(a.request, s.vendor.id, 'variable');
    const constant = await app.actions.catalogs.creationForm(a.request, s.vendor.id, 'constant');

    expect(variable.status).toBe(200);
    expect(variable.name).toBe(`Contrat AMAP variable - ${s.vendor.name}`);
    expect(constant.name).toBe(`Contrat AMAP classique - ${s.vendor.name}`);
    for (const f of [variable, constant]) {
      expect(f.startDate).toBe('2026-11-10');
      expect(f.endDate).toBe('2027-11-10');
    }
  });

  test('the default type is variable when none is given', { tag: ['@CAT-CCR-004', '@CAT-CCR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.creationForm(a.request, s.vendor.id);

    expect(form.name).toBe(`Contrat AMAP variable - ${s.vendor.name}`);
  });

  test('the contact is compulsory and chosen among the group members', { tag: ['@CAT-CCR-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    const form = await app.actions.catalogs.creationForm(a.request, s.vendor.id, 'constant');
    const res = await app.actions.catalogs.create(a.request, s.vendor.id, 'constant', { contactId: null });

    expect(form.contactRequired).toBe(true);
    expect(form.contactChoices).toContain(s.users.member.id);
    expect(form.contactChoices).not.toContain(s.users.nonMember.id);
    expect(res.status).toBe(200); // the form is shown again
    expect(await catalogsAfter(before)).toEqual([]);
  });

  test('offers the users-can-order flag, ticked by default', { tag: ['@CAT-CCR-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.creationForm(a.request, s.vendor.id, 'variable');

    expect(form.flags.offered).toContain('usersCanOrder');
    expect(form.flags.checked).toEqual(['usersCanOrder']);
  });

  // UND-037 (Undecided): hx no longer offers the percentage fee
  test('no longer offers a percentage fee on orders (UND-037, characterised)', { tag: ['@CAT-CCR-014'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const variable = await app.actions.catalogs.creationForm(a.request, s.vendor.id, 'variable');
    const constant = await app.actions.catalogs.creationForm(a.request, s.vendor.id, 'constant');

    expect(variable.offersPercentageFee).toBe(false);
    expect(constant.offersPercentageFee).toBe(false);
  });
});

test.describe('saving a new catalog', () => {
  test('accepts user orders by default', { tag: ['@CAT-CCR-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    const res = await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { contactId: s.users.member.id });

    expect(res.flash?.kind).toBe('ok');
    const [created] = await catalogsAfter(before);
    expect(hasFlag(created.flags, CatalogFlag.UsersCanOrder)).toBe(true);
    expect(hasFlag(created.flags, CatalogFlag.StockManagement)).toBe(false);
  });

  test('saves the group, the vendor, the contact and the default name', { tag: ['@CAT-CCR-005', '@CAT-CCR-006'] }, async ({ app, as, clock }) => {
    clock.set('2026-11-10 12:00:00');
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    await app.actions.catalogs.create(a.request, s.vendor.id, 'constant', { contactId: s.users.member.id });

    const [created] = await catalogsAfter(before);
    expect(created).toMatchObject({
      name: `Contrat AMAP classique - ${s.vendor.name}`,
      groupId: s.group.id,
      vendorId: s.vendor.id,
      userId: s.users.member.id,
      type: CatalogType.ConstantOrders,
      startDate: '2026-11-10 00:00:00',
      endDate: '2027-11-10 23:59:59',
    });
  });

  test('creates one volunteer role per volunteer wanted at each distribution', { tag: ['@CAT-CCR-008', '@DIS-ROL-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { name: 'Avec bénévoles', contactId: s.users.member.id, volunteers: 3 });

    const [created] = await catalogsAfter(before);
    const roles = await query<{ name: string; catalogId: number | null; groupId: number }>('SELECT name, catalogId, groupId FROM VolunteerRole WHERE catalogId = ? ORDER BY id', [created.id]);
    expect(roles).toHaveLength(3);
    expect(roles.every((r) => r.groupId === s.group.id)).toBe(true);
    roles.forEach((r, i) => expect(r.name.endsWith(`Avec bénévoles ${i + 1}`)).toBe(true));
  });

  test('creates no role when no volunteer is wanted, and at most 20 roles', { tag: ['@CAT-CCR-008', '@DIS-ROL-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { name: 'Sans', contactId: s.users.member.id, volunteers: 0 });
    await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { name: 'Beaucoup', contactId: s.users.member.id, volunteers: 25 });

    const [none, many] = await catalogsAfter(before);
    const count = async (id: number) => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM VolunteerRole WHERE catalogId = ?', [id]))!.n;
    expect(await count(none.id)).toBe(0);
    expect(await count(many.id)).toBe(20);
  });

  test('adds the vendor to the group when the vendor is also a user', { tag: ['@CAT-CCR-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario(); // the vendor's user is not a member
    const a = await actor(app, as, s);
    const membership = () => queryOne<{ rights: string | null }>('SELECT rights FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.vendor.id, s.group.id]);
    expect(await membership()).toBeUndefined();

    await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { contactId: s.users.member.id });

    expect(await membership()).toBeDefined();
  });

  test('does not add anybody else when the vendor is not a user', { tag: ['@CAT-CCR-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const solo = await make.vendor({ name: 'Producteur sans compte' });
    const a = await actor(app, as, s);
    const members = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM UserGroup WHERE groupId = ?', [s.group.id]))!.n;
    const before = await members();

    await app.actions.catalogs.create(a.request, solo.id, 'variable', { contactId: s.users.member.id });

    expect(await members()).toBe(before); // the contact was already a member
  });

  test('gives the contact the catalog, messages and membership rights', { tag: ['@CAT-CCR-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { contactId: s.users.member.id });

    const [created] = await catalogsAfter(before);
    const row = await queryOne<{ rights: string | null }>('SELECT rights FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);
    const rights = decodeRights(row!.rights);
    expect(rights).toContainEqual({ right: 'ContractAdmin', params: [String(created.id)] });
    expect(rights).toContainEqual({ right: 'Messages', params: null });
    expect(rights).toContainEqual({ right: 'Membership', params: null });
  });

  test('lands on the dashboard of the new catalog', { tag: ['@CAT-CCR-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    const res = await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { contactId: s.users.member.id });

    const [created] = await catalogsAfter(before);
    expect(res.status).toBe(302);
    expect(res.location).toContain(app.urls.catalogDashboard(created.id));
    expect(res.flash?.kind).toBe('ok');
  });

  test('only a coordinator of all catalogs can create one', { tag: ['@CAT-CCR-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const oneCatalogOnly = await actor(app, as, s, 'coordinator');
    const before = await lastCatalogId();

    const res = await app.actions.catalogs.create(oneCatalogOnly.request, s.vendor.id, 'variable', { contactId: s.users.member.id });

    expect(res.status).toBe(302);
    expect(res.location).not.toContain(app.urls.catalogDashboard(before + 1));
    expect(await catalogsAfter(before)).toEqual([]);
  });

  test('stores the start date at the beginning of its day and the end date at the end of its day', { tag: ['@CAT-CCR-012'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();
    const start = day(clock, 10);
    const end = day(clock, 100);

    const res = await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', {
      contactId: s.users.member.id,
      startDate: `${start} 14:30`,
      endDate: `${end} 08:15`,
    });

    expect(res.flash?.kind).toBe('ok');
    const [created] = await catalogsAfter(before);
    expect(created.startDate).toBe(`${start} 00:00:00`);
    expect(created.endDate).toBe(`${end} 23:59:59`);
  });

  test('accepts a catalog that starts and ends on the same day', { tag: ['@CAT-CCR-012'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', { contactId: s.users.member.id, startDate: day(clock, 10), endDate: day(clock, 10) });

    const [created] = await catalogsAfter(before);
    expect(created.startDate.slice(0, 10)).toBe(day(clock, 10));
    expect(created.endDate).toBe(`${day(clock, 10)} 23:59:59`);
  });

  test('refuses a start date after the end date', { tag: ['@CAT-CCR-012'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await lastCatalogId();

    const res = await app.actions.catalogs.create(a.request, s.vendor.id, 'variable', {
      contactId: s.users.member.id,
      startDate: day(clock, 100),
      endDate: day(clock, 10),
    });

    expect(res.flash?.kind).toBe('error');
    expect(await catalogsAfter(before)).toEqual([]);
  });
});

test.describe('the period of an existing catalog and its distributions', () => {
  // A new catalog has no distribution yet: the rule bites when the same form saves a catalog that has some.
  const lastDistribDay = (s: Scenario) => make.parisDate(s.multiDistribs[s.multiDistribs.length - 1].distribStartDate);

  test('refuses an end date before the last distribution', { tag: ['@CAT-CCR-013'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const last = lastDistribDay(s);
    const stored = await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE id = ?', [s.constCatalog.id]);

    const res = await app.actions.catalogs.edit(a.request, s.constCatalog.id, { endDate: day(clock, 7 * 3) });

    expect(last > day(clock, 7 * 3)).toBe(true);
    expect(res.flash?.kind).toBe('error');
    expect(await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE id = ?', [s.constCatalog.id])).toEqual(stored);
  });

  test('refuses a start date after the first distribution', { tag: ['@CAT-CCR-013'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const stored = await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE id = ?', [s.constCatalog.id]);

    const res = await app.actions.catalogs.edit(a.request, s.constCatalog.id, { startDate: day(clock, 10) });

    expect(res.flash?.kind).toBe('error');
    expect(await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE id = ?', [s.constCatalog.id])).toEqual(stored);
  });

  test('accepts an end date on the day of the last distribution', { tag: ['@CAT-CCR-013'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const last = lastDistribDay(s);

    const res = await app.actions.catalogs.edit(a.request, s.constCatalog.id, { endDate: last });

    // saved: back on the dashboard (a constant catalog with no order deadline also flashes a warning)
    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    const row = await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE id = ?', [s.constCatalog.id]);
    expect(row!.endDate).toBe(`${last} 23:59:59`);
  });
});
