# CAMAP Haxe → TypeScript migration: task overview

> A short, rough analysis built from the reference documentation in [docs/](docs/README.md).
> The numbers are orders of magnitude, meant for scoping. They are not a committed plan.
> The detailed plan (roadblocks, ordering, estimates per task) comes next.

## 1. What the job is

Today CAMAP runs **two apps on one MySQL database**:

- **camap-hx** (Haxe 4.0.5 / Neko / Apache): renders **every page** and owns **almost every write**. That covers catalogs, products, distributions, subscriptions, orders, baskets, payments config, volunteers, absences, admin, CSV and print exports, and all cron logic.
- **camap-ts** (NestJS 9 / TypeORM 0.2 / React 18): login and registration, sessions, memberships, member management, group messaging, vendor self-service, the mail queue, and 26 React "neo modules" mounted inside Haxe pages. It maps the same tables (22 entities mirror the Haxe db classes).

The two are tightly coupled. The TS front calls the Haxe REST API (`/api/*`) to order. Haxe calls Nest's `/bridge/*` endpoints and fetches its JS manifest on every page render. Nest triggers the Haxe crons over HTTP. Both share the session cookie and a secret key.

**The migration means:** move every remaining Haxe responsibility into camap-ts, so that `camap-hx`, Neko, Apache and the Haxe-JS bundle can be deleted. Visible behaviour must stay the same ("isomorphic"), with **no data migration**, because the database is already shared.

## 2. What moves (component count)

| Haxe component | Count | Size | Destination in camap-ts |
|---|---|---|---|
| Controller actions (routes) | **243** across 38 controllers | ~7k lines | Nest GraphQL queries and mutations (some REST) + React pages/routes |
| Services (business logic) | **17** | ~5.5k lines. The biggest are SubscriptionService 1147, OrderService 882, DistributionService 792, VolunteerService 412, PaymentService 357 | Nest services. This is the real porting work. |
| DB classes | **22** | ~3.5k lines | Entities already exist. Only the **business methods** on them move (e.g. `MultiDistrib.getState`, `Catalog` flags, `Subscription` absences). |
| Templates (`.mtt`) | **116** (about 100 pages + 14 email templates) | — | About 60–80 React pages/views after merging; emails go to the existing api-core mail renderer |
| Haxe-JS / React 16 bundle | **18** files (legacy OrderBox, selectors) | ~1.4k lines | Replaced by front-core components (MUI 5) |
| Cron jobs | **1 controller**: 1 per-minute, 8 hourly, 5 daily jobs | 826 lines | `@nestjs/schedule` (already used for the TS-side jobs) |
| Payment types | **7** | small | TS payment registry |
| Form widgets, tools, common | 9 + 8 + 3 | ~1.5k lines | Shared lib (`camap-common`) + React form components |
| Haxe REST `/api/*` used by the TS front | **25** routes | — | GraphQL. The front-core callers (`csaCatalog`, `batchOrder`, volunteers) are rewired. |
| Existing Haxe tests | 27 utest methods | — | Rewritten as Jest |

Status from [04-haxe-inventory.md](docs/04-haxe-inventory.md): of 336 Haxe units, **184 have no TS counterpart**, **130 are partial** (read-only GraphQL or a neo widget exists), **0 are fully ported**, and 22 exist in TS only as schema.

Business rules documented across the 10 feature docs: **about 315** numbered rules. They are the backbone of the tests and user stories below.

## 3. Big architectural moves

1. **Make front-core a full application.** Today it has no app shell: no global router, layout, navigation or auth-guarded routing. Only 3 modules have their own router. Haxe `base.mtt` provides all of that. This is the largest structural piece of new front-end work. It also includes a decision to make: SPA (keep webpack/React) or SSR.
2. **Move every write path into Nest.** Add GraphQL mutations and transactional services for catalogs, products, distributions and cycles, subscriptions, orders, baskets, absences, stock, payments and operations, volunteers and admin. Today TS has **no mutation** for subscriptions, orders or baskets.
3. **One rights and policy layer.** Rights checks are scattered and inconsistent on both sides: 34 security/rights issues, 17 of them High (`loginAs` impersonation, an unauthenticated `/cron/*`, missing ownership checks, un-awaited async guards). The port has to centralise them (guards and policies per resource), and must **not** copy the existing holes. This is the one place where "isomorphic" deliberately does not apply.
4. **Take ownership of the schema.** Haxe never migrates the schema, and TypeORM has 12 migrations but no baseline. The port needs a baseline migration taken from production. The legacy naming (PascalCase tables, legacy FK names, JSON/CSV text columns, Paris-time DATETIMEs) must be kept while both apps run side by side.
5. **Auth and session take-over.** TS already does login. Still to move: password reset (Haxe-only today, and broken), group selection, invite links, the rights editor and superadmin. The two-hash scheme (md5 `pass` from Haxe vs bcrypt `pass2` from TS) needs consolidating. The sugoi `Session`/sid coupling goes once Haxe is gone.
6. **Strangler routing during the transition.** Both apps must run in parallel and be migrated page by page. The reverse proxy (Traefik/Apache) routes each migrated path to the TS front, and neo modules disappear as their host pages move. The shared DB makes this possible, but it means every intermediate state must stay consistent across both writers.
7. **Crons, mail and notifications.** Move the `Cron.hx` jobs into Nest. Remove the HTTP trigger. Move the digest notifications (`NotificationMail`, read and written only by Haxe today).
8. **Files, exports, i18n.** Move the `/file/*` serving and sugoi `File` blobs, and server-side CSV and print views (no PDF/XLS in Haxe; TS already does client-side CSV/XLSX). Move gettext `.po` strings into i18next JSON. Move email templates.
9. **Upgrade camap-ts first.** NestJS 9→11, `@nestjs/graphql` 12 and Apollo Server 3 (end of life) → Apollo 4+, **TypeORM 0.2→0.3** (breaking: DataSource, find options, repositories), MUI 5→latest, and Node 20→22. Doing this before porting avoids writing about 15k lines of new code against APIs that are about to be replaced.
10. **Decommission.** Remove the Neko container, Apache config, haxe_libraries, the Haxe-JS build, `/bridge/*` and `/api/*`. Simplify docker-compose and the Kubernetes manifests.

## 4. Tests (rough)

The strategy needs **characterisation tests written against the current system first** (Haxe + TS), so that the same suite can show the port behaves the same.

| Layer | What | Rough count |
|---|---|---|
| Test tooling | Test DB + factories/fixtures (dataset generator exists but hard-codes the schema), fixed front-core Jest config, Playwright, CI test job (none today) | — (infrastructure) |
| Service / integration (Jest, real MySQL) | 1–2 per business rule, focused on subscriptions/orders/absences/stock/payments/distribution cycles | **450–600** |
| API contract (GraphQL + remaining REST) | Each ported route: happy path + rights matrix (anonymous, member, coordinator, admin, superadmin) | **250–350** |
| End-to-end UI (Playwright) | One per user-story journey, run against Haxe before porting and against TS after | **80–120** |
| Security regression | One per confirmed rights/security issue, asserting the **fixed** behaviour | **~35** |
| **Total new tests** | | **≈ 800–1,100** |

Today there are about 131 TS Jest cases (front-core's can't run) and 27 Haxe tests with no build target.

**Progress:** the Phase 0 harness exists in `camap-docker/tests` (2026-11-02). See [PROGRESS.md](PROGRESS.md).

## 5. User stories (rough)

About 243 routes and about 315 rules collapse into **≈ 100–120 user stories**. There are 6 actors: visitor, member, catalog coordinator, group admin, vendor and superadmin. Plus system stories for crons and mail.

| Domain | Stories |
|---|---|
| Users, auth, account (register, login, reset, invites, profile, RGPD/purge) | ~12 |
| Groups and membership (settings, members, waiting list, rights, cotisations) | ~12 |
| Catalogs, products, vendors, places, files (CRUD, CSV import/export, stock, duplicate, documents) | ~20 |
| Distributions and volunteers (multidistrib, cycles, shift, roles, calendar, attendance sheets) | ~16 |
| Orders and subscriptions (subscribe, constant/variable orders, absences, batch orders, baskets, history) | ~20 |
| Payments and reports (payment types, operations, balances, exports/prints) | ~12 |
| Messaging, notifications, crons (group mail, digests, reminders, purges) | ~8 |
| Admin / superadmin (theme, attention messages, diagnostics, scripts) | ~6 |
| Shell and navigation (home, group choice, menus, i18n, theme) | ~5 |
| **Total** | **≈ 110** |

## 6. Effort (rough order of magnitude)

These are person-days for one experienced TS developer familiar with the domain. The range is about ±30%. AI-assisted porting may compress the mechanical parts (templates→React, Haxe→TS services), but not the analysis, the rights redesign or the verification.

| Phase | Content | Person-days |
|---|---|---|
| 0. Test tooling | Test DB, factories, fix Jest, Playwright, CI | 10–15 |
| 1. Stories + characterisation tests | ~110 stories, E2E and API tests against the current system | 40–60 |
| 2. Upgrade camap-ts | Nest, Apollo, TypeORM 0.3, MUI, Node | 15–25 |
| 3. Foundations | Schema baseline, rights/policy layer, app shell + router, strangler routing, auth take-over | 25–35 |
| 4. Domain porting (services + mutations + pages + tests) | users/groups/admin 20–30 · catalogs/products/vendors/files 25–35 · distributions/volunteers 20–30 · **orders/subscriptions/absences/stock 30–45** · payments/reports 15–25 · messaging/crons 10–15 · remaining pages/i18n/theme 15–25 | 135–205 |
| 5. Cut-over and decommission | Remove Haxe/Neko/Apache, infra, security hardening, final verification | 10–20 |
| **Total** | | **≈ 235–360 person-days (≈ 11–17 person-months)** |

Phase 4 is where the risk is. Orders/subscriptions is the densest area: SubscriptionService and OrderService together hold about 2,000 lines of rules about absences, minimum orders, balances and stock, plus the order window, which is not enforced server-side.

## 7. What will happen, in sequence (outline only)

1. Write stories and characterisation tests against **today's** behaviour, and record the known bugs as known.
2. Upgrade camap-ts so new code targets current APIs.
3. Lay the foundations: schema baseline, rights layer, app shell, strangler routing.
4. Port domain by domain, starting with the least coupled (messaging/crons, admin), then catalogs → distributions → orders/subscriptions → payments. Each domain is "done" when its characterisation suite passes on TS and its pages are routed to TS.
5. Switch the last routes, then delete camap-hx.

## 8. Main risks to examine in the planning step
- Hidden behaviour in Sugoi (outside the repo): sessions, `Variable`, `File`, templo macros, and the mailer.
- Two writers on one DB during the transition, combined with float rounding and Paris-time dates, which are handled differently on each side.
- Undocumented actions (55 of 243 have no description) and the 82 api-core handlers mentioned only by generic names.
- Security fixes change behaviour. Each one needs an explicit product decision ("fix" vs "keep").
- The production deployment is Kubernetes (`CAMAP-APP/minikube-camap`), not this repo's docker-compose. Its routing is not documented here.
