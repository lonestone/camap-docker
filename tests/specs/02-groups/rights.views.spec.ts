/**
 * Group rights as seen through the pages they open (specs/02-groups/rights.md; camap-hx
 * db/UserGroup.hx hasRight, db/User.hx isAmapManager / canAccessMembership / canAccessMessages /
 * isContractManager, controller/AmapAdmin.hx doRights): what each right opens, the superadmin,
 * the coordinator of all or some catalogs, the vendor's automatic rights, the list of holders.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query } from '../../src/db/client.js';
import { Right, type JsonRight } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';
import type { APIRequestContext } from '@playwright/test';

type Who = { id: number; email: string; password: string };
type As = (u: any) => Promise<{ request: APIRequestContext }>;

/** A member of the group with exactly these rights. */
async function memberWith(s: make.AmapScenario, rights: JsonRight[]) {
  const u = await make.user();
  await make.userGroup({ user: u, group: s.group, rights });
  return u;
}

/** Which areas of the group a person can open: administration, members, messages, catalogs. */
async function reach(app: CamapApp, as: As, s: make.AmapScenario, user: Who, groupId = s.group.id) {
  const a = await as(user);
  await app.actions.group.select(a.request, groupId);
  const open = (p: { status: number; location: string | null }) => {
    if (p.status === 200) return true;
    expect(p.location).toBe('/'); // every refusal is a redirect to the home page
    return false;
  };
  return {
    administration: open(await app.views.groupAdmin.dashboard(a.request)),
    members: open(await app.views.member.list(a.request)),
    messages: open(await app.views.messages.page(a.request)),
    catalogs: open(await app.views.catalogs.list(a.request)),
  };
}

const NOTHING = { administration: false, members: false, messages: false, catalogs: false };

test.describe('a right never grants another one', () => {
  test('a group admin without the other rights opens the administration only', { tag: ['@GRP-RIG-001', '@GRP-RIG-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const u = await memberWith(s, [Right.GroupAdmin()]);

    expect(await reach(app, as, s, u)).toEqual({ ...NOTHING, administration: true });
  });

  test('a membership manager opens the members only', { tag: ['@GRP-RIG-001', '@GRP-RIG-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    expect(await reach(app, as, s, s.users.membershipManager)).toEqual({ ...NOTHING, members: true });
  });

  test('a messages manager opens the messages only', { tag: ['@GRP-RIG-001', '@GRP-RIG-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    expect(await reach(app, as, s, s.users.messagesManager)).toEqual({ ...NOTHING, messages: true });
  });

  test('a catalog coordinator opens the catalogs only', { tag: ['@GRP-RIG-001', '@GRP-RIG-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    expect(await reach(app, as, s, s.users.coordinator)).toEqual({ ...NOTHING, catalogs: true });
  });

  test('a plain member opens none of them', { tag: ['@GRP-RIG-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    expect(await reach(app, as, s, s.users.member)).toEqual(NOTHING);
  });

  test('somebody who holds the four rights opens all four', { tag: ['@GRP-RIG-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    expect(await reach(app, as, s, s.users.groupAdmin)).toEqual({ administration: true, members: true, messages: true, catalogs: true });
  });
});

test.describe('the superadmin', () => {
  test('a superadmin who is a member of the group opens everything and every catalog', { tag: ['@GRP-RIG-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.superadmin, group: s.group, rights: [] });

    expect(await reach(app, as, s, s.users.superadmin)).toEqual({ administration: true, members: true, messages: true, catalogs: true });
    const a = await as(s.users.superadmin);
    for (const c of [s.constCatalog, s.varCatalog]) expect((await app.views.catalogs.dashboard(a.request, c.id)).status).toBe(200);
  });

  // hx today: the messages and catalogs checks start by loading the person's membership, which a superadmin
  // outside the group does not have; administration and members have an explicit superadmin case. The statement
  // says a superadmin holds every right in every group.
  test('hx today: a superadmin outside the group opens the administration and the members, not the messages nor the catalogs', { tag: ['@GRP-RIG-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    expect(await reach(app, as, s, s.users.superadmin)).toEqual({ administration: true, members: true, messages: false, catalogs: false });
  });

  // UND-031 (undecided; suggestion: keep the Haxe semantics): the superadmin passes the rights checks without being a member.
  test('hx today: a superadmin who opens a group administration does not become one of its members', { tag: ['@GRP-RIG-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.superadmin);
    await app.actions.group.select(a.request, s.group.id);

    const dashboard = await app.views.groupAdmin.dashboard(a.request);
    await app.views.groupAdmin.rights(a.request);
    const editor = await app.actions.groupAdmin.rightsEditor(a.request);

    expect(dashboard.memberCount).toBe(6);
    expect(editor.members).not.toContain(s.users.superadmin.id);
    expect(await query('SELECT userId FROM UserGroup WHERE userId = ?', [s.users.superadmin.id])).toEqual([]);
  });
});

test.describe('the catalogs a coordinator manages', () => {
  async function scenarioWithMoreCatalogs() {
    const s = await make.amapScenario();
    const third = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain' });
    const otherVendor = await make.vendor({ name: 'Autre ferme' });
    const fourth = await make.catalog({ group: s.group, vendor: otherVendor, name: 'Fromages' });
    return { s, third, fourth };
  }

  // UND-031 (undecided; suggestion: keep the Haxe semantics): "all catalogs" = a coordinator right with no catalog list.
  test('a coordinator for all catalogs manages every catalog of the group, whoever the vendor, new ones included', { tag: ['@GRP-RIG-005'] }, async ({ app, as }) => {
    const { s, third, fourth } = await scenarioWithMoreCatalogs();
    const u = await memberWith(s, [Right.ContractAdmin()]);
    const a = await as(u);
    await app.actions.group.select(a.request, s.group.id);

    for (const c of [s.constCatalog, s.varCatalog, third, fourth]) {
      const page = await app.views.catalogs.dashboard(a.request, c.id);
      expect(page.status, c.name).toBe(200);
    }
    const list = await app.views.catalogs.list(a.request);
    for (const n of ['Légumes', 'Œufs', 'Pain', 'Fromages']) expect(list.text).toContain(n);
  });

  test('a coordinator for chosen catalogs manages those catalogs only', { tag: ['@GRP-RIG-005'] }, async ({ app, as }) => {
    const { s, third, fourth } = await scenarioWithMoreCatalogs();
    const u = await memberWith(s, [Right.ContractAdmin(s.constCatalog.id), Right.ContractAdmin(third.id)]);
    const a = await as(u);
    await app.actions.group.select(a.request, s.group.id);

    expect((await app.views.catalogs.dashboard(a.request, s.constCatalog.id)).status).toBe(200);
    expect((await app.views.catalogs.dashboard(a.request, third.id)).status).toBe(200);
    for (const c of [s.varCatalog, fourth]) {
      const page = await app.views.catalogs.dashboard(a.request, c.id);
      expect([c.name, page.status, page.location]).toEqual([c.name, 302, '/']);
    }
    const list = await app.views.catalogs.list(a.request);
    expect(list.text).toContain('Légumes');
    expect(list.text).toContain('Pain');
    expect(list.text).not.toContain('Œufs');
    expect(list.text).not.toContain('Fromages');
  });
});

test.describe("a vendor's automatic rights", () => {
  // UND-031 (undecided; suggestion: keep the Haxe semantics): automatic rights are per claimed catalog.
  test('a vendor who claimed their record and belongs to the group manages the catalogs of that vendor, and only those', { tag: ['@GRP-RIG-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const otherVendor = await make.vendor({ name: 'Autre ferme' });
    const foreign = await make.catalog({ group: s.group, vendor: otherVendor, name: 'Fromages' });
    await make.userGroup({ user: s.users.vendor, group: s.group, rights: [] });
    const a = await as(s.users.vendor);
    await app.actions.group.select(a.request, s.group.id);

    for (const c of [s.constCatalog, s.varCatalog]) expect((await app.views.catalogs.dashboard(a.request, c.id)).status).toBe(200);
    const refused = await app.views.catalogs.dashboard(a.request, foreign.id);
    expect([refused.status, refused.location]).toEqual([302, '/']);
    const list = await app.views.catalogs.list(a.request);
    expect(list.text).toContain('Légumes');
    expect(list.text).not.toContain('Fromages');
    // the automatic rights do not make them a group manager
    expect((await app.views.groupAdmin.dashboard(a.request)).status).toBe(302);
  });

  test('hx today: the same vendor outside the group manages nothing there', { tag: ['@GRP-RIG-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    expect((await reach(app, as, s, s.users.vendor)).catalogs).toBe(false);
  });

  test('automatic rights are not stored: they follow the catalogs the vendor claims', { tag: ['@GRP-RIG-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.vendor, group: s.group, rights: [] });
    const later = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Miel' });
    const a = await as(s.users.vendor);
    await app.actions.group.select(a.request, s.group.id);

    expect((await app.views.catalogs.dashboard(a.request, later.id)).status).toBe(200);
    expect(await query('SELECT rights FROM UserGroup WHERE userId = ?', [s.users.vendor.id])).toEqual([{ rights: null }]);
  });
});

test.describe('the list of members holding rights', () => {
  test('a group admin sees everybody who holds a right, and nobody else', { tag: ['@GRP-RIG-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    const page = await app.views.groupAdmin.rights(a.request);

    expect(page.status).toBe(200);
    expect(page.holders.map((h) => h.userId).sort((x, y) => x - y)).toEqual(
      [s.users.coordinator, s.users.membershipManager, s.users.messagesManager, s.users.groupAdmin].map((u) => u.id).sort((x, y) => x - y),
    );
  });

  test('every holder is shown with their rights', { tag: ['@GRP-RIG-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    const holders = (await app.views.groupAdmin.rights(a.request)).holders;

    const rightsOf = (id: number) => holders.find((h) => h.userId === id)!.rights;
    expect(rightsOf(s.users.groupAdmin.id)).toHaveLength(4);
    expect(rightsOf(s.users.coordinator.id)).toHaveLength(2);
    expect(rightsOf(s.users.coordinator.id).join(' ')).toContain('Légumes');
    expect(rightsOf(s.users.coordinator.id).join(' ')).toContain('Œufs');
    expect(rightsOf(s.users.membershipManager.id)).toHaveLength(1);
    expect(rightsOf(s.users.messagesManager.id)).toHaveLength(1);
  });

  test('a member whose rights were all removed is not listed', { tag: ['@GRP-RIG-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await execute('UPDATE UserGroup SET rights = ? WHERE userId = ? AND groupId = ?', ['[]', s.users.messagesManager.id, s.group.id]);
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    const holders = (await app.views.groupAdmin.rights(a.request)).holders;

    expect(holders.map((h) => h.userId)).not.toContain(s.users.messagesManager.id);
    expect(holders).toHaveLength(3);
  });

  test('the holders of another group are not listed', { tag: ['@GRP-RIG-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const stranger = await make.user();
    await make.userGroup({ user: stranger, group: other, rights: [Right.Messages()] });
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    expect((await app.views.groupAdmin.rights(a.request)).holders.map((h) => h.userId)).not.toContain(stranger.id);
  });

  test('a vendor member shows their automatic rights next to the ones they were given', { tag: ['@GRP-RIG-006', '@GRP-RIG-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.userGroup({ user: s.users.vendor, group: s.group, rights: [Right.Messages()] });
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    const holder = (await app.views.groupAdmin.rights(a.request)).holders.find((h) => h.userId === s.users.vendor.id)!;

    expect(holder.rights).toHaveLength(3); // messages + the two catalogs of the vendor
    expect(holder.rights.join(' ')).toContain('Légumes');
    expect(holder.rights.join(' ')).toContain('Œufs');
  });
});

test.describe('who is a group manager', () => {
  test('a group admin of the current group opens the administration pages', { tag: ['@GRP-RIG-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.groupAdmin);
    await app.actions.group.select(a.request, s.group.id);

    for (const section of ['settings', 'rights', 'vatRates', 'payments', 'media'] as const) {
      const page = await app.views.groupAdmin.section(a.request, section);
      expect([section, page.status]).toEqual([section, 200]);
    }
  });

  test('a superadmin opens them too', { tag: ['@GRP-RIG-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await as(s.users.superadmin);
    await app.actions.group.select(a.request, s.group.id);

    for (const section of ['settings', 'rights', 'vatRates', 'payments', 'media'] as const) {
      const page = await app.views.groupAdmin.section(a.request, section);
      expect([section, page.status]).toEqual([section, 200]);
    }
  });

  const others = [
    ['a membership manager', 'membershipManager'],
    ['a catalog coordinator', 'coordinator'],
    ['a messages manager', 'messagesManager'],
    ['a plain member', 'member'],
  ] as const;
  for (const [label, who] of others) {
    test(`${label} is sent back to the home page from every administration page`, { tag: ['@GRP-RIG-011'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await as(s.users[who]);
      await app.actions.group.select(a.request, s.group.id);

      // (the group settings page refuses with an error page instead: see group-settings.forms.spec.ts)
      for (const section of ['rights', 'vatRates', 'payments', 'media'] as const) {
        const page = await app.views.groupAdmin.section(a.request, section);
        expect([section, page.status, page.location]).toEqual([section, 302, '/']);
      }
    });
  }

  test('being group admin of another group is not enough', { tag: ['@GRP-RIG-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const u = await make.user();
    await make.userGroup({ user: u, group: s.group, rights: [] });
    await make.userGroup({ user: u, group: other, rights: [Right.GroupAdmin()] });

    expect((await reach(app, as, s, u, s.group.id)).administration).toBe(false);
    expect((await reach(app, as, s, u, other.id)).administration).toBe(true);
  });
});
