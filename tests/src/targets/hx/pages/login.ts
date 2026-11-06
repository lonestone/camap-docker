/**
 * hx /user/login: the page mounts the neo LoginBox module
 * (camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx),
 * served through the /neostatic/ proxy. Labels come from
 * camap-ts/public/locales/fr/{translation,login-registration,errors}.json.
 */
import { expect, type Page } from '@playwright/test';
import type { LoginPage } from '../../pages/login.js';
import { hxUrls } from '../urls.js';

export function hxLoginPage(page: Page): LoginPage {
  const form = () => page.locator('#login-registration-container');
  return {
    async goto() {
      await page.goto(hxUrls.login());
      await expect(form().getByLabel('Email')).toBeVisible();
    },
    async submit(email, password) {
      await form().getByLabel('Email').fill(email);
      await form().getByLabel('Mot de passe', { exact: false }).first().fill(password);
      await form().getByRole('button', { name: 'Se connecter' }).click();
    },
    async expectWrongCredentials() {
      await expect(form().getByRole('alert')).toContainText('mot de passe incorrect');
    },
  };
}
