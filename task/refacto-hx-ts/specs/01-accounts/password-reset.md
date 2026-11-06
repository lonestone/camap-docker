# Password reset and password definition (ACC-PWD)

Actors: visitor, logged-in user, member created by a manager.

- **ACC-PWD-001** As a visitor, I can ask for a password reset link by giving my email. <!-- 03-features/users-auth.md F5.3 step 2; camap-hx/src/controller/User.hx:146-172 -->
  - My primary or secondary email is accepted.
  - If no account has this email, I see "This E-mail is not linked to a known account".

- **ACC-PWD-002** As a visitor, I receive an email with a personal link to choose a new password. <!-- 03-features/users-auth.md F5.3 step 2; camap-hx/src/controller/User.hx:146-172 -->
  - The link is valid for 24 hours (see ACC-PWD-012).
  - **ERRATUM** Today the link is valid for 30 days. Source: `camap-hx/src/controller/User.hx:163,170` (CODE-032).
  - **DECISION (UND-011, 2026-11-06)** The reset link lifetime is 24 hours.

- **ACC-PWD-003** As a visitor opening a valid reset link, I see a form with two fields for the new password. <!-- 03-features/users-auth.md F5.3 step 3; camap-hx/src/controller/User.hx:174-183 -->

- **ACC-PWD-004** As a visitor opening an invalid or expired reset link, I see "Invalid request". <!-- 03-features/users-auth.md F5.3 step 3; camap-hx/src/controller/User.hx:174-183 -->

- **ACC-PWD-005** As a visitor, I can set a new password only if the two fields match. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/src/controller/User.hx:185-213 -->

- **ACC-PWD-006** As a visitor, I can set the password of an account only with the valid reset link of that account. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/src/controller/User.hx:174-197 -->
  - The reset token and the user it was issued for are checked again when I submit the new password, not only when the form is displayed.
  - A submission with a missing, expired or mismatching token is refused with "Invalid request" (see ACC-PWD-004).
  - **ERRATUM** Today the final step trusts the hidden user id of the form and the token is checked only when the form is displayed, so anyone who posts the form can set any user's password. Source: `camap-hx/src/controller/User.hx:174-197` (CODE-001).
  - **DECISION (UND-009, 2026-11-06)** Verify the reset token and the user id on submit.

- **ACC-PWD-007** As a visitor, my reset link stops working once I have used it. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/src/controller/User.hx:185-213 -->

- **ACC-PWD-008** As a user, I receive an email confirming my password was changed. <!-- 03-features/users-auth.md F5.3 step 4; camap-hx/lang/master/tpl/mail/newPasswordConfirmed.mtt -->
  - The email does not contain the password.

- **ACC-PWD-009** As a user, after I reset my password, only the new password lets me log in. <!-- 03-features/users-auth.md R8, F5.3; camap-hx/src/db/User.hx:274-281; camap-ts/packages/api-core/src/auth/auth.service.ts:319-346 -->
  - A reset invalidates the old password at once: the reset clears `pass2` (sets it to empty) when it writes the new legacy hash.
  - TS then re-creates the bcrypt hash at my next login.
  - **ERRATUM** Today the Haxe reset writes only the legacy hash and TS checks the bcrypt hash first, so the old password keeps working until the first login with the new one. Source: `camap-hx/src/db/User.hx:274-281`, `camap-ts/packages/api-core/src/auth/auth.service.ts:320-345` (CODE-005).
  - **DECISION (UND-007, 2026-11-06)** A password reset must clear `pass2` so the old password stops working immediately.

- **ACC-PWD-010** As a member added by a manager with no password yet, I receive an email with a link to create my password. <!-- 03-features/users-auth.md F5.3 step 5; 03-features/groups-membership.md R3; camap-hx/src/controller/User.hx:225 -->
  - The page says "create your password" instead of "reset".
  - The link is valid for 2 weeks.

- **ACC-PWD-011** As a logged-in user, I can change my password by asking for a reset link. <!-- 03-features/users-auth.md R21; camap-hx/src/controller/User.hx:120-226 -->
  - The account page does not offer a direct password change.

- **ACC-PWD-012** As a visitor, the reset link in my email uses a secure address (https) and is valid for 24 hours, for a single use. <!-- 03-features/inconsistencies-code.md CODE-032; camap-hx/src/controller/User.hx:163,170 -->
  - The reset token is single-use (see ACC-PWD-007).
  - **ERRATUM** Today the reset link uses `http://` and lasts 30 days, while other email links use `https://` and TS tokens last 2 weeks. Source: `camap-hx/src/controller/User.hx:163,170`, `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:295` (CODE-032).
  - **DECISION (UND-011, 2026-11-06)** Use an https reset link with a 24-hour, single-use lifetime.
