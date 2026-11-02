# User administration (ADM-USR)

Actors: superadmin.

- **ADM-USR-001** As a superadmin, I can search for users and open a user sheet. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/User.hx:10-74 -->

- **ADM-USR-002** As a superadmin, I can see a member's membership of a group with the last operations and the orders around the distributions of the last and next three months. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/User.hx:62-77 -->

- **ADM-USR-003** As a superadmin, I can delete a user account. <!-- 03-features/admin-superadmin.md S3, R4; camap-hx/src/controller/admin/User.hx:44-55 -->
  - The same rules as ACC-DEL-002 to ACC-DEL-004 apply.
  - See ACC-DEL-009 for error reporting.

- **ADM-USR-004** As a superadmin, I can move the subscriptions, orders, baskets and operations of the placeholder deleted user to another user. <!-- 03-features/admin-superadmin.md R5; camap-hx/src/controller/Subscriptions.hx:47-90 -->

- **ADM-USR-005** As a superadmin, I can log in as a user. <!-- 03-features/admin-superadmin.md R4; camap-hx/src/controller/Member.hx:89-103 -->
  - See ACC-IMP-001.

- **ADM-USR-006** As a platform operator, the placeholder user "deleted" (`deleted@camap.tld`) always exists, so that account deletion works. <!-- 03-features/admin-superadmin.md S2 Placeholder; camap-ts/packages/api-core/src/users/users.service.ts:333-340 -->
  - The install step and a database migration create it.
  - If it is missing anyway, account deletion (by the user, a superadmin or the nightly clean-up) stops with an explicit error instead of doing nothing.
  - **ERRATUM** Today no code creates it, and deletion silently returns nothing when it is missing. Source: `camap-ts/packages/api-core/src/users/users.service.ts:333-340`, `:546`.
  - **DECISION (UND-110, 2026-11-02)** Create the `deleted@camap.tld` placeholder at install and in a migration; account deletion fails loudly when it is missing.
