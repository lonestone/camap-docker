/**
 * Distribution sessions, cycles and catalog participation
 * (specs/04-distributions/multidistrib-schedule.md, cycles.md, distribution-participation.md;
 * controller/Distribution.hx, ContractAdmin.hx, service/DistributionService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';

const day = (clock: { now(): Date }, n: number) => make.parisDate(addDaysWall(clock.now(), n));

async function admin(app: any, as: any, s: any, who: 'groupAdmin' | 'coordinator' | 'member' = 'groupAdmin') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

const sessionsAfter = (id: number) =>
  query<{ id: number; distribStartDate: string; distribEndDate: string; orderStartDate: string; orderEndDate: string; volunteerRolesIds: string | null; placeId: number }>(
    'SELECT id, distribStartDate, distribEndDate, orderStartDate, orderEndDate, volunteerRolesIds, placeId FROM MultiDistrib WHERE id > ? ORDER BY id',
    [id],
  );

const lastSessionId = async (s: { multiDistribs: { id: number }[] }) => s.multiDistribs[s.multiDistribs.length - 1].id;

test.describe('distribution sessions', () => {
  test('a coordinator of all catalogs opens the distributions page, others are sent away', { tag: ['@DIS-MDS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const adminSession = await admin(app, as, s);
    const memberSession = await admin(app, as, s, 'member');
    const coordinator = await admin(app, as, s, 'coordinator'); // ContractAdmin on two catalogs only

    expect((await app.actions.sessions.list(adminSession.request)).status).toBe(200);
    expect((await app.actions.sessions.list(memberSession.request)).status).toBe(302);
    expect((await app.actions.sessions.list(coordinator.request)).status).toBe(302);
  });

  test('creates a session with a date, times, a place and order dates', { tag: ['@DIS-MDS-002', '@DIS-MDS-004'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);

    const res = await app.actions.sessions.create(a.request, {
      date: day(clock, 60),
      start: '19:00',
      end: '20:30',
      orderStart: `${day(clock, 40)} 08:00`,
      orderEnd: `${day(clock, 58)} 23:59`,
      placeId: s.place.id,
    });

    expect(res.flash?.kind).toBe('ok');
    const [md] = await sessionsAfter(last);
    expect(md).toMatchObject({
      distribStartDate: `${day(clock, 60)} 19:00:00`,
      distribEndDate: `${day(clock, 60)} 20:30:00`, // same day as the start
      orderStartDate: `${day(clock, 40)} 08:00:00`,
      orderEndDate: `${day(clock, 58)} 23:59:00`,
      placeId: s.place.id,
    });
  });

  test('refuses a second session on the same day at the same place', { tag: ['@DIS-MDS-003'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);
    const form = { date: day(clock, 60), start: '19:00', end: '20:00', orderStart: `${day(clock, 40)} 08:00`, orderEnd: `${day(clock, 58)} 23:59`, placeId: s.place.id };
    await app.actions.sessions.create(a.request, form);

    const res = await app.actions.sessions.create(a.request, { ...form, start: '10:00', end: '11:00' });

    expect(res.flash?.kind).toBe('error');
    expect(await sessionsAfter(last)).toHaveLength(1);
  });

  test('refuses a session whose orders close after it starts, or whose dates are missing', { tag: ['@DIS-MDS-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);
    const base = { date: day(clock, 60), start: '19:00', end: '20:00', placeId: s.place.id };

    const late = await app.actions.sessions.create(a.request, { ...base, orderStart: `${day(clock, 40)} 08:00`, orderEnd: `${day(clock, 61)} 23:59` });
    const missing = await app.actions.sessions.create(a.request, { ...base, orderStart: '', orderEnd: '' });

    expect(late.flash?.kind).toBe('error');
    expect(missing.flash?.kind ?? 'error').toBe('error');
    expect(await sessionsAfter(last)).toEqual([]);
  });

  test('a new session starts with the group\'s default volunteer roles', { tag: ['@DIS-MDS-006'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const caisse = await make.volunteerRole({ group: s.group, name: 'Caisse', enabledByDefault: true });
    await make.volunteerRole({ group: s.group, name: 'Rangement', enabledByDefault: false });
    await make.volunteerRole({ group: s.group, name: 'Rôle du catalogue', catalog: s.constCatalog, enabledByDefault: true });
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);

    await app.actions.sessions.create(a.request, {
      date: day(clock, 60), start: '19:00', end: '20:00', orderStart: `${day(clock, 40)} 08:00`, orderEnd: `${day(clock, 58)} 23:59`, placeId: s.place.id,
    });

    const [md] = await sessionsAfter(last);
    expect(md.volunteerRolesIds).toBe(String(caisse.id));
  });

  test('edits a session, and aligns the vendors\' dates when asked', { tag: ['@DIS-MDS-007', '@DIS-MDS-008'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const md = s.multiDistribs[1];
    const newDay = day(clock, 20);
    // a vendor with its own closing date on this session
    await query('UPDATE Distribution SET orderEndDate = ? WHERE id = ?', [`${make.parisDate(md.orderEndDate)} 12:00:00`, s.distributions[1].const.id]);
    const form = { date: newDay, start: '17:00', end: '18:00', orderStart: `${day(clock, 5)} 08:00`, orderEnd: `${day(clock, 18)} 22:00`, placeId: s.place.id };

    const res = await app.actions.sessions.edit(a.request, md.id, form);

    expect(res.flash?.kind).toBe('ok');
    const row = await queryOne<{ distribStartDate: string; orderEndDate: string }>('SELECT distribStartDate, orderEndDate FROM MultiDistrib WHERE id = ?', [md.id]);
    expect(row).toEqual({ distribStartDate: `${newDay} 17:00:00`, orderEndDate: `${day(clock, 18)} 22:00:00` });
    const dist = await query<{ date: string; orderEndDate: string }>('SELECT date, orderEndDate FROM Distribution WHERE multiDistribId = ? ORDER BY id', [md.id]);
    expect(dist.every((d) => d.date === `${newDay} 17:00:00`)).toBe(true);
    expect(dist[0].orderEndDate).toBe(`${make.parisDate(md.orderEndDate)} 12:00:00`); // its own date is kept

    await app.actions.sessions.edit(a.request, md.id, { ...form, override: true });
    const aligned = await query<{ orderEndDate: string }>('SELECT orderEndDate FROM Distribution WHERE multiDistribId = ?', [md.id]);
    expect(aligned.every((d) => d.orderEndDate === `${day(clock, 18)} 22:00:00`)).toBe(true);
  });

  test('deletes a session with a security token, and the participations with it', { tag: ['@DIS-MDS-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const md = s.multiDistribs[2];

    await app.actions.sessions.delete(a.request, md.id, { token: false });
    expect(await query('SELECT id FROM MultiDistrib WHERE id = ?', [md.id])).toHaveLength(1);

    const res = await app.actions.sessions.delete(a.request, md.id);

    expect(res.flash?.kind).toBe('ok');
    expect(await query('SELECT id FROM MultiDistrib WHERE id = ?', [md.id])).toEqual([]);
    expect(await query('SELECT id FROM Distribution WHERE multiDistribId = ?', [md.id])).toEqual([]);
  });
});

test.describe('distribution cycles', () => {
  const cycle = (clock: { now(): Date }, s: any, type: 'Weekly' | 'Monthly' | 'BiWeekly' | 'TriWeekly' = 'Weekly') => ({
    type,
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

  test('generates every session of a weekly cycle at once, with no catalog taking part', { tag: ['@DIS-CYC-001', '@DIS-CYC-002', '@DIS-CYC-003', '@DIS-CYC-005'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);

    const res = await app.actions.sessions.createCycle(a.request, cycle(clock, s));

    expect(res.flash?.kind).toBe('ok');
    const sessions = await sessionsAfter(last);
    expect(sessions.length).toBeGreaterThanOrEqual(4);
    expect(sessions.length).toBeLessThanOrEqual(5);
    // each session starts at 19:00 and closes its orders 2 days before at 23:55
    for (const md of sessions) {
      expect(md.distribStartDate.slice(11)).toBe('19:00:00');
      expect(md.distribEndDate.slice(11)).toBe('20:00:00');
      expect(md.orderEndDate.slice(11)).toBe('23:55:00');
      expect(md.orderStartDate.slice(11)).toBe('08:00:00');
    }
    expect(await query('SELECT id FROM Distribution WHERE multiDistribId > ?', [last])).toEqual([]);
    const row = await queryOne<{ cycleType: number; daysBeforeOrderStart: number; daysBeforeOrderEnd: number }>('SELECT cycleType, daysBeforeOrderStart, daysBeforeOrderEnd FROM DistributionCycle');
    expect(row).toEqual({ cycleType: 0, daysBeforeOrderStart: 10, daysBeforeOrderEnd: 2 });
  });

  test('a monthly cycle makes one session a month', { tag: ['@DIS-CYC-001'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);

    await app.actions.sessions.createCycle(a.request, { ...cycle(clock, s, 'Monthly'), endDate: day(clock, 200) });

    const sessions = await sessionsAfter(last);
    expect(sessions.length).toBeGreaterThanOrEqual(3);
    expect(sessions.length).toBeLessThanOrEqual(4);
  });

  test('deleting a cycle deletes its sessions', { tag: ['@DIS-CYC-006'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);
    await app.actions.sessions.createCycle(a.request, cycle(clock, s));
    const created = await queryOne<{ id: number }>('SELECT id FROM DistributionCycle');

    const res = await app.actions.sessions.deleteCycle(a.request, created!.id);

    expect(res.flash?.kind).toBe('ok');
    expect(await query('SELECT id FROM DistributionCycle')).toEqual([]);
    expect(await sessionsAfter(last)).toEqual([]);
  });
});

test.describe('catalog participation', () => {
  async function openSession(app: any, as: any, s: any, clock: { now(): Date }) {
    const a = await admin(app, as, s);
    const last = await lastSessionId(s);
    await app.actions.sessions.create(a.request, {
      date: day(clock, 60), start: '19:00', end: '20:00', orderStart: `${day(clock, 40)} 08:00`, orderEnd: `${day(clock, 58)} 23:59`, placeId: s.place.id,
    });
    const [md] = await sessionsAfter(last);
    return { a, md };
  }

  test('a catalog takes part in a session; its order window is the session\'s', { tag: ['@DIS-PAR-001', '@DIS-PAR-002'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const { a, md } = await openSession(app, as, s, clock);
    await make.setCatalog(s.varCatalog.id, { endDate: `${day(clock, 400)} 23:59:59` });

    const res = await app.actions.sessions.participate(a.request, md.id, s.varCatalog.id);

    expect(res.flash?.kind).toBe('ok');
    const d = await queryOne<{ date: string; orderStartDate: string; orderEndDate: string; catalogId: number }>(
      'SELECT date, orderStartDate, orderEndDate, catalogId FROM Distribution WHERE multiDistribId = ?',
      [md.id],
    );
    expect(d).toEqual({ catalogId: s.varCatalog.id, date: md.distribStartDate, orderStartDate: md.orderStartDate, orderEndDate: md.orderEndDate });
  });

  test('a catalog taking part adds its volunteer roles to the session', { tag: ['@DIS-PAR-003'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const role = await make.volunteerRole({ group: s.group, name: 'Livraison', catalog: s.varCatalog });
    const { a, md } = await openSession(app, as, s, clock);
    await make.setCatalog(s.varCatalog.id, { endDate: `${day(clock, 400)} 23:59:59` });

    await app.actions.sessions.participate(a.request, md.id, s.varCatalog.id);

    const row = await queryOne<{ volunteerRolesIds: string | null }>('SELECT volunteerRolesIds FROM MultiDistrib WHERE id = ?', [md.id]);
    expect((row!.volunteerRolesIds ?? '').split(',')).toContain(String(role.id));
  });

  test('a catalog can take part in all its sessions at once', { tag: ['@DIS-PAR-006'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const a = await admin(app, as, s);
    const extra = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders', contact: s.users.coordinator });

    await app.actions.sessions.participateAll(a.request, extra.id);

    const rows = await query<{ multiDistribId: number }>('SELECT multiDistribId FROM Distribution WHERE catalogId = ? ORDER BY multiDistribId', [extra.id]);
    expect(rows.map((r) => r.multiDistribId)).toEqual(s.multiDistribs.map((m) => m.id));
  });

  test('a coordinator cancels a catalog\'s participation in a session', { tag: ['@DIS-PAR-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await admin(app, as, s, 'coordinator');
    const target = s.distributions[3].var;

    const res = await app.actions.sessions.cancelParticipation(c.request, target.id);

    expect(res.flash?.kind).toBe('ok');
    expect(await query('SELECT id FROM Distribution WHERE id = ?', [target.id])).toEqual([]);
    expect(await query('SELECT id FROM Distribution WHERE multiDistribId = ?', [s.multiDistribs[3].id])).toHaveLength(1);
  });
});
