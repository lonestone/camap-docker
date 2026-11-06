/**
 * Playwright fixtures shared by every spec. Import `test` and `expect` from here.
 *
 * Auto fixtures (run for every test, in this order):
 *   _reset  truncate + seed the shared DB
 *   clock   back to real time before and after the test
 *   errors  fail the test if it produced new rows in `Error` (unless errors.expect())
 *
 * On demand:
 *   app     CamapApp of the current TARGET (hx, or ts with NotPorted -> skip)
 *   as(u)   { request, page } logged in as user `u` (real login through the app)
 *   anon    { request, page } for a visitor
 *   cron    run('minute' | 'hour' | 'daily')
 *   mails   BufferedJsonMail queue reader
 */
import { test as base, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { env } from './env.js';
import { closeDb } from './db/client.js';
import { resetDb } from './db/reset.js';
import { clock } from './clock.js';
import { createCron, type Cron } from './cron.js';
import { mails, type Mails } from './mails.js';
import { createErrors, type Errors } from './errors.js';
import type { CamapApp, Credentials } from './targets/types.js';
import { createHxApp } from './targets/hx/index.js';
import { createTsApp, NotPorted } from './targets/ts/index.js';

export type Session = { request: APIRequestContext; page: Page };
export type Actor = Credentials | 'anon';

type TestFixtures = {
  _reset: void;
  clock: typeof clock;
  errors: Errors;
  app: CamapApp;
  as: (actor: Actor) => Promise<Session>;
  anon: Session;
  cron: Cron;
  mails: Mails;
};

type WorkerFixtures = {
  _dbPool: void;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  _dbPool: [
    async ({}, use) => {
      await use();
      await closeDb();
    },
    { scope: 'worker', auto: true },
  ],

  _reset: [
    async ({}, use) => {
      await resetDb();
      await use();
    },
    { auto: true },
  ],

  clock: [
    async ({ _reset }, use) => {
      clock.reset();
      await use(clock);
      clock.reset();
    },
    { auto: true },
  ],

  errors: [
    async ({ _reset }, use, testInfo) => {
      const errors = createErrors();
      await errors.snapshot();
      await use(errors);
      const bad = await errors.unexpected();
      if (bad.length > 0) {
        const summary = bad.map((e) => `#${e.id} ${e.url ?? ''}\n${e.error.split('\n').slice(0, 6).join('\n')}`).join('\n---\n');
        await testInfo.attach('app-errors.txt', { body: summary, contentType: 'text/plain' });
        throw new Error(`The app logged ${bad.length} new row(s) in Error (call errors.expect() if intended):\n${summary}`);
      }
    },
    { auto: true },
  ],

  app: async ({}, use, testInfo) => {
    if (env.target === 'hx') return use(createHxApp());
    await use(
      createTsApp((member) => {
        testInfo.annotations.push({ type: 'not-ported', description: member });
        testInfo.skip(true, `not-ported: ${member}`);
        throw new NotPorted(member); // unreachable: skip() throws
      }),
    );
  },

  as: async ({ app, playwright, browser }, use) => {
    const sessions = new Map<string, Session>();
    const contexts: BrowserContext[] = [];
    const requests: APIRequestContext[] = [];

    await use(async (actor) => {
      const key = actor === 'anon' ? 'anon' : actor.email;
      const cached = sessions.get(key);
      if (cached) return cached;

      const request = await playwright.request.newContext({ baseURL: env.baseUrl });
      requests.push(request);
      if (actor !== 'anon') await app.auth.login(request, actor);

      const context = await browser.newContext({ baseURL: env.baseUrl, storageState: await request.storageState() });
      contexts.push(context);
      const session = { request, page: await context.newPage() };
      sessions.set(key, session);
      return session;
    });

    for (const c of contexts) await c.close();
    for (const r of requests) await r.dispose();
  },

  anon: async ({ as }, use) => {
    await use(await as('anon'));
  },

  cron: async ({ app, playwright }, use) => {
    const request = await playwright.request.newContext({ baseURL: env.baseUrl });
    await use(createCron(request, (job) => app.urls.cron(job)));
    await request.dispose();
  },

  mails: async ({}, use) => {
    await use(mails);
  },
});

export { expect };
