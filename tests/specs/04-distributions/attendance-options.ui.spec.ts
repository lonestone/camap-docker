/**
 * Display options of the attendance sheet, in a browser (specs/04-distributions/attendance-sheets.md DIS-ATT-009;
 * camap-ts front-core attendanceSheet.utils.ts loadAttendanceUserFormat / saveAttendanceUserFormat).
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test.describe('attendance sheet display options', () => {
  async function open(app: any, as: any) {
    const s = await make.amapScenario();
    const c = await as(s.users.coordinator);
    await app.actions.group.select(c.request, s.group.id);
    const sheet = app.pages.attendanceSheet(c.page);
    await sheet.goto(s.distributions[0].const.id);
    return { s, c, sheet };
  }

  test('the options start with the first choice, and the ones I pick are still there when I come back', { tag: ['@DIS-ATT-009'] }, async ({ app, as }) => {
    const { sheet } = await open(app, as);
    expect([await sheet.chosen('contact'), await sheet.chosen('product'), await sheet.chosen('date')]).toEqual([0, 0, 0]);

    await sheet.choose('contact', 1);
    await sheet.choose('date', 2);
    await sheet.reload();

    expect([await sheet.chosen('contact'), await sheet.chosen('product'), await sheet.chosen('date')]).toEqual([1, 0, 2]);
  });

  test('they are kept in the browser, not on the account: a new browser session starts with the defaults', { tag: ['@DIS-ATT-009'] }, async ({ app, as, browser }) => {
    const { s, sheet } = await open(app, as);
    await sheet.choose('product', 1);
    await sheet.reload();
    expect(await sheet.chosen('product')).toBe(1);

    // same coordinator, another browser profile
    const other = await browser.newContext();
    try {
      const again = await as(s.users.coordinator);
      await other.addCookies((await again.page.context().cookies()));
      const sheet2 = app.pages.attendanceSheet(await other.newPage());
      await sheet2.goto(s.distributions[0].const.id);
      expect(await sheet2.chosen('product')).toBe(0);
    } finally {
      await other.close();
    }
  });
});
