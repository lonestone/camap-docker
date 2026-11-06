# Catalog list, dashboard and visibility (CAT-CLV)

Actors: catalog coordinator, group admin, member, visitor. A catalog is called "contrat" in the French interface.

- **CAT-CLV-001** As a catalog coordinator, I can list the catalogs I manage. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/ContractAdmin.hx:47,63-68 -->
  - The list shows active catalogs and catalogs ended less than one month ago.
  - I can switch to the list of older, ended catalogs.
  - A group admin sees all catalogs of the group.

- **CAT-CLV-002** As a catalog coordinator, I can open the dashboard of a catalog I manage. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/ContractAdmin.hx:1014-1021 -->
  - The dashboard warns me about invalid characters in the description or in product references, names and descriptions.

- **CAT-CLV-003** As a member, a catalog is active between its start date and its end date. <!-- 03-features/catalogs-products-vendors-places.md R4; camap-hx/src/db/Catalog.hx:108-111 -->

- **CAT-CLV-004** As a member, I see a catalog in the shop only when it is active and open to orders by users. <!-- 03-features/catalogs-products-vendors-places.md R4; camap-hx/src/db/Catalog.hx:101-106 -->

- **CAT-CLV-005** As a member, a variable-orders catalog is open to orders only while at least one of its distributions has its order window open. <!-- 03-features/catalogs-products-vendors-places.md R4; camap-hx/src/db/Catalog.hx:116-126 -->
  - A constant-orders catalog is open to orders when it is visible in the shop.

- **CAT-CLV-006** As a member, I can see the active catalogs of my group, except those of a disabled vendor. <!-- 03-features/catalogs-products-vendors-places.md S3.3, R37; camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:79-93 -->

- **CAT-CLV-007** As a catalog coordinator, I can read a catalog I manage. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:53-64 -->

- **CAT-CLV-008** As a member or a visitor, I can see the catalog page with its active products, distributions, vendor, documents, constraints and absence rules. <!-- 03-features/catalogs-products-vendors-places.md S3.2; camap-hx/src/controller/api/Catalog.hx:14 -->
  - Documents shown depend on who I am (see CAT-DOC-004).

- **CAT-CLV-009** As a visitor, I cannot read the catalog or product data of a group I do not belong to. <!-- 03-features/catalogs-products-vendors-places.md S3.2; camap-hx/src/controller/api/Catalog.hx:14; camap-hx/src/controller/api/Product.hx:13-27 -->
  - The REST reads of a catalog and of its products need a logged-in member of the catalog's group, and the product list does not return inactive products.
  - **ERRATUM** Today `/api/catalog/:id` and `/api/product/*` need no login, and the product list also returns inactive products. Source: `camap-hx/src/controller/api/Catalog.hx:14`, `camap-hx/src/controller/api/Product.hx:13-27` (CODE-016).
  - **DECISION (UND-039, 2026-11-06)** Product export requires the right to manage the catalog; the REST catalog and product reads require a logged-in member of the catalog's group, and the product list hides inactive products.

- **CAT-CLV-010** As a member who is not a coordinator, I cannot read the subscriptions and products of a catalog through the catalog fields. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:141-149 -->
  - The catalog `subscriptions` field is readable only by the catalog managers and the subscriber; the `products` field only by members of the catalog's group or managers.
  - **ERRATUM** Today the catalog `products` and `subscriptions` fields have no guard or no management check. Source: `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:141-149` (CODE-021, CODE-022).
  - **DECISION (UND-043, 2026-11-06)** Require login on all these TS queries; restrict catalog `subscriptions` to catalog managers and the subscriber, catalog `products` to group members or managers, and `place` to members of its group.
