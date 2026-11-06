/**
 * Absence rules of CSA subscriptions (specs/05-orders/absences.md;
 * camap-hx/src/service/AbsencesService.hx, controller/api/Subscription.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { absentDistribIds } from '../../src/encodings/columns.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const storedAbsences = async (subId: number) =>
  absentDistribIds.decode((await queryOne<{ absentDistribIds: string | null }>('SELECT absentDistribIds FROM Subscription WHERE id = ?', [subId]))!.absentDistribIds);

const orderedDistribs = async (subId: number) =>
  (await query<{ distributionId: number }>('SELECT distributionId FROM UserOrder WHERE subscriptionId = ? AND quantity > 0 ORDER BY distributionId', [subId])).map(
    (r) => r.distributionId,
  );

test.describe('absences in constant subscriptions', () => {
  test('a member declares absences by choosing distributions when subscribing', { tag: ['@ORD-ABS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);

    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[3], d[1]] });

    expect(sub.absentDistribIds).toEqual([d[1], d[3]]);
    expect(await storedAbsences(sub.id)).toEqual([d[1], d[3]]);
  });

  test('absences must be among the possible distributions of the catalog', { tag: ['@ORD-ABS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const otherCatalogDistrib = s.distributions[0].var.id; // not a distribution of the constant catalog
    const p = s.products.const[0];

    const res = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.constCatalog.id,
      defaultOrder: [{ productId: p.id, productPrice: p.price, quantity: 1 }],
      absentDistribIds: [otherCatalogDistrib],
      initialOrders: [],
    });

    expect(res.status).not.toBe(200);
    expect(await query('SELECT id FROM Subscription')).toEqual([]);
  });

  test('a distribution with shifted orders cannot be chosen as an absence', { tag: ['@ORD-ABS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const merged = s.distributions[1].const.id;
    await make.setDistributionQuantities(merged, 2);
    const member = await as(s.users.member);
    const p = s.products.const[0];

    const res = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.constCatalog.id,
      defaultOrder: [{ productId: p.id, productPrice: p.price, quantity: 1 }],
      absentDistribIds: [merged],
      initialOrders: [],
    });

    expect(res.status).not.toBe(200);
  });

  test('absences contain no duplicate distribution', { tag: ['@ORD-ABS-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const p = s.products.const[0];

    const res = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.constCatalog.id,
      defaultOrder: [{ productId: p.id, productPrice: p.price, quantity: 1 }],
      absentDistribIds: [d[1], d[1]],
      initialOrders: [],
    });

    expect(res.status).toBe(500);
    expect(await query('SELECT id FROM Subscription')).toEqual([]);
  });

  test('the number of absences cannot change after creation, only their dates', { tag: ['@ORD-ABS-003', '@ORD-ABS-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[2], d[3]] });

    const fewer = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [d[2]] });
    const more = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [d[0], d[1], d[2]] });
    const moved = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [d[0], d[1]] });

    expect(fewer.status).toBe(500);
    expect(more.status).toBe(500);
    expect(moved.status).toBe(200);
    expect(await storedAbsences(sub.id)).toEqual([d[0], d[1]]);
  });

  test('a coordinator can change the number of absences', { tag: ['@ORD-ABS-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[2], d[3]] });
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.catalog.subscriptionAbsences.post(coordinator.request, sub.id, { absentDistribIds: [d[2]] });

    expect(res.status).toBe(200);
    expect(await storedAbsences(sub.id)).toEqual([d[2]]);
  });

  test('moving an absence moves the orders with it', { tag: ['@ORD-ABS-006', '@ORD-ABS-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[2], d[3]] });

    // no order on the absent distributions, a total over the present ones only
    expect(await orderedDistribs(sub.id)).toEqual([d[0], d[1]]);
    expect(sub.totalOrdered).toBe(30);

    await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [d[0], d[3]] });

    expect(await orderedDistribs(sub.id)).toEqual([d[1], d[2]]);
    const after = await app.api.subscription.get(member.request, sub.id);
    expect(after.body.totalOrdered).toBe(30);
  });

  test('the member sees closed distributions as locked absences', { tag: ['@ORD-ABS-004'] }, async ({ app, as, clock }) => {
    // UND-078: today the lock is the order window of each distribution.
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[0], d[3]] });

    clock.set('+7d'); // the order window of the first distribution (closes the day before) is now closed
    const res = await app.api.catalog.subscriptionAbsences.get(member.request, sub.id);

    expect(res.status).toBe(200);
    expect(res.body.closedDistribIds).toEqual([d[0]]);
    expect(res.body.possibleAbsentDistribs.map((x) => x.id)).not.toContain(d[0]);
  });

  test('an absence whose order window is closed can still be moved while the distribution is not held (UND-078)', { tag: ['@ORD-ABS-004'] }, async ({ app, as, clock }) => {
    // Characterisation: the order window locks absences in the response only.
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[0], d[3]] });

    clock.set('+7d'); // order window of d[0] closed, distribution not yet held
    const res = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [d[1], d[3]] });

    expect(res.status).toBe(200);
    expect(await storedAbsences(sub.id)).toEqual([d[1], d[3]]);
  });

  test('an absence on a distribution already held cannot be changed', { tag: ['@ORD-ABS-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[0], d[3]] });

    clock.set('+8d'); // d[0] is held
    const res = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [d[1], d[3]] });

    expect(res.status).toBe(500);
    expect(await storedAbsences(sub.id)).toEqual([d[0], d[3]]);
  });
});
