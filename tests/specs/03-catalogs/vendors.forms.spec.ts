/**
 * Vendor records through the coordinator's forms (specs/03-catalogs/vendors.md;
 * controller/Contract.hx doInsertVendor, controller/Vendor.hx doEdit,
 * service/VendorService.hx, db/User.hx canManageVendor).
 *
 * hx geocodes the address on every save (Mapbox, service/VendorService.hx). The test stack
 * answers geocoding with STUB_POINT, and finds nothing for an address containing NOWHERE
 * (tests/stack/curl-stub.sh), so both the saved result and the geocoding refusal are observable.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne, update } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'], opts: { selectGroup?: boolean } = {}) {
  const a = await as(s.users[who]);
  if (opts.selectGroup !== false) await app.actions.group.select(a.request, s.group.id);
  return a;
}

type VendorRow = { id: number; name: string; email: string | null; desc: string | null; linkUrl: string | null; lat: number | null; lng: number | null };
const vendorRow = (id: number) => queryOne<VendorRow>('SELECT * FROM Vendor WHERE id = ?', [id]);
const vendorCount = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Vendor'))!.n;

/** The scenario vendor with the fields the edit form requires, released (unclaimed) or not. */
async function editableVendor(s: Scenario, opts: { claimed: boolean }) {
  await update('Vendor', { id: s.vendor.id }, { companyNumber: '12345678900012', profession: 1, userId: opts.claimed ? s.users.vendor.id : null });
  return s.vendor.id;
}

/** The edit form stacks two reminders (shown as ok messages) on the session: the outcome is the error, if any. */
const outcome = (res: { alerts?: { kind: 'ok' | 'error'; text: string }[] }) => res.alerts?.find((a) => a.kind === 'error') ?? null;

const GEOCODING_FAILS = /Mapbox|Invalid res features|unable to locate/i;
const STUB_POINT = { lat: 48.1173, lng: -1.6778 };

test.describe('creating a vendor', () => {
  const validVendor = {
    name: 'Ferme des Tilleuls',
    email: 'tilleuls@camap.test',
    companyNumber: '12345678900012',
    profession: 1,
    address1: '2 rue des Tilleuls',
    zipCode: '44000',
    city: 'Nantes',
    desc: 'Légumes de saison',
    linkUrl: 'https://tilleuls.example.org',
    phone: '0611223344',
    peopleName: 'Tilda Tilleul',
  };

  test('a valid vendor form is saved, located on the map', { tag: ['@CAT-VEN-001', '@CAT-VEN-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.createVendor(a.request, validVendor);

    expect(res.status).toBe(302);
    expect(res.flash?.kind).not.toBe('error');
    const [row] = await query<VendorRow>('SELECT * FROM Vendor WHERE email = ?', ['tilleuls@camap.test']);
    expect(row).toMatchObject({ name: 'Ferme des Tilleuls', desc: 'Légumes de saison', linkUrl: 'https://tilleuls.example.org', ...STUB_POINT });
  });

  test('a vendor whose address cannot be located is refused and nothing is saved', { tag: ['@CAT-VEN-001', '@CAT-VEN-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await vendorCount();

    const res = await app.actions.catalogs.createVendor(a.request, { ...validVendor, city: 'NOWHERE' });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/contract/insertVendor');
    expect(res.flash?.kind).toBe('error');
    // not a validation message: the form was accepted, the map location failed
    expect(res.flash?.text).toMatch(GEOCODING_FAILS);
    expect(await vendorCount()).toBe(before);
  });

  test('the email is required', { tag: ['@CAT-VEN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await vendorCount();

    const res = await app.actions.catalogs.createVendor(a.request, { email: null });

    // the form is shown again, nothing is saved
    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(await vendorCount()).toBe(before);
  });

  test('the SIRET number is required in the form', { tag: ['@CAT-VEN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await vendorCount();

    const res = await app.actions.catalogs.createVendor(a.request, { companyNumber: null });

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(await vendorCount()).toBe(before);
  });

  test('an invalid email is refused', { tag: ['@CAT-VEN-001', '@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await vendorCount();

    const res = await app.actions.catalogs.createVendor(a.request, { email: 'not-an-email' });

    expect(res.location).toBe('/contract/insertVendor');
    expect(res.flash).toEqual({ kind: 'error', text: 'Email invalide.' });
    expect(await vendorCount()).toBe(before);
  });

  test('a description of more than 1000 characters is refused, 1000 is accepted', { tag: ['@CAT-VEN-001', '@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const tooLong = await app.actions.catalogs.createVendor(a.request, { desc: 'x'.repeat(1001) });
    const limit = await app.actions.catalogs.createVendor(a.request, { desc: 'x'.repeat(1000) });

    expect(tooLong.flash?.kind).toBe('error');
    expect(tooLong.flash?.text).toMatch(/moins de 1000 caractères/);
    // 1000 passes the length check, and the vendor is saved
    expect(limit.flash?.kind).not.toBe('error');
    expect(await query('SELECT id FROM Vendor WHERE CHAR_LENGTH(`desc`) = 1000')).toHaveLength(1);
  });
});

test.describe('a vendor email is unique', () => {
  test('a vendor cannot be created with the email of another vendor', { tag: ['@CAT-VEN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await vendorCount();

    const res = await app.actions.catalogs.createVendor(a.request, { name: 'Un autre nom', email: s.vendor.email! });

    expect(res.location).toBe('/contract/insertVendor');
    expect(res.flash).toEqual({ kind: 'error', text: 'Un producteur est déjà référencé avec cet email dans notre base de données' });
    expect(await vendorCount()).toBe(before);
  });

  test('the email is compared whatever its case', { tag: ['@CAT-VEN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await vendorCount();

    const res = await app.actions.catalogs.createVendor(a.request, { email: s.vendor.email!.toUpperCase() });

    expect(res.flash?.text).toMatch(/déjà référencé/);
    expect(await vendorCount()).toBe(before);
  });

  test('a new email passes the duplicate check', { tag: ['@CAT-VEN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.catalogs.createVendor(a.request, { email: 'brand-new@camap.test' });

    expect(res.flash?.text).not.toMatch(/déjà référencé/);
  });
});

test.describe('editing a vendor: who may', () => {
  test('a coordinator of one of the catalogs of an unclaimed vendor opens the edit form', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: false });
    const a = await actor(app, as, s, 'coordinator');

    const res = await app.actions.vendors.editForm(a.request, id);

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
  });

  test('a coordinator of other catalogs, or a plain member, is refused', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    // a vendor whose only catalog is not one the coordinator manages
    const other = await make.vendor({ name: 'Autre ferme', companyNumber: '12345678900012', profession: 1 });
    await make.catalog({ group: s.group, vendor: other, name: 'Contrat autre ferme' });
    const coordinator = await actor(app, as, s, 'coordinator');
    const member = await actor(app, as, s, 'member');

    for (const who of [coordinator, member]) {
      const res = await app.actions.vendors.editForm(who.request, other.id);
      expect(res.status).toBe(302);
      expect(res.location).toBe('/contractAdmin');
    }
  });

  test('the coordinator of all catalogs opens the form of a vendor whose catalog is in the group', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.vendor({ name: 'Autre ferme', companyNumber: '12345678900012', profession: 1 });
    await make.catalog({ group: s.group, vendor: other, name: 'Contrat autre ferme' });
    const a = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.vendors.editForm(a.request, other.id);

    expect(res.status).toBe(200);
  });

  test('a vendor with no catalog can be edited by a superadmin only', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const lone = await make.vendor({ name: 'Ferme sans contrat', companyNumber: '12345678900012', profession: 1 });
    const coordinatorOfAll = await actor(app, as, s, 'groupAdmin');
    const superadmin = await actor(app, as, s, 'superadmin', { selectGroup: false });

    const refused = await app.actions.vendors.editForm(coordinatorOfAll.request, lone.id);
    const allowed = await app.actions.vendors.editForm(superadmin.request, lone.id);

    expect(refused.status).toBe(302);
    expect(refused.location).toBe('/contractAdmin');
    expect(allowed.status).toBe(200);
  });

  test('a visitor is sent to the login page', { tag: ['@CAT-VEN-006'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: false });

    const res = await app.actions.vendors.editForm(anon.request, id);

    expect(res.status).toBe(302);
    expect(res.location).not.toBe('/contractAdmin');
  });

  test('a refused member cannot save changes either', { tag: ['@CAT-VEN-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: false });
    const member = await actor(app, as, s, 'member');

    const res = await app.actions.vendors.edit(member.request, id, { name: 'Piraté' });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/contractAdmin');
    expect((await vendorRow(id))?.name).toBe('Ferme du Test');
  });
});

test.describe('editing a claimed vendor', () => {
  test('only its owner opens the edit form', { tag: ['@CAT-VEN-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: true });
    const owner = await actor(app, as, s, 'vendor', { selectGroup: false });

    const res = await app.actions.vendors.editForm(owner.request, id);

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
  });

  test('a coordinator, the coordinator of all catalogs and a superadmin are all refused', { tag: ['@CAT-VEN-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: true });
    const refused = [
      await actor(app, as, s, 'coordinator'),
      await actor(app, as, s, 'groupAdmin'),
      await actor(app, as, s, 'superadmin', { selectGroup: false }),
    ];

    for (const who of refused) {
      const res = await app.actions.vendors.editForm(who.request, id);
      expect(res.status).toBe(302);
      expect(res.location).toBe('/contractAdmin');
    }
  });

  test('a refused coordinator cannot save changes', { tag: ['@CAT-VEN-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: true });
    const coordinator = await actor(app, as, s, 'coordinator');

    const res = await app.actions.vendors.edit(coordinator.request, id, { name: 'Piraté' });

    expect(res.location).toBe('/contractAdmin');
    expect((await vendorRow(id))?.name).toBe('Ferme du Test');
  });
});

test.describe('saving a vendor edit', () => {
  test('an invalid email is refused', { tag: ['@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: false });
    const a = await actor(app, as, s, 'coordinator');

    const res = await app.actions.vendors.edit(a.request, id, { email: 'not-an-email' });

    expect(res.location).toBe(`/vendor/edit/${id}`);
    expect(outcome(res)).toEqual({ kind: 'error', text: 'Email invalide.' });
    expect((await vendorRow(id))?.email).toBe('ferme@camap.test');
  });

  test('the email cannot be emptied', { tag: ['@CAT-VEN-001', '@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: false });
    const a = await actor(app, as, s, 'coordinator');

    const res = await app.actions.vendors.edit(a.request, id, { email: null });

    // required in the form: shown again, nothing saved
    expect(res.status).toBe(200);
    expect((await vendorRow(id))?.email).toBe('ferme@camap.test');
  });

  test('a description of more than 1000 characters is refused, 1000 is accepted', { tag: ['@CAT-VEN-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: false });
    const a = await actor(app, as, s, 'coordinator');

    const tooLong = await app.actions.vendors.edit(a.request, id, { desc: 'x'.repeat(1001) });
    const limit = await app.actions.vendors.edit(a.request, id, { desc: 'x'.repeat(1000) });

    expect(outcome(tooLong)?.text).toMatch(/moins de 1000 caractères/);
    // the coordinator's edit page also carries an unrelated reminder of kind error ("Chercher un producteur")
    expect(outcome(limit)?.text ?? '').not.toMatch(/1000|unable to locate/);
    expect((await vendorRow(id))?.desc).toBe('x'.repeat(1000));
  });

  test('a save with a new address locates the vendor again', { tag: ['@CAT-VEN-003', '@CAT-VEN-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: true });
    const owner = await actor(app, as, s, 'vendor', { selectGroup: false });

    const res = await app.actions.vendors.edit(owner.request, id, { name: 'Ferme renommée', address1: '3 rue Nouvelle' });

    expect(outcome(res)).toBeNull();
    expect(await vendorRow(id)).toMatchObject({ name: 'Ferme renommée', ...STUB_POINT });
  });

  test('a save is refused when the address cannot be located, and nothing changes', { tag: ['@CAT-VEN-003', '@CAT-VEN-004'] }, async ({ app, as }) => {
    // CAT-VEN-004 is undecided (UND-044): hx geocodes on save, and a failure blocks the save.
    const s = await make.amapScenario();
    const id = await editableVendor(s, { claimed: true });
    const owner = await actor(app, as, s, 'vendor', { selectGroup: false });

    const res = await app.actions.vendors.edit(owner.request, id, { name: 'Ferme renommée', address1: 'NOWHERE 3 rue Nouvelle' });

    expect(res.location).toBe(`/vendor/edit/${id}`);
    expect(outcome(res)?.kind).toBe('error');
    expect(outcome(res)?.text).toMatch(GEOCODING_FAILS);
    const stored = await vendorRow(id);
    expect(stored?.name).toBe('Ferme du Test');
    expect(stored?.lat).toBeNull();
    expect(stored?.lng).toBeNull();
    expect(await query('SELECT id FROM Vendor WHERE address1 = ?', ['NOWHERE 3 rue Nouvelle'])).toHaveLength(0);
  });
});
