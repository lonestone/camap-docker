/**
 * Order window of a session and of a catalog distribution
 * (specs/04-distributions/order-window-state.md; db/MultiDistrib.hx getState, db/Distribution.hx canOrderNow,
 * controller/Distribution.hx doEdit, controller/Contract.hx doEditVarOrders, service/DistributionService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { addDaysWall, atWallTime } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';

const day = (clock: { now(): Date }, n: number) => make.parisDate(addDaysWall(clock.now(), n));
const inDays = (clock: { now(): Date }, n: number) => addDaysWall(clock.now(), n);

async function selected(app: any, as: any, s: any, who: keyof typeof s.users) {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

test.describe('the state of a session', () => {
  /** A session `date` days from now whose own order window is [open, close] days from now; with the variable catalog taking part unless `vendor` is false. */
  async function session(s: Awaited<ReturnType<typeof make.amapScenario>>, clock: { now(): Date }, p: { date: number | Date; open: number; close: number; vendor?: boolean; own?: { open: number; close: number } }) {
    const start = p.date instanceof Date ? p.date : atWallTime(inDays(clock, p.date), 18);
    const md = await make.multiDistrib({ group: s.group, place: s.place, start, orderStart: inDays(clock, p.open), orderEnd: inDays(clock, p.close) });
    if (p.vendor !== false) {
      await make.distribution({
        catalog: s.varCatalog,
        multiDistrib: md,
        ...(p.own ? { orderStart: inDays(clock, p.own.open), orderEnd: inDays(clock, p.own.close) } : {}),
      });
    }
    return md;
  }

  test('is not yet open, open, closed or distributed, by the order dates and the distribution date', { tag: ['@DIS-OWS-001', '@DIS-OWS-002', '@DIS-OWS-003', '@DIS-OWS-004', '@DIS-OWS-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario({ distribs: 0 });
    await session(s, clock, { date: new Date(clock.now().getTime() - 3 * 3_600_000), open: -10, close: -4 }); // distribution started 3 hours ago
    await session(s, clock, { date: 3, open: 1, close: 2 });
    await session(s, clock, { date: 6, open: -2, close: 2 });
    await session(s, clock, { date: 9, open: -10, close: -1 });
    await session(s, clock, { date: 12, open: -10, close: 5, vendor: false }); // no variable-orders vendor
    const a = await selected(app, as, s, 'groupAdmin');

    const page = await app.views.sessions.overview(a.request);

    expect(page.status).toBe(200);
    // sessions are listed by date; no session is ever "validated"
    expect(page.states).toEqual(['distributed', 'notYetOpen', 'open', 'closed', 'none']);
  });

  test('the opening and closing dates of vendors with their own order dates count (earliest opening, latest closing)', { tag: ['@DIS-OWS-002', '@DIS-OWS-003'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario({ distribs: 0 });
    await session(s, clock, { date: 6, open: 1, close: 2, own: { open: -1, close: 2 } }); // the session opens tomorrow, but one vendor opened yesterday
    await session(s, clock, { date: 9, open: -10, close: -1, own: { open: -10, close: 3 } }); // the session closed yesterday, but one vendor closes in 3 days
    const a = await selected(app, as, s, 'groupAdmin');

    const page = await app.views.sessions.overview(a.request);

    expect(page.states).toEqual(['open', 'open']);
  });

  test('once the distribution has started the session is distributed, even with open order dates', { tag: ['@DIS-OWS-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario({ distribs: 0 });
    await session(s, clock, { date: new Date(clock.now().getTime() - 2 * 3_600_000), open: -10, close: 3 });
    const a = await selected(app, as, s, 'groupAdmin');

    const page = await app.views.sessions.overview(a.request);

    expect(page.states).toEqual(['distributed']);
  });
});

test.describe('ordering inside the window', () => {
  /** The member has an order of 2 boxes at the first session, whose window is set by `open`/`close` days from now. */
  async function arrange(app: any, as: any, clock: { now(): Date }, window: { open: number; close: number }) {
    const s = await make.amapScenario({ distribs: 1 });
    const md = s.multiDistribs[0];
    await query('UPDATE Distribution SET orderStartDate = ?, orderEndDate = ? WHERE id = ?', [`${day(clock, window.open)} 12:00:00`, `${day(clock, window.close)} 12:00:00`, s.distributions[0].var.id]);
    const sub = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: day(clock, -29), endDate: day(clock, 300) });
    const basket = await make.basket({ user: s.users.member, multiDistrib: md });
    const order = await make.userOrder({ user: s.users.member, product: s.products.var[0], distribution: s.distributions[0].var, basket, subscription: sub, quantity: 2 });
    await make.operation({ user: s.users.member, group: s.group, type: 'VOrder', amount: -4.8, basket }); // the legacy page rewrites the basket's order operation
    const member = await selected(app, as, s, 'member');
    const quantity = async () => (await queryOne<{ quantity: number }>('SELECT quantity FROM UserOrder WHERE id = ?', [order.id]))!.quantity;
    return { s, md, member, quantity };
  }

  test('an order can be edited strictly between the opening and the closing dates of the distribution', { tag: ['@DIS-OWS-006'] }, async ({ app, as, clock }) => {
    const { s, md, member, quantity } = await arrange(app, as, clock, { open: -2, close: 3 });

    await app.actions.orders.editVarOrders(member.request, md.id, { [s.products.var[0].id]: 5 });

    expect(await quantity()).toBe(5);
  });

  test('an order of a distribution that is closed is left as it is', { tag: ['@DIS-OWS-006'] }, async ({ app, as, clock }) => {
    const { s, md, member, quantity } = await arrange(app, as, clock, { open: -5, close: -1 });

    await app.actions.orders.editVarOrders(member.request, md.id, { [s.products.var[0].id]: 5 });

    expect(await quantity()).toBe(2);
  });

  test('an order of a distribution that is not yet open is left as it is', { tag: ['@DIS-OWS-006'] }, async ({ app, as, clock }) => {
    const { s, md, member, quantity } = await arrange(app, as, clock, { open: 2, close: 5 });

    await app.actions.orders.editVarOrders(member.request, md.id, { [s.products.var[0].id]: 5 });

    expect(await quantity()).toBe(2);
  });

  test('a catalog that does not accept user orders is left as it is', { tag: ['@DIS-OWS-006'] }, async ({ app, as, clock }) => {
    const { s, md, member, quantity } = await arrange(app, as, clock, { open: -2, close: 3 });
    await make.setCatalog(s.varCatalog.id, { flags: 0 }); // UsersCanOrder off

    await app.actions.orders.editVarOrders(member.request, md.id, { [s.products.var[0].id]: 5 });

    expect(await quantity()).toBe(2);
  });
});

test.describe('own order dates of a catalog distribution', () => {
  const ownDates = (clock: { now(): Date }, open: number, close: number) => ({ orderStart: `${day(clock, open)} 08:00`, orderEnd: `${day(clock, close)} 22:00` });
  const stored = (id: number) => queryOne<{ orderStartDate: string; orderEndDate: string }>('SELECT orderStartDate, orderEndDate FROM Distribution WHERE id = ?', [id]);

  test('a coordinator of a variable catalog gives one distribution its own opening and closing dates', { tag: ['@DIS-OWS-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await selected(app, as, s, 'coordinator');
    const target = s.distributions[1].var;

    const res = await app.actions.sessions.setOrderDates(c.request, target.id, ownDates(clock, 2, 10));

    expect(res.flash?.kind).toBe('ok');
    expect(await stored(target.id)).toEqual({ orderStartDate: `${day(clock, 2)} 08:00:00`, orderEndDate: `${day(clock, 10)} 22:00:00` });
    // the other vendors and the session keep theirs
    const md = await queryOne<{ orderEndDate: string }>('SELECT orderEndDate FROM MultiDistrib WHERE id = ?', [s.multiDistribs[1].id]);
    expect(md!.orderEndDate).not.toBe(`${day(clock, 10)} 22:00:00`);
  });

  test('is not offered for a constant-orders catalog', { tag: ['@DIS-OWS-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await selected(app, as, s, 'coordinator');
    const target = s.distributions[1].const;
    const before = await stored(target.id);

    const res = await app.actions.sessions.setOrderDates(c.request, target.id, ownDates(clock, 2, 10));

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(await stored(target.id)).toEqual(before);
  });

  test('a member without a right on the catalog is sent away', { tag: ['@DIS-OWS-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const m = await selected(app, as, s, 'member');
    const target = s.distributions[1].var;
    const before = await stored(target.id);

    await app.actions.sessions.setOrderDates(m.request, target.id, ownDates(clock, 2, 10));

    expect(await stored(target.id)).toEqual(before);
  });

  test('the new dates are checked against the distribution date', { tag: ['@DIS-OWS-007', '@DIS-OWS-008'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const c = await selected(app, as, s, 'coordinator');
    const target = s.distributions[1].var; // the session is 14 days from now
    const before = await stored(target.id);

    const afterDistribution = await app.actions.sessions.setOrderDates(c.request, target.id, ownDates(clock, 2, 16));
    expect(afterDistribution.flash?.kind).toBe('error');

    const reversed = await app.actions.sessions.setOrderDates(c.request, target.id, ownDates(clock, 10, 5));
    expect(reversed.flash?.kind).toBe('error');

    expect(await stored(target.id)).toEqual(before);
  });
});

test.describe('dates of a catalog distribution', () => {
  test('a distribution date must lie within the catalog dates', { tag: ['@DIS-OWS-008'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario({ distribs: 0 });
    const late = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(inDays(clock, 380), 19) }); // the catalog ends at +335 days
    const early = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(inDays(clock, -45), 19) }); // and starts at -30
    const inside = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(inDays(clock, 60), 19) });
    const a = await selected(app, as, s, 'groupAdmin');

    const afterEnd = await app.actions.sessions.participate(a.request, late.id, s.varCatalog.id);
    const beforeStart = await app.actions.sessions.participate(a.request, early.id, s.varCatalog.id);
    const ok = await app.actions.sessions.participate(a.request, inside.id, s.varCatalog.id);

    expect(afterEnd.flash?.kind).toBe('error');
    expect(beforeStart.flash?.kind).toBe('error');
    expect(ok.flash?.kind).toBe('ok');
    expect(await query('SELECT multiDistribId FROM Distribution')).toEqual([{ multiDistribId: inside.id }]);
  });

  test('a distribution cannot start before its order closing date', { tag: ['@DIS-OWS-008'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario({ distribs: 0 });
    // a session whose orders close after it starts can only come from the database: the forms refuse it (DIS-MDS-005)
    const md = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(inDays(clock, 60), 19), orderStart: inDays(clock, 30), orderEnd: inDays(clock, 61) });
    const a = await selected(app, as, s, 'groupAdmin');

    const res = await app.actions.sessions.participate(a.request, md.id, s.varCatalog.id);

    expect(res.flash?.kind).toBe('error');
    expect(await query('SELECT id FROM Distribution')).toEqual([]);
  });
});
