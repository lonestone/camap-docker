/**
 * Creating and disabling a group as a superadmin (specs/08-administration/admin-groups.md ADM-GRP-006, ADM-GRP-007;
 * specs/02-groups/group-creation.md GRP-CRE-002 to 005; controller/Group.hx doCreate, sys.db.admin).
 *
 * Group creation locates the first place through Mapbox. The test stack answers that call with a fixed point
 * (tests/stack/curl-stub.sh, installed in the neko-test image): without it the real Mapbox refuses the test
 * token, the request fails after the inserts, and everything is rolled back.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const STUB_POINT = { lat: 48.1173, lng: -1.6778 };
const NEW_GROUP = { groupName: 'AMAP du Test', name: 'Salle des fêtes', address1: '12 place du Marché', zipCode: '35000', city: 'Rennes' };

test.describe('a superadmin creates a group', () => {
  test('the group, its first place and the creator\'s membership are stored, and the creator lands on the home page of the new group', { tag: ['@ADM-GRP-007', '@GRP-CRE-001', '@GRP-CRE-002', '@GRP-CRE-005'] }, async ({ app, as }) => {
    const superadmin = await make.user({ superadmin: true });
    const admin = await as(superadmin);

    const res = await app.actions.group.create(admin.request, NEW_GROUP);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(res.flash?.kind).toBe('ok');
    expect(res.flash?.text).toMatch(/Félicitations, vous venez juste de créer une nouvelle AMAP/);
    const group = (await queryOne<{ id: number; name: string; userId: number | null }>('SELECT id, name, userId FROM `Group` WHERE name = ?', [NEW_GROUP.groupName]))!;
    expect(group).toBeDefined();
    // GRP-CRE-002: the creator is a member and the group's contact
    expect(group.userId).toBe(superadmin.id);
    expect(await query('SELECT userId, groupId FROM UserGroup WHERE groupId = ?', [group.id])).toEqual([{ userId: superadmin.id, groupId: group.id }]);
    // hx stores no right row for a superadmin (UserGroup.giveRight returns early: a superadmin holds every right),
    // yet the four rights open the group's administration pages
    expect((await queryOne<{ rights: string | null }>('SELECT rights FROM UserGroup WHERE groupId = ?', [group.id]))!.rights).toBeNull();
    await app.actions.group.select(admin.request, group.id);
    const dashboard = await app.views.groupAdmin.dashboard(admin.request);
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toContain(NEW_GROUP.groupName);
    // GRP-CRE-005: the new group is the selected one: the home page is its page, not the group chooser
    const home = await app.views.groups.home(admin.request);
    expect(home.status).toBe(200);
    expect(home.location).toBeNull();
    expect(home.text).toContain(NEW_GROUP.groupName);
  });

  test('the selected group is the new one even when the creator belongs to other groups', { tag: ['@GRP-CRE-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.superadmin, group: s.group, rights: [] });
    const admin = await as(s.users.superadmin);
    await app.actions.group.select(admin.request, s.group.id);

    await app.actions.group.create(admin.request, NEW_GROUP);

    const home = await app.views.groups.home(admin.request);
    expect(home.status).toBe(200);
    expect(home.text).toContain(NEW_GROUP.groupName);
    expect(home.text).not.toContain(s.group.name);
  });

  test('the new group starts with memberships on, a waiting list, and cash and check payments', { tag: ['@ADM-GRP-007', '@GRP-CRE-003'] }, async ({ app, as }) => {
    const admin = await as(await make.user({ superadmin: true }));

    await app.actions.group.create(admin.request, NEW_GROUP);

    const g = (await queryOne<{ hasMembership: number; regOption: number; allowedPaymentsType: string; disabled: string | null }>(
      'SELECT hasMembership, regOption, allowedPaymentsType, disabled FROM `Group` WHERE name = ?',
      [NEW_GROUP.groupName],
    ))!;
    expect(g.hasMembership).toBe(1);
    expect(g.regOption).toBe(1); // RegOption.WaitingList (Open = 2, Closed = 0)
    expect(JSON.parse(g.allowedPaymentsType).sort()).toEqual(['cash', 'check']);
    expect(g.disabled).toBeNull();
  });

  test('the first place is stored with the given address and located automatically', { tag: ['@ADM-GRP-007', '@GRP-CRE-004'] }, async ({ app, as }) => {
    const admin = await as(await make.user({ superadmin: true }));

    await app.actions.group.create(admin.request, NEW_GROUP);

    const place = (await queryOne<Record<string, unknown>>('SELECT p.* FROM Place p JOIN `Group` g ON g.id = p.groupId WHERE g.name = ?', [NEW_GROUP.groupName]))!;
    expect(place).toMatchObject({ name: 'Salle des fêtes', address1: '12 place du Marché', zipCode: '35000', city: 'Rennes', country: 'FR' });
    expect(place.lat).toBeCloseTo(STUB_POINT.lat, 4);
    expect(place.lng).toBeCloseTo(STUB_POINT.lng, 4);
  });

  test('when the map service finds nothing at that address, the whole creation is rolled back', { tag: ['@GRP-CRE-004'] }, async ({ app, as, errors }) => {
    // the stub answers a point without coordinates for an address containing NOWHERE (the real service does this for unknown addresses)
    errors.expect(/unable to locate this address/);
    const admin = await as(await make.user({ superadmin: true }));
    const count = async () => (await queryOne<{ g: number; p: number; ug: number }>('SELECT (SELECT COUNT(*) FROM `Group`) AS g, (SELECT COUNT(*) FROM Place) AS p, (SELECT COUNT(*) FROM UserGroup) AS ug'))!;
    const before = await count();

    const res = await app.actions.group.create(admin.request, { ...NEW_GROUP, address1: '1 rue NOWHERE' });

    expect(res.status).toBe(200);
    expect(res.body).toContain('unable to locate this address');
    expect(await count()).toEqual(before);
  });
});

test.describe('a superadmin disables a group', () => {
  // UND-025 is undecided: no screen and no endpoint write the field. The raw database tool (a superadmin-only
  // page, the only way today) edits the `disabled` column of the group row.
  const rowOf = (id: number) => queryOne<Record<string, unknown>>('SELECT * FROM `Group` WHERE id = ?', [id]);

  test('through the raw database tool, a group is disabled and members are sent to its notice', { tag: ['@ADM-GRP-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);
    const before = (await rowOf(s.group.id))!;
    expect((await app.views.groups.home(member.request)).status).toBe(200);

    const res = await app.actions.admin.editGroupColumnInDatabaseTool(admin.request, s.group.id, 'disabled', 'BLOCKED_BY_ADMIN');

    expect(res.status).toBe(302); // back to the row
    const after = (await rowOf(s.group.id))!;
    expect(after.disabled).toBe('BLOCKED_BY_ADMIN');
    // nothing else of the row changed
    expect({ ...after, disabled: null }).toEqual({ ...before, disabled: null });
    const home = await app.views.groups.home(member.request);
    expect(home.status).toBe(302);
    expect(home.location).toBe('/group/disabled');
  });

  test('clearing the column enables the group again', { tag: ['@ADM-GRP-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await execute("UPDATE `Group` SET disabled = 'SUSPENDED' WHERE id = ?", [s.group.id]);
    const admin = await as(s.users.superadmin);

    await app.actions.admin.editGroupColumnInDatabaseTool(admin.request, s.group.id, 'disabled', null);

    expect((await rowOf(s.group.id))!.disabled).toBeNull();
  });

  test('a group admin cannot reach the database tool', { tag: ['@ADM-GRP-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const groupAdmin = await as(s.users.groupAdmin);

    const res = await app.actions.admin.editGroupColumnInDatabaseTool(groupAdmin.request, s.group.id, 'disabled', 'BLOCKED_BY_ADMIN');

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect((await rowOf(s.group.id))!.disabled).toBeNull();
  });
});
