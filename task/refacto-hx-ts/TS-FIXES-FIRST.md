# Fix the camap-ts code we keep, first

The first work of the migration, done on the migration branch right after the camap-ts upgrade and before any domain is ported ([MIGRATION-PLAN.md](MIGRATION-PLAN.md) steps 2B and 3A). It ships with the migration branch: **there is no separate production patch** (user, 2026-11-06).

**Why first.** The port builds on camap-ts services, resolvers and guards. A bug left in them slows the porting down:
- ported code reuses or imitates the broken helper (an un-awaited rights check, a too-broad `hasRight`);
- the characterisation suite stays noisy: the test is an expected failure on both targets, and porters can't tell their regression from an old known bug;
- most of these fixes are the first pieces of the rights layer (OVERVIEW §3.3), and the TypeORM 0.3 upgrade touches the same files anyway.

**The rule** (applies to every decided fix):
- the bug is in **camap-ts** code that is kept → fixed here;
- the bug is in **Haxe or sugoi** → not fixed in the current system; the port doesn't copy it ([TS-ONLY-STEP.md](TS-ONLY-STEP.md));
- a TS fix that would break Haxe while it still runs waits for the port too (e.g. renewing the session id at login, CODE-178).

Each fix already has a test asserting the decided behaviour, which runs as an expected failure (`deviation('<key>')`). The test stack runs the branch's camap-ts behind Haxe, so a merged fix makes the test pass on the current stack too. **Done** means the fix is merged on the migration branch, the test passes, and the entry is removed from `tests/src/deviations.ts`. When part of the behaviour is in Haxe (item 6), keep `'hx'` in its `targets` until the port.

Code paths are relative to `camap-ts/packages/api-core/src` unless they start with `camap-hx/` or `camap-ts/`. Work wanted after the migration is in [POST-MIGRATION-TASKS.md](POST-MIGRATION-TASKS.md).

## Security

| # | Decision | Fix | Code | Statements | Deviation key / test |
|---|---|---|---|---|---|
| 1 | [UND-062](specs/UNDECIDED.md) | The attendance sheet of variable-order contracts uses the same rights rule as the classic attendance sheet (today: any logged-in user reads any distribution's attendance). | `shop/resolvers/attendance-list.resolver.ts:90-138` (CODE-009) | [DIS-ATT-007](specs/04-distributions/attendance-sheets.md) | `UND-062` |
| 2 | [UND-061](specs/UNDECIDED.md) | Distribution and multi-distribution reads require a login and group membership; a user's orders are visible only to that user and to managers (today: `distribution(id)` needs no login). | `shop/resolvers/distributions.resolver.ts:19-33,96-104`, `shop/resolvers/multi-distribs.resolver.ts:62-74` (CODE-010, CODE-018) | [DIS-MDS-015](specs/04-distributions/multidistrib-schedule.md) | `UND-061` |
| 3 | [UND-120](specs/UNDECIDED.md) | Sending a group message requires the messages right on the group; nothing is stored or queued otherwise. | `messages/messages.resolver.ts:135-218` (`createMessage`) | [COM-MSG-010](specs/07-communication/group-messages.md) | `UND-120`, `07-communication/group-messages.graphql` |
| 4 | [UND-121](specs/UNDECIDED.md) | The recipient lookup requires the messages right: await `canManageMessages()` (today a pending promise is always truthy, so member names and emails of any group leak). | `users/users.resolver.ts:105` | [COM-MSG-003](specs/07-communication/group-messages.md) | `UND-121`, `07-communication/message-recipients.graphql` |
| 5 | [UND-098](specs/UNDECIDED.md) | `message(id)` checks the message exists before reading its group and requires the messages right; latest messages are filtered on that right. | `messages/messages.resolver.ts:58-105` (CODE-057, CODE-034) | [COM-MSG-007, COM-MSG-008](specs/07-communication/group-messages.md) | `UND-098` |

Items 3–5 are in the same resolver area and go together.

## Account deletion

| # | Decision | Fix | Code | Statements | Deviation key / test |
|---|---|---|---|---|---|
| 6 | [UND-110](specs/UNDECIDED.md) | The install step and a TypeORM migration create the `deleted@camap.tld` placeholder (skipped when it exists); `UsersService.delete` fails loudly when it is missing instead of returning null. | `users/users.service.ts:333-340` | [ADM-USR-006](specs/08-administration/admin-users.md) | `UND-110` |
| 7 | [UND-015](specs/UNDECIDED.md) (CODE-056) | When deletion cannot proceed, `deleteAccount` stops with an error: no logout, no email to the group admins. | `users/users.resolver.ts:224-246` | [ACC-DEL-005, ACC-DEL-006, ACC-DEL-008](specs/01-accounts/account-deletion.md) | `CODE-056`, `08-administration/admin-users.forms` |

Items 6 and 7 go together. Production already has the placeholder row (user, 2026-11-06), so this is about fresh installs and failing loudly. The Haxe admin action that redirects as if nothing happened (`camap-hx/src/controller/admin/User.hx:44-55`) is **not** touched: it is Haxe code, ported later. Its test stays an expected failure on hx until then.

## Dead email templates

| # | Decision | Fix | Code | Statements | Deviation key / test |
|---|---|---|---|---|---|
| 8 | [UND-106](specs/UNDECIDED.md) | Remove the email templates that no flow sends: `anticheat`, `existingVendorInvitation`, `newVendorInvitation`, `time-slots-resolution`, `validateDistributedDistribution`, `validateDistributedDistribution-reminder`, `vendorCertificationInProgress`, `vendorCertificationRefused` (`.twig`), so the superadmin template list shows only templates a flow can send. | `camap-ts/packages/api-core/mails/` (template sources and `dist/`), `mails/controllers/mails.controller.ts` (`list`) | [ADM-TLS-002](specs/08-administration/maintenance-tools.md), [COM-AUT-003, COM-AUT-004](specs/07-communication/automatic-emails.md) | `UND-106`, `08-administration/maintenance-tools.api` |

Before deleting, grep camap-ts for each template name: nothing may still render it.

## Balances and theme

Both were first put at the port (2026-11-06) and moved here on the same day: the bugs are in camap-ts code the port keeps.

| # | Decision | Fix | Code | Statements | Deviation key / test |
|---|---|---|---|---|---|
| 9 | [UND-088](specs/UNDECIDED.md) | Every TS balance uses the Haxe formula: payments minus the subscription total, rounded to cents. Today the `CsaSubscription.balance` field (attendance sheet) sums every operation unrounded, and the service subtracts without rounding. | `groups/resolvers/csa-subscriptions.resolver.ts:17-35`, `groups/services/csa-subscriptions.service.ts:104-137` (CODE-102); reference `camap-hx/src/db/Subscription.hx:23-67` | [PAY-BAL-007, PAY-BAL-008](specs/06-payments/balances.md), [ORD-AMT-003](specs/05-orders/order-amounts.md) | `UND-088`, `06-payments/subscription-balance.api` |
| 10 | [UND-101](specs/UNDECIDED.md) | Nest reads the white-label theme saved by the superadmin (default as fallback, cache cleared on save) instead of the default theme cached forever; colors stay on the built-in palette. | `tools/variable.service.ts:61-72` (CODE-104) | [COM-EML-008](specs/07-communication/emails.md), [ADM-THM-003](specs/08-administration/theme.md), [NAV-THM-002](specs/09-navigation/theme-layout.md) | `UND-101`, `08-administration/theme.forms`, `09-navigation/language-theme.views` |

## Other decided fixes in camap-ts

The ten items above are the decided fixes that the characterisation suite found missing from both apps. Sorted on 2026-11-06, with the same rule, the other decisions of [specs/UNDECIDED.md](specs/UNDECIDED.md) that change camap-ts code. When an item says "characterised", its test pins today's behaviour (the title says "characterised"). The fix rewrites that test to assert the decided behaviour, and done means it passes.

**When.** The rights items (1–5, 11–19) are done on the rights layer, the first step of the foundations (plan step 3A): each fix is that layer's first use on an existing resolver. The others (6–10, 20–39) are done right after the upgrade (plan step 2B). Items marked † need the new transaction library (step 2A).

### Rights (plan step 3A)

| # | Decision | Fix | Code | Statements | Test to flip |
|---|---|---|---|---|---|
| 11 | [UND-010](specs/UNDECIDED.md) | `loginAs`: superadmin, or manager of the target's single group when the target is a non-admin member; the check is awaited and made on the caller, not the target. | `auth/auth.resolver.ts:126-148` (CODE-002) | [ACC-IMP-002, ACC-IMP-004](specs/01-accounts/impersonation.md) | `01-accounts/impersonation-invitations` (characterised) |
| 12 | [UND-017](specs/UNDECIDED.md) (TS part) | User reads are for group managers only: drop `user(id)`, restrict `getUsersFromEmails` (used by the members import). The invitation lookup by hash waits for the port: the Haxe invite page passes only the email to the register box (`camap-hx/lang/master/tpl/invite.mtt:6`). | `users/users.resolver.ts:62-66,121-140` (CODE-006) | [ACC-INV-006](specs/01-accounts/invitations.md) | `01-accounts/registration-invitations.graphql` (characterised) |
| 13 | [UND-029](specs/UNDECIDED.md) | Member and waiting lists (`getUserLists`, `getContractsUserLists`, `getDistributionsUserLists`, `getWaitingListsOfGroup`) need the membership right, group admin or superadmin on the requested group. | `groups/resolvers/userLists.resolver.ts`, `groups/resolvers/waitingLists.resolver.ts` (CODE-006) | [GRP-MEM-002](specs/02-groups/members.md), [GRP-WAI-004](specs/02-groups/waiting-list.md) | `02-groups/members.graphql`, `02-groups/waiting-list.graphql`, `06-payments/exports-data.graphql` (characterised) |
| 14 | [UND-031](specs/UNDECIDED.md) (TS part, CODE-028) | Haxe catalog semantics in TS: "all catalogs" is a coordinator right with no catalog list (not any coordinator right); vendor automatic rights apply per claimed catalog. The superadmin part is already the TS behaviour; Haxe is aligned at the port. | `groups/services/user-groups.service.ts:102-171` | [GRP-RIG-002, 004, 005, 006](specs/02-groups/rights.md) | `02-groups/rights.views`, `02-groups/rights.forms` (comments still say "undecided": update them) |
| 15 | [UND-041](specs/UNDECIDED.md) | Vendor email and phone follow the vendor's show settings; the rights check is awaited. | `vendors/resolvers/vendors.resolver.ts:456-467` (CODE-007) | [CAT-VEN-010](specs/03-catalogs/vendors.md) | `03-catalogs/vendors.graphql` (characterised) |
| 16 | [UND-042](specs/UNDECIDED.md) | Catalog and vendor documents follow the Haxe visibility rules; `canManageCatalog` is awaited and its arguments are put back in order. | `vendors/resolvers/catalogs.resolver.ts:173-193` (CODE-008) | [CAT-DOC-005](specs/03-catalogs/documents-files.md) | `03-catalogs/documents-files.graphql` ("today every logged-in user is given all the documents") |
| 17 | [UND-043](specs/UNDECIDED.md) | Login required on `getVendorsFromCompanyNumber`, `getVendorProfessions`, `place`, `vendorProductsSample` and the catalog fields `products` and `subscriptions`; subscriptions for managers and the subscriber, products for group members and managers, a place for members of its group. | `vendors/resolvers/vendors.resolver.ts:144,151` and the catalog/place resolvers (CODE-021, CODE-022) | [CAT-CLV-010](specs/03-catalogs/catalog-list-view.md), [CAT-PRD-018](specs/03-catalogs/products.md), [CAT-VEN-012](specs/03-catalogs/vendors.md), [CAT-PLC-009, 010](specs/03-catalogs/places.md) | `03-catalogs/vendors.graphql` (characterised) and the UND-043 tests in `products.api`, `places.api`, `catalog-list-view.views` |
| 18 | [UND-096](specs/UNDECIDED.md) | The operation validate and delete mutations require the membership right (`canManageMembers`) instead of the all-catalogs coordinator right. | `payments/resolvers/operation.resolver.ts:27-54,91-103` | [PAY-ENT-011](specs/06-payments/payment-entry.md) | `06-payments/operation-mutations.graphql` (characterised) |
| 19 | [UND-034](specs/UNDECIDED.md) (TS part) | Moving members back to the waiting list requires the membership right, rejects people already on it, and fixes the splice inside the loop. The Haxe action (token, self and admin checks) is ported later. | `groups/resolvers/waitingLists.resolver.ts:78-83` (CODE-055) | [GRP-WAI-007, 011](specs/02-groups/waiting-list.md) | `02-groups/waiting-list.graphql` (characterised) |

### Accounts and sessions (plan step 2B)

| # | Decision | Fix | Code | Statements | Test to flip |
|---|---|---|---|---|---|
| 20 | [UND-002](specs/UNDECIDED.md) | TS stores emails lower-cased and last names upper-cased on every save, as Haxe does. | `auth/auth.service.ts` (register), `users/users.service.ts` (update) | [ACC-REG-008](specs/01-accounts/registration.md) | `01-accounts/auth.graphql` (characterised) |
| 21 | [UND-003](specs/UNDECIDED.md) | The server enforces the group's phone and address requirement at registration. | `auth/auth.resolver.ts` (register); today only `front-core/.../RegistrationBox.tsx:186-202` | [ACC-REG-003](specs/01-accounts/registration.md) | `01-accounts/registration-invitations.graphql` (characterised) |
| 22 | [UND-004](specs/UNDECIDED.md) | The register API validates the password on the server: at least 8 characters, never empty. | `auth/auth.service.ts:103-120` (CODE-052) | [ACC-REG-009](specs/01-accounts/registration.md) | `01-accounts/auth.graphql` ("an empty password is refused") |
| 23 | [UND-006](specs/UNDECIDED.md) | Registration joins `invitedGroupId` only when the group is open or an invitation exists for the email. | `auth/auth.resolver.ts:99-104` (CODE-004) | [ACC-REG-012](specs/01-accounts/registration.md), [ACC-INV-004](specs/01-accounts/invitations.md), [GRP-JOI-003](specs/02-groups/join-quit.md) | `01-accounts/registration-invitations.graphql` (characterised) |
| 24 † | [UND-008](specs/UNDECIDED.md) | `login` counts failed attempts itself, in a write that survives the rolled-back login transaction, and reads the IP header in lower case. | `auth/auth.service.ts:50-56,280-309` (CODE-023) | [ACC-LOG-005](specs/01-accounts/login.md) | `01-accounts/auth.graphql` ("five failed logins … block the next login") |
| 25 | [UND-012](specs/UNDECIDED.md) | Changing the login email requires the current password. | `users/users.service.ts:124-147` | [ACC-PRO-005](specs/01-accounts/profile.md) | `01-accounts/profile-account.graphql` (characterised) |
| 26 | [UND-021](specs/UNDECIDED.md) | TS login creates the `Session` row when it is missing (given sid, French, empty data, client IP). Within A3: TS touches the row's existence, `uid` and `lastTime` only. | `auth/auth.service.ts:40-81` (CODE-105) | [ACC-LOG-001, 012](specs/01-accounts/login.md) | `01-accounts/sessions-tokens.graphql` (characterised) |
| 27 | [UND-020](specs/UNDECIDED.md), [UND-115](specs/UNDECIDED.md) | Remove the unused IP/user-agent blacklist guard and the dead settings (`tosVersion`, `defaultShowcaseGroupIds`); keep `platformtermsofservice`; a missing integer setting no longer throws and `set` is awaited. Same file as item 10: do them together. | `common/guards/black-list.guard.ts`, `tools/variable.service.ts:9-72` (CODE-125, CODE-060) | [ACC-SES-008](specs/01-accounts/sessions-tokens.md), [ADM-TLS-006](specs/08-administration/maintenance-tools.md), [CAT-VEN-011](specs/03-catalogs/vendors.md) | `01-accounts/sessions-tokens.graphql` (characterised), `08-administration/platform-settings.graphql` |

### Groups and memberships (plan step 2B)

| # | Decision | Fix | Code | Statements | Test to flip |
|---|---|---|---|---|---|
| 28 | [UND-027](specs/UNDECIDED.md) | Quitting a group follows the Haxe rule (refused when the member has orders in active catalogs, or in catalogs ended less than a month ago); the hard-coded group 16936 exception stays. | `groups/resolvers/groups.resolver.ts:124-147` (CODE-100) | [GRP-JOI-008, 010](specs/02-groups/join-quit.md) | `02-groups/join-quit.graphql`, `02-groups/join-quit.forms` (characterised) |
| 29 | [UND-028](specs/UNDECIDED.md) | Removing a member who has orders needs an explicit confirmation, as in Haxe; the batch removal no longer keeps null entries or splices inside its loop. | `groups/resolvers/group-previews-members.resolver.ts:61-108` (CODE-055), members module of front-core | [GRP-MEM-005, 006, 007](specs/02-groups/members.md) | `02-groups/members.graphql`, `02-groups/members.forms` (characterised) |
| 30 | [UND-033](specs/UNDECIDED.md) | Membership creation honours the payment type, checks that the user belongs to the group, and maps batch results by user id. | `groups/services/memberships.service.ts:97-133,224` (CODE-038) | [GRP-COT-006 to 010](specs/02-groups/membership.md) | `02-groups/membership.graphql` (characterised) |
| 31 | [UND-035](specs/UNDECIDED.md) | A membership is valid only when memberships are enabled for the group. | `groups/services/memberships.service.ts:198-212` | [GRP-COT-005](specs/02-groups/membership.md) | `02-groups/membership.graphql` (characterised) |

### Catalogs, dates, payments, mail (plan step 2B)

| # | Decision | Fix | Code | Statements | Test to flip |
|---|---|---|---|---|---|
| 32 | [UND-037](specs/UNDECIDED.md) | TS stops applying the percentage fee to displayed product prices (flag and rate stay stored and ignored; existing order lines keep their rate). | `vendors/services/catalogs.service.ts:146-178` (CODE-097) | [CAT-CCR-014](specs/03-catalogs/catalog-creation.md), [CAT-PPR-005](specs/03-catalogs/product-pricing.md), [ORD-OPL-015](specs/05-orders/order-placement.md), [ORD-AMT-002](specs/05-orders/order-amounts.md) | UND-037 tests in `03-catalogs/catalog-creation.forms`, `product-pricing.forms`, `05-orders/order-dialog.api` (characterised) |
| 33 | [UND-048](specs/UNDECIDED.md) | Vendor claim compares the secondary email null-safely. | `vendors/resolvers/vendors.resolver.ts:76` (CODE-074) | [CAT-VCL-003](specs/03-catalogs/vendor-claim.md) | `03-catalogs/vendor-claim.graphql` (characterised) |
| 34 | [UND-055](specs/UNDECIDED.md) | TS finders that compare raw Paris wall-clock columns with dates wrap them with `utcToZonedTime`. Done during the TypeORM conversion of the same finders. | `shop/services/multi-distribs.service.ts:50-115`, `vendors/entities/catalog.entity.ts:39-66` (CODE-096) | [DIS-MDS-012](specs/04-distributions/multidistrib-schedule.md) | none yet: add one pinned at a DST boundary |
| 35 † | [UND-089](specs/UNDECIDED.md) | TS payment operations follow the Haxe rules: amounts rounded to 2 decimals on save; the update locks, rounds and awaits the balance update; only pending on-the-spot payments are reused. This also removes the main A1 divergence on `Operation` while both apps write it. | `payments/services/payments.service.ts:186-275,377-380` (CODE-061, CODE-103) | [PAY-ENT-012, 013](specs/06-payments/payment-entry.md), [PAY-OPE-005, 006](specs/06-payments/operations.md), [PAY-BAL-003](specs/06-payments/balances.md) | `06-payments/operation-mutations.graphql` ("a membership fee with more than 2 decimals …") |
| 36 | [UND-099](specs/UNDECIDED.md) | `createMessage` with no valid recipient returns an error and stores nothing. With items 3–5 (same resolver). | `messages/messages.resolver.ts:192-197` (CODE-058) | [COM-MSG-011](specs/07-communication/group-messages.md) | `07-communication/group-messages.graphql` |
| 37 | [UND-100](specs/UNDECIDED.md) | Sent emails use the platform address with the sender's name, and Reply-To set to the sender. | `mails/mails.service.ts:256-273` (CODE-123) | [COM-EML-007](specs/07-communication/emails.md) | `07-communication/mail-content.cron`, `mail-delivery.cron` (characterised) |
| 38 | [UND-102](specs/UNDECIDED.md) (TS part) | Every deletion in the TS purge jobs is awaited (messages, cache, inactive accounts). The Haxe task deletions are ported later. | `messages/messages.service.ts:83`, `tools/cache.service.ts:58`, `users/users.service.ts:439-600` (CODE-059, CODE-067) | [COM-JOB-010](specs/07-communication/scheduled-jobs.md) | none: covered by the job tests |
| 39 | [UND-097](specs/UNDECIDED.md) (TS part), [UND-103](specs/UNDECIDED.md) | `HX_TRIGGER_CRONS` is read as a boolean ("false" no longer triggers), and the comment saying 00:15 says midnight. The shared key is left to the port: the check is in Haxe (`Cron.hx`), and it comes back when the first job moves to Nest. | `tools/crontab.service.ts:11,17,31,45` (CODE-151, CODE-088) | [COM-JOB-002, 003, 011](specs/07-communication/scheduled-jobs.md) | `07-communication/scheduled-jobs` (the `UND-097` deviation keeps `'hx'`) |

## Sorted to the port

These decisions touch camap-ts code, or code paths both apps share, but must wait for the port. They don't go into this file:

| Decision | Why it waits |
|---|---|
| [UND-005](specs/UNDECIDED.md), [UND-007](specs/UNDECIDED.md), [UND-011](specs/UNDECIDED.md), [UND-013](specs/UNDECIDED.md), [UND-036](specs/UNDECIDED.md) | The code to change is Haxe (`setPass` trim, password reset, reset link, age rule, "new member" test). TS already behaves as decided, or the flow is Haxe-only. |
| [UND-014](specs/UNDECIDED.md) | Setting which person logged in means writing the Neko-serialized `sdata`, which TS must not touch while Haxe runs (A3). The TS login only drops its "copy the language" TODO. |
| [UND-017](specs/UNDECIDED.md) (invitation by hash) | The Haxe invite page passes only the email to the register box. |
| [UND-019](specs/UNDECIDED.md) | One cookie-domain rule and a single-step logout: changing the TS cookie domain while Haxe sets its own would leave duplicate session cookies. Done with the session take-over. |
| [UND-022](specs/UNDECIDED.md) | Bridge user deletion becomes a POST: the caller is the Haxe admin page ([TS-ONLY-STEP.md](TS-ONLY-STEP.md) §3). |
| [UND-030](specs/UNDECIDED.md), [UND-031](specs/UNDECIDED.md) (superadmin part), [UND-034](specs/UNDECIDED.md) (Haxe part) | Haxe pages (rights editor, member actions). |
| [UND-032](specs/UNDECIDED.md) | Widening the fee column changes a column Haxe also writes, and the new way to manage the group fee is not specified yet. |
| [UND-044](specs/UNDECIDED.md) | Server-side geocoding needs the geocoder that the port brings over from `VendorService.hx`. Done with the catalogs/vendors domain. |
| [UND-046](specs/UNDECIDED.md) | The labels that say 3 MB are in Haxe (`addmedia.mtt:12`, `Media.hx:99`). |
| [UND-070](specs/UNDECIDED.md), [UND-073](specs/UNDECIDED.md) | Member subscription deletion and the order window are Haxe routes and services (orders domain). |
| [UND-097](specs/UNDECIDED.md) (key check), [UND-102](specs/UNDECIDED.md) (Haxe part), [UND-105](specs/UNDECIDED.md) | Haxe cron code; the per-job lock is designed when the jobs move to Nest. |
| [UND-111](specs/UNDECIDED.md) | The maintenance toggle goes on the admin pages, which are Haxe (administration domain). |

The decisions that keep the current behaviour (UND-001, 016, 025, 045, 052, 053, 057, 087) need no code change.
