/**
 * Attendance sheets (specs/04-distributions/attendance-sheets.md; controller/Distribution.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';

async function arrange(app: any, as: any) {
  const s = await make.amapScenario();
  const m1 = await as(s.users.member);
  const m2 = await as(s.users.member2);
  await subscribeConst(app, m1.request, s, s.users.member.id, { quantity: 2 });
  await subscribeConst(app, m2.request, s, s.users.member2.id);
  const c = await as(s.users.coordinator);
  await app.actions.group.select(c.request, s.group.id);
  const admin = await as(s.users.groupAdmin);
  await app.actions.group.select(admin.request, s.group.id);
  const date = make.parisDate(s.multiDistribs[0].distribStartDate);
  return { s, c, admin, date };
}

test.describe('attendance sheets', () => {
  test('a coordinator opens the attendance sheet of a catalog distribution', { tag: ['@DIS-ATT-005'] }, async ({ app, as }) => {
    const { s, c } = await arrange(app, as);

    const res = await app.views.attendance.catalogSheet(c.request, s.distributions[0].const.id);

    expect(res.status).toBe(200); // the sheet itself is drawn by a neo module: the server page is a shell
  });

  test('a member cannot open it', { tag: ['@DIS-ATT-005'] }, async ({ app, as }) => {
    const { s } = await arrange(app, as);
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.views.attendance.catalogSheet(m.request, s.distributions[0].const.id);

    expect(res.status).toBe(302);
  });

  test('a table of products by member for one distribution', { tag: ['@DIS-ATT-010', '@DIS-ATT-011'] }, async ({ app, as }) => {
    // UND-060: today any member can open it; characterised for the coordinator only.
    const { s, c } = await arrange(app, as);

    const res = await app.views.attendance.productsByMember(c.request, s.distributions[0].const.id);

    expect(res.status).toBe(200);
    expect(res.text).toContain('MEMBRE Martine');
    expect(res.text).toContain('MEMBRE Marc');
    expect(res.text).toContain('Panier de légumes');
  });

  test('a whole-day sheet in each layout lists the members, products and quantities', { tag: ['@DIS-ATT-001', '@DIS-ATT-002', '@DIS-ATT-003', '@DIS-MDS-011'] }, async ({ app, as }) => {
    const { s, admin, date } = await arrange(app, as);

    for (const type of ['all', 'allshort', 'one', 'contract'] as const) {
      const res = await app.views.attendance.day(admin.request, date, s.place.id, type);
      expect(res.status, type).toBe(200);
      expect(res.text, type).toContain('MEMBRE Martine');
      expect(res.text, type).toContain('MEMBRE Marc');
      expect(res.text, type).toContain('Panier de légumes');
    }
  });

  test('the whole-day sheet is for coordinators of all catalogs', { tag: ['@DIS-ATT-001'] }, async ({ app, as }) => {
    const { s, c, date } = await arrange(app, as);

    const res = await app.views.attendance.day(c.request, date, s.place.id, 'all');

    expect(res.status).toBe(302);
  });

  test('the daily attendance can be exported as CSV', { tag: ['@DIS-ATT-004', '@DIS-MDS-011'] }, async ({ app, as }) => {
    const { s, admin, date } = await arrange(app, as);

    const res = await app.exports.dayAttendance(admin.request, date, s.place.id);

    expect(res.status).toBe(200);
    expect(res.rows.map((r) => [r['userName'], r['Quantité'], r['total']]).sort()).toEqual([
      ['MEMBRE Marc', '1', '15'],
      ['MEMBRE Martine', '2', '30'],
    ]);
  });

  test('the format form offers a CSV choice (UND-095)', { tag: ['@PAY-RPT-010'] }, async ({ app, as }) => {
    deviation('UND-095');
    const { s, admin, date } = await arrange(app, as);

    const choices = await app.views.attendance.dayFormChoices(admin.request, date, s.place.id);

    expect(choices).toEqual(expect.arrayContaining(['one', 'contract', 'all', 'allshort', 'csv']));
  });
});

