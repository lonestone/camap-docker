/**
 * The places of a group through the group admin's forms (specs/03-catalogs/places.md;
 * controller/Place.hx, db/Place.hx, service/PlaceService.hx).
 *
 * Test-stack limitation: hx geocodes an edited place through Mapbox and the test stack runs with the
 * token `test`, so a geocoding always fails there. A place is still saved (the failure only warns), so what
 * is observable is: when hx attempts the geocoding (the warning appears), and what is saved around it.
 * A successful geocoding (coordinates filled from the address) cannot be observed.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import type { ActionResult, CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users']) {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

type Stored = {
  id: number;
  name: string;
  address1: string | null;
  address2: string | null;
  zipCode: string;
  city: string;
  country: string | null;
  lat: number | null;
  lng: number | null;
  groupId: number;
};
const stored = (id: number) => queryOne<Stored>('SELECT * FROM Place WHERE id = ?', [id]);
const byName = (name: string) => queryOne<Stored>('SELECT * FROM Place WHERE name = ?', [name]);
const placeCount = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Place'))!.n;

/** hx tries to locate the place on the map; the test stack makes it fail with a warning. */
const triedToLocate = (res: ActionResult) => (res.alerts ?? []).some((a) => a.kind === 'error' && /localiser cette adresse/.test(a.text));
/** The result is "saved": the confirmation message is shown after the redirect to the list. */
const saved = (res: ActionResult) => res.location === '/place' && (res.alerts ?? []).some((a) => a.kind === 'ok');

test.describe('managing the places of the group', () => {
  test('the places page lists the places of the current group only', { tag: ['@CAT-PLC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const second = await make.place({ group: s.group, name: 'Marché', main: false });
    const otherGroup = await make.group({ name: 'Autre groupe' });
    const foreign = await make.place({ group: otherGroup, name: 'Lieu étranger' });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.list(a.request);

    expect(res.status).toBe(200);
    expect([...res.placeIds].sort()).toEqual([s.place.id, second.id].sort());
    expect(res.placeIds).not.toContain(foreign.id);
    expect(res.offersDelete).toBe(true);
  });

  test('a group admin creates a place in the current group', { tag: ['@CAT-PLC-001', '@CAT-PLC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await placeCount();

    const res = await app.actions.places.create(a.request, {
      name: 'Halle du marché',
      address1: '12 place du Marché',
      address2: 'Entrée B',
      zipCode: '35000',
      city: 'Rennes',
    });

    expect(saved(res)).toBe(true);
    expect(await placeCount()).toBe(before + 1);
    expect(await byName('Halle du marché')).toMatchObject({
      address1: '12 place du Marché',
      address2: 'Entrée B',
      zipCode: '35000',
      city: 'Rennes',
      groupId: s.group.id,
    });
  });

  test('a new place is not located on the map', { tag: ['@CAT-PLC-004'] }, async ({ app, as }) => {
    // UND-044: hx never geocodes on creation (Place.hx doInsert); the suggestion is to geocode there too
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.create(a.request, { name: 'Halle', address1: '12 place du Marché' });

    expect(saved(res)).toBe(true);
    expect(triedToLocate(res)).toBe(false);
    expect(await byName('Halle')).toMatchObject({ lat: null, lng: null });
  });

  test('coordinates typed in the creation form are kept', { tag: ['@CAT-PLC-002', '@CAT-PLC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    await app.actions.places.create(a.request, { name: 'Halle', lat: 47.2184, lng: -1.5536 });

    expect(await byName('Halle')).toMatchObject({ lat: 47.2184, lng: -1.5536 });
  });

  test('the edit form shows the saved values and saving updates the place', { tag: ['@CAT-PLC-001', '@CAT-PLC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Ancien nom', address1: '3 rue Haute', address2: 'Cour', zipCode: '29200', city: 'Brest', lat: 48.39, lng: -4.49, main: false });
    const a = await actor(app, as, s, 'groupAdmin');

    const form = await app.actions.places.form(a.request, p.id);
    expect(form.status).toBe(200);
    expect(form.values).toMatchObject({ name: 'Ancien nom', address1: '3 rue Haute', address2: 'Cour', zipCode: '29200', city: 'Brest', country: 'FR' });

    // the name does not take part in the address: no new location is needed
    const res = await app.actions.places.edit(a.request, p.id, { name: 'Nouveau nom' });

    expect(saved(res)).toBe(true);
    expect(await stored(p.id)).toMatchObject({ name: 'Nouveau nom', address1: '3 rue Haute', city: 'Brest', lat: 48.39, lng: -4.49, groupId: s.group.id });
  });

  test('a group admin deletes a place no distribution uses', { tag: ['@CAT-PLC-001', '@CAT-PLC-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'À supprimer', main: false });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.delete(a.request, p.id);

    expect(res.location).toBe('/place');
    expect(res.flash?.kind).toBe('ok');
    expect(await stored(p.id)).toBeUndefined();
    expect(await stored(s.place.id)).toBeDefined();
  });
});

test.describe('place fields', () => {
  test('name, zip code and city are required, the address lines are optional', { tag: ['@CAT-PLC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const form = await app.actions.places.form(a.request);
    expect(form.required).toEqual(expect.arrayContaining(['name', 'zipCode', 'city']));
    expect(form.required).not.toContain('address1');
    expect(form.required).not.toContain('address2');

    const before = await placeCount();
    for (const missing of [{ name: '' }, { zipCode: '' }, { city: '' }]) {
      const res = await app.actions.places.create(a.request, missing);
      // the form is shown again
      expect(res.status).toBe(200);
      expect(res.location).toBeNull();
    }
    expect(await placeCount()).toBe(before);

    const ok = await app.actions.places.create(a.request, { name: 'Sans adresse', address1: null, address2: null });
    expect(saved(ok)).toBe(true);
    expect(await byName('Sans adresse')).toMatchObject({ address1: null, address2: null });
  });

  test('the name holds at most 64 characters', { tag: ['@CAT-PLC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const limit = 'n'.repeat(64);

    const res = await app.actions.places.create(a.request, { name: limit });
    expect(saved(res)).toBe(true);
    expect((await byName(limit))?.name).toBe(limit);

    // hx lets the database cut a longer name (non-strict SQL mode): never more than 64 characters stored
    await app.actions.places.create(a.request, { name: 'p'.repeat(65) });
    const rows = await query<{ name: string }>("SELECT name FROM Place WHERE name LIKE 'ppp%'");
    for (const r of rows) expect(r.name.length).toBeLessThanOrEqual(64);
  });

  test('the country is France by default', { tag: ['@CAT-PLC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const form = await app.actions.places.form(a.request);
    expect(form.country).toBe('FR');

    await app.actions.places.create(a.request, { name: 'Par défaut' });
    expect((await byName('Par défaut'))?.country).toBe('FR');
  });

  test('latitude and longitude are limited to valid ranges', { tag: ['@CAT-PLC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    await app.actions.places.create(a.request, { name: 'Trop haut', lat: 120, lng: 200 });
    await app.actions.places.create(a.request, { name: 'Trop bas', lat: -120, lng: -200 });
    await app.actions.places.create(a.request, { name: 'Limites', lat: 90, lng: -180 });

    expect(await byName('Trop haut')).toMatchObject({ lat: 90, lng: 180 });
    expect(await byName('Trop bas')).toMatchObject({ lat: -90, lng: -180 });
    expect(await byName('Limites')).toMatchObject({ lat: 90, lng: -180 });
  });

  test('latitude and longitude are both empty when one of them is', { tag: ['@CAT-PLC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    await app.actions.places.create(a.request, { name: 'Seulement lat', lat: 40 });
    await app.actions.places.create(a.request, { name: 'Seulement lng', lng: 4 });
    expect(await byName('Seulement lat')).toMatchObject({ lat: null, lng: null });
    expect(await byName('Seulement lng')).toMatchObject({ lat: null, lng: null });

    // same rule when editing: clearing one coordinate clears both
    const p = await make.place({ group: s.group, name: 'Avec position', lat: 10, lng: 20, main: false });
    await app.actions.places.edit(a.request, p.id, { lng: null });
    expect(await stored(p.id)).toMatchObject({ lat: null, lng: null });
  });
});

test.describe('countries', () => {
  // UND-045: the form offers 8 countries, but creating refuses all but France and Belgium (Place.hx:75-77)
  test('the form offers 8 countries', { tag: ['@CAT-PLC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const form = await app.actions.places.form(a.request);

    expect(form.countries.filter((c) => c !== '')).toEqual(['FR', 'BE', 'ES', 'IT', 'DE', 'CH', 'CA', '-']);
  });

  test('a place is created in France or in Belgium', { tag: ['@CAT-PLC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    expect(saved(await app.actions.places.create(a.request, { name: 'En France', country: 'FR' }))).toBe(true);
    expect(saved(await app.actions.places.create(a.request, { name: 'En Belgique', country: 'BE' }))).toBe(true);

    expect((await byName('En France'))?.country).toBe('FR');
    expect((await byName('En Belgique'))?.country).toBe('BE');
  });

  test('creating a place in another country the form offers is refused', { tag: ['@CAT-PLC-003'] }, async ({ app, as }) => {
    // differs from the statement ("any country the form offers"): hx has an explicit server rule
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await placeCount();

    for (const country of ['ES', 'IT', 'DE', 'CH', 'CA', '-']) {
      const res = await app.actions.places.create(a.request, { name: `Lieu ${country}`, country });
      expect(res.location).toBe('/place/insert');
      expect(res.flash).toEqual({ kind: 'error', text: 'Seules les adresses en France et en Belgique sont autorisées' });
    }
    expect(await placeCount()).toBe(before);
  });

  test('editing a place accepts any country the form offers', { tag: ['@CAT-PLC-003'] }, async ({ app, as }) => {
    // UND-045: the France/Belgium rule exists on creation only
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.edit(a.request, s.place.id, { country: 'ES' });

    expect(res.location).toBe('/place');
    expect((await stored(s.place.id))?.country).toBe('ES');
  });
});

test.describe('locating a place on the map', () => {
  // UND-044. hx geocodes on save when the address changed or the place has no position (controller/Place.hx:49-55).
  // The test stack answers geocoding with STUB_POINT, and finds nothing for an address containing NOWHERE
  // (tests/stack/curl-stub.sh).
  const STUB_POINT = { lat: 48.1173, lng: -1.6778 };

  test('changing the address locates the place again', { tag: ['@CAT-PLC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Halle', lat: 47.2, lng: -1.5, main: false });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.edit(a.request, p.id, { city: 'Rezé' });

    expect(saved(res)).toBe(true);
    expect(triedToLocate(res)).toBe(false);
    expect(await stored(p.id)).toMatchObject({ city: 'Rezé', ...STUB_POINT });
  });

  test('when the new address cannot be located, a warning shows and the place is saved with its old position', { tag: ['@CAT-PLC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Halle', lat: 47.2, lng: -1.5, main: false });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.edit(a.request, p.id, { city: 'NOWHERE' });

    expect(triedToLocate(res)).toBe(true);
    expect(res.alerts?.some((x) => x.kind === 'ok')).toBe(true);
    expect(await stored(p.id)).toMatchObject({ city: 'NOWHERE', lat: 47.2, lng: -1.5 });
  });

  test('a place without a position is located again even if the address did not change', { tag: ['@CAT-PLC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.edit(a.request, s.place.id, { name: 'Autre nom' });

    expect(saved(res)).toBe(true);
    expect(await stored(s.place.id)).toMatchObject({ name: 'Autre nom', ...STUB_POINT });
  });

  test('a located place whose address did not change is not located again', { tag: ['@CAT-PLC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Halle', lat: 47.2, lng: -1.5, main: false });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.edit(a.request, p.id, { name: 'Halle bis' });

    expect(saved(res)).toBe(true);
    expect(triedToLocate(res)).toBe(false);
    expect(await stored(p.id)).toMatchObject({ name: 'Halle bis', lat: 47.2, lng: -1.5 });
  });

  test('coordinates typed together with a new address are replaced by the located position', { tag: ['@CAT-PLC-004'] }, async ({ app, as }) => {
    // the address changed, so hx geocodes whatever position the form carried
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.edit(a.request, s.place.id, { city: 'Vannes', lat: 47.66, lng: -2.76 });

    expect(saved(res)).toBe(true);
    expect(await stored(s.place.id)).toMatchObject({ city: 'Vannes', ...STUB_POINT });
  });

  test('coordinates typed together with an address that cannot be located are kept', { tag: ['@CAT-PLC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.edit(a.request, s.place.id, { city: 'NOWHERE', lat: 47.66, lng: -2.76 });

    expect(triedToLocate(res)).toBe(true);
    expect(await stored(s.place.id)).toMatchObject({ city: 'NOWHERE', lat: 47.66, lng: -2.76 });
  });
});

test.describe('deleting a place', () => {
  test('a place used by a distribution cannot be deleted', { tag: ['@CAT-PLC-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.delete(a.request, s.place.id);

    // the refusal sends the admin to the catalogs page (Place.hx:94)
    expect(res.location).toBe('/contractAdmin');
    expect(res.alerts?.some((x) => x.kind === 'error' && /distributions sont liées à ce lieu/.test(x.text))).toBe(true);
    expect(await stored(s.place.id)).toBeDefined();
  });

  test('only a group manager can delete a place: others get no delete link and nothing is deleted', { tag: ['@CAT-PLC-005'] }, async ({ app, as, errors }) => {
    errors.expect(/forbidden/); // hx raises "forbidden" as an error page
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Protégé', main: false });

    for (const who of ['member', 'coordinator'] as const) {
      const a = await actor(app, as, s, who);
      expect((await app.actions.places.list(a.request)).offersDelete).toBe(false);

      const res = await app.actions.places.delete(a.request, p.id);

      // "forbidden" is raised as a plain error: no success redirect
      expect(res.flash?.kind).not.toBe('ok');
      expect(await stored(p.id)).toBeDefined();
    }
  });

  test('a delete without the security token does nothing', { tag: ['@CAT-PLC-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.place({ group: s.group, name: 'Intact', main: false });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.places.delete(a.request, p.id, { token: false });

    expect(res.location).toBeNull();
    expect(await stored(p.id)).toBeDefined();
  });
});

test.describe('who can list, create and edit places', () => {
  // UND-051: today only delete needs the group manager right; the suggestion is to require it everywhere.
  test('a plain member can list, create and edit places', { tag: ['@CAT-PLC-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'member');

    const list = await app.actions.places.list(a.request);
    expect(list.status).toBe(200);
    expect(list.placeIds).toEqual([s.place.id]);

    expect(saved(await app.actions.places.create(a.request, { name: 'Créé par un membre' }))).toBe(true);
    expect(await byName('Créé par un membre')).toMatchObject({ groupId: s.group.id });

    expect(saved(await app.actions.places.edit(a.request, s.place.id, { name: 'Renommé par un membre', lat: 47.2, lng: -1.5 }))).toBe(true);
    expect((await stored(s.place.id))?.name).toBe('Renommé par un membre');
  });

  test('the place of another group can be edited and deleted from the current group (no ownership check)', { tag: ['@CAT-PLC-006'] }, async ({ app, as }) => {
    // UND-051: the suggestion is to check the place belongs to the current group on edit and delete
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const foreign = await make.place({ group: other, name: 'Lieu étranger', lat: 10, lng: 10 });
    const doomed = await make.place({ group: other, name: 'À perdre', main: false });
    const a = await actor(app, as, s, 'groupAdmin');

    expect(saved(await app.actions.places.edit(a.request, foreign.id, { name: 'Modifié de l’extérieur' }))).toBe(true);
    expect(await stored(foreign.id)).toMatchObject({ name: 'Modifié de l’extérieur', groupId: other.id });

    const del = await app.actions.places.delete(a.request, doomed.id);
    expect(del.flash?.kind).toBe('ok');
    expect(await stored(doomed.id)).toBeUndefined();
  });

  test('a visitor is sent to the login page', { tag: ['@CAT-PLC-006'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const list = await app.actions.places.list(anon.request);
    const form = await app.actions.places.form(anon.request);
    const edit = await app.actions.places.form(anon.request, s.place.id);

    for (const r of [list, form, edit]) {
      expect(r.status).toBe(302);
      expect(r.location).toMatch(/^\/\?__redirect=/);
    }
    expect(await placeCount()).toBe(1);
  });
});
