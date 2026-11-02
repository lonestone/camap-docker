# Vendor public page and dashboard (CAT-VDB)

Actors: visitor, member, vendor.

- **CAT-VDB-001** As a visitor, I can open the public page of a vendor. <!-- 03-features/catalogs-products-vendors-places.md S3.1, F4; camap-hx/src/controller/Vendor.hx:22-38 -->
  - The page shows portrait, description, photos, active catalogs and next distributions.

- **CAT-VDB-002** As a visitor, the public page shows at most the next 4 distributions per group, and I can browse all distributions from a date. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:470-509 -->

- **CAT-VDB-003** As a vendor, I can open my vendor dashboard. <!-- 03-features/catalogs-products-vendors-places.md S3.1, F3; camap-hx/src/controller/Vendor.hx:42-43 -->
  - It has tabs for my profile, contracts, distributions, documents and images.
  - Only vendors can open it.

- **CAT-VDB-004** As a vendor, I can edit my profile from the dashboard. <!-- 03-features/catalogs-products-vendors-places.md F3; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:182 -->
  - Latitude and longitude are fields I can type.

- **CAT-VDB-005** As a vendor, I can upload my vendor image and gallery photos. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:283,330 -->
  - Photos are public.

- **CAT-VDB-006** As a vendor, I can add and delete PDF documents of my vendor record. <!-- 03-features/catalogs-products-vendors-places.md F3; camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:56,185 -->
