# Maintenance tools (ADM-TLS)

Actors: superadmin.

- **ADM-TLS-001** As a superadmin, I can list unsent emails and reset their retry counter. <!-- 03-features/admin-superadmin.md S3; 03-features/messaging-mails.md S3; camap-hx/src/controller/admin/Admin.hx:64-71 -->

- **ADM-TLS-002** As a superadmin, I can preview any email template with sample data and list all templates. <!-- 03-features/admin-superadmin.md S3; camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:36-86 -->
  - The removed templates with no sender (UND-106) no longer appear in the list.
  - **DECISION (UND-106, 2026-11-06)** The template list shows only templates that a flow can send. Fixed before the migration ([PRE-MIGRATION-TASKS.md](../../PRE-MIGRATION-TASKS.md)).
- **ADM-TLS-003** As a superadmin, I can view a stored image and recompress one image or a page of 500 images. <!-- 03-features/admin-superadmin.md S3; camap-ts/packages/api-core/src/files/file.controller.ts:33-150 -->
  - Compression overwrites the image.
  - A non-image gives "Not an image".

- **ADM-TLS-004** As a superadmin, I can copy products from one catalog to another. <!-- 03-features/admin-superadmin.md R5; camap-hx/src/controller/ContractAdmin.hx:314-336 -->
  - See CAT-CDD-007.

- **ADM-TLS-005** As a superadmin, I can delete a user through the bridge from the old back-office. <!-- 03-features/users-auth.md S3.3; camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:48-60 -->
  - See ADM-USR-003.
  - The bridge delete is a POST, and a refusal reason is shown to me (see ACC-DEL-009).
  - **DECISION (UND-022, 2026-11-06)** The bridge delete is a POST and the refusal reason is shown.

- **ADM-TLS-006** As a platform operator, the only stored platform setting that matters is the terms-of-service version, which stamps new vendors; settings can be read and saved reliably. <!-- 03-features/admin-superadmin.md S4 TS Variable keys; camap-ts/packages/api-core/src/tools/variable.service.ts:9-14 -->
  - The `platformtermsofservice` setting is kept.
  - The dead settings `tosVersion` and `defaultShowcaseGroupIds` are removed, and so is the unused IP blacklist setting.
  - Reading a missing numeric setting returns "no value" (undefined) instead of failing, and saving a setting waits for the write.
  - **ERRATUM** Today only the terms-of-service version is read; `tosVersion` and `defaultShowcaseGroupIds` are never read, the IP blacklist guard is never applied, reading a missing integer setting throws, and saving does not wait. Source: `camap-ts/packages/api-core/src/tools/variable.service.ts:9-72`, `camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:184-186`, `camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:27` (CODE-060).
  - **DECISION (UND-115, 2026-11-06)** Keep `platformtermsofservice`, remove the dead settings and the unused IP blacklist, fix `getInt` and await `set`.
