/**
 * Disabled groups (specs/02-groups/group-disabled.md; camap-hx/src/controller/Main.hx doHome,
 * Group.hx doDefault and doDisabled, Cron.hx doHour; camap-ts groupPreview GraphQL query).
 *
 * The notice page is a neo shell: the reason (and the button to the new website of a moved group)
 * is drawn by the browser from the GraphQL `groupPreview` query. The tests check the page that
 * members and visitors are sent to, and the data the notice is drawn from.
 *
 * GRP-DSB-005 (superadmin disables a group) is Undecided (UND-025): nothing writes the field today
 * and there is no endpoint to test. The factories set it directly.
 */
import { test, expect } from '../../src/fixtures.js';
import { addDaysWall, atWallTime, wallClock } from '../../src/encodings/dates.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';

type Reason = 'BLOCKED_BY_ADMIN' | 'MOVED' | 'SUSPENDED';
const REASONS: Reason[] = ['BLOCKED_BY_ADMIN', 'MOVED', 'SUSPENDED'];

/** A group with a place, a main contact and one member. */
async function groupWithMember(disabled: Reason | null, extra: { extUrl?: string | null } = {}) {
  const contact = await make.user();
  const g = await make.group({ name: `AMAP ${disabled ?? 'active'}`, regOption: 'Open', contact, disabled, ...extra });
  const place = await make.place({ group: g });
  const member = await make.user();
  await make.userGroup({ user: member, group: g });
  return { g, place, member };
}

test.describe('member of a disabled group', () => {
  for (const reason of REASONS) {
    test(`a member whose current group is disabled (${reason}) is sent to the notice instead of the home`, { tag: ['@GRP-DSB-001', '@NAV-HOM-003'] }, async ({ app, as }) => {
      const { g, member } = await groupWithMember(reason);
      const m = await as(member);
      await app.actions.group.select(m.request, g.id);

      const home = await app.views.groups.home(m.request);

      expect(home.status).toBe(302);
      expect(home.location).toBe(app.urls.groupDisabled());
    });
  }

  test('a member of an active group still gets the home page', { tag: ['@GRP-DSB-001'] }, async ({ app, as }) => {
    const { g, member } = await groupWithMember(null);
    const m = await as(member);
    await app.actions.group.select(m.request, g.id);

    const home = await app.views.groups.home(m.request);

    expect(home.status).toBe(200);
    expect(home.location).toBeNull();
  });

  test('the notice page of the current group is shown, for the group the member is in', { tag: ['@GRP-DSB-001'] }, async ({ app, as }) => {
    const { g, member } = await groupWithMember('SUSPENDED');
    const m = await as(member);
    await app.actions.group.select(m.request, g.id);

    const notice = await app.views.groups.disabledNotice(m.request);

    expect(notice.status).toBe(200);
    expect(notice.location).toBeNull();
    expect(notice.groupId).toBe(g.id);
  });
});

test.describe('public page of a disabled group', () => {
  for (const reason of REASONS) {
    test(`a visitor opening the public page of a ${reason} group is sent to the notice`, { tag: ['@GRP-DSB-002'] }, async ({ app, anon }) => {
      const { g } = await groupWithMember(reason);

      const page = await app.views.groups.page(anon.request, g.id);

      expect(page.status).toBe(302);
      expect(page.location).toBe(app.urls.groupDisabled(g.id));
    });
  }

  test('the notice page of the group opens for a visitor', { tag: ['@GRP-DSB-002'] }, async ({ app, anon }) => {
    const { g } = await groupWithMember('BLOCKED_BY_ADMIN');

    const notice = await app.views.groups.disabledNotice(anon.request, g.id);

    expect(notice.status).toBe(200);
    expect(notice.location).toBeNull();
    expect(notice.groupId).toBe(g.id);
  });

  test('a member opening the public page of a disabled group is sent to the notice too', { tag: ['@GRP-DSB-002'] }, async ({ app, as }) => {
    const { g, member } = await groupWithMember('MOVED');
    const m = await as(member);

    const page = await app.views.groups.page(m.request, g.id);

    expect(page.status).toBe(302);
    expect(page.location).toBe(app.urls.groupDisabled(g.id));
  });

  test('an active group keeps its public page', { tag: ['@GRP-DSB-002'] }, async ({ app, anon }) => {
    const { g } = await groupWithMember(null);

    const page = await app.views.groups.page(anon.request, g.id);

    expect(page.status).toBe(200);
    expect(page.location).toBeNull();
  });
});

const PREVIEW = 'query($id: Int!) { groupPreview(id: $id) { id name disabled extUrl } }';
type Preview = { groupPreview: { id: number; name: string; disabled: Reason | null; extUrl: string | null } };

test.describe('reason shown by the notice', () => {
  for (const reason of REASONS) {
    test(`the notice is told the group is ${reason}`, { tag: ['@GRP-DSB-003'] }, async ({ app, as }) => {
      const { g, member } = await groupWithMember(reason);
      const m = await as(member);

      const res = await app.graphql<Preview>(m.request, PREVIEW, { id: g.id });

      expect(res.errors).toBeNull();
      expect(res.data!.groupPreview.disabled).toBe(reason);
    });
  }

  test('a moved group gives the address of its new website; the notice is open to a visitor', { tag: ['@GRP-DSB-003'] }, async ({ app, anon }) => {
    const { g } = await groupWithMember('MOVED', { extUrl: 'https://nouvelle-amap.example.org' });

    const res = await app.graphql<Preview>(anon.request, PREVIEW, { id: g.id });

    expect(res.errors).toBeNull();
    expect(res.data!.groupPreview).toMatchObject({ id: g.id, disabled: 'MOVED', extUrl: 'https://nouvelle-amap.example.org' });
  });

  test('an active group has no reason', { tag: ['@GRP-DSB-003'] }, async ({ app, anon }) => {
    const { g } = await groupWithMember(null);

    const res = await app.graphql<Preview>(anon.request, PREVIEW, { id: g.id });

    expect(res.errors).toBeNull();
    expect(res.data!.groupPreview.disabled).toBeNull();
  });
});

test.describe('scheduled jobs and disabled groups', () => {
  /**
   * Two groups with a volunteer session at the same time, one disabled. The hourly job targets the
   * distribution days starting in [H:00, H+1:00) + N days; the clock is moved to H:15, N days before.
   */
  async function twoGroups(groupInput: Parameters<typeof make.group>[0], daysBefore: number) {
    const out = [];
    for (const disabled of [null, 'SUSPENDED'] as const) {
      const g = await make.group({ ...groupInput, disabled });
      const pl = await make.place({ group: g });
      const role = await make.volunteerRole({ group: g, name: 'Accueil' });
      const md = await make.multiDistrib({ group: g, place: pl, volunteerRoles: [role] });
      const member = await make.user();
      await make.userGroup({ user: member, group: g });
      out.push({ g, pl, role, md, member });
    }
    const [active, disabled] = out;
    const h = wallClock(active.md.distribStartDate).h;
    const mailTime = atWallTime(addDaysWall(active.md.distribStartDate, -daysBefore), h, 15);
    return { active, disabled, mailTime };
  }

  test('the hourly job sends no volunteer instruction mail for a disabled group', { tag: ['@GRP-DSB-004'] }, async ({ clock, cron, mails }) => {
    const { active, disabled, mailTime } = await twoGroups({ flags: flags(GroupFlag, 'AllowInformationNotifs'), volunteersMailDaysBeforeDutyPeriod: 4 }, 4);
    await make.volunteer({ user: active.member, multiDistrib: active.md, role: active.role });
    await make.volunteer({ user: disabled.member, multiDistrib: disabled.md, role: disabled.role });

    clock.set(mailTime);
    const mark = await mails.mark();
    expect((await cron.run('hour')).status).toBe(200);

    expect(await mails.to(active.member.email, mark)).toHaveLength(1); // the job did run
    expect(await mails.to(disabled.member.email, mark)).toEqual([]);
  });

  test('the hourly job sends no vacant-role alert for a disabled group', { tag: ['@GRP-DSB-004'] }, async ({ clock, cron, mails }) => {
    const { active, disabled, mailTime } = await twoGroups({ flags: flags(GroupFlag, 'AllowAlertNotifs'), vacantVolunteerRolesMailDaysBeforeDutyPeriod: 7 }, 7);

    clock.set(mailTime);
    const mark = await mails.mark();
    expect((await cron.run('hour')).status).toBe(200);

    expect((await mails.to(active.member.email, mark)).length).toBeGreaterThan(0); // the job did run
    expect(await mails.to(disabled.member.email, mark)).toEqual([]);
  });
});
