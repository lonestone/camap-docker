# 09 - camap-ts upgrade inventory (roadblocks E1, E2)

Read-only inventory, made on 2026-11-06, of what the camap-ts upgrade touches: TypeORM 0.2 → 0.3, the replacement of `typeorm-transactional-cls-hooked`, NestJS 9 → 11 and the GraphQL stack, and the front-core libraries the port builds on. It replaces the rough figures of [ROADBLOCKS.md](../ROADBLOCKS.md) E1/E2 and gives the Phase 2 estimate of [MIGRATION-PLAN.md](../MIGRATION-PLAN.md).

Paths are relative to `camap-ts/packages/api-core/` unless they start with `camap-ts/`. Counts come from grep plus a small scanner over `src/` and `test/` (250 `.ts` files, about 17.3k lines without specs). The installed versions were read from `node_modules`.

## 1. Summary

| Area | Size | Estimate (person-days) |
|---|---|---|
| TypeORM 0.3: configuration, DataSource, CLI | 1 module config, 2 CLI scripts, 2 `Connection` users, 1 `getConnection()` | 1–1.5 |
| TypeORM 0.3: repository calls | 108 `findOne(id)`, 7 `findOne(conditions)`, 20 `find(conditions)`, 2 `count(conditions)`, 13 `findByIds`, plus a review of nullable ids | 3–4 |
| Transaction library → `@nestjs-cls/transactional` (P6) | 85 `@Transactional()` in 28 files, 5 `@TransactionalMutation`, 32 repository injections, 1 deep import of library internals, the `MutationFail` rollback, the deadlock interceptor, cron and queue jobs | 3.5–5 |
| Nest 9 → 11 and peers, GraphQL stack | about 15 `@nestjs/*` and peer packages; Express 5 under Nest 11; 2 dead dependencies to remove | 2–3 |
| Node 22, TypeScript 5, Jest 29 | api-core, camap-common, front-core | 1–1.5 |
| front-core libraries the new pages use | MUI 5 → current, date pickers out of alpha; bundle names and manifest kept (E3) | 3–5 |
| Verification | tsc, api-core unit and e2e tests, full characterisation suite (about 1.2 h per run) | 1–2 |
| **Total** | | **15–22** |

The [TS-FIXES-FIRST.md](../TS-FIXES-FIRST.md) fixes are estimated separately in the plan.

Two of the costs that ROADBLOCKS expected are lower than feared:
- **There is no custom repository** (`EntityRepository`, `getCustomRepository`: 0). Every repository is injected with `@InjectRepository` (32 injections in 26 files), and that API doesn't change in `@nestjs/typeorm` for TypeORM 0.3.
- **GraphQL already runs on Apollo Server 4.** `@nestjs/apollo` 12.2.2 is installed with `@apollo/server` 4.12.2. `apollo-server-express` and `apollo-server-core` 3.13 are declared in `package.json`, but nothing in `src/` imports them.

## 2. TypeORM 0.2.45 → 0.3

### 2.1 Configuration

| What | Today | 0.3 |
|---|---|---|
| Module | `TypeOrmModule.forRoot()` with no argument (`src/app.module.ts`). It reads `ormconfig.js` implicitly: `camap-ts/ormconfig.js` (env, naming strategy, entity glob), extended by `packages/api-core/ormconfig.js` (migrations, `migrationsTransactionMode: 'each'`). | 0.3 no longer loads `ormconfig` files. Pass the options explicitly (`forRootAsync` with `ConfigService`), and put them in one `data-source.ts` that both the app and the CLI import. `@nestjs/typeorm` 8.0.5 → the release that matches Nest 11. |
| CLI | `typeorm --config ormconfig.js` (scripts `typeorm`, `dbsync`, root `dev:typeorm:*`); `migration:generate -n <name>` | `typeorm -d dist/data-source.js`; `migration:generate <path>`. Update the 6 root scripts and the 4 api-core scripts (`typeorm`, `dbsync`, `typeorm:l`, `start:prod`). |
| CLI tools | `src/cli/dataset.ts` (`createConnection()`), `src/cli/sync-db.ts` (`getConnectionOptions()` + `createConnection()`) | `new DataSource(options).initialize()` |
| Injected `Connection` | `src/dev/dataset-generator.ts:720,779`, `test/utils.ts:58` | inject `DataSource` |
| Global helpers | `getConnection()` in `src/places/services/places.service.ts:41` (the only one) | inject `DataSource` or a repository |
| Naming strategy | `camap-ts/orm-naming-strategy.js` | Check the method signatures against the 0.3 `DefaultNamingStrategy` (some changed). Its output must stay identical, because the table and FK names are a shared contract with Haxe. |

Production starts the API with `node packages/api-core/dist/main.js` (`camap-ts/camap-ts.Dockerfile:65`), so migrations never run at boot. The `start:prod` script does run them, but production doesn't use it. Keep it that way until the baseline migration exists ([07-production-deployment.md](07-production-deployment.md) §6).

### 2.2 Repository calls

| Pattern | Call sites | Files | 0.3 form | Caught by `tsc`? |
|---|---|---|---|---|
| `findOne(id)` (scalar first argument) | 108 (9 of them with options as the 2nd argument) | 46 | `findOneBy({ id })`, or `findOne({ where: { id }, relations })` | yes: the signature changed |
| `findOne({ field: value })` (conditions without `where`) | 7: `auth/session.service.ts:16,20`, `groups/services/csa-subscriptions.service.ts:140`, `groups/services/waitingLists.service.ts:19`, `tools/permalink.service.ts:14`, `vendors/services/products.service.ts:27`, `dev/dataset-generator.ts:753` | 6 | `findOneBy({...})` | object literals: yes; variables: no |
| `find({ field: value })` (conditions without `where`) | 20, in `files/file.service.ts`, `groups/services/{csa-subscriptions,memberships,user-groups,volunteers}.service.ts`, `payments/services/orders.service.ts`, `shop/services/{distribution-cycles,distributions}.service.ts`, `vendors/services/catalogs.service.ts` | 10 | `findBy({...})` | object literals: yes; variables: no |
| `count({ field: value })` | 2: `groups/services/user-groups.service.ts:174`, `groups/services/waitingLists.service.ts:23` | 2 | `countBy({...})` | object literals: yes |
| `findByIds(ids)` | 13 repository calls (the other 14 hits are service wrappers with the same name) | 13 | `findBy({ id: In(ids) })` (`findByIds` is deprecated in 0.3) | no: deprecated, not removed |
| `find`/`findOne` with `where` options | 32 + 10 | — | unchanged; `relations` arrays still accepted | — |
| `createQueryBuilder` | 23 | 12 | unchanged in practice | — |
| `save` / `update` / `delete` | 45 / 40 / 40 | 18 / 19 / 24 | unchanged; empty criteria now throw | — |
| Raw `query()` | migrations and `dev/dataset-generator.ts` only | — | unchanged | — |

**The risk is in nullable ids, not in the renames.** A property set to `undefined` in a `where` object is ignored, so `findOneBy({ id: undefined })` returns the first row of the table. 0.2 had the same trap for `findOne(undefined)`, so some current code may already have it. Converting 108 call sites by hand is the moment to close it:
- add one helper (e.g. `findOneByIdOrFail(repo, id)`) that throws on a `null` or `undefined` id, and use it for every converted `findOne(id)` whose id comes from a client argument or a nullable column;
- turn `null` in `where` into `IsNull()` where null is really meant (8 candidate lines);
- set the DataSource option `invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' }`. It exists in 0.3.31, where it defaults to `ignore`; 1.x makes `throw` the default. Every remaining nullable filter then fails loudly in the suite instead of matching every row.

`tsc` lists most call sites to change, because the method signatures changed. Calls that pass a variable instead of an object literal are not caught: the scanner list above is the checklist for those.

### 2.3 Entities

- No relation uses `primary: true` (0.3 removed it). Ten columns use `@Column({ primary: true })` (`Session`, `Permalink`, `Cache`, `Variable`, `WaitingList`, `Membership`, `Volunteer`). 0.3 still accepts that; switching them to `@PrimaryColumn` is optional.
- No lazy relations, no `eager`, no `@RelationId`, no column transformers. Date conversion is done in the entities and services (UND-055), not by TypeORM.
- The primary-key column order differs from production on `Membership`, `UserGroup` and `WaitingList` ([07-production-deployment.md](07-production-deployment.md) §5). That doesn't matter for TypeORM 0.3, but it does matter for the baseline migration.

## 3. Transactions: `typeorm-transactional-cls-hooked` 0.1.21

That library doesn't support TypeORM 0.3, so it has to be replaced.

### 3.1 Where it is used

| Use | Count | Where |
|---|---|---|
| `import { Transactional }` | 31 files | resolvers and services |
| `@Transactional()` | 85 | 28 files. Most in `auth/auth.service.ts` (10), `payments/services/payments.service.ts` (8), `users/users.service.ts` (7), `vendors/services/vendor.service.ts` (6), `vendors/resolvers/vendors.resolver.ts` (5) |
| `@TransactionalMutation` (`Transactional()` + `Mutation()`) | 5 uses | `common/decorators/transactional-mutation.decorator.ts`; `payments/resolvers/operation.resolver.ts`, `users/users.resolver.ts` |
| Setup | 3 | `initializeTransactionalContext()` + `patchTypeORMRepositoryWithBaseRepository()` in `src/main.ts`, `src/cli/utils.ts`, `test/utils.ts` |
| Library internals | 1 | `common/utils.ts:18-24` `getCurrentTransaction()` deep-imports `typeorm-transactional-cls-hooked/dist/common` and the `cls-hooked` namespace |
| Rollback without throwing | 2 uses | `common/decorators/mutation-fail.decorator.ts` catches typed `CamapError`s, calls `getCurrentTransaction().rollbackTransaction()` and returns the error as data |

Of the 26 GraphQL mutations, 24 carry a resolver-level transaction. The other 2 (`auth.resolver.ts` `recordBadLogin` and `logout`) each call one transactional service method. Propagation is the default (`REQUIRED`): nested service calls join the resolver's transaction. That matches what Haxe gives implicitly (one transaction per request).

### 3.2 Replacement

**Decided (P6, user, 2026-11-07): `nestjs-cls` + `@nestjs-cls/transactional` with its TypeORM adapter, on TypeORM 0.3.** It is maintained: 4.0.2 and adapter 2.0.2 in October 2026, for TypeORM 0.3/1.x and Nest 10–12. `typeorm-transactional` has been unmaintained since October 2023. The rest of the stack (TypeORM 1.x, Nest 12) is upgraded later ([§7](#7-option-typeorm-1x-instead-of-03-p6-reopened-2026-11-07)); this library already supports both.

What the switch involves:
- **Setup.** `ClsModule.forRoot` with the `ClsPluginTransactional` plugin and the TypeORM adapter (DataSource token). It replaces `initializeTransactionalContext()` / `patchTypeORMRepositoryWithBaseRepository()` in `main.ts`, `cli/utils.ts` and `test/utils.ts`.
- **Decorators.** `@Transactional()` keeps its name: 31 import lines change, and `@TransactionalMutation` is rebuilt on the new decorator. Propagation stays `REQUIRED` by default.
- **Repositories.** The transaction client is an `EntityManager`, and repositories injected with `@InjectRepository` don't join it. Add one helper, `@InjectTxRepository(Entity)`, plus a provider factory, that returns a proxy to `txHost.tx.getRepository(Entity)`, resolved at each call. Swap it into the 32 injections (26 files) and their modules; the service code is unchanged. Without it, writes made through an injected repository would silently run outside the transaction. The suite and a unit test that rolls back a transaction catch that.
- **Jobs outside a request.** `@nestjs/schedule` jobs (crontab, mail queue flush, purges) have no request context: mark the ones that open a transaction with `@UseCls()`.

Also to rewrite:
- `getCurrentTransaction()` and `MutationFail`. Replace the manual rollback with a throw inside the transactional method, and convert the typed error to its data form outside the transaction (an interceptor or a wrapper around the resolver).
- **Failed-login counting (UND-008).** It needs a write that survives the rolled-back login transaction: use `Propagation.REQUIRES_NEW` (or `NOT_SUPPORTED`) from the new library. That is why UND-008 is done after this step.

### 3.3 Deadlock policy

`common/interceptors/dealock.interceptor.ts` is a global interceptor. On `ER_LOCK_DEADLOCK` it re-runs the whole handler, up to 5 times and with no delay. Once that budget is used up, it completes without a value instead of re-throwing the deadlock (**CODE-184**). It uses `retryWhen`, which is deprecated.

The port needs an explicit policy (ROADBLOCKS E1). The user asked (2026-11-07) for the policy one would choose from first principles, not the Haxe one or the current TS one. It replaces the interceptor:

1. **Retry the transaction, not the request.** On a deadlock, MySQL has already rolled back the whole transaction, so the transaction is the unit to run again. Retry only at the **outermost** transaction: a nested `@Transactional` that joined an outer transaction lets the error go up, because its part can't be restarted on its own. In practice this is one decorator (e.g. `@TransactionalWithRetry()`) on the resolver or controller method that opens the transaction. It refuses to run inside an active transaction.
2. **Retry only transient lock errors.**
   - `ER_LOCK_DEADLOCK` (1213).
   - `ER_LOCK_WAIT_TIMEOUT` (1205). By default InnoDB rolls back only the statement on 1205, so the wrapper rolls back the whole transaction before retrying.
   Nothing else is retried.
3. **Bounded, with backoff.** At most 3 attempts in total, with exponential backoff and full jitter (for example random 0–50 ms, then random 0–150 ms). The total time stays far below the 30 s ingress timeout.
4. **No side effect outside the database inside a retried unit.** An e-mail is queued as a `BufferedJsonMail` row in the same transaction, which is already the case, so a retry can't send it twice. External HTTP calls (geocoding, the Haxe cron trigger) and file-system writes happen after the commit.
5. **Clear failure.** After the last attempt, the caller gets a distinct transient error: GraphQL error code `TRANSIENT_CONFLICT`, or HTTP 503 with `Retry-After` for REST. The error is logged with the attempt count. It never completes empty (CODE-184).
6. **Fewer deadlocks in the first place.**
   - Keep transactions short: no external call or slow work inside.
   - Lock rows in a consistent order.
   - Use `SELECT … FOR UPDATE` on read-modify-write paths: balances, stock, operation reuse (TS-FIXES-FIRST item 35).

Pin the policy with unit tests that force 1213 and 1205: retried, then success; exhausted, then the transient error; nested, so no retry. Every mutation is one transaction today (§3.1), and ported mutations keep that rule.

## 4. NestJS 9 → 11, GraphQL, peers

| Package | Installed | Target / note |
|---|---|---|
| `@nestjs/core`, `common`, `platform-express`, `testing`, `cli`, `schematics` | 9.4.3 / ^9 | 11. Nest 11 runs on Express 5: route wildcards change syntax (no wildcard route in the 5 REST controllers today, so nothing to rewrite). It needs `reflect-metadata` 0.2 and a recent TypeScript. |
| `@nestjs/graphql`, `@nestjs/apollo` | 12.2.2 | The releases for Nest 11. Apollo Server 4 is itself announced end-of-life, so take the Apollo Server major that matches those releases (check at upgrade time). Config in `app.module.ts`: `playground` → Apollo landing page plugin; `uploads: false` and `cors: false` go. |
| `apollo-server-express`, `apollo-server-core` | 3.13.0 | **Remove**: not imported anywhere. |
| `graphql-upload` | 13.0.0 | **Remove** the middleware (`main.ts:27`): no resolver takes an upload (**CODE-185**). Versions 14+ are ESM-only, so keeping it would block the upgrade. |
| `@nestjs/typeorm` | 8.0.5 | the release for Nest 11 and TypeORM 0.3 |
| `@nestjs/schedule` | ^4 | the release for Nest 11. Crontab services keep their decorators. |
| `@nestjs/passport` / `passport` | ^10 / ^0.7 | the release for Nest 11 |
| `@nestjs/config`, `@nestjs/axios`, `@nestjs/jwt` | ^3, ^3, ^11 | the releases for Nest 11 (jwt is already current) |
| `helmet` | ^4 | current major (default import; the CSP options keep their meaning) |
| `class-validator`, `class-transformer` | 0.14 / 0.5 | unchanged |
| `mysql2` | ^2 | ^3 (TypeORM 0.3 supports both; take 3 with the upgrade) |
| `graphql` | 16.11 | unchanged |
| TypeScript | ^4.6 | 5.x, in all three packages |
| Jest / ts-jest | 27 | 29 |
| Node | 20.19.5 (`engines`, `volta`, Dockerfile) | 22 LTS |

**Safety net.** api-core has 12 unit spec files (63 tests) and 6 e2e files (25 tests). The characterisation suite (`camap-docker/tests`) runs the upgraded camap-ts behind Haxe and covers the GraphQL and REST surface much more widely. A full run on the upgraded stack, with only the expected deviations, is the acceptance test of Phase 2.

## 5. front-core

Installed: React 18.2, MUI 5.6 (`@mui/lab` alpha), `@mui/x-date-pickers` ^5.0.0-alpha.5, react-router-dom 6.4, react-query 3, `@apollo/client` 3.7, formik 2 + formik-mui alpha, i18next 19, webpack 5 with `webpack-manifest-plugin`, Storybook 8 on Vite.

Upgrade only what the new pages will be built on, before writing about 60–80 pages:
- **MUI 5 → current, and the date pickers out of alpha.** The pickers changed their API between the 5 alpha and the stable releases, so every date field is touched.
- **The router**, for the app shell (the shell decision is in [MIGRATION-PLAN.md](../MIGRATION-PLAN.md) §2).
- Leave react-query, formik and i18next where they are unless a ported page needs a newer one.

Constraint E3 stays: while Haxe hosts neo modules, the bundle names and the manifest that `BridgeService.hx` reads must not change. Check this with the hx target of the suite (every page loads its modules).

## 6. Order of work

1. Remove the dead dependencies (`apollo-server-*` 3, `graphql-upload`), Node 22, TypeScript 5. Green build.
2. Nest 11 and peers, GraphQL modules. Green unit, e2e and suite runs.
3. TypeORM 0.3, `@nestjs-cls/transactional` and the deadlock policy, together: the old library doesn't run on 0.3. Convert the call sites with `tsc` as the checklist, plus the scanner list of §2.2 and the nullable-id review.
4. front-core libraries.
5. Full characterisation run. Then the [TS-FIXES-FIRST.md](../TS-FIXES-FIRST.md) items start on the upgraded code.

## 7. Option: TypeORM 1.x instead of 0.3 (P6, reopened 2026-11-07)

> **Decided (user, 2026-11-07): stay on TypeORM 0.3 now and upgrade the stack later; use `@nestjs-cls/transactional`.** The facts below stay as input for that later upgrade. With nestjs-cls already in place, moving to 1.x later no longer means replacing the transaction library: what remains is §7.2, roughly 3–5 days with the codemod.

Checked on npm and in the packages on 2026-11-07:
- `typeorm` `latest` is **1.1.2**; 0.3 is tagged `legacy` (0.3.31).
- `typeorm-transactional` last published in October 2023 (0.5.0), and `typeorm-transactional-cls-hooked` in May 2022. Both are unmaintained.
- `@nestjs-cls/transactional` 4.0.2 and its TypeORM adapter 2.0.2 were published in October 2026. They support `typeorm ^0.3.2 || ^1.0.0` and Nest 10–12.
- `@nestjs/typeorm` 12.0.3 supports TypeORM 0.3 and 1.x.

### 7.1 Transactions in TypeORM 1.x

TypeORM 1.1.2 has the same explicit transactions as before: `dataSource.transaction(cb)` / `manager.transaction(cb)` and `QueryRunner`. It has no `@Transactional` decorator, no propagation and no request context: there is no `AsyncLocalStorage` in the package. To keep the decorator pattern of the 85 `@Transactional()`, a context library is still needed. The maintained one is `@nestjs-cls/transactional`:
- `@Transactional()` with propagation modes, including `REQUIRES_NEW` for UND-008;
- `TransactionHost` with `withTransaction()`, which is where the §3.3 retry goes.

Its transaction client is an `EntityManager`. Repositories injected with `@InjectRepository` don't join the transaction. The cheap fix is one small helper, e.g. `@InjectTxRepository(Entity)`: a provider that returns a proxy to `txHost.tx.getRepository(Entity)`, resolved at each call. Swapping the 32 injections (26 files) for it leaves the service code unchanged.

The other way, passing an `EntityManager` explicitly through every transactional method, would change the signature of every service called inside a transaction. That costs about 8–12 more days for no behavioural gain.

### 7.2 What 1.x changes for camap-ts, beyond 0.3

Source: [upgrading from 0.3](https://typeorm.io/docs/releases/1.0/upgrading-from-0.3) and the 1.1.2 typings.

| Change | camap-ts impact |
|---|---|
| `null`/`undefined` in `where` **throws by default** (`invalidWhereValuesBehavior`, find and write paths). Empty criteria on update/delete are rejected. | **The nullable-id risk of §2.2 is closed by default.** Call sites that pass an optional filter as `undefined` will throw: the suite finds them, and each one gets an explicit condition. This replaces the planned guard helper. |
| `findByIds`, `findOneById`, `Connection`, `ConnectionOptions`, `ConnectionManager` and the global helpers (`getConnection`, `createConnection`, `getConnectionOptions`, …) removed | The same call sites as §2.1–2.2. 0.3 only deprecated them; 1.x makes the conversion mandatory. |
| String-array `relations` / `select` removed → object syntax | 5 + 3 call sites (the official codemod rewrites them) |
| Column option `width` removed; `unsigned` removed on float/decimal | 14 `width: 1` on `tinyint`, 1 `unsigned` on a `float` (`ProductDistributionStock`). This only affects migration generation; check against the production structure. |
| No automatic `.env` / `TYPEORM_*` loading; `ConnectionOptionsReader.all()` → `get()` | None: the options are passed explicitly (§2.1) |
| `nullable: false` relations use INNER JOIN; cascade and `orphanedRowAction` changes | None: no relation is declared `nullable: false`, and there is no cascade |
| Default naming-strategy hashes changed for names with special characters | `CamapNamingStrategy` extends the default. Acceptance: generating a migration against the production structure gives no FK or index rename. |
| Node ≥ 20 (ES2023), `mysql2` ≥ 3.15.3, `@nestjs/typeorm` ≥ 11.0.1 | Already in the plan (Node 22, mysql2 3) |
| Official codemod `@typeorm/codemod v1` (import renames, API replacements, find option syntax, dependency bumps; `TODO` comments where manual) | It targets 0.3 code, so the 0.2 forms (`findOne(id)`) are still converted by hand with `tsc` as the checklist. |

### 7.3 Cost

| | 0.3 + `typeorm-transactional` | 1.x + `@nestjs-cls/transactional` |
|---|---|---|
| Config, DataSource, CLI | 1–1.5 | 1–1.5 |
| Repository calls | 3–4 (including the nullable-id guard) | 3–5 (undefined filters fixed where they throw; no guard needed) |
| Entities, naming check | — | 0.5–1 |
| Transactions (library, `MutationFail`, deadlock policy, test/CLI setup) | 2–3 | 3.5–5 (adds `ClsModule`, `@InjectTxRepository`, `@UseCls()` on cron and queue jobs that open transactions) |
| **ORM + transactions** | **6–8.5** | **8–12.5** |
| Later move to 1.x | 4–7: a second pass on the same files, and the unmaintained transaction library replaced anyway | — |

**Recommendation: TypeORM 1.x + `@nestjs-cls/transactional`.**
- It costs about 2–4 days more now and avoids a second ORM migration of 4–7 days.
- Every dependency stays maintained.
- The throw-on-`undefined` default removes the main data risk of the conversion.
- The 2A estimate goes from 13–20 to about 15–24 days.

**Linked point, Nest 11 or 12.** `@nestjs/core` `latest` is 12.4.0, and 11 is tagged `legacy`. Nest 12 is ESM (`"type": "module"`), and `@nestjs/graphql`/`@nestjs/apollo` 14 require it, with Apollo Server 5. Staying CommonJS means Nest 11. Nest 12 means moving api-core to ESM, or relying on Node 22's `require(esm)`. That deserves its own short check before 2A starts. `nestjs-cls` and `@nestjs/typeorm` support both.
