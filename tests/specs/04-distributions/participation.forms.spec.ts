/**
 * Catalog participation in sessions, shifting, price changes, session scope, cycles on the distributions page
 * (specs/04-distributions/distribution-participation.md, multidistrib-schedule.md, cycles.md;
 * controller/Distribution.hx, ContractAdmin.hx, service/DistributionService.hx). The rest of these
 * statements is in sessions.forms.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, queryOne } from '../../src/db/client.js';
import { addDaysWall, atWallTime } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';
import { subscribeVar } from '../../src/flows.js';

const day = (clock: { now(): Date }, n: number) => make.parisDate(addDaysWall(clock.now(), n));

async function selected(app: any, as: any, s: any, who: keyof typeof s.users) {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

const distributionsOf = (md: number) => query<{ id: number; catalogId: number; date: string; quantities: number }>('SELECT id, catalogId, date, quantities FROM Distribution WHERE multiDistribId = ? ORDER BY id', [md]);
const rolesOf = async (md: number) => ((await queryOne<{ volunteerRolesIds: string | null }>('SELECT volunteerRolesIds FROM MultiDistrib WHERE id = ?', [md]))!.volunteerRolesIds ?? '').split(',').filter(Boolean);

test.describe('joining a session with subscriptions', () => {
  test('a constant-orders catalog with subscriptions cannot join a session; a variable one joins with a warning', { tag: ['@DIS-PAR-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const md = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 60), 19) });
    await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: day(clock, -29), endDate: day(clock, 300) });
    await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: day(clock, -29), endDate: day(clock, 300) });
    const a = await selected(app, as, s, 'groupAdmin');

    const refused = await app.actions.sessions.participate(a.request, md.id, s.constCatalog.id);
    expect(refused.flash?.kind).toBe('error');
    expect(refused.flash?.text).toContain('souscriptions');
    expect(await distributionsOf(md.id)).toEqual([]);

    const warned = await app.actions.sessions.participate(a.request, md.id, s.varCatalog.id);
    // the warning comes first, then the confirmation (the page adds a hint of its own after them)
    expect(warned.alerts?.slice(0, 2).map((x) => x.kind)).toEqual(['error', 'ok']);
    expect(warned.alerts?.[0].text).toContain('souscriptions');
    expect((await distributionsOf(md.id)).map((d) => d.catalogId)).toEqual([s.varCatalog.id]);
  });

  test('a catalog without subscriptions joins with no warning', { tag: ['@DIS-PAR-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const md = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 60), 19) });
    const a = await selected(app, as, s, 'groupAdmin');

    const res = await app.actions.sessions.participate(a.request, md.id, s.constCatalog.id);

    expect(res.flash?.kind).toBe('ok');
    expect(res.alerts?.some((x) => /souscriptions/.test(x.text))).toBe(false);
    expect(await distributionsOf(md.id)).toHaveLength(1);
  });
});

test.describe('the sessions of a catalog', () => {
  test('lists the sessions from the first distribution up to the end date, within a year unless a period is chosen', { tag: ['@DIS-PAR-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario({ distribs: 2 });
    // the catalog runs for years: its first distribution is the first session, the page stops one year later
    await make.setCatalog(s.constCatalog.id, { endDate: `${day(clock, 900)} 23:59:59`, firstDistribId: s.multiDistribs[0].id });
    const inside = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 300), 18) });
    const beyond = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 500), 18) });
    const a = await selected(app, as, s, 'groupAdmin');

    const page = await app.views.sessions.catalogSessions(a.request, s.constCatalog.id);

    expect(page.status).toBe(200);
    const joined = s.distributions.map((d) => d.const.id);
    expect(page.participating).toEqual(joined); // sessions where the catalog already takes part, in date order
    expect(page.joinable).toContain(inside.id);
    expect(page.joinable).not.toContain(beyond.id);

    const chosen = await app.views.sessions.catalogSessions(a.request, s.constCatalog.id, { from: day(clock, 450), to: day(clock, 550) });
    expect(chosen.joinable).toEqual([beyond.id]);
    expect(chosen.participating).toEqual([]);
  });

  test('without a first distribution, the page starts at the catalog start date', { tag: ['@DIS-PAR-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario({ distribs: 1 });
    const before = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), -20), 18) });
    const a = await selected(app, as, s, 'groupAdmin');

    const page = await app.views.sessions.catalogSessions(a.request, s.constCatalog.id);

    expect(page.joinable).toEqual([before.id]);
    expect(page.participating).toEqual([s.distributions[0].const.id]);
  });
});

test.describe('who can change the sessions of a catalog', () => {
  test('a coordinator can make a catalog take part in a session even if they do not manage it (UND-060, characterised)', { tag: ['@DIS-PAR-008'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' }); // the coordinator has no right on it
    const md = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 60), 19) });
    const c = await selected(app, as, s, 'coordinator');

    await app.actions.sessions.participate(c.request, md.id, other.id); // the confirmation is lost: the page it redirects to refuses this coordinator

    expect((await distributionsOf(md.id)).map((d) => d.catalogId)).toEqual([other.id]);
  });

  test('a member without any catalog right is sent away', { tag: ['@DIS-PAR-008'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const md = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 60), 19) });
    const m = await selected(app, as, s, 'member');

    const res = await app.actions.sessions.participate(m.request, md.id, s.constCatalog.id);

    expect(res.status).toBe(302);
    expect(await distributionsOf(md.id)).toEqual([]);
  });

  test('ticking and unticking the catalogs of a session, with the default roles added to an empty session (UND-060: no right check)', { tag: ['@DIS-PAR-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const caisse = await make.volunteerRole({ group: s.group, name: 'Caisse', enabledByDefault: true });
    await make.volunteerRole({ group: s.group, name: 'Rangement', enabledByDefault: false });
    const md = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 60), 19) });
    const a = await selected(app, as, s, 'groupAdmin');

    const add = await app.actions.sessions.setCatalogs(a.request, md.id, [s.constCatalog.id, s.varCatalog.id]);

    expect(add.flash?.kind).toBe('ok');
    expect((await distributionsOf(md.id)).map((d) => d.catalogId)).toEqual([s.constCatalog.id, s.varCatalog.id]);
    expect(await rolesOf(md.id)).toEqual([String(caisse.id)]);

    await app.actions.sessions.setCatalogs(a.request, md.id, [s.constCatalog.id]);
    expect((await distributionsOf(md.id)).map((d) => d.catalogId)).toEqual([s.constCatalog.id]);

    // the handler checks no right: a plain member unticks the last one
    const m = await selected(app, as, s, 'member');
    await app.actions.sessions.setCatalogs(m.request, md.id, []);
    expect(await distributionsOf(md.id)).toEqual([]);
  });

  test('a session that already has a vendor keeps its roles when another one is ticked', { tag: ['@DIS-PAR-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.volunteerRole({ group: s.group, name: 'Caisse', enabledByDefault: true });
    const a = await selected(app, as, s, 'groupAdmin');
    const md = s.multiDistribs[0];
    const before = await rolesOf(md.id);

    await app.actions.sessions.setCatalogs(a.request, md.id, [s.constCatalog.id, s.varCatalog.id]);

    expect(await rolesOf(md.id)).toEqual(before);
  });
});

test.describe('shifting a participation', () => {
  test('moves the distribution to another session, with its dates, and moves the catalog roles and removes their volunteers', { tag: ['@DIS-PAR-010'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const target = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 60), 19) });
    const role = await make.volunteerRole({ group: s.group, name: 'Livraison', catalog: s.varCatalog });
    const generic = await make.volunteerRole({ group: s.group, name: 'Caisse' });
    const source = s.multiDistribs[0];
    await query('UPDATE MultiDistrib SET volunteerRolesIds = ? WHERE id = ?', [`${generic.id},${role.id}`, source.id]);
    await make.volunteer({ user: s.users.member, multiDistrib: source, role });
    await make.volunteer({ user: s.users.member2, multiDistrib: source, role: generic });
    const c = await selected(app, as, s, 'coordinator');
    const moved = s.distributions[0].var;

    const res = await app.actions.sessions.shift(c.request, moved.id, target.id);

    expect(res.flash?.kind).toBe('ok');
    const row = await queryOne<{ multiDistribId: number; date: string; end: string; orderStartDate: string; orderEndDate: string }>('SELECT multiDistribId, date, end, orderStartDate, orderEndDate FROM Distribution WHERE id = ?', [moved.id]);
    const md = await queryOne<{ distribStartDate: string; distribEndDate: string; orderStartDate: string; orderEndDate: string }>('SELECT distribStartDate, distribEndDate, orderStartDate, orderEndDate FROM MultiDistrib WHERE id = ?', [target.id]);
    expect(row).toEqual({ multiDistribId: target.id, date: md!.distribStartDate, end: md!.distribEndDate, orderStartDate: md!.orderStartDate, orderEndDate: md!.orderEndDate });
    // the catalog's role leaves the old session with its volunteer and joins the new one; the generic role stays
    expect(await rolesOf(source.id)).toEqual([String(generic.id)]);
    expect(await rolesOf(target.id)).toContain(String(role.id));
    expect(await query('SELECT userId, volunteerRoleId FROM Volunteer WHERE multiDistribId = ?', [source.id])).toEqual([{ userId: s.users.member2.id, volunteerRoleId: generic.id }]);
  });

  test('refuses a session outside the catalog dates', { tag: ['@DIS-PAR-010'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const late = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 380), 19) }); // the catalog ends at +335 days
    const c = await selected(app, as, s, 'coordinator');
    const moved = s.distributions[0].var;

    const res = await app.actions.sessions.shift(c.request, moved.id, late.id);

    expect(res.flash?.kind).toBe('error');
    expect((await queryOne<{ multiDistribId: number }>('SELECT multiDistribId FROM Distribution WHERE id = ?', [moved.id]))!.multiDistribId).toBe(s.multiDistribs[0].id);
  });

  test('when the catalog already takes part in the target, the orders move there and the distribution counts twice', { tag: ['@DIS-PAR-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    const [e6] = s.products.var;
    const [from, to] = [s.distributions[0].var, s.distributions[1].var];
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: from.id, orders: [{ productId: e6.id, qty: 2 }] }]);
    const c = await selected(app, as, s, 'coordinator');

    const res = await app.actions.sessions.shift(c.request, from.id, s.multiDistribs[1].id);

    expect(res.flash?.kind).toBe('ok');
    expect(await query('SELECT id FROM Distribution WHERE id = ?', [from.id])).toEqual([]);
    // FINDING: the service does `quantities++` on the target but never saves it, so the distribution does not "count twice" in the DB
    expect((await queryOne<{ quantities: number }>('SELECT quantities FROM Distribution WHERE id = ?', [to.id]))!.quantities).toBe(1);
    const orders = await query<{ distributionId: number; quantity: number; basketId: number }>('SELECT distributionId, quantity, basketId FROM UserOrder WHERE subscriptionId = ?', [sub.id]);
    expect(orders).toEqual([{ distributionId: to.id, quantity: 2, basketId: orders[0].basketId }]);
    const basket = await queryOne<{ multiDistribId: number }>('SELECT multiDistribId FROM Basket WHERE id = ?', [orders[0].basketId]);
    expect(basket!.multiDistribId).toBe(s.multiDistribs[1].id);
  });

  test('is refused when a subscriber is absent on the target but not on the source', { tag: ['@DIS-PAR-010'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const [source, target] = [s.distributions[0].const, s.distributions[1].const];
    const sub = await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: day(clock, -29), endDate: day(clock, 300), absentDistribIds: [target.id] });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member, product: s.products.const[0], distribution: source, basket, subscription: sub });
    const c = await selected(app, as, s, 'coordinator');

    const res = await app.actions.sessions.shift(c.request, source.id, s.multiDistribs[1].id);

    expect(res.flash?.kind).toBe('error');
    expect(await query('SELECT id FROM Distribution WHERE id = ?', [source.id])).toHaveLength(1);
    expect((await queryOne<{ distributionId: number }>('SELECT distributionId FROM UserOrder WHERE subscriptionId = ?', [sub.id]))!.distributionId).toBe(source.id);
  });

  test('extends the subscriptions that end before the new date', { tag: ['@DIS-PAR-010'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const [source, last] = [s.distributions[0].const, s.distributions[3].const];
    await query('DELETE FROM Distribution WHERE id = ?', [last.id]); // the catalog does not take part in the last session any more
    const sub = await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: day(clock, -29), endDate: day(clock, 21) });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member, product: s.products.const[0], distribution: source, basket, subscription: sub });
    const c = await selected(app, as, s, 'coordinator');

    const res = await app.actions.sessions.shift(c.request, source.id, s.multiDistribs[3].id);

    expect(res.flash?.kind).toBe('ok');
    const row = await queryOne<{ endDate: string }>('SELECT endDate FROM Subscription WHERE id = ?', [sub.id]);
    expect(row!.endDate.slice(0, 10)).toBe(make.parisDate(s.multiDistribs[3].distribStartDate));
  });

  test('a member cannot shift a participation', { tag: ['@DIS-PAR-010'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const target = await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 60), 19) });
    const m = await selected(app, as, s, 'member');

    await app.actions.sessions.shift(m.request, s.distributions[0].var.id, target.id);

    expect((await queryOne<{ multiDistribId: number }>('SELECT multiDistribId FROM Distribution WHERE id = ?', [s.distributions[0].var.id]))!.multiDistribId).toBe(s.multiDistribs[0].id);
  });

  test('the shift form warns about renumbering, catalog dates, subscriptions and merged orders', { tag: ['@DIS-PAR-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await selected(app, as, s, 'coordinator');

    const constant = await app.views.sessions.shiftForm(c.request, s.distributions[0].const.id);
    const variable = await app.views.sessions.shiftForm(c.request, s.distributions[0].var.id);

    for (const page of [constant, variable]) {
      expect(page.status).toBe(200);
      expect(page.text).toContain('renumérotation des paniers');
      expect(page.text).toContain('date de fin du catalogue');
      expect(page.text).toContain('combinaison des commandes');
      expect(page.text).toContain('(Combiner les commandes)'); // the catalog already takes part in the other sessions
      expect(page.targets).toEqual(s.multiDistribs.slice(1).map((m) => m.id)); // every other upcoming session
    }
    expect(constant.text).toContain('extension des souscriptions'); // only for a constant-orders catalog
    expect(variable.text).not.toContain('extension des souscriptions');
  });
});

test.describe('changing prices and removing products in the orders of a session', () => {
  /** Two members ordered the 6-egg box at the first session; one also ordered the 12-egg box. */
  async function ordered(app: any, as: any, s: Awaited<ReturnType<typeof make.amapScenario>>) {
    const [e6, e12] = s.products.var;
    const d = s.distributions[0].var.id;
    const m1 = await as(s.users.member);
    const m2 = await as(s.users.member2);
    const sub1 = await subscribeVar(app, m1.request, s, s.users.member.id);
    const sub2 = await subscribeVar(app, m2.request, s, s.users.member2.id);
    await app.api.subscription.updateOrders(m1.request, sub1.id, [{ id: d, orders: [{ productId: e6.id, qty: 2 }, { productId: e12.id, qty: 1 }] }]);
    await app.api.subscription.updateOrders(m2.request, sub2.id, [{ id: d, orders: [{ productId: e6.id, qty: 1 }] }]);
    return { e6, e12, d };
  }
  const lines = (productId: number) => query<{ userId: number; quantity: number; productPrice: number }>('SELECT userId, quantity, productPrice FROM UserOrder WHERE productId = ? ORDER BY userId', [productId]);
  // the order operation of each member's basket for the session (OperationType.VOrder); the subscription totals (type 1) are not touched
  const basketAmounts = () => query<{ userId: number; amount: number }>('SELECT userId, amount FROM Operation WHERE type = 0 ORDER BY userId');

  test('changes the price of a product in every order of the session, not in the catalog, and updates the amounts', { tag: ['@DIS-PAR-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { e6 } = await ordered(app, as, s);
    expect(await basketAmounts()).toEqual([]); // ordering through the subscription writes no basket operation yet
    const a = await selected(app, as, s, 'groupAdmin');

    await app.actions.sessions.changePrice(a.request, s.multiDistribs[0].id, e6.id, 3);

    expect(await lines(e6.id)).toEqual([
      { userId: s.users.member.id, quantity: 2, productPrice: 3 },
      { userId: s.users.member2.id, quantity: 1, productPrice: 3 },
    ]);
    expect((await queryOne<{ price: number }>('SELECT price FROM Product WHERE id = ?', [e6.id]))!.price).toBe(e6.price);
    const after = await basketAmounts();
    expect(after.map((o) => o.amount)).toEqual([-10.5, -3]); // 2 x 3 + 1 x 4.5, and 1 x 3
  });

  test('a price change leads back to the distributions page (UND-058)', { tag: ['@DIS-PAR-012'] }, async ({ app, as }) => {
    deviation('UND-058');
    const s = await make.amapScenario();
    const a = await selected(app, as, s, 'groupAdmin');

    const res = await app.actions.sessions.changePrice(a.request, s.multiDistribs[0].id, s.products.var[0].id, 3);

    expect(res.location).toBe('/distribution');
  });

  test('a price change is for coordinators of all catalogs', { tag: ['@DIS-PAR-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { e6 } = await ordered(app, as, s);
    const c = await selected(app, as, s, 'coordinator');

    await app.actions.sessions.changePrice(c.request, s.multiDistribs[0].id, e6.id, 3);

    expect((await lines(e6.id)).map((l) => l.productPrice)).toEqual([2.4, 2.4]);
  });

  test('sets a product to zero in the orders of the session and updates the amounts', { tag: ['@DIS-PAR-014'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { e6, e12 } = await ordered(app, as, s);
    const a = await selected(app, as, s, 'groupAdmin');

    await app.actions.sessions.removeProduct(a.request, s.multiDistribs[0].id, e6.id);

    expect((await lines(e6.id)).map((l) => l.quantity)).toEqual([0, 0]);
    expect((await lines(e12.id)).map((l) => l.quantity)).toEqual([1]);
    expect((await basketAmounts()).map((o) => o.amount)).toEqual([-4.5, 0]); // the 12-egg box only, and nothing
  });
});

test.describe('scope of the session handlers', () => {
  test('a coordinator of all catalogs can edit the session of another group, with a place of another group, and change its prices (UND-059, characterised)', { tag: ['@DIS-MDS-009'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const elsewhere = await make.group({ name: 'Autre AMAP' });
    const faraway = await make.place({ group: elsewhere, name: 'Ailleurs' });
    const foreign = await make.multiDistrib({ group: elsewhere, place: faraway, start: atWallTime(addDaysWall(clock.now(), 50), 19) });
    await make.distribution({ catalog: s.varCatalog, multiDistrib: foreign });
    const a = await selected(app, as, s, 'groupAdmin');
    const newDay = day(clock, 52);

    const edit = await app.actions.sessions.edit(a.request, foreign.id, {
      date: newDay,
      start: '17:00',
      end: '18:00',
      orderStart: `${day(clock, 30)} 08:00`,
      orderEnd: `${day(clock, 48)} 22:00`,
      placeId: s.place.id, // a place of the admin's own group, on a session of another group
    });
    expect(edit.flash?.kind).toBe('ok');
    const row = await queryOne<{ distribStartDate: string; placeId: number; groupId: number }>('SELECT distribStartDate, placeId, groupId FROM MultiDistrib WHERE id = ?', [foreign.id]);
    expect(row).toEqual({ distribStartDate: `${newDay} 17:00:00`, placeId: s.place.id, groupId: elsewhere.id });

    const price = await app.actions.sessions.changePrice(a.request, foreign.id, s.products.var[0].id, 3);
    expect(price.location).toBe(`/distribution/validate/${foreign.id}`); // accepted: the same redirect as for a session of the own group
  });

  test('a member without the section right cannot edit a session', { tag: ['@DIS-MDS-009'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const m = await selected(app, as, s, 'member');
    const before = await queryOne<{ distribStartDate: string }>('SELECT distribStartDate FROM MultiDistrib WHERE id = ?', [s.multiDistribs[0].id]);

    await app.actions.sessions.edit(m.request, s.multiDistribs[0].id, { date: day(clock, 20), start: '17:00', end: '18:00', orderStart: `${day(clock, 5)} 08:00`, orderEnd: `${day(clock, 18)} 22:00`, placeId: s.place.id });

    expect(await queryOne('SELECT distribStartDate FROM MultiDistrib WHERE id = ?', [s.multiDistribs[0].id])).toEqual(before);
  });
});

test.describe('cycles on the distributions page', () => {
  const cycleForm = (clock: { now(): Date }, s: any) => ({
    type: 'Weekly' as const,
    startDate: day(clock, 100),
    endDate: day(clock, 130),
    start: '19:00',
    end: '20:00',
    daysBeforeOrderStart: 10,
    daysBeforeOrderEnd: 2,
    opening: '08:00',
    closing: '23:55',
    placeId: s.place.id,
  });

  test('a date that conflicts with an existing session aborts the whole cycle: nothing is created (UND-063, characterised)', { tag: ['@DIS-CYC-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await make.multiDistrib({ group: s.group, place: s.place, start: atWallTime(addDaysWall(clock.now(), 107), 19) }); // the second date of the cycle
    const a = await selected(app, as, s, 'groupAdmin');

    const res = await app.actions.sessions.createCycle(a.request, cycleForm(clock, s));

    expect(res.flash?.kind).toBe('error');
    expect(res.flash?.text).toContain('déjà une distribution');
    // the error rolls the request back: not even the sessions before the conflict (nor the cycle) are kept
    expect(await query('SELECT id FROM MultiDistrib WHERE distributionCycleId IS NOT NULL')).toEqual([]);
    expect(await query('SELECT id FROM DistributionCycle')).toEqual([]);
  });

  test('lists the cycles whose dates are inside or span the shown period', { tag: ['@DIS-CYC-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const cycle = (from: number, to: number) => make.distributionCycle({ group: s.group, place: s.place, startDate: addDaysWall(clock.now(), from), endDate: addDaysWall(clock.now(), to) });
    await cycle(10, 40); // inside the shown period (yesterday to 12 weeks from now)
    await cycle(-50, 200); // spans it
    await cycle(60, 200); // starts inside
    await cycle(-80, 20); // ends inside
    await cycle(200, 300); // later
    await cycle(-90, -10); // earlier
    const a = await selected(app, as, s, 'groupAdmin');

    const overview = await app.views.sessions.overview(a.request);

    expect(overview.status).toBe(200);
    expect(overview.cycleCount).toBe(4);
  });

  test('editing a cycle and inviting vendors to a whole cycle do nothing today (UND-063, characterised stubs)', { tag: ['@DIS-CYC-008'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const cycle = await make.distributionCycle({ group: s.group, place: s.place, startDate: addDaysWall(clock.now(), 10), endDate: addDaysWall(clock.now(), 40) });
    const a = await selected(app, as, s, 'groupAdmin');
    const before = await query('SELECT * FROM DistributionCycle');

    const stubs = await app.views.sessions.cycleStubs(a.request, cycle.id);

    expect(stubs.inviteVendors.text).toContain('Fonctionnalité bientôt disponible');
    expect(stubs.edit.text).not.toMatch(/Date de début de cycle|Cycle start date/); // no edit form
    expect(await query('SELECT * FROM DistributionCycle')).toEqual(before);
  });
});
