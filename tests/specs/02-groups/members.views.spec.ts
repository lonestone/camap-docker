/**
 * The members page and the member sheet (specs/02-groups/members.md; camap-hx controller/Member.hx
 * doDefault, doView, views member/view.mtt). The member list itself is drawn in the browser from GraphQL
 * (members.graphql.spec.ts).
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';

test.describe('the members page', () => {
  test('a membership manager opens the members page of the group', { tag: ['@GRP-MEM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const page = await app.views.member.list(m.request);

    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
  });

  test('a superadmin opens it too, without belonging to the group', { tag: ['@GRP-MEM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await app.actions.group.select(admin.request, s.group.id);

    const page = await app.views.member.list(admin.request);

    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
  });

  test('a group admin who holds the membership right opens it', { tag: ['@GRP-MEM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    expect((await app.views.member.list(a.request)).status).toBe(200);
  });

  test('a group admin without the membership right cannot', { tag: ['@GRP-MEM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await make.user();
    await make.userGroup({ user: admin, group: s.group, rights: [Right.GroupAdmin()] });
    const a = await as(admin);
    await app.actions.group.select(a.request, s.group.id);

    const page = await app.views.member.list(a.request);

    expect(page.status).toBe(302);
    expect(page.location).toBe('/');
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} is sent back to the home page`, { tag: ['@GRP-MEM-001'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);
      await app.actions.group.select(u.request, s.group.id);

      const page = await app.views.member.list(u.request);

      expect(page.status).toBe(302);
      expect(page.location).toBe('/');
    });
  }
});

test.describe('the member sheet', () => {
  test('a membership manager opens the sheet of a member: contact details and notification settings', { tag: ['@GRP-MEM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const sheet = await app.views.member.sheet(m.request, s.users.member.id);

    expect(sheet.status).toBe(200);
    expect(sheet.text).toContain('Martine');
    expect(sheet.text).toContain('member@camap.test');
    // the factory gives the 24h notification only (hx default)
    expect(sheet.notifications).toHaveLength(3);
    expect(sheet.notifications.filter((n) => n.active)).toHaveLength(1);
    expect(sheet.notifications.find((n) => n.active)!.name).toMatch(/24h/);
  });

  test('the sheet shows the active subscriptions of the member', { tag: ['@GRP-MEM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: addDaysWall(now, -10), endDate: addDaysWall(now, 60) });
    await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: addDaysWall(now, -10), endDate: addDaysWall(now, 60) });
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    expect((await app.views.member.sheet(m.request, s.users.member.id)).subscriptionCount).toBe(2);
    expect((await app.views.member.sheet(m.request, s.users.member2.id)).subscriptionCount).toBe(0);
  });

  test('the sheet offers the payments page, the waiting list, the removal and the membership dialog', { tag: ['@GRP-MEM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const sheet = await app.views.member.sheet(m.request, s.users.member.id);

    expect(sheet.offers).toMatchObject({ payments: true, moveToWaitingList: true, remove: true, membershipDialog: true });
  });

  test('the membership dialog is offered only when the group has memberships', { tag: ['@GRP-MEM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: false } });
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    expect((await app.views.member.sheet(m.request, s.users.member.id)).offers.membershipDialog).toBe(false);
  });

  test('a group admin is offered to log in as the member; a membership manager is not', { tag: ['@GRP-MEM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    expect((await app.views.member.sheet(a.request, s.users.member.id)).offers.loginAs).toBe(true);
    expect((await app.views.member.sheet(m.request, s.users.member.id)).offers.loginAs).toBe(false);
  });

  test('a person who is not in the group has no sheet', { tag: ['@GRP-MEM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const sheet = await app.views.member.sheet(m.request, s.users.nonMember.id);

    expect(sheet.status).toBe(302);
    expect(sheet.location).toBe('/member');
    expect(sheet.flash?.kind).toBe('error');
  });

  test('a plain member cannot open the sheet of another member', { tag: ['@GRP-MEM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const u = await as(s.users.member);
    await app.actions.group.select(u.request, s.group.id);

    const sheet = await app.views.member.sheet(u.request, s.users.member2.id);

    expect(sheet.status).toBe(302);
    expect(sheet.location).toBe('/');
  });
});

test.describe('members who never logged in', () => {
  test('the sheet says so when the member never logged in (UND-036)', { tag: ['@GRP-MEM-010'] }, async ({ app, as }) => {
    // The sheet reads the last-login date (User.ldate): empty = never logged in.
    const s = await make.amapScenario();
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const sheet = await app.views.member.sheet(m.request, s.users.member.id);

    expect(sheet.text).toMatch(/jamais connecté/);
  });

  test('the sheet shows the last login date of a member who did log in (UND-036)', { tag: ['@GRP-MEM-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const returning = await make.user({ firstName: 'Revenu', ldate: addDaysWall(clock.now(), -3) });
    await make.userGroup({ user: returning, group: s.group });
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    const sheet = await app.views.member.sheet(m.request, returning.id);

    expect(sheet.text).toContain('Dernière connexion');
    expect(sheet.text).not.toMatch(/jamais connecté/);
  });
});
