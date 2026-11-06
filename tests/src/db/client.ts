/**
 * mysql2 pool on the shared test DB. Tests use it to arrange (factories) and
 * to assert DB state; the apps under test never see this connection.
 */
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { env } from '../env.js';

let pool: Pool | undefined;

export function db(): Pool {
  pool ??= mysql.createPool({
    ...env.db,
    connectionLimit: 4,
    multipleStatements: true,
    // DATETIME columns hold Paris wall-clock strings (hx writes local time):
    // keep them as strings, never let the driver shift them.
    dateStrings: true,
    timezone: 'local',
    charset: 'utf8mb4',
    namedPlaceholders: false,
  });
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type Row = Record<string, any>;

export async function query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await db().query<RowDataPacket[]>(sql, params);
  return rows as T[];
}

export async function queryOne<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [res] = await db().query<ResultSetHeader>(sql, params);
  return res;
}

/** INSERT a row (`undefined` values are skipped so DB defaults apply) and return its insert id. */
export async function insert(table: string, row: Row): Promise<number> {
  const entries = Object.entries(row).filter(([, v]) => v !== undefined);
  const cols = entries.map(([k]) => `\`${k}\``).join(', ');
  const marks = entries.map(() => '?').join(', ');
  const res = await execute(`INSERT INTO \`${table}\` (${cols}) VALUES (${marks})`, entries.map(([, v]) => v));
  return res.insertId;
}

export async function update(table: string, where: Row, set: Row): Promise<void> {
  const s = Object.keys(set).map((k) => `\`${k}\` = ?`).join(', ');
  const w = Object.keys(where).map((k) => `\`${k}\` = ?`).join(' AND ');
  await execute(`UPDATE \`${table}\` SET ${s} WHERE ${w}`, [...Object.values(set), ...Object.values(where)]);
}
