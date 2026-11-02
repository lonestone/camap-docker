# Documentation inconsistencies (existing docs vs code)

Source: "Documentation inconsistencies" sections of drafts 01 to 11 (`task/refacto-hx-ts/docs/_drafts/`). Every entry is tagged with the verdict from the verification pass. REFUTED items are excluded and listed in the appendix.

Conventions
- Paths are repo-relative to the `camap-docker` root; draft prefix aliases (camap-hx/src/, camap-ts/packages/api-core/src/, camap-ts/packages/front-core/src/, camap-ts/packages/camap-common/src/, camap-hx/lang/master/tpl/) are expanded to full paths. `SUGOI` = external Haxe lib `sugoi` (outside the repo, in the lix cache: `~/haxe/haxe_libraries/sugoi/1.0.0/github/c3b8db853ccedf4be0eb15d6f27b16940ffcd37b/src/sugoi/`).
- "Refs" gives the draft and item number (`01#8.3` = draft 01, section "Documentation inconsistencies", item 3; `11#D-4` = draft 11 item D-4).
- Where a draft gave no line for the doc claim, "(line n/a)" is written. Where the verifier corrected a line, the corrected line is used.
- Deduplication: the same doc and the same claim reported by several drafts is merged into one entry listing all refs.

## Index by existing doc

| Doc | IDs (count) |
|---|---|
| Root `README.md` | DOC-01 to DOC-05 (5) |
| `camap-hx` docs | DOC-06 to DOC-09 (4) |
| `.cursor/rules/project.md` | DOC-10 to DOC-10 (1) |
| `camap-ts/README.md` and package READMEs | DOC-11 to DOC-13 (3) |
| `camap-ts/docs/conf.md` | DOC-14 to DOC-17 (4) |
| `camap-ts/docs/crons.md` | DOC-18 to DOC-19 (2) |
| `camap-ts/docs/install.md` | DOC-20 to DOC-23 (4) |
| `camap-ts/docs/troubleshooting.md` | DOC-24 to DOC-25 (2) |
| `camap-ts/docs/future.md` | DOC-26 to DOC-29 (4) |
| `camap-ts/docs/schema.md`, `dataset.md` and archived copies | DOC-30 to DOC-34 (5) |
| `camap-ts/docs/users.md` | DOC-35 to DOC-42 (8) |
| `camap-ts/docs/groups.md` | DOC-43 to DOC-45 (3) |
| `camap-ts/docs/membership.md` | DOC-46 to DOC-48 (3) |
| `camap-ts/docs/contracts.md` | DOC-49 to DOC-55 (7) |
| `camap-ts/docs/products.md` | DOC-56 to DOC-59 (4) |
| `camap-ts/docs/files.md` | DOC-60 to DOC-61 (2) |
| `camap-ts/docs/distributions.md`, `volunteers.md`, `messages.md` | DOC-62 to DOC-66 (5) |
| `camap-ts/docs/orders.md` and `subscriptions.md` | DOC-67 to DOC-73 (7) |
| `camap-ts/docs/payments.md` and `transactions.md` | DOC-74 to DOC-84 (11) |
| `camap-ts/docs/emails.md`, `templates.md`, `docs/tests/mail/` | DOC-85 to DOC-90 (6) |
| `camap-ts/docs/neo-modules.md` | DOC-91 to DOC-97 (7) |
| `camap-ts/docs/i18n.md`, `theme.md`, archives | DOC-98 to DOC-104 (7) |
| `camap-ts/docs/readme.md`, `tests.md`, archives, api-core docs and misc | DOC-105 to DOC-113 (9) |

---

## Root `README.md`

### DOC-01 - "5 containers" count
- Doc: `README.md:77-82` lists 5 containers.
- Code: matches the dev compose (traefik, mysql, nest, neko, mailpit); `docker-compose.prod.yml` and `docker-compose.easy.yml` run 4 (no mailpit).
- Refs: 01#8.17. Verdict: CONFIRMED.

### DOC-02 - copy `.env` / `config.xml` instructions
- Doc: `README.md:65-66` says to copy `.env` into `camap-ts` and `config.xml` into `camap-hx`.
- Code: dev compose mounts root-level `./.env` and `./config.xml` (`docker-compose.dev.yml:109,140-141`); `camap-ts/.env` is a symlink to `../.env`. Both root `config.xml` and `camap-hx/config.xml` exist; compose uses the root one (`docker-compose.dev.yml:140`).
- Refs: 01#8.12. Verdict: CONFIRMED.

### DOC-03 - "/install initialises the DB" and admin creation
- Doc: `README.md:96-98` says first access to `/install` initialises the database and creates admin `admin@camap.tld` / `admin`.
- Code: `/install` only seeds demo rows and requires existing tables (`camap-hx/src/controller/Install.hx:20,25-100`); `camap-ts/docs/troubleshooting.md:23` says to run `npm run schema:sync` first. TS has its own init in `camap-ts/scripts/start.sh:25-26` (`schema:sync` + `dataset`), not referenced by the Dockerfile or any compose (who runs it is unverified).
- Refs: 02#6.1, 01#8.18. Verdict: CONFIRMED.

### DOC-04 - `key` / `CAMAP_KEY` purpose
- Doc: `README.md:107-109,119-121` says `key`/`CAMAP_KEY` is "used to verify password hashes".
- Code: true for HX (`camap-hx/src/db/User.hx:278`) but it is also the bridge bearer secret (`camap-ts/packages/api-core/src/auth/strategies/bridge.strategy.ts:13`, see `camap-hx/src/service/BridgeService.hx:105`), the TS md5/sha1 salt (`camap-ts/packages/api-core/src/tools/crypto.service.ts:17-26`) and the file-id hash input (`camap-ts/packages/api-core/src/files/file.service.ts:65`). Undocumented in README and `conf.md`.
- Refs: 01#8.13. Verdict: CONFIRMED.

### DOC-05 - `docker-compose.yml` presented as an editable file
- Doc: `README.md:175,179` (and `camap-ts/docs/install.md:124,162`, see DOC-23) talk about `docker-compose.yml` as an editable base.
- Code: it is a symlink to `docker-compose.dev.yml`, so editing "the base" edits the dev file.
- Refs: 01#8.11. Verdict: CONFIRMED.

---

## `camap-hx` docs

### DOC-06 - "Haxe 4.05" and no test instructions
- Doc: `camap-hx/README.md:10` says "Haxe 4.05" (draft 01 cited :7, verifier corrected to :10); `camap-hx/Contributing.md:52` says "Testez votre modification avant de soumettre" without a command.
- Code: Dockerfile pins `4.0.5` (`camap-hx/camap-hx.Dockerfile:15`) (typo level). Haxe tests live in `camap-hx/src/test` and are not wired into any build file (see DOC-108).
- Refs: 01#8.15, 10#9.13. Verdict: CONFIRMED.

### DOC-07 - `www/theme/theme.md` less/scss file names
- Doc: `camap-hx/www/theme/theme.md` names `www/theme/default/css/variable.less` and `variable.scss` (singular) (line n/a).
- Code: files are `variables.less` and `variables.scss` (plural) in `camap-hx/www/theme/default/css`.
- Refs: 09#D15. Verdict: CONFIRMED.

### DOC-08 - `www/theme/theme.md` css build scripts
- Doc: `camap-hx/www/theme/theme.md` says `css_compile.sh` generates Bootstrap files and `npm run dev:sass` is `sass ../www/theme` (line n/a).
- Code: `camap-hx/www/theme/default/css_compile.sh` exists, `dev:sass` is at `camap-hx/backend/package.json:16`; `buildSass.sh` is the scripted path.
- Refs: 09#D16. Verdict: PLAUSIBLE: `css_compile.sh` content and behaviour were not run or read.

### DOC-09 - `camap-hx/README.md` / `Contributing.md` omit endpoint documentation
- Doc: `camap-ts/docs/install.md:29` describes `/api/<controller>/<action>` for `camap-hx/src/controller/api/<Controller>.hx`.
- Code: consistent (the directory exists), but no endpoint list is documented anywhere in the reviewed docs.
- Refs: 10#9.12. Verdict: CONFIRMED.

---

## `.cursor/rules/project.md`

### DOC-10 - "Do not couple camap-hx and camap-ts at build/runtime"
- Doc: `.cursor/rules/project.md:14`.
- Code: runtime coupling is structural: bridge (`camap-hx/src/service/BridgeService.hx:14,98`), shared key (`camap-ts/packages/api-core/src/auth/strategies/bridge.strategy.ts:13`), crons (`camap-ts/packages/api-core/src/tools/crontab.service.ts:20`), Apache proxy to Nest (`camap-hx/apache/camap-static.conf:16-25`), shared DB.
- Refs: 01#8.16. Verdict: CONFIRMED.

---

## `camap-ts/README.md` and package READMEs

### DOC-11 - "avec docker-compose (ne fonctionne plus)"
- Doc: `camap-ts/README.md:21` and `camap-ts/docs/install.md:21` say the docker-compose path no longer works.
- Code: `install.md` itself is a docker-compose-based procedure (`install.md:16,126,158-164`).
- Refs: 01#8.10. Verdict: CONFIRMED.

### DOC-12 - `packages/api-core/README.md` "Migrations are automatically run on start"
- Doc: `camap-ts/packages/api-core/README.md:50`. The README is the stock Nest template (unclosed code fence at `:58-59`, Travis badges).
- Code: only `start:prod` runs migrations (`camap-ts/packages/api-core/package.json:25`); `start` is `node dist/main`; Docker `CMD` is `node main` (`camap-ts/camap-ts.Dockerfile:65`); no `migrationsRun` anywhere in `src`.
- Refs: 10#9.8. Verdict: CONFIRMED.

### DOC-13 - `packages/browser-detect/README.md` build tool
- Doc: `camap-ts/packages/browser-detect/README.md:15-16` mentions parcel-bundler and copying into "Camap-Haxe" `www`.
- Code: `camap-ts/packages/browser-detect/package.json:7-8` uses parcel, so the README matches (the draft's original "not verified" is resolved).
- Refs: 10#9.9. Verdict: CONFIRMED (no divergence found; recorded as checked).

---

## `camap-ts/docs/conf.md`

### DOC-14 - `langs` separator
- Doc: `camap-ts/docs/conf.md:9` says `langs` is comma-separated (`fr,en,es,de`).
- Code: Sugoi splits on `;` (`SUGOI Config.hx:25`, external lib, verified in the lix cache); `config.xml:3` uses a single value. Also `camap-ts/docs/i18n.md` example "langs=fr,en" (see DOC-100).
- Refs: 01#8.3. Verdict: CONFIRMED.

### DOC-15 - environment variables omitted and `camap_api`
- Doc: `camap-ts/docs/conf.md:41-95` omits env vars used by code or sample: `CAMAP_LOCAL_HOST` (`.env.sample:55`, `crontab.service.ts:60`), `CAMAP_BRIDGE_API` (`.env.sample:57`), `DISABLE_BRUTE_FORCE` (`auth.service.ts:281`), `VERSION` (`tools.controller.ts:13`), `SMTP_IGNORE_TLS`, `SMTP_TLS_SERVERNAME` (`mails.module.ts:31,46`), `NODE_ENV`, `PUBLIC_PATH` (`camap-hx/entrypoint.sh:32`), `GIT_COMMIT_SHORT`. It also says `camap_api` is the URL of camap-ts (`conf.md:33`).
- Code: omissions as listed (not all re-checked by the verifier). The draft sub-claim "no HX code reads `camap_api`" was FALSE: `camap-hx/src/View.hx:278` uses `App.config.get("camap_api") + "/graphql"` (also set in `config.xml:16`).
- Refs: 01#8.4. Verdict: CONFIRMED (omission list); sub-claim about `camap_api` withdrawn by the verifier.

### DOC-16 - `DB_ENTITIES` glob mangled
- Doc: `camap-ts/docs/conf.md:65` shows `DB_ENTITIES = ./dist/\*_/_.entity.js` (markdown-mangled).
- Code: real value `./dist/**/*.entity.js` (`.env.sample:22`).
- Refs: 01#8.5. Verdict: CONFIRMED.

### DOC-17 - `FRONT_GRAPHQL_URL` and `DB_SYNCHRONIZE`
- Doc: `conf.md:89-90` gives `FRONT_GRAPHQL_URL=http://localhost:3010/graphql`; `conf.md:64` documents `DB_SYNCHRONIZE`.
- Code: `.env.test:46` has `FRONT_GRAPHQL_URL=/graphql` and the runtime default is relative `/graphql` (`camap-ts/packages/front-core/src/lib/runtimeCfg.ts:19-22`). `DB_SYNCHRONIZE=false` is defined in `.env.sample:21` / `.env.test:22` but `camap-ts/ormconfig.js:34` does not read it (commented out); only other mention is a commented line in `camap-ts/packages/api-core/src/envSchema.ts:19`.
- Refs: 10#9.10 (CONFIRMED), 02#6.8 (PLAUSIBLE: `.env.sample`/`.env.test` were not readable during that verification; `ormconfig.js:34` comment verified). Verdict: CONFIRMED for FRONT_GRAPHQL_URL; PLAUSIBLE for DB_SYNCHRONIZE (env files not read).

---

## `camap-ts/docs/crons.md`

### DOC-18 - crontab must be programmed; schedule `15 0 * * *`
- Doc: `camap-ts/docs/crons.md:11-17` says a server crontab must be programmed (neko `index.n cron/...`), daily at `15 0 * * *`; it also lists the hx crontab path `/var/vhosts/camap/www/`; it does not mention the Nest `CrontabService` + `HX_TRIGGER_CRONS` mechanism (only `conf.md:93` does) nor that `/cron/*` is unauthenticated.
- Code: Nest triggers HX over HTTP (`camap-ts/packages/api-core/src/tools/crontab.service.ts:20,34,48`), daily at 00:00 (`EVERY_DAY_AT_MIDNIGHT`, `:43`); the crontab text exists only as a comment (`crontab.service.ts:9-11`, path `/var/vhosts/appcamap/app.camap.net/www/` at `:9`, cosmetic). The jobs are inert unless `HX_TRIGGER_CRONS` is set (`:17`). `/cron/*` is unauthenticated: `camap-hx/src/controller/Cron.hx:36-37` `canRun()` returns true, no Apache/Traefik restriction found (security-relevant).
- Refs: 01#8.1, 08#9.2, 08#9.3 (first part), 08#9.4, 10#9.11. Verdict: CONFIRMED.

### DOC-19 - TS crons "handled by Node", example `sendEmailsFromBuffer`
- Doc: `camap-ts/docs/crons.md:21-32` ("En Ts"): crons handled directly by Node, with `sendEmailsFromBuffer` as the example.
- Code: the only cron service in `tools/` just calls HX (`crontab.service.ts:15-60`); the example method name was not found in `crontab.service.ts` (other Nest jobs not inventoried by draft 01); the doc omits cleanOldMessages, cleanCache, cleanUsers (draft 08).
- Refs: 01#8.2, 08#9.3 (second part). Verdict: CONFIRMED.

---

## `camap-ts/docs/install.md`

### DOC-20 - api-core build command
- Doc: `install.md:90-91` says api-core compilation is `npm run build:front`, output `front-core/dist/*`.
- Code: that is the front-core build, whose output is `public/neostatic` (`camap-ts/packages/front-core/webpack.config.js:12`); api-core is built by `build:api` (`camap-ts/package.json:13`) into `packages/api-core/dist`.
- Refs: 01#8.7. Verdict: CONFIRMED.

### DOC-21 - `camap-hx/apache.conf` as the static-serving config
- Doc: `install.md:49,64` points to `camap-hx/apache.conf`.
- Code: that file (`Listen 3009`, vhost on 3009, `camap-hx/apache.conf:4,6`) is not referenced by the Dockerfile; the image uses `camap-hx/apache/camap-static.conf` and the default Debian site (`camap-hx/camap-hx.Dockerfile:127,131-134`).
- Refs: 01#8.8. Verdict: CONFIRMED.

### DOC-22 - manual backend reinstall in the container
- Doc: `install.md:180-197` (`cd /srv/backend`, `lix download`, `haxe`).
- Code: the runtime image has no `/srv/backend`, `/srv/frontend` nor haxe (`camap-hx/camap-hx.Dockerfile:138-141`, apt list `:109-113`).
- Refs: 01#8.9. Verdict: CONFIRMED.

### DOC-23 - `docker-compose.yml` editable (see DOC-05)
- Doc: `install.md:124,162`.
- Code: symlink to `docker-compose.dev.yml`.
- Refs: 01#8.11. Verdict: CONFIRMED.

---

## `camap-ts/docs/troubleshooting.md`

### DOC-24 - CAMAP_HOST baked at front-core build time; used by cron
- Doc: `troubleshooting.md:32-33,36` claims `CAMAP_HOST` (and the front) is baked at front-core build time; `:34` says `CAMAP_HOST` is used "par le cron camap-ts".
- Code: webpack no longer inlines `FRONT_URL/FRONT_GRAPHQL_URL/CAMAP_HOST/MAPBOX_KEY`; they are read at runtime from `window.__APP_CONFIG__` (`camap-ts/packages/front-core/webpack.config.js:76-77`; `camap-hx/entrypoint.sh:55-62`). The cron uses `CAMAP_LOCAL_HOST` (`crontab.service.ts:60`).
- Refs: 01#8.6. Verdict: CONFIRMED.

### DOC-25 - "do not create the DB yourself, let camap-hx create it"
- Doc: `troubleshooting.md:18`.
- Code: all compose files create `db-camap` through the mysql image (`docker-compose.dev.yml:58`, `docker-compose.easy.yml:45`, `docker-compose.prod.yml:53`); no Haxe code creates a database outside tests (`camap-hx/src/test/TestSuite.hx:55`).
- Refs: 02#6.2. Verdict: CONFIRMED.

---

## `camap-ts/docs/future.md`

### DOC-26 - "fonctionne avec des dates UTC"
- Doc: `future.md:28`.
- Code: entities store Paris wall-clock datetimes and convert in getters (`camap-ts/packages/api-core/src/shop/entities/distribution.entity.ts:82-90`, `camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:99-106`); other datetime columns are untouched. (Paris/UTC handling is documented in `future.md:24-30`, but not in `distributions.md`, see DOC-62.)
- Refs: 02#6.3. Verdict: CONFIRMED.

### DOC-27 - DB charset latin1_swedish_ci
- Doc: `future.md:43`.
- Code: repo config is utf8mb4 on both sides (`camap-ts/mysql/my.cnf:8-10`, `camap-ts/ormconfig.js:36-37`). Whether existing production DBs are still latin1 is unverified.
- Refs: 02#6.4. Verdict: CONFIRMED (repo config only).

### DOC-28 - "quasiment toutes les entités" duplicated
- Doc: `future.md:30-32`.
- Code: 22/22 hx `db.*` classes are duplicated in TS (accurate); the doc does not mention the 7 sugoi tables or `BufferedMail`.
- Refs: 02#6.9. Verdict: PLAUSIBLE: the 22/22 count and the "7 sugoi tables" were not recounted.

### DOC-29 - MySQL 5.7 "ancienne"
- Doc: `future.md:53`.
- Code: stack runs MySQL 8.0.36 (`camap-ts/mysql/mysql.Dockerfile:1`, `camap-ts/README.md:15`).
- Refs: 01#8.14. Verdict: CONFIRMED.

---

## `camap-ts/docs/schema.md`, `dataset.md` and archived copies

### DOC-30 - `schema:log` should show no diff / all changes via migration
- Doc: `camap-ts/docs/schema.md:5-9`.
- Code: no baseline migration; dev DBs are built by `schema:sync` (`troubleshooting.md:23`); entities differ from hx declarations (see inconsistencies-code.md, data model items), so a clean `schema:log` depends on which side created the DB.
- Refs: 02#6.5. Verdict: PLAUSIBLE: needs a live DB; `schema.md:5-9` text verified.

### DOC-31 - `npm run typeorm` vs bare `typeorm`
- Doc: `camap-ts/docs/schema.md:25,38-39` uses `npm run typeorm ...`; the archived copy `camap-ts/docs/archives/api-core/schema.md` uses bare `typeorm ...` and is otherwise identical text.
- Code: cosmetic duplication.
- Refs: 02#6.6. Verdict: CONFIRMED.

### DOC-32 - `dataset --clean`
- Doc: `camap-ts/docs/dataset.md` (`--clean`, "supprimer toutes les données").
- Code: `camap-ts/packages/api-core/src/cli/dataset.ts:9-13` calls `connection.synchronize(true)`, which drops and recreates the whole schema, not only data.
- Refs: 02#6.7. Verdict: CONFIRMED.

### DOC-33 - archived dataset doc: typo and duplicate
- Doc: `camap-ts/docs/archives/dataset.md:157` references `dafault.islet.ts`; two divergent dataset docs exist (`docs/dataset.md` and `docs/archives/dataset.md`).
- Code: the file is `default.islet.ts` (the only islet file). The draft also claimed `genTransactionIslet` is not a helper in code; the verifier found it is a user-defined example function in the doc (`archives/dataset.md:73-75`), so that sub-claim is withdrawn.
- Refs: 10#9.6. Verdict: CONFIRMED for the typo and the two divergent docs; sub-claim withdrawn (PARTIALLY REFUTED, see appendix).

### DOC-34 - `docs/archives/api-core/tests.md` and `template-test-e2e.md` links and helpers
- Doc: `camap-ts/docs/archives/api-core/tests.md:5,7` link `./dataset.md` and `../test/dataset/dataset.md`; `:32` uses an `Orders` filter. `camap-ts/docs/archives/api-core/template-test-e2e.md:4-5,11,15,19` uses `beforeEach_e2e`, `afterEach_e2e`, `createApolloClient(testHelper, USERS.francois)` and `./dataset` with `USERS`.
- Code: actual dataset doc is `camap-ts/docs/archives/dataset.md`; `test/dataset` does not exist; no `Orders` e2e spec exists (specs: groups, multi-distrib.service, products, catalogs, catalogs.service, timezones); helpers are `initTestApp`, `closeTestApp`, `createApolloClient({app, signUser}, user)` (`camap-ts/packages/api-core/test/utils.ts:75,112,116`).
- Refs: 10#9.4, 10#9.5. Verdict: CONFIRMED.

---

## `camap-ts/docs/users.md`

(Draft 03 gave doc quotes, no line numbers: "line n/a".)

### DOC-35 - "Le champs `User.pass` n'est plus utilisé"
- Code: TS still writes `pass = md5(KEY+password)` at registration (`camap-ts/packages/api-core/src/auth/auth.service.ts:115`) and verifies against it as fallback (`:332-336`); HX `setPass` writes only `pass` (`camap-hx/src/db/User.hx:274-281`); HX "new users" query uses `pass == ""` (`camap-hx/src/db/User.hx:500`).
- Refs: 03#D1. Verdict: CONFIRMED.

### DOC-36 - Group access via `amapId` in `Session.data`
- Code: only possible in HX; `sdata` is a Neko-serialized blob TS never decodes (`camap-ts/packages/api-core/src/tools/models/session.entity.ts:29-30`; `SUGOI db/Session.hx:50-58`). TS gets group ids from the caller.
- Refs: 03#D2. Verdict: CONFIRMED.

### DOC-37 - fail2ban paragraph incomplete
- Code: omits that the counter is incremented only by the separate `recordBadLogin` mutation called by the React client (`camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:66`), threshold 5 failures, TTL 10 minutes, and the `DISABLE_BRUTE_FORCE` switch (`camap-ts/packages/api-core/src/auth/auth.service.ts:50-56,280-309`).
- Refs: 03#D3. Verdict: CONFIRMED.

### DOC-38 - authentication section describes only the JWT
- Code: omits the refresh-token cookie, the `Auth_sid` cookie and sid-sync check, and the bridge bearer endpoints (`camap-ts/packages/api-core/src/auth/auth.service.ts:16-18`, `camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:81-92`, `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts`).
- Refs: 03#D4. Verdict: CONFIRMED.

### DOC-39 - "Le champs email est unique"
- Code: only `email` has a unique index; `email2` uniqueness is application-level and not enforced by TS `register` (`camap-ts/packages/api-core/src/users/models/user.entity.ts:18-19`; `camap-ts/packages/api-core/src/auth/auth.service.ts:98-120`).
- Refs: 03#D5. Verdict: CONFIRMED.

### DOC-40 - inactive-user purge section omits conditions
- Code: never-logged users purged after 6 months; active membership and recent orders (2 years) excluded; `deleted@camap.tld` must exist else nothing is deleted; deletion also blocked by orders < 2 months or negative balance; `ldate NULL` users get no warning (`camap-ts/packages/api-core/src/users/users.service.ts:441-604`, `:333-359,373-388`).
- Refs: 03#D6. Verdict: CONFIRMED.

### DOC-41 - "hacke camap-hx"; password-change path
- Code: the doc does not state that HX password reset is the only password-change path (no TS mutation), nor that reset updates only `pass` (see inconsistencies-code.md, password reset items).
- Refs: 03#D7. Verdict: CONFIRMED.

### DOC-42 - link "Main.hx#L77 ... URL /home"
- Code: the group read is now at `camap-hx/src/controller/Main.hx:79` (`doHome` starts `:66`); line 77 is the closing `}` of the `if (app.user == null)` block.
- Refs: 03#D8. Verdict: CONFIRMED.

---

## `camap-ts/docs/groups.md`

### DOC-43 - `regOption` values
- Code: enum has 4 values Closed, WaitingList, Open, Full (`camap-hx/src/db/Group.hx:26-31`); `disabled` values (BLOCKED_BY_ADMIN, MOVED, SUSPENDED, `Group.hx:33-38`) not listed.
- Refs: 03#D9. Verdict: CONFIRMED.

### DOC-44 - rights "cumulables"
- Code: superadmin has every right implicitly (`camap-hx/src/db/UserGroup.hx:151-153`; `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:95,166`); undocumented HX "auto rights" `ContractAdmin(cid)` for claimed-vendor catalogs (`UserGroup.hx:72-84`); right `params` semantics: `null` = all catalogs (the example JSON `["8"]` for one catalog is correct).
- Refs: 03#D10. Verdict: CONFIRMED.

### DOC-45 - undocumented group features
- Code: not documented: group creation (HX, superadmin only), waiting list (`WaitingList` table, HX register / TS approve), invitations, quit-group rules, `Group.disabled` behaviour, HX-only rights editor `/amapadmin/editRight`. Draft 05 adds: cycles generation rules, waiting-list approval living in TS, attendance sheets, `daysBeforeDutyPeriodsOpen` and mail settings (group fields), volunteer calendar REST contract are not documented in any doc.
- Refs: 03#D11, 05#6.6. Verdict: CONFIRMED.

---

## `camap-ts/docs/membership.md`

### DOC-46 - file names and "front et back codés en TS"
- Code: files are `memberships.resolver.ts` / `memberships.service.ts` (`camap-ts/packages/api-core/src/groups/resolvers/`, `camap-ts/packages/api-core/src/groups/services/`), not `membership.*`. The settings form (`hasMembership`, fee, renewal date) is HX (`camap-hx/src/controller/AmapAdmin.hx:39-72`) and the dialog is launched from HX templates (`camap-hx/lang/master/tpl/member/view.mtt:213`).
- Refs: 03#D12. Verdict: CONFIRMED.

### DOC-47 - `Group.membershipFee` "optionnel"
- Code: creation fails if neither the request nor the group defines a fee, and `0` is treated as undefined (`camap-ts/packages/api-core/src/groups/services/memberships.service.ts:105-112`); tinyint column limits fee to 127 (`camap-ts/packages/api-core/src/groups/entities/group.entity.ts:57-58`).
- Refs: 03#D13. Verdict: CONFIRMED.

### DOC-48 - omitted behaviours
- Code: a membership creates both a debt and a cash payment operation (`memberships.service.ts:117-139`); membership protects users from inactive purge (`camap-ts/packages/api-core/src/users/users.service.ts:478-486`); year/period naming rule (`memberships.service.ts:217-253`); `hasMembership` is not consulted by `hasValidMembership` (`:198-212`).
- Refs: 03#D14. Verdict: CONFIRMED.

---

## `camap-ts/docs/contracts.md`

### DOC-49 - absences range written `absencesStartDate` twice
- Doc: `contracts.md:45` (and :41/:45 per draft 05) names `absencesStartDate` twice.
- Code: second should be `absencesEndDate` (`camap-hx/src/db/Catalog.hx:50-51`).
- Refs: 04#D1, 05#6.4, 06#D7. Verdict: CONFIRMED.

### DOC-50 - `percentageValue` / `percentageName` "ne servent plus"
- Doc: `contracts.md:27`.
- Code: TS still applies them to product price (`camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:100-112`, `.../services/catalogs.service.ts:146-153`) whereas Haxe disables them (`camap-hx/src/db/Catalog.hx:128-131`).
- Refs: 04#D2. Verdict: CONFIRMED.

### DOC-51 - catalog types and creation fields
- Doc: `contracts.md:12` (verifier-corrected from :15) mentions only two catalog types; `orderStartDaysBeforeDistrib/EndHours` described as entered "a la creation".
- Code: omits flags, stock, min-orders, absences, notifications, documents; constant catalogs hide start days (`camap-hx/src/service/CatalogService.hx:51`).
- Refs: 04#D3. Verdict: CONFIRMED.

### DOC-52 - absences titled "(contrats variables)"
- Doc: `contracts.md:41`.
- Code: absence management applies to CONST catalogs and to VAR catalogs only when `distribMinOrdersTotal > 0` (`camap-hx/src/db/Catalog.hx:143-152`).
- Refs: 05#6.4, 06#D8. Verdict: CONFIRMED.

### DOC-53 - field names
- Doc: `contracts.md` says `MultiDistrib.ordersStartDate` / `ordersEndDate`; `Catalog.userId`.
- Code: real fields `orderStartDate` / `orderEndDate` (`camap-hx/src/db/MultiDistrib.hx:23-24`); relation is named `contact` (column `userId`, `camap-hx/src/db/Catalog.hx:25`).
- Refs: 06#D7. Verdict: CONFIRMED.

### DOC-54 - per-catalog window customisation "Si ces champs sont definis"
- Code: requires non-null and non-zero (`camap-hx/src/service/DistributionService.hx:299,303`).
- Refs: 06#D9. Verdict: CONFIRMED.

### DOC-55 - features not covered by contracts/products docs
- Code: vendor claiming, disabled reasons, VAT-rate group setting, places, geocoding are not covered (`conf.md:37,80` mentions Mapbox tokens only). Also none of `orders.md`, `subscriptions.md`, `contracts.md` documents subscription deletion guards (past orders / payment operations), the minimum-order formula and `floor` proration (partially documented at `subscriptions.md:44-46`), stock behaviour, absence of server-side window enforcement, balance transfers, or that renewal does not exist.
- Refs: 04#D10, 06#D11. Verdict: PLAUSIBLE for 04#D10 (scope of "no doc covers them" grep-checked only); CONFIRMED for 06#D11.

---

## `camap-ts/docs/products.md`

### DOC-56 - units list
- Doc: `products.md:38` lists only Litres / unites / Kg.
- Code: 6 units (`camap-hx/common/Common.hx:90-97`).
- Refs: 04#D4. Verdict: CONFIRMED.

### DOC-57 - stock and other fields omitted
- Code: `stockTracking`, `stockTrackingPerDistrib`, `stock`, `active`, `image`, `desc` and `ProductDistributionStock` are not mentioned (grep of `products.md`).
- Refs: 04#D5. Verdict: CONFIRMED.

### DOC-58 - multiWeight "only with variablePrice"
- Doc: `products.md:46`.
- Code: Haxe allows it alone (`camap-hx/src/db/Product.hx:285-289`) and forbids bulk+multiWeight (`camap-hx/src/service/ProductService.hx:202-203`).
- Refs: 04#D6. Verdict: CONFIRMED.

### DOC-59 - bulk / variablePrice for all catalogs
- Doc: `products.md:44` (variablePrice) and `:48` (bulk).
- Code: both hidden for constant catalogs (`camap-hx/src/service/ProductService.hx:105-108`).
- Refs: 04#D7. Verdict: CONFIRMED.

---

## `camap-ts/docs/files.md`

### DOC-60 - "most mechanisms ported to TS module files"
- Doc: `files.md:19` (Sugoi serving mechanism at `:9`, cron at `:17`).
- Code: TS has create/delete/getUrl plus findOne/findByIds/findOneAndConvertToFile/findImagesName/getExtension/makeSign (`camap-ts/packages/api-core/src/files/file.service.ts:26-60`); no `/file/<hash>` route, no unused-file cron; `file.controller.ts` exposes only super-admin utilities.
- Refs: 04#D8. Verdict: CONFIRMED.

### DOC-61 - EntityFile, documents, media, visibility
- Code: `files.md` (19 lines) never mentions EntityFile, documents (PDF 10 MB), media (5 images), or visibility rules.
- Refs: 04#D9. Verdict: CONFIRMED.

---

## `camap-ts/docs/distributions.md`, `volunteers.md`, `messages.md`

### DOC-62 - MultiDistrib dates
- Doc: `distributions.md:11,17` says `MultiDistrib` carries order opening/closing dates.
- Code: true, but the doc does not mention the Paris<->UTC conversions in entities, `quantities`, nor `volunteerRolesIds` (documented only in `volunteers.md:9-11`).
- Refs: 05#6.2. Verdict: CONFIRMED.

### DOC-63 - `Distribution.date/end` "could be removed"
- Doc: `distributions.md:15` (verifier-corrected from :13).
- Code: still read everywhere (`camap-hx/src/service/AbsencesService.hx:17`, `camap-hx/src/controller/Cron.hx:468`, TS `camap-ts/packages/api-core/src/shop/services/distributions.service.ts:46-64`).
- Refs: 05#6.3. Verdict: CONFIRMED.

### DOC-64 - volunteers backend controller name
- Doc: `volunteers.md:21` (verifier-corrected from :25) says `controller/api/Distribution`.
- Code: file is `camap-hx/src/controller/api/Distributions.hx`; registration is an HX GET page (`camap-hx/src/controller/Distribution.hx:986-1002`); unsubscribe is an HX REST POST.
- Refs: 05#6.1. Verdict: CONFIRMED.

### DOC-65 - volunteer mails
- Doc: `volunteers.md` says mails are sent by crons `Volunteers instruction mail` / `Volunteers alerts`.
- Code: correct (`camap-hx/src/controller/Cron.hx:97,156`) but omits the third mail sent on self-unsubscribe (`camap-hx/src/service/VolunteerService.hx:140-160`, only if now > alertDate).
- Refs: 05#6.7. Verdict: CONFIRMED.

### DOC-66 - `messages.md` WaitingList structure and purge
- Doc: `messages.md:15` describes `WaitingList` as "structured like UserGroup"; says nothing about the 4-month purge or Reply-To / quit link; says Messages back is `messages.module.ts` (correct).
- Code: `WaitingList` also holds `date` and `message` (`camap-hx/src/db/WaitingList.hx:11-12`); purge `camap-ts/packages/api-core/src/messages/messages.service.ts:81` (line as given in draft 08).
- Refs: 05#6.5, 08#9.6. Verdict: CONFIRMED.

---

## `camap-ts/docs/orders.md` and `subscriptions.md`

### DOC-67 - `paid` and `feesRate` "ne servent plus"
- Doc: `orders.md`.
- Code: `paid` is still written/read (`camap-hx/src/service/OrderService.hx:183-187,227`; `canModify` refuses paid orders `camap-hx/src/db/UserOrder.hx:105-106`; OrderBox paid toggle `camap-hx/js/react/order/redux/components/Order.hx:177-184`); `feesRate` still read by `prepare` and by TS `computeUserOrderAmount` (`OrderService.hx:385-394`; `camap-ts/packages/camap-common/src/utils/index.ts:33-42`), though always 0 for new orders (`camap-hx/src/db/Catalog.hx:128-131`).
- Refs: 06#D1. Verdict: CONFIRMED.

### DOC-68 - "commandes gerees par OrderService en haxe"
- Code: true for writes, but `Basket` rows are created by `Basket.getOrCreate` (`camap-hx/src/db/Basket.hx:48-66`); basket `status` (OPEN/CONFIRMED/VALIDATED, +PAYMENT_PROCESSING in TS only) not documented.
- Refs: 06#D2. Verdict: CONFIRMED.

### DOC-69 - `Subscription.createRecurrentOrders()`
- Doc: `subscriptions.md:38`.
- Code: it is `SubscriptionService.createRecurrentOrders()` (`camap-hx/src/service/SubscriptionService.hx:899`, called at `:1006` and `AbsencesService.hx:147`); the entity has no such method.
- Refs: 06#D3. Verdict: CONFIRMED.

### DOC-70 - admin entry "Tout est en haxe"
- Doc: `subscriptions.md:30`.
- Code: admin entry also exists through the TS `batchOrder` module (`camap-hx/src/controller/ContractAdmin.hx:1102-1108`; `BatchOrder.module.tsx`) which uses the Haxe REST API with `adminMode`.
- Refs: 06#D4. Verdict: CONFIRMED.

### DOC-71 - member entry via REST, "adminMode"
- Code: accurate, but REST create always runs with `adminMode = true` (`camap-hx/src/controller/api/Subscription.hx:50`), so the "more flexible admin mode" flag does not separate member from admin on the API path.
- Refs: 06#D5. Verdict: CONFIRMED.

### DOC-72 - default-order cron for VAR catalogs
- Doc: `subscriptions.md` (`Cron.doHour()`, task 'Default automated orders for CSA variable contracts').
- Code: matches `camap-hx/src/controller/Cron.hx:227` but omits that it only handles distributions whose order end fell in the last hour, subscriptions with zero orders on that distribution (`Cron.hx:229-245`), and catalogs with `distribMinOrdersTotal > 0` (`Cron.hx:231-237`).
- Refs: 06#D6. Verdict: CONFIRMED.

### DOC-73 - subscriptions "ne peuvent pas se chevaucher"
- Doc: `subscriptions.md:21`.
- Code: overlap is checked per (user, catalog) only, not per vendor (`camap-hx/src/service/SubscriptionService.hx:420-466`).
- Refs: 06#D10. Verdict: CONFIRMED.

---

## `camap-ts/docs/payments.md` and `transactions.md`

### DOC-74 - `Order` operation type "Non utilise sur CAMAP"
- Doc: `payments.md:24` (verifier-corrected from :21).
- Code: hx actively creates VOrder operations (`camap-hx/src/service/PaymentService.hx:81-130`; `onOrderConfirm` `:175` calls `makeOrderOperation` `:229`; non-test callers `camap-hx/src/controller/Distribution.hx:1092,1138`). Hx enum `Operation.hx:6` is `VOrder`, TS enum `OperationType.ts:2` and `schema.gql:340-342` are `Order`.
- Refs: 07#1. Verdict: CONFIRMED.

### DOC-75 - Basket relation "not used"
- Doc: `payments.md:35` (corrected from :31).
- Code: hx sets `op.basket` on VOrder (`PaymentService.hx:121-122`) and requires it (`camap-hx/src/db/Operation.hx:160-161`).
- Refs: 07#2. Verdict: CONFIRMED.

### DOC-76 - `pending` no longer used
- Doc: `payments.md:33` (corrected from :29).
- Code: payments still created with `pending=true` (`PaymentService.hx:~49-50`, `camap-ts/packages/api-core/src/payments/services/payments.service.ts:193`), TS `makePaymentOperation` reuse logic depends on it (`:217,227`); the balance ignores it.
- Refs: 07#3. Verdict: CONFIRMED.

### DOC-77 - balance is the sum of "toutes ces operations"
- Doc: `payments.md:12` and `:14` (corrected from :25-26).
- Code: only operations linked to a subscription with `YEAR(startDate) > 2022` are summed (`PaymentService.hx:~350`, `payments.service.ts:~287`).
- Refs: 07#4. Verdict: CONFIRMED.

### DOC-78 - stale link "SubscriptionService.hx#L1003"
- Doc: `payments.md:51` (corrected from :49).
- Code: location is `createOrUpdateTotalOperation`, now at `camap-hx/src/service/SubscriptionService.hx:1059-1091`; it writes the SubscriptionTotal debt, not a payment.
- Refs: 07#5. Verdict: CONFIRMED.

### DOC-79 - `operation.entity.ts` link labelled `group.entity.ts`; Relation description
- Doc: `payments.md:45` (link label), `:39` (Relation links a payment to a debt).
- Code: subscription payment forms do not set `relation` (`camap-hx/src/controller/SubscriptionAdmin.hx:450-460`); only `Transaction.doInsertPayment` (`:61-70`, when 'unpaid' chosen), `makePaymentOperation` callers and TS memberships do.
- Refs: 07#6. Verdict: CONFIRMED.

### DOC-80 - duplicate transactions.md
- Doc: `camap-ts/docs/archives/api-core/transactions.md` and `camap-ts/packages/api-core/docs/transactions.md`.
- Code: byte-identical (`diff -q`).
- Refs: 07#7. Verdict: CONFIRMED.

### DOC-81 - `Transactional` must decorate resolver mutations
- Doc: `transactions.md:5-7` (also claims it must decorate `post`/`put`/`delete` controller methods).
- Code: payments resolver uses `@TransactionalMutation` (`camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:27,39`; `camap-ts/packages/api-core/src/common/decorators/transactional-mutation.decorator.ts:5-7`, composite `applyDecorators(Transactional(), Mutation(...))`), so the rule is satisfied but the decorator is not mentioned; api-core has no `@Post/@Put/@Delete` handler (only 11 `@Get`).
- Refs: 07#8, 11#D-4. Verdict: CONFIRMED.

### DOC-82 - empty "## Lock" section
- Doc: `transactions.md:9` (heading), draft 07 first cited :11.
- Code: `findOneById(id, lock)` implements `pessimistic_write` (`camap-ts/packages/api-core/src/payments/services/payments.service.ts:45-49`).
- Refs: 07#8, 11#D-4. Verdict: CONFIRMED.

### DOC-83 - sample `await decreaseStock(...)` not valid TS
- Doc: `transactions.md` sample uses `Promise.all([basket.map(...)])` (array of arrays, effectively not awaited) and an undefined `input`.
- Code: not compilable as written.
- Refs: 07#8, 11#D-4. Verdict: CONFIRMED.

### DOC-84 - missing coverage of exports and config
- Doc: no doc in `camap-ts/docs` or `api-core/docs` describes the CSV/XLSX exports, the payment-type per-group config, or the balance cut-off (grep for csv/xlsx returns no file).
- Refs: 07#9. Verdict: CONFIRMED.

---

## `camap-ts/docs/emails.md`, `templates.md`, `docs/tests/mail/`

### DOC-85 - table name `BufferedJsonEmail`
- Doc: `emails.md:11`.
- Code: table is `BufferedJsonMail` (`camap-hx/src/db/BufferedJsonMail.hx:10`, TS `@Entity('BufferedJsonMail')`).
- Refs: 08#9.1. Verdict: CONFIRMED.

### DOC-86 - cron "vide la pile" via camap-hx/src/SMTP
- Doc: `emails.md`.
- Code: HX no longer sends (`camap-hx/src/db/BufferedJsonMail.hx:77-123` commented). Doc does not mention NotificationMail digests, 99-recipient BCC chunking, retry limit 30.
- Refs: 08#9.5. Verdict: CONFIRMED.

### DOC-87 - `app.view.hDate` / `App.quickMail` examples
- Doc: `emails.md` examples.
- Code: `camap-hx/src/App.hx:371` `quickMail(to,subject,html,?group)`, `camap-hx/src/View.hx:186` `hDate(date)` match the examples.
- Refs: 08#9.9. Verdict: CONFIRMED (no divergence).

### DOC-88 - `templates.md` covers only Templo
- Code: Twing (TS) templates and the `mails/dist` build are not described; no doc for the `/mails/list` preview.
- Refs: 08#9.7. Verdict: CONFIRMED.

### DOC-89 - empty test doc
- Doc: `camap-ts/docs/tests/mail/330-2-multiples-coller.md` is empty (0 lines).
- Refs: 08#9.8. Verdict: CONFIRMED.

### DOC-90 - templates compile directory
- Doc: `camap-ts/docs/templates.md` says templates compile to `lang/fr/tmp`.
- Code: the Dockerfile comment says "lang/master/tpl -> lang/master/tmp" (`camap-hx/camap-hx.Dockerfile:87`) but the command writes in `lang/fr/tmp` (`:88-90`); the doc is right, the Dockerfile comment is wrong.
- Refs: 09#D11. Verdict: CONFIRMED.

---

## `camap-ts/docs/neo-modules.md`

### DOC-91 - `createNeoModule` procedure
- Doc: shows `createNeoModule` with `if (moduleName === 'myModule')` and `React.lazy` constants.
- Code: uses a `modules` record with `wrapper`/`props` (`camap-ts/packages/front-core/src/neo.tsx:42-195`).
- Refs: 09#D1. Verdict: CONFIRMED.

### DOC-92 - "three bundles (runtime, vendor, neo)"
- Code: Haxe loads `/env.js` + runtime, vendors, reactlibs, neo, app (`camap-hx/src/service/BridgeService.hx:44-63`); `env.js` is required by `set-public-path`/`runtimeCfg`.
- Refs: 09#D2. Verdict: CONFIRMED.

### DOC-93 - build commands
- Doc: `npm run build:neo` from front-core; `npm run build:front` from root.
- Code: front-core has only `build` (`camap-ts/packages/front-core/package.json:6`); root has `build:front` (`camap-ts/package.json:14`).
- Refs: 09#D3. Verdict: CONFIRMED.

### DOC-94 - `debug/neo.mtt` test route
- Doc: template `debug/neo.mtt` on route `/debug/neo`.
- Code: no `debug` template directory in `camap-hx/lang/master/tpl` and no `debug` route in `camap-hx/src/controller`.
- Refs: 09#D4. Verdict: CONFIRMED.

### DOC-95 - manifest example
- Doc: `http://localhost:3010/neostatic/...` with numbered chunk entries.
- Code: manifest also contains `reactlibs.js` and `app.js` keys (`camap-ts/packages/front-core/webpack.config.js:118-125`, `BridgeService.hx:49`).
- Refs: 09#D5. Verdict: CONFIRMED.

### DOC-96 - Storybook link
- Doc: `./storybook.md`.
- Code: `camap-ts/docs` has no `storybook.md`.
- Refs: 09#D6. Verdict: CONFIRMED.

### DOC-97 - snippet uses `<div>` + `<script>`
- Code: real helper is the `$$neoModule` macro (`camap-hx/lang/master/tpl/macros.mtt:3-9`), not mentioned.
- Refs: 09#D7. Verdict: CONFIRMED.

---

## `camap-ts/docs/i18n.md`, `theme.md`, archives

### DOC-98 - i18n extraction command
- Doc: `i18n.md`: "cd backend && haxe build.hxml -D i18n_parsing".
- Code: dedicated `camap-hx/backend/potGeneration.hxml` and `npm run i18n:extract` (`camap-hx/backend/package.json:18`).
- Refs: 09#D8. Verdict: CONFIRMED.

### DOC-99 - po -> mo workflow
- Doc: `i18n.md`: gettext po -> mo "when saving" with PoEdit/Weblate; no mention of `i18n.js` tooling.
- Code: `camap-hx/backend/i18n.js` (`diff`, `update`, `compile`) exists; Dockerfile uses `msgfmt` (`camap-hx.Dockerfile:93-95`).
- Refs: 09#D9. Verdict: CONFIRMED.

### DOC-100 - "langs=fr,en"
- Doc: `i18n.md`.
- Code: only `fr` has `.po` and templates (`camap-hx/config.xml.dist:3`, `camap-hx/www/lang`); separator is `;` (see DOC-14).
- Refs: 09#D10. Verdict: CONFIRMED.

### DOC-101 - logo path in theme.md
- Doc: `theme.md`: logo loaded from `/theme/$themeId/logo`.
- Code: templates use `/theme/::theme.id::/logo3.png` (`camap-hx/lang/master/tpl/design.mtt:17`, `camap-hx/lang/master/tpl/login.mtt:7`), `logo2.png` (`camap-hx/lang/master/tpl/layout-camap.mtt:50`); default theme logos are fixed `/theme/default/logo*.png` (`camap-hx/src/App.hx:66,101-114`); no extensionless route.
- Refs: 09#D12. Verdict: CONFIRMED.

### DOC-102 - GitHub links to Common.hx / App.hx
- Doc: `theme.md`: "Common.hx#L278", "App.hx#L63".
- Code: now `camap-hx/common/Common.hx:317`, `camap-hx/src/App.hx:60`.
- Refs: 09#D13. Verdict: CONFIRMED.

### DOC-103 - theme.md omissions
- Code: omits the `css` variable subfolder (`/css/<css>/` in `camap-hx/lang/master/tpl/base.mtt:31`) and the React-side `THEME_ID` / palette mechanism; themes `default` and `camap_old` exist (`camap-hx/www/theme`).
- Refs: 09#D14. Verdict: CONFIRMED.

### DOC-104 - duplicate translations doc
- Doc: `camap-ts/docs/archives/front-core/translations.md` ("La kook") duplicates the TS section of `i18n.md` (typo "kook").
- Refs: 09#D17. Verdict: CONFIRMED.

---

## `camap-ts/docs/readme.md`, `tests.md`, archives, api-core docs and misc

### DOC-105 - `readme.md` index (see also DOC-106)
- Doc: `camap-ts/docs/readme.md:1-10` lists neo-modules, error-handling, dataset, backend docs only.
- Code: i18n, theme, templates are not linked.
- Refs: 09#D18. Verdict: CONFIRMED.

### DOC-106 - broken links in `readme.md`
- Doc: `readme.md:12,13` link to `../packages/api-core/docs/tests.md` and `schema.md`; `:4` (verifier-corrected from :5) links `./error-handling.md`; `:16` links `../packages/front-core/docs/translations.md`.
- Code: `camap-ts/packages/api-core/docs` contains only `dataloader.md`, `transactions.md`, `utils.md`; `error-handling.md` exists only at `camap-ts/docs/archives/error-handling.md`; `translations.md` only at `camap-ts/docs/archives/front-core/translations.md`.
- Refs: 10#9.1. Verdict: CONFIRMED.

### DOC-107 - `tests.md` npm scripts "from root"
- Doc: `camap-ts/docs/tests.md:5-9` documents `npm run test`, `test:e2e`, `test:cov` from root.
- Code: root `camap-ts/package.json:7-27` has no such scripts (they exist in `camap-ts/packages/api-core/package.json:27-32`); front-core (`package.json:12`) and camap-common (`:10`) have their own `test`.
- Refs: 10#9.2. Verdict: CONFIRMED.

### DOC-108 - `tests.md` scope and Haxe tests "obsolete"
- Doc: `tests.md:3` says tests are Jest unit or e2e, Haxe tests obsolete.
- Code: omits front-core Jest component specs and Storybook; `camap-hx/src/test` still holds 27 test methods (draft said 26; verifier recount: 27), not wired in any hxml/Dockerfile.
- Refs: 10#9.3. Verdict: CONFIRMED.

### DOC-109 - `archives/error-handling.md` example
- Doc: `camap-ts/docs/archives/error-handling.md:103` uses `TestErrorType.DoSomethingError` vs enum member `DoSomething` (`:66`); `useDoSomethingMutation` called inside `go` at `:156`.
- Code: `MutationFail` / `CamapError` exist (`camap-ts/packages/api-core/src/common/decorators/mutation-fail.decorator.ts`, `camap-ts/packages/api-core/src/common/errors/camap.error.ts`); the example is a sketch, not runnable.
- Refs: 10#9.7. Verdict: CONFIRMED.

### DOC-110 - `api-core/docs/dataloader.md` loader name
- Doc: `camap-ts/packages/api-core/docs/dataloader.md:12-35` names `GroupLoader` in `group.loader.ts`.
- Code: class is `GroupsLoader` in `camap-ts/packages/api-core/src/groups/loaders/groups.loader.ts:8`; `AppModule` registers `DataLoaderInterceptor` as `APP_INTERCEPTOR` (`camap-ts/packages/api-core/src/app.module.ts:72-75`), matching the doc's step 2bis.
- Refs: 11#D-5. Verdict: CONFIRMED.

### DOC-111 - `api-core/docs/utils.md` coverage
- Doc: `camap-ts/packages/api-core/docs/utils.md` documents only `checkDeleted` (`camap-ts/packages/api-core/src/common/utils.ts:7`).
- Code: `common/` also holds `dataloader.ts`, `haxeCompat.ts`, `image.ts`, `constants.ts`, decorators (`current-user`, `maybe-current-user`, `is-admin`, `user-ip`, `mutation-fail`, `transactional-mutation`, `dataloder.decorator`) and guards not covered.
- Refs: 11#D-7. Verdict: CONFIRMED.

### DOC-112 - camap-common `email.ts` / `header.ts` undocumented
- Doc: no doc mentions them.
- Code: `camap-ts/packages/camap-common/src/email.ts:1-13` (`CONTAINS_EMAIL_REGEX`, `isEmail`, `containsEmail`): `isEmail` used only by `camap-ts/packages/front-core/src/modules/messages/components/MessageRecipientsSelect.tsx:527,547`; `containsEmail` and the regex have no caller in `api-core/src` or `front-core/src`. `camap-ts/packages/camap-common/src/header.ts:1` `URL_CUSTOM_HEADER = 'X-CAVEA-URL'` added by the Apollo client (`camap-ts/packages/front-core/src/lib/initApollo.tsx:33-40`) and allowed in CORS (`camap-ts/packages/api-core/src/main.ts:37-45`), but no server code reads it.
- Refs: 11#D-6. Verdict: CONFIRMED.

### DOC-113 - typo in source file name (not a doc)
- `camap-ts/packages/api-core/src/common/decorators/dataloder.decorator.ts` (missing "a"); harmless, searchable.
- Refs: 11#D-8. Verdict: CONFIRMED.

---

## Notes on draft 11 items about the draft documents themselves

Draft 11 items D-1 to D-3 concern the coverage-critic draft (`99-coverage-critic.md`), not the existing repository docs, so they are not DOC entries: the critic's "Uncovered TS handlers" list was matched by method name only (the handlers are documented in `04-catalogs-products-vendors.md:88`, `08-messaging-crons.md:94-95,98`, `10-integration-tests.md:153-155`); the critic's decorator count "87 of ~169" versus the real 181 (+ `@TransactionalMutation`); the critic's claim that `Install.doDiagnostics` "checks .htaccess" (code only prints a message when missing, `camap-hx/src/controller/Install.hx:114-116`). All CONFIRMED by draft 11.

---

## Appendix: Refuted during verification

| Draft ref | Claim | Why refuted |
|---|---|---|
| 01#8.4 (sub-claim) | "no HX code reads `camap_api`" | `camap-hx/src/View.hx:278` reads `App.config.get("camap_api") + "/graphql"`; also set in `config.xml:16`. (The rest of item 8.4 stays CONFIRMED, DOC-15.) |
| 10#9.6 (sub-claim, PARTIALLY REFUTED) | `genTransactionIslet` documented as a library helper that does not exist | It is a user-defined example function in the doc (`camap-ts/docs/archives/dataset.md:73-75`); the `dafault.islet.ts` typo and the two divergent dataset docs remain CONFIRMED (DOC-33). |
| 08#9.9 | `app.view.hDate` / `App.quickMail` examples not re-verified | Resolved: examples match code (DOC-87), no inconsistency. |
| 10#9.9 | parcel-bundler claim "not verified" | Resolved: README matches `camap-ts/packages/browser-detect/package.json:7-8` (DOC-13). |

No item in drafts 01 to 11 was tagged fully `[REFUTED]` in the Documentation sections beyond the sub-claims above.
