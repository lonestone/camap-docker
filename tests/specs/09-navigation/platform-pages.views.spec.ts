/**
 * Language of the interface, widget service and screens of the platform
 * (specs/09-navigation/language.md NAV-LNG-002, theme-layout.md NAV-THM-007, NAV-THM-009).
 *
 * Not tested (code structure, or needs the stack to be stopped):
 * - NAV-LNG-002 "no text is hard-coded in the code": the hx code does hard-code texts (UND-118 decided: export them).
 *   Only what a user sees is checked here: the interface stays French whatever is asked.
 * - NAV-THM-007 (UND-119, undecided): what the pages do when the widget service is down. hx
 *   (service/BridgeService.hx getNeoModuleScripts) throws "Unable to load ressources from CAMAP-ts." unless it
 *   still holds a cached list (a worker keeps the manifest it read once; the fallback cache is written 1 time in 10).
 *   The test stack cannot be stopped, so only the dependency of the pages on the manifest is pinned.
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test.describe('the interface is in French', () => {
  test('asking for another language through the address does not change the language of the pages, nor of the widgets', { tag: ['@NAV-LNG-002'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    for (const [who, page] of [
      [anon, 'login'],
      [member, 'chooser'],
    ] as const) {
      const asked = await app.views.platform.layout(who.request, page, { ask: 'en' });

      expect(asked.status).toBe(200);
      expect(asked.language).toBe('fr');
      expect(asked.interfaceLanguage).toBe('fr');
    }
  });
});

test.describe('the widget service', () => {
  test('a page loads the bundles the widget service lists, in its order', { tag: ['@NAV-THM-007'] }, async ({ app, anon }) => {
    const manifest = await app.views.platform.widgetManifest(anon.request);
    const layout = await app.views.platform.layout(anon.request, 'login');

    expect(manifest.status).toBe(200);
    expect(manifest.bundles.length).toBeGreaterThan(0);
    expect(layout.widgetBundles).toEqual(manifest.bundles);
  });
});

test.describe('no other screen', () => {
  test('the folders of the widget bundles and of the translation files list nothing', { tag: ['@NAV-THM-009'] }, async ({ app, anon }) => {
    for (const folder of ['widgets', 'translations', 'frenchTranslations'] as const) {
      const res = await app.views.platform.assetFolder(anon.request, folder);

      expect(res).toEqual({ status: 404, isWebPage: false });
    }
  });

  test('the addresses of a documentation or API explorer lead to the home page, not to a screen', { tag: ['@NAV-THM-009'] }, async ({ app, anon }) => {
    for (const path of ['docs', 'api-docs', 'swagger', 'playground']) {
      const res = await app.views.platform.unknownPath(anon.request, path);

      expect(res.status).toBe(302);
      expect(res.location).toBe(app.urls.home());
    }
  });
});
