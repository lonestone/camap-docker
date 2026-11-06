/**
 * User passwords. camap-ts checks bcrypt `pass2` first, then md5(KEY + pw)
 * in `pass` (camap-ts/packages/api-core/src/auth/auth.service.ts
 * isValidPassword). Factories write both, like a TS registration.
 */
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../env.js';

export const DEFAULT_PASSWORD = 'test1234';

export function md5Password(plain: string, key: string = env.camapKey): string {
  return createHash('md5').update(`${key}${plain}`).digest('hex');
}

const bcryptCache = new Map<string, string>();

/** Low cost factor: only speed matters here, bcrypt.compare reads the cost from the hash. */
export function bcryptPassword(plain: string): string {
  let h = bcryptCache.get(plain);
  if (!h) {
    h = bcrypt.hashSync(plain, 4);
    bcryptCache.set(plain, h);
  }
  return h;
}

export function bcryptMatches(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

/** Shared key sent to the cron endpoints: md5(KEY + "crons") (camap-hx/src/controller/Cron.hx canRun). */
export function cronKey(key: string = env.camapKey): string {
  return createHash('md5').update(`${key}crons`).digest('hex');
}

/** sha1(KEY + value) hex, as Nest's CryptoService.sha1 (quit-group link hash). */
export const sha1 = (v: string, key: string = env.camapKey): string => createHash('sha1').update(`${key}${v}`).digest('hex');
