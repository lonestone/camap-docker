# Account deletion (ACC-DEL)

Actors: logged-in user, superadmin.

- **ACC-DEL-001** As a logged-in user, I can delete my account by confirming my password. <!-- 03-features/users-auth.md R24; camap-ts/packages/api-core/src/users/users.resolver.ts:200-212 -->
  - I can only delete my own account.
  - A wrong password stops the deletion.

- **ACC-DEL-002** As a logged-in user, I cannot delete my account if I ordered within the last 2 months. <!-- 03-features/users-auth.md R25; camap-ts/packages/api-core/src/users/users.service.ts:331-436 -->
  - Orders placed as the second person of a household count too.

- **ACC-DEL-003** As a logged-in user, I cannot delete my account while my balance is negative in any group. <!-- 03-features/users-auth.md R25; camap-ts/packages/api-core/src/users/users.service.ts:331-436 -->

- **ACC-DEL-004** As a logged-in user, when I delete my account, my past data stays in the groups under a placeholder "deleted" user. <!-- 03-features/users-auth.md R25; camap-ts/packages/api-core/src/users/users.service.ts:331-436 -->
  - Catalog contacts and group contacts I held move to the placeholder.
  - My baskets, orders and subscriptions move to the placeholder.
  - My money operations with a non-zero amount move to the placeholder.
  - My money operations with a zero amount are deleted.

- **ACC-DEL-005** As a logged-in user, when I delete my account, I am logged out. <!-- 03-features/users-auth.md R24, F5.4; camap-ts/packages/api-core/src/users/users.resolver.ts:214-246 -->
  - I am logged out only once my account is really deleted (see ACC-DEL-008).
  - **ERRATUM** Today, if the placeholder "deleted" user is missing, my account is not deleted, yet I am logged out and admins are told I deleted it. Source: `camap-ts/packages/api-core/src/users/users.resolver.ts:224-246` (CODE-056).
  - **DECISION (UND-015, 2026-11-06)** No logout when the deletion fails.

- **ACC-DEL-006** As a group admin, I receive an email when a member of my group deletes their account. <!-- 03-features/users-auth.md R24; camap-ts/packages/api-core/src/users/users.resolver.ts:214-246 -->
  - The email is sent only when the deletion succeeded (see ACC-DEL-008).
  - **DECISION (UND-015, 2026-11-06)** No admin email when the deletion fails.

- **ACC-DEL-007** As a former member, my membership in each group is removed when my account is deleted. <!-- 03-features/users-auth.md R25; camap-ts/packages/api-core/src/groups/entities/user-group.entity.ts:23-24 -->

- **ACC-DEL-008** As a logged-in user, I see an error and my account stays intact when the deletion cannot be carried out. <!-- 03-features/users-auth.md R24-R25; camap-ts/packages/api-core/src/users/users.resolver.ts:224-246; camap-ts/packages/api-core/src/users/users.service.ts:333-340 -->
  - The placeholder user must exist for the deletion to proceed; it is created at install and by a migration (UND-110).
  - When the deletion cannot proceed, I am not logged out and the admins are not emailed.
  - **ERRATUM** Today deletion returns null when the placeholder user is missing (or is the user itself), but the logout and the admin emails still happen. Source: `camap-ts/packages/api-core/src/users/users.resolver.ts:224-246`, `camap-ts/packages/api-core/src/users/users.service.ts:333-340` (CODE-056).
  - **DECISION (UND-015, 2026-11-06)** Stop with an error when deletion cannot proceed, without logout or admin emails; the placeholder user is seeded by migration (UND-110).

- **ACC-DEL-009** As a superadmin, I can delete any user account and I see the reason when it is refused. <!-- 03-features/users-auth.md R26; camap-hx/src/controller/admin/User.hx:44-55 -->
  - The same rules as ACC-DEL-002 and ACC-DEL-003 apply.
  - The deletion is sent through the bridge as a POST; on refusal I am redirected back with the reason.
  - **ERRATUM** Today the error is printed then ignored and the redirect always happens, and the bridge route deletes through a GET. Source: `camap-hx/src/controller/admin/User.hx:44-55`, `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:48-58` (CODE-031).
  - **DECISION (UND-022, 2026-11-06)** Show the refusal reason to the admin and bridge the delete as a POST.
