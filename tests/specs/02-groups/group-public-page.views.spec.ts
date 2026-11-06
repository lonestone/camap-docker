/**
 * Public pages around a group: the map page, the CSA landing page, and the group remembered
 * for the join step (specs/02-groups/group-public-page.md; controller/Group.hx doDefault,
 * doMap, doCsa; Main.hx doHome; User.hx doJoingroup).
 *
 * The map itself is a neo module drawn by the browser: the page is checked for status only,
 * the groups it shows come from the GraphQL map query (group-public-page.graphql.spec.ts).
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const memberships = async (userId: number, groupId: number) =>
  (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;

test.describe('map and landing pages', () => {
  test('a visitor opens the map of groups', { tag: ['@GRP-PUB-002'] }, async ({ app, anon }) => {
    const page = await app.views.groups.map(anon.request);

    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
  });

  test('a visitor opens the landing page about CSA', { tag: ['@GRP-PUB-002'] }, async ({ app, anon }) => {
    const page = await app.views.groups.csa(anon.request, 'AMAP des Tilleuls');

    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
    expect(page.text).toContain('Créer un groupe en mode AMAP');
  });
});

test.describe('the open group is remembered for the join step', () => {
  test('a visitor who opened the page of an open group can then browse its shop', { tag: ['@GRP-PUB-005'] }, async ({ app, anon }) => {
    // UND-026 (Undecided): characterised as hx does it, the open group is stored in the session
    const g = await make.group({ name: 'AMAP ouverte', regOption: 'Open' });
    await make.place({ group: g });

    const before = await app.views.groups.home(anon.request);
    await app.views.groups.page(anon.request, g.id);
    const after = await app.views.groups.home(anon.request);

    expect(before.status).toBe(302); // no group yet: sent to the login
    expect(after.status).toBe(200);
    expect(after.location).toBeNull();
  });

  test('the page of a group with a waiting list is not remembered for a visitor', { tag: ['@GRP-PUB-005'] }, async ({ app, anon }) => {
    const g = await make.group({ name: 'AMAP en attente', regOption: 'WaitingList' });
    await make.place({ group: g });

    const page = await app.views.groups.page(anon.request, g.id);
    const home = await app.views.groups.home(anon.request);

    expect(page.status).toBe(200);
    expect(home.status).toBe(302);
    expect(home.location).toBe(app.urls.login());
  });

  test('a logged-in user who opened the page of an open group joins it', { tag: ['@GRP-PUB-005'] }, async ({ app, as }) => {
    const contact = await make.user();
    const g = await make.group({ name: 'AMAP ouverte', regOption: 'Open', contact });
    await make.place({ group: g });
    const user = await make.user();
    const s = await as(user);
    expect(await memberships(user.id, g.id)).toBe(0);

    await app.views.groups.page(s.request, g.id);
    const res = await app.actions.group.join(s.request);

    expect(res.status).toBe(302);
    expect(await memberships(user.id, g.id)).toBe(1);
  });
});
