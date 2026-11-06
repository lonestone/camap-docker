# CAMAP functional specifications

Functional specifications of CAMAP (French AMAP / CSA management app), written from the user point of view.
They describe WHAT a user can do and observe, for use as the base of user stories and tests during the Haxe (`camap-hx`) to TypeScript (`camap-ts`) migration.

## Scope: the current Haxe + TS system

The specs describe CAMAP **as it runs now**: `camap-hx` and `camap-ts` cooperating on one database, with Haxe pages that embed TS screens, the bridge between the two apps and the jobs triggered over HTTP.

- A statement, an erratum or a decision applies to this current system. A decision that changes behaviour is a change to make in whichever app owns the behaviour today, Haxe or TS.
- The characterisation tests built on these specs run against this system.
- What only happens once Haxe is gone (porting a Haxe page, removing a hybrid mechanism, the TS-only end state) is **not** written here. It is in [TS-ONLY-STEP.md](../TS-ONLY-STEP.md). A statement may point to that file, but never describes the TS-only state as if it were today's.

Source: the verified documentation in `../docs/` (mainly `../docs/03-features/*.md`). Every statement carries its source in an invisible HTML comment.

## Conventions

- One statement per line, with a stable ID: `**ACC-REG-001** As a visitor, I can ...`
- Details are indented sub-bullets under the statement. They are short and affirmative.
- The source is an HTML comment at the end of the statement line, for example `<!-- 03-features/users-auth.md R5; camap-hx/src/db/User.hx:57 -->`. `R12` is rule 12 of the feature file; `F5.3` is flow 5.3; `S3.1` is the routes table.
- The visible text never names classes or functions.
- Only facts established by the docs with certainty are written (cited rules, items tagged CONFIRMED). Everything else is skipped or turned into an Undecided.
- IDs never change once written. A removed statement leaves a gap.

### Undecided statements

When the current code is contentious, the statement is still written, marked like this:

`- **ORD-ABS-004** *Undecided (UND-012)*: As a member, I can declare absences until the order window closes.`

The statement describes the presumably intended behavior. `UNDECIDED.md` records the current behavior, the question and the options.
Contentious means: Haxe and TS differ, two code paths disagree, the behavior looks like a bug or a security hole, docs contradict code, the feature is dead or half-built, or a hard-coded value looks temporary.

### Actors

| Actor | Meaning |
|---|---|
| visitor | Not logged in |
| logged-in user | Has an account and is logged in, in any group or none |
| member | Member of the current group |
| catalog coordinator | Member with the right to manage one catalog, or all catalogs (called "référent" in the UI) |
| membership manager | Member with the right to manage members and memberships |
| messages manager | Member with the right to send group messages |
| group admin | Member with the group administration right |
| vendor | A producer who has claimed their vendor record |
| superadmin | Site-wide administrator |
| the system | Crons and automatic emails |

Rights do not imply each other: a group admin does not automatically have the membership, messages or catalog rights. A superadmin has every right in every group.

### ID scheme

`<DOMAIN>-<FEATURE>-NNN`. Domain codes: ACC, GRP, CAT, DIS, ORD, PAY, COM, ADM, NAV.

Feature codes are listed in the index below, next to each file.

## Index


Totals: 709 statements, 162 of them marked Undecided, 121 distinct points in [UNDECIDED.md](UNDECIDED.md).

### 01-accounts (ACC)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [account-deletion.md](01-accounts/account-deletion.md) | DEL | 9 | 2 | Account deletion |
| [impersonation.md](01-accounts/impersonation.md) | IMP | 4 | 1 | Log in as a member |
| [inactive-purge.md](01-accounts/inactive-purge.md) | PUR | 7 | 2 | Inactive account purge |
| [invitations.md](01-accounts/invitations.md) | INV | 6 | 3 | Invitations |
| [login.md](01-accounts/login.md) | LOG | 12 | 4 | Login |
| [logout.md](01-accounts/logout.md) | OUT | 3 | 1 | Logout |
| [notifications.md](01-accounts/notifications.md) | NOT | 5 | 0 | Email notification preferences |
| [password-reset.md](01-accounts/password-reset.md) | PWD | 12 | 3 | Password reset and password definition |
| [profile.md](01-accounts/profile.md) | PRO | 11 | 2 | Profile and account page |
| [registration.md](01-accounts/registration.md) | REG | 12 | 6 | Registration |
| [sessions-tokens.md](01-accounts/sessions-tokens.md) | SES | 9 | 2 | Sessions and login state |
| **Total ACC** | | **90** | **26** | |

### 02-groups (GRP)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [group-creation.md](02-groups/group-creation.md) | CRE | 7 | 1 | Group creation |
| [group-disabled.md](02-groups/group-disabled.md) | DSB | 5 | 1 | Disabled groups |
| [group-public-page.md](02-groups/group-public-page.md) | PUB | 7 | 1 | Public group pages and map |
| [group-settings.md](02-groups/group-settings.md) | SET | 11 | 1 | Group settings |
| [join-quit.md](02-groups/join-quit.md) | JOI | 10 | 2 | Joining and quitting a group |
| [members-import.md](02-groups/members-import.md) | IMP | 5 | 0 | Adding members by import |
| [members.md](02-groups/members.md) | MEM | 10 | 4 | Members list and member sheet |
| [membership.md](02-groups/membership.md) | COT | 15 | 4 | Membership fee, cotisation |
| [rights.md](02-groups/rights.md) | RIG | 13 | 5 | Group rights |
| [waiting-list.md](02-groups/waiting-list.md) | WAI | 13 | 2 | Waiting list |
| **Total GRP** | | **96** | **21** | |

### 03-catalogs (CAT)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [catalog-absences-settings.md](03-catalogs/catalog-absences-settings.md) | CAB | 6 | 0 | Absence rules of a catalog |
| [catalog-creation.md](03-catalogs/catalog-creation.md) | CCR | 14 | 1 | Catalog creation |
| [catalog-duplicate-delete.md](03-catalogs/catalog-duplicate-delete.md) | CDD | 7 | 1 | Duplicate and delete a catalog |
| [catalog-edit.md](03-catalogs/catalog-edit.md) | CED | 13 | 2 | Catalog settings |
| [catalog-list-view.md](03-catalogs/catalog-list-view.md) | CLV | 10 | 2 | Catalog list, dashboard and visibility |
| [documents-files.md](03-catalogs/documents-files.md) | DOC | 12 | 3 | Documents, images and files |
| [places.md](03-catalogs/places.md) | PLC | 10 | 4 | Places |
| [product-csv.md](03-catalogs/product-csv.md) | PCS | 2 | 1 | Product CSV import and export |
| [product-pricing.md](03-catalogs/product-pricing.md) | PPR | 5 | 1 | Prices, VAT and fees |
| [products.md](03-catalogs/products.md) | PRD | 18 | 4 | Products |
| [stock.md](03-catalogs/stock.md) | STK | 13 | 0 | Stock management |
| [vendor-claim.md](03-catalogs/vendor-claim.md) | VCL | 7 | 1 | Claiming a vendor record |
| [vendor-pages.md](03-catalogs/vendor-pages.md) | VDB | 6 | 0 | Vendor public page and dashboard |
| [vendors.md](03-catalogs/vendors.md) | VEN | 13 | 4 | Vendors |
| **Total CAT** | | **136** | **24** | |

### 04-distributions (DIS)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [attendance-sheets.md](04-distributions/attendance-sheets.md) | ATT | 11 | 2 | Attendance sheets and exports |
| [cycles.md](04-distributions/cycles.md) | CYC | 9 | 2 | Distribution cycles |
| [distribution-participation.md](04-distributions/distribution-participation.md) | PAR | 14 | 2 | Catalog participation in a session |
| [multidistrib-schedule.md](04-distributions/multidistrib-schedule.md) | MDS | 15 | 4 | Distribution sessions: create, edit, delete |
| [order-window-state.md](04-distributions/order-window-state.md) | OWS | 8 | 1 | Order window state |
| [volunteer-reminders.md](04-distributions/volunteer-reminders.md) | VRM | 5 | 0 | Volunteer reminder emails |
| [volunteer-roles.md](04-distributions/volunteer-roles.md) | ROL | 11 | 2 | Volunteer roles and duty settings |
| [volunteers.md](04-distributions/volunteers.md) | VOL | 15 | 4 | Volunteer registration and calendar |
| **Total DIS** | | **88** | **17** | |

### 05-orders (ORD)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [absences.md](05-orders/absences.md) | ABS | 11 | 2 | Absences |
| [admin-orders.md](05-orders/admin-orders.md) | ADO | 11 | 3 | Orders entered by coordinators |
| [balance-transfer.md](05-orders/balance-transfer.md) | BTR | 5 | 2 | Balance transfer between subscriptions |
| [baskets.md](05-orders/baskets.md) | BSK | 6 | 4 | Baskets |
| [constant-orders.md](05-orders/constant-orders.md) | CST | 6 | 1 | Constant orders |
| [order-amounts.md](05-orders/order-amounts.md) | AMT | 6 | 1 | Order amounts and balances |
| [order-history.md](05-orders/order-history.md) | HIS | 8 | 2 | My orders and history |
| [order-minimums.md](05-orders/order-minimums.md) | MIN | 7 | 1 | Minimum order amounts |
| [order-placement.md](05-orders/order-placement.md) | OPL | 15 | 3 | Placing and editing orders |
| [subscription-admin.md](05-orders/subscription-admin.md) | SBM | 13 | 1 | Subscription management by coordinators |
| [subscription-create.md](05-orders/subscription-create.md) | SUB | 18 | 4 | Subscribing to a catalog |
| [variable-orders.md](05-orders/variable-orders.md) | VAR | 6 | 2 | Variable orders and default orders |
| **Total ORD** | | **112** | **26** | |

### 06-payments (PAY)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [balances.md](06-payments/balances.md) | BAL | 8 | 2 | Balances |
| [operations.md](06-payments/operations.md) | OPE | 9 | 1 | Operations: debts and payments |
| [payment-entry.md](06-payments/payment-entry.md) | ENT | 13 | 5 | Recording and editing payments |
| [payment-types.md](06-payments/payment-types.md) | TYP | 9 | 2 | Payment types and group payment settings |
| [reports-exports.md](06-payments/reports-exports.md) | RPT | 13 | 2 | Reports and exports |
| **Total PAY** | | **52** | **12** | |

### 07-communication (COM)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [automatic-emails.md](07-communication/automatic-emails.md) | AUT | 5 | 2 | Automatic emails overview |
| [digests.md](07-communication/digests.md) | DGT | 5 | 0 | Digest emails |
| [emails.md](07-communication/emails.md) | EML | 10 | 2 | Email sending |
| [group-messages.md](07-communication/group-messages.md) | MSG | 11 | 3 | Group messages |
| [order-notifications.md](07-communication/order-notifications.md) | NTF | 8 | 2 | Order reminders and recaps |
| [scheduled-jobs.md](07-communication/scheduled-jobs.md) | JOB | 13 | 5 | Scheduled jobs |
| **Total COM** | | **52** | **14** | |

### 08-administration (ADM)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [admin-dashboard.md](08-administration/admin-dashboard.md) | DSH | 6 | 2 | Back-office access and home |
| [admin-groups.md](08-administration/admin-groups.md) | GRP | 9 | 3 | Group administration by superadmin |
| [admin-users.md](08-administration/admin-users.md) | USR | 6 | 1 | User administration |
| [announcements.md](08-administration/announcements.md) | ANN | 4 | 0 | Announcements |
| [error-log.md](08-administration/error-log.md) | ERR | 8 | 2 | Error log |
| [maintenance-install.md](08-administration/maintenance-install.md) | MNT | 10 | 6 | Maintenance mode, installation and diagnostics |
| [maintenance-tools.md](08-administration/maintenance-tools.md) | TLS | 6 | 1 | Maintenance tools |
| [theme.md](08-administration/theme.md) | THM | 4 | 1 | Theme and branding |
| **Total ADM** | | **53** | **16** | |

### 09-navigation (NAV)

| File | Code | Statements | Undecided | Title |
|---|---|---|---|---|
| [group-selection.md](09-navigation/group-selection.md) | SEL | 7 | 1 | Choosing the current group |
| [home.md](09-navigation/home.md) | HOM | 9 | 0 | Home page |
| [language.md](09-navigation/language.md) | LNG | 5 | 1 | Language |
| [theme-layout.md](09-navigation/theme-layout.md) | THM | 9 | 2 | Theme and page layout |
| **Total NAV** | | **30** | **4** | |

## Coverage notes

- Source notation in the HTML comments: `R<n>` = business rule n, `F<n>` / `F5.3` = flow, `S<n>` = routes table or section, `CODE-nnn` = entry in `../docs/inconsistencies-code.md`. File paths are relative to the `camap-docker` root.
- The source docs describe no menu or navigation bar content, so 09-navigation covers home, group selection, language and theme only.
- Cross-domain features are written once and referenced elsewhere by ID (for example the waiting list is in 02-groups, the absences of subscriptions are in 05-orders, with the catalog-side absence rules in 03-catalogs).
- Statements marked *Undecided* describe the presumably intended behavior. The current behavior and the question are in UNDECIDED.md.

## Errata

A sub-bullet `- **ERRATUM** …` under a statement means that the code today does **not** behave as the statement says, or only partly. Each erratum cites the code file and the matching entry in `docs/inconsistencies-code.md` (CODE-NNN). The statement stays as the presumably intended behavior. 42 errata were added in a first pass that cross-checked the High and Medium code inconsistencies against the statements' sources. Low-severity inconsistencies, and statements whose sources do not overlap the evidence lines, were not checked.

## Suggestions

Every statement marked *Undecided* has a sub-bullet `- **SUGGESTION** …`: a proposed resolution, written after checking the code on both sides. Each one cites the code place it is based on (`Based on: path:line`) and gives a confidence (high / medium / low; low means product input is needed). Statements that share a UND id share the same suggestion. `UNDECIDED.md` repeats each suggestion in short form in its last column. These are proposals, not decisions. Counts: 162 statements, 121 UND ids; confidence high       83, medium       73, low        6 (per statement).

A French summary, with a short context for each point, is in [UNDECIDED-suggestions.fr.md](UNDECIDED-suggestions.fr.md): the points still open, then the decisions that patch a security risk and those that fix a bug.

## Decisions

When the product owner settles a point, the statements concerned lose their *Undecided* marker and are rewritten to the decided behavior, with a `- **DECISION (UND-NNN, date)** …` sub-bullet. The entry in `UNDECIDED.md` is marked **DECIDED** with a **Decision** line, and both summary tables say so. Points affected by a decision get an `IMPACT OF UND-NNN` note.

Decided so far:
- UND-001 (2026-11-06): current behaviour kept; no confirmation email and no email verification at registration.
- UND-002 (2026-11-06): Haxe behaviour kept and applied in TS; email stored lower case, last name stored upper case, on every save.
- UND-003 (2026-11-06): suggestion accepted; the server enforces the group's phone and address requirement at registration.
- UND-004 (2026-11-06): suggestion accepted; the API enforces the 8-character password minimum and never accepts an empty password, imports get no usable hash.
- UND-005 (2026-11-06): suggestion accepted; passwords are never trimmed, the Haxe trim is removed.
- UND-006 (2026-11-06): suggestion accepted; registration joins the group only if it is open or a valid invitation exists for the email.
- UND-007 (2026-11-06): suggestion accepted; a password reset clears pass2 so the old password stops working at once.
- UND-008 (2026-11-06): suggestion accepted; the server counts failed logins itself and reads the IP header in lower case.
- UND-009 (2026-11-06): suggestion accepted; the password reset token and user id are verified on submit.
- UND-010 (2026-11-06): Haxe behaviour kept; log-in-as is for superadmins or the group manager of a single-group non-admin member, check awaited in TS.
- UND-011 (2026-11-06): suggestion accepted; password reset links use https and last 24 hours, single use.
- UND-012 (2026-11-06): suggestion accepted; changing the login email requires the current password, no verification mail for now.
- UND-013 (2026-11-06): suggestion accepted; the 18-year minimum age rule is dropped, birth date stays optional.
- UND-014 (2026-11-06): suggestion accepted; TS login records which household person logged in, and no language is copied into the session.
- UND-015 (2026-11-06): suggestion accepted; account deletion stops with an error when it cannot proceed, with no logout and no admin email; fixed before the migration.
- UND-016 (2026-11-06): current behaviour kept; inactive purge thresholds, exact-day warnings and no warning for never-logged users stay.
- UND-017 (2026-11-06): suggestion accepted; TS user reads are manager-only, user(id) is dropped, invitation lookup is by hash.
- UND-018 (2026-11-06): current behaviour kept; the invitation hash covers the email only.
- UND-019 (2026-11-06): suggestion accepted; one shared cookie-domain rule in Haxe and TS, single-step logout.
- UND-020 (2026-11-06): suggestion accepted; the unused IP/user-agent blacklist guard is dropped.
- UND-021 (2026-11-06): suggestion accepted; TS login creates the session row when it is missing.
- UND-022 (2026-11-06): suggestion accepted; the superadmin sees why a user deletion was refused and the bridge delete is a POST.
- UND-023 (2026-11-06): current behaviour kept; "full" is a closed state with a "group is full" notice.
- UND-024 (2026-11-06): suggestion accepted; group creation stays superadmin-only and the page checks login first.
- UND-025 (2026-11-06): current behaviour kept; groups are disabled in the database only, no UI or mutation added.
- UND-026 (2026-11-06): suggestion accepted; the open group stays stored in the visitor session.
- UND-027 (2026-11-06): Haxe distribution-based recent-orders rule for quitting a group; the group 16936 exception is kept.
- UND-028 (2026-11-06): suggestion accepted; TS member removal asks the Haxe confirmation for members with orders and the batch loop is fixed.
- UND-029 (2026-11-06): suggestion accepted; TS member and waiting lists require the membership right on the requested group.
- UND-030 (2026-11-06): suggestion accepted; the rights editor rejects non-members and self-lockout before any write, in one transaction.
- UND-031 (2026-11-06): Haxe semantics for catalogs (no-list coordinator right = all catalogs, vendor rights per claimed catalog); TS behaviour for superadmin (member of every group).
- UND-032 (2026-11-06): membership fee accepts any non-zero amount (larger type); 0 is not a valid fee; free/variable group cotisation is managed another way.
- UND-033 (2026-11-06): suggestion accepted; membership recording honours the payment type, checks group membership and maps batch results on user id.
- UND-034 (2026-11-06): suggestion accepted; moving a member back to the waiting list needs the membership right and a token and is refused for people already on it.
- UND-035 (2026-11-06): suggestion accepted; a membership is valid only when the group has memberships enabled.
- UND-036 (2026-11-06): suggestion accepted; a member is new when they have never logged in.
- UND-037 (2026-11-06): percentage fees are deactivated everywhere (no field, no fee applied) but kept in the data model.
- UND-038 (2026-11-06): suggestion accepted; a product edit validates before rewriting its stock rows.
- UND-039 (2026-11-06): suggestion accepted; product export needs the catalog management right, Haxe REST reads need group membership and hide inactive products.
- UND-040 (2026-11-06): suggestion accepted; batch product enable/disable is bound to the catalog in the URL and rejects foreign ids.
- UND-041 (2026-11-06): suggestion accepted; vendor email and phone honour the show flags, managers always see them.
- UND-042 (2026-11-06): suggestion accepted; TS catalog and vendor documents follow the Haxe visibility rules.
- UND-043 (2026-11-06): suggestion accepted; TS catalog/product/vendor/place queries require login, with subscriptions, products and places restricted by role or group.
- UND-044 (2026-11-06): suggestion accepted; server-side geocoding on address change or missing coordinates, vendor failure blocks, place failure warns, places geocoded on creation too.
- UND-045 (2026-11-06): current behaviour kept; place creation stays limited to France and Belgium, form list and address search unchanged.
- UND-046 (2026-11-06): current behaviour kept; the upload limit is the 4 MB server cap and the 3 MB labels are corrected.
- UND-047 (2026-11-06): current behaviour kept; catalog deletion stays a hard delete blocked by ordered quantities; soft delete of catalogs is a post-migration task.
- UND-048 (2026-11-06): suggestion accepted; claiming a vendor works without a secondary email.
- UND-049 (2026-11-06): current behaviour kept; multi-weight is allowed without variable price.
- UND-050 (2026-11-06): suggestion accepted; price refresh no longer crashes on constant catalogs.
- UND-051 (2026-11-06): current behaviour kept; only place delete requires a group manager.
- UND-052 (2026-11-06): current behaviour kept; vendors are disabled in the database only, no UI or mutation added.
- UND-053 (2026-11-06): current behaviour kept; documents are checked as PDF by file name only.
- UND-054 (2026-11-06): current behaviour kept; a changed order delay still overwrites custom distribution dates, with its warning.
- UND-055 (2026-11-04): suggestion accepted; dates stay stored as Paris wall-clock and TS raw-column comparisons are converted.
- UND-056 (2026-11-04): suggestion accepted; daylight-saving changes follow the real calendar through a time-zone library.
- UND-057 (2026-11-04): current behaviour kept; the dead "validated" state stays only for Haxe/DB compatibility.
- UND-058 (2026-11-04): suggestion accepted; price change redirects to `/distribution` and the validate buttons are removed.
- UND-059 (2026-11-04): current behaviour kept; session edit and price change are not scoped to the user's group.
- UND-060 (2026-11-04): current behaviour kept; no explicit rights checks are added to the distribution handlers.
- UND-061 (2026-11-02): suggestion accepted; TS distribution reads require login and group membership, user orders only for the owner and managers; fixed before the migration.
- UND-062 (2026-11-02): suggestion accepted; the variable-orders attendance sheet uses the classic access rule; fixed before the migration.
- UND-063 (2026-11-06): current behaviour kept; cycle generation aborts at the first conflict and the cycle stubs stay.
- UND-064 (2026-11-06): suggestion accepted; volunteer self-registration is a POST with token and all checks, several roles stay allowed.
- UND-065 (2026-11-02, amended 2026-11-04): suggestion accepted; removing registered volunteers needs a confirmation; the role edit/delete rights checks were dropped.
- UND-066 (2026-11-04): suggestion accepted; vacant roles are decided per role.
- UND-067 (2026-11-02): suggestion accepted; members subscribe with all member checks, admin mode only for admins and catalog coordinators.
- UND-068 (2026-11-02): suggestion accepted; reading a subscription requires login and is limited to the owner, catalog coordinators and admins.
- UND-069 (2026-11-02): suggestion accepted; history pages are limited to the owner, coordinators and admins, and the payments page is read-only.
- UND-070 (2026-11-02): suggestion accepted; member subscription deletion is a confirmed POST with a CSRF token.
- UND-071 (2026-11-02): suggestion accepted; recording a payment requires managing the subscription's catalog.
- UND-072 (2026-11-06): suggestion accepted; the creation stock clamp (order units) applies to edits too.
- UND-073 (2026-11-06): suggestion accepted; the order service enforces the order window for non-managers.
- UND-074 (2026-11-06): suggestion accepted; the admin order dialog returns per-line errors with success false and keeps saved lines.
- UND-075 (2026-11-02): suggestion accepted; the inline-edit sub-total uses the price saved with the order.
- UND-076 (2026-11-02): suggestion accepted; any existing basket is reused, and a leftover OPEN basket is switched to CONFIRMED when reused.
- UND-077 (2026-11-02): suggestion accepted; temporary baskets, their page and the confirm function are removed.
- UND-078 (2026-11-06): suggestion accepted; absences are locked by order closing date in the service too, and a coordinator creating a subscription uses admin mode for absences.
- UND-079 (2026-11-06): suggestion accepted; saving a default order keeps past orders, manual edits and saved prices.
- UND-080 (2026-11-02): suggestion accepted; a balance transfer target must be the same member, same vendor and not closed.
- UND-081 (2026-11-02): suggestion accepted; any non-zero balance, negative included, can be transferred.
- UND-082 (2026-11-02): suggestion accepted; the default-order job catches errors per subscription, logs them and continues.
- UND-083 (2026-11-06): current behaviour kept; subscription renewal stays out of scope, a new season is a new catalog.
- UND-084 (2026-11-02): suggestion accepted; the minimum-order error message shows the rounded total.
- UND-085 (2026-11-02): suggestion accepted; the legacy shop-mode order edit page is removed.
- UND-086 (2026-11-06): suggestion accepted; the basket total is computed on read and no longer stored.
- UND-087 (2026-11-06): current behaviour kept for legacy compatibility; the balance counts only operations of subscriptions starting after 2022.
- UND-088 (2026-11-02): suggestion accepted; a subscription balance is payments minus total, rounded to cents, on every screen; applied at the port to TS (TS-only step).
- UND-089 (2026-11-06): suggestion accepted; TS rounds operations to 2 decimals, locks/rounds/awaits on payment update, reuses only pending on-the-spot payments.
- UND-090 (2026-11-02): suggestion accepted; operations without a subscription can be edited and deleted without crashing.
- UND-091 (2026-11-02): current behaviour kept; a payment and a debt are settled together only when their sum is exactly zero.
- UND-092 (2026-11-02): suggestion accepted; the unused payment type link field is removed, docLink stays.
- UND-093 (2026-11-06): suggestion accepted; money pot is removed as a payment type and refused in validation and manual entry.
- UND-094 (2026-11-06): suggestion accepted; reports sum VAT-exclusive totals per rounded line and the invoice reuses the VAT helper.
- UND-095 (2026-11-02): suggestion accepted; the attendance sheet format form offers CSV.
- UND-096 (2026-11-06): suggestion accepted; TS validate/delete operation mutations are kept and require the membership right.
- UND-097 (2026-11-02): suggestion accepted; job endpoints require the shared key again and HX_TRIGGER_CRONS is read as a boolean.
- UND-098 (2026-11-02): suggestion accepted; reading messages requires the messages right, unknown ids give "not found", latest messages are filtered on the right; fixed before the migration.
- UND-099 (2026-11-02): suggestion accepted; a message with no valid recipient returns an error and stores nothing.
- UND-100 (2026-11-06): suggestion accepted; emails use the platform address with the sender name and reply to the sender.
- UND-101 (2026-11-02): suggestion accepted; TS reads the stored white-label theme (default as fallback, cache cleared on save), colors stay on the built-in palette; applied at the port to TS (TS-only step).
- UND-102 (2026-11-02): suggestion accepted; purge jobs await every deletion.
- UND-103 (2026-11-06): current behaviour kept; daily job and message purge stay at midnight, the 00:15 comment and docs are corrected.
- UND-104 (2026-11-06): suggestion accepted as amended by UND-118; automatic emails stay French, subjects and dates move to translation files at the port.
- UND-105 (2026-11-06): suggestion accepted; cron recap uses WHERE, errors email uses the faked clock, each job takes a lock across replicas.
- UND-106 (2026-11-06): suggestion accepted; email templates that nothing sends are removed until their flows are specified; fixed before the migration.
- UND-107 (2026-11-02): admin@camap.tld stays the default admin user; diagnostics are superadmin-only; the CSS demo page is removed.
- UND-108 (2026-11-02): suggestion accepted; the error purge needs a POST with a token and a confirmation, and the clean-up script is CLI-only with a dry-run by default.
- UND-109 (2026-11-02): suggestion accepted; admin group search uses parameterised queries and an explicit superadmin guard.
- UND-110 (2026-11-02): suggestion accepted; the `deleted@camap.tld` placeholder is created at install and by a migration, and account deletion fails loudly if it is missing; fixed before the migration.
- UND-111 (2026-11-06): suggestion accepted; a maintenance-mode toggle is added, SMTP/analytics/version stay in environment configuration.
- UND-112 (2026-11-06): current behaviour kept; theme and superadmin pages stay unlinked in the sidebar, theme reload stays manual.
- UND-113 (2026-11-06): suggestion accepted; both ping endpoints return one build-time version, the Haxe one disappears with the port.
- UND-114 (2026-11-06): suggestion accepted; the raw /db route is removed once dedicated screens exist, operators use a DB client meanwhile.
- UND-115 (2026-11-06): suggestion accepted; platform terms-of-service setting kept, dead settings and unused IP blacklist removed, settings read/save fixed.
- UND-116 (2026-11-02): suggestion accepted; stack traces stay in the server logs, the API returns only the error code and message.
- UND-117 (2026-11-02): current behaviour kept; a user can choose any group and sees every component that does not check membership.
- UND-118 (2026-11-02): French only, no change to the current system; when Haxe is ported to TS, every hard-coded string is exported to the translation files and the language parameter is dropped (TS-only step).
- UND-119 (2026-11-06): current behaviour kept, no graceful degradation is built; the dependency disappears with the Haxe pages (TS-only step).
- UND-120 (2026-11-06): suggestion accepted; sending a message requires the messages right; fixed before the migration.
- UND-121 (2026-11-06): suggestion accepted; the recipient lookup requires the messages right; fixed before the migration.
