/**
 * Recording, listing and deleting memberships (specs/02-groups/membership.md GRP-COT-003 to GRP-COT-015;
 * camap-ts memberships.resolver.ts, memberships.service.ts, userGroups.resolver.ts, reached through the hx origin).
 * The settings form is in membership.forms.spec.ts; the payment pages are in 06-payments.
 *
 * Only camap-ts computes the membership year here, and it reads the real clock (the fake clock
 * moves Neko only): the renewal dates below are relative to the real current year.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';

const Y = new Date().getFullYear();
const TODAY = make.parisDate(new Date());
/** A renewal date already passed this year: the membership year is the current one. */
const PASSED = `${Y}-01-01`;
/** A renewal date still to come this year: the membership year is the previous one. */
const COMING = `${Y}-12-31`;

type OperationRow = { id: number; name: string; amount: number; type: number; pending: number; relationId: number | null; subscriptionId: number | null; data: string | null; date: string };
const operations = (userId: number, groupId: number) =>
  query<OperationRow>('SELECT id, name, amount, type, pending, relationId, subscriptionId, data, date FROM Operation WHERE userId = ? AND groupId = ? ORDER BY id', [userId, groupId]);
type MembershipRow = { year: number; amount: number; date: string; operationId: number | null; distributionId: number | null; userId: number; groupId: number };
const stored = (groupId: number) =>
  query<MembershipRow>('SELECT year, amount, date, operationId, distributionId, userId, groupId FROM Membership WHERE groupId = ? ORDER BY userId, year', [groupId]);
const balanceOf = async (userId: number, groupId: number) =>
  (await queryOne<{ balance: number }>('SELECT balance FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId]))!.balance;
const OP = { VOrder: 0, SubscriptionTotal: 1, Payment: 2, Membership: 3 };

const withMemberships = (group: make.GroupInput = {}) =>
  make.amapScenario({ group: { hasMembership: true, membershipFee: 20, membershipRenewalDate: PASSED, ...group } });

test.describe('the membership year (GRP-COT-003)', () => {
  test('the year starts at the renewal date: after it, it is the current year', { tag: ['@GRP-COT-003'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors).toBeNull();
    expect(res.data!.createMembership.year).toBe(Y);
    expect((await stored(s.group.id)).map((r) => r.year)).toEqual([Y]);
  });

  test('before the renewal date of this year, it is the previous year', { tag: ['@GRP-COT-003'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: COMING });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors).toBeNull();
    expect(res.data!.createMembership.year).toBe(Y - 1);
  });

  test('without a renewal date, it is the calendar year', { tag: ['@GRP-COT-003'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: null });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors).toBeNull();
    expect(res.data!.createMembership.year).toBe(Y);
  });

  test('an explicit year wins over the computed one', { tag: ['@GRP-COT-003'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, year: Y - 2 });

    expect(res.data!.createMembership.year).toBe(Y - 2);
  });
});

test.describe('the name of the membership period (GRP-COT-004)', () => {
  const cases: [string, string | null, (y: number) => string][] = [
    ['in January', '2020-01-15', (y) => `${y}`],
    ['in February', '2020-02-28', (y) => `${y}`],
    ['in March', '2020-03-01', (y) => `${y}-${y + 1}`],
    ['in September', '2020-09-01', (y) => `${y}-${y + 1}`],
    ['with no renewal date', null, (y) => `${y}-${y + 1}`],
  ];
  for (const [label, renewal, name] of cases) {
    test(`renewal ${label}: ${name(2024)}`, { tag: ['@GRP-COT-004'] }, async ({ app, as }) => {
      const s = await withMemberships({ membershipRenewalDate: renewal });
      await make.membership({ group: s.group, user: s.users.member, year: 2024 });
      const m = await as(s.users.membershipManager);

      const res = await app.api.memberships.of(m.request, s.group.id, s.users.member.id);

      expect(res.data!.getUserMemberships.map((x) => x.name)).toEqual([name(2024)]);
    });
  }

  test('the name is in the label of the debt', { tag: ['@GRP-COT-004', '@GRP-COT-007'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: '2020-09-01' });
    const m = await as(s.users.membershipManager);

    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, year: 2024 });

    const ops = await operations(s.users.member.id, s.group.id);
    expect(ops.map((o) => o.name)).toEqual(['Adhésion 2024-2025', 'Paiement adhésion 2024-2025']);
  });
});

test.describe('a valid membership (GRP-COT-005, UND-035)', () => {
  const validOf = async (app: any, m: any, s: make.AmapScenario) => (await app.api.members.get(m.request, s.group.id, s.users.member.id)).data!.userGroup!.hasValidMembership as boolean;

  test('a membership of the current year is valid', { tag: ['@GRP-COT-005'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    await make.membership({ group: s.group, user: s.users.member, year: Y });
    const m = await as(s.users.membershipManager);

    expect(await validOf(app, m, s)).toBe(true);
  });

  test('a membership of an earlier year is not valid', { tag: ['@GRP-COT-005'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    await make.membership({ group: s.group, user: s.users.member, year: Y - 1 });
    const m = await as(s.users.membershipManager);

    expect(await validOf(app, m, s)).toBe(false);
  });

  test('before the renewal date, the membership of the previous year is the valid one', { tag: ['@GRP-COT-005', '@GRP-COT-003'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: COMING });
    await make.membership({ group: s.group, user: s.users.member, year: Y - 1 });
    await make.membership({ group: s.group, user: s.users.member2, year: Y });
    const m = await as(s.users.membershipManager);

    expect(await validOf(app, m, s)).toBe(true);
    expect((await app.api.members.get(m.request, s.group.id, s.users.member2.id)).data!.userGroup!.hasValidMembership).toBe(false);
  });

  test('a membership of another group does not count', { tag: ['@GRP-COT-005'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    const other = await make.group({ name: 'Autre AMAP', hasMembership: true, membershipFee: 10, membershipRenewalDate: PASSED });
    await make.membership({ group: other, user: s.users.member, year: Y });
    const m = await as(s.users.membershipManager);

    expect(await validOf(app, m, s)).toBe(false);
  });

  test('a group with no renewal date has no valid membership, whatever was recorded', { tag: ['@GRP-COT-005'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: null });
    await make.membership({ group: s.group, user: s.users.member, year: Y });
    const m = await as(s.users.membershipManager);

    expect(await validOf(app, m, s)).toBe(false);
  });

  test('a group that turned the memberships off still counts the row (UND-035, characterised)', { tag: ['@GRP-COT-005'] }, async ({ app, as }) => {
    // SUGGESTION of the spec: the validity should also require memberships to be enabled.
    const s = await withMemberships({ hasMembership: false, membershipRenewalDate: PASSED });
    await make.membership({ group: s.group, user: s.users.member, year: Y });
    const m = await as(s.users.membershipManager);

    expect(await validOf(app, m, s)).toBe(true);
  });
});

test.describe('recording a membership (GRP-COT-006, GRP-COT-007)', () => {
  test('with the fee entered: the membership, a debt and a cash payment of that fee', { tag: ['@GRP-COT-006', '@GRP-COT-007', '@PAY-OPE-007'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, membershipFee: 35 });

    expect(res.errors).toBeNull();
    const created = res.data!.createMembership;
    expect(created).toMatchObject({ userId: s.users.member.id, groupId: s.group.id, year: Y, amount: 35, id: `${s.users.member.id}-${s.group.id}-${Y}` });
    const [row] = await stored(s.group.id);
    expect(row).toMatchObject({ userId: s.users.member.id, year: Y, amount: 35, date: TODAY, distributionId: null });
    const [debt, payment] = await operations(s.users.member.id, s.group.id);
    expect(debt).toMatchObject({ type: OP.Membership, amount: -35, pending: 0, name: `Adhésion ${Y}`, subscriptionId: null });
    expect(payment).toMatchObject({ type: OP.Payment, amount: 35, pending: 0, relationId: debt.id, name: `Paiement adhésion ${Y}` });
    expect(JSON.parse(payment.data!)).toMatchObject({ type: 'cash' });
    expect(row.operationId).toBe(debt.id);
    expect(created.operationId).toBe(debt.id);
  });

  test('without a fee, the fee of the group is used', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.data!.createMembership.amount).toBe(20);
    const [debt, payment] = await operations(s.users.member.id, s.group.id);
    expect([debt.amount, payment.amount]).toEqual([-20, 20]);
  });

  test('without any fee, an error asks for one and nothing is recorded', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: null });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toMatch(/define a membership fee/);
    expect(await stored(s.group.id)).toEqual([]);
    expect(await operations(s.users.member.id, s.group.id)).toEqual([]);
  });

  test('a member has only one membership per year', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships();
    await make.membership({ group: s.group, user: s.users.member, year: Y });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toBe('membershipAlreayExists');
    expect(await stored(s.group.id)).toHaveLength(1);
    expect(await operations(s.users.member.id, s.group.id)).toEqual([]);
  });

  test('another year can be recorded for the same member', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships();
    await make.membership({ group: s.group, user: s.users.member, year: Y });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, year: Y - 1 });

    expect(res.errors).toBeNull();
    expect((await stored(s.group.id)).map((r) => r.year)).toEqual([Y - 1, Y]);
  });

  test('the group must have memberships enabled', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships({ hasMembership: false });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toMatch(/does not have memberships/);
    expect(await stored(s.group.id)).toEqual([]);
  });

  test('a distribution can be attached to the membership', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, distributionId: s.multiDistribs[0].id });

    expect(res.errors).toBeNull();
    expect((await stored(s.group.id))[0].distributionId).toBe(s.multiDistribs[0].id);
  });

  test('an unknown distribution is refused', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, distributionId: 999999 });

    expect(res.data).toBeNull();
    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await stored(s.group.id)).toEqual([]);
  });

  test('a group admin who holds the membership right can record one, a superadmin too', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const admin = await as(s.users.groupAdmin);
    const root = await as(s.users.superadmin);

    const a = await app.api.memberships.create(admin.request, s.users.member.id, { groupId: s.group.id, date: TODAY });
    const b = await app.api.memberships.create(root.request, s.users.member2.id, { groupId: s.group.id, date: TODAY });

    expect(a.errors).toBeNull();
    expect(b.errors).toBeNull();
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
    ['a person outside the group', 'nonMember'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} cannot record a membership`, { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
      const s = await withMemberships();
      const u = await as(s.users[who]);

      const res = await app.api.memberships.create(u.request, s.users.member2.id, { groupId: s.group.id, date: TODAY });

      expect(res.data).toBeNull();
      expect(res.errors?.[0].message).toMatch(/membership management/);
      expect(await stored(s.group.id)).toEqual([]);
    });
  }

  test('a visitor cannot record a membership', { tag: ['@GRP-COT-006'] }, async ({ app, anon }) => {
    const s = await withMemberships();

    const res = await app.api.memberships.create(anon.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await stored(s.group.id)).toEqual([]);
  });

  test('a manager of another group cannot record one in this group', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const other = await make.group({ name: 'Autre AMAP', hasMembership: true, membershipFee: 10 });
    const manager = await make.user();
    await make.userGroup({ user: manager, group: other, rights: [Right.Membership()] });
    const u = await as(manager);

    const res = await app.api.memberships.create(u.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors?.[0].message).toMatch(/membership management/);
    expect(await stored(s.group.id)).toEqual([]);
  });

  test('a fee of 0 is replaced by the group fee (CODE-038, characterised)', { tag: ['@GRP-COT-006'] }, async ({ app, as }) => {
    // spec ERRATUM: an explicit 0 does not make a free membership
    const s = await withMemberships({ membershipFee: 20 });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, membershipFee: 0 });

    expect(res.data!.createMembership.amount).toBe(20);
  });
});

/** A member with a payment on a subscription: the balance hx keeps for the group (sum of the subscription operations). */
async function memberWithBalance(s: make.AmapScenario, amount: number) {
  const sub = await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: addDaysWall(clock.now(), -10), endDate: addDaysWall(clock.now(), 60) });
  await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount, subscription: sub });
  await query('UPDATE UserGroup SET balance = ? WHERE userId = ? AND groupId = ?', [amount, s.users.member.id, s.group.id]);
}

test.describe('the balance of the member (GRP-COT-007)', () => {
  test('the balance stays unchanged', { tag: ['@GRP-COT-007'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    await memberWithBalance(s, 50);
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors).toBeNull();
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(50);
    const ops = await operations(s.users.member.id, s.group.id);
    expect(ops.filter((o) => o.subscriptionId === null).reduce((sum, o) => sum + o.amount, 0)).toBe(0); // the debt and the payment cancel out
  });

  test('a member with no operation keeps a balance of 0', { tag: ['@GRP-COT-007'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    const m = await as(s.users.membershipManager);

    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(0);
  });
});

test.describe('the payment type and the member of the group (GRP-COT-008, GRP-COT-009, UND-033, characterised)', () => {
  // SUGGESTION of the spec: honour the chosen payment type and reject a user who is not in the group.
  test('the payment type chosen is ignored: the payment is always cash', { tag: ['@GRP-COT-006', '@GRP-COT-008'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY, paymentType: 'check' });

    expect(res.errors).toBeNull();
    const payment = (await operations(s.users.member.id, s.group.id)).find((o) => o.type === OP.Payment)!;
    expect(JSON.parse(payment.data!)).toMatchObject({ type: 'cash' });
  });

  test('a person who is not in the group gets a membership and its operations', { tag: ['@GRP-COT-006', '@GRP-COT-009'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.nonMember.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors).toBeNull();
    expect((await stored(s.group.id)).map((r) => r.userId)).toEqual([s.users.nonMember.id]);
    expect(await operations(s.users.nonMember.id, s.group.id)).toHaveLength(2);
  });

  test('an unknown user is refused', { tag: ['@GRP-COT-009'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, 999999, { groupId: s.group.id, date: TODAY });

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toMatch(/does not exists/);
    expect(await stored(s.group.id)).toEqual([]);
  });
});

test.describe('recording memberships for several members (GRP-COT-010)', () => {
  test('every member gets a membership, a debt and a payment', { tag: ['@GRP-COT-010'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.createMany(m.request, [s.users.member.id, s.users.member2.id, s.users.coordinator.id], { groupId: s.group.id, date: TODAY, membershipFee: 15 });

    expect(res.errors).toBeNull();
    expect(res.data!.createMemberships.errors).toEqual([]);
    expect(res.data!.createMemberships.success.map((x) => x.userId).sort()).toEqual([s.users.member.id, s.users.member2.id, s.users.coordinator.id].sort());
    expect((await stored(s.group.id)).map((r) => [r.userId, r.year, r.amount]).sort()).toEqual([s.users.member, s.users.member2, s.users.coordinator].map((u) => [u.id, Y, 15]).sort());
    for (const u of [s.users.member, s.users.member2, s.users.coordinator]) {
      expect((await operations(u.id, s.group.id)).map((o) => o.amount)).toEqual([-15, 15]);
    }
  });

  test('a member who already has one for that year is reported and skipped', { tag: ['@GRP-COT-010'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    await make.membership({ group: s.group, user: s.users.member2, year: Y, amount: 7 });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.createMany(m.request, [s.users.member.id, s.users.member2.id, s.users.coordinator.id], { groupId: s.group.id, date: TODAY });

    expect(res.errors).toBeNull();
    const r = res.data!.createMemberships;
    expect(r.errors).toEqual([{ userId: s.users.member2.id, message: 'membershipAlreayExists' }]);
    expect(r.success.map((x) => x.userId).sort()).toEqual([s.users.member.id, s.users.coordinator.id].sort());
    const rows = await stored(s.group.id);
    expect(rows.find((x) => x.userId === s.users.member2.id)).toMatchObject({ amount: 7, operationId: null });
    expect(await operations(s.users.member2.id, s.group.id)).toEqual([]);
    expect(rows).toHaveLength(3);
  });

  test('the member reported is the wrong one when the ids are not given in ascending order (UND-033, characterised)', { tag: ['@GRP-COT-010'] }, async ({ app, as }) => {
    // The resolver pairs the memberships found (in the order of the request) with the users found (in id order).
    // SUGGESTION of the spec (UND-033): map on the user id.
    const s = await withMemberships();
    await make.membership({ group: s.group, user: s.users.coordinator, year: Y });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.createMany(m.request, [s.users.coordinator.id, s.users.member.id, s.users.member2.id], { groupId: s.group.id, date: TODAY });

    const r = res.data!.createMemberships;
    expect(r.success.map((x) => x.userId).sort()).toEqual([s.users.member.id, s.users.member2.id].sort());
    expect(r.errors).toEqual([{ userId: s.users.member.id, message: 'membershipAlreayExists' }]); // should be the coordinator
  });

  test('several members already have one: each is reported', { tag: ['@GRP-COT-010'] }, async ({ app, as }) => {
    const s = await withMemberships();
    await make.membership({ group: s.group, user: s.users.member, year: Y });
    await make.membership({ group: s.group, user: s.users.coordinator, year: Y });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.createMany(m.request, [s.users.member.id, s.users.member2.id, s.users.coordinator.id], { groupId: s.group.id, date: TODAY });

    const r = res.data!.createMemberships;
    expect(r.errors.map((e) => e.userId).sort()).toEqual([s.users.member.id, s.users.coordinator.id].sort());
    expect(r.success.map((x) => x.userId)).toEqual([s.users.member2.id]);
  });

  test('the same rules apply: no fee, memberships off, no right', { tag: ['@GRP-COT-010', '@GRP-COT-006'] }, async ({ app, as }) => {
    const noFee = await withMemberships({ membershipFee: null });
    const m = await as(noFee.users.membershipManager);
    const a = await app.api.memberships.createMany(m.request, [noFee.users.member.id], { groupId: noFee.group.id, date: TODAY });
    expect(a.errors?.[0].message).toMatch(/define a membership fee/);
    expect(await stored(noFee.group.id)).toEqual([]);

    const plain = await as(noFee.users.member);
    const b = await app.api.memberships.createMany(plain.request, [noFee.users.member.id], { groupId: noFee.group.id, date: TODAY, membershipFee: 10 });
    expect(b.errors?.[0].message).toMatch(/membership management/);
    expect(await stored(noFee.group.id)).toEqual([]);
  });
});

test.describe('deleting a membership (GRP-COT-011)', () => {
  test('the membership, its payment and its debt are deleted', { tag: ['@GRP-COT-011'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    const m = await as(s.users.membershipManager);
    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });
    await app.api.memberships.create(m.request, s.users.member2.id, { groupId: s.group.id, date: TODAY });
    expect(await operations(s.users.member.id, s.group.id)).toHaveLength(2);

    const res = await app.api.memberships.delete(m.request, s.group.id, s.users.member.id, Y);

    expect(res.errors).toBeNull();
    expect(res.data!.deleteMembership).toBe(`${s.users.member.id}-${s.group.id}-${Y}`);
    expect((await stored(s.group.id)).map((r) => r.userId)).toEqual([s.users.member2.id]);
    expect(await operations(s.users.member.id, s.group.id)).toEqual([]);
    expect(await operations(s.users.member2.id, s.group.id)).toHaveLength(2);
  });

  test('the balance of the member is recomputed', { tag: ['@GRP-COT-011'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 20 });
    const m = await as(s.users.membershipManager);
    await memberWithBalance(s, 50);
    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });
    await query('UPDATE UserGroup SET balance = 999 WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);

    const res = await app.api.memberships.delete(m.request, s.group.id, s.users.member.id, Y);

    expect(res.errors).toBeNull();
    expect(await balanceOf(s.users.member.id, s.group.id)).toBe(50);
  });

  test('a membership with no operation (an old one) is simply deleted', { tag: ['@GRP-COT-011'] }, async ({ app, as }) => {
    const s = await withMemberships();
    await make.membership({ group: s.group, user: s.users.member, year: Y - 1 });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.delete(m.request, s.group.id, s.users.member.id, Y - 1);

    expect(res.errors).toBeNull();
    expect(await stored(s.group.id)).toEqual([]);
  });

  test('the member can have a new membership for that year afterwards', { tag: ['@GRP-COT-011', '@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);
    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });
    await app.api.memberships.delete(m.request, s.group.id, s.users.member.id, Y);

    const again = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(again.errors).toBeNull();
  });

  test('a membership that does not exist is not found', { tag: ['@GRP-COT-011'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.delete(m.request, s.group.id, s.users.member.id, Y);

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toMatch(/Not Found/i);
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
    ['a person outside the group', 'nonMember'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} cannot delete a membership`, { tag: ['@GRP-COT-011'] }, async ({ app, as }) => {
      const s = await withMemberships();
      await make.membership({ group: s.group, user: s.users.member2, year: Y });
      const u = await as(s.users[who]);

      const res = await app.api.memberships.delete(u.request, s.group.id, s.users.member2.id, Y);

      expect(res.errors?.[0].message).toMatch(/membership management/);
      expect(await stored(s.group.id)).toHaveLength(1);
    });
  }

  test('a visitor cannot delete a membership', { tag: ['@GRP-COT-011'] }, async ({ app, anon }) => {
    const s = await withMemberships();
    await make.membership({ group: s.group, user: s.users.member2, year: Y });

    const res = await app.api.memberships.delete(anon.request, s.group.id, s.users.member2.id, Y);

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await stored(s.group.id)).toHaveLength(1);
  });
});

test.describe('the membership dialog (GRP-COT-012)', () => {
  test('it offers the proposed fee', { tag: ['@GRP-COT-012'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: 42 });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.formData(m.request, s.group.id, s.users.member.id);

    expect(res.errors).toBeNull();
    expect(res.data!.getMembershipFormData.membershipFee).toBe(42);
  });

  test('a group with no fee proposes none', { tag: ['@GRP-COT-012'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipFee: null });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.formData(m.request, s.group.id, s.users.member.id);

    expect(res.data!.getMembershipFormData.membershipFee).toBeNull();
  });

  test('it offers the years from 4 years back to 1 year ahead, named like the period', { tag: ['@GRP-COT-012', '@GRP-COT-004'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.formData(m.request, s.group.id, s.users.member.id);

    expect(res.data!.getMembershipFormData.availableYears).toEqual([-4, -3, -2, -1, 0, 1].map((d) => ({ id: Y + d, name: `${Y + d}` })));
  });

  test('a renewal date in autumn gives two-year names', { tag: ['@GRP-COT-012', '@GRP-COT-004'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: '2020-01-01'.replace('01-01', '09-01') });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.formData(m.request, s.group.id, s.users.member.id);

    const years = res.data!.getMembershipFormData.availableYears;
    expect(years).toHaveLength(6);
    for (const y of years) expect(y.name).toBe(`${y.id}-${y.id + 1}`);
    // ids are consecutive years
    expect(years.map((y) => y.id)).toEqual(Array.from({ length: 6 }, (_, i) => years[0].id + i));
  });

  test('it offers the distributions between 3 months ago and 5 days ahead', { tag: ['@GRP-COT-012'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const now = clock.now();
    const day = async (offsetDays: number) => (await make.multiDistrib({ group: s.group, place: s.place, start: addDaysWall(now, offsetDays) })).id;
    const tooOld = await day(-100);
    const old = await day(-80);
    const yesterday = await day(-1);
    const soon = await day(3);
    const later = await day(9);
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.formData(m.request, s.group.id, s.users.member.id);

    const ids = res.data!.getMembershipFormData.distributions.map((d) => d.id);
    expect(ids).toEqual([old, yesterday, soon]);
    expect(ids).not.toContain(tooOld);
    expect(ids).not.toContain(later);
    // the scenario's own distributions start in 7 days: out of range as well
    for (const md of s.multiDistribs) expect(ids).not.toContain(md.id);
  });

  test('only the distributions of this group are offered', { tag: ['@GRP-COT-012'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const other = await make.group({ name: 'Autre AMAP' });
    const otherPlace = await make.place({ group: other });
    await make.multiDistrib({ group: other, place: otherPlace, start: addDaysWall(clock.now(), -2) });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.formData(m.request, s.group.id, s.users.member.id);

    expect(res.data!.getMembershipFormData.distributions).toEqual([]);
  });

  const refused = [
    ['a plain member', 'member'],
    ['a messages manager', 'messagesManager'],
    ['a person outside the group', 'nonMember'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} cannot open it`, { tag: ['@GRP-COT-012'] }, async ({ app, as }) => {
      const s = await withMemberships();
      const u = await as(s.users[who]);

      const res = await app.api.memberships.formData(u.request, s.group.id, s.users.member2.id);

      expect(res.data).toBeNull();
      expect(res.errors?.[0].message).toMatch(/membership management/);
    });
  }
});

test.describe('the members with and without a valid membership (GRP-COT-014)', () => {
  test('only a membership of the current year puts a member in the valid list', { tag: ['@GRP-COT-014'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    await make.membership({ group: s.group, user: s.users.member, year: Y });
    await make.membership({ group: s.group, user: s.users.member2, year: Y - 1 });
    const m = await as(s.users.membershipManager);

    const lists = (await app.api.members.lists(m.request, s.group.id)).data!.getUserLists;
    const valid = await app.api.members.listUsers(m.request, { listType: 'membership', groupId: s.group.id });
    const without = await app.api.members.listUsers(m.request, { listType: 'noMembership', groupId: s.group.id });

    expect(valid.data!.getUserListInGroupByListType.map((u) => u.id)).toEqual([s.users.member.id]);
    const withoutIds = without.data!.getUserListInGroupByListType.map((u) => u.id);
    expect(withoutIds).toContain(s.users.member2.id);
    expect(withoutIds).not.toContain(s.users.member.id);
    expect(withoutIds).toHaveLength(5);
    expect(lists.find((l) => l.type === 'membership')!.count).toBe(1);
    expect(lists.find((l) => l.type === 'noMembership')!.count).toBe(5);
  });

  test('a person who left the group is in neither list', { tag: ['@GRP-COT-014'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    await make.membership({ group: s.group, user: s.users.nonMember, year: Y });
    const m = await as(s.users.membershipManager);

    const valid = await app.api.members.listUsers(m.request, { listType: 'membership', groupId: s.group.id });
    const without = await app.api.members.listUsers(m.request, { listType: 'noMembership', groupId: s.group.id });

    expect(valid.data!.getUserListInGroupByListType).toEqual([]);
    expect(without.data!.getUserListInGroupByListType.map((u) => u.id)).not.toContain(s.users.nonMember.id);
  });

  test('recording a membership moves the member from one list to the other', { tag: ['@GRP-COT-014', '@GRP-COT-006'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: PASSED });
    const m = await as(s.users.membershipManager);
    const before = await app.api.members.listUsers(m.request, { listType: 'membership', groupId: s.group.id });
    expect(before.data!.getUserListInGroupByListType).toEqual([]);

    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    const after = await app.api.members.listUsers(m.request, { listType: 'membership', groupId: s.group.id });
    expect(after.data!.getUserListInGroupByListType.map((u) => u.id)).toEqual([s.users.member.id]);
  });
});

test.describe('reading the memberships of a member (GRP-COT-015)', () => {
  test('a membership manager reads them, newest first, with the amount and the period name', { tag: ['@GRP-COT-015'] }, async ({ app, as }) => {
    const s = await withMemberships({ membershipRenewalDate: '2020-09-01', membershipFee: 20 });
    const m = await as(s.users.membershipManager);
    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: '2023-10-01', year: 2023, membershipFee: 12 });
    await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: '2024-10-01', year: 2024 });
    await make.membership({ group: s.group, user: s.users.member2, year: 2024 });

    const res = await app.api.memberships.of(m.request, s.group.id, s.users.member.id);

    expect(res.errors).toBeNull();
    expect(res.data!.getUserMemberships).toMatchObject([
      { id: `${s.users.member.id}-${s.group.id}-2024`, year: 2024, name: '2024-2025', amount: 20, userId: s.users.member.id, groupId: s.group.id },
      { id: `${s.users.member.id}-${s.group.id}-2023`, year: 2023, name: '2023-2024', amount: 12 },
    ]);
  });

  test('a member with no membership has an empty list', { tag: ['@GRP-COT-015'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.of(m.request, s.group.id, s.users.member.id);

    expect(res.errors).toBeNull();
    expect(res.data!.getUserMemberships).toEqual([]);
  });

  test('the memberships of other groups are not listed', { tag: ['@GRP-COT-015'] }, async ({ app, as }) => {
    const s = await withMemberships();
    const other = await make.group({ name: 'Autre AMAP', hasMembership: true, membershipFee: 10 });
    await make.membership({ group: other, user: s.users.member, year: Y });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.of(m.request, s.group.id, s.users.member.id);

    expect(res.data!.getUserMemberships).toEqual([]);
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
    ['a person outside the group', 'nonMember'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} needs the membership right: error, or an empty list when asked to ignore`, { tag: ['@GRP-COT-015'] }, async ({ app, as }) => {
      const s = await withMemberships();
      await make.membership({ group: s.group, user: s.users.member2, year: Y });
      const u = await as(s.users[who]);

      const strict = await app.api.memberships.of(u.request, s.group.id, s.users.member2.id);
      const lenient = await app.api.memberships.of(u.request, s.group.id, s.users.member2.id, { ignoreIfNotAllowed: true });

      expect(strict.data).toBeNull();
      expect(strict.errors?.[0].message).toMatch(/membership management/);
      expect(lenient.errors).toBeNull();
      expect(lenient.data!.getUserMemberships).toEqual([]);
    });
  }

  test('a visitor cannot read them', { tag: ['@GRP-COT-015'] }, async ({ app, anon }) => {
    const s = await withMemberships();

    const res = await app.api.memberships.of(anon.request, s.group.id, s.users.member.id);

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});
