# CAMAP — Haxe → TypeScript migration: reference documentation

This folder describes **what CAMAP actually does today**, as read from the code in the
`camap-hx` and `camap-ts` submodules in October and November 2026. It is the input for the next
steps: a task list covering tests and user stories, retooling `camap-ts` for a full test suite,
upgrading `camap-ts`, then porting the Haxe code and checking that the port behaves the same.
Those steps are **not** covered here. This folder contains no plan, estimate or recommendation.

## Scope

| Repo | What it is | Size (approx.) |
|---|---|---|
| `camap-hx` | Haxe 4 / Neko server-rendered app (Sugoi MVC, `.mtt` templates), plus a small Haxe→JS React bundle (`camap-hx/js`) | ~25k lines `.hx`, 116 source templates in `lang/master/tpl` (`lang/fr` is generated) |
| `camap-ts` | NestJS GraphQL API (`packages/api-core`), React "neo modules" (`packages/front-core`), shared lib (`packages/camap-common`) | ~17k lines api-core, ~37k lines front-core |
| `camap-docker` (this repo) | Dev docker-compose, Traefik, MySQL image | — |

**One-sentence architecture.** Every page is rendered by Haxe. TS adds React widgets ("neo
modules") inside those pages, and runs a GraphQL API over the **same MySQL database**. The two
apps share the sid session cookie, a secret key (`key` = `CAMAP_KEY`) and a set of HTTP calls in
both directions. See [01-architecture.md](01-architecture.md) and
[05-cross-stack-integration.md](05-cross-stack-integration.md).

## How to read

| File | Content |
|---|---|
| [01-architecture.md](01-architecture.md) | Components and versions, runtime topology and routing, page rendering, builds, full configuration reference, scheduling, logging |
| [02-data-model.md](02-data-model.md) | Every table, whether Haxe and/or TS map it, field differences, flags and enums, encodings, timezone, schema management, `Variable` keys |
| [03-features/](03-features/) | One file per business domain: routes and endpoints, numbered business rules, flows, Haxe vs TS ownership |
| [04-haxe-inventory.md](04-haxe-inventory.md) | Every Haxe controller action, service, db class, template directory and JS file, with its TS counterpart (none / partial / full) |
| [05-cross-stack-integration.md](05-cross-stack-integration.md) | Haxe `/api/*`, Nest `/bridge/*`, calls in both directions, shared DB writes, shared auth, GraphQL/REST inventory |
| [06-existing-tests.md](06-existing-tests.md) | Existing Haxe utest and TS Jest/e2e/Storybook suites, whether they can run, fixtures, CI |
| [inconsistencies-documentation.md](inconsistencies-documentation.md) | Where the existing docs (`camap-ts/docs`, READMEs…) contradict the code |
| [inconsistencies-code.md](inconsistencies-code.md) | Contradictions inside the code: rights/security gaps, bugs, Haxe↔TS divergences, dead code, config, tests |
| [_drafts/](_drafts/) | Working drafts per area (verified, tagged). They are kept for traceability; the files above are the reference. |

Feature files in `03-features/`:
users-auth · groups-membership · catalogs-products-vendors-places · distributions-volunteers ·
orders-subscriptions · payments-operations-reports · messaging-mails · crons-scheduled-jobs ·
admin-superadmin · frontend-templates-i18n.

### Conventions
- Every fact cites `path:line`, relative to the `camap-docker` root (e.g. `camap-hx/src/service/OrderService.hx:109`).
- Verification tags on inconsistencies:
  - **CONFIRMED**: a second agent re-read the cited code and the claim holds.
  - **PLAUSIBLE**: the claim depends on runtime, external libraries (Sugoi lives outside the repo, in `~/haxe`) or deployment config, and could not be checked statically.
  - Refuted claims were removed; each inconsistency file lists them in an appendix.
- "hx" means `camap-hx` and "ts" means `camap-ts`. "Ownership" means which side writes the data or serves the route today.

## Key facts at a glance
- **Shared database, double mapping.** 22 Haxe `db.*` classes map 1:1 to TypeORM entities on the same tables. Haxe never creates or migrates the schema. Schema comes from TypeORM (`schema:sync` in dev, `migration:run` in prod), and the 12 migrations have no baseline. → 02
- **Haxe owns almost every write**: catalogs, products, distributions, subscriptions, orders, baskets, payments config, volunteers and absences. TS writes: login and registration, sessions, memberships, member management, messages, vendor self-service, waiting-list decisions, and some payment operations. → 03-features
- **The TS front calls the Haxe REST API** (`/api/subscription/*`, `/api/catalog/*`, `/api/order/*`) for the member ordering UI. Haxe calls Nest `/bridge/*` with the shared key as a Bearer token. → 05
- **Crons**: the logic lives in Haxe `Cron.hx`, and Nest triggers it by calling `GET /cron/minute|hour|daily` on Haxe. Nest also runs its own jobs: mail queue flush, purges and cache. → crons-scheduled-jobs
- **Emails**: both sides write to the `BufferedJsonMail` queue table. Only Nest sends from it. → messaging-mails
- **Tests**: there are 27 Haxe utest methods with no build target, and about 131 TS Jest cases (the front-core Jest config is broken). CI only builds images. → 06

## Glossary

| Term (code / UI) | Meaning |
|---|---|
| **AMAP** | *Association pour le maintien d'une agriculture paysanne*, the French form of a CSA. In CAMAP, an AMAP is a **Group**. |
| **CSA** | Community Supported Agriculture. Used in TS names (`csaCatalog`, `csa-subscriptions`). |
| **Group** (`Group`) | One AMAP or association. It holds members, places, catalogs and settings (flags, allowed payment types, membership settings). |
| **UserGroup** | A user's membership of a group. It also holds the user's rights and the cached `balance`. |
| **Membership / adhésion / cotisation** | The yearly membership fee a member pays to the group (`Membership` table, `Operation` type 3). |
| **Catalog / contrat** (`Catalog`) | A contract between a group and a **vendor** for a period. Type 0 = constant orders (classic AMAP, the same basket at each distribution). Type 1 = variable orders. |
| **Vendor / producteur** (`Vendor`) | A producer. Vendor records are shared across groups, and a user can "claim" one. |
| **Product** | An item in a catalog: unit, quantity, price, VAT, and stock settings. |
| **Coordinator / référent** | A user with rights on a catalog (`ContractAdmin` right). |
| **MultiDistrib** | One distribution session: a date, a place and an order window, for one group. |
| **Distribution** | One catalog's participation in a MultiDistrib. It can override the order window. |
| **DistributionCycle** | A repeating template (weekly, biweekly, triweekly, monthly) used to create many MultiDistribs at once. |
| **Subscription / souscription** | A member's commitment to a catalog for a date range. It holds the default orders and absences. Every order line belongs to a subscription. |
| **UserOrder** | One order line: product × quantity × distribution, for a user and possibly a second user (`user2`). |
| **Basket / panier** | All of a user's order lines for one MultiDistrib. |
| **Absences** | Distributions a subscriber will miss, within the limits the catalog sets. |
| **Operation** | A money movement: 0 = variable order (`VOrder`/`Order`), 1 = `SubscriptionTotal`, 2 = `Payment`, 3 = `Membership`. |
| **Volunteer / permanence, VolunteerRole** | A member's shift at a distribution, and the shift role (generic or catalog-specific). |
| **WaitingList** | A request to join a group, which an admin approves or refuses. |
| **Neo module** | A React module from `front-core`, mounted inside a Haxe `.mtt` page (`neo.createNeoModule`). |
| **Sugoi** | The Haxe web framework CAMAP uses: MVC, `sys.db` ORM (SPOD), sessions, mailer, `Variable`, `File`. It lives outside the repo. |
| **SPOD / `sys.db`** | The Haxe ORM behind the `camap-hx/src/db/*` classes. |
| **`.mtt`** | Haxe templo templates. Source in `camap-hx/lang/master/tpl`; per-language copies are generated. |
| **BufferedJsonMail** | The email queue table. |
| **Bridge** | The Nest `/bridge/*` HTTP routes that Haxe calls, authenticated with `CAMAP_KEY`. |

## Inconsistencies in numbers
- **Existing documentation vs code**: 113 entries (DOC-NN). 5 are PLAUSIBLE; the rest are CONFIRMED.
- **Code**: 163 entries (CODE-NN), deduplicated from about 215 raw findings:

| Category | High | Medium | Low |
|---|---|---|---|
| Security / rights | 17 | 12 | 5 |
| Data integrity | 1 | 8 | 11 |
| Bug / crash | 0 | 12 | 22 |
| Haxe ↔ TS divergence | 0 | 17 | 18 |
| Dead code | 0 | 2 | 12 |
| Config / build | 2 | 7 | 12 |
| Tests | 0 | 2 | 3 |

High = auth/rights bypass or data loss. Examples: TS `loginAs` doesn't await its rights check, so any logged-in user can impersonate another; the Haxe password reset never checks the token; `/cron/*` and several Haxe `/api/*` routes need no login; vendor phone and email are exposed whatever the vendor's privacy settings.

## Method and limits
- 10 reader agents covered infra, data model, users/auth/groups, catalogs, distributions, orders, payments, messaging/crons, frontend/i18n, and integration/tests. 3 independent verifiers then re-read the code behind each claimed inconsistency, and a coverage critic and a gap-fill pass checked that every `.hx` file, controller action, template and api-core handler is covered (181 api-core handlers enumerated).
- Coverage gaps that remain are listed at the end of [04-haxe-inventory.md](04-haxe-inventory.md).
- The inventory is the least precise file. Its "TS counterpart" column is set per controller (with overrides), not checked per action. Its purpose text was extracted mechanically. 55 of its 243 actions have no description from the readers.
- Not covered: the production deployment (Kubernetes, see the `CAMAP-APP/minikube-camap` repo referenced in the root `README.md`), Sugoi internals, and live data.
- Nothing was executed. Builds, tests and the app were not run; every statement comes from static reading.
