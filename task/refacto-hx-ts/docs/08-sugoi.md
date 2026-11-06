# 08. Sugoi: what the framework does and how each part is ported

> Read on 2026-11-06 for roadblock B1 ([ROADBLOCKS.md](../ROADBLOCKS.md)).
> - Source: the `sugoi/` submodule, at commit `c3b8db8` (the one camap-hx pins in `camap-hx/backend/haxe_libraries/sugoi.hxml`): 94 Haxe files, about 8.7k lines. Read only.
> - The request transaction comes from `record-macros` (`bablukid/record-macros#41538b7`, lix cache).
> - Paths below are relative to `sugoi/src/sugoi/` unless they start with `camap-hx/`, `camap-ts/` or `record-macros`.
>
> Every mechanism is labelled as [PORTING-RULES.md](../PORTING-RULES.md) §1 requires:
> - **Match**: TS must reproduce it exactly, because existing data or a live contract depends on it. The forcing data is named.
> - **Reimplement**: TS gets the same observable result with standard NestJS/React tools. Nothing of the sugoi code is carried over.

## 1. Request lifecycle

Neko runs `App.main` → `BaseApp.main` (`BaseApp.hx:436-462`) for each request:

1. Headers: `no-cache` and `Content-Type: text/html; Charset=UTF-8` (`BaseApp.hx:22-29`). In debug mode camap-hx adds CORS `*` (`camap-hx/src/App.hx:26-29`).
2. `init`:
   - `config.xml` `maintain="1"` serves `maintain.mtt` and stops (`BaseApp.hx:378-385`);
   - otherwise it opens the MySQL connection from the `database` URL (`:386-404`).
3. `run` wraps the whole request in **one DB transaction** (`record-macros Transaction.hx:53-68`).
   - A deadlock (`try restarting transaction`) makes it **re-run the whole request, up to 3 times** (`:26-40`).
   - Any other error goes to `errorHandler`.
4. `mainLoop` (`BaseApp.hx:209-302`):
   - **Session.** It reads the session from the `?sid=` parameter first, then from the `sid` cookie (`:213-217`).
   - **Maintenance.** It reads the stored setting `Variable.maintain`; admins bypass it (`:220-229`).
   - **Language.** It sets the language (`:167-186`).
   - **Cookie.** It (re)sends the `sid` cookie when the session changed (`:203-207`, `:238`).
   - **Routing.** It dispatches the URI with `haxe.web.Dispatch` to `controller.Main` (`:247-257`). `@tpl` sets the template. `@logged` redirects visitors to `/?__redirect=<uri>`. `@admin` redirects non-admins to `/` (`:125-143`).
   - **Unknown route.** It rolls back and redirects to `/` (`:259-271`); in debug mode it rethrows instead.
   - **Controller results.** `Redirect` / `Ok` / `Error` actions redirect and store a flash message in the session. `Error` also rolls the transaction back (`:273-294`).
   - **End of request.** It renders the template, saves the session row and commits (`:102-123`, `:296-301`).
5. `errorHandler` (`BaseApp.hx:329-372`):
   - It rolls back and writes an `Error` row (`logError`, `:312-327`), which is committed after the rollback.
   - It renders `error.mtt`, with the stack for admins and in debug mode.
   - If even that fails and the `Error` table can't be read, it **re-initialises the database schema** (`:362-369`, CODE-182).

## 2. Mechanisms and how they are ported

| Mechanism | What sugoi does | Label | Port |
|---|---|---|---|
| Request transaction | One transaction for the whole request, committed at the end. Rolled back on an error or an `Error` action. The whole request is re-run up to 3× on a deadlock (`record-macros Transaction.hx`). | Reimplement | One TypeORM transaction per mutation or service call (the transaction library is replaced in Phase 2, E1). Deadlock retry becomes an explicit, per-operation policy, not a whole-request replay (ADM-ERR-008). |
| Routing and access metas | `haxe.web.Dispatch`, `@logged` → `/?__redirect=`, `@admin` → `/`, unknown route → redirect `/` (`BaseApp.hx:125-143,259-271`) | Reimplement | React router plus Nest guards. Keep the observable redirects the specs describe (NAV home/unknown path, login redirect). |
| Error handling and error log | Rollback, then an `Error` row (`url`, `ip`, `uid`, `userAgent`, stack), then an error page with the stack for admins (`BaseApp.hx:312-372`; `db/Error.hx`) | Reimplement (the table is Match while the admin error-log pages read it) | A Nest exception filter plus a logger. While the admin error-log pages (ADM-ERR) and the daily errors email read `Error`, write the same columns. Don't copy the stack-to-admins page, nor the schema re-initialisation (CODE-182). |
| Maintenance mode | `config.xml` `maintain` or the stored setting `Variable.maintain` ≠ 0; admins bypass it; `maintain.mtt` (`BaseApp.hx:220-244,378-385`) | Match the `Variable` key, Reimplement the gate | A Nest middleware or guard reading the same `Variable` key while both apps run, so one switch stops both. |
| Session | Table `Session` (`sid` 32, `ip` 15, `lang`, `messages`, `lastTime`, `createTime`, `sdata`, `uid`) (`db/Session.hx:9-25`). Cookie `sid`, 1 month (`BaseApp.hx:205`). The row is locked `FOR UPDATE` for the request and saved at its end (`db/Session.hx:63`, `BaseApp.hx:105`). Cleanup: logged-in sessions after 30 days, anonymous after 3 (`:120-125`). | **Match while both apps run**, then Reimplement | Shared contract today (UND-021, [TS-ONLY-STEP §3](../TS-ONLY-STEP.md)): the row, `uid`, `lastTime` and the `sid` cookie name and domain. `sdata` (Neko-serialized) and `messages` (Haxe-serialized) are Haxe-only formats: TS must neither read nor write them. Never port the `?sid=` parameter. Regenerate the id at login. Use crypto randomness and `HttpOnly; Secure; SameSite` (CODE-178, CODE-179). After Haxe, sessions become a TS-only design. |
| Flash messages | `Session.messages` filled by `Ok`/`Error` actions, read once by `getMessage(s)` (`BaseView.hx:52-74`) | Reimplement | Front-side notifications (the MUI snackbar/alert already used by front-core) driven by the mutation result. Nothing stored. |
| Language | `session.lang` ← user, `Accept-Language` or `?lang=` (`BaseApp.hx:148-186`) | Reimplement (dropped) | French only (UND-118): no language switching. |
| CSRF | Links: `?token=` = `md5(sid + key[0..6])` (`BaseController.hx:21-25`). Forms: hidden `<form>_token` = `md5(sid + key[0..5])` (`form/elements/CSRFProtection.hx:19-31`). Both are static for the whole session. | Reimplement | `SameSite` cookies plus a standard per-request or double-submit token, or the GraphQL JSON content-type rule. No stored data. Every state-changing GET of Haxe (CODE-020, UND-108) becomes a POST/mutation. |
| Forms and value cleaning | `Form` with typed elements. Strings trimmed, `""` → `null` (`form/elements/Input.hx:79-82`, `IntInput.hx:13-25`). Floats accept `,` (`form/filters/FloatFilter.hx:21-23`). Enums posted as their index (`Enum.hx:52-56`), flags as bit indexes (`Flags.hx:93-102`). `toSpod` writes only fields that were in the form (`Form.hx:237-271`). Uploads ≤ 6 MB (`FileUpload.hx:23`). | Reimplement the forms; Match the encodings | React forms (front-core components) plus Nest DTOs with class-transformer/class-validator reproducing the observable cleaning (trim, empty → null, comma decimals). Enum indexes and flag bitfields are **Match** (C2): use the shared encodings (`tests/src/encodings` are the reference). |
| Rich text | Stored as raw HTML, with no server-side sanitising (`form/elements/Richtext.hx`, `RichtextWym.hx`) | Reimplement; Match on read | Sanitise on write (allow-list). Existing stored HTML must still display. |
| Platform settings (`Variable`) | Key/value table, string values. `get` returns null when missing, `getInt` 0 (`db/Variable.hx`). `increment` ignores its step. | **Match** the table and keys | Both apps read the same keys (theme, maintain, ToS, analytics, etc.). Typed access through the existing TS `VariableService`; values stay strings. |
| Stored files and links | Blobs in `File` (`name`, `data`, `cdate`), linked by `EntityFile` (`entityType`, `documentType`, `data` = visibility) (`db/File.hx`, `db/EntityFile.hx`). URL `/file/<id>_<md5(id + key)>` (`File.hx:28-36`, `BaseView.hx:115-118`). `doFile` checks the signature, writes the blob to `www/file/` on disk and redirects with `?reload=1`, and Apache then serves the copy (`BaseController.hx:49-92`; `camap-hx/www/.htaccess`). | **Match** the signature and the URL path; Reimplement the serving | URLs already sit in sent emails and pages, so `/file/<id>_<md5(id + CAMAP_KEY)>` must keep resolving, with the same key. camap-ts already computes the same signature (`camap-ts/packages/api-core/src/files/file.service.ts:59-78`). Serve from Nest by streaming the blob with cache headers: no disk copy (pods are ephemeral), no signature in error messages (CODE-177). |
| `Cache` table | Key/value with expiry; values in `haxe.Serializer` format. Each read locks the row; 1 read in 1000 purges expired rows (`db/Cache.hx`). Used for **password-reset tokens** (30 days, `camap-hx/src/controller/User.hx:163-196`), cron deduplication (`camap-hx/src/controller/Cron.hx:478-501`) and the product excerpt of a distribution (`camap-hx/src/db/MultiDistrib.hx:104-132`). | Reimplement; Match only for reset links in flight | Nest `cache-manager` (or a TS-owned table) for the caches. Reset links follow UND-011 (24 h, single use). For links Haxe already sent, decide at cut-over whether to honour them (read the serialized user id) or let them expire. They are valid at most 30 days. |
| Permalinks | Table `Permalink` (`link` → `entityType`, `entityId`), resolved by `controller/Main.hx:48-52` | **Match** | Public group URLs that were handed out. camap-ts already maps the table (`PermalinkEntity`). |
| Mail composition | `sugoi.mail.Mail`: recipients checked by regex (an invalid one throws), template rendering with CSS inlining (`mail/Mail.hx:50-153`). `getKey()` (per-day key) is never used. camap-hx sends through its own `BufferedJsonMailer` into `BufferedJsonMail`, which Nest consumes. `MandrillMailer`/`SmtpMailer` and the `smtp_*` settings are dead (CODE-171). | Reimplement; Match the queue row while both write it | Nest mail templates (twig, already used). The `BufferedJsonMail` row is camap's format, not sugoi's: keep it while Haxe still queues mail. |
| i18n | gettext with the text as key; `::param::` interpolation (`i18n/translator/TMap.hx`). Per-language templates are generated from `lang/master` at build time (`i18n/TemplateTranslator.hx`). | Reimplement | i18next, French only, all strings in translation files (UND-118). |
| Templates and view helpers | templo `.mtt`. Helpers: `file()`, `getVariable()`, `nl2br`, `table`, `escapeJS`, `getMessages` (`BaseView.hx`). | Reimplement | React pages: Haxe structure, TS design ([PORTING-RULES §2](../PORTING-RULES.md)). |
| CSV | Export: `;` separator, every value wrapped in `"` with no escaping, headers translated, no BOM (`tools/Csv.hx:244-282`). Import: auto-detects `;` or `,` (`:48-68,149-178`). | Reimplement | A CSV library. Keep the observable format (`;`, column order, French headers) and escape properly (CODE-181). |
| Transactional tasks | `TransactionWrappedTask`: `START TRANSACTION`, run the job, and with `noException` (production) log the error and **commit anyway** (`tools/TransactionWrappedTask.hx:38-60`) | Reimplement | Nest scheduled jobs: one transaction per job (or per item), rollback on failure, structured logs (CODE-180). |
| Geocoding and HTTP calls | `curl` run as a process with an argument array, no shell (`apis/linux/Curl.hx:43-90`) | Reimplement | A Nest HTTP client. The test stack stubs it today (`tests/stack/curl-stub.sh`). |
| Plugins and events | `IPlugIn`, the `hxevents` dispatcher (`camap-hx/src/App.hx:46-56,197`) | Reimplement | Plain Nest services or `@nestjs/event-emitter`; nothing to keep. |
| Config | `config.xml` attributes (`Config.hx`): `key`, `host`, `database`, `debug`, `cache`, `maintain`, `lang(s)`, `sqllog`, `cookie_domain` (`BaseApp.hx:38`) | Reimplement; Match the `key` value | Nest `ConfigModule` env. `key` = `CAMAP_KEY` and must keep its value (md5 passwords, file signatures, D3). |
| Neko runtime caches | Module cache (`cache="1"`), templo compile cache | N/A | Disappears with Neko. |

## 3. What must be matched (summary)

These are the only places where the TS code must reproduce sugoi exactly. Each is forced by existing data or a live contract:

1. **`CAMAP_KEY` keeps its value.** It salts the md5 passwords and signs the file URLs.
2. **File URLs**: `/file/<id>_<md5(id + CAMAP_KEY)>`, resolving to the `File` blob.
3. **`Session` row and `sid` cookie while Haxe runs.** Name, domain, `uid`, `lastTime`, and the 30-day / 3-day cleanup. This is transitional ([TS-ONLY-STEP §3](../TS-ONLY-STEP.md)).
4. **`Variable` table**: same keys, string values.
5. **Enum indexes and flag bitfields** written by Haxe forms (C2).
6. **`Permalink` table** for public URLs.
7. **`BufferedJsonMail` rows while both apps queue mail** (transitional).
8. **`Error` table columns** while the admin error-log pages and the daily errors email read them.
9. **Existing rich-text HTML** must still render.
10. **Password-reset links already sent by Haxe**, only if the cut-over decides to honour them (transitional, at most 30 days).

Everything else is reimplemented with Nest/React tools.

## 4. Findings

Recorded in [inconsistencies-code.md](inconsistencies-code.md):

| ID | Severity | Finding |
|---|---|---|
| CODE-177 | **High** | `/file/*` answers a wrong signature with a 404 that **prints the right one**. Anyone can download any stored file by id, member-only documents included. Confirmed on the test stack. |
| CODE-178 | **High** | Session fixation. A `?sid=` in any URL is adopted and planted as the visitor's `sid` cookie, and neither Haxe nor TS issues a new id at login. Planting confirmed on the test stack; the takeover was not run end to end. |
| CODE-179 | Medium | Session ids come from a non-cryptographic PRNG over a 60-character alphabet (`g`/`G` missing, `j`/`J` twice). The `sid` cookie has no `HttpOnly`, `Secure` or `SameSite`. |
| CODE-180 | Low | `TransactionWrappedTask` commits the partial writes of a failed cron task in production. Its `START TRANSACTION` also implicitly commits the request's pending work. |
| CODE-181 | Low | CSV export: quotes inside values are not escaped; `Csv.escape` doesn't replace newlines or tabs (the result is discarded). |
| CODE-182 | Low | The last-resort error handler re-initialises the database schema when the `Error` table can't be read. |
| CODE-183 | Low | `Session.ip` and `Error.ip` are 15 characters: IPv6 addresses are cut, silently, since MySQL runs without strict mode. |

## 5. Effect on the roadblocks and the plan

- **B1 lifted.** Sugoi is read. The behaviours tests observe are explained, and none of it needs porting as code. The port's compatibility surface is §3.
- **A3 (shared session)** is now precise: TS may touch only `uid`, `lastTime` and the row's existence, never `sdata` or `messages`. CODE-178 and CODE-179 are fixed in the TS design, and also in the current system if decided (see below).
- **G3 (files)** is settled: same signature and URL; Nest streams from the DB. The disk copy in `www/file/` and the `?reload=1` redirect go away.
- **E1 (transactions)**: the TS replacement of the transaction library must cover what the request transaction gave implicitly. That means atomic multi-step writes per mutation, and an explicit deadlock policy.
- **CODE-177, CODE-178 and CODE-179 are live in production** but are fixed at the port, not before (user, 2026-11-06: no slot for production patches before the migration). See [TS-ONLY-STEP.md](../TS-ONLY-STEP.md) §1.
