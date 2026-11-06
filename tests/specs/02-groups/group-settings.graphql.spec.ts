/**
 * The group over GraphQL (specs/02-groups/group-settings.md; camap-ts groups.resolver.ts, reached
 * through the hx origin): reading the data of the group, setting its image.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import { makePng, pngSize } from '../../src/png.js';

const PNG_B64 = (w: number, h: number) => makePng(w, h).toString('base64');
type FileRow = { id: number; name: string; data: Buffer };
const fileRow = (id: number) => queryOne<FileRow>('SELECT id, name, data FROM File WHERE id = ?', [id]);
const imageIdOf = async (groupId: number) => (await queryOne<{ imageId: number | null }>('SELECT imageId FROM `Group` WHERE id = ?', [groupId]))!.imageId;

test.describe('reading the data of a group', () => {
  test('a group admin reads the data of their group', { tag: ['@GRP-SET-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario({
      group: { extUrl: 'https://amap.example.org', hasMembership: true, membershipFee: 25, flags: flags(GroupFlag, 'PhoneRequired') },
    });
    const a = await as(s.users.groupAdmin);

    const res = await app.api.groups.get(a.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.group).toEqual({
      id: s.group.id,
      name: 'AMAP des Tests',
      flags: flags(GroupFlag, 'PhoneRequired'),
      hasMembership: true,
      membershipFee: 25,
      currencyCode: 'EUR',
      extUrl: 'https://amap.example.org',
      txtDistrib: null,
      iban: null,
      image: null,
    });
  });

  test('a site admin reads the data of any group', { tag: ['@GRP-SET-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const sup = await as(s.users.superadmin);

    const res = await app.api.groups.get(sup.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.group.name).toBe('AMAP des Tests');
  });

  test('the data follows what the settings form saved', { tag: ['@GRP-SET-008', '@GRP-SET-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);
    await app.actions.groupAdmin.saveSettings(a.request, { name: 'AMAP renommée', extUrl: 'www.exemple.fr', txtDistrib: 'Sacs', phoneRequired: true });

    const res = await app.api.groups.get(a.request, s.group.id);

    expect(res.data!.group).toMatchObject({ name: 'AMAP renommée', extUrl: 'http://www.exemple.fr', txtDistrib: 'Sacs', flags: flags(GroupFlag, 'PhoneRequired') });
  });

  test('a plain member cannot read the data of the group', { tag: ['@GRP-SET-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.api.groups.get(m.request, s.group.id);

    expect(res.data).toBeNull();
    expect(res.errors).not.toBeNull();
    expect(res.errors![0].message).toMatch(/not admin of group/);
  });

  test("the admin of another group cannot read the group's data", { tag: ['@GRP-SET-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const otherAdmin = await make.user();
    await make.userGroup({ user: otherAdmin, group: other, rights: [Right.GroupAdmin()] });
    const o = await as(otherAdmin);

    const res = await app.api.groups.get(o.request, s.group.id);

    expect(res.data).toBeNull();
    expect(res.errors).not.toBeNull();
  });

  test('a visitor cannot read the data of a group', { tag: ['@GRP-SET-008'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.groups.get(anon.request, s.group.id);

    expect(res.data).toBeNull();
    expect(res.errors).not.toBeNull();
  });

  test('an unknown group gives a "not found" answer', { tag: ['@GRP-SET-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);

    const res = await app.api.groups.get(a.request, 999999);

    expect(res.data).toBeNull();
    expect(res.errors![0].message).toMatch(/not found/i);
  });
});

test.describe('the image of a group', () => {
  test('a group admin sets the image: it is stored and linked to the group', { tag: ['@GRP-SET-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);

    const res = await app.api.groups.setImage(a.request, { groupId: s.group.id, base64: PNG_B64(60, 40), mimeType: 'image/png', fileName: 'logo.png', maxWidth: 400 });

    expect(res.errors).toBeNull();
    expect(res.data!.setGroupImage.id).toBe(s.group.id);
    expect(res.data!.setGroupImage.image).toBeTruthy();
    const imageId = await imageIdOf(s.group.id);
    expect(imageId).not.toBeNull();
    const file = await fileRow(imageId!);
    expect(file!.name).toBe('logo.png');
    expect(pngSize(file!.data)).toEqual({ width: 60, height: 40 }); // smaller than maxWidth: not enlarged
    // the image is then part of the group's data
    const group = await app.api.groups.get(a.request, s.group.id);
    expect(group.data!.group.image).toBe(res.data!.setGroupImage.image);
  });

  test('the image is scaled down to the maximum width', { tag: ['@GRP-SET-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    const original = makePng(400, 300);

    await app.api.groups.setImage(a.request, { groupId: s.group.id, base64: original.toString('base64'), mimeType: 'image/png', fileName: 'grand.png', maxWidth: 100 });

    const file = await fileRow((await imageIdOf(s.group.id))!);
    expect(pngSize(file!.data)).toEqual({ width: 100, height: 75 });
  });

  test('a new image replaces the previous one, which is deleted', { tag: ['@GRP-SET-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.api.groups.setImage(a.request, { groupId: s.group.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'ancien.png', maxWidth: 400 });
    const first = (await imageIdOf(s.group.id))!;

    await app.api.groups.setImage(a.request, { groupId: s.group.id, base64: PNG_B64(30, 30), mimeType: 'image/png', fileName: 'nouveau.png', maxWidth: 400 });

    const second = (await imageIdOf(s.group.id))!;
    expect(second).not.toBe(first);
    expect(await fileRow(first)).toBeUndefined();
    expect((await fileRow(second))!.name).toBe('nouveau.png');
    expect(await query('SELECT id FROM File')).toHaveLength(1);
  });

  test('a plain member cannot set the image', { tag: ['@GRP-SET-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.api.groups.setImage(m.request, { groupId: s.group.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'piraté.png', maxWidth: 400 });

    expect(res.errors).not.toBeNull();
    expect(await imageIdOf(s.group.id)).toBeNull();
    expect(await query('SELECT id FROM File')).toHaveLength(0);
  });

  test("the admin of another group cannot set the group's image", { tag: ['@GRP-SET-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const otherAdmin = await make.user();
    await make.userGroup({ user: otherAdmin, group: other, rights: [Right.GroupAdmin()] });
    const o = await as(otherAdmin);

    const res = await app.api.groups.setImage(o.request, { groupId: s.group.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'piraté.png', maxWidth: 400 });

    expect(res.errors).not.toBeNull();
    expect(await imageIdOf(s.group.id)).toBeNull();
  });

  test('a visitor cannot set the image', { tag: ['@GRP-SET-007'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.groups.setImage(anon.request, { groupId: s.group.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'piraté.png', maxWidth: 400 });

    expect(res.data).toBeNull();
    expect(res.errors).not.toBeNull();
    expect(await imageIdOf(s.group.id)).toBeNull();
  });

  test('an unknown group gives a "not found" answer', { tag: ['@GRP-SET-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);

    const res = await app.api.groups.setImage(a.request, { groupId: 999999, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'logo.png', maxWidth: 400 });

    expect(res.errors![0].message).toMatch(/not found/i);
    expect(await query('SELECT id FROM File')).toHaveLength(0);
  });
});
