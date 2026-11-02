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

- **ACC-REG-003** *Undecided (UND-003)*: As a visitor joining a group that requires a phone number or an address, I must provide it before my account is created. <!-- 03-features/users-auth.md R5; camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx:186-202 -->
  - The form asks for them when the group requires them.
  - **SUGGESTION** Enforce it on the server. When `invitedGroupId` has the phone or address flag, validate with `phoneSchema` and `addressSchema` before creating the account. Based on: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:73-80` (server already picks schemas by input), `camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx:186-202` (client-only rule), `camap-hx/src/controller/Main.hx:136-146` (Haxe only nags afterwards). Confidence: medium.

- **ACC-REG-004** As a visitor, I cannot register with an email already used by another account. <!-- 03-features/users-auth.md R2; camap-ts/packages/api-core/src/auth/auth.service.ts:98-101 -->
  - The check covers both the primary and the secondary email of existing accounts.

- **ACC-REG-005** As a visitor, I am logged in right after my account is created. <!-- 03-features/users-auth.md F5.1; camap-ts/packages/api-core/src/auth/auth.resolver.ts:69-107 -->
  - I am redirected to the page I came from (for example the home page or the group join page).

- **ACC-REG-006** As a new user, my account starts with French as language and the 24-hour reminder email enabled. <!-- 03-features/users-auth.md R6; camap-ts/packages/api-core/src/auth/auth.service.ts:103-120 -->
  - If my secondary email equals my primary email, the secondary email is dropped.

- **ACC-REG-007** *Undecided (UND-001)*: As a visitor, I receive a confirmation email after registering. <!-- 03-features/users-auth.md F5.1 step 5; camap-ts/packages/api-core/src/auth/auth.service.ts -->
  - **SUGGESTION** Keep as is: no email at registration. The user is logged in right away. Add no verification step. Based on: `camap-ts/packages/api-core/src/auth/auth.service.ts:124-150` (registerAndLogin logs in directly), `camap-hx/lang/master/tpl/mail` (no welcome or confirmation template on either side). Confidence: medium.

- **ACC-REG-008** *Undecided (UND-002)*: As a user, my email is stored in lower case and my last name in upper case. <!-- 03-features/users-auth.md R4; camap-hx/src/db/User.hx:524-535 -->
  - **SUGGESTION** Normalise in TS too. Store email in lower case on create and update. Keep the last name upper case at display only, as TS already does. Based on: `camap-hx/src/db/User.hx:524-535` (clean() on every save), `camap-ts/packages/camap-common/src/utils/user-utils.ts:3` (formatLastName upper-cases at display), `camap-ts/packages/front-core/src/utils/fomat/index.ts:15` (same). Confidence: medium.

- **ACC-REG-009** *Undecided (UND-004)*: As a visitor, I cannot create an account with an empty password. <!-- 03-features/users-auth.md F5.1 step 5; camap-ts/packages/api-core/src/auth/auth.service.ts:103-120 -->
  - **SUGGESTION** Keep the public rule: password of at least 8 characters, enforced by the API schema. Never store or accept an empty password. For manager imports, create the account with no usable hash and reject an empty password in `isValidPassword`. Based on: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:73-80` (register validates `userRegistrationSchema`), `camap-ts/packages/camap-common/src/validators/registrationSchema/userRegistrationSchema.ts:6` (min 8), `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:142` (import passes an empty password on purpose). Confidence: high.

- **ACC-REG-010** *Undecided (UND-005)*: As a visitor, my password is stored so that it works identically whether I later log in or reset it, with no difference caused by leading or trailing spaces. <!-- 03-features/users-auth.md R7; camap-hx/src/db/User.hx:274-281; camap-ts/packages/api-core/src/tools/crypto.service.ts:22-24 -->
  - **SUGGESTION** Never trim passwords. Remove the trim from the Haxe `setPass`. Based on: `camap-ts/packages/api-core/src/tools/crypto.service.ts:22-24` (TS hashes the raw text, login uses it too), `camap-hx/src/db/User.hx:274-281` (trim only on reset, so a password with edge spaces can no longer log in). Confidence: high.

- **ACC-REG-011** As a user, my household can hold up to two persons, each with a first name, last name, email and phone. <!-- 03-features/users-auth.md R1; camap-hx/src/db/User.hx:30-38 -->
  - My account shows a combined name for the household when two persons are set.

- **ACC-REG-012** *Undecided (UND-006)*: As a visitor, I can only be added to a group at registration when the group accepts new members or I hold a valid invitation. <!-- 03-features/users-auth.md F5.1 step 3; camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104 -->
  - See also ACC-INV-004.
  - **SUGGESTION** Join the group only when it is open or when a valid invitation exists for this email. Check `regOption` like the Haxe join, and look up the invitation cache entry for the email. Based on: `camap-hx/src/controller/User.hx:238-239` (join refuses a non-open group), `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:201` (TS already tests `RegOption.Open`), `camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104` (no check today). Confidence: high.
