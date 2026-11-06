/**
 * Public page of a group, seen by a visitor (specs/02-groups/group-public-page.md).
 */
import { test, expect } from '../../src/fixtures.js';
import type { RegOptionName } from '../../src/encodings/flags.js';
import type { JoinMode } from '../../src/targets/pages/group-public.js';
import * as make from '../../src/factories/index.js';

async function publicGroup(name: string, regOption: RegOptionName) {
  const contact = await make.user();
  const g = await make.group({ name, regOption, contact });
  await make.place({ group: g });
  return g;
}

test.describe('group public page', () => {
  test('a visitor can open the public page of a group', { tag: ['@GRP-PUB-001'] }, async ({ app, anon }) => {
    const g = await publicGroup('AMAP du Marché', 'Open');

    const page = app.pages.groupPublic(anon.page);
    await page.goto(g.id);

    expect(await page.name()).toContain('AMAP du Marché');
  });

  const cases: [RegOptionName, JoinMode][] = [
    ['Open', 'open'],
    ['WaitingList', 'waiting-list'],
    ['Closed', 'closed'],
  ];
  for (const [regOption, mode] of cases) {
    test(`a visitor sees the join mode of a ${regOption} group`, { tag: ['@GRP-PUB-004'] }, async ({ app, anon }) => {
      const g = await publicGroup(`AMAP ${regOption}`, regOption);

      const page = app.pages.groupPublic(anon.page);
      await page.goto(g.id);

      expect(await page.name()).toContain(`AMAP ${regOption}`);
      expect(await page.joinMode()).toBe(mode);
    });
  }
});
