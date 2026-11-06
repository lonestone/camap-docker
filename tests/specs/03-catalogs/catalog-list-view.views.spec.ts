/**
 * Catalog list, dashboard and visibility (specs/03-catalogs/catalog-list-view.md; camap-hx
 * controller/ContractAdmin.hx doDefault/doView, db/Catalog.hx isActive/isVisibleInShop/hasOpenOrders,
 * controller/api/Catalog.hx, camap-ts vendors/resolvers/catalogs.resolver.ts).
 *
 * Skipped as browser-only or not arrangeable:
 * - CAT-CLV-002 (second bullet): the dashboard warnings about invalid UTF-8 in the description or
 *   in product references/names/descriptions. The columns are utf8mb4 under strict mode, so the DB
 *   cannot hold an invalid sequence and the test cannot create one.
 * - CAT-CLV-008 documents: which documents each viewer sees is CAT-DOC-004.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute } from '../../src/db/client.js';
import { addDaysWall, toSqlDateTime } from '../../src/encodings/dates.js';
import { CatalogFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** A logged-in actor with the scenario group as current group. */
async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users']) {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

/** Set the order window of every distribution of `catalogId`, relative to now (days). */
async function setOrderWindow(catalogId: number, now: Date, startDays: number, endDays: number) {
  await execute('UPDATE Distribution SET orderStartDate = ?, orderEndDate = ? WHERE catalogId = ?', [
    toSqlDateTime(addDaysWall(now, startDays)),
    toSqlDateTime(addDaysWall(now, endDays)),
    catalogId,
  ]);
}

test.describe('the list of catalogs I manage', () => {
  test('a coordinator sees the catalogs they manage, not the others', { tag: ['@CAT-CLV-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat Fromages interdit', contact: s.users.groupAdmin });
    const a = await actor(app, as, s, 'coordinator');

    const list = await app.views.catalogs.list(a.request);

    expect(list.status).toBe(200);
    expect(list.text).toContain(s.constCatalog.name);
    expect(list.text).toContain(s.varCatalog.name);
    expect(list.text).not.toContain(other.name);
  });

  test('a group admin sees all the catalogs of the group', { tag: ['@CAT-CLV-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat Fromages visible', contact: s.users.groupAdmin });
    const a = await actor(app, as, s, 'groupAdmin');

    const list = await app.views.catalogs.list(a.request);

    expect(list.status).toBe(200);
    for (const c of [s.constCatalog, s.varCatalog, other]) expect(list.text).toContain(c.name);
  });

  test('a catalog from another group is not in the list', { tag: ['@CAT-CLV-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const g2 = await make.group({ name: 'Autre groupe' });
    const foreign = await make.catalog({ group: g2, vendor: s.vendor, name: 'Contrat Etranger' });
    const a = await actor(app, as, s, 'groupAdmin');

    expect((await app.views.catalogs.list(a.request)).text).not.toContain(foreign.name);
  });

  test('the list shows active catalogs and those ended less than a month ago, and the old list the ended ones', { tag: ['@CAT-CLV-001'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    const justEnded = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat fini recemment', startDate: addDaysWall(now, -200), endDate: addDaysWall(now, -10) });
    const longEnded = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat fini anciennement', startDate: addDaysWall(now, -400), endDate: addDaysWall(now, -45) });
    const a = await actor(app, as, s, 'groupAdmin');

    const current = await app.views.catalogs.list(a.request);
    const old = await app.views.catalogs.list(a.request, { old: true });

    expect(current.text).toContain(s.constCatalog.name);
    expect(current.text).toContain(justEnded.name);
    expect(current.text).not.toContain(longEnded.name);
    expect(old.status).toBe(200);
    expect(old.text).toContain(longEnded.name);
    expect(old.text).toContain(justEnded.name);
    expect(old.text).not.toContain(s.constCatalog.name);
    expect(old.text).not.toContain(s.varCatalog.name);
  });

  test('a catalog not started yet is in the list', { tag: ['@CAT-CLV-001'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    const future = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat futur', startDate: addDaysWall(now, 20), endDate: addDaysWall(now, 380) });
    const a = await actor(app, as, s, 'groupAdmin');

    expect((await app.views.catalogs.list(a.request)).text).toContain(future.name);
  });

  test('a plain member cannot open the list: they are sent back to the home page', { tag: ['@CAT-CLV-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'member');

    const list = await app.views.catalogs.list(a.request);

    expect(list.status).toBe(302);
    expect(list.location).toBe('/');
    expect(list.text).not.toContain(s.constCatalog.name);
  });
});

test.describe('the dashboard of a catalog', () => {
  test('the coordinator of a catalog opens its dashboard', { tag: ['@CAT-CLV-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'coordinator');

    const page = await app.views.catalogs.dashboard(a.request, s.constCatalog.id);

    expect(page.status).toBe(200);
    expect(page.text).toContain(s.constCatalog.name);
  });

  test('a group admin opens the dashboard of any catalog of the group', { tag: ['@CAT-CLV-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat Miel' });
    const a = await actor(app, as, s, 'groupAdmin');

    const page = await app.views.catalogs.dashboard(a.request, other.id);

    expect(page.status).toBe(200);
    expect(page.text).toContain(other.name);
  });

  test('a coordinator of other catalogs only is refused', { tag: ['@CAT-CLV-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat Miel' });
    const a = await actor(app, as, s, 'coordinator');

    const page = await app.views.catalogs.dashboard(a.request, other.id);

    expect(page.status).toBe(302);
    expect(page.location).toBe('/');
    expect(page.text).not.toContain(other.name);
  });

  test('a plain member is refused', { tag: ['@CAT-CLV-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'member');

    const page = await app.views.catalogs.dashboard(a.request, s.constCatalog.id);

    expect(page.status).toBe(302);
    expect(page.location).toBe('/');
  });
});

test.describe('active catalogs and the shop', () => {
  test('a catalog is active between its start and end dates: only active ones are in the shop', { tag: ['@CAT-CLV-003', '@CAT-CLV-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    const ended = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat termine', startDate: addDaysWall(now, -60), endDate: addDaysWall(now, -1) });
    const notStarted = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat pas commence', startDate: addDaysWall(now, 1), endDate: addDaysWall(now, 60) });
    const member = await actor(app, as, s, 'member');

    const shop = (await app.views.shop.home(member.request)).text;

    expect(shop).toContain(s.constCatalog.name);
    expect(shop).not.toContain(ended.name);
    expect(shop).not.toContain(notStarted.name);
  });

  test('an active catalog closed to user orders is not in the shop', { tag: ['@CAT-CLV-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const closed = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat ferme aux commandes', flags: 0 });
    const open = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat ouvert aux commandes', flags: flags(CatalogFlag, 'UsersCanOrder') });
    void clock;
    const member = await actor(app, as, s, 'member');

    const shop = (await app.views.shop.home(member.request)).text;

    expect(shop).toContain(open.name);
    expect(shop).not.toContain(closed.name);
  });
});

test.describe('variable-orders catalogs and their order windows', () => {
  test('a variable catalog is in the shop while one of its distributions has its order window open', { tag: ['@CAT-CLV-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await setOrderWindow(s.varCatalog.id, clock.now(), -2, 5);
    const member = await actor(app, as, s, 'member');

    expect((await app.views.shop.home(member.request)).text).toContain(s.varCatalog.name);
  });

  test('a variable catalog whose order windows are all closed is not in the shop', { tag: ['@CAT-CLV-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await setOrderWindow(s.varCatalog.id, clock.now(), -10, -1);
    const member = await actor(app, as, s, 'member');

    const shop = (await app.views.shop.home(member.request)).text;

    expect(shop).not.toContain(s.varCatalog.name);
    expect(shop).toContain(s.constCatalog.name);
  });

  test('a variable catalog whose order windows are not open yet is not in the shop', { tag: ['@CAT-CLV-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await setOrderWindow(s.varCatalog.id, clock.now(), 2, 5);
    const member = await actor(app, as, s, 'member');

    expect((await app.views.shop.home(member.request)).text).not.toContain(s.varCatalog.name);
  });

  test('a variable catalog with no distribution at all is not in the shop', { tag: ['@CAT-CLV-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await execute('DELETE FROM Distribution WHERE catalogId = ?', [s.varCatalog.id]);
    const member = await actor(app, as, s, 'member');

    expect((await app.views.shop.home(member.request)).text).not.toContain(s.varCatalog.name);
  });

  test('one open window among closed ones is enough', { tag: ['@CAT-CLV-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    await setOrderWindow(s.varCatalog.id, now, -10, -1);
    await execute('UPDATE Distribution SET orderStartDate = ?, orderEndDate = ? WHERE id = ?', [
      toSqlDateTime(addDaysWall(now, -1)),
      toSqlDateTime(addDaysWall(now, 3)),
      s.distributions[2].var.id,
    ]);
    const member = await actor(app, as, s, 'member');

    expect((await app.views.shop.home(member.request)).text).toContain(s.varCatalog.name);
  });

  test('a constant-orders catalog stays in the shop even when no order window is open', { tag: ['@CAT-CLV-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await setOrderWindow(s.constCatalog.id, clock.now(), -10, -1);
    const member = await actor(app, as, s, 'member');

    expect((await app.views.shop.home(member.request)).text).toContain(s.constCatalog.name);
  });
});

test.describe('active catalogs of a group (GraphQL)', () => {
  test('a member reads the active catalogs of their group', { tag: ['@CAT-CLV-006'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    const ended = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat termine', startDate: addDaysWall(now, -60), endDate: addDaysWall(now, -1) });
    const notStarted = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat pas commence', startDate: addDaysWall(now, 1), endDate: addDaysWall(now, 60) });
    const member = await as(s.users.member);

    const res = await app.api.catalog.activeInGroup(member.request, s.group.id);

    expect(res.errors).toBeNull();
    const ids = res.data!.getActiveCatalogs.map((c) => c.id);
    expect(ids.sort()).toEqual([s.constCatalog.id, s.varCatalog.id].sort());
    expect(ids).not.toContain(ended.id);
    expect(ids).not.toContain(notStarted.id);
  });

  test('the catalogs of another group are not returned', { tag: ['@CAT-CLV-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const g2 = await make.group({ name: 'Autre groupe' });
    const foreign = await make.catalog({ group: g2, vendor: s.vendor, name: 'Contrat Etranger' });
    const member = await as(s.users.member);

    const res = await app.api.catalog.activeInGroup(member.request, s.group.id);

    expect(res.data!.getActiveCatalogs.map((c) => c.id)).not.toContain(foreign.id);
  });

  test('the catalogs of a disabled vendor are left out', { tag: ['@CAT-CLV-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const disabled = await make.vendor({ name: 'Ferme fermee', disabled: 1 });
    const hidden = await make.catalog({ group: s.group, vendor: disabled, name: 'Contrat producteur desactive' });
    const member = await as(s.users.member);

    const res = await app.api.catalog.activeInGroup(member.request, s.group.id);

    const ids = res.data!.getActiveCatalogs.map((c) => c.id);
    expect(ids).toContain(s.constCatalog.id);
    expect(ids).not.toContain(hidden.id);
  });
});

test.describe('reading one catalog as its coordinator (GraphQL)', () => {
  test('the coordinator of a catalog reads it', { tag: ['@CAT-CLV-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.coordinator);

    const res = await app.api.catalog.managed(a.request, s.constCatalog.id);

    expect(res.errors).toBeNull();
    expect(res.data!.catalog).toEqual({ id: s.constCatalog.id, name: s.constCatalog.name, groupId: s.group.id });
  });

  test('a group admin reads any catalog of the group', { tag: ['@CAT-CLV-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat Miel' });
    const a = await as(s.users.groupAdmin);

    const res = await app.api.catalog.managed(a.request, other.id);

    expect(res.errors).toBeNull();
    expect(res.data!.catalog.id).toBe(other.id);
  });

  test('a plain member cannot read it', { tag: ['@CAT-CLV-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.member);

    const res = await app.api.catalog.managed(a.request, s.constCatalog.id);

    expect(res.data).toBeNull();
    expect(res.errors![0].message).toMatch(/authorization/i);
  });

  test('a coordinator of other catalogs cannot read it', { tag: ['@CAT-CLV-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Contrat Miel' });
    const a = await as(s.users.coordinator);

    const res = await app.api.catalog.managed(a.request, other.id);

    expect(res.data).toBeNull();
    expect(res.errors![0].message).toMatch(/authorization/i);
  });

  test('an unknown catalog is not found', { tag: ['@CAT-CLV-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.coordinator);

    const res = await app.api.catalog.managed(a.request, 999999);

    expect(res.data).toBeNull();
    expect(res.errors![0].message).toMatch(/not found/i);
  });
});

test.describe('the catalog page (JSON)', () => {
  test('a member reads the catalog with its active products, distributions and vendor', { tag: ['@CAT-CLV-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const hiddenProduct = await make.product({ catalog: s.varCatalog, name: 'Produit inactif', active: false });
    const member = await as(s.users.member);

    const res = await app.api.catalog.get(member.request, s.varCatalog.id);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(s.varCatalog.id);
    expect(res.body.name).toBe(s.varCatalog.name);
    expect(res.body.vendor.name).toBe(s.vendor.name);
    expect(res.body.products.map((p) => p.id).sort()).toEqual(s.products.var.map((p) => p.id).sort());
    expect(res.body.products.map((p) => p.id)).not.toContain(hiddenProduct.id);
    expect(res.body.distributions.map((d) => d.id).sort()).toEqual(s.distributions.map((d) => d.var.id).sort());
    expect(Array.isArray(res.body.documents)).toBe(true);
    expect(res.body).toHaveProperty('constraints');
    expect(res.body).toHaveProperty('absences');
  });

  test('a visitor reads the same page', { tag: ['@CAT-CLV-008'] }, async ({ app, anon, as }) => {
    const s = await make.amapScenario();
    const hiddenProduct = await make.product({ catalog: s.constCatalog, name: 'Produit inactif', active: false });
    const member = await as(s.users.member);

    const visitor = await app.api.catalog.get(anon.request, s.constCatalog.id);
    const asMember = await app.api.catalog.get(member.request, s.constCatalog.id);

    expect(visitor.status).toBe(200);
    expect(visitor.body.name).toBe(s.constCatalog.name);
    expect(visitor.body.products.map((p) => p.id)).not.toContain(hiddenProduct.id);
    expect(visitor.body.products.map((p) => p.id)).toEqual(asMember.body.products.map((p) => p.id));
  });

  test('the page of a constant catalog describes its absence rules', { tag: ['@CAT-CLV-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.api.catalog.get(member.request, s.constCatalog.id);

    expect(res.status).toBe(200);
    expect(res.body.absences).toEqual(expect.any(String));
    expect(res.body.absences).not.toBe('');
  });
});

test.describe('reading the catalog and product data of a group you do not belong to', () => {
  // UND-039 (undecided): hx lets anyone read these; the suggestion is to restrict them.
  test('a visitor reads the catalog page', { tag: ['@CAT-CLV-009'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.catalog.get(anon.request, s.constCatalog.id);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe(s.constCatalog.name);
  });

  test('a logged-in user of another group reads the catalog page too', { tag: ['@CAT-CLV-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const outsider = await as(s.users.nonMember);

    const res = await app.api.catalog.get(outsider.request, s.constCatalog.id);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(s.constCatalog.id);
  });

  test('a visitor lists the products of a catalog, inactive ones included', { tag: ['@CAT-CLV-009'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const hiddenProduct = await make.product({ catalog: s.constCatalog, name: 'Produit inactif', active: false });

    const res = await app.api.products.ofCatalog(anon.request, s.constCatalog.id);

    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.id).sort()).toEqual([...s.products.const.map((p) => p.id), hiddenProduct.id].sort());
  });

  test('a logged-in user of another group downloads the product export of a catalog, a visitor is sent to log in', { tag: ['@CAT-CLV-009'] }, async ({ app, anon, as }) => {
    const s = await make.amapScenario();
    const outsider = await as(s.users.nonMember);

    const res = await app.exports.catalogProducts(outsider.request, s.constCatalog.id);
    const visitor = await app.exports.catalogProducts(anon.request, s.constCatalog.id);

    expect(res.status).toBe(200);
    expect(res.raw).toContain(s.products.const[0].name);
    expect(visitor.status).toBe(302);
  });
});

test.describe('what a member who is not a coordinator reads through the catalog fields', () => {
  // UND-043 (undecided): the catalog fields have no check beyond being logged in.
  test('a visitor cannot call the GraphQL catalog queries', { tag: ['@CAT-CLV-010'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.catalog.fieldsOfActive(anon.request, s.group.id);

    expect(res.errors).not.toBeNull();
    expect(res.data?.getActiveCatalogs ?? null).toBeNull();
  });

  test('a plain member reads the subscriptions and products of an active catalog', { tag: ['@CAT-CLV-010'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    const sub = await make.subscription({ user: s.users.member2, catalog: s.constCatalog, startDate: addDaysWall(now, -30), endDate: addDaysWall(now, 335) });
    const member = await as(s.users.member);

    const res = await app.api.catalog.fieldsOfActive(member.request, s.group.id);

    expect(res.errors).toBeNull();
    const cat = res.data!.getActiveCatalogs.find((c) => c.id === s.constCatalog.id)!;
    expect(cat.subscriptions.map((x) => x.id)).toEqual([sub.id]);
    expect(cat.subscriptionsCount).toBe(1);
    expect(cat.products.map((p) => p.id)).toEqual(s.products.const.map((p) => p.id));
  });

  test('a logged-in user of another group reads them too', { tag: ['@CAT-CLV-010'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    const sub = await make.subscription({ user: s.users.member2, catalog: s.constCatalog, startDate: addDaysWall(now, -30), endDate: addDaysWall(now, 335) });
    const outsider = await as(s.users.nonMember);

    const res = await app.api.catalog.fieldsOfActive(outsider.request, s.group.id);

    expect(res.errors).toBeNull();
    const cat = res.data!.getActiveCatalogs.find((c) => c.id === s.constCatalog.id)!;
    expect(cat.subscriptions.map((x) => x.id)).toEqual([sub.id]);
  });
});
