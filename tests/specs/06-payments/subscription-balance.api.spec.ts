/**
 * The balance of a subscription on every screen (specs/06-payments/balances.md PAY-BAL-008, PAY-BAL-007;
 * db/Subscription.hx getBalance, camap-ts csa-subscriptions.resolver.ts balance).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

/** The member subscribed (orders 60) and paid 0.1 + 0.2; the stored total operation is stale (-50): fees and the total operation do not count. */
async function arranged(app: any, as: any) {
  const s = await make.amapScenario();
  const m = await as(s.users.member);
  const sub = await subscribeConst(app, m.request, s, s.users.member.id);
  await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 0.1, subscription: sub });
  await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 0.2, subscription: sub });
  await query('UPDATE Operation SET amount = -50 WHERE subscriptionId = ? AND type = 1', [sub.id]);
  const c = await as(s.users.coordinator);
  await app.actions.group.select(c.request, s.group.id);
  return { s, sub, m, c };
}

test.describe('every screen shows the same subscription balance', () => {
  test('the JSON api, the CSV export and the history page: payments minus the order total, rounded to cents', { tag: ['@PAY-BAL-008', '@PAY-BAL-007'] }, async ({ app, as }) => {
    const { s, sub, m, c } = await arranged(app, as);

    const api = await app.api.subscription.get(m.request, sub.id);
    const csv = await app.exports.subscriptions(c.request);
    await app.actions.group.select(m.request, s.group.id);
    const history = await app.views.history.subscriptionPayments(m.request, sub.id);

    expect(api.body.balance).toBe(-59.7);
    expect(csv.rows[0]).toMatchObject({ paymentsTotal: '0,30', balance: '-59,70' });
    expect(history.text).toMatch(/Solde -59,70 €/);
  });

  test('the balance of the attendance sheet comes from the same formula', { tag: ['@PAY-BAL-008'] }, async ({ app, as }) => {
    deviation('UND-088');
    const { s, sub, c } = await arranged(app, as);

    const res = await app.graphql<{ attendanceClassicContract: { subscriptions: { id: number; balance: number }[] } }>(
      c.request,
      'query($catalogId: Int!) { attendanceClassicContract(catalogId: $catalogId) { subscriptions { id balance } } }',
      { catalogId: s.constCatalog.id },
    );

    expect(res.errors).toBeNull();
    // TS sums every operation of the subscription (the stale total -50 included) without rounding
    expect(res.data!.attendanceClassicContract.subscriptions.find((x) => x.id === sub.id)!.balance).toBe(-59.7);
  });
});
