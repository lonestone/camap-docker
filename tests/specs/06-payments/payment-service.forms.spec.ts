/**
 * What the payment service does with a payment type and a pending flag, seen through the hx pages that
 * use it (specs/06-payments/payment-types.md PAY-TYP-004, 008, 009; payment-entry.md PAY-ENT-012;
 * operations.md PAY-OPE-008). service/PaymentService.hx makePaymentOperation, db/Group.hx
 * getAllowedPaymentTypes, SubscriptionService.transferBalance.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne, update } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst, subscribeVar } from '../../src/flows.js';

const today = (clock: { now(): Date }) => make.parisDate(clock.now());

async function session(app: any, as: any, s: any, who: 'coordinator' | 'membershipManager' | 'groupAdmin') {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

const typeOf = (op: { data: string | null }) => JSON.parse(op.data!).type as string;
const payments = () => query<{ id: number; name: string; amount: number; pending: number; subscriptionId: number | null; data: string | null }>(
  'SELECT id, name, amount, pending, subscriptionId, data FROM Operation WHERE type = 2 ORDER BY id',
);

test.describe('a payment of type "on the spot" (PAY-TYP-008)', () => {
  async function massEntry(allowed: string[] | string | null, type: string) {
    return async (app: any, as: any) => {
      const s = await make.amapScenario();
      await update('Group', { id: s.group.id }, { allowedPaymentsType: typeof allowed === 'string' || allowed === null ? allowed : JSON.stringify(allowed) });
      const c = await session(app, as, s, 'coordinator');
      const m = await as(s.users.member);
      const sub = await subscribeConst(app, m.request, s, s.users.member.id);

      await app.actions.payments.massInsert(c.request, s.constCatalog.id, [{ subscriptionId: sub.id, amount: 15, type }]);
      return (await payments())[0];
    };
  }

  test('means the only on-the-spot type the group allows', { tag: ['@PAY-TYP-008'] }, async ({ app, as }) => {
    const op = await (await massEntry(['check', 'transfer'], 'onthespot'))(app, as);

    expect(typeOf(op)).toBe('check');
  });

  test('stays "on the spot" when the group allows several on-the-spot types', { tag: ['@PAY-TYP-008'] }, async ({ app, as }) => {
    const op = await (await massEntry(['cash', 'check'], 'onthespot'))(app, as);

    expect(typeOf(op)).toBe('onthespot');
  });

  test('stays "on the spot" when the group allows none', { tag: ['@PAY-TYP-008'] }, async ({ app, as }) => {
    const op = await (await massEntry(['transfer'], 'onthespot'))(app, as);

    expect(typeOf(op)).toBe('onthespot');
  });

  test('a concrete type is kept as it is, even when it is the only one allowed', { tag: ['@PAY-TYP-008'] }, async ({ app, as }) => {
    const op = await (await massEntry(['check'], 'cash'))(app, as);

    expect(typeOf(op)).toBe('cash');
  });

  test('card terminal is an on-the-spot type too', { tag: ['@PAY-TYP-008', '@PAY-TYP-001'] }, async ({ app, as }) => {
    const op = await (await massEntry(['card-terminal', 'transfer'], 'onthespot'))(app, as);

    expect(typeOf(op)).toBe('card-terminal');
  });
});

test.describe('the allowed payment types of a group (PAY-TYP-004)', () => {
  test('an unreadable setting means no type allowed', { tag: ['@PAY-TYP-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await session(app, as, s, 'groupAdmin');

    for (const bad of ['not json at all', '', null]) {
      await update('Group', { id: s.group.id }, { allowedPaymentsType: bad });
      const settings = await app.actions.groupAdmin.paymentSettings(a.request);
      expect(settings.status, String(bad)).toBe(200);
      expect(settings.enabled, String(bad)).toEqual([]);
    }
  });

  test('with no readable setting, "on the spot" is not replaced by a single type', { tag: ['@PAY-TYP-004', '@PAY-TYP-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await update('Group', { id: s.group.id }, { allowedPaymentsType: 'garbage' });
    const c = await session(app, as, s, 'coordinator');
    const m = await as(s.users.member);
    const sub = await subscribeConst(app, m.request, s, s.users.member.id);

    await app.actions.payments.massInsert(c.request, s.constCatalog.id, [{ subscriptionId: sub.id, amount: 15, type: 'onthespot' }]);

    expect(typeOf((await payments())[0])).toBe('onthespot');
  });
});

test.describe('payment types have no help link (PAY-TYP-009)', () => {
  test('the payment settings page links to no /transaction/<type> page', { tag: ['@PAY-TYP-009'] }, async ({ app, as }) => {
    // Observable part of the removal: the per-type link was never printed, only docLink is
    // (and only for money pot, which is not offered).
    const s = await make.amapScenario();
    const a = await session(app, as, s, 'groupAdmin');

    const settings = await app.actions.groupAdmin.paymentSettings(a.request);

    expect(settings.offered.length).toBeGreaterThan(0);
    expect(settings.links.filter((l) => l.includes('/transaction/'))).toEqual([]);
  });
});

test.describe('a payment waiting for a coordinator (PAY-ENT-012)', () => {
  test('editing a pending payment makes it no longer pending', { tag: ['@PAY-ENT-012', '@PAY-ENT-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const sub = await make.subscription({
      user: s.users.member,
      catalog: s.constCatalog,
      startDate: s.multiDistribs[0].distribStartDate,
      endDate: s.multiDistribs[3].distribEndDate,
    });
    const op = await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 30, pending: true, subscription: sub, data: { type: 'onthespot' } });
    const mm = await session(app, as, s, 'membershipManager');

    const res = await app.actions.payments.edit(mm.request, op.id, { name: 'Sur place', amount: 30, date: today(clock) });

    expect(res.status).toBe(302);
    expect(await queryOne('SELECT pending FROM Operation WHERE id = ?', [op.id])).toEqual({ pending: 0 });
  });

  test('a payment recorded by a coordinator is not pending', { tag: ['@PAY-ENT-012'] }, async ({ app, as }) => {
    // the mass entry goes through the payment service, which creates the payment pending, then clears it
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');
    const m = await as(s.users.member);
    const sub = await subscribeConst(app, m.request, s, s.users.member.id);

    await app.actions.payments.massInsert(c.request, s.constCatalog.id, [{ subscriptionId: sub.id, amount: 15, type: 'check' }]);

    expect((await payments()).map((p) => p.pending)).toEqual([0]);
  });
});

test.describe('a balance transfer (PAY-OPE-008)', () => {
  test('creates two payment operations of type "transfer", settled, one per subscription', { tag: ['@PAY-OPE-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');
    const member = await as(s.users.member);
    const from = await subscribeConst(app, member.request, s, s.users.member.id); // balance -60
    const to = await subscribeVar(app, member.request, s, s.users.member.id);

    const res = await app.actions.subscriptionAdmin.balanceTransfer(c.request, from.id, to.id);

    expect(res.flash?.kind).toBe('ok');
    const ops = await payments();
    expect(ops).toHaveLength(2);
    expect(ops.map((o) => [o.subscriptionId, o.amount, o.pending, typeOf(o)])).toEqual([
      [from.id, 60, 0, 'transfer'],
      [to.id, -60, 0, 'transfer'],
    ]);
    expect(ops[0].name).toContain(`#${to.id}`);
    expect(ops[1].name).toContain(`#${from.id}`);
  });
});
