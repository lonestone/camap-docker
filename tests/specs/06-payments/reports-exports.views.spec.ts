/**
 * Coordinator reports and CSV exports (specs/06-payments/reports-exports.md,
 * orders/subscription-admin.md ORD-SBM-006; controller/ContractAdmin.hx, service/ReportService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst, subscribeVar } from '../../src/flows.js';

async function coordinator(app: any, as: any, s: any) {
  const c = await as(s.users.coordinator);
  await app.actions.group.select(c.request, s.group.id);
  return c;
}

test.describe('CSV exports', () => {
  test('subscriptions of the active catalogs, one row each', { tag: ['@PAY-RPT-001', '@ORD-SBM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const sub = await subscribeConst(app, m.request, s, s.users.member.id);
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 25, subscription: sub });
    const c = await coordinator(app, as, s);

    const res = await app.exports.subscriptions(c.request);

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('csv');
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({
      subscriptionId: String(sub.id),
      userName: 'MEMBRE Martine',
      userEmail: 'member@camap.test',
      vendorName: 'Ferme du Test',
      catalogName: 'Légumes (contrat AMAP)',
      totalPrice: '60',
      paymentsTotal: '25',
      balance: '-35',
    });
  });

  test('a member cannot export the subscriptions', { tag: ['@PAY-RPT-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.exports.subscriptions(m.request);

    expect(res.status).toBe(302);
  });

  test('the orders of a distribution per member', { tag: ['@PAY-RPT-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m1 = await as(s.users.member);
    const m2 = await as(s.users.member2);
    await subscribeConst(app, m1.request, s, s.users.member.id, { quantity: 2 });
    await subscribeConst(app, m2.request, s, s.users.member2.id);
    const c = await coordinator(app, as, s);

    const res = await app.exports.ordersByMember(c.request, s.constCatalog.id, s.distributions[0].const.id);

    expect(res.status).toBe(200);
    expect(res.rows.map((r) => [r['Nom'], r['Quantité'], r['total']])).toEqual([
      ['MEMBRE Marc', '1', '15'], // sorted by name
      ['MEMBRE Martine', '2', '30'],
    ]);
  });

  test('the product statistics: quantity, product id, name, price and percentage', { tag: ['@PAY-RPT-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id);
    const c = await coordinator(app, as, s);

    const res = await app.exports.productStats(c.request, s.constCatalog.id);

    expect(res.header).toEqual(['Quantité', 'productId', 'Nom', 'prix TTC', 'Pourcentage']);
    expect(res.rows).toEqual([{ Quantité: '4', productId: String(s.products.const[0].id), Nom: 'Panier de légumes', 'prix TTC': '15', Pourcentage: '100' }]);
  });

  test('the totals per vendor over a period', { tag: ['@PAY-RPT-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id, { quantity: 2 });
    const c = await coordinator(app, as, s);
    const from = make.parisDate(s.multiDistribs[0].distribStartDate);
    const to = make.parisDate(s.multiDistribs[3].distribStartDate);

    const res = await app.exports.vendorTotals(c.request, from, to);

    expect(res.status).toBe(200);
    expect(res.raw).toContain('Panier de légumes');
    expect(res.rows.some((r) => r['quantity'] === '8' || Object.values(r).includes('8'))).toBe(true);
  });
});

test.describe('reports on screen', () => {
  test('the orders of a distribution per product, and the purchase order', { tag: ['@PAY-RPT-005', '@PAY-RPT-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await subscribeConst(app, m.request, s, s.users.member.id, { quantity: 3 });
    const c = await coordinator(app, as, s);
    const d = s.distributions[0].const.id;

    const byProduct = await app.views.reports.ordersByProduct(c.request, s.constCatalog.id, d);
    const purchase = await app.views.reports.purchaseOrder(c.request, s.constCatalog.id, d);

    for (const page of [byProduct, purchase]) {
      expect(page.status).toBe(200);
      expect(page.text).toContain('Panier de légumes');
    }
  });

  test('the orders over a period', { tag: ['@PAY-RPT-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await subscribeVar(app, m.request, s, s.users.member.id);
    await subscribeConst(app, m.request, s, s.users.member.id);
    const c = await coordinator(app, as, s);

    const res = await app.views.reports.ordersByTimeFrame(
      c.request,
      make.parisDate(s.multiDistribs[0].distribStartDate),
      make.parisDate(s.multiDistribs[3].distribStartDate),
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain('Panier de légumes');
  });
});
