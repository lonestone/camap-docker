/**
 * Reading and updating the absences of a CSA subscription over the API
 * (specs/05-orders/absences.md; camap-hx/src/controller/api/Catalog.hx
 * doSubscriptionAbsences).
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne } from '../../src/db/client.js';
import { absentDistribIds } from '../../src/encodings/columns.js';
import * as make from '../../src/factories/index.js';

/** Scenario + the member's subscription to the constant catalog, absent on the last two distributions. */
async function arrange() {
  const s = await make.amapScenario();
  const d = s.distributions.map((x) => x.const.id);
  const sub = await make.subscription({
    user: s.users.member,
    catalog: s.constCatalog,
    startDate: s.multiDistribs[0].distribStartDate,
    endDate: s.multiDistribs[s.multiDistribs.length - 1].distribEndDate,
    absentDistribIds: [d[2], d[3]],
  });
  return { s, d, sub };
}

async function storedAbsences(subId: number): Promise<number[]> {
  const row = await queryOne<{ absentDistribIds: string | null }>('SELECT absentDistribIds FROM Subscription WHERE id = ?', [subId]);
  return absentDistribIds.decode(row!.absentDistribIds);
}

test.describe('subscription absences API', () => {
  test('the owner reads the absences of their subscription', { tag: ['@ORD-ABS-008'] }, async ({ app, as }) => {
    const { s, d, sub } = await arrange();
    const member = await as(s.users.member);

    const res = await app.api.catalog.subscriptionAbsences.get(member.request, sub.id);

    expect(res.status).toBe(200);
    expect(res.body.absentDistribsNb).toBe(2);
    expect(res.body.absentDistribIds).toEqual([d[2], d[3]]);
    expect(res.body.possibleAbsentDistribs.map((x) => x.id)).toEqual(d);
  });

  test('the owner moves their absences to other distributions', { tag: ['@ORD-ABS-008'] }, async ({ app, as }) => {
    const { s, d, sub } = await arrange();
    const member = await as(s.users.member);

    const res = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [d[1], d[0]] });

    expect(res.status).toBe(200);
    expect(res.body.absentDistribIds).toEqual([d[0], d[1]]);
    expect(await storedAbsences(sub.id)).toEqual([d[0], d[1]]); // stored in date order
  });

  test('a member cannot post an empty list of absences', { tag: ['@ORD-ABS-007'] }, async ({ app, as }) => {
    const { s, d, sub } = await arrange();
    const member = await as(s.users.member);

    const res = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [] });

    expect(res.status).toBe(400);
    expect(await storedAbsences(sub.id)).toEqual([d[2], d[3]]);
  });

  test('a coordinator can post an empty list of absences', { tag: ['@ORD-ABS-007', '@ORD-ABS-008'] }, async ({ app, as }) => {
    const { s, sub } = await arrange();
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.catalog.subscriptionAbsences.post(coordinator.request, sub.id, { absentDistribIds: [] });

    expect(res.status).toBe(200);
    expect(res.body.absentDistribIds).toEqual([]);
    expect(await queryOne('SELECT absentDistribIds FROM Subscription WHERE id = ?', [sub.id])).toEqual({ absentDistribIds: null });
  });

  test('another member can neither read nor update the absences', { tag: ['@ORD-ABS-008'] }, async ({ app, as }) => {
    const { s, d, sub } = await arrange();
    const other = await as(s.users.member2);

    expect((await app.api.catalog.subscriptionAbsences.get(other.request, sub.id)).status).toBe(403);
    expect((await app.api.catalog.subscriptionAbsences.post(other.request, sub.id, { absentDistribIds: [d[0], d[1]] })).status).toBe(403);
    expect(await storedAbsences(sub.id)).toEqual([d[2], d[3]]);
  });

  test('absences are refused when the catalog does not manage absences', { tag: ['@ORD-ABS-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    // variable catalog with no minimum order per distribution: no absences (Catalog.hasAbsencesManagement)
    const sub = await make.subscription({
      user: s.users.member,
      catalog: s.varCatalog,
      startDate: s.multiDistribs[0].distribStartDate,
      endDate: s.multiDistribs[3].distribEndDate,
    });
    const member = await as(s.users.member);

    expect((await app.api.catalog.subscriptionAbsences.get(member.request, sub.id)).status).toBe(403);
  });
});
