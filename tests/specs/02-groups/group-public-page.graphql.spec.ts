/**
 * Public information of a group and "my groups" (specs/02-groups/group-public-page.md;
 * camap-ts group-previews.resolver.ts, reached through the hx origin).
 */
import { test, expect } from '../../src/fixtures.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';

const PREVIEW = 'query($id: Int!) { groupPreview(id: $id) { id name currencyCode extUrl disabled hasPhoneRequired hasAddressRequired } }';
type Preview = { groupPreview: { id: number; name: string; currencyCode: string; extUrl: string | null; disabled: string | null; hasPhoneRequired: boolean; hasAddressRequired: boolean } };
const MY_GROUPS = '{ myGroups { id name } }';

test.describe('public information of a group', () => {
  test('a visitor reads the public information of a group without logging in', { tag: ['@GRP-PUB-003'] }, async ({ app, anon }) => {
    const g = await make.group({ name: 'AMAP du Marché', regOption: 'Open' });

    const res = await app.graphql<Preview>(anon.request, PREVIEW, { id: g.id });

    expect(res.errors).toBeNull();
    expect(res.data!.groupPreview).toMatchObject({ id: g.id, name: 'AMAP du Marché', currencyCode: 'EUR', disabled: null });
  });

  test('an unknown group gives a "not found" answer', { tag: ['@GRP-PUB-003'] }, async ({ app, anon }) => {
    const res = await app.graphql<Preview>(anon.request, PREVIEW, { id: 999999 });

    expect(res.data).toBeNull();
    expect(res.errors).not.toBeNull();
    expect(res.errors![0].message).toMatch(/not found/i);
  });
});

test.describe('what a group requires before registering', () => {
  const cases: [string, number, boolean, boolean][] = [
    ['nothing', 0, false, false],
    ['a phone number', flags(GroupFlag, 'PhoneRequired'), true, false],
    ['an address', flags(GroupFlag, 'AddressRequired'), false, true],
    ['a phone number and an address', flags(GroupFlag, 'PhoneRequired', 'AddressRequired'), true, true],
  ];
  for (const [label, groupFlags, phone, address] of cases) {
    test(`a visitor sees that a group requires ${label}`, { tag: ['@GRP-PUB-007'] }, async ({ app, anon }) => {
      const g = await make.group({ flags: groupFlags });

      const res = await app.graphql<Preview>(anon.request, PREVIEW, { id: g.id });

      expect(res.errors).toBeNull();
      expect(res.data!.groupPreview).toMatchObject({ hasPhoneRequired: phone, hasAddressRequired: address });
    });
  }
});

test.describe('the groups of the logged-in user', () => {
  test('a logged-in user lists the groups they belong to, and only those', { tag: ['@GRP-PUB-006'] }, async ({ app, as }) => {
    const a = await make.group({ name: 'Groupe A' });
    const b = await make.group({ name: 'Groupe B' });
    await make.group({ name: 'Groupe C' });
    const user = await make.user();
    const other = await make.user();
    await make.userGroup({ user, group: a });
    await make.userGroup({ user, group: b });
    await make.userGroup({ user: other, group: b });
    const s = await as(user);

    const res = await app.graphql<{ myGroups: { id: number; name: string }[] }>(s.request, MY_GROUPS);

    expect(res.errors).toBeNull();
    expect([...res.data!.myGroups].sort((x, y) => x.id - y.id)).toEqual([
      { id: a.id, name: 'Groupe A' },
      { id: b.id, name: 'Groupe B' },
    ]);
  });

  test('a user who belongs to no group gets an empty list', { tag: ['@GRP-PUB-006'] }, async ({ app, as }) => {
    await make.group({ name: 'Groupe A' });
    const s = await as(await make.user());

    const res = await app.graphql<{ myGroups: unknown[] }>(s.request, MY_GROUPS);

    expect(res.errors).toBeNull();
    expect(res.data!.myGroups).toEqual([]);
  });

  test('a visitor cannot list their groups', { tag: ['@GRP-PUB-006'] }, async ({ app, anon }) => {
    await make.group({ name: 'Groupe A' });

    const res = await app.graphql(anon.request, MY_GROUPS);

    expect(res.data).toBeNull();
    expect(res.errors).not.toBeNull();
  });
});

test.describe('the groups map', () => {
  test('a visitor sees the groups on the map, with the position of their place', { tag: ['@GRP-PUB-002'] }, async ({ app, anon }) => {
    // zone far from the other specs' coordinates (see places.api.spec.ts)
    const g = await make.group({ name: 'AMAP de la carte' });
    const place = await make.place({ group: g, name: 'Place de la carte', lat: 30, lng: 130 });

    const res = await app.api.places.onMap(anon.request, { minLat: 29, maxLat: 31, minLng: 129, maxLng: 131 });

    expect(res.errors).toBeNull();
    expect(res.data!.getGroupsOnMap).toEqual([
      { id: g.id, name: 'AMAP de la carte', placeId: place.id, place: { id: place.id, name: 'Place de la carte', lat: 30, lng: 130 } },
    ]);
  });
});
