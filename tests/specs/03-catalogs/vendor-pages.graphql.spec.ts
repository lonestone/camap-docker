/**
 * What the vendor public page and dashboard are built from, through GraphQL
 * (specs/03-catalogs/vendor-pages.md; camap-ts vendors.resolver.ts, entity-file.resolver.ts).
 * The profile save is in vendors.graphql.spec.ts; the page shell is in vendor-pages.views.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne, update } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';
import { makePng, pngSize } from '../../src/png.js';

const PAGE = `query($id: Int!) {
  vendor(id: $id) {
    id name desc portrait image
    media { id name url }
    documents { id entityType documentType entityId visibility name url }
    activeCatalogs { id name }
    nextDistributions { group { id } distributions { id date } }
  }
}`;
const ALL = `query($id: Int!, $from: DateTime) { vendor(id: $id) { allDistributions(fromDate: $from) { group { id } distributions { id date } } } }`;
const CREATE_IMAGE = `mutation($vendorId: Int!, $b64: String!, $mime: String!, $name: String!, $w: Int!) {
  createVendorImage(vendorId: $vendorId, base64EncodedImage: $b64, mimeType: $mime, fileName: $name, maxWidth: $w) { id name url }
}`;
const SET_IMAGE = `mutation($vendorId: Int!, $b64: String!, $mime: String!, $name: String!, $w: Int!) {
  setVendorImage(vendorId: $vendorId, base64EncodedImage: $b64, mimeType: $mime, fileName: $name, maxWidth: $w) { id image }
}`;
const CREATE_DOC = `mutation($entityId: Int!, $b64: String!, $fileName: String!, $name: String, $visibility: String!) {
  createDocument(entityType: "vendor", entityId: $entityId, base64EncodedFile: $b64, fileName: $fileName, name: $name, visibility: $visibility) {
    id entityType documentType entityId visibility name url
  }
}`;
const DELETE_DOC = `mutation($id: Int!) { deleteDocument(id: $id) }`;

const png = (w: number, h: number) => makePng(w, h).toString('base64');
const imageVars = (vendorId: number, over: Record<string, unknown> = {}) => ({
  vendorId,
  b64: `data:image/png;base64,${png(40, 30)}`,
  mime: 'image/png',
  name: 'ferme.png',
  w: 300,
  ...over,
});
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const docVars = (entityId: number, over: Record<string, unknown> = {}) => ({
  entityId,
  b64: `data:application/pdf;base64,${PDF.toString('base64')}`,
  fileName: 'certificat.pdf',
  name: 'Certificat bio',
  visibility: 'public',
  ...over,
});

type EntityFileRow = { id: number; entityType: string; documentType: string; entityId: number; fileId: number; data: string };
const entityFiles = (vendorId: number) => query<EntityFileRow>("SELECT * FROM EntityFile WHERE entityType = 'vendor' AND entityId = ? ORDER BY id", [vendorId]);
const release = (vendorId: number) => update('Vendor', { id: vendorId }, { userId: null });
const fileCount = async () => (await query('SELECT id FROM File')).length;

/** A vendor with a catalog in a fresh group, which has `n` distribution days starting `first` days from now. */
async function vendorWithDistributions(n: number, first = 3) {
  const g = await make.group({ name: `Groupe ${n}` });
  const place = await make.place({ group: g });
  const v = await make.vendor({ name: `Ferme ${n} dates` });
  const cat = await make.catalog({ group: g, vendor: v });
  const now = new Date();
  const distribs = [];
  for (let i = 0; i < n; i++) {
    const md = await make.multiDistrib({ group: g, place, start: addDaysWall(now, first + 7 * i) });
    distribs.push(await make.distribution({ catalog: cat, multiDistrib: md }));
  }
  return { group: g, vendor: v, catalog: cat, distribs };
}

test.describe('the data of the public page', () => {
  test('a member reads the description, the active catalogs and the photos of a vendor', { tag: ['@CAT-VDB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme du Soleil', desc: 'Légumes de saison' });
    const active = await make.catalog({ group: s.group, vendor: v, name: 'Paniers actifs' });
    await make.catalog({ group: s.group, vendor: v, name: 'Contrat fini', startDate: addDaysWall(new Date(), -100), endDate: addDaysWall(new Date(), -10) });
    await make.catalog({ group: s.group, vendor: v, name: 'Contrat futur', startDate: addDaysWall(new Date(), 10), endDate: addDaysWall(new Date(), 100) });
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PAGE, { id: v.id });

    expect(res.errors).toBeNull();
    expect(res.data.vendor.name).toBe('Ferme du Soleil');
    expect(res.data.vendor.desc).toBe('Légumes de saison');
    // only catalogs running today
    expect(res.data.vendor.activeCatalogs).toEqual([{ id: active.id, name: 'Paniers actifs' }]);
    // no portrait and no photo yet
    expect(res.data.vendor.portrait).toBe('');
    expect(res.data.vendor.media).toEqual([]);
  });

  test('the portrait is the file of the vendor "portrait" document', { tag: ['@CAT-VDB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const { insert } = await import('../../src/db/client.js');
    const fileId = await insert('File', { name: 'portrait.png', data: makePng(10, 10), cdate: '2026-01-01 00:00:00' });
    await insert('EntityFile', { entityType: 'vendor', documentType: 'portrait', entityId: s.vendor.id, fileId, data: 'public' });
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PAGE, { id: s.vendor.id });

    expect(res.errors).toBeNull();
    expect(res.data.vendor.portrait).toMatch(/^\/file\//);
  });

  // The public page is open to visitors, but this query is behind the login guard (GqlAuthGuard).
  test('a visitor cannot run the vendor query (characterised)', { tag: ['@CAT-VDB-001'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.graphql(anon.request, PAGE, { id: s.vendor.id });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.data).toBeNull();
  });

  test('an unknown vendor is an error', { tag: ['@CAT-VDB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PAGE, { id: 999999 });

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

test.describe('the distributions of a vendor', () => {
  test('at most the next 4 distributions of each group are shown, soonest first', { tag: ['@CAT-VDB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await vendorWithDistributions(6);
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PAGE, { id: a.vendor.id });

    expect(res.errors).toBeNull();
    const [only] = res.data.vendor.nextDistributions;
    expect(res.data.vendor.nextDistributions).toHaveLength(1);
    expect(only.group.id).toBe(a.group.id);
    expect(only.distributions.map((d: { id: number }) => d.id)).toEqual(a.distribs.slice(0, 4).map((d) => d.id));
  });

  test('each group has its own limit of 4', { tag: ['@CAT-VDB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await vendorWithDistributions(5);
    // the same vendor sells in a second group
    const g2 = await make.group({ name: 'Autre AMAP' });
    const place2 = await make.place({ group: g2 });
    const cat2 = await make.catalog({ group: g2, vendor: a.vendor });
    const second = [];
    for (let i = 0; i < 2; i++) {
      const md = await make.multiDistrib({ group: g2, place: place2, start: addDaysWall(new Date(), 4 + 7 * i) });
      second.push(await make.distribution({ catalog: cat2, multiDistrib: md }));
    }
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PAGE, { id: a.vendor.id });

    expect(res.errors).toBeNull();
    const byGroup = new Map<number, number[]>(res.data.vendor.nextDistributions.map((x: any) => [x.group.id, x.distributions.map((d: any) => d.id)]));
    expect(byGroup.size).toBe(2);
    expect(byGroup.get(a.group.id)).toEqual(a.distribs.slice(0, 4).map((d) => d.id));
    expect(byGroup.get(g2.id)).toEqual(second.map((d) => d.id));
  });

  test('past distributions and those of an ended catalog are not "next"', { tag: ['@CAT-VDB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const g = await make.group({ name: 'Groupe passé' });
    const place = await make.place({ group: g });
    const v = await make.vendor({ name: 'Ferme passée' });
    const running = await make.catalog({ group: g, vendor: v });
    const ended = await make.catalog({ group: g, vendor: v, name: 'Fini', startDate: addDaysWall(new Date(), -100), endDate: addDaysWall(new Date(), -2) });
    const now = new Date();
    const past = await make.distribution({ catalog: running, multiDistrib: await make.multiDistrib({ group: g, place, start: addDaysWall(now, -5) }) });
    const next = await make.distribution({ catalog: running, multiDistrib: await make.multiDistrib({ group: g, place, start: addDaysWall(now, 5) }) });
    const ofEnded = await make.distribution({ catalog: ended, multiDistrib: await make.multiDistrib({ group: g, place, start: addDaysWall(now, 6) }) });
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PAGE, { id: v.id });

    expect(res.errors).toBeNull();
    const ids = res.data.vendor.nextDistributions.flatMap((x: any) => x.distributions.map((d: any) => d.id));
    expect(ids).toEqual([next.id]);
    expect(ids).not.toContain(past.id);
    expect(ids).not.toContain(ofEnded.id);
  });

  test('a vendor with no distribution has an empty list', { tag: ['@CAT-VDB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const v = await make.vendor({ name: 'Ferme sans date' });
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, PAGE, { id: v.id });

    expect(res.data.vendor.nextDistributions).toEqual([]);
  });

  test('all the distributions can be browsed, from a date', { tag: ['@CAT-VDB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await vendorWithDistributions(6);
    const member = await as(s.users.member);

    const all = await app.graphql(member.request, ALL, { id: a.vendor.id });
    const from = await app.graphql(member.request, ALL, { id: a.vendor.id, from: addDaysWall(a.distribs[3].date, -3).toISOString() });

    expect(all.errors).toBeNull();
    const ids = (r: typeof all) => r.data.vendor.allDistributions.flatMap((x: any) => x.distributions.map((d: any) => d.id));
    expect(ids(all)).toEqual(a.distribs.map((d) => d.id));
    expect(ids(from)).toEqual(a.distribs.slice(3).map((d) => d.id));
  });

  test('all the distributions include the past ones and those of ended catalogs', { tag: ['@CAT-VDB-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const g = await make.group({ name: 'Groupe historique' });
    const place = await make.place({ group: g });
    const v = await make.vendor({ name: 'Ferme historique' });
    const ended = await make.catalog({ group: g, vendor: v, name: 'Fini', startDate: addDaysWall(new Date(), -100), endDate: addDaysWall(new Date(), -2) });
    const old = await make.distribution({ catalog: ended, multiDistrib: await make.multiDistrib({ group: g, place, start: addDaysWall(new Date(), -20) }) });
    const member = await as(s.users.member);

    const res = await app.graphql(member.request, ALL, { id: v.id });

    expect(res.errors).toBeNull();
    expect(res.data.vendor.allDistributions.flatMap((x: any) => x.distributions.map((d: any) => d.id))).toEqual([old.id]);
  });
});

test.describe('uploading the vendor image', () => {
  test('the owner sets the image: it is compressed, stored and linked to the vendor', { tag: ['@CAT-VDB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, SET_IMAGE, imageVars(s.vendor.id, { b64: `data:image/png;base64,${png(400, 300)}`, w: 100 }));

    expect(res.errors).toBeNull();
    expect(res.data.setVendorImage.image).toMatch(/^\/file\//);
    const row = await queryOne<{ imageId: number }>('SELECT imageId FROM Vendor WHERE id = ?', [s.vendor.id]);
    const file = await queryOne<{ name: string; data: Buffer }>('SELECT name, data FROM File WHERE id = ?', [row!.imageId]);
    expect(file!.name).toBe('ferme.png');
    expect(pngSize(file!.data)).toEqual({ width: 100, height: 75 });
  });

  test('a new image replaces the previous one, which is deleted', { tag: ['@CAT-VDB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);
    await app.graphql(owner.request, SET_IMAGE, imageVars(s.vendor.id, { name: 'ancienne.png' }));
    const first = (await queryOne<{ imageId: number }>('SELECT imageId FROM Vendor WHERE id = ?', [s.vendor.id]))!.imageId;

    const res = await app.graphql(owner.request, SET_IMAGE, imageVars(s.vendor.id, { name: 'nouvelle.png' }));

    expect(res.errors).toBeNull();
    const second = (await queryOne<{ imageId: number }>('SELECT imageId FROM Vendor WHERE id = ?', [s.vendor.id]))!.imageId;
    expect(second).not.toBe(first);
    expect(await queryOne('SELECT id FROM File WHERE id = ?', [first])).toBeUndefined();
    expect(await fileCount()).toBe(1);
  });

  test('the owner adds gallery photos, which are public and listed on the page', { tag: ['@CAT-VDB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);
    const member = await as(s.users.member);

    const one = await app.graphql(owner.request, CREATE_IMAGE, imageVars(s.vendor.id, { name: 'serre.png' }));
    const two = await app.graphql(owner.request, CREATE_IMAGE, imageVars(s.vendor.id, { name: 'champ.png' }));

    expect(one.errors).toBeNull();
    expect(one.data.createVendorImage).toMatchObject({ name: 'serre.png' });
    expect(one.data.createVendorImage.url).toMatch(/^\/file\//);
    const rows = await entityFiles(s.vendor.id);
    expect(rows.map((r) => [r.documentType, r.data])).toEqual([['media', 'public'], ['media', 'public']]);
    // any logged-in user sees them (visitors cannot ask: see the characterised vendor query above)
    const page = await app.graphql(member.request, PAGE, { id: s.vendor.id });
    expect(page.data.vendor.media.map((m: { name: string }) => m.name)).toEqual(['serre.png', 'champ.png']);
    expect(page.data.vendor.media.map((m: { id: number }) => m.id)).toEqual([one.data.createVendorImage.id, two.data.createVendorImage.id]);
  });

  test('a gallery photo is compressed to the maximum width', { tag: ['@CAT-VDB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, CREATE_IMAGE, imageVars(s.vendor.id, { b64: `data:image/png;base64,${png(300, 200)}`, w: 150 }));

    expect(res.errors).toBeNull();
    const [row] = await entityFiles(s.vendor.id);
    const file = await queryOne<{ data: Buffer }>('SELECT data FROM File WHERE id = ?', [row.fileId]);
    expect(pngSize(file!.data)).toEqual({ width: 150, height: 100 });
  });

  test('a member, a coordinator of a claimed vendor and a visitor cannot upload', { tag: ['@CAT-VDB-005'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    for (const user of [s.users.member, s.users.coordinator, s.users.groupAdmin, s.users.superadmin]) {
      const who = await as(user);

      const image = await app.graphql(who.request, SET_IMAGE, imageVars(s.vendor.id));
      const photo = await app.graphql(who.request, CREATE_IMAGE, imageVars(s.vendor.id));

      expect(image.errors?.length, user.email).toBeGreaterThan(0);
      expect(photo.errors?.length, user.email).toBeGreaterThan(0);
    }
    const visitor = await app.graphql(anon.request, CREATE_IMAGE, imageVars(s.vendor.id));
    expect(visitor.errors?.length).toBeGreaterThan(0);
    expect(await entityFiles(s.vendor.id)).toEqual([]);
    expect(await fileCount()).toBe(0);
    expect((await queryOne<{ imageId: number | null }>('SELECT imageId FROM Vendor WHERE id = ?', [s.vendor.id]))!.imageId).toBeNull();
  });

  test('the owner of another vendor cannot upload', { tag: ['@CAT-VDB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const otherOwner = await make.user({ email: 'autre.producteur@camap.test' });
    await make.vendor({ name: 'Autre ferme', user: otherOwner });
    const who = await as(otherOwner);

    const res = await app.graphql(who.request, CREATE_IMAGE, imageVars(s.vendor.id));

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await fileCount()).toBe(0);
  });

  test('a coordinator of an unclaimed vendor and a superadmin can upload for it, a member cannot', { tag: ['@CAT-VDB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await release(s.vendor.id);
    const coordinator = await as(s.users.coordinator);
    const superadmin = await as(s.users.superadmin);
    const member = await as(s.users.member);

    const byCoordinator = await app.graphql(coordinator.request, CREATE_IMAGE, imageVars(s.vendor.id));
    const bySuperadmin = await app.graphql(superadmin.request, CREATE_IMAGE, imageVars(s.vendor.id));
    const byMember = await app.graphql(member.request, CREATE_IMAGE, imageVars(s.vendor.id));

    expect(byCoordinator.errors).toBeNull();
    expect(bySuperadmin.errors).toBeNull();
    expect(byMember.errors?.length).toBeGreaterThan(0);
    expect(await entityFiles(s.vendor.id)).toHaveLength(2);
  });

  test('an unknown vendor is refused', { tag: ['@CAT-VDB-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, CREATE_IMAGE, imageVars(999999));

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});

test.describe('the PDF documents of a vendor', () => {
  test('the owner adds a public PDF document: it is stored and listed on the vendor', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);
    const member = await as(s.users.member);

    const res = await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id));

    expect(res.errors).toBeNull();
    expect(res.data.createDocument).toMatchObject({ entityType: 'vendor', documentType: 'document', entityId: s.vendor.id, visibility: 'public', name: 'Certificat bio' });
    expect(res.data.createDocument.url).toMatch(/^\/file\//);
    const [row] = await entityFiles(s.vendor.id);
    expect(row).toMatchObject({ documentType: 'document', data: 'public' });
    const file = await queryOne<{ name: string; data: Buffer }>('SELECT name, data FROM File WHERE id = ?', [row.fileId]);
    expect(file!.name).toBe('Certificat bio');
    expect(file!.data.equals(PDF)).toBe(true);
    const page = await app.graphql(member.request, PAGE, { id: s.vendor.id });
    expect(page.data.vendor.documents).toEqual([expect.objectContaining({ id: res.data.createDocument.id, name: 'Certificat bio', visibility: 'public' })]);
    // documents are not photos
    expect(page.data.vendor.media).toEqual([]);
  });

  test('the file name is the document name when no name is given', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id, { name: null, fileName: 'Charte.PDF' }));

    expect(res.errors).toBeNull();
    expect(res.data.createDocument.name).toBe('Charte.PDF');
  });

  test('only PDF files are accepted, whatever the case of the extension', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const bad = await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id, { fileName: 'photo.png' }));
    const upper = await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id, { fileName: 'GRAND.PDF' }));

    expect(bad.errors?.[0].message).toMatch(/pdf/i);
    expect(upper.errors).toBeNull();
    expect(await entityFiles(s.vendor.id)).toHaveLength(1);
  });

  test('a document over 10 MB is refused, 10 MB exactly is accepted', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);
    const max = 10 * 1024 * 1024;
    const doc = (size: number) => ({ b64: `data:application/pdf;base64,${Buffer.alloc(size, 0x41).toString('base64')}` });

    const tooBig = await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id, doc(max + 1)));
    const exact = await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id, doc(max)));

    expect(tooBig.errors?.length).toBeGreaterThan(0);
    expect(exact.errors).toBeNull();
    expect(await entityFiles(s.vendor.id)).toHaveLength(1);
  });

  test('a vendor document can only be public', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    for (const visibility of ['members', 'subscribers', 'private', '']) {
      const res = await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id, { visibility }));

      expect(res.errors?.length, visibility).toBeGreaterThan(0);
    }
    expect(await entityFiles(s.vendor.id)).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  test('a member, the owner of another vendor and a visitor cannot add a document', { tag: ['@CAT-VDB-006'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const otherOwner = await make.user({ email: 'autre.producteur@camap.test' });
    await make.vendor({ name: 'Autre ferme', user: otherOwner });
    for (const user of [s.users.member, s.users.membershipManager, otherOwner]) {
      const who = await as(user);

      const res = await app.graphql(who.request, CREATE_DOC, docVars(s.vendor.id));

      expect(res.errors?.length, user.email).toBeGreaterThan(0);
    }
    expect((await app.graphql(anon.request, CREATE_DOC, docVars(s.vendor.id))).errors?.length).toBeGreaterThan(0);
    expect(await entityFiles(s.vendor.id)).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  // Unlike the vendor profile and the images (owner only once a vendor is claimed), the document
  // resolver lets anyone who manages one of the vendor's catalogs add a document, claimed or not.
  test('a coordinator of the vendor catalogs adds one even when the vendor is claimed (characterised)', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    const groupAdmin = await as(s.users.groupAdmin);

    const byCoordinator = await app.graphql(coordinator.request, CREATE_DOC, docVars(s.vendor.id));
    const byGroupAdmin = await app.graphql(groupAdmin.request, CREATE_DOC, docVars(s.vendor.id));

    expect(byCoordinator.errors).toBeNull();
    expect(byGroupAdmin.errors).toBeNull();
    expect(await entityFiles(s.vendor.id)).toHaveLength(2);
  });

  test('a coordinator of an unclaimed vendor and a superadmin can add one', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await release(s.vendor.id);
    const coordinator = await as(s.users.coordinator);
    const superadmin = await as(s.users.superadmin);
    const member = await as(s.users.member);

    expect((await app.graphql(coordinator.request, CREATE_DOC, docVars(s.vendor.id))).errors).toBeNull();
    expect((await app.graphql(superadmin.request, CREATE_DOC, docVars(s.vendor.id))).errors).toBeNull();
    expect((await app.graphql(member.request, CREATE_DOC, docVars(s.vendor.id))).errors?.length).toBeGreaterThan(0);
    expect(await entityFiles(s.vendor.id)).toHaveLength(2);
  });

  test('an unknown vendor is refused', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, CREATE_DOC, docVars(999999));

    expect(res.errors?.length).toBeGreaterThan(0);
  });

  test('the owner deletes a document: the record and its file are gone', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);
    const doc = (await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id))).data.createDocument;
    const keep = (await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id, { name: 'Autre' }))).data.createDocument;

    const res = await app.graphql(owner.request, DELETE_DOC, { id: doc.id });

    expect(res.errors).toBeNull();
    // camap-ts answers -1 even when the delete worked (the id is only returned when the driver reports `affected`)
    expect(res.data.deleteDocument).toBe(-1);
    expect((await entityFiles(s.vendor.id)).map((r) => r.id)).toEqual([keep.id]);
    expect(await fileCount()).toBe(1);
  });

  test('a member, the owner of another vendor and a visitor cannot delete a document', { tag: ['@CAT-VDB-006'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);
    const doc = (await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id))).data.createDocument;
    const otherOwner = await make.user({ email: 'autre.producteur@camap.test' });
    await make.vendor({ name: 'Autre ferme', user: otherOwner });
    for (const user of [s.users.member, otherOwner]) {
      const who = await as(user);

      const res = await app.graphql(who.request, DELETE_DOC, { id: doc.id });

      expect(res.errors?.length, user.email).toBeGreaterThan(0);
    }
    expect((await app.graphql(anon.request, DELETE_DOC, { id: doc.id })).errors?.length).toBeGreaterThan(0);
    expect(await entityFiles(s.vendor.id)).toHaveLength(1);
    expect(await fileCount()).toBe(1);
  });

  test('a coordinator of the vendor catalogs deletes it even when the vendor is claimed (characterised)', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);
    const coordinator = await as(s.users.coordinator);
    const doc = (await app.graphql(owner.request, CREATE_DOC, docVars(s.vendor.id))).data.createDocument;

    const res = await app.graphql(coordinator.request, DELETE_DOC, { id: doc.id });

    expect(res.errors).toBeNull();
    expect(await entityFiles(s.vendor.id)).toEqual([]);
  });

  test('deleting an unknown document is an error', { tag: ['@CAT-VDB-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, DELETE_DOC, { id: 999999 });

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});
