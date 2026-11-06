# CAMAP Haxe → TypeScript migration: detailed plan

> Written on 2026-11-06, revised on 2026-11-07 with the user's decisions (§8). It follows [OVERVIEW.md](OVERVIEW.md) and replaces its §6 estimates and its §7 outline.
> Inputs: [ROADBLOCKS.md](ROADBLOCKS.md), [PORTING-RULES.md](PORTING-RULES.md), [TS-FIXES-FIRST.md](TS-FIXES-FIRST.md), [TS-ONLY-STEP.md](TS-ONLY-STEP.md), the specs ([specs/](specs/README.md)), the test harness (`camap-docker/tests`) and the analysis docs, especially [07-production-deployment.md](docs/07-production-deployment.md), [08-sugoi.md](docs/08-sugoi.md) and [09-camap-ts-upgrade.md](docs/09-camap-ts-upgrade.md).
> Estimates are person-days for one developer who knows the stack and has read the specs. Each range covers the code, its tests and the TS side of the test harness for that step.

## 1. Rules the plan applies

1. **One production switch** (user, 2026-11-07).
   - Production stays on Haxe and the current camap-ts until every domain is ported. It then switches to TS in one cut-over (§6).
   - The domains are ported and verified one at a time on the migration branch. On the **test stack**, the ported domains run next to Haxe behind a proxy (§3).
   - The migration branch, with the upgrade and [TS-FIXES-FIRST.md](TS-FIXES-FIRST.md), ships only at the switch.
2. **Domains are ported whole** (A1, scoped to the test stack). A table's writers move to TS together, so that a `mixed` test run means something. Both apps may write a table during that phase when they apply the same rules: TS is aligned on Haxe before the port (P4). That covers the mail queues (`BufferedJsonMail`, `NotificationMail`), `Operation` (D6/D7), and the D4 writes to `Distribution` and `ProductDistributionStock`.
3. **The specs and the suite define "same behaviour".** A domain is done when its specs pass on the `ts` target, with no expected deviation left for it (§4.3).
4. **How code is ported:** [PORTING-RULES.md](PORTING-RULES.md). Reproduce sugoi/Haxe only where data or a live contract requires it (the 10 Match points of [08-sugoi.md](docs/08-sugoi.md) §3). Pages keep the Haxe structure and use the TS design.
5. **Fixes:** decided bugs in camap-ts code we keep are fixed before any port ([TS-FIXES-FIRST.md](TS-FIXES-FIRST.md)). Haxe and sugoi bugs are only fixed by the port. No production patch before the switch.
6. **Haxe is frozen (H2), in production and in code.** The only Haxe edits are two test-only patches, used only by the `mixed` test stack and never deployed (P2, P3).
7. **The suite runs locally before each merge.** No CI job.

## 2. The TS app shell (A2)

**Decided (P1, 2026-11-07): a single-page app in front-core, served by Nest on the web hostname.**

- **SPA, not SSR.** front-core is already a React 18 / webpack app, and its 26 modules are client-rendered. Nothing in the specs needs server rendering. The public pages (group page, invitation, login) are simple and not search-critical.
- **Served by Nest.** Nest already serves `/neostatic/` and `/locales/`. It also serves the SPA `index.html` for the page routes. After the switch, the web hostname points to Nest. Because the SPA runs on the web hostname, it calls `/graphql` on its own host, so there is no CORS.
- **Same URLs.** TS pages keep the Haxe URLs (`/contractAdmin/...`, `/distribution/...`). Users bookmark them, emails already sent contain them, and the test harness addresses pages through `app.urls`. They can be renamed after the switch, with redirects.
- **Shell content.**
  - The router, an auth guard, the layout and navigation built to the structure of `base.mtt` (header, group menu, sidebar, footer, notices) with front-core and MUI components.
  - Error pages, i18next and the theme (TS-FIXES-FIRST item 10).
  - Moving a domain adds routes; it doesn't rebuild the shell.
- **Current group.**
  - **Target design (production):** the current group belongs to the TS session.
  - **On the `mixed` test stack (P2):** Haxe keeps the group in the Neko-serialized `Session.sdata` (`camap-hx/src/App.hx:160-171`), which TS can't read. A test-only Haxe patch mirrors `session.data.amapId` into a plain cookie. TS changes the group through the existing Haxe URL `/user/choose?group=<id>&redirect=<url>`.

## 3. Verifying a domain next to Haxe (test stack only)

- **Routing table.** Created at step 3D: a file in this repo listing every path ported to TS, with its domain. It drives the test proxy, and it is the checklist of the production switch (every listed path answers on TS).
- **Test proxy.** A reverse proxy in `docker-compose.test.yml` routes the ported paths to nest-test and the rest to neko-test.
  - One rule per ported prefix (e.g. `/contractAdmin/orders`, not all of `/contractAdmin`), because a Haxe controller can span two domains (`ContractAdmin`, `Distribution`).
  - The harness gains a `mixed` target: its `CamapApp` uses the ts driver for ported domains and the hx driver for the rest.
- **Test-only Haxe patches.** On a camap-hx branch used by the test stack only:
  - the group cookie (P2);
  - the cron jobs of ported domains commented out in `Cron.hx`, so that Haxe and Nest don't both run them (P3).
  Keep them minimal: they are never deployed.
- **What `mixed` proves.** A ported domain works with the Haxe pages that still link to it and write next to it. That doesn't happen in production, but it catches broken links, shared-format errors (the Match points) and rule differences early, while the domain is fresh.

## 4. Steps and estimates

### 4.1 Done

| Phase | Status |
|---|---|
| 0. Test tooling | Done (2026-11-02): resettable DB, factories, Playwright, compose stack (neko-test, nest-test, mysql-test, mailpit), faked clock, `CamapApp` targets. |
| 1. Specs and characterisation | 709 statements, 121 UND points all decided; 685/709 statements covered by about 1,690 tests (full run about 1.2 h). The other 24 can't be observed on the current stack. |
| Read-only analyses | B1 sugoi, G1 production chart, C1 production schema, E1/E2 upgrade inventory. |

### 4.2 Remaining work

| Step | Content | Prerequisites | Person-days |
|---|---|---|---|
| **1R** | Close Phase 1: stabilise the 5 tests that fail intermittently in long runs. The 24 statements that can't be observed on the current stack get their tests with the port of their domain. | — | 1–2 |
| **2A** | camap-ts upgrade ([09-camap-ts-upgrade.md](docs/09-camap-ts-upgrade.md) §6): dead dependencies, Node 22, TypeScript 5, Nest 11 and GraphQL, TypeORM 0.3 + `@nestjs-cls/transactional` (P6), the deadlock policy (P5), front-core MUI and date pickers. Acceptance: full suite with only the known deviations. | 1R | 15–22 |
| **2B** | [TS-FIXES-FIRST.md](TS-FIXES-FIRST.md) items 6–10 and 20–39 (accounts, groups, catalogs, dates, payments, mail). Each one flips its test and removes its deviation. | 2A (items † need the new transaction library); item 6 after 3B | 12–20 |
| **3A** | Rights and policy layer (OVERVIEW §3.3): one policy service per resource (group, catalog, distribution, subscription, operation, message, user), Nest guards that await it, and a rights matrix test helper. Then TS-FIXES-FIRST items 1–5 and 11–19 move the existing resolvers onto it. The ported domains reuse it. | 2A | 8–15 |
| **3B** | Schema baseline (C1): a TypeORM baseline migration generated from the production structure (`:3306`, read-only). The 12 existing migrations are marked as applied, never run. Keep the production primary-key column order of `Membership`, `UserGroup`, `WaitingList`. Production has never run a migration, so the first new one (the `deleted@camap.tld` seed of TS-FIXES-FIRST item 6) comes after this step. | 2A | 2–3 |
| **3C** | App shell (§2): router, auth guard, layout and navigation in the structure of `base.mtt`, error pages, i18next wiring (French only, UND-118), theme, current group (TS session, plus the test-only cookie for `mixed`). Nest serves the SPA. | 2A | 8–12 |
| **3D** | Test-stack tooling (§3): routing table, test proxy, `mixed` target, the test-only Haxe branch with the group-cookie patch. | 3C | 2–3 |
| **3E** | ts driver skeleton in the harness (`tests/src/targets/ts/`): `urls`, `auth`, `graphql`, layout and login page objects. Shell specs (`09-navigation` layout parts, `00-stack`) pass on `ts`. | 3C | 2–3 |
| **4** | Domains D1–D8, in this order (§5). | 3A–3E | 131–203 |
| **5** | Production switch and decommissioning (§6). | D1–D8 | 12–18 |
| | **Total remaining** | | **≈ 193–301** |

These figures replace OVERVIEW §6. Phases 0 and 1 (50–75 days in OVERVIEW) are spent. OVERVIEW put the rest at 185–285 days.
- **What adds work:** the 29 extra camap-ts fixes sorted on 2026-11-06 (2B, part of 3A), and the shell, now costed apart from the domains.
- **What saves work:** the single switch removes the per-domain production cut-overs, rehearsals and ingress rules, and the transition plumbing in production.

With a second developer, D1 and D2 can run alongside D3 once Phase 3 is done (disjoint tables). D4 → D5 → D6/D7 stay sequential because they build on each other's tables.

### 4.3 Definition of done for a domain

1. **Writer inventory.** Every Haxe and TS code path that writes the domain's tables is listed, and each Haxe one is mapped to its TS replacement. This is the first task of the domain, and it confirms or corrects the boundary given in §5.
2. **Port.** Services, mutations and queries with policy-layer guards, pages and mail templates, under [PORTING-RULES.md](PORTING-RULES.md). The TS-ONLY-STEP §1 decisions of the domain and the decided behaviour of its specs are applied: the Haxe deviations of the domain don't exist on `ts`.
3. **Harness.** The ts driver implements the `CamapApp` members the domain's specs use. The domain's specs pass on `ts` with no deviation left. The routing table lists the domain's paths; its cron jobs are commented out in the test-only Haxe branch; a full `mixed` run passes.
4. **Data check** (as soon as the dump is available). The domain's tables in the anonymised production dump are read through the TS entities: flag and enum mapping (C2), dates around DST (C3), legacy rows (C5). Anything unreadable is fixed in the domain, not left for the switch.

## 5. Domains: order, boundaries, content

The order follows the dependencies:
1. the domains that only send mail or only touch platform settings;
2. accounts and groups, whose rights and settings every other domain reads;
3. catalogs, distributions, orders and payments, each built on the previous one.

The cron jobs move with the domain whose tables they write.

| # | Domain | Haxe scope | Tables written | Cron jobs moved | Haxe `/api` routes replaced | Specs (tests) | Person-days |
|---|---|---|---|---|---|---|---|
| **D1** | Messaging, notifications, automatic emails | `Messages` (1 action), the mail jobs of `Cron.hx` and the email templates they use | `Message`; the queues `BufferedJsonMail`, `NotificationMail` | Volunteer instruction mail, volunteer alerts, distribution notifications (4 h/24 h), order-opening notifications, email digests (hourly and daily), errors email, orders list to the vendor at order closing | — | `07-communication` (56) and the cron specs of `01`, `03` | 9–14 |
| **D2** | Platform administration | `admin/Admin` (10), `Attention` (1), `Install` (2, diagnostics superadmin-only), `Scripts` (3, CLI only, dry-run by default), the platform parts of `Main`/`Api`, theme | `Variable` (theme, maintenance toggle UND-111), `Error` | — | the platform parts of `Api.hx` | `08-administration` (163), except user and group admin | 5–9 |
| **D3** | Accounts and groups | `User` (10), `Account` (3), `Amap` (2), `AmapAdmin` (10: group settings, rights editor), `Group` (7), `Member` (9), `admin/User` (5), `admin/Group` (4), the invitation and group-choice parts of `Main` | `User`, `Group`, `UserGroup`, `Membership`, `WaitingList`, the `Cache` reset and invitation tokens | — | `api/User` (4) | `01-accounts` (81), `02-groups` (351), admin users and groups | 17–25 |
| **D4** | Catalogs, products, vendors, places, files and documents | `ContractAdmin` catalog actions (about 15), `Product` (6), `Vendor` (5), `Place` (5), `Documents` (4), `Media` (4), `/file/*` serving (same URL and signature, Match points 1–2), geocoding (UND-044) | `Catalog`, `Product`, `Vendor`, `Place`, `File`, `EntityFile`; also distribution order dates (UND-054) and `ProductDistributionStock` (UND-038), with the Haxe rules | Clean unused files, delete old documents | `api/Product` (2), `api/Places` (1) | `03-catalogs` (531) | 24–34 |
| **D5** | Distributions, cycles, volunteers | `Distribution` session actions (about 20), `amapadmin/Volunteers` (4), attendance sheets | `MultiDistrib`, `Distribution`, `DistributionCycle`, `Volunteer`, `VolunteerRole` | — | `api/Distributions` (2) | `04-distributions` (103) | 19–29 |
| **D6** | Subscriptions, orders, absences, baskets, stock | `Contract` (6), `ContractAdmin` order actions (about 15), `SubscriptionAdmin` order actions, `Subscriptions` (3), `History` (5), `Shop` (1), the `Distribution` price-change actions, the Haxe-JS OrderBox (18 files) replaced by front-core | `Subscription`, `UserOrder`, `Basket`, `ProductDistributionStock`, the order-side `Operation` writes | Default automated orders | `api/Order` (4), `api/Subscription` (4), `api/Catalog` (4) | `05-orders` (137) | 29–44 |
| **D7** | Payments, operations, reports and exports | `Transaction` (3), `SubscriptionAdmin` payment actions, the 7 payment types, reports, CSV and print views | `Operation` (payment side) | — | — | `06-payments` (61) | 14–24 |
| **D8** | Home, navigation, remaining pages, i18n | `Main` (home, legal and remaining pages), the remaining templates, gettext → i18next (UND-118), the language selection removed | — | — | the rest of `Api.hx` | `09-navigation` (48) | 14–24 |

**Where the TS-ONLY-STEP §1 decisions land.**
- D3: UND-119, CODE-178 and CODE-179. With a single switch, the session id renewal at login no longer has to wait for Haxe to be gone; it is done in D3, in the TS session design.
- D4: CODE-177, the `/file` 404 that leaks the signature.
- D8: UND-104, UND-118.
- At the switch: UND-113.
- UND-097: the cron endpoints disappear at the switch, so the key check only needs to hold on the HTTP trigger while the test stack still uses it.

## 6. Phase 5: production switch and decommission (12–18 days)

1. **Ready to switch.**
   - A full run on `ts` with no deviation left.
   - The data checks of every domain done on the anonymised dump.
   - A full rehearsal on a copy of the dump: migrations (3B baseline, then the new ones), start of Nest alone, the suite's smoke and read-only specs against it.
   - The routing table checked: every Haxe path answers on TS or is listed as removed.
2. **Sessions and passwords, at the switch.**
   - Sessions become TS-only: crypto ids, a new id at login, `HttpOnly; Secure; SameSite` cookies (CODE-178/179), one cookie-domain rule and a single-step logout (UND-019), which person logged in stored the TS way (UND-014).
   - Existing logins: decide whether current `sid` cookies are honoured once (read `Session.uid`), or everyone logs in again.
   - Password hashes: keep checking the md5 `pass` until each user has logged in once, then drop it (D3). `CAMAP_KEY` stays for the signed file URLs (Match point 1).
   - Reset links that Haxe already sent: honour them or not (Match point 10).
3. **The switch.**
   - Stop the Haxe crons, then point the web hostname to Nest and run the migrations.
   - Rollback window: re-point to Apache/Neko and the previous camap-ts image. That is possible only while TS writes the shared formats (Match points), and while the migrations run at the switch are additive. Destructive schema changes wait until the window is closed.
4. **Decommission.**
   - Remove the Neko container, the Apache config, `haxe_libraries`, the Haxe-JS build, `/bridge/*`, the Haxe `/api/*` routes, the cron HTTP trigger and the neo-module manifest contract (E3).
   - Remove the compose and chart entries. The chart is changed by whoever owns it; it is never edited from here.
   - The `hx` and `mixed` targets are retired. [POST-MIGRATION-TASKS.md](POST-MIGRATION-TASKS.md) starts after this.

**Freeze duration.** Production runs the current code until the switch: about 10–15 months for one developer. Any urgent production fix to camap-ts during that time must also be applied to the migration branch.

## 7. What waits for the anonymised production dump

The structure is known (`:3306`, C1), so every step can start without the dump.

| Needs the dump | Why |
|---|---|
| Step 4 of each domain (data check) | C2 flags and enums (`Group.flags`, `Catalog.flags`, `User.rights`, `UserOrder.flags`), C3 Paris dates around DST, C5 legacy rows (`VOrder` operations, deprecated `Distribution` fields, subscriptions before 2023 in balances) |
| 3B verification | run the baseline on a copy and check that `migration:run` marks the 12 migrations without running them |
| Switch rehearsal (§6) | real volumes and shapes, migration timing |
| Switching `tests/db/schema.sql` to the production structure (still open) | only changes the PK column order and 3 indexes; can be done any time |

It is best to have the dump before D1 finishes, so that the data checks are done domain by domain and not all at the end.

## 8. Decisions

| # | Question | Decision (2026-11-07) |
|---|---|---|
| — | How production moves to TS | One switch after every domain is ported; mixed Haxe + TS only on the test stack (§1, §6) |
| P1 | App shell (A2) | SPA in front-core, served by Nest on the web hostname, Haxe URLs kept (§2) |
| P2 | Current group while Haxe runs | Only on the test stack: a test-only Haxe patch mirrors `amapId` into a cookie. In production the group belongs to the TS session. |
| P3 | Moving cron jobs one domain at a time | Only on the test stack: comment out the moved jobs in `Cron.hx` on the test-only branch, no switch mechanism |
| P4 | Tables that two domains write | No problem: TS is aligned on the Haxe rules before the port, and the specs prove it on both targets |
| P5 | Deadlock policy | The first-principles policy of [09-camap-ts-upgrade.md](docs/09-camap-ts-upgrade.md) §3.3 (fixes CODE-184) |
| P6 | ORM version and transaction library | TypeORM 0.3 now; the stack (TypeORM 1.x, Nest 12) is upgraded later. Transactions with `nestjs-cls` + `@nestjs-cls/transactional` ([09-camap-ts-upgrade.md](docs/09-camap-ts-upgrade.md) §3.2). |

Still open: the anonymised production dump, whether to switch the test baseline to the production structure, and (at the switch) whether current sessions and reset links are honoured.
