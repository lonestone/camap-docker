/**
 * Products (specs/03-catalogs/products.md; controller/Product.hx, controller/ContractAdmin.hx doProducts,
 * service/ProductService.hx, db/Product.hx). The coordinator's product form, the lock on ordered products,
 * copy, delete and batch enable/disable. hx form posts; the target driver owns the field names.
 * Image, public product JSON and GraphQL are in products.api.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { insert, query, queryOne } from '../../src/db/client.js';
import { CatalogFlag, flags } from '../../src/encodings/flags.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp, ProductUnit } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** A logged-in actor with the scenario group as current group. */
async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'coordinator') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

type ProductRow = {
  id: number;
  name: string;
  ref: string | null;
  price: number;
  vat: number;
  desc: string | null;
  qt: number | null;
  unitType: number | null;
  stockTracking: number | null;
  stockTrackingPerDistrib: number | null;
  stock: number | null;
  organic: number;
  variablePrice: number;
  multiWeight: number;
  bulk: number;
  active: number;
  imageId: number | null;
  catalogId: number;
};
const products = (catalogId: number) => query<ProductRow>('SELECT * FROM Product WHERE catalogId = ? ORDER BY id', [catalogId]);
const productRow = async (id: number) => (await queryOne<ProductRow>('SELECT * FROM Product WHERE id = ?', [id]))!;
const newestProduct = async () => (await queryOne<ProductRow>('SELECT * FROM Product ORDER BY id DESC LIMIT 1'))!;
const productCount = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Product'))!.n;

/** Unit ordinals of camap-hx/common/Common.hx Unit. */
const UNIT_ORDINAL: Record<ProductUnit, number> = { piece: 0, kilogram: 1, gram: 2, litre: 3, centilitre: 4, millilitre: 5 };

/** A member has ordered `product`: the product is then referenced by a UserOrder. */
async function order(s: Scenario, product: { id: number; price: number }, status: 'OPEN' | 'CONFIRMED' | 'VALIDATED' = 'CONFIRMED', catalog: 'const' | 'var' = 'var') {
  const b = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0], status });
  await make.userOrder({ user: s.users.member, product, distribution: s.distributions[0][catalog], basket: b });
}

/** A user who coordinates one extra catalog of the group only. */
async function otherCoordinator(s: Scenario) {
  const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
  const baker = await make.user({ firstName: 'Boris', lastName: 'Boulanger', email: 'baker@camap.test' });
  await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });
  const pain = await make.product({ catalog: other, name: 'Pain complet', price: 4 });
  return { other, baker, pain };
}

test.describe('creating a product', () => {
  test('the coordinator of a catalog creates a product with all its fields', { tag: ['@CAT-PRD-001', '@CAT-PRD-014'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.products.create(a.request, s.varCatalog.id, {
      name: 'Tomates anciennes',
      reference: 'TOM-01',
      price: 4.2,
      description: 'Variétés <b>anciennes</b>',
      quantity: 500,
      unit: 'gram',
      vat: 20,
      organic: true,
      variablePrice: true,
      bulk: true,
    });

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'ok' });
    const p = await newestProduct();
    expect(p).toMatchObject({
      catalogId: s.varCatalog.id,
      name: 'Tomates anciennes',
      ref: 'TOM-01',
      price: 4.2,
      vat: 20,
      qt: 500,
      unitType: UNIT_ORDINAL.gram,
      organic: 1,
      variablePrice: 1,
      multiWeight: 0,
      bulk: 1,
      active: 1,
    });
    expect(p.desc).toContain('anciennes');
  });

  test('the group admin, who coordinates every catalog, creates one too', { tag: ['@CAT-PRD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.products.create(a.request, s.constCatalog.id, { name: 'Panier', price: 15 });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect((await newestProduct()).catalogId).toBe(s.constCatalog.id);
  });

  test('a member and a coordinator of another catalog cannot create a product', { tag: ['@CAT-PRD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { baker } = await otherCoordinator(s);
    const before = await productCount();
    const member = await actor(app, as, s, 'member');
    const bakerSession = await as(baker);
    await app.actions.group.select(bakerSession.request, s.group.id);

    const byMember = await app.actions.products.create(member.request, s.varCatalog.id, { name: 'Piraté', price: 1 });
    const byBaker = await app.actions.products.create(bakerSession.request, s.varCatalog.id, { name: 'Piraté', price: 1 });

    expect(byMember.status).toBe(302);
    expect(byBaker.status).toBe(302);
    expect(await productCount()).toBe(before);
  });

  test('a name is required; a form without one creates nothing', { tag: ['@CAT-PRD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: '', price: 3 });

    // the form is shown again (no redirect to the products list)
    expect(res.status).toBe(200);
    expect(await productCount()).toBe(before);
  });

  // Finding: the price field is marked required, but an empty or non-numeric price is accepted and stored as 0.
  test('hx today: an empty or non-numeric price is accepted and stored as 0', { tag: ['@CAT-PRD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const noPrice = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Sans prix', price: '' });
    const textPrice = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Prix texte', price: 'abc' });

    expect([noPrice.status, textPrice.status]).toEqual([302, 302]);
    const created = (await products(s.varCatalog.id)).filter((p) => ['Sans prix', 'Prix texte'].includes(p.name));
    expect(created.map((p) => p.price)).toEqual([0, 0]);
  });

  test('a name is cut to 128 characters and a reference to 32', { tag: ['@CAT-PRD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'N'.repeat(140), reference: 'R'.repeat(40), price: 2 });

    const p = await newestProduct();
    expect(p.name).toBe('N'.repeat(128));
    expect(p.ref).toBe('R'.repeat(32));
  });

  test('a price is rounded to two decimals', { tag: ['@CAT-PRD-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Arrondi', price: 3.456 });

    expect((await newestProduct()).price).toBe(3.46);
  });
});

test.describe('product defaults', () => {
  test('the new-product form starts with VAT 5.5%, quantity 1 and active', { tag: ['@CAT-PRD-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });

    expect(form.status).toBe(200);
    expect(form.values).toMatchObject({ vat: 5.5, quantity: '1', active: true, organic: false });
    expect(form.vatChoices).toEqual([5.5, 20]);
  });

  test('a product created with the defaults is stored with VAT 5.5, quantity 1 and active', { tag: ['@CAT-PRD-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Par défaut', price: 3 });

    const p = await newestProduct();
    expect(p).toMatchObject({ vat: 5.5, qt: 1, active: 1, organic: 0, variablePrice: 0, multiWeight: 0, bulk: 0 });
  });

  // Finding: Product.new() sets unitType = Piece, but the creation form does not pre-select it, so a
  // product created without choosing a unit has no unit (NULL) instead of "piece".
  test('hx today: the creation form pre-selects no unit, so a product created without one has none', { tag: ['@CAT-PRD-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });
    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Sans unité', price: 3 });

    expect(form.values.unit).toBeNull();
    expect((await newestProduct()).unitType).toBeNull();
  });

  test('a quantity of 0 is stored as empty', { tag: ['@CAT-PRD-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Quantité nulle', price: 3, quantity: 0 });

    expect((await newestProduct()).qt).toBeNull();
  });

  test('an empty VAT is read as 0', { tag: ['@CAT-PRD-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Sans TVA', price: 3, vat: null });

    expect((await newestProduct()).vat).toBe(0);
  });
});

test.describe('units', () => {
  test('the form offers piece, kilogram, gram, litre, centilitre and millilitre', { tag: ['@CAT-PRD-014'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });

    expect(form.unitChoices).toEqual(['piece', 'kilogram', 'gram', 'litre', 'centilitre', 'millilitre']);
  });

  for (const unit of ['piece', 'kilogram', 'gram', 'litre', 'centilitre', 'millilitre'] as const) {
    test(`a product can be sold by the ${unit}`, { tag: ['@CAT-PRD-014'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await actor(app, as, s);

      await app.actions.products.create(a.request, s.varCatalog.id, { name: `Produit ${unit}`, price: 2, quantity: 2, unit });

      const p = await newestProduct();
      expect(p).toMatchObject({ unitType: UNIT_ORDINAL[unit], qt: 2 });
      const edited = await app.actions.products.form(a.request, { productId: p.id });
      expect(edited.values.unit).toBe(unit);
    });
  }
});

test.describe('editing a product', () => {
  test('the coordinator edits the fields of a product that was never ordered', { tag: ['@CAT-PRD-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[0];

    const res = await app.actions.products.edit(a.request, p.id, {
      name: 'Œufs plein air',
      price: 3.1,
      quantity: 12,
      unit: 'piece',
      vat: 20,
      organic: true,
      reference: 'OEUF',
      active: false,
    });

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await productRow(p.id)).toMatchObject({ name: 'Œufs plein air', price: 3.1, qt: 12, vat: 20, organic: 1, ref: 'OEUF', active: 0 });
  });

  test('the edit form is pre-filled with the stored values', { tag: ['@CAT-PRD-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[0];

    const form = await app.actions.products.form(a.request, { productId: p.id });

    expect(form.status).toBe(200);
    expect(form.values).toMatchObject({ name: p.name, price: String(p.price), quantity: '1', unit: 'piece', vat: 5.5, active: true });
  });

  test('a member and a coordinator of another catalog cannot edit it', { tag: ['@CAT-PRD-003'] }, async ({ app, as, errors }) => {
    errors.expect(/./); // hx raises "Forbidden access" as an error page
    const s = await make.amapScenario();
    const { baker } = await otherCoordinator(s);
    const p = s.products.var[0];
    const before = await productRow(p.id);
    const member = await actor(app, as, s, 'member');
    const bakerSession = await as(baker);

    await app.actions.products.edit(member.request, p.id, { name: 'Piraté', price: 0.01 });
    await app.actions.products.edit(bakerSession.request, p.id, { name: 'Piraté', price: 0.01 });

    expect(await productRow(p.id)).toEqual(before);
  });

  test('the group admin edits a product of any catalog', { tag: ['@CAT-PRD-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const p = s.products.const[0];

    const res = await app.actions.products.edit(a.request, p.id, { name: 'Panier moyen' });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect((await productRow(p.id)).name).toBe('Panier moyen');
  });
});

test.describe('an ordered product', () => {
  for (const status of ['OPEN', 'CONFIRMED', 'VALIDATED'] as const) {
    test(`its price, quantity and unit are locked, whatever the status of the order (${status})`, { tag: ['@CAT-PRD-004'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await actor(app, as, s);
      const p = s.products.var[0];
      await order(s, p, status);

      const form = await app.actions.products.form(a.request, { productId: p.id });

      expect(form.offers).toMatchObject({ price: false, quantity: false, unit: false });
      expect(form.offers.organic).toBe(true); // the other fields stay editable
      expect(form.offersCopy).toBe(true);
    });
  }

  test('the server ignores a posted price, quantity or unit but still saves the other fields', { tag: ['@CAT-PRD-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[0];
    await order(s, p);
    const before = await productRow(p.id);

    const res = await app.actions.products.edit(a.request, p.id, { name: 'Renommé', price: 99, quantity: 5, unit: 'gram', organic: true });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await productRow(p.id)).toEqual({ ...before, name: 'Renommé', organic: 1 });
  });

  test('a product nobody ordered keeps price, quantity and unit editable', { tag: ['@CAT-PRD-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    await order(s, s.products.var[0]);

    const form = await app.actions.products.form(a.request, { productId: s.products.var[1].id });

    expect(form.offers).toMatchObject({ price: true, quantity: true, unit: true });
    expect(form.offersCopy).toBe(false);
  });

  test('copying it deactivates the original and creates an active copy, stock settings included', { tag: ['@CAT-PRD-004', '@CAT-PRD-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[0];
    await make.setProduct(p.id, { ref: 'OEUF', desc: 'Plein air', qt: 6, unitType: UNIT_ORDINAL.piece, organic: 1, multiWeight: 1, stockTracking: 1, stockTrackingPerDistrib: 0, stock: 24 });
    await order(s, p);
    const before = await productRow(p.id);

    const res = await app.actions.products.copyAndDeactivate(a.request, p.id);

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const original = await productRow(p.id);
    const copy = await newestProduct();
    expect(original).toEqual({ ...before, active: 0 });
    expect(copy.id).not.toBe(p.id);
    expect(copy).toMatchObject({
      catalogId: before.catalogId,
      name: before.name,
      ref: 'OEUF',
      desc: 'Plein air',
      price: before.price,
      vat: before.vat,
      qt: 6,
      unitType: UNIT_ORDINAL.piece,
      organic: 1,
      multiWeight: 1,
      stockTracking: 1,
      stockTrackingPerDistrib: 0,
      stock: 24,
      active: 1,
    });
    // the copy is a new product, so its price can be changed: nobody ordered it
    const copyForm = await app.actions.products.form(a.request, { productId: copy.id });
    expect(copyForm.offers).toMatchObject({ price: true, quantity: true, unit: true });
  });

  test('copying needs a valid token and the right to manage the catalog', { tag: ['@CAT-PRD-005'] }, async ({ app, as, errors }) => {
    errors.expect(/./); // hx raises "Forbidden access" as an error page
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const member = await actor(app, as, s, 'member');
    const p = s.products.var[0];
    const before = await productCount();

    const noToken = await app.actions.products.copyAndDeactivate(a.request, p.id, { token: false });
    await app.actions.products.copyAndDeactivate(member.request, p.id, { token: false });

    expect(noToken.flash).toMatchObject({ kind: 'error' });
    expect(await productCount()).toBe(before);
    expect((await productRow(p.id)).active).toBe(1);
  });
});

test.describe('deleting a product', () => {
  test('a product nobody ordered is deleted', { tag: ['@CAT-PRD-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[1];

    const res = await app.actions.products.delete(a.request, p.id);

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await queryOne('SELECT id FROM Product WHERE id = ?', [p.id])).toBeUndefined();
  });

  for (const status of ['OPEN', 'CONFIRMED', 'VALIDATED'] as const) {
    test(`a product referenced by an order cannot be deleted (${status})`, { tag: ['@CAT-PRD-006'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await actor(app, as, s);
      const p = s.products.var[0];
      await order(s, p, status);

      const res = await app.actions.products.delete(a.request, p.id);

      expect(res.flash).toMatchObject({ kind: 'error' });
      expect(await productRow(p.id)).toBeDefined();
    });
  }

  test('deleting needs a valid security token', { tag: ['@CAT-PRD-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[1];

    const res = await app.actions.products.delete(a.request, p.id, { token: false });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await productRow(p.id)).toBeDefined();
  });

  test('a member and a coordinator of another catalog cannot delete it', { tag: ['@CAT-PRD-006'] }, async ({ app, as, errors }) => {
    errors.expect(/./); // hx raises "Forbidden access" as an error page
    const s = await make.amapScenario();
    const { baker } = await otherCoordinator(s);
    const member = await actor(app, as, s, 'member');
    const bakerSession = await as(baker);
    const p = s.products.var[1];

    // the token of a page they may open, so that only the right is missing
    await app.actions.products.delete(member.request, p.id);
    await app.actions.products.delete(bakerSession.request, p.id);

    expect(await productRow(p.id)).toBeDefined();
  });
});

test.describe('batch enable and disable', () => {
  test('a coordinator disables then enables several products at once', { tag: ['@CAT-PRD-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const ids = s.products.var.map((p) => p.id);

    await app.actions.products.setActive(a.request, s.varCatalog.id, ids, false);
    const disabled = (await products(s.varCatalog.id)).map((p) => p.active);
    await app.actions.products.setActive(a.request, s.varCatalog.id, ids, true);
    const enabled = (await products(s.varCatalog.id)).map((p) => p.active);

    expect(disabled).toEqual(ids.map(() => 0));
    expect(enabled).toEqual(ids.map(() => 1));
  });

  test('only the products sent are changed', { tag: ['@CAT-PRD-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.products.setActive(a.request, s.varCatalog.id, [s.products.var[0].id], false);

    expect((await products(s.varCatalog.id)).map((p) => p.active)).toEqual([0, 1]);
    expect((await products(s.constCatalog.id)).every((p) => p.active === 1)).toBe(true);
  });

  test('a member cannot enable or disable products', { tag: ['@CAT-PRD-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await actor(app, as, s, 'member');

    await app.actions.products.setActive(member.request, s.varCatalog.id, s.products.var.map((p) => p.id), false);

    expect((await products(s.varCatalog.id)).every((p) => p.active === 1)).toBe(true);
  });

  test('a product id outside the catalog rejects the whole batch', { tag: ['@CAT-PRD-007'] }, async ({ app, as, errors }) => {
    errors.expect(/./); // hx throws "product N is not in this contract"
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const [first, second] = s.products.var;

    await app.actions.products.setActive(a.request, s.varCatalog.id, [first.id, s.products.const[0].id], false);

    expect((await productRow(first.id)).active).toBe(1);
    expect((await productRow(second.id)).active).toBe(1);
    expect((await productRow(s.products.const[0].id)).active).toBe(1);
  });

  // UND-040 (undecided): the rights are checked on the catalog of the page, but the service takes the
  // catalog of the first product id. hx today lets a coordinator change the products of another catalog.
  test('hx today: a coordinator of one catalog can disable the products of another one', { tag: ['@CAT-PRD-007', '@CAT-PRD-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { baker, other, pain } = await otherCoordinator(s);
    const bakerSession = await as(baker);
    await app.actions.group.select(bakerSession.request, s.group.id);
    const target = s.products.var[0];

    // the baker coordinates only "Pain": the page is theirs, the product is not
    await app.actions.products.setActive(bakerSession.request, other.id, [target.id], false);

    expect((await productRow(target.id)).active).toBe(0);
    expect((await productRow(pain.id)).active).toBe(1);
  });

  // UND-040: the catalog of the first id decides, so a list that starts in the managed catalog and
  // continues in another one is rejected whole.
  test('hx today: a list starting in the managed catalog and ending in another one is rejected', { tag: ['@CAT-PRD-008'] }, async ({ app, as, errors }) => {
    errors.expect(/./);
    const s = await make.amapScenario();
    const { baker, other, pain } = await otherCoordinator(s);
    const bakerSession = await as(baker);
    await app.actions.group.select(bakerSession.request, s.group.id);
    const target = s.products.var[0];

    await app.actions.products.setActive(bakerSession.request, other.id, [pain.id, target.id], false);

    expect((await productRow(pain.id)).active).toBe(1);
    expect((await productRow(target.id)).active).toBe(1);
  });
});

test.describe('options by catalog type', () => {
  test('the form of a constant catalog does not offer bulk or variable price', { tag: ['@CAT-PRD-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const creation = await app.actions.products.form(a.request, { catalogId: s.constCatalog.id });
    const edition = await app.actions.products.form(a.request, { productId: s.products.const[0].id });

    for (const form of [creation, edition]) {
      expect(form.offers.bulk).toBe(false);
      expect(form.offers.variablePrice).toBe(false);
      expect(form.offers.organic).toBe(true);
      expect(form.offers.multiWeight).toBe(true);
    }
  });

  test('the form of a variable catalog offers bulk and variable price', { tag: ['@CAT-PRD-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const creation = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });
    const edition = await app.actions.products.form(a.request, { productId: s.products.var[0].id });

    for (const form of [creation, edition]) expect(form.offers).toMatchObject({ bulk: true, variablePrice: true, multiWeight: true });
  });
});

test.describe('product consistency', () => {
  test('a bulk product needs a unit', { tag: ['@CAT-PRD-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Vrac', price: 3, bulk: true, quantity: 2, unit: null });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await productCount()).toBe(before);
  });

  test('a bulk product needs a quantity', { tag: ['@CAT-PRD-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Vrac', price: 3, bulk: true, quantity: null, unit: 'kilogram' });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await productCount()).toBe(before);
  });

  test('a bulk product cannot be multi-weight', { tag: ['@CAT-PRD-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Vrac', price: 3, bulk: true, multiWeight: true, quantity: 1, unit: 'kilogram' });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await productCount()).toBe(before);
  });

  test('a bulk product with a unit and a quantity is accepted', { tag: ['@CAT-PRD-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Vrac', price: 3, bulk: true, quantity: 1, unit: 'kilogram' });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await newestProduct()).toMatchObject({ bulk: 1, qt: 1, unitType: UNIT_ORDINAL.kilogram });
  });

  test('the same rules apply when a product is edited', { tag: ['@CAT-PRD-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[0];
    const before = await productRow(p.id);

    const res = await app.actions.products.edit(a.request, p.id, { bulk: true, multiWeight: true });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await productRow(p.id)).toEqual(before);
  });

  // Finding: the quantity is checked before the 0 -> empty conversion, so "bulk with quantity 0" passes
  // the rule and is stored as a bulk product with no quantity.
  test('hx today: a bulk product with a quantity of 0 passes and is stored without quantity', { tag: ['@CAT-PRD-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Vrac zéro', price: 3, bulk: true, quantity: 0, unit: 'kilogram' });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await newestProduct()).toMatchObject({ bulk: 1, qt: null });
  });

  // UND-049 (undecided): the rule "multi-weight implies variable price" is commented out in
  // db/Product.hx check(); a multi-weight product with a fixed price is stored as is.
  test('hx today: a multi-weight product need not be a variable-price product', { tag: ['@CAT-PRD-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Multipesée', price: 3, multiWeight: true, variablePrice: false });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await newestProduct()).toMatchObject({ multiWeight: 1, variablePrice: 0 });
  });
});

test.describe('stock settings of a failed edit', () => {
  // UND-038 (undecided): the edit rewrites the stock rows before the checks. The suggestion is to leave
  // them untouched when validation fails. hx today: the failed edit leaves them as they were (the redirect
  // with the error message rolls back the rewrite).
  test('hx today: an edit that fails the checks leaves the stock settings untouched', { tag: ['@CAT-PRD-015'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'StockManagement') });
    const p = s.products.var[0];
    // per-distribution stock, "per period" rule
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 2, stock: 10 });
    await insert('ProductDistributionStock', {
      productId: p.id,
      startDistributionId: s.distributions[0].var.id,
      endDistributionId: s.distributions[1].var.id,
      stockPerDistribution: 5,
      frequencyRatio: 1,
    });
    const rowsBefore = await query('SELECT * FROM ProductDistributionStock WHERE productId = ?', [p.id]);
    const before = await productRow(p.id);

    const res = await app.actions.products.edit(a.request, p.id, { bulk: true, multiWeight: true });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(await productRow(p.id)).toEqual(before);
    expect(await query('SELECT * FROM ProductDistributionStock WHERE productId = ?', [p.id])).toEqual(rowsBefore);
  });

  test('the form of a stock-managed catalog offers the stock settings', { tag: ['@CAT-PRD-015'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const plain = await app.actions.products.form(a.request, { productId: s.products.var[0].id });
    await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'StockManagement') });

    const managed = await app.actions.products.form(a.request, { productId: s.products.var[0].id });

    expect(plain.offers.stock).toBe(false);
    expect(managed.offers.stock).toBe(true);
  });
});
