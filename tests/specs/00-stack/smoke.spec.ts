/**
 * Harness smoke tests: the stack is up and the harness primitives work.
 * Not tied to a spec statement.
 */
import { test, expect } from '../../src/fixtures.js';
import { env } from '../../src/env.js';
import { query, queryOne } from '../../src/db/client.js';
import { resetDb } from '../../src/db/reset.js';
import { fromSqlDateTime } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';

test.describe('stack', () => {
  test('DB reset leaves exactly the seed rows', async () => {
    await make.amapScenario();
    expect((await query('SELECT id FROM `User`')).length).toBeGreaterThan(2);

    await resetDb();

    const users = await query<{ email: string }>('SELECT email FROM `User` ORDER BY id');
    expect(users.map((u) => u.email)).toEqual(['admin@camap.tld', 'deleted@camap.tld']);
    expect(await query('SELECT name FROM Variable ORDER BY name')).toEqual([
      { name: 'platformtermsofservice' },
      { name: 'tosVersion' },
    ]);
    expect(await query('SELECT id FROM `Error`')).toEqual([]);
    for (const t of ['Group', 'Catalog', 'MultiDistrib', 'Session', 'BufferedJsonMail']) {
      expect(await queryOne(`SELECT COUNT(*) AS n FROM \`${t}\``), t).toEqual({ n: 0 });
    }
  });

  test('the schema baseline is loaded (migrations recorded)', async () => {
    const rows = await query<{ name: string }>('SELECT name FROM migrations ORDER BY timestamp');
    expect(rows.length).toBeGreaterThan(0);
  });
});

test.describe('hx stack', () => {
  test.skip(env.target !== 'hx', 'hx container specifics');

  test('Apache serves env.js and proxies Nest (/neostatic, /graphql, /locales)', async ({ anon }) => {
    const envJs = await anon.request.get('/env.js');
    expect(envJs.status()).toBe(200);
    expect(await envJs.text()).toContain('__APP_CONFIG__');

    const manifest = await anon.request.get('/neostatic/manifest.json');
    expect(manifest.status()).toBe(200);
    expect(Object.keys(await manifest.json()).length).toBeGreaterThan(0);

    const gql = await anon.request.post('/graphql', { data: { query: '{ __typename }' } });
    expect(gql.status()).toBe(200);
    expect(await gql.json()).toEqual({ data: { __typename: 'Query' } });

    const locales = await anon.request.get('/locales/fr/translation.json');
    expect(locales.status()).toBe(200);
  });

  test('a first visit creates a sugoi session and sets the sid cookie', async ({ anon }) => {
    const res = await anon.request.get('/user/login');
    expect(res.status()).toBe(200);
    const sid = (await anon.request.storageState()).cookies.find((c) => c.name === 'sid')?.value;
    expect(sid).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(await queryOne('SELECT uid FROM `Session` WHERE sid = ?', [sid])).toEqual({ uid: null });
  });

  test('the fake clock drives Neko Date.now()', async ({ anon, clock }) => {
    const nekoNow = async () => {
      const text = await (await anon.request.get('/cron')).text();
      const m = /now is (\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/.exec(text);
      expect(m, text.slice(0, 200)).not.toBeNull();
      return fromSqlDateTime(m![1]);
    };
    const skew = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime());

    expect(skew(await nekoNow(), new Date())).toBeLessThan(60_000);

    const target = clock.set('+3d+5h');
    expect(skew(await nekoNow(), target)).toBeLessThan(60_000);

    clock.set('2027-03-28 01:59:30'); // DST change night in Paris
    expect(skew(await nekoNow(), fromSqlDateTime('2027-03-28 01:59:30'))).toBeLessThan(60_000);

    clock.reset();
    expect(skew(await nekoNow(), new Date())).toBeLessThan(60_000);
  });

  test('the errors fixture sees rows logged by the app', async ({ cron, errors }) => {
    // /cron/minute?json=1 logs its job list in Error on purpose ("debug in
    // error log db", controller/Cron.hx doMinute).
    const res = await cron.run('minute', { params: { json: '1' } });
    expect(res.status).toBe(200);
    const rows = await errors.newRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('/cron/minute');
    errors.expect(/"jobs"/);
  });

  test('API errors are rolled back, so they never reach the Error table', async ({ anon, errors }) => {
    // Characterisation of the errors fixture's blind spot: controller/Main.hx
    // doApi calls logError() then app.rollback(). Anonymous call on an API that
    // dereferences app.user (controller/api/Catalog.hx doSubscriptionAbsences).
    const s = await make.amapScenario();
    const sub = await make.subscription({
      user: s.users.member,
      catalog: s.constCatalog,
      startDate: s.multiDistribs[0].distribStartDate,
      endDate: s.multiDistribs[3].distribEndDate,
    });
    const res = await anon.request.get(`/api/catalog/subscriptionAbsences/${sub.id}`);
    expect(res.status()).toBe(500);
    expect(await errors.newRows()).toEqual([]);
  });
});
