# Claiming a vendor record (CAT-VCL)

Actors: logged-in user, vendor.

- **CAT-VCL-001** As a logged-in user, I can see the vendor records I can claim. <!-- 03-features/catalogs-products-vendors-places.md S3.3, R38; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:95 -->

- **CAT-VCL-002** As a logged-in user, I can claim an unclaimed vendor record whose email equals my primary or secondary email. <!-- 03-features/catalogs-products-vendors-places.md S3.3, R38; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:218-249 -->

- **CAT-VCL-003** As a logged-in user without a secondary email, I can claim a vendor with my primary email without error. <!-- 03-features/catalogs-products-vendors-places.md R38; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:76 -->
  - The secondary email is compared only when it is set (null-safe comparison, also in the claim itself).
  - **ERRATUM** Today `email2.toLowerCase()` throws when the user has no secondary email. Source: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:76` (CODE-074).
  - **DECISION (UND-048, 2026-11-06)** Fix the crash with a null-safe comparison of the secondary email.

- **CAT-VCL-004** As a vendor, when I claim a record, I am added to the groups of the vendor's active catalogs. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:225-234 -->

- **CAT-VCL-005** As a vendor with an existing record, claiming another record merges it into my existing one. <!-- 03-features/catalogs-products-vendors-places.md S3.3, R38; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:237-249 -->

- **CAT-VCL-006** As a vendor, I can merge all my other vendor records into one target record. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:253 -->

- **CAT-VCL-007** As a vendor who claimed a record, I automatically manage all catalogs of that vendor. <!-- 03-features/catalogs-products-vendors-places.md R35; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:138-140 -->
  - See GRP-RIG-006.
