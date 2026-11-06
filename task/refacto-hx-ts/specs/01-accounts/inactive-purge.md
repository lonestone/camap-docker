# Inactive account purge (ACC-PUR)

Actors: the system, logged-in user.

- **ACC-PUR-001** As the system, I run the inactive-account check every day at 01:00. <!-- 03-features/users-auth.md S3.4; camap-ts/packages/api-core/src/users/users.service.ts:441-604 -->

- **ACC-PUR-002** As a user inactive for almost 2 years, I receive a warning email before my account is deleted, on the exact day of each threshold. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:441-517 -->
  - Warnings are sent 1 month, 2 weeks and 3 days before the 2-year mark.
  - Inactivity is counted from my last login.
  - A warning is sent only when the day of the threshold matches exactly; a missed run means a missed warning. This is intended.
  - The per-account work of the purge is not awaited (`camap-ts/packages/api-core/src/users/users.service.ts:566-599`, CODE-067). This is accepted as is.
  - **DECISION (UND-016, 2026-11-06)** Keep the current behaviour: thresholds, exact-day warnings, no warning for never-logged users, per-row work not awaited.

- **ACC-PUR-003** As the system, I delete accounts whose last login is more than 2 years old. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:545-604 -->

- **ACC-PUR-004** As the system, I delete accounts that never logged in and were created more than 6 months ago, without warning them. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:545-604 -->
  - These users never receive a warning email.
  - Thresholds stay: 2 years of inactivity, 6 months for accounts that never logged in, and 3 warnings. This is intended.
  - **DECISION (UND-016, 2026-11-06)** Keep the current behaviour: thresholds, exact-day warnings, no warning for never-logged users, per-row work not awaited.

- **ACC-PUR-005** As a user with a valid membership in any group, my account is never purged. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:77-87 -->
  - A membership is valid when it is for the current or the previous year.

- **ACC-PUR-006** As a user with an order newer than 2 years, my account is never purged. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:545-604 -->

- **ACC-PUR-007** As the system, I delete purged accounts with the same rules as a self-deletion. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:331-436 -->
  - An account with recent orders or a negative balance is kept.
