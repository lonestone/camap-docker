/**
 * Bring the shared DB back to the seed state: truncate every table (except
 * TypeORM's `migrations`) and replay db/seed.sql. Runs before every test.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TESTS_ROOT, env } from '../env.js';
import { db, query } from './client.js';

const KEEP = new Set(['migrations']);
let tables: string[] | undefined;
let seedSql: string | undefined;

async function listTables(): Promise<string[]> {
  tables ??= (
    await query<{ name: string }>(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [env.db.database],
    )
  )
    .map((r) => r.name)
    .filter((t) => !KEEP.has(t));
  return tables;
}

export function seed(): string {
  seedSql ??= readFileSync(path.join(TESTS_ROOT, 'db/seed.sql'), 'utf8');
  return seedSql;
}

export async function resetDb(): Promise<void> {
  const conn = await db().getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of await listTables()) await conn.query(`TRUNCATE TABLE \`${t}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.query(seed());
  } finally {
    conn.release();
  }
}
