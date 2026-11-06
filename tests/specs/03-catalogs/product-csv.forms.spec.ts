/**
 * Product CSV import and export (specs/03-catalogs/product-csv.md; camap-hx controller/Product.hx
 * doImport / doExport). Import is three steps over hx: send a file (the rows read wait in the session),
 * check the table, confirm. Export is a plain download.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne } from '../../src/db/client.js';
import { Right } from '../../src/encodings/rights.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp, UploadFile } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'coordinator') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

type ProductRow = {
  id: number;
  name: string;
  ref: string | null;
  price: number;
  vat: number;
  desc: string | null;
  qt: number | null;
  unitType: number | null;
  stockTracking: number | null;
  stock: number | null;
  organic: number;
  variablePrice: number;
  multiWeight: number;
  bulk: number;
  active: number;
  imageId: number | null;
  catalogId: number;
};
const productsOf = (catalogId: number) => query<ProductRow>('SELECT * FROM Product WHERE catalogId = ? ORDER BY id', [catalogId]);
/** The export header is the French label of each field (two columns have no translation: "unit" and "bulk"). */
const EXPORT_HEADER = ['Nom', 'prix TTC', 'Référence', 'Description', 'TVA', 'Quantité', 'unit', 'Agriculture biologique', 'bulk', 'Prix variable selon pesée'];
const productCount = async () => (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM Product'))!.n;

/** Unit ordinals of camap-hx/common/Common.hx Unit. */
const UNIT = { piece: 0, kilogram: 1, gram: 2, litre: 3, centilitre: 4, millilitre: 5 } as const;

const HEADER = 'Nom,Prix,Référence,Description,TVA,Quantité,Unité,Bio,Vrac,Prix variable';
const csvFile = (rows: string[], opts: { header?: string; name?: string; eol?: string } = {}): UploadFile => ({
  name: opts.name ?? 'produits.csv',
  content: Buffer.from([opts.header ?? HEADER, ...rows].join(opts.eol ?? '\n') + (opts.eol ?? '\n'), 'utf8'),
});

/** The three steps in a row: send the file, then confirm. */
async function importFile(app: CamapApp, request: any, catalogId: number, file: UploadFile) {
  const preview = await app.actions.products.csvImport.upload(request, catalogId, file);
  const done = await app.actions.products.csvImport.confirm(request, catalogId);
  return { preview, done };
}

test.describe('importing products', () => {
  test('three steps: choose a file, check the table, confirm', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    const open = await app.actions.products.csvImport.open(a.request, s.varCatalog.id);
    const preview = await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, csvFile(['Tomates,3.5,T1,Rouges,5.5,1,kg,1,0,0', 'Oeufs,4,,Fermiers,5.5,6,piece,0,0,0']));

    expect(open).toMatchObject({ status: 200, step: 1 });
    expect(preview).toMatchObject({ status: 200, step: 2, offersConfirm: true });
    expect(preview.previewRows).toHaveLength(2);
    expect(preview.previewRows[0].slice(0, 2)).toEqual(['Tomates', '3.5']);
    expect(preview.previewRows[1][0]).toBe('Oeufs');
    expect(await productCount()).toBe(before); // nothing is saved before the confirmation

    const done = await app.actions.products.csvImport.confirm(a.request, s.varCatalog.id);

    expect(done).toMatchObject({ status: 200, step: 3, importedCount: 2 });
    expect(await productCount()).toBe(before + 2);
  });

  test('the columns are product name, price, reference, description, VAT, quantity, unit, organic, bulk, variable price', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

    await importFile(app, a.request, s.varCatalog.id, csvFile(['Tomates cerises,3.5,TC-01,Petites et sucrées,20,0.5,kg,1,1,1']));

    const p = (await productsOf(s.varCatalog.id)).find((x) => !known.includes(x.id))!;
    expect(p).toMatchObject({
      name: 'Tomates cerises',
      price: 3.5,
      ref: 'TC-01',
      desc: 'Petites et sucrées',
      vat: 20,
      qt: 0.5,
      unitType: UNIT.kilogram,
      organic: 1,
      bulk: 1,
      variablePrice: 1,
    });
  });

  test('the header row is skipped whatever it says, and the preview shows the fixed column names', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const preview = await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, csvFile(['Radis,1,,,5.5,1,piece,0,0,0'], { header: 'a,b,c,d,e,f,g,h,i,j' }));

    expect(preview.step).toBe(2);
    expect(preview.previewHeader).toHaveLength(10);
    expect(preview.previewRows).toHaveLength(1);
    expect(preview.previewRows[0][0]).toBe('Radis');
  });

  const unitCases: [string, keyof typeof UNIT][] = [
    ['kg', 'kilogram'],
    ['kilogram', 'kilogram'],
    ['g', 'gram'],
    ['gram', 'gram'],
    ['l', 'litre'],
    ['litre', 'litre'],
    ['cl', 'centilitre'],
    ['centilitre', 'centilitre'],
    ['ml', 'millilitre'],
    ['millilitre', 'millilitre'],
    ['KG', 'kilogram'], // case does not matter
    ['Litre', 'litre'],
    ['piece', 'piece'],
    ['bottle', 'piece'], // anything else means piece
    ['kilos', 'piece'],
    ['', 'piece'],
  ];
  for (const [text, unit] of unitCases) {
    test(`the unit "${text}" is read as ${unit}`, { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await actor(app, as, s);
      const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

      await importFile(app, a.request, s.varCatalog.id, csvFile([`Produit,2,,,5.5,1,${text},0,0,0`]));

      const p = (await productsOf(s.varCatalog.id)).find((x) => !known.includes(x.id))!;
      expect(p.unitType).toBe(UNIT[unit]);
    });
  }

  test('a file without the unit column gives pieces', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

    await importFile(app, a.request, s.varCatalog.id, csvFile(['Produit,2,,,5.5,3']));

    const p = (await productsOf(s.varCatalog.id)).find((x) => !known.includes(x.id))!;
    expect(p).toMatchObject({ qt: 3, unitType: UNIT.piece });
  });

  test('imported products are active, without stock tracking, and not multi-weight', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

    await importFile(app, a.request, s.varCatalog.id, csvFile(['Produit,2,,,5.5,1,piece,0,0,0']));

    const p = (await productsOf(s.varCatalog.id)).find((x) => !known.includes(x.id))!;
    expect(p).toMatchObject({ active: 1, stockTracking: 0, stock: null, multiWeight: 0, imageId: null });
  });

  test('organic, bulk and variable price are true for "true" or "1", false for anything else', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

    await importFile(app, a.request, s.varCatalog.id, csvFile([
      'A,1,,,5.5,1,kg,true,true,true',
      'B,1,,,5.5,1,kg,1,1,1',
      'C,1,,,5.5,1,kg,0,0,0',
      'D,1,,,5.5,1,kg,false,false,false',
      'E,1,,,5.5,1,kg,oui,yes,x',
      'F,1,,,5.5,1,kg,,,',
      'G,1,,,5.5,1,kg,TRUE,True,2',
    ]));

    const rows = (await productsOf(s.varCatalog.id)).filter((x) => !known.includes(x.id));
    const flagsOf = (name: string) => {
      const p = rows.find((x) => x.name === name)!;
      return [p.organic, p.bulk, p.variablePrice];
    };
    expect(flagsOf('A')).toEqual([1, 1, 1]);
    expect(flagsOf('B')).toEqual([1, 1, 1]);
    expect(flagsOf('C')).toEqual([0, 0, 0]);
    expect(flagsOf('D')).toEqual([0, 0, 0]);
    expect(flagsOf('E')).toEqual([0, 0, 0]);
    expect(flagsOf('F')).toEqual([0, 0, 0]);
    expect(flagsOf('G')).toEqual([0, 0, 0]); // the comparison is case sensitive
  });

  test('a semicolon-separated file is understood too, with decimal commas', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

    await importFile(app, a.request, s.varCatalog.id, csvFile(['Miel;12,5;M1;Toutes fleurs;5,5;0,5;kg;1;0;0'], { header: HEADER.replace(/,/g, ';') }));

    const p = (await productsOf(s.varCatalog.id)).find((x) => !known.includes(x.id))!;
    expect(p).toMatchObject({ name: 'Miel', price: 12.5, ref: 'M1', desc: 'Toutes fleurs', vat: 5.5, qt: 0.5, unitType: UNIT.kilogram, organic: 1 });
  });

  test('quoted fields may contain the separator, and a file saved in Latin-1 is converted to UTF-8', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);
    const latin1: UploadFile = { name: 'produits.csv', content: Buffer.from(`${HEADER}\n"Pâté, nature",4,,"Petit, mais bon",5.5,1,piece,0,0,0\n`, 'latin1') };

    await importFile(app, a.request, s.varCatalog.id, latin1);

    const p = (await productsOf(s.varCatalog.id)).find((x) => !known.includes(x.id))!;
    expect(p.name).toBe('Pâté, nature');
    expect(p.desc).toBe('Petit, mais bon');
  });

  test('empty lines and rows without a product name are left out', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

    const { done } = await importFile(app, a.request, s.varCatalog.id, csvFile(['Un,1', '', ',,,,,,,,,', ',5,REF,,,,,,,', 'Deux,2']));

    const rows = (await productsOf(s.varCatalog.id)).filter((x) => !known.includes(x.id));
    expect(rows.map((r) => r.name)).toEqual(['Un', 'Deux']);
    // Finding: the confirmation page counts the rows read (3, the nameless one included), not the products saved (2)
    expect(done.importedCount).toBe(3);
  });

  test('a file with only a header gives nothing to import', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    const preview = await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, csvFile([]));
    const done = await app.actions.products.csvImport.confirm(a.request, s.varCatalog.id);

    expect(preview).toMatchObject({ step: 2, offersConfirm: false });
    expect(done).toMatchObject({ step: 3, importedCount: null });
    expect(await productCount()).toBe(before);
  });

  test('sending the form without a file shows the file chooser again', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, null);

    expect(res).toMatchObject({ status: 200, step: 1 });
  });

  // Finding: no check is run on imported rows (ProductService.check() is not called): a bulk product
  // is accepted without any unit and a missing VAT is stored as 0.
  test('hx today: imported rows are not validated (bulk without unit accepted, missing VAT stored as 0)', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const known = (await productsOf(s.varCatalog.id)).map((p) => p.id);

    await importFile(app, a.request, s.varCatalog.id, csvFile(['Vrac,2,,,,,,0,1,0']));

    const p = (await productsOf(s.varCatalog.id)).find((x) => !known.includes(x.id))!;
    expect(p).toMatchObject({ name: 'Vrac', price: 2, bulk: 1, vat: 0, unitType: UNIT.piece, qt: null });
  });

  // Finding: a row whose price is missing or not a number makes hx fail ("Invalid operation" while rounding
  // the price in Product.check()); the whole import is rolled back, the good rows before it included.
  for (const [label, row] of [['not a number', 'Mauvais,beaucoup'], ['missing', 'Mauvais,']] as const) {
    test(`hx today: a row whose price is ${label} makes the whole import fail`, { tag: ['@CAT-PCS-001'] }, async ({ app, as, errors }) => {
      errors.expect(/Invalid operation/);
      const s = await make.amapScenario();
      const a = await actor(app, as, s);
      const before = await productCount();

      const preview = await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, csvFile(['Bon,2', row]));
      const done = await app.actions.products.csvImport.confirm(a.request, s.varCatalog.id);

      expect(preview.previewRows).toHaveLength(2);
      expect(done.step).toBeNull(); // an error page
      expect(done.importedCount).toBeNull();
      expect(await productCount()).toBe(before);
    });
  }

  test('the import works on a constant catalog too, and the rows go to the catalog of the page', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const varBefore = await productsOf(s.varCatalog.id);
    const constBefore = await productsOf(s.constCatalog.id);

    await importFile(app, a.request, s.constCatalog.id, csvFile(['Panier bio,20,,,5.5,1,piece,1,0,0']));

    expect(await productsOf(s.varCatalog.id)).toEqual(varBefore);
    const after = await productsOf(s.constCatalog.id);
    expect(after).toHaveLength(constBefore.length + 1);
    expect(after.at(-1)).toMatchObject({ name: 'Panier bio', catalogId: s.constCatalog.id });
  });

  test('going back to the first step forgets the file already read', { tag: ['@CAT-PCS-001'] }, async ({ app, as, errors }) => {
    errors.expect(/./); // confirming with nothing in the session fails inside hx
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, csvFile(['Un,1']));
    await app.actions.products.csvImport.open(a.request, s.varCatalog.id);
    await app.actions.products.csvImport.confirm(a.request, s.varCatalog.id);

    expect(await productCount()).toBe(before);
  });

  test('confirming twice imports once: the rows are dropped from the session', { tag: ['@CAT-PCS-001'] }, async ({ app, as, errors }) => {
    errors.expect(/./);
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();

    await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, csvFile(['Un,1']));
    await app.actions.products.csvImport.confirm(a.request, s.varCatalog.id);
    await app.actions.products.csvImport.confirm(a.request, s.varCatalog.id);

    expect(await productCount()).toBe(before + 1);
  });

  test('a file under 4 MB is accepted', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();
    const longDesc = 'x'.repeat(3 * 1024 * 1024);

    const { preview, done } = await importFile(app, a.request, s.varCatalog.id, csvFile([`Gros,1,,${longDesc}`]));

    expect(preview.step).toBe(2);
    expect(done.importedCount).toBe(1);
    expect(await productCount()).toBe(before + 1);
  });

  test('a file over 4 MB is refused and nothing is imported', { tag: ['@CAT-PCS-001'] }, async ({ app, as, errors }) => {
    errors.expect(/./); // "multipart_maximum_size_reached" is raised as an error page
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const before = await productCount();
    const tooBig = 'x'.repeat(4 * 1024 * 1024 + 1024);

    const preview = await app.actions.products.csvImport.upload(a.request, s.varCatalog.id, csvFile([`Énorme,1,,${tooBig}`]));
    const done = await app.actions.products.csvImport.confirm(a.request, s.varCatalog.id);

    expect(preview.step).not.toBe(2);
    expect(done.importedCount).toBeNull();
    expect(await productCount()).toBe(before);
  });
});

test.describe('who may import products', () => {
  test('the group admin, who coordinates every catalog, imports', { tag: ['@CAT-PCS-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'groupAdmin');
    const before = await productCount();

    const { done } = await importFile(app, a.request, s.constCatalog.id, csvFile(['Un,1']));

    expect(done.importedCount).toBe(1);
    expect(await productCount()).toBe(before + 1);
  });

  test('a member and the coordinator of another catalog cannot open the import, send a file or confirm', { tag: ['@CAT-PCS-001'] }, async ({ app, as, errors }) => {
    errors.expect(/./); // hx raises "Forbidden access" as an error page
    const s = await make.amapScenario();
    const other = await make.catalog({ group: s.group, vendor: s.vendor, name: 'Pain', type: 'VariableOrders' });
    const baker = await make.user({ firstName: 'Boris', lastName: 'Boulanger', email: 'baker@camap.test' });
    await make.userGroup({ user: baker, group: s.group, rights: [Right.ContractAdmin(other.id)] });
    const before = await productCount();
    const member = await actor(app, as, s, 'member');
    const bakerAs = await as(baker);
    await app.actions.group.select(bakerAs.request, s.group.id);

    for (const who of [member, bakerAs]) {
      const open = await app.actions.products.csvImport.open(who.request, s.varCatalog.id);
      const upload = await app.actions.products.csvImport.upload(who.request, s.varCatalog.id, csvFile(['Piraté,1']));
      const confirm = await app.actions.products.csvImport.confirm(who.request, s.varCatalog.id);
      for (const page of [open, upload, confirm]) expect(page.step).toBeNull();
    }

    expect(await productCount()).toBe(before);
  });

  test('a visitor is sent to log in', { tag: ['@CAT-PCS-001'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();
    const before = await productCount();

    const open = await app.actions.products.csvImport.open(anon.request, s.varCatalog.id);
    const upload = await app.actions.products.csvImport.upload(anon.request, s.varCatalog.id, csvFile(['Piraté,1']));

    expect(open.status).toBe(302);
    expect(upload.status).toBe(302);
    expect(await productCount()).toBe(before);
  });
});

test.describe('exporting products', () => {
  // The export is not a coordinator-only page in hx (UND-039 suggests restricting it to those who manage the catalog).
  test('the export lists the catalog products with name, price, reference, description, VAT, quantity, unit, organic, bulk, variable price', { tag: ['@CAT-PCS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = await make.product({ catalog: s.varCatalog, name: 'Miel de fleurs', price: 8.5, vat: 20 });
    await make.setProduct(p.id, { ref: 'MIEL-1', desc: 'Récolte 2026', qt: 0.5, unitType: UNIT.kilogram, organic: 1, bulk: 1, variablePrice: 1 });

    const res = await app.exports.catalogProducts(a.request, s.varCatalog.id);

    expect(res.status).toBe(200);
    expect(res.contentType).toContain('csv');
    expect(res.header).toEqual(EXPORT_HEADER);
    expect(res.rows.find((r) => r.Nom === 'Miel de fleurs')).toEqual({
      Nom: 'Miel de fleurs',
      'prix TTC': '8.5',
      Référence: 'MIEL-1',
      Description: 'Récolte 2026',
      TVA: '20',
      Quantité: '0.5',
      unit: 'Kilogram',
      'Agriculture biologique': 'true',
      bulk: 'true',
      'Prix variable selon pesée': 'true',
    });
  });

  test('a product without reference or description gets empty cells, and the flags read false', { tag: ['@CAT-PCS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = await make.product({ catalog: s.varCatalog, name: 'Lait' });
    await make.setProduct(p.id, { unitType: UNIT.litre });

    const res = await app.exports.catalogProducts(a.request, s.varCatalog.id);

    expect(res.rows.find((r) => r.Nom === 'Lait')).toMatchObject({ Référence: '', Description: '', unit: 'Litre', 'Agriculture biologique': 'false', bulk: 'false', 'Prix variable selon pesée': 'false' });
  });

  test('the active status and the image are not exported', { tag: ['@CAT-PCS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.exports.catalogProducts(a.request, s.varCatalog.id);

    expect(res.header).toEqual(EXPORT_HEADER);
    expect(res.header.join('|')).not.toMatch(/active|actif|image/i);
  });

  test('only the products of that catalog are exported', { tag: ['@CAT-PCS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.exports.catalogProducts(a.request, s.varCatalog.id);

    expect(res.rows.map((r) => r.Nom).sort()).toEqual(s.products.var.map((p) => p.name).sort());
    expect(res.rows.map((r) => r.Nom)).not.toContain(s.products.const[0].name);
  });

  // Finding: Catalog.getProducts(false) is "all products", so inactive ones are exported, although the
  // file does not say which they are.
  test('hx today: inactive products are exported too', { tag: ['@CAT-PCS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    await make.product({ catalog: s.varCatalog, name: 'Produit retiré', active: false });

    const res = await app.exports.catalogProducts(a.request, s.varCatalog.id);

    expect(res.rows.map((r) => r.Nom)).toContain('Produit retiré');
  });

  // UND-039 (undecided): the export checks no right. Characterised as it is today: any logged-in
  // member, even one who does not coordinate the catalog, downloads it; a visitor is sent to log in.
  test('hx today: a plain member downloads the export, a visitor is sent to log in', { tag: ['@CAT-PCS-002'] }, async ({ app, as, anon }) => {
    const s = await make.amapScenario();
    const member = await actor(app, as, s, 'member');

    const res = await app.exports.catalogProducts(member.request, s.varCatalog.id);
    const visitor = await app.exports.catalogProducts(anon.request, s.varCatalog.id);

    expect(res.status).toBe(200);
    expect(res.rows).toHaveLength(s.products.var.length);
    expect(visitor.status).toBe(302);
  });

  test('what the export gives can be imported back', { tag: ['@CAT-PCS-001', '@CAT-PCS-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = await make.product({ catalog: s.varCatalog, name: 'Fromage', price: 9 });
    await make.setProduct(p.id, { qt: 0.25, unitType: UNIT.kilogram, organic: 1 });
    const exported = await app.exports.catalogProducts(a.request, s.varCatalog.id);
    expect(exported.status).toBe(200);
    const before = await productsOf(s.constCatalog.id);

    // the export writes true/false and unit names (Kilogram, Piece...): the import reads both back
    const { done } = await importFile(app, a.request, s.constCatalog.id, { name: 'export.csv', content: Buffer.from(exported.raw.replace(/^﻿/, ''), 'utf8') });

    expect(done.importedCount).toBe(s.products.var.length + 1);
    const after = (await productsOf(s.constCatalog.id)).slice(before.length);
    const fromage = after.find((x) => x.name === 'Fromage')!;
    expect(fromage).toMatchObject({ price: 9, qt: 0.25, unitType: UNIT.kilogram, organic: 1 });
  });
});
