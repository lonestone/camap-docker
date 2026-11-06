/**
 * Duplicate and delete a catalog (specs/03-catalogs/catalog-duplicate-delete.md;
 * controller/ContractAdmin.hx doDuplicate, doDelete, doCopyProducts).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { CatalogFlag, flags } from '../../src/encodings/flags.js';
import { decodeRights, Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** A logged-in actor with the scenario group as current group. */
async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'coordinator') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

type CatalogRow = Record<string, any> & { id: number; name: string; type: number; userId: number | null };
const catalogRow = async (id: number) => (await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE id = ?', [id]))!;
const catalogByName = async (name: string) => (await queryOne<CatalogRow>('SELECT * FROM Catalog WHERE name = ?', [name]))!;
const exists = async (sql: string, params: unknown[]) => (await queryOne(sql, params)) !== undefined;
const catalogCount = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Catalog'))!.n;

type ProductRow = { id: number; name: string; price: number; active: number; stockTracking: number; stock: number | null; vat: number; qt: number; desc: string | null };
const productsOf = (catalogId: number) =>
  query<ProductRow>('SELECT id, name, price, active, stockTracking, stock, vat, qt, `desc` FROM Product WHERE catalogId = ? ORDER BY name', [catalogId]);
const rolesOf = (catalogId: number) =>
  query<{ id: number; name: string; groupId: number; enabledByDefault: number }>('SELECT id, name, groupId, enabledByDefault FROM VolunteerRole WHERE catalogId = ? ORDER BY name', [catalogId]);
const rightsOf = async (userId: number, groupId: number) =>
  decodeRights((await queryOne<{ rights: string | null }>('SELECT rights FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId]))!.rights);
const hasContractAdmin = async (userId: number, groupId: number, catalogId: number) =>
  (await rightsOf(userId, groupId)).some((r) => r.right === 'ContractAdmin' && r.params?.[0] === String(catalogId));

test.describe('duplicating a catalog', () => {
  test('the copy keeps the dates, contact, description, options, vendor, closing delay and maximum absences, but not the absence dates', { tag: ['@CAT-CDD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.constCatalog.id, {
      description: 'Légumes de saison',
      orderEndHoursBeforeDistrib: 48,
      distributorNum: 3,
      flags: flags(CatalogFlag, 'UsersCanOrder', 'DisplayPricesOnGroupPage', 'NotifyContactOnOrderEnd'),
    });
    const source = await catalogRow(s.constCatalog.id);
    expect(source.absencesStartDate).not.toBeNull();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.duplicate(a.request, s.constCatalog.id, { name: 'Légumes 2' });

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'ok' });
    const copy = await catalogByName('Légumes 2');
    expect(res.location).toContain(app.urls.catalogDashboard(copy.id));
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({
      type: source.type,
      groupId: source.groupId,
      vendorId: source.vendorId,
      userId: source.userId,
      description: 'Légumes de saison',
      orderEndHoursBeforeDistrib: 48,
      absentDistribsMaxNb: 2,
      distributorNum: 3,
      flags: source.flags,
    });
    // the dates are the source's, to the day (hx normalises them to 00:00:00 and 23:59:59 on insert)
    expect(copy.startDate.slice(0, 10)).toBe(source.startDate.slice(0, 10));
    expect(copy.endDate.slice(0, 10)).toBe(source.endDate.slice(0, 10));
    expect(copy.absencesStartDate).toBeNull();
    expect(copy.absencesEndDate).toBeNull();
    // the source is untouched
    expect(await catalogRow(s.constCatalog.id)).toEqual(source);
  });

  test('the form pre-fills the name of the copy ("<name> - copie") and the type of the source', { tag: ['@CAT-CDD-001'] }, async ({ app, as }) => {
    // The statement says "the copy keeps the name": hx offers the source name plus " - copie", cut at 50 characters.
    const s = await make.amapScenario();
    const long = await make.catalog({ group: s.group, vendor: s.vendor, name: 'A'.repeat(60), contact: s.users.coordinator });
    const a = await actor(app, as, s, 'groupAdmin');

    const constant = await app.actions.catalogs.duplicateForm(a.request, s.constCatalog.id);
    const variable = await app.actions.catalogs.duplicateForm(a.request, s.varCatalog.id);
    const cut = await app.actions.catalogs.duplicateForm(a.request, long.id);

    expect(constant).toMatchObject({ status: 200, name: 'Légumes (contrat AMAP) - copie', type: 'constant' });
    expect(variable).toMatchObject({ status: 200, name: 'Œufs (contrat variable) - copie', type: 'variable' });
    expect(cut.name).toBe(`${'A'.repeat(50)} - copie`);
  });

  test('I can choose the type of the copy; a variable copy of a constant catalog opens ordering 365 days before', { tag: ['@CAT-CDD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.catalogs.duplicate(a.request, s.constCatalog.id, { name: 'Variable depuis constant', type: 'variable' });

    const copy = await catalogByName('Variable depuis constant');
    expect(copy.type).toBe(1);
    expect(copy.orderStartDaysBeforeDistrib).toBe(365);
  });

  test('a variable copy of a variable catalog keeps its opening delay and its minimums', { tag: ['@CAT-CDD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { orderStartDaysBeforeDistrib: 10, orderEndHoursBeforeDistrib: 24, distribMinOrdersTotal: 15, catalogMinOrdersTotal: 80 });
    const a = await actor(app, as, s);

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Œufs 2' });

    expect(await catalogByName('Œufs 2')).toMatchObject({
      type: 1,
      orderStartDaysBeforeDistrib: 10,
      orderEndHoursBeforeDistrib: 24,
      distribMinOrdersTotal: 15,
      catalogMinOrdersTotal: 80,
    });
  });

  test('a constant copy of a variable catalog is a constant catalog', { tag: ['@CAT-CDD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Constant depuis variable', type: 'constant' });

    expect((await catalogByName('Constant depuis variable')).type).toBe(0);
  });

  test('a member and the coordinator of another catalog cannot duplicate it', { tag: ['@CAT-CDD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ firstName: 'Boris', lastName: 'Boulanger', email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });
    const before = await catalogCount();

    for (const who of [await actor(app, as, s, 'member'), await as(baker)]) {
      await app.actions.group.select(who.request, s.group.id);
      const form = await app.actions.catalogs.duplicateForm(who.request, s.constCatalog.id);
      const res = await app.actions.catalogs.duplicate(who.request, s.constCatalog.id, { name: 'Piraté' });

      expect(form.status).toBe(302);
      expect(form.location).not.toContain('/contractAdmin/duplicate');
      expect(res.location ?? '').not.toContain(app.urls.catalogDashboard(s.constCatalog.id));
    }
    expect(await catalogCount()).toBe(before);
  });
});

test.describe('products of a duplicated catalog', () => {
  async function withProducts() {
    const s = await make.amapScenario();
    const [tracked, plain] = s.products.var;
    await make.setProduct(tracked.id, { stockTracking: 1, stock: 12, vat: 20, qt: 500, desc: 'Gros calibre' });
    const retired = await make.product({ catalog: s.varCatalog, name: 'Boîte de 30 œufs', price: 9, active: false });
    return { s, tracked, plain, retired };
  }

  test('all products can be copied, with stock tracking disabled', { tag: ['@CAT-CDD-002'] }, async ({ app, as }) => {
    const { s, tracked, plain, retired } = await withProducts();
    const a = await actor(app, as, s);

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie tout', copyProducts: 'all' });

    const copy = await catalogByName('Copie tout');
    const copies = await productsOf(copy.id);
    // hx today: the product defaults apply to the copy, so an inactive product comes back active
    expect(copies.map((p) => [p.name, p.price, p.active])).toEqual(
      [retired, plain, tracked].map((p) => [p.name, p.price, 1]).sort((x, y) => String(x[0]).localeCompare(String(y[0]))),
    );
    expect(copies.every((p) => p.stockTracking === 0)).toBe(true);
    // the other settings of the product come along
    const t = copies.find((p) => p.name === tracked.name)!;
    expect(t).toMatchObject({ vat: 20, qt: 500, desc: 'Gros calibre' });
    // the source keeps its stock tracking
    expect((await productsOf(s.varCatalog.id)).find((p) => p.id === tracked.id)).toMatchObject({ stockTracking: 1, stock: 12 });
  });

  test('only the active products can be copied', { tag: ['@CAT-CDD-002'] }, async ({ app, as }) => {
    const { s, tracked, plain } = await withProducts();
    const a = await actor(app, as, s);

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie actifs', copyProducts: 'active' });

    const copies = await productsOf((await catalogByName('Copie actifs')).id);
    expect(copies.map((p) => p.name)).toEqual([plain.name, tracked.name].sort((x, y) => x.localeCompare(y)));
    expect(copies.every((p) => p.active === 1 && p.stockTracking === 0)).toBe(true);
  });

  test('no product can be copied', { tag: ['@CAT-CDD-002'] }, async ({ app, as }) => {
    const { s } = await withProducts();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie vide', copyProducts: 'none' });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await productsOf((await catalogByName('Copie vide')).id)).toEqual([]);
    expect(await productsOf(s.varCatalog.id)).toHaveLength(3);
  });
});

test.describe('distributions of a duplicated catalog', () => {
  test('a group admin can copy the distributions of the catalog', { tag: ['@CAT-CDD-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const form = await app.actions.catalogs.duplicateForm(a.request, s.varCatalog.id);
    const res = await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie avec distributions', copyDistributions: true });

    expect(form.offersCopyDistributions).toBe(true);
    expect(res.flash).toMatchObject({ kind: 'ok' });
    const copy = await catalogByName('Copie avec distributions');
    type D = { multiDistribId: number; date: string; orderStartDate: string; orderEndDate: string; placeId: number };
    const cols = 'multiDistribId, date, orderStartDate, orderEndDate, placeId';
    const original = await query<D>(`SELECT ${cols} FROM Distribution WHERE catalogId = ? ORDER BY date`, [s.varCatalog.id]);
    const copied = await query<D>(`SELECT ${cols} FROM Distribution WHERE catalogId = ? ORDER BY date`, [copy.id]);
    expect(original).toHaveLength(4);
    expect(copied).toEqual(original);
    // the other catalog's distributions are untouched
    expect(await query('SELECT id FROM Distribution WHERE catalogId = ?', [s.constCatalog.id])).toHaveLength(4);
  });

  test('without the option, the distributions are not copied', { tag: ['@CAT-CDD-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie sans distributions' });

    const copy = await catalogByName('Copie sans distributions');
    expect(await query('SELECT id FROM Distribution WHERE catalogId = ?', [copy.id])).toEqual([]);
  });

  test('a coordinator of the catalog is not offered the option, and posting it does nothing', { tag: ['@CAT-CDD-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.catalogs.duplicateForm(a.request, s.varCatalog.id);
    const res = await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie forcée', copyDistributions: true });

    expect(form.offersCopyDistributions).toBe(false);
    expect(res.flash).toMatchObject({ kind: 'ok' });
    const copy = await catalogByName('Copie forcée');
    expect(await query('SELECT id FROM Distribution WHERE catalogId = ?', [copy.id])).toEqual([]);
  });
});

test.describe('roles and coordinator of a duplicated catalog', () => {
  test('the roles of the catalog are copied, the generic ones and those of other catalogs are not', { tag: ['@CAT-CDD-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.volunteerRole({ group: s.group, name: 'Caisse', catalog: s.varCatalog, enabledByDefault: true });
    await make.volunteerRole({ group: s.group, name: 'Pesée', catalog: s.varCatalog, enabledByDefault: false });
    await make.volunteerRole({ group: s.group, name: 'Rôle du contrat AMAP', catalog: s.constCatalog });
    await make.volunteerRole({ group: s.group, name: 'Rôle général', catalog: null });
    const a = await actor(app, as, s);

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie rôles' });

    const copy = await catalogByName('Copie rôles');
    const roles = await rolesOf(copy.id);
    expect(roles.map((r) => [r.name, r.groupId, r.enabledByDefault])).toEqual([
      ['Caisse', s.group.id, 1],
      ['Pesée', s.group.id, 0],
    ]);
    // the originals stay where they were
    expect((await rolesOf(s.varCatalog.id)).map((r) => r.name)).toEqual(['Caisse', 'Pesée']);
    expect(await rolesOf(s.constCatalog.id)).toHaveLength(1);
    expect(await query('SELECT id FROM VolunteerRole WHERE catalogId IS NULL')).toHaveLength(1);
  });

  test('the contact of the source, a member of the group, coordinates the copy', { tag: ['@CAT-CDD-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie contact' });

    const copy = await catalogByName('Copie contact');
    expect(copy.userId).toBe(s.users.coordinator.id);
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, copy.id)).toBe(true);
    // and still the original
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, s.varCatalog.id)).toBe(true);
  });

  test('when the contact is not a member of the group, I become the contact and coordinator of the copy', { tag: ['@CAT-CDD-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { userId: s.users.nonMember.id });
    const a = await actor(app, as, s, 'coordinator');

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie contact externe' });

    const copy = await catalogByName('Copie contact externe');
    expect(copy.userId).toBe(s.users.coordinator.id);
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, copy.id)).toBe(true);
  });

  test('when someone else than the contact duplicates, they get the right on the copy too', { tag: ['@CAT-CDD-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const helper = await make.user({ firstName: 'Hélène', lastName: 'Aide', email: 'helper@camap.test' });
    await make.userGroup({ user: helper, group: s.group, rights: [Right.ContractAdmin(s.varCatalog.id)] });
    const a = await as(helper);
    await app.actions.group.select(a.request, s.group.id);

    await app.actions.catalogs.duplicate(a.request, s.varCatalog.id, { name: 'Copie aide' });

    const copy = await catalogByName('Copie aide');
    expect(copy.userId).toBe(s.users.coordinator.id);
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, copy.id)).toBe(true);
    expect(await hasContractAdmin(helper.id, s.group.id, copy.id)).toBe(true);
  });
});

test.describe('deleting a catalog', () => {
  test('a coordinator of all catalogs deletes it; the contact loses the right on it, the roles are removed', { tag: ['@CAT-CDD-005', '@DIS-ROL-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.volunteerRole({ group: s.group, name: 'Caisse', catalog: s.varCatalog });
    const keptRole = await make.volunteerRole({ group: s.group, name: 'Rôle du contrat AMAP', catalog: s.constCatalog });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.delete(a.request, s.varCatalog.id);

    expect(res.status).toBe(302);
    expect(res.location).toContain('/contractAdmin');
    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await exists('SELECT id FROM Catalog WHERE id = ?', [s.varCatalog.id])).toBe(false);
    expect(await rolesOf(s.varCatalog.id)).toEqual([]);
    expect(await exists('SELECT id FROM VolunteerRole WHERE name = ?', ['Caisse'])).toBe(false);
    expect(await exists('SELECT id FROM VolunteerRole WHERE id = ?', [keptRole.id])).toBe(true);
    // the contact keeps the right on the other catalog only
    // (hx today: removing a right leaves `{ right: 'ContractAdmin', params: [] }` entries in the rights JSON; they grant nothing)
    const rights = (await rightsOf(s.users.coordinator.id, s.group.id)).filter((r) => r.params?.length !== 0);
    expect(rights).toEqual([Right.ContractAdmin(s.constCatalog.id)]);
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, s.varCatalog.id)).toBe(false);
    expect(await exists('SELECT id FROM Catalog WHERE id = ?', [s.constCatalog.id])).toBe(true);
  });

  test('the coordinator of that catalog alone cannot delete it', { tag: ['@CAT-CDD-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'coordinator');

    const res = await app.actions.catalogs.delete(a.request, s.varCatalog.id);

    expect(res.location).toContain('/contractAdmin');
    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await exists('SELECT id FROM Catalog WHERE id = ?', [s.varCatalog.id])).toBe(true);
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, s.varCatalog.id)).toBe(true);
  });

  test('a member cannot delete a catalog', { tag: ['@CAT-CDD-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'member');

    const res = await app.actions.catalogs.delete(a.request, s.varCatalog.id);

    expect(res.status).toBe(302);
    expect(res.flash?.kind).not.toBe('ok');
    expect(await catalogCount()).toBe(2);
  });

  test('without the security token, nothing is deleted', { tag: ['@CAT-CDD-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.delete(a.request, s.varCatalog.id, { token: false });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await catalogCount()).toBe(2);
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, s.varCatalog.id)).toBe(true);
  });

  async function ordered(s: Scenario, quantity: number, product = s.products.var[0]) {
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member, product, distribution: s.distributions[0].var, basket, quantity });
  }

  test('a catalog with a total ordered quantity above 0 cannot be deleted', { tag: ['@CAT-CDD-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.volunteerRole({ group: s.group, name: 'Caisse', catalog: s.varCatalog });
    await ordered(s, 2);
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.delete(a.request, s.varCatalog.id);

    expect(res.location).toContain('/contractAdmin');
    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await exists('SELECT id FROM Catalog WHERE id = ?', [s.varCatalog.id])).toBe(true);
    expect(await productsOf(s.varCatalog.id)).toHaveLength(2);
    expect(await rolesOf(s.varCatalog.id)).toHaveLength(1);
    expect(await hasContractAdmin(s.users.coordinator.id, s.group.id, s.varCatalog.id)).toBe(true);
    expect(await query('SELECT id FROM UserOrder')).toHaveLength(1);
  });

  test('orders of quantity 0 do not prevent the deletion', { tag: ['@CAT-CDD-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await ordered(s, 0);
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.delete(a.request, s.varCatalog.id);

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await exists('SELECT id FROM Catalog WHERE id = ?', [s.varCatalog.id])).toBe(false);
  });

  // UND-047 (Undecided): the suggestion asks for explicit deletion of products, distributions and roles.
  test('hx today: deleting the catalog also removes its products, distributions, subscriptions and zero-quantity orders, through database cascades (UND-047)', { tag: ['@CAT-CDD-006'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await ordered(s, 0);
    const now = clock.now();
    const sub = await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: now, endDate: addDaysWall(now, 60) });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.delete(a.request, s.constCatalog.id);

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await productsOf(s.constCatalog.id)).toEqual([]);
    expect(await query('SELECT id FROM Distribution WHERE catalogId = ?', [s.constCatalog.id])).toEqual([]);
    expect(await exists('SELECT id FROM Subscription WHERE id = ?', [sub.id])).toBe(false);
    // the other catalog keeps everything, including the zero-quantity order and its distributions
    expect(await productsOf(s.varCatalog.id)).toHaveLength(2);
    expect(await query('SELECT id FROM Distribution WHERE catalogId = ?', [s.varCatalog.id])).toHaveLength(4);
    expect(await query('SELECT id FROM UserOrder')).toHaveLength(1);
  });

  test('hx today: only active products are checked for orders, so a catalog whose ordered products were deactivated can be deleted (UND-047)', { tag: ['@CAT-CDD-005', '@CAT-CDD-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await ordered(s, 3);
    await make.setProduct(s.products.var[0].id, { active: 0 });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.delete(a.request, s.varCatalog.id);

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await exists('SELECT id FROM Catalog WHERE id = ?', [s.varCatalog.id])).toBe(false);
    expect(await query('SELECT id FROM UserOrder')).toEqual([]);
  });
});

// hx today (CAT-CDD-007): the hidden page exists for a superadmin who is a member of the group, but its form
// cannot be submitted: the "copy from" list is rendered without any option and posting it raises
// "getTypedValue() function not implemented in source" (sugoi Selectbox). Nothing is ever copied.
test.describe('copying the products of another catalog (superadmin)', () => {
  async function copyScenario() {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.superadmin, group: s.group, rights: [] });
    return s;
  }

  test('hx today: posting the form fails and no product is copied or deleted', { tag: ['@CAT-CDD-007', '@ADM-TLS-004'] }, async ({ app, as, errors }) => {
    errors.expect(/getTypedValue\(\) function not implemented/);
    const s = await copyScenario();
    const a = await actor(app, as, s, 'superadmin');
    const before = await productsOf(s.constCatalog.id);

    const res = await app.actions.catalogs.copyProducts(a.request, s.constCatalog.id, s.varCatalog.id, { deleteExisting: true });

    expect(res.flash?.kind).not.toBe('ok');
    expect(res.location ?? '').not.toContain('/contractAdmin/products');
    expect(await productsOf(s.constCatalog.id)).toEqual(before);
    expect(await productsOf(s.varCatalog.id)).toHaveLength(2);
  });

  test('a group admin and a coordinator cannot use it', { tag: ['@CAT-CDD-007', '@ADM-TLS-004'] }, async ({ app, as }) => {
    const s = await copyScenario();

    for (const who of ['groupAdmin', 'coordinator'] as const) {
      const a = await actor(app, as, s, who);
      const res = await app.actions.catalogs.copyProducts(a.request, s.constCatalog.id, s.varCatalog.id, { deleteExisting: true });
      expect(res.status).toBe(302);
      expect(res.location).not.toContain('/contractAdmin/products');
    }
    expect((await productsOf(s.constCatalog.id)).map((p) => p.name)).toEqual(['Panier de légumes']);
  });
});
