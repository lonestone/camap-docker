# Crons and scheduled jobs

## 1. Scope

All scheduled work today: HX job logic (`camap-hx/src/controller/Cron.hx`: minute/hour/daily) and its trigger by the TS app, TS native `@Cron` jobs, HX CLI scripts, and TS CLI scripts. Mail pipeline detail is in `messaging-mails.md`; domain behaviour of individual jobs is cross-referenced to the feature files.

Ownership summary: cron schedule and trigger = TS (`CrontabService`); cron job logic = HX; TS also has its own native crons (mail buffer flush, cache clean, user purge, message purge).

## 2. Concepts & glossary terms

- **Trigger**: TS `CrontabService` HTTP-GETs `${CAMAP_LOCAL_HOST}/cron/{minute,hour,daily}` on HX when env `HX_TRIGGER_CRONS` is set (`camap-ts/packages/api-core/src/tools/crontab.service.ts:15-60`). The registration is `ToolsModule` (`camap-ts/packages/api-core/src/tools/tools.module.ts:9,51`) and `ScheduleModule.forRoot()` (`camap-ts/packages/api-core/src/app.module.ts:53`).
- **`HX_TRIGGER_CRONS`**: not validated by `envSchema`; truthiness test `if (!process.env.HX_TRIGGER_CRONS) return;` (`camap-ts/packages/api-core/src/tools/crontab.service.ts:17,31,45`), so any non-empty string (including `"false"`, `"0"`) enables it; `.env.sample:60` sets `true`.
- **`CAMAP_LOCAL_HOST`**: base URL used by the trigger (`camap-ts/packages/api-core/src/tools/crontab.service.ts:60`; sample `http://neko-loc-camap:80`, `.env.sample:55`).
- **TransactionWrappedTask**: HX task wrapper with `task.log` / `task.warning`; executed with `task.execute(!App.config.DEBUG)` (argument semantic unverified), except File clean and vendor orders list which pass `false` (`camap-hx/src/controller/Cron.hx:320,334`).
- **Cron events**: `MinutelyCron`, `HourlyCron`, `DailyCron` (`camap-hx/common/Common.hx:296-298`); no listener found in `camap-hx/src` (plugins unverified).
- **`?now=`**: fakes the clock (`camap-hx/src/controller/Cron.hx:24`); `?json=1` prints jobs JSON and logs it to the error table (`:81`).
- No cron daemon exists in the containers: `camap-hx.Dockerfile`, `camap-ts.Dockerfile`, `entrypoint.sh` contain none; Apache starts in the foreground (`camap-hx.Dockerfile:67`). The TS Nest cron timezone = process TZ (Europe/Paris in image, `camap-ts.Dockerfile:54`).

## 3. Routes & endpoints

| side | route / schedule | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `GET /cron/minute` | `camap-hx/src/controller/Cron.hx:20-29,58-86` | none: `canRun()` always `true` (`:36-38`), auth code commented out (`:40-52`); no Apache/Traefik restriction found | none | fires `MinutelyCron` event only |
| HX | `GET /cron/hour` | `camap-hx/src/controller/Cron.hx:92-340` | same | none | hourly jobs (section 4.1); manual `neko index.n cron/hour > cron.log` (`:90`) |
| HX | `GET /cron/daily` | `camap-hx/src/controller/Cron.hx:340-402` | same | none | daily jobs |
| TS | every minute | `camap-ts/packages/api-core/src/tools/crontab.service.ts:15-27` | env gate | | GET `/cron/minute` |
| TS | every hour (minute 0) | `camap-ts/packages/api-core/src/tools/crontab.service.ts:29-41` | env gate | | GET `/cron/hour` |
| TS | daily 00:00 (`EVERY_DAY_AT_MIDNIGHT`) | `camap-ts/packages/api-core/src/tools/crontab.service.ts:43-55` | env gate | | GET `/cron/daily`; comment at `:11` says `15 0 * * *` |
| TS | every minute | `camap-ts/packages/api-core/src/mails/mails.service.ts:184-342` (`sendEmailsFromBuffer`) | internal | | flush mail queue (see `messaging-mails.md`) |
| TS | daily 00:00 | `camap-ts/packages/api-core/src/messages/messages.service.ts:78-84` (`cleanOldMessages`) | internal | | deletes `Message` rows older than 4 months (not awaited, `:83`) |
| TS | daily 01:00 | `camap-ts/packages/api-core/src/tools/cache.service.ts:55-59` (`cleanCache`) | internal | | deletes expired Cache rows (not awaited, `:58`) |
| TS | daily 01:00 | `camap-ts/packages/api-core/src/users/users.service.ts:439-600` (`cleanUsers`) | internal | | inactive user warnings and purge (see `users-auth.md` rule 27) |
| HX | CLI `neko index.n scripts/<action>` | `camap-hx/src/controller/Scripts.hx` | constructor throws "CLI only" under mod_neko (`:14-16`); dispatcher `camap-hx/src/controller/Main.hx:341-358` | none | maintenance scripts (section 5) |

TS `@Cron` count: 7 usages in `api-core/src` (3 in `crontab.service.ts` + the 4 TS-native ones). `camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:2` imports `Cron` but uses none.

## 4. Business rules

### 4.1 HX jobs (`camap-hx/src/controller/Cron.hx`)

| trigger | job (TransactionWrappedTask name) | what it does / side effects | ref |
|---|---|---|---|
| minute | `MinutelyCron` event | only fires `app.event(MinutelyCron(now, jobs, mode))` | `camap-hx/src/controller/Cron.hx:58-86` |
| hour | Volunteers instruction mail | multidistribs starting in [now-hour + `g.volunteersMailDaysBeforeDutyPeriod` days, +1h); skips disabled groups and groups without flag `AllowInformationNotifs`; one mail to all volunteers (email + email2), body = `group.volunteersMailContent` with tokens `[DATE_DISTRIBUTION]` `[LIEU_DISTRIBUTION]` `[LISTE_BENEVOLES]`, template `mail/message.mtt` | `camap-hx/src/controller/Cron.hx:97-154` |
| hour | Volunteers alerts | same window using `vacantVolunteerRolesMailDaysBeforeDutyPeriod`; only multidistribs with vacant roles; needs `AllowAlertNotifs`; mail to ALL group members, body `group.alertMailContent` tokens `[DATE_DISTRIBUTION]` `[LIEU_DISTRIBUTION]` `[ROLES_MISSING]`; subject and date string hard-coded French (`:197,200`) | `camap-hx/src/controller/Cron.hx:156-210` |
| hour | Distrib notifications | `distribNotif` 4h (flag `HasEmailNotif4h`) and 24h (`HasEmailNotif24h`) before distribution: per user+group mail listing orders (skips zero-quantity totals, also notifies `user2` of alternated orders), template `mail/orderNotif.mtt`, user's language, Reply-To group contact; de-dup via Cache key `<date>+<flag>` 24h (skipped in DEBUG); uses `Distribution.date` (`:458-468`) | `camap-hx/src/controller/Cron.hx:213-218,458-622` |
| hour | Opening orders notifications | distributions whose `orderStartDate` is in the current hour, excluding constant-orders catalogs; mail to every group member with `HasEmailNotifOuverture`; `mail/orderNotif.mtt` | `camap-hx/src/controller/Cron.hx:221-225,624-714` |
| hour | Default automated orders for CSA variable contracts | distributions whose `orderEndDate` fell in last hour and `Catalog.distribMinOrdersTotal > 0` (`:231-237`): for each subscription active that day, not absent, with no order: creates orders from default orders, queues a `NotificationMail` (digest HOURLY, subject `DEFAULT_ORDER(catalogId)`), then recomputes the subscription total operation | `camap-hx/src/controller/Cron.hx:227-278` |
| hour | Email digest | `sendEmailDigest` for digests HOURLY(1) and COORDINATOR_HOURLY(11) | `camap-hx/src/controller/Cron.hx:281-286` |
| hour | Clean unused db.File | random 1000-id slice of `File`; deletes files not referenced by `Product.image`, `EntityFile`, `Group.image`, `Vendor.image`; `execute(false)`; comments at `:303-309` swapped | `camap-hx/src/controller/Cron.hx:289-320` |
| hour | `HourlyCron` event | fired after default automated orders; no listener found | `camap-hx/src/controller/Cron.hx:322-325` |
| hour | Send orders list to vendor on order closing | distributions whose `orderEndDate` fell in last hour: (a) if `catalog.shouldNotifyVendorOnOrderEnd()` and vendor email set, mail `mail/ordersByProduct.mtt` incl. new subscriptions since last distrib; (b) per catalog contact, if `shouldNotifyContactOnOrderEnd()`, one mail `mail/ordersForGroupContact.mtt`; SQL joins with `AND` not `WHERE` (`:716-724`) | `camap-hx/src/controller/Cron.hx:330-334,716-816` |
| daily | `DailyCron` event | fired first; no listener found | `camap-hx/src/controller/Cron.hx:344` |
| daily | Email digest | digests DAILY(2) and COORDINATOR_DAILY(12) (task also named "Email digest" like the hourly one) | `camap-hx/src/controller/Cron.hx:346-351` |
| daily | Send errors to admin | yesterday's `sugoi.db.Error` rows (`$date < yest24h && $date > yest0h`, `Date.now()` not the faked `this.now`) mailed to `webmaster_email` with subject "<theme name> Errors", template `mail/message.mtt`; no mail when none | `camap-hx/src/controller/Cron.hx:353-377` |
| daily | Old datas cleaning | `sugoi.db.Session.clean()` (logged sessions older than 30 days, anonymous older than 3 days) | `camap-hx/src/controller/Cron.hx:378-383` |
| daily | Delete old documents | catalogs ended 18 months (30-day months) ago in a 24h window: deletes their `EntityFile` type `document` and `File` | `camap-hx/src/controller/Cron.hx:385-402` |

Notes: the hourly window uses `now.setHourMinute(h+1)` (`camap-hx/src/controller/Cron.hx:98-107,156-165`; behaviour at hour 24 depends on `DateTool.setHourMinute`, `camap-hx/src/tools/DateTool.hx:45`, unverified). Digest consumer logic is in `messaging-mails.md`; volunteer-mail rules in `distributions-volunteers.md` rules 29-34; default-order cron in `orders-subscriptions.md` rule 8; file cleanup in `catalogs-products-vendors-places.md` rule 47.

### 4.2 TS native jobs

1. `MailsService.sendEmailsFromBuffer`: every minute, up to 100 rows, retry until tries >= 30 (`camap-ts/packages/api-core/src/mails/mails.service.ts:189`).
2. `MessagesService.cleanOldMessages`: daily 00:00, deletes `Message` rows older than 4 months (`camap-ts/packages/api-core/src/messages/messages.service.ts:78-84`).
3. `CacheService.cleanCache`: daily 01:00, deletes expired `Cache` rows (`camap-ts/packages/api-core/src/tools/cache.service.ts:55-59`).
4. `UsersService.cleanUsers`: daily 01:00: warnings (template `deletionWarning.twig`) 1 month, 2 weeks and 3 days before 2-year inactivity deletion; skips users with active membership; deletes users with `ldate < 2y` (or never logged in and created > 6 months ago) with no active membership and no orders < 2y, reassigning to `deleted@camap.tld` (`camap-ts/packages/api-core/src/users/users.service.ts:439-600`).
5. The daily trigger and `cleanOldMessages` both run at 00:00 (`camap-ts/packages/api-core/src/tools/crontab.service.ts:43`, `camap-ts/packages/api-core/src/messages/messages.service.ts:79`). Results of the trigger are only logged (`camap-ts/packages/api-core/src/tools/crontab.service.ts:22-25`). With several Nest replicas and `HX_TRIGGER_CRONS` set, each calls HX (no lock; duplicate execution risk unverified).

## 5. Flows

1. Trigger: Nest scheduler fires `CrontabService.minutely/hourly/daily` -> if `HX_TRIGGER_CRONS` -> HTTP GET to HX `/cron/<x>` -> `Cron.doMinute/doHour/doDaily` -> jobs run inside transaction-wrapped tasks -> mails written to `BufferedJsonMail` -> flushed by the TS minute cron.
2. Manual: `neko index.n cron/hour > cron.log` on the HX host (`camap-hx/src/controller/Cron.hx:90`); documented crontab text exists only as a comment in `camap-ts/packages/api-core/src/tools/crontab.service.ts:9-11`.

### CLI / maintenance scripts
- HX `camap-hx/src/controller/Scripts.hx` (CLI only; `neko index.n /scripts/<action>`, `:4-5`; guard = constructor throw under mod_neko `:12-16`): `recomputeBasketTotal(from,to)` (`:29-50`; for every group loads MDs in range, for every `Basket` sets `b.total = b.getOrdersTotal()`, dated 2023-01-06 in comment) and `cleannonamapdata(groupMinId,userMinId,vendorMinId)` (`:55-83`; deletes ShopMode groups with id > min, users without UserGroup, vendors without catalogs; no confirmation). Script runner catch-all: `setReturnCode(500)`, prints message and stack, `logError`, `rollback` (`camap-hx/src/controller/Main.hx:341-358`).
- TS (`camap-ts/packages/api-core/package.json:19-20`): `dataset` -> `dist/cli/dataset`, `dataset-server` -> `dist/cli/dataset-server`; `camap-ts/packages/api-core/src/cli/sync-db.ts` runs TypeORM `synchronize:true`; `camap-ts/packages/api-core/src/cli/index.ts` is a commander skeleton with all commands commented out (`:7-18`). Helpers `loadAdminProcess`/`saveAdminProcess` (`camap-ts/packages/api-core/src/cli/utils.ts:55-72`) store JSON state in `Variable`, no caller in `api-core/src`. CLI logger `camap-ts/packages/api-core/src/cli/cli-logger.ts:14-45`.

## 6. Ownership hx vs ts

| concern | owner |
|---|---|
| Cron schedule/trigger | TS (`CrontabService`) |
| Cron job logic (reminders, digests, recaps, auto orders, cleanup) | HX |
| TS native jobs (mail flush, cache clean, user purge, message purge) | TS |
| Session purge | HX (`Session.clean()`) |
| Maintenance scripts | HX (`Scripts.hx`); TS dataset CLI |

All rows of section 4.1 exist only in HX; the `NotificationMail` digest, its templates, `quitGroupFromMessage`, `/admin/emails` and `Scripts.hx` are HX-only dependencies of the cron area.

## 7. Known security/rights observations

Pointers only, see inconsistencies-code.md: `/cron/*` endpoints unauthenticated (`canRun()` always true); `HX_TRIGGER_CRONS=false` still triggers; un-awaited deletes in TS purge jobs; destructive `cleannonamapdata`. Doc divergences for `camap-ts/docs/crons.md` (daily time, trigger mechanism, TS jobs list): see inconsistencies-docs.md.
