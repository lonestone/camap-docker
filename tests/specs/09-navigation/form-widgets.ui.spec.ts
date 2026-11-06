/**
 * Behaviour of the page layout and of the date fields in a browser (specs/09-navigation/theme-layout.md).
 * camap-hx js/App.hx antiDoubleClick(), form/CamapDatePicker.hx, camap-ts front-core modules/haxe-date-picker.
 *
 * Not tested: "Birth date pickers open on the year" (NAV-THM-005, last bullet). The hx rule lives in
 * form/CamapForm.hx renderDDate (fields named birthdate/birthday), but no hx page offers such a field any more
 * (the profile is a Nest/React form), so no page can show it.
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';
import { env } from '../../src/env.js';

test.describe('buttons protect from a double submit', () => {
  test('a pressed button is disabled at once, then usable again after a few seconds', { tag: ['@NAV-THM-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const user = await as(s.users.nonMember);
    const layout = app.pages.layout(user.page);
    await layout.openGroupChooser();

    const pressed = await layout.pressFirstButton();

    expect(pressed).toEqual({ disabledRightAfter: true, clickableRightAfter: false });
    expect(await layout.pressedButtonClickableAgain()).toBe(true);
  });
});

test.describe('date fields', () => {
  /** Wall-clock `YYYY-MM-DD HH:MM` of now in a time zone. */
  const nowIn = (timeZone: string, at = new Date()) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at).replace(',', '');

  test('a date, a time and a date-time field each show a picker with the date in French, and give back the value untouched', { tag: ['@NAV-THM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    await app.actions.group.select(admin.request, s.group.id);
    const form = app.pages.dateForm(admin.page);
    await form.goto();

    const day = (await form.served('day'))!;
    const dayShown = await form.shown('day');
    const [year, month, date] = day.split(' ')[0].split('-').map(Number);

    expect(dayShown).toBe(new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, date))));
    expect(await form.shown('startTime')).toBe('19h00');
    expect(await form.shown('ordersOpening')).toMatch(/^\p{L}+ \d{1,2} \p{L}+ \d{4} à 08h00$/u);
    for (const field of ['day', 'startTime', 'ordersOpening'] as const) {
      expect(await form.submitted(field)).toBe(await form.served(field));
      expect(await form.opensPicker(field)).toBe(true);
      await admin.page.keyboard.press('Escape');
    }
  });

  test('a typed date or time is what the form posts, in the same text format as the server gives', { tag: ['@NAV-THM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    await app.actions.group.select(admin.request, s.group.id);
    const form = app.pages.dateForm(admin.page);
    await form.goto();

    await form.type('day', 'lundi 7 décembre 2027');
    await form.type('startTime', '08h30');
    await form.type('ordersOpening', 'mardi 8 décembre 2026 à 09h15');

    expect(await form.submitted('day')).toBe('2027-12-07 00:00:00');
    expect((await form.submitted('startTime')).slice(10)).toBe(' 08:30:00');
    expect(await form.submitted('ordersOpening')).toBe('2026-12-08 09:15:00');
  });

  test('an empty date starts at the current date and time', { tag: ['@NAV-THM-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    await app.actions.group.select(admin.request, s.group.id);
    const form = app.pages.dateForm(admin.page);
    const before = nowIn(env.appTimeZone);

    await form.goto({ emptyDates: true });

    const after = nowIn(env.appTimeZone);
    for (const field of ['day', 'startTime', 'ordersOpening'] as const) {
      expect(await form.served(field)).toBeNull();
      expect([before, after]).toContain((await form.submitted(field)).slice(0, 16));
    }
  });

  test('the picked value is in the local time of my browser', { tag: ['@NAV-THM-005'] }, async ({ app, as, browser }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    await app.actions.group.select(admin.request, s.group.id);
    const timeZone = 'Pacific/Auckland';
    const context = await browser.newContext({ baseURL: env.baseUrl, timezoneId: timeZone, storageState: await admin.request.storageState() });
    try {
      const form = app.pages.dateForm(await context.newPage());
      const before = nowIn(timeZone);

      await form.goto({ emptyDates: true });

      const after = nowIn(timeZone);
      expect([before, after]).toContain((await form.submitted('day')).slice(0, 16));
      expect(before.slice(0, 16)).not.toBe(nowIn(env.appTimeZone));
    } finally {
      await context.close();
    }
  });
});
