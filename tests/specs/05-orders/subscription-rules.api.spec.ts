/**
 * Remaining rules of subscriptions, default orders and what the ordering screens read
 * (specs/05-orders/absences.md, constant-orders.md, variable-orders.md, order-minimums.md,
 * order-placement.md, subscription-create.md, subscription-admin.md, admin-orders.md, order-history.md;
 * controller/api/Subscription.hx, api/Catalog.hx, service/SubscriptionService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import { absentDistribIds } from '../../src/encodings/columns.js';
import { addHours, atWallTime } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst, subscribeVar } from '../../src/flows.js';

const lines = (subId: number) =>
  query<{ id: number; distributionId: number; productId: number; quantity: number; productPrice: number }>(
    'SELECT id, distributionId, productId, quantity, productPrice FROM UserOrder WHERE subscriptionId = ? ORDER BY distributionId, id',
    [subId],
  );

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

const constLine = (s: Scenario, quantity: number, extra: Record<string, unknown> = {}) => [
  { productId: s.products.const[0].id, productPrice: s.products.const[0].price, quantity, ...extra },
];

test.describe('absences', () => {
  test('a coordinator sees the absences of the subscribers in the attendance of a constant catalog', { tag: ['@ORD-ABS-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[3], d[1]] });
    await subscribeConst(app, (await as(s.users.member2)).request, s, s.users.member2.id);
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);

    const res = await app.api.distributions.attendanceClassic(coordinator.request, s.constCatalog.id);

    expect(res.errors).toBeNull();
    const rows = res.data!.attendanceClassicContract.subscriptions;
    expect(rows).toHaveLength(2);
    const mine = rows.find((r) => r.id === sub.id)!;
    expect(absentDistribIds.decode(mine.absentDistribIds)).toEqual([d[1], d[3]]);
    expect(rows.find((r) => r.id !== sub.id)!.absentDistribIds ?? '').toBe('');
  });

  test('a coordinator creates a subscription with the same absence rules as a member (UND-078, characterised)', { tag: ['@ORD-ABS-011'] }, async ({ app, as }) => {
    // the absence count is only checked on an existing subscription, so admin mode makes no difference at creation
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    const coordinator = await as(s.users.coordinator);
    const member2 = await as(s.users.member2);
    const body = (userId: number) => ({ userId, catalogId: s.constCatalog.id, defaultOrder: constLine(s, 1), absentDistribIds: [d[2]], initialOrders: [] }); // 1 absence, 2 allowed

    const byCoordinator = await app.api.subscription.create(coordinator.request, body(s.users.member.id));
    const bySelf = await app.api.subscription.create(member2.request, body(s.users.member2.id));

    expect(byCoordinator.status).toBe(200);
    expect(bySelf.status).toBe(200);
    expect(byCoordinator.body.absentDistribIds).toEqual([d[2]]);
    expect(bySelf.body.absentDistribIds).toEqual([d[2]]);
  });
});

test.describe('default orders', () => {
  test('a coordinator changing the default order of a constant catalog rewrites every order, past ones included, at the current price (UND-079, characterised)', { tag: ['@ORD-CST-003', '@ORD-OPL-009'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    const before = await lines(sub.id);
    clock.set('+8d'); // the first distribution has been held
    await make.setProduct(s.products.const[0].id, { price: 20 }); // the vendor raised the price meanwhile

    const res = await app.api.subscription.updateDefaultOrder(coordinator.request, sub.id, constLine(s, 2));

    expect(res.status).toBe(200);
    const after = await lines(sub.id);
    expect(after.map((l) => [l.distributionId, l.quantity, l.productPrice])).toEqual(s.distributions.map((x) => [x.const.id, 2, 20]));
    expect(after.map((l) => l.id).filter((id) => before.some((b) => b.id === id))).toEqual([]); // the lines were deleted, whatever their quantity, and recreated
  });

  test('saving the default order of a variable catalog replaces the manual changes of the distributions not yet closed (UND-079, characterised)', { tag: ['@ORD-VAR-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 2 });
    const [e6, e12] = s.products.var;
    const dist = s.distributions.map((x) => x.var.id);
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id, { defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 1 }] });
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dist[1], orders: [{ productId: e12.id, qty: 2 }] }]); // a manual addition
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: dist[0], orders: [{ productId: e12.id, qty: 1 }] }]); // and one on the distribution that will close
    clock.set('+8d'); // the first distribution is closed
    const closed = (await lines(sub.id)).filter((l) => l.distributionId === dist[0]);

    const res = await app.api.subscription.updateDefaultOrder(member.request, sub.id, [{ productId: e6.id, productPrice: e6.price, quantity: 2 }]);

    expect(res.status).toBe(200);
    const after = await lines(sub.id);
    expect(after.filter((l) => l.distributionId === dist[0])).toEqual(closed); // closed: left alone
    for (const d of dist.slice(1)) expect(after.filter((l) => l.distributionId === d).map((l) => [l.productId, l.quantity])).toEqual([[e6.id, 2]]); // the manual line of dist[1] is gone
  });

  test('a second person is recorded and the basket alternates each distribution, an invert option flips it', { tag: ['@ORD-CST-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const other = await as(s.users.member2);
    await app.actions.group.select(member.request, s.group.id);
    await app.actions.group.select(other.request, s.group.id);
    const create = (invertSharedOrder: boolean) =>
      app.api.subscription.create(member.request, { userId: s.users.member.id, catalogId: s.constCatalog.id, defaultOrder: constLine(s, 1, { userId2: s.users.member2.id, invertSharedOrder }), absentDistribIds: [], initialOrders: [] });

    const sub = await create(false);

    expect(sub.status).toBe(200);
    expect(await app.views.subscriptions.sharedBasketTurns(member.request)).toEqual(['mine', 'theirs', 'mine', 'theirs']);
    // the second person sees the same orders on their own page, with the opposite turns
    expect(await app.views.subscriptions.sharedBasketTurns(other.request)).toEqual(['theirs', 'mine', 'theirs', 'mine']);

    await query('UPDATE UserOrder SET flags = 1 WHERE subscriptionId = ?', [sub.body.id]); // InvertSharedOrder
    expect(await app.views.subscriptions.sharedBasketTurns(member.request)).toEqual(['theirs', 'mine', 'theirs', 'mine']);
  });

  test('only one second person is allowed per subscription', { tag: ['@ORD-CST-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [p1] = s.products.const;
    const p2 = await make.product({ catalog: s.constCatalog, name: 'Panier de fruits', price: 10 });
    const member = await as(s.users.member);

    const res = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.constCatalog.id,
      defaultOrder: [
        { productId: p1.id, productPrice: p1.price, quantity: 1, userId2: s.users.member2.id, invertSharedOrder: false },
        { productId: p2.id, productPrice: p2.price, quantity: 1, userId2: s.users.coordinator.id, invertSharedOrder: false },
      ],
      absentDistribIds: [],
      initialOrders: [],
    });

    expect(res.status).toBe(500);
    expect(await query('SELECT id FROM Subscription')).toEqual([]);
  });
});

test.describe('minimums read by the ordering screen', () => {
  test('the catalog gives the screen its minimums, and the subscription the minimum it must reach', { tag: ['@ORD-MIN-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 3, catalogMinOrdersTotal: 42 });
    const [e6] = s.products.var;
    const member = await as(s.users.member);

    const catalog = await app.api.catalog.get(member.request, s.varCatalog.id);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id, {
      defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 5 }], // 12 per distribution, 48 in all
    });

    expect([catalog.body.distribMinOrdersTotal, catalog.body.catalogMinOrdersTotal]).toEqual([3, 42]);
    expect((await app.api.subscription.get(member.request, sub.id)).body.minSubscriptionOrder).toBe(42);
  });

  test('the minimum estimate follows the share of the distributions without absences, rounded down', { tag: ['@ORD-MIN-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 3, catalogMinOrdersTotal: 42, absentDistribsMaxNb: 1 });
    await query('UPDATE Catalog v, Catalog c SET v.absencesStartDate = c.absencesStartDate, v.absencesEndDate = c.absencesEndDate WHERE v.id = ? AND c.id = ?', [s.varCatalog.id, s.constCatalog.id]);
    const [e6] = s.products.var;
    const member = await as(s.users.member);

    const res = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.varCatalog.id,
      defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 5 }],
      absentDistribIds: [s.distributions[3].var.id],
      initialOrders: [],
    });

    expect(res.status).toBe(200);
    expect(res.body.minSubscriptionOrder).toBe(31); // 42 x 3/4 = 31.5
  });

  test('saving is refused below the estimate the screen shows and accepted at it', { tag: ['@ORD-MIN-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { catalogMinOrdersTotal: 42 });
    const [e6] = s.products.var;
    const d0 = s.distributions[0].var.id;
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id, { initialOrders: [{ id: d0, orders: [{ productId: e6.id, qty: 18 }] }] }); // 43.20
    const min = (await app.api.subscription.get(member.request, sub.id)).body.minSubscriptionOrder!;
    expect(min).toBe(42);

    const low = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: d0, orders: [{ productId: e6.id, qty: 17 }] }]); // 40.80
    const exact = await app.api.subscription.updateOrders(member.request, sub.id, [{ id: d0, orders: [{ productId: e6.id, qty: 18 }] }]);

    expect(low.status).toBe(500);
    expect(exact.status).toBe(200);
  });
});

test.describe('what the ordering screen knows of each distribution', () => {
  test('each distribution is open, not yet open, closed or absent, from its order dates and my absences', { tag: ['@ORD-OPL-011'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const d = s.distributions.map((x) => x.const.id);
    clock.set('+7d'); // the first distribution is closed, the second open, the others not open yet
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { absentDistribIds: [d[3]] });

    const catalog = (await app.api.catalog.get(member.request, s.constCatalog.id)).body;
    const mine = (await app.api.subscription.get(member.request, sub.id)).body;

    const now = clock.now();
    const stateOf = (x: { id: number; orderStartDate: string; orderEndDate: string }) =>
      mine.absentDistribIds.includes(x.id) ? 'absent' : new Date(x.orderStartDate) > now ? 'notYetOpen' : new Date(x.orderEndDate) < now ? 'closed' : 'open';
    expect(catalog.distributions.map((x) => x.id)).toEqual(d);
    expect(catalog.distributions.map(stateOf)).toEqual(['closed', 'open', 'notYetOpen', 'absent']);
  });
});

test.describe('creating a subscription in member mode (UND-067)', () => {
  /** The first distribution of the day is over, and another one is still open later the same day, so the subscription starts at midnight of that day. */
  async function lateDayScenario(clock: { set(to: Date | string): Date }) {
    const s = await make.amapScenario();
    const first = s.multiDistribs[0];
    const start = atWallTime(first.distribStartDate, 22);
    const late = await make.multiDistrib({ group: s.group, place: s.place, start, end: addHours(start, 1), orderStart: addHours(start, -48), orderEnd: addHours(start, -1) });
    await make.distribution({ catalog: s.constCatalog, multiDistrib: late });
    clock.set(addHours(first.distribEndDate, 0.5)); // 20:30 that day: the 18:00 distribution is past, the 22:00 one is open
    return s;
  }

  test('a coordinator can create a subscription that contains a past distribution without an order', { tag: ['@ORD-SUB-008', '@ORD-SUB-010'] }, async ({ app, as, clock }) => {
    const s = await lateDayScenario(clock);
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.subscription.create(coordinator.request, { userId: s.users.member.id, catalogId: s.constCatalog.id, defaultOrder: constLine(s, 1), absentDistribIds: [], initialOrders: [] });

    expect(res.status).toBe(200);
  });

  test('a member cannot create a subscription that contains a past distribution without an order', { tag: ['@ORD-SUB-008', '@ORD-SUB-010'] }, async ({ app, as, clock }) => {
    deviation('UND-067');
    const s = await lateDayScenario(clock);
    const member = await as(s.users.member);

    const res = await app.api.subscription.create(member.request, { userId: s.users.member.id, catalogId: s.constCatalog.id, defaultOrder: constLine(s, 1), absentDistribIds: [], initialOrders: [] });

    expect(res.status).toBe(500);
    expect(await query('SELECT id FROM Subscription')).toEqual([]);
  });
});

test.describe('renewal', () => {
  test('duplicating a catalog for the next season copies no subscription (UND-083, characterised)', { tag: ['@ORD-SUB-014'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await subscribeConst(app, member.request, s, s.users.member.id);
    const admin = await as(s.users.groupAdmin);
    await app.actions.group.select(admin.request, s.group.id);

    const res = await app.actions.catalogs.duplicate(admin.request, s.constCatalog.id, { name: 'Légumes saison suivante' });

    expect(res.status).toBe(302);
    const [copy] = await query<{ id: number }>('SELECT id FROM Catalog WHERE name = ?', ['Légumes saison suivante']);
    expect(await query('SELECT id FROM Subscription WHERE catalogId = ?', [copy.id])).toEqual([]);
    expect(await query('SELECT id FROM Subscription')).toHaveLength(1); // the member's subscription stays on the old catalog
  });
});

test.describe('the batch ordering page reads the subscriptions of a catalog', () => {
  test('a coordinator lists the subscribed members with their dates, and picks the first subscription ending in the future', { tag: ['@ORD-SBM-011', '@ORD-ADO-001'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const [m0, m1, m2, m3] = s.multiDistribs;
    const ended = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: m0.distribStartDate, endDate: m0.distribEndDate });
    const current = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: m2.distribStartDate, endDate: m3.distribEndDate });
    const other = await make.subscription({ user: s.users.member2, catalog: s.varCatalog, startDate: m1.distribStartDate, endDate: m3.distribEndDate });
    clock.set('+10d'); // the first subscription is over
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.catalog.subscriptionsOf(coordinator.request, s.varCatalog.id);

    expect(res.errors).toBeNull();
    const subs = res.data!.catalog.subscriptions;
    expect(subs.map((x) => [x.id, x.user.id]).sort()).toEqual([
      [ended.id, s.users.member.id],
      [current.id, s.users.member.id],
      [other.id, s.users.member2.id],
    ].sort());
    const pick = (userId: number) => subs.filter((x) => x.user.id === userId).find((x) => new Date(x.endDate) >= clock.now());
    expect(pick(s.users.member.id)?.id).toBe(current.id);
    expect(pick(s.users.member2.id)?.id).toBe(other.id);
  });

  test('a member cannot list the subscriptions of a catalog', { tag: ['@ORD-SBM-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.api.catalog.subscriptionsOf(member.request, s.varCatalog.id);

    expect(res.errors).not.toBeNull();
  });

  test('a coordinator creates the subscription of a member who has none, then orders for them', { tag: ['@ORD-ADO-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [e6] = s.products.var;
    const coordinator = await as(s.users.coordinator);

    const sub = await subscribeVar(app, coordinator.request, s, s.users.member.id);
    const res = await app.api.subscription.updateOrders(coordinator.request, sub.id, [{ id: s.distributions[1].var.id, orders: [{ productId: e6.id, qty: 2 }] }]);

    expect(res.status).toBe(200);
    expect(await query('SELECT userId, quantity FROM UserOrder WHERE subscriptionId = ?', [sub.id])).toEqual([{ userId: s.users.member.id, quantity: 2 }]);
  });
});

test.describe('the order summary email', () => {
  test('hx today: no order summary email is sent after an order, the mail exists only as a template', { tag: ['@ORD-HIS-008'] }, async ({ app, as, cron, mails }) => {
    // OrderService.sendOrderSummaryToMembers is called by nothing: the member gets only the subscription notification
    const s = await make.amapScenario();
    const [e6] = s.products.var;
    const mark = await mails.mark();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: s.distributions[1].var.id, orders: [{ productId: e6.id, qty: 2 }] }]);
    await cron.run('minute');
    await cron.run('hour');
    await cron.run('daily');

    const sent = await mails.since(mark);

    expect(sent.filter((m) => /Votre commande pour le/.test(m.title) || /Récapitulatif de votre commande/.test(m.htmlBody ?? ''))).toEqual([]);
  });
});
