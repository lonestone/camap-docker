# 05 - Cross-stack integration (camap-hx <-> camap-ts)

Scope: how the two runtimes interact today. Covers the integration channels, the full HX `/api/*` REST inventory with callers, the Nest `/bridge/*` routes, HX -> TS and TS -> HX calls, the neo-bundle bridge (BridgeService) between Haxe pages and React modules, tables written by both sides, shared authentication/session state (cookies, JWT, Bearer key), and a summary of the Nest GraphQL/REST surface with counts and a per-module list. Paths are relative to the `camap-docker` repo root. "unverified" marks claims not confirmed from code. The 03-draft path shortcuts were expanded (`HX/` = `camap-hx/src/`, `API/` = `camap-ts/packages/api-core/src/`, `FE/` = `camap-ts/packages/front-core/src/`, `TPL/` = `camap-hx/lang/master/tpl/`).

Sources: drafts 10 (part A), 09 (neo / BridgeService), 03 (shared session/auth), 11 (handler list, referenced not duplicated).

See inconsistencies-code.md / inconsistencies-documentation.md for the discrepancies found in this area (including unauthenticated `/cron/*` and several `/api/*` endpoints without login checks).

## 1. Overview and integration channels

- Two runtimes share one MySQL database. camap-hx (Neko/Apache) serves the legacy pages and a REST JSON API under `/api/*`. camap-ts (NestJS `api-core`, port 3010) serves GraphQL `/graphql`, the React bundles under `/neostatic`, locales under `/locales`, and a small REST "bridge" under `/bridge/*`. (Draft 10 places the HX vhost on port 3009 via `camap-hx/apache.conf:4`; the Docker image does not use that file, see `01-architecture.md` section 3.2.)
- Channels:
  1. Browser -> HX `/api/*` REST (React bundles built by camap-ts call HX for subscriptions, catalog, volunteers; the older Haxe-compiled React `OrderBox` calls HX too).
  2. Browser -> Nest `/graphql` (proxied by Apache from the HX host, `camap-hx/apache/camap-static.conf:15-18`).
  3. HX -> Nest `GET {camap_bridge_api}/bridge/*` with `Authorization: Bearer <config key>` (`camap-hx/src/service/BridgeService.hx:77-111`).
  4. HX -> Nest `GET {camap_bridge_api}/neostatic/manifest.json` on page renders until cached in a static var (`BridgeService.hx:12-21`).
  5. Nest -> HX `GET {CAMAP_LOCAL_HOST}/cron/{minute,hour,daily}` when `HX_TRIGGER_CRONS` is set (`camap-ts/packages/api-core/src/tools/crontab.service.ts:15-61`).
  6. Shared DB tables and shared cookies (`sid`, `Auth_sid`, `Authentication`, `Refresh`), sections 5 and 6.

## 2. HX `/api/*` endpoint inventory

Router: `controller.Api` (`camap-hx/src/controller/Api.hx:12`) dispatches `/api/<name>/...` to sub-controllers (`Main.doApi`, `camap-hx/src/controller/Main.hx:190-207`). Haxe Dispatch maps `doXxx` to `/xxx`; typed arguments (`db.User`, `db.Catalog`, ...) are path segments (ids); `?args:{...}` are query-string params. Auth for `/api/*` is the HX session (cookie `sid`) only; endpoints without `checkIsLogged()`/`@logged` do not enforce login themselves (how sugoi treats `app.user == null` globally is unverified). Error handling of the dispatcher is described in `01-architecture.md` section 8.1.

| URL | Method | Auth / rights | Payload -> response | Source | Callers found |
|---|---|---|---|---|---|
| `/api` | any | none | `{version, debug}` | `camap-hx/src/controller/Api.hx:18-25` | none found |
| `/api/planning/:groupId` | any | none (no login check) | list of distributions in next 2 months with place | `Api.hx:52-71` | none found |
| `/api/createSid` | any | only if `config.DEBUG` else throws | creates session without user, `{sid}` | `Api.hx:84-96` | `camap-ts/packages/front-core/src/dev-tools/datasets.story.tsx:188` (hardcoded `http://localhost/api/createSid`) |
| `/api/order/catalogs/:multiDistribId?catalogType=` | GET | none (no check) | `{success, catalogs[{id,name,image}]}`, skips disabled vendors | `camap-hx/src/controller/api/Order.hx:12-30` | `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:120` |
| `/api/order/get/:userId?catalog=&multiDistrib=` | GET | `checkIsLogged` + `canManageContract`/`canManageAllContracts` | `{success, orders}` | `Order.hx:50-70` | `OrderBoxThunk.hx:21` |
| `/api/order/update/:userId?catalog=&multiDistrib=` | POST JSON `{orders:[{id,productId,qt,paid,invertSharedOrder,userId2}]}` | same as get | `{success, orders}` | `Order.hx:76-97` | `OrderBoxThunk.hx:99` |
| `/api/order/updateOrderQuantity/:userId?catalog=&multiDistrib=` | POST JSON `{id, qt}` | same as get | `{success, subTotal,total,fees,basketTotal,nextQt}` | `Order.hx:103-132` | `camap-hx/js/App.hx:169` |
| `/api/distributions/unsubscribeFromRole/:multiDistribId/:roleId` | any (front uses POST) | `checkIsLogged`, caller must be the volunteer | `{success:true}` or error 422/403 | `camap-hx/src/controller/api/Distributions.hx:21-31` | `camap-ts/packages/front-core/src/modules/volunteersCalendar/requests.tsx:37-41` |
| `/api/distributions/volunteerRolesCalendar?from=&to=` | GET | none explicit; uses `app.getCurrentGroup()` | `{multiDistribs[], roles[]}` | `Distributions.hx:36-86` | `volunteersCalendar/requests.tsx:29` |
| `/api/places/:placeId` | GET only (405 otherwise) | none | `{name,address1,address2,city,zipCode,lat,lng}` | `camap-hx/src/controller/api/Places.hx:13-24` | none found |
| `/api/catalog/:catalogId` | GET | none explicit (`getVisibleDocuments(app.user)`) | catalog + products + vendor + distributions + constraints + absences | `camap-hx/src/controller/api/Catalog.hx:14-43` | `camap-ts/packages/front-core/src/modules/csaCatalog/requests.tsx:19-24` |
| `/api/catalog/catalogAbsences/:catalogId` | GET | none explicit | absence window + possible absent distribs | `Catalog.hx:48-55` | `csaCatalog/requests.tsx:45-50` |
| `/api/catalog/stocksPerProductDistribution/:catalogId` | GET | none explicit | `{productId:{distribId:stock}}` or empty | `Catalog.hx:57-72` | `csaCatalog/requests.tsx:32-37` |
| `/api/catalog/subscriptionAbsences/:subscriptionId` | GET + POST JSON `{absentDistribIds:[...]}` | owner or `canManageContract`; 403 if catalog has no absence management; 400 on empty list for non-manager | current absences, closed ids, possible distribs | `Catalog.hx:77-123` | `csaCatalog/requests.tsx:126-149`; also `camap-ts/packages/front-core/src/modules/batchOrder/BatchOrder.module.tsx:12` |
| `/api/subscription[/:subId]` | POST JSON `NewSubscriptionDto` creates; otherwise returns sub | create: admin / catalog manager / group manager / self; closed orders blocked for non-managers | subscription JSON (user, constraints, distributions with orders, defaultOrder, balance...) | `camap-hx/src/controller/api/Subscription.hx:27-58,149-203` | `csaCatalog/requests.tsx:72,112` |
| `/api/subscription/updateOrders/:subId` | POST JSON `{distributions:[...]}` | owner / admin / catalog manager | subscription JSON | `Subscription.hx:60-80` | `csaCatalog/requests.tsx:93` |
| `/api/subscription/updateDefaultOrder/:subId` | POST JSON `CSAOrder[]` | owner / admin / catalog manager | subscription JSON; `InvalidParameters` typed error on failure | `Subscription.hx:83-108` | `csaCatalog/requests.tsx:104` |
| `/api/subscription/checkDefaultOrder/:catalogId` | POST JSON `CSAOrder[]` | none explicit | `{defaultOrderCheck:true}` or throws | `Subscription.hx:111-132` | `csaCatalog/requests.tsx:157-161` |
| `/api/user/me` | GET / POST multipart | session user, else 401; POST edits address1/2, city, zipCode, phone | `user.infos()` | `camap-hx/src/controller/api/User.hx:18-39` | none found |
| `/api/user/getFromGroup` | GET | `@logged` + `canAccessMembership` or contract manager (403) | `{users:[UserInfo]}` | `User.hx:44-53` | `OrderBoxThunk.hx:44` |
| `/api/user/getToken` | GET | `@logged` | `{token}` JWT `{email,id}` signed with the HX `config.key` | `User.hx:56-64` | none found |
| `/api/product/:productId` | GET | none | `product.infos()` | `camap-hx/src/controller/api/Product.hx:13-15` | none found |
| `/api/product/get?catalogId=` | GET | none | `{products[]}` | `Product.hx:22-29` | `OrderBoxThunk.hx:150,156` |

Notes
- 25 routes. The front-core REST client builds URLs as `{CAMAP_HOST}/api{path}` with `credentials:'include'` (`camap-ts/packages/front-core/src/lib/REST/useRestGetApi.tsx:5,26-30`, `useRestPostApi.tsx:22-30`), so these calls go to the HX origin (same-site cookies).
- The base URL is read at module load from `window.__APP_CONFIG__` (`camap-ts/packages/front-core/src/lib/runtimeCfg.ts:14-16,47-57`), which HX serves as `/env.js` (generated by `camap-hx/entrypoint.sh:35-62`, injected first by `BridgeService.hx:53`). If `__APP_CONFIG__` is not yet defined, `BASE_URL` falls back to `window.location.origin` (`runtimeCfg.ts:52-55`; `useRestGetApi.tsx:5`), so correct ordering depends on `BridgeService.hx:53` placing `/env.js` first.
- Endpoints with "none found" callers might be used by third parties or mobile clients: unverified.
- Observed code facts for specific endpoints: `Subscription.hx` has no `checkIsLogged()`/`@logged` anywhere; `doDefault` with no POST and no `sub` calls `getSubscription(null)` (`Subscription.hx:57,149`) and the create branch dereferences `app.user` (`:34-37`). `Order.hx:12` (`/api/order/catalogs`) and `controller/api/Product.hx:13-29` have no `checkIsLogged()`, whereas other order endpoints do (`Order.hx:52,78,105`). `Distributions.hx:21,36` are declared without `public` (all other `do*` are `public`).

## 3. Calls between the stacks

### 3.1 HX -> TS
All use `camap_bridge_api` / `camap_api` from `config.xml` (sample `camap-hx/config.xml.dist:19-20`: both `http://nest-camap:3010`).

| Call | Where | Auth | Purpose |
|---|---|---|---|
| `GET {bridge}/neostatic/manifest.json` | `BridgeService.hx:12-21` (via `getNeoModuleScripts`, `camap-hx/src/View.hx:281-283`, used in `camap-hx/lang/master/tpl/base.mtt:118`) | Bearer key header | Webpack manifest; keys `runtime.js, vendors.js, reactlibs.js, neo.js, app.js` are normalised to `/neostatic/...` (`BridgeService.hx:24-60`). Fallback: Neko `Cache("manifest")` 1 h, written with probability 1/10 (`BridgeService.hx:63-74`); if both fail it throws "Unable to load ressources from CAMAP-ts." |
| `GET {bridge}/bridge/auth/logout/:userId` | `BridgeService.logout` `:95-101`, called from `camap-hx/src/controller/User.hx:83` | Bearer | removes the refresh token in Nest (`camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:34-46`) |
| `GET {bridge}/bridge/auth/delete-user/:userId` | `BridgeService.call` from `camap-hx/src/controller/admin/User.hx:49` (checks `app.user.isAdmin` first; errors swallowed by `Sys.println`, `:50-52`) | Bearer | deletes the user via Nest `usersService.delete` (`auth-bridge.controller.ts:48-60`) |
| `GET {bridge}/bridge/mail/getUnsentMails` | `camap-hx/src/controller/admin/Admin.hx:72` | Bearer | admin screen listing unsent buffered mails (`camap-ts/packages/api-core/src/mails/controllers/mail-bridge.controller.ts:10-13`) |
| `GET {bridge}/bridge/auth/tokens/:userId` | `BridgeService.getAuthToken` `:88-93` | Bearer | no caller found in `camap-hx/src`; endpoint exists at `auth-bridge.controller.ts:21-32` |
| `{camap_api}/graphql` | `View.getGraphqlUrl` `camap-hx/src/View.hx:277-279` | n/a | URL given to templates |
| Apache proxy `/neostatic/`, `/graphql`, `/locales/` -> `http://nest-devcamap:3010` | `camap-hx/apache/camap-static.conf:12-27` | none | browser-side proxy; also bypasses mod_neko (`:29-39`) |

Bridge guard: `AuthGuard('bridge')` = passport-http-bearer; valid iff the token equals `CAMAP_KEY` (`camap-ts/packages/api-core/src/auth/strategies/bridge.strategy.ts:12-14`). HX sends its `key` config value (`BridgeService.hx:103-110`). Nothing enforces that the two secrets match in code; `camap-hx/scripts/update-config.pl:24-26` sets HX `key` from `PW_HASH_KEY`, while Nest reads `CAMAP_KEY` (`camap-ts/packages/api-core/src/envSchema.ts:12`).

HX also computes an outbound JWT in `/api/user/getToken` (`camap-hx/src/controller/api/User.hx:58`) signed with the HX key, whereas Nest's JWT strategy verifies the `Authentication` cookie with `JWT_ACCESS_TOKEN_SECRET` (`camap-ts/packages/api-core/src/auth/strategies/jwt.strategy.ts:15-19`); whether the secrets coincide in deployments is unverified. Two token routes therefore exist (`BridgeService.getAuthToken` is unused).

Other HX outbound HTTP: Mapbox geocoding via Curl (`camap-hx/src/service/Mapbox.hx:25-40`); `haxe.Http` is imported in `camap-hx/src/controller/Member.hx:6` with no use found; `service.BridgeService` is imported in `camap-hx/src/controller/Group.hx:6` with no other reference.

### 3.2 TS -> HX
| Call | Where | Notes |
|---|---|---|
| `GET {CAMAP_LOCAL_HOST}/cron/minute`, `/cron/hour`, `/cron/daily` | `camap-ts/packages/api-core/src/tools/crontab.service.ts:15-55`, URL from `process.env.CAMAP_LOCAL_HOST` (`:57-61`) | Only when `HX_TRIGGER_CRONS` is truthy (`:17,31,45`). Schedules: every minute, every hour, `EVERY_DAY_AT_MIDNIGHT` (comment at `:11` mentions 00:15). Errors are only logged. HX `Cron.canRun()` always returns true (`camap-hx/src/controller/Cron.hx:36-38`), so these URLs are unauthenticated. HX handlers: `doMinute :58`, `doHour :92`, `doDaily :340`. When `CAMAP_LOCAL_HOST` is unset `getCamapHaxeUrl()` returns `undefined` (`:60`), producing the URL `undefined/cron/minute`; it is not in `envSchema.ts`. |
| Browser (front-core) -> `{CAMAP_HOST}/api/*` | section 2 | via `getRestBaseUrl()` (`runtimeCfg.ts:47`) |
| `CAMAP_HOST` used for links in mails, locales path, group links | `camap-ts/packages/api-core/src/mails/mails.service.ts:350,369`, `.../groups/resolvers/group-previews-members.resolver.ts:242,311`, `camap-ts/packages/front-core/src/lib/runtimeCfg.ts:24-28` | |
| Nest cookie names expected from HX | `sid` (HX session, `camap-ts/packages/api-core/src/auth/strategies/cookie.strategy.ts:8`) and `Auth_sid` | section 6 |

Other Nest-side crons (independent of HX): mails buffer every minute (`camap-ts/packages/api-core/src/mails/mails.service.ts:185`), messages daily (`messages/messages.service.ts:79`), cache clean 01:00 (`tools/cache.service.ts:55`), users 01:00 (`users/users.service.ts:442`). Trigger configuration is in `01-architecture.md` section 7.

## 4. Neo modules and the BridgeService (Haxe pages hosting React)

Detail of templates, module registry and i18n is outside this file; the integration-relevant facts are:

- Every page is rendered by HX. React code from camap-ts is mounted into those pages as "neo modules": the webpack bundle `neo.js` exposes the global `neo.createNeoModule(containerId, moduleName, props)` (`camap-ts/packages/front-core/src/neo.tsx:149-195`, `webpack.config.js:32-34,102-103`). A second, older client layer is Haxe-JS (`camap-hx/js/**` -> `camap-hx/www/js/app.js`) with the global `_Camap` singleton (`camap-hx/js/App.hx:61-64`).
- Script discovery: `View.getNeoModuleScripts()` -> `BridgeService.getNeoModuleScripts()`; the manifest is fetched from `<camap_bridge_api>/neostatic/manifest.json` with curl, once per process (`camap-hx/src/service/BridgeService.hx:12-20`). The returned list is `/env.js`, then `runtime.js`, `vendors.js`, `reactlibs.js`, `neo.js`, `app.js` (`BridgeService.hx:44-63`). If Nest is down at render time, every page render fails (`base.mtt:118` always calls it).
- `/env.js` carries `window.__APP_CONFIG__` (PUBLIC_PATH, API_HOSTNAME, API_PORT, CAMAP_HOST, CAMAP_BRIDGE_API, FRONT_URL, FRONT_GRAPHQL_URL, MAPBOX_KEY), consumed by `runtimeCfg.ts:14-20` and `set-public-path.ts:11-22` (`camap-ts/packages/front-core/src/`).
- Module contract: a DOM element with a unique `id` must exist (else `Could not get element by id`, `neo.tsx:154-155`); `createNeoModule` is called after DOMContentLoaded; props are plain JSON-able values; only `onClose` is injected for `place-dialog` and `imageUploaderDialog` (`neo.tsx:157-159,183-189`); the module name must be a key of the `modules` record (26 keys, `neo.tsx:42-147`), else `Unknown module: <name>` (`:172-174`). Most modules use `ApolloWrapper` (MUI ThemeProvider + date-fns FR locale + Suspense + Apollo); `haxeDatePicker`, `vatBox`, `volunteersCalendar` use the plain `Wrapper` (`neo.tsx:17-40,73-75,125-127,143-146`).
- Template macro: `$$neoModule(containerId, module, args)` (`camap-hx/lang/master/tpl/macros.mtt:3-9`); `View.neoArgs(args)` serialises a Haxe anonymous object into JS literal text, only String/Int/Float/null/nested objects (`camap-hx/src/View.hx:285-302`). Generic pages `neo.mtt` and `neoPublic.mtt` render a module named by `view.containerId/module/args` (used by `Vendor.doView` -> `vendorProfile`, `Vendor.doDashboard` -> `vendorDashboard`, `camap-hx/src/controller/Vendor.hx:21-48`).
- Client-side routing: `Members`, `VendorDashboard`, `VendorProfile` use `BrowserRouter` with a `basename` passed by Haxe; the HX controller must dispatch the sub-paths to the same template (`Vendor.doView(d:haxe.web.Dispatch, ...)`, `Vendor.hx:19-21`).
- Data access from neo modules: GraphQL at `FRONT_GRAPHQL_URL` or `/graphql` (`runtimeCfg.ts:22-25`) and legacy REST on the HX host (`getRestBaseUrl`, `runtimeCfg.ts:49-59`). `View.getGraphqlUrl()` = `camap_api + "/graphql"` (`View.hx:277-279`).
- Global `app` bundle: `camap-ts/packages/front-core/src/app.ts:18-21` sets `window._Camap.clearNotifications` ("while there is both HaXe and TS fronts, let HaXe setup the _Camap global object"); called from `CsaCatalogPresentation.tsx:74`.
- Haxe-JS helpers that mount neo modules: `getVATBox`, `openImageUploader`, `loginBox`/`registerBox`, `membershipBox` (`camap-hx/js/App.hx:75-92,94-111,259-284,286-304`). Login/registration in particular is a React module (`loginRegistration`) mounted by `camap-hx/lang/master/tpl/user/login.mtt:29-33` talking GraphQL to Nest; HX itself contains no code that creates accounts or checks a login password.
- HX and TS i18n and themes are independent: no strings are shared; the only shared data is the `theme` object injected as `_Camap.theme` (`base.mtt:98-102`) used for i18next interpolation (`camap-ts/packages/front-core/src/lib/i18n.ts:39-42`). The Haxe theme is stored in `Variable.whiteLabel` and ignored by TS (`02-data-model.md` section 7). The `attention` module is mounted at `camap-hx/lang/master/tpl/attention/default.mtt:7` but has no key in `neo.tsx:42-147`.
- Build/serve: Nest serves `/neostatic` with immutable caching (`camap-ts/packages/api-core/src/main.ts:60-72`); in dev compose `./camap-ts/public` is mounted at `/srv/public` of the HX container (`docker-compose.dev.yml:108`). See `01-architecture.md` sections 3 and 5.

## 5. Shared database state

- One MySQL schema. HX tables are described by `sys.db.Object` classes in `camap-hx/src/db`; Nest maps its `@Entity` classes (29 per grep of `@Entity(` in `api-core/src`) with `camap-ts/ormconfig.js:33` (naming strategy `orm-naming-strategy.js`) and runs its own migrations (`camap-ts/packages/api-core/src/migrations`, `camap-ts/packages/api-core/ormconfig.js:5-10`). Migrations are not run by the Docker CMD (`camap-ts/camap-ts.Dockerfile:65`); `start:prod` runs them (`camap-ts/packages/api-core/package.json:25`). Full table ownership is in `02-data-model.md`.
- Tables written by Nest (repositories with save/insert/update/delete): Session (`camap-ts/packages/api-core/src/auth/session.service.ts`, `users/users.service.ts`), User (`users.service.ts`), UserGroup, Membership, WaitingList, Group (`groups/services/*`), CsaSubscription, UserOrder, Basket, Operation (`groups/services/csa-subscriptions.service.ts`, `payments/services/*`), Vendor, Catalog, Product (`vendors/services/*`), Distribution, MultiDistrib, DistributionCycle (`shop/services/*`), Message (`messages/messages.service.ts`), BufferedJsonMail (`mails/mails.service.ts`), Cache (`tools/cache.service.ts`), Variable (`tools/variable.service.ts`), File, EntityFile (`files/file.service.ts`, `tools/entityFile.service.ts`).
- Mail buffer: `BufferedJsonMail` is filled by HX (`camap-hx/src/mail/BufferedJsonMailer.hx:9`, instantiated at `camap-hx/src/App.hx:352`) and drained/sent by the Nest cron (`camap-ts/packages/api-core/src/mails/mails.service.ts:185-215`), so HX never sends mail itself. `BufferedJsonMail.send()` builds an SMTP config from `Variable` `smtp_*` (`camap-hx/src/db/BufferedJsonMail.hx:82-85`).
- Subscriptions/orders created by the React bundles go through HX `/api/subscription/*` (HX writes), while Nest also has repositories for the same tables (CsaSubscription, UserOrder): two writers for the same tables.
- `Session` table: HX (sugoi) creates sessions (`App.current.session.sid`, `camap-hx/src/View.hx:328`); Nest only updates `uid`/`lastTime` on login (`camap-ts/packages/api-core/src/auth/auth.service.ts:70-79`, throws `Session not found with sid` if the sid is unknown) and deletes on logout (`auth.service.ts:176-189`). Entity: `camap-ts/packages/api-core/src/tools/models/session.entity.ts:7-41` (`sdata`, `messages` mediumblob are HX-serialised; a `TODO` at `auth.service.ts:76` concerns `sdata.whichUser`). Nest login therefore requires that HX has created the session row first.
- Nest never reads `Session.sdata`/`amapId`: the current group is HX-only (`session.data.amapId`, `camap-hx/src/App.hx:160-171`, `camap-hx/src/db/User.hx:318-329`) and groups are passed as ids by HX to React/GraphQL.
- `Variable` table is read/written by both with different key sets (`02-data-model.md` section 7).
- File URLs: Nest computes `/file/{id}_{md5(id+CAMAP_KEY)}` (`camap-ts/packages/api-core/src/files/file.service.ts:56-72`), the same scheme HX exposes (`camap-hx/src/controller/api/Catalog.hx:31` uses `sugoi.db.File.makeSign`, library code not inspected: equivalence unverified). `CryptoService.sha1/md5` prefix with `CAMAP_KEY` (`camap-ts/packages/api-core/src/tools/crypto.service.ts:8-22`), used by `operation.resolver.ts:8,24`.

## 6. Shared authentication and session

### 6.1 Models in parallel
- HX: cookie `sid` (set by sugoi `BaseApp.setCookie`, `Max-Age=2629746`, path `/`, optional `cookie_domain`) -> row in `Session` (sugoi `BaseApp.hx:204-206,212-221`, `sugoi/db/Session.hx:79-102`, external lib pinned at `camap-hx/backend/haxe_libraries/sugoi.hxml:1`). `Session.uid != null` means logged in; `Session.sdata` is Haxe/Neko-serialized (`sugoi/db/Session.hx:50-58`), unreadable by TS (`session.entity.ts:29-30`).
- TS: JWT access cookie `Authentication` (httpOnly), refresh cookie `Refresh` (bcrypt hash stored in `User.currentRefreshToken`), plus `Auth_sid` mirroring the HX sid (`camap-ts/packages/api-core/src/auth/auth.service.ts:16-18,234-278`).
- Bridge: login from TS writes `Session.uid` for the sid passed by the browser (`auth.service.ts:70-78`); HX calls TS with `Authorization: Bearer <key>` (`BridgeService.hx:103-111`); TS validates it against `CAMAP_KEY` (`bridge.strategy.ts:12-14`).

### 6.2 Cookies
| Cookie | Set by | Read by | Notes |
|---|---|---|---|
| `sid` | HX (sugoi session) | HX; Nest `CookieStrategy` (`camap-ts/packages/api-core/src/auth/strategies/cookie.strategy.ts:8`); Nest guard `checkSidSync` (`camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:85-91`) | |
| `Auth_sid` | Nest login (`auth.service.ts:272-278`), set when the login input has `sid` (`camap-ts/packages/api-core/src/auth/auth.resolver.ts:177-179`) | HX `Main.doHome :70-76` (`camap-hx/src/controller/Main.hx`) and `camap-hx/src/controller/User.hx:30-35` (redirects to `/user/logout` on mismatch), Nest guard | login `sid` comes from the HX template (`camap-hx/src/service/UserService.hx:71`) |
| `Authentication` (JWT access) | Nest (`auth.service.ts:234-240`) | Nest `JwtStrategy` (`jwt.strategy.ts:15`, extractor `cookie-extractors.ts:4-6`) | httpOnly (not in development: `auth.service.ts:194`) |
| `Refresh` (JWT refresh) | Nest | Nest guard fallback (`gql-auth-abstract-guard.ts:171-178`) | |

### 6.3 Flows
- Login/register are GraphQL mutations in Nest (`auth.resolver.ts`): HX page renders; sugoi creates/loads `Session` from cookie `sid` (sugoi `BaseApp.hx:210-221`); the HX template passes `session.sid` to the React module; `login(email,password,sid)` -> `AuthService.login` sets `User.ldate`, `Session.uid`, `Session.lastTime` for that sid and returns JWT cookies + `Auth_sid=<sid>`. On the next HX request sugoi loads `Session.user` => `app.user`; on the next GraphQL request `GqlAuthGuard` checks `Auth_sid == sid` then the JWT. Redirect after login uses `view.redirect` from `redirect`/`__redirect` params (`camap-hx/src/controller/User.hx:41-48`). (`camap-hx/src/controller/User.hx:32-37`, `Main.hx:70-77`: HX `/user/login` and `/home` redirect to `/user/logout` on mismatch.)
- Registration: `register` mutation -> `AuthService.registerAndLogin` -> `register` (md5+bcrypt hashes, flags, `lang='fr'`) -> `login`; with `invitedGroupId` a `UserGroup` row is created (`auth.resolver.ts:69-107,99-104`, `auth.service.ts:84-156`). No welcome/confirmation email and no email verification exist in this path.
- Logout: clears the three cookies server-side from either stack: Nest (`auth.service.ts:176-203`) and HX (`camap-hx/src/controller/User.hx:82-114`, three redirects because Haxe cannot set several Set-Cookie headers, `User.hx:90-95`); HX also calls the bridge `logout` (`User.hx:83`).
- `GqlAuthGuard` flow (`camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:81-92,160-228`): (a) if cookies `Auth_sid` and `sid` both exist and differ -> error `Neko/Nest logged state sync error`; (b) valid access token -> passport jwt; (c) else the refresh token cookie must verify AND match the bcrypt hash in DB, then new access+refresh tokens are issued and cookies written; (d) on any failure (outside `NODE_ENV=test`) delete session + refresh token of `Auth_sid`, clear the 3 cookies, deny (or for `MaybeAuthGuard`, continue anonymously via `void` strategy). `getUserIfRefreshTokenMatches` can return `undefined`, after which the guard calls `getAccessToken(user)` which throws and is caught by (d) (`gql-auth-abstract-guard.ts:195-200`, `users.service.ts:188-202`).
- Password reset is HX-only (`camap-hx/src/controller/User.hx:120-226`): token `md5("chp" + random(1e9))` stored in `Cache` (value user id, 30 days); TS member import consumes the same `chp-` cache key format.
- Impersonation: HX `/member/loginas/<id>` (`camap-hx/src/controller/Member.hx:92-96`) and TS `loginAs` mutation.
- Group selection: `/user/choose?group=ID` sets `session.data.amapId` without checking membership (`camap-hx/src/controller/User.hx:64-74`).
- Rights: site-wide `User.rights` bit 0 = super admin (HX `RightSite.Admin`, `camap-hx/src/db/User.hx:16-18`; TS `RightSite.SuperAdmin`, `camap-ts/packages/api-core/src/users/models/user.entity.ts:14-16`); per group `UserGroup.rights` JSON array `GroupAdmin | ContractAdmin(cid?) | Membership | Messages` (`camap-hx/src/db/UserGroup.hx:7-12`, `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:24-29`) plus HX-only computed auto-rights `ContractAdmin(cid)` for catalogs of vendors claimed by the user (`UserGroup.hx:72-79`). Rights writes are HX-only (`/amapadmin/editRight`); rights reads exist on both sides.
- Server-to-server auth: Bearer `CAMAP_KEY` (section 3.1). Cron endpoints on HX: no auth.
- Password hashing/links: HX `MD5(key + pass)` (`camap-hx/src/db/User.hx:278`); TS `CryptoService` prefix with `CAMAP_KEY`; see `01-architecture.md` section 6.3 for the shared secret usage.

### 6.4 HX <-> TS ownership (users/groups)
| Capability | HX | TS |
|---|---|---|
| Register | none | `register` |
| Login / logout | session write side effect only; logout redirect chain `camap-hx/src/controller/User.hx:82-114` | `login`, `logout`, JWT, `Auth_sid` |
| Password reset / change | yes (only place) `User.hx:120-226` | none |
| Email change | none | `updateUser` |
| Profile edit | `/api/user/me` POST (address/phone) | `updateUser` (React `userAccount`) |
| Notification flags | `Member.doView` display only | `updateUserNotifications` |
| Account deletion | superadmin delete -> bridge | `deleteAccount`, bridge `delete-user`, cron purge |
| Superadmin flag, backoffice | `/admin/*`, `/db` | `loginAs` only |
| Group creation | `/group/create` (superadmin) | none |
| Group settings (name, regOption, flags, membership settings, rights) | forms in `/amap/edit`, `/amapadmin/*` | `setGroupImage` only |
| Group public page / map / disabled | `/group/*` (map/disabled React) | `groupPreview*`, `getGroupsOnMap` |
| Current group selection | `session.data.amapId` | none |
| Rights read / write | `camap-hx/src/db/User.hx`, `UserGroup.hx` / `/amapadmin/editRight` | `UserGroupsService` / none |
| Members list / import / invite / remove | `/member` page shell only; `/member/delete` still routable | React members module + resolvers |
| Waiting list: register | `/group/list`, `/group/listCancel` | none |
| Waiting list: approve/refuse/move back | `/member/movetowl` (still routable) | `approveRequest`, `cancelRequest`, `moveBackToWaitingList` |
| Quit group | `/user/quitGroup*` (page shell + checks) | `quitGroup`, `quitGroupByControlKey` |
| Membership settings | `/amapadmin/membership` | none |
| Membership CRUD | none (opens React dialog) | `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts` |
| Session purge | `camap-hx/src/controller/Cron.hx:381` | none |
| Inactive user purge | none | `UsersService.cleanUsers` |

### 6.5 Files and static
- Nest serves `/neostatic` from `/srv` (`camap-ts/packages/api-core/src/main.ts:58-60`, `srvRoot = "/srv"`). HX writes `/srv/www/env.js` at container start (`camap-hx/entrypoint.sh:35-62`).
- CORS on Nest in production: `[FRONT_URL, CAMAP_HOST]`, credentials true (`main.ts:32-45`).

## 7. GraphQL / REST surface of api-core (summary)

The complete handler-by-handler list (181 handlers with guards and behaviour for the less-documented ones) is in `task/refacto-hx-ts/docs/_drafts/11-gaps.md` section 3; it is not duplicated here.

### 7.1 Counts
- GraphQL schema is code-first generated: `autoSchemaFile: src/schema.gql` (`camap-ts/packages/api-core/src/app.module.ts:48`), 753 lines. `type Query` at `src/schema.gql:531` (50 fields), `type Mutation` at `:584` (31 fields), no GraphQL `Subscription` type. Verified against decorators: 50 `@Query`, 31 `@Mutation`/`@TransactionalMutation` (26 + 5; `TransactionalMutation` = `Transactional()` + `Mutation()`, `camap-ts/packages/api-core/src/common/decorators/transactional-mutation.decorator.ts:5-7`).
- Across all decorators in `api-core/src` (specs excluded): 181 handlers = 50 `@Query`, 26 `@Mutation`, 5 `@TransactionalMutation`, 82 `@ResolveField`, 11 `@Get`, 7 `@Cron`. No `@Post`, `@Put`, `@Delete`, `@Patch` or `@Subscription` exists.
- Front-core consumes the schema via generated hooks in `camap-ts/packages/front-core/src/gql/index.tsx` (`graphql-codegen`, `gen:gql` script). Guards: `GqlAuthGuard` = passport `jwt` strategy with refresh fallback (`common/guards/gql-auth.guard.ts`, `gql-auth-abstract-guard.ts:121-200`). There is no `APP_GUARD` or global guard (`app.module.ts:66-75`; `main.ts` has no `useGlobalGuards`), so public vs protected is per resolver/class.

### 7.2 GraphQL operations per resolver file (all under `camap-ts/packages/api-core/src`; Q = queries, M = mutations)
Per-file counts are from `grep -c` of decorators; operation names from `src/schema.gql:531-615`; the mapping of a few names to a file (e.g. `isEmailRegistered`) is inferred (unverified).

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
| groups | `csa-subscriptions.resolver.ts` | 0 | 0 | no query/mutation decorators (file exists; exposes `CsaSubscription` fields such as `balance`) |
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

Resolver files under `shop/`, `groups/resolvers/`, `vendors/resolvers/` as listed in draft 11 section 3 carry the corresponding path prefixes (e.g. `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts`). The TS GraphQL layer exposes no distribution/subscription/order write mutation; those writes happen through HX `/api/*` (section 2) or HX pages.

### 7.3 REST controllers in api-core
| Route | Guard | Purpose | Source |
|---|---|---|---|
| `GET /health`, `GET /ping` | none | `{version}` | `camap-ts/packages/api-core/src/tools/tools.controller.ts:11-22` |
| `GET /bridge/auth/tokens/:id` | Bearer CAMAP_KEY | JWT (`{email,id}`) for user id | `auth/controllers/auth-bridge.controller.ts:21` |
| `GET /bridge/auth/logout/:id` | Bearer | remove refresh token (`usersService.removeRefreshToken`) | `:34` |
| `GET /bridge/auth/delete-user/:id` | Bearer | delete user (`usersService.delete`; state-changing GET) | `:48` |
| `GET /bridge/mail/getUnsentMails` | Bearer | unsent buffered mails | `mails/controllers/mail-bridge.controller.ts:10` |
| `GET /mails/get/:templateName/:params` | JWT + superadmin | render a twig template with JSON params | `mails/controllers/mails.controller.ts:36` |
| `GET /mails/list` | JWT + superadmin | list templates | `mails.controller.ts:67` |
| `GET /files/get/:id`, `/files/compress/:id`, `/files/compressAll/:page` | JWT + superadmin | dev/admin file tools (compress overwrites blobs in place) | `files/file.controller.ts:33,51,90` |
| `/neostatic/*`, `/locales/*` | none | static bundle / i18n | `main.ts:58+` |
| `POST /graphql` | per resolver | GraphQL | `app.module.ts:46-48` |

### 7.4 Per-module consumers
GraphQL operations are consumed by front-core hooks (`camap-ts/packages/front-core/src/gql/index.tsx`) and, for login/registration, mounted inside HX pages. Examples of gql sources: members (`camap-ts/packages/front-core/src/modules/members/members.gql.ts:71,109,117,125`), membership (`camap-ts/packages/front-core/src/modules/membership/membership.gql.ts:4-40`).
