/**
 * The coordinator's order dialog and what its calls leave in the database
 * (specs/05-orders/admin-orders.md, order-placement.md, order-amounts.md, baskets.md;
 * controller/api/Order.hx, service/OrderService.hx, db/Basket.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { CatalogFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import { subscribeVar } from '../../src/flows.js';

const lines = (subId: number) =>
  query<{ id: number; distributionId: number; productId: number; quantity: number; subscriptionId: number; feesRate: number; productPrice: number }>(
    'SELECT id, distributionId, productId, quantity, subscriptionId, feesRate, productPrice FROM UserOrder WHERE subscriptionId = ? ORDER BY distributionId, id',
    [subId],
  );

async function varSetup() {
  const s = await make.amapScenario();
  const [e6, e12] = s.products.var;
  const scope = { multiDistribId: s.multiDistribs[1].id, catalogId: s.varCatalog.id };
  return { s, e6, e12, scope, dv: s.distributions[1].var.id };
}

/** The variable catalog manages stock; the product has a global stock. */
async function withStock(s: Awaited<ReturnType<typeof make.amapScenario>>, productId: number, stock: number, extra: Record<string, unknown> = {}) {
  await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'StockManagement') });
  await make.setProduct(productId, { stockTracking: 1, stock, ...extra });
}

/** Somebody else's order, which uses up stock. */
async function otherOrder(s: Awaited<ReturnType<typeof make.amapScenario>>, product: { id: number; price: number }, quantity: number) {
  const basket = await make.basket({ user: s.users.member2, multiDistrib: s.multiDistribs[0] });
  await make.userOrder({ user: s.users.member2, product, distribution: s.distributions[0].var, basket, quantity });
}

test.describe('the order dialog saves orders for a member', () => {
  test('an empty list of orders is an error', { tag: ['@ORD-ADO-005'] }, async ({ app, as }) => {
    const { s, scope } = await varSetup();
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, scope, []);

    expect(res.status).toBe(500);
    expect(await query('SELECT id FROM UserOrder')).toEqual([]);
  });

  test('a line goes to the subscription that covers the date of its distribution', { tag: ['@ORD-ADO-005'] }, async ({ app, as }) => {
    const { s, e6 } = await varSetup();
    const [m0, m1, m2, m3] = s.multiDistribs;
    const first = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: m0.distribStartDate, endDate: m1.distribEndDate });
    const second = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: m2.distribStartDate, endDate: m3.distribEndDate });
    const coordinator = await as(s.users.coordinator);
    const scopeOf = (md: { id: number }) => ({ multiDistribId: md.id, catalogId: s.varCatalog.id });

    expect((await app.api.order.update(coordinator.request, s.users.member.id, scopeOf(m1), [{ productId: e6.id, qt: 1 }])).status).toBe(200);
    expect((await app.api.order.update(coordinator.request, s.users.member.id, scopeOf(m3), [{ productId: e6.id, qt: 2 }])).status).toBe(200);

    expect((await lines(first.id)).map((l) => [l.distributionId, l.quantity])).toEqual([[s.distributions[1].var.id, 1]]);
    expect((await lines(second.id)).map((l) => [l.distributionId, l.quantity])).toEqual([[s.distributions[3].var.id, 2]]);
  });

  test('a session whose date no subscription covers is refused', { tag: ['@ORD-ADO-005'] }, async ({ app, as }) => {
    const { s, e6 } = await varSetup();
    const [m0, m1, m2] = s.multiDistribs;
    await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: m0.distribStartDate, endDate: m1.distribEndDate });
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, { multiDistribId: m2.id, catalogId: s.varCatalog.id }, [{ productId: e6.id, qt: 1 }]);

    expect(res.status).toBe(500);
    expect(await query('SELECT id FROM UserOrder')).toEqual([]);
  });

  test('the basket total and the subscription total are refreshed', { tag: ['@ORD-ADO-005', '@ORD-BSK-005'] }, async ({ app, as }) => {
    // BSK-005 (UND-086, undecided): here the dialog refreshes the stored basket total
    const { s, e6, e12, scope } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 2 }, { productId: e12.id, qt: 1 }]);

    const basket = await queryOne<{ total: number }>('SELECT total FROM Basket WHERE userId = ?', [s.users.member.id]);
    expect(basket!.total).toBe(9.3); // 2 x 2.40 + 4.50
    expect(await query('SELECT amount FROM Operation WHERE subscriptionId = ? AND type = 1', [sub.id])).toEqual([{ amount: -9.3 }]);
  });

  test('a dialog answers success even when a line could not be saved (UND-074, characterised)', { tag: ['@ORD-ADO-006', '@ORD-OPL-007'] }, async ({ app, as }) => {
    const { s, e6, e12, scope } = await varSetup();
    await withStock(s, e6.id, 5);
    await otherOrder(s, e6, 3); // 2 left, whatever the distribution
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 4 }, { productId: e12.id, qt: 1 }]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true); // nothing tells the coordinator about the stock error
    // the line is limited to the stock left; the other line was saved
    expect((await lines(sub.id)).map((l) => [l.productId, l.quantity]).sort()).toEqual([[e6.id, 2], [e12.id, 1]].sort());
  });
});

test.describe('stock limits on orders (UND-072, characterised)', () => {
  test('through the dialog, an order above the available stock is limited to it', { tag: ['@ORD-OPL-007'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    await withStock(s, e6.id, 5);
    await otherOrder(s, e6, 3);
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 4 }]);

    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([2]);
  });

  test('through the dialog, with no stock left the quantity becomes 0', { tag: ['@ORD-OPL-007'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    await withStock(s, e6.id, 3);
    await otherOrder(s, e6, 3);
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 2 }]);

    expect(res.status).toBe(200);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([0]);
  });

  test('a member ordering above the stock gets an error and the order is not kept', { tag: ['@ORD-OPL-007'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    await withStock(s, e6.id, 5);
    await otherOrder(s, e6, 3);
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 4 }] }]);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).toContain('pas suffisant');
    expect(await lines(sub.id)).toEqual([]); // the limited line is rolled back with the error
  });

  test('a multi-weight product counts for 1 per line against the stock', { tag: ['@ORD-OPL-007'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    await withStock(s, e6.id, 1, { multiWeight: 1 });
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 3 }]);

    expect(res.status).toBe(200);
    expect((await lines(sub.id)).map((l) => l.quantity).filter((q) => q > 0)).toEqual([1]); // one line for the single unit in stock
  });

  test('stock only counts when the catalog manages it', { tag: ['@ORD-OPL-007'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    await make.setProduct(e6.id, { stockTracking: 1, stock: 1 }); // the catalog does not manage stock
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 4 }]);

    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([4]);
  });

  test('an edit limits the quantity with the product quantity as a factor, a creation does not', { tag: ['@ORD-OPL-007', '@ORD-OPL-001'] }, async ({ app, as }) => {
    // CODE-040: on creation the clamp is the stock left; on edit it is the stock left x product.qt
    const { s, e6, scope } = await varSetup();
    await withStock(s, e6.id, 5, { qt: 2 });
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 9 }]);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([5]);
    const [line] = await lines(sub.id);

    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ id: line.id, productId: e6.id, qt: 9 }]);

    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([10]);
  });
});

test.describe('deleting an order line', () => {
  test('a coordinator deletes a line of quantity 0 from the orders page; the subscription total is refreshed', { tag: ['@ORD-ADO-002', '@ORD-OPL-009'] }, async ({ app, as }) => {
    const { s, e6, e12, scope, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }, { productId: e12.id, qty: 1 }] }]);
    const byProduct = async () => Object.fromEntries((await lines(sub.id)).map((l) => [l.productId, l]));
    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ id: (await byProduct())[e12.id].id, productId: e12.id, qt: 0 }]);
    expect(await query('SELECT amount FROM Operation WHERE subscriptionId = ? AND type = 1', [sub.id])).toEqual([{ amount: -4.8 }]);
    await query('UPDATE Operation SET amount = -1 WHERE subscriptionId = ? AND type = 1', [sub.id]); // a stale total, to see it refreshed

    const res = await app.actions.orders.deleteLine(coordinator.request, s.varCatalog.id, dv, (await byProduct())[e12.id].id);

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect((await lines(sub.id)).map((l) => l.productId)).toEqual([e6.id]);
    expect(await query('SELECT amount FROM Operation WHERE subscriptionId = ? AND type = 1', [sub.id])).toEqual([{ amount: -4.8 }]);
  });

  test('a line with a quantity above 0 cannot be deleted by hand', { tag: ['@ORD-OPL-009'] }, async ({ app, as }) => {
    const { s, e6, e12, scope, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }, { productId: e12.id, qty: 1 }] }]);
    const empty = (await lines(sub.id)).find((l) => l.productId === e12.id)!;
    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ id: empty.id, productId: e12.id, qt: 0 }]);
    const kept = (await lines(sub.id)).find((l) => l.productId === e6.id)!; // the page prints its security token next to the empty line only

    const res = await app.actions.orders.deleteLine(coordinator.request, s.varCatalog.id, dv, kept.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/contractAdmin/orders/${s.varCatalog.id}`); // the refusal goes back to the page with no distribution, which hides its message
    expect((await lines(sub.id)).map((l) => [l.productId, l.quantity]).sort()).toEqual([[e6.id, 2], [e12.id, 0]].sort());
  });

  test('a member cannot open the orders page of a catalog', { tag: ['@ORD-ADO-002'] }, async ({ app, as }) => {
    const { s, dv } = await varSetup();
    const member = await as(s.users.member);

    const page = await app.views.orders.distributionOrders(member.request, s.varCatalog.id, dv);

    expect(page.status).toBe(302);
  });

  test('a coordinator sees the baskets of a distribution on the orders page', { tag: ['@ORD-ADO-002'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);

    const page = await app.views.orders.distributionOrders(coordinator.request, s.varCatalog.id, dv);

    expect(page.status).toBe(200);
    expect(page.text).toContain('MEMBRE Martine');
    expect(page.text).toContain('Boîte de 6 œufs');
  });
});

test.describe('order lines in the database and in the API', () => {
  test('a new order carries no fee rate, even when the catalog has a percentage fee (UND-037, characterised)', { tag: ['@ORD-OPL-015'] }, async ({ app, as }) => {
    const { s, e6, scope, dv } = await varSetup();
    await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'PercentageOnOrders'), percentageValue: 10, percentageName: 'Frais' });
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);
    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: s.products.var[1].id, qt: 1 }]);

    const rows = await lines(sub.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((l) => l.feesRate)).toEqual([0, 0]);
  });

  test('the amount of a line includes its fee rate, rounded line by line', { tag: ['@ORD-AMT-002'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    await make.setProduct(e6.id, { price: 1.5 });
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 1 }]);
    await query('UPDATE UserOrder SET feesRate = 11 WHERE subscriptionId = ?', [sub.id]); // an old order with a fee

    const got = await app.api.order.get(coordinator.request, s.users.member.id, scope);
    const [line] = (await lines(sub.id));
    const edit = await app.api.order.updateQuantity(coordinator.request, s.users.member.id, scope, { id: line.id, qt: 1 });

    expect(got.body.orders).toHaveLength(1);
    expect(got.body.orders[0].subTotal).toBe(1.5);
    expect(got.body.orders[0].fees).toBeCloseTo(0.165, 10);
    expect(got.body.orders[0].total).toBe(1.67); // 1.5 x 1.11 = 1.665, rounded up to the cent
    expect(edit.body.basketTotal).toBe('1,67');
    const basket = await queryOne<{ total: number }>('SELECT total FROM Basket WHERE userId = ?', [s.users.member.id]);
    expect(basket!.total).toBe(1.67);
  });

  test('a weight product keeps its quantity in product units; the displayed amount is the quantity times the product quantity', { tag: ['@ORD-OPL-014'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    await make.setProduct(e6.id, { bulk: 1, qt: 0.5, unitType: 1 }); // sold by weight, 0.5 kg a unit
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 2 }]);
    const [line] = await lines(sub.id);

    const edit = await app.api.order.updateQuantity(coordinator.request, s.users.member.id, scope, { id: line.id, qt: 3 });
    const got = await app.api.order.get(coordinator.request, s.users.member.id, scope);

    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([3]); // units, not kilograms
    expect(edit.body.nextQt).toBe('1,50'); // 3 x 0.5 kg
    expect(got.body.orders[0].quantity).toBe(3);
    expect(got.body.orders[0].productQt).toBe(0.5);
    expect(got.body.orders[0].smartQt).toContain('1,5');
  });
});

test.describe('the coordinator searches in the order dialog', () => {
  test('the products of the selected catalog and the members of the group are listed', { tag: ['@ORD-ADO-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);

    const products = await app.api.products.ofCatalog(coordinator.request, s.varCatalog.id);
    const users = await app.api.users.fromGroup(coordinator.request);

    expect(products.status).toBe(200);
    expect(products.body.products.map((p) => p.id).sort()).toEqual(s.products.var.map((p) => p.id).sort());
    expect(users.status).toBe(200);
    expect(users.body.users.map((u) => u.id)).toEqual(expect.arrayContaining([s.users.member.id, s.users.member2.id, s.users.coordinator.id]));
    expect(users.body.users.map((u) => u.id)).not.toContain(s.users.nonMember.id);
  });

  test('the member list is not given to a plain member', { tag: ['@ORD-ADO-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const users = await app.api.users.fromGroup(member.request);

    expect(users.status).toBe(403);
  });
});

test.describe('baskets', () => {
  test('the orders page lists the baskets of a session without the temporary ones', { tag: ['@ORD-BSK-004', '@ORD-ADO-002'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);
    // an old temporary basket of another member, with an order attached
    const tmp = await make.basket({ user: s.users.member2, multiDistrib: s.multiDistribs[1], status: 'OPEN', num: 2 });
    const sub2 = await make.subscription({ user: s.users.member2, catalog: s.varCatalog, startDate: s.multiDistribs[0].distribStartDate, endDate: s.multiDistribs[3].distribEndDate });
    await make.userOrder({ user: s.users.member2, product: e6, distribution: s.distributions[1].var, basket: tmp, subscription: sub2, quantity: 7 });
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);

    const csv = await app.exports.ordersByMember(coordinator.request, s.varCatalog.id, dv);

    expect(csv.status).toBe(200);
    expect(csv.rows.map((r) => [r['Nom'], r['Quantité']])).toEqual([['MEMBRE Martine', '2']]); // the temporary basket of the other member is left out
  });

  test('the total stored on a basket is not refreshed by a subscription order (UND-086, characterised)', { tag: ['@ORD-BSK-005'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);

    const basket = await queryOne<{ total: number }>('SELECT total FROM Basket WHERE userId = ?', [s.users.member.id]);
    expect(basket!.total).toBe(0); // the real total is 4.80, the stored one stays at 0
    expect((await app.api.subscription.get(member.request, sub.id)).body.totalOrdered).toBe(4.8);
  });

  test('no step marks a basket as validated', { tag: ['@ORD-BSK-006'] }, async ({ app, as, clock, cron }) => {
    const { s, e6, scope, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);
    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 1 }]);
    clock.set('+30d'); // the session is long over
    await cron.run('daily');
    await cron.run('hour');

    expect(await query('SELECT status FROM Basket')).toEqual([{ status: 'CONFIRMED' }]);
  });
});
