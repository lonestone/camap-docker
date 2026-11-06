/**
 * Documents of a group or a catalog through the GraphQL API (the Nest `createDocument`,
 * `deleteDocument` and the `documents` field of a catalog; camap-ts entity-file.resolver.ts and
 * catalogs.resolver.ts), which both stacks serve. The vendor documents are in
 * vendor-pages.graphql.spec.ts, the hx admin forms in documents-files.forms.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query } from '../../src/db/client.js';
import { addDaysWall } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

const CREATE_DOC = `mutation($entityType: String!, $entityId: Int!, $b64: String!, $fileName: String!, $name: String, $visibility: String!) {
  createDocument(entityType: $entityType, entityId: $entityId, base64EncodedFile: $b64, fileName: $fileName, name: $name, visibility: $visibility) {
    id entityType documentType entityId visibility name url
  }
}`;
const DELETE_DOC = `mutation($id: Int!) { deleteDocument(id: $id) }`;
const CATALOG_DOCS = `query($groupId: Int!) { getActiveCatalogs(groupId: $groupId) { id documents { id visibility name } } }`;

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
const vars = (entityType: 'group' | 'catalog', entityId: number, over: Record<string, unknown> = {}) => ({
  entityType,
  entityId,
  b64: `data:application/pdf;base64,${PDF.toString('base64')}`,
  fileName: 'reglement.pdf',
  name: 'Règlement',
  visibility: 'members',
  ...over,
});

type EntityFileRow = { id: number; entityType: string; documentType: string; entityId: number; fileId: number; data: string };
const documents = () => query<EntityFileRow>("SELECT * FROM EntityFile WHERE documentType = 'document' ORDER BY id");
const fileCount = async () => (await query('SELECT id FROM File')).length;

test.describe('adding a group document', () => {
  test('a group admin adds a document; the name defaults to the file name', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);

    const res = await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, { visibility: 'public' }));
    const unnamed = await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, { name: null, fileName: 'Charte.PDF' }));

    expect(res.errors).toBeNull();
    expect(res.data.createDocument).toMatchObject({ entityType: 'group', documentType: 'document', entityId: s.group.id, visibility: 'public', name: 'Règlement' });
    expect(res.data.createDocument.url).toMatch(/^\/file\//);
    expect(unnamed.data.createDocument.name).toBe('Charte.PDF');
    const [row] = await documents();
    expect(row).toMatchObject({ entityType: 'group', entityId: s.group.id, data: 'public' });
    const file = (await query<{ name: string; data: Buffer }>('SELECT name, data FROM File WHERE id = ?', [row.fileId]))[0];
    expect(file.name).toBe('Règlement');
    expect(file.data.equals(PDF)).toBe(true);
  });

  test('only a .pdf name is accepted, up to 10 MB', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    const max = 10 * 1024 * 1024;
    const big = (size: number) => ({ b64: `data:application/pdf;base64,${Buffer.alloc(size, 0x41).toString('base64')}` });

    const png = await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, { fileName: 'photo.png' }));
    const upper = await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, { fileName: 'GRAND.PDF' }));
    const tooBig = await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, big(max + 1)));
    const exact = await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, big(max)));

    expect(png.errors?.[0].message).toMatch(/pdf/i);
    expect(upper.errors).toBeNull();
    expect(tooBig.errors?.length).toBeGreaterThan(0);
    expect(exact.errors).toBeNull();
    expect(await documents()).toHaveLength(2);
  });

  // UND-053: only the extension is checked, the %PDF- signature is not
  test('any content named .pdf is stored (UND-053)', { tag: ['@CAT-DOC-006'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    const notPdf = `data:application/pdf;base64,${Buffer.from('MZ not a pdf').toString('base64')}`;

    const res = await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, { b64: notPdf, fileName: 'faux.pdf' }));

    expect(res.errors).toBeNull();
    expect(await documents()).toHaveLength(1);
  });

  test('a group document is for members or for everyone, not for subscribers', { tag: ['@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);

    for (const visibility of ['members', 'public']) {
      expect((await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, { visibility }))).errors, visibility).toBeNull();
    }
    // hx lets a group document be reserved to subscribers; this API does not (CODE-099)
    for (const visibility of ['subscribers', 'private', '']) {
      expect((await app.graphql(admin.request, CREATE_DOC, vars('group', s.group.id, { visibility }))).errors?.length, visibility).toBeGreaterThan(0);
    }
    expect((await documents()).map((r) => r.data)).toEqual(['members', 'public']);
  });

  test('a coordinator, a member, a vendor and a visitor cannot add a group document', { tag: ['@CAT-DOC-001'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    for (const user of [s.users.coordinator, s.users.member, s.users.vendor, s.users.nonMember]) {
      const who = await as(user);

      const res = await app.graphql(who.request, CREATE_DOC, vars('group', s.group.id));

      expect(res.errors?.length, user.email).toBeGreaterThan(0);
    }
    expect((await app.graphql(anon.request, CREATE_DOC, vars('group', s.group.id))).errors?.length).toBeGreaterThan(0);
    expect(await documents()).toEqual([]);
    expect(await fileCount()).toBe(0);
  });

  test('the admin of another group cannot add one, an unknown group is refused', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const otherAdmin = await make.user({ email: 'admin.autre@camap.test' });
    await make.userGroup({ user: otherAdmin, group: other, rights: [{ right: 'GroupAdmin', params: null }] });
    const who = await as(otherAdmin);

    const foreign = await app.graphql(who.request, CREATE_DOC, vars('group', s.group.id));
    const unknown = await app.graphql(who.request, CREATE_DOC, vars('group', 999999));
    const own = await app.graphql(who.request, CREATE_DOC, vars('group', other.id));

    expect(foreign.errors?.length).toBeGreaterThan(0);
    expect(unknown.errors?.length).toBeGreaterThan(0);
    expect(own.errors).toBeNull();
    expect(await documents()).toHaveLength(1);
  });

  test('an unknown entity type is refused', { tag: ['@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);

    const res = await app.graphql(admin.request, CREATE_DOC, { ...vars('group', s.group.id), entityType: 'place' });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await documents()).toEqual([]);
  });
});

test.describe('adding a catalog document', () => {
  test('a coordinator adds a document to their catalog, for subscribers, members or everyone', { tag: ['@CAT-DOC-002', '@CAT-DOC-003'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);

    for (const visibility of ['subscribers', 'members', 'public']) {
      const res = await app.graphql(coordinator.request, CREATE_DOC, vars('catalog', s.constCatalog.id, { visibility }));

      expect(res.errors, visibility).toBeNull();
      expect(res.data.createDocument, visibility).toMatchObject({ entityType: 'catalog', entityId: s.constCatalog.id, visibility });
    }
    const bad = await app.graphql(coordinator.request, CREATE_DOC, vars('catalog', s.constCatalog.id, { visibility: 'private' }));
    expect(bad.errors?.length).toBeGreaterThan(0);
    expect((await documents()).map((r) => r.data)).toEqual(['subscribers', 'members', 'public']);
  });

  test('the PDF rules apply to catalog documents too', { tag: ['@CAT-DOC-002', '@CAT-DOC-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    const tooBig = `data:application/pdf;base64,${Buffer.alloc(10 * 1024 * 1024 + 1, 0x41).toString('base64')}`;

    const png = await app.graphql(coordinator.request, CREATE_DOC, vars('catalog', s.constCatalog.id, { fileName: 'photo.png' }));
    const big = await app.graphql(coordinator.request, CREATE_DOC, vars('catalog', s.constCatalog.id, { b64: tooBig }));

    expect(png.errors?.length).toBeGreaterThan(0);
    expect(big.errors?.length).toBeGreaterThan(0);
    expect(await documents()).toEqual([]);
  });

  test('a group admin and a superadmin can; a member and a visitor cannot', { tag: ['@CAT-DOC-002'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    for (const user of [s.users.groupAdmin, s.users.superadmin]) {
      const who = await as(user);
      expect((await app.graphql(who.request, CREATE_DOC, vars('catalog', s.varCatalog.id))).errors, user.email).toBeNull();
    }
    for (const user of [s.users.member, s.users.nonMember]) {
      const who = await as(user);
      expect((await app.graphql(who.request, CREATE_DOC, vars('catalog', s.varCatalog.id))).errors?.length, user.email).toBeGreaterThan(0);
    }
    expect((await app.graphql(anon.request, CREATE_DOC, vars('catalog', s.varCatalog.id))).errors?.length).toBeGreaterThan(0);
    expect(await documents()).toHaveLength(2);
  });

  // The hx forms only let group managers and coordinators in; this API also lets the vendor's owner in.
  test('the owner of the catalog vendor can add one (characterised)', { tag: ['@CAT-DOC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const owner = await as(s.users.vendor);

    const res = await app.graphql(owner.request, CREATE_DOC, vars('catalog', s.constCatalog.id));

    expect(res.errors).toBeNull();
    expect(await documents()).toHaveLength(1);
  });

  test('the coordinator of another catalog cannot; an unknown catalog is refused', { tag: ['@CAT-DOC-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: await make.vendor({ name: 'Boulangerie' }), name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [{ right: 'ContractAdmin', params: [String(other.id)] }] });
    const who = await as(baker);

    const foreign = await app.graphql(who.request, CREATE_DOC, vars('catalog', s.constCatalog.id));
    const unknown = await app.graphql(who.request, CREATE_DOC, vars('catalog', 999999));
    const own = await app.graphql(who.request, CREATE_DOC, vars('catalog', other.id));

    expect(foreign.errors?.length).toBeGreaterThan(0);
    expect(unknown.errors?.length).toBeGreaterThan(0);
    expect(own.errors).toBeNull();
  });
});

test.describe('deleting a group or catalog document', () => {
  async function created(app: any, request: any, s: Scenario) {
    const g = (await app.graphql(request, CREATE_DOC, vars('group', s.group.id, { name: 'Du groupe' }))).data.createDocument;
    const c = (await app.graphql(request, CREATE_DOC, vars('catalog', s.constCatalog.id, { name: 'Du catalogue' }))).data.createDocument;
    return { g, c };
  }

  test('a group admin deletes a group document and a catalog document: the records and their files are gone', { tag: ['@CAT-DOC-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    const { g, c } = await created(app, admin.request, s);
    const keep = await make.entityFile({ entityType: 'group', entityId: s.group.id, name: 'Garde.pdf' });

    const delGroup = await app.graphql(admin.request, DELETE_DOC, { id: g.id });
    const delCatalog = await app.graphql(admin.request, DELETE_DOC, { id: c.id });

    expect(delGroup.errors).toBeNull();
    expect(delCatalog.errors).toBeNull();
    expect((await documents()).map((r) => r.id)).toEqual([keep.id]);
    expect(await fileCount()).toBe(1);
  });

  test('a coordinator deletes a document of their catalog but not a group document', { tag: ['@CAT-DOC-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    const { g, c } = await created(app, admin.request, s);
    const coordinator = await as(s.users.coordinator);

    const refused = await app.graphql(coordinator.request, DELETE_DOC, { id: g.id });
    const ok = await app.graphql(coordinator.request, DELETE_DOC, { id: c.id });

    expect(refused.errors?.length).toBeGreaterThan(0);
    expect(ok.errors).toBeNull();
    expect((await documents()).map((r) => r.id)).toEqual([g.id]);
  });

  test('a member and a visitor cannot delete; an unknown document is an error', { tag: ['@CAT-DOC-007'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.groupAdmin);
    const { g, c } = await created(app, admin.request, s);
    const member = await as(s.users.member);

    for (const id of [g.id, c.id]) {
      expect((await app.graphql(member.request, DELETE_DOC, { id })).errors?.length).toBeGreaterThan(0);
      expect((await app.graphql(anon.request, DELETE_DOC, { id })).errors?.length).toBeGreaterThan(0);
    }
    expect((await app.graphql(admin.request, DELETE_DOC, { id: 999999 })).errors?.length).toBeGreaterThan(0);
    expect(await documents()).toHaveLength(2);
    expect(await fileCount()).toBe(2);
  });
});

test.describe('the documents field of a catalog', () => {
  async function arrange() {
    const s = await make.amapScenario();
    for (const visibility of ['subscribers', 'members', 'public']) {
      await make.entityFile({ entityType: 'catalog', entityId: s.constCatalog.id, name: `doc-${visibility}.pdf`, visibility });
    }
    await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: addDaysWall(new Date(), -1), endDate: addDaysWall(new Date(), 60) });
    return s;
  }
  const docsOf = (res: any, catalogId: number): string[] =>
    (res.data.getActiveCatalogs.find((c: { id: number }) => c.id === catalogId)?.documents ?? []).map((d: { visibility: string }) => d.visibility).sort();

  // UND-042: `canManageCatalog` is not awaited in catalogs.resolver.ts, so its (truthy) promise gives every
  // logged-in caller the full list. The suggestion is the hx rules: managers and subscribers all, members
  // all but "subscribers", others public only.
  test('today every logged-in user is given all the documents, including the ones for subscribers (UND-042)', { tag: ['@CAT-DOC-005', '@CAT-DOC-004'] }, async ({ app, as }) => {
    const s = await arrange();

    for (const user of [s.users.member, s.users.member2, s.users.nonMember, s.users.coordinator]) {
      const who = await as(user);

      const res = await app.graphql(who.request, CATALOG_DOCS, { groupId: s.group.id });

      expect(res.errors, user.email).toBeNull();
      expect(docsOf(res, s.constCatalog.id), user.email).toEqual(['members', 'public', 'subscribers']);
    }
  });

  test('a visitor cannot read it', { tag: ['@CAT-DOC-005'] }, async ({ app, anon }) => {
    const s = await arrange();

    const res = await app.graphql(anon.request, CATALOG_DOCS, { groupId: s.group.id });

    expect(res.errors?.length).toBeGreaterThan(0);
  });
});
