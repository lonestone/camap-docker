# Catalog creation (CAT-CCR)

Actors: catalog coordinator with the right on all catalogs.

- **CAT-CCR-001** As a coordinator of all catalogs, I can start a new catalog by searching for a vendor. <!-- 03-features/catalogs-products-vendors-places.md S3.1, F1; camap-hx/src/controller/Contract.hx:41 -->
  - The search uses name words, profession and distance to the group's main place.
  - At most 30 results are shown.

- **CAT-CCR-002** As a coordinator of all catalogs, I can create a new vendor when the vendor is not found. <!-- 03-features/catalogs-products-vendors-places.md S3.1, F1; camap-hx/src/controller/Contract.hx:87-99 -->
  - I must tick the personal data (GDPR) checkbox.

- **CAT-CCR-003** As a coordinator, I cannot create a catalog for a disabled vendor. <!-- 03-features/catalogs-products-vendors-places.md S3.1, R37; camap-hx/src/controller/Contract.hx:125-127 -->

- **CAT-CCR-004** As a coordinator, I choose the catalog type: constant orders or variable orders. <!-- 03-features/catalogs-products-vendors-places.md S3.1, R1; camap-hx/src/controller/Contract.hx:122-137 -->
  - Variable is the default type.

- **CAT-CCR-005** As a coordinator, a new catalog is pre-filled with a default name, a start date of today and an end date one year later. <!-- 03-features/catalogs-products-vendors-places.md R5; camap-hx/src/service/CatalogService.hx:89-91 -->
  - The default name is "Contrat AMAP classique" or "Contrat AMAP variable" followed by the vendor name.

- **CAT-CCR-006** As a coordinator, I must choose a contact person for the catalog. <!-- 03-features/catalogs-products-vendors-places.md R5; camap-hx/src/service/CatalogService.hx:103 -->

- **CAT-CCR-007** As a coordinator, a new catalog accepts user orders by default. <!-- 03-features/catalogs-products-vendors-places.md R2; camap-hx/src/db/Catalog.hx:63 -->

- **CAT-CCR-008** As a coordinator, creating the catalog creates the volunteer roles for the number of volunteers I chose per distribution. <!-- 03-features/catalogs-products-vendors-places.md R12; camap-hx/src/controller/Contract.hx:162 -->

- **CAT-CCR-009** As a vendor who is also a user, I am added to the group when a catalog is created for me. <!-- 03-features/catalogs-products-vendors-places.md R12; camap-hx/src/controller/Contract.hx:165-167 -->

- **CAT-CCR-010** As the contact of a new catalog, I receive the catalog coordinator, messages and membership rights. <!-- 03-features/catalogs-products-vendors-places.md R12; camap-hx/src/controller/Contract.hx:168-174 -->

- **CAT-CCR-011** As a coordinator, after creating a catalog I land on its dashboard. <!-- 03-features/catalogs-products-vendors-places.md F1; camap-hx/src/controller/Contract.hx:41-183 -->

- **CAT-CCR-012** As a coordinator, the start date is set to the beginning of the day and the end date to the end of the day. <!-- 03-features/catalogs-products-vendors-places.md R3; camap-hx/src/db/Catalog.hx:341-351 -->
  - The start date must not be after the end date.

- **CAT-CCR-013** As a coordinator, I cannot save a catalog whose period leaves existing distributions outside of it. <!-- 03-features/catalogs-products-vendors-places.md R3; camap-hx/src/service/CatalogService.hx:123-135 -->

- **CAT-CCR-014** As a coordinator, I cannot set a percentage fee on the orders of a catalog: the feature is deactivated. <!-- 03-features/catalogs-products-vendors-places.md R5; camap-hx/src/db/Catalog.hx:128-131; camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:146-153 -->
  - The catalog form does not offer the percentage fields.
  - The flag and the percentage stay in the data model, unused, and no check treats a catalog as having a percentage fee.
  - **ERRATUM** Today the Haxe form no longer offers the fields (banner announcing the removal on 1 Feb 2023) and its check always returns false, but TS still applies the flag and the percentage. Source: `camap-hx/src/db/Catalog.hx:128-131`, `camap-hx/src/controller/ContractAdmin.hx:83-88`, `camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:146-178` (CODE-097).
  - **DECISION (UND-037, 2026-11-06)** Deactivate percentage fees everywhere without removing them from the data model: the field is not offered, no fee is applied, and the stored flag and percentage are ignored.
