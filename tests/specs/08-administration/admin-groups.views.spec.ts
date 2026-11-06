/**
 * Group administration by a superadmin: the list and its search, and the group page
 * (specs/08-administration/admin-groups.md; controller/admin/Group.hx).
 *
 * The group search is a GET form of the back-office. Its guard is the one of the parent route
 * (`@admin` on the back-office), which sends anyone else to "/".
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import * as make from '../../src/factories/index.js';

/** The scenario group (zip 44000) and four more: Rennes, Paris, Lyon (a quote in its name), and one with no place. */
async function arrange() {
  const s = await make.amapScenario();
  const rennes = await make.group({ name: 'AMAP du Bocage' });
  await make.place({ group: rennes, zipCode: '35000', city: 'Rennes' });
  const paris = await make.group({ name: 'Panier Parisien' });
  await make.place({ group: paris, zipCode: '75018', city: 'Paris' });
  const lyon = await make.group({ name: 'La "bonne" AMAP' });
  await make.place({ group: lyon, zipCode: '69001', city: 'Lyon' });
  const noPlace = await make.group({ name: 'Jardin sans lieu' });
  return { s, rennes, paris, lyon, noPlace };
}

const ids = (res: { groups: { id: number }[] }) => res.groups.map((g) => g.id);

test.describe('group list and search', () => {
  test('a superadmin lists every group by id, with the department of its first place', { tag: ['@ADM-GRP-001'] }, async ({ app, as }) => {
    const { s, rennes, paris, lyon, noPlace } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request);

    expect(res.status).toBe(200);
    expect(res.groups).toEqual([
      { id: s.group.id, name: 'AMAP des Tests', zipPrefix: '44', country: 'FR' },
      { id: rennes.id, name: 'AMAP du Bocage', zipPrefix: '35', country: 'FR' },
      { id: paris.id, name: 'Panier Parisien', zipPrefix: '75', country: 'FR' },
      { id: lyon.id, name: 'La "bonne" AMAP', zipPrefix: '69', country: 'FR' },
      { id: noPlace.id, name: 'Jardin sans lieu', zipPrefix: null, country: null },
    ]);
  });

  test('searching a name keeps the groups whose name contains it', { tag: ['@ADM-GRP-001'] }, async ({ app, as }) => {
    const { s, rennes, lyon } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: 'AMAP' });

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([s.group.id, rennes.id, lyon.id]);
  });

  test('a search by name that matches nothing lists nothing', { tag: ['@ADM-GRP-001'] }, async ({ app, as }) => {
    const { s } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: 'introuvable' });

    expect(res.status).toBe(200);
    expect(res.groups).toEqual([]);
  });

  test('searching department numbers keeps the groups whose place is in one of them', { tag: ['@ADM-GRP-001'] }, async ({ app, as }) => {
    const { s, rennes, paris } = await arrange();
    const admin = await as(s.users.superadmin);

    const one = await app.views.admin.groups(admin.request, { name: '', zipCodes: '35' });
    const several = await app.views.admin.groups(admin.request, { name: '', zipCodes: '44,75' });
    const spaced = await app.views.admin.groups(admin.request, { name: '', zipCodes: '35, 75' });

    expect(ids(one)).toEqual([rennes.id]);
    expect(ids(several)).toEqual([s.group.id, paris.id]);
    expect(ids(spaced)).toEqual([rennes.id, paris.id]);
  });

  test('a department number is a whole department: 4 is not 44', { tag: ['@ADM-GRP-001'] }, async ({ app, as }) => {
    const { s } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: '', zipCodes: '4' });

    expect(res.status).toBe(200);
    expect(res.groups).toEqual([]);
  });

  test('a name and department numbers narrow the result together', { tag: ['@ADM-GRP-001'] }, async ({ app, as }) => {
    const { s, rennes } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: 'AMAP', zipCodes: '35,75' });

    expect(ids(res)).toEqual([rennes.id]);
  });

  test('with department numbers, a group without a place is left out', { tag: ['@ADM-GRP-001'] }, async ({ app, as }) => {
    const { s, noPlace } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: 'Jardin', zipCodes: '44' });
    const byName = await app.views.admin.groups(admin.request, { name: 'Jardin' });

    expect(res.groups).toEqual([]);
    expect(ids(byName)).toEqual([noPlace.id]);
  });

  for (const who of ['member', 'groupAdmin'] as const) {
    test(`a ${who} gets no group list or search result`, { tag: ['@ADM-GRP-001', '@ADM-GRP-002'] }, async ({ app, as }) => {
      const { s } = await arrange();
      const u = await as(s.users[who]);

      const list = await app.views.admin.groups(u.request);
      const search = await app.views.admin.groups(u.request, { name: 'AMAP' });

      for (const res of [list, search]) {
        expect(res.status).toBe(302);
        expect(res.location).toBe('/');
        expect(res.groups).toEqual([]);
      }
    });
  }

  test('a visitor gets no group list or search result', { tag: ['@ADM-GRP-001', '@ADM-GRP-002'] }, async ({ app, as }) => {
    await arrange();
    const visitor = await as('anon');

    const search = await app.views.admin.groups(visitor.request, { name: 'AMAP' });

    expect(search.status).toBe(302);
    expect(search.groups).toEqual([]);
  });
});

test.describe('group search is not a query', () => {
  test('text with quotes and SQL keywords is only a name to look for', { tag: ['@ADM-GRP-002'] }, async ({ app, as }) => {
    // UND-109: decided, the name goes to the database as a query parameter. Today it is pasted
    // between quotes in the SQL (Group.hx:38-44): this closes the quote and lists every group.
    deviation('UND-109');
    const { s } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: 'zzz" OR 1=1 OR g.name like "' });

    expect(res.groups).toEqual([]);
  });

  test('a name with a double quote is found like any other name', { tag: ['@ADM-GRP-002'] }, async ({ app, as, errors }) => {
    // UND-109: today the quote breaks the SQL statement and the page is the error page
    deviation('UND-109');
    errors.expect(/SQL syntax/);
    const { s, lyon } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: '"bonne"' });

    expect(ids(res)).toEqual([lyon.id]);
  });

  test('department numbers that are not numbers end on the error page', { tag: ['@ADM-GRP-002'] }, async ({ app, as, errors }) => {
    // Not decided: the zip codes go through Std.parseInt, and the result of a failed parse is
    // multiplied, which crashes (Group.hx:34). Today's behaviour.
    errors.expect(/Invalid operation/);
    const { s } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.groups(admin.request, { name: '', zipCodes: 'abc' });

    expect(res.status).toBe(200);
    expect(res.groups).toEqual([]);
    expect(res.text).toMatch(/Une erreur est survenue/);
  });
});

test.describe('group page', () => {
  test('a superadmin sees the members, the producers and the active catalogs of a group', { tag: ['@ADM-GRP-003'] }, async ({ app, as }) => {
    const { s } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.group(admin.request, s.group.id);

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(res.text).toContain(`Groupe #${s.group.id}`);
    expect(res.text).toContain('AMAP des Tests');
    expect([...res.memberIds].sort((a, b) => a - b)).toEqual(
      [s.users.member, s.users.member2, s.users.coordinator, s.users.membershipManager, s.users.messagesManager, s.users.groupAdmin].map((u) => u.id).sort((a, b) => a - b),
    );
    expect(res.memberIds).not.toContain(s.users.superadmin.id);
    expect(res.vendorIds).toEqual([s.vendor.id]);
    expect([...res.catalogIds].sort((a, b) => a - b)).toEqual([s.constCatalog.id, s.varCatalog.id].sort((a, b) => a - b));
    // the page also gives the superadmin the actions on the group
    expect(res.offers).toEqual({ addMe: true, delete: true });
  });

  test('a group with no member, producer or catalog has an empty page', { tag: ['@ADM-GRP-003'] }, async ({ app, as }) => {
    const { s, noPlace } = await arrange();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.group(admin.request, noPlace.id);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Jardin sans lieu');
    expect(res.memberIds).toEqual([]);
    expect(res.vendorIds).toEqual([]);
    expect(res.catalogIds).toEqual([]);
  });

  test('a group admin of that group cannot open its back-office page', { tag: ['@ADM-GRP-003'] }, async ({ app, as }) => {
    const { s } = await arrange();
    const groupAdmin = await as(s.users.groupAdmin);

    const res = await app.views.admin.group(groupAdmin.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.memberIds).toEqual([]);
  });
});
