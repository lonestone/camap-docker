/**
 * Volunteer roles, registration and duty settings (specs/04-distributions/volunteers.md,
 * volunteer-roles.md, volunteer-reminders.md; controller/Distribution.hx, api/Distributions.hx,
 * amapadmin/Volunteers.hx, service/VolunteerService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, queryOne } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';

const day = (clock: { now(): Date }, n: number) => make.parisDate(addDaysWall(clock.now(), n));

async function session(app: any, as: any, s: any, who: keyof typeof s.users) {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

/** Scenario + one generic role on the first session. */
async function withRole(opts: { enabledByDefault?: boolean } = {}) {
  const s = await make.amapScenario();
  const role = await make.volunteerRole({ group: s.group, name: 'Caisse', enabledByDefault: opts.enabledByDefault ?? true });
  await query('UPDATE MultiDistrib SET volunteerRolesIds = ? WHERE groupId = ?', [String(role.id), s.group.id]);
  return { s, role };
}
const volunteersOf = (md: number) => query<{ userId: number; volunteerRoleId: number }>('SELECT userId, volunteerRoleId FROM Volunteer WHERE multiDistribId = ?', [md]);

test.describe('registering for a role', () => {
  test('a member registers for a vacant role; a filled role refuses a second volunteer', { tag: ['@DIS-VOL-003'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    const m1 = await session(app, as, s, 'member');
    const m2 = await session(app, as, s, 'member2');
    const md = s.multiDistribs[0].id;

    const first = await app.actions.volunteers.register(m1.request, md, role.id);
    const second = await app.actions.volunteers.register(m2.request, md, role.id);

    expect(first.flash?.kind).toBe('ok');
    expect(second.flash?.kind).toBe('error');
    expect(await volunteersOf(md)).toEqual([{ userId: s.users.member.id, volunteerRoleId: role.id }]);
  });

  test('registering is a link that acts when opened, with no check of the session\'s roles or of membership (UND-064, characterised)', { tag: ['@DIS-VOL-004', '@DIS-VOL-005'] }, async ({ app, as }) => {
    const { s } = await withRole();
    const stranger = await make.volunteerRole({ group: s.group, name: 'Rôle hors session', enabledByDefault: false }); // not in the session's role list
    const outsider = await session(app, as, s, 'nonMember'); // not a member of the group
    const md = s.multiDistribs[0].id;

    const res = await app.actions.volunteers.register(outsider.request, md, stranger.id);

    expect(res.flash?.kind).toBe('ok');
    expect(await volunteersOf(md)).toEqual([{ userId: s.users.nonMember.id, volunteerRoleId: stranger.id }]);
  });

  test('a member unregisters themselves from a role, nobody else\'s', { tag: ['@DIS-VOL-006'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    const md = s.multiDistribs[0].id;
    await make.volunteer({ user: s.users.member, multiDistrib: s.multiDistribs[0], role });
    const other = await as(s.users.member2);
    const owner = await as(s.users.member);

    const refused = await app.api.distributions.unsubscribeFromRole(other.request, md, role.id);
    expect(refused.status).toBe(403);
    expect(await volunteersOf(md)).toHaveLength(1);

    const ok = await app.api.distributions.unsubscribeFromRole(owner.request, md, role.id);
    expect(ok.status).toBe(200);
    expect(await volunteersOf(md)).toEqual([]);

    const none = await app.api.distributions.unsubscribeFromRole(owner.request, md, role.id);
    expect(none.status).toBe(422);
  });

  test('when a volunteer leaves after the alert date, the members of the group are told', { tag: ['@DIS-VOL-007'] }, async ({ app, as, mails }) => {
    const { s, role } = await withRole();
    await query('UPDATE `Group` SET vacantVolunteerRolesMailDaysBeforeDutyPeriod = 60 WHERE id = ?', [s.group.id]); // the alert date is already behind us
    await make.volunteer({ user: s.users.member, multiDistrib: s.multiDistribs[0], role });
    const owner = await as(s.users.member);
    const mark = await mails.mark();

    await app.api.distributions.unsubscribeFromRole(owner.request, s.multiDistribs[0].id, role.id);

    const sent = await mails.since(mark);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(expect.arrayContaining([s.users.member2.email, s.users.coordinator.email]));
  });

  test('a group admin assigns one member per role of a session', { tag: ['@DIS-VOL-008'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    const a = await session(app, as, s, 'groupAdmin');
    const md = s.multiDistribs[0].id;

    const res = await app.actions.volunteers.assign(a.request, md, { [role.id]: s.users.member2.id });

    expect(res.flash?.kind).toBe('ok');
    expect(await volunteersOf(md)).toEqual([{ userId: s.users.member2.id, volunteerRoleId: role.id }]);

    await app.actions.volunteers.assign(a.request, md, { [role.id]: null });
    expect(await volunteersOf(md)).toEqual([]);
  });
});

test.describe('the volunteers calendar', () => {
  test('shows the roles I hold, the vacancies and whether volunteers can still join', { tag: ['@DIS-VOL-001', '@DIS-VOL-002', '@DIS-VOL-010', '@DIS-VOL-011'] }, async ({ app, as, clock }) => {
    const { s, role } = await withRole();
    await make.volunteer({ user: s.users.member, multiDistrib: s.multiDistribs[0], role });
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.api.distributions.volunteerRolesCalendar(m.request, day(clock, 0), day(clock, 40));

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual([{ id: role.id, name: 'Caisse' }]);
    const [first, second] = res.body.multiDistribs;
    expect(first.hasVolunteerRole[role.id]).toBe(true);
    expect(first.volunteerForRole[role.id]).toMatchObject({ id: s.users.member.id });
    expect(first.hasVacantVolunteerRoles).toBe(false); // the only role is filled
    expect(second.hasVacantVolunteerRoles).toBe(true);
    expect(first.canVolunteersJoin).toBe(true);
    expect(first.volunteersRequired).toBe(1);
    expect(first.volunteersRegistered).toBe(1);
  });

  test('volunteers can join only inside the opening period of the group', { tag: ['@DIS-VOL-010', '@DIS-ROL-008'] }, async ({ app, as, clock }) => {
    const { s } = await withRole();
    await query('UPDATE `Group` SET daysBeforeDutyPeriodsOpen = 8 WHERE id = ?', [s.group.id]);
    const m = await session(app, as, s, 'member');

    const res = await app.api.distributions.volunteerRolesCalendar(m.request, day(clock, 0), day(clock, 40));

    const byId = new Map(res.body.multiDistribs.map((d) => [d.id, d]));
    expect(byId.get(s.multiDistribs[0].id)!.canVolunteersJoin).toBe(true); // 7 days away, inside 8
    expect(byId.get(s.multiDistribs[3].id)!.canVolunteersJoin).toBe(false); // 28 days away
  });
});

test.describe('volunteer roles', () => {
  test('a group admin creates a group-wide role, switched on for the coming sessions when enabled by default', { tag: ['@DIS-ROL-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await session(app, as, s, 'groupAdmin');

    const res = await app.actions.volunteers.createRole(a.request, { name: 'Cagnotte', enabledByDefault: true });

    expect(res.flash?.kind).toBe('ok');
    const role = await queryOne<{ id: number; catalogId: number | null; enabledByDefault: number }>('SELECT id, catalogId, enabledByDefault FROM VolunteerRole');
    expect(role).toMatchObject({ catalogId: null, enabledByDefault: 1 });
    const sessions = await query<{ volunteerRolesIds: string }>('SELECT volunteerRolesIds FROM MultiDistrib');
    expect(sessions.every((m) => (m.volunteerRolesIds ?? '').split(',').includes(String(role!.id)))).toBe(true);
  });

  test('a catalog coordinator creates a role for their catalog', { tag: ['@DIS-ROL-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const c = await session(app, as, s, 'coordinator');

    const res = await app.actions.volunteers.createCatalogRole(c.request, s.constCatalog.id, 'Livraison');

    expect(res.flash?.kind).toBe('ok');
    expect(await query('SELECT name, catalogId FROM VolunteerRole')).toEqual([{ name: 'Livraison', catalogId: s.constCatalog.id }]);
  });

  test('switching a role off removes the volunteers registered on future sessions (UND-065)', { tag: ['@DIS-ROL-004'] }, async ({ app, as }) => {
    deviation('UND-065');
    const { s, role } = await withRole({ enabledByDefault: true });
    await make.volunteer({ user: s.users.member, multiDistrib: s.multiDistribs[1], role });
    const a = await session(app, as, s, 'groupAdmin');

    await app.actions.volunteers.editRole(a.request, role.id, { name: 'Caisse', enabledByDefault: false });

    // decided: refuse, or ask for confirmation, before removing registered volunteers
    expect(await volunteersOf(s.multiDistribs[1].id)).toHaveLength(1);
  });

  test('a role with volunteers is deleted only when forced', { tag: ['@DIS-ROL-005'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    await make.volunteer({ user: s.users.member, multiDistrib: s.multiDistribs[0], role });
    const a = await session(app, as, s, 'groupAdmin');

    const plain = await app.actions.volunteers.deleteRole(a.request, role.id);
    expect(plain.flash?.kind).toBe('error');
    expect(await query('SELECT id FROM VolunteerRole')).toHaveLength(1);

    const forced = await app.actions.volunteers.deleteRole(a.request, role.id, { force: true });
    expect(forced.flash?.kind).toBe('ok');
    expect(await query('SELECT id FROM VolunteerRole')).toEqual([]);
    const sessions = await query<{ volunteerRolesIds: string | null }>('SELECT volunteerRolesIds FROM MultiDistrib');
    expect(sessions.every((m) => !(m.volunteerRolesIds ?? '').includes(String(role.id)))).toBe(true);
  });

  test('a role nobody holds is deleted without confirmation', { tag: ['@DIS-ROL-005'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    const a = await session(app, as, s, 'groupAdmin');

    const res = await app.actions.volunteers.deleteRole(a.request, role.id);

    expect(res.flash?.kind).toBe('ok');
    expect(await query('SELECT id FROM VolunteerRole')).toEqual([]);
  });

  test('a group admin chooses which roles a session needs, but cannot drop a role that has volunteers', { tag: ['@DIS-ROL-007'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    const second = await make.volunteerRole({ group: s.group, name: 'Rangement', enabledByDefault: false });
    const a = await session(app, as, s, 'groupAdmin');
    const mdRow = s.multiDistribs[0];

    const add = await app.actions.volunteers.setSessionRoles(a.request, mdRow.id, [role.id, second.id]);
    expect(add.flash?.kind).toBe('ok');
    expect((await queryOne<{ volunteerRolesIds: string }>('SELECT volunteerRolesIds FROM MultiDistrib WHERE id = ?', [mdRow.id]))!.volunteerRolesIds).toBe(`${role.id},${second.id}`);

    await make.volunteer({ user: s.users.member, multiDistrib: mdRow, role: second });
    const drop = await app.actions.volunteers.setSessionRoles(a.request, mdRow.id, [role.id]);
    expect(drop.flash?.kind).toBe('error');
    expect((await queryOne<{ volunteerRolesIds: string }>('SELECT volunteerRolesIds FROM MultiDistrib WHERE id = ?', [mdRow.id]))!.volunteerRolesIds).toBe(`${role.id},${second.id}`);
  });

  test('a coordinator can delete only the roles of their own catalog (UND-065)', { tag: ['@DIS-ROL-010'] }, async ({ app, as }) => {
    deviation('UND-065');
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const foreign = await make.volunteerRole({ group: s.group, name: 'Rôle du pain', catalog: other });
    const c = await session(app, as, s, 'coordinator'); // no right on "Pain"

    await app.actions.volunteers.deleteCatalogRole(c.request, foreign.id, other.id);

    expect(await query('SELECT id FROM VolunteerRole WHERE id = ?', [foreign.id])).toHaveLength(1);
  });
});

test.describe('duty settings and reminders', () => {
  test('a group admin opens the volunteers settings and edits the days and the email texts', { tag: ['@DIS-ROL-011', '@DIS-VRM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await session(app, as, s, 'groupAdmin');
    const page = await app.actions.volunteers.settings(a.request);
    expect(page.status).toBe(200);
    expect(page.values).toMatchObject({ dutyperiodsopen: '60', daysAfterClosingBeforeHidingDutyPeriods: '30' });

    const res = await app.actions.volunteers.saveSettings(a.request, { volunteersMailContent: 'Bonjour, pensez à la permanence', alertMailContent: 'Il manque du monde !' });

    expect(res.flash?.kind).toBe('ok');
    const row = await queryOne<{ volunteersMailContent: string; alertMailContent: string }>('SELECT volunteersMailContent, alertMailContent FROM `Group` WHERE id = ?', [s.group.id]);
    expect(row).toEqual({ volunteersMailContent: 'Bonjour, pensez à la permanence', alertMailContent: 'Il manque du monde !' });
  });

  test('the opening period must be between 7 and 365 days, and the hiding delay at most 255', { tag: ['@DIS-ROL-008', '@DIS-ROL-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await session(app, as, s, 'groupAdmin');
    const days = async () => (await queryOne<{ d: number; h: number }>('SELECT daysBeforeDutyPeriodsOpen AS d, daysAfterClosingBeforeHidingDutyPeriods AS h FROM `Group` WHERE id = ?', [s.group.id]))!;

    expect((await app.actions.volunteers.saveSettings(a.request, { dutyperiodsopen: 6 })).flash?.kind).toBe('error');
    expect((await app.actions.volunteers.saveSettings(a.request, { dutyperiodsopen: 366 })).flash?.kind).toBe('error');
    expect((await app.actions.volunteers.saveSettings(a.request, { daysAfterClosingBeforeHidingDutyPeriods: 256 })).flash?.kind).toBe('error');
    expect(await days()).toEqual({ d: 60, h: 30 });

    expect((await app.actions.volunteers.saveSettings(a.request, { dutyperiodsopen: 7, daysAfterClosingBeforeHidingDutyPeriods: 0 })).flash?.kind).toBe('ok');
    expect(await days()).toEqual({ d: 7, h: 0 });
  });

  test('members receive an alert email when a session still has vacant roles', { tag: ['@DIS-VRM-002'] }, async ({ app, as, clock, cron, mails }) => {
    const { s } = await withRole();
    const a = await session(app, as, s, 'groupAdmin');
    await app.actions.volunteers.saveSettings(a.request, { allowAlertNotifs: true, alertmaildays: 7 });
    const target = s.multiDistribs[0];
    clock.set(new Date(target.distribStartDate.getTime() - 7 * 86_400_000 + 30 * 60_000)); // 7 days before, in the hour the session starts
    const mark = await mails.mark();

    await cron.run('hour');

    const sent = await mails.since(mark);
    expect(sent.some((m) => m.to.includes(s.users.member.email))).toBe(true);
  });

  test('the volunteers participation page lists the members', { tag: ['@DIS-VOL-014', '@DIS-VOL-013'] }, async ({ app, as }) => {
    const { s } = await withRole();
    const a = await session(app, as, s, 'groupAdmin');

    const res = await app.actions.volunteers.participation(a.request);

    expect(res.status).toBe(200);
    expect(res.text).toContain('MEMBRE Martine');
  });
});
