/**
 * Trigger the scheduled jobs the way the platform does: a plain GET on the
 * hx cron endpoints (camap-hx/src/controller/Cron.hx). The shared key
 * md5(KEY + "crons") is always sent, so the helper keeps working once the key
 * check is enabled again (COM-JOB-002, UND-097).
 *
 * Jobs read the (fake) clock: set it with `clock.set()` first.
 */
import type { APIRequestContext } from '@playwright/test';
import { cronKey } from './encodings/passwords.js';

export type CronJob = 'minute' | 'hour' | 'daily';

export type CronRun = { status: number; body: string };

export function createCron(request: APIRequestContext, cronPath: (job: CronJob) => string) {
  return {
    async run(job: CronJob, opts: { withKey?: boolean; params?: Record<string, string> } = {}): Promise<CronRun> {
      const withKey = opts.withKey ?? true;
      const res = await request.get(cronPath(job), {
        params: { ...(withKey ? { key: cronKey() } : {}), ...opts.params },
        timeout: 120_000,
        maxRedirects: 0,
      });
      return { status: res.status(), body: await res.text() };
    },
  };
}
export type Cron = ReturnType<typeof createCron>;
