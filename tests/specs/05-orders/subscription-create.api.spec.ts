/**
 * Subscribing to a catalog and reading a subscription
 * (specs/05-orders/subscription-create.md; camap-hx/src/controller/api/Subscription.hx,
 * service/SubscriptionService.hx).
 */
import { request as pwRequest } from '@playwright/test';
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, queryOne } from '../../src/db/client.js';
import { env } from '../../src/env.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

const subscriptions = () => query('SELECT id, userId, catalogId, startDate, endDate FROM Subscription ORDER BY id');

test.describe('creating a subscription', () => {
  test('a member cannot subscribe to a catalog closed to orders, a coordinator can', { tag: ['@ORD-SUB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await query('UPDATE Catalog SET flags = 0 WHERE id = ?', [s.constCatalog.id]);
    const member = await as(s.users.member);

    await expect(subscribeConst(app, member.request, s, s.users.member.id)).rejects.toThrow(/failed: 500/);
    expect(await subscriptions()).toEqual([]);

    const coordinator = await as(s.users.coordinator);
    const sub = await subscribeConst(app, coordinator.request, s, s.users.member.id);
    expect(sub.user.id).toBe(s.users.member.id);
  });

  test('the subscription starts at the next distribution still open and ends with the catalog', { tag: ['@ORD-SUB-003'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    clock.set('+7d'); // the first distribution is tomorrow: its order window (closes the day before) is closed
    const member = await as(s.users.member);

    const sub = await subscribeConst(app, member.request, s, s.users.member.id);

    const [row] = await query<{ startDate: string; endDate: string }>('SELECT startDate, endDate FROM Subscription WHERE id = ?', [sub.id]);
    const secondDay = s.multiDistribs[1].distribStartDate;
    expect(row.startDate).toBe(`${make.parisDate(secondDay)} 00:00:00`);
    const cat = await queryOne<{ endDate: string }>('SELECT endDate FROM Catalog WHERE id = ?', [s.constCatalog.id]);
    expect(row.endDate).toBe(`${cat!.endDate.slice(0, 10)} 23:59:59`);
  });

  test('a subscription needs a distribution that is not closed', { tag: ['@ORD-SUB-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    clock.set('+40d'); // every scenario distribution is behind us

    await expect(subscribeConst(app, member.request, s, s.users.member.id)).rejects.toThrow(/failed: 500/);
    expect(await subscriptions()).toEqual([]);
  });

  test('two subscriptions of one member to the same catalog cannot overlap, other catalogs of the vendor can', { tag: ['@ORD-SUB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await subscribeConst(app, member.request, s, s.users.member.id);

    await expect(subscribeConst(app, member.request, s, s.users.member.id)).rejects.toThrow(/failed: 500/);

    const other = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.varCatalog.id, // same vendor, another catalog
      defaultOrder: [],
      absentDistribIds: [],
      initialOrders: [],
    });
    expect(other.status).toBe(200);
    expect((await subscriptions()).length).toBe(2);
  });

  test('a non-member joins the group when it is open', { tag: ['@ORD-SUB-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { regOption: 'Open' } });
    const outsider = await as(s.users.nonMember);

    const sub = await subscribeConst(app, outsider.request, s, s.users.nonMember.id);

    expect(sub.user.id).toBe(s.users.nonMember.id);
    expect(await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.nonMember.id, s.group.id])).toHaveLength(1);
  });

  test('a non-member gets an error when the group is not open', { tag: ['@ORD-SUB-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { regOption: 'Closed' } });
    const outsider = await as(s.users.nonMember);

    await expect(subscribeConst(app, outsider.request, s, s.users.nonMember.id)).rejects.toThrow(/failed: 500/);
    expect(await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.nonMember.id, s.group.id])).toHaveLength(0);
    expect(await subscriptions()).toEqual([]);
  });

  test('creating a subscription records orders, the total operation and the balance', { tag: ['@ORD-SUB-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const sub = await subscribeConst(app, member.request, s, s.users.member.id, { quantity: 2 });

    expect(sub.totalOrdered).toBe(120); // 4 distributions x 2 x 15
    expect(sub.balance).toBe(-120);
    expect(await query('SELECT quantity, productPrice FROM UserOrder WHERE subscriptionId = ?', [sub.id])).toHaveLength(4);
    expect(await query('SELECT type, amount, subscriptionId FROM Operation WHERE userId = ?', [s.users.member.id])).toEqual([
      { type: 1, amount: -120, subscriptionId: sub.id },
    ]);
    const ug = await queryOne<{ balance: number }>('SELECT balance FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);
    expect(ug!.balance).toBe(-120);
  });

  test('the member and the coordinator are notified of a subscription (hourly digest)', { tag: ['@ORD-SUB-012', '@COM-DGT-001', '@COM-DGT-002', '@COM-AUT-001'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await make.amapScenario();
    clock.set('+8d'); // the first distribution is past: the coordinator is told as well
    const member = await as(s.users.member);
    const mark = await mails.mark();

    await subscribeConst(app, member.request, s, s.users.member.id);

    const pending = await query<{ digest: number; recipientId: number }>('SELECT digest, recipientId FROM NotificationMail ORDER BY digest');
    expect(pending).toEqual([
      { digest: 1, recipientId: s.users.member.id },
      { digest: 11, recipientId: s.users.coordinator.id },
    ]);
    await cron.run('hour');
    expect(await mails.to(s.users.member.email, mark)).not.toHaveLength(0);
    expect(await mails.to(s.users.coordinator.email, mark)).not.toHaveLength(0);
  });
});

test.describe('reading a subscription', () => {
  test('the owner reads the distributions, orders, constraints, total and balance', { tag: ['@ORD-SUB-015'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const created = await subscribeConst(app, member.request, s, s.users.member.id);

    const res = await app.api.subscription.get(member.request, created.id);

    expect(res.status).toBe(200);
    expect(res.body.distributions.map((d) => d.id)).toEqual(s.distributions.map((d) => d.const.id));
    expect(res.body.distributions[0].orders).toEqual([expect.objectContaining({ productId: s.products.const[0].id, qty: 1 })]);
    expect(res.body.constraints).toContain('Panier de légumes');
    expect(res.body.totalOrdered).toBe(60);
    expect(res.body.balance).toBe(-60);
    expect(res.body.minSubscriptionOrder).toBe(0);
  });

  test('only the owner, a coordinator or an admin can read a subscription (UND-068)', { tag: ['@ORD-SUB-016'] }, async ({ app, as }) => {
    deviation('UND-068');
    const s = await make.amapScenario();
    const sub = await make.subscription({
      user: s.users.member,
      catalog: s.constCatalog,
      startDate: s.multiDistribs[0].distribStartDate,
      endDate: s.multiDistribs[3].distribEndDate,
    });
    const status = async (who: Parameters<typeof as>[0]) => (await app.api.subscription.get((await as(who)).request, sub.id)).status;

    expect(await status(s.users.member)).toBe(200);
    expect(await status(s.users.coordinator)).toBe(200);
    expect(await status(s.users.groupAdmin)).toBe(200);
    expect(await status(s.users.member2)).toBe(403);
    const anon = await pwRequest.newContext({ baseURL: env.baseUrl });
    expect([401, 403]).toContain((await app.api.subscription.get(anon, sub.id)).status);
  });
});

test.describe('deleting my own subscription', () => {
  test('a member deletes their subscription and its orders and operations', { tag: ['@ORD-SUB-017', '@ORD-SBM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);

    const res = await app.actions.subscription.deleteOwn(member.request, sub.id);

    expect(res.status).toBe(302);
    expect(res.location).toContain(`/subscriptions/contract/${s.constCatalog.id}`);
    expect(await subscriptions()).toEqual([]);
    expect(await query('SELECT id FROM UserOrder')).toEqual([]);
    expect(await query('SELECT id FROM Operation')).toEqual([]);
    const ug = await queryOne<{ balance: number }>('SELECT balance FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id]);
    expect(ug!.balance).toBe(0);
  });

  test('another member cannot delete my subscription', { tag: ['@ORD-SUB-017'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    const other = await as(s.users.member2);

    const res = await app.actions.subscription.deleteOwn(other.request, sub.id);

    expect(res.status).toBe(302);
    expect(await subscriptions()).toHaveLength(1);
  });

  test('a subscription with a past ordered distribution cannot be deleted', { tag: ['@ORD-SBM-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    clock.set('+8d'); // the first distribution has been held

    await app.actions.subscription.deleteOwn(member.request, sub.id);

    expect(await subscriptions()).toHaveLength(1);
    expect(await query('SELECT id FROM UserOrder WHERE subscriptionId = ?', [sub.id])).toHaveLength(4);
  });

  test('a subscription with a recorded payment cannot be deleted', { tag: ['@ORD-SBM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 20, subscription: sub });

    await app.actions.subscription.deleteOwn(member.request, sub.id);

    expect(await subscriptions()).toHaveLength(1);
  });

  test('deleting needs a confirmed POST with a security token (UND-070)', { tag: ['@ORD-SUB-018'] }, async ({ app, as }) => {
    deviation('UND-070');
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeConst(app, member.request, s, s.users.member.id);

    await app.actions.subscription.deleteOwn(member.request, sub.id); // a bare request, no token

    expect(await subscriptions()).toHaveLength(1);
  });
});
