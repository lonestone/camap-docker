import { clock } from '../clock.js';
import { toSqlDateTime } from '../encodings/dates.js';

let seq = 0;
/** Unique number for names and emails (unique within a run; the DB is reset between tests anyway). */
export const nextSeq = () => ++seq;

/** Current app time as a DATETIME string. */
export const nowSql = () => toSqlDateTime(clock.now());

/** Accept a Date (converted to Paris wall-clock) or an already formatted DATETIME string. */
export function sqlDateTime(v: Date | string): string;
export function sqlDateTime(v: Date | string | null | undefined): string | null | undefined;
export function sqlDateTime(v: Date | string | null | undefined): string | null | undefined {
  if (v == null) return v;
  return v instanceof Date ? toSqlDateTime(v) : v;
}

export const bool = (b: boolean) => (b ? 1 : 0);

/** 'YYYY-MM-DD' of an instant, in Paris time. */
export const parisDate = (d: Date): string => toSqlDateTime(d).slice(0, 10);
