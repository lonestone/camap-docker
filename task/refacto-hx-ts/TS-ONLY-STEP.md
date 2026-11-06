# The TS-only step

The specs in [specs/](specs/README.md) describe CAMAP as it runs now, with `camap-hx` and `camap-ts` cooperating on one database. This file holds what happens only **when Haxe is ported to TS and removed**. These are things that have no meaning in the current system, or that the product owner chose to do only at the port.

Rules:
- Nothing here changes the behaviour of the current system, and nothing here is tested by the characterisation suite as it runs today.
- When a spec statement or a decision touches the TS-only step, it points here and keeps describing today's system.
- Section 1 holds decisions. Section 2 records what is removed now and so has nothing to port. Section 3 is a list of points to look at again; nothing in it is decided.

## 1. Decisions applied at the port

### UND-118: French text, translation files and language parameter
Statements: [NAV-LNG-002 to NAV-LNG-005](specs/09-navigation/language.md), [ACC-PRO-006](specs/01-accounts/profile.md), [COM-EML-010](specs/07-communication/emails.md).

- The interface and emails stay in French only. There is no multi-language support.
- When a Haxe page, form or email is ported, all of its hard-coded text goes into the TS translation files. In the TS-only system, no text shown to a user is hard-coded.
- The hidden `?lang=` parameter of the Haxe account page, which stores a language on the user, is not ported (`camap-hx/src/controller/Account.hx:34-51`). There is no language selection in TS.
- The rich-text editor of forms (NAV-LNG-005) is in French in the ported forms.

### UND-104: subjects and dates of automatic emails
Statement: [COM-NTF-006](specs/07-communication/order-notifications.md).

- Automatic emails stay in French (UND-118): the "user language" option of UND-104 is not applied.
- When the Haxe cron emails (volunteer alerts and the others) are ported, their hard-coded subjects and date texts go into the TS translation files, like every other string.

### UND-119: pages no longer depend on the widget bundle list
Statement: [NAV-THM-007](specs/09-navigation/theme-layout.md).

- Today every Haxe page loads the list of TS widget bundles and fails when it cannot. The current system keeps this behaviour.
- The dependency goes away with the Haxe pages: TS pages do not load a separate list of widget bundles, so there is nothing to cache or degrade.

### UND-113: one version number
Statements: [ADM-MNT-005, ADM-MNT-006](specs/08-administration/maintenance-install.md).

- Today the Haxe ping has a hard-coded version and the TS endpoints read an environment variable. The current system gets one build-time version through both ping endpoints (UND-113).
- The Haxe ping disappears with the port: only the TS `/ping` and `/health` remain, with the build-time version. There is nothing to port.

### UND-101: TS reads the saved white-label theme (deferred 2026-11-06)
Statements: [COM-EML-008](specs/07-communication/emails.md), [ADM-THM-003](specs/08-administration/theme.md), [NAV-THM-002](specs/09-navigation/theme-layout.md).

- The decision stands (TS reads the white-label theme saved by the superadmin, falls back to the default, clears its cache on save; colors stay on the built-in palette), but the product owner chose to apply it only at the port.
- Until then the current system keeps today's behaviour: Nest `VariableService.getTheme()` returns the default theme, cached forever, so TS emails ignore the saved theme (`camap-ts/packages/api-core/src/tools/variable.service.ts:61-72`, CODE-104).
- The test stays an expected failure on the hx stack (deviation `UND-101`, target `hx` only) and must pass on the TS target.

### UND-088: one subscription balance formula in TS (deferred 2026-11-06)
Statements: [PAY-BAL-007, PAY-BAL-008](specs/06-payments/balances.md), [ORD-AMT-003](specs/05-orders/order-amounts.md).

- The decision stands (every screen shows payments minus the subscription total, rounded to cents, as Haxe computes it), but it is applied only at the port.
- Until then the current system keeps today's behaviour: the TS field `CsaSubscription.balance` used by the attendance sheet sums every operation of the subscription, unrounded, and the TS service subtracts without rounding (`camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:17-35`, `groups/services/csa-subscriptions.service.ts:104-137`, CODE-102).
- When porting the balance, use the Haxe formula (`camap-hx/src/db/Subscription.hx:23-67`). The test stays an expected failure on the hx stack (deviation `UND-088`, target `hx` only) and must pass on the TS target.

The other decided fixes that are missing from both apps are done **before** the migration: see [PRE-MIGRATION-TASKS.md](PRE-MIGRATION-TASKS.md).

## 2. Removed in the current system, so nothing to port

These features are removed from today's system by a decision. There is no TS counterpart to build.

| Feature | Decision | Statements |
|---|---|---|
| Temporary baskets: create, confirm and read functions, and the coordinator page | UND-077 | [ORD-BSK-003, ORD-BSK-004](specs/05-orders/baskets.md) |
| Legacy shop-mode order edit page | UND-085 | [ORD-ADO-010](specs/05-orders/admin-orders.md) |
| `/cssdemo` style-guide page | UND-107 | [ADM-MNT-007](specs/08-administration/maintenance-install.md) |
| Unused `link` field of payment types (docLink stays) | UND-092 | [payment-types.md](specs/06-payments/payment-types.md) |

Work wanted only after the migration (not part of the port) is listed in [POST-MIGRATION-TASKS.md](POST-MIGRATION-TASKS.md).

## 3. Hybrid mechanisms to look at again (not decided)

These behaviours exist, or were decided, because two apps share the database. Once Haxe is gone their reason may disappear. Each one needs a product or technical decision at that time. Until then the specs and their decisions apply as written.

| Mechanism | Today | Specs |
|---|---|---|
| Bridge user deletion | The old back-office deletes users through a `/bridge` POST on TS (UND-022). | [ADM-TLS-005](specs/08-administration/maintenance-tools.md), [ACC-DEL-009](specs/01-accounts/account-deletion.md) |
| Job trigger over HTTP | TS calls the Haxe job endpoints with a shared key; `HX_TRIGGER_CRONS` turns this off (UND-097). | [COM-JOB-001 to COM-JOB-003](specs/07-communication/scheduled-jobs.md) |
| Session rows shared with Haxe | TS login now creates the session row when Haxe has not (UND-021). The session table is still shared and written by both apps; its shape and lifetime may change once Haxe sessions are gone. | [ACC-LOG-001, ACC-LOG-012](specs/01-accounts/login.md) |
| Two password hashes | Haxe writes the legacy md5 hash and TS writes the bcrypt hash; a reset clears the bcrypt hash (UND-007). | [ACC-PWD-009](specs/01-accounts/password-reset.md), [ACC-LOG-001](specs/01-accounts/login.md) |
| Dead "validated" state | Kept only for Haxe and database compatibility (UND-057). | [DIS-OWS-005](specs/04-distributions/order-window-state.md), [ORD-BSK-006](specs/05-orders/baskets.md) |
| TS screens embedded in Haxe pages | Interactive screens are mounted inside Haxe pages and handle their own addresses; there is no screen outside these pages. In the TS-only system TS provides the whole app shell. | [NAV-THM-008, NAV-THM-009](specs/09-navigation/theme-layout.md), [NAV-SEL-003](specs/09-navigation/group-selection.md) |
| Paris wall-clock dates | Dates stay stored as Paris wall-clock because both apps read and write them (UND-055). | [DIS-MDS-012](specs/04-distributions/multidistrib-schedule.md) |
