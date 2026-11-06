/**
 * The public vendor page and the vendor dashboard shell (specs/03-catalogs/vendor-pages.md;
 * camap-hx controller/Vendor.hx doView, doDashboard). The tabs, photos and distributions
 * are drawn by the browser from GraphQL: see vendor-pages.graphql.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test.describe('the public page of a vendor', () => {
  test('a visitor and a member open it and are handed the vendor data', { tag: ['@CAT-VDB-001'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme du Soleil', email: 'soleil@camap.test', desc: 'Légumes de saison' });
    await make.catalog({ group: s.group, vendor: v });
    const member = await as(s.users.member);

    for (const who of [anon, member]) {
      const page = await app.views.vendors.publicPage(who.request, v.id);

      expect(page.status).toBe(200);
      expect(page.location).toBeNull();
      expect(page.email).toBe('soleil@camap.test');
    }
  });

  test('it needs no group: a user outside every group opens it too', { tag: ['@CAT-VDB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const outsider = await as(s.users.nonMember);

    const page = await app.views.vendors.publicPage(outsider.request, s.vendor.id);

    expect(page.status).toBe(200);
    expect(page.email).toBe(s.vendor.email);
  });
});

test.describe('the vendor dashboard', () => {
  test('a vendor opens it', { tag: ['@CAT-VDB-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const vendor = await as(s.users.vendor);

    const page = await app.views.vendors.dashboard(vendor.request);

    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
  });

  test('a member who owns no vendor is sent back to the home page', { tag: ['@CAT-VDB-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    for (const user of [s.users.member, s.users.coordinator, s.users.groupAdmin, s.users.superadmin]) {
      const who = await as(user);

      const page = await app.views.vendors.dashboard(who.request);

      expect(page.status, user.email).toBe(302);
      expect(page.location, user.email).toBe('/home');
    }
  });

  test('a visitor is sent to the login form, then back to the dashboard', { tag: ['@CAT-VDB-003'] }, async ({ app, anon }) => {
    await make.amapScenario();

    const page = await app.views.vendors.dashboard(anon.request);

    expect(page.status).toBe(302);
    // hx shows the login form on the home page and remembers where the visitor was going
    expect(page.location).toContain('/vendor/dashboard');
  });

  test('releasing the vendor record takes the dashboard away', { tag: ['@CAT-VDB-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const vendor = await as(s.users.vendor);
    const { update } = await import('../../src/db/client.js');
    await update('Vendor', { id: s.vendor.id }, { userId: null });

    const page = await app.views.vendors.dashboard(vendor.request);

    expect(page.status).toBe(302);
    expect(page.location).toBe('/home');
  });
});
