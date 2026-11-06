/**
 * Recording, editing and deleting payments (specs/06-payments/payment-entry.md,
 * balances.md, operations.md; controller/Transaction.hx, SubscriptionAdmin.hx,
 * service/PaymentService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const today = (clock: { now(): Date }) => make.parisDate(clock.now());
const balanceOf = async (userId: number, groupId: number) =>
  (await queryOne<{ balance: number }>('SELECT balance FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId]))!.balance;
const payments = () =>
  query<{ id: number; name: string; amount: number; pending: number; subscriptionId: number | null; relationId: number | null; data: string | null }>(
    'SELECT id, name, amount, pending, subscriptionId, relationId, data FROM Operation WHERE type = 2 ORDER BY id',
  );

/** A pending debt on a variable-catalog order (hx requires a basket on those). */
async function orderDebt(s: Awaited<ReturnType<typeof make.amapScenario>>, amount: number) {
  const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
  return make.operation({ user: s.users.member, group: s.group, type: 'VOrder', amount, pending: true, basket });
}

async function session(app: any, as: any, s: any, who: 'coordinator' | 'membershipManager' | 'groupAdmin') {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

test.describe('a coordinator records a payment for a member', () => {
  test('with a name, an amount, a date and a type', { tag: ['@PAY-ENT-001'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');

    const res = await app.actions.payments.insert(c.request, s.users.member.id, { name: 'Chèque de rentrée', amount: 50, date: today(clock), type: 'check' });

    expect(res.status).toBe(302);
    const [op] = await payments();
    expect(op).toMatchObject({ name: 'Chèque de rentrée', amount: 50, pending: 0, subscriptionId: null });
    expect(JSON.parse(op.data!)).toMatchObject({ type: 'check' });
  });

  test('a payment that exactly cancels the linked operation settles both', { tag: ['@PAY-ENT-002', '@PAY-ENT-003', '@PAY-OPE-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');
    const debt = await orderDebt(s, -20);

    await app.actions.payments.insert(c.request, s.users.member.id, { amount: 20, date: today(clock), relatedOperationId: debt.id });

    const [pay] = await payments();
    expect(pay).toMatchObject({ relationId: debt.id, pending: 0 });
    expect((await queryOne<{ pending: number }>('SELECT pending FROM Operation WHERE id = ?', [debt.id]))!.pending).toBe(0);
  });

  test('a payment off by a cent leaves the debt pending (no tolerance)', { tag: ['@PAY-ENT-003'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');
    const debt = await orderDebt(s, -20);

    await app.actions.payments.insert(c.request, s.users.member.id, { amount: 19.99, date: today(clock), relatedOperationId: debt.id });

    expect((await queryOne<{ pending: number }>('SELECT pending FROM Operation WHERE id = ?', [debt.id]))!.pending).toBe(1);
    const [pay] = await payments();
    expect(pay.relationId).toBe(debt.id);
  });

  test('a plain member cannot record payments', { tag: ['@PAY-ENT-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.payments.insert(m.request, s.users.member2.id, { amount: 50, date: today(clock) });

    expect(res.status).toBe(302);
    expect(await payments()).toEqual([]);
  });

  test('amounts are rounded to 2 decimals', { tag: ['@PAY-OPE-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');

    await app.actions.payments.insert(c.request, s.users.member.id, { amount: 10.006, date: today(clock) });

    expect((await payments())[0].amount).toBe(10.01);
  });
});

test.describe('a coordinator records a payment on a subscription', () => {
  test('the payment is attached to the subscription and counts in its balance', { tag: ['@PAY-ENT-005', '@ORD-SBM-008', '@PAY-BAL-007', '@ORD-SBM-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id); // total -60

    const res = await app.actions.payments.insertOnSubscription(c.request, sub.id, { name: 'Acompte', amount: 25, date: today(clock), type: 'cash' });

    expect(res.status).toBe(302);
    expect((await payments())[0]).toMatchObject({ amount: 25, subscriptionId: sub.id, pending: 0 });
    const after = await app.api.subscription.get(member.request, sub.id);
    expect(after.body.balance).toBe(-35);
  });

  test('only on a subscription of a catalog the coordinator manages (UND-071)', { tag: ['@PAY-ENT-004', '@ORD-SBM-012'] }, async ({ app, as, clock }) => {
    deviation('UND-071');
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const sub = await make.subscription({ user: s.users.member, catalog: other, startDate: s.multiDistribs[0].distribStartDate, endDate: s.multiDistribs[3].distribEndDate });
    const c = await session(app, as, s, 'coordinator'); // ContractAdmin on the scenario catalogs, not on "Pain"

    await app.actions.payments.insertOnSubscription(c.request, sub.id, { amount: 25, date: today(clock) });

    expect(await payments()).toEqual([]);
  });

  test('mass entry records one payment per row with an amount, and needs a token', { tag: ['@PAY-ENT-006', '@ORD-SBM-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');
    const m1 = await as(s.users.member);
    const m2 = await as(s.users.member2);
    const sub1 = await subscribeConst(app, m1.request, s, s.users.member.id);
    const sub2 = await subscribeConst(app, m2.request, s, s.users.member2.id);

    const noToken = await app.actions.payments.massInsert(c.request, s.constCatalog.id, [{ subscriptionId: sub1.id, amount: 15 }], { token: false });
    expect(noToken.flash).toBeNull();
    expect(await payments()).toEqual([]);

    const res = await app.actions.payments.massInsert(c.request, s.constCatalog.id, [
      { subscriptionId: sub1.id, amount: 15, label: 'Septembre' },
      { subscriptionId: sub2.id, amount: null },
    ]);

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect((await payments()).map((p) => [p.subscriptionId, p.amount, p.name])).toEqual([[sub1.id, 15, 'Septembre']]);
  });
});

test.describe('editing and deleting an operation', () => {
  async function withPayment() {
    const s = await make.amapScenario();
    const member = await make.subscription({
      user: s.users.member,
      catalog: s.constCatalog,
      startDate: s.multiDistribs[0].distribStartDate,
      endDate: s.multiDistribs[3].distribEndDate,
    });
    const op = await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 30, subscription: member, name: 'Chèque', data: { type: 'check' } });
    return { s, op, member };
  }

  test('a membership manager edits the name, amount and date of a payment', { tag: ['@PAY-ENT-007', '@PAY-ENT-009'] }, async ({ app, as, clock }) => {
    const { s, op } = await withPayment();
    const mm = await session(app, as, s, 'membershipManager');

    const res = await app.actions.payments.edit(mm.request, op.id, { name: 'Chèque corrigé', amount: 45, date: today(clock) });

    expect(res.status).toBe(302);
    expect((await payments())[0]).toMatchObject({ name: 'Chèque corrigé', amount: 45 });
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(45);
  });

  test('a membership manager deletes a payment with a security token', { tag: ['@PAY-ENT-008', '@PAY-ENT-009'] }, async ({ app, as }) => {
    // the token is printed on the subscription's payments page, which needs the catalog right as well:
    // the group admin holds both rights.
    const { s, op } = await withPayment();
    const mm = await session(app, as, s, 'groupAdmin');

    await app.actions.payments.delete(mm.request, op.id, { token: false });
    expect(await payments()).toHaveLength(1);

    const res = await app.actions.payments.delete(mm.request, op.id);
    expect(res.status).toBe(302);
    expect(await payments()).toEqual([]);
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(0);
  });

  test('only an admin can delete an order operation', { tag: ['@PAY-ENT-008'] }, async ({ app, as }) => {
    const { s, member } = await withPayment();
    const total = await make.operation({ user: s.users.member, group: s.group, type: 'SubscriptionTotal', amount: -60, subscription: member, data: {} });
    const mm = await session(app, as, s, 'membershipManager');

    await app.actions.payments.delete(mm.request, total.id);

    expect(await query('SELECT id FROM Operation WHERE id = ?', [total.id])).toHaveLength(1);
  });

  test('a payment with no subscription can be edited and deleted without error (UND-090)', { tag: ['@PAY-ENT-010'] }, async ({ app, as, clock, errors }) => {
    deviation('UND-090');
    const s = await make.amapScenario();
    const op = await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 30, data: { type: 'check' } });
    const mm = await session(app, as, s, 'membershipManager');

    const edit = await app.actions.payments.edit(mm.request, op.id, { name: 'Corrigé', amount: 31, date: today(clock) });
    expect(edit.status).toBe(302);
    expect((await payments())[0].amount).toBe(31);
    const del = await app.actions.payments.delete(mm.request, op.id);
    expect(del.status).toBe(302);
    expect(await payments()).toEqual([]);
    void errors;
  });
});

test.describe('balances', () => {
  async function subscriptionOf(s: Awaited<ReturnType<typeof make.amapScenario>>, user: { id: number }) {
    return make.subscription({ user, catalog: s.constCatalog, startDate: s.multiDistribs[0].distribStartDate, endDate: s.multiDistribs[3].distribEndDate });
  }

  test('the balance is the sum of the operations of the subscriptions, rounded to 2 decimals (UND-087)', { tag: ['@PAY-BAL-001', '@PAY-BAL-002', '@PAY-BAL-003'] }, async ({ app, as, clock }) => {
    // Characterised: PaymentService.updateUserBalance sums only the operations attached to a
    // subscription started after 2022. Operations with no subscription do not count.
    const s = await make.amapScenario();
    const sub = await subscriptionOf(s, s.users.member);
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 0.1, subscription: sub });
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 0.2, subscription: sub });
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 99 }); // no subscription: ignored
    const mm = await session(app, as, s, 'membershipManager');

    await app.views.member.payments(mm.request, s.users.member.id); // refreshes the balance
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(0.3); // 0.1 + 0.2, rounded

    const c = await session(app, as, s, 'coordinator');
    await app.actions.payments.insertOnSubscription(c.request, sub.id, { amount: 10, date: today(clock) });
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(10.3); // follows a new payment
  });

  test('a membership manager sees a member\'s operations, newest first, 10 per page', { tag: ['@PAY-BAL-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    for (let i = 1; i <= 12; i++) {
      await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: i, name: `Op${String(i).padStart(2, '0')}`, date: `2026-10-${String(i).padStart(2, '0')} 10:00:00` });
    }
    const mm = await session(app, as, s, 'membershipManager');

    const first = await app.views.member.payments(mm.request, s.users.member.id);
    const second = await app.views.member.payments(mm.request, s.users.member.id, 2);

    expect(first.status).toBe(200);
    expect(first.text).toContain('Op12');
    expect(first.text).not.toContain('Op02');
    expect(first.text.indexOf('Op12')).toBeLessThan(first.text.indexOf('Op11'));
    expect(second.text).toContain('Op02');
    expect(second.text).not.toContain('Op12');
  });

  test('the group\'s members are listed by zero, positive or negative balance', { tag: ['@PAY-BAL-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const subA = await subscriptionOf(s, s.users.member);
    const subB = await subscriptionOf(s, s.users.member2);
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 20, subscription: subA });
    await make.operation({ user: s.users.member2, group: s.group, type: 'SubscriptionTotal', amount: -15, subscription: subB });
    const mm = await session(app, as, s, 'membershipManager');

    const res = await app.views.member.balances(mm.request, { refresh: true });

    expect(res.status).toBe(200);
    expect(res.text).toContain('MEMBRE Martine');
    expect(res.text).toContain('MEMBRE Marc');
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(20);
    expect(await balanceOf(s.users.member2.id, s.group.id)).toBe(-15);
  });

  test('a member sees their balance in their history', { tag: ['@PAY-BAL-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const sub = await subscriptionOf(s, s.users.member);
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 42, subscription: sub });
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.views.history.subscriptionPayments(m.request, sub.id);

    expect(res.text).toMatch(/42/);
  });

  test('every subscription has one total operation named "Total Commandes"', { tag: ['@PAY-OPE-001', '@PAY-OPE-002', '@PAY-OPE-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const sub = await subscribeConst(app, m.request, s, s.users.member.id);

    expect(await query('SELECT name, type, amount FROM Operation WHERE subscriptionId = ?', [sub.id])).toEqual([{ name: 'Total Commandes', type: 1, amount: -60 }]);
    await app.actions.subscription.deleteOwn(m.request, sub.id);
    expect(await query('SELECT id FROM Operation')).toEqual([]);
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(0);
  });
});
