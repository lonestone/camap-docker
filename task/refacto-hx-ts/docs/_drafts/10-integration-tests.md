# 10 - Integration hx <-> ts and test suites (state of the code today)

All paths are relative to `/Users/renaud/Lonestone/CAMAP/camap-docker`. Claims marked "unverified" were not confirmed from code.

## 1. Overview

- Two runtimes share one MySQL database. camap-hx (Neko/Apache, port 3009: `camap-hx/apache/camap-static.conf`-style vhost in `camap-hx/apache.conf:4`) serves the legacy pages and a REST JSON API under `/api/*`. camap-ts (NestJS `api-core`, port 3010) serves GraphQL `/graphql`, the React bundles under `/neostatic`, locales under `/locales`, and a small REST "bridge" under `/bridge/*`.
- Integration channels (all verified below):
  1. Browser -> hx `/api/*` REST (React bundles built by camap-ts call hx for subscriptions, catalog, volunteers; the older Haxe-compiled React `OrderBox` calls hx too).
  2. Browser -> Nest `/graphql` (proxied by Apache from the hx host, `camap-hx/apache/camap-static.conf:15-18`).
  3. hx -> Nest `GET {camap_bridge_api}/bridge/*` with `Authorization: Bearer <config key>` (`camap-hx/src/service/BridgeService.hx:77-111`).
  4. hx -> Nest `GET {camap_bridge_api}/neostatic/manifest.json` on every render until cached in the static var (`BridgeService.hx:12-21`).
  5. Nest -> hx `GET {CAMAP_LOCAL_HOST}/cron/{minute,hour,daily}` when `HX_TRIGGER_CRONS` is set (`camap-ts/packages/api-core/src/tools/crontab.service.ts:15-61`).
  6. Shared DB tables and shared cookies (`sid`, `Auth_sid`, `Authentication`, `Refresh`), see section 4.
- Tests: hx has a utest suite (27 test methods in 7 classes, verifier-corrected) with no build target or CI hook found; ts has Jest unit specs (api-core, camap-common, front-core), api-core e2e specs (need MySQL), and Storybook stories. No CI workflow in either repo runs tests (they only build and push Docker images).

## 2. HX API endpoint inventory

Router: `controller.Api` (`camap-hx/src/controller/Api.hx:12`) dispatches `/api/<name>/...` to sub-controllers. Haxe Dispatch maps `doXxx` to `/xxx`; typed arguments (`db.User`, `db.Catalog`, ...) are path segments (ids); `?args:{...}` are query-string params. Auth for `/api/*` is the hx session (cookie `sid`), nothing else; endpoints without `checkIsLogged()`/`@logged` do not enforce login themselves (unverified how sugoi treats `app.user == null` globally).

| URL | Method | Auth / rights | Payload -> response | Source | Callers found |
|---|---|---|---|---|---|
| `/api` | any | none | `{version, debug}` | `Api.hx:18-25` | none found |
| `/api/planning/:groupId` | any | none (no login check) | list of distributions in next 2 months with place | `Api.hx:52-71` | none found |
| `/api/createSid` | any | only if `config.DEBUG` else throws | creates session without user, `{sid}` | `Api.hx:84-96` | `camap-ts/packages/front-core/src/dev-tools/datasets.story.tsx:188` (hardcoded `http://localhost/api/createSid`) |
| `/api/order/catalogs/:multiDistribId?catalogType=` | GET | none (no check) | `{success, catalogs[{id,name,image}]}`, skips disabled vendors | `controller/api/Order.hx:12-30` | `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:120` |
| `/api/order/get/:userId?catalog=&multiDistrib=` | GET | `checkIsLogged` + `canManageContract`/`canManageAllContracts` | `{success, orders}` | `Order.hx:50-70` | `OrderBoxThunk.hx:21` |
| `/api/order/update/:userId?catalog=&multiDistrib=` | POST JSON `{orders:[{id,productId,qt,paid,invertSharedOrder,userId2}]}` | same as get | `{success, orders}` | `Order.hx:76-97` | `OrderBoxThunk.hx:99` |
| `/api/order/updateOrderQuantity/:userId?catalog=&multiDistrib=` | POST JSON `{id, qt}` | same as get | `{success, subTotal,total,fees,basketTotal,nextQt}` | `Order.hx:103-132` | `camap-hx/js/App.hx:169` |
| `/api/distributions/unsubscribeFromRole/:multiDistribId/:roleId` | any (front uses POST) | `checkIsLogged`, caller must be the volunteer | `{success:true}` or error 422/403 | `controller/api/Distributions.hx:21-31` | `camap-ts/packages/front-core/src/modules/volunteersCalendar/requests.tsx:37-41` |
| `/api/distributions/volunteerRolesCalendar?from=&to=` | GET | none explicit; uses `app.getCurrentGroup()` | `{multiDistribs[], roles[]}` | `Distributions.hx:36-86` | `volunteersCalendar/requests.tsx:29` |
| `/api/places/:placeId` | GET only (405 otherwise) | none | `{name,address1,address2,city,zipCode,lat,lng}` | `controller/api/Places.hx:13-24` | none found |
| `/api/catalog/:catalogId` | GET | none explicit (`getVisibleDocuments(app.user)`) | catalog + products + vendor + distributions + constraints + absences | `controller/api/Catalog.hx:14-43` | `front-core/src/modules/csaCatalog/requests.tsx:19-24` |
| `/api/catalog/catalogAbsences/:catalogId` | GET | none explicit | absence window + possible absent distribs | `Catalog.hx:48-55` | `requests.tsx:45-50` |
| `/api/catalog/stocksPerProductDistribution/:catalogId` | GET | none explicit | `{productId:{distribId:stock}}` or empty | `Catalog.hx:57-72` | `requests.tsx:32-37` |
| `/api/catalog/subscriptionAbsences/:subscriptionId` | GET + POST JSON `{absentDistribIds:[...]}` | owner or `canManageContract`; 403 if catalog has no absence management; 400 on empty list for non-manager | current absences, closed ids, possible distribs | `Catalog.hx:77-123` | `requests.tsx:126-149`; also `front-core/src/modules/batchOrder/BatchOrder.module.tsx:12` |
| `/api/subscription[/:subId]` | POST JSON `NewSubscriptionDto` creates; otherwise returns sub | create: admin / catalog manager / group manager / self; closed orders blocked for non-managers | subscription JSON (user, constraints, distributions with orders, defaultOrder, balance...) | `controller/api/Subscription.hx:27-58,149-203` | `requests.tsx:72,112` |
| `/api/subscription/updateOrders/:subId` | POST JSON `{distributions:[...]}` | owner / admin / catalog manager | subscription JSON | `Subscription.hx:60-80` | `requests.tsx:93` |
| `/api/subscription/updateDefaultOrder/:subId` | POST JSON `CSAOrder[]` | owner / admin / catalog manager | subscription JSON; `InvalidParameters` typed error on failure | `Subscription.hx:83-108` | `requests.tsx:104` |
| `/api/subscription/checkDefaultOrder/:catalogId` | POST JSON `CSAOrder[]` | none explicit | `{defaultOrderCheck:true}` or throws | `Subscription.hx:111-132` | `requests.tsx:157-161` |
| `/api/user/me` | GET / POST multipart | session user, else 401; POST edits address1/2, city, zipCode, phone | `user.infos()` | `controller/api/User.hx:18-39` | none found |
| `/api/user/getFromGroup` | GET | `@logged` + `canAccessMembership` or contract manager (403) | `{users:[UserInfo]}` | `User.hx:44-53` | `OrderBoxThunk.hx:44` |
| `/api/user/getToken` | GET | `@logged` | `{token}` JWT `{email,id}` signed with hx `config.key` | `User.hx:56-64` | none found |
| `/api/product/:productId` | GET | none | `product.infos()` | `controller/api/Product.hx:13-15` | none found |
| `/api/product/get?catalogId=` | GET | none | `{products[]}` | `Product.hx:22-29` | `OrderBoxThunk.hx:150,156` |

Notes:
- 25 routes. Front-core REST client builds URLs as `{CAMAP_HOST}/api{path}` with `credentials:'include'` (`front-core/src/lib/REST/useRestGetApi.tsx:5,26-30`, `useRestPostApi.tsx:22-30`), so these calls go to the hx origin (same-site cookies).
- Base URL is read at module load from `window.__APP_CONFIG__` (`front-core/src/lib/runtimeCfg.ts:14-16,47-57`), which hx serves as `/env.js` (generated by `camap-hx/entrypoint.sh:35-62`, injected first by `BridgeService.hx:53`).
- Bridge-style `/api/*` endpoints with "none found" callers might be used by third parties or mobile clients: unverified.

## 3. TS->HX and HX->TS calls

### HX -> TS (all use `camap_bridge_api` / `camap_api` from `config.xml`; sample `camap-hx/config.xml.dist:15-16`, `camap_api` and `camap_bridge_api` both `http://nest-camap:3010`)

| Call | Where | Auth | Purpose |
|---|---|---|---|
| `GET {bridge}/neostatic/manifest.json` | `BridgeService.hx:12-21` (via `getNeoModuleScripts`, `View.hx:281-283`, used in `lang/master/tpl/base.mtt:118`) | Bearer key header | Webpack manifest; keys `runtime.js, vendors.js, reactlibs.js, neo.js, app.js` are normalised to `/neostatic/...` (`BridgeService.hx:24-60`). Fallback: Neko `Cache("manifest")` 1 h, written with probability 1/10 (`BridgeService.hx:63-74`); if both fail throws "Unable to load ressources from CAMAP-ts." |
| `GET {bridge}/bridge/auth/logout/:userId` | `BridgeService.logout` `:95-101`, called from `controller/User.hx:83` | Bearer | removes refresh token in Nest (`auth-bridge.controller.ts:34-46`) |
| `GET {bridge}/bridge/auth/delete-user/:userId` | `BridgeService.call` from `controller/admin/User.hx:49` | Bearer | deletes user via Nest `usersService.delete` (`auth-bridge.controller.ts:48-60`) |
| `GET {bridge}/bridge/mail/getUnsentMails` | `controller/admin/Admin.hx:72` | Bearer | admin screen listing unsent buffered mails (`mail-bridge.controller.ts:10-13`) |
| `GET {bridge}/bridge/auth/tokens/:userId` | `BridgeService.getAuthToken` `:88-93` | Bearer | no caller found in `camap-hx/src` (dead code). Endpoint exists at `auth-bridge.controller.ts:21-32` |
| `{camap_api}/graphql` | `View.getGraphqlUrl` `View.hx:277-279` | n/a (URL given to templates) | tells templates which GraphQL URL to use |
| Apache proxy `/neostatic/`, `/graphql`, `/locales/` -> `http://nest-devcamap:3010` | `camap-hx/apache/camap-static.conf:12-27` | none | browser-side proxy; also bypasses mod_neko (`:29-39`) |

Bridge guard: `AuthGuard('bridge')` = passport-http-bearer; valid iff token equals `CAMAP_KEY` (`api-core/src/auth/strategies/bridge.strategy.ts:12-14`). hx sends its `key` config value (`BridgeService.hx:103-110`). The two secrets must match: nothing enforces this in code; `camap-hx/scripts/update-config.pl:24-26` sets hx `key` from `PW_HASH_KEY`, while Nest reads `CAMAP_KEY` (`api-core/src/envSchema.ts:12`).

hx also computes outbound JWT in `/api/user/getToken` (`api/User.hx:58`), signed with the hx key, whereas Nest's JWT strategy verifies the `Authentication` cookie with `JWT_ACCESS_TOKEN_SECRET` (`api-core/src/auth/strategies/jwt.strategy.ts:15-19`). Whether the two secrets coincide in deployments is unverified.

External hx HTTP: Mapbox geocoding via Curl (`camap-hx/src/service/Mapbox.hx:25-40`); `haxe.Http` imported in `controller/Member.hx:6` with no use found by grep on `Http` calls.

### TS -> HX

| Call | Where | Notes |
|---|---|---|
| `GET {CAMAP_LOCAL_HOST}/cron/minute`, `/cron/hour`, `/cron/daily` | `crontab.service.ts:15-55`, URL from `process.env.CAMAP_LOCAL_HOST` (`:57-61`) | Only when `HX_TRIGGER_CRONS` is truthy (any non-empty string, including "false": `:17,31,45`). Schedules: every minute, every hour, `EVERY_DAY_AT_MIDNIGHT` (the comment in the file mentions 00:15 for daily: `:11` vs `:43`). Errors are only logged. hx `Cron.canRun()` always returns true (`camap-hx/src/controller/Cron.hx:36-38`), so these URLs are unauthenticated. hx handlers: `doMinute :58`, `doHour :92`, `doDaily :340`. |
| Browser (front-core) -> `{CAMAP_HOST}/api/*` | see section 2 | via `getRestBaseUrl()` (`runtimeCfg.ts:47`) |
| `CAMAP_HOST` used for links in mails, locales path, group links | `mails.service.ts:350,369`, `group-previews-members.resolver.ts:242,311`, `runtimeCfg.ts:24-28` | |
| Nest cookie names expected from hx | `sid` (hx session, `cookie.strategy.ts:8`) and `Auth_sid` | see section 4 |

Other Nest-side crons (independent of hx): mails buffer every minute (`mails/mails.service.ts:185`), messages daily (`messages/messages.service.ts:79`), cache clean 01:00 (`tools/cache.service.ts:55`), users 01:00 (`users/users.service.ts:442`).

## 4. Shared state

### 4.1 Database
- One MySQL schema. hx tables are the source of truth (`sys.db.Object` classes in `camap-hx/src/db`); Nest maps 29 `@Entity` classes (count via grep on `@Entity(` in `api-core/src`) with `ormconfig.js` (`camap-ts/ormconfig.js:33`, naming strategy `orm-naming-strategy.js`) and runs its own migrations (`api-core/src/migrations`, `api-core/ormconfig.js:5-10`). Migrations are not run by the Docker CMD (`camap-ts/camap-ts.Dockerfile:65`: `node packages/api-core/dist/main.js`); `start:prod` does run them (`api-core/package.json:25`).
- Tables written by Nest (repositories with save/insert/update/delete): Session (`auth/session.service.ts`, `users/users.service.ts`), User (`users.service.ts`), UserGroup, Membership, WaitingList, Group (`groups/services/*`), CsaSubscription, UserOrder, Basket, Operation (`groups/services/csa-subscriptions.service.ts`, `payments/services/*`), Vendor, Catalog, Product (`vendors/services/*`), Distribution, MultiDistrib, DistributionCycle (`shop/services/*`), Message (`messages/messages.service.ts`), BufferedJsonMail (`mails/mails.service.ts`), Cache (`tools/cache.service.ts`), Variable (`tools/variable.service.ts`), File, EntityFile (`files/file.service.ts`, `tools/entityFile.service.ts`).
- Tables written by hx that Nest also touches: BufferedJsonMail is filled by hx (`camap-hx/src/mail/BufferedJsonMailer.hx:9`, instantiated at `App.hx:352`) and drained/sent by Nest cron (`mails.service.ts:185-215`), so hx never sends mail itself. Subscriptions/orders created by the React bundles go through hx `/api/subscription/*` (hx writes), while Nest also has repositories for the same tables (CsaSubscription, UserOrder): two writers for the same tables.
- `Session` table: hx (sugoi) creates sessions (`App.current.session.sid`, `View.hx:328`); Nest only updates `uid`/`lastTime` on login (`api-core/src/auth/auth.service.ts:70-79`, throws if `sid` unknown) and deletes on logout (`auth.service.ts:176-189`). Entity: `api-core/src/tools/models/session.entity.ts:7-41` (`sdata`, `messages` mediumblob are hx-serialised, `TODO` at `auth.service.ts:76` about `sdata.whichUser`).

### 4.2 Auth / cookies
| Cookie | Set by | Read by | Notes |
|---|---|---|---|
| `sid` | hx (sugoi session) | hx; Nest `CookieStrategy` (`cookie.strategy.ts:8`); Nest guard `checkSidSync` (`common/guards/gql-auth-abstract-guard.ts:85-91`) | |
| `Auth_sid` | Nest login (`auth.service.ts:272-278`), set when login input has `sid` (`auth.resolver.ts:177-179`) | hx `Main.doHome :70-76` and `User.hx:30-35` (redirects to `/user/logout` on mismatch), Nest guard | login `sid` comes from hx template (`UserService.hx:71`) |
| `Authentication` (JWT access) | Nest (`auth.service.ts:234-240`) | Nest `JwtStrategy` (`jwt.strategy.ts:15`, extractor `cookie-extractors.ts:4-6`) | httpOnly |
| `Refresh` (JWT refresh) | Nest | Nest guard fallback (`gql-auth-abstract-guard.ts:171-178`) | |
- Login/register are GraphQL mutations in Nest (`auth.resolver.ts`), logout clears three cookies server side from either stack: Nest (`auth.service.ts:176-203`) and hx (`controller/User.hx:82-114`, three redirects because Haxe cannot set several Set-Cookie headers: `User.hx:90-95`).
- Server-to-server auth: Bearer `CAMAP_KEY` (section 3).
- Cron endpoints on hx: no auth (section 3).
- File URLs: Nest computes `/file/{id}_{md5(id+CAMAP_KEY)}` (`api-core/src/files/file.service.ts:56-72`), the same scheme hx exposes (`Catalog.hx:31` uses `sugoi.db.File.makeSign`, library code not inspected: equivalence unverified).
- `CryptoService.sha1/md5` prefix with `CAMAP_KEY` (`tools/crypto.service.ts:8-22`), used by `operation.resolver.ts:8,24`.

### 4.3 Files / static
- Nest serves `/neostatic` from `/srv` (`api-core/src/main.ts:58-60`, `srvRoot = "/srv"`); `camap-ts/public` is mounted in the dev Compose (`docker-compose.dev.yml:108`). hx writes `/srv/www/env.js` at container start (`camap-hx/entrypoint.sh:35-62`) with `PUBLIC_PATH, API_HOSTNAME, API_PORT, CAMAP_HOST, CAMAP_BRIDGE_API, FRONT_URL, FRONT_GRAPHQL_URL, MAPBOX_KEY`.
- CORS on Nest in production: `[FRONT_URL, CAMAP_HOST]`, credentials true (`main.ts:32-45`).

## 5. GraphQL / REST inventory (api-core)

### 5.1 GraphQL
- Schema file is code-first generated: `autoSchemaFile: src/schema.gql` (`api-core/src/app.module.ts:48`), 753 lines. `type Query` at `src/schema.gql:531` (50 fields), `type Mutation` at `:584` (31 fields), no GraphQL `Subscription` type (the `SubscriptionTotalOperationTypeData` match at `:357` is a data type). Counts verified against decorators: 50 `@Query`, 31 `@Mutation`/`@TransactionalMutation`.
- Per resolver file (queries / mutations), all under `packages/api-core/src`:

| Module | File | Q | M | Operations |
|---|---|---|---|---|
| auth | `auth/auth.resolver.ts` | 1 | 5 | `isEmailRegistered`; `login, recordBadLogin, register, logout, loginAs` |
| users | `users/users.resolver.ts` | 8 | 3 | `me, user, getUserFromControlKey, isGroupAdmin, canManageAllCatalogs, getEmailRecipientsByUserIds, getUsersFromEmails, getInvitedUserToRegister`; `updateUser, updateUserNotifications, deleteAccount` |
| groups | `groups/resolvers/groups.resolver.ts` | 1 | 3 | `group`; `quitGroup, quitGroupByControlKey, setGroupImage` |
| groups | `group-previews.resolver.ts` | 5 | 0 | `groupPreview, groupPreviews, groupPreviews2, getGroupsOnMap, myGroups` |
| groups | `group-previews-members.resolver.ts` | 1 | 3 | `groupPreviewMembers`; `removeUsersFromGroup, importAndCreateMembers, sendInvitesToNewMembers` |
| groups | `group-previews-catalogs.resolver.ts` | 1 | 0 | `groupPreviewCatalogs` |
| groups | `memberships.resolver.ts` | 2 | 3 | `getUserMemberships, getMembershipFormData`; `createMembership, createMemberships, deleteMembership` |
| groups | `waitingLists.resolver.ts` | 1 | 3 | `getWaitingListsOfGroup`; `moveBackToWaitingList, cancelRequest, approveRequest` |
| groups | `userLists.resolver.ts` | 4 | 0 | `getUserLists, getContractsUserLists, getDistributionsUserLists, getUserListInGroupByListType` |
| groups | `userGroups.resolver.ts` | 1 | 0 | `userGroup` |
| groups | `csa-subscriptions.resolver.ts` | 0 | 0 | no query/mutation decorators found (file exists) |
| shop | `multi-distribs.resolver.ts` | 3 | 0 | `multiDistribution, multiDistribs, distributedMultiDistribs` |
| shop | `distributions.resolver.ts` | 1 | 0 | `distribution` |
| shop | `distribution-cycles.resolver.ts` | 1 | 0 | `distributionCycles` |
| shop | `attendance-list.resolver.ts` | 2 | 0 | `attendanceClassicContract, attendanceVariableContract` |
| shop | `orders.resolver.ts` | 0 | 0 | none |
| places | `places/resolvers/places.resolver.ts` | 1 | 0 | `place` |
| vendors | `vendors.resolver.ts` | 9 | 5 | `vendor, getVendorWithEmailCheck, getActiveVendorsFromGroup, getClaimableVendors, getVendorsByUserId, getDefaultVendorByUserId, hasVendorsByUserId, getVendorsFromCompanyNumber, getVendorProfessions`; `claimVendor, consolidateVendors, updateVendor, setVendorImage, createVendorImage` |
| vendors | `catalogs.resolver.ts` | 3 | 0 | `catalog, getOrderableCatalogsFromMultiDistrib, getActiveCatalogs` |
| vendors | `products.resolver.ts` | 1 | 1 | `vendorProductsSample`; `setProductImage` |
| messages | `messages/messages.resolver.ts` | 4 | 1 | `getMessagesForGroup, getUserMessagesForGroup, message, getLatestMessages`; `createMessage` |
| payments | `payments/resolvers/operation.resolver.ts` | 0 | 2 | `validateOperation, deleteOperation` |
| tools | `tools/resolvers/entity-file.resolver.ts` | 0 | 2 | `createDocument, deleteDocument` |

Per-file counts are from `grep -c` of decorators; the operation names come from `src/schema.gql:531-615`. The mapping of a few operation names to a file (e.g. `isEmailRegistered`) is inferred from the per-file counts and not individually opened: unverified.

- Front-core consumes the schema through generated hooks in `front-core/src/gql/index.tsx` (`graphql-codegen`, `front-core/package.json` script `gen:gql`).
- Guards: `GqlAuthGuard` = passport `jwt` strategy with refresh fallback (`common/guards/gql-auth.guard.ts`, `gql-auth-abstract-guard.ts:121-200`).

### 5.2 REST controllers in api-core
| Route | Guard | Purpose | Source |
|---|---|---|---|
| `GET /health`, `GET /ping` | none | `{version}` for k8s | `tools/tools.controller.ts:11-22` |
| `GET /bridge/auth/tokens/:id` | Bearer CAMAP_KEY | JWT for user id | `auth/controllers/auth-bridge.controller.ts:21` |
| `GET /bridge/auth/logout/:id` | Bearer | remove refresh token | `:34` |
| `GET /bridge/auth/delete-user/:id` | Bearer | delete user | `:48` (state-changing GET) |
| `GET /bridge/mail/getUnsentMails` | Bearer | unsent buffered mails | `mails/controllers/mail-bridge.controller.ts:10` |
| `GET /mails/get/:templateName/:params` | JWT + superadmin | render a twig template with JSON params | `mails/controllers/mails.controller.ts:36` |
| `GET /mails/list` | JWT + superadmin | list templates | `mails.controller.ts:67` |
| `GET /files/get/:id`, `/files/compress/:id`, `/files/compressAll/:page` | JWT + superadmin | dev/admin file tools | `files/file.controller.ts:33,51,90` |
| `/neostatic/*`, `/locales/*` | none | static bundle / i18n | `main.ts:58+` (partially read) |
| `POST /graphql` | per resolver | GraphQL | `app.module.ts:46-48` |

## 6. Test inventory per side

### 6.1 camap-hx (utest)
- Entry point: `camap-hx/src/test/TestSuite.hx:15-30` (`main`) adds 7 cases to a utest `Runner`, reads the DB URL from `Sys.args()[0]` (`mysql://user:pass@host:port/db`, `:32-49`), then every test's `setup()` calls `TestSuite.initDB()` which does `DROP DATABASE tests; CREATE DATABASE tests; USE tests;` and recreates all tables (`:52-93`) regardless of the database named in the connection string, then `initDatas()` (`:151-~465`).
- No `.hxml`/script/CI invoking `test.TestSuite` was found in `camap-hx` (grep for `TestSuite` outside `src/test` returned nothing); `backend/build.hxml` only builds `-main App` to `www/index.n` (`camap-hx/backend/build.hxml:12-20`) and does not include `-lib utest`, although the lib is installed (`camap-hx/backend/haxe_libraries/utest.hxml:1`). `camap-ts/docs/tests.md:7` says the Haxe tests "sont tombés en désuétude". Runnable as-is: no (needs a custom `haxe` command and a MySQL with DROP rights, unverified).

| Class (file) | Test methods |
|---|---|
| `TestTools` (`TestTools.hx:10`) | `testDateRanges :13`, `testFloatTool :28`, `testStockDispatch :40`, `testListSynchronizer :56`, `testDateJSON :106`, `testMembership :118` |
| `TestUser` (`TestUser.hx:12`) | `testViewContract :28` |
| `TestOrders` (`TestOrders.hx:12`) | `testBasket :47`, `testStocks :81`, `testOrderEdit :127`, `testOrderWithMultiWeightProduct :191`, `testMakeOrderAndZeroQuantity :226`, `testDelete :250` |
| `TestDistributions` (`TestDistributions.hx:8`) | `testCreateCycle :100`, `testDelete :226`, `testUpdateAmapContractOperations :275`, `testCantCreateDistribOnSameDay :355` |
| `TestPayments` (`TestPayments.hx:11`) | `testValidateDistribution :24`, `testMakeOnTheSpotPaymentOperations :67` |
| `TestReports` (`TestReports.hx:12`) | `testOrdersByProduct :28` |
| `TestSubscriptions` (`TestSubscriptions.hx:16`) | `testDeleteSubscription :75`, `testCreateSubscription :142`, `testUpdateSubscription :292`, `testSubscriptionsOverlap :375`, `testDistributionShifting :425`, `testGetSubscriptionsExportData :501` |

Total 26 methods. Covered: services layer (orders, distributions, subscriptions, payments/operations, reports, stock, date tools). Not covered: controllers, `/api/*`, bridge, cron, mails, vendors/products pages, groups/membership UI.

### 6.2 camap-ts
Frameworks and configs:
- api-core: Jest 27 + ts-jest (`api-core/package.json:67,73`); unit config `api-core/jest.config.js` (`rootDir: src`, `testRegex: .spec.ts$`, node); e2e config `api-core/test/jest-e2e.json` (`.e2e-spec.ts$`, `testTimeout: 18000`, isolatedModules). Scripts: `test` = `TZ=UTC jest --forceExit`, `test:e2e` = `TZ=UTC jest --config ./test/jest-e2e.json -i --verbose --forceExit` (`package.json:27-32`).
- camap-common: Jest default regex, `rootDir: src`, node (`camap-common/jest.config.js`); script `test` = `jest` (`camap-common/package.json:10`).
- front-core: Jest 28 + babel-jest (`front-core/package.json:42,125`), `@testing-library/react@10`, jest config `front-core/jest.config.js` (rootDir `./`, `setupFilesAfterEnv: ['./test/setupTests.js']`, babel transform); Storybook 8 (`front-core/package.json:11,93-97`); helpers in `front-core/test/*` (`initI18n.ts`, `testUtils.ts`, `withTestI18nMocker.tsx`, `withTestMuiPickersPovider.tsx`).
- The root `camap-ts/package.json:7-27` has no `test` script (tests are per package).
- Env: api-core app reads `camap-ts/.env.test` when `NODE_ENV=test` (`api-core/src/app.module.ts:26`, `camap-ts/ormconfig.js:8-14`): DB `test` on `localhost:3306` with `root/root` (`camap-ts/.env.test`, DB part), `DB_SYNCHRONIZE=false`. `.env.ci.test` contains only `DB_HOST=mysql`.

| File | Type | `it` cases | Runnable (from config) |
|---|---|---|---|
| `api-core/src/auth/auth.service.spec.ts` | unit | 13 | yes (mocked repos, 14 specs use `Test.createTestingModule`/`jest.mock` per grep) |
| `api-core/src/common/utils.spec.ts` | unit | 10 | yes |
| `api-core/src/users/users.service.spec.ts` | unit | 9 | yes |
| `api-core/src/payments/services/payments.service.spec.ts` | unit | 8 | yes |
| `api-core/src/groups/services/memberships.service.spec.ts` | unit | 7 | yes |
| `api-core/src/common/mailer/mailer.service.spec.ts` | unit | 6 | yes |
| `api-core/src/shop/services/multi-distrib.service.spec.ts` | unit | 5 | yes |
| `api-core/src/groups/services/user-groups.service.spec.ts` | unit | 1 | yes |
| `api-core/src/groups/resolvers/group-previews.resolver.spec.ts` | unit | 1 | yes |
| `api-core/src/places/resolvers/places.resolver.spec.ts`, `.../services/places.service.spec.ts` | unit | 1 + 1 | yes |
| `api-core/src/timezones.spec.ts` | unit | 1 | yes (asserts UTC; requires `TZ=UTC` from the script) |
| `api-core/test/groups.e2e-spec.ts` | e2e | 10 (quit group x3, send invites x7) | needs MySQL `test` + `.env.test` |
| `api-core/test/multi-distrib.service.e2e-spec.ts` | e2e | 8 (create/update/delete multiDistrib) | same |
| `api-core/test/products.e2e-spec.ts` | e2e | 3 | same |
| `api-core/test/catalogs.e2e-spec.ts` | e2e | 2 | same |
| `api-core/test/catalogs.service.e2e-spec.ts` | e2e | 1 | same |
| `api-core/test/timezones.e2e-spec.ts` | e2e | 1 | yes (no DB use visible) |
| `camap-common/src/distributions/distribution.spec.ts` | unit | 5 | yes |
| `camap-common/src/products/format.spec.ts` | unit | 1 | yes |
| `camap-common/src/validators/loginSchema/loginSchema.spec.ts` | unit | 8 | yes |
| `front-core/src/components/utils/ISO31661Selector/ISO31661Selector.spec.tsx` | component | 12 | blocked: see code inconsistency 1 |
| `.../ConfirmDialog/ConfirmDialog.spec.tsx` | component | 6 | same |
| `.../ConfirmDialog/withConfirmDialog.spec.tsx` | component | 3 | same |
| `.../DialogTitleActions/DialogTitleActions.spec.tsx` | component | 4 | same |
| `.../DialogTitleClosable/DialogTitleClosable.spec.tsx` | component | 3 | same |
| `.../UploadButton/UploadButton.spec.tsx` | component | 1 | same |

Counts are `grep` of `it(`/`test(` at line start; totals: api-core unit 63, api-core e2e 25, camap-common 14, front-core 29, i.e. 131 cases. No `.skip`/`xit`/`todo` found.
- e2e harness: `test/utils.ts` boots `AppModule` via `@nestjs/testing`, signs JWT with `JwtService`, provides an Apollo-like client over supertest (`utils.ts:75-112`, `createApolloClient :116`), and generators from `dev/dataset-generator`. `cleanDB` runs `connection.synchronize(true)` (drops and recreates schema, `utils.ts:57-60`) but is called only by `multi-distrib.service.e2e-spec.ts:33`; `initTestApp(resetDb)` ignores its `resetDb` parameter (`utils.ts:75`).
- Storybook: 40+ `*.stories.tsx` under `front-core/src` plus `front-core/stories/{CssDebug,Debug}.stories.tsx`; config in `front-core/.storybook/`. Many stories use the dataset server (`front-core/src/dev-tools/datasets.story.tsx`). Run via `npm run dev:story` (root `package.json:19`).
- Not covered by automated tests: hx `/api/*`, bridge controllers, GraphQL resolvers for users/vendors/messages/shop (only service-level specs), crons, REST hooks in front-core.

## 7. Fixtures / dataset

- Generators: `api-core/src/dev/dataset-generator.ts` (822 lines) exports `datasetGenerators(app)` returning `admin, reset, genPlace, genGroup, genMultiDistrib, genBasket, genUser, genVendor, genCatalog, genProduct, genUserGroup, genDistribution, genUserOrder, genCsaSubscription, genOperation, genVolunteerRole` (`:719-822`). On init it recreates the `migrations` table content from `src/migrations`, saves base config variables (`tosVersion`, `platformTermsOfServiceVersion`) and ensures a super admin `admin@camap.tld` (`:716-770`). `genGroup` auto-adds the admin as UserGroup (`:795-799` area).
- Islets: only `api-core/src/dev/islets/default.islet.ts` (a group "AMAP de <city>" with 50 users).
- CLI: `npm run dataset <islet> [-c] [--noFail]` runs compiled `dist/cli/dataset` and loads `dist/dev/islets/<name>.islet.js` (`api-core/src/cli/dataset.ts:29-57`, `package.json:19`); `-c` calls `synchronize(true)` (wipes DB). `dataset-server` (`cli/dataset-server.ts:23-77`): Express on 6007, `GET/POST /islets/:name`, caches JSON in `.dataset-cache/`.
- Front: `DatasetProvider`/`useDataset` in `front-core/src/dev-tools/datasets.story.tsx`; with `loginAs` it calls hx `GET http://localhost/api/createSid` to get a sid, stores cookie `sid`, then runs the GraphQL `login` mutation with password `admin` (`:185-205`).
- hx fixtures: `TestSuite.initDatas()` creates users François/Seb/Julie, groups AMAP_DU_JARDIN/LOCAVORES, vendors, products, catalogs, distributions (`camap-hx/src/test/TestSuite.hx:115-149,151+`).

## 8. CI

- Both repos have `.github/workflows` with five identical-shaped workflows each: `docker-publish.yml` (tag `vX.Y.Z`, verifies tag is on `master`, pushes `ghcr.io/camap-app/camap-{hx,ts}`), `publish-feature.yml` (branches/tags `feature/**`, `feature-*`), `publish-fix.yml` (`fix-*`), `publish-mantis.yml` (`mantis-*`), `publish-staging.yml` (tags `staging-vN`, `staging-vN-rc*`). Plus `workflow_dispatch`. Source: `camap-hx/.github/workflows/*.yml`, `camap-ts/.github/workflows/*.yml` (`on:` blocks).
- Steps are checkout, ref validation, buildx, GHCR login, `docker/build-push-action` with `camap-hx.Dockerfile` / `camap-ts.Dockerfile`. No job runs `jest`, `npm test`, `haxe` tests or lint (grep of `jest`/`npm run` found none; "test" only matches "latest").
- No CI config at the `camap-docker` root (`.github` absent from listing).

## 9. Documentation inconsistencies

1. [CONFIRMED: readme.md:12,13,17 broken links; the error-handling link is at readme.md:4 (not :5); troubleshooting links verified against ls of api-core/docs and docs/archives] (verifier-corrected) `camap-ts/docs/readme.md:12,13` link to `../packages/api-core/docs/tests.md` and `schema.md`, which do not exist (`packages/api-core/docs` contains `dataloader.md`, `transactions.md`, `utils.md` only). `readme.md:5` links `./error-handling.md` which exists only at `docs/archives/error-handling.md`. `readme.md:16` links `../packages/front-core/docs/translations.md`, which exists only at `docs/archives/front-core/translations.md`.
2. [CONFIRMED: root package.json has no test scripts; api-core/package.json:27-31; front-core:12, camap-common:10 have "test"] `camap-ts/docs/tests.md:5-9` documents `npm run test`, `test:e2e`, `test:cov` "from root"; the root `camap-ts/package.json:7-27` has no such scripts (they exist in `packages/api-core/package.json:27-32`). It does not say front-core and camap-common have their own `test`.
3. [CONFIRMED: tests.md:3,5; `grep "function test"` in camap-hx/src/test yields 27 matches (draft said 26); no hxml/Dockerfile references src/test] (verifier-corrected) `camap-ts/docs/tests.md:3` says tests are Jest unit or e2e; it omits front-core Jest component specs and Storybook. It says Haxe tests are obsolete; `camap-hx/src/test` still holds 27 test methods (verifier-corrected) (not wired in any build file).
4. [CONFIRMED: archives/api-core/tests.md:5,7; test/dataset does not exist; test dir specs: catalogs, catalogs.service, groups, multi-distrib.service, products, timezones] `camap-ts/docs/archives/api-core/tests.md:5,7` link `./dataset.md` (actual file: `docs/archives/dataset.md`) and `../test/dataset/dataset.md` (does not exist). `:32` debug example uses `Orders` filter; no `Orders` e2e spec exists (specs: groups, multi-distrib.service, products, catalogs, catalogs.service, timezones).
5. [CONFIRMED: template-test-e2e.md:4-5 imports beforeEach_e2e etc.; utils.ts:75,112,116 export initTestApp/closeTestApp/createApolloClient; no test/dataset] `camap-ts/docs/archives/api-core/template-test-e2e.md:4-5,11,15,19` uses `beforeEach_e2e`, `afterEach_e2e`, `createApolloClient(testHelper, USERS.francois)` and `./dataset` with `USERS`; actual helpers are `initTestApp`, `closeTestApp`, `createApolloClient({app, signUser}, user)` and generators (`api-core/test/utils.ts:75,112,116`); no `test/dataset` exists.
6. [PARTIALLY REFUTED: `dafault.islet.ts` typo confirmed at archives/dataset.md:157 and two dataset docs exist; but `genTransactionIslet` is a user-defined example function in the doc (archives/dataset.md:73-75), not presented as a library helper; default.islet.ts is the only islet file] `camap-ts/docs/archives/dataset.md:...` references `dafault.islet.ts` (typo; actual `default.islet.ts`); two divergent dataset docs exist (`docs/dataset.md` and `docs/archives/dataset.md`); the archived one documents `genTransactionIslet` as a test helper, which does not exist in code (islets dir has only `default.islet.ts`).
7. [CONFIRMED: error-handling.md:103 uses TestErrorType.DoSomethingError vs enum member DoSomething (:66); useDoSomethingMutation called inside go at :156] `camap-ts/docs/archives/error-handling.md` uses `MutationFail`/`CamapError`: they exist (`api-core/src/common/decorators/mutation-fail.decorator.ts`, `common/errors/camap.error.ts`) but the example mixes names (`TestErrorType.DoSomethingError` vs enum member `DoSomething`); and `useDoSomethingMutation` is called inside `go` after being destructured. It is a sketch rather than runnable.
8. [CONFIRMED: README.md:50; package.json:25 start:prod runs migration:run, start is `node dist/main`; Dockerfile CMD camap-ts.Dockerfile:65 node main; no migrationsRun anywhere in src] `camap-ts/packages/api-core/README.md:50` says "Migrations are automatically run on start"; only `start:prod` runs them (`package.json:25`), the Docker `CMD` (`camap-ts.Dockerfile:65`) and `start` do not. The README is the stock Nest template (unclosed code fence at `:58-59`; Travis badges).
9. [CONFIRMED: README says parcel-bundler; browser-detect/package.json:7-8 uses parcel, so the claim "not verified" is resolved: README matches] `camap-ts/packages/browser-detect/README.md:15-16` mentions parcel-bundler and copying into "Camap-Haxe" `www`: build tool not verified in this package.
10. [CONFIRMED: conf.md:89-90; .env.test:46 FRONT_GRAPHQL_URL=/graphql; runtimeCfg.ts:19-22 default /graphql] `camap-ts/docs/conf.md:89-90` gives `FRONT_GRAPHQL_URL=http://localhost:3010/graphql` while `.env.test` and runtime default use relative `/graphql` (`camap-ts/.env.test`, `runtimeCfg.ts:19-22`).
11. [CONFIRMED security-relevant: crons.md:11-16 only documents crontab; conf.md describes HX_TRIGGER_CRONS; /cron/* has no auth (Cron.hx:36-38 canRun returns true) and no Apache/Traefik restriction found] `camap-ts/docs/crons.md:11-16` says a crontab must be set; it does not mention the Nest `CrontabService` + `HX_TRIGGER_CRONS` mechanism (only `conf.md:93` does) nor that `/cron/*` is unauthenticated.
12. [CONFIRMED: install.md:28-29 ; controller/api/ directory exists] `camap-ts/docs/install.md:29` describes `/api/<controller>/<action>` for `camap-hx/src/controller/api/<Controller>.hx`: consistent with code, but no endpoint list is documented anywhere in the docs reviewed.
13. [CONFIRMED: camap-hx/README.md:10 says Haxe 4.05; Contributing.md:52 "Testez votre modification avant de soumettre"] `camap-hx/README.md` says Haxe 4.05 and no test instructions; `camap-hx/Contributing.md:52` says "Testez votre modification" without a command.

## 10. Code inconsistencies

1. [CONFIRMED: jest.config.js:124 setupFilesAfterEnv ./test/setupTests.js; front-core/test contains only initI18n.ts, testUtils.ts, withTestI18nMocker.tsx, withTestMuiPickersPovider.tsx; no jest key in package.json overriding it] `camap-ts/packages/front-core/jest.config.js` sets `setupFilesAfterEnv: ['./test/setupTests.js']`, but `front-core/test/` has no `setupTests.js` (files: `initI18n.ts, testUtils.ts, withTestI18nMocker.tsx, withTestMuiPickersPovider.tsx`; `find` for `setupTests*` returned nothing). Jest would fail at startup; front-core specs are likely not runnable as configured.
2. [CONFIRMED: dataset-generator.ts:784 `TRUNCATE TABLE db.${meta.tableName}`; .env.test:20 DB_DATABASE=test; whether reset() runs against the test DB not checked] `camap-ts/packages/api-core/src/dev/dataset-generator.ts:784` hardcodes schema `db.` in `TRUNCATE TABLE db.<table>` (the `reset()` helper) while the test DB is named `test` (`camap-ts/.env.test`, `DB_DATABASE=test`).
3. [CONFIRMED: utils.ts:75 resetDb never referenced in body; groups.e2e-spec.ts:66 initTestApp(false); cleanDB (utils.ts:57) called only from multi-distrib.service.e2e-spec.ts:33] `camap-ts/packages/api-core/test/utils.ts:75`: parameter `resetDb` is never used; `groups.e2e-spec.ts:66` passes `false` with no effect. `cleanDB` (`:57`) is called by only one spec (`multi-distrib.service.e2e-spec.ts:33`), the others rely on whatever state the DB has.
4. [CONFIRMED: TestSuite.hx:56-58 (draft :55-57) DROP/CREATE DATABASE tests hard-coded; connectDb :32-48 uses dbname from CLI arg] (verifier-corrected) `camap-hx/src/test/TestSuite.hx:55-57` always drops and recreates database `tests`, ignoring the dbname in the CLI arg used by `connectDb` (`:32-49`): a mismatch can drop the wrong schema or fail.
5. [CONFIRMED security-relevant: Cron.hx:36-38 canRun() returns true, auth block commented; no Apache (apache.conf, camap-static.conf) or Traefik restriction on /cron; crontab.service.ts:19-20 plain axios.get without credentials] `camap-hx/src/controller/Cron.hx:36-38`: `canRun()` returns `true` unconditionally (key check commented out), so `/cron/*` is public; the doc comment above says "CLI only en prod". Nest calls it over HTTP without credentials (`crontab.service.ts:19-20`).
6. [CONFIRMED: crontab.service.ts:17,31,45 `if (!process.env.HX_TRIGGER_CRONS) return` (string "false" is truthy); :60 returns env CAMAP_LOCAL_HOST; not in envSchema.ts (only grep hit is crontab.service.ts:60)] `camap-ts/packages/api-core/src/tools/crontab.service.ts:17,31,45`: `HX_TRIGGER_CRONS` is tested as truthy string, so `HX_TRIGGER_CRONS=false` still triggers. Daily cron fires at `EVERY_DAY_AT_MIDNIGHT` (`:43`) while the comment lists `15 0 * * *` (`:11`). `getCamapHaxeUrl()` returns `undefined` when `CAMAP_LOCAL_HOST` is unset (`:60`), producing the URL `undefined/cron/minute`; `CAMAP_LOCAL_HOST` is not in `api-core/src/envSchema.ts` (only `CAMAP_HOST`, `CAMAP_KEY` seen at `:10-12`).
7. [CONFIRMED: only definition at BridgeService.hx:88 for getAuthToken in camap-hx/src; User.hx:56-64 doGetToken signs JWT with App.config key] `camap-hx/src/service/BridgeService.hx:88-93` `getAuthToken` has no caller in `camap-hx/src`, while `camap-hx/src/controller/api/User.hx:56-64` mints its own JWT with the hx key; two token routes exist.
8. [CONFIRMED with line fix: config.xml.dist:19-20 (not :15-16) uses nest-camap; docker-compose.dev.yml:72 service nest-loc-camap, alias nest-devcamap at :113-115; production hostnames unverified] (verifier-corrected) `camap-hx/apache/camap-static.conf:13-27` proxies to hostname `nest-devcamap`, whereas `config.xml.dist:15-16` uses `nest-camap` and Compose names the service `nest-loc-camap` with network alias `nest-devcamap` (`docker-compose.dev.yml:72,113-115`). Production hostnames would need a different file (unverified).
9. [CONFIRMED security-relevant: Subscription.hx has no checkIsLogged/@logged anywhere; doDefault :27-58 dereferences app.user; getSubscription(sub) at :57/:149 with null sub; doUpdateOrders :60, doUpdateDefaultOrder :83, doCheckDefaultOrder :111. Whether the sugoi dispatcher or Api controller adds a global login guard not checked] `camap-hx/src/controller/api/Subscription.hx:27-58`: `doDefault(?sub)` with no POST and no `sub` calls `getSubscription(null)` (line 57, then `:149` dereferences `sub`), and the create branch dereferences `app.user` without `checkIsLogged()` (`:34-37`); same for `doUpdateOrders :60-80`, `doUpdateDefaultOrder :83-108`, `doCheckDefaultOrder :111` (no login or rights check, but also no data written).
10. [CONFIRMED security-relevant: Order.hx:12 doCatalogs and Product.hx doDefault/doGet have no login check (read-only); Order.hx:52,78,105 do call checkIsLogged()] `camap-hx/src/controller/api/Order.hx:12-30` (`/api/order/catalogs`) and `controller/api/Product.hx:13-29` (`/api/product/*`) have no `checkIsLogged()`; other order endpoints in the same file do (`Order.hx:52,78,105`).
11. [CONFIRMED: Distributions.hx:21,36 `function do...` without public; front POST at volunteersCalendar/requests.tsx:37-41 (useRestPostApi). Haxe visibility is compile-time only so dispatch likely works (runtime dispatch by sugoi PLAUSIBLE)] `camap-hx/src/controller/api/Distributions.hx:21` and `:36` are declared without `public` (all other `do*` are `public`); front calls `unsubscribeFromRole` with POST (`volunteersCalendar/requests.tsx:41`) though the handler is method-agnostic.
12. [CONFIRMED security-relevant: auth-bridge.controller.ts:47-48 @Get('delete-user/:id') state-changing GET, but class is guarded by @UseGuards(AuthGuard('bridge')) (:13); admin/User.hx:49 call, errors swallowed by Sys.println at :50-52 (checks app.user.isAdmin first)] `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:48`: user deletion is exposed as `GET /bridge/auth/delete-user/:id` (state-changing GET), invoked from hx (`controller/admin/User.hx:49`) which swallows errors with `Sys.println` (`:50-52`).
13. [CONFIRMED: Group.hx:6 imports service.BridgeService, Member.hx:6 imports haxe.Http; no other BridgeService reference in Group.hx; Http usage in Member.hx not found] `camap-hx/src/controller/Group.hx:6` imports `service.BridgeService` and `Member.hx:6` imports `haxe.Http` with no use found.
14. [CONFIRMED: useRestGetApi.tsx:5 module-level BASE_URL; runtimeCfg.ts:52-54 origin fallback; BridgeService.hx:53 /env.js pushed first] `camap-ts/packages/front-core/src/lib/REST/useRestGetApi.tsx:5`: `BASE_URL` is a module-level constant evaluated at import; if `/env.js` has not yet defined `__APP_CONFIG__`, it falls back to `window.location.origin` (`runtimeCfg.ts:52-55`); correct ordering depends on `BridgeService.hx:53` placing `/env.js` first.
15. [CONFIRMED: datasets.story.tsx:188 and :197; Api.hx:86 DEBUG guard] `camap-ts/packages/front-core/src/dev-tools/datasets.story.tsx:188` hardcodes `http://localhost/api/createSid`; endpoint only works when hx `DEBUG=true` (`Api.hx:86`) and the dataset password is hardcoded `'admin'` (`:197`).
16. [CONFIRMED: auth.service.ts:70-73 throws UnauthorizedException `Session not found with sid` if no session row] `camap-ts/packages/api-core/src/auth/auth.service.ts:70-74` login requires a pre-existing hx session row for the given `sid` (throws `Session not found with sid`), so Nest login cannot work without hx having created a session first; the `README`/docs do not state this coupling.
17. [CONFIRMED for test:cov omitting TZ=UTC (package.json:27 vs :29); collectCoverageFrom being relative to rootDir src is normal Jest behaviour, not an inconsistency; timezones.spec.ts exists at api-core/src/timezones.spec.ts] `camap-ts/packages/api-core/jest.config.js` `collectCoverageFrom` is relative to `rootDir: src` and `test:cov` omits `TZ=UTC` (`package.json:29` vs `:27`), whereas `timezones.spec.ts` asserts UTC.


## Verification summary

Confirmed: 29; Refuted: 0 (1 partially refuted: doc item 6 genTransactionIslet part); Plausible: 0. Line-number corrections: doc 1, doc 3 (27 Haxe test methods), code 4, code 8. Security-relevant confirmed: code 5 (/cron/* unauthenticated), code 9-10 (hx api endpoints without login check), code 12 (guarded GET delete-user), doc 11.
