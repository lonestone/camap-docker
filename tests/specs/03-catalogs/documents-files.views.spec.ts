/**
 * Who sees which documents and images of a group or catalog, and how a stored file is opened
 * (specs/03-catalogs/documents-files.md; camap-hx db/Catalog.hx getVisibleDocuments, db/Group.hx
 * getVisibleDocuments / getVisibleMedia, controller/Group.hx, controller/api/Catalog.hx, sugoi doFile).
 */
import { test, expect } from '../../src/fixtures.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';
import { makePng } from '../../src/png.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

/** In hx a catalog's subscriber is a member with an order on one of its products. */
async function subscribe(s: Scenario, user: { id: number }) {
  const sub = await make.subscription({ user, catalog: s.constCatalog, startDate: addDaysWall(new Date(), -1), endDate: addDaysWall(new Date(), 60) });
  const basket = await make.basket({ user, multiDistrib: s.multiDistribs[0] });
  await make.userOrder({ user, product: s.products.const[0], distribution: s.distributions[0].const, basket, subscription: sub });
}

/** One document of each visibility on a catalog. */
async function catalogDocuments(s: Scenario) {
  await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Reserve-souscripteurs.pdf', visibility: 'subscribers' });
  await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Reserve-membres.pdf', visibility: 'members' });
  await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Public.pdf', visibility: 'public' });
}

const catalogNames = async (app: CamapApp, request: Parameters<CamapApp['api']['catalog']['get']>[0], catalogId: number) => {
  const res = await app.api.catalog.get(request, catalogId);
  expect(res.status).toBe(200);
  return res.body.documents.map((d) => d.name).sort();
};

test.describe('the documents of a catalog, by who looks', () => {
  test('a subscriber sees all the documents', { tag: ['@CAT-DOC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await catalogDocuments(s);
    await subscribe(s, s.users.member);
    const member = await as(s.users.member);

    expect(await catalogNames(app, member.request, s.constCatalog.id)).toEqual(['Public.pdf', 'Reserve-membres.pdf', 'Reserve-souscripteurs.pdf']);
  });

  test('a group member who is not a subscriber sees all but the ones reserved to subscribers', { tag: ['@CAT-DOC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await catalogDocuments(s);
    await subscribe(s, s.users.member);
    const other = await as(s.users.member2);

    expect(await catalogNames(app, other.request, s.constCatalog.id)).toEqual(['Public.pdf', 'Reserve-membres.pdf']);
  });

  test('someone outside the group, and a visitor, see only the public documents', { tag: ['@CAT-DOC-004'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    await catalogDocuments(s);
    const outsider = await as(s.users.nonMember);

    expect(await catalogNames(app, outsider.request, s.constCatalog.id)).toEqual(['Public.pdf']);
    expect(await catalogNames(app, anon.request, s.constCatalog.id)).toEqual(['Public.pdf']);
  });

  // UND-042: managers get no special treatment in hx; the suggestion gives them all documents
  test('a coordinator who is not a subscriber sees what any member sees (UND-042)', { tag: ['@CAT-DOC-004', '@CAT-DOC-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await catalogDocuments(s);
    const coordinator = await as(s.users.coordinator);

    expect(await catalogNames(app, coordinator.request, s.constCatalog.id)).toEqual(['Public.pdf', 'Reserve-membres.pdf']);
  });

  test('a subscriber of another catalog is not a subscriber of this one', { tag: ['@CAT-DOC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await catalogDocuments(s);
    const sub = await make.subscription({ user: s.users.member, catalog: s.varCatalog, startDate: addDaysWall(new Date(), -1), endDate: addDaysWall(new Date(), 60) });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member, product: s.products.var[0], distribution: s.distributions[0].var, basket, subscription: sub });
    const member = await as(s.users.member);

    expect(await catalogNames(app, member.request, s.constCatalog.id)).toEqual(['Public.pdf', 'Reserve-membres.pdf']);
  });

  test('the documents of another catalog and of the group are not listed', { tag: ['@CAT-DOC-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Ici.pdf', visibility: 'public' });
    await make.entityFile({ entityType: 'catalog', entityId: s.varCatalog.id, name: 'Ailleurs.pdf', visibility: 'public' });
    await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Groupe.pdf', visibility: 'public' });
    await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, documentType: 'media', name: 'image.png', visibility: 'public' });
    const member = await as(s.users.member);

    expect(await catalogNames(app, member.request, s.constCatalog.id)).toEqual(['Ici.pdf']);
  });
});

test.describe('the documents and images of a group, by who looks', () => {
  async function groupDocuments(s: Scenario) {
    await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Statuts-membres.pdf', visibility: 'members' });
    await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Statuts-public.pdf', visibility: 'public' });
    await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Reserve-souscripteurs.pdf', visibility: 'subscribers' });
  }
  const names = (page: { documents: { name: string }[] }) => page.documents.map((d) => d.name).sort();

  test('a member sees every group document, a visitor and an outsider the public ones', { tag: ['@CAT-DOC-003', '@CAT-DOC-005'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    await groupDocuments(s);
    const member = await as(s.users.member);
    const outsider = await as(s.users.nonMember);

    const asMember = await app.views.groups.page(member.request, s.group.id);
    const asOutsider = await app.views.groups.page(outsider.request, s.group.id);
    const asVisitor = await app.views.groups.page(anon.request, s.group.id);

    expect(asMember.status).toBe(200);
    // hx only tells members from the others for group documents: "subscribers" is shown to every member
    expect(names(asMember)).toEqual(['Reserve-souscripteurs.pdf', 'Statuts-membres.pdf', 'Statuts-public.pdf']);
    expect(names(asOutsider)).toEqual(['Statuts-public.pdf']);
    expect(names(asVisitor)).toEqual(['Statuts-public.pdf']);
  });

  test('the group page also lists the documents of its active catalogs, by the same rules', { tag: ['@CAT-DOC-004'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    await catalogDocuments(s);
    await subscribe(s, s.users.member);
    const subscriber = await as(s.users.member);
    const member = await as(s.users.member2);

    expect(names(await app.views.groups.page(subscriber.request, s.group.id))).toEqual(['Public.pdf', 'Reserve-membres.pdf', 'Reserve-souscripteurs.pdf']);
    expect(names(await app.views.groups.page(member.request, s.group.id))).toEqual(['Public.pdf', 'Reserve-membres.pdf']);
    expect(names(await app.views.groups.page(anon.request, s.group.id))).toEqual(['Public.pdf']);
  });

  test('the images of the gallery are on the group page, for the public ones to everybody', { tag: ['@CAT-DOC-008'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'media', name: 'Marche.png', visibility: 'public', data: makePng(20, 20) });
    await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'media', name: 'Interne.png', visibility: 'members', data: makePng(20, 20) });
    const member = await as(s.users.member);

    const asMember = await app.views.groups.page(member.request, s.group.id);
    const asVisitor = await app.views.groups.page(anon.request, s.group.id);

    // a member sees the images of every visibility, a visitor the public ones (images are uploaded as public)
    expect(asMember.images.map((i) => i.name).sort()).toEqual(['Interne.png', 'Marche.png']);
    expect(asVisitor.images.map((i) => i.name)).toEqual(['Marche.png']);
  });

  test('documents are not shown as images, nor images as documents', { tag: ['@CAT-DOC-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.entityFile({ entityType: 'group', entityId: s.group.id, documentType: 'media', name: 'Marche.png', visibility: 'public' });
    await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Statuts.pdf', visibility: 'public' });
    const member = await as(s.users.member);

    const page = await app.views.groups.page(member.request, s.group.id);

    expect(page.images.map((i) => i.name)).toEqual(['Marche.png']);
    expect(names(page)).toEqual(['Statuts.pdf']);
  });
});

test.describe('opening a stored file', () => {
  test('the link of a document opens the file, even for a visitor', { tag: ['@CAT-DOC-012'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const content = Buffer.from('%PDF-1.4\nle contenu\n%%EOF\n');
    // hx keeps a copy of an opened file on disk, named after its id: use an id no other test uses.
    // Keep it small: sugoi caches signatures in a Neko array indexed by id (max_array_size ~2^29).
    const fileId = 100_000 + (Date.now() % 5_000_000);
    await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Statuts.pdf', visibility: 'public', data: content, fileId });
    const member = await as(s.users.member);
    const [link] = (await app.views.groups.page(member.request, s.group.id)).documents;

    // the link carries the file id and a signature derived from the server key
    expect(link.href).toMatch(/^\/file\/\d+_[0-9a-f]{32}$/);
    const asMember = await app.actions.files.open(member.request, link.href);
    const asVisitor = await app.actions.files.open(anon.request, link.href);

    expect(asMember.status).toBe(200);
    expect(asMember.body.equals(content)).toBe(true);
    expect(asVisitor.status).toBe(200);
    expect(asVisitor.body.equals(content)).toBe(true);
  });

  test('the link in the public catalog data opens the document', { tag: ['@CAT-DOC-012'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const content = Buffer.from('%PDF-1.4\ncontrat\n%%EOF\n');
    const fileId = 100_000 + (Date.now() % 5_000_000);
    await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: 'Contrat.pdf', visibility: 'members', data: content, fileId });
    const member = await as(s.users.member);

    const [doc] = (await app.api.catalog.get(member.request, s.constCatalog.id)).body.documents;
    const res = await app.actions.files.open(member.request, doc.url);

    expect(doc.url).toMatch(/^\/file\/\d+_[0-9a-f]{32}$/);
    expect(res.status).toBe(200);
    expect(res.body.equals(content)).toBe(true);
  });

  test('a link with a wrong signature, or for an unknown file, does not open anything', { tag: ['@CAT-DOC-012'] }, async ({ app, anon }) => {
    const doc = await make.entityFile({ entityType: 'group', entityId: (await make.group({ name: 'G' })).id, name: 'Secret.pdf', visibility: 'members', data: Buffer.from('%PDF-secret') });

    for (const href of [`/file/${doc.fileId}.pdf`, `/file/${doc.fileId}_${'0'.repeat(32)}.pdf`, `/file/${doc.fileId + 100}_${'0'.repeat(32)}.pdf`]) {
      const res = await app.actions.files.open(anon.request, href);

      // hx answers a 404 text with a 200 status
      expect(res.body.toString().startsWith('404'), href).toBe(true);
      expect(res.body.toString(), href).not.toContain('secret');
    }
  });

  test('the signature is not valid for another file', { tag: ['@CAT-DOC-012'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const a = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'A.pdf', visibility: 'public', data: Buffer.from('%PDF-A') });
    const b = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'B.pdf', visibility: 'public', data: Buffer.from('%PDF-B') });
    const member = await as(s.users.member);
    const links = (await app.views.groups.page(member.request, s.group.id)).documents;
    const linkA = links.find((l) => l.name === 'A.pdf')!;

    const forged = linkA.href.replace(`/file/${a.fileId}_`, `/file/${b.fileId}_`);
    const res = await app.actions.files.open(anon.request, forged);

    expect(res.body.toString().startsWith('404')).toBe(true);
  });
});
