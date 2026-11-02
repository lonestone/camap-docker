# Scheduled jobs (COM-JOB)

Actors: the system.

- **COM-JOB-001** As the system, I run minute, hourly and daily jobs on a fixed schedule. <!-- 03-features/crons-scheduled-jobs.md S2 Trigger, S3; camap-ts/packages/api-core/src/tools/crontab.service.ts:15-55 -->
  - The platform calls the job runner every minute, every hour and every day at midnight.
  - The calls happen only when jobs are enabled in the configuration.
  - **ERRATUM** The job endpoints have no authentication: anyone who can reach the Haxe app can trigger them. Source: `camap-hx/src/controller/Cron.hx:36-38` (CODE-015). Decided fix: see COM-JOB-002 (UND-097).

- **COM-JOB-002** As the system, I run jobs only when called by the platform itself. <!-- 03-features/crons-scheduled-jobs.md S3, S7; camap-hx/src/controller/Cron.hx:36-52 -->
  - A job endpoint runs only when the call carries the shared key (md5 of KEY + "crons"); TS sends it.
  - Calls without the key are refused.
  - **ERRATUM** Today anyone who knows the address can call the job endpoints; the key check is commented out. Source: `camap-hx/src/controller/Cron.hx:36-52` (CODE-015).
  - **DECISION (UND-097, 2026-11-02)** Re-enable the shared-key check on the job endpoints and read HX_TRIGGER_CRONS as a boolean.

- **COM-JOB-003** As a platform operator, I can disable the jobs by configuration. <!-- 03-features/crons-scheduled-jobs.md S2 HX_TRIGGER_CRONS; camap-ts/packages/api-core/src/tools/crontab.service.ts:17,31,45 -->
  - Jobs are triggered only when HX_TRIGGER_CRONS is "true"; any other value disables them.
  - **ERRATUM** Today any non-empty value, including "false", enables them. Source: `camap-ts/packages/api-core/src/tools/crontab.service.ts:17,31,45` (CODE-151).
  - **DECISION (UND-097, 2026-11-02)** Re-enable the shared-key check on the job endpoints and read HX_TRIGGER_CRONS as a boolean.

- **COM-JOB-004** As the system, I send the vendor and contact recaps, reminders, default orders, volunteer emails and digests every hour. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:92-340 -->
  - Each is described in its feature.

- **COM-JOB-005** As the system, I delete unused stored files every hour, in slices. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:289-320 -->
  - See CAT-DOC-010.

- **COM-JOB-006** As the system, I email yesterday's errors to the webmaster every day. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:353-377 -->
  - The subject is the platform name followed by "Errors".
  - Nothing is sent when there was no error.

- **COM-JOB-007** As the system, I delete old sessions every day. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:378-383 -->
  - See ACC-SES-002.

- **COM-JOB-008** As the system, I delete the documents of catalogs that ended 18 months ago. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:385-402 -->

- **COM-JOB-009** As the system, I delete expired cache entries every night at 01:00. <!-- 03-features/crons-scheduled-jobs.md S4.2; camap-ts/packages/api-core/src/tools/cache.service.ts:55-59 -->
  - **ERRATUM** The delete is not awaited, so it may not complete within the job. Source: `camap-ts/packages/api-core/src/tools/cache.service.ts:58` (CODE-059).

- **COM-JOB-010** As the system, I wait for deletions to complete in purge jobs. <!-- 03-features/crons-scheduled-jobs.md S4.2; camap-ts/packages/api-core/src/messages/messages.service.ts:83; camap-ts/packages/api-core/src/tools/cache.service.ts:58 -->
  - The message purge, the cache cleaning and the account purge await each deletion.
  - The transaction commits only after the deletions, and their errors are logged.
  - **ERRATUM** Today these jobs start deletions without waiting for them. Source: `camap-ts/packages/api-core/src/messages/messages.service.ts:83`, `camap-ts/packages/api-core/src/tools/cache.service.ts:58` (CODE-059, CODE-067).
  - **DECISION (UND-102, 2026-11-02)** Await every deletion in purge jobs.

- **COM-JOB-011** *Undecided (UND-103)*: As the system, the daily job runs at a documented time that does not collide with the message purge. <!-- 03-features/crons-scheduled-jobs.md S3, S4.2; camap-ts/packages/api-core/src/tools/crontab.service.ts:11,43; camap-ts/packages/api-core/src/messages/messages.service.ts:79 -->
  - The comment says 00:15, the code says midnight, and the message purge also runs at midnight.
  - **SUGGESTION** Run the daily job at 00:15 as documented, and move the message purge off midnight (for example 00:30). Based on: `camap-ts/packages/api-core/src/tools/crontab.service.ts:5-7,43` (comment says 15 0 * * *, code runs at midnight), `camap-ts/packages/api-core/src/messages/messages.service.ts:79` (purge also at midnight), `camap-ts/packages/api-core/src/tools/cache.service.ts:55` and `users/users.service.ts:442` (two jobs both at 01:00). Confidence: medium.

- **COM-JOB-012** *Undecided (UND-105)*: As the system, one daily job runs once even with several application replicas. <!-- 03-features/crons-scheduled-jobs.md S4.2; camap-ts/packages/api-core/src/tools/crontab.service.ts:15-55 -->
  - Currently each replica calls the job endpoints, with no lock.
  - **SUGGESTION** Fix all three: use WHERE in the recap query (same shape as `Cron.hx:232-236`), use the faked clock `now` in the errors email, and take a lock per daily job so only one replica runs it (for example a row in the cache table, or run jobs from one replica only). Based on: `camap-hx/src/controller/Cron.hx:716-724` (join on AND), `camap-hx/src/controller/Cron.hx:353-357` (errors email uses Date.now), `camap-ts/packages/api-core/src/tools/crontab.service.ts:15-55` (every replica fires jobs, no lock). Confidence: medium. Note: with an INNER JOIN the AND form returns the same rows, so that fix is cosmetic.

- **COM-JOB-013** As the system, the daily errors mail uses the real current time. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:353-377 -->
