/**
 * VAT in the coordinator's totals and in the member invoice (specs/06-payments/reports-exports.md
 * PAY-RPT-009, PAY-RPT-013; controller/ContractAdmin.hx doVendorsByTimeFrame, controller/Member.hx doInvoice,
 * service/ReportService.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

async function actor(app: any, as: any, s: any, who: 'coordinator' | 'membershipManager' | 'groupAdmin' | 'member') {
  const u = await as(s.users[who]);
  await app.actions.group.select(u.request, s.group.id);
  return u;
}

test.describe('totals per vendor when a product is ordered in several sessions (PAY-RPT-009, UND-094)', () => {
  // The live page (vendorsByTimeFrame) adds quantity, total with VAT and total without VAT when it merges
  // the lines of one product from several distributions. The helper that has the bug described by UND-094
  // (ReportService.getMultiDistribVendorOrdersByProduct: adds quantity and totalTTC only) is only called
  // from a commented-out page. Characterised: the merged totals are right.
  test('the merged line adds the quantity and both totals', { tag: ['@PAY-RPT-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.product({ catalog: s.varCatalog, name: 'Au vingt', price: 12, vat: 20 });
    for (const [i, qt] of [[0, 1], [1, 2], [2, 4]] as const) {
      const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[i] });
      await make.userOrder({ user: s.users.member, product: p, distribution: s.distributions[i].var, basket, quantity: qt });
    }
    const c = await actor(app, as, s, 'groupAdmin');

    const res = await app.exports.vendorTotals(c.request, make.parisDate(s.multiDistribs[0].distribStartDate), make.parisDate(s.multiDistribs[3].distribStartDate));

    expect(res.status).toBe(200);
    const row = res.rows.find((r) => r['Produit']?.startsWith('Au vingt'))!;
    expect(row).toMatchObject({ Quantité: '7', priceHT: '10', priceTTC: '12', totalHT: '70', totalTTC: '84' });
    // the vendor block closes with one total line
    const total = res.rows.find((r) => r['totalHT'] === '70' && !r['Produit']);
    expect(total).toMatchObject({ totalHT: '70', totalTTC: '84' });
  });

  test('the total without VAT of a product ordered in 3 sessions is the sum of the per-session amounts', { tag: ['@PAY-RPT-009'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = await make.product({ catalog: s.varCatalog, name: 'Au cinq', price: 10, vat: 5.5 });
    for (const i of [0, 1, 2]) {
      const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[i] });
      await make.userOrder({ user: s.users.member, product: p, distribution: s.distributions[i].var, basket, quantity: 1 });
    }
    const c = await actor(app, as, s, 'groupAdmin');

    const res = await app.exports.vendorTotals(c.request, make.parisDate(s.multiDistribs[0].distribStartDate), make.parisDate(s.multiDistribs[3].distribStartDate));

    const row = res.rows.find((r) => r['Produit']?.startsWith('Au cinq'))!;
    // 3 x 9.48 (10 / 1.055 = 9.4787, rounded to cents by ProductService.getHTPrice for each session)
    expect(row).toMatchObject({ Quantité: '3', priceHT: '9,48', totalTTC: '30' });
    expect(row['totalHT']).toBe('28,44');
  });
});

test.describe('the member invoice for a distribution session (PAY-RPT-013)', () => {
  async function ordersOfTwoVendors() {
    const s = await make.amapScenario();
    const v2 = await make.vendor({ name: 'Boulangerie du Test' });
    const cat2 = await make.catalog({ group: s.group, vendor: v2, name: 'Pains', type: 'VariableOrders', contact: s.users.coordinator });
    const d2 = await make.distribution({ catalog: cat2, multiDistrib: s.multiDistribs[0] });
    const pain = await make.product({ catalog: cat2, name: 'Pain complet', price: 4, vat: 5.5 });
    const oeufs = await make.product({ catalog: s.varCatalog, name: 'Oeufs bio', price: 12, vat: 20 });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member, product: oeufs, distribution: s.distributions[0].var, basket, quantity: 2 });
    await make.userOrder({ user: s.users.member, product: pain, distribution: d2, basket, quantity: 3 });
    return { s, basket };
  }

  test('lists the orders grouped by vendor, with a total per vendor, and the VAT table', { tag: ['@PAY-RPT-013'] }, async ({ app, as }) => {
    const { s } = await ordersOfTwoVendors();
    const mm = await actor(app, as, s, 'membershipManager');

    const page = await app.views.invoices.ofMember(mm.request, s.users.member.id, s.multiDistribs[0].id);

    expect(page.status).toBe(200);
    expect(page.text).toContain('MEMBRE Martine');
    // one block per vendor (vendor name in capitals), each with its lines and its total
    const ferme = page.text.indexOf('FERME DU TEST');
    const boulangerie = page.text.indexOf('BOULANGERIE DU TEST');
    expect(ferme).toBeGreaterThan(-1);
    expect(boulangerie).toBeGreaterThan(-1);
    const blocks = [{ name: 'ferme', at: ferme }, { name: 'boulangerie', at: boulangerie }].sort((a, b) => a.at - b.at);
    const slice = (name: string) => {
      const i = blocks.findIndex((b) => b.name === name);
      return page.text.slice(blocks[i].at, blocks[i + 1]?.at);
    };
    const fermeBlock = slice('ferme');
    const boulBlock = slice('boulangerie');
    expect(fermeBlock).toContain('Oeufs bio');
    expect(fermeBlock).not.toContain('Pain complet');
    expect(fermeBlock).toMatch(/TOTAL : 24/);
    expect(boulBlock).toContain('Pain complet');
    expect(boulBlock).not.toContain('Oeufs bio');
    expect(boulBlock).toMatch(/TOTAL : 12/);
    // VAT table: rate, without VAT, VAT, with VAT
    expect(page.text).toMatch(/\b20 % 20 4 24\b/);
    expect(page.text).toMatch(/\b5\.5 % 11,37 0,63 12\b/);
  });

  test('prints the payments of the basket', { tag: ['@PAY-RPT-013'] }, async ({ app, as }) => {
    const { s, basket } = await ordersOfTwoVendors();
    const debt = await make.operation({ user: s.users.member, group: s.group, type: 'VOrder', amount: -36, basket });
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 36, relation: debt, data: { type: 'check' } });
    const mm = await actor(app, as, s, 'membershipManager');

    const page = await app.views.invoices.ofMember(mm.request, s.users.member.id, s.multiDistribs[0].id);

    expect(page.text).toMatch(/Paiement\s+Chèque/);
    expect(page.text).toMatch(/36\s*(€|&euro;)/);
  });

  test('is for membership managers only', { tag: ['@PAY-RPT-013'] }, async ({ app, as }) => {
    const { s } = await ordersOfTwoVendors();
    const m = await actor(app, as, s, 'member');

    const page = await app.views.invoices.ofMember(m.request, s.users.member.id, s.multiDistribs[0].id);

    expect(page.text).not.toContain('Reçu');
    expect(page.text).not.toContain('FERME DU TEST');
  });
});
