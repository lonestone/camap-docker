/**
 * The "new interface" of operations: camap-ts operation.resolver.ts (validateOperation,
 * deleteOperation) and the amounts written by memberships.service.ts, reached through the hx origin
 * (specs/06-payments/payment-entry.md PAY-ENT-011..013, operations.md PAY-OPE-006).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';

const balanceOf = async (userId: number, groupId: number) =>
  (await queryOne<{ balance: number }>('SELECT balance FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId]))!.balance;

/** A subscription of the member with one pending on-the-spot payment of 30 (what the payment service leaves until validation). */
async function withPendingPayment() {
  const s = await make.amapScenario();
  const sub = await make.subscription({
    user: s.users.member,
    catalog: s.constCatalog,
    startDate: s.multiDistribs[0].distribStartDate,
    endDate: s.multiDistribs[3].distribEndDate,
  });
  const op = await make.operation({
    user: s.users.member,
    group: s.group,
    type: 'Payment',
    amount: 30,
    pending: true,
    subscription: sub,
    name: 'Paiement sur place',
    data: { type: 'onthespot' },
  });
  return { s, sub, op };
}

const stored = (id: number) =>
  queryOne<{ pending: number; amount: number; data: string | null }>('SELECT pending, amount, data FROM Operation WHERE id = ?', [id]);

test.describe('validating a pending payment (PAY-ENT-011, PAY-ENT-012)', () => {
  test('the validation clears the pending flag and recomputes the balance of the member', { tag: ['@PAY-ENT-011', '@PAY-ENT-012'] }, async ({ app, as }) => {
    const { s, op } = await withPendingPayment();
    const admin = await as(s.users.groupAdmin);
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(0);

    const res = await app.api.operations.validate(admin.request, op.id);

    expect(res.errors).toBeNull();
    expect(res.data!.validateOperation).toMatchObject({ id: op.id, pending: false, amount: 30, type: 'Payment' });
    expect(await stored(op.id)).toMatchObject({ pending: 0, amount: 30 });
    expect(JSON.parse((await stored(op.id))!.data!)).toEqual({ type: 'onthespot' }); // no type given: left as it was
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(30);
  });

  test('the validation can set the concrete on-the-spot type', { tag: ['@PAY-ENT-011'] }, async ({ app, as }) => {
    const { s, op } = await withPendingPayment();
    const admin = await as(s.users.groupAdmin);

    const res = await app.api.operations.validate(admin.request, op.id, 'check');

    expect(res.errors).toBeNull();
    expect(res.data!.validateOperation).toMatchObject({ pending: false, data: { type: 'check' } });
    expect(JSON.parse((await stored(op.id))!.data!)).toEqual({ type: 'check' });
  });

  test('it needs the right on all the catalogs, not the membership right of the Haxe pages', { tag: ['@PAY-ENT-011'] }, async ({ app, as }) => {
    // UND-096: characterised. The Haxe edit and delete pages need canAccessMembership; here the
    // all-catalogs right is required, so a membership manager is refused.
    const { s, op } = await withPendingPayment();

    for (const who of ['membershipManager', 'member'] as const) {
      const user = await as(s.users[who]);
      const res = await app.api.operations.validate(user.request, op.id);
      expect(res.data, who).toBeNull();
      expect(res.errors?.[0].message, who).toMatch(/authorization to manage all catalogs/);
    }
    expect(await stored(op.id)).toMatchObject({ pending: 1 });
  });

  test('a coordinator of all the catalogs may validate, and so may a coordinator of a single catalog', { tag: ['@PAY-ENT-011'] }, async ({ app, as }) => {
    // Characterised: the "all catalogs" right is checked with hasRight(catalogAdmin), which any
    // ContractAdmin right satisfies, whatever the catalog: a single-catalog coordinator passes too.
    const { s, op } = await withPendingPayment();
    const all = await make.user({ firstName: 'Tous', lastName: 'Catalogues', email: 'all@camap.test' });
    await make.userGroup({ user: all, group: s.group, rights: [Right.ContractAdmin()] });
    const c = await as(all);
    const single = await as(s.users.coordinator);

    const res = await app.api.operations.validate(c.request, op.id);
    expect(res.errors).toBeNull();
    expect(await stored(op.id)).toMatchObject({ pending: 0 });

    await query('UPDATE Operation SET pending = 1 WHERE id = ?', [op.id]);
    const res2 = await app.api.operations.validate(single.request, op.id);
    expect(res2.errors).toBeNull();
    expect(await stored(op.id)).toMatchObject({ pending: 0 });
  });

  test('an unknown operation is not found, and a visitor is refused', { tag: ['@PAY-ENT-011'] }, async ({ app, as, anon }) => {
    const { s, op } = await withPendingPayment();
    const admin = await as(s.users.groupAdmin);

    const unknown = await app.api.operations.validate(admin.request, op.id + 1000);
    const visitor = await app.api.operations.validate(anon.request, op.id);

    expect(unknown.data).toBeNull();
    expect(unknown.errors?.[0].message).toMatch(/Not Found/i);
    expect(visitor.data).toBeNull();
    expect(visitor.errors).not.toBeNull();
    expect(await stored(op.id)).toMatchObject({ pending: 1 });
  });
});

test.describe('deleting an operation (PAY-ENT-011)', () => {
  test('deletes the operation and recomputes the balance', { tag: ['@PAY-ENT-011'] }, async ({ app, as }) => {
    const { s, op } = await withPendingPayment();
    const admin = await as(s.users.groupAdmin);
    await app.api.operations.validate(admin.request, op.id);
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(30);

    const res = await app.api.operations.delete(admin.request, op.id);

    expect(res.errors).toBeNull();
    expect(res.data!.deleteOperation).toBe(op.id);
    expect(await query('SELECT id FROM Operation WHERE id = ?', [op.id])).toEqual([]);
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(0);
  });

  test('is refused to a membership manager and to a plain member', { tag: ['@PAY-ENT-011'] }, async ({ app, as }) => {
    const { s, op } = await withPendingPayment();

    for (const who of ['membershipManager', 'member'] as const) {
      const user = await as(s.users[who]);
      const res = await app.api.operations.delete(user.request, op.id);
      expect(res.errors?.[0].message, who).toMatch(/authorization to manage all catalogs/);
    }
    expect(await query('SELECT id FROM Operation WHERE id = ?', [op.id])).toHaveLength(1);
  });
});

test.describe('amounts written by the new interface (PAY-OPE-006, PAY-ENT-013)', () => {
  test('a membership fee with more than 2 decimals is stored as given, not rounded (UND-089)', { tag: ['@PAY-OPE-006', '@PAY-ENT-013'] }, async ({ app, as }) => {
    // Characterised (UND-089 undecided): hx rounds every operation amount to 2 decimals
    // (Operation.check); memberships.service.ts saves the debt and the payment as they come.
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 20, membershipRenewalDate: `${new Date().getFullYear()}-01-01` } });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: make.parisDate(new Date()), membershipFee: 10.006 });

    expect(res.errors).toBeNull();
    const ops = await query<{ type: number; amount: number }>('SELECT type, amount FROM Operation WHERE userId = ? ORDER BY id', [s.users.member.id]);
    expect(ops.map((o) => o.type)).toEqual([3, 2]);
    expect(ops.map((o) => o.amount)).toEqual([-10.006, 10.006]);
  });
});
