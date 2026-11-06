/**
 * The hourly clean-up of stored files nothing uses any more
 * (specs/03-catalogs/documents-files.md CAT-DOC-010; camap-hx controller/Cron.hx doHour,
 * task "Clean unused db.File entities").
 *
 * Each run looks at one slice of 1000 file ids: random(round(maxId / 1000)). While the highest id
 * stays under 1500 the slice is always the first one (ids 1 to 999), which keeps the test deterministic.
 */
import { test, expect } from '../../src/fixtures.js';
import { insert, query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const ids = async () => (await query<{ id: number }>('SELECT id FROM File ORDER BY id')).map((r) => r.id);

test.describe('clean-up of unused files', () => {
  test('a file that no product, document, group or vendor uses is deleted', { tag: ['@CAT-DOC-010'] }, async ({ cron }) => {
    const s = await make.amapScenario();
    const orphan = await make.file({ name: 'orphelin.png' });
    const forProduct = await make.file({ name: 'produit.png' });
    const forGroup = await make.file({ name: 'groupe.png' });
    const forVendor = await make.file({ name: 'producteur.png' });
    const doc = await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'contrat.pdf' });
    const media = await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'media', name: 'photo.png', visibility: 'public' });
    await query('UPDATE Product SET imageId = ? WHERE id = ?', [forProduct.id, s.products.const[0].id]);
    await query('UPDATE `Group` SET imageId = ? WHERE id = ?', [forGroup.id, s.group.id]);
    await query('UPDATE Vendor SET imageId = ? WHERE id = ?', [forVendor.id, s.vendor.id]);

    const run = await cron.run('hour');

    expect(run.status).toBe(200);
    expect(await ids()).toEqual([forProduct.id, forGroup.id, forVendor.id, doc.fileId, media.fileId]);
    expect(await ids()).not.toContain(orphan.id);
  });

  test('a file is kept as long as one thing uses it', { tag: ['@CAT-DOC-010'] }, async ({ cron }) => {
    const s = await make.amapScenario();
    const shared = await make.file({ name: 'partage.png' });
    await query('UPDATE Product SET imageId = ? WHERE id = ?', [shared.id, s.products.const[0].id]);
    await query('UPDATE Vendor SET imageId = ? WHERE id = ?', [shared.id, s.vendor.id]);

    await cron.run('hour');
    expect(await ids()).toEqual([shared.id]);

    // the product no longer uses it, the vendor still does
    await query('UPDATE Product SET imageId = NULL WHERE id = ?', [s.products.const[0].id]);
    await cron.run('hour');
    expect(await ids()).toEqual([shared.id]);

    await query('UPDATE Vendor SET imageId = NULL WHERE id = ?', [s.vendor.id]);
    await cron.run('hour');
    expect(await ids()).toEqual([]);
  });

  test('the file of a document that was deleted is cleaned up too', { tag: ['@CAT-DOC-010'] }, async ({ cron }) => {
    const s = await make.amapScenario();
    const doc = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'vieux.pdf' });
    await query('DELETE FROM EntityFile WHERE id = ?', [doc.id]);

    await cron.run('hour');

    expect(await ids()).toEqual([]);
  });

  test('a run only checks one slice of 1000 files: ids outside it are left alone', { tag: ['@CAT-DOC-010'] }, async ({ cron }) => {
    // ids 10 and 999 are in the first slice, 1000 (bounds are excluded) and 1200 are not
    for (const id of [10, 999, 1000, 1200]) await insert('File', { id, name: `orphelin-${id}.png`, data: Buffer.from('x'), cdate: '2026-01-01 00:00:00' });

    await cron.run('hour');

    expect(await ids()).toEqual([1000, 1200]);
  });
});
