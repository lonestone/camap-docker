/**
 * hx /distribution/csaList/<distributionId> (lang/master/tpl/distribution/CSAList.mtt): the `classicContractAttendance`
 * neo module (camap-ts front-core modules/csaAttendanceSheet). Its display options are radio groups named
 * `<option>-format`; the choices are saved in the browser's localStorage.
 */
import { expect, type Page } from '@playwright/test';
import type { AttendanceSheetPage } from '../../pages/attendance-sheet.js';

export function hxAttendanceSheetPage(page: Page): AttendanceSheetPage {
  const radios = (option: string) => page.locator(`input[name="${option}-format"]`);
  let current = 0;
  const open = async () => {
    await page.goto(`/distribution/csaList/${current}`);
    await expect(radios('contact').first()).toBeAttached();
  };
  return {
    async goto(distributionId) {
      current = distributionId;
      await open();
    },
    async reload() {
      await open();
    },
    async choose(option, choice) {
      await page.locator(`input[name="${option}-format"][value="${choice}"]`).check();
    },
    async chosen(option) {
      const values = await radios(option).evaluateAll((els) => (els as HTMLInputElement[]).filter((e) => e.checked).map((e) => e.value));
      expect(values).toHaveLength(1);
      return Number(values[0]);
    },
  };
}
