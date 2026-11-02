# 06 - Existing tests

Scope: the automated tests and test tooling present in the repository today: the camap-hx utest suite, the camap-ts Jest unit/e2e specs and Storybook, frameworks and configuration, whether each suite is runnable as configured, the test fixtures/dataset generators, and CI. Paths are relative to the `camap-docker` repo root. "unverified" marks claims not confirmed from code.

Sources: draft 10 (part B: sections 6, 7, 8).

See inconsistencies-code.md / inconsistencies-documentation.md for discrepancies found in test documentation and test harness code.

## 1. Summary

- camap-hx has a utest suite (27 test methods in 7 classes, verifier-corrected; the draft body lists 26 by a manual count) with no build target or CI hook found.
- camap-ts has Jest unit specs (api-core, camap-common, front-core), api-core e2e specs (need MySQL), and Storybook stories.
- No CI workflow in either repo runs tests (they only build and push Docker images). No CI config exists at the `camap-docker` root.
- Not covered by automated tests on either side: HX `/api/*`, bridge controllers, GraphQL resolvers for users/vendors/messages/shop (only service-level specs exist), crons, REST hooks in front-core, HX controllers, mails, vendors/products pages, groups/membership UI.

## 2. camap-hx (utest)

### 2.1 Harness
- Entry point: `camap-hx/src/test/TestSuite.hx:15-30` (`main`) adds 7 cases to a utest `Runner` and reads the DB URL from `Sys.args()[0]` (`mysql://user:pass@host:port/db`, `:32-49`).
- Every test's `setup()` calls `TestSuite.initDB()`, which executes `DROP DATABASE tests; CREATE DATABASE tests; USE tests;` and recreates all tables (`:52-93`; the draft cites `:55-57` / `:56-58` for the DROP/CREATE lines) regardless of the database named in the connection string (`connectDb :32-49` uses the dbname from the CLI arg). Then `initDatas()` creates fixtures (`:151-~465`).
- The table list (`TestSuite.hx:59-91`) still contains removed tables `db.Category`, `db.CategoryGroup`, `db.ProductCategory` (`:61-63`) and omits `ProductDistributionStock`, `NotificationMail`, `Membership`, `WaitingList`, `Message`, `BufferedJsonMail`; `sys.db.TableCreate` is used here only (`:95-99`).
- No `.hxml`/script/CI invoking `test.TestSuite` was found in `camap-hx` (grep for `TestSuite` outside `src/test` returned nothing). `camap-hx/backend/build.hxml` only builds `-main App` to `www/index.n` (`:12-20`) and does not include `-lib utest`, although the lib is installed (`camap-hx/backend/haxe_libraries/utest.hxml:1`). `camap-ts/docs/tests.md:7` says the Haxe tests "sont tombés en désuétude". Runnable as-is: no (needs a custom `haxe` command and a MySQL with DROP rights; unverified).
- `camap-hx/Contributing.md:52` says "Testez votre modification avant de soumettre" without giving a command; `camap-hx/README.md` has no test instructions.

### 2.2 Test classes (27 methods per the verifier count)
| Class (file) | Test methods |
|---|---|
| `TestTools` (`camap-hx/src/test/TestTools.hx:10`) | `testDateRanges :13`, `testFloatTool :28`, `testStockDispatch :40`, `testListSynchronizer :56`, `testDateJSON :106`, `testMembership :118` |
| `TestUser` (`TestUser.hx:12`) | `testViewContract :28` |
| `TestOrders` (`TestOrders.hx:12`) | `testBasket :47`, `testStocks :81`, `testOrderEdit :127`, `testOrderWithMultiWeightProduct :191`, `testMakeOrderAndZeroQuantity :226`, `testDelete :250` |
| `TestDistributions` (`TestDistributions.hx:8`) | `testCreateCycle :100`, `testDelete :226`, `testUpdateAmapContractOperations :275`, `testCantCreateDistribOnSameDay :355` |
| `TestPayments` (`TestPayments.hx:11`) | `testValidateDistribution :24`, `testMakeOnTheSpotPaymentOperations :67` |
| `TestReports` (`TestReports.hx:12`) | `testOrdersByProduct :28` |
| `TestSubscriptions` (`TestSubscriptions.hx:16`) | `testDeleteSubscription :75`, `testCreateSubscription :142`, `testUpdateSubscription :292`, `testSubscriptionsOverlap :375`, `testDistributionShifting :425`, `testGetSubscriptionsExportData :501` |

The table lists 26 methods; the verifier's `grep "function test"` over `camap-hx/src/test` found 27 matches (one method not identified in the draft table). Covered: services layer (orders, distributions, subscriptions, payments/operations, reports, stock, date tools). Not covered: controllers, `/api/*`, bridge, cron, mails, vendors/products pages, groups/membership UI.

### 2.3 Fixtures
`TestSuite.initDatas()` creates users François/Seb/Julie, groups AMAP_DU_JARDIN/LOCAVORES, vendors, products, catalogs and distributions (`camap-hx/src/test/TestSuite.hx:115-149,151+`).

## 3. camap-ts

### 3.1 Frameworks and configuration
- api-core: Jest 27 + ts-jest (`camap-ts/packages/api-core/package.json:67,73`); unit config `camap-ts/packages/api-core/jest.config.js` (`rootDir: src`, `testRegex: .spec.ts$`, node); e2e config `camap-ts/packages/api-core/test/jest-e2e.json` (`.e2e-spec.ts$`, `testTimeout: 18000`, isolatedModules). Scripts: `test` = `TZ=UTC jest --forceExit`, `test:e2e` = `TZ=UTC jest --config ./test/jest-e2e.json -i --verbose --forceExit` (`camap-ts/packages/api-core/package.json:27-32`). `test:cov` omits `TZ=UTC` (`package.json:29` vs `:27`) and `collectCoverageFrom` is relative to `rootDir: src`.
- camap-common: Jest default regex, `rootDir: src`, node (`camap-ts/packages/camap-common/jest.config.js`); script `test` = `jest` (`camap-ts/packages/camap-common/package.json:10`).
- front-core: Jest 28 + babel-jest (`camap-ts/packages/front-core/package.json:42,125`), `@testing-library/react@10`, jest config `camap-ts/packages/front-core/jest.config.js` (rootDir `./`, `setupFilesAfterEnv: ['./test/setupTests.js']` at `:124`, babel transform); Storybook 8 (`front-core/package.json:11,93-97`); helpers in `camap-ts/packages/front-core/test/*` (`initI18n.ts`, `testUtils.ts`, `withTestI18nMocker.tsx`, `withTestMuiPickersPovider.tsx`). `front-core/test/` contains no `setupTests.js` (`find` returned nothing; no `jest` key in `package.json` overrides it), so Jest would fail at startup as configured and the front-core specs are likely not runnable (verified config/file mismatch).
- The root `camap-ts/package.json:7-27` has no `test` script (tests are per package); `camap-ts/docs/tests.md:5-9` documents `npm run test`, `test:e2e`, `test:cov` "from root".
- Environment: the api-core app reads `camap-ts/.env.test` when `NODE_ENV=test` (`camap-ts/packages/api-core/src/app.module.ts:26`, `camap-ts/ormconfig.js:8-14`): DB `test` on `localhost:3306` with `root/root`, `DB_SYNCHRONIZE=false` (`.env.test`, DB part). `.env.ci.test` contains only `DB_HOST=mysql`. `camap-ts/mysql/init-test-db.sql:1` creates the `test` DB. The e2e `timezones` spec and unit `timezones.spec.ts` assert UTC and need `TZ=UTC` from the script.

### 3.2 Spec inventory
Counts are `grep` of `it(`/`test(` at line start. No `.skip`/`xit`/`todo` found.

| File (under `camap-ts/packages/`) | Type | `it` cases | Runnable (from config) |
|---|---|---|---|
| `api-core/src/auth/auth.service.spec.ts` | unit | 13 | yes (mocked repos; 14 specs use `Test.createTestingModule`/`jest.mock` per grep) |
| `api-core/src/common/utils.spec.ts` | unit | 10 | yes |
| `api-core/src/users/users.service.spec.ts` | unit | 9 | yes |
| `api-core/src/payments/services/payments.service.spec.ts` | unit | 8 | yes |
| `api-core/src/groups/services/memberships.service.spec.ts` | unit | 7 | yes |
| `api-core/src/common/mailer/mailer.service.spec.ts` | unit | 6 | yes |
| `api-core/src/shop/services/multi-distrib.service.spec.ts` | unit | 5 | yes |
| `api-core/src/groups/services/user-groups.service.spec.ts` | unit | 1 | yes |
| `api-core/src/groups/resolvers/group-previews.resolver.spec.ts` | unit | 1 | yes |
| `api-core/src/places/resolvers/places.resolver.spec.ts`, `.../services/places.service.spec.ts` | unit | 1 + 1 | yes |
| `api-core/src/timezones.spec.ts` | unit | 1 | yes (asserts UTC; requires `TZ=UTC`) |
| `api-core/test/groups.e2e-spec.ts` | e2e | 10 (quit group x3, send invites x7) | needs MySQL `test` + `.env.test` |
| `api-core/test/multi-distrib.service.e2e-spec.ts` | e2e | 8 (create/update/delete multiDistrib) | same |
| `api-core/test/products.e2e-spec.ts` | e2e | 3 | same |
| `api-core/test/catalogs.e2e-spec.ts` | e2e | 2 | same |
| `api-core/test/catalogs.service.e2e-spec.ts` | e2e | 1 | same |
| `api-core/test/timezones.e2e-spec.ts` | e2e | 1 | yes (no DB use visible) |
| `camap-common/src/distributions/distribution.spec.ts` | unit | 5 | yes |
| `camap-common/src/products/format.spec.ts` | unit | 1 | yes |
| `camap-common/src/validators/loginSchema/loginSchema.spec.ts` | unit | 8 | yes |
| `front-core/src/components/utils/ISO31661Selector/ISO31661Selector.spec.tsx` | component | 12 | blocked (missing `setupTests.js`) |
| `front-core/src/components/utils/ConfirmDialog/ConfirmDialog.spec.tsx` | component | 6 | same |
| `front-core/src/components/utils/ConfirmDialog/withConfirmDialog.spec.tsx` | component | 3 | same |
| `front-core/src/components/utils/DialogTitleActions/DialogTitleActions.spec.tsx` | component | 4 | same |
| `front-core/src/components/utils/DialogTitleClosable/DialogTitleClosable.spec.tsx` | component | 3 | same |
| `front-core/src/components/utils/UploadButton/UploadButton.spec.tsx` | component | 1 | same |

(All six front-core spec paths checked with `find`, they are under `front-core/src/components/utils/`.)

Totals: api-core unit 63, api-core e2e 25, camap-common 14, front-core 29, i.e. 131 cases.

### 3.3 e2e harness
- `camap-ts/packages/api-core/test/utils.ts` boots `AppModule` via `@nestjs/testing`, signs JWT with `JwtService`, provides an Apollo-like client over supertest (`utils.ts:75-112`, `createApolloClient :116`), and uses generators from `dev/dataset-generator`.
- `cleanDB` runs `connection.synchronize(true)` (drops and recreates the schema, `utils.ts:57-60`) but is called only by `multi-distrib.service.e2e-spec.ts:33`; `initTestApp(resetDb)` never uses its `resetDb` parameter (`utils.ts:75`), and `groups.e2e-spec.ts:66` passes `false` with no effect; other specs rely on whatever state the DB has.
- Dataset generator `reset()` hardcodes the schema name `db.` in `TRUNCATE TABLE db.<table>` (`camap-ts/packages/api-core/src/dev/dataset-generator.ts:784`) while the test DB is named `test` (`.env.test:20`); whether `reset()` runs against the test DB was not checked.

### 3.4 Storybook
40+ `*.stories.tsx` under `camap-ts/packages/front-core/src` plus `front-core/stories/{CssDebug,Debug}.stories.tsx`; config in `front-core/.storybook/`. Many stories use the dataset server (`front-core/src/dev-tools/datasets.story.tsx`). Run via `npm run dev:story` (root `camap-ts/package.json:19`).

## 4. Fixtures and dataset

- Generators: `camap-ts/packages/api-core/src/dev/dataset-generator.ts` (822 lines) exports `datasetGenerators(app)` returning `admin, reset, genPlace, genGroup, genMultiDistrib, genBasket, genUser, genVendor, genCatalog, genProduct, genUserGroup, genDistribution, genUserOrder, genCsaSubscription, genOperation, genVolunteerRole` (`:719-822`). On init it recreates the `migrations` table content from `src/migrations`, saves base config variables (`tosVersion`, `platformTermsOfServiceVersion`) and ensures a super admin `admin@camap.tld` (`:716-770`). `genGroup` auto-adds the admin as UserGroup (`:795-799` area).
- Islets: only `camap-ts/packages/api-core/src/dev/islets/default.islet.ts` (a group "AMAP de <city>" with 50 users).
- CLI: `npm run dataset <islet> [-c] [--noFail]` runs compiled `dist/cli/dataset` and loads `dist/dev/islets/<name>.islet.js` (`camap-ts/packages/api-core/src/cli/dataset.ts:29-57`, `package.json:19`); `-c` calls `synchronize(true)` (wipes the whole schema, `cli/dataset.ts:9-13`). `dataset-server` (`cli/dataset-server.ts:23-77`): Express on 6007, `GET/POST /islets/:name`, caches JSON in `.dataset-cache/`.
- Front: `DatasetProvider`/`useDataset` in `camap-ts/packages/front-core/src/dev-tools/datasets.story.tsx`; with `loginAs` it calls HX `GET http://localhost/api/createSid` (only works when HX `DEBUG=true`, `camap-hx/src/controller/Api.hx:86`) to get a sid, stores cookie `sid`, then runs the GraphQL `login` mutation with the hard-coded password `admin` (`datasets.story.tsx:185-205`).
- HX fixtures: `TestSuite.initDatas()` (section 2.3).
- Documentation of this tooling: `camap-ts/docs/dataset.md` and `camap-ts/docs/archives/dataset.md` (divergent copies; the archived one references `dafault.islet.ts` (typo, `:157`) and documents `genTransactionIslet` as an example function defined in the doc itself, `:73-75`), `camap-ts/docs/tests.md`, `camap-ts/docs/archives/api-core/tests.md` (links `./dataset.md` and `../test/dataset/dataset.md`, the latter does not exist), `camap-ts/docs/archives/api-core/template-test-e2e.md` (uses `beforeEach_e2e`, `afterEach_e2e`, `createApolloClient(testHelper, USERS.francois)` and `./dataset` with `USERS`; actual helpers are `initTestApp`, `closeTestApp`, `createApolloClient({app, signUser}, user)`, `test/utils.ts:75,112,116`). `camap-ts/docs/readme.md` links `../packages/api-core/docs/tests.md` and `schema.md`, which do not exist.

## 5. CI

- Both repos have `.github/workflows` with five identically-shaped workflows each: `docker-publish.yml` (tag `vX.Y.Z`, verifies the tag is on `master`, pushes `ghcr.io/camap-app/camap-{hx,ts}`), `publish-feature.yml` (branches/tags `feature/**`, `feature-*`), `publish-fix.yml` (`fix-*`), `publish-mantis.yml` (`mantis-*`), `publish-staging.yml` (tags `staging-vN`, `staging-vN-rc*`), plus `workflow_dispatch`. Source: `camap-hx/.github/workflows/*.yml`, `camap-ts/.github/workflows/*.yml` (`on:` blocks).
- Steps: checkout, ref validation, buildx, GHCR login, `docker/build-push-action` with `camap-hx.Dockerfile` / `camap-ts.Dockerfile`. No job runs `jest`, `npm test`, Haxe tests or lint (grep of `jest`/`npm run` found none; "test" only matches "latest").
- No CI config at the `camap-docker` root (`.github` absent from the listing).
- Build pipelines and image tags are described in `01-architecture.md` section 5.5.
