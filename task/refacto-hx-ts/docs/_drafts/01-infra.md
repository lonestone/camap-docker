# 01 - Infrastructure, runtime, build & configuration

Paths are relative to the camap-docker root. `HX` = camap-hx, `TS` = camap-ts. "unverified" = not provable from the repo alone.
`.env` (root) was NOT read (secrets); only `.env.sample`, `.env.test`, `.env.ci.test` and code were used.

## 1. Overview

- Four containers (+ mailpit) orchestrated by compose: Traefik reverse proxy, MySQL, Nest (camap-ts), Neko/Apache (camap-hx) (`docker-compose.dev.yml:3,52,72,117,143`).
- `docker-compose.yml` is a symlink to `docker-compose.dev.yml` (root listing). Variants: `docker-compose.easy.yml` (prebuilt GHCR images), `docker-compose.prod.yml` (build from sources).
- Root README declares the repo "no longer maintained" (Kubernetes/minikube instead) and says real production uses Nginx, not Traefik (`README.md:3-8,17`).
- HX serves HTML pages (Templo `.mtt` templates) via Apache + mod_neko (`camap-hx/camap-hx.Dockerfile:111,123`). TS serves GraphQL/REST, the React "neo" bundles under `/neostatic/`, and i18n JSON under `/locales/` (`camap-ts/packages/api-core/src/main.ts:63,74`).
- HX and TS call each other: HX -> TS through `camap_bridge_api` (`camap-hx/src/service/BridgeService.hx:14,78,89,98`); TS -> HX through `CAMAP_LOCAL_HOST` for crons (`camap-ts/packages/api-core/src/tools/crontab.service.ts:60`). Shared secret: HX `key` == TS `CAMAP_KEY`.
- Both apps share ONE MySQL database (HX: `database` in config.xml `config.xml:10`; TS: `DB_*` `.env.sample:15-23`).

## 2. Components & versions

| Component | Version | Source |
|---|---|---|
| Haxe | 4.0.5 | `camap-hx/camap-hx.Dockerfile:15`, `camap-hx/backend/.haxerc` |
| lix | 15.12.4 | `camap-hx/camap-hx.Dockerfile:13` |
| Node (build and runtime images; both TS and HX frontend build) | 20.19.5 | `camap-hx/camap-hx.Dockerfile:4`, `camap-ts/camap-ts.Dockerfile:1,39`, `camap-ts/package.json:3-5` |
| Neko | distro package (Debian) `neko`, `libapache2-mod-neko` (runtime base `debian:bookworm-slim`) | `camap-hx/camap-hx.Dockerfile:100,111` |
| Apache | distro `apache2`, mods rewrite, neko, headers, proxy, proxy_http | `camap-hx/camap-hx.Dockerfile:111,123,130` |
| HX framework | Sugoi pinned commit c3b8db8 (CAMAP-APP/sugoi), templo 3.0.0, record-macros (fork bablukid, pinned sha) | `camap-hx/backend/haxe_libraries/sugoi.hxml:1`, `templo.hxml:2`, `record-macros.hxml:1` |
| HX app VERSION | 3.0.12 | `camap-hx/src/App.hx:20` |
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
- Two separate React versions coexist: 16 in HX frontend, 18 in TS front-core (see above rows).
- Haxe frontend uses `-dce no`, `-debug`, `-D debug` always (`camap-hx/frontend/build.hxml:23-25`), i.e. no production flavour of `app.js`.
- Timezone: `TZ=Europe/Paris` in HX runtime (`camap-hx.Dockerfile:115`), TS runtime (`camap-ts.Dockerfile:54`), MySQL (`mysql.Dockerfile:12`). Tests run with `TZ=UTC` (`camap-ts/packages/api-core/package.json:27`).

## 3. Runtime topology & request routing

### Traefik
- Entry points: `web :80`, `websecure :443`, `nest :3010`, API dashboard `:8080` (insecure) (`docker-compose.dev.yml:16-27`).
- Routing by Host (docker labels):
  - `camap.localdomain` -> `neko-loc-camap:80` (HX/Apache) (`docker-compose.dev.yml:129-130`)
  - `api.camap.localdomain` -> `nest-loc-camap:3010` (TS) (`docker-compose.dev.yml:99-100`)
  - both on entrypoint `websecure`, `tls=true`, middleware `serviceheaders` (CORS headers) (`docker-compose.dev.yml:101-103,131-133`).
- No path-based routing in Traefik: split between HX and TS by hostname only.
- TLS: self-signed cert files `ssl/server.cer`/`server.key` loaded via file provider `traefik/config/dynamic.yml:1-8` (ssl dir mounted at `docker-compose.dev.yml:41`).
- `traefik.yml` (mounted `/traefik.yml`, `docker-compose.dev.yml:36`) defines http->https redirect, `exposedByDefault: true`, file provider `/etc/traefik/config` (`traefik.yml:5-34`). See code inconsistencies about precedence with CLI flags.
- Docker network aliases: `camap.localdomain` alias on the reverse-proxy (`docker-compose.dev.yml:47-50`), `nest-devcamap` alias on Nest (dev only) (`docker-compose.dev.yml:113-115`).

### Apache inside the HX container (path -> destination)
Defined in `camap-hx/apache/camap-static.conf` (copied by `camap-hx.Dockerfile:131-132`):
- `/neostatic/` -> proxy `http://nest-devcamap:3010/neostatic/` (`camap-static.conf:16-17`)
- `/graphql` -> proxy `http://nest-devcamap:3010/graphql` (`:20-21`)
- `/locales/` -> proxy `http://nest-devcamap:3010/locales/` (`:24-25`)
- `/env.js` -> local file `/srv/www/env.js` (no-store) (`:7-13`)
- these four bypass mod_neko/rewrites (`:28-37`)
- everything else -> `www/.htaccess`: any non-file-extension path (`^[_a-z0-9A-Z-]+$` names) and not `/file/*` is rewritten to `/index.n` (the Neko app) (`camap-hx/www/.htaccess:1-9`); `css/<hash>/` and `js/<hash>/` cache-busting prefixes stripped (`.htaccess:3-4`).
- Docroot `/srv/www` (`camap-hx.Dockerfile:125,127`); `AllowOverride All` (`:124`); logs to stdout/stderr (`:121-122`).
- Sugoi loads `config.xml` from `getCwd()+"../"` = `/srv/config.xml` (`/Users/renaud/haxe/haxe_libraries/sugoi/.../src/sugoi/Config.hx:19,22`, external lib, pinned commit c3b8db8).
- Templates: when `debug=1` uses `../lang/master/` (compiled on the fly); otherwise `../lang/<lang>/` precompiled `tmp/` (`.../sugoi/BaseApp.hx:80-85`, external).

### Browser -> servers (what loads where)
- HX page base template loads scripts from TS: HX asks `GET {camap_bridge_api}/neostatic/manifest.json` and builds the list `/env.js`, runtime.js, vendors.js, reactlibs.js, neo.js, app.js (`camap-hx/src/service/BridgeService.hx:12-21,50-62`). Browser then fetches `/neostatic/...` on the HX host, which Apache proxies to Nest.
- Browser GraphQL from `FRONT_GRAPHQL_URL` (emitted into `env.js`, `camap-hx/entrypoint.sh:61`); Apache also proxies `/graphql` as relative fallback (`camap-static.conf:19-21`).
- HX -> TS server-side bridge: `Authorization: Bearer <config key>` (`BridgeService.hx:105`) validated by `BridgeStrategy` against `CAMAP_KEY` (`camap-ts/packages/api-core/src/auth/strategies/bridge.strategy.ts:13`). Bridge paths `/bridge/auth/logout/<id>` (`BridgeService.hx:98`).
- Nest listens on `API_HOSTNAME:API_PORT` (fallback `PORT` then 3001) (`main.ts:87-90`); `.env.sample` sets `nest-loc-camap`:3010 (`.env.sample:53-54`).
- Nest static: `/srv/public/neostatic` at `/neostatic/` (365d immutable cache), `/srv/public/locales` at `/locales/` (1 day) (`main.ts:58-80`). `srvRoot` is hard-coded `/srv` (`main.ts:58`).
- Nest health: `GET /health`, `GET /ping` (`camap-ts/packages/api-core/src/tools/tools.controller.ts:11,19`), returning `{version: VERSION||0}` (`:13,21`).
- HX container healthcheck: `curl http://127.0.0.1/` (`camap-hx.Dockerfile:155`). No healthcheck for Nest/MySQL in compose or Dockerfile (unverified for easy images).
- Nest CORS: `origin: [FRONT_URL, CAMAP_HOST]` in production, `true` otherwise; credentials on; allowed headers include custom `URL_CUSTOM_HEADER` (`main.ts:32-47`). Helmet CSP only when production (`main.ts:50-55`). Body limit 25 MB (`main.ts:29-30`), GraphQL upload max 1 GB / 10 files (`main.ts:27`).
- Traefik CORS middleware allows origins `https://camap.localdomain,https://api.camap.localdomain` hard-coded (`docker-compose.dev.yml:30`), allowed headers include `x-cavea-url` (`:33`).

### Variants
| | dev | easy | prod |
|---|---|---|---|
| mysql | build `mysql.Dockerfile` (`:52-55`), publishes 3306 (`:62-64`) | `ghcr.io/camap-app/mysql:master` (`:42`) | build (`:48-50`), no host port |
| nest | build `./camap-ts` (`:78-80`), `npm run start:dev` (`:97`), mounts src/public/.env (`:108-111`) | `ghcr.io/camap-app/camap-ts:master`, `npm run start:dev` (`:65,71`) | build, `npm run start:prod` (`:86`), `env_file: camap-ts/.env` (`:81`) |
| neko | build `./camap-hx` (`:119-121`), mounts lang, www, config.xml, `.env` as `/srv/camapts.env` (`:138-141`) | `ghcr.io/camap-app/camap-hx:master` (`:84`), no mounts | build (`:107-109`), no mounts |
| platform | `linux/amd64` forced on nest/neko (`:73,118`) | - | - |
| mailpit | yes | no | no |

## 4. Build pipelines

### HX image (`camap-hx/camap-hx.Dockerfile`, multi-stage)
Builder (node:20.19.5-slim):
1. Installs `neko gettext git curl` (`:7-10`), lix 15.12.4 (`:13`), Haxe 4.0.5 (`:15,35-36`).
2. Backend deps via `lix download` in `/srv/backend` (`:32-39`); frontend deps + `npm ci` in `/srv/frontend` (`:50-58`).
3. Copies `common data js lang src www backend frontend` (`:64-71`) and `config.xml.dist` as `/srv/config.xml` (`:73`; needed only at build).
4. Backend: `haxe -v build.hxml -D i18n_generation` -> `www/index.n` (`:77-80`, `camap-hx/backend/build.hxml:18`). The `i18n_generation` define makes Sugoi `TemplateTranslator` parse `../lang/master` (generates `lang/<lang>/tpl`, external lib `BaseApp.hx:50-52`; the generation itself is unverified).
5. Frontend: `haxe -v build.hxml` -> `www/js/app.js` (`:85`, `camap-hx/frontend/build.hxml:28`).
6. Templates: `neko ../../../backend/temploc2.n -macros macros.mtt -output ../tmp/ *.mtt */*.mtt */*/*.mtt` run in `lang/fr/tpl` (`:88-90`).
7. `.po` -> `.mo`: `msgfmt www/lang/texts_fr.po -o www/lang/texts_fr.mo` (`:94`).
Runtime (debian:bookworm-slim): installs apache2 + mod_neko, perl twig libs (`:109-113`); copies `/srv/www /srv/lang /srv/data` and `temploc2.n` -> wrapper `/usr/bin/temploc2` (`:138-144`); creates `lang/master/tmp` (0777) and `www/file` (`:151-152`); writes a default `robots.txt` (Disallow all except /group/) if absent (`:150`); `ENTRYPOINT /entrypoint.sh` (`:156`).
- Runtime image has NO `config.xml`, NO `backend/` dir (only the artifacts listed above).

### HX entrypoint (`camap-hx/entrypoint.sh`)
- Sources `/srv/camapts.env` if present (normalizes `KEY: v`, `KEY = v`, CRLF) (`:5,9-29`).
- Generates `/srv/www/env.js` setting `window.__APP_CONFIG__` with keys: PUBLIC_PATH (default `/neostatic/`), API_HOSTNAME, API_PORT, CAMAP_HOST, CAMAP_BRIDGE_API, FRONT_URL, FRONT_GRAPHQL_URL, MAPBOX_KEY; empty values omitted (`:31-64`).
- Starts `apache2ctl -D FOREGROUND` (`:67`). No cron daemon is started.

### TS image (`camap-ts/camap-ts.Dockerfile`)
- Builder: installs g++/make/python3/git/perl libs (`:6-8`), non-root user `interamap` (`:10`); copies `orm*.js package*.json packages public` (`:15-17`), `.env.sample` as `/srv/.env` (`:20`; the `bash -c "source ... && export"` on `:21` has no persistent effect), `npm install` (`:24`), rebuilds node-sass/bcrypt/sharp (failures ignored, `:25-27`), `npm run build` (`:28`), `npm prune --production` (`:29`), copies `api-core/mails/dist` to `/srv/mails/dist` (`:31-34`), copies `scripts/` (`:36`). Build arg `GIT_COMMIT_SHORT` (`:3-4`).
- Runtime: same node, installs `libconfig-tiny-perl virtual-mysql-client-core procps` (`:49-53`), `NODE_ENV=production` (`:54-55`), `CMD node packages/api-core/dist/main.js` (`:65`).
- Root build: `npm run build` = `build:common` (rollup) -> `build:api` (`prebuild` rimraf dist, `build:mail` ts-node, then `nest build -p tsconfig.build.json`) -> `build:front` (webpack) (`camap-ts/package.json:11-14`, `camap-ts/packages/api-core/package.json:14-17`).
- front-core webpack: entries `neo` (`src/neo.tsx`) and `app` (`src/app.ts`), `mode: production` hard-coded, output `camap-ts/public/neostatic/[name].[contenthash].bundle.js`, plus `manifest.json` (WebpackManifestPlugin), `publicPath '/neostatic/'` overridden at runtime by `src/set-public-path.ts` from `__APP_CONFIG__.PUBLIC_PATH` (`camap-ts/packages/front-core/webpack.config.js:11-12,31-35,74,102-112`, `src/set-public-path.ts:11-26`). Chunks: `reactlibs`, `vendors`, `runtime` (`:113-129`). Build-time constants: `process.env.NODE_ENV` and `__CACHE_KEY__` (= `GIT_COMMIT_SHORT` or `git rev-parse --short HEAD` or `unknown`) (`:14-28,75-80`); used for i18n URL `?v=` (`src/lib/runtimeCfg.ts:27`, `src/lib/i18n.ts:26`).
- Theme: at build start copies `src/theme/${THEME_ID}/palette.ts` to `src/palette.ts`, and at end restores `default` (`webpack.config.js:81-100`); `THEME_ID` read from `camap-ts/.env` via dotenv (`:10`).
- Dev watch: `webpack watch --config webpack.dev.config.js` (`front-core/package.json:7`).
- Storybook: `npm run dev:story` -> port 6006 (`camap-ts/package.json:19`, `front-core/package.json:11`). `vite.config.ts` exists (`front-core/vite.config.ts:1-7`) and is only for Storybook (`@storybook/react-vite`, `package.json:96`) (inference).
- camap-common: `rollup -c && rimraf ./dist && mv ./tmp ./dist` (`camap-common/package.json:8`); `postinstall` of root installs the 3 packages' deps with `--ignore-scripts` (`camap-ts/package.json:27`); api-core and front-core depend on `camap-common` as `file:../camap-common` and on `camap-ts: file:../..` (`api-core/package.json:95-96`, `front-core/package.json:40-41`).
- MySQL image: `mysql:8.0.36` + `camap-ts/mysql/my.cnf` (`mysql.Dockerfile:11`), context must be root (`docker-compose.dev.yml:53-55`).

### Standalone HX (non-docker) scripts
- `camap-hx/backend/package.json:9-17`: `build:hx`, `build:tmpl` (uses `lang/master/tpl` -> `lang/master/tmp`), `build:sass`, `watch` (nodemon), `i18n:extract|diff|translate|compile`.
- `camap-hx/frontend/package.json:33-37`: `build` (npm-run-all `build:*` => `haxe build.hxml`), `libs:prod` (rollup `libs/rollup.config.js`), `watch`.

### CI (GitHub Actions)
- HX: `docker-publish.yml` (tag `vX.Y.Z` from master -> `ghcr.io/camap-app/camap-hx`), `publish-staging|feature|fix|mantis.yml` (`camap-hx/.github/workflows/`).
- TS: same set (`camap-ts/.github/workflows/`); production tags `vX.Y.Z`, `major_minor`, `major`, `latest`; staging `staging-vX` tag -> `:staging` (`docker-publish.yml:54,101-105`, `publish-staging.yml:18,54,87-90`).

## 5. Configuration

### 5.1 HX `config.xml` (Sugoi `sugoi.Config`, attributes of root `<config>`)
Location at runtime `/srv/config.xml` (dev: bind mount of root `config.xml`, `docker-compose.dev.yml:140`). Templates: `camap-hx/config.xml.dist` (used at build, `:1-23`); root `config.xml` and `camap-hx/config.xml` (both gitignored for HX: `camap-hx/.gitignore:3`).

| Key | Read at | Notes |
|---|---|---|
| lang, langs, langnames | Sugoi `Config.hx:24-25`; `camap-hx/src/controller/Account.hx:35-36` | Sugoi splits `langs` on `;` (`Config.hx:25`) |
| host | `Config.hx:29` -> `App.config.HOST` (e.g. `camap-hx/src/controller/User.hx:84,99`) | public host |
| name | `Config.hx:30` | app name |
| webmaster_email | `camap-hx/src/controller/Cron.hx:370` | nightly error report |
| database | `BaseApp.hx:387` (regex `mysql://user:pass@host[:port]/db`) | external lib |
| sqllog | `Config.hx:33` | |
| debug | `Config.hx:28`; used ~20x in `Cron.hx`, `App.hx:28,189` | DEBUG=1 -> CORS `*` headers (`App.hx:28-31`), templates from `lang/master` |
| cache | `BaseApp.hx:458` (`neko.Web.cacheModule`) | |
| maintain | `BaseApp.hx:379` (also DB Variable `maintain`, `:220`) | |
| cachetpl | `BaseApp.hx:66` | templo cache |
| key | `App.config.KEY` / `get("key")`: password hash `camap-hx/src/db/User.hx:278`; invite/notif links SHA1 `camap-hx/src/controller/Main.hx:310`, `Account.hx:62`; JWT signing `camap-hx/src/controller/api/User.hx:58`; Bearer to TS `BridgeService.hx:105` | shared with TS `CAMAP_KEY` |
| camap_api | not found read in HX code by grep (`camap-hx/src`, `common`) | unverified use; docs list it (`camap-ts/docs/conf.md:33`) |
| camap_bridge_api | `BridgeService.hx:14,78,89,98` | URL reachable from HX container |
| mapbox_server_token | `camap-hx/src/service/Mapbox.hx:26` | |
| dataHost | `Config.hx:32` default `data.<host>` | not set in config |

Default values differ between samples: `config.xml` (local) `key="BvA8wNG6H5Ruz69FfW3t"`, host `camap.localdomain`, DB `root:root@loc-mysql`, `camap_api=https://api.camap.localdomain`, bridge `http://nest-loc-camap:3010` (`config.xml:6-20`); `config.xml.dist` host `localhost`, DB `mysql`, `camap_api`/bridge `http://nest-camap:3010` (`camap-hx/config.xml.dist:6-20`).

### 5.2 TS env (`camap-ts/.env` -> symlink to `../.env`, i.e. root `.env`; template `camap-ts/.env.sample`, root `.env.sample`)
Loaded by:
- Nest `ConfigModule.forRoot` with `envFilePath` = `<api-core>/(dist|src)/../../../.env` (`.env.test` when `NODE_ENV=test`) and yup validation (`camap-ts/packages/api-core/src/app.module.ts:24-41`). Nest ConfigModule gives precedence to real process env over file (Nest default behaviour, unverified in this repo).
- TypeORM `camap-ts/ormconfig.js:6-24`: reads `.env` (or `.env.test`) with dotenv and MERGES `{...process.env, ...fileEnv}` (file wins over process env, `:20`); `USE_LOCAL_DB` forces `DB_HOST=localhost` (`:22-24`); `entities` = `packages/api-core` + `DB_ENTITIES` (`:33`); `logging` = `JSON.parse(DB_LOGGING)` (`:35`); charset utf8mb4 (`:36-37`); `packages/api-core/ormconfig.js:4-11` adds `migrations dist/migrations/*.js` and migrationsTransactionMode `each`.
- front-core webpack via dotenv (`THEME_ID`) (`webpack.config.js:10`).
- HX entrypoint (as `/srv/camapts.env`) for the subset emitted into `env.js` (`entrypoint.sh:31-64`).

| Var | Required by yup (`envSchema.ts`) | Read at | Notes |
|---|---|---|---|
| NODE_ENV | default development; one of development/production/test/provision (`:4-7`) | `main.ts:33,53`, `app.module.ts:46-47`, `auth.service.ts:194-274,349`, `mails.service.ts:75,99`, `gql-auth-abstract-guard.ts:220` | Dockerfile sets production (`camap-ts.Dockerfile:55`); dev compose sets development (`docker-compose.dev.yml:84`); cookies `HttpOnly` only if not development (`auth.service.ts:194`) |
| FRONT_URL | required (`:9`) | `main.ts:34`, `mails.controller.ts:81` | public URL of nest; also CORS origin in prod |
| CAMAP_HOST | required (`:10`) | `main.ts:34`, `variable.service.ts:67`, `mails.service.ts:369`, `auth.service.ts:351`, `group-previews-members.resolver.ts:242,311` | public URL of HX |
| CAMAP_KEY | required (`:12`) | `crypto.service.ts:12` (sha1/md5 prefix), `bridge.strategy.ts:13`, `file.service.ts:65` (md5 of `id+CAMAP_KEY` in file URLs) | MUST equal HX `key` |
| JWT_ACCESS_TOKEN_SECRET / _EXPIRATION_TIME | required (`:13-14`) | `auth.service.ts:227`, `auth.module.ts:30`, `jwt.strategy.ts:18`, `gql-auth-abstract-guard.ts:109` | sample 900 s |
| JWT_REFRESH_TOKEN_SECRET / _EXPIRATION_TIME | required (`:15-16`) | `auth.service.ts:249`, `gql-auth-abstract-guard.ts:114` | sample 2629746 s |
| DB_CONNECTION | required (`:18`) | `ormconfig.js:27` | |
| DB_HOST/USERNAME/PASSWORD/DATABASE/PORT | not validated | `ormconfig.js:28-32` | |
| DB_SYNCHRONIZE | commented out in schema (`:19-23`) | not read (`ormconfig.js:34` commented, wrong name `SYNCHRONIZE`) | dead |
| DB_ENTITIES | not validated | `ormconfig.js:33` | sample `./dist/**/*.entity.js` (`.env.sample:22`); test `./src/**/*.entity.ts` (`.env.test`) |
| DB_LOGGING | not validated | `ormconfig.js:35` | `JSON.parse` -> must be valid JSON (throws if unset) |
| MAILER_TRANSPORT | required, only `smtp` (`:25`) | `mails.module.ts:27` | |
| SMTP_HOST, PORT, SECURE, AUTH_USER, AUTH_PASS | required when smtp (`:27-46`) | `mails.module.ts:30-46` | AUTH_USER/PASS therefore mandatory even if server has no auth |
| SMTP_IGNORE_TLS | not validated | `mails.module.ts:31`; `requireTLS = !secure && !ignoreTLS` (`:39`) | |
| SMTP_REQUIRE_TLS | not validated | not read anywhere in `api-core/src` | in `.env.sample:32` and dev compose (`docker-compose.dev.yml:91`): dead |
| SMTP_TLS_SERVERNAME | not validated | `mails.module.ts:46` | not in sample |
| MAPBOX_KEY | not validated in api-core | not read by api-core; emitted into `env.js` by HX entrypoint (`entrypoint.sh:39,62`); read by front via `__APP_CONFIG__` (`front-core/src/lib/mapboxconfig.ts:13`) | |
| API_HOSTNAME / API_PORT (`PORT`) | not validated | `main.ts:87-88`; also emitted to env.js (`entrypoint.sh:56-57`) | |
| CAMAP_LOCAL_HOST | not validated | `crontab.service.ts:60` | sample `http://neko-loc-camap:80` (`.env.sample:55`) |
| CAMAP_BRIDGE_API | not validated | not read by api-core; only emitted to env.js (`entrypoint.sh:59`) | sample `.env.sample:57` |
| FRONT_GRAPHQL_URL | not validated in api-core | emitted to env.js (`entrypoint.sh:61`) | front-core `envSchema.ts` lists it but is unused (see inconsistencies) |
| HX_TRIGGER_CRONS | not validated | `crontab.service.ts:17,31,45` | truthiness test (see 6) |
| THEME_ID | not validated | `mails.controller.ts:54`; `webpack.config.js:86` | |
| DISABLE_BRUTE_FORCE | not validated | `auth.service.ts:281` (`!== 'true'`) | not in sample or docs |
| VERSION | not validated | `tools.controller.ts:13,21` | |
| NODE_TLS_REJECT_UNAUTHORIZED=0 | - | Node itself | `.env.sample:48` ("comment if not using self-signed certs") |
| PUBLIC_PATH | - | `entrypoint.sh:32,55` -> `set-public-path.ts:14` | not in sample |
| GIT_COMMIT_SHORT | - | Docker build arg (`camap-ts.Dockerfile:3-4`) -> `webpack.config.js:15` | |
| CHOKIDAR_USEPOLLING, WATCHPACK_POLLING | - | dev compose (`:85-86`) | |

Compose-level overrides on nest (dev): `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=false`, `SMTP_IGNORE_TLS=true` (`docker-compose.dev.yml:87-91`).
Mailpit credentials hard-coded: `mail_user/mail_pass` (`docker-compose.dev.yml:150`, `.env.sample:34-35`).

### 5.3 Shared hx<->ts values
| HX | TS | Usage |
|---|---|---|
| `key` (config.xml) | `CAMAP_KEY` | HX password hash `MD5(key + pass)` (`camap-hx/src/db/User.hx:278`); TS `CryptoService.md5/sha1` prefix with `CAMAP_KEY` (`crypto.service.ts:17-26`); HX Sha1(`KEY`+email/id) links (`Main.hx:310`, `Account.hx:62`); bridge Bearer (`BridgeService.hx:105` vs `bridge.strategy.ts:13`); TS file ids md5 (`file.service.ts:65`) |
| `host` | `CAMAP_HOST` | public URL of HX (HX stores a host name, TS a full URL) |
| `camap_bridge_api` | `CAMAP_BRIDGE_API` (env.js only) and `API_HOSTNAME`/`API_PORT` | HX->TS internal URL |
| `camap_api` | `FRONT_URL` | public URL of TS |
| `mapbox_server_token` | `MAPBOX_KEY` | two separate tokens (server vs browser) |
| DB `database` | `DB_*` | same MySQL |
| (HX `/cron/*`) | `CAMAP_LOCAL_HOST` | TS triggers HX crons |
- Is JWT signed by HX (`config key`, `api/User.hx:58`) verified by Nest with `JWT_ACCESS_TOKEN_SECRET`? Not equal secrets by config -> unverified how this HX token is consumed.

### 5.4 Test envs
- `camap-ts/.env.test`: API_PORT 3011, DB `test`@localhost root/root, `DB_ENTITIES=./src/**/*.entity.ts`, SMTP ethereal, `CAMAP_KEY=7F8X...` (`.env.test`). Contains committed credentials/tokens (observation).
- `camap-ts/.env.ci.test`: `DB_HOST=mysql` only.

## 6. Scheduled jobs triggering

- Production crons are NOT in any Dockerfile or compose (no crontab/cron package: `camap-hx.Dockerfile`, `camap-ts.Dockerfile`, `entrypoint.sh` contain none).
- Trigger: Nest `CrontabService` (registered in `ToolsModule`, `camap-ts/packages/api-core/src/tools/tools.module.ts:9,51`; scheduler via `ScheduleModule.forRoot()`, `app.module.ts:53`) does `GET {CAMAP_LOCAL_HOST}/cron/minute|hour|daily` on HX:
  - minute: `@Cron(EVERY_MINUTE)` (`crontab.service.ts:15-27`)
  - hour: `@Cron(EVERY_HOUR)` (`:29-41`)
  - daily: `@Cron(EVERY_DAY_AT_MIDNIGHT)` = 00:00 (`:43-55`)
  - each guarded by `if (!process.env.HX_TRIGGER_CRONS) return;` (`:17,31,45`) -> any non-empty string (including `"false"`) enables; the dev/sample value is `true` (`.env.sample:60`).
  - Results only logged (`:22-25`). Timezone of the Nest cron = process TZ (Europe/Paris in image, `camap-ts.Dockerfile:54`).
- HX side: `Cron.hx` `doMinute/doHour/doDaily` etc.; `canRun()` unconditionally `return true` (`camap-hx/src/controller/Cron.hx:36-37`), i.e. `/cron/*` is callable by anyone who can reach HX (the key/CLI checks are commented out, `:39-50`).
- Other schedule-like Nest jobs besides this trigger: not inventoried here (see other areas).
- If several Nest replicas run with `HX_TRIGGER_CRONS` set, each calls HX (no lock in `crontab.service.ts`) -> unverified duplicate execution risk.

## 7. Existing documentation map

| Doc | Content | Status vs code |
|---|---|---|
| `README.md` (root) | docker install, hosts, config keys, Mailpit, certificates, Traefik | says repo unmaintained; partially stale (see 8) |
| `camap-hx/README.md` | framework summary, polyfill note | OK; says Haxe 4.05 (`:7`), code 4.0.5 |
| `camap-hx/Contributing.md`, `camap-ts/Contributing.md` | branch/PR workflow (staging -> master) | process doc, not verified here |
| `camap-ts/README.md` | architecture (3 modules), doc index, TODO typeorm 0.3 | index links to docs that exist (`docs/*.md`) |
| `camap-ts/docs/install.md` | dev install, project layout, build commands | partly stale |
| `camap-ts/docs/conf.md` | config.xml + .env keys | incomplete / partly wrong |
| `camap-ts/docs/crons.md` | HX crontab and Nest crons | stale vs HX_TRIGGER_CRONS mechanism |
| `camap-ts/docs/troubleshooting.md` | error recipes | one stale entry |
| `camap-ts/docs/readme.md`, `future.md` | index; sustainability notes | `future.md:53` MySQL version stale |
| `camap-ts/docs/{dataset,emails,files,i18n,templates,theme,neo-modules,schema,tests,...}.md` | feature docs | out of this area |
| `.cursor/rules/project.md` | repo rules and "Haxe project is being deprecated" | `:14` "do not couple hx and ts" contradicts runtime coupling |

## 8. Documentation inconsistencies

1. [CONFIRMED] `camap-ts/docs/crons.md:11-17` says a server crontab must be programmed (neko `index.n cron/...`) and daily is `15 0 * * *`; code triggers via HTTP from Nest (`crontab.service.ts:20,34,48`) and daily at 00:00 (`:43`). The crontab text exists only as a comment in `crontab.service.ts:9-11`.
2. [CONFIRMED] `camap-ts/docs/crons.md:21-32` says TS crons are "handled by Node" with `sendEmailsFromBuffer` as example; the only cron service found in `tools/` just calls HX (`crontab.service.ts`); the example method name was not found in `crontab.service.ts` (other Nest jobs not inventoried).
3. [CONFIRMED] `camap-ts/docs/conf.md:9` says `langs` is comma-separated (`fr,en,es,de`); Sugoi splits on `;` (`/Users/renaud/haxe/haxe_libraries/sugoi/.../src/sugoi/Config.hx:25`, external lib). `config.xml` uses a single value (`config.xml:3`). (verifier-corrected: Sugoi Config.hx:25 splits on ";" verified in ~/haxe/haxe_libraries/sugoi/1.0.0/github/*/src/sugoi/Config.hx:25)
4. [CONFIRMED] `camap-ts/docs/conf.md:41-95` omits env vars used by code/sample: `CAMAP_LOCAL_HOST` (`.env.sample:55`, `crontab.service.ts:60`), `CAMAP_BRIDGE_API` (`.env.sample:57`), `DISABLE_BRUTE_FORCE` (`auth.service.ts:281`), `VERSION` (`tools.controller.ts:13`), `SMTP_IGNORE_TLS`, `SMTP_TLS_SERVERNAME` (`mails.module.ts:31,46`), `NODE_ENV`, `PUBLIC_PATH` (`entrypoint.sh:32`), `GIT_COMMIT_SHORT`. It also says `camap_api` is the URL of camap-ts (`conf.md:33`) but no HX code reads `camap_api` (grep, `camap-hx/src` and `common`). (verifier-corrected: env-var omissions not all re-checked; but the sub-claim "no HX code reads camap_api" is FALSE: camap-hx/src/View.hx:278 `App.config.get("camap_api") + "/graphql"` (also set in config.xml:16))
5. [CONFIRMED] `camap-ts/docs/conf.md:65` shows `DB_ENTITIES = ./dist/\*_/_.entity.js` (markdown-mangled glob; real value `.env.sample:22`).
6. [CONFIRMED] `camap-ts/docs/troubleshooting.md:32-33,36` claims CAMAP_HOST (and the front) is baked at front-core build time; webpack now explicitly no longer inlines `FRONT_URL/FRONT_GRAPHQL_URL/CAMAP_HOST/MAPBOX_KEY` and reads them at runtime from `window.__APP_CONFIG__` (`front-core/webpack.config.js:76-77`; `entrypoint.sh:55-62`). `.../troubleshooting.md:34` also says CAMAP_HOST is used "par le cron camap-ts"; the cron uses `CAMAP_LOCAL_HOST` (`crontab.service.ts:60`).
7. [CONFIRMED] `camap-ts/docs/install.md:90-91` "api-core compilation: `npm run build:front`, output `front-core/dist/*`": that is the front-core build, whose output is `public/neostatic` (`webpack.config.js:12`); api-core is built by `build:api` (`camap-ts/package.json:13`) into `packages/api-core/dist`.
8. [CONFIRMED] `camap-ts/docs/install.md:49,64` points to `camap-hx/apache.conf` as how Apache serves statics; that file (`Listen 3009`, vhost on 3009, `camap-hx/apache.conf:4,6`) is not referenced by the Dockerfile; the image uses `camap-hx/apache/camap-static.conf` and the default Debian site (`camap-hx.Dockerfile:127,131-134`).
9. [CONFIRMED] `camap-ts/docs/install.md:180-197` (reinstall backend manually in the container, `cd /srv/backend`, `lix download`, `haxe`): the runtime image has no `/srv/backend`, `/srv/frontend` nor haxe (`camap-hx.Dockerfile:138-141`, apt list `:109-113`).
10. [CONFIRMED] `camap-ts/docs/install.md:21` / `camap-ts/README.md:21` "avec docker-compose (ne fonctionne plus)" while install.md itself is a docker-compose-based procedure (`install.md:16,126,158-164`).
11. [CONFIRMED] `camap-ts/docs/install.md:124,162`, root `README.md:175,179` talk about `docker-compose.yml` as an editable file; it is a symlink to `docker-compose.dev.yml` (root listing), so editing "the base" edits the dev file.
12. [CONFIRMED] Root `README.md:65-66` "copy `.env` into `camap-ts` and `config.xml` into `camap-hx`"; dev compose mounts root-level `./.env` and `./config.xml` (`docker-compose.dev.yml:109,140-141`) and `camap-ts/.env` is a symlink to `../.env`. Both `config.xml` (root) and `camap-hx/config.xml` exist; which is used by compose: root one (`:140`).
13. [CONFIRMED] Root `README.md:107-109,119-121` says `key`/`CAMAP_KEY` is "used to verify password hashes". True for HX (`User.hx:278`) but it is also the bridge bearer secret, TS md5/sha1 salt and file-id hash input (`bridge.strategy.ts:13`, `crypto.service.ts:17-26`, `file.service.ts:65`); undocumented in README/conf.md.
14. [CONFIRMED] `camap-ts/docs/future.md:53` says MySQL 5.7 "commence à être ancienne"; the stack runs 8.0.36 (`mysql.Dockerfile:1`, `camap-ts/README.md:15`).
15. [CONFIRMED] `camap-hx/README.md:7` "Haxe 4.05" vs `4.0.5` (`camap-hx.Dockerfile:15`) - typo level. (verifier-corrected: actual line is camap-hx/README.md:10)
16. [CONFIRMED] `.cursor/rules/project.md:14` "Do not couple camap-hx and camap-ts at build/runtime"; runtime coupling is structural: bridge (`BridgeService.hx:14,98`), shared key (`bridge.strategy.ts:13`), crons (`crontab.service.ts:20`), Apache proxy to Nest (`camap-static.conf:16-25`), shared DB.
17. [CONFIRMED] Root `README.md:77-82` "5 containers": matches dev compose (traefik, mysql, nest, neko, mailpit); prod/easy compose have 4 (no mailpit) (`docker-compose.prod.yml`, `docker-compose.easy.yml`).
18. [CONFIRMED] Root `README.md:96-98` says first access to `/install` initializes the DB and creates admin `admin@camap.tld`/`admin`; TS side has its own `scripts/start.sh` init (`schema:sync` + `dataset`, `camap-ts/scripts/start.sh:25-26`) not referenced by the Dockerfile or any compose (unverified who runs it). No claim checked regarding the `/install` controller itself (other area). (verifier-corrected: start.sh:25-26 verified; not referenced by Dockerfile/compose)

## 9. Code inconsistencies

Compose / Traefik
1. [CONFIRMED] `docker-compose.prod.yml:108-109` and `:79-80` use `context: .` with `dockerfile: camap-hx.Dockerfile` / `camap-ts.Dockerfile`; neither file exists at the root (they are in `camap-hx/` and `camap-ts/`; dev uses `./camap-hx` `./camap-ts`, `docker-compose.dev.yml:78-80,119-121`). The prod compose build paths are broken as written. (verifier-corrected: prod compose lines 79-80 and 108-109 verified; no Dockerfile at root)
2. [CONFIRMED] `docker-compose.prod.yml:81` `env_file: camap-ts/.env` while dev/easy use root `.env` (`docker-compose.dev.yml:81-83`, `docker-compose.easy.yml:66`); prod has no `.env` mount, easy and prod neko containers have no `config.xml` and no `camapts.env` mount, and the HX image does not contain `config.xml` (`camap-hx.Dockerfile:138-141`), so the Neko app cannot read config (Sugoi `Config.hx:22` reads the file unconditionally).
3. [CONFIRMED] `docker-compose.easy.yml:13` and `docker-compose.prod.yml:13`: `--entrypoints.nest.adress=:3010` (typo `adress`); dev has `address` (`docker-compose.dev.yml:20`). The nest entrypoint is defined but no router uses it (routers use `websecure`).
4. [PLAUSIBLE: runtime DNS resolution not testable; alias only in dev compose verified (dev.yml:114-115)] `camap-hx/apache/camap-static.conf:16-25` proxies to hostname `nest-devcamap`, a network alias defined only in dev compose (`docker-compose.dev.yml:113-115`); prod/easy nest containers have no alias (no `networks` block in `docker-compose.prod.yml:74-104` / `docker-compose.easy.yml:63-82`). `config.xml:20` uses `nest-loc-camap` for the bridge. So `/neostatic`, `/graphql`, `/locales` proxies fail outside dev (unverified at runtime).
5. [PLAUSIBLE: which Traefik static source wins (CLI vs /traefik.yml at non-default path) depends on Traefik runtime; file contents and absence of traefik.enable labels (dev.yml:70,153 are =false only for mysql/mailpit) verified] Traefik static config conflict: `command:` flags (`docker-compose.dev.yml:12-20`) say `exposedbydefault=false`, whereas `traefik.yml:30` says `exposedByDefault: true`; `traefik.yml` also defines redirect `web->websecure` (`:7-12`) that the CLI flags do not. Mounted at `/traefik.yml` (`docker-compose.dev.yml:36`), not the documented default location `/etc/traefik/traefik.yml`; which source is effective is unverified. The nest/neko containers have no `traefik.enable=true` label (`docker-compose.dev.yml:98-105,128-135`), so they rely on `exposedByDefault: true`; with the CLI value (false) they would not be routed.
6. [CONFIRMED] `serviceheaders` middleware and `traefik.http.routers.service.middlewares=serviceheaders` are defined as labels on the reverse-proxy container itself (`docker-compose.dev.yml:29-38`) which has no `traefik.enable=true`; router `service` has no rule/service (dangling). Hard-coded origins `https://camap.localdomain` (`:30`) do not follow a changed hostname.
7. [CONFIRMED] Nest CMD/command differences: image `CMD` runs `node dist/main.js` without migrations (`camap-ts.Dockerfile:65`); only `start:prod` runs `typeorm migration:run` (`api-core/package.json:25`), used only by `docker-compose.prod.yml:86`. dev and easy use `start:dev` (`nest start --watch`, `docker-compose.dev.yml:97`, `docker-compose.easy.yml:71`) - easy runs watch mode on a production image that pruned dev dependencies (`camap-ts.Dockerfile:29`) (`@nestjs/cli` is in `dependencies`, `api-core/package.json:81`). (verifier-corrected: @nestjs/cli is at api-core/package.json:79 (not 81))
8. [PLAUSIBLE: CI workflows not opened] `docker-compose.easy.yml:42,65,84` uses image tag `:master`; the TS workflows found tag `vX.Y.Z`, `major.minor`, `major`, `latest` and `staging` (`camap-ts/.github/workflows/docker-publish.yml:101-105`, `publish-staging.yml:87-90`). No `master` tag found in these two workflows (the other publish-* workflows not checked) -> unverified.
9. [CONFIRMED] `docker-compose.dev.yml:84` sets `NODE_ENV=development` for Nest while Dockerfile sets production (`camap-ts.Dockerfile:55`); with `development` the auth cookies lose `HttpOnly` and the cookie domain logic is skipped (`auth.service.ts:194,349`). (verifier-corrected: HttpOnly check at auth.service.ts:194-274 (several sites), domain skip at :349)
10. [CONFIRMED] MySQL port `3306` is published to the host in dev (`:62-63`) and also in easy (`docker-compose.easy.yml`, `ports 3306`), contradicting the my.cnf comment "in production keep database not exposed" (`camap-ts/mysql/my.cnf`), though the comment is about `bind-address`. (verifier-corrected: my.cnf:12-14 bind-address comment verified; easy.yml:50-52 publishes 3306)
11. [CONFIRMED] Root `.env` (not read) is mounted both as nest `/srv/.env` (`docker-compose.dev.yml:109`) and HX `/srv/camapts.env` (`:141`): one file feeds both runtimes with different parsing rules (`entrypoint.sh:9-26` normalizes `KEY = value`; dotenv in Node handles the spaces itself).

Config / code
12. [CONFIRMED] `.env.sample` has `HX_TRIGGER_CRONS=true`; the check is `!process.env.HX_TRIGGER_CRONS` (`crontab.service.ts:17`): `HX_TRIGGER_CRONS=false` or `0` still triggers.
13. [CONFIRMED] `camap-ts/packages/api-core/src/tools/crontab.service.ts:11` comment says daily cron at `15 0`; implemented `EVERY_DAY_AT_MIDNIGHT` (`:43`).
14. [CONFIRMED] `camap-hx/src/controller/Cron.hx:36-37`: `canRun()` returns `true` unconditionally; auth/CLI checks are commented out; combined with Apache routing any request path to `index.n` (`.htaccess:5-8`), `/cron/*` is publicly invocable (also confirmed the intended guard in the comment `:39-50`). (verifier-corrected: Cron.hx:36-37 and doMinute/doHour/doDaily:59,93,341 call canRun(); camap-hx/www/.htaccess:6-8 rewrites to /index.n; no Apache/Traefik rule blocks /cron (apache/camap-static.conf, traefik/config). SECURITY-RELEVANT)
15. [CONFIRMED] `.env.sample:22` `DB_ENTITIES=./dist/**/*.entity.js` vs `.env.test` `./src/**/*.entity.ts`; `ormconfig.js:33` prefixes `packages/api-core` - OK, but `ormconfig.js:34` comment uses `env.SYNCHRONIZE` while sample uses `DB_SYNCHRONIZE`; `DB_SYNCHRONIZE` is in sample/docs yet unused (dead). (verifier-corrected: ormconfig is camap-ts/ormconfig.js:33-34 (packages/api-core/ormconfig.js extends it); DB_SYNCHRONIZE only in docs/conf.md:64 and a commented line in envSchema.ts:19; .env.sample not readable here)
16. [CONFIRMED] `SMTP_REQUIRE_TLS` set in `.env.sample:32` and dev compose (`docker-compose.dev.yml:90`) but never read (`mails.module.ts` computes `requireTLS = !secure && !ignoreTLS`, `:39`). (verifier-corrected: SMTP_REQUIRE_TLS only in dev.yml:91; not read in src (mails.module.ts:39))
17. [CONFIRMED] `envSchema.ts:39-46` makes `SMTP_AUTH_USER/PASS` required, yet `mails.module.ts:36-37` defaults host/port when unset (defaults unreachable in practice because schema requires host and port, `envSchema.ts:27-34`).
18. [CONFIRMED] `camap-ts/packages/front-core/src/envSchema.ts` (requires FRONT_URL, FRONT_GRAPHQL_URL, CAMAP_HOST, MAPBOX_KEY, CACHE_KEY) is not imported anywhere in `front-core/src` (grep for `envSchema` finds only the file itself) -> dead. `CACHE_KEY` there vs actual `__CACHE_KEY__` define (`webpack.config.js:79`). (verifier-corrected: front-core src has no import of envSchema (grep); webpack define at :79)
19. [PLAUSIBLE: Nest ConfigModule precedence (process env first) not opened; ormconfig.js:20 file-overrides-env verified] `ormconfig.js:20` file overrides process env; Nest ConfigModule does the opposite (process env first) - the same var set in both places (compose `env_file` vs mounted `.env`) can resolve differently for DB vs app config.
20. [CONFIRMED] `camap-ts/packages/api-core/src/main.ts:58` hard-codes `/srv` (the commented `process.cwd()` alternative `:57`); `main.ts:10` imports `resolve` unused. (verifier-corrected: srvRoot at main.ts:58; `resolve` imported at :10, only used in a comment :83)
21. [CONFIRMED] `camap-ts/package.json:20-21` scripts restart `neko-camap` / `nest-camap` and `api-core/package.json:37` logs `nest-camap`; compose services are `neko-loc-camap` / `nest-loc-camap` -> broken scripts. Root `dev:typeorm:*` uses `typeorm` script of api-core (`api-core/package.json:34`) OK.
22. [CONFIRMED] `camap-ts/scripts/start.sh` (DB init, `NPM_RUN_CMD`) and `scripts/tune-env-file.pl` (merge `.env.sample` with `PW_HASH_KEY`, `FRONT_URL`...) are not referenced by Dockerfiles/compose in this repo (the Dockerfile copies `scripts/` `:36` but `CMD` is node directly `:65`) - appear to serve another deployment (Scalingo/buildpack, per `camap-ts/README.md:22`); `tune-env-file.pl` maps `PW_HASH_KEY` -> `CAMAP_KEY` (`:20-22`), a name not used elsewhere. (verifier-corrected: not referenced in package.json files, Dockerfile or README (grep); Scalingo claim is from camap-ts/README.md:22)
23. [CONFIRMED] `camap-ts/scripts/iso-3166-1.sh` copies to `packages/front-core/public/data` (`:9`): script not wired into any npm script (grep of `package.json` files: none) (unverified in other places). (verifier-corrected: no npm script references it (grep of root/api-core/front-core package.json))
24. [PLAUSIBLE: shell behaviour on symlink not run] `camap-ts/scripts/setup.sh:3-11` runs `npm install` then copies `.env.sample` if `.env` missing, but `camap-ts/.env` is a symlink to `../.env` here (dangling symlink would not satisfy `[ ! -f ]` but `cp` writes through the link; unverified).
25. [PLAUSIBLE: Sugoi BaseApp.hx and image build output not re-checked; Dockerfile:80,88 and backend/package.json:11 verified] HX build vs docs on templates: Dockerfile compiles `lang/fr/tpl` (`:88`, a gitignored dir `camap-hx/.gitignore: lang/fr/tpl/*`) which only exists after the backend build with `-D i18n_generation` (`:80`); `backend/package.json:11` `build:tmpl` compiles `lang/master/tpl` instead; at runtime `debug=1` reads `lang/master`, `debug=0` reads `lang/fr` (external Sugoi `BaseApp.hx:80-85`). Dev compose mounts local `./camap-hx/lang` over `/srv/lang` (`:138`), hiding the precompiled `lang/fr/tmp` from the image.
26. [CONFIRMED] Dev compose mounts local `./camap-hx/www:/srv/www` (`:139`), so the image-built `www/index.n`, `www/js/app.js`, `texts_fr.mo` are shadowed by local files (must be built on the host; `.gitignore` excludes `*.n`, `www/lang/*.mo`, `camap-hx/.gitignore`). Entrypoint writes `env.js` into this mounted dir (`entrypoint.sh:4`), ignored by git (`camap-hx/.gitignore:55`).
27. [CONFIRMED] `camap-hx/frontend/build.hxml:23-25` always compiles `-debug -D debug -dce no`; `camap-hx/frontend/package.json:34` `libs:prod` refers to `libs/rollup.config.js` (dir `camap-hx/frontend/libs/` exists, not examined). (verifier-corrected: build.hxml:23-25 verified)
28. [CONFIRMED] Versions: HX frontend React 16 + react-router 5 (`frontend/package.json:13,16`) vs front-core React 18 + router 6 (`front-core/package.json:70,78`) coexisting on the same pages (neo modules loaded from HX templates).
29. [CONFIRMED] `camap-ts/packages/front-core/src/set-public-path.ts:1` header comment says `packages/api-core/src/set-public-path.ts` (wrong path comment).
30. [PLAUSIBLE: secrets in config.xml seen (key at config.xml:15 and mapbox at :17-18); .env.test and pem not inspected] Committed secrets/tokens in repo: `config.xml` key and a Mapbox token (`config.xml:17,22`), `.env.test` SMTP creds and Mapbox key, `camap-ts/packages/front-core/localhost-key.pem` (file present; contents not inspected). Observation only.


## Verification summary

Confirmed: 41, Refuted: 0, Plausible: 7 (items 8.1-8.18 doc, 9.1-9.30 code). Note 8.4 sub-claim on `camap_api` is wrong (View.hx:278 reads it) and is corrected inline.
