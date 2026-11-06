/**
 * Creating a group, as the superadmin's form (specs/02-groups/group-creation.md;
 * controller/Group.hx doCreate, service/PlaceService.hx).
 *
 * The map location is a call to Mapbox (service/Mapbox.hx, through the `curl` binary). The test stack
 * answers it with a fixed point (tests/stack/curl-stub.sh), so a valid form really creates the group.
 * What the new group looks like (creator's rights, defaults, located first place, selected group,
 * landing page) is checked in specs/08-administration/group-creation.forms.spec.ts (ADM-GRP-007).
 * Here: who can open and post the form, what the form asks for, and the checks that come first.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const counts = async () => ({
  groups: (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM `Group`'))!.n,
  places: (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Place'))!.n,
  memberships: (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM UserGroup'))!.n,
});

const REFUSAL = /Vous ne pouvez pas créer de nouveau groupe/;
const GEOCODING_FAILS = /Mapbox|Invalid res features|unable to locate/i;

test.describe('group creation form', () => {
  test('a superadmin gets a form asking for the group name and the address of its first place', { tag: ['@GRP-CRE-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const form = await app.actions.group.createForm(admin.request);

    expect(form.status).toBe(200);
    expect(form.location).toBeNull();
    expect(Object.keys(form.values).sort()).toEqual(['address1', 'address2', 'city', 'country', 'groupName', 'id', 'name', 'zipCode']);
    // the coordinates are not asked: the place is located from its address
    expect(form.values).not.toHaveProperty('lat');
    expect(form.values).not.toHaveProperty('lng');
    expect(form.values.country).toBe('FR');
    expect(form.countries).toContain('FR');
    expect([...form.required].sort()).toEqual(['city', 'country', 'groupName', 'name', 'zipCode']);
  });

  for (const field of ['groupName', 'name', 'zipCode', 'city'] as const) {
    test(`the form is refused before the map location without ${field}`, { tag: ['@GRP-CRE-001'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const admin = await as(s.users.superadmin);
      const before = await counts();

      const res = await app.actions.group.create(admin.request, { groupName: 'AMAP du Test', name: 'Salle', address1: '1 rue X', [field]: '' });

      // the form is shown again (no redirect, no error page, nothing logged) and nothing is created
      expect(res.status).toBe(200);
      expect(res.location).toBeNull();
      expect(res.body).toContain('_formSubmitted');
      expect(res.body).not.toMatch(GEOCODING_FAILS);
      expect(await counts()).toEqual(before);
    });
  }

  test('the address lines are optional: a form with only the group, place name, zip code and city creates the group', { tag: ['@GRP-CRE-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const before = await counts();

    const res = await app.actions.group.create(admin.request, { groupName: 'AMAP du Test', name: 'Salle', address1: '', address2: '' });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    expect(await counts()).toEqual({ groups: before.groups + 1, places: before.places + 1, memberships: before.memberships + 1 });
  });
});

test.describe('who can create a group', () => {
  const refused: [string, 'member' | 'groupAdmin' | 'coordinator'][] = [
    ['a member', 'member'],
    ['the admin of a group', 'groupAdmin'],
    ['a coordinator', 'coordinator'],
  ];
  for (const [label, who] of refused) {
    test(`${label} who is not a superadmin cannot open the creation form`, { tag: ['@GRP-CRE-006'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const user = await as(s.users[who]);

      const res = await app.actions.group.createForm(user.request);

      // sent to the home page with an explanation that creation goes through the federation
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(res.flash?.kind).toBe('error');
      expect(res.flash?.text).toMatch(REFUSAL);
      expect(res.body).not.toContain('_formSubmitted');
    });
  }

  test('a user who is not a superadmin cannot post the creation form either', { tag: ['@GRP-CRE-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const user = await as(s.users.groupAdmin);
    const before = await counts();

    // the form is refused before it is built, so this posts without the form's token
    const res = await user.request.post('/group/create', {
      form: { groupName: 'Pirate', name: 'Salle', zipCode: '44000', city: 'Nantes', country: 'FR', submit: 'OK' },
      maxRedirects: 0,
    });

    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toBe('/');
    expect(await counts()).toEqual(before);
  });

  test('a visitor who is not logged in gets a technical error page, not a login page', { tag: ['@GRP-CRE-007'] }, async ({ anon, errors }) => {
    // UND-024: no login guard on the action; hx dereferences the missing user (isAdmin) and shows its error page.
    // Suggested: keep it superadmin-only and ask the visitor to log in.
    errors.expect(/isAdmin/);
    const before = await counts();

    const res = await anon.request.get('/group/create', { maxRedirects: 0 });

    expect(res.status()).toBe(200);
    expect(res.headers()['location']).toBeUndefined();
    const html = await res.text();
    expect(html).toContain('Invalid field access : isAdmin');
    expect(html).not.toContain('_formSubmitted');
    expect(await counts()).toEqual(before);
  });
});
