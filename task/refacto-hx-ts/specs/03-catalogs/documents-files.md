# Documents, images and files (CAT-DOC)

Actors: group admin, catalog coordinator, vendor, member, the system, superadmin.

- **CAT-DOC-001** As a group admin, I can add PDF documents to my group. <!-- 03-features/catalogs-products-vendors-places.md S3.1, R48; camap-hx/src/controller/Documents.hx:112-153 -->
  - The file name must end with .pdf and the file must not exceed 10 MB.

- **CAT-DOC-002** As a catalog coordinator, I can add PDF documents to a catalog I manage. <!-- 03-features/catalogs-products-vendors-places.md S3.1, R48; camap-hx/src/controller/Documents.hx:116-129 -->

- **CAT-DOC-003** As a document owner, I choose who can see the document. <!-- 03-features/catalogs-products-vendors-places.md R48; camap-hx/src/controller/Documents.hx:60-62 -->
  - Catalog documents: subscribers or group members.
  - Group documents: group members or everyone.
  - **ERRATUM** TS offers fewer choices (group documents: members or everyone) and returns all vendor documents without filtering; Haxe also allows subscribers for group documents. Source: `camap-hx/src/controller/Documents.hx:57-62, camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:95-126` (CODE-099).

- **CAT-DOC-004** As a member, I see catalog documents according to my relation to the catalog. <!-- 03-features/catalogs-products-vendors-places.md R15; camap-hx/src/db/Catalog.hx:310-331 -->
  - A subscriber sees all documents.
  - A group member sees all except those reserved to subscribers.
  - Other people see only public documents.

- **CAT-DOC-005** *Undecided (UND-042)*: As a visitor, I see only the documents I am allowed to see, in every screen. <!-- 03-features/catalogs-products-vendors-places.md R15, R48; camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:173-193; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:438-449 -->
  - **SUGGESTION** Apply the Haxe visibility rules in TS. Catalog documents: managers and subscribers see all, group members see all except subscribers-only, others see public only. Await `canManageCatalog(user, parent)` and fix the swapped argument. Vendor documents: show only public ones unless the user manages the vendor. Based on: `camap-hx/src/db/Catalog.hx:310-331` (rules), `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:173-193` (`canManageCatalog(currentUser, parent.id)` not awaited), `camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:95,110,125,129-150` (vendor documents only accept `public`). Confidence: high.

- **CAT-DOC-006** *Undecided (UND-053)*: As a document owner, I can only upload real PDF files. <!-- 03-features/catalogs-products-vendors-places.md R48; camap-hx/src/controller/Documents.hx:148; camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:66 -->
  - **SUGGESTION** Check the `%PDF-` file signature on upload in both stacks, on top of the `.pdf` extension. Based on: `camap-hx/src/controller/Documents.hx:148` and `camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:66` (both only test the file name extension). Confidence: high.

- **CAT-DOC-007** As a document owner, I can delete my documents. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:185 -->

- **CAT-DOC-008** As a group admin, I can add up to 5 images to my group gallery. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Media.hx:16-114 -->
  - Accepted formats: jpg, jpeg, png, bmp, gif.
  - Images are public.

- **CAT-DOC-009** *Undecided (UND-046)*: As a group admin, the maximum size of an uploaded image is stated correctly. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Media.hx:97 -->
  - **SUGGESTION** The limit is 3 MB. Set the server cap to 3 MB so it matches messages, labels and the TS compression. Based on: `camap-hx/src/controller/Media.hx:96-99` (comment and message say 3 Mb, cap is 4), `camap-hx/lang/master/tpl/contractadmin/addmedia.mtt:12` (label 3 Mo), `camap-ts/packages/front-core/src/modules/imageUploader/ImageUploader.tsx:189-190` (`maxSizeMB: 3`). Confidence: high.

- **CAT-DOC-010** As the system, I delete stored files that no product, document, group or vendor uses any more. <!-- 03-features/catalogs-products-vendors-places.md R47; camap-hx/src/controller/Cron.hx:289-316 -->
  - Each run checks a slice of 1000 files.

- **CAT-DOC-011** As a superadmin, I can view a stored image and recompress existing images to save space. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/files/file.controller.ts:33-150 -->

- **CAT-DOC-012** As a member, I can open files through a signed link that cannot be guessed. <!-- 03-features/catalogs-products-vendors-places.md R45; camap-ts/packages/api-core/src/files/file.service.ts:59-78 -->
