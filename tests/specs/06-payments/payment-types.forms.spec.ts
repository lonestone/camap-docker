/**
 * Payment types (specs/06-payments/payment-types.md; controller/AmapAdmin.hx doPayments,
 * service/PaymentService.hx getPaymentTypes).
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

async function admin(app: any, as: any, s: any) {
  const a = await as(s.users.groupAdmin);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

test.describe('payment types', () => {
  test('a group admin chooses the accepted types, except "on the spot", and the IBAN', { tag: ['@PAY-TYP-001', '@PAY-TYP-002', '@PAY-TYP-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);

    const before = await app.actions.groupAdmin.paymentSettings(a.request);
    expect(before.offered).toEqual(['cash', 'check', 'transfer', 'card-terminal']); // no "on the spot"
    expect(before.enabled).toEqual(['cash', 'check']);

    const res = await app.actions.groupAdmin.savePaymentSettings(a.request, { types: ['check', 'transfer'], iban: 'FR7612345678901234567890123' });

    expect(res.flash?.kind).toBe('ok');
    const after = await app.actions.groupAdmin.paymentSettings(a.request);
    expect(after.enabled).toEqual(['check', 'transfer']);
    expect(after.iban).toBe('FR7612345678901234567890123');
    const row = await queryOne<{ allowedPaymentsType: string; IBAN: string }>('SELECT allowedPaymentsType, IBAN FROM `Group` WHERE id = ?', [s.group.id]);
    expect(JSON.parse(row!.allowedPaymentsType)).toEqual(['check', 'transfer']);
  });

  test('at least one type must stay enabled', { tag: ['@PAY-TYP-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);

    const res = await app.actions.groupAdmin.savePaymentSettings(a.request, { types: [] });

    expect(res.flash?.kind).toBe('error');
    expect((await app.actions.groupAdmin.paymentSettings(a.request)).enabled).toEqual(['cash', 'check']);
  });

  test('only a group admin can change the payment settings', { tag: ['@PAY-TYP-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await as(s.users.coordinator);
    await app.actions.group.select(c.request, s.group.id);

    const res = await app.actions.groupAdmin.savePaymentSettings(c.request, { types: ['transfer'] });

    expect(res.status).toBe(302);
    const row = await queryOne<{ allowedPaymentsType: string }>('SELECT allowedPaymentsType FROM `Group` WHERE id = ?', [s.group.id]);
    expect(JSON.parse(row!.allowedPaymentsType)).toEqual(['cash', 'check']);
  });

  test('a coordinator entering a payment by hand picks among the admin types, without the money pot (UND-093)', { tag: ['@PAY-TYP-003', '@PAY-TYP-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await as(s.users.coordinator);
    await app.actions.group.select(c.request, s.group.id);

    const types = await app.actions.payments.manualEntryTypes(c.request, s.users.member.id);

    expect(types).toEqual(['cash', 'check', 'transfer', 'card-terminal']);
  });
});
