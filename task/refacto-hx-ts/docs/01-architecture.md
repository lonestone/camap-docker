# 01 - Architecture, runtime, build and configuration

Scope: describes the current runtime topology of CAMAP (Haxe `camap-hx` and TypeScript `camap-ts` sharing one MySQL database), the components and their versions, request routing, how a page is rendered, the build pipelines, the full configuration reference (HX `config.xml`, TS environment variables, values shared between the two), scheduled-job triggering, and logging/error handling. Paths are relative to the `camap-docker` repo root. "unverified" marks facts that could not be proven from the repository alone. The root `.env` was not read (secrets); only `.env.sample`, `.env.test`, `.env.ci.test` and code were used.

Sources: drafts 01, 09 (rendering pipeline, brief), 10 (integration overview), 11 (sections 4.1 Haxe `Variable` keys excluded here, 5 logging and errors).

See inconsistencies-code.md / inconsistencies-documentation.md for the list of discrepancies found in this area.

## 1. Overview

- HX serves HTML pages (Templo `.mtt` templates) through Apache + mod_neko (`camap-hx/camap-hx.Dockerfile:111,123`). TS serves GraphQL/REST, the React "neo" bundles under `/neostatic/`, and i18n JSON under `/locales/` (`camap-ts/packages/api-core/src/main.ts:63,74`).
- HX and TS call each other: HX -> TS through `camap_bridge_api` (`camap-hx/src/service/BridgeService.hx:14,78,89,98`); TS -> HX through `CAMAP_LOCAL_HOST` for crons (`camap-ts/packages/api-core/src/tools/crontab.service.ts:60`). Shared secret: HX `key` equals TS `CAMAP_KEY`.
- Both apps share ONE MySQL database (HX: `database` in `config.xml:10`; TS: `DB_*` in `.env.sample:15-23`).
- Every page a user navigates to is rendered server-side by camap-hx; React code from camap-ts is injected into those pages as "neo modules" (see section 4). Detail of the integration channels is in `05-cross-stack-integration.md`.

## 2. Components and versions

| Component | Version | Source |
|---|---|---|
| Haxe | 4.0.5 | `camap-hx/camap-hx.Dockerfile:15`, `camap-hx/backend/.haxerc` |
| lix | 15.12.4 | `camap-hx/camap-hx.Dockerfile:13` |
| Node (build and runtime images; both TS and HX frontend build) | 20.19.5 | `camap-hx/camap-hx.Dockerfile:4`, `camap-ts/camap-ts.Dockerfile:1,39`, `camap-ts/package.json:3-5` |
| Neko | distro package (Debian) `neko`, `libapache2-mod-neko` (runtime base `debian:bookworm-slim`) | `camap-hx/camap-hx.Dockerfile:100,111` |
| Apache | distro `apache2`, mods rewrite, neko, headers, proxy, proxy_http | `camap-hx/camap-hx.Dockerfile:111,123,130` |
| HX framework | Sugoi pinned commit c3b8db8 (CAMAP-APP/sugoi), templo 3.0.0, record-macros (fork bablukid, pinned sha) | `camap-hx/backend/haxe_libraries/sugoi.hxml:1`, `templo.hxml:2`, `record-macros.hxml:1` |
| HX app VERSION | 3.0.12 (hard-coded literal; git macros commented out) | `camap-hx/src/App.hx:20-21` |
| HX frontend (Haxe -> JS) | React 16.14.0, react-redux 5.1.2, MUI 4.12.4, react-router ^5 | `camap-hx/frontend/package.json:8-17` |
| NestJS | ^9 (core ^9.4.3), @nestjs/graphql ^12, apollo-server ^3, @nestjs/schedule ^4, @nestjs/typeorm ~8.0 | `camap-ts/packages/api-core/package.json:77-88,92-93` |
| TypeORM | ^0.2.45 (root and api-core) | `camap-ts/package.json:41`, `camap-ts/packages/api-core/package.json:130` |
| TypeScript | ^4.6.3 | `camap-ts/package.json:34`, api-core `package.json:74`, front-core `package.json:132` |
| front-core (React "neo") | React ^18.2, MUI ^5.6, @apollo/client ^3.7, react-router-dom ^6.4, webpack ^5.90 | `camap-ts/packages/front-core/package.json:16,27,70,72,78,81` |
| camap-common | rollup -> CJS `dist/index.js` | `camap-ts/packages/camap-common/package.json:4-6`, `rollup.config.js:12-19` |
| MySQL | 8.0.36 image, utf8mb4, `mysql_native_password`, sql-mode without STRICT_TRANS_TABLES, max_allowed_packet 100M, TZ Europe/Paris | `mysql.Dockerfile:1,12-13`, `camap-ts/mysql/my.cnf` |
| Traefik | v3.6.8 (dev) / `beaufort` (easy, prod) | `docker-compose.dev.yml:5`, `docker-compose.easy.yml:5`, `docker-compose.prod.yml:5` |
| Mailpit | `axllent/mailpit` (SMTP 1025, UI 8025; auth mail_user/mail_pass) | `docker-compose.dev.yml:143-153` |

Notes
- Two React versions coexist on the same pages: 16 (+ react-router 5) in the HX frontend (`camap-hx/frontend/package.json:13,16`), 18 (+ router 6) in TS front-core (`camap-ts/packages/front-core/package.json:70,78`).
- The Haxe frontend is always compiled with `-dce no`, `-debug`, `-D debug` (`camap-hx/frontend/build.hxml:23-25`), so there is no production flavour of `app.js`.
- Timezone: `TZ=Europe/Paris` in the HX runtime (`camap-hx/camap-hx.Dockerfile:115`), the TS runtime (`camap-ts/camap-ts.Dockerfile:54`) and MySQL (`mysql.Dockerfile:12`). TS tests run with `TZ=UTC` (`camap-ts/packages/api-core/package.json:27`).
- CODEOWNERS (root, `camap-hx`, `camap-ts`): `* @Mandrak-Kimigo @InterAMAP44`, no per-folder owners (`CODEOWNERS:1`, `camap-hx/CODEOWNERS:1`, `camap-ts/CODEOWNERS:1`).

## 3. Runtime topology and request routing

### ~~3.1 Traefik~~
Irrelevant

### 3.2 Apache inside the HX container (path -> destination)
Defined in `camap-hx/apache/camap-static.conf` (copied by `camap-hx/camap-hx.Dockerfile:131-132`):
- `/neostatic/` -> proxy `http://nest-devcamap:3010/neostatic/` (`camap-static.conf:16-17`)
- `/graphql` -> proxy `http://nest-devcamap:3010/graphql` (`:20-21`)
- `/locales/` -> proxy `http://nest-devcamap:3010/locales/` (`:24-25`)
- `/env.js` -> local file `/srv/www/env.js` (no-store) (`:7-13`)
- These four bypass mod_neko and the rewrites (`:28-37`).
- Everything else goes through `camap-hx/www/.htaccess`: any extension-less path (`^[_a-z0-9A-Z-]+$` names) not under `/file/*` is rewritten to `/index.n` (the Neko app) (`camap-hx/www/.htaccess:1-9`); `css/<hash>/` and `js/<hash>/` cache-busting prefixes are stripped (`.htaccess:3-4`). No Apache or Traefik rule restricts `/cron/*` (`camap-hx/apache/camap-static.conf`, `traefik/config`).
- Docroot `/srv/www` (`camap-hx.Dockerfile:125,127`); `AllowOverride All` (`:124`); logs to stdout/stderr (`:121-122`).
- `camap-hx/apache.conf` (`Listen 3009`, vhost on 3009, `camap-hx/apache.conf:4,6`) is not referenced by the Dockerfile; the image uses `camap-hx/apache/camap-static.conf` and the default Debian site (`camap-hx.Dockerfile:127,131-134`). (Draft 10 describes the HX vhost as "port 3009"; the Dockerfile healthcheck and Traefik service use port 80, so port 3009 is not what runs in the image.)
- Sugoi loads `config.xml` from `getCwd()+"../"` = `/srv/config.xml` (Sugoi `Config.hx:19,22`, external lib `~/haxe/haxe_libraries/sugoi/...`, pinned commit c3b8db8).
- Templates: when `debug=1` HX uses `../lang/master/` (compiled on the fly); otherwise `../lang/<lang>/` precompiled `tmp/` (Sugoi `BaseApp.hx:80-85`, external).

### 3.3 Browser to servers
- The HX base template loads scripts from TS: HX asks `GET {camap_bridge_api}/neostatic/manifest.json` and builds the list `/env.js`, runtime.js, vendors.js, reactlibs.js, neo.js, app.js (`camap-hx/src/service/BridgeService.hx:12-21,50-62`). The browser then fetches `/neostatic/...` on the HX host, which Apache proxies to Nest.
- Browser GraphQL goes to `FRONT_GRAPHQL_URL` (emitted into `env.js`, `camap-hx/entrypoint.sh:61`); Apache also proxies `/graphql` as a relative fallback (`camap-static.conf:19-21`).
- HX -> TS server-side bridge: `Authorization: Bearer <config key>` (`BridgeService.hx:105`) validated by `BridgeStrategy` against `CAMAP_KEY` (`camap-ts/packages/api-core/src/auth/strategies/bridge.strategy.ts:13`).
- Nest listens on `API_HOSTNAME:API_PORT` (fallback `PORT`, then 3001) (`main.ts:87-90`); `.env.sample` sets `nest-loc-camap`:3010 (`.env.sample:53-54`).
- Nest static: `/srv/public/neostatic` at `/neostatic/` (365 d immutable cache), `/srv/public/locales` at `/locales/` (1 day) (`main.ts:58-80`). `srvRoot` is hard-coded `/srv` (`main.ts:58`).
- Nest health: `GET /health`, `GET /ping` (`camap-ts/packages/api-core/src/tools/tools.controller.ts:11,19`), returning `{version: VERSION||0}` (`:13,21`). HX has `/ping` printing its hard-coded version (`camap-hx/src/controller/Main.hx:326-328`).
- HX container healthcheck: `curl http://127.0.0.1/` (`camap-hx.Dockerfile:155`). No healthcheck for Nest/MySQL in compose or Dockerfile (unverified for the easy images).
- Nest CORS: `origin: [FRONT_URL, CAMAP_HOST]` in production, `true` otherwise; credentials on; allowed headers include the custom `URL_CUSTOM_HEADER` (`X-CAVEA-URL`) (`main.ts:32-47`). Helmet CSP only when production (`main.ts:50-55`). Body limit 25 MB (`main.ts:29-30`), GraphQL upload max 1 GB / 10 files (`main.ts:27`).

## 4. Request lifecycle of a page

1. Browser requests `https://camap.localdomain/<path>`; Traefik routes by host to the Apache container (`docker-compose.dev.yml:129-130`).
2. Apache: `/neostatic/`, `/graphql`, `/locales/`, `/env.js` bypass Neko (section 3.2). Any other path is rewritten to `/index.n` (`camap-hx/www/.htaccess:5-8`).
3. Sugoi/`haxe.web.Dispatch` dispatches `doXxx` controller methods (`Main` delegates to sub-controllers, `camap-hx/src/controller/Main.hx:55-64`); `doDefault` handles maintenance mode, permalinks, else redirects to `/home` (`Main.hx:34-53`). Methods annotated `@tpl("x.mtt")` choose the template. `/api/*` is dispatched to `controller.Api` (`Main.hx:190-207`).
4. The controller sets properties on `view` (`camap-hx/src/View.hx`); the `.mtt` is rendered. Most pages `::use 'design.mtt'::` (wrapping `base.mtt`); the public vendor page uses `neoPublic.mtt` (`camap-hx/lang/master/tpl/neoPublic.mtt:1`).
5. `base.mtt` emits Bootstrap 3 CSS and `style(.min).css` from `/theme/<theme.id>/css/<getVariable('css')>/` (`camap-hx/lang/master/tpl/base.mtt:31-38`), `/font/icons.css` (`:42`), Leaflet CSS (`:45`), then `fetch.umd.js`, `libs.prod.js`, `app.js` from `/js/<getVariable('js')>/` (`:50-53`); `app.js` is the Haxe-JS output (`camap-hx/frontend/build.hxml:28`).
6. At the end of `<body>`, an inline script sets `_Camap.theme`, then on DOMContentLoaded `_Camap.lang/userId/userName/userEmail/version` and calls `antiDoubleClick()` (`base.mtt:98-115`). Then `::foreach script getNeoModuleScripts()::` emits the neo bundle `<script>` tags (`base.mtt:118-120`).
7. `View.getNeoModuleScripts()` delegates to `BridgeService.getNeoModuleScripts()` (`camap-hx/src/View.hx:281-283`), which fetches `<camap_bridge_api>/neostatic/manifest.json` with curl once per process (static cache) (`BridgeService.hx:12-20`). Returned list in order: `/env.js`, then manifest keys `runtime.js`, `vendors.js`, `reactlibs.js`, `neo.js`, `app.js` normalised to `/neostatic/...` (`BridgeService.hx:44-63`). Fallback: a 1-hour Neko cache entry `manifest` (written with probability 1/10), else the exception "Unable to load ressources from CAMAP-ts." (`:57-72`). If Nest is down at render time, every page render fails because `base.mtt` always calls this (`base.mtt:118`).
8. In the browser, templates call `neo.createNeoModule(containerId, moduleName, props)` (via the Templo macro `$$neoModule`, `camap-hx/lang/master/tpl/macros.mtt:3-9`) to mount lazily loaded React 18 components (`camap-ts/packages/front-core/src/neo.tsx:42-195`). The registry holds 26 module keys. Neo modules reach data via GraphQL (`FRONT_GRAPHQL_URL` or `/graphql`, `camap-ts/packages/front-core/src/lib/runtimeCfg.ts:22-25`) and legacy REST on the HX host (`getRestBaseUrl`, `runtimeCfg.ts:49-59`).
9. There is no pure-TS page: front-core has no top-level router; only 3 module-local `BrowserRouter`s (`Members`, `VendorDashboard`, `VendorProfile`) (`camap-ts/packages/front-core/src/app.ts:1-7`). Nest serves only `/neostatic`, `/locales` and `/graphql` (`main.ts:60-83`).

Mails are rendered by Haxe `App.processTemplate` from `mail/*.mtt` (`camap-hx/src/App.hx:385-400`) and separately by Nest with Twing (`camap-ts/packages/api-core/src/common/mailer/adapters/twing.adapter.ts`). The full template, neo-module, i18n and theme inventory is in the frontend document (draft 09 scope); the neo bridge is also summarised in `05-cross-stack-integration.md`.

## 5. Build pipelines

### 5.1 HX image (`camap-hx/camap-hx.Dockerfile`, multi-stage)
Builder (node:20.19.5-slim):
1. Installs `neko gettext git curl` (`:7-10`), lix 15.12.4 (`:13`), Haxe 4.0.5 (`:15,35-36`).
2. Backend deps via `lix download` in `/srv/backend` (`:32-39`); frontend deps + `npm ci` in `/srv/frontend` (`:50-58`).
3. Copies `common data js lang src www backend frontend` (`:64-71`) and `config.xml.dist` as `/srv/config.xml` (`:73`; needed only at build).
4. Backend: `haxe -v build.hxml -D i18n_generation` -> `www/index.n` (`:77-80`, `camap-hx/backend/build.hxml:18`). The `i18n_generation` define makes Sugoi `TemplateTranslator` parse `../lang/master` and generate `lang/<lang>/tpl` (Sugoi `BaseApp.hx:50-52`, external; the generation itself is unverified).
5. Frontend: `haxe -v build.hxml` -> `www/js/app.js` (`:85`, `camap-hx/frontend/build.hxml:28`).
6. Templates: `neko ../../../backend/temploc2.n -macros macros.mtt -output ../tmp/ *.mtt */*.mtt */*/*.mtt` run in `lang/fr/tpl` (`:88-90`). `lang/fr/tpl` is gitignored (`camap-hx/.gitignore`) and exists only after the backend build with `-D i18n_generation`; `backend/package.json:11` `build:tmpl` compiles `lang/master/tpl` instead.
7. `.po` -> `.mo`: `msgfmt www/lang/texts_fr.po -o www/lang/texts_fr.mo` (`:94`).

Runtime (debian:bookworm-slim): installs apache2 + mod_neko and perl twig libs (`:109-113`); copies `/srv/www /srv/lang /srv/data` and `temploc2.n` -> wrapper `/usr/bin/temploc2` (`:138-144`); creates `lang/master/tmp` (0777) and `www/file` (`:151-152`); writes a default `robots.txt` (Disallow all except /group/) if absent (`:150`); `ENTRYPOINT /entrypoint.sh` (`:156`). The runtime image has NO `config.xml`, NO `backend/`, no `frontend/` and no haxe (only the artifacts listed).

Dev compose mounts local `./camap-hx/lang:/srv/lang` and `./camap-hx/www:/srv/www` (`docker-compose.dev.yml:138-139`), shadowing the image-built `lang/fr/tmp`, `www/index.n`, `www/js/app.js` and `texts_fr.mo` with host files (`*.n`, `www/lang/*.mo` are gitignored). The entrypoint writes `env.js` into this mounted dir (`entrypoint.sh:4`), ignored by git (`camap-hx/.gitignore:55`). `./camap-ts/public` is mounted as `/srv/public` for neo bundles (`docker-compose.dev.yml:108`).

### 5.2 HX entrypoint (`camap-hx/entrypoint.sh`)
- Sources `/srv/camapts.env` if present (normalises `KEY: v`, `KEY = v`, CRLF) (`:5,9-29`).
- Generates `/srv/www/env.js` setting `window.__APP_CONFIG__` with keys PUBLIC_PATH (default `/neostatic/`), API_HOSTNAME, API_PORT, CAMAP_HOST, CAMAP_BRIDGE_API, FRONT_URL, FRONT_GRAPHQL_URL, MAPBOX_KEY; empty values omitted (`:31-64`). (Other drafts cite the same block as `entrypoint.sh:35-62` / `:41-66`; the exact line span differs between drafts.)
- Starts `apache2ctl -D FOREGROUND` (`:67`). No cron daemon is started.

### 5.3 TS image (`camap-ts/camap-ts.Dockerfile`)
- Builder: installs g++/make/python3/git/perl libs (`:6-8`), non-root user `interamap` (`:10`); copies `orm*.js package*.json packages public` (`:15-17`), `.env.sample` as `/srv/.env` (`:20`; the `bash -c "source ... && export"` on `:21` has no persistent effect), `npm install` (`:24`), rebuilds node-sass/bcrypt/sharp (failures ignored, `:25-27`), `npm run build` (`:28`), `npm prune --production` (`:29`), copies `api-core/mails/dist` to `/srv/mails/dist` (`:31-34`), copies `scripts/` (`:36`). Build arg `GIT_COMMIT_SHORT` (`:3-4`).
- Runtime: same node, installs `libconfig-tiny-perl virtual-mysql-client-core procps` (`:49-53`), `NODE_ENV=production` (`:54-55`), `CMD node packages/api-core/dist/main.js` (`:65`). The image `CMD` does not run migrations; only `start:prod` runs `typeorm migration:run` (`camap-ts/packages/api-core/package.json:25`), used only by `docker-compose.prod.yml:86`. Dev and easy use `start:dev` (`nest start --watch`, `docker-compose.dev.yml:97`, `docker-compose.easy.yml:71`); `@nestjs/cli` is in `dependencies` (`api-core/package.json:79`).
- Root build: `npm run build` = `build:common` (rollup) -> `build:api` (`prebuild` rimraf dist, `build:mail` ts-node, then `nest build -p tsconfig.build.json`) -> `build:front` (webpack) (`camap-ts/package.json:11-14`, `camap-ts/packages/api-core/package.json:14-17`).
- front-core webpack: entries `neo` (`src/neo.tsx`) and `app` (`src/app.ts`), `mode: production` hard-coded, output `camap-ts/public/neostatic/[name].[contenthash].bundle.js` with `libraryTarget: 'var'`, plus `manifest.json` (WebpackManifestPlugin); `publicPath '/neostatic/'` is overridden at runtime by `src/set-public-path.ts` from `__APP_CONFIG__.PUBLIC_PATH` (`camap-ts/packages/front-core/webpack.config.js:11-12,31-35,74,102-112`, `src/set-public-path.ts:11-26`). Chunks: `reactlibs`, `vendors`, `runtime` (`webpack.config.js:113-129`). Build-time constants: `process.env.NODE_ENV` and `__CACHE_KEY__` (= `GIT_COMMIT_SHORT` or `git rev-parse --short HEAD` or `unknown`) (`:14-28,75-80`); used for the i18n URL `?v=` (`src/lib/runtimeCfg.ts:27`, `src/lib/i18n.ts:26`). `FRONT_URL/FRONT_GRAPHQL_URL/CAMAP_HOST/MAPBOX_KEY` are not inlined at build; they are read at runtime from `window.__APP_CONFIG__` (`webpack.config.js:76-77`; `entrypoint.sh:55-62`). `public/neostatic` is gitignored.
- Theme: at build start webpack copies `src/theme/${THEME_ID}/palette.ts` to `src/palette.ts`, and restores `default` at the end (`webpack.config.js:81-100`); `THEME_ID` is read from `camap-ts/.env` via dotenv (`:10`).
- Dev watch: `webpack watch --config webpack.dev.config.js` (`front-core/package.json:7`). Storybook: `npm run dev:story` -> port 6006 (`camap-ts/package.json:19`, `front-core/package.json:11`). `front-core/vite.config.ts:1-7` exists and appears to serve only Storybook (`@storybook/react-vite`, `package.json:96`) (inference).
- camap-common: `rollup -c && rimraf ./dist && mv ./tmp ./dist` (`camap-common/package.json:8`); root `postinstall` installs the 3 packages' deps with `--ignore-scripts` (`camap-ts/package.json:27`); api-core and front-core depend on `camap-common` as `file:../camap-common` and on `camap-ts: file:../..` (`api-core/package.json:95-96`, `front-core/package.json:40-41`).
- MySQL image: `mysql:8.0.36` + `camap-ts/mysql/my.cnf` (`mysql.Dockerfile:11`); build context must be the repo root (`docker-compose.dev.yml:53-55`).
- Auxiliary scripts not referenced by Dockerfiles/compose/package.json: `camap-ts/scripts/start.sh` (DB init via `schema:sync` + `dataset`, `:25-26`), `scripts/tune-env-file.pl` (maps `PW_HASH_KEY` -> `CAMAP_KEY`, `:20-22`), `scripts/iso-3166-1.sh` (copies to `packages/front-core/public/data`, `:9`), `scripts/setup.sh:3-11`. `camap-ts/README.md:22` mentions Scalingo; `camap-hx/scripts/update-config.pl:24-26` sets HX `key` from `PW_HASH_KEY`.
- `camap-ts/package.json:20-21` scripts restart `neko-camap` / `nest-camap` and `api-core/package.json:37` logs `nest-camap`; compose services are named `neko-loc-camap` / `nest-loc-camap`.

### 5.4 Standalone HX (non-docker) scripts
- `camap-hx/backend/package.json:9-17`: `build:hx`, `build:tmpl` (uses `lang/master/tpl` -> `lang/master/tmp`), `build:sass`, `watch` (nodemon), `i18n:extract|diff|translate|compile`.
- `camap-hx/frontend/package.json:33-37`: `build` (npm-run-all `build:*` => `haxe build.hxml`), `libs:prod` (rollup `libs/rollup.config.js`), `watch`.
- Sass: `build:sass` = `buildSass.sh` (per theme dir: `variables.less` -> `variables.scss`, `sass` to `style.css`/`style.min.css`; also `www/css/print.scss`) (`camap-hx/backend/buildSass.sh:1-13`).

### 5.5 CI (GitHub Actions)
- HX: `docker-publish.yml` (tag `vX.Y.Z` from master -> `ghcr.io/camap-app/camap-hx`), `publish-staging|feature|fix|mantis.yml` (`camap-hx/.github/workflows/`).
- TS: same set (`camap-ts/.github/workflows/`); production tags `vX.Y.Z`, `major_minor`, `major`, `latest`; staging `staging-vX` tag -> `:staging` (`docker-publish.yml:54,101-105`, `publish-staging.yml:18,54,87-90`). No `master` tag was found in these two workflows (the easy compose uses `:master`; other publish-* workflows not checked).
- No CI config exists at the `camap-docker` root. See `06-existing-tests.md` for test-related CI facts.

## 6. Configuration reference

### 6.1 HX `config.xml` (Sugoi `sugoi.Config`, attributes of root `<config>`)
Runtime location `/srv/config.xml` (dev: bind mount of root `config.xml`, `docker-compose.dev.yml:140`). Templates: `camap-hx/config.xml.dist` (used at build, `:1-23`); root `config.xml` and `camap-hx/config.xml` (both gitignored for HX: `camap-hx/.gitignore:3`). The dev compose uses the root one (`:140`). Easy and prod neko containers have no `config.xml` mount and the image contains none (`camap-hx.Dockerfile:138-141`); Sugoi `Config.hx:22` reads the file unconditionally.

| Key | Read at | Notes |
|---|---|---|
| lang, langs, langnames | Sugoi `Config.hx:24-25`; `camap-hx/src/controller/Account.hx:35-36` | Sugoi splits `langs` on `;` (`Config.hx:25`); `config.xml:3` uses one value |
| host | `Config.hx:29` -> `App.config.HOST` (e.g. `camap-hx/src/controller/User.hx:84,99`) | public host name |
| name | `Config.hx:30` | app name |
| webmaster_email | `camap-hx/src/controller/Cron.hx:370` | recipient of the nightly error report |
| database | `BaseApp.hx:387` (regex `mysql://user:pass@host[:port]/db`) | external lib |
| sqllog | `Config.hx:33` | |
| debug | `Config.hx:28`; used ~20x in `Cron.hx`, `App.hx:28,189` | DEBUG=1 -> CORS `*` headers (`App.hx:28-31`), templates from `lang/master`, `/api/createSid` enabled (`Api.hx:84-96`) |
| cache | `BaseApp.hx:458` (`neko.Web.cacheModule`) | |
| maintain | `BaseApp.hx:379` (also DB Variable `maintain`, `:220`) | |
| cachetpl | `BaseApp.hx:66` | templo cache |
| key | `App.config.KEY` / `get("key")`: password hash `camap-hx/src/db/User.hx:278`; invite/notif links SHA1 `camap-hx/src/controller/Main.hx:310`, `Account.hx:62`; JWT signing `camap-hx/src/controller/api/User.hx:58`; Bearer to TS `BridgeService.hx:105` | shared with TS `CAMAP_KEY` |
| camap_api | `camap-hx/src/View.hx:278` (`App.config.get("camap_api") + "/graphql"`) | verifier-corrected: an earlier grep missed this read; `camap-ts/docs/conf.md:33` lists it |
| camap_bridge_api | `BridgeService.hx:14,78,89,98` | URL reachable from the HX container |
| mapbox_server_token | `camap-hx/src/service/Mapbox.hx:26` | |
| dataHost | `Config.hx:32`, default `data.<host>` | not set in config |

Sample values differ: root `config.xml` has `key="BvA8wNG6H5Ruz69FfW3t"`, host `camap.localdomain`, DB `root:root@loc-mysql`, `camap_api=https://api.camap.localdomain`, bridge `http://nest-loc-camap:3010` (`config.xml:6-20`); `camap-hx/config.xml.dist` has host `localhost`, DB `mysql`, `camap_api`/bridge `http://nest-camap:3010` (`config.xml.dist:6-20`, lines 19-20 for the hostnames).

### 6.2 TS environment (`camap-ts/.env` is a symlink to `../.env`, i.e. root `.env`; templates `camap-ts/.env.sample`, root `.env.sample`)
Loaded by:
- Nest `ConfigModule.forRoot` with `envFilePath` = `<api-core>/(dist|src)/../../../.env` (`.env.test` when `NODE_ENV=test`) and yup validation (`camap-ts/packages/api-core/src/app.module.ts:24-41`). Nest's ConfigModule normally gives real process env precedence over the file (Nest default behaviour, not opened in this repo).
- TypeORM `camap-ts/ormconfig.js:6-24`: reads `.env` (or `.env.test`) with dotenv and MERGES `{...process.env, ...fileEnv}` (file wins over process env, `:20`); `USE_LOCAL_DB` forces `DB_HOST=localhost` (`:22-24`); `entities` = `packages/api-core` + `DB_ENTITIES` (`:33`); `logging` = `JSON.parse(DB_LOGGING)` (`:35`); charset utf8mb4 (`:36-37`); `packages/api-core/ormconfig.js:4-11` adds `migrations dist/migrations/*.js` and migrationsTransactionMode `each`.
- front-core webpack via dotenv (`THEME_ID`) (`webpack.config.js:10`).
- HX entrypoint (as `/srv/camapts.env`) for the subset emitted into `env.js` (`entrypoint.sh:31-64`).

| Var | Required by yup (`envSchema.ts`) | Read at | Notes |
|---|---|---|---|
| NODE_ENV | default development; one of development/production/test/provision (`:4-7`) | `main.ts:33,53`, `app.module.ts:46-47`, `auth.service.ts:194-274,349`, `mails.service.ts:75,99`, `gql-auth-abstract-guard.ts:220` | Dockerfile sets production (`camap-ts.Dockerfile:55`); dev compose sets development (`docker-compose.dev.yml:84`); auth cookies `HttpOnly` only if not development (`auth.service.ts:194-274`), cookie domain logic skipped in development (`:349`) |
| FRONT_URL | required (`:9`) | `main.ts:34`, `mails.controller.ts:81` | public URL of Nest; also CORS origin in prod |
| CAMAP_HOST | required (`:10`) | `main.ts:34`, `variable.service.ts:67`, `mails.service.ts:369`, `auth.service.ts:351`, `group-previews-members.resolver.ts:242,311` | public URL of HX |
| CAMAP_KEY | required (`:12`) | `crypto.service.ts:12` (sha1/md5 prefix), `bridge.strategy.ts:13`, `file.service.ts:65` (md5 of `id+CAMAP_KEY` in file URLs) | must equal HX `key` (nothing enforces it in code) |
| JWT_ACCESS_TOKEN_SECRET / _EXPIRATION_TIME | required (`:13-14`) | `auth.service.ts:227`, `auth.module.ts:30`, `jwt.strategy.ts:18`, `gql-auth-abstract-guard.ts:109` | sample 900 s |
| JWT_REFRESH_TOKEN_SECRET / _EXPIRATION_TIME | required (`:15-16`) | `auth.service.ts:249`, `gql-auth-abstract-guard.ts:114` | sample 2629746 s |
| DB_CONNECTION | required (`:18`) | `ormconfig.js:27` | |
| DB_HOST/USERNAME/PASSWORD/DATABASE/PORT | not validated | `ormconfig.js:28-32` | |
| DB_SYNCHRONIZE | commented out in schema (`:19-23`) | not read (`ormconfig.js:34` commented, uses the name `SYNCHRONIZE`) | only in `docs/conf.md:64` and a commented line in `envSchema.ts:19` |
| DB_ENTITIES | not validated | `ormconfig.js:33` | sample `./dist/**/*.entity.js` (`.env.sample:22`); test `./src/**/*.entity.ts` (`.env.test`) |
| DB_LOGGING | not validated | `ormconfig.js:35` | `JSON.parse` -> must be valid JSON (throws if unset) |
| MAILER_TRANSPORT | required, only `smtp` (`:25`) | `mails.module.ts:27` | |
| SMTP_HOST, PORT, SECURE, AUTH_USER, AUTH_PASS | required when smtp (`:27-46`) | `mails.module.ts:30-46` | AUTH_USER/PASS mandatory even if the server has no auth; `mails.module.ts:36-37` defaults for host/port are unreachable because the schema requires them (`:27-34`) |
| SMTP_IGNORE_TLS | not validated | `mails.module.ts:31`; `requireTLS = !secure && !ignoreTLS` (`:39`) | |
| SMTP_REQUIRE_TLS | not validated | not read in `api-core/src` | present in `.env.sample:32` and dev compose (`docker-compose.dev.yml:91`) |
| SMTP_TLS_SERVERNAME | not validated | `mails.module.ts:46` | not in sample |
| MAPBOX_KEY | not validated in api-core | not read by api-core; emitted into `env.js` by HX entrypoint (`entrypoint.sh:39,62`); read by front via `__APP_CONFIG__` (`front-core/src/lib/mapboxconfig.ts:13`) | |
| API_HOSTNAME / API_PORT (`PORT`) | not validated | `main.ts:87-88`; also emitted to env.js (`entrypoint.sh:56-57`) | |
| CAMAP_LOCAL_HOST | not validated | `crontab.service.ts:60` | sample `http://neko-loc-camap:80` (`.env.sample:55`); `getCamapHaxeUrl()` returns `undefined` when unset |
| CAMAP_BRIDGE_API | not validated | not read by api-core; only emitted to env.js (`entrypoint.sh:59`) | sample `.env.sample:57` |
| FRONT_GRAPHQL_URL | not validated in api-core | emitted to env.js (`entrypoint.sh:61`) | `front-core/src/envSchema.ts` lists it (with FRONT_URL, CAMAP_HOST, MAPBOX_KEY, CACHE_KEY) but is not imported anywhere in `front-core/src`; `.env.test` and runtime default use relative `/graphql` (`runtimeCfg.ts:19-22`) |
| HX_TRIGGER_CRONS | not validated | `crontab.service.ts:17,31,45` | truthiness test, see section 7 |
| THEME_ID | not validated | `mails.controller.ts:54`; `webpack.config.js:86` | |
| DISABLE_BRUTE_FORCE | not validated | `auth.service.ts:281` (`!== 'true'`) | not in sample or docs |
| VERSION | not validated | `tools.controller.ts:13,21` | |
| NODE_TLS_REJECT_UNAUTHORIZED=0 | - | Node itself | `.env.sample:48` |
| PUBLIC_PATH | - | `entrypoint.sh:32,55` -> `set-public-path.ts:14` | not in sample |
| GIT_COMMIT_SHORT | - | Docker build arg (`camap-ts.Dockerfile:3-4`) -> `webpack.config.js:15` | |
| CHOKIDAR_USEPOLLING, WATCHPACK_POLLING | - | dev compose (`:85-86`) | |

Compose-level overrides on nest (dev): `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=false`, `SMTP_IGNORE_TLS=true` (`docker-compose.dev.yml:87-91`). Mailpit credentials are hard-coded: `mail_user/mail_pass` (`docker-compose.dev.yml:150`, `.env.sample:34-35`).

### 6.3 Shared HX <-> TS values
| HX | TS | Usage |
|---|---|---|
| `key` (config.xml) | `CAMAP_KEY` | HX password hash `MD5(key + pass)` (`camap-hx/src/db/User.hx:278`); TS `CryptoService.md5/sha1` prefix with `CAMAP_KEY` (`crypto.service.ts:17-26`); HX Sha1(`KEY`+email/id) links (`Main.hx:310`, `Account.hx:62`); bridge Bearer (`BridgeService.hx:105` vs `bridge.strategy.ts:13`); TS file ids md5 (`file.service.ts:65`) |
| `host` | `CAMAP_HOST` | public URL of HX (HX stores a host name, TS a full URL) |
| `camap_bridge_api` | `CAMAP_BRIDGE_API` (env.js only) and `API_HOSTNAME`/`API_PORT` | HX -> TS internal URL |
| `camap_api` | `FRONT_URL` | public URL of TS |
| `mapbox_server_token` | `MAPBOX_KEY` | two separate tokens (server vs browser) |
| DB `database` | `DB_*` | same MySQL |
| (HX `/cron/*`) | `CAMAP_LOCAL_HOST` | TS triggers HX crons |

- HX also mints a JWT in `/api/user/getToken` signed with the HX `key` (`camap-hx/src/controller/api/User.hx:58`), whereas Nest verifies the `Authentication` cookie with `JWT_ACCESS_TOKEN_SECRET` (`jwt.strategy.ts:15-19`); whether the two secrets coincide in deployments is unverified.
- The root README describes `key`/`CAMAP_KEY` as "used to verify password hashes" (`README.md:107-109,119-121`); in code it is also the bridge bearer secret, the TS md5/sha1 salt and a file-id hash input.

## 7. Scheduled jobs and their triggering

- Production crons are NOT defined in any Dockerfile or compose (no crontab/cron package in `camap-hx.Dockerfile`, `camap-ts.Dockerfile`, `entrypoint.sh`).
- Trigger: Nest `CrontabService` (registered in `ToolsModule`, `camap-ts/packages/api-core/src/tools/tools.module.ts:9,51`; scheduler via `ScheduleModule.forRoot()`, `app.module.ts:53`) does `GET {CAMAP_LOCAL_HOST}/cron/minute|hour|daily` on HX:
  - minute: `@Cron(EVERY_MINUTE)` (`crontab.service.ts:15-27`)
  - hour: `@Cron(EVERY_HOUR)` (`:29-41`)
  - daily: `@Cron(EVERY_DAY_AT_MIDNIGHT)` = 00:00 (`:43-55`); a comment at `:9-11` lists a crontab with daily at `15 0 * * *`
  - each guarded by `if (!process.env.HX_TRIGGER_CRONS) return;` (`:17,31,45`): any non-empty string (including `"false"`) enables; the sample value is `true` (`.env.sample:60`).
  - Results are only logged (`:22-25`). The Nest cron timezone is the process TZ (Europe/Paris in the image, `camap-ts.Dockerfile:54`). There is no lock; with several Nest replicas each would call HX (duplicate execution unverified).
- HX side: `Cron.hx` `doMinute :58`, `doHour :92`, `doDaily :340`; `canRun()` unconditionally returns `true` (`camap-hx/src/controller/Cron.hx:36-38`), the key/CLI checks being commented out (`:39-50`). Combined with the `.htaccess` rewrite, `/cron/*` is callable by anyone who can reach HX; Nest calls it without credentials (`crontab.service.ts:19-20`).
- Other Nest-side scheduled jobs (independent of HX): buffered-mail sending every minute (`camap-ts/packages/api-core/src/mails/mails.service.ts:185`), messages daily (`messages/messages.service.ts:79`), cache clean 01:00 (`tools/cache.service.ts:55`), users 01:00 (`users/users.service.ts:442`).
- HX CLI scripts (`neko index.n scripts/<x>`) exist for one-off jobs, e.g. `Scripts.doRecomputeBasketTotal` (constructor throws "CLI only" under mod_neko, `camap-hx/src/controller/Scripts.hx:14-16`; dispatcher `Main.doScripts`, `Main.hx:341-358`).
- HX cron tasks use `TransactionWrappedTask(name)` with `task.execute(!App.config.DEBUG)` (`Cron.hx`); the daily error digest is one of them (section 8.2).

## 8. Logging and errors

No Sentry (or Rollbar/Bugsnag/Datadog) integration exists in sources: a case-insensitive grep for `sentry` over `camap-hx` and `camap-ts` (excluding `node_modules`, `dist`, `haxe_libraries`) matches only compiled third-party bundles (`camap-ts/public/neostatic/vendors.*.bundle.js`).

### 8.1 Haxe (Neko / Apache) side
| Mechanism | Behaviour | path:line |
|---|---|---|
| `App.log(t)` | Only when `App.config.DEBUG`: `neko.Web.logMessage(Std.string(t))` -> Apache error log; optional `Weblog.log` under `#if weblog` | `camap-hx/src/App.hx:188-195` |
| `App.current.logError(e[, stack])` (sugoi library; table `sugoi.db.Error` with fields `error`, `url`, `user`, `ip`, `date` read at `Cron.hx:365`) | Persists an error row. Called from the API catch-all (`Main.hx:203`), the scripts catch-all (`Main.hx:348`), cron mail failures (`Cron.hx:615,706`), cron JSON dump when `?json=1` (`Cron.hx:81`), `PaymentService.hx:202` | listed |
| REST API errors | `controller.Api` dispatch is wrapped in try/catch: `tink.core.Error` -> HTTP `e.code`, body `{error:{code,message,stack}}`, rollback (`Main.hx:193-198`); any other exception -> HTTP 500, `logError(e,stack)`, body includes the stack trace to the client, rollback (`Main.hx:199-206`) | `camap-hx/src/controller/Main.hx:187-207` |
| CLI scripts | Catch-all: `setReturnCode(500)`, prints message and each stack line with `Sys.println`, `logError`, `rollback` (`Main.hx:341-358`); scripts print progress with `Sys.println` (`Scripts.hx:19-25`) | `camap-hx/src/controller/Scripts.hx`, `Main.hx` |
| Cron tasks | `TransactionWrappedTask(name)` with `task.log` / `task.warning` (e.g. `Cron.hx:616-617,707-708` print exception + call stack) | `camap-hx/src/controller/Cron.hx` |
| Daily error digest | Cron task "Send errors to admin by email": selects `Error` rows between yesterday 00:00 and 24:00, builds HTML `error at URL (user, IP)` and mails it to `App.config.get("webmaster_email")` with subject "<theme name> Errors"; no mail when none | `camap-hx/src/controller/Cron.hx:353-377` |
| Back-office viewer | `/admin/errors`: paginated list (20/page) + 30-day chart; `?empty=1` truncates the `Error` table on GET with no CSRF token; the `like` filter SQL is commented out | `camap-hx/src/controller/admin/Admin.hx:101-129` |
| User-facing errors | `throw Error(url,msg)` / `throw Ok(url,msg)` / `throw Redirect(url)` (sugoi dispatcher; about 174 `throw Error(`/`Std.string(e)` occurrences in `camap-hx/src`) become session flash messages, not log rows | `camap-hx/src/controller/*.hx` |
| `trace(...)` | 3 live uses: `VolunteerService.hx:146,152`, `OrderBoxThunk.hx:173` (browser console) | listed |
| Browser | no global error handler in Haxe React code | n/a |

### 8.2 TypeScript side
| Mechanism | Behaviour | path:line |
|---|---|---|
| Bootstrap log | `console.log("Server started on <url>. Production: ...")` | `camap-ts/packages/api-core/src/main.ts:93-97` |
| Nest `Logger` instances | `'MessageService'` (`messages.service.ts:12,82`); `'MailService'` (no valid recipients -> mail skipped/deleted `mails.service.ts:114,217`, SMTP rejections `:301`, send failure `:328`); `'UsersService CRON'` (`users.service.ts:54,444,498,597,601`); `'FileService'` (`file.service.ts:17`) | listed |
| Raw `console.log` | `CrontabService` (`crontab.service.ts:18-53`), `file.controller.ts:84,133,144`, `vendor.service.ts:228`, dataset CLIs | listed |
| CLI logger | `CliNestLogger` buffers log/warn/error in memory, prints errors in red; `debug`/`verbose` are no-ops (`camap-ts/packages/api-core/src/cli/cli-logger.ts:14-45`, used by `cli/utils.ts:30-47`); `ActionLogger` prefixes timestamps (`cli/utils.ts:73-76`) | listed |
| GraphQL | Apollo `debug` and `playground` enabled when `NODE_ENV !== 'production'` (`app.module.ts:46-47`): stack traces in error extensions outside production. No `formatError`, no global exception filter (no `ExceptionFilter`/`@Catch`/`formatError` in `api-core/src`) | `camap-ts/packages/api-core/src/app.module.ts:41-52` |
| Exceptions thrown | Nest HTTP exceptions: `NotFoundException` x59, `UnauthorizedException` x37, `ForbiddenException` x37, `BadRequestException` x11, `InternalServerErrorException` x5 (specs excluded) | listed |
| Domain errors | `CamapError(type)` (`common/errors/camap.error.ts:3-14`) + `@MutationFail([types])` decorator that rolls back the transaction and returns `error.toObj()` as a normal GraphQL result (`common/decorators/mutation-fail.decorator.ts:5-25`); single use: `updateUser` (`users/users.resolver.ts:161`) | listed |
| Deadlocks | `DeadlockInterceptor` retries a request up to 5 times on MySQL `ER_LOCK_DEADLOCK` / Postgres `deadlock_detected` (`common/interceptors/dealock.interceptor.ts:5-33`, registered `app.module.ts:66-70`); HX has no equivalent | listed |
| Env validation | `Env error: ...` thrown at boot if `envSchema` fails (`app.module.ts:35-38`) | listed |
| Front-core | `utils/logger.ts` logs only if `NODE_ENV` is neither production nor test (`front-core/src/utils/logger.ts:3-14`); 30 files use the `ApolloErrorAlert` component; `CommonAlertError.tsx` in `components/`; many bare `console.error` (`VendorForm.tsx:139,159`, `ImageUploader.tsx:271`); the Apollo client has only a scalar link and a custom-header link, no `onError` link (`front-core/src/lib/initApollo.tsx:33-75`) | listed |

Summary: HX persists errors in the DB `Error` table and mails a daily digest; TS has no persistence, no digest, no alerting: errors go to stdout through Nest `Logger`/`console`.

### 8.3 Related: version reporting
HX `VERSION = [3,0,12]` is hard-coded (`camap-hx/src/App.hx:21`; `camap-hx/common/GitMacros.hx` macros `getGitCommitDate/getGitShortSHA/getGitBranch` exist but their uses are commented out, `App.hx:21`, `camap-hx/js/App.hx:40`). TS `/ping` and `/health` return `process.env.VERSION` or `0` (`tools.controller.ts:11-21`).
