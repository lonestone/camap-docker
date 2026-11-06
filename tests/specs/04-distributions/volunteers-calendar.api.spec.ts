/**
 * Volunteer calendar roles and assignments, remainder pass (specs/04-distributions/volunteers.md;
 * controller/api/Distributions.hx doVolunteerRolesCalendar, service/VolunteerService.hx
 * getUsedRolesInMultidistribs, controller/Distribution.hx doVolunteers).
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';

const day = (clock: { now(): Date }, n: number) => make.parisDate(addDaysWall(clock.now(), n));
const volunteersOf = (md: number) => query<{ userId: number; volunteerRoleId: number }>('SELECT userId, volunteerRoleId FROM Volunteer WHERE multiDistribId = ?', [md]);

test.describe('roles shown in the volunteers calendar', () => {
  test('the generic roles are always shown, the roles of a catalog until the group\'s hiding delay after it ends', { tag: ['@DIS-VOL-012'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario(); // the hiding delay of the group is 30 days
    const live = await make.catalog({ group: s.group, vendor: s.vendor, name: 'En cours', endDate: addDaysWall(clock.now(), 100) });
    const justEnded = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Fini hier', endDate: addDaysWall(clock.now(), -10) });
    const longEnded = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Fini depuis longtemps', endDate: addDaysWall(clock.now(), -45) });
    const generic = await make.volunteerRole({ group: s.group, name: 'Caisse' });
    const roleLive = await make.volunteerRole({ group: s.group, name: 'Rôle en cours', catalog: live });
    const roleJustEnded = await make.volunteerRole({ group: s.group, name: 'Rôle fini récemment', catalog: justEnded });
    const roleLongEnded = await make.volunteerRole({ group: s.group, name: 'Rôle fini depuis longtemps', catalog: longEnded });
    const all = [generic, roleLive, roleJustEnded, roleLongEnded].map((r) => r.id).join(',');
    await query('UPDATE MultiDistrib SET volunteerRolesIds = ? WHERE groupId = ?', [all, s.group.id]);
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.api.distributions.volunteerRolesCalendar(m.request, day(clock, 0), day(clock, 40));

    expect(res.status).toBe(200);
    expect(res.body.roles.map((r: { id: number }) => r.id).sort((a: number, b: number) => a - b)).toEqual([generic.id, roleLive.id, roleJustEnded.id]);
    expect(Object.keys(res.body.multiDistribs[0].hasVolunteerRole).map(Number).sort((a, b) => a - b)).toEqual([generic.id, roleLive.id, roleJustEnded.id]);
  });

  test('a longer hiding delay keeps the roles of a catalog that ended long ago', { tag: ['@DIS-VOL-012'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const longEnded = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Fini depuis longtemps', endDate: addDaysWall(clock.now(), -45) });
    const role = await make.volunteerRole({ group: s.group, name: 'Rôle ancien', catalog: longEnded });
    await query('UPDATE MultiDistrib SET volunteerRolesIds = ? WHERE groupId = ?', [String(role.id), s.group.id]);
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);
    const before = await app.api.distributions.volunteerRolesCalendar(m.request, day(clock, 0), day(clock, 40));
    await query('UPDATE `Group` SET daysAfterClosingBeforeHidingDutyPeriods = 60 WHERE id = ?', [s.group.id]);

    const after = await app.api.distributions.volunteerRolesCalendar(m.request, day(clock, 0), day(clock, 40));

    expect(before.body.roles).toEqual([]);
    expect(after.body.roles).toEqual([{ id: role.id, name: 'Rôle ancien' }]);
  });
});

test.describe('assigning volunteers to a session', () => {
  async function withRole() {
    const s = await make.amapScenario();
    const role = await make.volunteerRole({ group: s.group, name: 'Caisse' });
    await query('UPDATE MultiDistrib SET volunteerRolesIds = ? WHERE groupId = ?', [String(role.id), s.group.id]);
    return { s, role };
  }

  test('any member of the group can assign volunteers: there is no rights check (UND-060, kept as is)', { tag: ['@DIS-VOL-009'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    const plain = await as(s.users.member); // no right at all
    await app.actions.group.select(plain.request, s.group.id);
    const md = s.multiDistribs[0].id;

    const res = await app.actions.volunteers.assign(plain.request, md, { [role.id]: s.users.member2.id });

    // the flash is lost: /distribution itself redirects a member without the rights
    expect(res.status).toBe(302);
    expect(res.location).toBe('/distribution');
    expect(await volunteersOf(md)).toEqual([{ userId: s.users.member2.id, volunteerRoleId: role.id }]);
  });

  test('the session is not checked against the admin\'s group (UND-060, kept as is)', { tag: ['@DIS-VOL-009'] }, async ({ app, as }) => {
    const { s, role } = await withRole();
    const other = await make.group({ name: 'Autre AMAP' });
    const boss = await make.user({ firstName: 'Bob', lastName: 'Autre' });
    await make.userGroup({ user: boss, group: other, rights: [Right.GroupAdmin()] });
    const b = await as(boss);
    await app.actions.group.select(b.request, other.id);
    const md = s.multiDistribs[0].id; // a session of the first group

    const res = await app.actions.volunteers.assign(b.request, md, { [role.id]: boss.id });

    // the flash is lost: /distribution itself redirects a member without the rights
    expect(res.status).toBe(302);
    expect(res.location).toBe('/distribution');
    expect(await volunteersOf(md)).toEqual([{ userId: boss.id, volunteerRoleId: role.id }]);
  });
});
