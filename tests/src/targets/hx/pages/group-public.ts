/**
 * hx /group/<id> (controller/Group.hx doDefault, lang/fr/tpl/group/view.mtt).
 * The "Inscriptions" block depends on Group.regOption.
 */
import { expect, type Page } from '@playwright/test';
import type { GroupPublicPage, JoinMode } from '../../pages/group-public.js';
import { hxUrls } from '../urls.js';

const JOIN_TEXTS: [JoinMode, RegExp][] = [
  ['open', /Inscription libre|M'inscrire à ce groupe/],
  ['waiting-list', /inscriptions sur liste d'attente/],
  ['full', /Ce groupe est complet/],
  ['closed', /Contactez le responsable pour vous inscrire/],
];

export function hxGroupPublicPage(page: Page): GroupPublicPage {
  return {
    async goto(groupId) {
      const res = await page.goto(hxUrls.groupPage(groupId));
      expect(res?.status(), `GET ${hxUrls.groupPage(groupId)}`).toBe(200);
    },
    async name() {
      return (await page.title()).trim();
    },
    async joinMode() {
      const block = page.locator('h4', { hasText: 'Inscriptions' }).locator('..');
      await expect(block).toBeVisible();
      const text = await block.innerText();
      const hit = JOIN_TEXTS.find(([, re]) => re.test(text));
      if (!hit) throw new Error(`Unknown join mode block:\n${text}`);
      return hit[0];
    },
  };
}
