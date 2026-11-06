/**
 * Sessions, cycles, distributions and attendance as the GraphQL API serves them
 * (specs/04-distributions/multidistrib-schedule.md, cycles.md, attendance-sheets.md, volunteers.md;
 * camap-ts multi-distribs.resolver.ts, distributions.resolver.ts, distribution-cycles.resolver.ts,
 * attendance-list.resolver.ts). The queries are served by Nest through the hx origin.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import { addDaysWall, fromSqlDateTime } from '../../src/encodings/dates.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';

const day = (clock: { now(): Date }, n: number) => make.parisDate(addDaysWall(clock.now(), n));
const utcDay = (clock: { now(): Date }, n: number) => `${day(clock, n)}T00:00:00.000Z`;
const ids = (rows: { id: number }[] | undefined) => (rows ?? []).map((r) => r.id).sort((a, b) => a - b);

async function selected(app: any, as: any, s: any, who: keyof typeof s.users) {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

test.describe('attendance of a catalog (GraphQL)', () => {
  /** Three subscriptions of the constant catalog: whole catalog, ended already, starting later. */
  async function subscriptions(s: Awaited<ReturnType<typeof make.amapScenario>>, clock: { now(): Date }) {
    const whole = await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: day(clock, -29), endDate: day(clock, 300), absentDistribIds: [s.distributions[1].const.id] });
    const past = await make.subscription({ user: s.users.member2, catalog: s.constCatalog, startDate: day(clock, -29), endDate: day(clock, 2) });
    const later = await make.subscription({ user: s.users.nonMember, catalog: s.constCatalog, startDate: day(clock, 20), endDate: day(clock, 300) });
    return { whole, past, later };
  }

  test('lists the subscriptions overlapping the period, the distributions in it and the absences', { tag: ['@DIS-ATT-006'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const subs = await subscriptions(s, clock);
    const a = await selected(app, as, s, 'groupAdmin');

    // the period defaults to the catalog dates
    const all = await app.api.distributions.attendanceClassic(a.request, s.constCatalog.id);
    expect(all.errors).toBeNull();
    const full = all.data!.attendanceClassicContract;
    expect(full.catalog.id).toBe(s.constCatalog.id);
    expect(ids(full.subscriptions)).toEqual([subs.whole.id, subs.past.id, subs.later.id].sort((x, y) => x - y));
    expect(ids(full.distributions)).toEqual(s.distributions.map((d) => d.const.id).sort((x, y) => x - y));
    expect(full.subscriptions.find((x) => x.id === subs.whole.id)!.absentDistribIds).toBe(String(s.distributions[1].const.id));

    // a narrower period keeps the subscriptions that overlap it and the distributions inside it
    const narrow = await app.api.distributions.attendanceClassic(a.request, s.constCatalog.id, { startDate: utcDay(clock, 6), endDate: utcDay(clock, 15) });
    const part = narrow.data!.attendanceClassicContract;
    expect(ids(part.subscriptions)).toEqual([subs.whole.id]);
    expect(ids(part.distributions)).toEqual([s.distributions[0].const.id, s.distributions[1].const.id].sort((x, y) => x - y));
  });

  test('is open to the coordinator of the catalog and to a volunteer of one of its sessions, not to other members', { tag: ['@DIS-ATT-006'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await subscriptions(s, clock);
    const role = await make.volunteerRole({ group: s.group, name: 'Caisse' });
    await make.volunteer({ user: s.users.member2, multiDistrib: s.multiDistribs[2], role });
    const coordinator = await selected(app, as, s, 'coordinator');
    const volunteer = await selected(app, as, s, 'member2');
    const other = await selected(app, as, s, 'member');
    const visitor = await as(s.users.nonMember);

    expect((await app.api.distributions.attendanceClassic(coordinator.request, s.constCatalog.id)).errors).toBeNull();
    expect((await app.api.distributions.attendanceClassic(volunteer.request, s.constCatalog.id)).errors).toBeNull();
    for (const who of [other, visitor]) {
      const res = await app.api.distributions.attendanceClassic(who.request, s.constCatalog.id);
      expect(res.errors).not.toBeNull();
      expect(res.data).toBeNull();
    }
  });

  test('a coordinator of another catalog only is let in too (characterised: the check only looks for any catalog right)', { tag: ['@DIS-ATT-006'] }, async ({ app, as, clock }) => {
    // FINDING: canManageAllCatalogs() is true for any ContractAdmin right, even one limited to other catalogs
    // (user-groups.service.ts hasRight), so the "coordinator of this catalog or volunteer" branch is never reached.
    const s = await make.amapScenario();
    await subscriptions(s, clock);
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const user = await make.user({ firstName: 'Paulette', lastName: 'Pain', email: 'pain@camap.test' });
    await make.userGroup({ user, group: s.group, rights: [Right.ContractAdmin(other.id)] });
    const c = await as(user);

    const res = await app.api.distributions.attendanceClassic(c.request, s.constCatalog.id);

    expect(res.errors).toBeNull();
  });

  /** A variable catalog distribution with one subscriber's order on it. */
  async function variableOrder(s: Awaited<ReturnType<typeof make.amapScenario>>, clock: { now(): Date }) {
    const sub = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: day(clock, -29), endDate: day(clock, 300) });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member, product: s.products.var[0], distribution: s.distributions[0].var, basket, subscription: sub });
    return sub;
  }

  test('a manager of the catalog reads the subscriptions that ordered at one variable-catalog distribution', { tag: ['@DIS-ATT-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const sub = await variableOrder(s, clock);
    const coordinator = await selected(app, as, s, 'coordinator');
    const admin = await selected(app, as, s, 'groupAdmin');

    for (const who of [coordinator, admin]) {
      const res = await app.api.distributions.attendanceVariable(who.request, s.varCatalog.id, s.distributions[0].var.id);
      expect(res.errors).toBeNull();
      const att = res.data!.attendanceVariableContract;
      expect(att.catalog.id).toBe(s.varCatalog.id);
      expect(att.distribution.id).toBe(s.distributions[0].var.id);
      expect(att.subscriptions.map((x) => x.id)).toEqual([sub.id]);
    }
  });

  test('a logged-in user who is neither a manager nor a volunteer is refused (UND-062)', { tag: ['@DIS-ATT-007'] }, async ({ app, as, clock }) => {
    deviation('UND-062');
    const s = await make.amapScenario();
    await variableOrder(s, clock);
    const other = await selected(app, as, s, 'member2');

    const res = await app.api.distributions.attendanceVariable(other.request, s.varCatalog.id, s.distributions[0].var.id);

    expect(res.errors).not.toBeNull();
  });

  test('a volunteer of the session reads the variable-catalog attendance', { tag: ['@DIS-ATT-007'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    await variableOrder(s, clock);
    const role = await make.volunteerRole({ group: s.group, name: 'Caisse' });
    await make.volunteer({ user: s.users.member2, multiDistrib: s.multiDistribs[0], role });
    const volunteer = await selected(app, as, s, 'member2');

    const res = await app.api.distributions.attendanceVariable(volunteer.request, s.varCatalog.id, s.distributions[0].var.id);

    expect(res.errors).toBeNull();
  });
});

test.describe('cycles and sessions (GraphQL)', () => {
  test('a coordinator of all catalogs lists the cycles of the group that have not ended', { tag: ['@DIS-CYC-009'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const running = await make.distributionCycle({ group: s.group, place: s.place, startDate: addDaysWall(clock.now(), -20), endDate: addDaysWall(clock.now(), 40) });
    await make.distributionCycle({ group: s.group, place: s.place, startDate: addDaysWall(clock.now(), -60), endDate: addDaysWall(clock.now(), -10) }); // ended
    const future = await make.distributionCycle({ group: s.group, place: s.place, startDate: addDaysWall(clock.now(), 50), endDate: addDaysWall(clock.now(), 90) });
    const elsewhere = await make.group({ name: 'Autre AMAP' });
    const place = await make.place({ group: elsewhere, name: 'Ailleurs' });
    await make.distributionCycle({ group: elsewhere, place, startDate: addDaysWall(clock.now(), -20), endDate: addDaysWall(clock.now(), 40) });
    const admin = await selected(app, as, s, 'groupAdmin');
    const member = await selected(app, as, s, 'member');
    const visitor = await as(s.users.nonMember);

    const res = await app.api.distributions.cycles(admin.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(ids(res.data!.distributionCycles)).toEqual([running.id, future.id].sort((a, b) => a - b));
    expect(res.data!.distributionCycles.every((c) => c.groupId === s.group.id)).toBe(true);
    for (const who of [member, visitor]) {
      const refused = await app.api.distributions.cycles(who.request, s.group.id);
      expect(refused.errors).not.toBeNull();
    }
  });

  test('a coordinator of all catalogs lists the sessions of a period; those already distributed are listed apart; the next one is returned when none is found', { tag: ['@DIS-MDS-014'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const past = await make.multiDistrib({ group: s.group, place: s.place, start: addDaysWall(clock.now(), -10) });
    const admin = await selected(app, as, s, 'groupAdmin');

    const week = await app.api.distributions.multiDistribs(admin.request, s.group.id, utcDay(clock, 5), utcDay(clock, 16));
    expect(week.errors).toBeNull();
    expect(ids(week.data!.multiDistribs)).toEqual([s.multiDistribs[0].id, s.multiDistribs[1].id]);

    const done = await app.api.distributions.distributedMultiDistribs(admin.request, s.group.id);
    expect(ids(done.data!.distributedMultiDistribs)).toEqual([past.id]);

    const empty = await app.api.distributions.multiDistribs(admin.request, s.group.id, utcDay(clock, -40), utcDay(clock, -20));
    expect(empty.data!.multiDistribs).toEqual([]);
    const next = await app.api.distributions.multiDistribs(admin.request, s.group.id, utcDay(clock, -40), utcDay(clock, -20), { nextIfEmpty: true });
    expect(ids(next.data!.multiDistribs)).toEqual([s.multiDistribs[0].id]);
  });

  test('a member without a catalog right cannot list the sessions of a period', { tag: ['@DIS-MDS-014'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const member = await selected(app, as, s, 'member');

    const res = await app.api.distributions.multiDistribs(member.request, s.group.id, utcDay(clock, 0), utcDay(clock, 40));

    expect(res.errors).not.toBeNull();
    expect((await app.api.distributions.distributedMultiDistribs(member.request, s.group.id)).errors).not.toBeNull();
  });

  test('a coordinator limited to some catalogs is let in too (characterised: any catalog right counts as "all catalogs")', { tag: ['@DIS-MDS-014'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const coordinator = await selected(app, as, s, 'coordinator'); // two catalogs only

    const res = await app.api.distributions.multiDistribs(coordinator.request, s.group.id, utcDay(clock, 0), utcDay(clock, 40));

    expect(res.errors).toBeNull();
  });

  test('a member of the group reads a session with its volunteers and the roles it needs', { tag: ['@DIS-VOL-015', '@DIS-MDS-015'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const caisse = await make.volunteerRole({ group: s.group, name: 'Caisse' });
    const rangement = await make.volunteerRole({ group: s.group, name: 'Rangement' });
    const md = s.multiDistribs[0];
    await query('UPDATE MultiDistrib SET volunteerRolesIds = ? WHERE id = ?', [`${caisse.id},${rangement.id}`, md.id]);
    await make.volunteer({ user: s.users.member2, multiDistrib: md, role: caisse });
    const member = await selected(app, as, s, 'member');

    const res = await app.api.distributions.multiDistrib(member.request, md.id);

    expect(res.errors).toBeNull();
    const got = res.data!.multiDistribution;
    expect(got).toMatchObject({ id: md.id, groupId: s.group.id });
    expect(got.volunteerRoles.map((r) => r.name).sort()).toEqual(['Caisse', 'Rangement']);
    expect(got.volunteers).toEqual([{ userId: s.users.member2.id, volunteerRoleId: caisse.id }]);
  });

  test('reading a session requires membership of its group (UND-061)', { tag: ['@DIS-MDS-015'] }, async ({ app, as }) => {
    deviation('UND-061');
    const s = await make.amapScenario();
    const outsider = await as(s.users.nonMember);

    const res = await app.api.distributions.multiDistrib(outsider.request, s.multiDistribs[0].id);

    expect(res.errors).not.toBeNull();
  });

  test('reading a distribution requires a login (UND-061)', { tag: ['@DIS-MDS-015'] }, async ({ app, anon }) => {
    deviation('UND-061');
    const s = await make.amapScenario();
    const visitor = anon;

    const res = await app.api.distributions.distribution(visitor.request, s.distributions[0].var.id);

    expect(res.errors).not.toBeNull();
  });

  test('the orders of a distribution are visible only to their owner and to managers of the catalog (UND-061)', { tag: ['@DIS-MDS-015'] }, async ({ app, as, clock }) => {
    deviation('UND-061');
    const s = await make.amapScenario();
    const sub = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: day(clock, -29), endDate: day(clock, 300) });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    const order = await make.userOrder({ user: s.users.member, product: s.products.var[0], distribution: s.distributions[0].var, basket, subscription: sub });
    const owner = await selected(app, as, s, 'member');
    const coordinator = await selected(app, as, s, 'coordinator');
    const stranger = await selected(app, as, s, 'member2');
    const orderIds = async (who: { request: any }) => ((await app.api.distributions.distribution(who.request, s.distributions[0].var.id)).data?.distribution.userOrders ?? []).map((o) => o.id);

    expect(await orderIds(owner)).toEqual([order.id]);
    expect(await orderIds(coordinator)).toEqual([order.id]);
    expect(await orderIds(stranger)).toEqual([]);
  });
});

test.describe('dates of sessions', () => {
  const winter = '2026-12-09 18:00:00';
  const summer = '2027-07-14 18:00:00';

  async function sessionsAt(s: Awaited<ReturnType<typeof make.amapScenario>>, walls: string[]) {
    const out = [];
    for (const w of walls) out.push(await make.multiDistrib({ group: s.group, place: s.place, start: fromSqlDateTime(w) }));
    return out;
  }

  test('every date is the Paris wall-clock time, in winter and in summer, whichever application shows it', { tag: ['@DIS-MDS-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const [w, su] = await sessionsAt(s, [winter, summer]);
    const admin = await selected(app, as, s, 'groupAdmin');

    // Nest: an ISO instant that is the Paris time of the stored wall clock
    const gql = await app.api.distributions.multiDistribs(admin.request, s.group.id, '2026-12-08T00:00:00.000Z', '2027-07-15T00:00:00.000Z');
    const byId = new Map(gql.data!.multiDistribs.map((d) => [d.id, d]));
    expect(new Date(byId.get(w.id)!.distribStartDate).toISOString()).toBe(fromSqlDateTime(winter).toISOString());
    expect(new Date(byId.get(su.id)!.distribStartDate).toISOString()).toBe(fromSqlDateTime(summer).toISOString());

    // hx: the stored wall clock time itself, with a UTC offset
    const json = await app.api.distributions.sessionDates(admin.request, '2026-12-09', '2026-12-09');
    expect(json.body.multiDistribs.map((d) => d.distribStartDate.slice(0, 19))).toEqual(['2026-12-09T18:00:00']);
    const jsonSummer = await app.api.distributions.sessionDates(admin.request, '2027-07-14', '2027-07-14');
    expect(jsonSummer.body.multiDistribs.map((d) => d.distribStartDate.slice(0, 19))).toEqual(['2027-07-14T18:00:00']);
  });

  test('summer and winter time change on the real Europe/Paris dates each year (UND-056)', { tag: ['@DIS-MDS-013'] }, async ({ app, as }) => {
    deviation('UND-056');
    const s = await make.amapScenario();
    // 2027: DST starts on 28 March and ends on 31 October; hx hard-codes 29 March and 25 October
    await sessionsAt(s, ['2027-03-28 18:00:00', '2027-10-28 12:00:00', '2027-07-14 18:00:00', '2027-12-09 18:00:00']);
    const admin = await selected(app, as, s, 'groupAdmin');
    const offset = async (date: string) => (await app.api.distributions.sessionDates(admin.request, date, date)).body.multiDistribs[0]?.distribStartDate.slice(19);

    expect(await offset('2027-07-14')).toBe('+02:00');
    expect(await offset('2027-12-09')).toBe('+01:00');
    expect(await offset('2027-03-28')).toBe('+02:00');
    expect(await offset('2027-10-28')).toBe('+02:00');
  });
});
