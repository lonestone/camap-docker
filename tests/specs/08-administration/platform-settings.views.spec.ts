/**
 * Platform settings stored in the `Variable` table (specs/08-administration/maintenance-install.md ADM-MNT-009,
 * ADM-MNT-010; controller/Main.hx, db/BufferedJsonMail.hx, templates base.mtt / macros.mtt).
 *
 * UND-111 is undecided: nothing in the app writes these settings, they are edited in the database.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { mailpit } from '../../src/mailpit.js';

const setVariable = (name: string, value: string) =>
  execute('INSERT INTO `Variable` (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [name, value]);

test.describe('settings read from the stored variables', () => {
  test('the analytics id of the page layout is the stored one', { tag: ['@ADM-MNT-009'] }, async ({ app, as }) => {
    const visitor = await as('anon');
    expect((await app.views.platform.analyticsId(visitor.request)).analyticsId).toBeNull();

    await setVariable('googleTagManagerId', 'GTM-TEST123');

    const page = await app.views.platform.analyticsId(visitor.request);
    expect(page.status).toBe(200);
    expect(page.analyticsId).toBe('GTM-TEST123');
  });

  test('an empty stored analytics id loads no analytics', { tag: ['@ADM-MNT-009'] }, async ({ app, as }) => {
    await setVariable('googleTagManagerId', '');
    const visitor = await as('anon');

    expect((await app.views.platform.analyticsId(visitor.request)).analyticsId).toBeNull();
  });

  test('stored SMTP settings are ignored: queued emails leave through the SMTP server of the configuration', { tag: ['@ADM-MNT-009'] }, async ({ app, anon }) => {
    // hx reads smtp_host, smtp_port, smtp_user and smtp_pass from the Variable table only in commented-out code
    // (BufferedJsonMail.finallySend); the flush that sends the queue (Nest, every minute) reads its environment.
    test.slow();
    await setVariable('smtp_host', 'smtp.unreachable.invalid');
    await setVariable('smtp_port', '9');
    await setVariable('smtp_user', 'nobody');
    await setVariable('smtp_pass', 'wrong');
    const u = await make.user({ email: 'reglages@camap.test' });
    const sentMark = await mailpit.mark();

    await app.actions.account.forgotPassword(anon.request, u.email);

    const delivered = await mailpit.waitFor(sentMark, { timeoutMs: 100_000, done: (d) => d.some((m) => m.bcc.some((a) => a.Address === u.email) || m.to.some((a) => a.Address === u.email)) });
    expect(delivered.length).toBeGreaterThan(0);
  });
});

test.describe('no screen edits the stored settings', () => {
  test('the back-office offers no link to SMTP, analytics or maintenance settings', { tag: ['@ADM-MNT-010'] }, async ({ app, as }) => {
    // UND-111: the maintenance switch, the SMTP settings and the analytics id are only changed in the database
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const home = await app.views.admin.dashboard(admin.request);

    expect(home.status).toBe(200);
    expect(home.text).not.toMatch(/smtp|analytics|maintenance|googleTagManager/i);
  });
});
