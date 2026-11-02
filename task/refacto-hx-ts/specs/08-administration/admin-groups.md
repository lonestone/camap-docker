# Group administration by superadmin (ADM-GRP)

Actors: superadmin.

- **ADM-GRP-001** As a superadmin, I can list and search groups by name or zip code. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Group.hx:21-55 -->

- **ADM-GRP-002** As a superadmin, whatever I type in the group search (name or zip codes) is treated as a search value and never alters the query. <!-- 03-features/admin-superadmin.md S3, S7; camap-hx/src/controller/admin/Group.hx:31-44 -->
  - The name and zip-code filters are passed to the database as query parameters.
  - The group search checks by itself that I am a superadmin; it does not rely only on the guard of a parent route.
  - A non-superadmin calling the group search gets an access-denied error.
  - **ERRATUM** Today the group name is concatenated inside quotes into the SQL string (zip codes go through `Std.parseInt`), and the method has no admin guard of its own (only the parent controller checks). Source: `camap-hx/src/controller/admin/Group.hx:38-44`, `camap-hx/src/controller/Main.hx:333-335` (CODE-025, CODE-027).
  - **DECISION (UND-109, 2026-11-02)** Group search uses parameterised queries and an explicit superadmin guard on the method.

- **ADM-GRP-003** As a superadmin, I can view a group. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Group.hx:10-112 -->

- **ADM-GRP-004** As a superadmin, I can add myself as a member of a group. <!-- 03-features/admin-superadmin.md S3, R4; camap-hx/src/controller/admin/Group.hx:98-102 -->

- **ADM-GRP-005** As a superadmin, I can delete a group. <!-- 03-features/admin-superadmin.md S3, R4; camap-hx/src/controller/admin/Group.hx:104-112 -->

- **ADM-GRP-006** *Undecided (UND-025)*: As a superadmin, I can disable a group. <!-- 03-features/admin-superadmin.md S3 /db; camap-hx/src/controller/Main.hx:302-306 -->
  - See GRP-DSB-005.
  - **SUGGESTION** Add a superadmin-only mutation to set or clear the disabled reason (blocked by admin, moved, suspended). Based on: `camap-ts/packages/front-core/src/modules/groupDisabled/GroupDisabled.module.tsx:22-34` (notice already shows these reasons), `camap-hx/src/controller/Main.hx:84-86` (disabled groups are redirected), `camap-hx/src/controller/Group.hx:25-27` (public page redirects); no code writes the field. Confidence: medium.

- **ADM-GRP-007** As a superadmin, I can create a group. <!-- 03-features/groups-membership.md R4; camap-hx/src/controller/Group.hx:132-187 -->
  - See GRP-CRE-001.

- **ADM-GRP-008** As a platform operator, I can run a clean-up of non-AMAP data by script from the command line only. <!-- 03-features/crons-scheduled-jobs.md CLI; camap-hx/src/controller/Scripts.hx:55-83 -->
  - The script deletes shop-mode groups above a minimum id, users without a group and vendors without catalogs.
  - By default it runs as a dry-run and only lists what it would delete.
  - The minimum ids must be given explicitly; nothing is deleted without them.
  - It cannot be triggered from a web page.
  - **ERRATUM** Today the script deletes with no confirmation or preview. Source: `camap-hx/src/controller/Scripts.hx:55-83` (CODE-035).
  - **DECISION (UND-108, 2026-11-02)** The error-log purge needs a POST with a CSRF token and a confirmation; the clean-up script runs from the command line only, with a dry-run by default and explicit minimum ids.

- **ADM-GRP-009** As a platform operator, I can recompute the total of all baskets in a date range by script. <!-- 03-features/crons-scheduled-jobs.md CLI; camap-hx/src/controller/Scripts.hx:29-50 -->
  - The script can only be run from the command line.
