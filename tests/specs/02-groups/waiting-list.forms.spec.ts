/**
 * The waiting list of a group, hx side: asking to join, leaving, the mail to the managers, and the
 * "put back on the waiting list" link of the member sheet (specs/02-groups/waiting-list.md;
 * camap-hx controller/Group.hx doList, doListCancel, controller/Member.hx doMovetowl,
 * service/WaitingListService.hx).
 * Approving, refusing and the lists are GraphQL (waiting-list.graphql.spec.ts).
 * Already covered elsewhere: a request for a waiting-list group (GRP-SET-003), the refusal on a
 * closed or full group (GRP-SET-003, GRP-SET-004).
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';

const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;
const waiting = (userId: number, groupId: number) => query<{ message: string }>('SELECT message FROM WaitingList WHERE userId = ? AND amapId = ?', [userId, groupId]);

async function waitingListScenario() {
  return make.amapScenario({ group: { regOption: 'WaitingList' } });
}

test.describe('asking to join a group with a waiting list', () => {
  test('a logged-in user is put on the waiting list and sent back to the group page', { tag: ['@GRP-WAI-001'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    const n = await as(s.users.nonMember);

    const res = await app.actions.group.requestWaitingList(n.request, s.group.id, 'Bonjour, je cherche une AMAP');

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/group/${s.group.id}`);
    expect(await waiting(s.users.nonMember.id, s.group.id)).toEqual([{ message: 'Bonjour, je cherche une AMAP' }]);
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
  });

  test('the message is optional', { tag: ['@GRP-WAI-001'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    const n = await as(s.users.nonMember);

    const res = await app.actions.group.requestWaitingList(n.request, s.group.id);

    expect(res.location).toBe(`/group/${s.group.id}`);
    expect(await waiting(s.users.nonMember.id, s.group.id)).toEqual([{ message: '' }]);
  });

  test('a visitor who is not logged in is sent back to the group page and recorded nowhere', { tag: ['@GRP-WAI-001'] }, async ({ app, anon }) => {
    const s = await waitingListScenario();

    const res = await app.actions.group.requestWaitingList(anon.request, s.group.id, 'Moi');

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/group/${s.group.id}`);
    expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
  });

  test('a group that is open (no waiting list) takes no request', { tag: ['@GRP-WAI-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { regOption: 'Open' } });
    const n = await as(s.users.nonMember);

    const res = await app.actions.group.requestWaitingList(n.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/group/${s.group.id}`);
    expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
  });
});

test.describe('the mail to the managers', () => {
  test('the group admins and the membership managers are told, nobody else', { tag: ['@GRP-WAI-002'] }, async ({ app, as, mails }) => {
    const s = await waitingListScenario();
    const n = await as(s.users.nonMember);
    const mark = await mails.mark();

    await app.actions.group.requestWaitingList(n.request, s.group.id, 'Je voudrais des légumes');

    const recipients = (await mails.since(mark)).flatMap((m) => m.to).sort();
    expect(recipients).toEqual([s.users.groupAdmin.email, s.users.membershipManager.email].sort());
    const [mail] = await mails.to(s.users.membershipManager.email, mark);
    expect(mail.title).toBe("NONMEMBRE Nina s'est inscrit·e à la liste d'attente.");
    expect(mail.htmlBody).toContain('Je voudrais des légumes');
    expect(mail.htmlBody).toContain('AMAP des Tests');
  });

  test('someone with both rights is mailed once', { tag: ['@GRP-WAI-002'] }, async ({ app, as, mails }) => {
    const s = await waitingListScenario();
    const both = await make.user({ email: 'both@camap.test' });
    await make.userGroup({ user: both, group: s.group, rights: [Right.GroupAdmin(), Right.Membership()] });
    const n = await as(s.users.nonMember);
    const mark = await mails.mark();

    await app.actions.group.requestWaitingList(n.request, s.group.id);

    expect(await mails.to(both.email, mark)).toHaveLength(1);
  });

  test('a refused request (already waiting) sends no mail', { tag: ['@GRP-WAI-002', '@GRP-WAI-009'] }, async ({ app, as, mails }) => {
    const s = await waitingListScenario();
    await make.waitingList({ group: s.group, user: s.users.nonMember });
    const n = await as(s.users.nonMember);
    const mark = await mails.mark();

    await app.actions.group.requestWaitingList(n.request, s.group.id);

    expect(await mails.since(mark)).toEqual([]);
  });
});

test.describe('being already in the group, or already waiting', () => {
  test('a member of the group cannot ask to join it', { tag: ['@GRP-WAI-009'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    const m = await as(s.users.member);

    const res = await app.actions.group.requestWaitingList(m.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/group/${s.group.id}`);
    expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });

  test('asking twice keeps one entry and the first message', { tag: ['@GRP-WAI-009'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    const n = await as(s.users.nonMember);
    await app.actions.group.requestWaitingList(n.request, s.group.id, 'premier message');

    const res = await app.actions.group.requestWaitingList(n.request, s.group.id, 'second message');

    expect(res.status).toBe(302);
    expect(await waiting(s.users.nonMember.id, s.group.id)).toEqual([{ message: 'premier message' }]);
  });

  test('someone waiting for another group can ask for this one too', { tag: ['@GRP-WAI-009'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    const other = await make.group({ name: 'Autre AMAP', regOption: 'WaitingList', contact: await make.user() });
    await make.waitingList({ group: other, user: s.users.nonMember });
    const n = await as(s.users.nonMember);

    await app.actions.group.requestWaitingList(n.request, s.group.id);

    expect(await waiting(s.users.nonMember.id, s.group.id)).toHaveLength(1);
    expect(await waiting(s.users.nonMember.id, other.id)).toHaveLength(1);
  });
});

test.describe('leaving the waiting list', () => {
  test('a person on the list takes their request back', { tag: ['@GRP-WAI-003', '@GRP-WAI-010'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    await make.waitingList({ group: s.group, user: s.users.nonMember });
    const n = await as(s.users.nonMember);

    const res = await app.actions.group.leaveWaitingList(n.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/group/${s.group.id}`);
    expect(await waiting(s.users.nonMember.id, s.group.id)).toEqual([]);
  });

  test('only their own request goes, and only in that group', { tag: ['@GRP-WAI-003'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    const other = await make.group({ name: 'Autre AMAP', regOption: 'WaitingList', contact: await make.user() });
    const neighbour = await make.user();
    await make.waitingList({ group: s.group, user: s.users.nonMember });
    await make.waitingList({ group: s.group, user: neighbour });
    await make.waitingList({ group: other, user: s.users.nonMember });
    const n = await as(s.users.nonMember);

    await app.actions.group.leaveWaitingList(n.request, s.group.id);

    expect(await waiting(neighbour.id, s.group.id)).toHaveLength(1);
    expect(await waiting(s.users.nonMember.id, other.id)).toHaveLength(1);
  });

  test('someone who is not on the list gets a refusal and nothing changes', { tag: ['@GRP-WAI-010'] }, async ({ app, as }) => {
    const s = await waitingListScenario();
    const neighbour = await make.user();
    await make.waitingList({ group: s.group, user: neighbour });
    const n = await as(s.users.nonMember);

    const res = await app.actions.group.leaveWaitingList(n.request, s.group.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/group/${s.group.id}`);
    expect(await waiting(neighbour.id, s.group.id)).toHaveLength(1);
  });

  test('a visitor who is not logged in is refused', { tag: ['@GRP-WAI-003'] }, async ({ app, anon }) => {
    const s = await waitingListScenario();
    await make.waitingList({ group: s.group, user: s.users.nonMember });

    const res = await app.actions.group.leaveWaitingList(anon.request, s.group.id);

    expect(res.status).toBe(302);
    expect(await waiting(s.users.nonMember.id, s.group.id)).toHaveLength(1);
  });
});

test.describe('putting a member back on the waiting list (hx link of the member sheet)', () => {
  async function asManager(app: any, as: any, s: make.AmapScenario) {
    const m = await as(s.users.membershipManager);
    await app.actions.group.select(m.request, s.group.id);
    return m;
  }

  test('the member leaves the group and waits, with the name of the manager in the message', { tag: ['@GRP-WAI-007', '@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await asManager(app, as, s);

    const res = await app.actions.members.moveToWaitingList(m.request, s.users.member.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/member');
    expect(res.flash?.kind).toBe('ok');
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(0);
    // User.getName(): LASTNAME Firstname (Haxe upper-cases ASCII only: "ADHéSIONS")
    const [entry] = await waiting(s.users.member.id, s.group.id);
    expect(entry.message).toMatch(/^Remis en liste d'attente par ADH\S+SIONS Adèle$/);
  });

  test('no security token is needed (ERRATUM, CODE-025: a plain GET does it)', { tag: ['@GRP-WAI-007', '@GRP-WAI-011'] }, async ({ app, as }) => {
    // UND-034 (undecided) suggests keeping the checks and asking for a token: hx has none
    const s = await make.amapScenario();
    const m = await asManager(app, as, s);

    await app.actions.members.moveToWaitingList(m.request, s.users.member2.id);

    expect(await memberOf(s.users.member2.id, s.group.id)).toBe(0);
    expect(await waiting(s.users.member2.id, s.group.id)).toHaveLength(1);
  });

  test('a manager cannot put themselves back', { tag: ['@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await asManager(app, as, s);

    const res = await app.actions.members.moveToWaitingList(m.request, s.users.membershipManager.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/member/view/${s.users.membershipManager.id}`);
    expect(await memberOf(s.users.membershipManager.id, s.group.id)).toBe(1);
    expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
  });

  test('a group admin cannot be put back', { tag: ['@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await asManager(app, as, s);

    const res = await app.actions.members.moveToWaitingList(m.request, s.users.groupAdmin.id);

    expect(res.location).toBe(`/member/view/${s.users.groupAdmin.id}`);
    expect(await memberOf(s.users.groupAdmin.id, s.group.id)).toBe(1);
    expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
  });

  test('someone who is not a member of the group cannot be put back', { tag: ['@GRP-WAI-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await asManager(app, as, s);

    const res = await app.actions.members.moveToWaitingList(m.request, s.users.nonMember.id);

    expect(res.status).toBe(302);
    expect(res.location).toBe(`/member/view/${s.users.nonMember.id}`);
    expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
  });

  test('a member who already waits is not added twice and stays a member', { tag: ['@GRP-WAI-007'] }, async ({ app, as }) => {
    // UND-034 (undecided): hx rejects the duplicate
    const s = await make.amapScenario();
    await make.waitingList({ group: s.group, user: s.users.member, message: 'déjà là' });
    const m = await asManager(app, as, s);

    const res = await app.actions.members.moveToWaitingList(m.request, s.users.member.id);

    expect(res.location).toBe(`/member/view/${s.users.member.id}`);
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
    expect(await waiting(s.users.member.id, s.group.id)).toEqual([{ message: 'déjà là' }]);
  });

  const refused = [
    ['a plain member', 'member'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} is sent away and nothing moves`, { tag: ['@GRP-WAI-008'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);
      await app.actions.group.select(u.request, s.group.id);

      const res = await app.actions.members.moveToWaitingList(u.request, s.users.member2.id);

      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(await memberOf(s.users.member2.id, s.group.id)).toBe(1);
      expect(await query('SELECT 1 FROM WaitingList')).toHaveLength(0);
    });
  }

  test('a group admin without the membership right is sent away too', { tag: ['@GRP-WAI-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await make.user();
    await make.userGroup({ user: a, group: s.group, rights: [Right.GroupAdmin()] });
    const u = await as(a);
    await app.actions.group.select(u.request, s.group.id);

    const res = await app.actions.members.moveToWaitingList(u.request, s.users.member.id);

    expect(res.location).toBe('/');
    expect(await memberOf(s.users.member.id, s.group.id)).toBe(1);
  });
});
