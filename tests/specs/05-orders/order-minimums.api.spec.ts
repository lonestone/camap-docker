/**
 * Minimum orders of variable catalogs (specs/05-orders/order-minimums.md;
 * service/SubscriptionService.hx checkVarOrders, api/Subscription.hx doCheckDefaultOrder).
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

async function setup(columns: Record<string, unknown>) {
  const s = await make.amapScenario();
  await make.setCatalog(s.varCatalog.id, columns);
  const [e6, e12] = s.products.var;
  return { s, e6, e12 };
}

async function create(app: any, request: any, s: any, defaultOrder: any[], initialOrders: any[] = []) {
  return app.api.subscription.create(request, {
    userId: s.users.member.id,
    catalogId: s.varCatalog.id,
    defaultOrder,
    absentDistribIds: [],
    initialOrders,
  });
}

test.describe('per-distribution minimum', () => {
  test('a default order below the distribution minimum is refused, one at the minimum is accepted', { tag: ['@ORD-MIN-001'] }, async ({ app, as }) => {
    const { s, e6 } = await setup({ distribMinOrdersTotal: 5 });
    const member = await as(s.users.member);

    const low = await create(app, member.request, s, [{ productId: e6.id, productPrice: e6.price, quantity: 2 }]); // 4.80 < 5
    expect(low.status).toBe(500);
    expect(low.body.error.message).toContain('au moins 5');
    expect(await query('SELECT id FROM Subscription')).toEqual([]);

    const ok = await create(app, member.request, s, [{ productId: e6.id, productPrice: e6.price, quantity: 3 }]); // 7.20
    expect(ok.status).toBe(200);
  });

  test('a subscription with a minimum cannot have no order at all', { tag: ['@ORD-MIN-003'] }, async ({ app, as }) => {
    const { s } = await setup({ distribMinOrdersTotal: 5 });
    const member = await as(s.users.member);

    const res = await create(app, member.request, s, []);

    expect(res.status).toBe(500);
    expect(await query('SELECT id FROM Subscription')).toEqual([]);
  });

  test('the default order can be checked before saving', { tag: ['@ORD-MIN-005'] }, async ({ app, as }) => {
    const { s, e6 } = await setup({ distribMinOrdersTotal: 5 });
    const member = await as(s.users.member);

    const ok = await app.api.subscription.checkDefaultOrder(member.request, s.varCatalog.id, [{ productId: e6.id, productPrice: e6.price, quantity: 3 }]);
    const low = await app.api.subscription.checkDefaultOrder(member.request, s.varCatalog.id, [{ productId: e6.id, productPrice: e6.price, quantity: 1 }]);

    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ defaultOrderCheck: true });
    expect(low.status).toBe(500);
    expect(await query('SELECT id FROM Subscription')).toEqual([]);
  });

  test('absences are left out of the minimum check', { tag: ['@ORD-MIN-006'] }, async ({ app, as }) => {
    const { s, e6 } = await setup({ distribMinOrdersTotal: 5, absentDistribsMaxNb: 1 });
    await query('UPDATE Catalog v, Catalog c SET v.absencesStartDate = c.absencesStartDate, v.absencesEndDate = c.absencesEndDate WHERE v.id = ? AND c.id = ?', [
      s.varCatalog.id,
      s.constCatalog.id,
    ]);
    const member = await as(s.users.member);
    const absent = s.distributions[3].var.id;

    const res = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.varCatalog.id,
      defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 3 }],
      absentDistribIds: [absent],
      initialOrders: [],
    });

    expect(res.status).toBe(200);
    const absentOrders = await query('SELECT id FROM UserOrder WHERE distributionId = ?', [absent]);
    expect(absentOrders).toEqual([]);
  });
});

test.describe('catalog minimum', () => {
  test('the total over the subscription must reach its share of the catalog minimum', { tag: ['@ORD-MIN-002'] }, async ({ app, as }) => {
    const { s, e6 } = await setup({ catalogMinOrdersTotal: 40 });
    const member = await as(s.users.member);
    const dist = s.distributions.map((d) => d.var.id);
    const orders = (qty: number) => [{ id: dist[0], orders: [{ productId: e6.id, qty }] }];

    const low = await create(app, member.request, s, [], orders(2)); // 4.80 < 40
    expect(low.status).toBe(500);
    expect(await query('SELECT id FROM Subscription')).toEqual([]);

    const ok = await create(app, member.request, s, [], orders(17)); // 40.80
    expect(ok.status).toBe(200);
  });

  test('the error message prints the total that was compared', { tag: ['@ORD-MIN-007'] }, async ({ app, as }) => {
    // The raw/rounded mismatch of CODE-046 does not show: Neko prints 0.1 + 0.2 as 0.3.
    const { s, e6 } = await setup({ catalogMinOrdersTotal: 40 });
    await make.setProduct(e6.id, { price: 0.1 });
    const [e12] = s.products.var.slice(1);
    await make.setProduct(e12.id, { price: 0.2 });
    const member = await as(s.users.member);

    const res = await create(app, member.request, s, [], [{ id: s.distributions[0].var.id, orders: [{ productId: e6.id, qty: 1 }, { productId: e12.id, qty: 1 }] }]);

    expect(res.status).toBe(500);
    expect(res.body.error.message).toContain('est de 0.3 €');
  });
});
