/**
 * Fake clock for the hx app (libfaketime in neko-test, see
 * tests/stack/neko-test.Dockerfile).
 *
 * The offset file holds "+<seconds>" relative to the real time, re-read on
 * every time() call (FAKETIME_NO_CACHE=1). An offset is used rather than
 * libfaketime's "@date" start-at format, because "@" counts from the faked
 * process start, and Apache workers live for a long time.
 *
 * Only Neko sees the fake time. Nest and MySQL keep the real clock, which is
 * safe because JWT expiry is checked by Nest only and hx writes its own
 * timestamps (SQL NOW() only appears in an admin stats query).
 *
 * Factories use `clock.now()` so fixture dates line up with the app's "now".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';
import { fromSqlDateTime, parseRelative } from './encodings/dates.js';

const FILE = path.join(env.faketimeDir, 'faketime.rc');

let offsetMs = 0;

function write(ms: number): void {
  mkdirSync(env.faketimeDir, { recursive: true });
  const secs = Math.round(ms / 1000);
  writeFileSync(FILE, `${secs >= 0 ? '+' : ''}${secs}\n`);
  offsetMs = secs * 1000;
}

export const clock = {
  /** The app's "now" (real time + offset). */
  now(): Date {
    return new Date(Date.now() + offsetMs);
  },

  /** Current offset from the real time, in ms. */
  offsetMs(): number {
    return offsetMs;
  },

  isFaked(): boolean {
    return offsetMs !== 0;
  },

  /**
   * Move the app clock. Accepts an instant, a Paris wall-clock string
   * ('2026-11-10 14:30:00') or a relative spec from the *current fake* now
   * ('+2d', '-3h', '+1d+30m'). The clock keeps ticking from there.
   */
  set(to: Date | string): Date {
    let target: Date;
    if (to instanceof Date) target = to;
    else if (/^[+-]/.test(to.trim())) target = new Date(clock.now().getTime() + parseRelative(to));
    else target = fromSqlDateTime(to);
    write(target.getTime() - Date.now());
    return clock.now();
  },

  /** Back to real time. */
  reset(): void {
    write(0);
  },
};
