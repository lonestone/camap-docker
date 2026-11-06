/**
 * Group administration by a superadmin: add oneself to a group, delete a group, and the
 * command-line scripts (specs/08-administration/admin-groups.md; controller/admin/Group.hx,
 * controller/Scripts.hx).
 *
 * Creating (ADM-GRP-007) and disabling (ADM-GRP-006, UND-025) a group are in group-lifecycle.forms.spec.ts.
 * The clean-up script's dry-run default and explicit minimum ids (UND-108) can only be seen on a
 * command line, which a black-box HTTP test cannot start: only "never from a web page" is tested.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const count = async (table: string, where = '1', params: unknown[] = []) =>
  (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE ${where}`, params))!.n;
const memberships = (userId: number, groupId: number) => count('UserGroup', 'userId = ? AND groupId = ?', [userId, groupId]);

test.describe('add oneself to a group', () => {
  test('a superadmin becomes a member of the group and lands on it', { tag: ['@ADM-GRP-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    expect(await memberships(s.users.superadmin.id, s.group.id)).toBe(0);

    const res = await app.actions.admin.addMeToGroup(admin.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/user/choose?group=${s.group.id}`);
    expect(await memberships(s.users.superadmin.id, s.group.id)).toBe(1);
  });

  test('doing it again does not add a second membership', { tag: ['@ADM-GRP-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    await app.actions.admin.addMeToGroup(admin.request, s.group.id);
    await app.actions.admin.addMeToGroup(admin.request, s.group.id);

    expect(await memberships(s.users.superadmin.id, s.group.id)).toBe(1);
  });

  test('a membership is added to that group only', { tag: ['@ADM-GRP-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const admin = await as(s.users.superadmin);

    await app.actions.admin.addMeToGroup(admin.request, other.id);

    expect(await memberships(s.users.superadmin.id, other.id)).toBe(1);
    expect(await memberships(s.users.superadmin.id, s.group.id)).toBe(0);
  });

  test('a user who is not a superadmin cannot add themselves', { tag: ['@ADM-GRP-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const user = await as(s.users.nonMember);
    const visitor = await as('anon');

    const res = await app.actions.admin.addMeToGroup(user.request, s.group.id);
    const anon = await app.actions.admin.addMeToGroup(visitor.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(anon.location).toBe('/');
    expect(await memberships(s.users.nonMember.id, s.group.id)).toBe(0);
  });
});

test.describe('delete a group', () => {
  test('a superadmin deletes a group with its places, members, catalogs and distribution days, and keeps the users', { tag: ['@ADM-GRP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    await make.place({ group: other });
    await make.userGroup({ user: s.users.member, group: other });
    const admin = await as(s.users.superadmin);
    const users = await count('User');
    const vendors = await count('Vendor');

    const res = await app.actions.admin.deleteGroup(admin.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/admin/group/');
    expect(res.flash).toEqual({ kind: 'ok', text: 'Groupe effacé' });
    expect(await count('Group', 'id = ?', [s.group.id])).toBe(0);
    expect(await count('UserGroup', 'groupId = ?', [s.group.id])).toBe(0);
    expect(await count('Place', 'groupId = ?', [s.group.id])).toBe(0);
    expect(await count('Catalog', 'groupId = ?', [s.group.id])).toBe(0);
    expect(await count('MultiDistrib', 'groupId = ?', [s.group.id])).toBe(0);
    // what belongs to the people, and the other groups, stays
    expect(await count('User')).toBe(users);
    expect(await count('Vendor')).toBe(vendors);
    expect(await count('Group', 'id = ?', [other.id])).toBe(1);
    expect(await count('UserGroup', 'groupId = ?', [other.id])).toBe(1);
  });

  test('the group no longer appears in the list', { tag: ['@ADM-GRP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const admin = await as(s.users.superadmin);

    await app.actions.admin.deleteGroup(admin.request, other.id);
    const list = await app.views.admin.groups(admin.request);

    expect(list.groups.map((g) => g.id)).toEqual([s.group.id]);
  });

  test('without the security token nothing is deleted', { tag: ['@ADM-GRP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.deleteGroup(admin.request, s.group.id, { token: false });

    expect(res.flash?.text).not.toBe('Groupe effacé');
    expect(await count('Group', 'id = ?', [s.group.id])).toBe(1);
    expect(await count('UserGroup', 'groupId = ?', [s.group.id])).toBe(6);
  });

  test('the token of another session does not delete', { tag: ['@ADM-GRP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.user({ superadmin: true, email: 'other.admin@camap.test' });
    const admin = await as(s.users.superadmin);
    const otherAdmin = await as(other);
    // a token printed in one session (here the other superadmin's) is no good in another
    const page = await otherAdmin.request.get(`/admin/group/view/${s.group.id}`);
    const token = /token=([0-9a-f]+)/.exec(await page.text())?.[1];
    expect(token).toBeTruthy();

    const res = await admin.request.get(`/admin/group/deleteGroup/${s.group.id}?token=${token}`, { maxRedirects: 0 });

    expect(res.status()).not.toBe(302);
    expect(await count('Group', 'id = ?', [s.group.id])).toBe(1);
  });

  test('a user who is not a superadmin cannot delete a group, even the group admin of it', { tag: ['@ADM-GRP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const groupAdmin = await as(s.users.groupAdmin);

    const res = await app.actions.admin.deleteGroup(groupAdmin.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(await count('Group', 'id = ?', [s.group.id])).toBe(1);
  });
});

test.describe('maintenance scripts', () => {
  const dayParams = { from: '2020-01-01', to: '2030-01-01' };

  test('the basket total script cannot be run from a web page, even by a superadmin', { tag: ['@ADM-GRP-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const md = s.multiDistribs[0];
    const bk = await make.basket({ user: s.users.member, multiDistrib: md, total: 999 });
    await make.userOrder({ user: s.users.member, product: s.products.const[0], distribution: s.distributions[0].const, basket: bk, quantity: 1 });
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.runScript(admin.request, 'recomputeBasketTotal', dayParams);

    expect(res.status).toBe(500);
    expect(res.body).toContain('CLI only');
    // the total is still the wrong one the test wrote: nothing was recomputed
    expect((await queryOne<{ total: number }>('SELECT total FROM Basket WHERE id = ?', [bk.id]))!.total).toBe(999);
  });

  test('a visitor cannot run it either', { tag: ['@ADM-GRP-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const bk = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0], total: 999 });
    const visitor = await as('anon');

    const res = await app.actions.admin.runScript(visitor.request, 'recomputeBasketTotal', dayParams);

    expect(res.status).toBe(500);
    expect((await queryOne<{ total: number }>('SELECT total FROM Basket WHERE id = ?', [bk.id]))!.total).toBe(999);
  });

  test('the clean-up script cannot be run from a web page, even by a superadmin, and deletes nothing', { tag: ['@ADM-GRP-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const lonely = await make.user({ email: 'lonely@camap.test' });
    const bareVendor = await make.vendor({ name: 'Producteur sans catalogue', email: 'bare@camap.test' });
    const admin = await as(s.users.superadmin);
    const before = {
      groups: await count('Group'),
      users: await count('User'),
      vendors: await count('Vendor'),
    };

    const res = await app.actions.admin.runScript(admin.request, 'cleanNonAmapData', { groupMinId: '0', userMinId: '0', vendorMinId: '0' });

    expect(res.status).toBe(500);
    expect(res.body).toContain('CLI only');
    expect({ groups: await count('Group'), users: await count('User'), vendors: await count('Vendor') }).toEqual(before);
    expect(await count('User', 'id = ?', [lonely.id])).toBe(1);
    expect(await count('Vendor', 'id = ?', [bareVendor.id])).toBe(1);
  });

  test('a visitor cannot run the clean-up script either', { tag: ['@ADM-GRP-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.user({ email: 'lonely@camap.test' });
    const visitor = await as('anon');
    const users = await count('User');

    const res = await app.actions.admin.runScript(visitor.request, 'cleanNonAmapData', { groupMinId: '0', userMinId: '0', vendorMinId: '0' });

    expect(res.status).toBe(500);
    expect(await count('User')).toBe(users);
    expect(await query('SELECT id FROM `Group` WHERE id = ?', [s.group.id])).toHaveLength(1);
  });
});
