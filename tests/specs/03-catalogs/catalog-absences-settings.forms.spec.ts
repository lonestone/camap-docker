/**
 * Absence rules of a catalog (specs/03-catalogs/catalog-absences-settings.md; controller/ContractAdmin.hx doAbsences,
 * service/CatalogService.hx checkAbsences, service/AbsencesService.hx, db/Catalog.hx hasAbsencesManagement,
 * controller/api/Catalog.hx doCatalogAbsences).
 * Declaring absences on a subscription is covered by specs/05-orders/absences*.spec.ts; the main catalog form
 * does not hold these fields (catalog-edit.forms.spec.ts, CAT-CED-005 clears them when the minimum is 0).
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne } from '../../src/db/client.js';
import { addDaysWall, atWallTime, fromSqlDateTime, toSqlDate, toSqlDateTime } from '../../src/encodings/dates.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** A logged-in actor with the scenario group as current group. */
async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'coordinator') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

type Stored = { absentDistribsMaxNb: number; absencesStartDate: string | null; absencesEndDate: string | null; startDate: string; endDate: string };
const stored = async (id: number) =>
  (await queryOne<Stored>('SELECT absentDistribsMaxNb, absencesStartDate, absencesEndDate, startDate, endDate FROM Catalog WHERE id = ?', [id]))!;

/** Day (YYYY-MM-DD) of the n-th scenario distribution (0-based), shifted by `shift` days. */
const dayOf = (s: Scenario, i: number, shift = 0) => toSqlDate(addDaysWall(s.multiDistribs[i].distribStartDate, shift));

/** The constant catalog with no absence rule at all. */
async function withoutAbsences(s: Scenario) {
  await make.setCatalog(s.constCatalog.id, { absentDistribsMaxNb: 0, absencesStartDate: null, absencesEndDate: null });
}

test.describe('allowing absences on a catalog', () => {
  test('the coordinator sets a maximum number and an absence period', { tag: ['@CAT-CAB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await withoutAbsences(s);
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 3, startDate: dayOf(s, 0, -1), endDate: dayOf(s, 3, 1) });

    expect(res.status).toBe(302);
    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    const row = await stored(s.constCatalog.id);
    expect(row.absentDistribsMaxNb).toBe(3);
    // the period runs from the start of its first day to the end of its last day
    expect(row.absencesStartDate).toBe(`${dayOf(s, 0, -1)} 00:00:00`);
    expect(row.absencesEndDate).toBe(`${dayOf(s, 3, 1)} 23:59:59`);
  });

  test('the form shows the saved rules; with none yet it proposes the catalog dates', { tag: ['@CAT-CAB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const saved = await app.actions.catalogs.absencesForm(a.request, s.constCatalog.id);
    await withoutAbsences(s);
    const empty = await app.actions.catalogs.absencesForm(a.request, s.constCatalog.id);

    expect(saved).toMatchObject({ status: 200, maxNb: 2, startDate: dayOf(s, 0, -1), endDate: dayOf(s, 3, 1) });
    const catalog = await stored(s.constCatalog.id);
    expect(empty).toMatchObject({ status: 200, maxNb: 0, startDate: catalog.startDate.slice(0, 10), endDate: catalog.endDate.slice(0, 10) });
  });

  test('the group admin, who coordinates all catalogs, sets the rules too', { tag: ['@CAT-CAB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 1 });

    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await stored(s.constCatalog.id)).absentDistribsMaxNb).toBe(1);
  });

  test('a member and the coordinator of another catalog cannot change the rules', { tag: ['@CAT-CAB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ firstName: 'Boris', lastName: 'Boulanger', email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });
    const before = await stored(s.constCatalog.id);

    for (const who of [await actor(app, as, s, 'member'), await as(baker)]) {
      await app.actions.group.select(who.request, s.group.id);
      const form = await app.actions.catalogs.absencesForm(who.request, s.constCatalog.id);
      const res = await app.actions.catalogs.setAbsences(who.request, s.constCatalog.id, { maxNb: 1 });

      expect(form.status).toBe(302);
      expect(form.location).not.toContain('/contractAdmin/absences');
      expect(res.location ?? '').not.toContain(app.urls.catalogDashboard(s.constCatalog.id));
    }
    expect(await stored(s.constCatalog.id)).toEqual(before);
  });

  test('a maximum of 0 switches absences off', { tag: ['@CAT-CAB-001', '@CAT-CAB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 0 });

    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await stored(s.constCatalog.id)).absentDistribsMaxNb).toBe(0);
    const rules = await app.api.catalog.absences(a.request, s.constCatalog.id);
    expect(rules.body.possibleAbsentDistribs).toEqual([]);
  });
});

test.describe('when members can use absences', () => {
  test('a constant catalog with a maximum and both dates offers its distributions', { tag: ['@CAT-CAB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const rules = await app.api.catalog.absences(member.request, s.constCatalog.id);

    expect(rules.status).toBe(200);
    expect(rules.body.possibleAbsentDistribs.map((d) => d.id)).toEqual(s.distributions.map((d) => d.const.id));
  });

  test('a constant catalog with no maximum, or no date, offers no absence', { tag: ['@CAT-CAB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const offered = async () => (await app.api.catalog.absences(member.request, s.constCatalog.id)).body.possibleAbsentDistribs;

    await make.setCatalog(s.constCatalog.id, { absentDistribsMaxNb: 0 });
    expect(await offered()).toEqual([]);
    await make.setCatalog(s.constCatalog.id, { absentDistribsMaxNb: 2, absencesStartDate: null });
    expect(await offered()).toEqual([]);
    await make.setCatalog(s.constCatalog.id, { absencesStartDate: toSqlDateTime(atWallTime(addDaysWall(s.multiDistribs[0].distribStartDate, -1), 0)), absencesEndDate: null });
    expect(await offered()).toEqual([]);
  });

  test('a variable catalog needs a minimum per distribution above 0', { tag: ['@CAT-CAB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const rules = {
      absentDistribsMaxNb: 2,
      absencesStartDate: toSqlDateTime(atWallTime(addDaysWall(s.multiDistribs[0].distribStartDate, -1), 0)),
      absencesEndDate: toSqlDateTime(atWallTime(addDaysWall(s.multiDistribs[3].distribStartDate, 1), 23, 59, 59)),
    };
    await make.setCatalog(s.varCatalog.id, rules);
    const member = await as(s.users.member);
    const sub = await make.subscription({
      user: s.users.member,
      catalog: s.varCatalog,
      startDate: s.multiDistribs[0].distribStartDate,
      endDate: s.multiDistribs[3].distribEndDate,
    });

    const without = await app.api.catalog.absences(member.request, s.varCatalog.id);
    const withoutSub = await app.api.catalog.subscriptionAbsences.get(member.request, sub.id);
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 10 });
    const withMinimum = await app.api.catalog.absences(member.request, s.varCatalog.id);
    const withMinimumSub = await app.api.catalog.subscriptionAbsences.get(member.request, sub.id);

    expect(without.body.possibleAbsentDistribs).toEqual([]);
    expect(withoutSub.status).toBe(403);
    expect(withMinimum.body.possibleAbsentDistribs.map((d) => d.id)).toEqual(s.distributions.map((d) => d.var.id));
    expect(withMinimumSub.status).toBe(200);
  });
});

test.describe('the absence period of a catalog', () => {
  test('both dates are needed: an empty date is not saved', { tag: ['@CAT-CAB-003'] }, async ({ app, as, errors }) => {
    // The "dates required" message of checkAbsences cannot be reached from the form. Today an empty date field
    // crashes the controller (null.getFullYear(), ContractAdmin.hx:1149) and an error page comes back with status 200.
    errors.expect(/getFullYear/);
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await stored(s.constCatalog.id);

    const noStart = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 1, startDate: null });
    const noEnd = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 1, endDate: null });

    for (const res of [noStart, noEnd]) {
      expect(res.status).toBe(200);
      expect(res.location).toBeNull();
    }
    expect(await stored(s.constCatalog.id)).toEqual(before);
  });

  test('the start must be before the end', { tag: ['@CAT-CAB-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await stored(s.constCatalog.id);

    const reversed = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { startDate: dayOf(s, 3), endDate: dayOf(s, 0) });

    expect(reversed.location).toContain('/contractAdmin/absences/');
    expect(reversed.flash?.text).toContain('La date de début des absences doit être avant la date de fin');
    expect(await stored(s.constCatalog.id)).toEqual(before);
  });

  test('a one-day period is accepted: the start is at 00:00 and the end at 23:59', { tag: ['@CAT-CAB-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 1, startDate: dayOf(s, 1), endDate: dayOf(s, 1) });

    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await stored(s.constCatalog.id)).absencesEndDate).toBe(`${dayOf(s, 1)} 23:59:59`);
  });
});

test.describe('the maximum number of absences', () => {
  test('it may equal the number of distributions in the period', { tag: ['@CAT-CAB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 4 });

    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await stored(s.constCatalog.id)).absentDistribsMaxNb).toBe(4);
  });

  test('it cannot exceed the number of distributions in the period', { tag: ['@CAT-CAB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await stored(s.constCatalog.id);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 5 });

    expect(res.location).toContain('/contractAdmin/absences/');
    expect(res.flash?.text).toContain("Le nombre maximum d'absences que vous avez saisi est trop grand");
    expect(await stored(s.constCatalog.id)).toEqual(before);
  });

  test('only the distributions inside the period count', { tag: ['@CAT-CAB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    // period = the first 2 distributions
    const tooMany = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 3, startDate: dayOf(s, 0, -1), endDate: dayOf(s, 1, 1) });
    const ok = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 2, startDate: dayOf(s, 0, -1), endDate: dayOf(s, 1, 1) });

    expect(tooMany.location).toContain('/contractAdmin/absences/');
    expect(ok.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await stored(s.constCatalog.id)).absentDistribsMaxNb).toBe(2);
  });

  test('a distribution that carries shifted orders does not count', { tag: ['@CAT-CAB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setDistributionQuantities(s.distributions[1].const.id, 2);
    const a = await actor(app, as, s);

    const four = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 4 });
    const three = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 3 });

    expect(four.location).toContain('/contractAdmin/absences/');
    expect(three.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
  });

  test('a period covering the whole catalog needs a maximum below the number of distributions', { tag: ['@CAT-CAB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    // the catalog runs exactly over the absence period of the scenario
    await make.setCatalog(s.constCatalog.id, {
      startDate: toSqlDateTime(atWallTime(addDaysWall(s.multiDistribs[0].distribStartDate, -1), 0)),
      endDate: toSqlDateTime(atWallTime(addDaysWall(s.multiDistribs[3].distribStartDate, 1), 23, 59, 59)),
    });
    const a = await actor(app, as, s);

    const equal = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 4 });
    const below = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 3 });

    expect(equal.location).toContain('/contractAdmin/absences/');
    expect(equal.flash?.text).toContain('Il doit être inférieur au nombre de distributions du contrat');
    expect(below.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
    expect((await stored(s.constCatalog.id)).absentDistribsMaxNb).toBe(3);
  });
});

test.describe('the absence period against the catalog dates', () => {
  test('a period inside the catalog dates is accepted', { tag: ['@CAT-CAB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { startDate: dayOf(s, 0, -1), endDate: dayOf(s, 2) });

    expect(res.location).toContain(app.urls.catalogDashboard(s.constCatalog.id));
  });

  test('a period starting before the catalog is refused', { tag: ['@CAT-CAB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await stored(s.constCatalog.id);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { startDate: toSqlDate(addDaysWall(fromSqlDateTime(before.startDate), -10)) });

    expect(res.location).toContain('/contractAdmin/absences/');
    expect(res.flash?.text).toContain('Les dates d\'absences doivent être comprises entre le début et la fin du contrat');
    expect(await stored(s.constCatalog.id)).toEqual(before);
  });

  test('a period ending after the catalog is refused', { tag: ['@CAT-CAB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await stored(s.constCatalog.id);

    const res = await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { endDate: toSqlDate(addDaysWall(fromSqlDateTime(before.endDate), 10)) });

    expect(res.location).toContain('/contractAdmin/absences/');
    expect(res.flash?.text).toContain('Les dates d\'absences doivent être comprises entre le début et la fin du contrat');
    expect(await stored(s.constCatalog.id)).toEqual(before);
  });
});

test.describe('what members see of the absence rules', () => {
  test('anyone can read the period, the maximum and the distributions concerned', { tag: ['@CAT-CAB-006'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const asMember = await app.api.catalog.absences(member.request, s.constCatalog.id);
    const asVisitor = await app.api.catalog.absences(anon.request, s.constCatalog.id);

    for (const res of [asMember, asVisitor]) {
      expect(res.status).toBe(200);
      expect(res.body.absentDistribsMaxNb).toBe(2);
      expect(res.body.startDate).toContain(dayOf(s, 0, -1));
      expect(res.body.endDate).toContain(dayOf(s, 3, 1));
      expect(res.body.possibleAbsentDistribs.map((d) => d.id)).toEqual(s.distributions.map((d) => d.const.id));
    }
  });

  test('only the distributions inside the period, with no shifted orders, are listed', { tag: ['@CAT-CAB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setDistributionQuantities(s.distributions[2].const.id, 2);
    const a = await actor(app, as, s);
    await app.actions.catalogs.setAbsences(a.request, s.constCatalog.id, { maxNb: 2, startDate: dayOf(s, 1, -1), endDate: dayOf(s, 3, 1) });

    const rules = await app.api.catalog.absences(a.request, s.constCatalog.id);

    expect(rules.body.possibleAbsentDistribs.map((d) => d.id)).toEqual([s.distributions[1].const.id, s.distributions[3].const.id]);
  });

  test('a catalog with no absence rule lists no distribution', { tag: ['@CAT-CAB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await withoutAbsences(s);
    const member = await as(s.users.member);

    const rules = await app.api.catalog.absences(member.request, s.constCatalog.id);

    expect(rules.status).toBe(200);
    expect(rules.body.absentDistribsMaxNb).toBe(0);
    expect(rules.body.startDate).toBeNull();
    expect(rules.body.possibleAbsentDistribs).toEqual([]);
  });
});
