# Password reset and password definition (ACC-PWD)

Actors: visitor, logged-in user, member created by a manager.

- **ACC-PWD-001** As a visitor, I can ask for a password reset link by giving my email. <!-- 03-features/users-auth.md F5.3 step 2; camap-hx/src/controller/User.hx:146-172 -->
  - My primary or secondary email is accepted.
  - If no account has this email, I see "This E-mail is not linked to a known account".

- **ACC-PWD-002** As a visitor, I receive an email with a personal link to choose a new password. <!-- 03-features/users-auth.md F5.3 step 2; camap-hx/src/controller/User.hx:146-172 -->
  - The link is valid for 30 days.

- **ACC-PWD-003** As a visitor opening a valid reset link, I see a form with two fields for the new password. <!-- 03-features/users-auth.md F5.3 step 3; camap-hx/src/controller/User.hx:174-183 -->

- **ACC-PWD-004** As a visitor opening an invalid or expired reset link, I see "Invalid request". <!-- 03-features/users-auth.md F5.3 step 3; camap-hx/src/controller/User.hx:174-183 -->

- **ACC-PWD-005** As a visitor, I can set a new password only if the two fields match. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/src/controller/User.hx:185-213 -->

- **ACC-PWD-006** *Undecided (UND-009)*: As a visitor, I can set the password of an account only with the valid reset link of that account. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/src/controller/User.hx:174-197 -->
  - **SUGGESTION** Require the reset token on the final step. Check `Cache.get(key) == uid` on submit, as the display step does. Based on: `camap-hx/src/controller/User.hx:178` (token checked when the form is shown), `camap-hx/src/controller/User.hx:189-196` (submit uses the hidden `uid` and already holds `key` to destroy it). Confidence: high.

- **ACC-PWD-007** As a visitor, my reset link stops working once I have used it. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/src/controller/User.hx:185-213 -->

- **ACC-PWD-008** As a user, I receive an email confirming my password was changed. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/lang/master/tpl/mail/newPasswordConfirmed.mtt -->
  - The email does not contain the password.

- **ACC-PWD-009** *Undecided (UND-007)*: As a user, after I reset my password, only the new password lets me log in. <!-- 03-features/users-auth.md R8, F5.3; camap-hx/src/db/User.hx:274-281; camap-ts/packages/api-core/src/auth/auth.service.ts:319-346 -->
  - **SUGGESTION** A reset must invalidate the old password at once. Clear `pass2` (set it to empty) when Haxe `setPass` writes the new legacy hash. TS then re-creates the bcrypt hash at the next login. Based on: `camap-hx/src/db/User.hx:274-281` (only `pass` written), `camap-ts/packages/api-core/src/auth/auth.service.ts:326-345` (bcrypt checked first, skipped when `pass2` is empty). Confidence: high.

- **ACC-PWD-010** As a member added by a manager with no password yet, I receive an email with a link to create my password. <!-- 03-features/users-auth.md F5.3 step 5; 03-features/groups-membership.md R3; camap-hx/src/controller/User.hx:225 -->
  - The page says "create your password" instead of "reset".
  - The link is valid for 2 weeks.

- **ACC-PWD-011** As a logged-in user, I can change my password by asking for a reset link. <!-- 03-features/users-auth.md R21; camap-hx/src/controller/User.hx:120-226 -->
  - The account page does not offer a direct password change.

- **ACC-PWD-012** *Undecided (UND-011)*: As a visitor, the reset link in my email uses a secure address and a lifetime consistent with the other email links. <!-- 03-features/inconsistencies-code.md CODE-032; camap-hx/src/controller/User.hx:163,170 -->
  - **SUGGESTION** Use `https://` for the reset link. Shorten the lifetime to 24 hours and keep the token single-use. Based on: `camap-hx/src/controller/User.hx:163,170` (30 days, `http://`), `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:295` (other links last 2 weeks). Confidence: low. Needs product input: acceptable reset lifetime.
