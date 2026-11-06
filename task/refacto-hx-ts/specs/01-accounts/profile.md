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

- **ACC-PRO-005** As a logged-in user, I confirm my identity with my current password before my login email changes. <!-- 03-features/users-auth.md R20; camap-ts/packages/api-core/src/users/users.service.ts:124-147 -->
  - No verification email is sent for now.
  - The same password check already protects account deletion (`isValidPassword`).
  - **ERRATUM** Today `updateUser` changes the login email freely, with no password and no verification email. Source: `camap-ts/packages/api-core/src/users/users.service.ts:124-147`, `camap-ts/packages/api-core/src/users/users.resolver.ts:158-176`.
  - **DECISION (UND-012, 2026-11-06)** Ask for the current password before a login email change; no verification mail for now.

- **ACC-PRO-006** As a logged-in user, I cannot choose a language on my account page: the interface is in French only. <!-- 03-features/users-auth.md R21; camap-hx/src/controller/Account.hx:46-51 -->
  - See NAV-LNG-003.
  - **DECISION (UND-118, 2026-11-02)** French only. This changes nothing in the current Haxe + TS system: exporting the hard-coded Haxe strings and dropping the language parameter happen when Haxe is ported to TS, see [TS-ONLY-STEP.md](../../TS-ONLY-STEP.md).

- **ACC-PRO-007** As a logged-in user, I can save any birth date, or none: there is no minimum age. <!-- 03-features/users-auth.md R21; camap-hx/src/service/UserService.hx:55-59 -->
  - The birth date stays an optional field.
  - **ERRATUM** Today the Haxe service defines an "at least 18 years old" check (`isBirthdayValid`) that nothing calls, and TS does not apply it. Source: `camap-hx/src/service/UserService.hx:55-59`.
  - **DECISION (UND-013, 2026-11-06)** Drop the 18-year rule; the birth date stays optional.

- **ACC-PRO-008** As a logged-in user, I can update my address and phone number from the ordering widgets. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/api/User.hx:18-39 -->

- **ACC-PRO-009** As a member of a group that requires a phone number or an address, I see a reminder on the home page until I provide it. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Main.hx:135-145 -->

- **ACC-PRO-010** As a logged-in user, my name is displayed as "LASTNAME Firstname", and for a two-person household as a couple name. <!-- 03-features/users-auth.md R23; camap-hx/src/db/User.hx:228-261 -->

- **ACC-PRO-011** As a logged-in user, I can see and quit the groups I belong to from my account page. <!-- 03-features/groups-membership.md F4; camap-ts/packages/front-core/src/modules/users/QuitGroup/QuitGroup.module.tsx -->
  - See the quit-group rules in 02-groups/join-quit.md.
