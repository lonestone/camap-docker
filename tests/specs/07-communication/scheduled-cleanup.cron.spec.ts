/**
 * Clean-up jobs run by the hx job endpoints (specs/07-communication/scheduled-jobs.md COM-JOB-005 and
 * COM-JOB-008; camap-hx controller/Cron.hx doHour "Clean unused db.File entities", doDaily
 * "Delete old documents"). The clean-up of the same unused files is also covered, by file kind,
 * in 03-catalogs/documents-files.cron.spec.ts (CAT-DOC-010).
 */
import { test, expect } from '../../src/fixtures.js';
import { insert, query } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import { clock } from '../../src/clock.js';
import * as make from '../../src/factories/index.js';

const fileIds = async () => (await query<{ id: number }>('SELECT id FROM File ORDER BY id')).map((r) => r.id);
const entityFileIds = async () => (await query<{ id: number }>('SELECT id FROM EntityFile ORDER BY id')).map((r) => r.id);
const DAY = 86_400_000;

test.describe('hourly clean-up of stored files', () => {
  test('an unused file is deleted, a file still used is kept, in slices of 1000 ids', { tag: ['@COM-JOB-005'] }, async ({ cron }) => {
    const s = await make.amapScenario();
    const used = await make.file({ name: 'produit.png' });
    await query('UPDATE Product SET imageId = ? WHERE id = ?', [used.id, s.products.const[0].id]);
    const orphan = await make.file({ name: 'orphelin.png' });
    // with a highest id of 1000 a run always looks at the first slice (ids 1 to 999): id 1000 is outside it
    await insert('File', { id: 1000, name: 'loin.png', data: Buffer.from('x'), cdate: '2026-01-01 00:00:00' });

    const run = await cron.run('hour');

    expect(run.status).toBe(200);
    const left = await fileIds();
    expect(left).toContain(used.id);
    expect(left).not.toContain(orphan.id);
    expect(left).toContain(1000);
  });
});

test.describe('daily deletion of old catalog documents', () => {
  /** A catalog of the scenario's group that ended `daysAgo` days ago, with a document and a photo. */
  async function endedCatalog(s: make.AmapScenario, daysAgo: number) {
    const now = clock.now();
    const catalog = await make.catalog({
      group: s.group,
      vendor: s.vendor,
      startDate: new Date(now.getTime() - (daysAgo + 365) * DAY),
      endDate: new Date(now.getTime() - daysAgo * DAY),
    });
    const document = await make.entityFile({ entityType: 'catalog', entityId: catalog.id, name: 'contrat.pdf' });
    return { catalog, document };
  }

  test('the documents of a catalog that ended 18 months ago (540 days) are deleted with their files', { tag: ['@COM-JOB-008'] }, async ({ cron }) => {
    const s = await make.amapScenario();
    const old = await endedCatalog(s, 540.5);
    const other = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'reglement.pdf' });

    const run = await cron.run('daily');

    expect(run.status).toBe(200);
    expect(await entityFileIds()).toEqual([other.id]);
    expect(await fileIds()).toEqual([other.fileId]);
    expect(await query('SELECT id FROM Catalog WHERE id = ?', [old.catalog.id])).toHaveLength(1); // the catalog stays
  });

  test('the documents of a catalog that ended more recently are kept', { tag: ['@COM-JOB-008'] }, async ({ cron }) => {
    const s = await make.amapScenario();
    const recent = await endedCatalog(s, 539); // not yet 18 months
    const running = await endedCatalog(s, -30); // still running

    await cron.run('daily');

    expect(await entityFileIds()).toEqual([recent.document.id, running.document.id]);
  });

  test('only the one-day window of the run is looked at: a catalog that ended earlier keeps its documents', { tag: ['@COM-JOB-008'] }, async ({ cron }) => {
    // Characterised: a catalog that ended 20 months ago, or whose day was missed (job down), is never cleaned.
    const s = await make.amapScenario();
    const longAgo = await endedCatalog(s, 600);

    await cron.run('daily');

    expect(await entityFileIds()).toEqual([longAgo.document.id]);
  });

  test('only documents are deleted, not the other files of the catalog', { tag: ['@COM-JOB-008'] }, async ({ cron }) => {
    const s = await make.amapScenario();
    const old = await endedCatalog(s, 540.5);
    const media = await make.entityFile({ entityType: 'catalog', entityId: old.catalog.id, documentType: 'media', name: 'photo.png', visibility: 'public' });

    await cron.run('daily');

    expect(await entityFileIds()).toEqual([media.id]);
  });
});
