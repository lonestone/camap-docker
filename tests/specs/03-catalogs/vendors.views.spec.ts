/**
 * The public vendor page (specs/03-catalogs/vendors.md; controller/Vendor.hx doView,
 * db/Vendor.hx getInfos, controller/Contract.hx doInsertChoose).
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test.describe('a disabled vendor', () => {
  test('its page is open to members and visitors only while the vendor is enabled', { tag: ['@CAT-VEN-008'] }, async ({ app, as, anon, errors }) => {
    errors.expect(/n'est plus référencé/);
    const s = await make.amapScenario();
    const disabled = await make.vendor({ name: 'Producteur désactivé', disabled: 2 });
    const member = await as(s.users.member);

    for (const who of [member, anon]) {
      const open = await app.views.vendors.publicPage(who.request, s.vendor.id);
      const closed = await app.views.vendors.publicPage(who.request, disabled.id);

      expect(open.status).toBe(200);
      expect(open.email).toBe(s.vendor.email);
      // hx answers with its error page (still HTTP 200) and logs the refusal: no vendor data is handed out
      expect(closed.email).toBeNull();
      expect(closed.text).toContain("Ce producteur n'est plus référencé");
    }
  });

  test('the page of a vendor disabled for any reason is closed', { tag: ['@CAT-VEN-008'] }, async ({ app, anon, errors }) => {
    errors.expect(/n'est plus référencé/);
    await make.amapScenario();
    for (const reason of [0, 1, 2]) {
      const v = await make.vendor({ name: `Producteur ${reason}`, disabled: reason });

      const page = await app.views.vendors.publicPage(anon.request, v.id);

      expect(page.email).toBeNull();
      expect(page.text).toContain("Ce producteur n'est plus référencé");
    }
  });

  test('it cannot be chosen for a new catalog', { tag: ['@CAT-VEN-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const disabled = await make.vendor({ name: 'Producteur banni', disabled: 2 });
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    const res = await app.actions.catalogs.typeChoices(a.request, disabled.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/contract/defineVendor/');
    expect(res.types).toEqual([]);
  });

  test('its catalogs are not listed as active', { tag: ['@CAT-VEN-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const disabled = await make.vendor({ name: 'Ferme fermee', disabled: 1 });
    const hidden = await make.catalog({ group: s.group, vendor: disabled, name: 'Contrat producteur desactive' });
    const member = await as(s.users.member);

    const res = await app.api.catalog.activeInGroup(member.request, s.group.id);

    const ids = res.data!.getActiveCatalogs.map((c) => c.id);
    expect(ids).toContain(s.constCatalog.id);
    expect(ids).not.toContain(hidden.id);
  });
});

// CAT-VEN-010 is undecided (UND-041): the hx page honours the vendor's choices.
test.describe('contact details on the vendor page', () => {
  test('the email and phone are shown when the vendor chose to show them', { tag: ['@CAT-VEN-010'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme ouverte', email: 'ouverte@camap.test', phone: '0611223344', showEmail: true, showPhone: true });
    const member = await as(s.users.member);

    for (const who of [member, anon]) {
      const page = await app.views.vendors.publicPage(who.request, v.id);

      expect(page.status).toBe(200);
      expect(page.email).toBe('ouverte@camap.test');
      expect(page.phone).toBe('0611223344');
    }
  });

  test('the email and phone are left out when the vendor chose to hide them', { tag: ['@CAT-VEN-010'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme discrète', email: 'discrete@camap.test', phone: '0611223344', showEmail: false, showPhone: false });
    const member = await as(s.users.member);

    for (const who of [member, anon]) {
      const page = await app.views.vendors.publicPage(who.request, v.id);

      expect(page.status).toBe(200);
      expect(page.email).toBe('');
      expect(page.phone).toBeNull();
      expect(page.text).not.toContain('discrete@camap.test');
    }
  });

  test('each choice is independent', { tag: ['@CAT-VEN-010'] }, async ({ app, anon }) => {
    await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme mixte', email: 'mixte@camap.test', phone: '0611223344', showEmail: true, showPhone: false });

    const page = await app.views.vendors.publicPage(anon.request, v.id);

    expect(page.email).toBe('mixte@camap.test');
    expect(page.phone).toBeNull();
  });

  // hx has no manager exception on the page: even the coordinator of the vendor's catalogs sees the hidden contact left out.
  test('a coordinator of the vendor sees the same page as a member (characterised)', { tag: ['@CAT-VEN-010'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme discrète', email: 'discrete@camap.test', phone: '0611223344', showEmail: false, showPhone: false });
    await make.catalog({ group: s.group, vendor: v, name: 'Contrat discret' });
    const a = await as(s.users.groupAdmin);

    const page = await app.views.vendors.publicPage(a.request, v.id);

    expect(page.email).toBe('');
    expect(page.phone).toBeNull();
  });
});
