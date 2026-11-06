/**
 * What an API client receives when a request fails (specs/08-administration/error-log.md;
 * controller/Main.hx doApi). Errors raised under /api/* are never persisted (logged, then rolled back):
 * only the HTTP status and body can be asserted.
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import { query } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

test.describe('a failing API request', () => {
  test('a service error returns its code and message', { tag: ['@ADM-ERR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.api.places.write(member.request, s.place.id);

    expect(res.status).toBe(405);
    expect(res.body).toMatchObject({ error: { code: 405, message: 'Method Not Allowed' } });
  });

  test('an unexpected error returns code 500 and a message', { tag: ['@ADM-ERR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.api.platform.unexpectedFailure(member.request);

    expect(res.status).toBe(500);
    expect(res.body.error?.code).toBe(500);
    expect(typeof res.body.error?.message).toBe('string');
    expect(res.body.error?.message).not.toBe('');
  });

  test('a failing request is rolled back', { tag: ['@ADM-ERR-005'] }, async ({ app, as }) => {
    // the subscription is inserted, then the minimum-order check fails: nothing must remain
    const s = await make.amapScenario();
    await make.setCatalog(s.varCatalog.id, { distribMinOrdersTotal: 5 });
    const [e6] = s.products.var;
    const member = await as(s.users.member);

    const res = await app.api.subscription.create(member.request, {
      userId: s.users.member.id,
      catalogId: s.varCatalog.id,
      defaultOrder: [{ productId: e6.id, productPrice: e6.price, quantity: 1 }],
      absentDistribIds: [],
      initialOrders: [],
    });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: { code: 500 } });
    expect(await query('SELECT id FROM Subscription')).toEqual([]);
  });

  test('the response never contains a stack trace (unexpected error)', { tag: ['@ADM-ERR-006'] }, async ({ app, as }) => {
    // UND-116 (decided): keep stack traces server-side. hx prints them in the body.
    deviation('UND-116');
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.api.platform.unexpectedFailure(member.request);

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/Called from|\.hx line|\n\s+at /);
    expect(res.body.error).not.toHaveProperty('stack');
  });

  test('the response never contains a stack trace (service error)', { tag: ['@ADM-ERR-006'] }, async ({ app, as }) => {
    // UND-116: hx also adds the stack of tink errors to the body
    deviation('UND-116');
    const s = await make.amapScenario();
    const member = await as(s.users.member);

    const res = await app.api.places.write(member.request, s.place.id);

    expect(res.status).toBe(405);
    expect(res.body).not.toHaveProperty('error.stack');
    expect(JSON.stringify(res.body)).not.toMatch(/Called from|\.hx line/);
  });
});
