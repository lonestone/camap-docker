# Undecided points

Every point of contention found while writing the specs. A statement marked *Undecided (UND-NNN)* in the specs points to an entry below.
Entries are grouped by domain. IDs are sequential across the project and are reused when the same question appears in several statements.

Each entry lists:
- **Statements**: the spec statements affected (links to their files).
- **Current behavior**: what the code does today. The statement in the spec describes the presumably intended behavior of the current Haxe + TS system (see the scope note in [README.md](README.md#scope-the-current-haxe--ts-system)).
- **Question**: what the product owner must answer.
- **Options**: the possible answers.
- **Suggestion**: a proposed resolution found by checking the code, with its confidence. Each statement in the specs carries the full **SUGGESTION** with the code reference it is based on. Nothing is decided until the product owner answers.

## Contents

- [Summary of suggestions](#summary-of-suggestions) — table ordered by confidence
- [Accounts (ACC)](#accounts-acc) — 22 entries
- [Groups (GRP)](#groups-grp) — 14 entries
- [Catalogs (CAT)](#catalogs-cat) — 18 entries
- [Distributions (DIS)](#distributions-dis) — 12 entries
- [Orders (ORD)](#orders-ord) — 20 entries
- [Payments (PAY)](#payments-pay) — 10 entries
- [Communication (COM)](#communication-com) — 12 entries
- [Administration (ADM)](#administration-adm) — 10 entries
- [Navigation (NAV)](#navigation-nav) — 3 entries

## Accounts (ACC)

- **UND-001** No confirmation email, no email verification at registration — **DECIDED**
  - **Statements**: [ACC-REG-007](01-accounts/registration.md)
  - **Current behavior**: Registration sends no email and never verifies the address (`camap-ts/packages/api-core/src/auth/auth.service.ts`, `auth.resolver.ts`; users-auth F5.1 step 5).
  - **Question**: Must a new user receive a confirmation or verification email?
  - **Options**:
    - (a) keep as is
    - (b) welcome email only
    - (c) verify email before activation
  - **Suggestion**: Keep as is: no confirmation email at registration. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a): keep as is, no confirmation email and no email verification at registration.

- **UND-002** Normalisation of email and last name — **DECIDED**
  - **Statements**: [ACC-REG-008](01-accounts/registration.md)
  - **Current behavior**: Haxe lower-cases emails and upper-cases last names on every save (`camap-hx/src/db/User.hx:524-535`). TS does not (users-auth R4). Users registered in TS keep their casing.
  - **Question**: Which normalisation is the rule?
  - **Options**:
    - (a) normalise in TS too
    - (b) normalise only at display
    - (c) drop normalisation
  - **Suggestion**: Lower-case email on write in TS; upper-case last name at display only. Confidence: medium.
  - **Decision** (2026-11-06): Haxe behaviour kept (option a, normalise in TS too). Email lower-cased and last name upper-cased on every save, stored; this differs from the suggestion, which upper-cased the last name only at display.

- **UND-003** Phone/address required by group enforced client-side only — **DECIDED**
  - **Statements**: [ACC-REG-003](01-accounts/registration.md)
  - **Current behavior**: Only the registration form requires them (`camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx:186-202`); the API accepts a registration without them (users-auth R5).
  - **Question**: Must the server enforce the group's phone/address requirement?
  - **Options**:
    - (a) server enforcement
    - (b) client only
  - **Suggestion**: Enforce phone/address server-side from the group flags at registration. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The server enforces the group's phone and address requirement at registration.

- **UND-004** Empty password accepted by register API — **DECIDED**
  - **Statements**: [ACC-REG-009](01-accounts/registration.md)
  - **Current behavior**: `register` stores `md5(KEY+'')` and `bcrypt('')` for an empty password; login schema refuses empty (CODE-052; `camap-ts/packages/api-core/src/auth/auth.service.ts:103-120`).
  - **Question**: Must the API reject a password shorter than 8 characters?
  - **Options**:
    - (a) validate server side
    - (b) leave to client
  - **Suggestion**: Keep min 8 in API schema; never accept empty password; import gets no usable hash. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a): the API validates the password server side (min 8, never empty); imported accounts get no usable hash.

- **UND-005** Password trimming differs between Haxe and TS — **DECIDED**
  - **Statements**: [ACC-REG-010](01-accounts/registration.md)
  - **Current behavior**: Haxe trims the password before hashing (`camap-hx/src/db/User.hx:274-281`); TS does not (`camap-ts/packages/api-core/src/tools/crypto.service.ts:22-24`).
  - **Question**: Are leading/trailing spaces part of the password?
  - **Options**:
    - (a) never trim
    - (b) trim everywhere
  - **Suggestion**: Never trim passwords; remove trim from Haxe setPass. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Passwords are never trimmed; the trim is removed from Haxe setPass.

- **UND-006** Registration with an invited group id joins any group — **DECIDED**
  - **Statements**: [ACC-REG-012](01-accounts/registration.md), [ACC-INV-004](01-accounts/invitations.md), [GRP-JOI-003](02-groups/join-quit.md)
  - **Current behavior**: TS register adds the user to the group given as `invitedGroupId` with no `regOption` and no invitation check, whereas Haxe join requires an open group (CODE-004; `camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104`; `camap-hx/src/controller/User.hx:238-239`).
  - **Question**: May a visitor join any group at registration?
  - **Options**:
    - (a) require a valid signed invitation or an open group
    - (b) keep
  - **Suggestion**: Join group only if open or a valid invitation exists for the email. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Registration joins the group only if it is open or a valid invitation exists for the email.

- **UND-007** Old password still works after Haxe reset — **DECIDED**
  - **Statements**: [ACC-PWD-009](01-accounts/password-reset.md), [ACC-LOG-003](01-accounts/login.md)
  - **Current behavior**: Haxe reset writes only the legacy hash; TS checks the bcrypt hash first, so the old password keeps working until the first login with the new one (CODE-005; `camap-hx/src/db/User.hx:274-281`; `camap-ts/packages/api-core/src/auth/auth.service.ts:320-345`).
  - **Question**: Must a reset invalidate the previous password immediately?
  - **Options**:
    - (a) yes, update both hashes
    - (b) accept
  - **Suggestion**: Reset must clear pass2 so the old password stops working. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). A reset clears pass2 so the old password stops working immediately.

- **UND-008** Brute-force ban depends on the client — **DECIDED**
  - **Statements**: [ACC-LOG-005](01-accounts/login.md)
  - **Current behavior**: The failed-login counter is incremented only by a separate mutation called by the React box after a wrong-password error; `login` itself never counts. The IP header is read with a specific case (CODE-023; `camap-ts/packages/api-core/src/auth/auth.service.ts:50-56,280-309`; `LoginBox.tsx:65-68`).
  - **Question**: Must the server count failures itself?
  - **Options**:
    - (a) count in login
    - (b) keep client-driven
  - **Suggestion**: Count failures inside login, committed outside the rolled-back transaction; fix lower-case IP header. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The server counts failed logins inside login, committed outside the rolled-back transaction, and reads the IP header in lower case.

- **UND-009** Password reset does not verify the token on submit — **DECIDED**
  - **Statements**: [ACC-PWD-006](01-accounts/password-reset.md)
  - **Current behavior**: The final step trusts the hidden user id of the form; the token is checked only when the form is displayed (CODE-001; `camap-hx/src/controller/User.hx:174-197`). Anyone who posts the form can set any user's password.
  - **Question**: Must the token be verified on submit?
  - **Options**:
    - (a) verify token and user id on submit
    - (b) keep
  - **Suggestion**: Verify reset token and user id on submit. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The reset token and user id are verified on submit.

- **UND-010** Log-in-as authorisation in GraphQL — **DECIDED**
  - **Statements**: [ACC-IMP-004](01-accounts/impersonation.md), [ACC-IMP-002](01-accounts/impersonation.md)
  - **Current behavior**: The TS `loginAs` check is not awaited and uses the target user; any logged-in user passing a group id can impersonate a non-superadmin member of at most one group (CODE-002; `camap-ts/packages/api-core/src/auth/auth.resolver.ts:126-148`). Haxe check is correct.
  - **Question**: Who may impersonate?
  - **Options**:
    - (a) superadmin or group admin of the target's group (Haxe rule)
    - (b) superadmin only
  - **Suggestion**: Haxe rule, awaited: superadmin, or group manager of a single-group non-admin member. Confidence: high.
  - **Decision** (2026-11-06): Keep the Haxe behaviour (option a). Superadmin, or group manager of a single-group non-admin member, with the check awaited in TS.

- **UND-011** Reset link scheme and lifetime — **DECIDED**
  - **Statements**: [ACC-PWD-012](01-accounts/password-reset.md), [ACC-PWD-002](01-accounts/password-reset.md)
  - **Current behavior**: The reset link uses `http://` and lasts 30 days; other email links use `https://`; TS tokens last 2 weeks (CODE-032; `camap-hx/src/controller/User.hx:163,170`).
  - **Question**: Which lifetime and scheme?
  - **Options**:
    - (a) https and 2 weeks
    - (b) https and shorter (hours)
    - (c) keep
  - **Suggestion**: https link, 24h single-use lifetime. Confidence: low.
  - **Decision** (2026-11-06): Suggestion accepted (variant of option b). Https reset link, 24-hour single-use lifetime.

- **UND-012** Email change without verification — **DECIDED**
  - **Statements**: [ACC-PRO-005](01-accounts/profile.md)
  - **Current behavior**: `updateUser` changes the login email with no password and no verification mail (users-auth R20; `camap-ts/packages/api-core/src/users/users.service.ts:124-147`).
  - **Question**: Must a change of login email be confirmed?
  - **Options**:
    - (a) ask for password
    - (b) verification mail
    - (c) keep
  - **Suggestion**: Ask current password before login email change. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The current password is required before a login email change; no verification mail for now.

- **UND-013** Birth date >= 18 rule only in Haxe — **DECIDED**
  - **Statements**: [ACC-PRO-007](01-accounts/profile.md)
  - **Current behavior**: The 18-year check exists only in the Haxe service; TS profile edit does not apply it (users-auth R21; `camap-hx/src/service/UserService.hx:55-59`).
  - **Question**: Is a minimum age required?
  - **Options**:
    - (a) apply in TS
    - (b) drop the rule
  - **Suggestion**: Drop the 18-year rule; Haxe function has no caller. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option b). The 18-year minimum age rule is dropped; the birth date stays optional.

- **UND-014** Language and which person logged in not set at TS login — **DECIDED**
  - **Statements**: [ACC-LOG-010](01-accounts/login.md), [ACC-LOG-011](01-accounts/login.md)
  - **Current behavior**: TS login does not copy the user language to the session nor sets which of the two persons is logged in (TODO in code) (CODE-118; `camap-ts/packages/api-core/src/auth/auth.service.ts:77`). Haxe pages read both.
  - **Question**: Must login set them?
  - **Options**:
    - (a) set both at login
    - (b) drop the two-person notion
  - **Suggestion**: Set which person logged in at TS login; drop session language copy. Confidence: low.
  - **Decision** (2026-11-06): Suggestion accepted (option a for the person, no language copy). TS login sets which person logged in and no longer tries to copy the language into the session.

- **UND-015** Account deletion continues after a null result — **DECIDED**
  - **Statements**: [ACC-DEL-008](01-accounts/account-deletion.md), [ACC-DEL-005](01-accounts/account-deletion.md), [ACC-DEL-006](01-accounts/account-deletion.md)
  - **Current behavior**: If the placeholder user is missing (or is the user itself) deletion returns null, but the logout and the admin emails still happen (CODE-056; `camap-ts/packages/api-core/src/users/users.resolver.ts:224-246`; `users.service.ts:333-340`). The placeholder `deleted@camap.tld` is not created by any code.
  - **Question**: What happens when deletion cannot proceed?
  - **Options**:
    - (a) stop with an error
    - (b) create the placeholder automatically
  - **Suggestion**: Stop with an error when deletion cannot proceed; seed placeholder user by migration. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Deletion stops with an error when it cannot proceed, with no logout and no admin email; the placeholder is seeded by migration (UND-110). Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).
  - **Impact of UND-110**: the placeholder is now created at install and by a migration, and deletion fails loudly when it is missing. Option (a) follows from the UND-110 decision; confirm to close this point.

- **UND-016** Inactive purge warning rules — **DECIDED**
  - **Statements**: [ACC-PUR-002](01-accounts/inactive-purge.md), [ACC-PUR-004](01-accounts/inactive-purge.md)
  - **Current behavior**: Warnings match the exact day only; users never logged in are never warned but can be deleted after 6 months; the purge runs per-row async callbacks not awaited (CODE-067; `camap-ts/packages/api-core/src/users/users.service.ts:441-604`).
  - **Question**: Are the thresholds (2 years, 6 months, 3 warnings) the policy, and must never-logged users be warned?
  - **Options**:
    - (a) keep thresholds, fix the day match and warn all
    - (b) change thresholds
  - **Suggestion**: Keep thresholds; day-range warnings, warn never-logged users, await per-row work. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour. Thresholds, exact-day warnings, no warning for never-logged users and the un-awaited per-row work stay as they are.

- **UND-017** TS user reads without rights checks — **DECIDED**
  - **Statements**: [ACC-INV-006](01-accounts/invitations.md)
  - **Current behavior**: `user(id)`, `getUsersFromEmails` need only a login; `getInvitedUserToRegister(email)` is public and returns name, phone, address from the cache (CODE-006; `camap-ts/packages/api-core/src/users/users.resolver.ts:62-66,121-140`).
  - **Question**: Who may read other users' data?
  - **Options**:
    - (a) restrict to group managers
    - (b) keep
  - **Suggestion**: Restrict reads to managers; drop unused user(id); invitation lookup by hash. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). User reads restricted to group managers, `user(id)` dropped, invitation lookup by hash.

- **UND-018** Invitation link hash covers only the email — **DECIDED**
  - **Statements**: [ACC-INV-005](01-accounts/invitations.md), [ACC-INV-003](01-accounts/invitations.md)
  - **Current behavior**: `/invite/<hash>/<email>/<group>/<userId>`: hash is `sha1(KEY+email)`; group and user id are unauthenticated, so a valid hash for any email lets a visitor add any user to any group; the session group is set before validation (CODE-003; `camap-hx/src/controller/Main.hx:308-318`).
  - **Question**: Must the signature cover email, group and user?
  - **Options**:
    - (a) sign all parameters
    - (b) keep
  - **Suggestion**: Sign email, group and user in the invite hash, like quit-group key. Confidence: high.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). The invitation hash keeps covering the email only.

- **UND-019** Cookie domain computed differently in Haxe and TS — **DECIDED**
  - **Statements**: [ACC-OUT-003](01-accounts/logout.md), [ACC-SES-009](01-accounts/sessions-tokens.md)
  - **Current behavior**: Haxe strips a leading `app.` from HOST; TS strips only `https://` from CAMAP_HOST; logout clears cookies through a 3-redirect chain (CODE-117; `camap-hx/src/controller/User.hx:84-88`; `camap-ts/packages/api-core/src/auth/auth.service.ts:348-357`).
  - **Question**: Which domain rule applies, and must logout be a single step?
  - **Options**:
    - (a) one shared rule
    - (b) keep both
  - **Suggestion**: One cookie-domain rule (strip scheme and leading app.), single-step logout. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). One cookie-domain rule (strip scheme and leading app.), single-step logout.

- **UND-020** IP/user-agent blacklist guard is never applied — **DECIDED**
  - **Statements**: [ACC-SES-008](01-accounts/sessions-tokens.md)
  - **Current behavior**: The guard (blacklist in a stored variable, rejects "python" agents) exists but is used nowhere (CODE-125; `camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50`).
  - **Question**: Is the blacklist a wanted feature?
  - **Options**:
    - (a) apply it
    - (b) remove it
  - **Suggestion**: Drop the blacklist guard; no caller and not in Haxe. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option b). The blacklist guard is dropped, consistent with UND-115.
  - **Impact of UND-115**: the unused IP blacklist setting is removed (UND-115), which points to option (b), dropping the guard too; confirm to close this point.

- **UND-021** TS login requires an existing Haxe session row — **DECIDED**
  - **Statements**: [ACC-LOG-012](01-accounts/login.md), [ACC-LOG-001](01-accounts/login.md)
  - **Current behavior**: Login fails with "Session not found" if the browser has no session row (CODE-105; `camap-ts/packages/api-core/src/auth/auth.service.ts:40-81`).
  - **Question**: Should login create the session if missing?
  - **Options**:
    - (a) create it
    - (b) keep dependency on Haxe session
  - **Suggestion**: Create the session row at login when missing. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). TS login creates the session row when it is missing.

- **UND-022** Superadmin deletion swallows errors — **DECIDED**
  - **Statements**: [ACC-DEL-009](01-accounts/account-deletion.md), [ADM-TLS-005](08-administration/maintenance-tools.md)
  - **Current behavior**: The admin user delete calls the TS delete through the bridge and swallows errors (users-auth R26; `camap-hx/src/controller/admin/User.hx:44-55`). The bridge route is a state-changing GET (CODE-031).
  - **Question**: Must the admin see why a deletion was refused?
  - **Options**:
    - (a) show error
    - (b) keep
  - **Suggestion**: Show the refusal reason to the admin; bridge delete as POST. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The refusal reason is shown to the superadmin and the bridge delete is a POST.


## Groups (GRP)

- **UND-023** "Full" registration option has no behavior — **DECIDED**
  - **Statements**: [GRP-SET-004](02-groups/group-settings.md)
  - **Current behavior**: The `Full` value exists with a label only; no code path treats it differently from Closed (groups R1; `camap-hx/src/App.hx:304`).
  - **Question**: What does a full group do?
  - **Options**:
    - (a) same as closed
    - (b) show "full" and take waiting-list requests
    - (c) remove option
  - **Suggestion**: Keep Full as a closed state with a "group is full" notice; no join, no waiting list. Confidence: high.
  - **Decision** (2026-11-06): Keep the current behaviour (option a). Full acts as closed, with the existing "group is full" notice on the public page.

- **UND-024** Group creation: superadmin only, page not behind login — **DECIDED**
  - **Statements**: [GRP-CRE-007](02-groups/group-creation.md), [GRP-CRE-006](02-groups/group-creation.md)
  - **Current behavior**: `/group/create` is superadmin only but the method is not `@logged` and dereferences the user; a visitor can trigger an error (CODE-025; `camap-hx/src/controller/Group.hx:132-139`). TS has no creation mutation. The user choice page links to the creation page (CODE-032). New groups use waiting list although the object default is Open (groups R1).
  - **Question**: Is group creation superadmin-only for good, and who creates groups in the future?
  - **Options**:
    - (a) keep superadmin only, add login guard
    - (b) self-service creation
  - **Suggestion**: Keep group creation superadmin-only; add the login guard before the admin test. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Group creation stays superadmin-only and the page checks login before the superadmin right.

- **UND-025** No way to disable a group — **DECIDED**
  - **Statements**: [GRP-DSB-005](02-groups/group-disabled.md), [ADM-GRP-006](08-administration/admin-groups.md)
  - **Current behavior**: `Group.disabled` is read by Haxe and TS but written by no application code; it is set through the database or the raw DB admin (groups R5; CODE-106; `camap-ts/packages/api-core/src/migrations/1741445966001-group-disabled.ts`).
  - **Question**: Must a superadmin be able to set it from the UI?
  - **Options**:
    - (a) add UI/mutation
    - (b) keep DB-only
    - (c) remove the feature
  - **Suggestion**: Add a superadmin-only mutation to set or clear the disabled reason. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). Groups are disabled in the database only; no UI or mutation is added.

- **UND-026** Open-group page stores the group for anonymous visitors — **DECIDED**
  - **Statements**: [GRP-PUB-005](02-groups/group-public-page.md)
  - **Current behavior**: Opening `/group/<id>` of an open group writes the group in the session even for visitors (CODE-024; `camap-hx/src/controller/Group.hx:25-36`). Used as the first step of the join flow.
  - **Question**: Is remembering the group for visitors intended?
  - **Options**:
    - (a) keep for the join flow
    - (b) pass the group through the redirect instead
  - **Suggestion**: Keep the open group in the visitor session (anonymous shop browsing relies on it). Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The open group stays stored in the visitor session (join flow and anonymous shop browsing).

- **UND-027** Quit-group rules differ; hard-coded group — **DECIDED**
  - **Statements**: [GRP-JOI-008](02-groups/join-quit.md), [GRP-JOI-010](02-groups/join-quit.md)
  - **Current behavior**: Haxe refuses when orders exist in active catalogs (or ended less than a month ago); TS refuses on any user order less than 1 month old. TS also forbids quitting group 16936 (hard-coded) (CODE-100; `camap-hx/src/controller/User.hx:272-302`; `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:124-147`).
  - **Question**: Which "recent order" rule applies and is group 16936 special?
  - **Options**:
    - (a) Haxe rule
    - (b) TS rule
    - (c) drop the special group
  - **Suggestion**: Use the Haxe distribution-based recent-orders rule; drop hard-coded group 16936. Confidence: medium.
  - **Decision** (2026-11-06): Haxe rule (option a) for recent orders, but the hard-coded group 16936 exception is kept (not option c).

- **UND-028** Member removal checks differ — **DECIDED**
  - **Statements**: [GRP-MEM-006](02-groups/members.md), [GRP-MEM-007](02-groups/members.md), [GRP-MEM-005](02-groups/members.md)
  - **Current behavior**: Haxe requires a CSRF token and an explicit confirmation when the member has orders; TS removal checks no orders or balance. TS batch removal keeps null entries and splices inside the loop (CODE-055; `camap-hx/src/controller/Member.hx:116-135`; `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:61-108`).
  - **Question**: Must removing a member with orders or a balance be blocked or confirmed?
  - **Options**:
    - (a) apply Haxe confirmation in TS
    - (b) block
    - (c) keep
  - **Suggestion**: Apply the Haxe confirmation for members with orders; fix batch removal loop. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The Haxe confirmation for members with orders applies in TS, and the batch removal loop is fixed.

- **UND-029** TS member and waiting lists lack per-group rights checks — **DECIDED**
  - **Statements**: [GRP-MEM-002](02-groups/members.md), [GRP-WAI-004](02-groups/waiting-list.md)
  - **Current behavior**: `getUserLists`, `getContractsUserLists`, `getDistributionsUserLists`, `getWaitingListsOfGroup` require a login only; any logged-in user can read another group's lists (CODE-006; `camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts`, `waitingLists.resolver.ts:40-45`).
  - **Question**: Who may read member and waiting lists?
  - **Options**:
    - (a) membership right (or group admin) only
    - (b) keep
  - **Suggestion**: Require the membership right on the requested group for member and waiting lists. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Member and waiting lists require the membership right (or group admin, or superadmin) on the requested group.

- **UND-030** Rights editor edge cases — **DECIDED**
  - **Statements**: [GRP-RIG-009](02-groups/rights.md), [GRP-RIG-010](02-groups/rights.md), [GRP-RIG-008](02-groups/rights.md)
  - **Current behavior**: The self-lockout test runs after each right was already saved; a selected non-member user crashes the editor; both checkbox groups share the name "rights" (CODE-029; `camap-hx/src/controller/AmapAdmin.hx:115,147,155-179`). No TS mutation edits rights.
  - **Question**: Must the editor be transactional and validate its input?
  - **Options**:
    - (a) validate before saving
    - (b) keep
  - **Suggestion**: Validate non-member and self-lockout before any write, in one transaction. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Reject a non-member and run the self-lockout test before any write, in one transaction.

- **UND-031** Rights semantics differ between Haxe and TS — **DECIDED**
  - **Statements**: [GRP-RIG-004](02-groups/rights.md), [GRP-RIG-005](02-groups/rights.md), [GRP-RIG-006](02-groups/rights.md), [GRP-RIG-002](02-groups/rights.md)
  - **Current behavior**: Haxe "all catalogs" = a right with no catalog list; TS = any catalog-coordinator right. TS applies vendor auto rights only when managing one catalog; TS treats a superadmin as a member everywhere, Haxe does not; the superadmin test is written in two ways in TS (CODE-028; `camap-hx/src/db/User.hx:191-195,342-344`; `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-171`).
  - **Question**: Which semantics are the rule?
  - **Options**:
    - (a) Haxe semantics
    - (b) TS semantics
  - **Suggestion**: Keep Haxe semantics: no-list coordinator right = all catalogs; superadmin not a member. Confidence: medium.
  - **Decision** (2026-11-06): Mixed. Haxe semantics for catalogs (no-list coordinator right = all catalogs; vendor auto rights per claimed catalog); TS behaviour for superadmin (treated as a member of every group, Haxe aligned).

- **UND-032** Membership fee range — **DECIDED**
  - **Statements**: [GRP-COT-002](02-groups/membership.md), [GRP-COT-006](02-groups/membership.md)
  - **Current behavior**: The fee is a tiny integer (max 127) on both sides; a fee of 0 given to a membership is replaced by the group fee (CODE-051, CODE-038; `camap-ts/packages/api-core/src/groups/entities/group.entity.ts:54-58`; `memberships.service.ts:97-133`).
  - **Question**: Is a free membership or a fee above 127 possible?
  - **Options**:
    - (a) widen type, allow 0
    - (b) keep
  - **Suggestion**: Widen the fee type; allow empty or 0 (free) explicitly. Confidence: medium.
  - **Decision** (2026-11-06): Widen the fee type and accept any non-zero value (variant of option a: 0 is not accepted as a free membership). The group cotisation is managed another way, to be specified.

- **UND-033** Membership creation gaps — **DECIDED**
  - **Statements**: [GRP-COT-008](02-groups/membership.md), [GRP-COT-009](02-groups/membership.md), [GRP-COT-006](02-groups/membership.md), [GRP-COT-007](02-groups/membership.md), [GRP-COT-010](02-groups/membership.md)
  - **Current behavior**: The payment type input is ignored (always cash), the user is not checked to belong to the group, and batch creation relies on the database returning users in input order (CODE-038; `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:97-133,224`).
  - **Question**: Must the payment type be honoured and the group membership checked?
  - **Options**:
    - (a) fix both
    - (b) keep cash only
  - **Suggestion**: Honour the payment type and check the user belongs to the group. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Honour the payment type, check the user belongs to the group, and map batch results on user id.

- **UND-034** Move member back to waiting list — **DECIDED**
  - **Statements**: [GRP-WAI-007](02-groups/waiting-list.md), [GRP-WAI-011](02-groups/waiting-list.md)
  - **Current behavior**: Haxe action has no CSRF token and no explicit rights check; TS does not reject people already in the waiting list and has splice-in-loop misalignment (CODE-025, CODE-055; `camap-hx/src/controller/Member.hx:213-223`; `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:78-83`).
  - **Question**: Which checks apply?
  - **Options**:
    - (a) Haxe duplicate check and CSRF + right in both
    - (b) keep
  - **Suggestion**: Reject users already on the waiting list; require the membership right; fix splice. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Reject users already on the waiting list, require the membership right and the token in both stacks, keep the Haxe self and admin checks, fix the splice.

- **UND-035** "Valid membership" ignores the enabled flag — **DECIDED**
  - **Statements**: [GRP-COT-005](02-groups/membership.md)
  - **Current behavior**: A membership is valid if the group has a renewal date and a row exists for the current year; the "memberships enabled" flag is not consulted, yet the membership lists return empty when it is off (groups R16; `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:198-212`).
  - **Question**: Does the enabled flag gate validity?
  - **Options**:
    - (a) yes
    - (b) no
  - **Suggestion**: Gate membership validity on memberships being enabled. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Membership validity is gated on memberships being enabled.

- **UND-036** "New member" detection differs — **DECIDED**
  - **Statements**: [GRP-MEM-010](02-groups/members.md)
  - **Current behavior**: Haxe treats an empty password as new; TS uses a missing last-login date, and TS-created members never have an empty password (CODE-101; `camap-hx/src/db/User.hx:495-505`; `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:177-200`). Nothing in Haxe writes the last-login date.
  - **Question**: Which definition?
  - **Options**:
    - (a) never logged in
    - (b) no password yet
  - **Suggestion**: New member = never logged in (empty last-login date). Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). A new member is one who never logged in (empty last-login date).


## Catalogs (CAT)

- **UND-037** Percentage fees on orders: disabled in Haxe, honoured in TS — **DECIDED**
  - **Statements**: [CAT-CCR-014](03-catalogs/catalog-creation.md), [CAT-PPR-005](03-catalogs/product-pricing.md), [ORD-OPL-015](05-orders/order-placement.md), [ORD-AMT-002](05-orders/order-amounts.md)
  - **Current behavior**: Haxe removed the percentage fields from the catalog form and the check always returns false (banner "removal 1 Feb 2023"); TS still applies the flag and the percentage in the displayed product price (CODE-097; `camap-hx/src/db/Catalog.hx:128-131`, `camap-hx/src/controller/ContractAdmin.hx:83-88`; `camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:146-178`, `products.resolver.ts:100-112`).
  - **Question**: Do percentage fees still exist?
  - **Options**:
    - (a) removed everywhere
    - (b) kept everywhere
  - **Suggestion**: Remove percentage fees everywhere; keep the Haxe "no fee" rule. Confidence: high.
  - **Decision** (2026-11-06): Percentage fees are deactivated everywhere without being removed from the data model (variant of option a: no field, no fee applied, stored flag and percentage ignored). Existing order lines with a non-zero fee rate are still honoured.

- **UND-038** Product edit rewrites stock rows before validation — **DECIDED**
  - **Statements**: [CAT-PRD-015](03-catalogs/products.md)
  - **Current behavior**: The edit action rewrites the stock rows first, then runs the frozen-field and validation checks; rollback on error is unverified (CODE-043; `camap-hx/src/controller/Product.hx:70-76`; `camap-hx/src/service/ProductService.hx:150`).
  - **Question**: Must a failed edit leave stock unchanged?
  - **Options**:
    - (a) validate first
    - (b) rely on transaction rollback
  - **Suggestion**: Validate first, then rewrite the stock rows. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Validate first, then rewrite the stock rows.

- **UND-039** HX REST catalog/product reads and product export have no rights check — **DECIDED**
  - **Statements**: [CAT-CLV-009](03-catalogs/catalog-list-view.md), [CAT-PCS-002](03-catalogs/product-csv.md)
  - **Current behavior**: `/api/catalog/:id`, `/api/product/*` need no login (the product list also returns inactive products); `/product/export` checks no right (CODE-016; `camap-hx/src/controller/api/Catalog.hx:14`, `api/Product.hx:13-27`, `Product.hx:286-290`).
  - **Question**: Who may read these?
  - **Options**:
    - (a) members of the group (export: coordinators)
    - (b) keep public for the shop
  - **Suggestion**: Product export needs canManageContract. REST reads need group membership. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Product export needs the catalog management right; REST reads need group membership and hide inactive products.

- **UND-040** Batch product enable/disable scope — **DECIDED**
  - **Statements**: [CAT-PRD-008](03-catalogs/products.md)
  - **Current behavior**: The catalog is derived from the first product id; rights are checked on the URL catalog; the service verifies that all ids belong to that catalog but the audit found a cross-catalog path (CODE-017; `camap-hx/src/service/ProductService.hx:14-48`, `camap-hx/src/controller/ContractAdmin.hx:258-285`).
  - **Question**: Confirm the batch is bound to the URL catalog
  - **Options**:
    - (a) bind to URL catalog and reject foreign ids
    - (b) keep
  - **Suggestion**: Bind batch enable/disable to the URL catalog and reject foreign ids. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a): the batch is bound to the catalog in the URL and foreign product ids are rejected.

- **UND-041** Vendor phone and email exposure — **DECIDED**
  - **Statements**: [CAT-VEN-010](03-catalogs/vendors.md)
  - **Current behavior**: TS field resolvers call the async rights check without awaiting it, so phone and email are exposed whatever the vendor's privacy settings (CODE-007; `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:456-467`). Haxe honours show-email/show-phone.
  - **Question**: Must privacy flags be honoured?
  - **Options**:
    - (a) honour flags (managers always see)
    - (b) always public
  - **Suggestion**: Honour show-email and show-phone; await the rights check. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Honour show-email and show-phone; await the rights check.

- **UND-042** Catalog and vendor documents leak through un-awaited checks — **DECIDED**
  - **Statements**: [CAT-DOC-005](03-catalogs/documents-files.md)
  - **Current behavior**: The TS catalog `documents` field always returns every document because the rights check is not awaited and its arguments are swapped; vendor documents are returned unfiltered (CODE-008; `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:173-193`, `vendors.resolver.ts:438-449`).
  - **Question**: Must visibility apply in TS?
  - **Options**:
    - (a) apply Haxe visibility rules
    - (b) keep
  - **Suggestion**: Apply Haxe document visibility in TS; await check, fix swapped args. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Apply the Haxe document visibility rules in TS; await the check and fix the swapped arguments.

- **UND-043** TS queries without guard or rights check — **DECIDED**
  - **Statements**: [CAT-CLV-010](03-catalogs/catalog-list-view.md), [CAT-PRD-018](03-catalogs/products.md), [CAT-VEN-012](03-catalogs/vendors.md), [CAT-PLC-010](03-catalogs/places.md), [CAT-PLC-009](03-catalogs/places.md)
  - **Current behavior**: `getVendorsFromCompanyNumber`, `getVendorProfessions`, `place`, `vendorProductsSample`, and the catalog fields `products` and `subscriptions` have no guard or no management check (CODE-021, CODE-022; `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:144,151`, `places.resolver.ts:10`, `products.resolver.ts:179`, `catalogs.resolver.ts:141-149`).
  - **Question**: Which of these must be public, logged-in or restricted?
  - **Options**:
    - (a) require login or right
    - (b) keep public
  - **Suggestion**: Require login; restrict subscriptions to managers, products to members, place to its group. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Login required on all these queries; subscriptions restricted to managers and the subscriber, products to group members or managers, place to members of its group.

- **UND-044** Geocoding differs between Haxe and TS — **DECIDED**
  - **Statements**: [CAT-VEN-004](03-catalogs/vendors.md), [CAT-PLC-004](03-catalogs/places.md), [CAT-VDB-004](03-catalogs/vendor-pages.md)
  - **Current behavior**: Haxe geocodes vendors on every save (a failure blocks the save) and places only on edit (warning only); TS `updateVendor` never geocodes and trusts the latitude/longitude typed by the user (CODE-098; `camap-hx/src/service/VendorService.hx:137-142`, `camap-hx/src/controller/Place.hx:50-56,79-82`; `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277`).
  - **Question**: Who geocodes and is a failure blocking?
  - **Options**:
    - (a) server side always
    - (b) client supplies coordinates
  - **Suggestion**: Geocode server-side on address change; vendor failure blocks, place failure warns. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Server-side geocoding on address change or missing coordinates; a vendor failure blocks, a place failure warns; places are also geocoded on creation.

- **UND-045** Country rules for places — **DECIDED**
  - **Statements**: [CAT-PLC-003](03-catalogs/places.md)
  - **Current behavior**: Creation is allowed only for France and Belgium, the form offers 8 countries, the front address search covers 13 country codes (`camap-hx/src/controller/Place.hx:75-77`, `camap-hx/src/db/Place.hx:113-125`, `camap-ts/packages/front-core/src/utils/mapbox-geocoding.ts:24-25`).
  - **Question**: Which countries are supported?
  - **Options**:
    - (a) FR+BE
    - (b) all offered
    - (c) the 13 territories
  - **Suggestion**: Allow only France and Belgium; trim the form. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour. Creation stays limited to France and Belgium; the 8-country form and the 13-code address search are unchanged.

- **UND-046** Upload size limit stated differently — **DECIDED**
  - **Statements**: [CAT-DOC-009](03-catalogs/documents-files.md)
  - **Current behavior**: Upload cap is 4 MB while the comment and labels say 3 MB ("3 Mo"); the TS front compresses to max 3 MB (CODE-072; `camap-hx/src/controller/Media.hx:97`, `camap-ts/packages/front-core/src/modules/imageUploader/ImageUploader.tsx:189-190`).
  - **Question**: What is the real limit?
  - **Options**:
    - (a) 3 MB
    - (b) 4 MB
  - **Suggestion**: Limit is 3 MB; set the server cap to 3 MB. Confidence: high.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). The real limit is the 4 MB server cap; labels saying 3 MB are corrected to 4 MB.

- **UND-047** Catalog delete: what is deleted with it — **DECIDED**
  - **Statements**: [CAT-CDD-006](03-catalogs/catalog-duplicate-delete.md)
  - **Current behavior**: The Haxe comment says products, orders and distributions are deleted too; the code deletes only the volunteer roles and the catalog, cascade presumably done by the database and unverified (`camap-hx/src/controller/ContractAdmin.hx:1166-1204`).
  - **Question**: What must deletion remove?
  - **Options**:
    - (a) catalog with products and distributions (blocked if ordered)
    - (b) forbid deletion, only archive
  - **Suggestion**: Delete only if no order quantity; delete products, distributions and roles explicitly. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour. Deletion stays as it is (hard delete, blocked by ordered quantities, cascade left to the database). A post-migration task is created to make catalogs soft-deleted (see POST-MIGRATION-TASKS.md).

- **UND-048** Vendor claim crashes without secondary email — **DECIDED**
  - **Statements**: [CAT-VCL-003](03-catalogs/vendor-claim.md)
  - **Current behavior**: `email2.toLowerCase()` throws when the user has no secondary email (CODE-074; `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:76`).
  - **Question**: Bug fix confirmation
  - **Options**:
    - (a) fix
    - (b) none
  - **Suggestion**: Fix the crash: null-safe email2 comparison. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Null-safe comparison of the secondary email.

- **UND-049** Multi-weight without variable price — **DECIDED**
  - **Statements**: [CAT-PRD-011](03-catalogs/products.md)
  - **Current behavior**: The rule "multi-weight implies variable price" is commented out, so multi-weight alone is allowed (`camap-hx/src/db/Product.hx:285-289`).
  - **Question**: Is multi-weight allowed alone?
  - **Options**:
    - (a) require variable price
    - (b) allow
  - **Suggestion**: Allow multi-weight without variable price (rule deliberately commented out). Confidence: high.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). Multi-weight is allowed without variable price.

- **UND-050** Price refresh crashes on constant catalogs — **DECIDED**
  - **Statements**: [CAT-CED-013](03-catalogs/catalog-edit.md), [CAT-CED-012](03-catalogs/catalog-edit.md)
  - **Current behavior**: The refresh action dereferences a distribution argument that is set only for variable catalogs (CODE-063; `camap-hx/src/controller/ContractAdmin.hx:758-775`).
  - **Question**: Is price refresh meant for constant catalogs?
  - **Options**:
    - (a) fix
    - (b) variable only
  - **Suggestion**: Fix: skip the distribution arg and redirect without ?d for constant catalogs. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Price refresh is fixed for constant catalogs: no distribution argument, redirect without ?d.

- **UND-051** Place actions lack explicit rights checks — **DECIDED**
  - **Statements**: [CAT-PLC-006](03-catalogs/places.md)
  - **Current behavior**: Only delete requires a group manager; list, create and edit have no explicit check in the controller (parent guard unverified) (`camap-hx/src/controller/Place.hx:18-93`).
  - **Question**: Who may manage places?
  - **Options**:
    - (a) group managers
    - (b) group admin and coordinators
  - **Suggestion**: Group managers only; require isAmapManager and same-group place. Confidence: high.
  - **Decision** (2026-11-06): Keep the current behaviour. Only delete requires a group manager; list, create and edit keep no explicit check and no same-group check is added.

- **UND-052** No way to disable a vendor — **DECIDED**
  - **Statements**: [CAT-VEN-009](03-catalogs/vendors.md)
  - **Current behavior**: The disabled state is read by Haxe and TS; ban/unban exist as service functions in TS with no resolver or Haxe page found (`camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:196-207`).
  - **Question**: Must a superadmin disable a vendor from the UI?
  - **Options**:
    - (a) add UI
    - (b) DB only
  - **Suggestion**: Add superadmin-only ban/unban mutations reusing the existing service. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). Vendors are disabled in the database only; no UI or mutation is added.

- **UND-053** "PDF only" checked by file name only — **DECIDED**
  - **Statements**: [CAT-DOC-006](03-catalogs/documents-files.md)
  - **Current behavior**: Haxe and TS check only that the name ends with .pdf (CODE-033; `camap-hx/src/controller/Documents.hx:148`, `entity-file.resolver.ts:66`); visibility option lists differ (CODE-099).
  - **Question**: Is a content check needed?
  - **Options**:
    - (a) check content type
    - (b) keep
  - **Suggestion**: Check the %PDF- signature in both stacks. Confidence: high.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). Only the .pdf file name is checked, not the content.

- **UND-054** Catalog edit overwrites custom order dates — **DECIDED**
  - **Statements**: [CAT-CED-004](03-catalogs/catalog-edit.md)
  - **Current behavior**: Changing the opening or closing delay rewrites the order window of all future distributions of the catalog (`camap-hx/src/service/CatalogService.hx:238-269`).
  - **Question**: Must custom per-distribution dates be preserved?
  - **Options**:
    - (a) only update non-customised
    - (b) keep
  - **Suggestion**: Keep the overwrite with its warning, only when a delay changed. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). The overwrite of custom order dates stays, with its warning.


## Distributions (DIS)

- **UND-055** Time zone handling differs between Haxe and TS — **DECIDED**
  - **Statements**: [DIS-MDS-012](04-distributions/multidistrib-schedule.md)
  - **Current behavior**: The database stores Paris wall-clock times; TS entities convert with a zone library, but some TS finders compare raw columns with unconverted dates; the catalog dates are plain dates without conversion; tests run in UTC (CODE-096; `camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:50-115`, `camap-ts/packages/api-core/src/vendors/entities/catalog.entity.ts:39-66`).
  - **Question**: Which time zone convention is the rule (stored, transported, displayed)?
  - **Options**:
    - (a) store UTC, display in group zone
    - (b) keep Paris wall-clock
  - **Suggestion**: Keep Paris wall-clock storage; wrap raw-column comparisons with utcToZonedTime. Confidence: high.
  - **Decision** (2026-11-04): Suggestion accepted. Paris wall-clock storage is kept and raw-column comparisons are wrapped with `utcToZonedTime` (option b).

- **UND-056** Daylight-saving boundaries hard-coded — **DECIDED**
  - **Statements**: [DIS-MDS-013](04-distributions/multidistrib-schedule.md)
  - **Current behavior**: The Haxe JSON API appends +01:00 or +02:00 using fixed dates every year ("29 March 02:00" and "25 October 03:00"); a date tool has a table for 2019 to 2024 only and throws outside it (no call site found) (CODE-081; `camap-hx/common/Formatting.hx:226-255`, `camap-hx/src/tools/DateTool.hx:10-35,93-139`).
  - **Question**: Must DST follow the real calendar?
  - **Options**:
    - (a) use a time zone library
    - (b) keep
  - **Suggestion**: Follow the real DST calendar (last Sunday March/October) or use a tz library. Confidence: high.
  - **Decision** (2026-11-04): Suggestion accepted (option a). Time-zone library, real DST calendar.

- **UND-057** "Validated" state of a session is dead — **DECIDED**
  - **Statements**: [DIS-OWS-005](04-distributions/order-window-state.md)
  - **Current behavior**: The session state never returns "validated" but a template branches on it, another template hard-codes dates in March 2021, and TS declares a VALIDATED status exposed by no field (`camap-hx/src/db/MultiDistrib.hx:260-280`, `camap-hx/lang/master/tpl/distribution/default.mtt:129,184`, `camap-ts/packages/api-core/src/shop/multi-distrib-status.ts:1-7`).
  - **Question**: Does a validation step exist for a session?
  - **Options**:
    - (a) remove the state
    - (b) implement validation
  - **Suggestion**: Remove the dead "validated" session/basket state. Confidence: high.
  - **Decision** (2026-11-04): Keep the current behaviour (no validation step). The dead "validated" state stays, only for Haxe/DB compatibility; no impact on other statements.

- **UND-058** Redirect to a missing validation page — **DECIDED**
  - **Statements**: [DIS-PAR-012](04-distributions/distribution-participation.md)
  - **Current behavior**: After a price change (and from several buttons of the distribution page) the user is redirected to `/distribution/validate/<id>`, which has no handler (CODE-083; `camap-hx/src/controller/Distribution.hx:1096,1144`).
  - **Question**: Where must the user land?
  - **Options**:
    - (a) back to the distributions page
    - (b) implement the validation page
  - **Suggestion**: Redirect to /distribution like sibling actions; drop validate buttons. Confidence: high.
  - **Decision** (2026-11-04): Suggestion accepted (option a). Redirect to `/distribution` and remove the validate buttons.

- **UND-059** Session edit and price change not scoped to the user's group — **DECIDED**
  - **Statements**: [DIS-MDS-009](04-distributions/multidistrib-schedule.md)
  - **Current behavior**: `editMd` and `changePrice` check the section right but do not compare the session with the user's group, and the posted place is not checked against the group (CODE-011; `camap-hx/src/controller/Distribution.hx:614-678,1106-1151`; `camap-hx/src/service/DistributionService.hx:194-248`).
  - **Question**: Must these be limited to the current group?
  - **Options**:
    - (a) yes
    - (b) keep
  - **Suggestion**: Reject sessions and places outside the user's group. Confidence: high.
  - **Decision** (2026-11-04): Keep the current behaviour (option b). Session edit and price change stay unscoped to the user's group.

- **UND-060** Distribution handlers without explicit rights checks — **DECIDED**
  - **Statements**: [DIS-PAR-008](04-distributions/distribution-participation.md), [DIS-VOL-009](04-distributions/volunteers.md), [DIS-ATT-011](04-distributions/attendance-sheets.md)
  - **Current behavior**: `inviteFarmers`, `volunteerRoles`, `volunteers`, `listByProductUser`, `participate` and role edit/delete have no explicit right check, or do not verify that the object belongs to the group or catalog (CODE-019; `camap-hx/src/controller/Distribution.hx:78,479,873,937`, `camap-hx/src/controller/ContractAdmin.hx:221-249,1001-1011`).
  - **Question**: Which right guards each action?
  - **Options**:
    - (a) coordinator of the catalog or group admin as appropriate
    - (b) keep
  - **Suggestion**: Guard handlers with catalog or section rights plus object-belongs-to-group checks. Confidence: high.
  - **Decision** (2026-11-04): Keep the current behaviour (option b). No explicit rights checks are added to these handlers. UND-065 is amended accordingly: role edit/delete get no new rights checks.

- **UND-061** TS distribution reads without authentication or membership — **DECIDED**
  - **Statements**: [DIS-MDS-015](04-distributions/multidistrib-schedule.md)
  - **Current behavior**: `distribution(id)` and `Distribution.userOrders` need no login (the user orders of a distribution are readable by anyone); `multiDistribution(id)` needs only a login (CODE-010, CODE-018; `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:19-33,96-104`, `multi-distribs.resolver.ts:62-74`).
  - **Question**: Who may read a distribution and its orders?
  - **Options**:
    - (a) group members (orders: self or managers)
    - (b) keep
  - **Suggestion**: Require login and group membership; user orders for owner or managers. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Login and group membership are required; user orders are visible only to the owner and managers. Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).

- **UND-062** Variable-orders attendance without rights check — **DECIDED**
  - **Statements**: [DIS-ATT-007](04-distributions/attendance-sheets.md)
  - **Current behavior**: `attendanceVariableContract` needs only a login, while the classic one needs a right (CODE-009; `camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:90-138`).
  - **Question**: Same access rule as the classic sheet?
  - **Options**:
    - (a) same rule
    - (b) keep
  - **Suggestion**: Apply the classic attendance rule: manager of all/catalog or session volunteer. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The variable-orders sheet uses the classic attendance rule. Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).

- **UND-063** Cycles: half-implemented — **DECIDED**
  - **Statements**: [DIS-CYC-004](04-distributions/cycles.md), [DIS-CYC-008](04-distributions/cycles.md)
  - **Current behavior**: Cycle validation is commented out; generation aborts at the first same-day/same-place conflict with no per-occurrence handling and sessions already created stay; cycle edit, cycle insert and invite-vendors-to-cycle are empty or "coming soon" stubs (`camap-hx/src/service/DistributionService.hx:664-790`, `camap-hx/src/controller/Distribution.hx:399,549,684`).
  - **Question**: What must a cycle conflict do, and which cycle features are in scope?
  - **Options**:
    - (a) skip conflicting dates and report
    - (b) all-or-nothing
    - (c) drop stubs
  - **Suggestion**: Skip and report conflicting dates; drop the cycle stubs. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). A conflict aborts the cycle generation; the stubs stay.

- **UND-064** Volunteer self-registration: GET with side effect, weak checks — **DECIDED**
  - **Statements**: [DIS-VOL-004](04-distributions/volunteers.md), [DIS-VOL-005](04-distributions/volunteers.md), [DIS-VOL-003](04-distributions/volunteers.md)
  - **Current behavior**: Registering is a GET on the calendar page with parameters; the only server check is that the role is not filled; the opening period, the role belonging to the session and the user belonging to the group are not checked server side; a user may hold several roles on the same session (`camap-hx/src/controller/Distribution.hx:993-1002`, `camap-hx/src/service/VolunteerService.hx:86-111`).
  - **Question**: Which checks and which method?
  - **Options**:
    - (a) POST with all checks
    - (b) keep
  - **Suggestion**: Register by POST with token and all checks; keep several roles allowed. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Registration is a POST with token and all checks; several roles stay allowed.

- **UND-065** Role editing consequences and scoping — **DECIDED**
  - **Statements**: [DIS-ROL-004](04-distributions/volunteer-roles.md), [DIS-ROL-010](04-distributions/volunteer-roles.md)
  - **Current behavior**: Editing a group-wide role with "enabled by default" off removes the role and its volunteers from all future sessions; the edit forces a group-wide role and works on any role id; handlers read the session role list before the future-date guard (CODE-064; `camap-hx/src/controller/amapadmin/Volunteers.hx:121-170`, `camap-hx/src/controller/ContractAdmin.hx:203,221-249`). Volunteers on roles removed by cancelling a participation are not deleted explicitly (cascade unverified).
  - **Question**: What happens to registered volunteers and who may edit which role?
  - **Options**:
    - (a) refuse or confirm
    - (b) keep
  - **Suggestion**: Confirm/force before removing volunteers; add rights checks on role edit/delete. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Removing registered volunteers needs a confirmation ("force"); role edit and delete check rights on the role's catalog or group.
  - **Decision amended** (2026-11-04): The rights checks on role edit and delete are dropped (see UND-060); only the confirmation before removing registered volunteers stays.

- **UND-066** "Vacant roles" count — **DECIDED**
  - **Statements**: [DIS-VOL-011](04-distributions/volunteers.md)
  - **Current behavior**: "Has vacant roles" compares the number of roles with the total number of volunteer rows of the session (`camap-hx/src/db/MultiDistrib.hx:419-428`).
  - **Question**: Vacant means at least one role without volunteer?
  - **Options**:
    - (a) per role
    - (b) keep total comparison
  - **Suggestion**: Vacant when at least one role has no volunteer, per role. Confidence: high.
  - **Decision** (2026-11-04): Suggestion accepted (option a). Vacancy is decided per role.


## Orders (ORD)

- **UND-067** Member subscription creation runs in admin mode — **DECIDED**
  - **Statements**: [ORD-SUB-010](05-orders/subscription-create.md)
  - **Current behavior**: The REST create always forces admin mode, bypassing the "catalog open", "start not before next open distribution" and "constant: no past distribution without order" checks; only an open-orders test and the computed start remain. Group-manager test uses the session group while catalog rights use the catalog's group (CODE-078, CODE-047; `camap-hx/src/controller/api/Subscription.hx:35-50`, `camap-hx/src/service/SubscriptionService.hx:363,378,475`).
  - **Question**: Which checks must apply to a member creating their own subscription?
  - **Options**:
    - (a) member mode with all checks
    - (b) keep admin mode with compensating guards
  - **Suggestion**: Member mode with all checks; admin mode only for admin or catalog manager. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Members subscribe in member mode with all checks; admin mode is only for admins or coordinators of the catalog, checked on the catalog's group.

- **UND-068** Subscription read without login or ownership check — **DECIDED**
  - **Statements**: [ORD-SUB-016](05-orders/subscription-create.md)
  - **Current behavior**: `GET /api/subscription/:id` has no login or ownership check (CODE-013; `camap-hx/src/controller/api/Subscription.hx:27-58`).
  - **Question**: Who may read a subscription?
  - **Options**:
    - (a) owner, coordinator, group admin
    - (b) keep
  - **Suggestion**: Read subscription only as owner, catalog coordinator or admin, login required. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Login is required; only the owner, a coordinator of the catalog or an admin can read a subscription.

- **UND-069** History pages: no ownership check, read page that writes — **DECIDED**
  - **Statements**: [ORD-HIS-005](05-orders/order-history.md), [ORD-HIS-006](05-orders/order-history.md)
  - **Current behavior**: `/history/basket`, `/subscriptionOrders` and `/subscriptionPayments` take any id with only a membership test; the payments page also refreshes the total operation (CODE-012; `camap-hx/src/controller/History.hx:64-121`).
  - **Question**: Must these be limited to the owner?
  - **Options**:
    - (a) owner only
    - (b) keep
  - **Suggestion**: Limit history pages to owner/coordinator/admin; make payments page read-only. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). History pages are limited to the owner, a coordinator of the catalog or an admin; the payments page is read-only.

- **UND-070** Member subscription delete is a GET without token — **DECIDED**
  - **Statements**: [ORD-SUB-018](05-orders/subscription-create.md)
  - **Current behavior**: The member deletion link is a GET with no CSRF token (the admin route has one) (CODE-020; `camap-hx/src/controller/Subscriptions.hx:35-44`; `camap-ts/packages/front-core/src/modules/csaCatalog/containers/CsaCatalogSubscription.tsx:192-198`).
  - **Question**: Must deletion be a protected POST?
  - **Options**:
    - (a) yes
    - (b) keep
  - **Suggestion**: Member deletion becomes a confirmed POST with CSRF token. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Member deletion is a confirmed POST with a CSRF token.

- **UND-071** Payment insertion uses a weak right check — **DECIDED**
  - **Statements**: [ORD-SBM-012](05-orders/subscription-admin.md), [PAY-ENT-004](06-payments/payment-entry.md), [PAY-ENT-005](06-payments/payment-entry.md)
  - **Current behavior**: `insertPayment` checks `isContractManager()` without a catalog, so any manager of any catalog passes (CODE-014; `camap-hx/src/controller/SubscriptionAdmin.hx:420-466`).
  - **Question**: Must the check be on the subscription's catalog?
  - **Options**:
    - (a) yes
    - (b) keep
  - **Suggestion**: Check canManageContract on the subscription's catalog when recording payment. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Recording a payment requires managing the subscription's catalog, for a member of the group.

- **UND-072** Stock clamp differs between order creation and edit — **DECIDED**
  - **Statements**: [ORD-OPL-007](05-orders/order-placement.md)
  - **Current behavior**: Creation writes the available stock; edit writes the available stock times the product quantity and tests multi-weight with the old quantity; an error is still raised after clamping (CODE-040; `camap-hx/src/service/OrderService.hx:116-135,199-222`).
  - **Question**: Which clamp rule and unit?
  - **Options**:
    - (a) creation rule everywhere
    - (b) edit rule everywhere
  - **Suggestion**: Creation clamp rule everywhere: available stock in order units. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The creation clamp rule (available stock in order units) applies everywhere.

- **UND-073** Order window not enforced by the server — **DECIDED**
  - **Statements**: [ORD-OPL-010](05-orders/order-placement.md)
  - **Current behavior**: `make`, `edit` and the subscription order update do not test the distribution order window; only the TS screen and a legacy page do. Whether event listeners enforce it is unverified (`camap-hx/src/service/OrderService.hx:30-240`, `camap-hx/src/controller/api/Subscription.hx:70-73`).
  - **Question**: Must the server refuse orders outside the window for non-managers?
  - **Options**:
    - (a) enforce
    - (b) keep UI enforcement
  - **Suggestion**: Enforce order window in the service for non-managers. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The order service enforces the order window for non-managers; managers may bypass it.

- **UND-074** Admin order dialog hides line errors — **DECIDED**
  - **Statements**: [ORD-ADO-006](05-orders/admin-orders.md)
  - **Current behavior**: The order dialog endpoint always answers success; line-level errors are put into session messages (`camap-hx/src/service/OrderService.hx:734-762`, `camap-hx/src/controller/api/Order.hx:76-97`).
  - **Question**: How must line errors be reported?
  - **Options**:
    - (a) fail the request
    - (b) return per-line errors
  - **Suggestion**: Return per-line errors with success false; keep saved lines. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option b, per-line errors). The dialog returns per-line errors with success false and keeps the saved lines.

- **UND-075** Sub-total after inline edit uses the current price — **DECIDED**
  - **Statements**: [ORD-ADO-004](05-orders/admin-orders.md)
  - **Current behavior**: The inline edit sub-total uses the current product price while totals use the price saved with the order (CODE-041; `camap-hx/src/service/OrderService.hx:863,357,381`).
  - **Question**: Which price?
  - **Options**:
    - (a) saved price
    - (b) current price
  - **Suggestion**: Sub-total uses the price saved with the order. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The sub-total uses the saved price.

- **UND-076** Basket reuse when the basket is open — **DECIDED**
  - **Statements**: [ORD-BSK-002](05-orders/baskets.md)
  - **Current behavior**: Getting a basket creates a new one when the existing one has status "open" (CODE-042; `camap-hx/src/db/Basket.hx:48-66`).
  - **Question**: Is that intended?
  - **Options**:
    - (a) reuse any existing basket
    - (b) keep
  - **Suggestion**: Reuse any existing basket; OPEN branch only served temporary baskets. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a), following UND-077. Any existing basket is reused; a leftover OPEN basket is switched to CONFIRMED when reused.

- **UND-077** Temporary baskets and their confirmation are dead code — **DECIDED**
  - **Statements**: [ORD-BSK-003](05-orders/baskets.md), [ORD-BSK-004](05-orders/baskets.md)
  - **Current behavior**: Create, confirm and read functions have no callers; the coordinator page still lists them; the confirmation passes a basket where a boolean is expected (CODE-077; `camap-hx/src/service/OrderService.hx:419-494,581-621`, `camap-hx/src/controller/ContractAdmin.hx:1112-1115`).
  - **Question**: Keep or remove the temporary basket feature?
  - **Options**:
    - (a) remove
    - (b) revive
  - **Suggestion**: Remove temporary baskets, their page and confirm function. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Temporary baskets, their page and the confirm function are removed.

- **UND-078** Absence lock criterion and admin mode — **DECIDED**
  - **Statements**: [ORD-ABS-004](05-orders/absences.md), [ORD-ABS-011](05-orders/absences.md)
  - **Current behavior**: The service refuses changes on past distributions by distribution date; the REST layer locks by order closing date. Subscription creation passes non-admin mode to absences even in admin mode (CODE-049, CODE-047; `camap-hx/src/service/AbsencesService.hx:114-194`, `camap-hx/src/controller/api/Catalog.hx:86-90`, `camap-hx/src/service/SubscriptionService.hx:675-682`).
  - **Question**: Which lock date applies?
  - **Options**:
    - (a) order closing date
    - (b) distribution date
  - **Suggestion**: Lock absences by order closing date; pass admin mode when coordinator creates. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a): absences are locked by the order closing date of each distribution, in the service too, and a coordinator creating a subscription uses admin mode for absences.

- **UND-079** Default order saving overwrites per-distribution edits and uses the current price — **DECIDED**
  - **Statements**: [ORD-CST-003](05-orders/constant-orders.md), [ORD-VAR-004](05-orders/variable-orders.md), [ORD-AMT-005](05-orders/order-amounts.md)
  - **Current behavior**: Saving the default order deletes and recreates the not-yet-closed orders (all orders for constant catalogs, including past ones) at the current product price; the price stored in the default order is never used (CODE-048; `camap-hx/src/service/SubscriptionService.hx:906-916,909,989-993`, `camap-hx/src/service/OrderService.hx:77`).
  - **Question**: Must past orders and manual edits be preserved, and which price applies?
  - **Options**:
    - (a) preserve
    - (b) keep
  - **Suggestion**: Preserve past orders, manual edits and saved prices when saving default order. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Past orders, manual edits and saved prices are preserved when saving a default order.

- **UND-080** Balance transfer target check — **DECIDED**
  - **Statements**: [ORD-BTR-004](05-orders/balance-transfer.md)
  - **Current behavior**: The posted target is validated only as belonging to the same user, and the source balance is read before the null check (CODE-036; `camap-hx/src/service/SubscriptionService.hx:1100-1104`).
  - **Question**: Must the target be same vendor and not closed?
  - **Options**:
    - (a) check both
    - (b) keep
  - **Suggestion**: Transfer target must be same member, same vendor, not closed. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The server checks same member, same vendor and not closed, after a null check.

- **UND-081** Transfer button not limited to positive balances — **DECIDED**
  - **Statements**: [ORD-BTR-005](05-orders/balance-transfer.md)
  - **Current behavior**: The condition "balance above 0" is commented out in the template; negative balances are transferable (`camap-hx/lang/master/tpl/contractadmin/subscriptionpayments.mtt:23-33`; `camap-hx/src/service/SubscriptionService.hx:1099-1139`).
  - **Question**: May a negative balance be transferred?
  - **Options**:
    - (a) positive only
    - (b) any
  - **Suggestion**: Allow negative balance transfer (comment shows deliberate). Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option b). Any non-zero balance, negative included, can be transferred.

- **UND-082** Default-order cron error handling — **DECIDED**
  - **Statements**: [ORD-VAR-006](05-orders/variable-orders.md)
  - **Current behavior**: A failure of `make` is not caught per subscription (effect unverified) (`camap-hx/src/controller/Cron.hx:227-278`).
  - **Question**: Must one failure stop the batch?
  - **Options**:
    - (a) isolate failures
    - (b) keep
  - **Suggestion**: Try/catch per subscription in default-order cron, log and continue. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Failures are caught per subscription, logged, and the job continues.

- **UND-083** Subscription renewal does not exist — **DECIDED**
  - **Statements**: [ORD-SUB-014](05-orders/subscription-create.md)
  - **Current behavior**: No renewal feature exists in either codebase; a new season is a new catalog plus new subscriptions; duplicating a catalog does not copy subscriptions (`camap-hx/src/controller/ContractAdmin.hx:782-900`).
  - **Question**: Is renewal in scope?
  - **Options**:
    - (a) add renewal
    - (b) keep manual process
  - **Suggestion**: Keep manual new-catalog process; renewal out of scope. Confidence: low.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). Subscription renewal stays out of scope; a new season is a new catalog.

- **UND-084** Minimum error message shows unrounded total — **DECIDED**
  - **Statements**: [ORD-MIN-007](05-orders/order-minimums.md)
  - **Current behavior**: The check compares the rounded total but the message prints the unrounded one (CODE-046; `camap-hx/src/service/SubscriptionService.hx:613,618`).
  - **Question**: Cosmetic fix confirmation
  - **Options**:
    - (a) fix
    - (b) keep
  - **Suggestion**: Print the rounded total in the minimum error message. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The message prints the rounded total.

- **UND-085** Legacy shop-mode order edit page — **DECIDED**
  - **Statements**: [ORD-ADO-010](05-orders/admin-orders.md)
  - **Current behavior**: The page has no incoming link, truncates quantities with an integer parse and dereferences a possibly missing operation (CODE-076; `camap-hx/src/controller/Contract.hx:188-251`).
  - **Question**: Keep or remove?
  - **Options**:
    - (a) remove
    - (b) repair
  - **Suggestion**: Remove the legacy shop-mode order edit page. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The page is removed.

- **UND-086** Basket total is "not reliable" — **DECIDED**
  - **Statements**: [ORD-BSK-005](05-orders/baskets.md)
  - **Current behavior**: The field is for stats only, refreshed by some actions but not by subscription API order changes (`camap-hx/src/db/Basket.hx:24`, `camap-hx/src/service/OrderService.hx:775-857`).
  - **Question**: Must the basket total be kept in sync or computed?
  - **Options**:
    - (a) compute on read
    - (b) keep
  - **Suggestion**: Compute basket total on read; do not store it. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a): the basket total is computed on read from its orders and no longer stored.


## Payments (PAY)

- **UND-087** Balance counts only subscription operations after 2022 — **DECIDED**
  - **Statements**: [PAY-BAL-001](06-payments/balances.md)
  - **Current behavior**: The group balance sums only operations joined to a subscription whose start year is after 2022; order operations, memberships and manual payments without subscription are not counted; the pending-aware query is commented out and a comment (1 Jan 2021) does not match the code (CODE-037; `camap-hx/src/service/PaymentService.hx:343-354`; `camap-ts/packages/api-core/src/payments/services/payments.service.ts:280-296`).
  - **Question**: Which operations make up the balance and is the 2022 cut-off temporary?
  - **Options**:
    - (a) all operations, no cut-off
    - (b) keep the cut-off
    - (c) subscription operations plus membership
  - **Suggestion**: Sum all non-pending operations in the group; drop 2022 cut-off. Confidence: low.
  - **Decision** (2026-11-06): Keep the current behaviour (option b), for legacy compatibility: the balance counts only operations of subscriptions starting after 2022.

- **UND-088** Subscription balance computed differently in TS — **DECIDED**
  - **Statements**: [PAY-BAL-008](06-payments/balances.md), [PAY-BAL-007](06-payments/balances.md), [ORD-AMT-003](05-orders/order-amounts.md)
  - **Current behavior**: TS sums all operations of the subscription (including the negative total) without rounding, while Haxe uses payments minus total, rounded; the GraphQL field is commented out of the type but the resolver exists; Haxe order operations include fees while the subscription total does not (CODE-102; `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:22-30`, `csa-subscriptions.service.ts:104-137`, `camap-hx/src/service/PaymentService.hx:98-104`).
  - **Question**: Which formula is the reference?
  - **Options**:
    - (a) Haxe formula
    - (b) TS formula
  - **Suggestion**: Haxe formula: payments minus total, rounded to cents (TS service has it). Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Every screen uses payments minus subscription total, rounded to cents. Timing (2026-11-06): applied when Haxe is ported to TS, not in the current system ([TS-ONLY-STEP.md](../TS-ONLY-STEP.md)).

- **UND-089** TS payment operation creation differs from Haxe — **DECIDED**
  - **Statements**: [PAY-ENT-013](06-payments/payment-entry.md), [PAY-OPE-006](06-payments/operations.md), [PAY-ENT-012](06-payments/payment-entry.md), [PAY-OPE-005](06-payments/operations.md), [PAY-BAL-003](06-payments/balances.md)
  - **Current behavior**: TS reuse rules for pending on-the-spot and transfer payments differ from Haxe; the TS update adds amounts without lock or rounding and does not await the balance update; operations have no 2-decimal check in TS (CODE-061, CODE-103; `camap-ts/packages/api-core/src/payments/services/payments.service.ts:186-275,377-380`; `camap-hx/src/service/PaymentService.hx:25-76`).
  - **Question**: Which creation and rounding rules?
  - **Options**:
    - (a) Haxe rules in TS
    - (b) redefine
  - **Suggestion**: Round to 2 decimals on save; lock, round and await on payment update. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a, Haxe rules in TS). Round to 2 decimals on save; lock, round and await on payment update; reuse only pending on-the-spot payments.

- **UND-090** Edit/delete payment crashes on missing subscription — **DECIDED**
  - **Statements**: [PAY-ENT-010](06-payments/payment-entry.md)
  - **Current behavior**: The edit and delete actions read the operation's subscription before checking it, which fails for operations without a subscription (CODE-062; `camap-hx/src/controller/Transaction.hx:89-96,128-132`).
  - **Question**: Bug fix confirmation
  - **Options**:
    - (a) fix
    - (b) none
  - **Suggestion**: Null-check subscription before building return URL; allow no-subscription operations. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Operations without a subscription can be edited and deleted; the return URL falls back to the member payments page.

- **UND-091** Float equality when pairing payment and debt — **DECIDED**
  - **Statements**: [PAY-ENT-003](06-payments/payment-entry.md)
  - **Current behavior**: The pair is settled when the sum equals zero with no rounding (CODE-044; `camap-hx/src/controller/Transaction.hx:64`).
  - **Question**: Use a cent tolerance?
  - **Options**:
    - (a) round to cents
    - (b) keep
  - **Suggestion**: Settle payment/debt pair when the sum rounded to cents is zero. Confidence: high.
  - **Decision** (2026-11-02): Keep the current behaviour (option b). The pair is settled when the sum is exactly zero.

- **UND-092** Payment type links without a handler — **DECIDED**
  - **Statements**: [PAY-TYP-009](06-payments/payment-types.md)
  - **Current behavior**: The `link` of each payment type points to `/transaction/<type>` routes that do not exist (CODE-129; `camap-hx/src/payment/Cash.hx:19`).
  - **Question**: Are help pages wanted?
  - **Options**:
    - (a) remove links
    - (b) create pages
  - **Suggestion**: Remove unused payment type link field; keep docLink. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The link field is removed; docLink stays.

- **UND-093** Money pot is half-supported — **DECIDED**
  - **Statements**: [PAY-TYP-003](06-payments/payment-types.md), [PAY-TYP-001, PAY-TYP-002, PAY-TYP-007](06-payments/payment-types.md)
  - **Current behavior**: Money pot is commented out of the list of all types in both stacks but still accepted by validation and manual entry; it cannot be combined with other types (`camap-hx/src/service/PaymentService.hx:263`, `camap-hx/src/controller/AmapAdmin.hx:325-327`).
  - **Question**: Is money pot a supported type?
  - **Options**:
    - (a) remove
    - (b) support fully
  - **Suggestion**: Remove money pot as a choosable type. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Money pot is removed as a choosable type and refused in validation and manual entry.

- **UND-094** Report totals and VAT rounding — **DECIDED**
  - **Statements**: [PAY-RPT-009](06-payments/reports-exports.md), [PAY-RPT-013](06-payments/reports-exports.md)
  - **Current behavior**: Merging per-vendor distributions adds quantity and total with VAT but not the total without VAT; amounts without VAT are not rounded; the invoice duplicates the logic; one query groups by price but averages the saved price (CODE-039, CODE-053, CODE-054; `camap-hx/src/service/ReportService.hx:29-174`, `camap-hx/src/controller/Member.hx:177-200`).
  - **Question**: Confirm expected totals and rounding
  - **Options**:
    - (a) fix sums, round each line
    - (b) keep
  - **Suggestion**: Fix merged VAT-exclusive total, round per line, reuse VAT helper in invoice. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Fix the merged VAT-exclusive total, round per line, group by saved price, reuse the VAT helper in the invoice.

- **UND-095** Daily attendance CSV not selectable — **DECIDED**
  - **Statements**: [PAY-RPT-010](06-payments/reports-exports.md)
  - **Current behavior**: The CSV branch exists but the format form has no CSV choice; a link on another page reaches it (CODE-130; `camap-hx/src/controller/Distribution.hx:154-159,206-229`).
  - **Question**: Offer the CSV in the form?
  - **Options**:
    - (a) yes
    - (b) remove
  - **Suggestion**: Add CSV choice to attendance format form. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The attendance format form offers CSV.

- **UND-096** TS validate/delete operation: rights and use — **DECIDED**
  - **Statements**: [PAY-ENT-011](06-payments/payment-entry.md)
  - **Current behavior**: TS requires the all-catalogs coordinator right while Haxe edit/delete require the membership right; the two mutations appear in the generated client only, with no component using them (payments R12; `camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:27-54,91-103`).
  - **Question**: Which right and is the feature wanted?
  - **Options**:
    - (a) membership right
    - (b) all-catalogs coordinator
    - (c) drop
  - **Suggestion**: Keep validate/delete mutations with membership right (canManageMembers), or drop if unused. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The validate and delete mutations are kept and require the membership right (canManageMembers).


## Communication (COM)

- **UND-097** Job endpoints are public; the enable switch is truthiness — **DECIDED**
  - **Statements**: [COM-JOB-002](07-communication/scheduled-jobs.md), [COM-JOB-003](07-communication/scheduled-jobs.md)
  - **Current behavior**: `/cron/minute|hour|daily` need no authentication (the check always returns true and is commented out); the platform trigger runs whenever the variable is non-empty, including "false" (CODE-015, CODE-151; `camap-hx/src/controller/Cron.hx:36-52`; `camap-ts/packages/api-core/src/tools/crontab.service.ts:17,31,45`).
  - **Question**: Must job endpoints be protected and the switch parsed as a boolean?
  - **Options**:
    - (a) shared secret and boolean flag
    - (b) network-level restriction
    - (c) keep
  - **Suggestion**: Re-enable key check on job endpoints; parse HX_TRIGGER_CRONS as boolean. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The job endpoints require the shared key again, and HX_TRIGGER_CRONS is read as a boolean.

- **UND-098** Message read rights and null handling — **DECIDED**
  - **Statements**: [COM-MSG-007](07-communication/group-messages.md), [COM-MSG-008](07-communication/group-messages.md)
  - **Current behavior**: `message(id)` reads the group of the message before the null check; `getLatestMessages` has no group-right check (only the author's own messages) (CODE-057, CODE-034; `camap-ts/packages/api-core/src/messages/messages.resolver.ts:58-105`).
  - **Question**: Must these check the current right and handle unknown ids?
  - **Options**:
    - (a) fix
    - (b) keep
  - **Suggestion**: Null-check before group read; require messages right and filter latest messages. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The message is null-checked before its group is read, the messages right is required, and latest messages are filtered on that right. Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).

- **UND-099** Queued email may be missing when a message is created — **DECIDED**
  - **Statements**: [COM-MSG-011](07-communication/group-messages.md)
  - **Current behavior**: `createMessage` dereferences the queued email although it can be null when no recipient is valid (CODE-058; `camap-ts/packages/api-core/src/messages/messages.resolver.ts:192-197`).
  - **Question**: What happens when no recipient is valid?
  - **Options**:
    - (a) error to the sender
    - (b) store message anyway
  - **Suggestion**: Return an error and store no message when no valid recipient. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The sender gets an error and no message is stored when no recipient is valid.

- **UND-100** Sender address of emails differs between Haxe and TS — **DECIDED**
  - **Statements**: [COM-EML-007](07-communication/emails.md)
  - **Current behavior**: Haxe stores the group contact as sender; the TS sender always uses the platform sender address and ignores the stored sender; Reply-To rules differ (CODE-123; `camap-hx/src/App.hx:351-369`; `camap-ts/packages/api-core/src/mails/mails.service.ts:256-273`).
  - **Question**: Who is the visible sender and reply address?
  - **Options**:
    - (a) platform address with group name, reply to group contact
    - (b) group contact address
  - **Suggestion**: Platform address with sender name, Reply-To to the sender. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Platform address with the sender name; Reply-To set to the sender.

- **UND-101** TS email theme ignores the white-label setting — **DECIDED**
  - **Statements**: [COM-EML-008](07-communication/emails.md), [ADM-THM-003](08-administration/theme.md), [NAV-THM-002](09-navigation/theme-layout.md)
  - **Current behavior**: TS returns a default theme (cached forever) and never reads the white-label variable, while Haxe reads it; the TS front theme is also hard-coded (CODE-104, CODE-122; `camap-ts/packages/api-core/src/tools/variable.service.ts:61-72`; `camap-hx/src/App.hx:145-150`).
  - **Question**: Is white-labelling a supported feature?
  - **Options**:
    - (a) TS reads the setting
    - (b) drop white-label
  - **Suggestion**: TS reads the stored white-label theme (default as fallback, cache cleared on save); colors stay on the built-in palette. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). TS reads the stored white-label theme, with the default as fallback and the cache cleared on save; colors stay on the built-in palette. Timing (2026-11-06): applied when Haxe is ported to TS, not in the current system ([TS-ONLY-STEP.md](../TS-ONLY-STEP.md)).

- **UND-102** Deletions not awaited in purge jobs — **DECIDED**
  - **Statements**: [COM-JOB-010](07-communication/scheduled-jobs.md)
  - **Current behavior**: Message purge, cache cleaning and the account purge start deletions without waiting; Haxe task deletes inside transactions are not awaited either (CODE-059, CODE-067; `camap-ts/packages/api-core/src/messages/messages.service.ts:83`, `cache.service.ts:58`).
  - **Question**: Bug fix confirmation
  - **Options**:
    - (a) fix
    - (b) none
  - **Suggestion**: Await every deletion in purge jobs. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Every deletion in purge jobs is awaited.

- **UND-103** Daily job time — **DECIDED**
  - **Statements**: [COM-JOB-011](07-communication/scheduled-jobs.md)
  - **Current behavior**: Daily trigger at 00:00 while a comment (and the old docs) says 00:15; the message purge also runs at 00:00 (CODE-088; `camap-ts/packages/api-core/src/tools/crontab.service.ts:11,43`).
  - **Question**: At which time must each daily job run?
  - **Options**:
    - (a) stagger them
    - (b) keep
  - **Suggestion**: Daily job at 00:15 as documented; move message purge off midnight. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). Jobs stay at midnight; the comment (and old docs) saying 00:15 are corrected.

- **UND-104** Hard-coded French in automatic emails — **DECIDED**
  - **Statements**: [COM-NTF-006](07-communication/order-notifications.md)
  - **Current behavior**: Subject and date text of volunteer alerts and other cron mails are hard-coded French; the alert token is `[ROLES_MISSING]` in the code and `[ROLES_MANQUANTS]` in an older description (CODE-082; `camap-hx/src/controller/Cron.hx:197,200`).
  - **Question**: Which language do automatic emails use?
  - **Options**:
    - (a) group/user language
    - (b) French only
  - **Suggestion**: Switch locale to user lang for automatic emails, translate subject and date. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted as amended by UND-118. Emails are French only; the hard-coded subjects and dates go into the translation files at the port (see TS-ONLY-STEP.md).
  - **Impact of UND-118**: with no language selection, automatic emails are in French, and their hard-coded subjects and dates are exported to the translation files. Option (b) follows from the UND-118 decision; confirm to close this point.

- **UND-105** Small cron defects — **DECIDED**
  - **Statements**: [COM-NTF-007](07-communication/order-notifications.md), [COM-JOB-012](07-communication/scheduled-jobs.md), [COM-JOB-013](07-communication/scheduled-jobs.md)
  - **Current behavior**: The vendor and contact recap SQL joins with AND instead of WHERE; the errors email uses the real clock instead of the faked one; several application replicas each trigger the jobs without a lock (CODE-082; `camap-hx/src/controller/Cron.hx:716-724,353-377`; `camap-ts/packages/api-core/src/tools/crontab.service.ts`).
  - **Question**: Confirm these must be fixed
  - **Options**:
    - (a) fix
    - (b) keep
  - **Suggestion**: Use WHERE, faked clock in errors email, per-job lock across replicas. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). WHERE in the recap query, faked clock in the errors email, per-job lock across replicas.

- **UND-106** Email templates with no sender — **DECIDED**
  - **Statements**: [COM-AUT-003](07-communication/automatic-emails.md), [COM-AUT-004](07-communication/automatic-emails.md), [ADM-TLS-002](08-administration/maintenance-tools.md)
  - **Current behavior**: Templates for distribution validation (and reminder), new and existing vendor invitation, vendor certification (in progress, refused), anti-cheat and time-slot resolution are in the TS template folder but referenced by no sender (use elsewhere unverified); the distribution "validated" state is dead (UND-057) (`camap-ts/packages/api-core/mails/src/*.twig`).
  - **Question**: Which of these features are in scope?
  - **Options**:
    - (a) implement the flows
    - (b) remove templates
  - **Suggestion**: Remove templates with no sender until their flows are specified. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option b). Templates with no sender are removed until their flows are specified. Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).


- **UND-120** Sending a message does not check the messages right — **DECIDED**
  - **Statements**: [COM-MSG-010](07-communication/group-messages.md)
  - **Current behavior**: `createMessage` checks only that the user is logged in; only the read queries call `userIsAllowedToAccessMessages`, so any logged-in user can send a message by email to the members of any group (`camap-ts/packages/api-core/src/messages/messages.resolver.ts:135-218`). Found by the characterisation suite (test `group-messages.graphql`).
  - **Question**: Must sending require the messages right on the group?
  - **Options**:
    - (a) fix: require the messages right
    - (b) keep
  - **Suggestion**: Require the messages right on the group before storing or queuing anything. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Sending a message requires the messages right on the group; otherwise nothing is stored or queued. Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).

- **UND-121** Recipient lookup leaks member emails — **DECIDED**
  - **Statements**: [COM-MSG-003](07-communication/group-messages.md)
  - **Current behavior**: `getEmailRecipientsByUserIds` tests `canManageMessages()` without awaiting it; a pending promise is always truthy, so any logged-in user gets the names and emails of the members of any group (`camap-ts/packages/api-core/src/users/users.resolver.ts:105`). Found by the characterisation suite (test `message-recipients.graphql`).
  - **Question**: Must the recipient lookup require the messages right?
  - **Options**:
    - (a) fix: await the check
    - (b) keep
  - **Suggestion**: Await the right check; without the messages right the lookup returns nothing. Confidence: high.
  - **Decision** (2026-11-06): Suggestion accepted (option a). The recipient lookup requires the messages right on the group; without it no name or email is returned. Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).


## Administration (ADM)

- **UND-107** Install, diagnostics and style guide exposure — **DECIDED**
  - **Statements**: [ADM-MNT-003](08-administration/maintenance-install.md), [ADM-MNT-004](08-administration/maintenance-install.md), [ADM-MNT-007](08-administration/maintenance-install.md)
  - **Current behavior**: First install creates admin@camap.tld with password "admin"; `/install/diagnostics` and `/cssdemo` are public, the diagnostics creating folders as a side effect (CODE-026; `camap-hx/src/controller/Install.hx:25-122`, `camap-hx/src/controller/Main.hx:209-220`).
  - **Question**: How is the first admin created and who may run diagnostics?
  - **Options**:
    - (a) operator-defined credentials, diagnostics for superadmin or CLI
    - (b) keep
  - **Suggestion**: Operator-chosen first admin credentials; diagnostics via CLI or superadmin only; drop public style guide. Confidence: high.
  - **Decision** (2026-11-02): Suggestion partly accepted. Keep admin@camap.tld as the default admin user created at first install (option b for this part); diagnostics are for superadmins only; the CSS demo page is removed.

- **UND-108** Destructive admin actions without protection — **DECIDED**
  - **Statements**: [ADM-GRP-008](08-administration/admin-groups.md), [ADM-ERR-003](08-administration/error-log.md)
  - **Current behavior**: `/admin/errors?empty=1` truncates the error table by GET with no token; the clean-up script deletes shop-mode groups, users without group and vendors without catalog with no confirmation (CODE-030, CODE-035; `camap-hx/src/controller/admin/Admin.hx:111-113`, `camap-hx/src/controller/Scripts.hx:55-83`).
  - **Question**: Which protections are needed?
  - **Options**:
    - (a) POST with token, confirmation and dry-run
    - (b) keep
  - **Suggestion**: POST with token and confirmation for error purge; clean-up script CLI-only with dry-run. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The error purge needs a POST with a token and a confirmation; the clean-up script is CLI-only, with a dry-run by default.

- **UND-109** Group search by string-concatenated SQL — **DECIDED**
  - **Statements**: [ADM-GRP-002](08-administration/admin-groups.md)
  - **Current behavior**: The group list builds SQL by concatenating the name and zip inputs; its method has no own admin guard (guard is on the parent controller) (CODE-025, CODE-027; `camap-hx/src/controller/admin/Group.hx:21-55`).
  - **Question**: Confirm parameterised queries
  - **Options**:
    - (a) fix
    - (b) none
  - **Suggestion**: Use parameterised queries for group search; add explicit admin guard. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a).

- **UND-110** Placeholder "deleted" user is not created by code — **DECIDED**
  - **Statements**: [ADM-USR-006](08-administration/admin-users.md)
  - **Current behavior**: Account deletion needs the user `deleted@camap.tld`, which no code or install step creates (`camap-ts/packages/api-core/src/users/users.service.ts:333-340`).
  - **Question**: Who creates the placeholder?
  - **Options**:
    - (a) install and migration create it
    - (b) manual
  - **Suggestion**: Create the deleted@camap.tld placeholder in install and migration; fail loudly if missing. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). The install step and a migration create the placeholder; account deletion fails loudly when it is missing. Timing (2026-11-06): fixed in the current system, before the migration ([PRE-MIGRATION-TASKS.md](../PRE-MIGRATION-TASKS.md)).

- **UND-111** Platform settings have no admin screen — **DECIDED**
  - **Statements**: [ADM-MNT-001](08-administration/maintenance-install.md), [ADM-MNT-009](08-administration/maintenance-install.md), [ADM-MNT-010](08-administration/maintenance-install.md)
  - **Current behavior**: Maintenance mode, SMTP settings, analytics id, css/js versions are only editable in the database; nothing in the repo writes them (admin R: Variable keys; `camap-hx/src/controller/Main.hx:36`, `camap-hx/src/db/BufferedJsonMail.hx:82-85`). The TS transport reads environment variables instead of the SMTP variables.
  - **Question**: Which settings need an admin UI?
  - **Options**:
    - (a) add screens
    - (b) configuration files only
  - **Suggestion**: Add maintenance-mode toggle only; keep SMTP, analytics and version in environment config. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a, maintenance mode only). A maintenance-mode toggle is added; SMTP, analytics and version stay in environment configuration.

- **UND-112** Theme and superadmin pages not linked — **DECIDED**
  - **Statements**: [ADM-DSH-004](08-administration/admin-dashboard.md)
  - **Current behavior**: The theme and superadmin list pages exist but the sidebar links to neither; the theme is cached in memory until reload or restart (`camap-hx/src/controller/admin/Admin.hx:34-62,207`, `camap-hx/lang/master/tpl/admin/basedesign.mtt:14-20`).
  - **Question**: Keep as hidden pages?
  - **Options**:
    - (a) link and auto-reload
    - (b) keep
  - **Suggestion**: Link theme and superadmin pages in the sidebar; auto-reload theme on save. Confidence: medium.
  - **Decision** (2026-11-06): Keep the current behaviour (option b). The pages stay out of the sidebar and the theme is reloaded manually.

- **UND-113** Two version numbers — **DECIDED**
  - **Statements**: [ADM-MNT-006](08-administration/maintenance-install.md)
  - **Current behavior**: Haxe `/ping` returns a hard-coded version 3.0.12; TS `/ping` and `/health` return an environment variable or 0 (CODE-121; `camap-hx/src/App.hx:21`, `camap-ts/packages/api-core/src/tools/tools.controller.ts:11-21`).
  - **Question**: Which version is exposed and where from?
  - **Options**:
    - (a) one build-time version
    - (b) keep both
  - **Suggestion**: Expose one build-time version through both ping endpoints. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). One build-time version is exposed through both ping endpoints; the Haxe endpoint disappears with the port (see TS-ONLY-STEP.md).

- **UND-114** Raw DB admin route kept with its link removed — **DECIDED**
  - **Statements**: [ADM-DSH-006](08-administration/admin-dashboard.md)
  - **Current behavior**: `/db` is reachable by superadmins; the sidebar link was commented out for incompatibility with MySQL 8; it is the only way to edit rights and the disabled state (`camap-hx/src/controller/Main.hx:302-306`, `camap-hx/lang/master/tpl/admin/basedesign.mtt:11-13`).
  - **Question**: Keep, replace or remove?
  - **Options**:
    - (a) replace with dedicated screens
    - (b) keep for operators
  - **Suggestion**: Remove raw /db once dedicated screens exist; operators use a DB client meanwhile. Confidence: low.
  - **Decision** (2026-11-06): Suggestion accepted. The raw /db route is removed once dedicated screens exist; operators use a database client meanwhile.

- **UND-115** Dead or defective platform settings in TS — **DECIDED**
  - **Statements**: [ADM-TLS-006](08-administration/maintenance-tools.md), [CAT-VEN-011](03-catalogs/vendors.md)
  - **Current behavior**: `tosVersion` and `defaultShowcaseGroupIds` are never read; the IP blacklist guard is never applied; reading a missing integer setting throws and saving does not wait (CODE-060; `camap-ts/packages/api-core/src/tools/variable.service.ts:9-72`).
  - **Question**: Which settings stay?
  - **Options**:
    - (a) remove dead ones, fix the service
    - (b) keep
  - **Suggestion**: Keep platformtermsofservice; remove dead settings; fix getInt and set; drop unused IP blacklist. Confidence: medium.
  - **Decision** (2026-11-06): Suggestion accepted (option a). Keep platformtermsofservice; remove dead settings and the unused IP blacklist; fix getInt and set.

- **UND-116** Stack traces returned to API clients — **DECIDED**
  - **Statements**: [ADM-ERR-006](08-administration/error-log.md)
  - **Current behavior**: For unexpected errors the REST API returns the stack trace in the response body (`camap-hx/src/controller/Main.hx:199-206`).
  - **Question**: Must traces stay server-side?
  - **Options**:
    - (a) log only
    - (b) keep for debugging
  - **Suggestion**: Keep stack traces server-side (log only); return code and message. Confidence: high.
  - **Decision** (2026-11-02): Suggestion accepted (option a). Stack traces are logged on the server only; the API returns the error code and message.


## Navigation (NAV)

- **UND-117** Group choice without membership check — **DECIDED**
  - **Statements**: [NAV-SEL-002](09-navigation/group-selection.md)
  - **Current behavior**: `/user/choose?group=ID` writes the selected group for any id, with a login only; downstream use of the selected group is not traced (CODE-024; `camap-hx/src/controller/User.hx:60-74`).
  - **Question**: Must the group be one the user belongs to?
  - **Options**:
    - (a) check membership (or superadmin)
    - (b) keep
  - **Suggestion**: Check membership (or superadmin) before selecting a group. Confidence: high.
  - **Decision** (2026-11-02): Keep the current behaviour (option b). A user can open any group and see every component that does not check membership; components that check membership or rights stay closed.

- **UND-118** Language support is incomplete — **DECIDED**
  - **Statements**: [NAV-LNG-002](09-navigation/language.md); also applied to [NAV-LNG-003](09-navigation/language.md), [NAV-LNG-004](09-navigation/language.md), [NAV-LNG-005](09-navigation/language.md), [ACC-PRO-006](01-accounts/profile.md), [COM-EML-010](07-communication/emails.md)
  - **Current behavior**: Only French is shipped. Haxe text uses gettext with many untranslated French literals; the TS front always loads French and ignores the user and session language; no string is shared between the two (frontend R18-R21; `camap-hx/js/App.hx:329`, `camap-ts/packages/front-core/src/lib/i18n.ts:16-17`).
  - **Question**: Is multi-language a requirement?
  - **Options**:
    - (a) French only
    - (b) full multi-language with one translation system
  - **Suggestion**: French only; drop the per-user language switch for now. Confidence: high.
  - **Decision** (2026-11-02): When porting Haxe to TS, export every hard-coded string to the translation files, and remove the language selection. The interface and emails are in French.
  - **Scope**: nothing changes in the current Haxe + TS system. The string export and the removal of the hidden `?lang=` account parameter are part of the TS-only step, see [TS-ONLY-STEP.md](../TS-ONLY-STEP.md).

- **UND-119** Page rendering depends on the widget service — **DECIDED**
  - **Statements**: [NAV-THM-007](09-navigation/theme-layout.md)
  - **Current behavior**: Every Haxe page asks the TS side for the list of widget bundles and fails with "Unable to load ressources from CAMAP-ts." when it cannot; the list is cached per process without invalidation (CODE-146; `camap-hx/src/service/BridgeService.hx:10-72`, `camap-hx/lang/master/tpl/base.mtt:118`).
  - **Question**: Must pages degrade gracefully?
  - **Options**:
    - (a) degrade
    - (b) keep (the dependency disappears with the Haxe pages)
  - **Suggestion**: Degrade gracefully: keep last good bundle list, render the page without widgets. Confidence: medium.
  - **Decision** (2026-11-06): Keep (option b). The current system keeps its behaviour and nothing is built to degrade gracefully, because the dependency disappears with the Haxe pages (see [TS-ONLY-STEP.md](../TS-ONLY-STEP.md)).

## Summary of suggestions

One line per undecided point. The suggestion is written so it can be read on its own. Rows are ordered by confidence, from low to high (low: UND-011 to UND-114, 5 rows; medium: UND-001 to UND-119, 49 rows; high: UND-004 to UND-118, 67 rows), then by domain (ACC, GRP, CAT, DIS, ORD, PAY, COM, ADM, NAV).

| ID | Suggestion |
|---|---|
| UND-011 | **Decided:** Password reset links use https and stay valid for 24 hours, for a single use. |
| UND-014 | **Decided:** TS login records which person of the household logged in, and does not copy a language into the session (French only). |
| UND-083 | **Decided:** Subscription renewal stays out of scope: a new season keeps being a new catalog that members subscribe to again (current behaviour kept). |
| UND-087 | **Decided:** The balance keeps counting only operations linked to subscriptions starting after 2022, for legacy compatibility (current behaviour kept). |
| UND-114 | **Decided:** The raw database admin route is removed once dedicated admin screens exist; until then operators use a database client. |
| UND-001 | **Decided:** Registration keeps sending no confirmation email and does not require email verification (current behaviour kept). |
| UND-002 | **Decided:** Both stacks store emails in lower case and last names in upper case on every save, as Haxe does today. |
| UND-003 | **Decided:** When a group requires a phone number or an address, registration enforces it on the server, not only in the form. |
| UND-008 | **Decided:** Failed logins are counted by the server during login, not by a client call, and the client IP is read from the `X-Real-Ip` header in lower case. |
| UND-012 | **Decided:** Changing the login email requires the user's current password; no verification email is added for now. |
| UND-013 | **Decided:** The 18-year minimum age rule is dropped, since the Haxe function that holds it is never called; the birth date stays optional. |
| UND-016 | **Decided:** The inactive-account purge keeps its thresholds, its exact-day warnings, its lack of warning for users who never logged in, and its current per-account processing (current behaviour kept). |
| UND-017 | **Decided:** TS user queries are readable by group managers only, the unused single-user query is removed, and invitation lookup goes through the invitation hash. |
| UND-019 | **Decided:** Haxe and TS compute the cookie domain with one shared rule, and logout clears the session in a single step. |
| UND-020 | **Decided:** The IP and user-agent blacklist guard is removed, since nothing applies it and Haxe has no equivalent. |
| UND-021 | **Decided:** TS login creates the session row itself when Haxe has not created one yet. |
| UND-024 | **Decided:** Group creation stays reserved to superadmins, and the page checks login before checking the superadmin right. |
| UND-025 | **Decided:** A group can still only be disabled or re-enabled directly in the database; no screen or mutation is added (current behaviour kept). |
| UND-026 | **Decided:** When a visitor opens the page of an open group, the group stays stored in the visitor's session, for the join flow and to browse its shop. |
| UND-027 | **Decided:** Quitting a group is refused when the member has orders in recent distributions (the Haxe rule), and the hard-coded exception for group 16936 is kept. |
| UND-028 | **Decided:** Removing a member who has orders requires the confirmation that Haxe asks for, in TS too, and removing several members at once handles every member. |
| UND-031 | **Decided:** Catalogs keep the Haxe meaning (a coordinator right without a catalog list covers all catalogs; vendor automatic rights are per claimed catalog), and a superadmin is treated as a member of every group, as TS does today. |
| UND-032 | **Decided:** The membership fee accepts any non-zero amount (including above 127); 0 is not a valid fee and keeps meaning "use the group fee"; free or variable group cotisation is managed another way. |
| UND-034 | **Decided:** Moving a member back to the waiting list requires the membership right and a security token, and is refused for users already on the waiting list. |
| UND-035 | **Decided:** A membership counts as valid only when the group has memberships enabled. |
| UND-039 | **Decided:** Exporting products requires the right to manage that catalog, and the Haxe REST reads of catalogs and products require group membership and hide inactive products. |
| UND-043 | **Decided:** TS catalog, product, vendor and place queries require login; catalog subscriptions are visible to managers and the subscriber only, products to group members or managers, and a place to members of its group. |
| UND-044 | **Decided:** Vendor and place addresses are geocoded on the server whenever the address changes or coordinates are missing (places also on creation); a failure blocks a vendor save and only warns for a place. |
| UND-045 | **Decided:** Place creation stays limited to France and Belgium; the form's country list and the address search are not changed (current behaviour kept). |
| UND-047 | **Decided:** Catalog deletion keeps its current behaviour (permanent, refused when something was ordered, cascade left to the database); making catalogs soft-deleted becomes a task for after the migration. |
| UND-050 | **Decided:** Refreshing prices on a constant-orders catalog works without a distribution parameter instead of crashing. |
| UND-052 | **Decided:** A vendor can still only be disabled or re-enabled directly in the database; no screen or mutation is added (current behaviour kept). |
| UND-054 | **Decided:** Editing a catalog keeps overwriting custom order dates of future distributions when an order delay changed, with the existing warning (current behaviour kept). |
| UND-063 | **Decided:** Cycle creation keeps stopping at the first conflicting date, and the unfinished cycle functions are left as they are (current behaviour kept). |
| UND-064 | **Decided:** Volunteer self-registration is a form submission with a security token and the full checks (role in the session, registration open, user in the group), and a member may still take several roles. |
| UND-072 | **Decided:** Order quantities are limited by the available stock with the same rule, in order units, when an order is created and when it is edited. |
| UND-073 | **Decided:** The server refuses orders outside the order window for members; coordinators and admins can still edit after closing. |
| UND-074 | **Decided:** The admin order dialog shows which order lines failed and why, while keeping the lines that were saved. |
| UND-078 | **Decided:** Absences are locked when orders close for a distribution, and a coordinator creating a subscription applies absences in admin mode. |
| UND-079 | **Decided:** Saving a default order does not change past orders, manual edits of a distribution, or the prices already saved on orders. |
| UND-089 | **Decided:** Payment operations created by TS are rounded to 2 decimals on save, and updating a payment locks the row, rounds and waits for the balance update; only pending on-the-spot payments are reused. |
| UND-093 | **Decided:** Money pot is no longer offered as a payment type and is refused in validation and manual entry. |
| UND-094 | **Decided:** Reports compute VAT-exclusive totals per line with rounding, merged distributions add the VAT-exclusive total, and the invoice reuses the shared VAT helper. |
| UND-096 | **Decided:** The TS mutations that validate or delete an operation are kept and require the membership right, like the Haxe pages. |
| UND-100 | **Decided:** Emails are sent from the platform address with the sender's name shown, and replies go to the sender. |
| UND-103 | **Decided:** The daily job and the message purge stay at midnight, not staggered; the code comment and old docs that say 00:15 are corrected (current behaviour kept). |
| UND-104 | **Decided:** Automatic emails are in French only (UND-118); their hard-coded subjects and dates go into the translation files when the emails are ported to TS. |
| UND-105 | **Decided:** The cron jobs use a proper SQL WHERE clause, the errors email shows the faked clock, and each job takes a lock so several replicas do not run it twice. |
| UND-106 | **Decided:** Email templates that nothing sends are removed until their flows are specified. Fixed before the migration. |
| UND-111 | **Decided:** Superadmins get a maintenance-mode switch; SMTP, analytics and version settings stay in the environment configuration. |
| UND-112 | **Decided:** The theme and superadmin pages stay unlinked in the sidebar and the theme keeps being reloaded manually (current behaviour kept). |
| UND-113 | **Decided:** Both ping endpoints return the same build-time version number; the Haxe endpoint disappears when Haxe is removed. |
| UND-115 | **Decided:** The platform terms-of-service version setting is kept, the dead settings and the unused IP blacklist are removed, and reading or saving settings is fixed. |
| UND-119 | **Decided:** the current behaviour is kept and no graceful degradation of the widget service is built; the dependency disappears with the Haxe pages (TS-only step). |
| UND-004 | **Decided:** The API validates the password server side (min 8, never empty); imported accounts get no usable hash. |
| UND-005 | **Decided:** Passwords are never trimmed of leading or trailing spaces, on either side. |
| UND-006 | **Decided:** Registering through an invitation adds the user to the group only if the group is open or a valid invitation exists for that email. |
| UND-007 | **Decided:** A password reset invalidates the old password immediately (the legacy-compatibility hash is cleared), so only the new password works. |
| UND-009 | **Decided:** The password reset form checks the reset token and the user it was issued for when the new password is submitted. |
| UND-010 | **Decided:** The Haxe rule is kept: logging in as another user is allowed only to a superadmin, or to a group manager for a non-admin member who belongs to that single group, with the check awaited in TS. |
| UND-015 | **Decided:** Account deletion stops with an error when it cannot proceed, without logging the user out or emailing the admins; the placeholder "deleted" user is created by a migration (see UND-110). Fixed before the migration. |
| UND-018 | **Decided:** The invitation link hash keeps covering the email only; the group and user parts are not signed (current behaviour kept). |
| UND-022 | **Decided:** When a superadmin deletes a user and the deletion is refused, the reason is shown, and the deletion call is a POST. |
| UND-023 | **Decided:** The "full" registration option stays a closed state with a "group is full" notice: no direct joining and no waiting list (current behaviour kept). |
| UND-029 | **Decided:** Member lists and waiting lists in TS require the membership right (or group admin, or superadmin) on the requested group. |
| UND-030 | **Decided:** The rights editor checks that the user is a member and that the admin does not lock themselves out before saving anything, all in one transaction. |
| UND-033 | **Decided:** Recording a membership uses the chosen payment type and checks that the user belongs to the group; batch results are mapped on user id. |
| UND-036 | **Decided:** A member counts as new when they have never logged in. |
| UND-037 | **Decided:** Percentage fees on orders are deactivated everywhere (no field, no fee applied) but not removed from the data model. |
| UND-038 | **Decided:** Editing a product validates the form before rewriting its stock rows. |
| UND-040 | **Decided:** The batch is bound to the catalog in the URL and foreign product ids are rejected. |
| UND-041 | **Decided:** A vendor's email and phone are shown only when the vendor chose to show them, or to managers of the vendor's catalogs. |
| UND-042 | **Decided:** TS applies the same document visibility rules as Haxe for catalog and vendor documents, checking rights correctly. |
| UND-046 | **Decided:** The upload size limit stays at the 4 MB server cap; labels and messages saying 3 MB are corrected. |
| UND-048 | **Decided:** Claiming a vendor works for users without a secondary email instead of crashing. |
| UND-049 | **Decided:** A product sold by weight in several pieces is allowed without a variable price (current behaviour kept). |
| UND-051 | **Decided:** Only deleting a place requires a group manager; list, create and edit keep having no explicit check (current behaviour kept). |
| UND-053 | **Decided:** Uploaded documents are accepted as PDF by file name only (.pdf), without a content check (current behaviour kept). |
| UND-055 | **Decided:** Dates should keep being stored as Paris local time, and TS should convert them correctly whenever it compares them. |
| UND-056 | **Decided:** Summer and winter time changes should follow the real calendar each year, using a time-zone library instead of a fixed table. |
| UND-057 | **Decided:** The unused "validated" state of distribution sessions and baskets stays as is, kept only for Haxe/database compatibility; no validation step exists. |
| UND-058 | **Decided:** After editing a session, the user is sent back to the distributions page, and the buttons to validate a session are removed. |
| UND-059 | **Decided:** Editing a session or changing its prices stays checked against the section right only, with no comparison with the user's group. |
| UND-060 | **Decided:** The distribution and volunteer-role handlers keep their current rights checks; no new explicit checks are added. |
| UND-061 | **Decided:** TS distribution queries require login and group membership, and a user's orders are visible only to that user and to managers. Fixed before the migration. |
| UND-062 | **Decided:** the attendance sheet of a variable-orders catalog is visible only to coordinators of all catalogs or of that catalog, and to the session's volunteers. Fixed before the migration. |
| UND-065 | **Decided:** editing a volunteer role asks for confirmation before removing the volunteers already registered; no rights checks are added (amended 2026-11-04). |
| UND-066 | **Decided:** A session counts as having vacant roles when at least one of its roles has no volunteer. |
| UND-067 | **Decided:** when a member subscribes, all member checks apply; admin mode is used only by admins and catalog coordinators. |
| UND-068 | **Decided:** a subscription is readable only by its owner, the catalog's coordinators and admins, after login. |
| UND-069 | **Decided:** the order and payment history pages are visible only to the owner, coordinators and admins, and viewing them writes nothing. |
| UND-070 | **Decided:** a member deleting their subscription confirms it, through a POST with a security token. |
| UND-071 | **Decided:** recording a payment on a subscription requires the right to manage that subscription's catalog. |
| UND-075 | **Decided:** the sub-total shown after editing an order line uses the price saved with the order. |
| UND-076 | **Decided:** a member always reuses their existing basket for a session, whatever its status; a leftover open basket is confirmed when reused. |
| UND-077 | **Decided:** temporary baskets, their confirmation page and function are removed as dead code. |
| UND-080 | **Decided:** a balance transfer only goes to another subscription of the same member, with the same vendor, that is not closed. |
| UND-081 | **Decided:** coordinators can transfer negative balances as well as positive ones. |
| UND-082 | **Decided:** the default-order job handles errors per subscription: it logs the error and continues with the next one. |
| UND-084 | **Decided:** the minimum-order error message shows the total rounded to cents. |
| UND-085 | **Decided:** the legacy shop-mode page for editing orders is removed. |
| UND-086 | **Decided:** The basket total is computed on read from its orders and no longer stored. |
| UND-088 | **Decided:** a subscription balance is its payments minus its total, rounded to cents, as Haxe computes it, on every screen. Applied at the port to TS (TS-only step). |
| UND-090 | **Decided:** editing or deleting an operation that has no subscription (variable order, membership) works instead of crashing. |
| UND-091 | **Decided:** a payment and a debt are settled together when their sum is exactly zero, as today (no cent tolerance). |
| UND-092 | **Decided:** the unused link field of payment types is removed; the documentation link stays. |
| UND-095 | **Decided:** the attendance sheet format form offers CSV, which the code already supports. |
| UND-097 | **Decided:** the cron endpoints require the shared key again, and the setting that enables crons is read as a true/false value. |
| UND-098 | **Decided:** reading messages requires the messages right on the group, unknown messages give "not found", and latest messages are listed only for groups where the user still has that right. Fixed before the migration. |
| UND-099 | **Decided:** sending a message with no valid recipient returns an error and stores nothing. |
| UND-101 | **Decided:** TS reads the white-label theme saved by the superadmin (falling back to the default, refreshed on save), while colors stay on the built-in palette. Applied at the port to TS (TS-only step). |
| UND-102 | **Decided:** purge jobs wait for every deletion to finish. |
| UND-120 | **Decided:** sending a group message requires the messages right on the group. Fixed before the migration. |
| UND-121 | **Decided:** looking up message recipients requires the messages right; otherwise no name or email is returned. Fixed before the migration. |
| UND-107 | **Decided:** first install keeps creating admin@camap.tld as the default admin user; diagnostics are for superadmins only; the CSS demo page is removed. |
| UND-108 | **Decided:** purging errors needs a POST with a security token and a confirmation, and the clean-up script runs only from the command line, with a dry-run by default. |
| UND-109 | **Decided:** The admin group search uses parameterised queries and an explicit superadmin check. |
| UND-110 | **Decided:** the placeholder "deleted" user is created at install and by a migration, and account deletion fails loudly if it is missing. Fixed before the migration. |
| UND-116 | **Decided:** stack traces stay in the server logs; the API returns only an error code and message. |
| UND-117 | **Decided:** a user can choose any group, even one they do not belong to, and sees every component that does not check membership. |
| UND-118 | **Decided:** French only, no change to the current system; when porting Haxe to TS, every hard-coded string is exported to the translation files and the language parameter is dropped (TS-only step). |
