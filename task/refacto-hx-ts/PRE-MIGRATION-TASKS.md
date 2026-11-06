# Tasks before the migration

Decided fixes that land in the **current** system (Haxe + TS), before any domain is ported. They answer roadblock D2 in [ROADBLOCKS.md](ROADBLOCKS.md): these holes or bugs are live in production today, and neither app implements the decided behaviour.

All of them are in **camap-ts** (`packages/api-core`). That code is kept after the port, so the fixes are not thrown away with Haxe. Code paths below are relative to `camap-ts/packages/api-core/src` unless they start with `camap-hx/`.

Each fix already has a test in `camap-docker/tests` that asserts the decided behaviour and runs as an expected failure (`deviation('<key>')`). **Done** means: the fix is merged, the test passes on the hx stack, and the entry is removed from `tests/src/deviations.ts` (Playwright reports an unexpected pass until then).

Decided 2026-11-06. Fixes that wait for the port are in [TS-ONLY-STEP.md](TS-ONLY-STEP.md); work wanted after the migration is in [POST-MIGRATION-TASKS.md](POST-MIGRATION-TASKS.md).

## Security

| # | Decision | Fix | Code | Statements | Deviation key / test |
|---|---|---|---|---|---|
| 1 | [UND-062](specs/UNDECIDED.md) | The attendance sheet of variable-order contracts uses the same rights rule as the classic attendance sheet (today: any logged-in user reads any distribution's attendance). | `shop/resolvers/attendance-list.resolver.ts:90-138` (CODE-009) | [DIS-ATT-007](specs/04-distributions/attendance-sheets.md) | `UND-062` |
| 2 | [UND-061](specs/UNDECIDED.md) | Distribution and multi-distribution reads require a login and group membership; a user's orders are visible only to that user and to managers (today: `distribution(id)` needs no login). | `shop/resolvers/distributions.resolver.ts:19-33,96-104`, `shop/resolvers/multi-distribs.resolver.ts:62-74` (CODE-010, CODE-018) | [DIS-MDS-015](specs/04-distributions/multidistrib-schedule.md) | `UND-061` |
| 3 | [UND-120](specs/UNDECIDED.md) | Sending a group message requires the messages right on the group; nothing is stored or queued otherwise. | `messages/messages.resolver.ts:135-218` (`createMessage`) | [COM-MSG-010](specs/07-communication/group-messages.md) | `UND-120`, `07-communication/group-messages.graphql` |
| 4 | [UND-121](specs/UNDECIDED.md) | The recipient lookup requires the messages right: await `canManageMessages()` (today a pending promise is always truthy, so member names and emails of any group leak). | `users/users.resolver.ts:105` | [COM-MSG-003](specs/07-communication/group-messages.md) | `UND-121`, `07-communication/message-recipients.graphql` |
| 5 | [UND-098](specs/UNDECIDED.md) | `message(id)` checks the message exists before reading its group and requires the messages right; latest messages are filtered on that right. | `messages/messages.resolver.ts:58-105` (CODE-057, CODE-034) | [COM-MSG-007, COM-MSG-008](specs/07-communication/group-messages.md) | `UND-098` |

Items 3–5 are in the same resolver area and can ship together.

## Account deletion

| # | Decision | Fix | Code | Statements | Deviation key / test |
|---|---|---|---|---|---|
| 6 | [UND-110](specs/UNDECIDED.md) | The install step and a migration create the `deleted@camap.tld` placeholder; deletion fails loudly when it is missing (today it silently does nothing, and the Haxe admin action redirects as if it worked). | `users/users.service.ts:333-340`, `camap-hx/src/controller/admin/User.hx:44-55` | [ADM-USR-006](specs/08-administration/admin-users.md) | `UND-110` |
| 7 | [UND-015](specs/UNDECIDED.md) (CODE-056) | When deletion cannot proceed, `deleteAccount` stops with an error: no logout, no email to the group admins. | `users/users.resolver.ts:224-246` | [ACC-DEL-005, ACC-DEL-006, ACC-DEL-008](specs/01-accounts/account-deletion.md) | `CODE-056`, `08-administration/admin-users.forms` |

Items 6 and 7 ship together. Production already has the `deleted@camap.tld` placeholder row (confirmed by the user, 2026-11-06), so deletions work there today: the fix is about fresh installs and failing loudly, not about an incident. The migration that creates the row must skip it when it exists.

Item 6 touches one Haxe file (`admin/User.hx`, the error display). Keep that change minimal: the page is ported later.

## Dead email templates

| # | Decision | Fix | Code | Statements | Deviation key / test |
|---|---|---|---|---|---|
| 8 | [UND-106](specs/UNDECIDED.md) | Remove the email templates that no flow sends: `anticheat`, `existingVendorInvitation`, `newVendorInvitation`, `time-slots-resolution`, `validateDistributedDistribution`, `validateDistributedDistribution-reminder`, `vendorCertificationInProgress`, `vendorCertificationRefused` (`.twig`), so the superadmin template list shows only templates a flow can send. | `camap-ts/packages/api-core/mails/` (template sources and `dist/`), `mails/controllers/mails.controller.ts` (`list`) | [ADM-TLS-002](specs/08-administration/maintenance-tools.md), [COM-AUT-003, COM-AUT-004](specs/07-communication/automatic-emails.md) | `UND-106`, `08-administration/maintenance-tools.api` |

Before deleting, grep both apps for each template name: nothing may still render it.
