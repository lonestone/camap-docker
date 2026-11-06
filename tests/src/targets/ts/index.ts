/**
 * camap-ts target driver: nothing is ported yet.
 *
 * Every member of CamapApp that the driver does not implement resolves to a
 * NotPorted stub: the first time a test touches it, the test is skipped with a
 * `not-ported` annotation (fixtures.ts installs the hook). To port a domain,
 * add the real implementation to `ported` below (same shape as
 * targets/hx/index.ts); the tests that use it start running on TARGET=ts.
 */
import type { CamapApp } from '../types.js';

export class NotPorted extends Error {
  constructor(public readonly member: string) {
    super(`not-ported: ${member}`);
  }
}

/** Called when a test reaches an unported member. Replaced by fixtures.ts with test.skip(). */
export type OnNotPorted = (member: string) => never;

const ported: Partial<CamapApp> = {
  // e.g. urls: tsUrls, pages: { login: tsLoginPage, ... }
};

/**
 * Implemented members are returned as is. A missing member becomes a callable
 * proxy: reading through it is allowed (`app.pages.login`), calling it
 * (`app.pages.login(page)`) reports the full member path as not ported.
 */
function stub(member: string, onNotPorted: OnNotPorted, impl: unknown): any {
  if (impl !== undefined && (typeof impl !== 'object' || impl === null)) return impl;
  return new Proxy(function notPorted() {}, {
    get(_t, key) {
      if (typeof key === 'symbol' || key === 'then') return undefined;
      return stub(`${member}.${String(key)}`, onNotPorted, (impl as any)?.[key]);
    },
    apply() {
      return onNotPorted(member);
    },
  });
}

export function createTsApp(onNotPorted: OnNotPorted): CamapApp {
  return stub('ts', onNotPorted, { ...ported, name: 'ts' });
}
