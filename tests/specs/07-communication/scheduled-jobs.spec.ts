/**
 * Job endpoints (specs/07-communication/scheduled-jobs.md; camap-hx/src/controller/Cron.hx).
 */
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';

test.describe('scheduled job endpoints', () => {
  test('a job call carrying the shared key runs', { tag: ['@COM-JOB-002'] }, async ({ cron }) => {
    const res = await cron.run('minute');

    expect(res.status).toBe(200);
    expect(res.body).toMatch(/now is \d{4}-\d\d-\d\d/);
  });

  test('a job call without the shared key is refused', { tag: ['@COM-JOB-002'] }, async ({ cron }) => {
    deviation('UND-097');

    const res = await cron.run('minute', { withKey: false });

    expect([401, 403]).toContain(res.status);
  });
});
