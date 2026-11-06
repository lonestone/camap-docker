/**
 * The rights editor of the group administration (specs/02-groups/rights.md; camap-hx
 * controller/AmapAdmin.hx doEditRight, db/UserGroup.hx giveRight): what it offers, giving and
 * replacing rights, the self-lockout rule, the person who is not a member, who may use it.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';
import { decodeRights, Right, type JsonRight } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp, RightsChoice } from '../../src/targets/types.js';
import type { APIRequestContext } from '@playwright/test';

type As = (u: any) => Promise<{ request: APIRequestContext }>;

const rightsOf = async (userId: number, groupId: number) =>
  decodeRights((await queryOne<{ rights: string | null }>('SELECT rights FROM UserGroup WHERE userId = ? AND groupId = ?', [userId, groupId]))!.rights);
const rowsOf = (userId: number) => query<{ groupId: number }>('SELECT groupId FROM UserGroup WHERE userId = ?', [userId]);

/** The stored rights, whatever their order. */
const expectRights = (actual: JsonRight[], expected: JsonRight[]) => {
  expect(actual).toHaveLength(expected.length);
  expect(actual).toEqual(expect.arrayContaining(expected));
};

async function adminOf(app: CamapApp, as: As, s: make.AmapScenario, who: 'groupAdmin' | 'superadmin' = 'groupAdmin') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

const SAVED = '/amapadmin/rights';

test.describe('what the rights editor offers', () => {
  test('giving rights to a new person: the four kinds of rights, all catalogs and each active catalog, among the members', { tag: ['@GRP-RIG-001', '@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const editor = await app.actions.groupAdmin.rightsEditor(a.request);

    expect(editor.status).toBe(200);
    expect(editor.groupRights.offered).toEqual(['GroupAdmin', 'Membership', 'Messages']);
    expect(editor.catalogRights.offered).toEqual(['all', s.constCatalog.id, s.varCatalog.id]);
    expect(editor.groupRights.checked).toEqual([]);
    expect(editor.catalogRights.checked).toEqual([]);
    const members = [s.users.member, s.users.member2, s.users.coordinator, s.users.membershipManager, s.users.messagesManager, s.users.groupAdmin].map((u) => u.id);
    expect([...editor.members!].sort((x, y) => x - y)).toEqual(members.sort((x, y) => x - y));
  });

  // (hx lists the catalogs ended less than 30 days ago as well: Group.getActiveContracts(true))
  test('the catalogs offered are the active ones of this group: a long ended catalog or one of another group is left out', { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const now = clock.now();
    await make.catalog({ group: s.group, vendor: s.vendor, name: 'Terminé', startDate: addDaysWall(now, -200), endDate: addDaysWall(now, -60) });
    const upcoming = await make.catalog({ group: s.group, vendor: s.vendor, name: 'À venir', startDate: addDaysWall(now, 20), endDate: addDaysWall(now, 200) });
    const other = await make.group({ name: 'Autre groupe' });
    await make.catalog({ group: other, vendor: s.vendor, name: 'Étranger' });
    const a = await adminOf(app, as, s);

    const editor = await app.actions.groupAdmin.rightsEditor(a.request);

    expect(editor.catalogRights.offered).toEqual(['all', s.constCatalog.id, s.varCatalog.id, upcoming.id]);
  });

  test('editing a member: what they hold is ticked, and the person cannot be changed', { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const admin = await app.actions.groupAdmin.rightsEditor(a.request, s.users.groupAdmin.id);
    const coordinator = await app.actions.groupAdmin.rightsEditor(a.request, s.users.coordinator.id);
    const nobody = await app.actions.groupAdmin.rightsEditor(a.request, s.users.member.id);

    expect(admin.members).toBeNull();
    expect(admin.groupRights.checked).toEqual(['GroupAdmin', 'Membership', 'Messages']);
    expect(admin.catalogRights.checked).toEqual(['all']);
    expect(coordinator.groupRights.checked).toEqual([]);
    expect(coordinator.catalogRights.checked).toEqual([s.constCatalog.id, s.varCatalog.id]);
    expect(nobody.groupRights.checked).toEqual([]);
    expect(nobody.catalogRights.checked).toEqual([]);
  });

  // UND-031 (undecided; suggestion: keep the Haxe semantics): the automatic rights come from the claimed vendor record.
  test('a vendor member: the rights they get automatically are shown apart, and are not ticked', { tag: ['@GRP-RIG-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.vendor, group: s.group, rights: [Right.Messages()] });
    const a = await adminOf(app, as, s);

    const editor = await app.actions.groupAdmin.rightsEditor(a.request, s.users.vendor.id);

    expect(editor.automatic).toHaveLength(2);
    expect(editor.automatic.join(' ')).toContain('Légumes');
    expect(editor.automatic.join(' ')).toContain('Œufs');
    expect(editor.groupRights.checked).toEqual(['Messages']);
    expect(editor.catalogRights.checked).toEqual([]);
  });

  test('a member who is not a vendor has no automatic rights', { tag: ['@GRP-RIG-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    expect((await app.actions.groupAdmin.rightsEditor(a.request, s.users.coordinator.id)).automatic).toEqual([]);
  });
});

test.describe('giving rights', () => {
  const cases: [string, (s: make.AmapScenario) => RightsChoice, (s: make.AmapScenario) => JsonRight[]][] = [
    ['group admin', () => ({ groupAdmin: true }), () => [Right.GroupAdmin()]],
    ['membership', () => ({ membership: true }), () => [Right.Membership()]],
    ['messages', () => ({ messages: true }), () => [Right.Messages()]],
    ['all catalogs', () => ({ allCatalogs: true }), () => [Right.ContractAdmin()]],
    ['one catalog', (s) => ({ catalogs: [s.varCatalog.id] }), (s) => [Right.ContractAdmin(s.varCatalog.id)]],
    ['two catalogs', (s) => ({ catalogs: [s.constCatalog.id, s.varCatalog.id] }), (s) => [Right.ContractAdmin(s.constCatalog.id), Right.ContractAdmin(s.varCatalog.id)]],
    [
      'a mix',
      (s) => ({ messages: true, membership: true, catalogs: [s.constCatalog.id] }),
      (s) => [Right.Messages(), Right.Membership(), Right.ContractAdmin(s.constCatalog.id)],
    ],
  ];
  for (const [label, choice, stored] of cases) {
    test(`a group admin gives a member the right: ${label}`, { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await adminOf(app, as, s);

      const res = await app.actions.groupAdmin.giveRights(a.request, s.users.member.id, choice(s));

      expect(res.status).toBe(302);
      expect(res.location).toBe(SAVED);
      expect(res.flash?.kind).toBe('ok');
      expectRights(await rightsOf(s.users.member.id, s.group.id), stored(s));
    });
  }

  test('the member then manages what they were given, and nothing else', { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);
    await app.actions.groupAdmin.giveRights(a.request, s.users.member.id, { messages: true, catalogs: [s.varCatalog.id] });
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    expect((await app.views.messages.page(m.request)).status).toBe(200);
    expect((await app.views.catalogs.dashboard(m.request, s.varCatalog.id)).status).toBe(200);
    expect((await app.views.catalogs.dashboard(m.request, s.constCatalog.id)).status).toBe(302);
    expect((await app.views.member.list(m.request)).status).toBe(302);
    expect((await app.views.groupAdmin.dashboard(m.request)).status).toBe(302);
  });

  test('a member who is given the group admin right opens the administration', { tag: ['@GRP-RIG-008', '@GRP-RIG-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);
    await app.actions.groupAdmin.giveRights(a.request, s.users.member.id, { groupAdmin: true });
    const m = await as(s.users.member);
    await app.actions.group.select(m.request, s.group.id);

    expect((await app.views.groupAdmin.dashboard(m.request)).status).toBe(200);
  });

  test('a superadmin gives rights too', { tag: ['@GRP-RIG-008', '@GRP-RIG-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s, 'superadmin');

    const res = await app.actions.groupAdmin.giveRights(a.request, s.users.member.id, { messages: true });

    expect(res.location).toBe(SAVED);
    expect(await rightsOf(s.users.member.id, s.group.id)).toEqual([Right.Messages()]);
  });

  test('giving rights changes nobody else', { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    await app.actions.groupAdmin.giveRights(a.request, s.users.member.id, { messages: true });

    expect(await rightsOf(s.users.member2.id, s.group.id)).toEqual([]);
    expectRights(await rightsOf(s.users.coordinator.id, s.group.id), [Right.ContractAdmin(s.constCatalog.id), Right.ContractAdmin(s.varCatalog.id)]);
  });
});

test.describe('replacing the rights of a member', () => {
  test('saving replaces the whole list: the rights that are not ticked are removed', { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.editRights(a.request, s.users.coordinator.id, { messages: true });

    expect(res.location).toBe(SAVED);
    expect(res.flash?.kind).toBe('ok');
    expect(await rightsOf(s.users.coordinator.id, s.group.id)).toEqual([Right.Messages()]);
    // and the coordinator no longer manages the catalogs
    const c = await as(s.users.coordinator);
    await app.actions.group.select(c.request, s.group.id);
    expect((await app.views.catalogs.list(c.request)).status).toBe(302);
    expect((await app.views.messages.page(c.request)).status).toBe(200);
  });

  test('"all catalogs" replaces a list of chosen catalogs', { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    await app.actions.groupAdmin.editRights(a.request, s.users.coordinator.id, { allCatalogs: true });

    expect(await rightsOf(s.users.coordinator.id, s.group.id)).toEqual([Right.ContractAdmin()]);
  });

  test('ticking nothing removes every right: the member is no longer listed, and stays a member', { tag: ['@GRP-RIG-008', '@GRP-RIG-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.editRights(a.request, s.users.messagesManager.id, {});

    expect(res.location).toBe(SAVED);
    expect(res.flash?.kind).toBe('ok');
    expect(await rightsOf(s.users.messagesManager.id, s.group.id)).toEqual([]);
    expect(await rowsOf(s.users.messagesManager.id)).toEqual([{ groupId: s.group.id }]);
    const holders = (await app.views.groupAdmin.rights(a.request)).holders;
    expect(holders.map((h) => h.userId)).not.toContain(s.users.messagesManager.id);
    const m = await as(s.users.messagesManager);
    await app.actions.group.select(m.request, s.group.id);
    expect((await app.views.messages.page(m.request)).status).toBe(302);
  });

  test('a group admin can remove the rights of another group admin', { tag: ['@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const second = await make.user();
    await make.userGroup({ user: second, group: s.group, rights: [Right.GroupAdmin()] });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.editRights(a.request, second.id, {});

    expect(res.flash?.kind).toBe('ok');
    expect(await rightsOf(second.id, s.group.id)).toEqual([]);
  });

  // UND-031 (undecided): vendor automatic rights are not stored; saving the editor keeps only what was ticked.
  test('the automatic rights of a vendor are not stored when the editor is saved', { tag: ['@GRP-RIG-006', '@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.vendor, group: s.group, rights: [Right.Messages()] });
    const a = await adminOf(app, as, s);

    await app.actions.groupAdmin.editRights(a.request, s.users.vendor.id, { messages: true, membership: true });

    expectRights(await rightsOf(s.users.vendor.id, s.group.id), [Right.Messages(), Right.Membership()]);
    const v = await as(s.users.vendor);
    await app.actions.group.select(v.request, s.group.id);
    expect((await app.views.catalogs.dashboard(v.request, s.constCatalog.id)).status).toBe(200);
  });
});

test.describe('a group admin cannot remove their own group admin right', () => {
  // UND-030 (undecided; suggestion: validate before saving, in one transaction). hx today: the rights are
  // written before the check (CODE-029), but the refusal rolls the transaction back, so nothing is kept.
  test('hx today: the refusal leaves their rights unchanged', { tag: ['@GRP-RIG-009', '@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const before = await rightsOf(s.users.groupAdmin.id, s.group.id);
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.editRights(a.request, s.users.groupAdmin.id, { messages: true, membership: true });

    expect(res.location).toBe(SAVED);
    expect(res.flash?.kind).toBe('error');
    expect(await rightsOf(s.users.groupAdmin.id, s.group.id)).toEqual(before);
    expect(before).toHaveLength(4);
  });

  test('ticking nothing is refused too', { tag: ['@GRP-RIG-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const before = await rightsOf(s.users.groupAdmin.id, s.group.id);
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.editRights(a.request, s.users.groupAdmin.id, {});

    expect(res.flash?.kind).toBe('error');
    expect(await rightsOf(s.users.groupAdmin.id, s.group.id)).toEqual(before);
  });

  test('they can change their other rights while they keep the group admin right', { tag: ['@GRP-RIG-009', '@GRP-RIG-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.editRights(a.request, s.users.groupAdmin.id, { groupAdmin: true, membership: true });

    expect(res.flash?.kind).toBe('ok');
    expectRights(await rightsOf(s.users.groupAdmin.id, s.group.id), [Right.GroupAdmin(), Right.Membership()]);
  });
});

test.describe('choosing a person who is not a member of the group', () => {
  // UND-030 (undecided; suggestion: a clear error, nothing written). hx today: the form accepts any user id
  // and the page crashes ("Invalid field access : rights"); nothing is saved, nobody joins the group.
  test('hx today: giving rights to a non-member crashes and changes nothing', { tag: ['@GRP-RIG-010'] }, async ({ app, as, errors }) => {
    errors.expect(/Invalid field access : rights/);
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.giveRights(a.request, s.users.nonMember.id, { messages: true });

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(res.body).toContain('Invalid field access : rights');
    expect(await rowsOf(s.users.nonMember.id)).toEqual([]);
  });

  test('hx today: a person of another group only is not a member either', { tag: ['@GRP-RIG-010'] }, async ({ app, as, errors }) => {
    errors.expect(/Invalid field access : rights/);
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const stranger = await make.user();
    await make.userGroup({ user: stranger, group: other, rights: [] });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.giveRights(a.request, stranger.id, { groupAdmin: true });

    expect(res.status).toBe(200);
    expect(await rowsOf(stranger.id)).toEqual([{ groupId: other.id }]);
    expect(await rightsOf(stranger.id, other.id)).toEqual([]);
  });

  test('editing the rights of a non-member is refused with "no user"; nothing is changed', { tag: ['@GRP-RIG-010'] }, async ({ app, as, errors }) => {
    errors.expect(/no user/);
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const editor = await app.actions.groupAdmin.rightsEditor(a.request, s.users.nonMember.id);
    const res = await app.actions.groupAdmin.editRights(a.request, s.users.nonMember.id, { messages: true });

    expect(editor.groupRights.offered).toEqual([]); // no form: an error page
    expect(res.location).toBeNull();
    expect(res.body).toContain('no user');
    expect(await rowsOf(s.users.nonMember.id)).toEqual([]);
  });
});

test.describe('who can use the rights editor', () => {
  const refused = [
    ['a membership manager', 'membershipManager'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
    ['a plain member', 'member'],
  ] as const;
  for (const [label, who] of refused) {
    test(`${label} is sent back to the home page and nothing is saved`, { tag: ['@GRP-RIG-011', '@GRP-RIG-008'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await as(s.users[who]);
      await app.actions.group.select(u.request, s.group.id);
      const before = await rightsOf(s.users.member2.id, s.group.id);

      const give = await app.actions.groupAdmin.giveRights(u.request, s.users.member2.id, { groupAdmin: true });
      const edit = await app.actions.groupAdmin.editRights(u.request, s.users.member.id, { groupAdmin: true });

      expect([give.status, give.location]).toEqual([302, '/']);
      expect([edit.status, edit.location]).toEqual([302, '/']);
      expect(await rightsOf(s.users.member2.id, s.group.id)).toEqual(before);
      expect(await rightsOf(s.users.member.id, s.group.id)).toEqual([]);
    });
  }

  test('a group admin of another group cannot give rights in this one', { tag: ['@GRP-RIG-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const u = await make.user();
    await make.userGroup({ user: u, group: s.group, rights: [] });
    await make.userGroup({ user: u, group: other, rights: [Right.GroupAdmin()] });
    const a = await as(u);
    await app.actions.group.select(a.request, s.group.id);

    const res = await app.actions.groupAdmin.giveRights(a.request, s.users.member.id, { messages: true });

    expect([res.status, res.location]).toEqual([302, '/']);
    expect(await rightsOf(s.users.member.id, s.group.id)).toEqual([]);
  });
});
