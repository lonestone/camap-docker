/**
 * Pages of the account area that only display (specs/01-accounts/impersonation.md, notifications.md,
 * profile.md; camap-hx controller/Member.hx doView, controller/Account.hx doDefault, controller/Main.hx doGroup).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { queryOne } from '../../src/db/client.js';
import { GroupFlag, UserFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';

test.describe('the "log in as" button of the member sheet', () => {
  test('a group admin gets it for a member of exactly one group, not for a member of several', { tag: ['@ACC-IMP-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member2, group: other });
    const ga = await as(s.users.groupAdmin);
    await app.actions.group.select(ga.request, s.group.id);

    expect((await app.views.member.sheet(ga.request, s.users.member.id)).offers.loginAs).toBe(true);
    expect((await app.views.member.sheet(ga.request, s.users.member2.id)).offers.loginAs).toBe(false);
  });

  test('a superadmin gets it on every sheet', { tag: ['@ACC-IMP-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member2, group: other });
    const admin = await as(s.users.superadmin);
    await app.actions.group.select(admin.request, s.group.id);

    expect((await app.views.member.sheet(admin.request, s.users.member.id)).offers.loginAs).toBe(true);
    expect((await app.views.member.sheet(admin.request, s.users.member2.id)).offers.loginAs).toBe(true);
  });
});

test.describe('the notifications a member has enabled', () => {
  test('a membership manager sees them on the sheet of the member, as a display only', { tag: ['@ACC-NOT-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await make.user({ flags: flags(UserFlag, 'HasEmailNotif4h', 'HasEmailNotifOuverture') });
    await make.userGroup({ user: member, group: s.group });
    const mm = await as(s.users.membershipManager);
    await app.actions.group.select(mm.request, s.group.id);

    const sheet = await app.views.member.sheet(mm.request, member.id);

    expect(sheet.status).toBe(200);
    expect(sheet.notifications).toHaveLength(3);
    const active = sheet.notifications.filter((n) => n.active).map((n) => n.name);
    expect(active).toHaveLength(2);
    expect(active.join(' ')).toMatch(/4h/);
    expect(active.join(' ')).not.toMatch(/24h/);
    // displaying them changes nothing
    expect((await queryOne<{ flags: number }>('SELECT flags FROM User WHERE id = ?', [member.id]))!.flags).toBe(flags(UserFlag, 'HasEmailNotif4h', 'HasEmailNotifOuverture'));
  });
});

test.describe('the account page', () => {
  test('it offers no language selection', { tag: ['@ACC-PRO-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const page = await app.views.platform.accountLanguage(member.request);

    expect(page.status).toBe(200);
    expect(page.offersLanguageChoice).toBe(false);
    expect(page.language).toBe('fr');
  });

  test('asking for another language through the address does not change the stored language (DECISION UND-118)', { tag: ['@ACC-PRO-006'] }, async ({ app, as }) => {
    deviation('UND-118');
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const before = (await queryOne<{ lang: string | null }>('SELECT lang FROM User WHERE id = ?', [s.users.member.id]))?.lang;

    await app.views.platform.accountLanguage(member.request, 'en');

    expect((await queryOne<{ lang: string | null }>('SELECT lang FROM User WHERE id = ?', [s.users.member.id]))?.lang).toBe(before);
  });
});

test.describe('reminder to give a phone number or an address', () => {
  const PHONE = /Les membres de ce groupe doivent fournir un numéro de téléphone/;
  const ADDRESS = /Les membres de ce groupe doivent fournir leur adresse/;

  test('the home page reminds a member of a group that requires them, until they are given', { tag: ['@ACC-PRO-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { flags: flags(GroupFlag, 'PhoneRequired', 'AddressRequired') } });
    const member = await as(s.users.member);
    await app.actions.group.select(member.request, s.group.id);

    const home = await app.views.groups.homeAlerts(member.request);
    expect(home.alerts.map((a) => a.text)).toEqual([expect.stringMatching(PHONE), expect.stringMatching(ADDRESS)]);

    await app.api.users.updateContact(member.request, { phone: '0612345678', city: 'Nantes', zipCode: '44000', address1: '1 rue du Test' });
    expect((await app.views.groups.homeAlerts(member.request)).alerts).toEqual([]);
  });
});
