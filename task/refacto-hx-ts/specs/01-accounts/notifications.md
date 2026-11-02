# Email notification preferences (ACC-NOT)

Actors: logged-in user, visitor holding an email link.

- **ACC-NOT-001** As a logged-in user, I can enable or disable three email notifications. <!-- 03-features/users-auth.md R22; camap-ts/packages/api-core/src/users/users.resolver.ts:178-196 -->
  - Reminder 4 hours before a distribution.
  - Reminder 24 hours before a distribution.
  - Notification when an order opens.

- **ACC-NOT-002** As a new user, I have the 24-hour reminder enabled by default. <!-- 03-features/users-auth.md R6; camap-hx/src/db/User.hx:57-68 -->

- **ACC-NOT-003** As a visitor, I can edit my notification preferences from the link in an email footer without logging in. <!-- 03-features/users-auth.md R22, S3.1; camap-hx/src/controller/Account.hx:59-68 -->
  - The link carries a personal key.
  - A wrong key gives no access.

- **ACC-NOT-004** As a logged-in user, I can only edit my own notification preferences. <!-- 03-features/users-auth.md S3.2; camap-ts/packages/api-core/src/users/users.resolver.ts:178-196 -->

- **ACC-NOT-005** As a membership manager, I can see on a member's sheet which notifications that member has enabled. <!-- 03-features/users-auth.md S6; camap-hx/src/controller/Member.hx:38-83 -->
  - The sheet only displays the settings.
