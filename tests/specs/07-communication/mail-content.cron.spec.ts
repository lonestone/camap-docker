/**
 * What the queued emails look like: layout, branding, language, sender
 * (specs/07-communication/emails.md, automatic-emails.md, order-notifications.md). Read from the mail
 * queue, as hx and Nest write it; what actually leaves over SMTP is in mail-delivery.cron.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { execute, query } from '../../src/db/client.js';
import { addDaysWall, atWallTime, wallClock } from '../../src/encodings/dates.js';
import { GroupFlag, UserFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst } from '../../src/flows.js';
import type { NewMessage } from '../../src/targets/types.js';

const HOUR = 3_600_000;

/** Sessions have not started yet at the clock's now: opening notifications fire inside the opening hour. */
async function openingNotification(s: make.AmapScenario, clock: { set(d: Date): unknown }, cron: { run(j: 'hour'): Promise<unknown> }, mails: { mark(): Promise<number>; to(e: string, m: number): Promise<any[]> }, user: { email: string }) {
  clock.set(new Date(s.multiDistribs[0].orderStartDate.getTime() + 20 * 60_000));
  const mark = await mails.mark();
  await cron.run('hour');
  return mails.to(user.email, mark);
}

test.describe('layout of the emails', () => {
  test('a platform email uses the platform layout, a group email the group layout', { tag: ['@COM-EML-009'] }, async ({ app, anon, clock, cron, mails }) => {
    const s = await make.amapScenario();
    await execute('UPDATE User SET flags = ? WHERE id = ?', [flags(UserFlag, 'HasEmailNotifOuverture'), s.users.member.id]);
    const mark = await mails.mark();
    await app.actions.account.forgotPassword(anon.request, s.users.member2.email);
    const platform = (await mails.to(s.users.member2.email, mark))[0];

    const group = (await openingNotification(s, clock, cron, mails, s.users.member))[0];

    expect(platform.htmlBody).toContain('/theme/default/logo2.png'); // platform header
    expect(platform.htmlBody).not.toContain('faites partie de');
    expect(group.htmlBody).toContain(`<b>${s.group.name}</b>`); // group name in the header
    expect(group.htmlBody).toContain('/theme/default/logo3.png'); // platform logo in the footer
    expect(group.htmlBody).toMatch(/Vous recevez ce message car vous faites partie de/);
    expect(group.htmlBody).toContain(`/group/${s.group.id}`); // the group button
  });

  test('a message written in the group messages tool carries the group layout', { tag: ['@COM-EML-009'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.messagesManager);
    const mark = await mails.mark();
    const input: NewMessage = {
      title: 'Bonjour',
      htmlBody: '<p>Texte du message</p>',
      senderName: 'Max Messages',
      senderEmail: 'messages@camap.test',
      recipients: [{ email: s.users.member.email, id: s.users.member.id }],
      group: { id: s.group.id, name: s.group.name },
    };

    const res = await app.api.messages.create(mm.request, input);

    expect(res.errors).toBeNull();
    const [sent] = await mails.since(mark);
    expect(sent.htmlBody).toContain('Texte du message');
    expect(sent.htmlBody).toContain(s.group.name);
    expect(sent.htmlBody).toMatch(/Vous recevez ce message car vous faites partie de/);
    expect(sent.htmlBody).toContain('/theme/default/logo3.png');
  });
});

test.describe('branding of the emails', () => {
  async function savedTheme(app: any, as: any, s: make.AmapScenario, patch: (t: any) => void) {
    const admin = await as(s.users.superadmin);
    const theme = JSON.parse((await app.views.admin.themeSettings(admin.request)).settings!);
    patch(theme);
    await app.actions.admin.setTheme(admin.request, JSON.stringify(theme));
    await app.actions.admin.reloadTheme(admin.request);
  }

  test('without a saved theme, emails use the default theme', { tag: ['@COM-EML-008'] }, async ({ app, anon, mails }) => {
    const s = await make.amapScenario();
    const mark = await mails.mark();

    await app.actions.account.forgotPassword(anon.request, s.users.member.email);

    const [sent] = await mails.to(s.users.member.email, mark);
    expect(sent.sender).toMatchObject({ name: 'CAMAP', email: 'noreply@camap.amap44.org' });
    expect(sent.htmlBody).toContain('/theme/default/logo2.png');
    expect(sent.htmlBody).toContain('alt="logo CAMAP"');
  });

  test('a saved theme that cannot be read is replaced by the default theme in emails', { tag: ['@COM-EML-008'] }, async ({ app, as, anon, mails }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    await execute("REPLACE INTO Variable (name, value) VALUES ('whiteLabel', 'ceci n''est pas du JSON{')");
    await app.actions.admin.reloadTheme(admin.request);
    const mark = await mails.mark();

    await app.actions.account.forgotPassword(anon.request, s.users.member.email);

    const [sent] = await mails.to(s.users.member.email, mark);
    expect(sent.sender).toMatchObject({ name: 'CAMAP', email: 'noreply@camap.amap44.org' });
    expect(sent.htmlBody).toContain('alt="logo CAMAP"');
  });

  test('emails written by the hx side carry the saved white-label theme', { tag: ['@COM-EML-008'] }, async ({ app, as, anon, mails }) => {
    const s = await make.amapScenario();
    await savedTheme(app, as, s, (t) => {
      t.name = 'Plateforme Test';
      t.email.senderEmail = 'noreply@plateforme.test';
    });
    const mark = await mails.mark();

    await app.actions.account.forgotPassword(anon.request, s.users.member.email);

    const [sent] = await mails.to(s.users.member.email, mark);
    expect(sent.sender).toMatchObject({ name: 'Plateforme Test', email: 'noreply@plateforme.test' });
    expect(sent.htmlBody).toContain('alt="logo Plateforme Test"');
  });

  test('emails written by the TS side carry the saved white-label theme (DECISION UND-101)', { tag: ['@COM-EML-008'] }, async ({ app, as, mails }) => {
    deviation('UND-101');
    const s = await make.amapScenario();
    await savedTheme(app, as, s, (t) => {
      t.name = 'Plateforme Test';
    });
    const mm = await as(s.users.messagesManager);
    const mark = await mails.mark();
    const input: NewMessage = {
      title: 'Bonjour',
      htmlBody: '<p>Texte</p>',
      senderName: 'Max Messages',
      senderEmail: 'messages@camap.test',
      recipients: [{ email: s.users.member.email, id: s.users.member.id }],
      group: { id: s.group.id, name: s.group.name },
    };

    await app.api.messages.create(mm.request, input);

    const [sent] = await mails.since(mark);
    expect(sent.htmlBody).toContain('<title>Plateforme Test</title>');
  });
});

test.describe('language of the emails', () => {
  test('a visitor asking for a password reset gets a French email', { tag: ['@COM-EML-010'] }, async ({ app, anon, mails }) => {
    const s = await make.amapScenario();
    const mark = await mails.mark();

    await app.actions.account.forgotPassword(anon.request, s.users.member.email);

    const [sent] = await mails.to(s.users.member.email, mark);
    expect(sent.title).toBe('CAMAP : Changement de mot de passe');
    expect(sent.htmlBody).toContain('Vous avez demandé à changer votre mot de passe');
  });

  test('a member whose stored language is English gets the volunteer alert and the reset in French', { tag: ['@COM-EML-010', '@COM-NTF-006'] }, async ({ app, anon, clock, cron, mails }) => {
    // UND-104 / UND-118: the volunteer alert subject and its date are hard-coded in French, and so is the rest
    const g = await make.group({ flags: flags(GroupFlag, 'AllowAlertNotifs'), vacantVolunteerRolesMailDaysBeforeDutyPeriod: 7 });
    const pl = await make.place({ group: g });
    const role = await make.volunteerRole({ group: g, name: 'Accueil' });
    const md = await make.multiDistrib({ group: g, place: pl, volunteerRoles: [role] });
    const english = await make.user({ lang: 'en', email: 'english@camap.test' });
    await make.userGroup({ user: english, group: g });
    const h = wallClock(md.distribStartDate).h;
    clock.set(atWallTime(addDaysWall(md.distribStartDate, -7), h, 15));
    const mark = await mails.mark();

    expect((await cron.run('hour')).status).toBe(200);
    await app.actions.account.forgotPassword(anon.request, english.email);

    const sent = await mails.to(english.email, mark);
    const alert = sent.find((m) => /volontaires/.test(m.title))!;
    expect(alert.title).toMatch(/^Besoin de volontaires pour la distribution du /);
    const reset = sent.find((m) => /mot de passe/.test(m.title))!;
    expect(reset.htmlBody).toContain('Vous avez demandé à changer votre mot de passe');
  });

  test('a distribution reminder follows the stored language of the member: English subject (UND-104, characterised)', { tag: ['@COM-NTF-006'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await make.amapScenario();
    const english = await make.user({ lang: 'en', email: 'english2@camap.test', flags: flags(UserFlag, 'HasEmailNotif24h') });
    await make.userGroup({ user: english, group: s.group });
    const e = await as(english);
    await subscribeConst(app, e.request, s, english.id);
    clock.set(new Date(s.multiDistribs[0].distribStartDate.getTime() - 23.5 * HOUR));
    const mark = await mails.mark();

    await cron.run('hour');

    const sent = (await mails.to(english.email, mark)).filter((m) => /distribution/i.test(m.title));
    expect(sent).toHaveLength(1);
    // finding: the reminder switches to the member's language (the date stays French), the volunteer alert does not
    expect(sent[0].title).toMatch(/^Distribution on /);
  });
});

test.describe('sender of group emails', () => {
  test('the hx side stores the group contact as the sender, with the group name', { tag: ['@COM-EML-007'] }, async ({ clock, cron, mails }) => {
    // UND-100: what is shown to the recipient is decided in mail-delivery.cron.spec.ts
    const s = await make.amapScenario();
    await execute('UPDATE User SET flags = ? WHERE id = ?', [flags(UserFlag, 'HasEmailNotifOuverture'), s.users.member.id]);

    const [sent] = await openingNotification(s, clock, cron, mails, s.users.member);

    expect(sent.sender).toMatchObject({ name: s.group.name, email: s.users.groupAdmin.email });
  });

  test('a group without a contact falls back to the platform sender address', { tag: ['@COM-EML-007'] }, async ({ clock, cron, mails }) => {
    const s = await make.amapScenario();
    await execute('UPDATE `Group` SET userId = NULL WHERE id = ?', [s.group.id]);
    await execute('UPDATE User SET flags = ? WHERE id = ?', [flags(UserFlag, 'HasEmailNotifOuverture'), s.users.member.id]);

    const [sent] = await openingNotification(s, clock, cron, mails, s.users.member);

    expect(sent.sender).toMatchObject({ name: s.group.name, email: 'noreply@camap.amap44.org' });
  });
});

test.describe('emails no code sends (UND-106, characterised)', () => {
  test('no email asks the coordinator or the vendor to validate a distribution that took place', { tag: ['@COM-AUT-003'] }, async ({ clock, cron, mails }) => {
    const s = await make.amapScenario();
    const mark = await mails.mark();
    for (const days of [1, 15, 30]) {
      clock.set(new Date(s.multiDistribs[0].distribEndDate.getTime() + days * 24 * HOUR));
      await cron.run('hour');
      await cron.run('daily');
    }

    const sent = await mails.since(mark);
    const text = sent.map((m) => `${m.title} ${m.htmlBody}`).join('\n');
    expect(text).not.toMatch(/n'oubliez pas de la\s*<b>valider|valider votre distribution|créneaux horaires ont été attribués/);
    expect(sent.filter((m) => m.to.includes(s.users.coordinator.email) || m.to.includes('ferme@camap.test'))).toEqual([]);
  });

  test('no email about the invitation or certification of a vendor is sent', { tag: ['@COM-AUT-004'] }, async ({ clock, cron, mails }) => {
    const s = await make.amapScenario();
    const mark = await mails.mark();
    clock.set(new Date(s.multiDistribs[0].distribEndDate.getTime() + 24 * HOUR));
    await cron.run('hour');
    await cron.run('daily');

    const sent = await mails.since(mark);
    const text = sent.map((m) => `${m.title} ${m.htmlBody}`).join('\n');
    expect(text).not.toMatch(/ouvrir votre compte producteur|Charte producteurs|suspectés de triche|Votre compte producteur/);
    expect(await query('SELECT id FROM BufferedJsonMail WHERE title LIKE ?', ['%producteur%'])).toEqual([]);
  });
});
