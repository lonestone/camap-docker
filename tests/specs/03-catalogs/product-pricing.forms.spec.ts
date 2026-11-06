/**
 * Prices, VAT and fees (specs/03-catalogs/product-pricing.md; camap-hx db/Product.hx,
 * service/ProductService.hx, db/Group.hx getVatRates, db/Catalog.hx hasPercentageOnOrders).
 * Prices are entered with VAT. The price without VAT shows up in the vendor order totals (CSV), the
 * member invoice and the product JSON ("vatValue"). The price/VAT widget of the form is a browser
 * widget (CAT-PPR-003, not tested here).
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne, update } from '../../src/db/client.js';
import { CatalogFlag, flags } from '../../src/encodings/flags.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';

type Scenario = Awaited<ReturnType<typeof make.amapScenario>>;

async function actor(app: CamapApp, as: any, s: Scenario, who: keyof Scenario['users'] = 'coordinator') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

const newestProduct = async () => (await queryOne<{ id: number; price: number; vat: number }>('SELECT id, price, vat FROM Product ORDER BY id DESC LIMIT 1'))!;
const storedRates = async (groupId: number) => JSON.parse((await queryOne<{ vatRates: string }>('SELECT vatRates FROM `Group` WHERE id = ?', [groupId]))!.vatRates);

const DEFAULT_RATES = [
  { label: 'TVA alimentaire', value: 5.5 },
  { label: 'TVA standard', value: 20 },
];

test.describe('prices include VAT', () => {
  test('the coordinator enters a price with VAT: it is stored and shown as such', { tag: ['@CAT-PPR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Miel', price: 12.5, vat: 20 });

    const p = await newestProduct();
    expect(p).toMatchObject({ price: 12.5, vat: 20 });
    const shown = await app.api.products.get(a.request, p.id);
    expect(shown.body).toMatchObject({ price: 12.5, vat: 20 });
  });

  for (const [typed, stored] of [
    [4.126, 4.13],
    [4.124, 4.12],
    [19.999, 20],
    [0.004, 0],
  ] as const) {
    test(`a price of ${typed} is stored with two decimals: ${stored}`, { tag: ['@CAT-PPR-001'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const a = await actor(app, as, s);

      await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Arrondi', price: typed });

      expect((await newestProduct()).price).toBe(stored);
    });
  }

  test('editing a product that was never ordered rounds its price too', { tag: ['@CAT-PPR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = s.products.var[0];

    await app.actions.products.edit(a.request, p.id, { price: 7.777 });

    expect((await queryOne<{ price: number }>('SELECT price FROM Product WHERE id = ?', [p.id]))!.price).toBe(7.78);
  });
});

test.describe('price without VAT', () => {
  // ProductInfo.vatValue = price - price / (1 + vat/100), null when the rate is 0
  for (const [price, vat, ht] of [
    [12, 20, 10],
    [10, 5.5, 10 / 1.055],
    [4.5, 5.5, 4.5 / 1.055],
  ] as const) {
    test(`a price of ${price} with ${vat}% VAT has a VAT amount of price minus price / (1 + ${vat}%)`, { tag: ['@CAT-PPR-002'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const member = await as(s.users.member);
      const p = await make.product({ catalog: s.varCatalog, name: 'Produit', price, vat });

      const one = await app.api.products.get(member.request, p.id);
      const list = await app.api.products.ofCatalog(member.request, s.varCatalog.id);

      expect(one.body.vatValue as number).toBeCloseTo(price - ht, 6);
      expect(list.body.products.find((x) => x.id === p.id)!.vatValue as number).toBeCloseTo(price - ht, 6);
    });
  }

  test('a product without VAT has no VAT amount', { tag: ['@CAT-PPR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const p = await make.product({ catalog: s.varCatalog, name: 'Exonéré', price: 5, vat: 0 });

    const one = await app.api.products.get(member.request, p.id);

    expect(one.body.vatValue).toBeNull();
  });

  test('the vendor order totals give the price and total without VAT next to those with VAT', { tag: ['@CAT-PPR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p20 = await make.product({ catalog: s.varCatalog, name: 'Au vingt', price: 12, vat: 20 });
    const p55 = await make.product({ catalog: s.varCatalog, name: 'Au cinq', price: 10, vat: 5.5 });
    const p0 = await make.product({ catalog: s.varCatalog, name: 'Au zéro', price: 7, vat: 0 });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    const d = s.distributions[0].var;
    await make.userOrder({ user: s.users.member, product: p20, distribution: d, basket, quantity: 3 });
    await make.userOrder({ user: s.users.member, product: p55, distribution: d, basket, quantity: 2 });
    await make.userOrder({ user: s.users.member, product: p0, distribution: d, basket, quantity: 1 });
    const from = make.parisDate(s.multiDistribs[0].distribStartDate);
    const to = make.parisDate(s.multiDistribs[1].distribStartDate);

    const res = await app.exports.vendorTotals(a.request, from, to);

    expect(res.status).toBe(200);
    const row = (name: string) => res.rows.find((r) => r['Produit'].startsWith(name))!;
    expect(row('Au vingt')).toMatchObject({ Quantité: '3', priceHT: '10', priceTTC: '12', totalHT: '30', totalTTC: '36' });
    expect(row('Au cinq')).toMatchObject({ Quantité: '2', priceHT: '9,48', priceTTC: '10', totalHT: '18,96', totalTTC: '20' });
    expect(row('Au zéro')).toMatchObject({ Quantité: '1', priceHT: '7', priceTTC: '7', totalHT: '7', totalTTC: '7' });
  });

  test('the member invoice splits the orders by VAT rate: without VAT, VAT, with VAT', { tag: ['@CAT-PPR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s, 'membershipManager'); // the invoice page is for those who manage members
    const p20 = await make.product({ catalog: s.varCatalog, name: 'Au vingt', price: 12, vat: 20 });
    const p55 = await make.product({ catalog: s.varCatalog, name: 'Au cinq', price: 10, vat: 5.5 });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    const d = s.distributions[0].var;
    await make.userOrder({ user: s.users.member, product: p20, distribution: d, basket, quantity: 3 });
    await make.userOrder({ user: s.users.member, product: p55, distribution: d, basket, quantity: 2 });

    const page = await app.views.invoices.ofMember(a.request, s.users.member.id, s.multiDistribs[0].id);

    expect(page.status).toBe(200);
    // rate, without VAT, VAT, with VAT
    expect(page.text).toMatch(/\b20 % 30 6 36\b/);
    expect(page.text).toMatch(/\b5\.5 % 18,96 1,04 20\b/);
  });
});

test.describe('VAT rates of the group', () => {
  test('the product form offers the rates of the group with their labels', { tag: ['@CAT-PPR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const form = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });

    expect(form.vatRates).toEqual(DEFAULT_RATES);
  });

  test('a group with its own list of rates offers those, and a product can use one', { tag: ['@CAT-PPR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await update('Group', { id: s.group.id }, { vatRates: JSON.stringify([{ label: 'Taux réduit', value: 10 }, { label: 'Exonéré', value: 0 }, { label: 'Taux plein', value: 19.6 }]) });
    const a = await actor(app, as, s);

    const form = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });
    await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Au dix', price: 3, vat: 10 });

    expect(form.vatRates).toEqual([{ label: 'Taux réduit', value: 10 }, { label: 'Exonéré', value: 0 }, { label: 'Taux plein', value: 19.6 }]);
    expect((await newestProduct()).vat).toBe(10);
  });

  test('the rates of another group are not offered', { tag: ['@CAT-PPR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    await update('Group', { id: other.id }, { vatRates: JSON.stringify([{ label: 'Ailleurs', value: 2.1 }]) });
    const a = await actor(app, as, s);

    const form = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });

    expect(form.vatChoices).toEqual([5.5, 20]);
  });

  for (const [label, stored] of [
    ['is not JSON', 'pas du json'],
    ['is empty', ''],
    ['is missing', null],
  ] as const) {
    test(`a rate list that ${label} is replaced by the two default rates, when the form is opened`, { tag: ['@CAT-PPR-004'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      await update('Group', { id: s.group.id }, { vatRates: stored });
      const a = await actor(app, as, s);

      const form = await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });

      expect(form.vatRates).toEqual(DEFAULT_RATES);
      expect(await storedRates(s.group.id)).toEqual(DEFAULT_RATES);
    });
  }

  test('a valid rate list is left alone', { tag: ['@CAT-PPR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const custom = [{ label: 'Seul taux', value: 8 }];
    await update('Group', { id: s.group.id }, { vatRates: JSON.stringify(custom) });
    const a = await actor(app, as, s);

    await app.actions.products.form(a.request, { catalogId: s.varCatalog.id });

    expect(await storedRates(s.group.id)).toEqual(custom);
  });

  test('the edit form of a product also offers the group rates, with the product rate selected', { tag: ['@CAT-PPR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);
    const p = await make.product({ catalog: s.varCatalog, name: 'Au vingt', price: 12, vat: 20 });

    const form = await app.actions.products.form(a.request, { productId: p.id });

    expect(form.vatRates).toEqual(DEFAULT_RATES);
    expect(form.values.vat).toBe(20);
  });

  // Finding: the VAT select is not validated server side, so a rate outside the group list is stored as posted.
  test('hx today: a rate that is not in the group list is accepted and stored', { tag: ['@CAT-PPR-004'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await actor(app, as, s);

    const res = await app.actions.products.create(a.request, s.varCatalog.id, { name: 'Taux libre', price: 3, vat: 7 });

    expect(res.flash).toMatchObject({ kind: 'ok' });
    expect((await newestProduct()).vat).toBe(7);
  });
});

test.describe('percentage fees', () => {
  // UND-037 (undecided): hx disabled the percentage fees (no form field, Catalog.hasPercentageOnOrders() is
  // always false), so the displayed price is the price entered. TS still adds the fee.
  test('hx today: a catalog flagged with a percentage fee still shows the price entered', { tag: ['@CAT-PPR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { flags: flags(CatalogFlag, 'UsersCanOrder', 'PercentageOnOrders'), percentageValue: 10, percentageName: 'Frais de gestion' });
    const member = await as(s.users.member);
    const p = await make.product({ catalog: s.varCatalog, name: 'Avec frais', price: 20, vat: 5.5 });

    const one = await app.api.products.get(member.request, p.id);
    const list = await app.api.products.ofCatalog(member.request, s.varCatalog.id);

    expect(one.body.price).toBe(20);
    expect(list.body.products.find((x) => x.id === p.id)!.price).toBe(20);
  });

  test('a catalog without a percentage fee shows the price entered', { tag: ['@CAT-PPR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const p = await make.product({ catalog: s.varCatalog, name: 'Sans frais', price: 20, vat: 5.5 });

    const one = await app.api.products.get(member.request, p.id);

    expect(one.body.price).toBe(20);
  });
});
