# Duplicate and delete a catalog (CAT-CDD)

Actors: catalog coordinator, coordinator of all catalogs.

- **CAT-CDD-001** As a catalog coordinator, I can duplicate a catalog. <!-- 03-features/catalogs-products-vendors-places.md R11; camap-hx/src/controller/ContractAdmin.hx:782,810-834 -->
  - The copy keeps name, dates, contact, description, options, vendor, closing delay and maximum absences.
  - Absence dates are not copied.
  - I can choose the type of the copy.
  - A variable copy keeps the opening delay of the source, or 365 days.

- **CAT-CDD-002** As a catalog coordinator, when duplicating I choose to copy no products, all products or only active products. <!-- 03-features/catalogs-products-vendors-places.md R11; camap-hx/src/controller/ContractAdmin.hx:860-876 -->
  - Copied products have stock tracking disabled.

- **CAT-CDD-003** As a group admin, when duplicating I can also copy the distributions of the catalog. <!-- 03-features/catalogs-products-vendors-places.md R11; camap-hx/src/controller/ContractAdmin.hx:878-891 -->
  - Other coordinators do not get this option.

- **CAT-CDD-004** As a catalog coordinator, duplicating copies the volunteer roles and makes the contact (or me) coordinator of the copy. <!-- 03-features/catalogs-products-vendors-places.md R11; camap-hx/src/controller/ContractAdmin.hx:842-858,894-903 -->

- **CAT-CDD-005** As a coordinator of all catalogs, I can delete a catalog. <!-- 03-features/catalogs-products-vendors-places.md R13; camap-hx/src/controller/ContractAdmin.hx:1170-1204 -->
  - Deletion is refused if the total ordered quantity is above 0.
  - The contact's coordinator right and the volunteer roles are removed.

- **CAT-CDD-006** As a coordinator of all catalogs, deleting a catalog removes it for good, with its volunteer roles; its products and distributions go with it through the database cascade. <!-- 03-features/catalogs-products-vendors-places.md R13; camap-hx/src/controller/ContractAdmin.hx:1166-1204 -->
  - The deletion is permanent (the catalog is not archived) and only possible while no order has a quantity above 0 (see CAT-CDD-005).
  - The code deletes only the volunteer roles and the catalog; the removal of products, distributions and orders relies on the database cascade, which is not verified (`camap-hx/src/controller/ContractAdmin.hx:1166-1204`). This is accepted as is.
  - A later soft delete of catalogs is planned for after the migration: see `task/refacto-hx-ts/POST-MIGRATION-TASKS.md`.
  - **DECISION (UND-047, 2026-11-06)** Keep the current behaviour: hard delete blocked by ordered quantities, no explicit deletion of products and distributions; making catalogs soft-deleted is a post-migration task.

- **CAT-CDD-007** As a superadmin, I can copy the products of one catalog into another, keeping only name and price, optionally deleting the target's products first. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/ContractAdmin.hx:314-336 -->
