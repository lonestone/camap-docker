/**
 * Attendance sheet export (specs/04-distributions/attendance-sheets.md, DIS-ATT-008).
 * The CSV and XLSX files are built in the browser (front-core attendanceSheet.utils.ts) from the GraphQL
 * attendance queries: the file itself is not testable here, the data its header is made of is.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

async function selected(app: any, as: any, s: any, who: keyof typeof s.users) {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

test.describe('the header of an exported attendance sheet', () => {
  test('a constant catalog gives the group, the catalog, its coordinator, its vendor and the instructions', { tag: ['@DIS-ATT-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await execute('UPDATE `Group` SET txtDistrib = ? WHERE id = ?', ['Apportez vos sacs', s.group.id]);
    const c = await selected(app, as, s, 'coordinator');

    const res = await app.api.distributions.attendanceSheetHeader(c.request, s.constCatalog.id);

    expect(res.errors).toBeNull();
    const { catalog } = res.data!.sheet;
    expect(catalog).toMatchObject({
      id: s.constCatalog.id,
      name: 'Légumes (contrat AMAP)',
      group: { id: s.group.id, name: 'AMAP des Tests', txtDistrib: 'Apportez vos sacs' },
      user: { id: s.users.coordinator.id, firstName: 'Colette', lastName: 'Coordinatrice', email: 'coordinator@camap.test' },
      vendor: { id: s.vendor.id, name: 'Ferme du Test', email: 'ferme@camap.test' },
    });
  });

  test('a variable catalog distribution also gives the volunteers of the session with their roles', { tag: ['@DIS-ATT-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const caisse = await make.volunteerRole({ group: s.group, name: 'Caisse' });
    const own = await make.volunteerRole({ group: s.group, name: 'Pesée', catalog: s.varCatalog });
    await make.volunteer({ user: s.users.member, multiDistrib: s.multiDistribs[0], role: caisse });
    await make.volunteer({ user: s.users.member2, multiDistrib: s.multiDistribs[0], role: own });
    const c = await selected(app, as, s, 'coordinator');

    const res = await app.api.distributions.attendanceSheetHeader(c.request, s.varCatalog.id, s.distributions[0].var.id);

    expect(res.errors).toBeNull();
    const md = res.data!.sheet.distribution!.multiDistrib;
    expect(md.id).toBe(s.multiDistribs[0].id);
    expect(md.volunteers.map((v) => [v.user.id, v.volunteerRole.name, v.volunteerRole.catalogId]).sort()).toEqual(
      [
        [s.users.member.id, 'Caisse', null],
        [s.users.member2.id, 'Pesée', s.varCatalog.id],
      ].sort(),
    );
  });
});
