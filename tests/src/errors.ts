/**
 * Uncaught application errors. sugoi logs them in the `Error` table
 * (BaseApp.logError; also tink errors swallowed by cron tasks). The `errors`
 * auto fixture fails any test that produced new rows, unless the test says
 * it expects them with `errors.expect()`.
 *
 * Blind spot: errors raised under /api/* never persist. controller/Main.hx
 * doApi calls logError() and then app.rollback(), which removes the row. API
 * tests must assert the HTTP status (500) themselves.
 */
import { query } from './db/client.js';

export type AppError = { id: number; date: string; error: string; url: string | null; uid: number | null };

export function createErrors() {
  let mark = 0;
  let expected: RegExp | true | undefined;

  return {
    async snapshot(): Promise<void> {
      const [r] = await query<{ m: number | null }>('SELECT MAX(id) AS m FROM `Error`');
      mark = r?.m ?? 0;
      expected = undefined;
    },

    async newRows(): Promise<AppError[]> {
      return query<AppError>('SELECT id, date, error, url, uid FROM `Error` WHERE id > ? ORDER BY id', [mark]);
    },

    /**
     * Allow new Error rows in this test (optionally only those matching `pattern`,
     * tested against the message and the url).
     */
    expect(pattern?: RegExp): void {
      expected = pattern ?? true;
    },

    /** Rows that make the test fail. */
    async unexpected(): Promise<AppError[]> {
      const rows = await this.newRows();
      if (expected === true) return [];
      const re = expected;
      return re ? rows.filter((r) => !re.test(r.error) && !re.test(r.url ?? '')) : rows;
    },
  };
}
export type Errors = ReturnType<typeof createErrors>;
