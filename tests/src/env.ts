/**
 * Harness configuration. Every value can be overridden by an environment
 * variable so the suite can point at another stack (CI, a TS deployment...).
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export type TargetName = 'hx' | 'ts';

const target = (process.env.TARGET ?? 'hx') as TargetName;
if (target !== 'hx' && target !== 'ts') {
  throw new Error(`TARGET must be "hx" or "ts", got "${process.env.TARGET}"`);
}

export const TESTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(TESTS_ROOT, '..');

export const env = {
  target,
  /** Origin of the app under test. On hx, Apache also proxies /graphql, /neostatic/, /locales/ to Nest. */
  baseUrl: process.env.CAMAP_BASE_URL ?? 'http://localhost:8180',
  /** Origin of the camap-ts API (Nest) for its REST routes that the app origin does not proxy (/mails/*, /files/*). Production serves it on its own hostname. */
  apiUrl: process.env.CAMAP_API_URL ?? 'http://localhost:3180',
  /** Shared MySQL, used for arrange (factories) and assert (DB state). */
  db: {
    host: process.env.CAMAP_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.CAMAP_DB_PORT ?? 3307),
    user: process.env.CAMAP_DB_USER ?? 'root',
    password: process.env.CAMAP_DB_PASSWORD ?? 'root',
    database: process.env.CAMAP_DB_NAME ?? 'camap_test',
  },
  /** hx `key` (config.test.xml) == Nest CAMAP_KEY: md5 password salt, cron key. */
  camapKey: process.env.CAMAP_KEY ?? 'camap-test-key-0123456789',
  /** Directory mounted as /faketime in neko-test (libfaketime offset file). */
  faketimeDir: process.env.CAMAP_FAKETIME_DIR ?? path.join(TESTS_ROOT, '.faketime'),
  /** Time zone of the apps (TZ=Europe/Paris in the images, as in production). */
  appTimeZone: 'Europe/Paris',
  mailpitUrl: process.env.CAMAP_MAILPIT_URL ?? 'http://localhost:8026',
  specsDir: process.env.CAMAP_SPECS_DIR ?? path.join(REPO_ROOT, 'task/refacto-hx-ts/specs'),
} as const;
