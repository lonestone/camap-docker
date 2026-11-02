# Maintenance mode, installation and diagnostics (ADM-MNT)

Actors: superadmin, visitor, platform operator.

- **ADM-MNT-001** *Undecided (UND-111)*: As a superadmin, I can switch the platform into maintenance mode. <!-- 03-features/admin-superadmin.md S4 Variable keys, F3; camap-hx/src/controller/Main.hx:36-41 -->
  - Non-admin visitors see a maintenance page instead of the home page.
  - Superadmins bypass it.
  - Currently it is switched on only by editing the database.
  - **SUGGESTION** Add a superadmin toggle for maintenance mode only. Keep SMTP, analytics and version settings in environment configuration. Based on: `camap-hx/src/controller/admin/Admin.hx:148-154` (sibling stored-message form to copy), `camap-hx/src/controller/Main.hx:36-41` (maintenance read from the database), `camap-ts/packages/api-core/src/envSchema.ts:25-32` (TS reads SMTP from env). Confidence: medium.

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

- **ADM-MNT-006** *Undecided (UND-113)*: As a visitor, I see one version number for the platform. <!-- 03-features/admin-superadmin.md S3, S6; camap-hx/src/App.hx:21; camap-ts/packages/api-core/src/tools/tools.controller.ts:11-21 -->
  - Currently Haxe has a hard-coded version and TS reads an environment variable.
  - **SUGGESTION** Expose one build-time version from the CI, read from one source by the Haxe and TS ping endpoints. Based on: `camap-hx/src/App.hx:21` (hard-coded 3.0.12), `camap-ts/packages/api-core/src/tools/tools.controller.ts:11-21` (env `VERSION` or 0), `camap-hx/src/controller/Main.hx:327` (Haxe ping prints `App.VERSION`). Confidence: medium.

- **ADM-MNT-007** As a visitor, there is no internal style-guide (CSS demo) page. <!-- 03-features/admin-superadmin.md S3, S7; camap-hx/src/controller/Main.hx:209-215 -->
  - The `/cssdemo` page is removed and not ported to TS.
  - **ERRATUM** Today `/cssdemo` is public. Source: `camap-hx/src/controller/Main.hx:209-215` (CODE-026).
  - **DECISION (UND-107, 2026-11-02)** Keep admin@camap.tld as the default admin user created at first install; restrict diagnostics to superadmins; remove the CSS demo page.

- **ADM-MNT-008** As a visitor, I can read the terms of service. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/Main.hx:358-364 -->

- **ADM-MNT-009** As a platform operator, platform SMTP settings and analytics ids are read from stored variables. <!-- 03-features/admin-superadmin.md S4 Variable keys; camap-hx/src/db/BufferedJsonMail.hx:82-85 -->

- **ADM-MNT-010** *Undecided (UND-111)*: As a superadmin, I can edit the stored platform settings from a screen. <!-- 03-features/admin-superadmin.md S4 Variable keys; camap-hx/src/controller/Main.hx:36 -->
  - Currently no screen edits SMTP settings, analytics id or style versions.
  - **SUGGESTION** Add a superadmin toggle for maintenance mode only. Keep SMTP, analytics and version settings in environment configuration. Based on: `camap-hx/src/controller/admin/Admin.hx:148-154` (sibling stored-message form to copy), `camap-hx/src/controller/Main.hx:36-41` (maintenance read from the database), `camap-ts/packages/api-core/src/envSchema.ts:25-32` (TS reads SMTP from env). Confidence: medium.
