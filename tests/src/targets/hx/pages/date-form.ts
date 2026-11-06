/**
 * hx /distribution/insertMd (controller/Distribution.hx doInsertMd): form/CamapDatePicker.hx renders a
 * `haxeDatePicker` neo module (camap-ts front-core modules/haxe-date-picker) in a div whose id is the field name;
 * the widget writes a hidden input named like the field, and shows a text input named `react_<field>`.
 */
import { expect, type Page } from '@playwright/test';
import type { DateFieldKind, DateFormPage } from '../../pages/date-form.js';

const FIELD: Record<DateFieldKind, string> = { day: 'date', startTime: 'startHour', ordersOpening: 'orderStartDate' };

export function hxDateFormPage(page: Page): DateFormPage {
  const box = (field: DateFieldKind) => page.locator(`div[id$="_${FIELD[field]}"]`);
  return {
    async goto(opts) {
      if (opts?.emptyDates) {
        await page.route('**/distribution/insertMd', async (route) => {
          const res = await route.fetch();
          await route.fulfill({ response: res, body: (await res.text()).replace(/(createNeoModule\([\s\S]*?\bvalue: )"[^"]*"/g, '$1null') });
        });
      }
      await page.goto('/distribution/insertMd');
      await expect(box('day').locator('input[type=hidden]')).toBeAttached();
    },
    async shown(field) {
      return box(field).locator('input[type=text]').inputValue();
    },
    async submitted(field) {
      return box(field).locator('input[type=hidden]').inputValue();
    },
    async served(field) {
      const html = await page.content();
      return new RegExp(`createNeoModule\\("[^"]*_${FIELD[field]}",[\\s\\S]*?value: "([^"]*)"`).exec(html)?.[1] ?? null;
    },
    async opensPicker(field) {
      await box(field).locator('input[type=text]').click();
      try {
        await expect(page.locator('.MuiPickersPopper-root').first()).toBeVisible({ timeout: 5_000 });
        return true;
      } catch {
        return false;
      }
    },
    async type(field, text) {
      const input = box(field).locator('input[type=text]');
      await input.fill(text);
      await input.blur();
    },
  };
}
