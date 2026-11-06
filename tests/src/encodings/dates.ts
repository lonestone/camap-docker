/**
 * DATETIME columns hold Europe/Paris wall-clock strings: hx reads
 * `Date.now()` in the container's TZ and writes it without zone. The test
 * runner may run in any TZ (UTC on CI), so conversions are explicit.
 */
import { env } from '../env.js';

const TZ = env.appTimeZone;

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export type WallClock = { y: number; mo: number; d: number; h: number; mi: number; s: number };

/** Paris wall-clock parts of an instant. */
export function wallClock(instant: Date): WallClock {
  const p = Object.fromEntries(fmt.formatToParts(instant).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** Instant -> 'YYYY-MM-DD HH:MM:SS' (Paris), the format of DATETIME columns. */
export function toSqlDateTime(instant: Date): string {
  const w = wallClock(instant);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)} ${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}`;
}

/** Instant -> 'YYYY-MM-DD' (Paris), for DATE columns. */
export function toSqlDate(instant: Date): string {
  return toSqlDateTime(instant).slice(0, 10);
}

/** Paris wall-clock -> instant (handles DST; ambiguous times resolve to the first occurrence). */
export function fromWallClock(w: Partial<WallClock> & Pick<WallClock, 'y' | 'mo' | 'd'>): Date {
  const { y, mo, d, h = 0, mi = 0, s = 0 } = w;
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  let t = asUtc;
  for (let i = 0; i < 3; i++) {
    const seen = wallClock(new Date(t));
    const seenUtc = Date.UTC(seen.y, seen.mo - 1, seen.d, seen.h, seen.mi, seen.s);
    const diff = asUtc - seenUtc;
    if (diff === 0) break;
    t += diff;
  }
  return new Date(t);
}

/** 'YYYY-MM-DD HH:MM:SS' (Paris) -> instant. */
export function fromSqlDateTime(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (!m) throw new Error(`Not a SQL datetime: ${s}`);
  return fromWallClock({ y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) });
}

const MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Exact duration shift (not calendar-aware across DST, use `addDaysWall` for that). */
export function addMs(instant: Date, ms: number): Date {
  return new Date(instant.getTime() + ms);
}
export const addMinutes = (i: Date, n: number) => addMs(i, n * MS.m);
export const addHours = (i: Date, n: number) => addMs(i, n * MS.h);

/** Same Paris wall-clock time, `n` calendar days later (what MySQL DATE_ADD(.., INTERVAL n DAY) does on wall-clock strings). */
export function addDaysWall(instant: Date, n: number): Date {
  const w = wallClock(instant);
  const shifted = new Date(Date.UTC(w.y, w.mo - 1, w.d + n));
  return fromWallClock({ ...w, y: shifted.getUTCFullYear(), mo: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() });
}

/** Same Paris day as `instant`, at h:mi:s. */
export function atWallTime(instant: Date, h: number, mi = 0, s = 0): Date {
  const w = wallClock(instant);
  return fromWallClock({ y: w.y, mo: w.mo, d: w.d, h, mi, s });
}

/** Parse a relative spec: '+2d', '-3h', '+90m', '+30s' (sum of terms allowed: '+1d+2h'). Returns ms. */
export function parseRelative(spec: string): number {
  const re = /([+-])(\d+)([smhd])/g;
  let total = 0;
  let consumed = 0;
  for (const m of spec.matchAll(re)) {
    total += (m[1] === '-' ? -1 : 1) * Number(m[2]) * MS[m[3] as keyof typeof MS];
    consumed += m[0].length;
  }
  if (consumed === 0 || consumed !== spec.replace(/\s/g, '').length) {
    throw new Error(`Bad relative time "${spec}" (expected e.g. "+2d", "-3h", "+1d+30m")`);
  }
  return total;
}
