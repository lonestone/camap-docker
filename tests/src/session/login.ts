/**
 * Real logins, through the apps. Never forge sessions in SQL: hx
 * `Session.sdata` is neko-serialised.
 *
 * hx login is two steps (ACC-LOG-001 erratum, CODE-105):
 *   1. any hx request creates a sugoi Session row and sets the `sid` cookie
 *      (sugoi BaseApp.mainLoop / db/Session.init);
 *   2. the Nest GraphQL `login(input:{email,password,sid})` mutation sets
 *      Session.uid and returns the Auth_sid / Authentication / Refresh cookies
 *      (camap-ts/packages/api-core/src/auth/auth.service.ts login).
 * Everything goes through the hx origin (Apache proxies /graphql to Nest), so
 * a single cookie jar holds all four cookies.
 */
import type { APIRequestContext, BrowserContextOptions } from '@playwright/test';
import type { Credentials } from '../targets/types.js';

export type StorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

const LOGIN_MUTATION = `mutation login($input: LoginInput!) {
  login(input: $input) { id email }
}`;

export class LoginError extends Error {}

export async function hxLogin(
  request: APIRequestContext,
  user: Credentials,
  urls: { login(): string; graphql: string },
): Promise<void> {
  const page = await request.get(urls.login());
  if (!page.ok()) throw new LoginError(`GET ${urls.login()} -> ${page.status()}`);

  const sid = (await request.storageState()).cookies.find((c) => c.name === 'sid')?.value;
  if (!sid) throw new LoginError('hx did not set the sid cookie');

  const res = await request.post(urls.graphql, {
    data: { operationName: 'login', query: LOGIN_MUTATION, variables: { input: { email: user.email, password: user.password, sid } } },
  });
  const json = (await res.json().catch(() => ({}))) as { data?: unknown; errors?: { message: string }[] };
  if (!res.ok() || json.errors?.length) {
    throw new LoginError(`GraphQL login(${user.email}) failed: ${res.status()} ${JSON.stringify(json.errors ?? json)}`);
  }

  const names = new Set((await request.storageState()).cookies.map((c) => c.name));
  for (const c of ['sid', 'Auth_sid', 'Authentication', 'Refresh']) {
    if (!names.has(c)) throw new LoginError(`cookie ${c} missing after login of ${user.email}`);
  }
}
