/**
 * Maintenance tools (specs/08-administration/maintenance-tools.md; controller/admin/Admin.hx doEmails).
 *
 * Not testable from here:
 *  - ADM-TLS-002 (email template preview and list) and ADM-TLS-003 (stored image view / recompression):
 *    only camap-ts serves them (`/mails/...`, `/files/...`), on its own origin: see maintenance-tools.api.spec.ts.
 *  - ADM-TLS-004 is CAT-CDD-007 and ADM-TLS-005 is ADM-USR-003 (tagged on their tests).
 *  - ADM-TLS-006 (UND-115) is in platform-settings.graphql.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, execute } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

async function queueMail(over: { title?: string; tries?: number; sent?: boolean; ago?: string } = {}): Promise<number> {
  const res = await execute(
    `INSERT INTO BufferedJsonMail (title, htmlBody, textBody, mailerType, tries, cdate, sdate, rawStatus, headers, sender, recipients, attachments)
     VALUES (?, '<p>hello</p>', 'hello', 'smtp', ?, DATE_SUB(NOW(), INTERVAL ${over.ago ?? '1 HOUR'}), ${over.sent ? 'NOW()' : 'NULL'}, NULL, '{}', ?, ?, '[]')`,
    [over.title ?? 'Test mail', over.tries ?? 0, JSON.stringify({ email: 'from@camap.test', name: 'From' }), JSON.stringify([{ email: 'to@camap.test', name: 'To' }])],
  );
  return res.insertId;
}
const triesOf = async (id: number) => (await query<{ tries: number }>('SELECT tries FROM BufferedJsonMail WHERE id = ?', [id]))[0].tries;

test.describe('unsent emails', () => {
  test('a superadmin lists the unsent emails and only them, newest first', { tag: ['@ADM-TLS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const old = await queueMail({ title: 'Old unsent', ago: '2 DAY' });
    const recent = await queueMail({ title: 'Recent unsent', ago: '1 HOUR' });
    await queueMail({ title: 'Already sent', sent: true });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.emails(admin.request);

    expect(res.status).toBe(200);
    expect(res.announcedCount).toBe(2);
    expect(res.mails.map((m) => m.id)).toEqual([recent, old]);
    expect(res.mails.map((m) => m.title)).toEqual(['Recent unsent', 'Old unsent']);
  });

  test('the queue shows 10 emails per page and announces the full count', { tag: ['@ADM-TLS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    for (let i = 0; i < 12; i++) await queueMail({ title: `Mail ${i}`, ago: `${i + 1} MINUTE` });
    const admin = await as(s.users.superadmin);

    const first = await app.views.admin.emails(admin.request);
    const second = await app.views.admin.emails(admin.request, { page: 2 });

    expect(first.announcedCount).toBe(12);
    expect(first.mails).toHaveLength(10);
    expect(second.mails).toHaveLength(2);
  });

  test('an email that was already tried offers a retry, a fresh one does not', { tag: ['@ADM-TLS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const fresh = await queueMail({ title: 'Fresh', tries: 0, ago: '1 MINUTE' });
    const failing = await queueMail({ title: 'Failing', tries: 3, ago: '2 MINUTE' });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.emails(admin.request);

    expect(res.mails.find((m) => m.id === fresh)).toMatchObject({ tries: 0, canRetry: false });
    expect(res.mails.find((m) => m.id === failing)).toMatchObject({ tries: 3, canRetry: true });
  });

  test('a superadmin resets the retry counter of an email', { tag: ['@ADM-TLS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const failing = await queueMail({ tries: 7 });
    const other = await queueMail({ tries: 2 });
    const admin = await as(s.users.superadmin);

    const res = await app.actions.admin.resetMailTries(admin.request, failing);

    expect(res.status).toBe(200);
    expect(await triesOf(failing)).toBe(0);
    expect(await triesOf(other)).toBe(2);
    // the queue is still there, the mail still unsent
    expect((await app.views.admin.emails(admin.request)).mails.find((m) => m.id === failing)).toMatchObject({ tries: 0, canRetry: false });
  });

  test('a user who is not a superadmin can neither list nor reset', { tag: ['@ADM-TLS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const failing = await queueMail({ title: 'Secret subject', tries: 4 });
    for (const who of [await as(s.users.groupAdmin), await as('anon')]) {
      const list = await app.views.admin.emails(who.request);
      const reset = await app.actions.admin.resetMailTries(who.request, failing);

      expect(list.status).toBe(302);
      expect(list.location).toBe('/');
      expect(list.mails).toEqual([]);
      expect(list.text).not.toContain('Secret subject');
      expect(reset.status).toBe(302);
      expect(reset.location).toBe('/');
    }
    expect(await triesOf(failing)).toBe(4);
  });
});
