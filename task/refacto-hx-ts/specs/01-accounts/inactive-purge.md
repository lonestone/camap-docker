# Inactive account purge (ACC-PUR)

Actors: the system, logged-in user.

- **ACC-PUR-001** As the system, I run the inactive-account check every day at 01:00. <!-- 03-features/users-auth.md S3.4; camap-ts/packages/api-core/src/users/users.service.ts:441-604 -->

- **ACC-PUR-002** *Undecided (UND-016)*: As a user inactive for almost 2 years, I receive a warning email before my account is deleted. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:441-517 -->
  - Warnings are sent 1 month, 2 weeks and 3 days before the 2-year mark.
  - Inactivity is counted from my last login.
  - **SUGGESTION** Keep the thresholds (2 years, 6 months, 3 warnings). Match each warning by a day range, not the exact day. Warn never-logged users from their creation date. Await the per-row work. Based on: `camap-ts/docs/users.md:63-65` (2-year policy with warnings), `camap-ts/packages/api-core/src/users/users.service.ts:489-495` (exact-day match), `camap-ts/packages/api-core/src/users/users.service.ts:566-599` (async stream callback not awaited). Confidence: medium.

- **ACC-PUR-003** As the system, I delete accounts whose last login is more than 2 years old. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:545-604 -->

- **ACC-PUR-004** *Undecided (UND-016)*: As the system, I delete accounts that never logged in and were created more than 6 months ago. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:545-604 -->
  - These users never receive a warning email.
  - **SUGGESTION** Keep the thresholds (2 years, 6 months, 3 warnings). Match each warning by a day range, not the exact day. Warn never-logged users from their creation date. Await the per-row work. Based on: `camap-ts/docs/users.md:63-65` (2-year policy with warnings), `camap-ts/packages/api-core/src/users/users.service.ts:489-495` (exact-day match), `camap-ts/packages/api-core/src/users/users.service.ts:566-599` (async stream callback not awaited). Confidence: medium.

- **ACC-PUR-005** As a user with a valid membership in any group, my account is never purged. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:77-87 -->
  - A membership is valid when it is for the current or the previous year.

- **ACC-PUR-006** As a user with an order newer than 2 years, my account is never purged. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:545-604 -->

- **ACC-PUR-007** As the system, I delete purged accounts with the same rules as a self-deletion. <!-- 03-features/users-auth.md R27; camap-ts/packages/api-core/src/users/users.service.ts:331-436 -->
  - An account with recent orders or a negative balance is kept.
