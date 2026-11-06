# CAMAP Haxe → TS migration: potential roadblocks

> Input for the planning step. Each item states **what** could block, the **evidence** in the code or
> docs, and its **impact**. Severity: 🔴 can stop or derail the migration · 🟠 costs weeks or forces a design
> decision · 🟡 local friction. The mitigation hints are pointers for planning, not decisions.
> Detail and citations are in [docs/](docs/README.md), especially `inconsistencies-code.md`.

## A. Coupling between the two apps

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| A1 | 🔴 | **Two writers on one database during the transition.** Haxe and TS both write the same tables. Their rules differ (rounding, balance, reuse of payment operations, nullability), so a half-migrated domain can corrupt data written by the other side. | Two `Operation` reuse rules: `PaymentService.hx:35-40` vs `payments.service.ts:211-229`. TS has no rounding hook like hx `Operation.check()`. `updatePaymentOperation` doesn't await its balance update. | Domains must be cut over **whole** (every writer of a table at once), not page by page. This limits how fine the strangler routing can be. |
| A2 | 🔴 | **Every page depends on Nest being up, and on the Haxe chrome.** `base.mtt` loads the neo bundles through BridgeService on each render. Navigation, layout and group context exist only in Haxe templates. | `docs/01-architecture.md` §page lifecycle; `base.mtt:118` | Pages can't move to TS one at a time until a TS app shell exists. The shell is on the critical path. |
| A3 | 🟠 | **Shared session and identity.** Haxe sugoi `Session` holds Haxe-serialized blobs. TS writes `Session.uid`. sid, Auth_sid and the JWT access/refresh cookies coexist. The cookie domain is set in `User.hx:84-88`. | `docs/03-features/users-auth.md`, `02-data-model.md` (Session) | Any change to the session format breaks the other app. Session handling must stay compatible until Haxe is switched off. |
| A4 | 🟠 | **Cross calls.** The TS front calls 25 Haxe `/api/*` routes for ordering, catalogs and volunteers. Haxe calls Nest `/bridge/*`. Nest triggers Haxe `/cron/*`. | `docs/05-cross-stack-integration.md` | Each one becomes a contract test and a switch-over step. The ordering UI (`csaCatalog`, `batchOrder`) can only move when the subscription and order write path moves. |
| A5 | 🟡 | **Neo modules depend on Haxe props.** The 26 modules are mounted with props serialized by Haxe (`$$neoModule`, `neoArgs`). Some Bool and array serialization is fragile. | `09-frontend…` C6; `neo.tsx:42-147` | Each module has to be re-hosted in the TS shell with its props fetched another way. |

## B. Hidden or undocumented behaviour

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| B1 | 🟠 | **Sugoi framework.** Sugoi is a CAMAP fork, pinned to commit `c3b8db8` (`camap-hx/backend/haxe_libraries/sugoi.hxml`) and only on disk in the lix cache. It provides sessions, `Variable`, `File` and `makeSign`, the mailer, templo macros, rights helpers, `BaseApp` dispatch and caching. None of it was in scope for the docs. | `docs/README.md` (limits); several PLAUSIBLE items depend on it | Behaviour that the tests will observe comes from code nobody has documented. Sugoi must be read before the auth, file and dispatch domains are ported. |
| B2 | 🟠 | **55 of 243 Haxe actions have no description**, and 82 api-core handlers are only mentioned by generic names. | `04-haxe-inventory.md` §12, `_drafts/11-gaps.md` | The user stories will be incomplete unless these are analysed first. Hidden admin or maintenance features may surface late. |
| B3 | 🟠 | **Implicit rules in templates.** `.mtt` templates hold logic: conditions, formatting, rights-based display, `macros.mtt`. Gettext strings are the only spec for a lot of the UI. | 116 templates. `lang/fr` is generated; `lang/master` is the source. | Porting templates→React will drop behaviour unless pages are snapshot or E2E tested before migration. |
| B4 | 🟡 | **No product owner spec.** The existing docs contradict the code in 113 places. | `inconsistencies-documentation.md` | Only the code tells the truth. Every disagreement needs a decision on whether it is a bug or a feature. |

## C. Data and schema

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| C1 | 🔴 | **No schema baseline.** Haxe never creates or migrates the schema. TypeORM has 12 migrations with no baseline. Dev uses `schema:sync`. The production schema can differ from the entities (e.g. `Vendor.companyNumber` is NOT NULL in a migration but nullable in the entity). | `02-data-model.md`; CODE entries on nullability | Tests run against a synced dev DB may not match production. A baseline from a production dump is a prerequisite. |
| C2 | 🟠 | **Legacy encodings.** Haxe `SFlags` bitfields are stored as integers, and TS is missing flags (GroupFlags drops ordinals 1, 2, 11, 12; CatalogFlags has 3 of 6). There are CSV and JSON text columns (`absentDistribIds`, `volunteerRolesIds`, `defaultOrders`, `allowedPaymentsType`). Enums are stored by index (`SEnum`), so their order matters. | `02-data-model.md` §5 | Wrong flag or enum mapping silently corrupts settings. Every flag and enum needs a mapping test. |
| C3 | 🟠 | **Time zones.** Haxe stores Paris wall-clock time (`TZ=Europe/Paris`). Four TS entities convert Paris↔UTC with date-fns-tz; the rest don't. The DST helper in `DateTool` stops at 2024. | `02-data-model.md` §5.3; `DateTool.hx:10-35` | Off-by-one-hour bugs around DST in order windows, cycles and crons. These are hard to see in tests unless dates are pinned. |
| C4 | 🟠 | **Floating-point money.** Prices, quantities and balances are floats, and the two sides round differently. `Transaction.hx:64` compares floats with `==`. | `07-payments…`, CODE entries | Isomorphic tests on amounts will flicker unless a rounding contract is defined first. |
| C5 | 🟡 | **Historic data quirks.** The balance only counts subscriptions where `YEAR(startDate) > 2022`. There are legacy `VOrder` operations and deprecated duplicate fields on `Distribution` (`date`, `end`, `place`). | `PaymentService.hx:350`, `payments.service.ts:287`, `Distribution.hx:18-21` | Production data contains shapes the new code must still read. Fixtures must include them. |

## D. Security vs "isomorphic"

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| D1 | 🔴 | **Copying behaviour copies the holes.** There are 34 security/rights findings, 17 rated High: `loginAs` impersonation, a password reset that doesn't check the token, a public `/cron/*`, unauthenticated `/api/subscription/:id`, missing ownership checks, and un-awaited guards. | `inconsistencies-code.md` (Security/rights) | "Same behaviour" can't apply to these. Each needs an explicit fix/keep decision, and tests have to assert the fixed behaviour. That makes the characterisation suite intentionally non-isomorphic in places. |
| D2 | 🟠 | **Some fixes may need to land before the migration.** Several High issues are exploitable in production today. | same | Pressure to patch the Haxe code we are about to delete. This needs deciding early (hotfix both sides, or accept the risk until the domain is ported). |
| D3 | 🟠 | **Password hashes.** Haxe md5(`key`+pass) is stored in `pass`, and TS bcrypt in `pass2`. A Haxe reset updates only `pass`, so the old bcrypt password keeps working. | `User.hx:274`, `auth.service.ts:324` | Users must migrate to a single hash without forcing a mass reset. `CAMAP_KEY` can't change until md5 is gone. |

## E. camap-ts stack upgrade

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| E1 | 🔴 | **TypeORM 0.2 → 0.3** is a breaking rewrite: DataSource instead of Connection, `find` options, `findOne(id)` removed, custom repositories removed. In api-core: 59 calls to `getRepository`/`getConnection`/`InjectRepository`, about 36 files with `findOne(id)`/`findByIds`, and 39 files on `typeorm-transactional-cls-hooked`, which doesn't support 0.3. | `api-core/package.json` (`typeorm ^0.2.45`) | This touches almost every service. The transaction library must be replaced, which changes the `@Transactional` pattern everywhere. It has to be done before porting. |
| E2 | 🟠 | **Apollo Server 3 is end-of-life**, `@nestjs/graphql` 12 is on Nest 9, and NestJS 9 → 11 brings peer dependency changes (`@nestjs/schedule`, passport, class-validator). | `01-architecture.md` versions table | A forced chain of upgrades. The GraphQL e2e tests (25) are the only safety net. |
| E3 | 🟡 | **Front-core**: React 18, MUI 5, webpack with a manifest that Haxe reads, and a hard-coded `fr` locale and `default` theme. Upgrading MUI or the build will break the Haxe-hosted bundles while Haxe still exists. | `09-frontend…` C8/C9; `BridgeService.hx:44-63` | The bundle names and manifest contract must stay stable during the transition. |

## F. Testing

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| F1 | 🔴 | **There is no reliable test harness today.** CI has no test job. The front-core Jest config requires a missing `setupTests.js`. The dataset generator hard-codes the `db.` schema. Haxe `TestSuite` drops a fixed `tests` DB and has no build target. | `06-existing-tests.md` | Phase 0 (tooling) blocks everything else. Characterisation tests can't be written without a resettable DB and fixtures. |
| F2 | 🟠 | **Characterisation against Haxe needs Haxe runnable in CI**: Haxe 4.0.5, lix, Neko, mod_neko Apache and templo compilation. | `01-architecture.md` build pipeline | The CI image will be heavy. Needs a docker-compose based test stack (MySQL + Neko + Nest). |
| F3 | 🟠 | **Test tooling has to span both apps.** Playwright E2E must run unchanged against Haxe pages and then against TS pages, while the URLs, DOM and texts change. | — | The tests need stable selectors and URL abstractions. Without that, E2E tests get rewritten at each cut-over and stop proving the port behaves the same. |
| F4 | 🟡 | **Non-determinism**: crons, the mail queue (every minute), `Math.random` in the manifest cache, dates and DST. | `BridgeService.hx:57-72`, `Cron.hx` | Tests need injectable clocks and synchronous mail capture (Mailpit exists in dev). |

## G. Infrastructure and operations

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| G1 | 🟠 | **Production is Kubernetes (`CAMAP-APP/minikube-camap`), not this repo.** This repo's root README says it is deprecated. The production routing (Nginx), secrets and cron wiring are not documented here. | root `README.md` | The strangler routing and cut-over must be designed on infrastructure we haven't read yet. |
| G2 | 🟠 | **Broken or drifting configs**: the prod and easy compose files point to Dockerfiles that aren't there and have no `config.xml`. The Apache proxy targets `nest-devcamap`, which exists only in dev. `HX_TRIGGER_CRONS=false` still triggers the crons. | `inconsistencies-code.md` (Config/build) | The local stack may not reflect production. Tests could pass locally and fail in the cluster. |
| G3 | 🟡 | **Files stored as DB blobs** (sugoi `File`) and served via Haxe `/file/*`, with a signature that depends on `key`. | `04-catalogs…`, `11-gaps` | The file URLs embedded in emails and pages must keep working after Haxe is gone. |

## H. Organisation and scope

| # | Sev | Roadblock | Evidence | Impact |
|---|---|---|---|---|
| H1 | 🟠 | **The orders/subscriptions domain is dense.** SubscriptionService and OrderService hold about 2,000 lines covering absences, minimum orders, stock clamps and balances. The rules disagree with each other (stock clamp differs between `make` and `edit`; absence lock uses `distribution.date` in one place and `orderEndDate` in another), and the order window isn't enforced server-side. | `06-orders…`, CODE entries | This is the riskiest domain. It needs product decisions on several rules, and could take a large share of the porting budget. |
| H2 | 🟠 | **Feature freeze.** Development keeps going on Haxe and TS (recent commits in both). Every Haxe change during the migration has to be ported twice. | git logs of both submodules | Needs a freeze or a "TS only" rule for new features. The `.cursor/rules/project.md` already says to prefer TS. |
| H3 | 🟡 | **French-only domain and UI.** The gettext `.po` strings need to become i18next. Translations and email wording are business-visible. | `09-frontend…` | A copy and translation review is needed, and visual-diff tests will flag every wording change. |
| H4 | 🟡 | **Dead or partial features**: no renewal feature, `/distribution/validate` with no handler, `confirmTmpBasket` that can't work, `Group.disabled` never set, unused entities and resolvers. | `inconsistencies-code.md` (Dead code) | Each needs a decision to drop or keep. Otherwise effort gets spent porting dead code. |

## Summary: critical path roadblocks (🔴)
1. **F1** No test harness → Phase 0 tooling first.
2. **C1** No schema baseline → baseline taken from a production dump.
3. **E1** TypeORM 0.3 + transaction library → upgrade before porting.
4. **A2** No TS app shell → build the shell before migrating any page.
5. **A1** Two writers on one DB → cut over whole domains, not pages.
6. **D1** Security holes vs "isomorphic" → a fix/keep decision per finding, made up front.

## Status updates
- **2026-11-02** The characterisation harness (`camap-docker/tests`) is in place; details are in [PROGRESS.md](PROGRESS.md).
  - **F1** lifted: the DB can be reset before every test, factories and fixtures exist, and a Playwright suite runs.
  - **F2** lifted: a docker-compose test stack (MySQL, Neko, Nest, Mailpit) runs locally. By decision there is no CI job: the suite runs locally before merging.
  - **F3** addressed: tests go through a `CamapApp` target interface (urls, api, pages). The hx driver is done, the ts driver is a stub that skips tests as not ported.
  - **F4** addressed: the hx clock is faked with libfaketime, crons are triggered by tests, and mail is read synchronously from `BufferedJsonMail`.
  - **C1** partly addressed: a TypeORM-synced baseline is committed for tests. The production-derived baseline is still needed.
  - **C2/C3** addressed for tests: the encodings are centralised and unit-tested.
  - **D1** mechanism in place: `deviation('UND-NNN')` makes a test an expected failure.
- **2026-11-06** **D2** decided. The 9 decided fixes that neither app implements were triaged: 7 are fixed in the current system before the migration ([TS-FIXES-FIRST.md](TS-FIXES-FIRST.md): UND-061, 062, 098, 110, 015/CODE-056, and the two messaging findings now recorded as UND-120 and UND-121); 2 are applied only at the port ([TS-ONLY-STEP.md](TS-ONLY-STEP.md) §1: UND-101, UND-088). All 7 pre-migration fixes are in camap-ts code that the port keeps.
- **2026-11-06** **H2** in effect (confirmed by the user): feature freeze on Haxe. No new feature goes into camap-hx; new work goes to TS only. Haxe changes are limited to the decided fixes that must touch it (see [TS-FIXES-FIRST.md](TS-FIXES-FIRST.md)).
- **2026-11-06** **G1** partly known (user): production serves Nest and hx on separate hostnames. The test stack now mirrors that for the Nest-only REST routes (published Nest port 3180). The rest of the production routing is still to read in `CAMAP-APP/minikube-camap`.
- **2026-11-06** **D2** follow-up: UND-106 (remove the email templates no flow sends) added to [TS-FIXES-FIRST.md](TS-FIXES-FIRST.md) (item 8), after its test became reachable.
- **2026-11-06** **G1** read: the `minikube-camap` Helm chart (a template with local values; production values are not in it). Two ingresses (web host → Apache/Neko, api host → Nest); Apache proxies `/graphql`, `/neostatic/`, `/locales/` in-cluster. The strangler router is the **web ingress** (path rules), and the TS front needs a backend on the web host. Points to check in production: `/bridge/*` and `/cron/*` are publicly routed, `FRONT_URL` is the internal API URL, the ingress read timeout is 30 s, MySQL runs without strict mode. Details: [docs/07-production-deployment.md](docs/07-production-deployment.md).
- **2026-11-06** **C1** mostly lifted: the DB provided on `:3306` has the production structure. It matches the test baseline except the primary-key column order of `Membership`, `UserGroup` and `WaitingList` (plus 3 extra `userId` indexes in test). Same MySQL version, `sql_mode`, time zone and collation. Its `migrations` table is empty, so the baseline migration must mark the 12 existing ones as applied rather than run them. Its data is a small sample, so the data-shape checks (C2, C3, C5) still need an anonymised production dump. Details: [docs/07-production-deployment.md](docs/07-production-deployment.md) §5–6.
- **2026-11-06** **B1** source available: the `sugoi/` submodule is at the commit camap-hx pins (`c3b8db8`): 94 Haxe files, about 8.7k lines. Not read yet.
- **2026-11-06** **B1** lifted: sugoi read, see [docs/08-sugoi.md](docs/08-sugoi.md). Nothing in it is ported as code. Only 10 points must be matched for data compatibility (§3: `CAMAP_KEY`, file URLs, the shared `Session` row and `sid` cookie while Haxe runs, `Variable`, enum/flag encodings, `Permalink`, the mail queue row, `Error` columns, existing rich text, reset links in flight). Everything else is reimplemented with Nest/React ([PORTING-RULES.md](PORTING-RULES.md)). **A3** narrowed: TS may touch only `uid`, `lastTime` and the row itself, never `sdata`/`messages`. **G3** settled: same signature and URL, Nest streams from the DB.
- **2026-11-06** **D2** sugoi read items: **CODE-177** (High: the `/file/*` 404 prints the valid signature), **CODE-178** (High: session fixation through `?sid=`) and CODE-179 (Medium: weak session ids, no cookie flags) are live in production. Decided: fixed at the port, not before ([TS-ONLY-STEP.md](TS-ONLY-STEP.md) §1). There is no slot for production patches before the migration, so only pre-migration work that helps the migration itself is planned.
- **2026-11-06** **D2** revised with the user: "before the migration" no longer means a production patch. Decided fixes in **camap-ts code that is kept** are done first, on the migration branch with the camap-ts upgrade ([TS-FIXES-FIRST.md](TS-FIXES-FIRST.md): the 8 earlier items, TS part only, plus UND-088 and UND-101 moved back from the port). Fixes in **Haxe or sugoi** are not made in the current system; the port doesn't copy the bug ([TS-ONLY-STEP.md](TS-ONLY-STEP.md)).
- **2026-11-06** **E1** measured ([docs/09-camap-ts-upgrade.md](docs/09-camap-ts-upgrade.md)). There is no custom repository. The conversion covers 108 `findOne(id)`, 29 calls with conditions but no `where`, 13 `findByIds`, the DataSource config and CLI, 1 `getConnection()`. The real risk is nullable ids (`undefined` in `where` matches every row). The transaction library: 85 `@Transactional()` in 28 files, replaced by `typeorm-transactional` (same API). The two pieces that use its internals (`getCurrentTransaction`, `MutationFail`) are rewritten. The deadlock interceptor gets an explicit policy (CODE-184). Estimate 13–20 person-days including front-core.
- **2026-11-06** **E2** smaller than expected: GraphQL already runs on Apollo Server 4 (`@nestjs/apollo` 12.2.2 + `@apollo/server` 4.12.2). `apollo-server-*` 3 and `graphql-upload` are unused and are removed (CODE-185). What remains is Nest 9 → 11 with its peers, Node 22 and TypeScript 5.
- **2026-11-06** Detailed plan written: [MIGRATION-PLAN.md](MIGRATION-PLAN.md).
  - **A2**: SPA served by Nest on the web hostname (decision P1). TS can't read the current group from the Neko-serialized session, so the shell needs a group bridge (decision P2).
  - **A1**: boundaries per domain (§5). The cron jobs move with their domain; that needs a per-job switch in Haxe (decision P3). Tables written by two domains are covered by decision P4.
  - **D2**: the other decided camap-ts fixes are sorted in [TS-FIXES-FIRST.md](TS-FIXES-FIRST.md) (items 11–39, plus a list of those that wait for the port).
- **2026-11-07** Decisions on the plan (user), recorded in [MIGRATION-PLAN.md](MIGRATION-PLAN.md) §8:
  - **Production switches to TS in one go** after every domain is ported. The mixed Haxe + TS state exists only on the test stack (`mixed` target behind a proxy).
  - **A1** is now a test-stack concern only: no two writers in production. Tables written by both sides with the same rules are accepted, since TS is aligned on Haxe before the port (P4).
  - **G1**: no per-domain ingress rules; at the switch the web hostname points to Nest.
  - **A2**: SPA served by Nest (P1).
  - **P2/P3**: the current-group cookie and the commented-out cron jobs are test-only Haxe patches, never deployed.
  - **E1**: deadlock policy set from first principles (P5, [docs/09-camap-ts-upgrade.md](docs/09-camap-ts-upgrade.md) §3.3).
  - New consequence: production stays frozen on the current code until the switch (about 10–15 months), and any urgent camap-ts fix has to be applied to the migration branch too.
- **2026-11-07** **E1/P6** decided: TypeORM 0.3 now (1.x and Nest 12 later), transactions with `@nestjs-cls/transactional` (maintained). `typeorm-transactional` is unmaintained since 2023. The nullable-id risk is closed by setting `invalidWhereValuesBehavior: throw` (available in 0.3.31). Upgrade estimate 15–22 days ([docs/09-camap-ts-upgrade.md](docs/09-camap-ts-upgrade.md) §3.2).
