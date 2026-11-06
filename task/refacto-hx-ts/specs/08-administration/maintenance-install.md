# Maintenance mode, installation and diagnostics (ADM-MNT)

Actors: superadmin, visitor, platform operator.

- **ADM-MNT-001** As a superadmin, I can switch the platform into maintenance mode from a screen. <!-- 03-features/admin-superadmin.md S4 Variable keys, F3; camap-hx/src/controller/Main.hx:36-41 -->
  - Non-admin visitors see a maintenance page instead of the home page.
  - Superadmins bypass it.
  - **ERRATUM** Today it is switched on only by editing the database. Source: `camap-hx/src/controller/Main.hx:36-41`.
  - **DECISION (UND-111, 2026-11-06)** Add a superadmin toggle for maintenance mode only; keep SMTP, analytics and version settings in environment configuration.

- **ADM-MNT-002** As a platform operator, I can install CAMAP on an empty database. <!-- 03-features/admin-superadmin.md S3, F4; camap-hx/src/controller/Install.hx:17-104 -->
  - It creates a first group and a superadmin account.
  - On a non-empty database it refuses with "CAMAP est deja installe".

- **ADM-MNT-003** As a platform operator, the first install creates the default superadmin account admin@camap.tld. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/Install.hx:25-100 -->
  - It is created as admin@camap.tld with password "admin", as today.
  - **DECISION (UND-107, 2026-11-02)** Keep admin@camap.tld as the default admin user created at first install; restrict diagnostics to superadmins; remove the CSS demo page.

- **ADM-MNT-004** As a superadmin, I can run installation diagnostics, and only superadmins can. <!-- 03-features/admin-superadmin.md S3, S7; camap-hx/src/controller/Install.hx:106-122 -->
  - Diagnostics create missing file and temp folders and warn about a missing access-control file.
  - Other users and visitors are refused.
  - **ERRATUM** Today the diagnostics page is public. Source: `camap-hx/src/controller/Install.hx:106-122` (CODE-026).
  - **DECISION (UND-107, 2026-11-02)** Keep admin@camap.tld as the default admin user created at first install; restrict diagnostics to superadmins; remove the CSS demo page.

- **ADM-MNT-005** As a visitor, I can read the platform version. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/Main.hx:326-328 -->
  - The old and the new application each give a version, and a health status.

- **ADM-MNT-006** As a visitor, I see one version number for the platform, whichever application answers. <!-- 03-features/admin-superadmin.md S3, S6; camap-hx/src/App.hx:21; camap-ts/packages/api-core/src/tools/tools.controller.ts:11-21 -->
  - The version is set at build time (from the CI) and read from one source by the Haxe and the TS ping endpoints.
  - Once Haxe is removed, only the TS endpoints remain: see `task/refacto-hx-ts/TS-ONLY-STEP.md`.
  - **ERRATUM** Today the Haxe ping returns a hard-coded version 3.0.12 while the TS ping and health endpoints return the `VERSION` environment variable or 0. Source: `camap-hx/src/App.hx:21`, `camap-hx/src/controller/Main.hx:327`, `camap-ts/packages/api-core/src/tools/tools.controller.ts:11-21` (CODE-121).
  - **DECISION (UND-113, 2026-11-06)** Expose one build-time version through both ping endpoints.

- **ADM-MNT-007** As a visitor, there is no internal style-guide (CSS demo) page. <!-- 03-features/admin-superadmin.md S3, S7; camap-hx/src/controller/Main.hx:209-215 -->
  - The `/cssdemo` page is removed.
  - **ERRATUM** Today `/cssdemo` is public. Source: `camap-hx/src/controller/Main.hx:209-215` (CODE-026).
  - **DECISION (UND-107, 2026-11-02)** Keep admin@camap.tld as the default admin user created at first install; restrict diagnostics to superadmins; remove the CSS demo page.

- **ADM-MNT-008** As a visitor, I can read the terms of service. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/Main.hx:358-364 -->

- **ADM-MNT-009** As a platform operator, platform SMTP settings and analytics ids are read from stored variables. <!-- 03-features/admin-superadmin.md S4 Variable keys; camap-hx/src/db/BufferedJsonMail.hx:82-85 -->
  - They have no admin screen and stay in the environment configuration (see ADM-MNT-010).

- **ADM-MNT-010** As a superadmin, I can edit the maintenance mode from a screen, and no other stored platform setting. <!-- 03-features/admin-superadmin.md S4 Variable keys; camap-hx/src/controller/Main.hx:36 -->
  - SMTP settings, the analytics id and the style versions have no admin screen: they stay in the environment configuration.
  - **ERRATUM** Today no screen edits any of these settings, maintenance mode included, and TS reads SMTP from environment variables instead of the stored variables. Source: `camap-hx/src/controller/Main.hx:36`, `camap-hx/src/db/BufferedJsonMail.hx:82-85`, `camap-ts/packages/api-core/src/envSchema.ts:25-32`.
  - **DECISION (UND-111, 2026-11-06)** Add a superadmin toggle for maintenance mode only; keep SMTP, analytics and version settings in environment configuration.
