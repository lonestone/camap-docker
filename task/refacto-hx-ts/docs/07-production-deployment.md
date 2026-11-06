# 07. Production deployment and production schema

> Read on 2026-11-06 for roadblocks G1 and C1 ([ROADBLOCKS.md](../ROADBLOCKS.md)).
> Sources:
> - the `minikube-camap` submodule (commit `128ff2a`), a Helm chart deployed by Argo CD. It is read only: nothing in this analysis is written there.
> - the database the user provided on `localhost:3306` (container `loc-mysql`, schema `db-camap`), queried read only.

## 1. What the minikube repo is

Its README calls it a **template** for a local environment (Minikube on Windows + Argo CD), meant to be forked. Its `values.yaml` holds local values: `camap.local` / `api.camap.local`, `NODE_ENV=development`, `debug=1`, 1 replica each, an in-cluster MySQL with 2 Gi.

So the chart shows **how** production is built: which services, which ingresses, how config reaches each app. The **real production values** are not in it: hostnames, replicas, autoscaling, secrets, an external DB or not, `NODE_ENV`. The user confirmed one of them: production serves hx and Nest on separate hostnames, as the chart does.

## 2. Topology

| Piece | Chart object | What it does |
|---|---|---|
| `web` | `deployment-web.yaml`, image `ghcr.io/camap-app/camap-hx` | Apache + mod_neko, port 80, `TZ=Europe/Paris`, probes on `/ping`. Optional HPA (2–4 pods on memory), PDB. |
| `api` | `deployment-api.yaml`, image `ghcr.io/camap-app/camap-ts` | Nest, port 3010, `TZ=Europe/Paris`, probes on `/health`. `replicaCount: 1`, no HPA. |
| `mysql` | `statefullset-mysql.yaml`, MySQL 8.0 | `utf8mb4_unicode_ci`, `sql-mode` **without** `STRICT_TRANS_TABLES`, `mysql_native_password`, no binlog. |
| config | `configmap.yaml`, `files/*.tpl` | An init container runs `envsubst` on `camapts.env.tpl` and `camaphx-config.xml.tpl` from secrets `camap-mysql` and `camap-runtime`. Both apps get the same `CAMAP_KEY`. `DB_SYNCHRONIZE=false`. |
| mail | `apps/mailpit.yaml` | Mailpit in the template; production uses a real SMTP (`SMTP_*` values). |

## 3. Routing

```
browser ──► ingress-web  (host: web)  /  ──► web:80  (Apache)
                                              ├─ /graphql, /neostatic/, /locales/  ──► camap-api:3010   (apacheOverlay ProxyPass)
                                              └─ everything else                    ──► Neko (Haxe)
browser ──► ingress-api  (host: api)  /  ──► camap-api:3010   (every Nest route: /mails/*, /files/*, /bridge/*, /health, ...)
web pod ──► camap-api:3010  (camap_bridge_api: /bridge/*, manifest)          [in-cluster]
api pod ──► http://camap-web (CAMAP_LOCAL_HOST: /cron/* when HX_TRIGGER_CRONS) [in-cluster]
```

- The Apache proxy rules come from a ConfigMap (`web.apacheOverlay.camapStaticConf`) mounted over `/etc/apache2/conf-available/camap-static.conf`. It has the same three rules as `camap-hx/apache/camap-static.conf`, with the service `camap-api` instead of `nest-devcamap`. The repo's file is not what production runs: the overlay replaces it.
- Ingress extras on the web host: 301 redirects for `/cgu` and `/privacypolicy` (to external URLs), and an optional block of `/install` (`ingress.web.security.blockInstall`, **false** in the template). The api host can get `deny` CIDRs (`ingress.denyCidrs`).
- Ingress limits: body 15 MB, read timeout 30 s.

## 4. What it means for the migration

1. **The strangler router is the web ingress (nginx), not Apache.** The cleanest cut-over step is: add an ingress path on the web host (`pathType: Prefix`, longest match wins) pointing to the TS front for each migrated area. The web host keeps one origin, so cookies, CSRF and links don't change. Apache overlays are a fallback for paths that the ingress can't split.
2. **The TS front needs a home.** Today the React bundles are served by Nest (`/neostatic/`, through Apache). The app shell (roadblock A2) can be served by Nest or by a new `front` deployment. Either way, it is a new backend for web-host ingress paths. This is a chart change, made by whoever owns the production fork (not by us in this repo).
3. **The api host already exposes every Nest route publicly**, `/bridge/*` included. The bridge is meant for in-cluster calls from Haxe. Check that production restricts it (`denyCidrs`, or an auth check in Nest). Otherwise it is one more security item, like the public `/cron/*` (UND-097), which the web ingress exposes too.
4. **Crons.** `api` has one replica and no HPA, so the Nest `@Cron` jobs run once. Haxe crons are triggered in-cluster by Nest (`HX_TRIGGER_CRONS=true`, `CAMAP_LOCAL_HOST=http://camap-web`), which lands on any web pod. Moving the jobs into Nest removes the HTTP trigger. If production ever scales `api`, the jobs need a lock (decided in COM-JOB-012).
5. **Sessions across pods.** `web` can scale out (HPA). Haxe sessions live in the DB (`Session`), so any pod can serve any request. The TS front must keep that property: no in-memory session state.
6. **`FRONT_URL` is the internal API URL in the chart** (`FRONT_URL = camapApiUrl = http://camap-api:3010`). Nest uses it for CORS (`main.ts:34`) and for the links of the email template list (`mails.controller.ts:81`), so those links point to an in-cluster name. Check the production value before relying on `FRONT_URL` in the port.
7. **Long-running admin calls hit the 30 s ingress timeout.** For example `/files/compressAll` on 500 images. The port should make such jobs asynchronous.
8. **MySQL is not in strict mode.** Out-of-range or too-long values are truncated with a warning, not refused. The TS port and the test stack must keep the same `sql-mode`, or writes that pass today will fail after the port (or the reverse). The test stack already matches (§5).

## 5. Production schema vs the test baseline (C1)

The schemas were compared column by column through `information_schema` (tables, columns with type/nullability/default/extra/collation, indexes, foreign keys with their rules). Server settings were compared too.

| | `db-camap` (3306) | `camap_test` (3307, test baseline) |
|---|---|---|
| MySQL | 8.0.36 | 8.0.36 |
| `sql_mode` | `ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION` | same |
| time zone | `SYSTEM` = CET | same |
| charset / collation | utf8mb4 / utf8mb4_unicode_ci | same |
| tables / columns / FKs | 30 / 300 / 58 | same, identical definitions |
| indexes | 95 | 98 |

**The only difference** is in the primary keys of three join tables. Production lists `userId` first, and the TypeORM-synced test baseline lists it last. To cover `userId` lookups, TypeORM then adds a separate index:

| Table | Production PK | Test PK | Extra test index |
|---|---|---|---|
| `Membership` | `userId, groupId, year` | `year, groupId, userId` | `Membership_user (userId)` |
| `UserGroup` | `userId, groupId` | `groupId, userId` | `UserGroup_user (userId)` |
| `WaitingList` | `userId, amapId` | `amapId, userId` | `WaitingList_user (userId)` |

This doesn't change any behaviour the tests observe: same columns, and the same uniqueness. The only effect is on query plans, and on the row order of queries with no `ORDER BY` that scan a whole table. The production schema dump (`mysqldump --no-data`) can become the baseline as it is.

**The `migrations` table is empty** in `db-camap`. The table exists, but none of the 12 TypeORM migrations in `camap-ts/packages/api-core/src/migrations` is recorded as applied, although the schema already contains their effects. Running `migration:run` against it would replay all 12. The baseline migration (OVERVIEW §3.4) must therefore be the first migration, and existing databases must be marked as already migrated: insert the baseline and the 12 old migrations into `migrations`, never run them.

## 6. Limits of this database

The structure matches production, but **the data is a small sample, not production volume**: 7 users, 2 groups, 9 catalogs, 928 orders, 57 distribution days (February 2026 to March 2027), the last user created on 2026-02-20. It is enough to check the schema. It is **not** enough for the data-shape checks the roadblocks call for: legacy `VOrder` operations, subscriptions before 2022 (C5), every flag and enum value in use (C2), DST-crossing dates (C3), and real volumes for performance. Those need a production dump, anonymised.
