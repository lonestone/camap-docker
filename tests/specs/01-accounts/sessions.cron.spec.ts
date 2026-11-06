/**
 * Clean-up of old sessions by the daily job (specs/01-accounts/sessions-tokens.md ACC-SES-002;
 * camap-hx controller/Cron.hx doDaily, task "Old datas cleaning", sugoi Session.clean).
 * The rows are only deleted, so they can be written directly: their `sdata` is never read.
 */
import { test, expect } from '../../src/fixtures.js';
import { insert, query } from '../../src/db/client.js';
import { toSqlDateTime, addDaysWall } from '../../src/encodings/dates.js';
import * as make from '../../src/factories/index.js';

async function session(sid: string, ageDays: number, uid: number | null, now: Date) {
  const t = toSqlDateTime(addDaysWall(now, -ageDays));
  await insert('Session', { sid, uid, lastTime: t, createTime: t, sdata: '', lang: 'fr', messages: '', ip: '127.0.0.1' });
}
// the job call itself opens a session of its own: look at the rows written here only
const sids = async () => (await query<{ sid: string }>("SELECT sid FROM Session WHERE sid REGEXP '^[a-e]{32}$' ORDER BY sid")).map((r) => r.sid);

test.describe('old sessions', () => {
  test('the daily job deletes logged-in sessions older than 30 days and anonymous ones older than 3 days', { tag: ['@ACC-SES-002'] }, async ({ cron, clock }) => {
    const u = await make.user();
    const now = clock.now();
    await session('a'.repeat(32), 31, u.id, now); // logged in, too old
    await session('b'.repeat(32), 29, u.id, now); // logged in, still valid
    await session('c'.repeat(32), 4, null, now); // anonymous, too old
    await session('d'.repeat(32), 2, null, now); // anonymous, recent
    await session('e'.repeat(32), 31, null, now); // anonymous, much too old

    const run = await cron.run('daily');

    expect(run.status).toBe(200);
    expect(await sids()).toEqual(['b'.repeat(32), 'd'.repeat(32)]);
  });
});
