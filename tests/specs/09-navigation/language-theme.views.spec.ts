/**
 * Language, theme and page layout (specs/09-navigation/language.md, theme-layout.md;
 * camap-hx lang/master/tpl/base.mtt, macros.mtt footer(), controller/Account.hx, form/CamapForm.hx,
 * camap-ts public/locales).
 *
 * Checked elsewhere: the theme admin form and the terms redirect of the saved theme (08-administration/theme.forms.spec.ts,
 * maintenance-install.views.spec.ts, ADM-THM-*, ADM-MNT-008).
 * Browser only (no test): NAV-LNG-002 (every text comes from the translation files: code structure),
 * NAV-THM-004 (anti double click), NAV-THM-005 (date picker), NAV-THM-007 (widget service down), NAV-THM-009 (no other screens).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import type { ImportedPerson } from '../../src/targets/types.js';

const LOGO = '/theme/test/logo-test.png';
const savedTheme = {
  id: 'test-theme',
  name: 'Plateforme Test',
  supportEmail: 'aide@plateforme.test',
  footer: { bloc1: `<img src="${LOGO}" alt="Logo test"/>`, bloc2: '<p>Contact : aide@plateforme.test</p>', bloc3: '<p>Troisieme bloc</p>', bloc4: '<p>Dernier bloc</p>' },
  email: { senderEmail: 'envoi@plateforme.test', brandedEmailLayoutFooter: '<p>Pied de mail de la plateforme test</p>' },
  terms: {
    termsOfServiceLink: 'https://example.test/cgu',
    termsOfSaleLink: 'https://example.test/cgv',
    platformTermsOfServiceLink: 'https://example.test/cgs',
    privacyPolicyLink: 'https://example.test/rgpd',
  },
};

async function saveTheme(app: any, request: any, theme: unknown) {
  await app.actions.admin.setTheme(request, JSON.stringify(theme));
  await app.actions.admin.reloadTheme(request);
}

test.describe('language', () => {
  test('pages are in French, for a visitor and for a logged-in user', { tag: ['@NAV-LNG-001'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const login = await app.views.platform.layout(anon.request, 'login');
    const chooser = await app.views.platform.layout(member.request, 'chooser');

    expect(login.status).toBe(200);
    expect(login.language).toBe('fr');
    expect(chooser.status).toBe(200);
    expect(chooser.language).toBe('fr');
    expect(chooser.text).toMatch(/Vous êtes membre des groupes/);
  });

  test('French is the only language shipped in the translation files', { tag: ['@NAV-LNG-001'] }, async ({ app, anon }) => {
    const french = await app.views.platform.translations(anon.request, 'fr');

    expect(french.status).toBe(200);
    expect(Object.keys(french.body ?? {}).length).toBeGreaterThan(0);
    for (const other of ['en', 'de', 'es']) {
      expect((await app.views.platform.translations(anon.request, other)).status).toBe(404);
    }
  });

  test('the account page offers no language selection', { tag: ['@NAV-LNG-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const page = await app.views.platform.accountLanguage(member.request);

    expect(page.status).toBe(200);
    expect(page.offersLanguageChoice).toBe(false);
    expect(page.language).toBe('fr');
  });

  test('asking for another language through the address does not change the stored language of the user (DECISION UND-118)', { tag: ['@NAV-LNG-003'] }, async ({ app, as }) => {
    deviation('UND-118');
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const before = (await queryOne<{ lang: string | null }>('SELECT lang FROM User WHERE id = ?', [s.users.member.id]))?.lang;

    const page = await app.views.platform.accountLanguage(member.request, 'en');

    // the page itself stays French: only the stored choice of the user is rewritten (Account.hx:46-51)
    expect(page.language).toBe('fr');
    expect((await queryOne<{ lang: string | null }>('SELECT lang FROM User WHERE id = ?', [s.users.member.id]))?.lang).toBe(before);
  });

  test('the password reset email is in French', { tag: ['@NAV-LNG-004'] }, async ({ app, anon, mails }) => {
    const u = await make.user({ email: 'oublie@camap.test' });
    const mark = await mails.mark();

    await app.actions.account.forgotPassword(anon.request, u.email);

    const [mail] = await mails.to(u.email, mark);
    expect(mail.title).toBe('CAMAP : Changement de mot de passe');
    expect(mail.htmlBody).toMatch(/mot de passe/i);
  });

  const NEO: ImportedPerson = { firstName: 'Neo', lastName: 'Nouveau', email: 'neo@camap.test' };

  test('the invitation email sent by the platform is in French', { tag: ['@NAV-LNG-004'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.invite(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

    expect(res.errors).toBeNull();
    const [mail] = await mails.to(NEO.email, mark);
    expect(mail.title).toMatch(/^Invitation à rejoindre un groupe/);
  });

  test('the editor of the group settings form is in French', { tag: ['@NAV-LNG-005', '@NAV-THM-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    await app.actions.group.select(admin.request, s.group.id);

    const page = await app.views.groupAdmin.settingsEditor(admin.request);

    expect(page.status).toBe(200);
    expect(page.editor).toEqual({ language: 'fr' });
  });
});

test.describe('theme on the pages', () => {
  test('the default theme gives its name, logo and support contact to every page', { tag: ['@NAV-THM-001'] }, async ({ app, anon }) => {
    const page = await app.views.platform.layout(anon.request, 'login');

    expect(page.title).toBe('CAMAP');
    expect(page.theme).toEqual({ id: 'default', name: 'CAMAP', supportEmail: expect.stringMatching(/@/) });
    expect(page.footer!.images).toContain('/theme/default/logo.png');
    expect(page.footer!.text).toMatch(/Support/);
  });

  test('a saved theme gives its own name, logo and support contact to the pages, visitor or member', { tag: ['@NAV-THM-001', '@NAV-THM-002'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const member = await as(s.users.member);
    await saveTheme(app, admin.request, savedTheme);

    for (const [who, page] of [
      [anon, 'login'],
      [member, 'chooser'],
    ] as const) {
      const layout = await app.views.platform.layout(who.request, page);

      expect(layout.status).toBe(200);
      expect(layout.title).toBe('Plateforme Test');
      expect(layout.theme).toEqual({ id: 'test-theme', name: 'Plateforme Test', supportEmail: 'aide@plateforme.test' });
      expect(layout.footer!.images).toEqual([LOGO]);
      expect(layout.footer!.text).toContain('Contact : aide@plateforme.test');
      expect(layout.footer!.text).toContain('Dernier bloc');
    }
  });

  test('a theme without footer shows no footer', { tag: ['@NAV-THM-001'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const { footer, ...withoutFooter } = savedTheme;
    await saveTheme(app, admin.request, withoutFooter);

    const layout = await app.views.platform.layout(anon.request, 'login');

    expect(layout.theme?.name).toBe('Plateforme Test');
    expect(layout.footer).toBeNull();
  });

  test('the emails sent by the platform carry the footer of the saved theme (DECISION UND-101)', { tag: ['@NAV-THM-002'] }, async ({ app, as, mails }) => {
    deviation('UND-101');
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const original = (await app.views.admin.themeSettings(admin.request)).settings!;
    await saveTheme(app, admin.request, savedTheme);
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();
    try {
      const res = await app.api.members.invite(mm.request, {
        groupId: s.group.id,
        withAccounts: [],
        withoutAccounts: [{ firstName: 'Neo', lastName: 'Nouveau', email: 'neo@camap.test' }],
      });

      expect(res.errors).toBeNull();
      const [mail] = await mails.to('neo@camap.test', mark);
      expect(mail.htmlBody).toContain('Pied de mail de la plateforme test');
    } finally {
      // the TS side caches the theme: put the original back through the same save
      await app.actions.admin.setTheme(admin.request, original);
    }
  });

  test('the terms of service link of the platform comes from the saved theme', { tag: ['@NAV-THM-003'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await saveTheme(app, admin.request, savedTheme);

    const tos = await app.views.platform.termsOfService(anon.request);

    expect(tos.status).toBe(302);
    expect(tos.location).toBe('https://example.test/cgu');
  });

  test('the pages load the interactive widget bundles at their end', { tag: ['@NAV-THM-008'] }, async ({ app, anon }) => {
    const page = await app.views.platform.layout(anon.request, 'login');

    expect(page.widgetBundles.length).toBeGreaterThan(0);
  });
});
