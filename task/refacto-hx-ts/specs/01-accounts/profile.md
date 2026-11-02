# Profile and account page (ACC-PRO)

Actors: logged-in user.

- **ACC-PRO-001** As a logged-in user, I can open my account page. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Account.hx:23-54 -->
  - Visitors are sent to the login page first, then back to the account page.

- **ACC-PRO-002** As a logged-in user, I can edit my own first names, last names, emails, phones, addresses, zip code, city, nationality, country of residence and birth date. <!-- 03-features/users-auth.md R21; camap-ts/packages/api-core/src/users/dto/update-user.input.ts:3-52 -->
  - The values are validated.
  - A field I leave empty is saved as empty.

- **ACC-PRO-003** As a logged-in user, I can edit only my own profile. <!-- 03-features/users-auth.md R20; camap-ts/packages/api-core/src/users/users.resolver.ts:159-176 -->

- **ACC-PRO-004** As a logged-in user, I cannot save an email already used by another account. <!-- 03-features/users-auth.md R2, R20; camap-ts/packages/api-core/src/users/users.service.ts:137-145 -->
  - The check covers primary and secondary emails.

- **ACC-PRO-005** *Undecided (UND-012)*: As a logged-in user, I confirm my identity before my login email changes. <!-- 03-features/users-auth.md R20; camap-ts/packages/api-core/src/users/users.service.ts:124-147 -->
  - **SUGGESTION** Ask for the current password before a login email change. Add no verification mail for now. Based on: `camap-ts/packages/api-core/src/users/users.resolver.ts:200-212` (`deleteAccount` already requires the password via `isValidPassword`), `camap-ts/packages/api-core/src/users/users.resolver.ts:158-176` (`updateUser` changes email freely). Confidence: medium.

- **ACC-PRO-006** As a logged-in user, I cannot choose a language on my account page: the interface is in French only. <!-- 03-features/users-auth.md R21; camap-hx/src/controller/Account.hx:46-51 -->
  - **DECISION (UND-118, 2026-11-02)** When porting Haxe to TS, export every hard-coded string to the translation files, and remove the language selection.

- **ACC-PRO-007** *Undecided (UND-013)*: As a logged-in user, I can only save a birth date that makes me at least 18 years old. <!-- 03-features/users-auth.md R21; camap-hx/src/service/UserService.hx:55-59 -->
  - **SUGGESTION** Drop this rule: no caller in Haxe. Keep birth date as an optional field. Based on: `camap-hx/src/service/UserService.hx:55-59` (`isBirthdayValid` defined, never called anywhere in `camap-hx/src`), `camap-ts/packages/front-core/src/modules/users/UserAccountModule/components/UserInfosForm.tsx:185` (optional date field). Confidence: medium.

- **ACC-PRO-008** As a logged-in user, I can update my address and phone number from the ordering widgets. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/api/User.hx:18-39 -->

- **ACC-PRO-009** As a member of a group that requires a phone number or an address, I see a reminder on the home page until I provide it. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Main.hx:135-145 -->

- **ACC-PRO-010** As a logged-in user, my name is displayed as "LASTNAME Firstname", and for a two-person household as a couple name. <!-- 03-features/users-auth.md R23; camap-hx/src/db/User.hx:228-261 -->

- **ACC-PRO-011** As a logged-in user, I can see and quit the groups I belong to from my account page. <!-- 03-features/groups-membership.md F4; camap-ts/packages/front-core/src/modules/users/QuitGroup/QuitGroup.module.tsx -->
  - See the quit-group rules in 02-groups/join-quit.md.
