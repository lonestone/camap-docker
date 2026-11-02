# Admin and superadmin back-office, install, scripts, variables, logging

## 1. Scope

Site-wide superadmin pages (`/admin/*`, `/db`), the global `Variable` settings (theme, attention messages, maintenance), first-install and diagnostics, CLI scripts, the dev style guide `/cssdemo`, error logging, and the superadmin-only TS maintenance REST endpoints. Group-level admin (`/amapadmin`) is in `groups-membership.md`.

Ownership summary: the back-office is HX only. TS has no admin pages; the only TS superadmin surfaces are `loginAs`, bridge `delete-user`, `/files/*` and `/mails/*` maintenance REST, and `VariableService`. `Main.doAdmin` is `@admin` (`camap-hx/src/controller/Main.hx:333-336`), so every `/admin/*` route is superadmin only; `@admin` requires `user.isAdmin()` else redirect `/` (`SUGOI/BaseApp.hx:133-141`; sugoi library outside the repo).

## 2. Concepts & glossary terms

- **Superadmin**: `User.rights` bit 0 (see `users-auth.md`).
- **`Variable`**: shared table `Variable(name varchar(64) PK, value mediumtext)`; TS entity `camap-ts/packages/api-core/src/tools/models/variable.entity.ts:3-10`; HX side `sugoi.db.Variable` (library class).
- **Theme / white label**: JSON in `Variable.whiteLabel`.
- **Attention messages**: flash messages shown on group home from `Variable` keys `attMessage`, `attMessageAdmins`, `attMessageAdminsAlert`.
- **Maintenance mode**: `Variable.maintain` non-zero.
- **Error table**: `sugoi.db.Error` (`error`, `url`, `user`, `ip`, `date`).
- **Placeholder user** `deleted@camap.tld` (see `users-auth.md`).

## 3. Routes & endpoints

| side | route/operation | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `/admin` | `camap-hx/src/controller/admin/Admin.hx:29-39` | `@admin` | `camap-hx/lang/master/tpl/admin/default.mtt` | back-office home; `?reloadSettings=1` calls `app.setTheme()` then redirect "Theme reloaded" |
| HX | `/admin/theme` | `camap-hx/src/controller/admin/Admin.hx:41-62` (store `:52`) | `@admin` | form | one TextArea holding `Json.stringify(app.getTheme())`; on submit parses JSON and stores in `Variable.whiteLabel`; parse error -> redirect `/admin/theme` with "Erreur : ..."; success redirect `/admin/`; in-memory static `App.theme` refreshed only by `/admin?reloadSettings=1` (`:34-38`) or restart (`camap-hx/src/App.hx:153-157`) |
| HX | `/admin/errors` | `camap-hx/src/controller/admin/Admin.hx:101-129` | `@admin` | `camap-hx/lang/master/tpl/admin/errors.mtt` | lists `sugoi.db.Error` rows (20/page, `ResultsBrowser`), 1-month per-day stats; optional `?user=<id>`; `?empty=1` runs `truncate table Error` on GET without CSRF token (`:111-113`); `like` filter parsed but its SQL commented out (`:110`) |
| HX | `/admin/emails` | `camap-hx/src/controller/admin/Admin.hx:64-71` | `@admin` | `camap-hx/lang/master/tpl/admin/emails.mtt` | unsent mails via TS bridge (see `messaging-mails.md`) |
| HX | `/admin/attention` | `camap-hx/src/controller/admin/Admin.hx:146-179` (store `:173`) | `@admin` | form | `attMessage`: flash shown to ALL members of every group (`camap-hx/src/controller/Main.hx:166-170`) |
| HX | `/admin/attentionAdmins` | `camap-hx/src/controller/admin/Admin.hx:184-204` (store `:197-198`) | `@admin` | form (TextArea `attMessageAdmins` + Checkbox `msgAlert` "fond rouge") | writes `attMessageAdmins` and `attMessageAdminsAlert`; read side `camap-hx/src/controller/Main.hx:147-164` |
| HX | `/admin/messages` | `camap-hx/src/controller/admin/Admin.hx:146-179` (store `:154`, read `:148`) | `@admin` | form | `homeMessage`: raw HTML on the group chooser page (`camap-hx/lang/master/tpl/user/choose.mtt:3-6`, `::raw::`) |
| HX | `/admin/superadmins` | `camap-hx/src/controller/admin/Admin.hx:207-209` | `@admin` | `camap-hx/lang/master/tpl/admin/superadmins.mtt` | users with `rights.has(Admin)` |
| HX | `/admin/user[/search/view/delete/userGroup]` | `camap-hx/src/controller/admin/User.hx:10-74` | `@admin` | `camap-hx/lang/master/tpl/admin/user/*.mtt` | user search/view/delete/usergroup sheet; delete calls TS bridge `delete-user` and swallows errors (`:44-55`); `doUserGroup(u,g)` (`:62-77`) renders `admin/user/usergroup.mtt` (46 l.: member's `UserGroup`, last operations `db.Operation.getLastOperations`, MDs +/- 3 months of 30.5 days with their orders) |
| HX | `/admin/group[/view/addMe/deleteGroup]` | `camap-hx/src/controller/admin/Group.hx:10-112` | `@admin` via `Main.doAdmin` (method has no own `@admin`) | `camap-hx/lang/master/tpl/admin/group/*.mtt` | group list with raw SQL built by string concatenation of `groupName` and zip (`:21-55`, `:31-44`), view, add self as member (`:98-102`), delete group (`:104-112`) |
| HX | `/db` | `camap-hx/src/controller/Main.hx:302-306` | `@admin` | sugoi DB admin | raw DB admin (edit `User.rights`, `Group.disabled`...); sidebar link commented out "incompatibility with mysql upgrade to v8" (`camap-hx/lang/master/tpl/admin/basedesign.mtt:11-13`) |
| HX | admin layout | `camap-hx/lang/master/tpl/admin/basedesign.mtt` (28 l.), `admin/design.mtt:1` | `@admin` | `admin/default.mtt`, `emails.mtt`, `errors.mtt` use `admin/design.mtt` | superadmin sidebar: links `/admin/errors`, `/admin/emails`, `/admin/messages`, `/admin/attention`, `/admin/attentionAdmins`, `/admin/group`, `/admin/user` (`:14-20`); no links to `/admin/theme` or `/admin/superadmins` although both routes exist (`Admin.hx:42,207`) |
| HX | `/install` (default) | `camap-hx/src/controller/Install.hx:17-104` | self-guard `db.User.manager.count(true) > 0` (`:19-21`) | none | first install: if `User` table empty creates group + user `admin@camap.tld` / password `admin` with Admin flag (`:25-100`); otherwise `throw "CAMAP est deja installe"` |
| HX | `GET /install/diagnostics` | `camap-hx/src/controller/Install.hx:106-122` (dispatch `camap-hx/src/controller/Main.hx:217-220`) | none (neither `Main.doInstall` nor `Install` restricts it) | none (`Sys.println`) | creates `<webroot>file/` if missing (`:110-113`), prints a warning (does not create) if `file/.htaccess` is missing (`:114-116`), creates `<webroot>../tmp` if missing (`:117-120`) |
| HX | `GET /cssdemo` | `camap-hx/src/controller/Main.hx:209-215` | none | `camap-hx/lang/master/tpl/cssDemo.mtt` (196 l.) | dev style guide (alerts, buttons, `btn-noAntiDoubleClick`); puts `Map<String,String>` `users` (`bob` -> "is a nice fellow") in the view (`cssDemo.mtt:5`) |
| HX | CLI `scripts/<action>` | `camap-hx/src/controller/Scripts.hx`; dispatcher `camap-hx/src/controller/Main.hx:341-358` | constructor throws "CLI only" under mod_neko (`:14-16`) | none | `recomputeBasketTotal(from,to)` (`:29-50`), `cleannonamapdata` (`:55-83`); see `crons-scheduled-jobs.md` |
| HX | `/ping`, `/tos`, `/cgu` | `camap-hx/src/controller/Main.hx:326-328,358-364` | none | none | version JSON (hard-coded `VERSION = [3,0,12]`, `camap-hx/src/App.hx:21`) |
| TS | `GET /ping`, `/health` | `camap-ts/packages/api-core/src/tools/tools.controller.ts:11-21` | none | | `process.env.VERSION` or `0`, no git info |
| TS | `GET /files/get/:id`, `/files/compress/:id`, `/files/compressAll/:page` | `camap-ts/packages/api-core/src/files/file.controller.ts:33-49,51-88,90-150` | superadmin (`:39,58,96`) | | maintenance; details in `catalogs-products-vendors-places.md` |
| TS | `GET /mails/get/:templateName/:params`, `/mails/list` | `camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:36-65,67-86` | superadmin | | template previews (see `messaging-mails.md`) |
| TS | `GET /bridge/auth/*` | `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:21-60` | bearer `CAMAP_KEY` | | see `users-auth.md` |

## 4. Business rules

### Variable keys used by HX

| key | written by | read by | meaning / format | reader auth effect |
|---|---|---|---|---|
| `maintain` | nobody in repo (set manually in DB) | `Main.doDefault` `sugoi.db.Variable.getInt("maintain") != 0` (`camap-hx/src/controller/Main.hx:36`) | non-zero = maintenance: renders `maintain.mtt` instead of redirecting to `/home`; bypassed for `user.isAdmin()` (`:39-41`) | admin bypass |
| `attMessage` | `Admin.doAttention` (`camap-hx/src/controller/admin/Admin.hx:173`) | `camap-hx/src/controller/Main.hx:167`, `Admin.hx:167` (form default) | free text/HTML; ignored when `""`, null or the string `"null"` (`Main.hx:168`) | all members |
| `attMessageAdmins` | `Admin.doAttentionAdmins` (`Admin.hx:197`) | `Main.hx:151`, `Admin.hx:186` | text for group admins | members with `ug.getRights().length > 0` or `isAdmin()` (`Main.hx:150`) |
| `attMessageAdminsAlert` | `Admin.hx:198` (checkbox `msgAlert`) | `Main.hx:153` (`== "true"` -> red flash), `Admin.hx:187,190` | boolean stored as string | same |
| `homeMessage` | `Admin.doMessages` (`Admin.hx:154`) | `Admin.hx:148`; `camap-hx/lang/{master,fr}/tpl/user/choose.mtt:3-6` via `getVariable("homeMessage")`, `::raw::` | banner on group chooser page | public page after login |
| `whiteLabel` | `Admin.doTheme` (`Admin.hx:52`) | `App.setTheme` raw SQL `SELECT value FROM Variable WHERE name='whiteLabel'` (`camap-hx/src/App.hx:145-147`); fallback `defaultTheme` on null/exception (`:148-150`); cached in static `App.theme` | theme JSON | n/a |
| `smtp_host`, `smtp_port` (Int), `smtp_user`, `smtp_pass` | nobody in repo | `BufferedJsonMail` SMTP config sent to the bridge (`camap-hx/src/db/BufferedJsonMail.hx:82-85`) | SMTP credentials in clear text in DB | n/a |
| `googleTagManagerId`, `css`, `js` | n/a | template helper `getVariable(...)` (`camap-hx/lang/master/tpl/base.mtt:26,94,31-42,50-53`) | asset-version path segments | n/a |

`camap-hx/src/controller/Install.hx:3` imports `sugoi.db.Variable` without using it; `camap-hx/src/test/TestSuite.hx:88` only registers the table for test DB creation.

### Variable keys used by TS (`VariableNames`, `camap-ts/packages/api-core/src/tools/variable.service.ts:9-14`)

| key | written by | read by | effect |
|---|---|---|---|
| `tosVersion` | seeded `'1'` by `camap-ts/packages/api-core/src/dev/dataset-generator.ts:746` only | no reader | none |
| `platformtermsofservice` | seeded `'1'` (`dataset-generator.ts:747`) | `VendorService.create` -> `getInt(...)` stored into `Vendor.tosVersion` (`camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:183-195`) | stamps new vendors; `getInt` tests `i === null` (`variable.service.ts:47`) but `findOne` returns `undefined`, so a missing row throws at `parseInt(i.value)` (`:48`) |
| `IPBlacklist` | none | `BlackListGuard` (`camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:26-39`): JSON array of IPs; also rejects User-Agent containing `python` (`:45-47`) | guard never applied |
| `defaultShowcaseGroupIds` | none | none (declaration only, `variable.service.ts:14`) | dead |

1. `VariableService.set` (`camap-ts/packages/api-core/src/tools/variable.service.ts:49-59`) calls `this.variableRepo.save(v)` without `await` (`:59`); `findOneByKey` (`:23`); `get()` (`:36-40`) uses `!v`. They are called only by the CLI helpers `loadAdminProcess`/`saveAdminProcess` (`camap-ts/packages/api-core/src/cli/utils.ts:55-72`) with no caller in `api-core/src`. TS writes `Variable` only through the dataset seeder; HX writes `attMessage*`, `homeMessage`, `whiteLabel`; front-core has no equivalent admin pages.
2. TS `VariableService.getTheme()` never reads the DB: it returns `DEFAULT_THEME(CAMAP_HOST)` cached in a static (`camap-ts/packages/api-core/src/tools/variable.service.ts:61-72`); TS mails (`camap-ts/packages/api-core/src/mails/mails.service.ts:65,102,240`), invitations (`camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:191,306`) and `camap-ts/packages/api-core/src/users/users.service.ts:515` ignore the HX-edited white label.
3. Attention messages: `attMessage` is shown as a session flash to all members; `attMessageAdmins` (red when alert flag is `"true"`) only to members with any right or admin (`camap-hx/src/controller/Main.hx:147-170`).

### Superadmin actions
4. User delete (`/admin/user/delete`) = TS `UsersService.delete` via bridge (rules in `users-auth.md` 25-26). Group delete and add-self-as-member in `camap-hx/src/controller/admin/Group.hx:98-112`. Session purge and superadmin impersonation: see `users-auth.md`.
5. Distribution tools reachable by group managers but flagged as back-office: `Distribution.doEditMd`, `doChangePrice` (see `distributions-volunteers.md`), `ContractAdmin.doCopyProducts` (`@admin`, `camap-hx/src/controller/ContractAdmin.hx:314`), `Subscriptions.doReattribute` (`@admin`, `camap-hx/src/controller/Subscriptions.hx:47-90`).

### Logging and errors

| mechanism | behaviour | path:line |
|---|---|---|
| `App.log(t)` | only when `App.config.DEBUG`: `neko.Web.logMessage` -> Apache error log; optional `Weblog.log` | `camap-hx/src/App.hx:188-195` |
| `App.current.logError(e[, stack])` | persists a `sugoi.db.Error` row (library implementation); callers: API catch-all (`camap-hx/src/controller/Main.hx:203`), scripts catch-all (`:348`), cron mail failures (`camap-hx/src/controller/Cron.hx:615,706`), cron JSON dump `?json=1` (`:81`), `camap-hx/src/service/PaymentService.hx:202` | listed |
| REST API errors | `controller.Api` wrapped in try/catch: `tink.core.Error` -> HTTP `e.code`, body `{error:{code,message,stack}}`, rollback (`camap-hx/src/controller/Main.hx:193-198`); other exceptions -> HTTP 500, `logError`, body includes the stack trace to the client, rollback (`:199-206`) | `camap-hx/src/controller/Main.hx:187-207` |
| CLI scripts | catch-all: `setReturnCode(500)`, prints message and stack with `Sys.println`, `logError`, `rollback` | `camap-hx/src/controller/Main.hx:341-358` |
| Daily error digest | cron "Send errors to admin" mails yesterday's rows to `webmaster_email` | `camap-hx/src/controller/Cron.hx:353-377` |
| Back-office viewer | `/admin/errors` | `camap-hx/src/controller/admin/Admin.hx:101-129` |
| User-facing errors | `throw Error(url,msg)` / `Ok` / `Redirect` (about 174 occurrences in `camap-hx/src`) become session flash messages, not log rows | `camap-hx/src/controller/*.hx` |
| `trace(...)` | 3 live uses: `camap-hx/src/service/VolunteerService.hx:146,152`, `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:173` | |
| Sentry/Rollbar/etc. | none in sources (matches only compiled third-party bundles in `camap-ts/public/neostatic/`) | |
| TS bootstrap | `console.log("Server started on <url>. Production: ...")` | `camap-ts/packages/api-core/src/main.ts:93-97` |
| TS `Logger` | `'MessageService'` (`camap-ts/packages/api-core/src/messages/messages.service.ts:12,82`), `'MailService'` (`camap-ts/packages/api-core/src/mails/mails.service.ts:114,217,301,328`), `'UsersService CRON'` (`camap-ts/packages/api-core/src/users/users.service.ts:54,444,498,597,601`), `'FileService'` (`camap-ts/packages/api-core/src/files/file.service.ts:17`) | |
| TS raw `console.log` | `CrontabService` (`camap-ts/packages/api-core/src/tools/crontab.service.ts:18-53`), `camap-ts/packages/api-core/src/files/file.controller.ts:84,133,144`, `camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:228`, dataset CLIs | |
| GraphQL | Apollo `debug` and `playground` enabled when `NODE_ENV !== 'production'`; no `formatError`, no global exception filter | `camap-ts/packages/api-core/src/app.module.ts:41-52` |
| Exceptions | Nest HTTP exceptions (NotFound x59, Unauthorized x37, Forbidden x37, BadRequest x11, InternalServerError x5 by grep) | `camap-ts/packages/api-core/src` |
| Domain errors | `CamapError(type)` (`camap-ts/packages/api-core/src/common/errors/camap.error.ts:3-14`) + `@MutationFail([types])` rolling back and returning `error.toObj()` (`camap-ts/packages/api-core/src/common/decorators/mutation-fail.decorator.ts:5-25`); single use `updateUser` (`camap-ts/packages/api-core/src/users/users.resolver.ts:161`) | |
| Deadlocks | `DeadlockInterceptor` retries a request up to 5 times on MySQL `ER_LOCK_DEADLOCK` / Postgres `deadlock_detected` (`camap-ts/packages/api-core/src/common/interceptors/dealock.interceptor.ts:5-33`, registered `camap-ts/packages/api-core/src/app.module.ts:66-70`); HX has none | |
| Env validation | `Env error: ...` at boot if `envSchema` fails | `camap-ts/packages/api-core/src/app.module.ts:35-38` |
| Transactions | `@TransactionalMutation` = `Transactional()` + `Mutation()` (`camap-ts/packages/api-core/src/common/decorators/transactional-mutation.decorator.ts:5-7`); no `@Post/@Put/@Delete/@Patch/@Subscription` exists; 11 `@Get` | |

HX persists errors in DB and mails a daily digest; TS has no persistence, digest or alerting (stdout via Nest `Logger`/`console`).

### Install, files and diagnostics
6. TS seeds via `camap-ts/packages/api-core/src/dev/dataset-generator.ts` (not `Install`). `FilesService` stores files in a DB table (`camap-ts/packages/api-core/src/files/file.service.ts`), so no `file/` directory diagnostics are needed there.
7. TS `/files/*` routes overwrite blobs in place with no backup; `compressFiles` injects `@Res()` yet `return 'No page'` when `page` is falsy (`camap-ts/packages/api-core/src/files/file.controller.ts:99`; behaviour with `@Res()` unverified).

## 5. Flows

1. Theme change: `/admin/theme` -> JSON stored in `Variable.whiteLabel` -> HX picks it up after `/admin?reloadSettings=1` or restart; TS keeps the default theme.
2. Announcement: `/admin/attention` or `/admin/attentionAdmins` -> `Variable` -> shown as flash on `/home` (`camap-hx/src/controller/Main.hx:147-170`).
3. Maintenance: operator sets `Variable.maintain` in DB -> `/` renders `maintain.mtt` for non-admins.
4. First install: empty `User` table -> `/install` creates group and `admin@camap.tld`.
5. Error triage: `logError` rows -> `/admin/errors` and the daily mail.

## 6. Ownership hx vs ts

| capability | HX | TS |
|---|---|---|
| Back-office pages (`/admin/*`, `/db`) | all | none |
| Theme editing | writes `whiteLabel`, reads it | default theme only |
| Attention/home messages | write and read | none |
| Install and diagnostics | yes | dataset seeder |
| Error persistence and digest | yes | none |
| Maintenance REST (`/files/*`, `/mails/*`) | none | superadmin REST |
| Version | hard-coded `[3,0,12]` at `/ping` | `process.env.VERSION` at `/ping`, `/health` |

## 7. Known security/rights observations

Pointers only, see inconsistencies-code.md: unauthenticated `/install/diagnostics` and `/cssdemo`; `/admin/errors?empty=1` truncation via GET without token; string-concatenated SQL in `/admin/group`; `BlackListGuard` never applied; `VariableService` `getInt`/`set` defects; HX theme ignored by TS; `/cron/*` unauthenticated (see `crons-scheduled-jobs.md`). Doc divergences for `transactions.md`, `dataloader.md`, `utils.md`: see inconsistencies-docs.md.
