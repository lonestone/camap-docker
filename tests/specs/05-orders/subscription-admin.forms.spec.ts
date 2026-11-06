/**
 * Subscription management by coordinators (specs/05-orders/subscription-admin.md,
 * subscription-create.md ORD-SUB-004, balance-transfer.md; controller/SubscriptionAdmin.hx,
 * controller/Subscriptions.hx). These are hx form posts; the target driver owns the field names.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst, subscribeVar } from '../../src/flows.js';

const ymd = (d: Date) => make.parisDate(d);
const subs = () => query<{ id: number; userId: number; userId2: number | null; startDate: string; endDate: string }>('SELECT id, userId, userId2, startDate, endDate FROM Subscription ORDER BY id');

async function coordinatorSession(app: any, as: any, s: any) {
  const c = await as(s.users.coordinator);
  await app.actions.group.select(c.request, s.group.id);
  return c;
}

test.describe('a coordinator creates a subscription', () => {
  test('with a start date, an end date, default orders and a second person', { tag: ['@ORD-SBM-002', '@ORD-SBM-013', '@ORD-SUB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const p = s.products.const[0];

    const res = await app.actions.subscriptionAdmin.create(c.request, s.constCatalog.id, {
      userId: s.users.member.id,
      startDate: ymd(s.multiDistribs[1].distribStartDate),
      endDate: ymd(s.multiDistribs[2].distribStartDate),
      quantities: { [p.id]: 2 },
      user2: { [p.id]: s.users.member2.id },
      invert: { [p.id]: true },
    });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    const [row] = await subs();
    expect(row.userId).toBe(s.users.member.id);
    expect(row.userId2).toBe(s.users.member2.id);
    // from the first second of the start day to the last second of the end day
    expect(row.startDate).toBe(`${ymd(s.multiDistribs[1].distribStartDate)} 00:00:00`);
    expect(row.endDate).toBe(`${ymd(s.multiDistribs[2].distribStartDate)} 23:59:59`);
    const orders = await query<{ distributionId: number; quantity: number; userId2: number; flags: number }>('SELECT distributionId, quantity, userId2, flags FROM UserOrder ORDER BY distributionId');
    expect(orders.map((o) => [o.distributionId, o.quantity])).toEqual([
      [s.distributions[1].const.id, 2],
      [s.distributions[2].const.id, 2],
    ]);
    expect(orders.every((o) => o.userId2 === s.users.member2.id && o.flags !== 0)).toBe(true); // InvertSharedOrder set
  });

  test('the start is before the end and both are inside the catalog dates', { tag: ['@ORD-SUB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const p = s.products.const[0];
    const create = (startDate: string, endDate: string) =>
      app.actions.subscriptionAdmin.create(c.request, s.constCatalog.id, { userId: s.users.member.id, startDate, endDate, quantities: { [p.id]: 1 } });
    const d1 = ymd(s.multiDistribs[1].distribStartDate);
    const d2 = ymd(s.multiDistribs[2].distribStartDate);

    expect((await create(d2, d1)).flash?.kind).toBe('error'); // start after end
    expect((await create('2000-01-01', d1)).flash?.kind).toBe('error'); // before the catalog starts
    expect((await create(d1, '2100-01-01')).flash?.kind).toBe('error'); // after the catalog ends
    expect(await subs()).toEqual([]);
  });

  test('an admin can start before the next open distribution', { tag: ['@ORD-SUB-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const p = s.products.const[0];
    clock.set('+8d'); // distribution 0 is past, distribution 1 is open

    const res = await app.actions.subscriptionAdmin.create(c.request, s.constCatalog.id, {
      userId: s.users.member.id,
      startDate: ymd(s.multiDistribs[0].distribStartDate), // earlier than the next open distribution
      endDate: ymd(s.multiDistribs[3].distribStartDate),
      quantities: { [p.id]: 1 },
    });

    expect(res.flash?.kind).toBe('ok');
    expect(await subs()).toHaveLength(1);
  });

  test('only a coordinator of the catalog can create, list or delete subscriptions', { tag: ['@ORD-SBM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);
    const p = s.products.const[0];

    const list = await app.actions.subscriptionAdmin.list(member.request, s.constCatalog.id);
    const create = await app.actions.subscriptionAdmin.create(
      member.request,
      s.constCatalog.id,
      { userId: s.users.member.id, startDate: ymd(s.multiDistribs[0].distribStartDate), endDate: ymd(s.multiDistribs[3].distribStartDate), quantities: { [p.id]: 1 } },
      { token: false },
    ).catch(() => null);

    expect(list.status).toBe(302);
    expect(create === null || create.status === 302).toBe(true);
    expect(await subs()).toEqual([]);
  });

  test('the list is sorted by member name', { tag: ['@ORD-SBM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const mk = (u: { id: number }) =>
      make.subscription({ user: u, catalog: s.constCatalog, startDate: s.multiDistribs[0].distribStartDate, endDate: s.multiDistribs[3].distribEndDate });
    await mk(s.users.member2); // MEMBRE Marc
    await mk(s.users.member); // MEMBRE Martine
    await mk(s.users.groupAdmin); // ADMIN Gaston

    const res = await app.actions.subscriptionAdmin.list(c.request, s.constCatalog.id);

    expect(res.status).toBe(200);
    const at = (name: string) => res.body.indexOf(name);
    expect(at('ADMIN Gaston')).toBeGreaterThan(-1);
    expect(at('ADMIN Gaston')).toBeLessThan(at('MEMBRE Marc'));
    expect(at('MEMBRE Marc')).toBeLessThan(at('MEMBRE Martine'));
  });
});

test.describe('a coordinator edits a subscription', () => {
  test('both dates are required and the rules are checked again', { tag: ['@ORD-SBM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    const before = await subs();
    const p = s.products.const[0];

    const noEnd = await app.actions.subscriptionAdmin.edit(c.request, sub.id, { startDate: ymd(s.multiDistribs[0].distribStartDate), endDate: '', quantities: { [p.id]: 1 } });
    const inverted = await app.actions.subscriptionAdmin.edit(c.request, sub.id, {
      startDate: ymd(s.multiDistribs[2].distribStartDate),
      endDate: ymd(s.multiDistribs[1].distribStartDate),
      quantities: { [p.id]: 1 },
    });

    expect(noEnd.flash?.kind).toBe('error');
    expect(inverted.flash?.kind).toBe('error');
    expect(await subs()).toEqual(before);
  });

  test('saving a constant subscription recreates its orders', { tag: ['@ORD-SBM-003', '@ORD-CST-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    const p = s.products.const[0];
    const idsBefore = (await query<{ id: number }>('SELECT id FROM UserOrder ORDER BY id')).map((r) => r.id);

    const res = await app.actions.subscriptionAdmin.edit(c.request, sub.id, {
      startDate: ymd(s.multiDistribs[0].distribStartDate),
      endDate: ymd(s.multiDistribs[3].distribStartDate),
      quantities: { [p.id]: 1 }, // same content
    });

    expect(res.flash?.kind).toBe('ok');
    const after = await query<{ id: number; quantity: number }>('SELECT id, quantity FROM UserOrder ORDER BY id');
    expect(after).toHaveLength(4);
    expect(after.every((o) => !idsBefore.includes(o.id))).toBe(true); // all lines are new rows
  });

  test('an absence outside the new period is refused', { tag: ['@ORD-SBM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const d = s.distributions.map((x) => x.const.id);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[3]] });
    const p = s.products.const[0];

    const res = await app.actions.subscriptionAdmin.edit(c.request, sub.id, {
      startDate: ymd(s.multiDistribs[0].distribStartDate),
      endDate: ymd(s.multiDistribs[1].distribStartDate), // ends before the absence
      quantities: { [p.id]: 1 },
      absences: [d[3]],
    });

    expect(res.flash?.kind).toBe('error');
    expect(res.flash?.text).toContain('absence');
  });
});

test.describe('deleting a subscription as a coordinator', () => {
  test('needs a security token', { tag: ['@ORD-SBM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);

    const without = await app.actions.subscriptionAdmin.delete(c.request, sub.id, { token: false });
    expect(without.flash?.kind).toBe('error');
    expect(await subs()).toHaveLength(1);

    const withToken = await app.actions.subscriptionAdmin.delete(c.request, sub.id);
    expect(withToken.flash?.kind).toBe('ok');
    expect(await subs()).toEqual([]);
    expect(await query('SELECT id FROM UserOrder')).toEqual([]);
  });

  test('is refused with a payment recorded, balance transfers count as payments', { tag: ['@ORD-SBM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 10, subscription: sub, data: { type: 'transfer' } });

    const res = await app.actions.subscriptionAdmin.delete(c.request, sub.id);

    expect(res.flash?.kind).toBe('error');
    expect(await subs()).toHaveLength(1);
  });
});

test.describe('balance transfer', () => {
  test('moves the balance of a subscription to another subscription of the same member and vendor', { tag: ['@ORD-BTR-001', '@ORD-BTR-005', '@PAY-OPE-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const from = await subscribeConst(app, member.request, s, s.users.member.id); // balance -60
    const to = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.actions.subscriptionAdmin.balanceTransfer(c.request, from.id, to.id);

    expect(res.flash?.kind).toBe('ok');
    const ops = await query<{ subscriptionId: number; amount: number; type: number }>('SELECT subscriptionId, amount, type FROM Operation WHERE type = 2 ORDER BY id');
    expect(ops).toEqual([
      { subscriptionId: from.id, amount: 60, type: 2 }, // a negative balance can be transferred too
      { subscriptionId: to.id, amount: -60, type: 2 },
    ]);
  });

  test('is refused when the member has no other subscription', { tag: ['@ORD-BTR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const from = await subscribeConst(app, member.request, s, s.users.member.id);

    const res = await app.actions.subscriptionAdmin.balanceTransfer(c.request, from.id, from.id);

    expect(res.flash?.kind).toBe('error');
    expect(await query('SELECT id FROM Operation WHERE type = 2')).toEqual([]);
  });

  test('needs a security token', { tag: ['@ORD-BTR-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const from = await subscribeConst(app, member.request, s, s.users.member.id);
    const to = await subscribeVar(app, member.request, s, s.users.member.id);

    await app.actions.subscriptionAdmin.balanceTransfer(c.request, from.id, to.id, { token: false });

    expect(await query('SELECT id FROM Operation WHERE type = 2')).toEqual([]);
  });

  test('is limited to a subscription of the same member', { tag: ['@ORD-BTR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const other = await as(s.users.member2);
    const from = await subscribeConst(app, member.request, s, s.users.member.id);
    await subscribeVar(app, member.request, s, s.users.member.id); // gives the member a target to pick from
    const foreign = await subscribeVar(app, other.request, s, s.users.member2.id);

    const res = await app.actions.subscriptionAdmin.balanceTransfer(c.request, from.id, foreign.id);

    expect(res.flash?.kind).toBe('error');
    expect(await query('SELECT id FROM Operation WHERE type = 2')).toEqual([]);
  });

  test('is limited to a subscription of the same vendor, not closed (UND-080)', { tag: ['@ORD-BTR-004', '@ORD-BTR-001'] }, async ({ app, as }) => {
    deviation('UND-080');
    const s = await make.amapScenario();
    const c = await coordinatorSession(app, as, s);
    const member = await as(s.users.member);
    const from = await subscribeConst(app, member.request, s, s.users.member.id);
    await subscribeVar(app, member.request, s, s.users.member.id);
    const otherVendor = await make.vendor({ name: 'Autre ferme' });
    const otherCatalog = await make.catalog({ group: s.group, vendor: otherVendor, name: 'Pain', type: 'VariableOrders', contact: s.users.coordinator });
    await make.distribution({ catalog: otherCatalog, multiDistrib: s.multiDistribs[1] });
    const foreign = await make.subscription({ user: s.users.member, catalog: otherCatalog, startDate: s.multiDistribs[0].distribStartDate, endDate: s.multiDistribs[3].distribEndDate });

    const res = await app.actions.subscriptionAdmin.balanceTransfer(c.request, from.id, foreign.id);

    expect(res.flash?.kind).toBe('error');
    expect(await query('SELECT id FROM Operation WHERE type = 2')).toEqual([]);
  });
});

test.describe('reattributing the subscription of a deleted user', () => {
  test('a superadmin moves the subscription, its orders, baskets and operations', { tag: ['@ORD-SBM-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const deleted = await queryOne<{ id: number }>("SELECT id FROM User WHERE email = 'deleted@camap.tld'");
    await make.userGroup({ user: deleted!, group: s.group, rights: [] });
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeConst(app, coordinator.request, s, deleted!.id);
    const admin = await as(s.users.superadmin);

    const res = await app.actions.subscriptionAdmin.reattribute(admin.request, sub.id, s.users.member.id);

    expect(res.status).toBe(302);
    expect(res.location).toContain(`/contractAdmin/subscriptions/edit/${sub.id}`);
    const row = await queryOne<{ userId: number }>('SELECT userId FROM Subscription WHERE id = ?', [sub.id]);
    expect(row!.userId).toBe(s.users.member.id);
    expect(await query('SELECT DISTINCT userId FROM UserOrder')).toEqual([{ userId: s.users.member.id }]);
    expect(await query('SELECT DISTINCT userId FROM Basket')).toEqual([{ userId: s.users.member.id }]);
    expect(await query('SELECT DISTINCT userId FROM Operation')).toEqual([{ userId: s.users.member.id }]);
  });

  test('works only from the deleted user, and only for a superadmin', { tag: ['@ORD-SBM-010'] }, async ({ app, as, errors }) => {
    errors.expect(/cette fonction marche/);
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);

    const byAdmin = await app.actions.subscriptionAdmin.reattribute((await as(s.users.superadmin)).request, sub.id, s.users.member2.id);
    const byCoordinator = await app.actions.subscriptionAdmin.reattribute((await as(s.users.coordinator)).request, sub.id, s.users.member2.id);

    expect(byAdmin.status).not.toBe(302); // an error page: the owner is not the deleted user
    expect(byCoordinator.status).not.toBe(200);
    const row = await queryOne<{ userId: number }>('SELECT userId FROM Subscription WHERE id = ?', [sub.id]);
    expect(row!.userId).toBe(s.users.member.id);
  });
});
