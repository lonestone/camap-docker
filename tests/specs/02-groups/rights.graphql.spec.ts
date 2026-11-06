/**
 * What the membership and group admin rights open over GraphQL and the forms they go with
 * (specs/02-groups/rights.md GRP-RIG-012, GRP-RIG-013; camap-ts groups.resolver.ts,
 * group-previews-members.resolver.ts, memberships.resolver.ts, reached through the hx origin).
 * The member and waiting-list features themselves are in members.*, membership.* and waiting-list.*.
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne } from '../../src/db/client.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import { makePng } from '../../src/png.js';

const TODAY = make.parisDate(new Date());
const imageIdOf = async (groupId: number) => (await queryOne<{ imageId: number | null }>('SELECT imageId FROM `Group` WHERE id = ?', [groupId]))!.imageId;
const nameOf = async (groupId: number) => (await queryOne<{ name: string }>('SELECT name FROM `Group` WHERE id = ?', [groupId]))!.name;
const membershipCount = async (groupId: number) => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Membership WHERE groupId = ?', [groupId]))!.n;

async function groupAdminOnly(s: make.AmapScenario) {
  const u = await make.user();
  await make.userGroup({ user: u, group: s.group, rights: [Right.GroupAdmin()] });
  return u;
}

test.describe('a membership manager manages members and memberships', () => {
  test('they open the members page and a member sheet, read the group preview and the memberships of a member', { tag: ['@GRP-RIG-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 20 } });
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);

    expect((await app.views.member.list(m.request)).status).toBe(200);
    expect((await app.views.member.sheet(m.request, s.users.member.id)).status).toBe(200);
    const preview = await app.api.members.preview(m.request, s.group.id);
    expect(preview.errors).toBeNull();
    expect(preview.data!.groupPreviewMembers.id).toBe(s.group.id);
    const memberships = await app.api.memberships.of(m.request, s.group.id, s.users.member.id);
    expect(memberships.errors).toBeNull();
    expect(memberships.data!.getUserMemberships).toEqual([]);
  });

  test('they record a membership', { tag: ['@GRP-RIG-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 20, membershipRenewalDate: `${new Date().getFullYear()}-01-01` } });
    const m = await as(s.users.membershipManager);

    const res = await app.api.memberships.create(m.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect(res.errors).toBeNull();
    expect(await membershipCount(s.group.id)).toBe(1);
  });

  test('a group admin without the membership right gets none of this', { tag: ['@GRP-RIG-012', '@GRP-RIG-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 20, membershipRenewalDate: `${new Date().getFullYear()}-01-01` } });
    const a = await as(await groupAdminOnly(s));
    await app.actions.group.select(a.request, s.group.id);

    const list = await app.views.member.list(a.request);
    const preview = await app.api.members.preview(a.request, s.group.id);
    const created = await app.api.memberships.create(a.request, s.users.member.id, { groupId: s.group.id, date: TODAY });

    expect([list.status, list.location]).toEqual([302, '/']);
    expect(preview.data).toBeNull();
    expect(preview.errors?.length).toBeGreaterThan(0);
    expect(created.data).toBeNull();
    expect(created.errors?.length).toBeGreaterThan(0);
    expect(await membershipCount(s.group.id)).toBe(0);
  });

  for (const [label, who] of [
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
    ['a plain member', 'member'],
  ] as const) {
    test(`${label} cannot record a membership`, { tag: ['@GRP-RIG-012', '@GRP-RIG-002'] }, async ({ app, as }) => {
      const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 20, membershipRenewalDate: `${new Date().getFullYear()}-01-01` } });
      const u = await as(s.users[who]);

      const res = await app.api.memberships.create(u.request, s.users.member2.id, { groupId: s.group.id, date: TODAY });

      expect(res.data).toBeNull();
      expect(res.errors?.length).toBeGreaterThan(0);
      expect(await membershipCount(s.group.id)).toBe(0);
    });
  }
});

test.describe('a group admin reads and edits the group', () => {
  test('with only the group admin right: they read the data, set the image and save the settings', { tag: ['@GRP-RIG-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(await groupAdminOnly(s));
    await app.actions.group.select(a.request, s.group.id);

    const data = await app.api.groups.get(a.request, s.group.id);
    const image = await app.api.groups.setImage(a.request, { groupId: s.group.id, base64: makePng(30, 20).toString('base64'), mimeType: 'image/png', fileName: 'logo.png', maxWidth: 400 });
    const saved = await app.actions.groupAdmin.saveSettings(a.request, { name: 'Nouveau nom' });

    expect(data.errors).toBeNull();
    expect(data.data!.group.name).toBe('AMAP des Tests');
    expect(image.errors).toBeNull();
    expect(await imageIdOf(s.group.id)).not.toBeNull();
    expect(saved.location).toBe('/amapadmin');
    expect(await nameOf(s.group.id)).toBe('Nouveau nom');
  });

  for (const [label, who] of [
    ['a membership manager', 'membershipManager'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
  ] as const) {
    test(`${label} can neither read the data of the group nor set its image`, { tag: ['@GRP-RIG-013', '@GRP-RIG-002'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);

      const data = await app.api.groups.get(u.request, s.group.id);
      const image = await app.api.groups.setImage(u.request, { groupId: s.group.id, base64: makePng(30, 20).toString('base64'), mimeType: 'image/png', fileName: 'logo.png', maxWidth: 400 });

      expect(data.data).toBeNull();
      expect(data.errors?.length).toBeGreaterThan(0);
      expect(image.data).toBeNull();
      expect(image.errors?.length).toBeGreaterThan(0);
      expect(await imageIdOf(s.group.id)).toBeNull();
    });
  }
});
