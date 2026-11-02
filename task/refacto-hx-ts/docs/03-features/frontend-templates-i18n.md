# Frontend and rendering layer: Haxe templates, Haxe-JS, neo modules, forms, theme, i18n

## 1. Scope

Server-side page rendering by camap-hx (Templo `.mtt`, Sugoi), the injection of React "neo modules" from camap-ts front-core, the legacy Haxe-JS layer (`_Camap`), server-side form widgets (`camap-hx/src/form/*`), template inventory, theme, and the two i18n systems. Feature behaviour of individual pages is in the other feature files.

Summary: every page the user navigates to is rendered server-side by camap-hx; front-core has no top-level router or app shell. React is injected through `neo.createNeoModule(containerId, moduleName, props)` exposed by the `neo.js` bundle (`camap-ts/packages/front-core/src/neo.tsx:149-195`, `camap-ts/packages/front-core/webpack.config.js:32-34,102-103`).

## 2. Concepts & glossary terms

- **Neo module**: lazily loaded React 18 component mounted in a `<div>` of a Haxe page; registry key in `modules` (`camap-ts/packages/front-core/src/neo.tsx:42-147`).
- **`_Camap` (alias `_`)**: Haxe-JS global singleton with helper functions called from template `onclick=` handlers (`camap-hx/js/App.hx:61-64`).
- **Templo / `.mtt`**: HX template language (`::use 'x.mtt'::`, `::cond::`, `$$macro(...)`).
- **master vs fr templates**: source of truth `camap-hx/lang/master/tpl`; `lang/fr/tpl` and `lang/*/tmp/*.n` are generated and gitignored (`camap-hx/.gitignore:18-27`).
- **gettext** (`.po/.mo`, HX) vs **i18next** (JSON, TS): no shared strings.
- **Theme**: JSON `Theme` typedef (`camap-hx/common/Common.hx:317-337`), stored in `Variable.whiteLabel`.
- **`getVariable(...)`**: template helper implemented in the sugoi library (outside the repo), backing unverified. Keys used: `googleTagManagerId` (`camap-hx/lang/master/tpl/base.mtt:26,94`), `css` (`:31,36,38,42`), `js` (`:50,52,53`) as asset-version path segments; `homeMessage` (`camap-hx/lang/master/tpl/user/choose.mtt:3-6`).
- **BridgeService manifest**: HX fetches `<camap_bridge_api>/neostatic/manifest.json` to learn bundle URLs.
- **`/env.js`**: runtime config `window.__APP_CONFIG__` written by `camap-hx/entrypoint.sh:41-66`.

## 3. Routes & endpoints

Pages are listed in the domain files. Rendering-layer routes and assets:

| side | route | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `/neostatic/`, `/graphql`, `/locales/` | `camap-hx/apache/camap-static.conf:15-40` | none | n/a | Apache reverse-proxies to Nest (port 3010), bypassing Neko, together with `/env.js`; upstream host hard-coded `nest-devcamap` (`:16`) while `camap-hx/config.xml.dist:19-20` uses `nest-camap` |
| TS | `/neostatic/` (static) | `camap-ts/packages/api-core/src/main.ts:60-72` | none | webpack output | immutable caching |
| TS | `/locales/` (static) | `camap-ts/packages/api-core/src/main.ts:73-80` | none | `camap-ts/public/locales/` | i18n JSON, max-age 1 day |
| HX | generic neo pages | `camap-hx/src/controller/Vendor.hx:21-50` | see `catalogs-products-vendors-places.md` | `camap-hx/lang/master/tpl/neo.mtt:3`, `neoPublic.mtt:40` | module name and args from `view.containerId/module/args`; `Vendor.doView(d:haxe.web.Dispatch, ...)` dispatch in first argument lets the front use `BrowserRouter` (`camap-hx/src/controller/Vendor.hx:19-21`) |
| HX | `/cssdemo` | `camap-hx/src/controller/Main.hx:209-215` | none | `camap-hx/lang/master/tpl/cssDemo.mtt` | style guide (see `admin-superadmin.md`) |

## 4. Business rules

### 4.1 Request to HTML
1. Dispatch is Sugoi/`haxe.web.Dispatch`: controller classes with `doXxx` methods; `Main` delegates sub-controllers (`doGroup(d)` -> `d.dispatch(new controller.Group())`, `camap-hx/src/controller/Main.hx:55-64`); `doDefault` handles maintenance mode, permalinks, else redirects `/home` (`camap-hx/src/controller/Main.hx:34-53`); `@tpl("x.mtt")` chooses the template (`:66`).
2. The controller sets properties on `view` (`camap-hx/src/View.hx`); most pages `::use 'design.mtt'::` (wraps `base.mtt`); the public vendor page uses `neoPublic.mtt` (`::use 'base.mtt'::`, `camap-hx/lang/master/tpl/neoPublic.mtt:1`).
3. `base.mtt` emits Bootstrap 3 CSS and `style(.min).css` from `/theme/<theme.id>/css/<getVariable('css')>/` (`camap-hx/lang/master/tpl/base.mtt:31-38`), `/font/icons.css` (`:42`), Leaflet CSS from unpkg (`:45`), scripts `fetch.umd.js`, `libs.prod.js`, `app.js` from `/js/<getVariable('js')>/` (`:50-53`). `libs.prod.js` = vendored libs (`camap-hx/frontend/libs/rollup.config.js`); `app.js` = Haxe-JS output (`camap-hx/frontend/build.hxml:28`).
4. End of `<body>`: inline script sets `_Camap.theme` (id, name, supportEmail); on DOMContentLoaded sets `_Camap.lang/userId/userName/userEmail/version` and calls `_Camap.antiDoubleClick()` (`camap-hx/lang/master/tpl/base.mtt:98-115`); then `::foreach script getNeoModuleScripts()::` emits the neo `<script>` tags (`:118-120`).

### 4.2 neo bundle discovery
5. `View.getNeoModuleScripts()` delegates to `BridgeService.getNeoModuleScripts()` (`camap-hx/src/View.hx:281-283`); manifest fetched with curl once per process (static cache, no invalidation) (`camap-hx/src/service/BridgeService.hx:10-20`). Returned order: `/env.js`, then manifest keys `runtime.js`, `vendors.js`, `reactlibs.js`, `neo.js`, `app.js`, normalised to `/neostatic/...` (`:44-63`). Fallback: 1-hour cache entry `manifest` (written with probability 1/10) else exception "Unable to load ressources from CAMAP-ts." (`:57-72`). If Nest is down at render time every page render fails because `base.mtt` always calls it (`camap-hx/lang/master/tpl/base.mtt:118`).
6. `/env.js` merges PUBLIC_PATH, API_HOSTNAME, API_PORT, CAMAP_HOST, CAMAP_BRIDGE_API, FRONT_URL, FRONT_GRAPHQL_URL, MAPBOX_KEY (non-empty ones only); read by `camap-ts/packages/front-core/src/lib/runtimeCfg.ts:14-20` and `camap-ts/packages/front-core/src/set-public-path.ts:11-22`, which overrides `__webpack_require__.p` so lazy chunks load from `PUBLIC_PATH` or `<origin>/neostatic/`.
7. Webpack: entries `neo` (`camap-ts/packages/front-core/src/neo.tsx`) and `app` (`camap-ts/packages/front-core/src/app.ts`), output `camap-ts/public/neostatic/[name].[contenthash].bundle.js`, `libraryTarget: 'var'`, `runtimeChunk: 'single'`, split chunks `reactlibs` (react, react-dom, @mui/material) and `vendors` (`camap-ts/packages/front-core/webpack.config.js:12,32-34,102-125`); `WebpackManifestPlugin` creates `manifest.json` (`:80`); `public/neostatic` is gitignored. `webpack.config.js` copies `src/theme/${THEME_ID}/palette.ts` over `src/palette.ts` before the build and restores the default afterwards (`:80-100`, `THEME_ID` at `:86`; `camap-ts/.env.sample:55` sets `default`).

### 4.3 Neo module integration contract
8. The page must have loaded neo scripts (automatic via `base.mtt`); a DOM element with a unique `id` must exist else `Could not get element by id` (`camap-ts/packages/front-core/src/neo.tsx:154-155`); call after DOMContentLoaded with plain JSON-able props; only `onClose` is injected for `place-dialog` and `imageUploaderDialog` (unmounts the React root) (`:157-159,183-189`); unknown `moduleName` throws `Unknown module: <name>` (`:172-174`).
9. Each registry entry: lazy component, optional wrapper (most use `ApolloWrapper` = MUI ThemeProvider + date-fns FR LocalizationProvider + Suspense + Apollo, `:17-40,36`), optional default props (`csaCatalog*`, `volunteersCalendar` set `showFallback:false`). `haxeDatePicker`, `vatBox`, `volunteersCalendar` use the plain `Wrapper` without Apollo (`:73-75,125-127,143-146`). Outside development each mount logs `[Neo] renderModule ...` (`:164-169`).
10. Templo macro `$$neoModule(containerId, module, args)` renders the div and a DOMContentLoaded script (`camap-hx/lang/master/tpl/macros.mtt:3-9`). `View.neoArgs(args)` serialises a Haxe object into JS literal text; handles String/Int/Float/null/nested objects, while Bool and arrays fall to the nested branch via `Reflect.fields` (`camap-hx/src/View.hx:285-302`; inferred from code, not executed; templates work around with `!!parseInt(...)` inline, `camap-hx/lang/master/tpl/attention/default.mtt:9`).
11. Data access from neo modules: GraphQL at `FRONT_GRAPHQL_URL` or `/graphql` (`camap-ts/packages/front-core/src/lib/runtimeCfg.ts:22-25`), legacy REST on the Haxe host (`getRestBaseUrl`, `:49-59`). Haxe exposes `View.getGraphqlUrl()` = `camap_api + "/graphql"` (`camap-hx/src/View.hx:277-279`; `camap_api` also read at `:278` and set in `camap-hx/config.xml:16`).
12. `camap-ts/packages/front-core/src/app.ts` sets `window._Camap.clearNotifications` ("let HaXe setup the _Camap global object", `:18-21`; called `camap-ts/packages/front-core/src/modules/csaCatalog/containers/CsaCatalogPresentation.tsx:74`, typed `camap-ts/packages/front-core/src/types.ts:18`); it states "This is not the root of the frontend app!" (`:1-7`).
13. Modules needing URL routing use `BrowserRouter` with a `basename` from Haxe: `Members`, `VendorDashboard`, `VendorProfile` (`camap-ts/packages/front-core/src/modules/members/Members.module.tsx:3,29`, `camap-ts/packages/front-core/src/modules/vendorDashboard/VendorDashboard.module.tsx:11,233`, `camap-ts/packages/front-core/src/modules/vendorProfile/VendorProfile.module.tsx:7,115`); no `createBrowserRouter`, no root `<Routes>`. `camap-ts/packages/front-core/src/react-router-config.ts:1-8` exports only React Router v6 `future` flags.
14. No pure-TS page exists: Nest serves only `/neostatic`, `/locales`, `/graphql` (`camap-ts/packages/api-core/src/main.ts:60-83`); `camap-ts/public/` contains `data`, `img`, `locales`, `neostatic`.

### 4.4 Mail rendering
15. HX emails: `App.processTemplate` (injects `HOST`, `theme`, `hDate`, `_`/`__`) over `mail/*.mtt` (`camap-hx/src/App.hx:385-400`, theme `:388`). TS emails: Twing in api-core (`camap-ts/packages/api-core/src/common/mailer/adapters/twing.adapter.ts`) with the i18next `trans` filter (`:15-30,34-45`). See `messaging-mails.md`.

### 4.5 Template compilation (HX)
16. Pass 1: build with `-D i18n_generation` copies master templates into `lang/<lang>/tpl` replacing `::_("english")::` with the translation (e.g. `camap-hx/lang/master/tpl/home.mtt:75` `::_("Open orders")::` -> `camap-hx/lang/fr/tpl/home.mtt:75` `::_("Commandes ouvertes")::`), run in `camap-hx/camap-hx.Dockerfile:77-80`. Pass 2: `neko temploc2.n -macros macros.mtt -output ../tmp/ *.mtt */*.mtt */*/*.mtt` in `lang/fr/tpl` (`camap-hx/camap-hx.Dockerfile:88-90`; the comment at `:87` says `lang/master/tmp`). In dev `debug="1"` does both automatically (`camap-hx/config.xml.dist:13`). Runtime reads `lang/<lang>/tmp/*.mtt.n` (e.g. `lang/fr/tmp/account__default.mtt.n`). Dev compose mounts `./camap-hx/lang:/srv/lang`, `./camap-hx/www:/srv/www`, `./camap-ts/public:/srv/public` (`docker-compose.dev.yml:108,138-139`).
17. Haxe-JS build: `camap-hx/frontend/build.hxml` (`-main App`, `-cp ../common -cp ../js`, libs sugoi, react-next, classnames, react-types, react-router-4, redux, redux-connect, redux-thunk, material-ui, modular, tink_json; flags `-debug -dce no -D debug`, output `../www/js/app.js`, `:1-26`); also built in debug mode in the production Dockerfile (`camap-hx/camap-hx.Dockerfile:83-85`). `camap-hx/frontend/package.json` pins react 16.14, @material-ui/core 4.12, redux 4.2, react-router 5, bootstrap.native 2.0.27; vendored libs via `npm run libs:prod` -> `www/js/libs.prod.js`; `www/js/app.js` and `app.js.map` gitignored (`camap-hx/.gitignore:31`).

### 4.6 i18n
18. HX gettext: config `lang`, `langs`, `langnames` (dist: only `fr`) (`camap-hx/config.xml.dist:2-4`). Source strings are English inside code/templates: `_("text")`, `__("text ::tok::", {tok:..})`, `t._("...")` (`camap-hx/lang/master/tpl/home.mtt:75`, `camap-hx/src/controller/Main.hx:50`); contexts `"text||context"` (`camap-hx/src/View.hx:155-160`); many French literals are not wrapped (e.g. `camap-hx/js/App.hx:329`, `camap-hx/src/controller/Main.hx:31,68`, `camap-hx/src/controller/Vendor.hx:68,70`) and are never translated.
19. Extraction: `cd backend && npm run i18n:extract` = move `www/lang/allTexts.pot` to `.bak`, run `haxe potGeneration.hxml` (`-D i18n_parsing`, `camap-hx/backend/potGeneration.hxml`), then `node i18n.js diff old new` (`camap-hx/backend/package.json:18`). Merge: `npm run i18n:translate` = `node i18n.js update ../www/lang/allTexts.pot ../www/lang/texts_fr.po` (interactive prompt per new key, deletes obsolete keys, writes `.po` and `.mo`) (`camap-hx/backend/i18n.js:60-91`, `package.json:20`); `npm run i18n:compile` compiles `www/lang/*.po` (`i18n.js:6-19`). Files: `www/lang/allTexts.pot`, `texts_fr.po` (about 853 `msgid` lines by grep), `texts_fr.mo` (gitignored, `camap-hx/.gitignore:29`); the Dockerfile builds `.mo` with `msgfmt` (`camap-hx/camap-hx.Dockerfile:93-95`). Runtime `sugoi.i18n.Locale.texts` (`camap-hx/src/View.hx:21,153`); `App.t = TMap(getTranslationArray(), "fr")` is a separate hard-coded French map for DB field labels in forms (`camap-hx/src/App.hx:34-36,207-215`). Templates are translated at build time (copy per language), not at runtime.
20. TS i18next: `camap-ts/packages/front-core/src/lib/i18n.ts` (imported `camap-ts/packages/front-core/src/neo.tsx:9`): i18next + react-i18next, `lng/fallbackLng: 'fr'` hard-coded (`:16-17`; `_Camap.lang` not used); chained backend LocalStorage (24 h in production, key `__CACHE_KEY__` = git short hash) then HTTP `<CAMAP_HOST>/locales/{{lng}}/{{ns}}.json?v=<cache key>` (`:14-43`, `camap-ts/packages/front-core/src/lib/runtimeCfg.ts:27-31`); `interpolation.defaultVariables.theme` = `window._Camap.theme` (`:39-42`). Files `camap-ts/public/locales/fr/*.json` (namespaces such as translation, attendance, batch-order, csa-catalog, errors, messages, unit, yup, vendorDashboard, volunteers-calendar; folders groupMap, members, membership, payments, public, shop, upload, users); only `fr` exists. Hook `useCamapTranslation({alias: 'ns'}, loadCommon?)` (`camap-ts/packages/front-core/src/utils/hooks/use-camap-translation.tsx:3-42`). API/mail: Twing `trans` filter via `i18next-fs-backend` reading `public/locales/{{lng}}/{{ns}}.json` relative to the compiled file (`twing.adapter.ts:15-30,34-45`). Date locale: date-fns `fr` hard-coded (`camap-ts/packages/front-core/src/neo.tsx:7,29`).
21. No strings are shared between `.po/.mo` and JSON; the only shared data is the `theme` object injected as `_Camap.theme` (`camap-hx/lang/master/tpl/base.mtt:98-102`). Templates embedding neo modules pass already-translated values only via props.

### 4.7 Theme
22. Data: `Theme` typedef (`camap-hx/common/Common.hx:317-337`; `terms` fields `termsOfServiceLink, termsOfSaleLink, platformTermsOfServiceLink, privacyPolicyLink` at `:332-335`); stored as JSON in `Variable` row `whiteLabel`, read by `App.setTheme()` once per process; on missing row or any error a hard-coded default (`id:"default"`, name "CAMAP", support `inter@amap44.org`, footer with hard-coded logos) is used (`camap-hx/src/App.hx:59-151`); `getTheme()` `:156`; added to mail contexts (`:388`). TS counterpart `camap-ts/packages/camap-common/src/theme.ts` (terms: `termsOfServiceLink, termsOfSaleLink, platformTermsLink`) and `VariableService.getTheme()` (never reads `whiteLabel`; see `admin-superadmin.md`).
23. CSS: `/theme/<theme.id>/css/<variable 'css'>/{bootstrap.min.css,style(.min).css}` (`camap-hx/lang/master/tpl/base.mtt:31-38`); themes on disk `camap-hx/www/theme/default` (bootstrap, style.scss, variables.less/.scss, logos, favicons, `css_compile.sh`) and `camap-hx/www/theme/camap_old`; `www/css/print.scss`. Build: `build:sass` = `buildSass.sh` (per theme dir converts `variables.less` into `variables.scss`, runs `sass` to `style.css` and `style.min.css`; also `www/css/print.scss`) (`camap-hx/backend/buildSass.sh:1-13`, `camap-hx/backend/package.json:15`); `dev:sass` = `sass ../www/theme`; Bootstrap 3.4.1 itself is recompiled by hand with grunt (`camap-hx/www/theme/theme.md`). Logos referenced as fixed `/theme/::theme.id::/logo3.png` (`camap-hx/lang/master/tpl/design.mtt:17`, `user/login.mtt:7`), `logo2.png` (`mail/layout-camap.mtt:50`).
24. React theme: MUI theme `camap-ts/packages/front-core/src/theme/default/theme.ts`, palette `camap-ts/packages/front-core/src/theme/default/palette.ts` (primary `#eb702f`, secondary `#f6a96c`), tokens `camap-ts/packages/front-core/src/theme/commonPalette.ts`; `neo.tsx` always imports `./theme/default/theme` (`camap-ts/packages/front-core/src/neo.tsx:12`), so the runtime `theme.id` affects React styling only through the build-time `THEME_ID` palette. The legacy order box has its own `camap-hx/js/react/mui/CamapTheme.hx`.

## 5. Template inventory

`camap-hx/lang/master/tpl`: 116 `.mtt`; `camap-hx/lang/fr/tpl`: 117 (generated copy; extra `mail/digest_html.mtt`, 0 bytes, absent from master, stale).

| directory (master/tpl) | .mtt | embeds neo (direct) |
|---|---|---|
| (root) | 12 | `macros.mtt` (macro, `place-dialog` link `:3-9,141`), `neo.mtt`, `neoPublic.mtt`, `home.mtt`/`invite.mtt` (call `_Camap.registerBox`), `base.mtt` (loads bundles) |
| account | 3 | `default.mtt`, `editNotif.mtt`, `quit.mtt` |
| admin, admin/group, admin/user | 6, 2, 4 | none |
| amap | 1 | none |
| amapadmin | 5 | none (uses `_Camap.openImageUploader`) |
| amapadmin/volunteers | 1 | none (`_Camap.setReadonly`) |
| attention | 1 | `default.mtt` ("attention", not registered) |
| block | 1 | none (`modal.mtt`) |
| contract | 4 | `order.mtt` |
| contractadmin | 27 | `batchOrder.mtt` (also `_Camap.initOrderBox`, `updateUserOrderQuantity`, `getCheckboxesId`, `handleScrolling`, `openImageUploader` in other files) |
| contractadmin/subscriptionadmin | 2 | none |
| distribution | 10 | `CSAList.mtt`, `volunteersCalendar.mtt` |
| group | 4 | `disabled.mtt`, `map.mtt`, `view.mtt` |
| history | 4 | none (`_Camap.overlay`) |
| mail, mail/notifications | 12, 2 | none (server-side mail) |
| member | 6 | `default.mtt`, `loginAs.mtt`, `view.mtt` |
| messages, place | 1, 1 | `default.mtt`, `view.mtt` |
| product, shop | 1, 1 | none |
| user | 4 | `choose.mtt` (vendorHomeWidget via macro), `login.mtt` |
| vendor | 1 | none (`addimage.mtt` uses `_Camap.openImageUploader`) |

Files with a literal `neo.createNeoModule` or `$$neoModule`: account/default, account/editNotif, account/quit, attention/default, contract/order, contractadmin/batchOrder, distribution/CSAList, distribution/volunteersCalendar, group/disabled, group/map, group/view, macros, member/default, member/loginAs, member/view, messages/default, neo, neoPublic, place/view, user/choose.

Templates with few or no mentions elsewhere and where they are documented:

| template | rendered by | documented in |
|---|---|---|
| `cssDemo.mtt` (196 l.; prints `users.get("bob")` at `:5`; extends `design.mtt`) | `camap-hx/src/controller/Main.hx:209-215` | `admin-superadmin.md` |
| `admin/basedesign.mtt` (28 l.), `admin/design.mtt` | admin pages | `admin-superadmin.md` |
| `admin/user/usergroup.mtt` (46 l.) | `camap-hx/src/controller/admin/User.hx:62-77` (`@admin` `doUserGroup(u,g)`) | `admin-superadmin.md` |
| `distribution/listByDateShort.mtt`, `listByDateOnePageContract.mtt`, `listByDateOnePage.mtt` | `camap-hx/src/controller/Distribution.hx:188-193` | `distributions-volunteers.md` |
| `contractadmin/adddocument.mtt`, `addmedia.mtt` | `camap-hx/src/controller/Documents.hx:112-153`, `camap-hx/src/controller/Media.hx:82-` | `catalogs-products-vendors-places.md` |
| `contractadmin/subscriptionbalancetransfer.mtt`, `subscriptionpayments.mtt`, `history/subscriptionpayments.mtt`, `contractadmin/subscriptionadmin/editsubscription.mtt` | `camap-hx/src/controller/SubscriptionAdmin.hx`, `camap-hx/src/controller/History.hx:107-121` | `orders-subscriptions.md` |
| `contractadmin/vendorsByTimeFrame.mtt` | `camap-hx/src/controller/ContractAdmin.hx:545-640` | `payments-operations-reports.md` |
| `mail/notifications/subscription-created-*.mtt`, `mail/orderSummaryForMember.mtt`, `mail/layout-*.mtt` | `camap-hx/src/service/SubscriptionService.hx:713,739`, `camap-hx/src/service/OrderService.hx:542` | `messaging-mails.md` |

## 6. Neo module registry (`camap-ts/packages/front-core/src/neo.tsx:42-147`, 26 keys)

| module key | source (`camap-ts/packages/front-core/src/modules/...`) | mounted by (HX) |
|---|---|---|
| `batchOrder` | `batchOrder/BatchOrder.module` | `camap-hx/lang/master/tpl/contractadmin/batchOrder.mtt:5` |
| `classicContractAttendance` | `csaAttendanceSheet/ClassicContractAttendanceModule` | `distribution/CSAList.mtt:22` |
| `variableContractAttendance` | `csaAttendanceSheet/VariableContractAttendanceModule` | `distribution/CSAList.mtt:10` |
| `csaCatalog` | `csaCatalog/CsaCatalog.module` | `contract/order.mtt:16` |
| `csaCatalogSubscription` | `csaCatalog/CsaCatalogSubscription.module` | `member/view.mtt:155` |
| `deleteAccount` | `users/DeleteAccountModule/DeleteAccount.module` | `account/default.mtt:16` (macro) |
| `editNotifications` | `users/EditNotifications/EditNotifications.module` | `account/editNotif.mtt:11` |
| `groupDisabled` | `groupDisabled/GroupDisabled.module` | `group/disabled.mtt:7` |
| `groupMap` | `groupMap/GroupMap.module` | `group/map.mtt:9` |
| `haxeDatePicker` | `haxe-date-picker/HaxeDatePicker` (no Apollo) | HX form element `camap-hx/src/form/CamapDatePicker.hx:37` |
| `imageUploaderDialog` | `imageUploader/ImageUploader.module` | `_Camap.openImageUploader` (`camap-hx/js/App.hx:94-111`); `vendor/addimage.mtt:7`, `contractadmin/products.mtt:167`, `amapadmin/default.mtt:16` |
| `loginAs` | `loginRegistration/LoginAs.module` | `member/loginAs.mtt:7` |
| `loginRegistration` | `loginRegistration/LoginRegistration.module` | `_Camap.loginBox/registerBox` (`camap-hx/js/App.hx:259-284`); `user/login.mtt:30`, `home.mtt:53,387`, `invite.mtt:6`, `group/view.mtt:430,448,471` |
| `members` | `members/Members.module` | `member/default.mtt:7` |
| `membershipDialog` | `membership/MembershipDialog.module` | `_Camap.membershipBox` (`camap-hx/js/App.hx:286-304`); `member/view.mtt:213` |
| `messages` | `messages/Messages.module` | `messages/default.mtt:7` |
| `place` | `places/PlaceModule` | `place/view.mtt:9`, `group/view.mtt:376` |
| `place-dialog` | `places/PlaceDialogModule` | `macros.mtt:141`, `group/view.mtt:573` |
| `quitGroup` | `users/QuitGroup/QuitGroup.module` | `account/quit.mtt:10` |
| `userAccount` | `users/UserAccountModule/user-account.module` | `account/default.mtt:7` (macro) |
| `vatBox` | `vatBox/VatBox.module` (no Apollo) | `_Camap.getVATBox` (`camap-hx/js/App.hx:75-92`); no Haxe caller found in `src`/`common`/`lang` |
| `vendorHomeWidget` | `vendorDashboard/VendorHomeWidget.module` | `user/choose.mtt:22` (macro) |
| `vendorDashboard` | `vendorDashboard/VendorDashboard.module` (BrowserRouter + `layout/DashboardLayout`) | `neo.mtt` via `Vendor.doDashboard` (`camap-hx/src/controller/Vendor.hx:41-50`) |
| `vendorProfile` | `vendorProfile/VendorProfile.module` (BrowserRouter + `layout/VendorLayout`) | `neoPublic.mtt` via `Vendor.doView` (`camap-hx/src/controller/Vendor.hx:21-39`) |
| `volunteersCalendar` | `volunteersCalendar/VolunteersCalendar.module` (no Apollo) | `distribution/volunteersCalendar.mtt:6` |

Mounted but not registered: `attention` at `camap-hx/lang/master/tpl/attention/default.mtt:7` (no `attention` key in `camap-ts/packages/front-core/src/neo.tsx:42-147`; would throw `Unknown module: attention`, `:172-174`; `camap-ts/packages/front-core/src/layout/AdminLayout.tsx:26,31` lists `/admin/attention` routes but the layout is unused).

Other front-core inventory: `src/components` (CommonAlertError, DayPicker, DeleteButton, DistributionInfoCard, DocumentList, DocumentUploader, Empty, TabPanel, UpdateButton; dirs attendanceSheet, calendar, dateRangePicker, forms, map, svg, utils, vendor), `src/containers/geo`, `src/layout` (AdminLayout, DashboardLayout, GroupLayout, PublicLayout, VendorLayout; only DashboardLayout and VendorLayout are imported by modules), `src/lib` (i18n.ts, runtimeCfg.ts, initApollo.tsx, withApollo.tsx, withi18n.tsx, auth.context.tsx, datei18n.ts, mapboxconfig.ts, strings.ts, `REST/`, CamapApolloMockedProvider), `src/gql` generated by `npm run gen:gql` (`camap-ts/packages/front-core/package.json`, `gql.gen.yml`), `src/config/apollo.config.ts`; Storybook `npm run storybook`, stories in `camap-ts/packages/front-core/stories/` and next to modules. Front-core logging/errors: `utils/logger.ts` logs only outside production/test (`camap-ts/packages/front-core/src/utils/logger.ts:3-14`); 30 files use `ApolloErrorAlert`; Apollo client has only a scalar link and a custom-header link, no `onError` link (`camap-ts/packages/front-core/src/lib/initApollo.tsx:33-75`); custom header `X-CAVEA-URL` (`camap-ts/packages/camap-common/src/header.ts:1`) sent with `window.location.pathname` (`camap-ts/packages/front-core/src/lib/initApollo.tsx:33-40`), allowed in CORS (`camap-ts/packages/api-core/src/main.ts:37-45`) and read by no server code. `camap-ts/packages/camap-common/src/email.ts` (`isEmail`, `containsEmail`, `CONTAINS_EMAIL_REGEX`): `isEmail` used only by `camap-ts/packages/front-core/src/modules/messages/components/MessageRecipientsSelect.tsx:527,547`.

## 7. Haxe-JS inventory (`camap-hx/js`)

`App.main()` creates one `App` and assigns `window._` and `window._Camap` (`camap-hx/js/App.hx:61-64`); fields `currency`, `t` (declared, not set), `Modal`, `lang`, `userId`, `userName`, `userEmail` (`:48-54`) set by `base.mtt:106-111`; `_Camap.theme`, `_Camap.version` assigned dynamically by the template.

| function (`camap-hx/js/App.hx`) | purpose | called from |
|---|---|---|
| `getVATBox` (`:75`) | mounts neo `vatBox` | no caller found |
| `openImageUploader` (`:94`) | mounts neo `imageUploaderDialog` | vendor/addimage, contractadmin/products, amapadmin/default |
| `initOrderBox` (`:113`) | legacy React16+Redux `OrdersDialog` | contractadmin/orders.mtt:29,107; ordersByDate.mtt:66 |
| `updateUserOrderQuantity` (`:145`) | `POST /api/order/updateOrderQuantity/<userId>` via `HttpUtil.fetch`, updates DOM totals | contractadmin/orders.mtt:147 |
| `roundTo` (`:223`) | static helper | none found |
| `overlay` (`:233`) | Ajax-load URL into `#myModal` | contract/editVarOrders:29, history/csaorders:40, history/basket:30 |
| `modal` (`:249`) | show bootstrap modal | none (block/modal.mtt uses `new _Camap.Modal(...)`, `:27`) |
| `loginBox` / `registerBox` (`:259,282`) | mounts neo `loginRegistration` | user/login, home, invite, group/view |
| `membershipBox` (`:286`) | mounts neo `membershipDialog` | member/view.mtt:213 |
| `getCheckboxesId` (`:306`) | ids of checked checkboxes | contractadmin/products.mtt:37,49 |
| `setWarningOnUnload` (`:319`), `goto` (`:358`), `toggle/show/hide` (`:400-418`) | DOM helpers | none found |
| `antiDoubleClick` (`:340`) | disables `.btn` for 3 s | base.mtt:113 |
| `setReadonly` (`:426`) | | amapadmin/volunteers/default.mtt:49-59 |
| `resetGroupInSession` (`:448`) | `GET /account/quitGroup/<id>` | none found |
| `InitStockTrackingComponent` (`:453`) | form visibility | `camap-hx/src/form/StockTrackingPerDistribForm.hx:189` |
| `handleScrolling` (`:531`) | scroll buttons | contractadmin/stocks.mtt:2 |
| `handleAriaTabEvents` (`:592`) | ARIA tabs + `?tabId` | group/view.mtt:10 |

Other files: `camap-hx/js/bootstrap/Modal.hx` (bootstrap.native wrapper), `camap-hx/js/utils/HttpUtil.hx` (XHR promise wrapper; `HttpMethod.PATCH = 'GET'` at `:16`; used only by `updateUserOrderQuantity`), `camap-hx/js/react/order/**`, `camap-hx/js/react/product/**`, `camap-hx/js/react/user/redux/components/UserSelector.hx`, `camap-hx/js/react/mui/CamapTheme.hx` (legacy order box, reachable only via `initOrderBox`; see `orders-subscriptions.md` 5.6). `camap-hx/common/GitMacros.hx` (82 l.): build-time macros `getGitCommitDate`, `getGitShortSHA`, `getGitBranch` shelling out to git (`:13-27,33-50,56-73`); imported by `camap-hx/src/App.hx:2` but only used in commented code (`camap-hx/src/App.hx:21`, `camap-hx/js/App.hx:40`), so version is the literal `[3,0,12]`.

## 8. Server-side form widgets (`camap-hx/src/form/*`, sugoi.form, rendered by `form.mtt`)

| file | behaviour | used by | TS / React counterpart |
|---|---|---|---|
| `CamapForm.hx` (57 l.) | extends `sugoi.form.Form`; `fromSpod` maps DDate/DTimeStamp/DDateTime to `CamapDatePicker` (`renderDDate` opens on "year" for `birthdate`/`birthday`, `:38-44`; `renderDTimeStamp` `:48`); `addRichText(form,selector)` injects inline TinyMCE init (`/js/tinymce/tinymce.min.js`, plugins autolink emoticons image code link lists, `language` = session lang, GPL licence key, `:23-41`); throws "richtext already added to form." if called twice | `camap-hx/src/controller/Place.hx:43,70`, `Amap.hx:42,77`, `Distribution.hx:294`; `addRichText`: `Amap.hx:77`, `Product.hx:96,144`, `ContractAdmin.hx:156`, `amapadmin/Volunteers.hx:79` | React forms in front-core; Slate for messages |
| `CamapDatePicker.hx` (47 l.) | extends `NativeDatePicker`; renders a `<div id>` plus inline script `neo.createNeoModule(id,"haxeDatePicker",{name,type,value,required,openTo})` (`:27-46`); `getTypedValue` null for empty else `Date.fromString`; format `"EEEE d MMM yyyy"`; constructor parameter spelled `attibutes` while `super` receives `attributes` (`:13-21`) | `camap-hx/src/controller/Transaction.hx:35,107`, `Distribution.hx:429,437,438,566,622,630,637` | `camap-ts/packages/front-core/src/modules/haxe-date-picker`; writes `YYYY-MM-DD HH:mm:ss` local time (`HaxeDatePicker.tsx:21-28,99-103`); empty value becomes now (`:37-42`) |
| `CamapDateTimePicker.hx` (11 l.) | type `datetime` | `Distribution.hx:300-301` | same |
| `CamapTimePicker.hx` (11 l.) | type `time` | no usage found | same |
| `RawHtml.hx` (26 l.) | renders arbitrary HTML between fields | `Contract.hx:99`, `amapadmin/Volunteers.hx:25,29`, `CamapForm.hx:25` | none |
| `ColorRadioGroup.hx` (45 l.) | radio of colored squares from `db.CategoryGroup.COLORS` | no usage found | none |
| `ProductTypeRadioGroup.hx` (49 l.) | radio with `/img/<type>.png` per `ProductType` | no usage found | none |
| `UnitQuantity.hx` (26 l.) | `FloatInput` + unit label `Formatting.unit(unit)` | no usage found | `camap-ts/packages/camap-common/src/products/format.ts` |
| `StockTrackingPerDistribForm.hx` (234 l.) | composite stock-per-distribution input (see `catalogs-products-vendors-places.md` rule 32) | `camap-hx/src/service/ProductService.hx:119` | `Product.stockTracking` in GraphQL (`camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:142`) |

Other HX units: `camap-hx/src/controller/Controller.hx` (base class `extends sugoi.BaseController`); `camap-hx/src/tools/StringTool.hx` (35 l.: `toSortingKey` accent folding, `compare`; used `Amap.hx:26`, `History.hx:43`, `ContractAdmin.hx:59,75`, `Main.hx:92`); `camap-hx/src/tools/ObjectListTool.hx` (156 l.: `getIds`, `deduplicate`, `toIdMap`, `deduplicateOrders`, `deduplicateDistribsByKey`, `groupDistribsByKey`, `groupOrdersByKey`, `:49-137`); `camap-hx/src/tools/ArrayTool.hx` (60 l.: `groupByDate`, `mapLength`, `deduplicate`; used `db/MultiDistrib.hx:405`, `service/VolunteerService.hx:193,397`, `service/AbsencesService.hx:34`); `camap-hx/src/import.hx` (global `using Lambda; using Std;`).

## 9. Flows

1. Page render: Apache -> Neko -> Dispatch -> controller -> `view` -> `.mtt` (compiled `lang/fr/tmp/*.n`) -> `base.mtt` -> neo scripts from manifest -> inline `neo.createNeoModule` calls on DOMContentLoaded.
2. Neo mount: `createNeoModule(id, name, props)` -> registry lookup -> lazy component -> wrapper (Apollo/MUI/i18n) -> React root in the div.
3. Translation: build-time template copy per language + gettext `.mo` at runtime (HX); i18next JSON over HTTP (TS front) or `i18next-fs-backend` (Twing).
4. Theme: `Variable.whiteLabel` -> `App.setTheme()` -> `_Camap.theme` and CSS path; React theme fixed at build by `THEME_ID`.

## 10. Ownership hx vs ts

| concern | HX | TS |
|---|---|---|
| Page shells, routing, templates | all | none (modules only) |
| React modules | host pages | front-core modules |
| Theme data | `Variable.whiteLabel` read | default theme, no DB read |
| Translations | `.po/.mo` + template copies | JSON i18next, `fr` only |
| Date pickers in forms | server widget | `haxe-date-picker` module |
| Form widgets (TinyMCE etc.) | `camap-hx/src/form` | none |

## 11. Known security/rights observations

Pointers only, see inconsistencies-code.md: every page render depends on Nest availability and a process-cached manifest; `attention` module not registered; unauthenticated `/cssdemo`; Apache upstream host name mismatch. Doc divergences for `neo-modules.md`, `i18n.md`, `theme.md`, `templates.md`: see inconsistencies-docs.md.
