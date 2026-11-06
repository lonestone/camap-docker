# Fix the camap-ts code we keep, first

The first work of the migration, done on the migration branch together with the camap-ts upgrade (OVERVIEW §6 Phase 2), before any domain is ported. It ships with the migration branch: **there is no separate production patch** (user, 2026-11-06).

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

The list above holds the decided fixes found missing from both apps by the characterisation suite. Other decisions in [specs/UNDECIDED.md](specs/UNDECIDED.md) also fix camap-ts code (e.g. the TS rights reads of UND-017 and UND-029, `loginAs` in UND-010, `canManageAllCatalogs` in CODE-028). They are sorted with the same rule and listed here when the migration plan is written.
