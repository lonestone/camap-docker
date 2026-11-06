/**
 * Reading a place and the groups map (specs/03-catalogs/places.md; hx controller/api/Places.hx,
 * camap-ts places.resolver.ts and group-previews.resolver.ts, places.service.ts).
 * Rows are placed with the factories: nothing here needs the Mapbox geocoding.
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test.describe('reading a place', () => {
  test('a member reads the name, address and position of a place', { tag: ['@CAT-PLC-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Halle', address1: '12 place du Marché', address2: 'Entrée B', zipCode: '35000', city: 'Rennes', lat: 48.11, lng: -1.68, main: false });
    const member = await as(s.users.member);

    const res = await app.api.places.get(member.request, p.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Halle', address1: '12 place du Marché', address2: 'Entrée B', zipCode: '35000', city: 'Rennes', lat: 48.11, lng: -1.68 });
  });

  test('a visitor can read a place through the API, without login', { tag: ['@CAT-PLC-009'] }, async ({ app, anon }) => {
    // ERRATUM / CODE-021: no login needed
    const s = await make.amapScenario();

    const res = await app.api.places.get(anon.request, s.place.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: s.place.name, city: 'Nantes', zipCode: '44000', address1: '1 rue de la Ferme' });
  });

  test('the place API only answers to GET', { tag: ['@CAT-PLC-009'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.places.write(anon.request, s.place.id);

    expect(res.status).toBe(405);
  });

  test('a visitor can read a place through GraphQL, without login', { tag: ['@CAT-PLC-009', '@CAT-PLC-010'] }, async ({ app, anon }) => {
    // UND-043: today `place` has no guard; the suggestion is to restrict it to members of the group
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Halle', address2: 'Entrée B', country: 'BE', lat: 50.85, lng: 4.35, main: false });

    const res = await app.api.places.byId(anon.request, p.id);

    expect(res.errors).toBeNull();
    expect(res.data?.place).toMatchObject({ id: p.id, name: 'Halle', city: 'Nantes', zipCode: '44000', address2: 'Entrée B', country: 'BE', lat: 50.85, lng: 4.35 });
  });

  test('a logged-in user reads the details of a place through GraphQL', { tag: ['@CAT-PLC-010'] }, async ({ app, as }) => {
    // UND-043: nonMember is in no group and can still read
    const s = await make.amapScenario();
    const user = await as(s.users.nonMember);

    const res = await app.api.places.byId(user.request, s.place.id);

    expect(res.errors).toBeNull();
    expect(res.data?.place).toMatchObject({ id: s.place.id, name: s.place.name, address1: '1 rue de la Ferme' });
  });
});

test.describe('the groups map', () => {
  // Coordinates far from anything else the scenarios use, so each test owns its area.
  const AT = { lat: 10, lng: 100 };

  const ids = (res: { data: { getGroupsOnMap: { placeId: number }[] } | null }) => (res.data?.getGroupsOnMap ?? []).map((g) => g.placeId).sort((a, b) => a - b);

  test('a visitor sees the groups whose place is in the zone', { tag: ['@CAT-PLC-007'] }, async ({ app, anon }) => {
    const inside = await make.group({ name: 'Groupe dans la zone' });
    const insidePlace = await make.place({ group: inside, name: 'Dans la zone', lat: AT.lat, lng: AT.lng });
    const outside = await make.group({ name: 'Groupe hors zone' });
    await make.place({ group: outside, name: 'Hors zone', lat: AT.lat + 5, lng: AT.lng });
    const unlocated = await make.group({ name: 'Groupe sans position' });
    await make.place({ group: unlocated, name: 'Sans position' });

    const res = await app.api.places.onMap(anon.request, { minLat: 9, maxLat: 11, minLng: 99, maxLng: 101 });

    expect(res.errors).toBeNull();
    expect(res.data?.getGroupsOnMap).toEqual([
      { id: inside.id, name: 'Groupe dans la zone', placeId: insidePlace.id, place: { id: insidePlace.id, name: 'Dans la zone', lat: AT.lat, lng: AT.lng } },
    ]);
  });

  test('a zone shows at most 200 places', { tag: ['@CAT-PLC-007'] }, async ({ app, anon }) => {
    const g = await make.group({ name: 'Groupe à 201 lieux' });
    for (let i = 0; i < 201; i++) await make.place({ group: g, name: `Lieu ${i}`, lat: AT.lat + i / 1000, lng: AT.lng, main: false });

    const res = await app.api.places.onMap(anon.request, { minLat: 9, maxLat: 11, minLng: 99, maxLng: 101 });

    expect(res.errors).toBeNull();
    expect(res.data?.getGroupsOnMap).toHaveLength(200);
  });

  test('a zone wider than 20 degrees of latitude or 38 of longitude shows nothing', { tag: ['@CAT-PLC-007'] }, async ({ app, anon }) => {
    const g = await make.group({ name: 'Groupe' });
    const p = await make.place({ group: g, name: 'Lieu', lat: AT.lat, lng: AT.lng });

    // the limits themselves are allowed
    expect(ids(await app.api.places.onMap(anon.request, { minLat: 0, maxLat: 20, minLng: 90, maxLng: 110 }))).toEqual([p.id]);
    expect(ids(await app.api.places.onMap(anon.request, { minLat: 0, maxLat: 20.5, minLng: 90, maxLng: 110 }))).toEqual([]);
    expect(ids(await app.api.places.onMap(anon.request, { minLat: 5, maxLat: 15, minLng: 70, maxLng: 108 }))).toEqual([p.id]);
    expect(ids(await app.api.places.onMap(anon.request, { minLat: 5, maxLat: 15, minLng: 70, maxLng: 108.5 }))).toEqual([]);
  });

  test('near a position, the closest places within 2 degrees are shown', { tag: ['@CAT-PLC-007'] }, async ({ app, anon }) => {
    const g = await make.group({ name: 'Groupe' });
    const near = await make.place({ group: g, name: 'Proche', lat: AT.lat + 0.5, lng: AT.lng, main: false });
    const edge = await make.place({ group: g, name: 'Limite', lat: AT.lat, lng: AT.lng + 1.9, main: false });
    await make.place({ group: g, name: 'Trop loin', lat: AT.lat + 2.5, lng: AT.lng, main: false });
    await make.place({ group: g, name: 'Sans position', main: false });

    const res = await app.api.places.onMap(anon.request, AT);

    expect(res.errors).toBeNull();
    expect(ids(res)).toEqual([near.id, edge.id].sort((a, b) => a - b));
  });

  test('near a position, at most the 10 closest places are shown', { tag: ['@CAT-PLC-007'] }, async ({ app, anon }) => {
    const g = await make.group({ name: 'Groupe' });
    const placed: number[] = [];
    for (let i = 1; i <= 12; i++) placed.push((await make.place({ group: g, name: `Lieu ${i}`, lat: AT.lat + i / 100, lng: AT.lng, main: false })).id);

    const res = await app.api.places.onMap(anon.request, AT);

    expect(ids(res)).toEqual(placed.slice(0, 10));
  });

  test('the map needs a zone or a position', { tag: ['@CAT-PLC-007'] }, async ({ app, anon }) => {
    const res = await app.api.places.onMap(anon.request, {});

    expect(res.data).toBeNull();
    expect(res.errors?.[0].message).toBe('Please provide parameters');
  });
});
