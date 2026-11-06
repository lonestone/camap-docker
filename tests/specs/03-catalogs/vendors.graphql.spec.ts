/**
 * The vendor dashboard and vendor queries of camap-ts, through GraphQL
 * (specs/03-catalogs/vendors.md; camap-ts vendors.resolver.ts, vendor.service.ts).
 * Unlike the coordinator's hx form, this path does not geocode the address.
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne, update } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

const UPDATE = `mutation(
  $vendorId: Int!, $name: String!, $email: String!, $city: String!, $zipCode: String!, $companyNumber: String!,
  $address1: String, $desc: String, $linkUrl: String, $lat: Float, $lng: Float, $showEmail: Boolean, $showPhone: Boolean
) {
  updateVendor(vendorId: $vendorId, name: $name, email: $email, city: $city, zipCode: $zipCode, companyNumber: $companyNumber,
    address1: $address1, desc: $desc, linkUrl: $linkUrl, lat: $lat, lng: $lng, showEmail: $showEmail, showPhone: $showPhone) {
    id name email city address1 desc linkUrl lat lng
  }
}`;

type Stored = { name: string; email: string; address1: string | null; desc: string | null; linkUrl: string | null; lat: number | null; lng: number | null };
const stored = (id: number) => queryOne<Stored>('SELECT * FROM Vendor WHERE id = ?', [id]);

/** Valid arguments for the scenario vendor, with overrides. */
const args = (s: Scenario, over: Record<string, unknown> = {}) => ({
  vendorId: s.vendor.id,
  name: 'Ferme du Test',
  email: 'ferme@camap.test',
  city: 'Nantes',
  zipCode: '44000',
  companyNumber: '12345678900012',
  ...over,
});

const release = (s: Scenario) => update('Vendor', { id: s.vendor.id }, { userId: null });

test.describe('saving the vendor profile', () => {
  test('the owner saves the profile', { tag: ['@CAT-VEN-005', '@CAT-VEN-007', '@CAT-VDB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, UPDATE, args(s, { name: 'Ferme renommée', desc: 'Légumes de saison' }));

    expect(res.errors).toBeNull();
    expect(res.data.updateVendor).toMatchObject({ id: s.vendor.id, name: 'Ferme renommée', desc: 'Légumes de saison' });
    expect(await stored(s.vendor.id)).toMatchObject({ name: 'Ferme renommée', desc: 'Légumes de saison' });
  });

  test('an invalid email is refused', { tag: ['@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    for (const email of ['not-an-email', 'a@b', 'with space@camap.test']) {
      const res = await app.graphql(owner.request, UPDATE, args(s, { email }));

      expect(res.errors?.[0].message).toMatch(/Invalid email format/);
    }
    expect((await stored(s.vendor.id))?.email).toBe('ferme@camap.test');
  });

  test('a description of more than 1000 characters is refused, 1000 is accepted', { tag: ['@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const tooLong = await app.graphql(owner.request, UPDATE, args(s, { desc: 'x'.repeat(1001) }));
    expect(tooLong.errors?.[0].message).toMatch(/Description must be less than 1000 characters/);
    expect((await stored(s.vendor.id))?.desc).toBeNull();

    const limit = await app.graphql(owner.request, UPDATE, args(s, { desc: 'x'.repeat(1000) }));
    expect(limit.errors).toBeNull();
    expect((await stored(s.vendor.id))?.desc).toHaveLength(1000);
  });

  test('a link that does not start with http gets http:// in front', { tag: ['@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const bare = await app.graphql(owner.request, UPDATE, args(s, { linkUrl: 'ferme.example.org' }));
    expect(bare.errors).toBeNull();
    expect((await stored(s.vendor.id))?.linkUrl).toBe('http://ferme.example.org');

    for (const linkUrl of ['http://plain.example.org', 'https://secure.example.org']) {
      await app.graphql(owner.request, UPDATE, args(s, { linkUrl }));
      expect((await stored(s.vendor.id))?.linkUrl).toBe(linkUrl);
    }
  });
});

test.describe('the address of a vendor saved from the dashboard', () => {
  // CAT-VEN-003 ERRATUM and CAT-VEN-004 (undecided, UND-044): camap-ts does not locate the address.
  test('the position fields are stored as entered', { tag: ['@CAT-VEN-003', '@CAT-VEN-004', '@CAT-VDB-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, UPDATE, args(s, { address1: '3 rue du Test', lat: 47.2184, lng: -1.5536 }));

    expect(res.errors).toBeNull();
    expect(await stored(s.vendor.id)).toMatchObject({ address1: '3 rue du Test', lat: 47.2184, lng: -1.5536 });
  });

  test('a new address without coordinates is saved and the old position is kept', { tag: ['@CAT-VEN-003', '@CAT-VEN-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await update('Vendor', { id: s.vendor.id }, { lat: 45.0, lng: 3.0 });
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, UPDATE, args(s, { address1: 'Une adresse introuvable' }));

    expect(res.errors).toBeNull();
    expect(await stored(s.vendor.id)).toMatchObject({ address1: 'Une adresse introuvable', lat: 45, lng: 3 });
  });
});

test.describe('who may save a vendor profile', () => {
  test('the owner of a claimed vendor is the only one', { tag: ['@CAT-VEN-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const refused = [await as(s.users.coordinator), await as(s.users.groupAdmin), await as(s.users.superadmin), await as(s.users.member)];

    for (const who of refused) {
      const res = await app.graphql(who.request, UPDATE, args(s, { name: 'Piraté' }));

      expect(res.errors?.[0].message).toMatch(/cannot update vendor/);
    }
    expect((await stored(s.vendor.id))?.name).toBe('Ferme du Test');
  });

  test('a coordinator of one of the catalogs of an unclaimed vendor saves it', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await release(s);
    const coordinator = await as(s.users.coordinator);

    const res = await app.graphql(coordinator.request, UPDATE, args(s, { name: 'Par la coordinatrice' }));

    expect(res.errors).toBeNull();
    expect((await stored(s.vendor.id))?.name).toBe('Par la coordinatrice');
  });

  test('a member with no right on its catalogs is refused', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await release(s);
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, UPDATE, args(s, { name: 'Piraté' }));

    expect(res.errors?.[0].message).toMatch(/cannot update vendor/);
    expect((await stored(s.vendor.id))?.name).toBe('Ferme du Test');
  });

  test('a superadmin saves any unclaimed vendor', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const lone = await make.vendor({ name: 'Ferme sans contrat', email: 'lone@camap.test' });
    const superadmin = await as(s.users.superadmin);
    const member = await as(s.users.member);

    const refused = await app.graphql(member.request, UPDATE, args(s, { vendorId: lone.id, email: 'lone@camap.test', name: 'Piraté' }));
    const allowed = await app.graphql(superadmin.request, UPDATE, args(s, { vendorId: lone.id, email: 'lone@camap.test', name: 'Par le superadmin' }));

    expect(refused.errors?.[0].message).toMatch(/cannot update vendor/);
    expect(allowed.errors).toBeNull();
    expect((await stored(lone.id))?.name).toBe('Par le superadmin');
  });

  test('a visitor is refused', { tag: ['@CAT-VEN-006', '@CAT-VEN-007'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.graphql(anon.request, UPDATE, args(s, { name: 'Piraté' }));

    expect(res.errors).not.toBeNull();
    expect((await stored(s.vendor.id))?.name).toBe('Ferme du Test');
  });
});

// CAT-VEN-010 is undecided (UND-041). The hx page honours the vendor's choices (see vendors.views.spec.ts).
// camap-ts awaits nothing before testing the manager right, so a pending promise is always truthy:
// today the GraphQL email and phone are returned whatever the vendor chose.
test.describe('contact details through GraphQL', () => {
  const READ = `query($id: Int!) { vendor(id: $id) { id email phone showEmail showPhone } }`;

  test('a member reads the email and phone of a vendor who chose to hide them (characterised, UND-041)', { tag: ['@CAT-VEN-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme discrète', email: 'discrete@camap.test', phone: '0611223344', showEmail: false, showPhone: false });
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, READ, { id: v.id });

    expect(res.errors).toBeNull();
    expect(res.data.vendor).toMatchObject({ showEmail: false, showPhone: false, email: 'discrete@camap.test', phone: '0611223344' });
  });
});

test.describe('professions and company number search', () => {
  const PROFESSIONS = `query { getVendorProfessions { id name } }`;
  const BY_SIRET = `query($n: String!) { getVendorsFromCompanyNumber(companyNumber: $n) { id name } }`;

  test('a logged-in user lists the vendor professions', { tag: ['@CAT-VEN-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PROFESSIONS);

    expect(res.errors).toBeNull();
    expect(res.data.getVendorProfessions.length).toBeGreaterThan(5);
    expect(res.data.getVendorProfessions[0]).toEqual({ id: expect.any(Number), name: expect.any(String) });
  });

  test('a logged-in user searches vendors by company number', { tag: ['@CAT-VEN-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await make.vendor({ name: 'Ferme A', companyNumber: '11111111100011' });
    await make.vendor({ name: 'Ferme B', companyNumber: '22222222200022' });
    const member = await as(s.users.member);

    const found = await app.graphql(member.request, BY_SIRET, { n: '11111111100011' });
    const none = await app.graphql(member.request, BY_SIRET, { n: '99999999900099' });

    expect(found.data.getVendorsFromCompanyNumber).toEqual([{ id: a.id, name: 'Ferme A' }]);
    expect(none.data.getVendorsFromCompanyNumber).toEqual([]);
  });

  // UND-043: these two queries have no login guard today (their sibling queries do).
  test('a visitor can also list the professions and search by company number (characterised, UND-043)', { tag: ['@CAT-VEN-012'] }, async ({ app, anon }) => {
    const v = await make.vendor({ name: 'Ferme A', companyNumber: '11111111100011' });

    const professions = await app.graphql(anon.request, PROFESSIONS);
    const bySiret = await app.graphql(anon.request, BY_SIRET, { n: '11111111100011' });

    expect(professions.errors).toBeNull();
    expect(professions.data.getVendorProfessions.length).toBeGreaterThan(5);
    expect(bySiret.errors).toBeNull();
    expect(bySiret.data.getVendorsFromCompanyNumber).toEqual([{ id: v.id, name: 'Ferme A' }]);
  });
});

test.describe('the vendors a user owns', () => {
  const OWNED = `query($id: Int!) { getVendorsByUserId(userId: $id) { id name } }`;
  const DEFAULT = `query($id: Int!) { getDefaultVendorByUserId(userId: $id) { id name } }`;
  const HAS = `query($id: Int!) { hasVendorsByUserId(userId: $id) }`;

  test('an owner sees their vendors, their default vendor and that they own some', { tag: ['@CAT-VEN-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const second = await make.vendor({ name: 'Deuxième ferme', user: s.users.vendor });
    const owner = await as(s.users.vendor);

    const owned = await app.graphql(owner.request, OWNED, { id: s.users.vendor.id });
    const def = await app.graphql(owner.request, DEFAULT, { id: s.users.vendor.id });
    const has = await app.graphql(owner.request, HAS, { id: s.users.vendor.id });

    expect(owned.data.getVendorsByUserId.map((v: { id: number }) => v.id).sort()).toEqual([s.vendor.id, second.id].sort());
    expect([s.vendor.id, second.id]).toContain(def.data.getDefaultVendorByUserId.id);
    expect(has.data.hasVendorsByUserId).toBe(true);
  });

  test('a user who owns no vendor owns none', { tag: ['@CAT-VEN-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const owned = await app.graphql(member.request, OWNED, { id: s.users.member.id });
    const has = await app.graphql(member.request, HAS, { id: s.users.member.id });

    expect(owned.data.getVendorsByUserId).toEqual([]);
    expect(has.data.hasVendorsByUserId).toBe(false);
  });

  test('these questions can only be asked about oneself', { tag: ['@CAT-VEN-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    for (const q of [OWNED, DEFAULT, HAS]) {
      const res = await app.graphql(member.request, q, { id: s.users.vendor.id });

      expect(res.errors).not.toBeNull();
      expect(res.data).toBeNull();
    }
  });

  test('a visitor cannot ask', { tag: ['@CAT-VEN-013'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.graphql(anon.request, HAS, { id: s.users.vendor.id });

    expect(res.errors).not.toBeNull();
  });
});
