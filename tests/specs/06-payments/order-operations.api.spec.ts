/**
 * The debt operation of a variable-catalog basket (specs/06-payments/operations.md PAY-OPE-003;
 * service/PaymentService.hx makeOrderOperation / updateOrderOperation / onOrderConfirm).
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeVar } from '../../src/flows.js';

type Op = { id: number; name: string; amount: number; type: number; pending: number; basketId: number | null; subscriptionId: number | null; userId: number; groupId: number; date: string };
const orderOps = () => query<Op>('SELECT id, name, amount, type, pending, basketId, subscriptionId, userId, groupId, date FROM Operation WHERE type = 0 ORDER BY id');

/** Two members ordered at the first session of the variable catalog; the coordinator of every catalog is logged in. */
async function ordered(app: any, as: any) {
  const s = await make.amapScenario();
  const [e6, e12] = s.products.var;
  const d = s.distributions[0].var.id;
  const m1 = await as(s.users.member);
  const m2 = await as(s.users.member2);
  const sub1 = await subscribeVar(app, m1.request, s, s.users.member.id);
  const sub2 = await subscribeVar(app, m2.request, s, s.users.member2.id);
  await app.api.subscription.updateOrders(m1.request, sub1.id, [{ id: d, orders: [{ productId: e6.id, qty: 2 }, { productId: e12.id, qty: 1 }] }]);
  await app.api.subscription.updateOrders(m2.request, sub2.id, [{ id: d, orders: [{ productId: e6.id, qty: 1 }] }]);
  const a = await as(s.users.groupAdmin);
  await app.actions.group.select(a.request, s.group.id);
  return { s, e6, e12, d, a, sub1, sub2 };
}

// hx writes the debt of a basket (PaymentService.onOrderConfirm) only when the session's orders are
// changed by the coordinator: a price change or the removal of a product (Distribution.hx:1092,1138).
// Ordering through the subscription does not write it (the subscription total, type 1, is kept instead).
test.describe('the order of a session on a variable catalog creates a debt (PAY-OPE-003)', () => {
  test('ordering through the subscription writes the subscription total, not a basket debt', { tag: ['@PAY-OPE-003'] }, async ({ app, as }) => {
    const { sub1 } = await ordered(app, as);

    expect(await orderOps()).toEqual([]);
    expect(await query('SELECT amount FROM Operation WHERE subscriptionId = ? AND type = 1', [sub1.id])).toEqual([{ amount: -9.3 }]);
  });

  test('one operation "Order for <date>" per basket, the negative sum of its lines', { tag: ['@PAY-OPE-003'] }, async ({ app, as }) => {
    const { s, e6, a } = await ordered(app, as);

    await app.actions.sessions.changePrice(a.request, s.multiDistribs[0].id, e6.id, 3);

    const ops = await orderOps();
    expect(ops.map((o) => [o.userId, o.amount])).toEqual([
      [s.users.member.id, -10.5], // 2 x 3 + 1 x 4.5
      [s.users.member2.id, -3],
    ]);
    for (const op of ops) {
      expect(op).toMatchObject({ pending: 0, subscriptionId: null, groupId: s.group.id });
      expect(op.name).toMatch(/^(Order for|Commande du) /);
    }
    const baskets = await query<{ id: number; userId: number; multiDistribId: number }>('SELECT id, userId, multiDistribId FROM Basket ORDER BY userId');
    expect(baskets.map((b) => b.multiDistribId)).toEqual([s.multiDistribs[0].id, s.multiDistribs[0].id]);
    expect(ops.map((o) => o.basketId)).toEqual(baskets.map((b) => b.id));
  });

  test('the operation of a basket is updated, not duplicated, when its lines change again', { tag: ['@PAY-OPE-003'] }, async ({ app, as }) => {
    const { s, e6, e12, a } = await ordered(app, as);
    await app.actions.sessions.changePrice(a.request, s.multiDistribs[0].id, e6.id, 3);
    await query('UPDATE UserOrder SET feesRate = 10 WHERE productId = ? AND userId = ?', [e6.id, s.users.member.id]); // a line that carries a fee

    await app.actions.sessions.changePrice(a.request, s.multiDistribs[0].id, e12.id, 5);

    const ops = await orderOps();
    expect(ops).toHaveLength(2);
    expect(ops[0].amount).toBe(-(6.6 + 5)); // 2 x 3 + 10 %, plus 1 x 5, each line rounded
  });

  test('the debt is listed with the operations of the member', { tag: ['@PAY-OPE-003'] }, async ({ app, as }) => {
    const { s, e6, a } = await ordered(app, as);
    await app.actions.sessions.changePrice(a.request, s.multiDistribs[0].id, e6.id, 3);
    const [op] = await orderOps();

    const page = await app.views.member.payments(a.request, s.users.member.id);

    expect(page.status).toBe(200);
    expect(page.text).toContain(op.name);
    expect(page.text).toMatch(/10,5/);
  });
});
