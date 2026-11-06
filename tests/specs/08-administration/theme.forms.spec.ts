/**
 * Platform theme (specs/08-administration/theme.md; controller/admin/Admin.hx doTheme and doDefault,
 * App.hx setTheme). The theme is the JSON block kept in the `whiteLabel` variable.
 *
 * In this test stack Neko re-reads the theme on every request, so "the change shows after the reload"
 * (ADM-THM-002) cannot be told apart from "the change shows at once": only the result is asserted.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, execute } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import type { ImportedPerson } from '../../src/targets/types.js';

const NEO: ImportedPerson = { firstName: 'Neo', lastName: 'Nouveau', email: 'neo@camap.test' };

const stored = async () => (await query<{ value: string }>("SELECT value FROM Variable WHERE name = 'whiteLabel'"))[0]?.value ?? null;
const instanceName = (text: string) => /Nom de l'instance (.*?) ID du th/.exec(text)?.[1] ?? null;

test.describe('editing the theme', () => {
  test('the edit page offers the current theme as a readable block, the default one when none is saved', { tag: ['@ADM-THM-001', '@ADM-THM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    expect(await stored()).toBeNull();

    const page = await app.views.admin.themeSettings(admin.request);

    expect(page.status).toBe(200);
    const theme = JSON.parse(page.settings!);
    expect(theme).toMatchObject({ id: 'default', name: 'CAMAP' });
    expect(theme.email.senderEmail).toEqual(expect.any(String));
  });

  test('a valid block is saved and the superadmin returns to the back-office home', { tag: ['@ADM-THM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const theme = JSON.parse((await app.views.admin.themeSettings(admin.request)).settings!);
    theme.name = 'Plateforme Test';

    const res = await app.actions.admin.setTheme(admin.request, JSON.stringify(theme, null, 2));

    expect(res.status).toBe(302);
    expect(res.location).toMatch(/\/admin\/?$/);
    expect(res.flash).toEqual({ kind: 'ok', text: 'Thème mis à jour' });
    expect(JSON.parse((await stored())!)).toMatchObject({ id: 'default', name: 'Plateforme Test' });
    // the edit page now offers the saved block
    expect(JSON.parse((await app.views.admin.themeSettings(admin.request)).settings!).name).toBe('Plateforme Test');
  });

  test('a block that is not valid JSON is refused with an error message and nothing is saved', { tag: ['@ADM-THM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    for (const bad of ['{"name": "Sans fin"', 'pas du JSON']) {
      const res = await app.actions.admin.setTheme(admin.request, bad);

      expect(res.status).toBe(302);
      expect(res.location).toBe('/admin/theme');
      expect(res.flash?.kind).toBe('error');
      expect(res.flash?.text).toMatch(/^Erreur :/);
    }
    expect(await stored()).toBeNull();
  });

  test('an empty block is not accepted by the form either', { tag: ['@ADM-THM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.setTheme(admin.request, '');

    // the field is required: the form is shown again, nothing is saved
    expect(res.status).toBe(200);
    expect(await stored()).toBeNull();
  });

  test('a block that is valid JSON but not a theme is saved all the same: the literal null breaks every page', { tag: ['@ADM-THM-001'] }, async ({ app, as, errors }) => {
    // Characterised as it is today (finding): only the syntax is checked, not the shape.
    errors.expect(/.*/);
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.setTheme(admin.request, 'null');

    expect(res.location).toMatch(/\/admin\/?$/);
    expect(await stored()).toBe('null');
    const page = await app.views.admin.dashboard(admin.request);
    expect(page.text).toMatch(/Invalid field access/);
    expect(page.text).not.toContain("Console d'administration");
  });

  test('only a superadmin can edit the theme', { tag: ['@ADM-THM-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const refused = [await as(s.users.groupAdmin), await as(s.users.member), await as('anon')];

    for (const who of refused) {
      const res = await app.actions.admin.setTheme(who.request, '{"name":"Pirate"}');
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
    }
    expect(await stored()).toBeNull();
  });
});

test.describe('the saved theme on the pages', () => {
  test('after the settings reload, the back-office home shows the saved theme', { tag: ['@ADM-THM-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const before = await app.views.admin.dashboard(admin.request);
    const theme = JSON.parse((await app.views.admin.themeSettings(admin.request)).settings!);
    theme.name = 'Plateforme Test';
    theme.id = 'test-theme';
    await app.actions.admin.setTheme(admin.request, JSON.stringify(theme));

    await app.actions.admin.reloadTheme(admin.request);
    const after = await app.views.admin.dashboard(admin.request);

    expect(instanceName(before.text)).toBe('CAMAP');
    expect(instanceName(after.text)).toBe('Plateforme Test');
    expect(after.text).toMatch(/ID du thème courant test-theme/);
  });

  test('a member sees the saved theme name on the pages', { tag: ['@ADM-THM-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const theme = JSON.parse((await app.views.admin.themeSettings(admin.request)).settings!);
    theme.name = 'Plateforme Test';
    await app.actions.admin.setTheme(admin.request, JSON.stringify(theme));
    await app.actions.admin.reloadTheme(admin.request);
    const member = await as(s.users.member);

    const chooser = await app.views.groups.chooser(member.request);

    expect(chooser.text).toContain('groupes Plateforme Test');
  });

  test('emails sent after the theme was saved carry its name (DECISION UND-101)', { tag: ['@ADM-THM-003', '@ADM-THM-001'] }, async ({ app, as, mails }) => {
    deviation('UND-101');
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const original = (await app.views.admin.themeSettings(admin.request)).settings!;
    const theme = JSON.parse(original);
    theme.name = 'Plateforme Test';
    await app.actions.admin.setTheme(admin.request, JSON.stringify(theme));
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();
    try {
      const res = await app.api.members.invite(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

      expect(res.errors).toBeNull();
      const sent = await mails.to(NEO.email, mark);
      expect(sent).toHaveLength(1);
      expect(sent[0].title).toBe('Invitation à rejoindre un groupe Plateforme Test');
    } finally {
      // the TS side caches the theme: put the original back through the same save
      await app.actions.admin.setTheme(admin.request, original);
    }
  });
});

test.describe('the default theme', () => {
  test('without a saved theme the platform shows the default theme', { tag: ['@ADM-THM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const home = await app.views.admin.dashboard(admin.request);

    expect(await stored()).toBeNull();
    expect(instanceName(home.text)).toBe('CAMAP');
    expect(home.text).toMatch(/ID du thème courant default/);
  });

  test('a saved theme that cannot be read is replaced by the default theme', { tag: ['@ADM-THM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await execute("REPLACE INTO Variable (name, value) VALUES ('whiteLabel', 'ceci n''est pas du JSON{')");

    await app.actions.admin.reloadTheme(admin.request);
    const home = await app.views.admin.dashboard(admin.request);

    expect(home.status).toBe(200);
    expect(instanceName(home.text)).toBe('CAMAP');
    expect(home.text).toMatch(/ID du thème courant default/);
  });
});
