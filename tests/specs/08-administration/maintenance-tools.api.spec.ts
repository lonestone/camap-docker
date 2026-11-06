/**
 * Superadmin tools served only by camap-ts on its own origin (env.apiUrl, published nest-test port):
 * email template preview and list (ADM-TLS-002), stored image view and recompression (ADM-TLS-003, CAT-DOC-011).
 * camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts, src/files/file.controller.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import { deviation } from '../../src/deviations.js';
import * as make from '../../src/factories/index.js';
import { makePng, pngSize } from '../../src/png.js';

const dataOf = async (fileId: number): Promise<Buffer> =>
  (await query<{ data: Buffer }>('SELECT data FROM File WHERE id = ?', [fileId]))[0].data;

/** Templates that no flow sends (UND-106: removed from the list). */
const UNSENT_TEMPLATES = [
  'anticheat.twig',
  'existingVendorInvitation.twig',
  'newVendorInvitation.twig',
  'time-slots-resolution.twig',
  'validateDistributedDistribution-reminder.twig',
  'validateDistributedDistribution.twig',
  'vendorCertificationInProgress.twig',
  'vendorCertificationRefused.twig',
];

test.describe('email templates', () => {
  test('a superadmin lists the email templates, each with a preview link', { tag: ['@ADM-TLS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.mailTemplates(admin.request);

    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual(expect.arrayContaining(['message.twig', 'invitationToJoinGroup.twig', 'deletionWarning.twig']));
    // Characterisation: every .twig file is listed, the shared layouts (_base, _layout-*) included
    expect(res.body.templates).toEqual(expect.arrayContaining(['_base.twig', '_layout-camap.twig', '_layout-group.twig']));
    expect(res.body.links.length).toBe(res.body.templates.length);
    // Characterisation: the links are built on FRONT_URL (the app origin), not on the API origin that serves them
    expect(res.body.links[0]).toMatch(/^http:\/\/localhost:8180\/mails\/get\/[^/]+\.twig\/%7B%7D$/);
  });

  test('the list shows only templates that a flow can send (DECISION UND-106)', { tag: ['@ADM-TLS-002'] }, async ({ app, as }) => {
    deviation('UND-106');
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.mailTemplates(admin.request);

    expect(res.status).toBe(200);
    expect(res.body.templates.filter((t) => UNSENT_TEMPLATES.includes(t))).toEqual([]);
  });

  test('a superadmin previews a template rendered with the sample data given', { tag: ['@ADM-TLS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.mailPreview(admin.request, 'invitationToJoinGroup.twig', { groupName: 'Les Paniers du Lundi' });

    expect(res.status).toBe(200);
    expect(res.body).toContain('<html');
    expect(res.body).toContain('Les Paniers du Lundi');
  });

  test('missing sample data is filled in: a group name, and a text for the message template', { tag: ['@ADM-TLS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.mailPreview(admin.request, 'message.twig', {});

    expect(res.status).toBe(200);
    expect(res.body).toContain('<html');
    expect(res.body.length).toBeGreaterThan(500);
  });

  test('only a superadmin can list or preview templates', { tag: ['@ADM-TLS-002'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    for (const who of [await as(s.users.groupAdmin), anon]) {
      expect((await app.api.adminTools.mailTemplates(who.request)).status).not.toBe(200);
      expect((await app.api.adminTools.mailPreview(who.request, 'message.twig', {})).status).not.toBe(200);
    }
  });
});

test.describe('stored images', () => {
  test('a superadmin views a stored image', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const png = makePng(20, 30);
    const f = await make.file({ name: 'photo.png', data: png });
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.storedImage(admin.request, f.id);

    expect(res.status).toBe(200);
    expect(res.body).toContain(`<img src="data:image/*;base64,${png.toString('base64')}"`);
  });

  test('an unknown file id is "not found"', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    expect((await app.api.adminTools.storedImage(admin.request, 987654)).status).toBe(404);
    expect((await app.api.adminTools.compressImage(admin.request, 987654)).status).toBe(404);
  });

  test('recompressing an image overwrites it, at most 500 pixels high', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const f = await make.file({ name: 'grande.png', data: makePng(40, 800) });
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.compressImage(admin.request, f.id);

    expect(res.status).toBe(200);
    const stored = await dataOf(f.id);
    expect(pngSize(stored)).toEqual({ width: 25, height: 500 });
    expect(res.body).toContain(stored.toString('base64'));
  });

  test('a small image is not enlarged', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const f = await make.file({ name: 'petite.png', data: makePng(30, 40) });
    const admin = await as(s.users.superadmin);

    expect((await app.api.adminTools.compressImage(admin.request, f.id)).status).toBe(200);

    expect(pngSize(await dataOf(f.id))).toEqual({ width: 30, height: 40 });
  });

  test('recompressing a file that is not an image answers "Not an image" and keeps the file', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const f = await make.file({ name: 'contrat.pdf' });
    const before = await dataOf(f.id);
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.compressImage(admin.request, f.id);

    expect(res.body).toBe('Not an image');
    expect(await dataOf(f.id)).toEqual(before);
  });

  test('a superadmin recompresses a page of stored images', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await make.file({ name: 'a.png', data: makePng(40, 800) });
    const b = await make.file({ name: 'b.png', data: makePng(30, 600) });
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.compressImagePage(admin.request, 1);

    expect(res.status).toBe(200);
    expect(pngSize(await dataOf(a.id)).height).toBe(500);
    expect(pngSize(await dataOf(b.id)).height).toBe(500);
  });

  test('when the first file of the page is not an image, the images are still recompressed but the request gets no answer', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as }) => {
    // Characterisation: compressAll only answers once it reaches the first file of the page, and only if that one
    // was recompressed (file.controller.ts:90-150); otherwise the response is never written.
    const s = await make.amapScenario();
    const doc = await make.file({ name: 'contrat.pdf' });
    const img = await make.file({ name: 'grande.png', data: makePng(40, 800) });
    const admin = await as(s.users.superadmin);

    const res = await app.api.adminTools.compressImagePage(admin.request, 1, 5_000);

    expect(res.status).toBe('no-answer');
    expect(pngSize(await dataOf(img.id)).height).toBe(500);
    expect((await dataOf(doc.id)).toString()).toContain('%PDF');
  });

  test('only a superadmin can view or recompress stored images', { tag: ['@ADM-TLS-003', '@CAT-DOC-011'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const f = await make.file({ name: 'grande.png', data: makePng(40, 800) });
    const before = await dataOf(f.id);
    for (const who of [await as(s.users.groupAdmin), anon]) {
      expect((await app.api.adminTools.storedImage(who.request, f.id)).status).not.toBe(200);
      expect((await app.api.adminTools.compressImage(who.request, f.id)).status).not.toBe(200);
      const page = await app.api.adminTools.compressImagePage(who.request, 1);
      expect(page.status).not.toBe(200);
    }
    expect(await dataOf(f.id)).toEqual(before);
  });
});
