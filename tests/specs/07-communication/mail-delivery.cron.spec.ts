/**
 * Sending the queued emails (specs/07-communication/emails.md COM-EML-001 to 008, 010). Nest flushes
 * BufferedJsonMail to SMTP every minute, on real time (the fake clock does not reach it), so every test
 * here waits for the next flush: up to a minute, hence test.slow(). What arrives is read from the test
 * mailpit; the queue rows are seeded or written by hx and read back in the DB.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { mailpit, type DeliveredMail } from '../../src/mailpit.js';

const DAY = 86_400_000;
const FLUSH_TIMEOUT = 100_000;

/** Wait for a DB condition on the queue (the flush works in one transaction: what we see is committed). */
async function waitForQueue<T>(read: () => Promise<T>, done: (v: T) => boolean, timeoutMs = FLUSH_TIMEOUT): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await read();
    if (done(v)) return v;
    if (Date.now() > deadline) throw new Error(`the mail queue did not reach the expected state in time: ${JSON.stringify(v)}`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

const rows = (where = '1=1', params: unknown[] = []) =>
  query<{ id: number; title: string; tries: number; sdate: string | null; rawStatus: string | null; recipients: string }>(
    `SELECT id, title, tries, sdate, rawStatus, recipients FROM BufferedJsonMail WHERE ${where} ORDER BY id`,
    params,
  );
const titles = async () => (await rows()).map((r) => r.title);
const bccOf = (m: DeliveredMail) => m.bcc.map((a) => a.Address).sort();
const withTitle = (delivered: DeliveredMail[], title: string) => delivered.filter((m) => m.subject === title);

test.describe('the mail queue is flushed every minute', () => {
  test.slow();

  test('an email is queued at once, sent within about a minute, and removed from the queue once sent', { tag: ['@COM-EML-001', '@COM-EML-006', '@COM-EML-010'] }, async ({ app, anon, mails }) => {
    const u = await make.user({ email: 'attente@camap.test', lang: 'en' });
    const sentMark = await mailpit.mark();
    const queueMark = await mails.mark();

    await app.actions.account.forgotPassword(anon.request, u.email); // returns without waiting for the SMTP server

    const [queued] = await rows('id > ?', [queueMark]);
    expect(queued.sdate).toBeNull();
    expect(queued.tries).toBe(0);
    const delivered = await mailpit.waitFor(sentMark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => d.some((m) => bccOf(m).includes(u.email)) });
    const mail = delivered.find((m) => bccOf(m).includes(u.email))!;
    expect(mail.subject).toBe('CAMAP : Changement de mot de passe'); // French, whatever the stored language
    expect(mail.html).toContain('Vous avez demandé à changer votre mot de passe');
    await waitForQueue(() => rows('id = ?', [queued.id]), (r) => r.length === 0);
  });

  test('the recipients of a message are hidden from each other: one blind copy list', { tag: ['@COM-EML-003'] }, async () => {
    const mark = await mailpit.mark();
    await make.queuedMail({
      title: 'Copie cachée',
      recipients: [
        { email: 'alice@camap.test', name: 'Alice' },
        { email: 'bob@camap.test', name: 'Bob' },
        { email: 'chloe@camap.test', name: 'Chloé' },
      ],
    });

    const delivered = await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Copie cachée').length > 0 });

    const [mail] = withTitle(delivered, 'Copie cachée');
    expect(withTitle(delivered, 'Copie cachée')).toHaveLength(1);
    expect(mail.to).toEqual([]);
    expect(mail.cc).toEqual([]);
    expect(bccOf(mail)).toEqual(['alice@camap.test', 'bob@camap.test', 'chloe@camap.test']);
    expect(mail.headers.to).toBeUndefined();
    expect(mail.headerText).not.toMatch(/alice|bob|chloe/); // nothing a recipient could read
    expect(mail.html).not.toMatch(/alice|bob|chloe/);
  });

  test('a mail for more than 99 recipients is sent in groups of at most 99', { tag: ['@COM-EML-003'] }, async () => {
    const mark = await mailpit.mark();
    const everyone = Array.from({ length: 150 }, (_, i) => ({ email: `membre${String(i + 1).padStart(3, '0')}@camap.test` }));
    await make.queuedMail({ title: 'Grande liste', recipients: everyone });

    const delivered = await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Grande liste').length >= 2 });
    await new Promise((r) => setTimeout(r, 3_000)); // nothing else should follow

    const parts = withTitle(await mailpit.since(mark), 'Grande liste');
    expect(parts.map((m) => m.bcc.length).sort((a, b) => b - a)).toEqual([99, 51]);
    expect(parts.every((m) => m.to.length === 0)).toBe(true);
    expect(parts.flatMap(bccOf).sort()).toEqual(everyone.map((r) => r.email).sort());
    expect(delivered.length).toBeGreaterThanOrEqual(2);
    expect(await rows()).toEqual([]); // the whole mail is out of the queue
  });

  test('invalid addresses are dropped, and a mail left with no recipient is not sent', { tag: ['@COM-EML-004'] }, async () => {
    const mark = await mailpit.mark();
    await make.queuedMail({
      title: 'Un seul bon',
      recipients: [{ email: 'bon@camap.test' }, { email: 'pas-une-adresse' }, { email: '' }, { email: 'a b@camap.test' }],
    });
    await make.queuedMail({ title: 'Aucun bon', recipients: [{ email: 'pas-une-adresse' }, { email: '@camap.test' }] });
    await make.queuedMail({ title: 'Personne', recipients: [] });

    const delivered = await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Un seul bon').length > 0 });
    await waitForQueue(titles, (t) => t.length === 0);

    expect(withTitle(delivered, 'Un seul bon').map(bccOf)).toEqual([['bon@camap.test']]);
    const all = await mailpit.since(mark);
    expect(withTitle(all, 'Aucun bon')).toEqual([]);
    expect(withTitle(all, 'Personne')).toEqual([]);
  });

  test('at most 100 emails are processed per flush, oldest first', { tag: ['@COM-EML-002'] }, async () => {
    const now = Date.now();
    for (let i = 1; i <= 105; i++) {
      await make.queuedMail({ title: `Lot ${String(i).padStart(3, '0')}`, recipients: [{ email: `lot${i}@camap.test` }], cdate: new Date(now - (106 - i) * 1000) });
    }

    const left = await waitForQueue(titles, (t) => t.length < 105);

    expect(left).toEqual(['Lot 101', 'Lot 102', 'Lot 103', 'Lot 104', 'Lot 105']); // the 5 newest wait for the next minute
  });

  test('a failed email is retried: the attempt is counted, and it is given up after 30 tries', { tag: ['@COM-EML-005'] }, async () => {
    const mark = await mailpit.mark();
    const failing = [{ filename: 'x.txt', path: '/nonexistent/file' }]; // sending fails whatever the recipient
    await make.queuedMail({ title: 'Échec premier', recipients: [{ email: 'e1@camap.test' }], attachments: failing });
    await make.queuedMail({ title: 'Échec dernier', recipients: [{ email: 'e2@camap.test' }], attachments: failing, tries: 29 });
    await make.queuedMail({ title: 'Abandonné', recipients: [{ email: 'e3@camap.test' }], tries: 30 });
    await make.queuedMail({ title: 'Dernière chance', recipients: [{ email: 'e4@camap.test' }], tries: 29 });

    await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Dernière chance').length > 0 });
    await waitForQueue(titles, (t) => !t.includes('Dernière chance'));

    const left = Object.fromEntries((await rows()).map((r) => [r.title, r]));
    expect(left['Échec premier'].tries).toBe(1);
    expect(left['Échec premier'].rawStatus).toContain('ENOENT'); // the reason is kept
    expect(left['Échec dernier'].tries).toBe(30);
    expect(left['Abandonné'].tries).toBe(30); // not tried again
    const all = await mailpit.since(mark);
    expect(withTitle(all, 'Abandonné')).toEqual([]);
    expect(withTitle(all, 'Échec premier')).toEqual([]);
  });

  test('when only some recipients are rejected, the email is kept for them only', { tag: ['@COM-EML-005'] }, async () => {
    const mark = await mailpit.mark();
    // valid for the sender (a@b.c shape) but refused by the SMTP server
    await make.queuedMail({ title: 'Rejet partiel', recipients: [{ email: 'accepte@camap.test' }, { email: 'rejete..deux@camap.test' }] });

    const delivered = await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Rejet partiel').length > 0 });
    const [left] = await waitForQueue(() => rows(), (r) => r.length === 1 && r[0].tries === 1);

    expect(withTitle(delivered, 'Rejet partiel').map(bccOf)).toEqual([['accepte@camap.test']]);
    expect(JSON.parse(left.recipients)).toEqual([{ email: 'rejete..deux@camap.test' }]);
    expect(left.rawStatus).toContain('rejete..deux@camap.test');
  });

  test('a sent email leaves the queue, and entries sent more than 10 days ago are purged', { tag: ['@COM-EML-006'] }, async () => {
    const mark = await mailpit.mark();
    const now = Date.now();
    await make.queuedMail({ title: 'À envoyer', recipients: [{ email: 'envoi@camap.test' }] });
    await make.queuedMail({ title: 'Envoyé il y a 11 jours', recipients: [{ email: 'vieux@camap.test' }], cdate: new Date(now - 12 * DAY), sdate: new Date(now - 11 * DAY) });
    await make.queuedMail({ title: 'Envoyé il y a 9 jours', recipients: [{ email: 'recent@camap.test' }], cdate: new Date(now - 10 * DAY), sdate: new Date(now - 9 * DAY) });

    await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'À envoyer').length > 0 });
    const left = await waitForQueue(titles, (t) => !t.includes('À envoyer'));

    expect(left).toEqual(['Envoyé il y a 9 jours']);
    expect(withTitle(await mailpit.since(mark), 'Envoyé il y a 9 jours')).toEqual([]); // sent entries are history, not sent again
  });
});

test.describe('sender and branding of what is sent', () => {
  test.slow();

  test('the shown sender is the stored sender name on the platform address, replies go to the sender header (UND-100, characterised)', { tag: ['@COM-EML-007'] }, async () => {
    // Characterised as it is today: the stored sender address (the group contact) is replaced by the platform
    // address; it only survives in the Reply-To header the hx side writes.
    const mark = await mailpit.mark();
    await make.queuedMail({
      title: 'Message du groupe',
      recipients: [{ email: 'membre@camap.test' }],
      sender: { name: 'AMAP des Tests', email: 'contact@camap.test', userId: null },
      headers: { 'Reply-To': 'contact@camap.test' },
    });

    const delivered = await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Message du groupe').length > 0 });

    const [mail] = withTitle(delivered, 'Message du groupe');
    expect(mail.from).toEqual({ Name: 'AMAP des Tests', Address: 'noreply@camap.amap44.org' });
    expect(mail.replyTo.map((a) => a.Address)).toEqual(['contact@camap.test']);
  });

  test('an email with no stored sender comes from the platform name and address', { tag: ['@COM-EML-008'] }, async () => {
    const mark = await mailpit.mark();
    await make.queuedMail({ title: 'Sans expéditeur', recipients: [{ email: 'membre@camap.test' }], sender: null });

    const delivered = await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Sans expéditeur').length > 0 });

    expect(withTitle(delivered, 'Sans expéditeur')[0].from).toEqual({ Name: 'CAMAP', Address: 'noreply@camap.amap44.org' });
  });

  test('the platform address is the one of the saved white-label theme (DECISION UND-101)', { tag: ['@COM-EML-008'] }, async ({ app, as }) => {
    deviation('UND-101');
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const theme = JSON.parse((await app.views.admin.themeSettings(admin.request)).settings!);
    theme.name = 'Plateforme Test';
    theme.email.senderEmail = 'noreply@plateforme.test';
    await app.actions.admin.setTheme(admin.request, JSON.stringify(theme));
    await app.actions.admin.reloadTheme(admin.request);
    const mark = await mailpit.mark();
    await make.queuedMail({ title: 'Sous un autre thème', recipients: [{ email: 'membre@camap.test' }], sender: null });

    const delivered = await mailpit.waitFor(mark, { timeoutMs: FLUSH_TIMEOUT, done: (d) => withTitle(d, 'Sous un autre thème').length > 0 });

    expect(withTitle(delivered, 'Sous un autre thème')[0].from).toEqual({ Name: 'Plateforme Test', Address: 'noreply@plateforme.test' });
  });
});
