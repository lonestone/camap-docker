/**
 * Automatic emails driven by the hourly and daily jobs (specs/07-communication/order-notifications.md,
 * digests.md, scheduled-jobs.md; camap-hx/src/controller/Cron.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query } from '../../src/db/client.js';
import { CatalogFlag, UserFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import { subscribeConst, subscribeVar } from '../../src/flows.js';

const HOUR = 3_600_000;

/** Mails to `email` that are distribution reminders (not the hourly activity digest). */
const reminders = async (mails: { to(email: string, mark: number): Promise<{ title: string }[]> }, email: string, mark: number) =>
  (await mails.to(email, mark)).filter((m) => /distribution/i.test(m.title) && !/activité|activity/i.test(m.title));

async function memberWithFlags(userFlags: number) {
  const s = await make.amapScenario();
  await execute('UPDATE User SET flags = ? WHERE id IN (?, ?)', [userFlags, s.users.member.id, s.users.member2.id]);
  return s;
}

test.describe('reminders before a distribution', () => {
  test('a member with orders is reminded 24 hours before, once, if they enabled it', { tag: ['@COM-NTF-001', '@COM-AUT-002', '@COM-NTF-008'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await memberWithFlags(flags(UserFlag, 'HasEmailNotif24h'));
    await execute('UPDATE User SET flags = 0 WHERE id = ?', [s.users.member2.id]); // member2 opted out
    const m1 = await as(s.users.member);
    const m2 = await as(s.users.member2);
    await subscribeConst(app, m1.request, s, s.users.member.id);
    await subscribeConst(app, m2.request, s, s.users.member2.id);
    const start = s.multiDistribs[0].distribStartDate;
    clock.set(new Date(start.getTime() - 23.5 * HOUR));
    const mark = await mails.mark();

    await cron.run('hour');
    await cron.run('hour'); // the same hour again: already handled

    expect(await reminders(mails, s.users.member.email, mark)).toHaveLength(1);
    expect(await reminders(mails, s.users.member2.email, mark)).toHaveLength(0);
  });

  test('the same reminder 4 hours before, if enabled', { tag: ['@COM-NTF-002'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await memberWithFlags(flags(UserFlag, 'HasEmailNotif4h'));
    const m1 = await as(s.users.member);
    await subscribeConst(app, m1.request, s, s.users.member.id);
    const start = s.multiDistribs[0].distribStartDate;
    clock.set(new Date(start.getTime() - 3.5 * HOUR));
    const mark = await mails.mark();

    await cron.run('hour');

    expect(await reminders(mails, s.users.member.email, mark)).toHaveLength(1);
  });

  test('a member with no order on that distribution gets no reminder', { tag: ['@COM-NTF-001'] }, async ({ clock, cron, mails }) => {
    const s = await memberWithFlags(flags(UserFlag, 'HasEmailNotif24h'));
    clock.set(new Date(s.multiDistribs[0].distribStartDate.getTime() - 23.5 * HOUR));
    const mark = await mails.mark();

    await cron.run('hour');

    expect(await reminders(mails, s.users.member.email, mark)).toHaveLength(0);
  });

  test('members are told when ordering opens on a variable catalog, if enabled', { tag: ['@COM-NTF-003', '@COM-AUT-005'] }, async ({ clock, cron, mails }) => {
    const s = await memberWithFlags(flags(UserFlag, 'HasEmailNotifOuverture'));
    await execute('UPDATE User SET flags = 0 WHERE id = ?', [s.users.member2.id]);
    const orderStart = s.distributions[0].var; // order window opens 10 days before the session
    const opens = s.multiDistribs[0].orderStartDate;
    clock.set(new Date(opens.getTime() + 20 * 60_000)); // inside the opening hour
    const mark = await mails.mark();

    await cron.run('hour');

    const sent = await mails.to(s.users.member.email, mark);
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0].headers)).toContain(s.users.groupAdmin.email); // replies go to the group contact
    expect(await mails.to(s.users.member2.email, mark)).toHaveLength(0);
    void orderStart;
  });
});

test.describe('order recaps when orders close', () => {
  const afterClose = (s: Awaited<ReturnType<typeof make.amapScenario>>, minutes = 90) => new Date(s.multiDistribs[0].orderEndDate.getTime() + minutes * 60_000);

  test('the vendor gets the ordered products of a variable catalog when orders close', { tag: ['@COM-NTF-004', '@COM-JOB-004'] }, async ({ app, as, clock, cron, mails }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);
    const sub = await subscribeVar(app, m.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(m.request, sub.id, [{ id: s.distributions[0].var.id, orders: [{ productId: s.products.var[0].id, qty: 3 }] }]);
    clock.set(afterClose(s));
    const mark = await mails.mark();

    await cron.run('hour');

    const sent = await mails.to('ferme@camap.test', mark);
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toContain('Commandes Œufs (contrat variable)');
    expect(sent[0].htmlBody).toContain('Boîte de 6 œufs');
  });

  test('a constant catalog notifies the vendor only when the option is on', { tag: ['@COM-NTF-004'] }, async ({ clock, cron, mails }) => {
    const s = await make.amapScenario();
    clock.set(afterClose(s));
    const mark = await mails.mark();
    await cron.run('hour');
    const without = (await mails.to('ferme@camap.test', mark)).filter((x) => x.title.includes('Légumes'));
    expect(without).toEqual([]);

    await query('UPDATE Catalog SET flags = ? WHERE id = ?', [flags(CatalogFlag, 'UsersCanOrder', 'NotifyVendorOnOrderEnd'), s.constCatalog.id]);
    clock.set(new Date(afterClose(s).getTime() + 24 * HOUR - 24 * HOUR)); // same hour: re-run
    await cron.run('hour');
    const withOption = (await mails.to('ferme@camap.test', mark)).filter((x) => x.title.includes('Légumes'));
    expect(withOption).toHaveLength(1);
  });

  test('the catalog contact gets a recap when orders close, if the catalog notifies the contact', { tag: ['@COM-NTF-005', '@COM-NTF-007'] }, async ({ clock, cron, mails }) => {
    const s = await make.amapScenario();
    await query('UPDATE Catalog SET flags = ? WHERE id = ?', [flags(CatalogFlag, 'UsersCanOrder', 'NotifyContactOnOrderEnd'), s.varCatalog.id]);
    clock.set(afterClose(s, 300)); // five hours after: outside the "last hour" window
    const mark = await mails.mark();
    await cron.run('hour');
    expect(await mails.to(s.users.coordinator.email, mark)).toHaveLength(0);

    clock.set(afterClose(s, 90));
    await cron.run('hour');
    const recap = await mails.to(s.users.coordinator.email, mark);
    expect(recap).toHaveLength(1);
    expect(recap[0].title).toContain('Commandes mises à jour');
  });
});

test.describe('digests', () => {
  test('a digest keeps the last notification per group and subject, one email per group', { tag: ['@COM-DGT-004', '@COM-DGT-005'] }, async ({ clock, cron, mails }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    const note = (groupId: number, subject: string, body: string, cdate: string) =>
      execute('INSERT INTO NotificationMail (cdate, htmlBody, textBody, digest, subject, groupId, recipientId, attachments) VALUES (?, ?, ?, 1, ?, ?, ?, ?)', [
        cdate, body, body, subject, groupId, s.users.member.id, '[]',
      ]);
    await note(s.group.id, 'SUBSCRIPTION(1)', 'premier', '2026-11-03 09:00:00.000000');
    await note(s.group.id, 'SUBSCRIPTION(1)', 'dernier', '2026-11-03 10:00:00.000000');
    await note(s.group.id, 'DEFAULT_ORDER(2)', 'autre sujet', '2026-11-03 10:30:00.000000');
    await note(other.id, 'SUBSCRIPTION(9)', 'autre groupe', '2026-11-03 10:40:00.000000');
    void clock;
    const mark = await mails.mark();

    await cron.run('hour');

    const sent = await mails.to(s.users.member.email, mark);
    expect(sent).toHaveLength(2); // one per group
    const first = sent.find((m) => m.htmlBody?.includes('dernier'))!;
    expect(first.htmlBody).toContain('autre sujet');
    expect(first.htmlBody).not.toContain('premier');
    expect(await query('SELECT id FROM NotificationMail')).toEqual([]); // consumed
  });

  test('daily digests are sent by the daily job, not the hourly one', { tag: ['@COM-DGT-005'] }, async ({ cron, mails }) => {
    const s = await make.amapScenario();
    await execute('INSERT INTO NotificationMail (cdate, htmlBody, textBody, digest, subject, groupId, recipientId, attachments) VALUES (NOW(), ?, ?, 2, ?, ?, ?, ?)', [
      'quotidien', 'quotidien', 'X(1)', s.group.id, s.users.member.id, '[]',
    ]);
    const mark = await mails.mark();

    await cron.run('hour');
    expect(await mails.to(s.users.member.email, mark)).toHaveLength(0);

    await cron.run('daily');
    expect(await mails.to(s.users.member.email, mark)).toHaveLength(1);
  });
});

test.describe('daily jobs', () => {
  test('yesterday\'s errors are emailed to the webmaster', { tag: ['@COM-JOB-006', '@COM-JOB-013', '@ADM-ERR-004'] }, async ({ clock, cron, mails, errors }) => {
    errors.expect(/boom-yesterday|boom-today/);
    clock.set('2026-11-10 08:00:00');
    await execute('INSERT INTO Error (date, url, error) VALUES (?, ?, ?)', ['2026-11-09 14:00:00', '/some/url', 'boom-yesterday']);
    await execute('INSERT INTO Error (date, url, error) VALUES (?, ?, ?)', ['2026-11-10 07:00:00', '/other/url', 'boom-today']);
    const mark = await mails.mark();

    await cron.run('daily');

    const sent = await mails.to('webmaster@camap.test', mark);
    expect(sent).toHaveLength(1);
    expect(sent[0].htmlBody).toContain('boom-yesterday');
    expect(sent[0].htmlBody).not.toContain('boom-today');
  });

  test('no error yesterday, no email', { tag: ['@COM-JOB-006'] }, async ({ clock, cron, mails }) => {
    clock.set('2026-11-10 08:00:00');
    const mark = await mails.mark();

    await cron.run('daily');

    expect(await mails.to('webmaster@camap.test', mark)).toEqual([]);
  });

  test('old sessions are deleted', { tag: ['@COM-JOB-007'] }, async ({ cron, anon }) => {
    await anon.request.get('/'); // creates a Session row
    const old = await query<{ sid: string }>('SELECT sid FROM Session');
    expect(old.length).toBeGreaterThan(0);
    await execute('UPDATE Session SET lastTime = DATE_SUB(NOW(), INTERVAL 90 DAY)');

    await cron.run('daily');

    expect(await query('SELECT sid FROM Session WHERE sid IN (?)', [old.map((r) => r.sid)])).toEqual([]);
  });
});
