# 09 - Frontend and rendering layer: Haxe templates, Haxe-JS, neo modules, theme, i18n

Scope: what the code does today. All paths are relative to the `camap-docker` root. "unverified" marks claims I could not confirm in the repo.

## 1. Overview

- Every page the user navigates to is rendered **server-side by camap-hx** (Haxe/Neko, Templo `.mtt` templates, Sugoi framework). There is no pure-TS page: front-core has no top-level router or app shell (see section 3.4).
- React code from camap-ts is injected into those pages as **"neo modules"**: a webpack bundle (`neo.js`) exposes the global `neo.createNeoModule(containerId, moduleName, props)` which mounts a lazily loaded React 18 component in a `<div>` of the Haxe page (`camap-ts/packages/front-core/src/neo.tsx:149-195`, `camap-ts/packages/front-core/webpack.config.js:32-34,102-103`).
- A second, older client layer is **Haxe-JS** (`camap-hx/js/**` compiled to `camap-hx/www/js/app.js`) which defines the global `_Camap` (alias `_`) singleton with helper functions called from template `onclick=` handlers (`camap-hx/js/App.hx:61-64`). It also holds a legacy React 16 + Redux + material-ui v4 "order box" (`camap-hx/js/App.hx:113-143`).
- Two translation systems coexist: gettext `.po/.mo` + per-language template copies on the Haxe side, and i18next JSON files served by camap-ts on the React/mail side. They share no strings (section 6).
- Theming is double: Haxe loads a `Theme` JSON from the `Variable` table (`whiteLabel`) and picks CSS from `www/theme/<id>/`; React uses a MUI theme compiled from `src/theme/default` (section 7).

## 2. Rendering pipeline (end to end)

### 2.1 Request to HTML

1. Apache (mod_neko) serves `camap-hx`; it reverse-proxies `/neostatic/`, `/graphql`, `/locales/` to Nest (port 3010) and bypasses Neko for these paths and `/env.js` (`camap-hx/apache/camap-static.conf:15-40`). The proxy target host is hard-coded as `nest-devcamap` (`camap-hx/apache/camap-static.conf:16`), whereas `config.xml.dist` uses `nest-camap` for `camap_api`/`camap_bridge_api` (`camap-hx/config.xml.dist:19-20`).
2. Route dispatch is Sugoi/`haxe.web.Dispatch`: controller classes with `doXxx` methods; `Main` delegates sub-controllers (e.g. `doGroup(d)` calls `d.dispatch(new controller.Group())`, `camap-hx/src/controller/Main.hx:55-64`). `doDefault` handles maintenance mode, then permalinks, else redirect `/home` (`camap-hx/src/controller/Main.hx:34-53`). Methods annotated `@tpl("x.mtt")` choose the template (e.g. `camap-hx/src/controller/Main.hx:66`).
3. Controller sets properties on `view` (class `View`, `camap-hx/src/View.hx`); the `.mtt` is rendered. Most pages `::use 'design.mtt'::` (which wraps `base.mtt`), public vendor page uses `neoPublic.mtt` (`::use 'base.mtt'::`, `camap-hx/lang/master/tpl/neoPublic.mtt:1`).
4. `base.mtt` emits, in order: Bootstrap 3 CSS and `style(.min).css` from `/theme/<theme.id>/css/<getVariable('css')>/` (`camap-hx/lang/master/tpl/base.mtt:31-38`), `/font/icons.css` (`:42`), Leaflet CSS from unpkg (`:45`), then scripts `fetch.umd.js`, `libs.prod.js`, `app.js` from `/js/<getVariable('js')>/` (`:50-53`). `libs.prod.js` is the vendored lib bundle (rollup, `camap-hx/frontend/libs/rollup.config.js`) and `app.js` is the Haxe-JS output (`camap-hx/frontend/build.hxml:28`).
5. At the end of `<body>`, an inline script sets `_Camap.theme` (id, name, supportEmail), then on DOMContentLoaded sets `_Camap.lang/userId/userName/userEmail/version` and calls `_Camap.antiDoubleClick()` (`camap-hx/lang/master/tpl/base.mtt:98-115`). Then `::foreach script getNeoModuleScripts()::` emits the neo bundle `<script>` tags (`:118-120`).

### 2.2 neo bundle discovery (BridgeService)

- `View.getNeoModuleScripts()` delegates to `BridgeService.getNeoModuleScripts()` (`camap-hx/src/View.hx:281-283`).
- Haxe fetches `<camap_bridge_api>/neostatic/manifest.json` with curl, once per process (static cache) (`camap-hx/src/service/BridgeService.hx:12-20`).
- Returned list, in order: `/env.js`, then manifest keys `runtime.js`, `vendors.js`, `reactlibs.js`, `neo.js`, `app.js`, each normalised to a `/neostatic/...` path (`camap-hx/src/service/BridgeService.hx:44-63`). Fallback: a 1-hour cache entry `manifest` (written with probability 1/10) else the exception "Unable to load ressources from CAMAP-ts." (`:57-72`).
- Consequence: if Nest is down at render time, **every page render fails**, because `base.mtt` always calls it (`camap-hx/lang/master/tpl/base.mtt:118`).
- `/env.js` is written by `camap-hx/entrypoint.sh:41-66` at container start: `window.__APP_CONFIG__` merged with PUBLIC_PATH, API_HOSTNAME, API_PORT, CAMAP_HOST, CAMAP_BRIDGE_API, FRONT_URL, FRONT_GRAPHQL_URL, MAPBOX_KEY (only non-empty ones). It is read by front-core `runtimeCfg.ts` (`camap-ts/packages/front-core/src/lib/runtimeCfg.ts:14-20`) and `set-public-path.ts` (`camap-ts/packages/front-core/src/set-public-path.ts:11-22`), which overrides `__webpack_require__.p` so lazy chunks load from `PUBLIC_PATH` or `<origin>/neostatic/`.
- Webpack build: entries `neo` (`src/neo.tsx`) and `app` (`src/app.ts`), output `camap-ts/public/neostatic/[name].[contenthash].bundle.js`, `libraryTarget: 'var'` so `neo` and `app` become window globals; `runtimeChunk: 'single'`; split chunks `reactlibs` (react, react-dom, @mui/material) and `vendors` (`camap-ts/packages/front-core/webpack.config.js:12,32-34,102-125`). `WebpackManifestPlugin` creates `manifest.json` (`:80`). `public/neostatic` is gitignored (`camap-ts/.gitignore`, line `public/neostatic`). Nest serves it with immutable caching under `/neostatic/` (`camap-ts/packages/api-core/src/main.ts:60-72`).

### 2.3 Neo module integration contract

Contract between a Haxe template and front-core:

1. The page must have loaded the neo scripts (automatic via `base.mtt`).
2. A DOM element with a unique `id` must exist (else `createNeoModule` throws `Could not get element by id`, `camap-ts/packages/front-core/src/neo.tsx:154-155`).
3. Call `neo.createNeoModule(id, moduleName, props)` after DOMContentLoaded. Props are plain JSON-able values; no callbacks except `onClose` injected for `place-dialog` and `imageUploaderDialog`, which unmounts the React root (`neo.tsx:157-159,183-189`).
4. `moduleName` must be a key in the `modules` record (`neo.tsx:42-147`); unknown name throws `Unknown module: <name>` (`:172-174`). Each entry: lazy component, optional wrapper (most use `ApolloWrapper` = MUI ThemeProvider + date-fns FR LocalizationProvider + Suspense + Apollo, `:17-40,36`), optional default props (`csaCatalog*`, `volunteersCalendar` set `showFallback:false`).
5. Modules `haxeDatePicker`, `vatBox`, `volunteersCalendar` use the plain `Wrapper` (no Apollo) (`neo.tsx:73-75,125-127,143-146`).
6. In non-development mode each mount logs `[Neo] renderModule ...` with props to the console (`neo.tsx:164-169`).
7. A Templo macro wraps steps 2-3: `$$neoModule(containerId, module, args)` renders the div and a DOMContentLoaded script (`camap-hx/lang/master/tpl/macros.mtt:3-9`). `View.neoArgs(args)` serialises a Haxe anonymous object into JS object-literal text, only String/Int/Float/null/nested objects (no arrays, no Bool: see inconsistency C6) (`camap-hx/src/View.hx:285-302`).
8. Generic pages: `neo.mtt` (inside `design.mtt`) and `neoPublic.mtt` (inside `base.mtt`, with Open Graph meta and a "Home" link) render a module whose name and args come from `view.containerId/module/args` (`camap-hx/lang/master/tpl/neo.mtt:3`, `neoPublic.mtt:40`). Users: `Vendor.doView` -> `vendorProfile`, `Vendor.doDashboard` -> `vendorDashboard` (`camap-hx/src/controller/Vendor.hx:21-48`).
9. Data access from neo modules: GraphQL at `FRONT_GRAPHQL_URL` or `/graphql` (`camap-ts/packages/front-core/src/lib/runtimeCfg.ts:22-25`), and legacy REST on the Haxe host (`getRestBaseUrl`, `:49-59`). Haxe exposes `View.getGraphqlUrl()` = `camap_api + "/graphql"` (`camap-hx/src/View.hx:277-279`).
10. Global `app` bundle: `src/app.ts` sets `window._Camap.clearNotifications` (comment: "while there is both HaXe and TS fronts, let HaXe setup the _Camap global object") (`camap-ts/packages/front-core/src/app.ts:18-21`); it is called from `CsaCatalogPresentation.tsx:74` and typed in `src/types.ts:18`.
11. Haxe-JS helpers that themselves mount neo modules: `getVATBox`, `openImageUploader`, `loginBox`/`registerBox`, `membershipBox` (section 4.2).

Browser-side wiring is client-side routing inside a module: modules that need URL routing use `BrowserRouter` with a `basename` passed by Haxe (`Members`, `VendorDashboard`, `VendorProfile`) (`camap-ts/packages/front-core/src/modules/members/Members.module.tsx:3,29`; `.../vendorDashboard/VendorDashboard.module.tsx:11,233`; `.../vendorProfile/VendorProfile.module.tsx:7,115`). The Haxe controller must dispatch the sub-paths to the same template (`Vendor.doView(d:haxe.web.Dispatch, ...)`, comment "asking for dispatch in first argument allows us to use BrowserRouter in front", `camap-hx/src/controller/Vendor.hx:19-21`).

### 2.4 Mail rendering

Emails are rendered by Haxe `App.processTemplate` (injects `HOST`, `theme`, `hDate`, `_`/`__`) from `mail/*.mtt` (`camap-hx/src/App.hx:385-400`), and separately by Nest with Twing in `api-core` (`camap-ts/packages/api-core/src/common/mailer/adapters/twing.adapter.ts`) using the i18next `trans` filter (`:34-45`).

### 2.5 Template compilation pipeline (Haxe)

- Source of truth: `camap-hx/lang/master/tpl` (116 `.mtt`). `lang/fr/tpl` and `lang/*/tmp/*.n` are **generated and gitignored** (`camap-hx/.gitignore:18-27`); only `lang/fr/tmp/readme.md` is tracked.
- Pass 1: build with `-D i18n_generation` copies master templates into `lang/<lang>/tpl`, replacing `::_("english")::` with the translation (verified on `home.mtt`: master `::_("Open orders")::` at `lang/master/tpl/home.mtt:75`, generated `fr` has `::_("Commandes ouvertes")::` at `lang/fr/tpl/home.mtt:75`). Run in the Dockerfile (`camap-hx/camap-hx.Dockerfile:77-80`).
- Pass 2: `neko temploc2.n -macros macros.mtt -output ../tmp/ *.mtt */*.mtt */*/*.mtt` in `lang/fr/tpl` (`camap-hx/camap-hx.Dockerfile:88-90`, verifier-corrected). In dev `debug="1"` does both automatically (`camap-hx/config.xml.dist:13`, `camap-ts/docs/templates.md`).
- Runtime reads `lang/<lang>/tmp/*.mtt.n` (e.g. `lang/fr/tmp/account__default.mtt.n`).
- The dev compose mounts `./camap-hx/lang:/srv/lang` and `./camap-hx/www:/srv/www`, and `./camap-ts/public:/srv/public` for neo bundles (`docker-compose.dev.yml:108,138-139`).

## 3. Template inventory

### 3.1 Counts

`camap-hx/lang/master/tpl`: **116** `.mtt`. `camap-hx/lang/fr/tpl`: 117 (generated copy). The "233" figure for both folders is the sum 116+117; fr has one extra file, `mail/digest_html.mtt` (0 bytes; absent from master), a stale leftover (`diff` of the two listings).

| Directory (master/tpl) | .mtt | Embeds neo (direct) |
|---|---|---|
| (root) | 12 | `macros.mtt` (macro and `place-dialog` link `:3-9,141`), `neo.mtt`, `neoPublic.mtt`, `home.mtt`/`invite.mtt` (call `_Camap.registerBox`, indirect), `base.mtt` (loads bundles) |
| account | 3 | `default.mtt` (userAccount, deleteAccount via macro), `editNotif.mtt`, `quit.mtt` |
| admin | 6 | none |
| admin/group | 2 | none |
| admin/user | 4 | none |
| amap | 1 | none |
| amapadmin | 5 | none (uses `_Camap.openImageUploader`) |
| amapadmin/volunteers | 1 | none (`_Camap.setReadonly`) |
| attention | 1 | `default.mtt` ("attention", see C1) |
| block | 1 | none (`modal.mtt`) |
| contract | 4 | `order.mtt` |
| contractadmin | 27 | `batchOrder.mtt` (also `_Camap.initOrderBox`, `updateUserOrderQuantity`, `getCheckboxesId`, `handleScrolling`, `openImageUploader` in other files) |
| contractadmin/subscriptionadmin | 2 | none |
| distribution | 10 | `CSAList.mtt`, `volunteersCalendar.mtt` |
| group | 4 | `disabled.mtt`, `map.mtt`, `view.mtt` |
| history | 4 | none (`_Camap.overlay`) |
| mail | 12 | none (server-side mail, rendered by `App.processTemplate`) |
| mail/notifications | 2 | none |
| member | 6 | `default.mtt`, `loginAs.mtt`, `view.mtt` |
| messages | 1 | `default.mtt` |
| place | 1 | `view.mtt` |
| product | 1 | none |
| shop | 1 | none |
| user | 4 | `choose.mtt` (vendorHomeWidget via macro), `login.mtt` (calls `_Camap.loginBox`) |
| vendor | 1 | none (`addimage.mtt` uses `_Camap.openImageUploader`) |

Files containing a literal `neo.createNeoModule` or `$$neoModule`: account/default, account/editNotif, account/quit, attention/default, contract/order, contractadmin/batchOrder, distribution/CSAList, distribution/volunteersCalendar, group/disabled, group/map, group/view, macros, member/default, member/loginAs, member/view, messages/default, neo, neoPublic, place/view, user/choose (grep over `camap-hx/lang/master`).

## 4. Neo module inventory and mount points

### 4.1 Module registry (`camap-ts/packages/front-core/src/neo.tsx:42-147`)

| Module name (key) | Source dir/file (`src/modules/...`) | Mounted by (hx) |
|---|---|---|
| `batchOrder` | `batchOrder/BatchOrder.module` | `lang/master/tpl/contractadmin/batchOrder.mtt:5` |
| `classicContractAttendance` | `csaAttendanceSheet/ClassicContractAttendanceModule` | `distribution/CSAList.mtt:22` |
| `variableContractAttendance` | `csaAttendanceSheet/VariableContractAttendanceModule` | `distribution/CSAList.mtt:10` |
| `csaCatalog` | `csaCatalog/CsaCatalog.module` | `contract/order.mtt:16` |
| `csaCatalogSubscription` | `csaCatalog/CsaCatalogSubscription.module` | `member/view.mtt:155` |
| `deleteAccount` | `users/DeleteAccountModule/DeleteAccount.module` | `account/default.mtt:16` (macro) |
| `editNotifications` | `users/EditNotifications/EditNotifications.module` | `account/editNotif.mtt:11` |
| `groupDisabled` | `groupDisabled/GroupDisabled.module` | `group/disabled.mtt:7` |
| `groupMap` | `groupMap/GroupMap.module` | `group/map.mtt:9` |
| `haxeDatePicker` | `haxe-date-picker/HaxeDatePicker` (no Apollo) | Haxe form element `camap-hx/src/form/CamapDatePicker.hx:37` (renders inline script) |
| `imageUploaderDialog` | `imageUploader/ImageUploader.module` | `_Camap.openImageUploader` (`camap-hx/js/App.hx:94-111`), used in `vendor/addimage.mtt:7`, `contractadmin/products.mtt:167`, `amapadmin/default.mtt:16` |
| `loginAs` | `loginRegistration/LoginAs.module` | `member/loginAs.mtt:7` |
| `loginRegistration` | `loginRegistration/LoginRegistration.module` | `_Camap.loginBox/registerBox` (`camap-hx/js/App.hx:259-284`); called from `user/login.mtt:30`, `home.mtt:53,387`, `invite.mtt:6`, `group/view.mtt:430,448,471` |
| `members` | `members/Members.module` | `member/default.mtt:7` |
| `membershipDialog` | `membership/MembershipDialog.module` | `_Camap.membershipBox` (`camap-hx/js/App.hx:286-304`); `member/view.mtt:213` |
| `messages` | `messages/Messages.module` | `messages/default.mtt:7` |
| `place` | `places/PlaceModule` | `place/view.mtt:9`, `group/view.mtt:376` |
| `place-dialog` | `places/PlaceDialogModule` | `macros.mtt:141`, `group/view.mtt:573` |
| `quitGroup` | `users/QuitGroup/QuitGroup.module` | `account/quit.mtt:10` |
| `userAccount` | `users/UserAccountModule/user-account.module` | `account/default.mtt:7` (macro) |
| `vatBox` | `vatBox/VatBox.module` (no Apollo) | `_Camap.getVATBox` (`camap-hx/js/App.hx:75-92`); the Haxe caller is not in `src`/`common`/`lang` (unverified: probably a form element in a vendored library) |
| `vendorHomeWidget` | `vendorDashboard/VendorHomeWidget.module` | `user/choose.mtt:22` (macro) |
| `vendorDashboard` | `vendorDashboard/VendorDashboard.module` (BrowserRouter + `layout/DashboardLayout`) | `neo.mtt` via `Vendor.doDashboard` (`camap-hx/src/controller/Vendor.hx:41-50`) |
| `vendorProfile` | `vendorProfile/VendorProfile.module` (BrowserRouter + `layout/VendorLayout`) | `neoPublic.mtt` via `Vendor.doView` (`camap-hx/src/controller/Vendor.hx:21-39`) |
| `volunteersCalendar` | `volunteersCalendar/VolunteersCalendar.module` (no Apollo) | `distribution/volunteersCalendar.mtt:6` |

26 keys. Dirs in `src/modules` (17): batchOrder, csaAttendanceSheet, csaCatalog, groupDisabled, groupMap, haxe-date-picker, imageUploader, loginRegistration, members, membership, messages, places, users, vatBox, vendorDashboard, vendorProfile, volunteersCalendar.

### 4.2 Mounted from templates but not registered

- `attention` is mounted at `camap-hx/lang/master/tpl/attention/default.mtt:7` but there is no `attention` key in `neo.tsx:42-147` (see C1).

### 4.3 front-core other inventory (no pages of their own)

- `src/components` (shared UI): top-level files CommonAlertError, DayPicker, DeleteButton, DistributionInfoCard, DocumentList, DocumentUploader, Empty, TabPanel, UpdateButton; dirs attendanceSheet, calendar, dateRangePicker, forms, map, svg, utils (CamapIcon, CamapLink, CamapMap, ConfirmDialog, DropzoneArea, Product, ...), vendor. `src/containers/geo` only.
- `src/layout`: AdminLayout, DashboardLayout, GroupLayout, PublicLayout, VendorLayout. Only DashboardLayout (VendorDashboard) and VendorLayout (VendorProfile) are imported by modules; the others are not imported outside `src/layout` (grep over `src`; AdminLayout/PublicLayout/GroupLayout: no importer found, "unverified" for dynamic use).
- `src/lib`: i18n.ts, runtimeCfg.ts, initApollo.tsx, withApollo.tsx, withi18n.tsx, auth.context.tsx, datei18n.ts, mapboxconfig.ts, strings.ts, `REST/`, CamapApolloMockedProvider.
- `src/gql`: generated (`index.tsx`, `introspection.json`, `fragments/`, `mutations/`, `queries/`), generated by `npm run gen:gql` (`camap-ts/packages/front-core/package.json`, `gql.gen.yml`). `src/config/apollo.config.ts`.
- `src/react-router-config.ts`: only exports React Router v6 `future` flags (`v7_startTransition`, `v7_relativeSplatPath`) and `reactRouterDefaultProps` (`camap-ts/packages/front-core/src/react-router-config.ts:1-8`), imported by the 3 router modules.
- Storybook: `npm run storybook` (`package.json`), stories next to modules.

### 4.4 Routing in front-core: pure TS pages?

None. No `createBrowserRouter`, no root `<Routes>`; only 3 module-local `BrowserRouter`s (section 2.3). `src/app.ts` states "This is not the root of the frontend app!" (`camap-ts/packages/front-core/src/app.ts:1-7`). Nest serves only `/neostatic`, `/locales`, `/graphql` assets/API, no HTML pages (`camap-ts/packages/api-core/src/main.ts:60-83`; only static assets seen, "no HTML page route" unverified beyond that file). `camap-ts/public/` contains `data`, `img`, `locales`, `neostatic`.

## 5. Haxe-JS inventory (`camap-hx/js`, built by `camap-hx/frontend/build.hxml`)

### 5.1 Build

`camap-hx/frontend/build.hxml`: `-main App`, `-cp ../common -cp ../js`, libs sugoi, react-next, classnames, react-types, react-router-4, redux, redux-connect, redux-thunk, material-ui, modular, tink_json; flags `-debug -dce no -D debug`, output `../www/js/app.js` (`:1-26`). Always built in debug mode, even for the production Dockerfile (`camap-hx/camap-hx.Dockerfile:83-85`, verifier-corrected). `frontend/package.json` pins react 16.14, @material-ui/core 4.12, redux 4.2, react-router 5, bootstrap.native 2.0.27. Vendored libs bundle: `npm run libs:prod` (rollup) -> `www/js/libs.prod.js`; `www/js/app.js` and `app.js.map` are gitignored (`camap-hx/.gitignore:31`, exceptions for libs/fetch/browser-detect/tinymce).

### 5.2 Globals

`App.main()` creates one `App` and assigns `window._` and `window._Camap` (the comment says `_Camap` avoids lodash conflicts) (`camap-hx/js/App.hx:61-64`). Instance fields: `currency`, `t` (declared, not set), `Modal`, `lang`, `userId`, `userName`, `userEmail` (`:48-54`); set by `base.mtt:106-111`. Also `_Camap.theme`, `_Camap.version` assigned dynamically by the template (not declared in Haxe).

### 5.3 Public functions of `_Camap` and status

| Function (`camap-hx/js/App.hx`) | Purpose | Called from |
|---|---|---|
| `getVATBox` (:75) | mounts neo `vatBox` replacing vat input | no caller in src/lang (unverified, maybe vendored sugoi/form) |
| `openImageUploader` (:94) | mounts neo `imageUploaderDialog` | vendor/addimage, contractadmin/products, amapadmin/default |
| `initOrderBox` (:113) | legacy React16+Redux `OrdersDialog` (admin order edit) | contractadmin/orders.mtt:29,107; ordersByDate.mtt:66 |
| `updateUserOrderQuantity` (:145) | `POST /api/order/updateOrderQuantity/<userId>` via `HttpUtil.fetch`, updates DOM totals | contractadmin/orders.mtt:147 |
| `roundTo` (:223) | static helper | no caller found |
| `overlay` (:233) | Ajax-load URL into `#myModal` (bootstrap.native) | contract/editVarOrders:29, history/csaorders:40, history/basket:30 |
| `modal` (:249) | show a bootstrap modal by id | none found (block/modal.mtt uses `new _Camap.Modal(...)`, `:27`) |
| `loginBox` / `registerBox` (:259,282) | mounts neo `loginRegistration` | user/login, home, invite, group/view |
| `membershipBox` (:286) | mounts neo `membershipDialog` | member/view.mtt:213 |
| `getCheckboxesId` (:306) | ids of checked checkboxes | contractadmin/products.mtt:37,49 |
| `setWarningOnUnload` (:319), `goto` (:358), `toggle/show/hide` (:400-418) | misc DOM helpers | no caller found in src/lang/common (unverified) |
| `antiDoubleClick` (:340) | disables `.btn` for 3 s after click | base.mtt:113 |
| `setReadonly` (:426) | | amapadmin/volunteers/default.mtt:49-59 |
| `resetGroupInSession` (:448) | `GET /account/quitGroup/<id>` | no caller found |
| `InitStockTrackingComponent` (:453) | form visibility logic | `camap-hx/src/form/StockTrackingPerDistribForm.hx:189` |
| `handleScrolling` (:531) | scroll buttons | contractadmin/stocks.mtt:2 |
| `handleAriaTabEvents` (:592) | ARIA tabs + `?tabId` in URL | group/view.mtt:10 |

### 5.4 Other Haxe-JS files

- `js/bootstrap/Modal.hx`: extern/wrapper for bootstrap.native Modal (`_Camap.Modal`).
- `js/utils/HttpUtil.hx`: promise wrapper over XMLHttpRequest, `fetch(url, method, params, accept, contentType)`; POST sends JSON body; used only by `updateUserOrderQuantity` (`camap-hx/js/App.hx:145`).
- `js/react/order/**` (OrdersDialog, redux actions/reducers/thunks, components Catalog, Order, InsertOrder, ...), `js/react/product/**`, `js/react/user/redux/components/UserSelector.hx`, `js/react/mui/CamapTheme.hx`: the legacy order box built on material-ui v4 and redux. Reachable only through `initOrderBox`.

## 6. i18n

### 6.1 Haxe side (gettext)

- Config: `config.xml` `lang`, `langs`, `langnames` (dist: only `fr`) (`camap-hx/config.xml.dist:2-4`).
- Source strings are in **English** inside code/templates: `_("text")`, `__("text ::tok::", {tok:..})`, `t._("...")` (`camap-hx/lang/master/tpl/home.mtt:75`, `camap-hx/src/controller/Main.hx:50`). Some contexts use `"text||context"` syntax (`camap-hx/src/View.hx:155-160`). Many strings in master are in fact French literals not wrapped in `_()` (e.g. `camap-hx/js/App.hx:322`, `camap-hx/src/controller/Main.hx:68`) - these are never translated.
- Extraction: `cd backend && npm run i18n:extract` = move `www/lang/allTexts.pot` to `.bak`, run `haxe potGeneration.hxml` (flags `-D i18n_parsing`, `camap-hx/backend/potGeneration.hxml`) then `node i18n.js diff old new` (`camap-hx/backend/package.json:18`).
- Merge: `npm run i18n:translate` = `node i18n.js update ../www/lang/allTexts.pot ../www/lang/texts_fr.po`: interactive CLI prompt for each new key, deletes obsolete keys, writes `.po` and `.mo` (`camap-hx/backend/i18n.js:60-91`, `package.json:20`). `npm run i18n:compile` compiles all `www/lang/*.po` to `.mo` (`i18n.js:6-19`).
- Files: `www/lang/allTexts.pot` (+ `.bak`), `texts_fr.po` (about 853 `msgid` lines counted by grep), `texts_fr.mo` (gitignored, `camap-hx/.gitignore:29`). Dockerfile builds `.mo` with `msgfmt` (`camap-hx/camap-hx.Dockerfile:93-95`), not with `i18n.js`.
- Runtime: `sugoi.i18n.Locale.texts` (`View.hx:21,153`); `App.t = TMap(getTranslationArray(), "fr")` is a separate hard-coded French map for DB field labels in forms (`camap-hx/src/App.hx:34-36,207-215`).
- Templates are translated at **build time** (copy per language, section 2.5), not at runtime.

### 6.2 TS side (i18next)

- Front: `src/lib/i18n.ts` (imported by `neo.tsx:9`): i18next + react-i18next, `lng/fallbackLng: 'fr'` (hard-coded; `_Camap.lang` is not used), chained backend LocalStorage (24 h in production, key `__CACHE_KEY__` = git short hash) then HTTP at `<CAMAP_HOST>/locales/{{lng}}/{{ns}}.json?v=<cache key>` (`camap-ts/packages/front-core/src/lib/i18n.ts:14-43`, `runtimeCfg.ts:27-31`). `interpolation.defaultVariables.theme` = `window._Camap.theme` so JSON strings can use `{{theme.name}}` (`i18n.ts:39-42`).
- Files: `camap-ts/public/locales/fr/*.json` (namespaces such as translation, attendance, batch-order, csa-catalog, errors, messages, unit, yup, vendorDashboard, volunteers-calendar and folders groupMap, members, membership, payments, public, shop, upload, users). Only `fr` exists.
- Hook: `useCamapTranslation({alias: 'ns'}, loadCommon?)` returns `t` (searches all given namespaces, then returns the key) plus one `t` per alias (`camap-ts/packages/front-core/src/utils/hooks/use-camap-translation.tsx:3-42`). Documented in `camap-ts/docs/i18n.md` and `camap-ts/docs/archives/front-core/translations.md`.
- Served by Nest `/locales/` (max-age 1 day) (`camap-ts/packages/api-core/src/main.ts:73-80`) and proxied by Apache (`camap-hx/apache/camap-static.conf:24-25`).
- API/mail: Twing `trans` filter via `i18next-fs-backend` reading `public/locales/{{lng}}/{{ns}}.json` relative to the compiled file (`camap-ts/packages/api-core/src/common/mailer/adapters/twing.adapter.ts:15-30,34-45`). Date locale: front uses date-fns `fr` (`neo.tsx:4,31`).

### 6.3 Sharing

No strings are shared between Haxe (`.po/.mo`) and TS (JSON). The only shared data is the `theme` object injected as `_Camap.theme` (`base.mtt:98-102`) for interpolation. Templates that embed neo modules pass already-translated values only via props.

## 7. Theme

- Data: `Theme` typedef in `camap-hx/common/Common.hx:317-337`; stored as JSON in table `Variable` row `whiteLabel`, read by `App.setTheme()` once per process; on missing row or any error, a hard-coded default (`id:"default"`, name "CAMAP", support `inter@amap44.org`, footer with hard-coded logos) is used (`camap-hx/src/App.hx:59-151`). Exposed through `getTheme()` (`:156`) and added to all `processTemplate` mail contexts (`:388`). TS counterpart: `camap-ts/packages/camap-common/src/theme.ts` and `VariableService.getTheme()` (per `camap-ts/docs/theme.md`; service not re-verified).
- CSS selection: `/theme/<theme.id>/css/<variable 'css'>/{bootstrap.min.css,style(.min).css}` (`base.mtt:31-38`). Themes on disk: `www/theme/default` (bootstrap, style.scss, variables.less/.scss, logos, favicons, `css_compile.sh`) and `www/theme/camap_old`. `www/css/print.scss`.
- Build: `backend/package.json` `build:sass` = `buildSass.sh` (for each theme dir: converts `variables.less` into `variables.scss`, runs `sass` to `style.css` and `style.min.css`; also `www/css/print.scss`) (`camap-hx/backend/buildSass.sh:1-13`, `package.json:15`). `dev:sass` = `sass ../www/theme`. Bootstrap 3.4.1 itself must be recompiled by hand with grunt (`camap-hx/www/theme/theme.md`).
- React theme: MUI theme `src/theme/default/theme.ts`, palette `src/theme/default/palette.ts` (primary `#eb702f`, secondary `#f6a96c`), color tokens `src/theme/commonPalette.ts`. Webpack copies `src/theme/${THEME_ID}/palette.ts` onto `src/palette.ts` before build and restores the default one afterwards (`camap-ts/packages/front-core/webpack.config.js:80-100`). `neo.tsx` always imports `./theme/default/theme` (`neo.tsx:9`), so the runtime `theme.id` has no effect on React styling beyond the palette selected at build time (via `THEME_ID`).
- Haxe-JS legacy order box has its own `react/mui/CamapTheme.hx`.

## 8. Ownership

- `CODEOWNERS` at root, in `camap-hx` and `camap-ts`: `* @Mandrak-Kimigo @InterAMAP44` (no per-folder owners) (`CODEOWNERS:1`, `camap-hx/CODEOWNERS:1`, `camap-ts/CODEOWNERS:1`).
- Author of `frontend/package.json`: "François Barbut" (`camap-hx/frontend/package.json:4`).

## 9. Documentation inconsistencies

| # | Doc claim | Reality |
|---|---|---|
| D1 | [CONFIRMED] `camap-ts/docs/neo-modules.md` shows `createNeoModule` with `if (moduleName === 'myModule')` and `React.lazy` constants | Code uses a `modules` record with `wrapper`/`props` (`camap-ts/packages/front-core/src/neo.tsx:42-195`); the doc procedure ("initialiser dans la fonction") is outdated |
| D2 | [CONFIRMED] `neo-modules.md`: "Les trois bundles (runtime, vendor, neo) doivent être ajoutés" | Haxe loads `/env.js` + runtime, vendors, reactlibs, neo, app (`camap-hx/src/service/BridgeService.hx:44-63`); `env.js` is required by `set-public-path`/`runtimeCfg` |
| D3 | [CONFIRMED] `neo-modules.md`: `npm run build:neo` from front-core; `npm run build:front` from root | front-core has no `build:neo`, only `build` (`camap-ts/packages/front-core/package.json:6`); root has `build:front` (`camap-ts/package.json:14`) |
| D4 | [CONFIRMED] `neo-modules.md`: test integration with template `debug/neo.mtt` on route `/debug/neo` | No `debug` template dir in `camap-hx/lang/master/tpl`, no `debug` route in controllers (grep of `camap-hx/src/controller`) |
| D5 | [CONFIRMED] `neo-modules.md` manifest example `http://localhost:3010/neostatic/...`, numbered chunk entries | Manifest also contains `reactlibs.js` and `app.js` keys (`webpack.config.js:118-125`, `BridgeService.hx:49`) |
| D6 | [CONFIRMED] `neo-modules.md`: Storybook doc link `./storybook.md` | `camap-ts/docs` has no `storybook.md` (directory listing) |
| D7 | [CONFIRMED] `neo-modules.md` snippet uses `<div>` + `<script>` | The real helper is `$$neoModule` macro (`camap-hx/lang/master/tpl/macros.mtt:3-9`), not mentioned |
| D8 | [CONFIRMED] `docs/i18n.md`: "cd backend && haxe build.hxml -D i18n_parsing" | Dedicated `backend/potGeneration.hxml` and `npm run i18n:extract` (`camap-hx/backend/package.json:18`) |
| D9 | [CONFIRMED] `docs/i18n.md`: gettext `po -> mo` "when saving" with PoEdit/Weblate; no mention of `i18n.js` tooling (`diff`, `update`, `compile`) | `camap-hx/backend/i18n.js` and scripts exist; Dockerfile uses `msgfmt` (`camap-hx.Dockerfile:93-95`) |
| D10 | [CONFIRMED] `docs/i18n.md`: "langs=fr,en" example | Only `fr` has `.po` and templates exist (`camap-hx/config.xml.dist:3`, `www/lang`) |
| D11 | [CONFIRMED: Dockerfile comment is at camap-hx.Dockerfile:87 and the command at :88-90 (draft said :82-86)] `docs/templates.md`: templates compile to `lang/fr/tmp` but dockerfile comment says "lang/master/tpl -> lang/master/tmp" | The command writes in `lang/fr/tmp` (`camap-hx.Dockerfile:88-90`); the comment at `:87` is wrong (code-side) |
| D12 | [CONFIRMED: templates use /theme/::theme.id::/logo3.png (design.mtt:17, login.mtt:7), logo2.png (layout-camap.mtt:50); no extensionless /logo] `docs/theme.md`: logo loaded from `/theme/$themeId/logo` | Not found; logos are referenced as fixed `/theme/default/logo*.png` in the default theme (`camap-hx/src/App.hx:66,101-114`); theme folder contains `logo.png` etc. (no extensionless route verified) |
| D13 | [CONFIRMED: Common.hx:317, App.hx:60] `docs/theme.md`: Theme structure "defined at Common.hx#L278" and default at `App.hx#L63` (GitHub links) | Now `camap-hx/common/Common.hx:317`, `camap-hx/src/App.hx:60` |
| D14 | [CONFIRMED] `docs/theme.md`: themes `default` and `camap_old` | Confirmed (`camap-hx/www/theme`) but the doc omits the `css` variable subfolder (`/css/<css>/` in `base.mtt:31`) and the React-side `THEME_ID`/palette mechanism |
| D15 | [CONFIRMED] `camap-hx/www/theme/theme.md`: `www/theme/default/css/variable.less` and "variable.scss" (singular) | Files are `variables.less`, `variables.scss` (plural) (`ls www/theme/default/css`) |
| D16 | [PLAUSIBLE: css_compile.sh exists (www/theme/default/css_compile.sh) but its content/behaviour not run; npm dev:sass confirmed at backend/package.json:16] `camap-hx/www/theme/theme.md` says `css_compile.sh` generates Bootstrap files; also `npm run dev:sass` is `sass ../www/theme` | `css_compile.sh` exists in `www/theme/default/` but not verified; `buildSass.sh` is the scripted path |
| D17 | [CONFIRMED] `docs/archives/front-core/translations.md` ("La kook") describes the same hook | Duplicate of `docs/i18n.md` TS section; typo "kook" |
| D18 | [CONFIRMED] `camap-ts/docs/readme.md` index | Lists neo-modules, error-handling, dataset, backend docs only; i18n, theme, templates not linked (`camap-ts/docs/readme.md:1-10`) |

## 10. Code inconsistencies

- **C1** [CONFIRMED: modules record spans neo.tsx:42-147 with no attention key; throw is at neo.tsx:172-174; Attention.hx serves attention/default.mtt] Template mounts a module name not registered: `neo.createNeoModule("attention-neo-container", "attention", ...)` at `camap-hx/lang/master/tpl/attention/default.mtt:7`, but `modules` in `camap-ts/packages/front-core/src/neo.tsx:42-147` has no `attention` key. It would throw `Unknown module: attention` (`neo.tsx:172-174`). The admin layout lists `/admin/attention` routes (`camap-ts/packages/front-core/src/layout/AdminLayout.tsx:26,31`) but is itself unused by any module (unverified).
- **C2** [CONFIRMED: HttpUtil.hx:16; no .PATCH usage in camap-hx/js or src] `HttpUtil.HttpMethod.PATCH = 'GET'` (`camap-hx/js/utils/HttpUtil.hx:16`) - PATCH sends GET. Unused today.
- **C3** [CONFIRMED: frontend/build.hxml has -debug/-dce no/-D debug; Dockerfile frontend build at :83-85 (draft said :88-91)] Haxe-JS built with `-debug -D debug -dce no` and written to `www/js/app.js` even in the production image (`camap-hx/frontend/build.hxml:21-25`, `camap-hx.Dockerfile:88-91`): the "debug" build is the prod artifact.
- **C4** [CONFIRMED: lang/fr/tpl/mail/digest_html.mtt is 0 bytes, absent from lang/master/tpl/mail; lang/fr/tpl/* is gitignored (camap-hx/.gitignore:18)] `lang/fr/tpl/mail/digest_html.mtt` (0 bytes) exists only in the generated fr folder, not in master (listing diff). Stale generated file.
- **C5** [CONFIRMED: Dockerfile comment at :87 says lang/master/tmp, command at :88-90 runs in /srv/lang/fr/tpl with -output ../tmp/ (draft cited :82). Copy-to-fr/tpl by i18n_generation not re-verified] `-D i18n_generation` copies into `lang/fr/tpl` but the Dockerfile comment says output goes to `lang/master/tmp` (`camap-hx/camap-hx.Dockerfile:82`), while the command writes `lang/fr/tmp`.
- **C6** [CONFIRMED by code reading (View.hx:285-302): Bool/arrays fall to the nested branch via Reflect.fields; runtime output not executed. Note the !!parseInt in attention/default.mtt:9 is raw JS in the template, not a neoArgs workaround] `View.neoArgs` serialises only String/Int/Float/null/objects; `Bool` and arrays are treated as nested objects via `Reflect.fields` (`camap-hx/src/View.hx:285-302`), so a `Bool` yields `k: {}`-like output and arrays become `{0:..}`. Behaviour inferred from code, not executed. Templates working around it use `!!parseInt(...)` inline (`attention/default.mtt:9`).
- **C7** [PLAUSIBLE: names confirmed (camap-static.conf:16-25 nest-devcamap; config.xml.dist:19-20 nest-camap); whether both resolve in compose/prod not checked] Hard-coded Apache upstream `nest-devcamap` (`camap-hx/apache/camap-static.conf:16-25`) vs `nest-camap` in `config.xml.dist:19-20` and in docs; image works only where both names resolve (unverified for prod compose).
- **C8** [CONFIRMED: i18n.ts:16-17 lng/fallbackLng "fr" (draft :19-20); neo.tsx imports frLocale at :7 and uses it at :29 (draft :4,31); base.mtt:106] (verifier-corrected) i18n language is hard-coded to `fr` on the React side (`camap-ts/packages/front-core/src/lib/i18n.ts:19-20`) even though Haxe injects `_Camap.lang` (`base.mtt:106`); `neo.tsx` also hard-codes date-fns `frLocale` (`neo.tsx:4,31`).
- **C9** [CONFIRMED: neo.tsx:12 imports ./theme/default/theme (draft said :9); base.mtt:31] (verifier-corrected) React theme is always `theme/default/theme` (`neo.tsx:9`), while Haxe theme id is dynamic per instance (`base.mtt:31`); runtime `theme.id` only affects text interpolation and CSS in Haxe pages.
- **C10** [CONFIRMED: Common.hx:332-335 (draft :331-336); TS camap-common/src/theme.ts:16-18] (verifier-corrected) `Theme.terms` fields differ between Haxe and TS: Haxe has `termsOfServiceLink, termsOfSaleLink, platformTermsOfServiceLink, privacyPolicyLink` (`camap-hx/common/Common.hx:331-336`); TS has `termsOfServiceLink, termsOfSaleLink, platformTermsLink` (`camap-ts/packages/camap-common/src/theme.ts`, `terms` block).
- **C11** [CONFIRMED: webpack.config.js:86 uses process.env.THEME_ID; mitigated since camap-ts/.env.sample:55 sets THEME_ID=default] `webpack.config.js` mutates the source tree during build (copies `src/theme/<THEME_ID>/palette.ts` over `src/palette.ts`, restores default at the end, `:80-100`); if `THEME_ID` is unset the source path is `src/theme/undefined/palette.ts` (`:86`, "unverified" whether `.env` always sets it; `THEME_ID` appears in `camap-ts/.env.sample`).
- **C12** [CONFIRMED in code: BridgeService.hx:10-20 static _neoManifest cached forever; process lifetime under mod_neko is PLAUSIBLE/unverified] `BridgeService` fetches the neo manifest through curl at render time, once per process, with no invalidation (`BridgeService.hx:12-20`): after a front redeploy with new content hashes, a long-lived Neko process keeps old bundle URLs (inferred; Neko process lifetime under mod_neko not verified).
- **C13** [CONFIRMED: none of the 8 names (as _Camap members) called in camap-hx/src, common, lang/master, js; defined at js/App.hx:223,249,319,358,400,406,412,448] Dead/unreferenced `_Camap` functions (`roundTo`, `modal`, `goto`, `toggle`, `show`, `hide`, `setWarningOnUnload`, `resetGroupInSession`) have no caller in `camap-hx/src|common|lang/master` (see 5.3; vendored libs not checked).
- **C14** [CONFIRMED: AdminLayout/GroupLayout only referenced by themselves; PublicLayout only also by VendorLayout (same folder)] Layouts `AdminLayout`, `PublicLayout`, `GroupLayout` in `camap-ts/packages/front-core/src/layout` have no importers outside the layout folder (grep over `src`).
- **C15** [CONFIRMED with line fixes: js/App.hx:329 (not :322); Main.hx:31,68 ok; Vendor.hx:68,70 (not :54)] (verifier-corrected) French literals hard-coded in Haxe-JS (`warn` message `camap-hx/js/App.hx:322`) and controllers (`camap-hx/src/controller/Main.hx:31,68`, `Vendor.hx:54`), bypassing gettext.


## Verification summary

Confirmed: 31; Refuted: 0; Plausible: 2 (D16, C7). Several line-number corrections applied (C8, C9, C10, C15, D11, C3, C5).
