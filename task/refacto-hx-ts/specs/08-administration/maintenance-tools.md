# Maintenance tools (ADM-TLS)

Actors: superadmin.

- **ADM-TLS-001** As a superadmin, I can list unsent emails and reset their retry counter. <!-- 03-features/admin-superadmin.md S3; 03-features/messaging-mails.md S3; camap-hx/src/controller/admin/Admin.hx:64-71 -->

- **ADM-TLS-002** As a superadmin, I can preview any email template with sample data and list all templates. <!-- 03-features/admin-superadmin.md S3; camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:36-86 -->

- **ADM-TLS-003** As a superadmin, I can view a stored image and recompress one image or a page of 500 images. <!-- 03-features/admin-superadmin.md S3; camap-ts/packages/api-core/src/files/file.controller.ts:33-150 -->
  - Compression overwrites the image.
  - A non-image gives "Not an image".

- **ADM-TLS-004** As a superadmin, I can copy products from one catalog to another. <!-- 03-features/admin-superadmin.md R5; camap-hx/src/controller/ContractAdmin.hx:314-336 -->
  - See CAT-CDD-007.

- **ADM-TLS-005** As a superadmin, I can delete a user through the bridge from the old back-office. <!-- 03-features/users-auth.md S3.3; camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:48-60 -->
  - See ADM-USR-003.

- **ADM-TLS-006** *Undecided (UND-115)*: As a platform operator, stored platform settings (terms-of-service version, IP blacklist, showcase groups) have an effect on the platform. <!-- 03-features/admin-superadmin.md S4 TS Variable keys; camap-ts/packages/api-core/src/tools/variable.service.ts:9-14 -->
  - Only the terms-of-service version is read, to stamp new vendors.
  - The blacklist guard is never applied and the showcase setting is never read.
  - Reading a missing numeric setting fails, and saving a setting does not wait for the write.
  - **SUGGESTION** Keep `platformtermsofservice`; remove `tosVersion` and `defaultShowcaseGroupIds`; fix `getInt` (undefined, not null) and await `set`; drop the IP blacklist unless its guard is applied. Based on: `camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:184-186` (only live read), `camap-ts/packages/api-core/src/tools/variable.service.ts:42-52` (`findOne` returns undefined; `i.value` throws), `camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:27` (guard unused). Confidence: medium. Product input needed: is an IP blacklist wanted?
