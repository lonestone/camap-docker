/**
 * Stock management, member side (specs/03-catalogs/stock.md; db/Product.hx getDistribStock/getAvailableStock,
 * controller/api/Catalog.hx doStocksPerProductDistribution, service/OrderService.hx, camap-ts
 * products.resolver.ts). The available stock of each product at each future distribution, and how
 * orders reduce it. The coordinator's forms are in stock.forms.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { insert, query } from '../../src/db/client.js';
import { CatalogFlag, flags } from '../../src/encodings/flags.js';
import { addDaysWall, atWallTime } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';
import * as make from '../../src/factories/index.js';
import { subscribeVar } from '../../src/flows.js';
import type { CamapApp } from '../../src/targets/types.js';
import type { APIRequestContext } from '@playwright/test';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** The variable catalog of the scenario, with stock management on (the constant one stays off). */
async function stockScenario(opts: Parameters<typeof make.amapScenario>[0] = {}) {
  const s = await make.amapScenario(opts);
  await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'StockManagement') });
  return { s, d: s.distributions.map((x) => x.var), p: s.products.var[0] };
}

/** Available stock of a product at each given distribution, as the member API reports it. */
async function available(app: CamapApp, request: APIRequestContext, catalogId: number, productId: number, distribs: { id: number }[]) {
  const res = await app.api.catalogStock.perProductDistribution(request, catalogId);
  expect(res.status).toBe(200);
  const byDistrib = res.body?.[String(productId)] ?? {};
  return distribs.map((x) => byDistrib[String(x.id)]);
}

async function order(s: Scenario, product: { id: number; price: number }, distribution: { id: number }, quantity: number, who: 'member' | 'member2' = 'member') {
  const md = (await query<{ multiDistribId: number }>('SELECT multiDistribId FROM Distribution WHERE id = ?', [distribution.id]))[0];
  const basket = await make.basket({ user: s.users[who], multiDistrib: { id: md.multiDistribId } });
  await make.userOrder({ user: s.users[who], product, distribution, basket, quantity });
}

/** StockTracking: 0 Disabled, 1 Global, 2 PerDistribution. StockTrackingPerDistribution: 0 always the same, 1 frequency, 2 per period. */
const global = (productId: number, stock: number | null) => make.setProduct(productId, { stockTracking: 1, stock });
const alwaysSame = (productId: number, stock: number | null) => make.setProduct(productId, { stockTracking: 2, stockTrackingPerDistrib: 0, stock });

test.describe('the available stock is the stock minus the orders', () => {
  test('global stock: every order at any distribution reduces it for all of them', { tag: ['@CAT-STK-002', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await global(p.id, 10);
    await order(s, p, d[0], 4);
    await order(s, p, d[2], 3, 'member2');
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([3, 3, 3, 3]);
  });

  test('the same stock at every distribution: only the orders of that distribution count', { tag: ['@CAT-STK-003', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await alwaysSame(p.id, 10);
    await order(s, p, d[0], 4);
    await order(s, p, d[0], 3, 'member2');
    await order(s, p, d[2], 1);
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([3, 10, 9, 10]);
  });

  test('an order with a quantity of 0 does not reduce the stock', { tag: ['@CAT-STK-002', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await global(p.id, 10);
    await order(s, p, d[0], 0);
    await order(s, p, d[1], 2);
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([8, 8, 8, 8]);
  });

  test('a multi-weight product counts 1 per order line, whatever its quantity', { tag: ['@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await make.setProduct(p.id, { multiWeight: 1, stockTracking: 1, stock: 5 });
    await order(s, p, d[0], 0.4);
    await order(s, p, d[0], 1.7, 'member2');
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([3, 3, 3, 3]);
  });

  test('a stock below the orders shows as 0, never as a negative number', { tag: ['@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await alwaysSame(p.id, 3);
    await order(s, p, d[1], 5);
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([3, 0, 3, 3]);
  });

  test('a tracked product with an empty stock has no limit', { tag: ['@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await global(p.id, null);
    await order(s, p, d[0], 4);
    const member = await as(s.users.member);

    const res = await app.api.catalogStock.perProductDistribution(member.request, s.varCatalog.id);

    expect(res.body![String(p.id)]).toEqual({ [d[0].id]: null, [d[1].id]: null, [d[2].id]: null, [d[3].id]: null });
  });

  test('a product with no stock tracking has no limit and no entry', { tag: ['@CAT-STK-002', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await order(s, p, d[0], 40);
    const member = await as(s.users.member);

    const res = await app.api.catalogStock.perProductDistribution(member.request, s.varCatalog.id);

    expect(res.body![String(p.id)]).toEqual({});
  });
});

test.describe('stock every 2nd, 3rd or 4th distribution', () => {
  for (const [every, start] of [[2, 0], [2, 1], [3, 0], [3, 2], [4, 1]] as const) {
    test(`1 distribution out of ${every}, starting from the distribution number ${start + 1}`, { tag: ['@CAT-STK-004'] }, async ({ app, as }) => {
      const { s, d, p } = await stockScenario({ distribs: 8 });
      await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 1, stock: 5 });
      await insert('ProductDistributionStock', { productId: p.id, startDistributionId: d[start].id, endDistributionId: d[start].id, stockPerDistribution: 5, frequencyRatio: every });
      const member = await as(s.users.member);

      const stocks = await available(app, member.request, s.varCatalog.id, p.id, d);

      // stock at the start distribution and every `every` after it, none before the start
      expect(stocks).toEqual(d.map((_, i) => (i >= start && (i - start) % every === 0 ? 5 : 0)));
    });
  }

  test('the orders of a distribution reduce only its own stock', { tag: ['@CAT-STK-004', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 1, stock: 5 });
    await insert('ProductDistributionStock', { productId: p.id, startDistributionId: d[0].id, endDistributionId: d[0].id, stockPerDistribution: 5, frequencyRatio: 2 });
    await order(s, p, d[2], 2);
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([5, 0, 3, 0]);
  });
});

test.describe('stock per period', () => {
  test('each period gives its stock to its distributions; the others have 0', { tag: ['@CAT-STK-005'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario({ distribs: 6 });
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 2, stock: 0 });
    await insert('ProductDistributionStock', { productId: p.id, startDistributionId: d[0].id, endDistributionId: d[1].id, stockPerDistribution: 4, frequencyRatio: 1 });
    await insert('ProductDistributionStock', { productId: p.id, startDistributionId: d[4].id, endDistributionId: d[4].id, stockPerDistribution: 9, frequencyRatio: 1 });
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([4, 4, 0, 0, 9, 0]);
  });

  test('the orders of a distribution reduce only its own stock', { tag: ['@CAT-STK-005', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 2, stock: 0 });
    await insert('ProductDistributionStock', { productId: p.id, startDistributionId: d[0].id, endDistributionId: d[1].id, stockPerDistribution: 4, frequencyRatio: 1 });
    await order(s, p, d[1], 3);
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([4, 1, 0, 0]);
  });

  test('a product with no period at all has a stock of 0 everywhere', { tag: ['@CAT-STK-005'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await make.setProduct(p.id, { stockTracking: 2, stockTrackingPerDistrib: 2, stock: 0 });
    const member = await as(s.users.member);

    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([0, 0, 0, 0]);
  });
});

test.describe('what a member sees', () => {
  test('a member sees the available stock of each product at each future distribution', { tag: ['@CAT-STK-007'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    const [, other] = s.products.var;
    await alwaysSame(p.id, 6);
    await global(other.id, 20);
    await order(s, p, d[0], 2);
    const member = await as(s.users.member2);

    const res = await app.api.catalogStock.perProductDistribution(member.request, s.varCatalog.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      [p.id]: { [d[0].id]: 4, [d[1].id]: 6, [d[2].id]: 6, [d[3].id]: 6 },
      [other.id]: { [d[0].id]: 20, [d[1].id]: 20, [d[2].id]: 20, [d[3].id]: 20 },
    });
  });

  test('a distribution that is over is not listed', { tag: ['@CAT-STK-007'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    const pastDay = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), -5), 18) });
    const pastDistrib = await make.distribution({ catalog: s.varCatalog, multiDistrib: pastDay });
    await global(p.id, 10);
    const member = await as(s.users.member);

    const res = await app.api.catalogStock.perProductDistribution(member.request, s.varCatalog.id);

    expect(Object.keys(res.body![String(p.id)]).map(Number).sort()).toEqual(d.map((x) => x.id).sort());
    expect(res.body![String(p.id)][String(pastDistrib.id)]).toBeUndefined();
  });

  test('nothing is shown when the catalog has no stock management', { tag: ['@CAT-STK-007'] }, async ({ app, as }) => {
    const { s, p } = await stockScenario();
    await global(p.id, 10);
    const member = await as(s.users.member);

    const res = await app.api.catalogStock.perProductDistribution(member.request, s.constCatalog.id);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

test.describe('orders reduce the stock', () => {
  test('a member who orders reduces the global stock; the other distributions follow', { tag: ['@CAT-STK-002', '@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await global(p.id, 5);
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: d[1].id, orders: [{ productId: p.id, qty: 3 }] }]);

    expect(res.status).toBe(200);
    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([2, 2, 2, 2]);
  });

  test('an order above the available stock is refused', { tag: ['@CAT-STK-006'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    await global(p.id, 5);
    await order(s, p, d[0], 3, 'member2');
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: d[2].id, orders: [{ productId: p.id, qty: 3 }] }]);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toContain('2');
    expect(await query('SELECT id FROM UserOrder WHERE userId = ?', [s.users.member.id])).toEqual([]);
    expect(await available(app, member.request, s.varCatalog.id, p.id, d)).toEqual([2, 2, 2, 2]);
  });

  test('a product with no stock tracking can be ordered in any quantity', { tag: ['@CAT-STK-002'] }, async ({ app, as }) => {
    const { s, d, p } = await stockScenario();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: d[1].id, orders: [{ productId: p.id, qty: 500 }] }]);

    expect(res.status).toBe(200);
    expect((await query<{ quantity: number }>('SELECT quantity FROM UserOrder WHERE userId = ?', [s.users.member.id])).map((r) => r.quantity)).toEqual([500]);
  });
});

test.describe('a catalog without stock management ignores the stock of its products', () => {
  test('orders are not limited, whatever the tracking left on the product', { tag: ['@CAT-STK-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [e6] = s.products.var; // the variable catalog has no stock management here
    await global(e6.id, 2);
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: s.distributions[1].var.id, orders: [{ productId: e6.id, qty: 9 }] }]);

    expect(res.status).toBe(200);
    expect((await query<{ quantity: number }>('SELECT quantity FROM UserOrder WHERE userId = ?', [s.users.member.id])).map((r) => r.quantity)).toEqual([9]);
  });

  test('the product reports its stock tracking as disabled', { tag: ['@CAT-STK-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [e6] = s.products.var;
    await make.setProduct(e6.id, { stockTracking: 1, stock: 4 });
    const member = await as(s.users.member);

    const res = await app.api.products.vendorStockTracking(member.request, s.vendor.id);

    expect(res.errors).toBeNull();
    const reported = res.data!.vendorProductsSample.find((x) => x.id === e6.id);
    expect(reported).toEqual({ id: e6.id, stockTracking: 'Disabled' });
  });
});
