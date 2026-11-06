/**
 * Stock management, coordinator side (specs/03-catalogs/stock.md; controller/Product.hx,
 * controller/ContractAdmin.hx doStocks/doDuplicate, service/ProductService.hx, service/CatalogService.hx,
 * db/ProductDistributionStock.hx). The stock settings are posted with the product form; what a member
 * sees (available stock) is in stock.api.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { insert, query, queryOne } from '../../src/db/client.js';
import { CatalogFlag, flags } from '../../src/encodings/flags.js';
import { addDaysWall, atWallTime } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** The variable catalog of the scenario, with stock management on (the constant one stays off). */
async function stockScenario(opts: Parameters<typeof make.amapScenario>[0] = {}) {
  const s = await make.amapScenario(opts);
  await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'StockManagement') });
  return { s, d: s.distributions.map((x) => x.var.id) };
}

async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'coordinator') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

/** StockTracking: 0 Disabled, 1 Global, 2 PerDistribution. StockTrackingPerDistribution: 0 always the same, 1 frequency, 2 per period. */
type ProductRow = { id: number; name: string; catalogId: number; stockTracking: number | null; stockTrackingPerDistrib: number | null; stock: number | null };
const productRow = async (id: number) => (await queryOne<ProductRow>('SELECT id, name, catalogId, stockTracking, stockTrackingPerDistrib, stock FROM Product WHERE id = ?', [id]))!;
const productByName = async (name: string) => queryOne<ProductRow>('SELECT id, name, catalogId, stockTracking, stockTrackingPerDistrib, stock FROM Product WHERE name = ?', [name]);
const periods = (productId: number) =>
  query<{ startDistributionId: number; endDistributionId: number; stockPerDistribution: number; frequencyRatio: number }>(
    'SELECT startDistributionId, endDistributionId, stockPerDistribution, frequencyRatio FROM ProductDistributionStock WHERE productId = ? ORDER BY id',
    [productId],
  );
const productCount = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Product'))!.n;

/** A member has ordered `quantity` of `product` at `distribution`. */
async function order(s: Scenario, product: { id: number; price: number }, distribution: { id: number }, quantity: number, who: 'member' | 'member2' = 'member') {
  const md = await queryOne<{ multiDistribId: number }>('SELECT multiDistribId FROM Distribution WHERE id = ?', [distribution.id]);
  const basket = await make.basket({ user: s.users[who], multiDistrib: { id: md!.multiDistribId } });
  await make.userOrder({ user: s.users[who], product, distribution, basket, quantity });
}

test.describe('the stocks page', () => {
  test('a coordinator opens the stocks page of a catalog with stock management; a member cannot', { tag: ['@CAT-STK-001'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const member = await actor(app, as, s, 'member');

    const ok = await app.views.stocks.page(coordinator.request, s.varCatalog.id);
    const refused = await app.views.stocks.page(member.request, s.varCatalog.id);

    expect(ok.status).toBe(200);
    expect(ok.text).toContain(s.products.var[0].name);
    expect(refused.status).toBe(302);
    expect(refused.location).toBe('/');
  });

  test('the stocks page redirects away when the catalog has no stock management', { tag: ['@CAT-STK-001'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.views.stocks.page(coordinator.request, s.constCatalog.id);

    // hx redirects to the home page with an error message (lost: the home page redirects again)
    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
  });

  test('the product form offers the stock settings only in a catalog with stock management', { tag: ['@CAT-STK-001'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const on = await app.actions.products.form(coordinator.request, { catalogId: s.varCatalog.id });
    const off = await app.actions.products.form(coordinator.request, { catalogId: s.constCatalog.id });

    expect(on.offers.stock).toBe(true);
    expect(off.offers.stock).toBe(false);
  });

  test('stock settings posted to a catalog without stock management are ignored', { tag: ['@CAT-STK-001', '@CAT-STK-012'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const [veg] = s.products.const;

    const created = await app.actions.products.create(coordinator.request, s.constCatalog.id, { name: 'Courges', price: 3, stock: { mode: 'global', stock: 5 } });
    const edited = await app.actions.products.edit(coordinator.request, veg.id, { stock: { mode: 'global', stock: 9 } });

    expect(created.flash).toMatchObject({ kind: 'ok' });
    expect(edited.flash).toMatchObject({ kind: 'ok' });
    // a product made through a form without stock fields gets a NULL tracking, which hx reads as Disabled
    const courges = (await productByName('Courges'))!;
    expect([0, null]).toContain(courges.stockTracking);
    expect(courges.stock).toBeNull();
    expect(await productRow(veg.id)).toMatchObject({ stockTracking: 0, stock: null });
    expect(await periods(veg.id)).toEqual([]);
  });
});

test.describe('stock modes', () => {
  test('none: a product created without stock settings has no tracking', { tag: ['@CAT-STK-002'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Radis', price: 2 });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await productByName('Radis')).toMatchObject({ stockTracking: 0, stock: null });
  });

  test('global: one stock for the catalog', { tag: ['@CAT-STK-002'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Miel', price: 6, stock: { mode: 'global', stock: 12 } });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const p = (await productByName('Miel'))!;
    expect(p).toMatchObject({ catalogId: s.varCatalog.id, stockTracking: 1, stock: 12 });
    expect(await periods(p.id)).toEqual([]);
  });

  test('per distribution, the same stock at every distribution', { tag: ['@CAT-STK-002', '@CAT-STK-003'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Pain', price: 4, stock: { mode: 'perDistribution', rule: 'always', stock: 8 } });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const p = (await productByName('Pain'))!;
    expect(p).toMatchObject({ stockTracking: 2, stockTrackingPerDistrib: 0, stock: 8 });
    expect(await periods(p.id)).toEqual([]);
  });

  test('a coordinator can change the stock mode of an existing product', { tag: ['@CAT-STK-002'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];

    await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'global', stock: 20 } });
    expect(await productRow(p.id)).toMatchObject({ stockTracking: 1, stock: 20 });

    await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'perDistribution', rule: 'always', stock: 3 } });
    expect(await productRow(p.id)).toMatchObject({ stockTracking: 2, stockTrackingPerDistrib: 0, stock: 3 });

    const res = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'none' } });
    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect((await productRow(p.id)).stockTracking).toBe(0);
  });

  test('stock 0 is a valid stock', { tag: ['@CAT-STK-002', '@CAT-STK-008'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Edition limitée', price: 9, stock: { mode: 'global', stock: 0 } });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await productByName('Edition limitée')).toMatchObject({ stockTracking: 1, stock: 0 });
  });
});

test.describe('stock every 2nd, 3rd or 4th distribution', () => {
  for (const every of [2, 3, 4] as const) {
    test(`1 distribution out of ${every}, from the chosen one`, { tag: ['@CAT-STK-004'] }, async ({ app, as }) => {
      const { s, d } = await stockScenario();
      const coordinator = await actor(app, as, s);

      const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, {
        name: 'Fromage',
        price: 7,
        stock: { mode: 'perDistribution', rule: 'every', every, startDistributionId: d[1], stock: 5 },
      });

      expect(res.flash).toMatchObject({ kind: 'ok' });
      const p = (await productByName('Fromage'))!;
      expect(p).toMatchObject({ stockTracking: 2, stockTrackingPerDistrib: 1, stock: 5 });
      // one row: the start distribution, the ratio and the stock
      expect(await periods(p.id)).toEqual([{ startDistributionId: d[1], endDistributionId: d[1], stockPerDistribution: 5, frequencyRatio: every }]);
    });
  }

  test('the frequency, the first distribution and the stock are checked', { tag: ['@CAT-STK-004', '@CAT-STK-008'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const before = await productCount();

    const noStock = await app.actions.products.create(coordinator.request, s.varCatalog.id, {
      name: 'Fromage',
      price: 7,
      stock: { mode: 'perDistribution', rule: 'every', every: 2, startDistributionId: d[0], stock: null },
    });
    const badStock = await app.actions.products.create(coordinator.request, s.varCatalog.id, {
      name: 'Fromage',
      price: 7,
      stock: { mode: 'perDistribution', rule: 'every', every: 2, startDistributionId: d[0], stock: 'beaucoup' },
    });

    // the form is shown again with its errors: no redirect, nothing saved
    expect(noStock.status).toBe(200);
    expect(badStock.status).toBe(200);
    expect(await productCount()).toBe(before);
  });

  // The spec asks for a frequency of 2, 3 or 4. hx has a check on the empty choice but it never fires
  // (Math.isNaN(null) is false): the product is saved with a ratio of 1, i.e. stock at every distribution.
  test('hx today: leaving the frequency empty is accepted and stores a ratio of 1', { tag: ['@CAT-STK-004'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, {
      name: 'Fromage',
      price: 7,
      stock: { mode: 'perDistribution', rule: 'every', every: null, startDistributionId: d[0], stock: 4 },
    });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const p = (await productByName('Fromage'))!;
    expect((await periods(p.id)).map((x) => x.frequencyRatio)).toEqual([1]);
  });
});

test.describe('stock per period', () => {
  test('a coordinator gives a stock per period between two distributions', { tag: ['@CAT-STK-005'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, {
      name: 'Agneau',
      price: 20,
      stock: {
        mode: 'perDistribution',
        rule: 'periods',
        periods: [
          { fromDistributionId: d[0], toDistributionId: d[1], stock: 4 },
          { fromDistributionId: d[3], toDistributionId: d[3], stock: 9 },
        ],
      },
    });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const p = (await productByName('Agneau'))!;
    // the product has no global stock of its own: hx stores 0
    expect(p).toMatchObject({ stockTracking: 2, stockTrackingPerDistrib: 2, stock: 0 });
    expect(await periods(p.id)).toEqual([
      { startDistributionId: d[0], endDistributionId: d[1], stockPerDistribution: 4, frequencyRatio: 1 },
      { startDistributionId: d[3], endDistributionId: d[3], stockPerDistribution: 9, frequencyRatio: 1 },
    ]);
  });

  test('editing the periods replaces the previous ones', { tag: ['@CAT-STK-005'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    await app.actions.products.edit(coordinator.request, p.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: d[1], stock: 4 }, { fromDistributionId: d[2], toDistributionId: d[3], stock: 6 }] },
    });
    expect(await periods(p.id)).toHaveLength(2);

    const res = await app.actions.products.edit(coordinator.request, p.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[1], toDistributionId: d[2], stock: 2 }] },
    });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect(await periods(p.id)).toEqual([{ startDistributionId: d[1], endDistributionId: d[2], stockPerDistribution: 2, frequencyRatio: 1 }]);
  });

  test('switching to another mode removes the periods', { tag: ['@CAT-STK-005', '@CAT-STK-003'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    await app.actions.products.edit(coordinator.request, p.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: d[1], stock: 4 }] },
    });

    await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'perDistribution', rule: 'always', stock: 6 } });

    expect(await periods(p.id)).toEqual([]);
    expect(await productRow(p.id)).toMatchObject({ stockTrackingPerDistrib: 0, stock: 6 });
  });

  test('every period needs a stock that is a number', { tag: ['@CAT-STK-005', '@CAT-STK-008'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const before = await productCount();

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, {
      name: 'Agneau',
      price: 20,
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: d[1], stock: 'peu' }] },
    });

    expect(res.status).toBe(200);
    expect(await productCount()).toBe(before);
  });
});

test.describe('a stock is required', () => {
  test('global stock: creating a tracked product without stock is refused', { tag: ['@CAT-STK-008'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const before = await productCount();

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Miel', price: 6, stock: { mode: 'global', stock: null } });

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'error', text: expect.stringContaining('stock') });
    expect(await productCount()).toBe(before);
  });

  test('global stock: turning tracking on without a stock is refused and nothing changes', { tag: ['@CAT-STK-008'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    const before = await productRow(p.id);

    const res = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'global', stock: null } });

    expect(res.flash).toMatchObject({ kind: 'error', text: expect.stringContaining('stock') });
    expect(await productRow(p.id)).toEqual(before);
  });

  test('same stock at every distribution: an empty or non-numeric stock fails the form', { tag: ['@CAT-STK-008'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const before = await productCount();

    const empty = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Pain', price: 4, stock: { mode: 'perDistribution', rule: 'always', stock: null } });
    const text = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Pain', price: 4, stock: { mode: 'perDistribution', rule: 'always', stock: 'abc' } });

    expect(empty.status).toBe(200);
    expect(text.status).toBe(200);
    expect(await productCount()).toBe(before);
  });

  test('no tracking needs no stock', { tag: ['@CAT-STK-008'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, { name: 'Radis', price: 2, stock: { mode: 'none' } });

    expect(res.flash).toMatchObject({ kind: 'ok' });
  });
});

test.describe('a stock cannot go below the orders', () => {
  test('same stock at every distribution: the error gives the minimum stock allowed', { tag: ['@CAT-STK-009'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 0, stock: 10 });
    await order(s, p, s.distributions[0].var, 4);
    await order(s, p, s.distributions[0].var, 3, 'member2');
    const before = await productRow(p.id);

    const tooLow = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'perDistribution', rule: 'always', stock: 5 } });

    expect(tooLow.flash).toMatchObject({ kind: 'error' });
    expect(tooLow.flash!.text).toContain('7');
    expect(await productRow(p.id)).toEqual(before);

    const justEnough = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'perDistribution', rule: 'always', stock: 7 } });

    expect(justEnough.flash).toMatchObject({ kind: 'ok' });
    expect((await productRow(p.id)).stock).toBe(7);
  });

  test('global stock: every order counts, whatever the distribution', { tag: ['@CAT-STK-009'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    await make.setProduct(p.id, { stockTracking: 1, stock: 10 });
    await order(s, p, s.distributions[0].var, 4);
    await order(s, p, s.distributions[2].var, 3);

    const tooLow = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'global', stock: 6 } });
    const ok = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'global', stock: 7 } });

    expect(tooLow.flash).toMatchObject({ kind: 'error' });
    expect(tooLow.flash!.text).toContain('7');
    expect(ok.flash).toMatchObject({ kind: 'ok' });
    expect((await productRow(p.id)).stock).toBe(7);
  });

  test('periods: a period stock below the orders of one of its distributions is refused', { tag: ['@CAT-STK-009'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    await order(s, p, s.distributions[1].var, 5);
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 2, stock: 0 });
    await insert('ProductDistributionStock', { productId: p.id, startDistributionId: d[0], endDistributionId: d[1], stockPerDistribution: 6, frequencyRatio: 1 });
    const rowsBefore = await periods(p.id);

    const res = await app.actions.products.edit(coordinator.request, p.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: d[1], stock: 2 }] },
    });

    expect(res.flash).toMatchObject({ kind: 'error' });
    expect(res.flash!.text).toContain('5');
    expect(await periods(p.id)).toEqual(rowsBefore);
  });

  test('a distribution that is already past is not checked', { tag: ['@CAT-STK-009'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    const pastDay = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), -5), 18) });
    const pastDistrib = await make.distribution({ catalog: s.varCatalog, multiDistrib: pastDay });
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 0, stock: 10 });
    await order(s, p, pastDistrib, 8);

    const res = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'perDistribution', rule: 'always', stock: 2 } });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect((await productRow(p.id)).stock).toBe(2);
  });

  test('orders cancelled to quantity 0 do not count', { tag: ['@CAT-STK-009', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 0, stock: 10 });
    await order(s, p, s.distributions[0].var, 0);

    const res = await app.actions.products.edit(coordinator.request, p.id, { stock: { mode: 'perDistribution', rule: 'always', stock: 1 } });

    expect(res.flash).toMatchObject({ kind: 'ok' });
  });
});

test.describe('saving a catalog with a tracked product without stock', () => {
  test('the catalog is saved and the coordinator is only warned', { tag: ['@CAT-STK-010'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    await make.setProduct(s.products.var[0].id, { stockTracking: 1, stock: null });

    const res = await app.actions.catalogs.edit(coordinator.request, s.varCatalog.id, { description: 'Nouvelle description' });

    expect(res.status).toBe(302);
    expect(res.alerts!.some((a) => a.kind === 'error' && /stock/i.test(a.text))).toBe(true);
    expect(res.alerts!.some((a) => a.kind === 'ok')).toBe(true);
    const saved = await queryOne<{ description: string }>('SELECT description FROM Catalog WHERE id = ?', [s.varCatalog.id]);
    expect(saved!.description).toBe('Nouvelle description');
  });

  test('no warning when every tracked product has a stock, or when the catalog has no stock management', { tag: ['@CAT-STK-010'] }, async ({ app, as }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    await make.setProduct(s.products.var[0].id, { stockTracking: 1, stock: 3 });
    await make.setProduct(s.products.var[1].id, { stockTracking: 0, stock: null });
    const complete = await app.actions.catalogs.edit(coordinator.request, s.varCatalog.id, { description: 'a' });

    await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder') });
    await make.setProduct(s.products.var[1].id, { stockTracking: 1, stock: null });
    const off = await app.actions.catalogs.edit(coordinator.request, s.varCatalog.id, { description: 'b' });

    expect(complete.alerts!.some((a) => /stock/i.test(a.text))).toBe(false);
    expect(off.alerts!.some((a) => /stock/i.test(a.text))).toBe(false);
  });
});

test.describe('distributions of a stock period', () => {
  test('a period cannot use a distribution of another catalog: nothing is saved', { tag: ['@CAT-STK-011'], }, async ({ app, as, errors }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    errors.expect(/does not match the product catalog/);
    const foreign = s.distributions[0].const.id;
    const before = await productCount();

    const res = await app.actions.products.create(coordinator.request, s.varCatalog.id, {
      name: 'Agneau',
      price: 20,
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: foreign, stock: 4 }] },
    });

    // hx shows its error page (no redirect, no flash) and rolls the whole save back
    expect(res.flash).toBeNull();
    expect(await productCount()).toBe(before);
    expect(await query('SELECT id FROM ProductDistributionStock')).toEqual([]);
  });

  test('the first distribution of a frequency rule must belong to the catalog too', { tag: ['@CAT-STK-011'] }, async ({ app, as, errors }) => {
    const { s } = await stockScenario();
    const coordinator = await actor(app, as, s);
    errors.expect(/does not match the product catalog/);
    const before = await productCount();

    await app.actions.products.create(coordinator.request, s.varCatalog.id, {
      name: 'Fromage',
      price: 7,
      stock: { mode: 'perDistribution', rule: 'every', every: 2, startDistributionId: s.distributions[0].const.id, stock: 4 },
    });

    expect(await productCount()).toBe(before);
    expect(await query('SELECT id FROM ProductDistributionStock')).toEqual([]);
  });

  test('editing a product with a foreign distribution leaves its periods as they were', { tag: ['@CAT-STK-011'] }, async ({ app, as, errors }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    errors.expect(/does not match the product catalog/);
    const p = s.products.var[0];
    await app.actions.products.edit(coordinator.request, p.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: d[1], stock: 4 }] },
    });
    const before = await periods(p.id);

    await app.actions.products.edit(coordinator.request, p.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: s.distributions[0].const.id, toDistributionId: d[1], stock: 9 }] },
    });

    expect(await periods(p.id)).toEqual(before);
  });
});

test.describe('duplicating a catalog', () => {
  test('a duplicated product starts with stock tracking off and no stock periods', { tag: ['@CAT-STK-013'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const [tracked, plain] = s.products.var;
    await app.actions.products.edit(coordinator.request, tracked.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: d[1], stock: 4 }] },
    });
    expect(await periods(tracked.id)).toHaveLength(1);

    const res = await app.actions.catalogs.duplicate(coordinator.request, s.varCatalog.id, { name: 'Copie', copyProducts: 'all' });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const copy = (await queryOne<{ id: number }>('SELECT id FROM Catalog WHERE name = ?', ['Copie']))!;
    const copies = await query<ProductRow>('SELECT id, name, catalogId, stockTracking, stockTrackingPerDistrib, stock FROM Product WHERE catalogId = ? ORDER BY name', [copy.id]);
    expect(copies.map((c) => c.name)).toEqual([plain.name, tracked.name].sort());
    for (const c of copies) {
      expect(c.stockTracking).toBe(0);
      expect(await periods(c.id)).toEqual([]);
    }
    // the original keeps its settings
    expect(await productRow(tracked.id)).toMatchObject({ stockTracking: 2, stockTrackingPerDistrib: 2 });
    expect(await periods(tracked.id)).toHaveLength(1);
  });

  test('hx today: "copy and deactivate" is not the same: it keeps the tracking mode but not the periods', { tag: ['@CAT-STK-013'] }, async ({ app, as }) => {
    const { s, d } = await stockScenario();
    const coordinator = await actor(app, as, s);
    const p = s.products.var[0];
    await app.actions.products.edit(coordinator.request, p.id, {
      stock: { mode: 'perDistribution', rule: 'periods', periods: [{ fromDistributionId: d[0], toDistributionId: d[1], stock: 4 }] },
    });

    const res = await app.actions.products.copyAndDeactivate(coordinator.request, p.id);

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const copy = (await queryOne<ProductRow>('SELECT id, name, catalogId, stockTracking, stockTrackingPerDistrib, stock FROM Product WHERE catalogId = ? AND id <> ? AND name = ?', [s.varCatalog.id, p.id, p.name]))!;
    expect(copy).toMatchObject({ stockTracking: 2, stockTrackingPerDistrib: 2 });
    expect(await periods(copy.id)).toEqual([]);
  });
});
