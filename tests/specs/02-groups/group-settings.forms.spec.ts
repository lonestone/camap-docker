/**
 * The group settings form (specs/02-groups/group-settings.md; controller/Amap.hx doEdit,
 * db/Group.hx): name, texts, website, contact, legal representative, how new members join
 * (GRP-SET-003/004) and the three options (GRP-SET-005).
 *
 * The form does not geocode anything: it can be saved in the test stack.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { GroupFlag, RegOption, flags, type RegOptionName } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';
import type { APIRequestContext } from '@playwright/test';

type Row = { name: string; txtIntro: string | null; txtHome: string | null; txtDistrib: string | null; extUrl: string | null; regOption: number; flags: number; userId: number | null; legalReprId: number | null };
const rowOf = async (id: number) =>
  (await queryOne<Row>('SELECT name, txtIntro, txtHome, txtDistrib, extUrl, regOption, flags, userId, legalReprId FROM `Group` WHERE id = ?', [id]))!;

async function adminOf(app: CamapApp, as: (u: any) => Promise<{ request: APIRequestContext }>, s: Awaited<ReturnType<typeof make.amapScenario>>, who: 'groupAdmin' | 'member' | 'membershipManager' | 'coordinator' = 'groupAdmin') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

const UPDATED = /Groupe mis à jour/;

test.describe('what the settings form offers', () => {
  test('the form shows the group as it is and offers the joining modes, three options and the members', { tag: ['@GRP-SET-002', '@GRP-SET-003', '@GRP-SET-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { txtIntro: '<p>Bienvenue</p>', extUrl: 'https://amap.example.org', flags: flags(GroupFlag, 'HidePhone') } });
    const a = await adminOf(app, as, s);

    const f = await app.actions.groupAdmin.settings(a.request);

    expect(f.status).toBe(200);
    expect(f.location).toBeNull();
    expect(f.values).toMatchObject({
      name: 'AMAP des Tests',
      txtIntro: '<p>Bienvenue</p>',
      extUrl: 'https://amap.example.org',
      regOption: 'Open',
      hidePhone: true,
      phoneRequired: false,
      addressRequired: false,
      contactId: s.users.groupAdmin.id,
      legalRepresentativeId: null,
    });
    expect(f.offered.regOptions).toEqual(['Closed', 'WaitingList', 'Open', 'Full']);
    expect(f.offered.options).toEqual(['hidePhone', 'phoneRequired', 'addressRequired']);
    // the contact and the legal representative are chosen among the members of the group
    const memberIds = [s.users.member, s.users.member2, s.users.coordinator, s.users.membershipManager, s.users.messagesManager, s.users.groupAdmin].map((u) => u.id);
    expect([...f.offered.userIds].sort()).toEqual([...memberIds].sort());
    expect(f.offered.userIds).not.toContain(s.users.nonMember.id);
  });
});

test.describe('editing the group', () => {
  test('a group admin edits the name, texts, website, contact and legal representative', { tag: ['@GRP-SET-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveSettings(a.request, {
      name: 'AMAP des Tilleuls',
      txtIntro: '<p>Notre AMAP</p>',
      txtHome: '<p>Bienvenue aux adhérents</p>',
      txtDistrib: 'Pensez à vos sacs',
      extUrl: 'https://tilleuls.example.org',
      contactId: s.users.coordinator.id,
      legalRepresentativeId: s.users.member.id,
    });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/amapadmin');
    expect(res.flash?.kind).toBe('ok');
    expect(res.flash?.text).toMatch(UPDATED);
    expect(await rowOf(s.group.id)).toMatchObject({
      name: 'AMAP des Tilleuls',
      txtIntro: '<p>Notre AMAP</p>',
      txtHome: '<p>Bienvenue aux adhérents</p>',
      txtDistrib: 'Pensez à vos sacs',
      extUrl: 'https://tilleuls.example.org',
      userId: s.users.coordinator.id,
      legalReprId: s.users.member.id,
    });
    // the form now shows what was saved
    const f = await app.actions.groupAdmin.settings(a.request);
    expect(f.values).toMatchObject({ name: 'AMAP des Tilleuls', contactId: s.users.coordinator.id, legalRepresentativeId: s.users.member.id });
  });

  test('what the form does not change keeps its value, the contact and legal representative can be removed', { tag: ['@GRP-SET-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { txtIntro: '<p>Notre AMAP</p>' } });
    const a = await adminOf(app, as, s);
    await app.actions.groupAdmin.saveSettings(a.request, { legalRepresentativeId: s.users.member.id });

    const res = await app.actions.groupAdmin.saveSettings(a.request, { contactId: null, legalRepresentativeId: null });

    expect(res.flash?.text).toMatch(UPDATED);
    expect(await rowOf(s.group.id)).toMatchObject({ name: 'AMAP des Tests', txtIntro: '<p>Notre AMAP</p>', userId: null, legalReprId: null });
  });

  test('a website given without a scheme gets "http://", one with a scheme is kept', { tag: ['@GRP-SET-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    await app.actions.groupAdmin.saveSettings(a.request, { extUrl: 'www.tilleuls.example.org' });
    expect((await rowOf(s.group.id)).extUrl).toBe('http://www.tilleuls.example.org');

    await app.actions.groupAdmin.saveSettings(a.request, { extUrl: 'https://secure.example.org' });
    expect((await rowOf(s.group.id)).extUrl).toBe('https://secure.example.org');
  });

  test('the name is required: without it the form is shown again and nothing changes', { tag: ['@GRP-SET-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveSettings(a.request, { name: '', txtIntro: '<p>Autre</p>' });

    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(res.body).toContain('_formSubmitted');
    expect(await rowOf(s.group.id)).toMatchObject({ name: 'AMAP des Tests', txtIntro: null });
  });

  test('a form that says it edits another group is refused and changes nothing', { tag: ['@GRP-SET-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveSettings(a.request, { name: 'Piraté' }, { formGroupId: other.id });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/amap/edit');
    expect(res.flash?.kind).toBe('error');
    expect(res.flash?.text).toMatch(/Autre groupe/);
    expect((await rowOf(s.group.id)).name).toBe('AMAP des Tests');
    expect((await rowOf(other.id)).name).toBe('Autre groupe');
  });
});

test.describe('who can edit the group', () => {
  const refused: ['member' | 'membershipManager' | 'coordinator', string][] = [
    ['member', 'a plain member'],
    ['membershipManager', 'a membership manager'],
    ['coordinator', 'a catalog coordinator'],
  ];
  for (const [who, label] of refused) {
    test(`${label} cannot open or post the settings form`, { tag: ['@GRP-SET-002'] }, async ({ app, as, errors }) => {
      // hx refuses with a technical error page (200, logged), not with a redirect
      errors.expect(/pas acc[eè]s/);
      const s = await make.amapScenario();
      const u = await adminOf(app, as, s, who);

      const form = await app.actions.groupAdmin.settings(u.request);
      const res = await app.actions.groupAdmin.saveSettings(u.request, { name: 'Piraté', regOption: 'Closed' });

      expect(form.status).toBe(200);
      expect(form.offered.regOptions).toEqual([]); // no form on the page
      expect(res.body).not.toContain('_formSubmitted');
      expect(await rowOf(s.group.id)).toMatchObject({ name: 'AMAP des Tests', regOption: RegOption.Open });
    });
  }
});

test.describe('how new members join', () => {
  const modes: RegOptionName[] = ['Closed', 'WaitingList', 'Open', 'Full'];
  for (const mode of modes) {
    test(`a group admin sets the group to "${mode}"`, { tag: ['@GRP-SET-003'] }, async ({ app, as }) => {
      const s = await make.amapScenario({ group: { regOption: mode === 'Open' ? 'Closed' : 'Open' } });
      const a = await adminOf(app, as, s);

      const res = await app.actions.groupAdmin.saveSettings(a.request, { regOption: mode });

      expect(res.flash?.text).toMatch(UPDATED);
      expect((await rowOf(s.group.id)).regOption).toBe(RegOption[mode]);
      expect((await app.actions.groupAdmin.settings(a.request)).values.regOption).toBe(mode);
    });
  }

  const announced: [RegOptionName, 'closed' | 'waiting-list' | 'open' | 'full'][] = [
    ['Closed', 'closed'],
    ['WaitingList', 'waiting-list'],
    ['Open', 'open'],
    ['Full', 'full'],
  ];
  for (const [mode, joinMode] of announced) {
    test(`once set to "${mode}", the public page of the group announces it`, { tag: ['@GRP-SET-003', '@GRP-SET-004'] }, async ({ app, as, anon }) => {
      const s = await make.amapScenario({ group: { regOption: mode === 'Closed' ? 'Open' : 'Closed' } });
      const a = await adminOf(app, as, s);
      await app.actions.groupAdmin.saveSettings(a.request, { regOption: mode });

      const page = app.pages.groupPublic(anon.page);
      await page.goto(s.group.id);

      expect(await page.joinMode()).toBe(joinMode);
    });
  }

  test('an open group lets a logged-in user join directly', { tag: ['@GRP-SET-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { regOption: 'Closed' } });
    const a = await adminOf(app, as, s);
    await app.actions.groupAdmin.saveSettings(a.request, { regOption: 'Open' });
    const newcomer = await make.user();
    const n = await as(newcomer);
    await app.views.groups.page(n.request, s.group.id); // the open group is remembered for the join step

    const res = await app.actions.group.join(n.request);

    expect(res.status).toBe(302);
    expect(await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [newcomer.id, s.group.id])).toHaveLength(1);
  });

  test('a group with a waiting list takes a request instead of a direct join', { tag: ['@GRP-SET-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { regOption: 'Open' } });
    const a = await adminOf(app, as, s);
    await app.actions.groupAdmin.saveSettings(a.request, { regOption: 'WaitingList' });
    const newcomer = await make.user();
    const n = await as(newcomer);

    const res = await app.actions.group.requestWaitingList(n.request, s.group.id, 'Je voudrais rejoindre');

    expect(res.status).toBe(302);
    expect(await query('SELECT message FROM WaitingList WHERE userId = ? AND amapId = ?', [newcomer.id, s.group.id])).toEqual([{ message: 'Je voudrais rejoindre' }]);
    expect(await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [newcomer.id, s.group.id])).toHaveLength(0);
  });

  test('a closed group lets nobody join by themselves', { tag: ['@GRP-SET-003'] }, async ({ app, as, errors }) => {
    errors.expect(/not open|no group selected/);
    const s = await make.amapScenario({ group: { regOption: 'Open' } });
    const a = await adminOf(app, as, s);
    const newcomer = await make.user();
    const n = await as(newcomer);
    await app.views.groups.page(n.request, s.group.id); // remembered while the group was still open
    await app.actions.groupAdmin.saveSettings(a.request, { regOption: 'Closed' });

    const join = await app.actions.group.join(n.request);
    const wait = await app.actions.group.requestWaitingList(n.request, s.group.id);

    expect(join.status).not.toBe(302); // an error page: no way in
    expect(wait.status).toBe(302);
    expect(wait.location).toBe(`/group/${s.group.id}`);
    expect(await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [newcomer.id, s.group.id])).toHaveLength(0);
    expect(await query('SELECT 1 FROM WaitingList WHERE userId = ?', [newcomer.id])).toHaveLength(0);
  });
});

test.describe('a full group (UND-023, undecided: characterised as hx does it)', () => {
  test('a full group behaves like a closed one for new joiners: no direct join, no waiting-list request', { tag: ['@GRP-SET-004'] }, async ({ app, as, errors }) => {
    // UND-023: Full is kept as a closed state with a notice (suggested)
    errors.expect(/not open|no group selected/);
    const s = await make.amapScenario({ group: { regOption: 'Open' } });
    const a = await adminOf(app, as, s);
    const newcomer = await make.user();
    const n = await as(newcomer);
    await app.views.groups.page(n.request, s.group.id);
    await app.actions.groupAdmin.saveSettings(a.request, { regOption: 'Full' });

    const join = await app.actions.group.join(n.request);
    const wait = await app.actions.group.requestWaitingList(n.request, s.group.id);

    expect(join.status).not.toBe(302);
    expect(wait.status).toBe(302);
    expect(wait.location).toBe(`/group/${s.group.id}`);
    expect(await query('SELECT 1 FROM UserGroup WHERE userId = ? AND groupId = ?', [newcomer.id, s.group.id])).toHaveLength(0);
    expect(await query('SELECT 1 FROM WaitingList WHERE userId = ?', [newcomer.id])).toHaveLength(0);
  });

  test('the public page of a full group says so', { tag: ['@GRP-SET-004'] }, async ({ app, anon }) => {
    const contact = await make.user();
    const g = await make.group({ name: 'AMAP complète', regOption: 'Full', contact });
    await make.place({ group: g });

    const page = await app.views.groups.page(anon.request, g.id);

    expect(page.status).toBe(200);
    expect(page.text).toContain("Ce groupe est complet et n'accepte plus de nouvelles inscriptions");
  });
});

test.describe('the three options', () => {
  const options = [
    ['hidePhone', 'HidePhone'],
    ['phoneRequired', 'PhoneRequired'],
    ['addressRequired', 'AddressRequired'],
  ] as const;

  for (const [key, flag] of options) {
    test(`a group admin switches "${key}" on, then off, without touching the others`, { tag: ['@GRP-SET-005'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await adminOf(app, as, s);
      const bit = 1 << GroupFlag[flag];

      await app.actions.groupAdmin.saveSettings(a.request, { [key]: true });
      expect((await rowOf(s.group.id)).flags).toBe(bit);
      expect((await app.actions.groupAdmin.settings(a.request)).values[key]).toBe(true);

      await app.actions.groupAdmin.saveSettings(a.request, { [key]: false });
      expect((await rowOf(s.group.id)).flags).toBe(0);
      expect((await app.actions.groupAdmin.settings(a.request)).values[key]).toBe(false);
    });
  }

  test('the three options can be switched on together and are independent', { tag: ['@GRP-SET-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    await app.actions.groupAdmin.saveSettings(a.request, { hidePhone: true, phoneRequired: true, addressRequired: true });
    expect((await rowOf(s.group.id)).flags).toBe(flags(GroupFlag, 'HidePhone', 'PhoneRequired', 'AddressRequired'));

    await app.actions.groupAdmin.saveSettings(a.request, { phoneRequired: false });
    expect((await rowOf(s.group.id)).flags).toBe(flags(GroupFlag, 'HidePhone', 'AddressRequired'));
  });

  test('saving the form keeps the volunteer notification options, which the form does not show', { tag: ['@GRP-SET-005'] }, async ({ app, as }) => {
    const notifs = flags(GroupFlag, 'AllowInformationNotifs', 'AllowAlertNotifs');
    const s = await make.amapScenario({ group: { flags: notifs } });
    const a = await adminOf(app, as, s);

    await app.actions.groupAdmin.saveSettings(a.request, { phoneRequired: true });
    expect((await rowOf(s.group.id)).flags).toBe(notifs | flags(GroupFlag, 'PhoneRequired'));

    await app.actions.groupAdmin.saveSettings(a.request, { phoneRequired: false });
    expect((await rowOf(s.group.id)).flags).toBe(notifs);
  });

  test('the options are what the login and registration forms then require', { tag: ['@GRP-SET-005', '@GRP-SET-006'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);
    await app.actions.groupAdmin.saveSettings(a.request, { phoneRequired: true, addressRequired: false });

    const page = await app.views.groups.groupPageRequirements(anon.request, s.group.id);

    expect(page.phoneRequired).toBe(true);
    expect(page.addressRequired).toBe(false);
  });
});
