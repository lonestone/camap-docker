/**
 * Choosing the recipients of a group message (specs/07-communication/group-messages.md COM-MSG-003;
 * camap-ts users.resolver.ts getEmailRecipientsByUserIds, messages.resolver.ts createMessage, reached
 * through GraphQL on the shared origin). The lists themselves (getUserLists, getUserListInGroupByListType)
 * are covered in 02-groups/members.graphql.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import type { NewMessage } from '../../src/targets/types.js';

const RECIPIENTS = `query($ids: [Int!]!, $groupId: Int!) { getEmailRecipientsByUserIds(ids: $ids, inGroup: $groupId) { id firstName lastName email } }`;
type Recipients = { getEmailRecipientsByUserIds: { id: number; email: string }[] };

test.describe('recipients of a message', () => {
  test('the picked members are resolved to their emails, members of the group only', { tag: ['@COM-MSG-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const outsider = await make.user({ email: 'dehors@camap.test' });
    const mm = await as(s.users.messagesManager);

    const res = await app.graphql<Recipients>(mm.request, RECIPIENTS, { ids: [s.users.member.id, s.users.member2.id, outsider.id], groupId: s.group.id });

    expect(res.errors).toBeNull();
    expect(res.data!.getEmailRecipientsByUserIds.map((u) => u.email).sort()).toEqual([s.users.member.email, s.users.member2.email].sort());
  });

  test('a member without the messages right gets no recipients', { tag: ['@COM-MSG-003'] }, async ({ app, as }) => {
    // Finding: the right check is a promise that is never awaited, so it is always true (users.resolver.ts:105)
    deviation('UND-121');
    const s = await make.amapScenario();
    const plain = await as(s.users.member);

    const res = await app.graphql<Recipients>(plain.request, RECIPIENTS, { ids: [s.users.member2.id], groupId: s.group.id });

    expect(res.data?.getEmailRecipientsByUserIds ?? []).toEqual([]);
  });

  test('the list chosen is saved with the message and named in the email', { tag: ['@COM-MSG-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.messagesManager);
    const input: NewMessage = {
      title: 'Aux nouveaux',
      htmlBody: '<p>Bienvenue</p>',
      senderName: 'Max Messages',
      senderEmail: 'messages@camap.test',
      recipients: [{ email: s.users.member.email, id: s.users.member.id }],
      group: { id: s.group.id, name: s.group.name },
      list: { type: 'newUsers', name: 'Nouveaux membres' },
    };

    const res = await app.api.messages.create(mm.request, input);

    expect(res.errors).toBeNull();
    expect(res.data!.createMessage.recipientListId).toBe('newUsers');
    const [stored] = await query<{ recipientListId: string; body: string }>('SELECT recipientListId, body FROM Message WHERE id = ?', [res.data!.createMessage.id]);
    expect(stored.recipientListId).toBe('newUsers');
    expect(stored.body).toContain('Nouveaux membres'); // "Vous recevez ce message car vous faites partie de <groupe> (<liste>)"
  });
});
