/**
 * Products over JSON and GraphQL (specs/03-catalogs/products.md: default picture, image upload,
 * product listing, vendor product sample; camap-hx controller/api/Product.hx, db/Product.hx,
 * camap-ts vendors/resolvers/products.resolver.ts). The coordinator's form is in products.forms.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import { makePng, pngSize } from '../../src/png.js';

const PNG_B64 = (w: number, h: number) => makePng(w, h).toString('base64');

type FileRow = { id: number; name: string; data: Buffer };
const fileRow = (id: number) => queryOne<FileRow>('SELECT id, name, data FROM File WHERE id = ?', [id]);
const imageIdOf = async (productId: number) => (await queryOne<{ imageId: number | null }>('SELECT imageId FROM Product WHERE id = ?', [productId]))!.imageId;

test.describe('product picture', () => {
  test('a product without image shows the default vegetable picture', { tag: ['@CAT-PRD-012'] }, async ({ app, anon, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const p = s.products.var[0];

    const one = await app.api.products.get(member.request, p.id);
    const list = await app.api.products.ofCatalog(member.request, s.varCatalog.id);

    expect(one.status).toBe(200);
    expect(one.body.image).toMatch(/legumes\.png$/);
    expect(list.body.products.every((x) => /legumes\.png$/.test(x.image))).toBe(true);
    void anon;
  });

  test('a product with an image shows that image instead', { tag: ['@CAT-PRD-012', '@CAT-PRD-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    const member = await as(s.users.member);
    const p = s.products.var[0];
    const before = (await app.api.products.get(member.request, p.id)).body.image;

    const res = await app.api.products.setImage(coordinator.request, { productId: p.id, base64: PNG_B64(50, 50), mimeType: 'image/png', fileName: 'tomate.png', maxWidth: 300 });

    expect(res.errors).toBeNull();
    const after = (await app.api.products.get(member.request, p.id)).body.image;
    expect(after).not.toBe(before);
    expect(after).not.toMatch(/legumes\.png$/);
    expect(res.data!.setProductImage.image).toBeTruthy();
  });
});

test.describe('product image upload', () => {
  test('a coordinator uploads an image: it is stored and linked to the product', { tag: ['@CAT-PRD-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    const p = s.products.var[0];

    const res = await app.api.products.setImage(coordinator.request, { productId: p.id, base64: PNG_B64(60, 40), mimeType: 'image/png', fileName: 'tomate.png', maxWidth: 300 });

    expect(res.errors).toBeNull();
    const imageId = await imageIdOf(p.id);
    expect(imageId).not.toBeNull();
    const file = await fileRow(imageId!);
    expect(file!.name).toBe('tomate.png');
    expect(pngSize(file!.data)).toEqual({ width: 60, height: 40 }); // smaller than maxWidth: not enlarged
  });

  test('the image is compressed: it is scaled down to the maximum width', { tag: ['@CAT-PRD-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    const p = s.products.var[0];
    const original = makePng(400, 300);

    await app.api.products.setImage(coordinator.request, { productId: p.id, base64: original.toString('base64'), mimeType: 'image/png', fileName: 'grand.png', maxWidth: 100 });

    const file = await fileRow((await imageIdOf(p.id))!);
    expect(pngSize(file!.data)).toEqual({ width: 100, height: 75 });
    expect(file!.data.length).toBeLessThan(original.length);
  });

  test('a new image replaces the previous one, which is deleted', { tag: ['@CAT-PRD-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    const p = s.products.var[0];
    await app.api.products.setImage(coordinator.request, { productId: p.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'ancienne.png', maxWidth: 300 });
    const first = (await imageIdOf(p.id))!;

    await app.api.products.setImage(coordinator.request, { productId: p.id, base64: PNG_B64(30, 30), mimeType: 'image/png', fileName: 'nouvelle.png', maxWidth: 300 });

    const second = (await imageIdOf(p.id))!;
    expect(second).not.toBe(first);
    expect(await fileRow(first)).toBeUndefined();
    expect((await fileRow(second))!.name).toBe('nouvelle.png');
    expect(await query('SELECT id FROM File')).toHaveLength(1);
  });

  test('a member cannot change the image', { tag: ['@CAT-PRD-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const p = s.products.var[0];

    const res = await app.api.products.setImage(member.request, { productId: p.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'piraté.png', maxWidth: 300 });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await imageIdOf(p.id)).toBeNull();
    expect(await query('SELECT id FROM File')).toEqual([]);
  });

  test('a coordinator of another catalog cannot change the image', { tag: ['@CAT-PRD-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });
    const bakerSession = await as(baker);
    const p = s.products.var[0];

    const res = await app.api.products.setImage(bakerSession.request, { productId: p.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'piraté.png', maxWidth: 300 });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await imageIdOf(p.id)).toBeNull();
  });

  test('a visitor cannot change the image', { tag: ['@CAT-PRD-013'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const p = s.products.var[0];

    const res = await app.api.products.setImage(anon.request, { productId: p.id, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'piraté.png', maxWidth: 300 });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await imageIdOf(p.id)).toBeNull();
  });

  test('an unknown product is reported as not found', { tag: ['@CAT-PRD-013'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);

    const res = await app.api.products.setImage(coordinator.request, { productId: 99999, base64: PNG_B64(20, 20), mimeType: 'image/png', fileName: 'x.png', maxWidth: 300 });

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(await query('SELECT id FROM File')).toEqual([]);
  });
});

test.describe('products in the catalog', () => {
  test('a member sees the products with unit, quantity, price and organic label', { tag: ['@CAT-PRD-016'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const bio = await make.product({ catalog: s.varCatalog, name: 'Carottes bio', price: 3.2, qt: 2 });
    await make.setProduct(bio.id, { organic: 1, unitType: 1 }); // kilogram

    const one = await app.api.products.get(member.request, bio.id);
    const list = await app.api.products.ofCatalog(member.request, s.varCatalog.id);

    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({ id: bio.id, name: 'Carottes bio', price: 3.2, qt: 2, organic: true, catalogId: s.varCatalog.id });
    expect(String(one.body.unitType)).toMatch(/^(1|Kilogram)$/);
    const listed = list.body.products.find((p) => p.id === bio.id)!;
    expect(listed).toMatchObject({ name: 'Carottes bio', price: 3.2, qt: 2, organic: true });
    expect(String(listed.unitType)).toMatch(/^(1|Kilogram)$/);
    // a product without the organic option is not labelled
    expect(list.body.products.find((p) => p.id === s.products.var[0].id)!.organic).toBe(false);
  });

  test('the list holds the products of the catalog only', { tag: ['@CAT-PRD-016'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const list = await app.api.products.ofCatalog(member.request, s.varCatalog.id);

    expect(list.body.products.map((p) => p.id).sort()).toEqual(s.products.var.map((p) => p.id).sort());
  });
});

test.describe('vendor product sample', () => {
  /** The vendor sells tomatoes in both catalogs (similar names) and one other product. */
  async function arrange() {
    const s = await make.amapScenario();
    const tomates = await make.product({ catalog: s.constCatalog, name: 'Tomates', price: 3 });
    const tomate = await make.product({ catalog: s.varCatalog, name: 'Tomate', price: 3 });
    const courgettes = await make.product({ catalog: s.varCatalog, name: 'Courgettes', price: 2 });
    return { s, tomates, tomate, courgettes };
  }

  test('the vendor sees a sample of the products of their vendor record', { tag: ['@CAT-PRD-017'] }, async ({ app, as }) => {
    const { s, courgettes } = await arrange();
    const vendor = await as(s.users.vendor);

    const res = await app.api.products.vendorSample(vendor.request, s.vendor.id);

    expect(res.errors).toBeNull();
    const names = res.data!.vendorProductsSample.map((p) => p.name);
    expect(names).toContain(courgettes.name);
    expect(names).toContain('Panier de légumes'); // a product of the vendor's other catalog
  });

  test('products with similar names are merged', { tag: ['@CAT-PRD-017'] }, async ({ app, as }) => {
    const { s } = await arrange();
    const vendor = await as(s.users.vendor);

    const res = await app.api.products.vendorSample(vendor.request, s.vendor.id);

    const names = res.data!.vendorProductsSample.map((p) => p.name);
    expect(names.filter((n) => /^Tomate/.test(n))).toHaveLength(1);
    // "Boîte de 6 œufs" and "Boîte de 12 œufs" are similar too: 6 products, 2 merges
    expect(names.filter((n) => /^Boîte/.test(n))).toHaveLength(1);
    expect(names).toHaveLength(4);
  });

  test('another vendor\'s products are not in the sample', { tag: ['@CAT-PRD-017'] }, async ({ app, as }) => {
    const { s } = await arrange();
    const otherVendor = await make.vendor({ name: 'Ferme voisine' });
    const otherCatalog = await make.catalog({ group: s.group, vendor: otherVendor, name: 'Fromages' });
    await make.product({ catalog: otherCatalog, name: 'Chèvre frais', price: 5 });
    const vendor = await as(s.users.vendor);

    const res = await app.api.products.vendorSample(vendor.request, s.vendor.id);

    expect(res.data!.vendorProductsSample.map((p) => p.name)).not.toContain('Chèvre frais');
  });

  // UND-043 (undecided): the query only needs a login. hx/Nest today: any logged-in user, member of
  // the group or not, sees the sample of any vendor; a visitor is turned away.
  test('hx today: any logged-in user sees the sample of any vendor', { tag: ['@CAT-PRD-018'] }, async ({ app, as }) => {
    const { s } = await arrange();
    const member = await as(s.users.member);
    const stranger = await as(s.users.nonMember);

    const byMember = await app.api.products.vendorSample(member.request, s.vendor.id);
    const byStranger = await app.api.products.vendorSample(stranger.request, s.vendor.id);

    expect(byMember.errors).toBeNull();
    expect(byStranger.errors).toBeNull();
    expect(byStranger.data!.vendorProductsSample.map((p) => p.name)).toEqual(byMember.data!.vendorProductsSample.map((p) => p.name));
    expect(byStranger.data!.vendorProductsSample.length).toBeGreaterThan(0);
  });

  test('a visitor cannot see the sample', { tag: ['@CAT-PRD-018'] }, async ({ app, anon }) => {
    const { s } = await arrange();

    const res = await app.api.products.vendorSample(anon.request, s.vendor.id);

    expect(res.errors?.length).toBeGreaterThan(0);
    expect(res.data).toBeNull();
  });
});
