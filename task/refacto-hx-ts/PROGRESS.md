# CAMAP Haxe → TS migration: progress log

> What has been built so far, against the phases of [OVERVIEW.md](OVERVIEW.md) §6–7 and the
> roadblocks of [ROADBLOCKS.md](ROADBLOCKS.md). Newest entry first.
> Spec writing has its own log: [specs/_progress.md](specs/_progress.md).

## Status at a glance

| Phase (OVERVIEW §6) | Status |
|---|---|
| Specs (user statements) | ✅ 709 statements in [specs/](specs/README.md); UND decisions ongoing ([UNDECIDED.md](specs/UNDECIDED.md)) |
| 0. Test tooling | ✅ Harness delivered in `camap-docker/tests`, against camap-hx (entry 2026-11-02) |
| 1. Characterisation tests | ✅ Remainder pass done: 682 / 709 statements covered by 1675 tests; the 27 left are not observable on this stack (entry 2026-11-06) |
| 2–5 | ⬜ Not started |

---

## 2026-11-03: Phase 1 started, 05-orders (non-UI first)

Decision with the user: tests are written by me, domain by domain, on the single test
stack. Non-UI statements first (JSON API, form posts, cron, mail queue, DB state);
browser-only statements come in a second pass.

**Done so far** (all green, 108 tests, expected failures included; coverage 75 / 709):

| Spec file | Statements |
|---|---|
| `05-orders/absences-rules.api.spec.ts` | ORD-ABS-001..006, 009 (004 characterises UND-078) |
| `05-orders/subscription-create.api.spec.ts` | ORD-SUB-002, 003, 005, 006, 009, 011, 012, 015, 016*, 017, 018*, ORD-SBM-005 |
| `05-orders/variable-orders.api.spec.ts` | ORD-VAR-001..003, 005, 006*, ORD-OPL-001, 006, 012 |
| `05-orders/order-placement.api.spec.ts` | ORD-OPL-002..005, 008, 013, ORD-CST-001, 002, 006, ORD-AMT-001, 003..005, ORD-ADO-003, 004*, 007, 008 |
| `05-orders/order-minimums.api.spec.ts` | ORD-MIN-001..003, 005..007 |
| `05-orders/subscription-admin.forms.spec.ts` | ORD-SUB-004, 007, ORD-SBM-001..005, 010, 013, ORD-CST-004, ORD-BTR-001..005 |

`*` = runs under `deviation()` (decided behaviour hx does not implement): UND-068, UND-070,
UND-075, UND-080, UND-082.

**Harness additions:** `app.api.subscription` and `app.api.order` JSON clients,
`app.actions` (group select, admin subscription forms, balance transfer, reattribute,
own-subscription delete) with CSRF token and flash-message handling in `targets/hx/api.ts`,
`flows.ts` (subscribe through the app), `make.setProduct/setCatalog/parisDate`.

**Findings while writing (candidate CODE entries):**

1. hx forms: dates are posted as `_startDate`/`_endDate`; sugoi forms prefix every field
   with the form name and send `<form>_formSubmitted=true`; the token comes from a hidden
   input on the GET page.
2. Many admin pages need the session's current group: `GET /user/choose?group=<id>`.
3. The `/api/order/*` endpoints crash (500 "Invalid field access : distribStartDate") when
   called with `catalog` only and no `multiDistrib` for a variable catalog.
4. `POST /api/subscription/updateOrders` lets a member edit a paid line and resets `paid`
   (the API always runs in admin mode, CODE-078).
5. Absences locked by the order window are locked in the response only: the server refuses
   a change only once the distribution date is past (UND-078).
6. The "raw vs rounded" message of CODE-046 (ORD-MIN-007) could not be reproduced: Neko
   prints the float sum rounded.

**06-payments done (non-UI)**, 147 tests green, coverage 124 / 709:

| Spec file | Statements |
|---|---|
| `06-payments/payment-entry.forms.spec.ts` | PAY-ENT-001..010, PAY-BAL-001..007, PAY-OPE-001, 002, 004, 005, 009, ORD-SBM-007..009, 012* |
| `06-payments/reports-exports.views.spec.ts` | PAY-RPT-001..007, ORD-SBM-006 |
| `06-payments/payment-types.forms.spec.ts` | PAY-TYP-001..003, 006, 007 |
| `05-orders/history-baskets.views.spec.ts` | ORD-HIS-001..006*, ORD-BSK-001, 002* |

New deviations: UND-069, UND-071, UND-076, UND-090. New harness members: `app.views`
(history, member payments/balances, reports), `app.exports` (CSV with parsing), `app.actions.payments`,
`app.actions.groupAdmin`, `sugoiForm()` helper (token + `<form>_` prefixed fields).

Findings:
7. **`PaymentService.updateUserBalance` only sums operations attached to a subscription that
   started after 2022** (inner join on `Subscription`, `year(startDate) > 2022`). A payment
   recorded for a member with no subscription never counts in the balance (UND-087).
8. The delete link of an operation (and its token) exists only on the *subscription's* payments
   page (`/contractAdmin/subscriptions/payments/:id`, needs the catalog right): a pure membership
   manager gets no token. Operations without a subscription have no delete link at all (UND-090).
9. After `Transaction.insertPayment` hx redirects a coordinator to `/member/payments/:id`, which
   needs the membership right: a coordinator without it lands on the home page.
10. An operation row of type Payment with `data = NULL` makes `/member/payments/:id` crash
    (`Operation.getData`); same for a VOrder without basket ("should have a basket").

**Not covered in 05-orders yet** (need pages or are internal): ORD-SUB-001, 008, 010, 013,
014 (wizard / member mode unreachable by API); ORD-ABS-010, 011; ORD-BSK-*; ORD-AMT-002, 006;
ORD-CST-003, 005; ORD-HIS-*; ORD-OPL-007, 009..011, 014, 015; ORD-ADO-001, 002, 005, 006,
009..011; ORD-SBM-006..009, 011, 012 (payments: with 06-payments); ORD-MIN-004; ORD-VAR-004.

---

## 2026-11-02: characterisation test harness (Phase 0)

The first critical-path blocker (ROADBLOCKS F1) is lifted. The harness can run the
same tests against camap-hx today and camap-ts later. The scope agreed with the user
was the infrastructure plus about 6 seed tests, with the clock faked now through
libfaketime. Full documentation is in [`tests/README.md`](../../tests/README.md).
Nothing is committed yet.

### What was built (`camap-docker/`)

| Piece | Where | Notes |
|---|---|---|
| Isolated test stack | `docker-compose.test.yml`, `tests/stack/` | Compose project `camap-test` with `mysql-test` (tmpfs, port 3307), `nest-test` (built image, `dist/main.js`, alias `nest-devcamap`), `neko-test` (camap-hx image plus libfaketime, port 8180) and `mailpit-test` (port 8026). No Traefik. It can run beside the dev stack. |
| Stack script | `tests/scripts/stack.sh` | `build` (hx base image first), `up` (never rebuilds an image that exists), `wait`, `down`, `logs`, `ps` |
| Schema baseline (C1) | `tests/db/schema.sql`, `tests/scripts/baseline-schema.sh` | TypeORM `schema:sync` from the camap-ts entities into a scratch DB, then a dump of the 30 tables plus the 12 `migrations` rows. Regenerating gives no diff. A production-derived dump can replace it without touching any test. |
| Seed | `tests/db/seed.sql` | ToS `Variable`s, `admin@camap.tld`/`admin` (UND-107), `deleted@camap.tld` (UND-110) |
| DB reset | `tests/src/db/reset.ts` | Truncates every table except `migrations` and replays the seed, before **every** test (`workers: 1`) |
| Factories | `tests/src/factories/` | `user, userGroup, group, place, waitingList, membership, vendor, catalog, product, multiDistrib, distribution, distributionCycle, volunteerRole, volunteer, subscription, basket, userOrder, operation`, and the `amapScenario()` preset with one user per actor (all with password `test1234`) |
| Encodings (C2, C3) | `tests/src/encodings/` | SFlags ordinals taken from the Haxe enums, rights JSON, md5/bcrypt, CSV/JSON text columns, Paris wall-clock DATETIMEs. 11 unit tests (project `unit`). |
| Real logins | `tests/src/session/login.ts` | A hx `sid` session first, then the Nest GraphQL `login` mutation, all through the hx origin (one cookie jar). Sessions are never forged in SQL. |
| Fake clock (F4) | `tests/src/clock.ts`, `tests/stack/neko-test.Dockerfile` | libfaketime in Apache only. Uses an offset file (`+<seconds>`), re-read on every call. |
| Crons, mail, errors (F4) | `tests/src/{cron,mails,errors}.ts` | `cron.run()` (sends the shared key), reads of the `BufferedJsonMail` queue, and an `errors` auto fixture on the `Error` table |
| Target abstraction (F3) | `tests/src/targets/` | `CamapApp` interface (urls, auth, api, pages). The hx driver is done. The ts driver is a stub that marks a test `not-ported` and skips it. |
| Deviations (D1) | `tests/src/deviations.ts` | `deviation('UND-097')` makes the test an expected failure on the targets listed for that UND |
| Spec coverage | `tests/scripts/spec-coverage.ts` → `tests/reports/spec-coverage.md` | Parses `specs/**` statement IDs and reads the test tags |

### Seed tests (25 characterisation tests and 11 unit tests)

| Spec file | Statements | Layer |
|---|---|---|
| `00-stack/smoke.spec.ts` | (harness) | reset, baseline, Apache proxies, sid session, fake clock in Neko, `Error` capture |
| `01-accounts/login.ui.spec.ts` | ACC-LOG-001, ACC-LOG-004, ACC-LOG-006 | Browser, through the real neo LoginBox |
| `02-groups/group-public-page.spec.ts` | GRP-PUB-001, GRP-PUB-004 | Browser, visitor (Open / WaitingList / Closed) |
| `05-orders/absences.api.spec.ts` | ORD-ABS-007, ORD-ABS-008 | hx REST API, rights matrix, DB state |
| `04-distributions/volunteer-reminders.spec.ts` | DIS-VRM-001, DIS-VRM-003, DIS-VRM-004 | Hourly cron with the fake clock, mail queue |
| `07-communication/scheduled-jobs.spec.ts` | COM-JOB-002 | `deviation('UND-097')`: expected failure on hx |

### Verification

- `TARGET=hx`: 36 tests as expected, including COM-JOB-002 as an expected failure. Two runs in a row from a cold stack give identical results.
- `TARGET=ts`: the 18 spec tests are skipped as `not-ported`. The 5 hx-only smoke tests are skipped, and the 2 DB smoke tests pass.
- Coverage: 11 / 709 statements.
- The schema baseline regenerates with no diff, and the TypeScript typecheck is clean.

### Decisions taken during implementation

- **Clock = libfaketime offset, not `@date`.** The start-at format counts from process start, and Apache workers are long-lived, so it would drift. It was checked that Neko's `Date.now()` follows the file across prefork workers; `apache2 -X` is not needed.
- **Nest runs with `NODE_ENV=development` in the test stack.** With any other value, the cookies get `Domain=<CAMAP_HOST>` (`auth.service.ts` `getDomainProperty`), which is invalid on `http://localhost:8180`.
- **The Nest env file is mounted at `/srv/.env`, not passed with `env_file`.** `ormconfig.js` lets the file override process env (CODE-150).
- **`HX_TRIGGER_CRONS` is left unset** (CODE-015/CODE-151: `"false"` counts as true). Tests trigger jobs themselves.
- **hx `debug="0"`**, as in production.
- **No CI job** (2026-11-03, user decision): tests run locally before merging. The workflow drafted on 2026-11-02 was removed.
- **Images are built only by `stack.sh build`.** `compose up --build` rebuilt the hx base image through `additional_contexts` with a different cache key, and that Haxe build failed twice under amd64 emulation (exit 244).

### Findings (not yet in docs/inconsistencies-code.md)

These are candidate CODE entries. They have no IDs; add them when the doc is next revised.

1. **API errors never reach the `Error` table.** `controller/Main.hx` `doApi` calls `logError()` and then `app.rollback()`, which removes the row. Errors raised under `/api/*` leave no trace in the DB. The test `00-stack/smoke.spec.ts` pins this.
2. **An anonymous call to `/api/catalog/subscriptionAbsences/:id` returns 500.** `app.user.canManageContract` is dereferenced without a login check (`controller/api/Catalog.hx:77-80`). This is related to CODE-016 (unauthenticated `/api/catalog`).
3. **`/cron/minute?json=1` writes an `Error` row on every call**, on purpose ("debug in error log db", `controller/Cron.hx` doMinute). It pollutes the error log and the daily errors mail (COM-JOB-006).
4. **The Nest cookie `Domain` is built from `CAMAP_HOST` by stripping only `https://`**, so an `http://` host gives `Domain=http://…`. This is harmless in production (https), but it breaks any non-dev http deployment.
5. **Neko's clock is visible at `GET /cron`**: the constructor prints `now is …` for any cron URL, even `doDefault`. The harness uses it to check the fake clock.

### Next steps

1. Commit the harness (the user pushes). There is no CI job by decision (2026-11-03): the suite runs locally before merging (`tests/README.md` "Before merging").
2. Replace `tests/db/schema.sql` with a production-derived baseline when a dump is available (C1 is still open for production).
3. Write characterisation tests domain by domain, using the coverage report as the to-do list. Priority: orders/subscriptions/absences (densest), then the security findings with decided fixes, each with a `deviation()`.
4. Add a `src/deviations.ts` entry for every decided UND or CODE fix as tests reach it.
5. When porting starts, implement `src/targets/ts` members domain by domain (`tests/README.md` "Targets").

## 2026-11-03: subagent-per-spec-file phase

Method: one subagent (sonnet 5.5, high) per spec markdown file, run one at a time (single DB/clock),
brief in `TEST-WRITING-BRIEF.md`. Coverage before this phase: 253/709 (04-distributions, 07-communication,
01-accounts specs written earlier in the session, not logged individually).

Findings from earlier unlogged work (candidate CODE entries): password-reset form trusts a hidden uid
(any valid link sets another account's password, UND-009); Nest `loginAs` check is an always-truthy Promise
(any logged-in user can impersonate single-group non-superadmins, UND-010); invitation link doesn't check userId
vs email (UND-018); `createMessage` doesn't check the messages right; `/api` errors never persisted;
participation pages crash without `_from/_to`; Neko dates overflow after 2038; `Message.recipients` list
queries fail; lockout only fed by client `recordBadLogin`.

### 03-catalogs/catalog-creation.md -> `specs/03-catalogs/catalog-creation.forms.spec.ts` (30 tests)
Covered CAT-CCR-001, 003-014 (002 only the consent box). Deferred: CAT-CCR-002 server side (vendor creation fails
in test stack: Mapbox geocoding with token `test`), date-picker/wording/tinymce (browser).
Findings: only `insertChoose` checks a disabled vendor (direct `/contract/insert/<id>` creates the catalog);
consent checkbox is HTML `required` only, `doInsertVendor` never reads `gdprConsent`; filler-word-only vendor
name returns all vendors (max 30); constant catalog without order deadline gets 72h and an error-styled flash
but is saved; no percentage field/flag in hx (UND-037).
Harness: `actions.catalogs.*`, `urls.catalogDashboard`, generic `readForm`/`fillAndPost` in hx/api.ts.

### 03-catalogs/catalog-edit.md -> `specs/03-catalogs/catalog-edit.forms.spec.ts` (38 tests)
Covered CAT-CED-001..013 (004/013 characterised under UND-054/UND-050). Deferred: stock fields hidden on product
form (page rendering); `hasConstraints` never called in hx (nothing observable).
Findings: constant-catalog order page fails BEFORE any price update in hx (`Catalog.getOrders(null)` throws
"must have a delivery", Catalog.hx:271 via ContractAdmin.hx:767), not after as the spec says; saving a constant
catalog with empty delay also moves order closing of future distributions to 72h; variable-catalog price update
works from plain GET without token; "disappears from shop" observed on `/home` open-orders list.
Harness: `ActionResult.alerts`, `alertsOf`, `updatePrices`, `views.shop.home`; fixed `flags[]` override bug.

### 03-catalogs/products.md -> `products.forms.spec.ts` (51) + `products.api.spec.ts` (18)
Covered CAT-PRD-001..018 (only the crop UI of 013 is browser-only). 007/008 (UND-040), 011 (UND-049), 015 (UND-038)
characterised at hx behaviour.
Findings: no default unit "piece" on creation (NULL unit stored, PRD-002); empty/non-numeric price stored as 0 though
required (PRD-001); bulk product with quantity 0 accepted (PRD-010); multi-weight without variable price accepted
(PRD-011, spec mismatch); failed edit leaves stock rows untouched since the error redirect rolls back the rewrite,
UND-038 premise doesn't hold in hx (PRD-015); coordinator of catalog A can disable a product of catalog B via A's page
(PRD-007/008); server silently ignores price/quantity/unit posted for an ordered product (PRD-004); member or foreign
coordinator gets a 200 "Ouille !" page on edit/copy/delete (PRD-003/006); `/api/product/:id` returns `unitType` as a
number, `/api/product/get` as a string (PRD-012/016).
Harness: `api.products`, `actions.products`, `src/png.ts` (`makePng`, `pngSize`).

### 03-catalogs/stock.md -> `stock.forms.spec.ts` (34) + `stock.api.spec.ts` (24)
Covered CAT-STK-001..013 (stocks page text and JS period widget not asserted; page tested by status/redirect).
Findings: empty frequency choice accepted and stored as ratio 1 because `Math.isNaN(null)` is false (STK-004);
only catalog duplication goes through `ProductService.duplicate`, "copy and deactivate" keeps tracking mode but not
periods so copied per-period product has stock 0 everywhere (STK-013); camap-ts GraphQL `Product.stockTracking`
errors ("Enum StockTracking cannot represent value") for products in stock-managed catalogs: DB holds ordinals,
Nest enum is string-valued (STK-012, not pinned); product created via form without stock fields gets
`stockTracking` NULL not 0 (STK-001/012); distribution from another catalog gives error page + logged 500, save
rolled back (STK-011); order above available stock over the subscription API returns 500 not 403 (STK-006);
`order.update` by a coordinator above available stock silently caps the quantity, 200.
Harness: `ProductStockInput`, `api.catalogStock`, `views.stocks.page`, `actions.catalogs.duplicate`, `stockFields`.

### 03-catalogs/catalog-duplicate-delete.md -> `catalog-duplicate-delete.forms.spec.ts` (26)
Covered CAT-CDD-001..007.
Findings: copy name comes from the form, pre-filled "<name> - copie", cut at 50 chars (spec says "keeps name"); dates
normalised to 00:00:00/23:59:59 (CDD-001); "all products" copy turns inactive products active because
`ProductService.duplicate` doesn't copy `active` (CDD-002); delete order check uses `getProducts()` (active only), so
a catalog whose ordered products were deactivated can be deleted and its orders vanish; rest goes through DB
`ON DELETE CASCADE`; `removeRight` leaves empty `{ContractAdmin, params: []}` entries in contact rights JSON
(CDD-005/006, UND-047); member deleting is redirected to `/` not `/contractAdmin` (CDD-005); CDD-007 (copy products
page) is broken in hx: superadmin non-member redirected to `/`, member superadmin gets an empty source select, POST
raises "getTypedValue() function not implemented in source" (sugoi Selectbox); nothing copied.
Harness: `actions.catalogs.{duplicateForm,delete,copyProducts}`, `duplicate` options.

### 03-catalogs/catalog-list-view.md -> `catalog-list-view.views.spec.ts` (36)
Covered CAT-CLV-001..010. Deferred: dashboard invalid-character warnings (CLV-002: `Catalog.check()` only fires on
invalid UTF-8, columns are utf8mb4, data can't be created); documents part of CLV-008 (depends on CAT-DOC-004).
Findings: default list also shows catalogs not started yet (CLV-001); `/api/catalog/:id` and `/api/product/get?catalogId=`
answer anonymous visitors and other groups' users, product list includes inactive products (CLV-009, UND-039);
`/product/export/:id` has no right check, any logged-in user from another group downloads the CSV (CLV-009);
a plain member or another group's user can read `subscriptions`, `subscriptionsCount`, `products` of an active catalog
via GraphQL `getActiveCatalogs`, visitors refused (CLV-010, UND-043). No deviations added.
Harness: `views.catalogs.{list,dashboard}`, `api.catalog.{get,activeInGroup,managed,fieldsOfActive}`,
`exports.catalogProducts`.

### 03-catalogs/vendors.md -> `vendors.forms.spec.ts` (21) + `vendors.views.spec.ts` (8) + `vendors.graphql.spec.ts` (19)
Covered CAT-VEN-001..008, 010, 012, 013. Not covered: VEN-009 (nothing calls `ban`/`unban`), VEN-011
(`VendorService.create` has no caller); successful vendor save through the hx form is unreachable in the test stack
(Mapbox geocoding with token `test` fails every save): "link must start with http" pinned through GraphQL
`updateVendor`; "unable to locate this address" not observable (hx shows `Error#500: Invalid res features…`).
Findings: claimed vendor editable only by its owner, superadmin refused too (VEN-007, matches spec); hx page honours
show-email/show-phone but Nest `vendor` query returns email/phone even when hidden because `editor` is an un-awaited
Promise (VEN-010, UND-041); `getVendorProfessions`/`getVendorsFromCompanyNumber` work for anonymous (VEN-012,
UND-043); disabled vendor page returns 200 with error page and logs an Error row (VEN-008); duplicate-email check is
case-insensitive (VEN-002).
Harness: `actions.vendors.{editForm,edit}`, `views.vendors.publicPage`, `make.vendor` extended options.
Next: remaining 03-catalogs files (vendor-claim, vendor-pages, places, documents-files, product-pricing,
product-csv, catalog-absences-settings), then 02-groups, 01-accounts remainder, 08-administration, 09-navigation.

### 03-catalogs/vendor-claim.md -> `vendor-claim.graphql.spec.ts` (29)
Covered CAT-VCL-001..007 via GraphQL only (claiming exists only in camap-ts; hx has no claim flow; claim screens not tested).
Findings: VCL-003 premise doesn't hold: crash is in `getVendorWithEmailCheck` (`null.toLowerCase()` when primary email
differs and no secondary email, because of `&&` short-circuit), not in `claimVendor`; both cases characterised
(UND-048 undecided); VCL-001/002 listing matches emails case-insensitively (DB collation), `claim` compares
case-sensitively, so a vendor stored `Paul@Ferme.test` is listed to `paul@ferme.test` then the claim is refused;
VCL-005 `migrateVendor` and `delete` are not awaited in `claim` (latent race). No harness changes.

### 03-catalogs/vendor-pages.md -> `vendor-pages.views.spec.ts` (6) + `vendor-pages.graphql.spec.ts` (31)
Covered CAT-VDB-001, 002, 003, 005, 006 (VDB-004 already tagged via VEN-003/004/005 tests). Deferred (browser):
portrait/photos/tabs rendering and upload widgets.
Findings: GraphQL `vendor` query is behind the login guard, so a visitor gets an error although the public page is
open to visitors (VDB-001); `createDocument`/`deleteDocument` let any coordinator of one of the vendor's catalogs act
even if the vendor is claimed, while `createVendorImage`/`setVendorImage`/`updateVendor` are owner-only (VDB-006);
`deleteDocument` returns -1 even when the delete worked (VDB-006); visitor on `/vendor/dashboard` is redirected to
`/?__redirect=/vendor/dashboard`, members without a vendor to `/home` (VDB-003); `nextDistributions` follows Nest's
real clock, not the fake one (VDB-002). Harness: `views.vendors.dashboard`.

### 03-catalogs/places.md -> `places.forms.spec.ts` (25) + `places.api.spec.ts` (11) + `places.views.spec.ts` (2)
Covered CAT-PLC-001..007, 009, 010. Deferred: PLC-008 (Mapbox address search widget). Test-stack limit: hx geocodes
only on edit and it always fails (token `test`); tests assert the attempt (warning) and that the place is still saved.
Findings: hx refuses creating a place outside FR/BE though the form offers 8 countries, edit accepts any (Place.hx:75-77,
PLC-003 spec mismatch); any logged-in user can list/create/edit places, only delete is guarded (PLC-006, UND-051);
edit and delete don't check the place's group: a group admin edited and deleted another group's place (security,
PLC-006); refusal redirects to `/contractAdmin` not `/place`, non-manager delete raises an Error row "forbidden"
(PLC-005); 65-char name silently cut to 64 (PLC-002); `/api/places/:id` and GraphQL `place(id)` work without login
(PLC-009/010, CODE-021/UND-043); hx JSON API returns 500 for an unknown place id.
Harness: `api.places`, `actions.places`, `make.place` options (lat, lng, country, address2, main:false).

### 03-catalogs/documents-files.md -> `documents-files.{forms(31),views(13),graphql(17),cron(4)}.spec.ts`
Covered CAT-DOC-001..010, 012. Deferred: DOC-011 (superadmin view/recompress): Nest REST `/file/*` not proxied by the hx
origin, unreachable from the test stack.
Findings: `Documents.hx` edit/delete never check the document belongs to the group/catalog in the URL: a group admin can
rename/delete another group's document by id, a coordinator can delete a group document via the catalog route
(DOC-007/003, security); hx "subscriber" = having a `UserOrder` on an active catalog, not a `Subscription` row (DOC-004);
hx managers get no extra rights (a non-subscribed coordinator sees only members + public docs) while Nest
`catalog.documents` (via `getActiveCatalogs`) returns all documents incl. subscribers-only to any logged-in user
because `canManageCatalog` isn't awaited (DOC-005, UND-042); hx stores any posted visibility string and its edit form
allows "subscribers" on group documents, which Nest refuses (DOC-003); image cap is 4 MiB counting all multipart
fields while the message says 3 Mo, documents 10 MiB (DOC-009/010, UND-046); Nest lets the vendor owner add catalog
documents, hx forms don't (DOC-002).
Harness: `actions.{documents,media,files}`, `views.groups.page`, hand-built multipart body (Neko ignores Playwright
`multipart`), `factories/files.ts`.

### 03-catalogs/product-pricing.md + product-csv.md -> `product-pricing.forms.spec.ts` (23) + `product-csv.forms.spec.ts` (45)
Covered CAT-PPR-001, 002, 004, 005; CAT-PCS-001, 002. Deferred: PPR-003 (price/VAT sync is a JS widget); PPR-004
"new group starts with 5.5%/20%" (group creation geocodes, fails in the test stack).
Findings: CSV import row with missing/non-numeric price makes `Product.check()` raise "Invalid operation", whole
import rolled back incl. good rows (PCS-001); "N products imported" counts rows read, not products saved; imported rows
aren't validated (bulk without unit accepted, empty VAT stored 0); export header is the French field label, `unit` and
`bulk` untranslated, units exported as `Piece`/`Kilogram` (re-imports cleanly) (PCS-002); any logged-in member downloads
the export, inactive products included (PCS-002, UND-039); server doesn't check posted VAT against the group's list
(rate 7 stored, PPR-004); displayed price ignores percentage-fee flag set in DB (PPR-005, UND-037); VAT amount exposed
as `vatValue`, null when VAT is 0 (PPR-002).
Harness: `actions.products.csvImport.{open,upload,confirm}`, `ProductFormView.vatRates`, `views.invoices.ofMember`.

### 03-catalogs/catalog-absences-settings.md -> `catalog-absences-settings.forms.spec.ts` (22)
Covered CAT-CAB-001..006. Findings: "both dates required" message in `checkAbsences` is unreachable: an empty date field
crashes the controller (null `getFullYear`, ContractAdmin.hx:1149), error page with HTTP 200, nothing saved (CAB-003);
absence period counted through `hasAbsencesManagement`, so on a variable catalog with minimum 0 any maximum above 0 is
refused as "too large" (0 distributions), not tested (CAB-004); refused saves are rolled back (CAB-001/005).
Harness: `api.catalog.absences`, `actions.catalogs.{absencesForm,setAbsences}`.

**03-catalogs: all 14 spec files done.** Next: full-suite run + coverage refresh, then 02-groups.

Full suite after 03-catalogs: 821 passed (9.1 min, expected failures included). **383 / 709** statements covered (54.0 %), by 810 tests.

## 02-groups (started)

### 02-groups/group-creation.md -> `group-creation.forms.spec.ts` (12)
Covered GRP-CRE-001, 004 (only "geocoding is attempted"), 006, 007 (UND-024 characterised). Not reachable: GRP-CRE-002,
003, 005 (creator's rights, defaults, selected group, landing): every valid form ends on the Mapbox failure.
Findings: visitor on `/group/create` gets HTTP 200 with "Invalid field access : isAdmin" error page, no login redirect,
Error row logged (GRP-CRE-007); in hx the geocoding failure throws after group/place/UserGroup inserts and the whole
request is rolled back: a Mapbox outage means no group is created (GRP-CRE-001/004).
Harness: `GroupCreationForm`, `actions.group.{createForm,create}`, `alertsFromHtml`, `followAlerts`.

**Harness blocker worth a decision:** `camap-hx/src/service/Mapbox.hx:27` hardcodes `https://api.mapbox.com/geocoding/v5/`
with token `mapbox_server_token`="test" (tests/stack/config.test.xml). Every geocoding save (group creation, place edit,
vendor create/edit) fails in the test stack, blocking GRP-CRE-002/003/005, CAT-CCR-002, CAT-VEN-001/003 saves, PLC-004
success path. Fix option: a stub Mapbox server in the test compose + `extra_hosts` mapping api.mapbox.com to it + a
self-signed CA trusted by the Neko image. Not done yet.

### 02-groups/group-disabled.md -> `group-disabled.spec.ts` (18)
Covered GRP-DSB-001..004. Deferred: DSB-003 notice text (browser; only its GraphQL data tested); DSB-005 (UND-025) nothing
writes the field and no endpoint exists.
Findings: only `Cron.hx` lines 110 and 170 check `isDisabled()`; the other hourly jobs (distribution notices 4h/24h,
opening-orders notice, default automated orders) and the daily job don't, so a disabled group's members probably
still get those mails (not tested, DSB-004); `groupPreview` GraphQL is public and exposes `disabled` and `extUrl` of any
group to anonymous callers (DSB-003).
Harness: `urls.groupDisabled`, `views.groups.{home,disabledNotice}`, `GroupInput.extUrl`.

### 02-groups/group-public-page.md -> `group-public-page.graphql.spec.ts` (10) + `group-public-page.views.spec.ts` (5)
Covered GRP-PUB-001..007 (001/004 by the earlier browser spec). Map widget and landing text only checked for status.
Findings: hx stores the open group in the session on page view, so a visitor then reaches `/home` (shop) and a user can
call `/user/joingroup`; for non-open groups `/home` redirects the visitor to `/user/login` (PUB-005, UND-026
characterised); `groupPreview` exposes `disabled`/`extUrl` to anyone (PUB-003); `myGroups` is not filtered by disabled
groups (PUB-006, not tested); CSA page prints the group name only in the `mailto:` link.
Harness: `views.groups.{map,csa}`, `actions.group.join`.

### 02-groups/group-settings.md -> `group-settings.{forms(27),views(32),graphql(16)}.spec.ts`
Covered GRP-SET-001..010 (011 is a pointer to membership.md, covered there under GRP-COT). Not tagged D: logo uploader
button, registration widgets, TinyMCE. The group-edit form does not geocode, so it saves fine in the test stack.
Findings: SET-010 spec says "current and ended catalogs", hx lists only current and not-yet-started ones sorted by name
(`Amap.hx` `doDefault`); a member/membership manager/coordinator opening or posting `/amap/edit` gets a logged
technical error page (HTTP 200), `/amapadmin` redirects to `/` instead (message lost on double redirect) (SET-002);
settings form `id` is checked against the session group, mismatch redirects with error and saves nothing (SET-002);
a Full group refuses a direct join (error page) and redirects a waiting-list request without storing it (SET-004,
UND-023); saving keeps AllowInformationNotifs/AllowAlertNotifs flags (SET-005).
Harness: `api.groups.{get,setImage}`, `actions.groupAdmin.{settings,saveSettings}`, `actions.group.requestWaitingList`,
`views.groupAdmin.{dashboard,section}`, `views.groups.{catalogList,groupPageRequirements,loginPageRequirements}`.

### 02-groups/join-quit.md -> `join-quit.forms.spec.ts` (15) + `join-quit.graphql.spec.ts` (19)
Covered GRP-JOI-001..008, 010, 009 (membership removal part). Deferred: JOI-009 selection cleared (browser,
`window._Camap.resetGroupInSession`); JOI-003 ERRATUM concerns TS `register` (CODE-004), not hx.
Findings: hx never mails the group contact when a newcomer joins: `doJoingroup` creates the UserGroup then tests
`!isMemberOf(group)`, always false (JOI-002, test asserts no mail); JOI-008 (UND-027 characterised): hx link pages refuse on
orders in active catalogs and catalogs ended <30 days ago whatever the order date, the TS mutation refuses only when
`UserOrder.date` <1 month old, so an old order in an active catalog is refused by the hx page but accepted by the
mutation; hx also checks balance after orders; hx accepts a legacy md5 key on the link page, the mutation only sha1
(JOI-005); message-footer link without login redirects to itself with `?__redirect=` (JOI-006).
Harness: `api.groups.{quit,quitByControlKey}`, `actions.group.{quitKey,quitKeyFromMessage,openQuitLink,openQuitLinkFromMessage}`.

### 02-groups/members.md + members-import.md -> `members.{views(16),forms(15),graphql(39)}.spec.ts` + `members-import.graphql.spec.ts` (22)
Covered GRP-MEM-001..010, GRP-IMP-001..005 (member list UI itself is browser; only its GraphQL data tested).
Flakiness note: `members.forms.spec.ts` self-removal-with-confirm test (GRP-MEM-006/005) failed once in an earlier 4-file
run, then passed alone, 3 more runs and in the final 92-test run; cause not found: watch for it in full-suite runs.
Findings: hx removal link `/member/delete` refuses self-removal but not a group admin; only the GraphQL mutation returns
`cannotRemoveAdmin` (MEM-005); `removeUsersFromGroup` with a non-admin not in the group throws a TypeError and nobody is
removed (rollback), spec says that person is reported in the result (MEM-007); hx asks confirmation when the member has
orders, the GraphQL mutation removes without asking (MEM-006, UND-028); any logged-in user, even outside the group, can
read all member lists with emails (MEM-002, UND-029, security); `hasValidMembership` always false when the group has no
renewal date (MEM-009); import: a "new" line whose email already has an account is silently ignored, a nonexistent
`withAccounts` id gives an internal error, imported `address1` gets a trailing space (IMP-002/003); group `membershipFee`
is rounded to an integer (12.5 -> 13).
Harness: `api.members` (9 GraphQL members), `views.member.{list,sheet}`, `actions.members.remove`.

### 02-groups/membership.md -> `membership.{forms(11),graphql(72),views(2)}.spec.ts`
Covered GRP-COT-001..015 (COT-013 dialog widget and COT-012 dialog UI are browser-only; only GraphQL data tested).
Membership year comes from Nest (real clock): tests use renewal dates relative to the real year.
Findings: selecting `name` on `createMembership(s)` fails "Cannot return null for non-nullable field Membership.name"
yet the DB write is committed (COT-006/007); `createMemberships` reports the wrong user in `errors` when ids aren't in
ascending order (request order paired with `findByIds` order) (COT-010, UND-033); balance is recomputed from
subscription operations only, a stored balance not matching them is reset (COT-007); form accepts a fee >127, MySQL
silently stores 127, fee 0 accepted (COT-002); non-admins redirected to `/` with no flash (COT-001); debt row (type
Membership) has `data` NULL (COT-007); memberships off still counts as valid, payment always cash, fee 0 replaced by the
group fee, a user outside the group accepted (COT-005/006/008/009, as in the spec).
Harness: `api.memberships`, `actions.groupAdmin.{membershipSettings,saveMembershipSettings}`, `membershipRenewalDate`.

### 02-groups/rights.md -> `rights.{views(26),forms(32),graphql(10)}.spec.ts`
Covered GRP-RIG-001..013 (RIG-012 waiting-list part left to waiting-list spec GRP-WAI-004..008).
Findings: a superadmin who is not a member of the group opens administration and members pages, but messages and
catalogs pages redirect them to `/` since `canAccessMessages` and `isContractManager` return false without a UserGroup
row, contradicting "holds every right in every group" (RIG-003); CODE-029 rights written before the check but refusal
rolls back, not observable over HTTP (RIG-009); giving rights to a non-member crashes with "Invalid field access : rights"
(error page 200, nothing saved), editing a non-member's rights gives "no user" (RIG-010); editor also offers catalogs that
ended <30 days ago (`getActiveContracts(true)`) (RIG-008); a superadmin isn't added to UserGroup nor counted as member
(RIG-004); a vendor outside the group manages no catalogs on hx pages (RIG-006).
Harness: `actions.groupAdmin.{rightsEditor,giveRights,editRights}`, `views.groupAdmin.rights`, `rightsValues`.

### 02-groups/waiting-list.md -> `waiting-list.forms.spec.ts` (24) + `waiting-list.graphql.spec.ts` (31)
Covered GRP-WAI-001..013 (WAI-013 only as a list type via GraphQL, not the React page).
Findings: refuse mutation also mails every other membership manager, not only the person (WAI-006; mails not awaited,
tests poll `mails.since`); Nest `moveBackToWaitingList` has no duplicate check: for a member who already waits it removes
the membership, overwrites the entry, response fails "Cannot return null for non-nullable field WaitingList.amapId",
DB changes kept, while hx `/member/movetowl` refuses the same case (WAI-007, UND-034); `/member/movetowl/:id` is a plain
GET with no token (WAI-011, CODE-025); move-back message uses `User.getName()` which uppercases ASCII only
("ADHéSIONS Adèle") (WAI-011); visitor redirected to `/group/:id`, flashes lost on the redirect (WAI-001);
`getWaitingListsOfGroup` open to any logged-in user incl. non-members (WAI-004, UND-029).
Harness: `api.waitingList.{of,approve,refuse,moveBack}`, `actions.group.leaveWaitingList`,
`actions.members.moveToWaitingList`.

**02-groups: all 10 spec files done.** Next: full-suite run + coverage refresh.

Full suite after 02-groups: 1275 passed (12.4 min, expected failures included). Coverage 472/709 (02-groups 91/96, 03-catalogs 130/136).

## 08-administration (started)

### 08-administration/admin-dashboard.md + admin-groups.md -> `admin-dashboard.views.spec.ts` (15), `admin-groups.views.spec.ts` (16), `admin-groups.forms.spec.ts` (13)
Covered ADM-DSH-001..006, ADM-GRP-001..005, 008, 009 (web refusal only). Deviation added: UND-109 (two ADM-GRP-002
tests expected failures: injected name lists every group; a name with `"` breaks the SQL).
Deferred: ADM-GRP-006 (UND-025; only raw `/db` tool, no screen); ADM-GRP-007 (group creation form, in 02-groups, geocoding
fails); ADM-GRP-008 dry-run default / explicit minimum ids and DECISION part of UND-108 (command line only); method's own
access-denied guard (UND-109) not observable in hx, redirect to `/` asserted.
Findings: non-numeric zip search crashes "Invalid operation (*)" (`Group.hx:34`) (GRP-002); group search is a GET form with
CSRF token, request without it ends on the error page; `/db` answers 200 but content is an error "Unknown description
'int NOT NULL AUTO_INCREMENT'" (MySQL 8 incompatibility) (DSH-006); sidebar has no theme/superadmin link, only home page
buttons (DSH-004, UND-112); deleting a group removes places, memberships, catalogs, distribution days, users and vendors
stay, call without token or with another session's token deletes nothing (GRP-005); `addMe` inserts
`UserGroup.rights = NULL` not `''` (GRP-004); scripts answer 500 "CLI only" to everyone, no side effect (GRP-008/009);
raw template text (`::foreach`) printed in admin sidebar HTML comments.
Harness: `views.admin.{dashboard,theme,superadmins,database,groups,group}`, `actions.admin.{reloadTheme,addMeToGroup,deleteGroup,runScript}`.

### 08-administration/admin-users.md + announcements.md + theme.md -> `admin-users.{views(16),forms(15)}`, `announcements.forms` (20), `theme.forms` (11)
Covered ADM-USR-001..006, ADM-ANN-001..004, ADM-THM-001..004. Deviations added: UND-101, UND-110, CODE-056 (targets hx+ts).
Deferred: USR-006 install step/migration creating the placeholder (not drivable over HTTP; missing-placeholder behaviour
covered); THM-002 "ignored until reload" (neko-test re-reads theme on every request). USR-004 reattribute already covered under ORD-SBM-010.
Findings: theme save only checks JSON syntax: `null` accepted and breaks every page incl. `/admin/theme`, `{}` accepted and
prints "null" as instance name (THM-001); `GET /admin/user/delete/:id` deletes the account with no token or confirmation
(CSRF), a refusal (recent order, negative balance) redirects exactly like a success, no message (USR-003, UND-022);
emptied announcement message stored as the text "null" and edit form pre-fills "null" (ANN-001/002); self-deletion without
the placeholder fails loudly in GraphQL but the user is logged out and admins mailed anyway (USR-006, CODE-056).
Harness: `views.admin.{themeSettings,messageSettings,usersHome,userSearch,user,userGroup}`, `views.groups.{homeAlerts,chooser}`,
`actions.admin.{setTheme,setMessage,deleteUser}`.

### 08-administration/error-log.md + maintenance-tools.md + maintenance-install.md -> `error-log.views` (12), `error-log.api` (5), `maintenance-tools.views` (5), `maintenance-install.views` (11)
Covered ADM-ERR-001,002,003,005,006,007; ADM-TLS-001; ADM-MNT-001,004,005,007,008; ADM-MNT-002 (refusal on a non-empty DB only).
33 tests, 7 are expected failures. Deviations added: UND-108, UND-116, UND-107.
Not covered: ERR-004 (already COM-JOB-006); ERR-008 (Nest deadlock interceptor can't be provoked); TLS-002/003, MNT-006 (Nest
serves `/mails`, `/files`, `/ping`, `/health` but only `/graphql`, `/neostatic/`, `/locales/` are proxied through the hx
origin); TLS-004/005 are CAT-CDD-007 and ADM-USR-003; TLS-006 (`VendorService.create` has no caller); MNT-002 install on an
empty DB + MNT-003 account it creates (an empty-DB install test was written and run, then removed: it is destructive to
the local test DB, so only the refusal is tested); MNT-009 (SMTP from stored vars is commented-out code); MNT-010 (no
settings screen); MNT-004 folder creation on container disk.
Findings: API error body carries `stack` for service and unexpected errors (ERR-006, UND-116); `GET /admin/errors?empty=1`
empties the table with no token (ERR-003, UND-108); `/install/diagnostics` and `/cssdemo` served to visitors and members
(MNT-004/007, UND-107); in the test container diagnostics log `sys_create_dir` (cannot create folder); from code reading:
`UserGroup.giveRight` returns early for a superadmin so `Install.hx` stores no group rights for the first user (MNT-003),
hx upper-cases the installer's last name (MNT-002).
Harness: `api.platform.unexpectedFailure`, `views.admin.{errors,emails}`, `views.platform.*`,
`actions.admin.{purgeErrors,resetMailTries}`, `actions.install.run`.

**08-administration: all 8 spec files done.**

## 09-navigation (started)

### 09-navigation/group-selection.md + home.md -> `group-selection.views.spec.ts` (14), `home.views.spec.ts` (12)
Covered NAV-SEL-001..006, NAV-HOM-001,002,004,006,008,009. Covered by other tests but NOT tagged with the NAV id (coverage
report shows them uncovered; add the tags if wanted): NAV-SEL-007 (ADM-ANN-003), NAV-HOM-003 (GRP-DSB-001), NAV-HOM-005
(ADM-ANN-001/002), NAV-HOM-007 (ADM-MNT-001).
Not observable: SEL-001 "pending order cleared" (`session.data.order` never set in hx) and "new-group flag cleared" (group
creation can't complete, Mapbox).
Findings: a superadmin choosing a group they don't belong to opens group admin, settings and rights (200) but the catalog
admin list redirects to `/` (`canManageAllContracts` checks membership): not "full rights everywhere" (SEL-002); in the test
stack the logout redirect chain never clears cookies (`Domain=localhost:8180` is invalid so the jar ignores the delete),
test follows redirects by hand to the login page (HOM-009).
Harness: `views.groups.{homeOpenOrders}`, `chooser.offersVendorWidget`, `views.platform.unknownPath`,
`actions.group.{select({redirect}),forgetAfterQuit}`, `auth.endPlatformSession` (hx/index.ts: sets `Session.uid` NULL).

### 09-navigation/language.md + theme-layout.md -> `language-theme.views.spec.ts` (13, 2 expected failures)
Covered NAV-LNG-001,003,004,005; NAV-THM-001,002,003,006,008. Deviation added: UND-118 (hx). Deferred: LNG-002 (code
structure), THM-004 (anti double click, JS), THM-005 (date picker widget), THM-007 (needs Nest down), THM-009 (property of the TS
port). THM-003 only the ToS link (the other three links are used by no hx page); THM-008 only "pages load the neostatic bundles".
Findings: `GET /account?lang=<anything>` stores the value in `User.lang`, pages stay French, no language link (LNG-003, UND-118);
Nest emails ignore the saved theme, always the default email footer (THM-002, UND-101); invite email sender is the acting
membership manager, not the theme's `senderEmail`; password reset email title is French "CAMAP : Changement de mot de passe" (LNG-004).
Harness: `PageLayout`, `views.platform.{layout,translations,accountLanguage}`, `views.groupAdmin.settingsEditor`.

**09-navigation: all 4 spec files done.**

## Remainder pass (uncovered IDs per domain)

### 01-accounts remainder -> 6 new files in `specs/01-accounts/` (30 tests)
`sessions-tokens.graphql` (11: SES-001,004,005,008, LOG-007,009,010,011,012, OUT-003), `sessions.cron` (1: SES-002),
`registration-invitations.graphql` (8: REG-003,007,010,012, INV-001,004,006, PWD-010), `account-views.views` (6: IMP-003,
NOT-005, PRO-006 under existing UND-118 deviation, PRO-009), `profile-widgets.api` (3: PRO-008, PRO-011 myGroups only),
`account-deletion.forms` (2: DEL-009). Some overlap with existing tests in other domains (IMP-003, NOT-005, PRO-009, DEL-009, INV-001).
Not testable: ACC-PUR-001..007 (purge is only Nest's `@Cron` 01:00 `cleanUsers` on the real clock, no HTTP trigger, hx
`/cron/daily` doesn't call it, libfaketime covers Neko only: candidate to test directly on the TS target); SES-007 (dev
Nest drops HttpOnly); SES-009 (cookie domain is a deployment/browser matter); partly SES-008 (blacklisted-IP part has no
entry point), SES-004 (visible "logged state sync" message is internal).
Findings: a reset trims the password but login doesn't, so a password with edge spaces set through a reset only logs in
trimmed (REG-010); register adds the user to a Closed group through `invitedGroupId` (REG-012/INV-004); server doesn't
enforce required phone/address (REG-003); anyone can read a manager's invited data with `getInvitedUserToRegister(email)`
(INV-006, security); refused admin deletion redirects silently (DEL-009); login with the secondary email doesn't switch the
greeting to the second person (LOG-011).
Harness: `api.users.{me,updateContact}`, `actions.account.logout`, `auth.tamper(request, 'dropAccessToken'|'invalidateTokens'|'desyncSession')`.

### 2026-11-04: remainder pass, status before 05..09
Coverage refreshed: **588 / 709** (82.9 %), 1525 tests. 04-distributions remainder was done earlier
(80/88 covered) without an entry here. Still uncovered: 01 9, 02 5, 03 6, 04 8, 05 31, 06 17, 07 23, 08 13, 09 9.
Plan agreed with the user: one sonnet 5.5 agent per domain, sequential, order 05 → 06 → 07 → 08 → 09 → 02+03+04,
each briefed with `TEST-WRITING-BRIEF.md` and the domain's uncovered IDs from `tests/reports/spec-coverage.md`.

### 05-orders remainder -> `order-dialog.api` (22), `order-pages.views` (8), `subscription-rules.api` (15)
All 31 uncovered IDs now tagged (agent report; green on hx, tsc clean). Weak coverage (JS-side logic recomputed from server
data): ADO-001, ADO-011, SBM-011, OPL-011, SUB-001, MIN-004. Added `@ORD-ADO-005` to 2 tests in `order-placement.api`.
Findings: hx never sends the order summary mail (`sendOrderSummaryToMembers` has no caller, HIS-008); `/contractAdmin/tmpBaskets`
crashes once an OPEN basket exists (`Basket.hx:231`, BSK-003); absence count rule skipped at creation so admin mode is moot
(ABS-011); dialog answers success while the stock clamp saves a limited line (ADO-006); member stock error rolls the line back
instead of limiting it, dialog clamp is stock×qt (OPL-007, CODE-040); subscription orders leave `Basket.total` 0 (BSK-005);
batch-order page needs only coordinator of any catalog (ADO-001/011).
Harness: `api.users.fromGroup`, `api.catalog.subscriptionsOf`, `views.orders.{distributionOrders,legacyVarOrdersPage,temporaryBaskets,batchOrder}`,
`views.shop.productInfo`, `views.subscriptions.{subscriptionPage,sharedBasketTurns}`, `actions.orders.deleteLine`; factory `userOrder.feesRate`.
Deviations added: UND-085, UND-077, UND-067.

### 06-payments remainder -> `operation-mutations.graphql` (8), `payment-service.forms` (11), `order-operations.api` (4), `subscription-balance.api` (2), `reports-vat.views` (5), `exports-data.graphql` (3)
15 / 17 IDs covered (agent report; green on hx, tsc clean). Tags added: PAY-OPE-007 on the GRP-COT-007 test
(`membership.graphql`), PAY-OPE-008 on the ORD-BTR-001 test (`subscription-admin.forms`).
Deferred: PAY-TYP-005 (payment context has no caller anywhere), PAY-RPT-008 (`getOrdersByVAT` unused, no TS turnover query).
Partial: ENT-012/013 (on-the-spot add path unreachable over HTTP), RPT-011/012 (GraphQL data only; CSV built in browser),
TYP-004 (group creation rolls back on the test stack), TYP-009 (no `/transaction/` link only).
Findings: `validateOperation`/`deleteOperation` accept a single-catalog coordinator (ENT-011); `createMembership` stores
10.006 unrounded (OPE-006/ENT-013, UND-089); hx writes the "Order for <date>" debt only on coordinator price change or product
removal, not when a member orders (OPE-003); any member can read the group's full contact list (RPT-011, UND-029);
buggy `getMultiDistribVendorOrdersByProduct` only used by commented-out code (RPT-009).
Harness: `api.operations.{validate,delete}`, `paymentSettings.links`. Deviation added: UND-088.

### 07-communication remainder -> `mail-delivery.cron` (11, slow: real Nest flush → mailpit, ~11 min), `mail-content.cron` (13), `scheduled-cleanup.cron` (5), `message-recipients.graphql` (3)
Covered: EML-001..010, NTF-006, AUT-003, AUT-004, JOB-005, JOB-008, MSG-003 (agent report; green on hx, tsc clean).
Deferred: MSG-009, JOB-009, JOB-010 (Nest `@Cron` at real midnight/01:00, no endpoint, fake clock is Neko-only);
JOB-001, 003, 011, 012 (schedule/config/replicas; stack runs with `HX_TRIGGER_CRONS` unset).
Findings: `users.resolver.ts:105` doesn't await `canManageMessages`, so any logged-in user reads the emails of any group's
members (MSG-003, security, deviation `FINDING-MSG-RECIPIENTS`); stored group-contact address replaced by platform address,
only name + Reply-To kept (EML-007, UND-100); reminder subject follows member language but volunteer alert always French
(NTF-006, UND-104); Nest twig layout emits unquoted `camap=""` attribute on footer logo; rejected recipients kept with tries+1 (EML-005).
Harness: `src/mailpit.ts` (`mark`, `since`, `waitFor`), `make.queuedMail`, `make.user({lang})`. Deviation added: FINDING-MSG-RECIPIENTS (UND-101 reused).

### 08-administration remainder -> `group-lifecycle.forms` (8), `install.forms` (4), `platform-settings.views` (4), `platform-settings.graphql` (1)
Covered: ADM-GRP-006, 007, MNT-003, 009, 010, TLS-006 (+ extra tags GRP-CRE-001..005, ADM-MNT-002). Tags added: ADM-ERR-004 on
COM-JOB-006, ADM-TLS-004 on CAT-CDD-007, ADM-TLS-005 on ADM-USR-003, ADM-MNT-006 (hx half) on ADM-MNT-005.
Deferred: ADM-TLS-002/003 and Nest half of MNT-006 (Nest-only routes, not proxied through hx origin; needs a published nest port
or a proxy rule = stack change, to decide), ADM-ERR-008 (deadlock not provokable).
Findings: group creation failure was a harness gap (hx calls real api.mapbox.com with token "test" → rollback), fixed with a
curl stub; disabling a group is only possible through the raw `/db/Group` tool (GRP-006); superadmin creator gets NULL rights,
`giveRight` returns early (GRP-CRE-002); install upper-cases the last name (MNT-003); hx reads `smtp_*` only in commented code
(MNT-009); BlackListGuard unused (TLS-006).
Harness: `tests/stack/curl-stub.sh` + COPY in `neko-test.Dockerfile` (Mapbox stub; was docker-cp'd into the running container,
needs image rebuild), `actions.admin.editGroupColumnInDatabaseTool`, `views.platform.analyticsId`. `group-creation.forms` updated.
Stub made permanent 2026-11-06: neko-test image rebuilt and container recreated; 00-stack + group-creation + group-lifecycle green (26). Note: a plain `compose build neko-test` also tries to rebuild neko-base and fails on the flaky Haxe build, but the tagged images were still updated.

### 09-navigation remainder -> `form-widgets.ui` (5 browser tests), `platform-pages.views` (4)
All 9 IDs tagged (agent report; green on hx, tsc clean). New: THM-004, THM-005, LNG-002, THM-007 (partial: bundles = manifest
only, Nest-down behaviour untestable without stopping the stack), THM-009. Tags added: SEL-007 on ADM-ANN-003, HOM-003 on
GRP-DSB-001, HOM-005 on 2 ADM-ANN tests, HOM-007 on 2 ADM-MNT-001 tests. Not testable: birth-date picker (no such field left),
"no hard-coded text" (code property).
Findings: GET `/graphql` with Accept text/html serves GraphQL Playground when NODE_ENV≠production (`app.module.ts:47`);
date picker is a text field + popper, no native date input.
Harness: `platform.layout({ask})` → `interfaceLanguage`, `platform.widgetManifest`, `platform.assetFolder`; page objects `layout`, `dateForm`.

### 02/03/04 remainder -> `04-distributions/{volunteers-calendar.api (4), attendance-export.graphql (2), attendance-options.ui (2)}`
New: DIS-VOL-009 (UND-060 kept as is), VOL-012, ATT-008 (header data only; file built in browser), ATT-009 (localStorage).
Tags added: GRP-SET-011 on GRP-COT-001 tests, CAT-VDB-004 on 2 vendors.graphql tests, DIS-ROL-003 on CAT-CCR-008, DIS-ROL-006
on CAT-CDD-005, DIS-VOL-001 on the calendar test (4-month window is client-side), DIS-MDS-011 on attendance.views.
Deferred: GRP-DSB-005 / CAT-VEN-009 (decided disable action doesn't exist yet), CAT-DOC-011 (Nest-only `/files/*`, not proxied),
CAT-PLC-008 (browser-side Mapbox in camap-ts), CAT-PPR-003 (VAT sync widget is dead code in hx), CAT-VEN-011 (no `Vendor.tosVersion`
column, no writer).
Risk flagged: `03-catalogs/vendors.forms.spec.ts` "fails on the map location" tests likely stale since the Mapbox stub → full run.
Harness: `attendanceSheetHeader`, page object `attendanceSheet`.
2026-11-06: full suite run started to check for regressions from the Mapbox stub.

### 2026-11-06: full run after the remainder pass
Full suite on hx: 1657 passed, 14 failed (1.2 h). Fixed:
- 7 tests in `03-catalogs/places.forms` and `vendors.forms` assumed geocoding always fails. Rewritten against the Mapbox stub:
  success → stub point, `NOWHERE` address → failure path. Characterisation correction: when the address changes, hx geocodes
  and **overwrites coordinates typed in the place form** (`controller/Place.hx:49-55`); the old test only passed because
  geocoding failed.
- 2 tests in `03-catalogs/documents-files.views` picked a file id up to ~800M from `Date.now()`; sugoi caches signatures in a
  Neko array indexed by id (`sugoi/db/File.hx:34`, max_array_size ~2^29), so they failed depending on the time of day. Range narrowed.
- 5 failures did not reproduce in isolation (password-reset PWD-008/009, mail-delivery EML-005 partial rejects and EML-008 sender,
  ADM-DSH-006 db tool, ADM-TLS-001 unsent emails): order/timing-dependent in long runs, likely the real Nest mail flush. To watch.
README: new "The Mapbox stub" section. Stale comments updated (group-selection, vendors.graphql).

**Coverage: 682 / 709 (96.2 %), 1675 tests.** Remaining 27, all with a recorded reason above: Nest-only crons on real time
(ACC-PUR-001..007, COM-MSG-009, COM-JOB-009/010), schedule/config/replicas (COM-JOB-001/003/011/012), Nest-only REST routes not
proxied (ADM-TLS-002/003, CAT-DOC-011), no implementation to test (GRP-DSB-005, CAT-VEN-009, CAT-VEN-011, CAT-PPR-003,
PAY-TYP-005, PAY-RPT-008), browser/cookie/deployment (ACC-SES-007/009, CAT-PLC-008), deadlock (ADM-ERR-008).
Open decision for the user: proxy Nest-only REST routes (or publish the nest-test port) to reach ADM-TLS-002/003, CAT-DOC-011.
Next: commit the harness and tests (user pushes); triage the findings into docs/inconsistencies-code.md / UNDECIDED.md.
