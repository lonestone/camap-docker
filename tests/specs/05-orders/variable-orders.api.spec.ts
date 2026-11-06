/**
 * Variable-orders catalogs: ordering per distribution, default order, default-order job
 * (specs/05-orders/variable-orders.md, order-placement.md; api/Subscription.hx,
 * service/OrderService.hx, controller/Cron.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeVar } from '../../src/flows.js';

const ordersOf = (subId: number) =>
  query<{ distributionId: number; productId: number; quantity: number; productPrice: number }>(
    'SELECT distributionId, productId, quantity, productPrice FROM UserOrder WHERE subscriptionId = ? ORDER BY distributionId, productId',
    [subId],
  );

test.describe('ordering in a variable catalog', () => {
  test('a member orders per distribution; each order joins the basket of the session', { tag: ['@ORD-VAR-001', '@ORD-OPL-001', '@ORD-OPL-006', '@ORD-OPL-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [e6, e12] = s.products.var;
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    const d1 = s.distributions[1].var.id;

    const res = await app.api.subscription.updateOrders(member.request, sub.id, [
      { id: d1, orders: [{ productId: e6.id, qty: 2 }, { productId: e12.id, qty: 1 }] },
    ]);

    expect(res.status).toBe(200);
    expect(await ordersOf(sub.id)).toEqual([
      { distributionId: d1, productId: e6.id, quantity: 2, productPrice: 2.4 },
      { distributionId: d1, productId: e12.id, quantity: 1, productPrice: 4.5 },
    ]);
    const baskets = await query<{ id: number; multiDistribId: number; userId: number; num: number; status: string }>('SELECT id, multiDistribId, userId, num, status FROM Basket');
    expect(baskets).toEqual([{ id: baskets[0].id, multiDistribId: s.multiDistribs[1].id, userId: s.users.member.id, num: 1, status: 'CONFIRMED' }]);
    const lines = await query<{ basketId: number }>('SELECT basketId FROM UserOrder WHERE subscriptionId = ?', [sub.id]);
    expect(lines.every((l) => l.basketId === baskets[0].id)).toBe(true);
    expect(res.body.totalOrdered).toBe(9.3);
  });

  test('a variable catalog without minimum has no default order', { tag: ['@ORD-VAR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [e6] = s.products.var;
    const member = await as(s.users.member);

    const sub = await subscribeVar(app, member.request, s, s.users.member.id, {
      defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 3 }],
    });

    expect(sub.defaultOrder).toEqual([]);
    expect(await query('SELECT id FROM UserOrder')).toEqual([]);
  });

  test('a default order is applied to the distributions of the subscription', { tag: ['@ORD-VAR-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 5 });
    const [e6] = s.products.var;
    const member = await as(s.users.member);

    const sub = await subscribeVar(app, member.request, s, s.users.member.id, {
      defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 3 }],
    });

    expect(sub.defaultOrder).toEqual([expect.objectContaining({ productId: e6.id, quantity: 3 })]);
    const orders = await ordersOf(sub.id);
    expect(orders.map((o) => o.distributionId)).toEqual(s.distributions.map((d) => d.var.id));
    expect(orders.every((o) => o.quantity === 3)).toBe(true);
  });
});

test.describe('default-order job (hourly)', () => {
  async function arrange() {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 5 });
    return s;
  }
  const closeOf = (s: Awaited<ReturnType<typeof arrange>>, i: number) => s.distributions[i].var.orderEndDate;

  test('a subscriber who placed no order gets the default order when the window just closed', { tag: ['@ORD-VAR-005', '@COM-DGT-003'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await arrange();
    const [e6] = s.products.var;
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id, { defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 3 }] });
    const d0 = s.distributions[0].var.id;
    const mark = await mails.mark();
    await query('DELETE FROM UserOrder WHERE subscriptionId = ? AND distributionId = ?', [sub.id, d0]); // the member removed their order for d0

    clock.set(new Date(closeOf(s, 0).getTime() + 90 * 60 * 1000)); // the hour after the window closed
    await cron.run('hour');

    const orders = await ordersOf(sub.id);
    expect(orders.filter((o) => o.distributionId === d0)).toEqual([{ distributionId: d0, productId: e6.id, quantity: 3, productPrice: 2.4 }]);
    // the member is told by the digest sent in the same run
    const told = await mails.to(s.users.member.email, mark);
    expect(told.some((m) => /par défaut a été appliquée/.test(m.htmlBody ?? ''))).toBe(true);
  });

  test('a subscriber who already has an order is left alone', { tag: ['@ORD-VAR-005'] }, async ({ app, as, clock, cron }) => {
    const s = await arrange();
    const [e6] = s.products.var;
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id, { defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 3 }] });
    const d0 = s.distributions[0].var.id;
    await query('UPDATE UserOrder SET quantity = 7 WHERE subscriptionId = ? AND distributionId = ?', [sub.id, d0]);

    clock.set(new Date(closeOf(s, 0).getTime() + 90 * 60 * 1000));
    await cron.run('hour');

    expect((await ordersOf(sub.id)).filter((o) => o.distributionId === d0)).toEqual([{ distributionId: d0, productId: e6.id, quantity: 7, productPrice: 2.4 }]);
    expect(await query('SELECT id FROM NotificationMail WHERE subject LIKE ?', ['DEFAULT_ORDER%'])).toEqual([]);
  });

  test('one failing subscription does not stop the others (UND-082)', { tag: ['@ORD-VAR-006'] }, async ({ app, as, clock, cron }) => {
    deviation('UND-082');
    const s = await arrange();
    const [e6] = s.products.var;
    const m1 = await as(s.users.member);
    const m2 = await as(s.users.member2);
    const sub1 = await subscribeVar(app, m1.request, s, s.users.member.id, { defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 3 }] });
    const sub2 = await subscribeVar(app, m2.request, s, s.users.member2.id, { defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 3 }] });
    const d0 = s.distributions[0].var.id;
    await query('DELETE FROM UserOrder WHERE distributionId = ?', [d0]);
    // make the first subscription fail: corrupt its default orders
    await query('UPDATE Subscription SET defaultOrders = ? WHERE id = ?', ['not json', sub1.id]);

    clock.set(new Date(closeOf(s, 0).getTime() + 90 * 60 * 1000));
    await cron.run('hour');

    expect((await ordersOf(sub2.id)).filter((o) => o.distributionId === d0)).toHaveLength(1);
  });
});
