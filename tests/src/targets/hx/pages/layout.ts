/**
 * lang/master/tpl/base.mtt calls `_Camap.antiDoubleClick()` once the page is loaded; js/App.hx antiDoubleClick()
 * puts `.disabled` on a clicked `.btn` for 3 s (bootstrap gives `.btn.disabled` no pointer events).
 */
import { expect, type Page } from '@playwright/test';
import type { LayoutPage } from '../../pages/layout.js';

export function hxLayoutPage(page: Page): LayoutPage {
  const button = () => page.locator('a.btn:visible, button.btn:visible').first();
  const clickable = async () => (await button().evaluate((el) => getComputedStyle(el).pointerEvents)) !== 'none';
  return {
    async openGroupChooser() {
      await page.goto('/user/choose');
      await page.waitForFunction(() => typeof (window as any)._Camap?.antiDoubleClick === 'function');
      await page.waitForLoadState('networkidle');
    },
    async pressFirstButton() {
      // keep the page where it is: the click handler of the layout still runs
      await button().evaluate((el) => el.addEventListener('click', (e) => e.preventDefault()));
      await button().click();
      return { disabledRightAfter: await button().evaluate((el) => el.classList.contains('disabled')), clickableRightAfter: await clickable() };
    },
    async pressedButtonClickableAgain() {
      await expect.poll(clickable, { timeout: 10_000 }).toBe(true);
      return clickable();
    },
  };
}
