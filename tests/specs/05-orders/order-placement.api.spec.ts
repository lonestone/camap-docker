/**
 * Placing and editing orders (specs/05-orders/order-placement.md, constant-orders.md,
 * order-amounts.md, admin-orders.md; controller/api/Order.hx, api/Subscription.hx,
 * service/OrderService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst, subscribeVar } from '../../src/flows.js';

const lines = (subId: number) =>
  query<{ id: number; distributionId: number; productId: number; quantity: number; paid: number }>(
    'SELECT id, distributionId, productId, quantity, paid FROM UserOrder WHERE subscriptionId = ? ORDER BY distributionId, id',
    [subId],
  );

async function varSetup() {
  const s = await make.amapScenario();
  const [e6, e12] = s.products.var;
  const scope = { multiDistribId: s.multiDistribs[1].id, catalogId: s.varCatalog.id };
  return { s, e6, e12, scope, dv: s.distributions[1].var.id };
}

test.describe('placing an order', () => {
  test('a decimal quantity is refused for a product that is not sold by weight', { tag: ['@ORD-OPL-002'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 1.5 }] }]);

    expect(res.status).toBe(500);
    expect(await lines(sub.id)).toEqual([]);
  });

  test('a decimal quantity is accepted for a bulk or variable-price product', { tag: ['@ORD-OPL-002'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    await make.setProduct(e6.id, { bulk: 1 });
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 1.5 }] }]);

    expect(res.status).toBe(200);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([1.5]);
  });

  test('a multi-weight product is ordered as N lines of quantity 1, with a whole quantity', { tag: ['@ORD-OPL-003'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    await make.setProduct(e6.id, { multiWeight: 1 });
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);

    const decimal = await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 1.5 }]);
    expect(decimal.status).toBe(500);
    expect(await lines(sub.id)).toEqual([]);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 3 }]);
    expect(res.status).toBe(200);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([1, 1, 1]);
  });

  test('ordering the same product at the same distribution again adds to the existing line', { tag: ['@ORD-OPL-004'] }, async ({ app, as }) => {
    const { s, e6, scope, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 1 }]);

    expect(res.status).toBe(200);
    expect((await lines(sub.id)).map((l) => [l.productId, l.quantity])).toEqual([[e6.id, 3]]);
  });

  test('an order needs a subscription', { tag: ['@ORD-OPL-005', '@ORD-ADO-005'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ productId: e6.id, qt: 1 }]);

    expect(res.status).toBe(500);
    expect(await query('SELECT id FROM UserOrder')).toEqual([]);
  });

  test('the quantity of an order line can be edited', { tag: ['@ORD-OPL-008', '@ORD-ADO-003'] }, async ({ app, as }) => {
    const { s, e6, scope, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);
    const [line] = await lines(sub.id);

    const res = await app.api.order.updateQuantity(coordinator.request, s.users.member.id, scope, { id: line.id, qt: 5 });

    expect(res.status).toBe(200);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([5]);
  });

  test('the sub-total shown after an inline edit uses the price saved with the order (UND-075)', { tag: ['@ORD-ADO-004', '@ORD-AMT-001'] }, async ({ app, as }) => {
    deviation('UND-075');
    const { s, e6, scope, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);
    const [line] = await lines(sub.id);
    await make.setProduct(e6.id, { price: 3 }); // the vendor raised the price afterwards

    const res = await app.api.order.updateQuantity(coordinator.request, s.users.member.id, scope, { id: line.id, qt: 5 });

    expect(Number(String((res.body as any).subTotal).replace(',', '.'))).toBe(12); // 5 x 2.40 saved, not 5 x 3
  });

  test('a subscription total follows the saved price, rounded to cents', { tag: ['@ORD-AMT-001'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 3 }] }]);
    await make.setProduct(e6.id, { price: 10 }); // later price change leaves the saved price alone

    const res = await app.api.subscription.get(member.request, sub.id);

    expect(res.body.totalOrdered).toBe(7.2);
  });
});

test.describe('order window and paid mark', () => {
  test('the API does not enforce the order window for a member (UND-073, characterised)', { tag: ['@ORD-OPL-010'] }, async ({ app, as, clock }) => {
    const { s, e6 } = await varSetup();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    clock.set('+7d'); // the window of the first distribution (closes the day before) is now closed

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: s.distributions[0].var.id, orders: [{ productId: e6.id, qty: 1 }] }]);

    expect(res.status).toBe(200);
    expect(await lines(sub.id)).toHaveLength(1);
  });

  test('a coordinator sets the paid mark; a later quantity edit resets it (characterised)', { tag: ['@ORD-AMT-006', '@ORD-ADO-005'] }, async ({ app, as }) => {
    const { s, e6, scope, dv } = await varSetup();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 2 }] }]);
    const [line] = await lines(sub.id);

    await app.api.order.update(coordinator.request, s.users.member.id, scope, [{ id: line.id, productId: e6.id, qt: 2, paid: true }]);
    expect((await lines(sub.id)).map((l) => l.paid)).toEqual([1]);

    const edit = await app.api.order.updateQuantity(coordinator.request, s.users.member.id, scope, { id: line.id, qt: 5 });
    expect(edit.status).toBe(200); // not blocked: the line changes and loses its paid mark
    expect((await lines(sub.id)).map((l) => [l.quantity, l.paid])).toEqual([[5, 0]]);
  });
});

test.describe('who can update orders', () => {
  test('only coordinators of the catalog (or of all catalogs) read and update the orders of a member', { tag: ['@ORD-ADO-007'] }, async ({ app, as }) => {
    const { s, e6, scope } = await varSetup();
    const otherCatalog = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const otherScope = { multiDistribId: scope.multiDistribId, catalogId: otherCatalog.id };
    const coordinator = await as(s.users.coordinator); // ContractAdmin on the two scenario catalogs only
    const admin = await as(s.users.groupAdmin); // ContractAdmin on all catalogs
    const member = await as(s.users.member);
    const uid = s.users.member.id;

    expect((await app.api.order.get(coordinator.request, uid, scope)).status).toBe(200);
    expect((await app.api.order.get(coordinator.request, uid, otherScope)).status).toBe(403);
    expect((await app.api.order.get(admin.request, uid, otherScope)).status).toBe(200);
    expect((await app.api.order.get(member.request, uid, scope)).status).toBe(403);
    expect((await app.api.order.update(member.request, uid, scope, [{ productId: e6.id, qt: 1 }])).status).toBe(403);
    expect((await app.api.order.update(coordinator.request, uid, otherScope, [{ productId: e6.id, qt: 1 }])).status).toBe(403);
  });

  test('the catalogs open for a session are listed, without catalogs of disabled vendors', { tag: ['@ORD-ADO-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.vendor({ name: 'Ferme bannie' });
    const banned = await make.catalog({ group: s.group, vendor: other, name: 'Banni', type: 'VariableOrders' });
    await make.distribution({ catalog: banned, multiDistrib: s.multiDistribs[0] });
    await query('UPDATE Vendor SET disabled = 1 WHERE id = ?', [other.id]);
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.order.catalogs(coordinator.request, s.multiDistribs[0].id);

    expect(res.status).toBe(200);
    expect(res.body.catalogs.map((c) => c.name).sort()).toEqual(['Légumes (contrat AMAP)', 'Œufs (contrat variable)']);
  });

  test('the catalog list answers a visitor with no login (CODE-016, characterised)', { tag: ['@ORD-ADO-008'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.order.catalogs(anon.request, s.multiDistribs[0].id);

    expect(res.status).toBe(200);
  });

  test('only the owner, a coordinator or an admin updates a default order', { tag: ['@ORD-OPL-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = s.products.const[0];
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    const line = [{ productId: p.id, productPrice: p.price, quantity: 2 }];
    const put = async (who: Parameters<typeof as>[0]) => (await app.api.subscription.updateDefaultOrder((await as(who)).request, sub.id, line)).status;

    expect(await put(s.users.member2)).toBe(403);
    expect(await put(s.users.member)).toBe(200);
    expect(await put(s.users.coordinator)).toBe(200);
    expect(await put(s.users.groupAdmin)).toBe(200);
  });
});

test.describe('constant orders', () => {
  test('the default order is the order at every distribution of the subscription', { tag: ['@ORD-CST-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { quantity: 2 });

    expect((await lines(sub.id)).map((l) => [l.distributionId, l.quantity])).toEqual(s.distributions.map((d) => [d.const.id, 2]));
  });

  test('a member changes the default order while there are no past orders, not after', { tag: ['@ORD-CST-002'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const p = s.products.const[0];
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    const line = (quantity: number) => [{ productId: p.id, productPrice: p.price, quantity }];

    const before = await app.api.subscription.updateDefaultOrder(member.request, sub.id, line(2));
    expect(before.status).toBe(200);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([2, 2, 2, 2]);

    clock.set('+8d'); // the first distribution has been held with an order
    const after = await app.api.subscription.updateDefaultOrder(member.request, sub.id, line(3));
    expect(after.status).toBeGreaterThanOrEqual(400);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([2, 2, 2, 2]);

    const byCoordinator = await app.api.subscription.updateDefaultOrder((await as(s.users.coordinator)).request, sub.id, line(3));
    expect(byCoordinator.status).toBe(200);
  });

  test('a second person is recorded on every line of a shared basket (alternation itself not asserted)', { tag: [] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = s.products.const[0];
    const member = await as(s.users.member);

    const sub = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.constCatalog.id,
      defaultOrder: [{ productId: p.id, productPrice: p.price, quantity: 1, userId2: s.users.member2.id, invertSharedOrder: false }],
      absentDistribIds: [],
      initialOrders: [],
    });

    expect(sub.status).toBe(200);
    expect(sub.body.user2?.id).toBe(s.users.member2.id);
    const rows = await query<{ userId2: number; flags: number }>('SELECT userId2, flags FROM UserOrder WHERE subscriptionId = ?', [sub.body.id]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.userId2 === s.users.member2.id)).toBe(true);
  });

  test('a member orders from a constant catalog only while it accepts user orders', { tag: ['@ORD-CST-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = s.products.const[0];
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    await query('UPDATE Catalog SET flags = 0 WHERE id = ?', [s.constCatalog.id]);

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [
      { id: s.distributions[1].const.id, orders: [{ productId: p.id, qty: 5 }] },
    ]);

    expect(res.status).toBe(500);
    expect((await lines(sub.id)).map((l) => l.quantity)).toEqual([1, 1, 1, 1]);
  });
});

test.describe('amounts and balance', () => {
  test('the balance is the payments minus the total, and the total operation is rewritten only when it changes', { tag: ['@ORD-AMT-003', '@ORD-AMT-004'] }, async ({ app, as }) => {
    const { s, e6, dv } = await varSetup();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    const orders = (qty: number) => [{ id: dv, orders: [{ productId: e6.id, qty }] }];
    await app.api.subscription.updateOrders(member.request, sub.id, orders(2));
    const op1 = await queryOne<{ id: number; amount: number; date: string }>('SELECT id, amount, date FROM Operation WHERE type = 1');
    expect(op1!.amount).toBe(-4.8);
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 3, subscription: sub });

    const same = await app.api.subscription.updateOrders(member.request, sub.id, orders(2));
    const op2 = await queryOne<{ id: number; amount: number; date: string }>('SELECT id, amount, date FROM Operation WHERE type = 1');
    expect(op2).toEqual(op1); // unchanged amount: not rewritten
    expect(same.body.balance).toBe(-1.8); // 3 - 4.8

    const more = await app.api.subscription.updateOrders(member.request, sub.id, orders(3));
    const totals = await query<{ amount: number }>('SELECT amount FROM Operation WHERE type = 1');
    expect(totals).toEqual([{ amount: -7.2 }]);
    expect(more.body.balance).toBe(-4.2);
  });

  test('the order line carries the price of the product at the time it was ordered', { tag: ['@ORD-AMT-005', '@ORD-OPL-001'] }, async ({ app, as }) => {
    // UND-079 undecided: characterised. The line keeps the price saved at creation.
    const { s, e6, dv } = await varSetup();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 1 }] }]);
    await make.setProduct(e6.id, { price: 9 });

    const [row] = await query<{ productPrice: number }>('SELECT productPrice FROM UserOrder WHERE subscriptionId = ?', [sub.id]);
    expect(row.productPrice).toBe(2.4);
  });
});
