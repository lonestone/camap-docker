/**
 * Volunteer instruction emails sent by the hourly job
 * (specs/04-distributions/volunteer-reminders.md; camap-hx/src/controller/Cron.hx
 * doHour, task "Volunteers instruction mail").
 *
 * The job picks the distribution days starting in [H:00, H+1:00) + N days,
 * where H is the current hour and N the group's
 * volunteersMailDaysBeforeDutyPeriod. The clock is moved to H:15, N days
 * before the distribution.
 */
import { test, expect } from '../../src/fixtures.js';
import { addDaysWall, atWallTime, wallClock } from '../../src/encodings/dates.js';
import { GroupFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import type { GroupInput } from '../../src/factories/groups.js';

const DAYS_BEFORE = 4;

async function arrange(groupInput: GroupInput) {
  const g = await make.group({ flags: flags(GroupFlag, 'AllowInformationNotifs'), volunteersMailDaysBeforeDutyPeriod: DAYS_BEFORE, ...groupInput });
  const pl = await make.place({ group: g, name: 'Grange Dupont' });
  const role = await make.volunteerRole({ group: g, name: 'Accueil' });
  const md = await make.multiDistrib({ group: g, place: pl, volunteerRoles: [role] });
  const vol = await make.user({ firstName: 'Valérie', lastName: 'Bénévole', email2: 'conjoint@camap.test' });
  await make.userGroup({ user: vol, group: g });
  await make.volunteer({ user: vol, multiDistrib: md, role });
  const h = wallClock(md.distribStartDate).h;
  const mailTime = atWallTime(addDaysWall(md.distribStartDate, -DAYS_BEFORE), h, 15);
  return { g, pl, md, vol, mailTime };
}

test.describe('volunteer instruction email', () => {
  test(
    'a volunteer receives the instructions N days before the distribution, on both emails',
    { tag: ['@DIS-VRM-001', '@DIS-VRM-004'] },
    async ({ clock, cron, mails }) => {
      const { vol, mailTime } = await arrange({});

      // Not the targeted hour yet (real time, >= 7 days before): nothing.
      let mark = await mails.mark();
      expect((await cron.run('hour')).status).toBe(200);
      expect(await mails.to(vol.email, mark)).toEqual([]);

      clock.set(mailTime);
      mark = await mails.mark();
      expect((await cron.run('hour')).status).toBe(200);

      const sent = await mails.to(vol.email, mark);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toEqual([vol.email, 'conjoint@camap.test']);
      expect(sent[0].htmlBody).toContain('Grange Dupont'); // [LIEU_DISTRIBUTION]
      expect(sent[0].htmlBody).toContain('Accueil'); // [LISTE_BENEVOLES]: role : names
      expect(sent[0].htmlBody).toContain('Valérie');
      expect(sent[0].htmlBody).not.toMatch(/\[(DATE_DISTRIBUTION|LIEU_DISTRIBUTION|LISTE_BENEVOLES)\]/);

      // One hour later the distribution is out of the window: no second mail.
      clock.set('+1h');
      mark = await mails.mark();
      await cron.run('hour');
      expect(await mails.to(vol.email, mark)).toEqual([]);
    },
  );

  test('no instruction email when the group does not allow information notifications', { tag: ['@DIS-VRM-001'] }, async ({ clock, cron, mails }) => {
    const { vol, mailTime } = await arrange({ flags: 0 });

    clock.set(mailTime);
    const mark = await mails.mark();
    expect((await cron.run('hour')).status).toBe(200);

    expect(await mails.to(vol.email, mark)).toEqual([]);
  });

  test('a disabled group sends no volunteer email', { tag: ['@DIS-VRM-003'] }, async ({ clock, cron, mails }) => {
    const { vol, mailTime } = await arrange({ disabled: 'SUSPENDED' });

    clock.set(mailTime);
    const mark = await mails.mark();
    expect((await cron.run('hour')).status).toBe(200);

    expect(await mails.to(vol.email, mark)).toEqual([]);
  });
});
