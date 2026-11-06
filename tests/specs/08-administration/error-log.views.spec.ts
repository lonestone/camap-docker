/**
 * Error log (specs/08-administration/error-log.md; sugoi BaseApp.logError, controller/admin/Admin.hx doErrors,
 * template admin/errors.mtt). The daily error mail (ADM-ERR-004) is checked with COM-JOB-006
 * (07-communication/order-notifications.cron.spec.ts).
 *
 * MySQL keeps real time (the fake clock only moves Neko), so the rows below are dated with the DB's NOW().
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query, execute } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

async function logError(over: { error?: string; url?: string; uid?: number | null; ip?: string; ago?: string } = {}): Promise<number> {
  const res = await execute(
    `INSERT INTO \`Error\` (date, ip, uid, url, error, userAgent) VALUES (DATE_SUB(NOW(), INTERVAL ${over.ago ?? '1 HOUR'}), ?, ?, ?, ?, 'Test-Agent/1.0')`,
    [over.ip ?? '10.1.2.3', over.uid ?? null, over.url ?? '/some/page', over.error ?? 'boom'],
  );
  return res.insertId;
}
const count = async () => (await query<{ c: number }>('SELECT COUNT(*) AS c FROM `Error`'))[0].c;

test.describe('recording errors', () => {
  test('an unexpected error is logged with its address, user, IP and date', { tag: ['@ADM-ERR-001'] }, async ({ app, as, errors }) => {
    errors.expect(/CAMAP est déjà installé/);
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    // the installation page throws a plain string when the platform is already installed: an unexpected error
    await app.views.platform.install(member.request);

    const rows = await query<{ url: string; uid: number | null; ip: string | null; date: string; error: string; userAgent: string | null }>(
      'SELECT url, uid, ip, date, error, userAgent FROM `Error` ORDER BY id DESC',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('/install');
    expect(rows[0].uid).toBe(s.users.member.id);
    expect(rows[0].ip).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
    expect(rows[0].error).toContain('CAMAP est déjà installé');
    expect(rows[0].userAgent).toBeTruthy();
    // the date is "now" (Paris wall-clock vs MySQL clock: allow the time zone offset)
    const [age] = await query<{ m: number }>('SELECT ABS(TIMESTAMPDIFF(MINUTE, date, NOW())) AS m FROM `Error`');
    expect(age.m).toBeLessThan(180);
  });

  test('an error of a visitor is logged without a user', { tag: ['@ADM-ERR-001'] }, async ({ app, as, errors }) => {
    errors.expect(/CAMAP est déjà installé/);
    await make.amapScenario();
    const visitor = await as('anon');

    await app.views.platform.install(visitor.request);

    const rows = await query<{ uid: number | null }>('SELECT uid FROM `Error`');
    expect(rows).toEqual([{ uid: null }]);
  });

  test('an expected error shows as a message and is not logged', { tag: ['@ADM-ERR-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);
    const before = await count();

    // a refused form (invalid theme JSON) is an expected error: flash message on a redirect
    const res = await app.actions.admin.setTheme(admin.request, 'pas du JSON');

    expect(res.status).toBe(302);
    expect(res.flash?.kind).toBe('error');
    expect(await count()).toBe(before);
  });

  test('a refused access (no right) is an expected error: message, no log row', { tag: ['@ADM-ERR-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const before = await count();

    const res = await app.views.admin.dashboard(member.request);

    expect(res.status).toBe(302);
    expect(await count()).toBe(before);
  });
});

test.describe('browsing the error log', () => {
  test('a superadmin lists the errors, newest first, with their details', { tag: ['@ADM-ERR-002'] }, async ({ app, as, errors }) => {
    errors.expect();
    const s = await make.amapScenario();
    const older = await logError({ error: 'older failure', url: '/older', ago: '3 DAY', uid: s.users.member.id, ip: '10.9.8.7' });
    const newer = await logError({ error: 'newer failure', url: '/newer', ago: '1 HOUR' });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.errors(admin.request);

    expect(res.status).toBe(200);
    expect(res.entries.map((e) => e.id)).toEqual([newer, older]);
    expect(res.entries[0]).toMatchObject({ message: 'newer failure', url: '/newer', userId: null, ip: '10.1.2.3', userAgent: 'Test-Agent/1.0' });
    expect(res.entries[1]).toMatchObject({ message: 'older failure', url: '/older', userId: s.users.member.id, ip: '10.9.8.7' });
  });

  test('the list has 20 errors per page', { tag: ['@ADM-ERR-002'] }, async ({ app, as, errors }) => {
    errors.expect();
    const s = await make.amapScenario();
    for (let i = 0; i < 25; i++) await logError({ error: `failure ${i}`, ago: `${i + 1} MINUTE` });
    const admin = await as(s.users.superadmin);

    const first = await app.views.admin.errors(admin.request);
    const second = await app.views.admin.errors(admin.request, { page: 2 });

    expect(first.entries).toHaveLength(20);
    expect(second.entries).toHaveLength(5);
    expect(first.entries[0].message).toBe('failure 0');
    expect(second.entries[4].message).toBe('failure 24');
  });

  test('daily counts cover the last month only', { tag: ['@ADM-ERR-002'] }, async ({ app, as, errors }) => {
    errors.expect();
    const s = await make.amapScenario();
    await logError({ ago: '2 DAY' });
    await logError({ ago: '2 DAY', error: 'second' });
    await logError({ ago: '5 DAY' });
    await logError({ ago: '60 DAY', error: 'too old for the graph' });
    const day = async (ago: number) => (await query<{ d: string }>(`SELECT DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ${ago} DAY), '%y-%m-%d') AS d`))[0].d;
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.errors(admin.request);

    expect(res.daily).toEqual([
      { day: await day(5), count: 1 },
      { day: await day(2), count: 2 },
    ]);
    // the old one is still in the list
    expect(res.entries).toHaveLength(4);
  });

  test('the list can be filtered by user, and so can the daily counts', { tag: ['@ADM-ERR-002'] }, async ({ app, as, errors }) => {
    errors.expect();
    const s = await make.amapScenario();
    const mine = await logError({ uid: s.users.member.id, error: 'member failure', ago: '2 DAY' });
    await logError({ uid: s.users.member2.id, error: 'member2 failure', ago: '2 DAY' });
    await logError({ error: 'anonymous failure', ago: '2 DAY' });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.errors(admin.request, { userId: s.users.member.id });

    expect(res.entries.map((e) => e.id)).toEqual([mine]);
    expect(res.daily.map((d) => d.count)).toEqual([1]);
  });

  test('a member and a visitor cannot open the error log', { tag: ['@ADM-ERR-002'] }, async ({ app, as, errors }) => {
    errors.expect();
    const s = await make.amapScenario();
    await logError({ error: 'secret failure' });
    for (const who of [await as(s.users.groupAdmin), await as('anon')]) {
      const res = await app.views.admin.errors(who.request);

      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(res.entries).toEqual([]);
      expect(res.text).not.toContain('secret failure');
    }
  });
});

test.describe('emptying the error log', () => {
  test('a superadmin empties the error log', { tag: ['@ADM-ERR-003'] }, async ({ app, as, errors }) => {
    errors.expect();
    const s = await make.amapScenario();
    await logError();
    await logError({ error: 'second' });
    const admin = await as(s.users.superadmin);

    await app.actions.admin.purgeErrors(admin.request);

    expect(await count()).toBe(0);
  });

  test('a user who is not a superadmin cannot empty it', { tag: ['@ADM-ERR-003'] }, async ({ app, as, errors }) => {
    errors.expect();
    const s = await make.amapScenario();
    await logError();
    const before = await count();

    for (const who of [await as(s.users.groupAdmin), await as('anon')]) {
      const res = await app.actions.admin.purgeErrors(who.request);

      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
    }
    expect(await count()).toBe(before);
  });

  test('without a security token the purge does nothing', { tag: ['@ADM-ERR-003'] }, async ({ app, as, errors }) => {
    // UND-108 (decided): the purge is a POST with a CSRF token and a confirmation.
    // hx empties the table on a plain GET `/admin/errors?empty=1`, no token (CODE-030).
    deviation('UND-108');
    errors.expect();
    const s = await make.amapScenario();
    await logError();
    const admin = await as(s.users.superadmin);

    await app.actions.admin.purgeErrors(admin.request, { token: false });

    expect(await count()).toBe(1);
  });
});
