/**
 * Impersonation and invitation links (specs/01-accounts/impersonation.md, invitations.md;
 * camap-hx controller/Member.hx doLoginas, controller/Main.hx doInvite, camap-ts auth.resolver.ts loginAs).
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const LOGIN_AS = `mutation($userId: Int!, $groupId: Int) { loginAs(userId: $userId, groupId: $groupId) { id } }`;
const ME = `query { me { id } }`;

test.describe('logging in as another user (hx member sheet)', () => {
  test('a superadmin logs in as any member', { tag: ['@ACC-IMP-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await app.actions.group.select(admin.request, s.group.id);

    const res = await app.actions.members.loginAs(admin.request, s.users.member.id);

    expect(res.sessionUserId).toBe(s.users.member.id);
  });

  test('a group admin logs in as a member who belongs to at most one group, not as a superadmin', { tag: ['@ACC-IMP-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member2, group: other }); // member2 now belongs to two groups
    const ga = await as(s.users.groupAdmin);
    await app.actions.group.select(ga.request, s.group.id);

    const twoGroups = await app.actions.members.loginAs(ga.request, s.users.member2.id);
    expect(twoGroups.sessionUserId).toBe(s.users.groupAdmin.id); // refused: still logged in as the admin

    const ok = await app.actions.members.loginAs(ga.request, s.users.member.id);
    expect(ok.sessionUserId).toBe(s.users.member.id);
  });

  test('a plain member cannot log in as someone else', { tag: ['@ACC-IMP-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    const res = await app.actions.members.loginAs(m.request, s.users.member2.id);

    expect(res.sessionUserId).toBe(s.users.member.id);
  });
});

test.describe('logging in as another user (GraphQL loginAs)', () => {
  test('a superadmin gets the login cookies of the target', { tag: ['@ACC-IMP-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.graphql(admin.request, LOGIN_AS, { userId: s.users.member.id });

    expect(res.data.loginAs.id).toBe(s.users.member.id);
    expect((await app.graphql(admin.request, ME)).data.me.id).toBe(s.users.member.id);
  });

  test('a plain member can log in as a user of a single group by naming the group (UND-010, characterised)', { tag: ['@ACC-IMP-004', '@ACC-IMP-002'] }, async ({ app, as }) => {
    // The resolver tests `!this.userGroupsService.isGroupAdmin(...)`, a Promise that is always truthy:
    // the group-admin check never refuses anyone.
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, LOGIN_AS, { userId: s.users.member2.id, groupId: s.group.id });

    expect(res.errors).toBeNull();
    expect((await app.graphql(m.request, ME)).data.me.id).toBe(s.users.member2.id);
  });

  test('nobody but a superadmin can log in as a superadmin', { tag: ['@ACC-IMP-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const ga = await as(s.users.groupAdmin);

    const res = await app.graphql(ga.request, LOGIN_AS, { userId: s.users.superadmin.id, groupId: s.group.id });

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

test.describe('invitation links', () => {
  test('a link with a wrong or altered key is refused', { tag: ['@ACC-INV-003'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const wrong = await app.actions.invitations.open(anon.request, { hash: 'deadbeef', email: 'invite@camap.test', groupId: s.group.id });
    const altered = await app.actions.invitations.open(anon.request, { hash: app.actions.invitations.hashFor('invite@camap.test'), email: 'autre@camap.test', groupId: s.group.id });

    for (const res of [wrong, altered]) {
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
    }
    expect(await query('SELECT userId FROM UserGroup WHERE userId = ?', [s.users.nonMember.id])).toEqual([]);
  });

  test('a valid link opens the registration for the invited email', { tag: ['@ACC-INV-002'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.actions.invitations.open(anon.request, { hash: app.actions.invitations.hashFor('invite@camap.test'), email: 'invite@camap.test', groupId: s.group.id });

    expect(res.status).toBe(200);
    expect(res.body).toContain('invite@camap.test');
  });

  test('an existing user opening a link addressed to them joins the group (UND-018)', { tag: ['@ACC-INV-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const outsider = await as(s.users.nonMember);

    const res = await app.actions.invitations.open(outsider.request, {
      hash: app.actions.invitations.hashFor(s.users.nonMember.email),
      email: s.users.nonMember.email,
      groupId: s.group.id,
      userId: s.users.nonMember.id,
    });

    expect(res.status).toBe(302);
    expect(await query('SELECT userId FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.nonMember.id, s.group.id])).toHaveLength(1);
  });

  test('the user id in the link is not checked against the invited email (UND-018, characterised)', { tag: ['@ACC-INV-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    await app.actions.invitations.open(anon.request, {
      hash: app.actions.invitations.hashFor('invite@camap.test'),
      email: 'invite@camap.test',
      groupId: s.group.id,
      userId: s.users.nonMember.id, // someone else
    });

    expect(await query('SELECT userId FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.nonMember.id, s.group.id])).toHaveLength(1);
  });
});
