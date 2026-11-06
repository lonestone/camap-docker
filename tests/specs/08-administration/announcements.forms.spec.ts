/**
 * Platform announcements (specs/08-administration/announcements.md; controller/admin/Admin.hx
 * doMessages, doAttention, doAttentionAdmins; controller/Main.hx doHome; user/choose.mtt).
 *
 * Three platform messages are kept as variables: `attMessage` (flash for every member, "group message"),
 * `attMessageAdmins` + `attMessageAdminsAlert` (flash for members holding rights, red when alert) and
 * `homeMessage` (raw HTML box on the group chooser page).
 */
import { test, expect } from '../../src/fixtures.js';
import { query, execute } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const variable = async (name: string) => (await query<{ value: string }>('SELECT value FROM Variable WHERE name = ?', [name]))[0]?.value ?? null;
const setVariable = (name: string, value: string) => execute('REPLACE INTO Variable (name, value) VALUES (?, ?)', [name, value]);

test.describe('the message for every member (attMessage)', () => {
  test('a superadmin posts it and lands on the back-office home', { tag: ['@ADM-ANN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.setMessage(admin.request, 'groupMessage', 'Maintenance samedi soir');

    expect(res.status).toBe(302);
    expect(res.location).toMatch(/\/admin\/?$/);
    expect(res.flash).toEqual({ kind: 'ok', text: 'Message Groupe mis à jour' });
    expect(await variable('attMessage')).toBe('Maintenance samedi soir');
  });

  test('the edit page offers the message saved so far', { tag: ['@ADM-ANN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await setVariable('attMessage', 'Déjà là');

    const page = await app.views.admin.messageSettings(admin.request, 'groupMessage');

    expect(page.status).toBe(200);
    expect(page.value).toBe('Déjà là');
  });

  test('a member of a group sees it as a flash message on the group home page', { tag: ['@ADM-ANN-001', '@ADM-ANN-004', '@NAV-HOM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setVariable('attMessage', 'Maintenance samedi soir');
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeAlerts(member.request);

    expect(home.status).toBe(200);
    expect(home.alerts).toEqual([{ kind: 'ok', text: 'Maintenance samedi soir' }]);
  });

  test('it is shown to the members of every group', { tag: ['@ADM-ANN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.nonMember, group: other });
    await setVariable('attMessage', 'Pour tous');
    const outsider = await as(s.users.nonMember);
    await app.actions.group.select(outsider.request, other.id);

    const home = await app.views.groups.homeAlerts(outsider.request);

    expect(home.alerts.map((a) => a.text)).toEqual(['Pour tous']);
  });

  test('it is added to the page again on every visit', { tag: ['@ADM-ANN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setVariable('attMessage', 'Toujours là');
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const first = await app.views.groups.homeAlerts(member.request);
    const second = await app.views.groups.homeAlerts(member.request);

    expect(first.alerts.map((a) => a.text)).toEqual(['Toujours là']);
    expect(second.alerts.map((a) => a.text)).toEqual(['Toujours là']);
  });

  test('an empty message shows nothing', { tag: ['@ADM-ANN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await app.actions.admin.setMessage(admin.request, 'groupMessage', 'À retirer');

    const res = await app.actions.admin.setMessage(admin.request, 'groupMessage', '');

    expect(res.flash?.kind).toBe('ok');
    // hx saves the text "null" for an empty field; the home page ignores it
    expect(['', 'null']).toContain(await variable('attMessage'));
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);
    expect((await app.views.groups.homeAlerts(member.request)).alerts).toEqual([]);
  });

  test('a message never set shows nothing', { tag: ['@ADM-ANN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    expect((await app.views.groups.homeAlerts(member.request)).alerts).toEqual([]);
  });

  test('only a superadmin can post it', { tag: ['@ADM-ANN-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const refused = [await as(s.users.groupAdmin), await as(s.users.member), await as('anon')];

    for (const who of refused) {
      const res = await app.actions.admin.setMessage(who.request, 'groupMessage', 'Pirate');
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
    }
    expect(await variable('attMessage')).toBeNull();
  });
});

test.describe('the message for the members holding rights (attMessageAdmins)', () => {
  test('a superadmin posts it, as a plain message or as an alert', { tag: ['@ADM-ANN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const plain = await app.actions.admin.setMessage(admin.request, 'groupAdminMessage', 'Pour les admins');
    expect(plain.flash).toEqual({ kind: 'ok', text: 'Message Admins Groupes mis à jour' });
    expect(await variable('attMessageAdmins')).toBe('Pour les admins');
    expect(await variable('attMessageAdminsAlert')).not.toBe('true');

    await app.actions.admin.setMessage(admin.request, 'groupAdminMessage', 'Urgent', true);
    expect(await variable('attMessageAdmins')).toBe('Urgent');
    expect(await variable('attMessageAdminsAlert')).toBe('true');
  });

  test('the edit page offers the saved message and the alert box as it was left', { tag: ['@ADM-ANN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await app.actions.admin.setMessage(admin.request, 'groupAdminMessage', 'Urgent', true);

    const on = await app.views.admin.messageSettings(admin.request, 'groupAdminMessage');
    await app.actions.admin.setMessage(admin.request, 'groupAdminMessage', 'Calme', false);
    const off = await app.views.admin.messageSettings(admin.request, 'groupAdminMessage');

    expect(on).toMatchObject({ value: 'Urgent', alert: true });
    expect(off).toMatchObject({ value: 'Calme', alert: false });
  });

  test('a group admin sees it on the group home page, a plain member does not', { tag: ['@ADM-ANN-002', '@NAV-HOM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setVariable('attMessageAdmins', 'Pour les admins');
    const ga = await as(s.users.groupAdmin);
    const member = await as(s.users.member);
    await app.actions.group.select(ga.request, s.group.id);
    await app.actions.group.select(member.request, s.group.id);

    const forAdmin = await app.views.groups.homeAlerts(ga.request);
    const forMember = await app.views.groups.homeAlerts(member.request);

    expect(forAdmin.alerts).toEqual([{ kind: 'ok', text: 'Pour les admins' }]);
    expect(forMember.alerts).toEqual([]);
  });

  test('every member holding some right sees it, not only the group admin', { tag: ['@ADM-ANN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setVariable('attMessageAdmins', 'Pour ceux qui ont des droits');

    for (const who of ['coordinator', 'membershipManager', 'messagesManager'] as const) {
      const u = await as(s.users[who]);
      await app.actions.group.select(u.request, s.group.id);
      const home = await app.views.groups.homeAlerts(u.request);
      expect(home.alerts.map((a) => a.text), who).toEqual(['Pour ceux qui ont des droits']);
    }
  });

  test('flagged as an alert, it is shown as an error (red) message', { tag: ['@ADM-ANN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setVariable('attMessageAdmins', 'Panne du paiement');
    await setVariable('attMessageAdminsAlert', 'true');
    const ga = await as(s.users.groupAdmin);
    await app.actions.group.select(ga.request, s.group.id);

    const home = await app.views.groups.homeAlerts(ga.request);

    expect(home.alerts).toEqual([{ kind: 'error', text: 'Panne du paiement' }]);
  });

  test('a superadmin who is a member of the group sees it too', { tag: ['@ADM-ANN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.superadmin, group: s.group });
    await setVariable('attMessageAdmins', 'Pour les admins');
    const admin = await as(s.users.superadmin);
    await app.actions.group.select(admin.request, s.group.id);

    expect((await app.views.groups.homeAlerts(admin.request)).alerts.map((a) => a.text)).toEqual(['Pour les admins']);
  });

  test('an admin message and the message for everyone are both shown, the admin one first', { tag: ['@ADM-ANN-002', '@ADM-ANN-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setVariable('attMessageAdmins', 'Pour les admins');
    await setVariable('attMessage', 'Pour tous');
    const ga = await as(s.users.groupAdmin);
    await app.actions.group.select(ga.request, s.group.id);

    const home = await app.views.groups.homeAlerts(ga.request);

    expect(home.alerts.map((a) => a.text)).toEqual(['Pour les admins', 'Pour tous']);
  });

  test('only a superadmin can post it', { tag: ['@ADM-ANN-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const ga = await as(s.users.groupAdmin);

    const res = await app.actions.admin.setMessage(ga.request, 'groupAdminMessage', 'Pirate', true);

    expect(res.location).toBe('/');
    expect(await variable('attMessageAdmins')).toBeNull();
  });
});

test.describe('the message on the group chooser page (homeMessage)', () => {
  test('a superadmin posts it', { tag: ['@ADM-ANN-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.setMessage(admin.request, 'homeMessage', '<b>Bienvenue</b>');

    expect(res.location).toMatch(/\/admin\/?$/);
    expect(res.flash).toEqual({ kind: 'ok', text: 'Message Général mis à jour' });
    expect(await variable('homeMessage')).toBe('<b>Bienvenue</b>');
    expect((await app.views.admin.messageSettings(admin.request, 'homeMessage')).value).toBe('<b>Bienvenue</b>');
  });

  test('the chooser page shows it as raw HTML', { tag: ['@ADM-ANN-003', '@NAV-SEL-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await setVariable('homeMessage', '<b>Bienvenue</b> sur <a href="https://exemple.org/">le site</a>');
    const member = await as(s.users.member);

    const page = await app.views.groups.chooser(member.request);

    expect(page.status).toBe(200);
    expect(page.messageHtml).toBe('<b>Bienvenue</b> sur <a href="https://exemple.org/">le site</a>');
  });

  test('without a message the chooser page has no message box', { tag: ['@ADM-ANN-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const before = await app.views.groups.chooser(member.request);
    await setVariable('homeMessage', '');
    const after = await app.views.groups.chooser(member.request);

    expect(before.messageHtml).toBeNull();
    expect(after.messageHtml).toBeNull();
  });

  test('only a superadmin can post it', { tag: ['@ADM-ANN-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const ga = await as(s.users.groupAdmin);

    const res = await app.actions.admin.setMessage(ga.request, 'homeMessage', '<script>x</script>');

    expect(res.location).toBe('/');
    expect(await variable('homeMessage')).toBeNull();
  });
});
