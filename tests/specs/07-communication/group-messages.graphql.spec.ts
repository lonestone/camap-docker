/**
 * Group messages (specs/07-communication/group-messages.md; camap-ts messages.resolver.ts,
 * reached through GraphQL on the shared origin).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { execute, query } from '../../src/db/client.js';
import { encodeRights } from '../../src/encodings/rights.js';
import { sha1 } from '../../src/encodings/passwords.js';
import * as make from '../../src/factories/index.js';
import type { NewMessage } from '../../src/targets/types.js';

const msg = (s: Awaited<ReturnType<typeof make.amapScenario>>, extra: Record<string, unknown> = {}): NewMessage => ({
  title: 'Distribution exceptionnelle',
  htmlBody: '<p>Bonjour à tous</p>',
  senderName: 'Max Messages',
  senderEmail: 'messages@camap.test',
  recipients: [
    { email: s.users.member.email, id: s.users.member.id, firstName: 'Martine', lastName: 'Membre' },
    { email: s.users.member2.email, id: s.users.member2.id },
  ],
  group: { id: s.group.id, name: s.group.name },
  ...extra,
} as NewMessage);

test.describe('sending a group message', () => {
  test('the messages page opens for a messages manager', { tag: ['@COM-MSG-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.messagesManager);
    await app.actions.group.select(mm.request, s.group.id);

    const res = await app.views.messages.page(mm.request);

    expect(res.status).toBe(200);
  });

  test('a rich-text message is queued for each recipient and stored in the group history', { tag: ['@COM-MSG-002', '@COM-MSG-004'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.messagesManager);
    const mark = await mails.mark();

    const res = await app.api.messages.create(mm.request, msg(s));

    expect(res.errors).toBeNull();
    const stored = res.data!.createMessage;
    expect(stored).toMatchObject({ title: 'Distribution exceptionnelle', amapId: s.group.id, senderId: s.users.messagesManager.id });
    expect(JSON.parse((await query<{ recipients: string }>('SELECT recipients FROM Message WHERE id = ?', [stored.id]))[0].recipients)).toEqual([s.users.member.email, s.users.member2.email]);
    const sent = await mails.since(mark);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual([s.users.member.email, s.users.member2.email]);
    expect(sent[0].htmlBody).toContain('Bonjour à tous');
    // each message carries a link to quit the group
    expect(sent[0].htmlBody).toContain(`/user/quitGroupFromMessage/${s.group.id}/${sha1(String(s.group.id))}`);
  });

  test('a message with no valid recipient is an error and stores nothing (UND-099)', { tag: ['@COM-MSG-011'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.messagesManager);
    const mark = await mails.mark();

    const res = await app.api.messages.create(mm.request, msg(s, { recipients: [{ email: 'pas-une-adresse' }, { email: '' }] }));

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await query('SELECT id FROM Message')).toEqual([]);
    expect(await mails.since(mark)).toEqual([]);
  });

  test('a user without the messages right cannot send (finding: the right is not checked)', { tag: ['@COM-MSG-010'] }, async ({ app, as }) => {
    deviation('FINDING-MSG-RIGHT');
    const s = await make.amapScenario();
    const plain = await as(s.users.member);

    const res = await app.api.messages.create(plain.request, msg(s));

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await query('SELECT id FROM Message')).toEqual([]);
  });
});

test.describe('reading group messages', () => {
  async function history(app: any, as: any, n = 22) {
    const s = await make.amapScenario();
    const mm = await as(s.users.messagesManager);
    const gm = await as(s.users.groupAdmin);
    for (let i = 1; i <= n; i++) {
      await execute(
        'INSERT INTO Message (title, body, date, amapId, senderId, recipients, recipientListId, slateContent, attachments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [`Message ${String(i).padStart(2, '0')}`, '<p>x</p>', `2026-10-${String((i % 28) + 1).padStart(2, '0')} 10:00:00`, s.group.id, i % 2 ? s.users.messagesManager.id : s.users.groupAdmin.id, JSON.stringify([s.users.member.email]), 'all', '[]', '[]'],
      );
    }
    return { s, mm, gm };
  }

  test('the last 20 messages of the group, newest first', { tag: ['@COM-MSG-005'] }, async ({ app, as }) => {
    const { s, mm } = await history(app, as);

    const res = await app.api.messages.forGroup(mm.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.getMessagesForGroup).toHaveLength(20);
    const dates = await query<{ title: string }>('SELECT title FROM Message ORDER BY date DESC LIMIT 20');
    expect(res.data!.getMessagesForGroup.map((m) => m.title)).toEqual(dates.map((d) => d.title));
  });

  test('the last 20 messages I sent in a group', { tag: ['@COM-MSG-006'] }, async ({ app, as }) => {
    const { s, mm } = await history(app, as);

    const res = await app.api.messages.mineInGroup(mm.request, s.group.id);

    expect(res.errors).toBeNull();
    expect(res.data!.getUserMessagesForGroup.length).toBeGreaterThan(0);
    expect(res.data!.getUserMessagesForGroup.every((m) => m.senderId === s.users.messagesManager.id)).toBe(true);
  });

  test('one message with its recipients; only a messages manager reads it', { tag: ['@COM-MSG-007'] }, async ({ app, as }) => {
    const { s, mm } = await history(app, as, 1);
    const [{ id }] = await query<{ id: number }>('SELECT id FROM Message');
    const member = await as(s.users.member);

    const ok = await app.api.messages.byId(mm.request, id);
    const refused = await app.api.messages.byId(member.request, id);

    expect(ok.data!.message.recipients).toEqual([s.users.member.email]);
    expect(refused.errors?.[0].message).toMatch(/cannot access messages/i);
  });

  test('an unknown message is "not found", checked before its group is read (UND-098)', { tag: ['@COM-MSG-007'] }, async ({ app, as }) => {
    deviation('UND-098');
    const { mm } = await history(app, as, 1);

    const res = await app.api.messages.byId(mm.request, 99999);

    expect(res.errors?.[0].message).toMatch(/not found/i);
  });

  test('the latest messages I sent, only in groups where I still have the messages right (UND-098)', { tag: ['@COM-MSG-008'] }, async ({ app, as }) => {
    deviation('UND-098');
    const { s, mm } = await history(app, as, 4);
    await execute('UPDATE UserGroup SET rights = ? WHERE userId = ? AND groupId = ?', [encodeRights([]), s.users.messagesManager.id, s.group.id]); // right withdrawn

    const res = await app.api.messages.latest(mm.request);

    expect(res.data!.getLatestMessages).toEqual([]);
  });

  test('the latest messages I sent, across groups', { tag: ['@COM-MSG-008'] }, async ({ app, as }) => {
    const { mm } = await history(app, as, 4);

    const res = await app.api.messages.latest(mm.request);

    expect(res.errors).toBeNull();
    expect(res.data!.getLatestMessages.length).toBeGreaterThan(0);
  });
});

