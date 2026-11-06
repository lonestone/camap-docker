/**
 * hx: after login "/" -> "/home" -> "/user/choose" when no group is selected
 * (controller/Main.hx doHome); user/choose.mtt greets "Bonjour <firstName> !".
 */
import { expect, type Page } from '@playwright/test';
import type { HomePage } from '../../pages/home.js';

export function hxHomePage(page: Page): HomePage {
  return {
    async expectGreeting(firstName) {
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(`Bonjour\\s+${firstName}`) })).toBeVisible();
    },
  };
}
