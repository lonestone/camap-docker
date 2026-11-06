# Registration (ACC-REG)

Actors: visitor, logged-in user. Registration is done in the login/registration box shown on the login page and on invitation pages.

- **ACC-REG-001** As a visitor, I can create an account with my first name, last name, email and a password. <!-- 03-features/users-auth.md R5; camap-ts/packages/camap-common/src/validators/registrationSchema/userRegistrationSchema.ts -->
  - First name, last name and email are required.
  - The password has at least 8 characters.
  - I confirm the password by typing it twice, and both must match.
  - I must accept the terms of service.

- **ACC-REG-002** As a visitor, I can add optional contact details when I register (phone, address, zip code, city). <!-- 03-features/users-auth.md R5; camap-ts/packages/api-core/src/auth/auth.resolver.ts:76-80 -->
  - A phone number, if given, must be valid.
  - If I fill any of zip code, address or city, the address is validated.

- **ACC-REG-003** As a visitor joining a group that requires a phone number or an address, I must provide it before my account is created, whatever client I use. <!-- 03-features/users-auth.md R5; camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx:186-202 -->
  - The form asks for them when the group requires them.
  - The server enforces it too: when the invited group has the phone or address flag, it validates with `phoneSchema` and `addressSchema` before creating the account.
  - **ERRATUM** Today only the registration form requires them; the API accepts a registration without them, and Haxe only reminds the member afterwards. Source: `camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx:186-202`, `camap-ts/packages/api-core/src/auth/auth.resolver.ts:73-80`, `camap-hx/src/controller/Main.hx:136-146`.
  - **DECISION (UND-003, 2026-11-06)** Enforce the group's phone and address requirement on the server at registration.

- **ACC-REG-004** As a visitor, I cannot register with an email already used by another account. <!-- 03-features/users-auth.md R2; camap-ts/packages/api-core/src/auth/auth.service.ts:98-101 -->
  - The check covers both the primary and the secondary email of existing accounts.

- **ACC-REG-005** As a visitor, I am logged in right after my account is created. <!-- 03-features/users-auth.md F5.1; camap-ts/packages/api-core/src/auth/auth.resolver.ts:69-107 -->
  - I am redirected to the page I came from (for example the home page or the group join page).

- **ACC-REG-006** As a new user, my account starts with French as language and the 24-hour reminder email enabled. <!-- 03-features/users-auth.md R6; camap-ts/packages/api-core/src/auth/auth.service.ts:103-120 -->
  - If my secondary email equals my primary email, the secondary email is dropped.

- **ACC-REG-007**: As a visitor, I receive no confirmation email after registering and I am logged in right away. <!-- 03-features/users-auth.md F5.1 step 5; camap-ts/packages/api-core/src/auth/auth.service.ts -->
  - My email address is not verified: no verification step is added.
  - This is intended: no welcome or confirmation template exists on either side. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:124-150` (`registerAndLogin` logs in directly), `camap-hx/lang/master/tpl/mail`.
  - **DECISION (UND-001, 2026-11-06)** Keep the current behaviour: no email at registration and no email verification.

- **ACC-REG-008** As a user, my email is stored in lower case and my last name in upper case, whichever application saves my account. <!-- 03-features/users-auth.md R4; camap-hx/src/db/User.hx:524-535 -->
  - The normalisation runs on every save, on creation and on update, in Haxe (`clean()`) and in TS.
  - **ERRATUM** Today TS does not normalise, so users registered or edited in TS keep their casing. Source: `camap-hx/src/db/User.hx:524-535` (Haxe `clean()` on every save).
  - **DECISION (UND-002, 2026-11-06)** Keep the Haxe behaviour: lower-case email and upper-case last name stored on every save, and apply it in TS too.

- **ACC-REG-009**: As a visitor, I cannot create an account with an empty password; my password has at least 8 characters. <!-- 03-features/users-auth.md F5.1 step 5; camap-ts/packages/api-core/src/auth/auth.service.ts:103-120 -->
  - The API enforces the 8-character minimum itself (registration schema), not only the form.
  - An empty password is never stored or accepted, at registration or in `isValidPassword`.
  - Accounts created by a manager import get no usable password hash: their owner sets one through a password reset.
  - **ERRATUM** Today `register` stores `md5(KEY+'')` and `bcrypt('')` for an empty password, while the login schema refuses an empty one. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:103-120` (CODE-052).
  - **DECISION (UND-004, 2026-11-06)** Validate the password server side (min 8, never empty); imports get no usable hash.

- **ACC-REG-010** As a visitor, my password is stored exactly as typed, so it works identically whether I later log in or reset it; leading and trailing spaces are part of the password. <!-- 03-features/users-auth.md R7; camap-hx/src/db/User.hx:274-281; camap-ts/packages/api-core/src/tools/crypto.service.ts:22-24 -->
  - Passwords are never trimmed, at registration, login or reset, in TS and in Haxe.
  - **ERRATUM** Today Haxe `setPass` trims the password before hashing (on reset), so a password with edge spaces can no longer log in; TS hashes the raw text. Source: `camap-hx/src/db/User.hx:274-281`, `camap-ts/packages/api-core/src/tools/crypto.service.ts:22-24`.
  - **DECISION (UND-005, 2026-11-06)** Never trim passwords; remove the trim from the Haxe `setPass`.

- **ACC-REG-011** As a user, my household can hold up to two persons, each with a first name, last name, email and phone. <!-- 03-features/users-auth.md R1; camap-hx/src/db/User.hx:30-38 -->
  - My account shows a combined name for the household when two persons are set.

- **ACC-REG-012** As a visitor, I can only be added to a group at registration when the group accepts new members or I hold a valid invitation. <!-- 03-features/users-auth.md F5.1 step 3; camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104 -->
  - See also ACC-INV-004.
  - A group that is not open and for which I hold no valid invitation is not joined; the registration itself still succeeds.
  - The registration checks the group's registration option, like the Haxe join, and looks up the invitation cache entry for the email.
  - **ERRATUM** Today TS registration adds the user to the group given as `invitedGroupId` with no registration-option or invitation check. Source: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104` (CODE-004).
  - **DECISION (UND-006, 2026-11-06)** Join the group at registration only when it is open or when a valid invitation exists for this email.
