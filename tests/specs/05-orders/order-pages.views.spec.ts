/**
 * Server-rendered pages around orders and subscriptions (specs/05-orders/admin-orders.md, baskets.md,
 * order-history.md, subscription-create.md; controller/Contract.hx, ContractAdmin.hx, Shop.hx, Subscriptions.hx).
 * The JavaScript widgets these pages start (batch ordering, ordering screen) are not driven here: the tests
 * check what the pages hand to them.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import * as make from '../../src/factories/index.js';
import { subscribeVar } from '../../src/flows.js';

test.describe('pages that no longer exist after the migration', () => {
  test('the legacy page to edit my variable orders is removed (UND-085)', { tag: ['@ORD-ADO-010'] }, async ({ app, as }) => {
    deviation('UND-085');
    const s = await make.amapScenario();
    const member = await as(s.users.member);
    const sub = await subscribeVar(app, member.request, s, s.users.member.id);
    await app.api.subscription.updateOrders(member.request, sub.id, [{ id: s.distributions[1].var.id, orders: [{ productId: s.products.var[0].id, qty: 1 }] }]);

    const page = await app.views.orders.legacyVarOrdersPage(member.request, s.multiDistribs[1].id);

    expect(page.status).toBe(404);
  });

  test('the temporary-baskets page of the coordinator is removed (UND-077)', { tag: ['@ORD-BSK-003'] }, async ({ app, as }) => {
    deviation('UND-077');
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);

    const page = await app.views.orders.temporaryBaskets(coordinator.request, s.multiDistribs[0].id);

    expect(page.status).toBe(404);
  });

  test('hx today: the page fails as soon as a temporary basket exists, nothing creates one any more (CODE-077)', { tag: ['@ORD-BSK-003'] }, async ({ app, as, errors }) => {
    errors.expect(/Invalid field access/);
    const s = await make.amapScenario();
    await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0], status: 'OPEN' });
    const coordinator = await as(s.users.coordinator);
    await app.actions.group.select(coordinator.request, s.group.id);

    const page = await app.views.orders.temporaryBaskets(coordinator.request, s.multiDistribs[0].id);

    expect(page.status).toBe(200);
    expect(page.text).not.toContain('Martine'); // the template stops at the first basket
  });
});

test.describe('the batch ordering page', () => {
  test('a coordinator opens it for a catalog; a member is sent away', { tag: ['@ORD-ADO-011', '@ORD-ADO-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const coordinator = await as(s.users.coordinator);
    const member = await as(s.users.member);
    await app.actions.group.select(coordinator.request, s.group.id);
    await app.actions.group.select(member.request, s.group.id);

    const page = await app.views.orders.batchOrder(coordinator.request, s.varCatalog.id);
    const refused = await app.views.orders.batchOrder(member.request, s.varCatalog.id);

    expect(page.status).toBe(200);
    expect([page.catalogId, page.groupId]).toEqual([s.varCatalog.id, s.group.id]);
    expect(refused.status).toBe(302);
  });
});

test.describe('the product information popup', () => {
  test('a member opens the information of a product: price, unit and vendor', { tag: ['@ORD-HIS-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await make.setProduct(s.products.var[0].id, { qt: 6, unitType: 0 });
    const member = await as(s.users.member);

    const page = await app.views.shop.productInfo(member.request, s.products.var[0].id, s.distributions[0].var.id);

    expect(page.status).toBe(200);
    expect(page.text).toContain('2,40');
    expect(page.text).toContain('Ferme du Test');
  });
});

test.describe('the subscription page of a catalog', () => {
  test('a member opens it and the ordering screen gets the member and the catalog', { tag: ['@ORD-SUB-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const page = await app.views.subscriptions.subscriptionPage(member.request, s.constCatalog.id);

    expect(page.status).toBe(200);
    expect(page.text).toContain(s.constCatalog.name);
    expect([page.catalogId, page.userId, page.subscriptionId]).toEqual([s.constCatalog.id, s.users.member.id, null]);
  });

  test('a visitor is sent to the login page', { tag: ['@ORD-SUB-001'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const page = await app.views.subscriptions.subscriptionPage(anon.request, s.constCatalog.id);

    expect(page.status).toBe(302);
  });

  test('the screen is given the subscription that ends after the next open distribution, not an ended one', { tag: ['@ORD-SUB-013'] }, async ({ app, as, clock }) => {
    const s = await make.amapScenario();
    const [m0, m1, m2, m3] = s.multiDistribs;
    await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: m0.distribStartDate, endDate: m1.distribEndDate });
    const member = await as(s.users.member);
    clock.set('+15d'); // the first two distributions are over, the next open one is the third
    const page = () => app.views.subscriptions.subscriptionPage(member.request, s.constCatalog.id);

    expect((await page()).subscriptionId).toBeNull(); // the only subscription ended with the second distribution

    const coming = await make.subscription({ user: s.users.member, catalog: s.constCatalog, startDate: m2.distribStartDate, endDate: m3.distribEndDate });
    expect((await page()).subscriptionId).toBe(coming.id);
  });
});
