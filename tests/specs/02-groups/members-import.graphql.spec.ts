/**
 * Adding members by import (specs/02-groups/members-import.md; camap-ts group-previews-members.resolver.ts
 * importAndCreateMembers, sendInvitesToNewMembers, reached through the hx origin).
 * The invitation link itself is opened in 01-accounts/impersonation-invitations.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import { Right } from '../../src/encodings/rights.js';
import type { ImportedPerson } from '../../src/targets/types.js';
import type { QueuedMail } from '../../src/mails.js';

const NEO: ImportedPerson = { firstName: 'Neo', lastName: 'Nouveau', email: 'neo@camap.test', phone: '0601020304', zipCode: '44000', city: 'Nantes', address1: '1 rue des Lilas' };
const ZED: ImportedPerson = { firstName: 'Zed', lastName: 'Zeste', email: 'zed@camap.test' };

const memberOf = async (userId: number, groupId: number) => (await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId])).length;
const userByEmail = async (email: string) => (await query('SELECT * FROM User WHERE email = ?', [email]))[0];

/** The first link of a mail that matches `pattern`, as a path (the mail holds an absolute URL, with `&amp;`). */
function linkIn(mail: QueuedMail, pattern: RegExp): string {
  const hrefs = [...(mail.htmlBody ?? '').matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const href = hrefs.find((h) => pattern.test(h));
  if (!href) throw new Error(`no link matching ${pattern} in: ${hrefs.join(' ')}`);
  return href.replace(/^https?:\/\/[^/]+/, '');
}

/** A member who is a group admin but does not hold the membership right. */
async function adminWithoutMembershipRight(s: make.AmapScenario) {
  const u = await make.user({ firstName: 'Alex', lastName: 'Adminseul' });
  await make.userGroup({ user: u, group: s.group, rights: [Right.GroupAdmin()] });
  return u;
}

test.describe('creating accounts and adding people (importAndCreateMembers)', () => {
  test('a membership manager adds people to a closed group', { tag: ['@GRP-IMP-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { regOption: 'Closed' } });
    const mm = await as(s.users.membershipManager);

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [NEO] });

    expect(res.errors).toBeNull();
    const neo = await userByEmail(NEO.email);
    expect(await memberOf(neo.id, s.group.id)).toBe(1);
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(1);
    expect(res.data!.importAndCreateMembers.withAccounts).toEqual([s.users.nonMember.id]);
  });

  for (const regOption of ['WaitingList', 'Open', 'Full'] as const) {
    test(`it works for a group whose join option is ${regOption}`, { tag: ['@GRP-IMP-001'] }, async ({ app, as }) => {
      const s = await make.amapScenario({ group: { regOption } });
      const mm = await as(s.users.membershipManager);

      const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [] });

      expect(res.errors).toBeNull();
      expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(1);
    });
  }

  test('a person with no account gets an account with the details given', { tag: ['@GRP-IMP-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

    expect(res.errors).toBeNull();
    const neo = await userByEmail(NEO.email);
    expect(neo).toMatchObject({ firstName: 'Neo', lastName: 'Nouveau', phone: '0601020304', zipCode: '44000', city: 'Nantes', ldate: null });
    expect(neo.address1).toContain('1 rue des Lilas');
    expect(await memberOf(neo.id, s.group.id)).toBe(1);
  });

  test('the new person receives a link to choose a password, valid for 2 weeks', { tag: ['@GRP-IMP-002'] }, async ({ app, as, anon, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

    const neo = await userByEmail(NEO.email);
    const sent = await mails.to(NEO.email, mark);
    expect(sent).toHaveLength(1);
    const link = linkIn(sent[0], /\/user\/forgottenPassword\//);
    const token = res.data!.importAndCreateMembers.withoutAccounts[0];
    expect(link).toContain(`/user/forgottenPassword/${token}/${neo.id}`);
    const [cache] = await query<{ value: string; seconds: number }>('SELECT value, TIMESTAMPDIFF(SECOND, cdate, expire) AS seconds FROM Cache WHERE name = ?', [token]);
    expect(cache.seconds).toBe(14 * 24 * 3600);
    expect(cache.value).toBe(`i${neo.id}`);

    // the link opens the form to choose a password
    const page = await app.actions.account.openResetLink(anon.request, link);
    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
  });

  test('several lines with the same email create one account only', { tag: ['@GRP-IMP-002'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO, { ...NEO, firstName: 'Doublon' }] });

    expect(res.errors).toBeNull();
    expect(await query('SELECT id FROM User WHERE email = ?', [NEO.email])).toHaveLength(1);
    expect(await mails.to(NEO.email, mark)).toHaveLength(1);
  });

  test('a line whose email already has an account is ignored: nobody is added or mailed (characterised)', { tag: ['@GRP-IMP-002', '@GRP-IMP-003'] }, async ({ app, as, mails }) => {
    // The caller is expected to send existing accounts in `withAccounts`; an existing email listed as "new" is skipped silently.
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [{ ...NEO, email: s.users.nonMember.email }] });

    expect(res.errors).toBeNull();
    expect(res.data!.importAndCreateMembers).toEqual({ withoutAccounts: [], withAccounts: [] });
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
    expect(await mails.since(mark)).toEqual([]);
  });

  test('an invalid email refuses the whole import', { tag: ['@GRP-IMP-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO, { ...ZED, email: 'not-an-email' }] });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await userByEmail(NEO.email)).toBeUndefined();
  });

  test('a person who already has an account is added to the group and receives a link to the group page', { tag: ['@GRP-IMP-003'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [] });

    expect(res.errors).toBeNull();
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(1);
    const sent = await mails.to(s.users.nonMember.email, mark);
    expect(sent).toHaveLength(1);
    expect(linkIn(sent[0], new RegExp(`/group/${s.group.id}$`))).toBe(`/group/${s.group.id}`);
    // an existing account is not touched
    expect(await query('SELECT id FROM User WHERE email = ?', [s.users.nonMember.email])).toHaveLength(1);
  });

  test('a person who is already a member is neither added again nor mailed', { tag: ['@GRP-IMP-003'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id, withAccounts: [s.users.member.id], withoutAccounts: [] });

    expect(res.errors).toBeNull();
    expect(res.data!.importAndCreateMembers.withAccounts).toEqual([]);
    expect(await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [s.users.member.id, s.group.id])).toHaveLength(1);
    expect(await mails.to(s.users.member.email, mark)).toEqual([]);
  });

  test('an unknown group is refused', { tag: ['@GRP-IMP-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);

    const res = await app.api.members.importAndCreate(mm.request, { groupId: s.group.id + 1000, withAccounts: [], withoutAccounts: [NEO] });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await userByEmail(NEO.email)).toBeUndefined();
  });
});

test.describe('inviting people by email (sendInvitesToNewMembers)', () => {
  test('a person with no account gets an invitation, and no account is created', { tag: ['@GRP-IMP-004'] }, async ({ app, as, anon, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.invite(mm.request, { groupId: s.group.id, withAccounts: [], withoutAccounts: [NEO] });

    expect(res.errors).toBeNull();
    expect(await userByEmail(NEO.email)).toBeUndefined();
    const sent = await mails.to(NEO.email, mark);
    expect(sent).toHaveLength(1);
    const link = linkIn(sent[0], /\/invite\//);
    expect(link).toMatch(new RegExp(`^/invite/[0-9a-f]{40}/${NEO.email}/${s.group.id}\\?`));
    expect(link).toContain(app.actions.invitations.hashFor(NEO.email));
    // the details typed by the manager are kept for 2 weeks
    const token = res.data!.sendInvitesToNewMembers.withoutAccounts[0];
    const [cache] = await query<{ value: string; seconds: number }>('SELECT value, TIMESTAMPDIFF(SECOND, cdate, expire) AS seconds FROM Cache WHERE name = ?', [token]);
    expect(cache.seconds).toBe(14 * 24 * 3600);
    expect(JSON.parse(cache.value)).toMatchObject({ email: NEO.email, firstName: 'Neo', lastName: 'Nouveau' });

    // the link opens the registration for that email
    const opened = await app.actions.invitations.open(anon.request, { hash: app.actions.invitations.hashFor(NEO.email), email: NEO.email, groupId: s.group.id });
    expect(opened.status).toBe(200);
    expect(opened.body).toContain(NEO.email);
  });

  test('a person who has an account gets an invitation to join and is not added until they accept', { tag: ['@GRP-IMP-004'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario();
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();

    const res = await app.api.members.invite(mm.request, { groupId: s.group.id, withAccounts: [s.users.nonMember.id, s.users.member.id], withoutAccounts: [] });

    expect(res.errors).toBeNull();
    expect(res.data!.sendInvitesToNewMembers.withAccounts).toEqual([s.users.nonMember.id]); // member already belongs to the group
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
    const sent = await mails.to(s.users.nonMember.email, mark);
    expect(sent).toHaveLength(1);
    expect(linkIn(sent[0], /\/invite\//)).toMatch(new RegExp(`^/invite/[0-9a-f]{40}/${s.users.nonMember.email}/${s.group.id}/${s.users.nonMember.id}$`));
    expect(await mails.to(s.users.member.email, mark)).toEqual([]);
  });

  test('the link of the invitation makes the existing person join, even in a closed group', { tag: ['@GRP-IMP-004'] }, async ({ app, as, mails }) => {
    const s = await make.amapScenario({ group: { regOption: 'Closed' } });
    const mm = await as(s.users.membershipManager);
    const mark = await mails.mark();
    await app.api.members.invite(mm.request, { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [] });
    const link = linkIn((await mails.to(s.users.nonMember.email, mark))[0], /\/invite\//);
    const outsider = await as(s.users.nonMember);

    const res = await outsider.request.get(link, { maxRedirects: 0 });

    expect(res.status()).toBe(302);
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(1);
  });
});

test.describe('who can import', () => {
  const refused = [
    ['a plain member', (s: make.AmapScenario) => s.users.member],
    ['a catalog coordinator', (s: make.AmapScenario) => s.users.coordinator],
    ['a messages manager', (s: make.AmapScenario) => s.users.messagesManager],
  ] as const;

  for (const [label, who] of refused) {
    test(`${label} cannot import or invite`, { tag: ['@GRP-IMP-005'] }, async ({ app, as, mails }) => {
      const s = await make.amapScenario();
      const u = await as(who(s));
      const mark = await mails.mark();
      const input = { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [NEO] };

      const imported = await app.api.members.importAndCreate(u.request, input);
      const invited = await app.api.members.invite(u.request, input);

      expect(imported.errors?.[0].message).toMatch(/membership right/);
      expect(invited.errors?.[0].message).toMatch(/membership right/);
      expect(await userByEmail(NEO.email)).toBeUndefined();
      expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
      expect(await mails.since(mark)).toEqual([]);
    });
  }

  test('a group admin without the membership right cannot import or invite', { tag: ['@GRP-IMP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await adminWithoutMembershipRight(s);
    const a = await as(admin);
    const input = { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [NEO] };

    const imported = await app.api.members.importAndCreate(a.request, input);
    const invited = await app.api.members.invite(a.request, input);

    expect(imported.errors?.length).toBeGreaterThan(0);
    expect(invited.errors?.length).toBeGreaterThan(0);
    expect(await userByEmail(NEO.email)).toBeUndefined();
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
  });

  test('a manager of another group cannot import into this one', { tag: ['@GRP-IMP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    const manager = await make.user();
    await make.userGroup({ user: manager, group: other, rights: [Right.Membership()] });
    const m = await as(manager);

    const res = await app.api.members.importAndCreate(m.request, { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [] });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(0);
  });

  test('a visitor cannot import or invite', { tag: ['@GRP-IMP-005'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const input = { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [NEO] };

    const imported = await app.api.members.importAndCreate(anon.request, input);
    const invited = await app.api.members.invite(anon.request, input);

    expect(imported.errors?.length).toBeGreaterThan(0);
    expect(invited.errors?.length).toBeGreaterThan(0);
    expect(await userByEmail(NEO.email)).toBeUndefined();
  });

  test('a superadmin can import into any group', { tag: ['@GRP-IMP-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.api.members.importAndCreate(admin.request, { groupId: s.group.id, withAccounts: [s.users.nonMember.id], withoutAccounts: [] });

    expect(res.errors).toBeNull();
    expect(await memberOf(s.users.nonMember.id, s.group.id)).toBe(1);
  });
});
