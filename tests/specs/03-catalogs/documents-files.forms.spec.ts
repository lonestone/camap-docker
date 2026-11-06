/**
 * PDF documents of a group or a catalog, and the group's image gallery, managed through the hx
 * admin forms (specs/03-catalogs/documents-files.md; camap-hx controller/Documents.hx, controller/Media.hx).
 * Who sees what is in documents-files.views.spec.ts, the GraphQL entry points in
 * documents-files.graphql.spec.ts, the orphan-file clean-up in documents-files.cron.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import { makePng } from '../../src/png.js';
import type { CamapApp, FileScope } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const pdf = (name = 'charte.pdf') => ({ name, content: PDF });
const png = (name = 'photo.png') => ({ name, content: makePng(40, 30) });
const MiB = 1024 * 1024;
const filler = (name: string, size: number) => ({ name, content: Buffer.alloc(size, 0x41) });

type EntityFileRow = { id: number; entityType: string; documentType: string; entityId: number; fileId: number; data: string | null };
const entityFiles = (documentType: 'document' | 'media') =>
  query<EntityFileRow>('SELECT * FROM EntityFile WHERE documentType = ? ORDER BY id', [documentType]);
const fileRow = (id: number) => queryOne<{ id: number; name: string; data: Buffer }>('SELECT id, name, data FROM File WHERE id = ?', [id]);
const fileCount = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM File'))!.n;

/** A logged-in actor with the scenario group as current group. */
async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users']) {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

const groupScope: FileScope = {};
const catalogScope = (s: Scenario): FileScope => ({ catalogId: s.constCatalog.id });

test.describe('adding a PDF document to the group', () => {
  test('a group admin adds a PDF with a name and a visibility', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.documents.upload(admin.request, groupScope, { file: pdf('statuts.pdf'), name: 'Statuts de 2024', visibility: 'public' });

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'ok', text: expect.stringContaining('Statuts de 2024') });
    const [row] = await entityFiles('document');
    expect(row).toMatchObject({ entityType: 'group', entityId: s.group.id, data: 'public' });
    const stored = await fileRow(row.fileId);
    expect(stored!.name).toBe('Statuts de 2024');
    expect(stored!.data.equals(PDF)).toBe(true);
    const list = await app.actions.documents.list(admin.request, groupScope);
    expect(list.ids).toEqual([row.id]);
    expect(list.names).toEqual(['Statuts de 2024']);
    expect(list.visibilities).toEqual(['public']);
  });

  test('the file name is the document name when no name is given', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    await app.actions.documents.upload(admin.request, groupScope, { file: pdf('Charte.PDF'), name: '' });

    const [row] = await entityFiles('document');
    expect((await fileRow(row.fileId))!.name).toBe('Charte.PDF');
    // members only is the choice the form pre-selects
    expect(row.data).toBe('members');
  });

  test('only a file whose name ends with .pdf is accepted, whatever the case', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    const upper = await app.actions.documents.upload(admin.request, groupScope, { file: pdf('GRAND.PDF') });
    expect(upper.flash?.kind).toBe('ok');
    expect(await entityFiles('document')).toHaveLength(1);

    for (const name of ['photo.png', 'document.docx', 'archive.pdf.zip', 'pdf']) {
      const res = await app.actions.documents.upload(admin.request, groupScope, { file: { name, content: PDF } });

      expect(res.flash, name).toMatchObject({ kind: 'error', text: expect.stringMatching(/pdf/i) });
    }
    expect(await entityFiles('document')).toHaveLength(1);
    expect(await fileCount()).toBe(1);
  });

  // UND-053: hx only looks at the extension; the suggestion is to check the %PDF- signature too
  test('hx stores any content named .pdf (UND-053)', { tag: ['@CAT-DOC-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');
    const notAPdf = Buffer.from('MZ this is not a pdf');

    const res = await app.actions.documents.upload(admin.request, groupScope, { file: { name: 'faux.pdf', content: notAPdf } });

    expect(res.flash?.kind).toBe('ok');
    const [row] = await entityFiles('document');
    expect((await fileRow(row.fileId))!.data.equals(notAPdf)).toBe(true);
  });

  test('a document over 10 MB is refused, a big one under the limit is accepted', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    const tooBig = await app.actions.documents.upload(admin.request, groupScope, { file: filler('trop-gros.pdf', 10 * MiB + 1) });

    expect(tooBig.status).toBe(302);
    expect(tooBig.flash).toMatchObject({ kind: 'error', text: expect.stringContaining('10 Mo') });
    expect(await entityFiles('document')).toEqual([]);
    expect(await fileCount()).toBe(0);

    const big = await app.actions.documents.upload(admin.request, groupScope, { file: filler('gros.pdf', 9 * MiB) });

    expect(big.flash?.kind).toBe('ok');
    expect(await entityFiles('document')).toHaveLength(1);
  });

  test('nothing is created when no file, or an empty file, is sent', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    const none = await app.actions.documents.upload(admin.request, groupScope, { file: null, name: 'Rien' });
    const empty = await app.actions.documents.upload(admin.request, groupScope, { file: { name: 'vide.pdf', content: Buffer.alloc(0) } });

    expect(none.status).toBe(200);
    expect(empty.status).toBe(200);
    expect(await entityFiles('document')).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  test('a coordinator, a member and a vendor cannot add a group document', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    for (const who of ['coordinator', 'member', 'vendor'] as const) {
      const a = await actor(app, as, s, who);

      const res = await app.actions.documents.upload(a.request, groupScope, { file: pdf() });

      expect(res.status, who).toBe(302);
      expect(res.location, who).toBe('/');
    }
    expect(await entityFiles('document')).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  test('a visitor cannot add a group document', { tag: ['@CAT-DOC-001'] }, async ({ app, anon }) => {
    await make.amapScenario();

    const res = await app.actions.documents.upload(anon.request, groupScope, { file: pdf() });

    expect(res.status).toBe(302);
    expect(await entityFiles('document')).toEqual([]);
  });

  test('the documents page is for group admins only', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Règlement.pdf', visibility: 'members' });
    const admin = await actor(app, as, s, 'groupAdmin');
    const coordinator = await actor(app, as, s, 'coordinator');

    const ok = await app.actions.documents.list(admin.request, groupScope);
    const refused = await app.actions.documents.list(coordinator.request, groupScope);

    expect(ok.status).toBe(200);
    expect(ok.names).toEqual(['Règlement.pdf']);
    expect(refused.status).toBe(302);
    expect(refused.names).toEqual([]);
  });
});

test.describe('adding a PDF document to a catalog', () => {
  test('a coordinator adds a document to a catalog they manage', { tag: ['@CAT-DOC-002', '@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await actor(app, as, s, 'coordinator');

    const res = await app.actions.documents.upload(coordinator.request, catalogScope(s), { file: pdf('contrat.pdf'), name: 'Contrat type', visibility: 'subscribers' });

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'ok', text: expect.stringContaining('Contrat type') });
    const [row] = await entityFiles('document');
    expect(row).toMatchObject({ entityType: 'catalog', entityId: s.constCatalog.id, data: 'subscribers' });
    expect((await fileRow(row.fileId))!.name).toBe('Contrat type');
    const list = await app.actions.documents.list(coordinator.request, catalogScope(s));
    expect(list.names).toEqual(['Contrat type']);
    expect(list.visibilities).toEqual(['subscribers']);
    // the group's own list does not show it
    const admin = await actor(app, as, s, 'groupAdmin');
    expect((await app.actions.documents.list(admin.request, groupScope)).ids).toEqual([]);
  });

  test('the same PDF rules apply to a catalog document', { tag: ['@CAT-DOC-002', '@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await actor(app, as, s, 'coordinator');

    const notPdf = await app.actions.documents.upload(coordinator.request, catalogScope(s), { file: png() });
    const tooBig = await app.actions.documents.upload(coordinator.request, catalogScope(s), { file: filler('gros.pdf', 10 * MiB + 1) });

    expect(notPdf.flash).toMatchObject({ kind: 'error', text: expect.stringMatching(/pdf/i) });
    expect(tooBig.flash).toMatchObject({ kind: 'error', text: expect.stringContaining('10 Mo') });
    expect(await entityFiles('document')).toEqual([]);
  });

  test('a group admin can add a document to any catalog of the group', { tag: ['@CAT-DOC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.documents.upload(admin.request, { catalogId: s.varCatalog.id }, { file: pdf(), visibility: 'public' });

    expect(res.flash?.kind).toBe('ok');
    expect((await entityFiles('document'))[0]).toMatchObject({ entityType: 'catalog', entityId: s.varCatalog.id });
  });

  test('a member, a vendor and the coordinator of another catalog cannot add a catalog document', { tag: ['@CAT-DOC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ firstName: 'Boris', lastName: 'Boulanger', email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });

    for (const who of [s.users.member, s.users.vendor, baker]) {
      const a = await as(who);
      await app.actions.group.select(a.request, s.group.id);

      const res = await app.actions.documents.upload(a.request, catalogScope(s), { file: pdf() });
      const list = await app.actions.documents.list(a.request, catalogScope(s));

      expect(res.status, who.email).toBe(302);
      expect(res.location, who.email).toBe('/');
      expect(list.status, who.email).toBe(302);
    }
    expect(await entityFiles('document')).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  test('a coordinator of a given catalog can add documents to it', { tag: ['@CAT-DOC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ firstName: 'Boris', lastName: 'Boulanger', email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });
    const a = await as(baker);
    await app.actions.group.select(a.request, s.group.id);

    const res = await app.actions.documents.upload(a.request, { catalogId: other.id }, { file: pdf() });

    expect(res.flash?.kind).toBe('ok');
    expect((await entityFiles('document'))[0]).toMatchObject({ entityType: 'catalog', entityId: other.id });
  });
});

test.describe('the visibility of a document', () => {
  test('the owner changes the name and the visibility of a group document', { tag: ['@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const doc = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Ancien.pdf', visibility: 'members' });
    const admin = await actor(app, as, s, 'groupAdmin');

    // hx also accepts "subscribers" for a group document (TS offers members or public only: CODE-099)
    for (const visibility of ['public', 'subscribers', 'members']) {
      const res = await app.actions.documents.edit(admin.request, groupScope, doc.id, { name: `Nouveau ${visibility}`, visibility });

      expect(res.status, visibility).toBe(302);
      expect(res.flash, visibility).toMatchObject({ kind: 'ok', text: expect.stringContaining(`Nouveau ${visibility}`) });
      const [row] = await entityFiles('document');
      expect(row.data, visibility).toBe(visibility);
      expect((await fileRow(doc.fileId))!.name, visibility).toBe(`Nouveau ${visibility}`);
    }
  });

  test('the owner changes the visibility of a catalog document', { tag: ['@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const doc = await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Contrat.pdf', visibility: 'subscribers' });
    const coordinator = await actor(app, as, s, 'coordinator');

    const res = await app.actions.documents.edit(coordinator.request, catalogScope(s), doc.id, { visibility: 'public' });

    expect(res.flash?.kind).toBe('ok');
    expect((await entityFiles('document'))[0].data).toBe('public');
    // the name was left as it was
    expect((await fileRow(doc.fileId))!.name).toBe('Contrat.pdf');
  });

  test('the visibility chosen at upload is stored as posted, with no check', { tag: ['@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    // the group form offers members and public only, but the server keeps whatever is posted
    await app.actions.documents.upload(admin.request, groupScope, { file: pdf('a.pdf'), visibility: 'subscribers' });
    await app.actions.documents.upload(admin.request, groupScope, { file: pdf('b.pdf'), visibility: 'nimporte-quoi' });
    await app.actions.documents.upload(admin.request, groupScope, { file: pdf('c.pdf'), visibility: null });

    expect((await entityFiles('document')).map((r) => r.data)).toEqual(['subscribers', 'nimporte-quoi', null]);
  });

  test('only the owner can edit a document', { tag: ['@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const group = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Groupe.pdf', visibility: 'members' });
    const cat = await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Catalogue.pdf', visibility: 'members' });

    for (const who of ['member', 'vendor'] as const) {
      const a = await actor(app, as, s, who);

      const g = await app.actions.documents.edit(a.request, groupScope, group.id, { visibility: 'public' });
      const c = await app.actions.documents.edit(a.request, catalogScope(s), cat.id, { visibility: 'public' });

      expect(g.status, who).toBe(302);
      expect(c.status, who).toBe(302);
    }
    // a coordinator is not a group admin
    const coordinator = await actor(app, as, s, 'coordinator');
    const refused = await app.actions.documents.edit(coordinator.request, groupScope, group.id, { visibility: 'public' });
    expect(refused.status).toBe(302);
    expect((await entityFiles('document')).map((r) => r.data)).toEqual(['members', 'members']);
  });
});

test.describe('deleting a document', () => {
  test('a group admin deletes a group document: the record and its file are gone', { tag: ['@CAT-DOC-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const doc = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Vieux.pdf' });
    const keep = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Garde.pdf' });
    const admin = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.documents.delete(admin.request, groupScope, doc.id);

    expect(res.status).toBe(302);
    expect(res.flash).toMatchObject({ kind: 'ok', text: expect.stringContaining('Vieux.pdf') });
    expect((await entityFiles('document')).map((r) => r.id)).toEqual([keep.id]);
    expect(await fileRow(doc.fileId)).toBeUndefined();
    expect(await fileRow(keep.fileId)).toBeDefined();
  });

  test('a coordinator deletes a document of their catalog', { tag: ['@CAT-DOC-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const doc = await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Contrat.pdf' });
    const coordinator = await actor(app, as, s, 'coordinator');

    const res = await app.actions.documents.delete(coordinator.request, catalogScope(s), doc.id);

    expect(res.flash?.kind).toBe('ok');
    expect(await entityFiles('document')).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  test('without the security token nothing is deleted', { tag: ['@CAT-DOC-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const group = await make.entityFile({ entityType: 'group', entityId: s.group.id });
    const cat = await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id });
    const admin = await actor(app, as, s, 'groupAdmin');

    const g = await app.actions.documents.delete(admin.request, groupScope, group.id, { token: false });
    const c = await app.actions.documents.delete(admin.request, catalogScope(s), cat.id, { token: false });

    expect(g.flash?.kind).toBe('error');
    expect(c.flash?.kind).toBe('error');
    expect(await entityFiles('document')).toHaveLength(2);
    expect(await fileCount()).toBe(2);
  });

  test('a member, a vendor and a coordinator (for a group document) cannot delete', { tag: ['@CAT-DOC-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const group = await make.entityFile({ entityType: 'group', entityId: s.group.id });
    const cat = await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id });
    for (const who of ['member', 'vendor'] as const) {
      const a = await actor(app, as, s, who);
      const g = await app.actions.documents.delete(a.request, groupScope, group.id);
      const c = await app.actions.documents.delete(a.request, catalogScope(s), cat.id);
      expect(g.location, who).toBe('/');
      expect(c.location, who).toBe('/');
    }
    const coordinator = await actor(app, as, s, 'coordinator');
    const refused = await app.actions.documents.delete(coordinator.request, groupScope, group.id);

    expect(refused.location).toBe('/');
    expect(await entityFiles('document')).toHaveLength(2);
  });

  // hx never checks that the document belongs to the group or catalog of the URL: a manager of one
  // scope can edit or delete any document by id. Pinned as it is today; not a decided behaviour.
  test('hx does not check that the document belongs to the scope of the URL', { tag: ['@CAT-DOC-007', '@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const otherGroup = await make.group({ name: 'Autre groupe' });
    const foreign = await make.entityFile({ entityType: 'group', entityId: otherGroup.id, name: 'Autre.pdf', visibility: 'members' });
    const groupDoc = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Statuts.pdf' });
    await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Contrat.pdf' }); // so that the catalog page prints a token
    const coordinator = await actor(app, as, s, 'coordinator');
    const admin = await actor(app, as, s, 'groupAdmin');

    // a group admin renames, then deletes, the document of another group
    const edit = await app.actions.documents.edit(admin.request, groupScope, foreign.id, { name: 'Piraté', visibility: 'public' });
    expect(edit.flash?.kind).toBe('ok');
    expect((await fileRow(foreign.fileId))!.name).toBe('Piraté');
    const del = await app.actions.documents.delete(admin.request, groupScope, foreign.id);
    expect(del.flash?.kind).toBe('ok');
    expect(await fileRow(foreign.fileId)).toBeUndefined();
    // a coordinator deletes a group-level document through the catalog route
    const del2 = await app.actions.documents.delete(coordinator.request, catalogScope(s), groupDoc.id);
    expect(del2.flash?.kind).toBe('ok');
    expect(await fileRow(groupDoc.fileId)).toBeUndefined();
  });
});

test.describe('the image gallery of a group', () => {
  test('a group admin adds images in the five accepted formats, public', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    for (const name of ['a.jpg', 'b.JPEG', 'c.png', 'd.bmp', 'e.Gif']) {
      const res = await app.actions.media.upload(admin.request, { file: png(name), name: `Image ${name}` });

      expect(res.status, name).toBe(302);
      expect(res.flash, name).toMatchObject({ kind: 'ok', text: expect.stringContaining(`Image ${name}`) });
    }

    const rows = await entityFiles('media');
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.entityType === 'group' && r.entityId === s.group.id && r.data === 'public')).toBe(true);
    const list = await app.actions.media.list(admin.request);
    expect(list.ids).toEqual(rows.map((r) => r.id));
    expect(list.names).toEqual(['Image a.jpg', 'Image b.JPEG', 'Image c.png', 'Image d.bmp', 'Image e.Gif']);
    expect(list.visibilities).toEqual(['public', 'public', 'public', 'public', 'public']);
    expect(list.offersAdd).toBe(false);
    // the image is stored as sent
    expect((await fileRow(rows[2].fileId))!.data.equals(png().content)).toBe(true);
  });

  test('other formats are refused', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    for (const name of ['doc.pdf', 'photo.webp', 'logo.svg', 'photo.png.exe', 'png']) {
      const res = await app.actions.media.upload(admin.request, { file: { name, content: png().content } });

      expect(res.flash, name).toMatchObject({ kind: 'error', text: expect.stringMatching(/jpg, bmp, gif ou png/) });
    }
    expect(await entityFiles('media')).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  test('a sixth image is refused until one is deleted', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');
    const media = [];
    for (let i = 1; i <= 5; i++) media.push(await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'media', name: `img${i}.png`, visibility: 'public' }));

    const refused = await app.actions.media.upload(admin.request, { file: png('sixieme.png') });

    expect(refused.status).toBe(302);
    expect(refused.flash?.kind).toBe('error');
    expect(await entityFiles('media')).toHaveLength(5);
    expect(await fileCount()).toBe(5);

    await app.actions.media.delete(admin.request, media[0].id);
    const accepted = await app.actions.media.upload(admin.request, { file: png('sixieme.png') });

    expect(accepted.flash?.kind).toBe('ok');
    expect(await entityFiles('media')).toHaveLength(5);
  });

  test('the limit counts the images of this group only, not its documents nor other groups', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    for (let i = 1; i <= 5; i++) await make.entityFile({ entityType: 'group', entityId: other.id, documentType: 'media', name: `x${i}.png`, visibility: 'public' });
    for (let i = 1; i <= 5; i++) await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'document', name: `d${i}.pdf` });
    const admin = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.media.upload(admin.request, { file: png() });

    expect(res.flash?.kind).toBe('ok');
  });

  // UND-046: the message and the label say 3 MB but the server cap is 4 MiB (and counts the form fields).
  test('an image over the 4 MiB server cap is refused, a 3.5 MiB one is accepted (UND-046)', { tag: ['@CAT-DOC-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    const tooBig = await app.actions.media.upload(admin.request, { file: filler('trop-grosse.png', 4 * MiB + 1) });

    expect(tooBig.status).toBe(302);
    expect(tooBig.flash).toMatchObject({ kind: 'error', text: expect.stringContaining('3 Mo') });
    expect(await entityFiles('media')).toEqual([]);
    expect(await fileCount()).toBe(0);

    const mid = await app.actions.media.upload(admin.request, { file: filler('moyenne.png', 3.5 * MiB) });

    expect(mid.flash?.kind).toBe('ok');
    expect(await entityFiles('media')).toHaveLength(1);
  });

  test('nothing is created when no file is sent', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await actor(app, as, s, 'groupAdmin');

    const res = await app.actions.media.upload(admin.request, { file: null });

    expect(res.status).toBe(200);
    expect(await entityFiles('media')).toEqual([]);
  });

  test('a coordinator, a member and a vendor cannot manage the gallery', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const img = await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'media', name: 'x.png', visibility: 'public' });

    for (const who of ['coordinator', 'member', 'vendor'] as const) {
      const a = await actor(app, as, s, who);

      const up = await app.actions.media.upload(a.request, { file: png() });
      const list = await app.actions.media.list(a.request);
      const del = await app.actions.media.delete(a.request, img.id);

      expect(up.location, who).toBe('/');
      expect(list.status, who).toBe(302);
      expect(del.location, who).toBe('/');
    }
    expect(await entityFiles('media')).toHaveLength(1);
  });

  test('a group admin renames and deletes an image', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const img = await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'media', name: 'ancienne.png', visibility: 'public' });
    const admin = await actor(app, as, s, 'groupAdmin');

    const edit = await app.actions.media.edit(admin.request, img.id, { name: 'Nouvelle image' });

    expect(edit.flash?.kind).toBe('ok');
    expect((await fileRow(img.fileId))!.name).toBe('Nouvelle image');
    expect((await entityFiles('media'))[0].data).toBe('public');

    const noToken = await app.actions.media.delete(admin.request, img.id, { token: false });
    expect(noToken.flash?.kind).toBe('error');
    expect(await entityFiles('media')).toHaveLength(1);

    const del = await app.actions.media.delete(admin.request, img.id);
    expect(del.flash?.kind).toBe('ok');
    expect(await entityFiles('media')).toEqual([]);
    expect(await fileCount()).toBe(0);
  });
});
