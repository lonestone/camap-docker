/**
 * Order history pages and baskets (specs/05-orders/order-history.md, baskets.md;
 * controller/History.hx, db/Basket.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst, subscribeVar } from '../../src/flows.js';

async function setup(app: any, as: any) {
  const s = await make.amapScenario();
  const member = await as(s.users.member);
  await app.actions.group.select(member.request, s.group.id);
  const sub = await subscribeConst(app, member.request, s, s.users.member.id);
  const [basket] = await query<{ id: number }>('SELECT id FROM Basket WHERE userId = ? ORDER BY id', [s.users.member.id]);
  return { s, member, sub, basket };
}

test.describe('order history', () => {
  test('a member opens their history page', { tag: ['@ORD-HIS-001'] }, async ({ app, as }) => {
    const { s, member } = await setup(app, as);

    const res = await app.views.history.home(member.request);

    expect(res.status).toBe(200);
    expect(res.text).toContain(s.constCatalog.name);
  });

  test('a member sees the products of one of their baskets', { tag: ['@ORD-HIS-002'] }, async ({ app, as }) => {
    const { member, basket } = await setup(app, as);

    const res = await app.views.history.basket(member.request, basket.id);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Panier de légumes');
  });

  test('a member sees their orders of a catalog and of a subscription', { tag: ['@ORD-HIS-003', '@ORD-HIS-004'] }, async ({ app, as }) => {
    const { member, s, sub } = await setup(app, as);

    const byCatalog = await app.views.history.catalogOrders(member.request, s.constCatalog.id);
    const bySub = await app.views.history.subscriptionOrders(member.request, sub.id);
    const payments = await app.views.history.subscriptionPayments(member.request, sub.id);

    for (const page of [byCatalog, bySub]) {
      expect(page.status).toBe(200);
      expect(page.text).toContain('Panier de légumes');
    }
    expect(payments.status).toBe(200);
  });

  test('the history pages of another member are refused (UND-069)', { tag: ['@ORD-HIS-002', '@ORD-HIS-005'] }, async ({ app, as }) => {
    deviation('UND-069');
    const { s, sub, basket } = await setup(app, as);
    const other = await as(s.users.member2);
    await app.actions.group.select(other.request, s.group.id);

    const pages = [
      await app.views.history.basket(other.request, basket.id),
      await app.views.history.subscriptionOrders(other.request, sub.id),
      await app.views.history.subscriptionPayments(other.request, sub.id),
    ];

    for (const page of pages) expect([302, 403]).toContain(page.status);
  });

  test('opening the payments page changes nothing (UND-069)', { tag: ['@ORD-HIS-006'] }, async ({ app, as }) => {
    deviation('UND-069');
    const { member, sub } = await setup(app, as);
    await query('UPDATE Operation SET amount = -1 WHERE subscriptionId = ? AND type = 1', [sub.id]); // a stale total
    const before = await query('SELECT * FROM Operation ORDER BY id');

    await app.views.history.subscriptionPayments(member.request, sub.id);

    expect(await query('SELECT * FROM Operation ORDER BY id')).toEqual(before);
  });

  test('a visitor is sent to the login page', { tag: ['@ORD-HIS-001'] }, async ({ app, anon }) => {
    const res = await app.views.history.home(anon.request);

    expect(res.status).toBe(302);
  });
});

test.describe('baskets', () => {
  test('there is one basket per member and distribution session, numbered in sequence', { tag: ['@ORD-BSK-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m1 = await as(s.users.member);
    const m2 = await as(s.users.member2);

    await subscribeConst(app, m1.request, s, s.users.member.id);
    await subscribeConst(app, m2.request, s, s.users.member2.id);

    const baskets = await query<{ userId: number; multiDistribId: number; num: number }>('SELECT userId, multiDistribId, num FROM Basket ORDER BY multiDistribId, num');
    expect(baskets).toHaveLength(8); // 2 members x 4 sessions
    for (const md of s.multiDistribs) {
      expect(baskets.filter((b) => b.multiDistribId === md.id).map((b) => [b.userId, b.num])).toEqual([
        [s.users.member.id, 1],
        [s.users.member2.id, 2],
      ]);
    }
  });

  test('ordering again for the same session reuses the existing basket', { tag: ['@ORD-BSK-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [e6, e12] = s.products.var;
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    const dv = s.distributions[1].var.id;

    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 1 }] }]);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dv, orders: [{ productId: e6.id, qty: 1 }, { productId: e12.id, qty: 1 }] }]);

    expect(await query('SELECT id FROM Basket')).toHaveLength(1);
  });

  test('a basket still OPEN is reused and switched to CONFIRMED (UND-076)', { tag: ['@ORD-BSK-001', '@ORD-BSK-002'] }, async ({ app, as }) => {
    deviation('UND-076');
    const s = await make.amapScenario();
    const [e6] = s.products.var;
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[1], status: 'OPEN' });

    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: s.distributions[1].var.id, orders: [{ productId: e6.id, qty: 1 }] }]);

    const baskets = await query<{ status: string }>('SELECT status FROM Basket');
    expect(baskets).toEqual([{ status: 'CONFIRMED' }]);
  });
});
