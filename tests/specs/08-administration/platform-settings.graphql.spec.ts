/**
 * Stored settings that have no effect on the platform (specs/08-administration/maintenance-tools.md ADM-TLS-006, UND-115;
 * camap-ts common/guards/black-list.guard.ts).
 *
 * Not observable over HTTP: the terms-of-service version only stamps vendors created by VendorService.create, which
 * no endpoint calls; `tosVersion` and `defaultShowcaseGroupIds` are never read; `getInt` on a missing setting and
 * the unawaited `set` are internal behaviours.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute } from '../../src/db/client.js';
import { env } from '../../src/env.js';
import * as make from '../../src/factories/index.js';

const PREVIEW = 'query($id: Int!) { groupPreview(id: $id) { id name } }';
type Preview = { groupPreview: { id: number; name: string } };

test.describe('the IP blacklist', () => {
  test('is never applied: a stored blacklist, and a client the guard would refuse, are served as usual', { tag: ['@ADM-TLS-006'] }, async ({ app, playwright }) => {
    // The BlackListGuard refuses a listed IP and any user agent containing "python", but no resolver uses it.
    const g = await make.group({ name: 'AMAP du Marché', regOption: 'Open' });
    await execute("INSERT INTO `Variable` (name, value) VALUES ('IPBlacklist', ?)", [JSON.stringify(['127.0.0.1', '::1', '172.17.0.1', '172.18.0.1', '172.24.0.1', '192.168.65.1'])]);
    const python = await playwright.request.newContext({ baseURL: env.baseUrl, extraHTTPHeaders: { 'user-agent': 'python-requests/2.31.0' } });

    try {
      const res = await app.graphql<Preview>(python, PREVIEW, { id: g.id });

      expect(res.status).toBe(200);
      expect(res.errors).toBeNull();
      expect(res.data!.groupPreview).toMatchObject({ id: g.id, name: 'AMAP du Marché' });
    } finally {
      await python.dispose();
    }
  });
});
