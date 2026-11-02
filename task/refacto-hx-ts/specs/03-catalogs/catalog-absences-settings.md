# Absence rules of a catalog (CAT-CAB)

Actors: catalog coordinator, member. Declaring absences is in 05-orders/absences.md.

- **CAT-CAB-001** As a catalog coordinator, I can allow absences on a catalog by giving a maximum number and an absence period. <!-- 03-features/catalogs-products-vendors-places.md S3.1, R14; camap-hx/src/controller/ContractAdmin.hx:1121 -->

- **CAT-CAB-002** As a member, absences are available on a constant catalog, or on a variable catalog with a per-distribution minimum above 0, once a maximum number and both dates are set. <!-- 03-features/catalogs-products-vendors-places.md R14; camap-hx/src/db/Catalog.hx:145-152 -->

- **CAT-CAB-003** As a catalog coordinator, if I allow absences, both period dates are required and the start is before the end. <!-- 03-features/catalogs-products-vendors-places.md R14; camap-hx/src/service/CatalogService.hx:197-233 -->

- **CAT-CAB-004** As a catalog coordinator, the maximum number of absences cannot exceed the number of distributions in the period. <!-- 03-features/catalogs-products-vendors-places.md R14; camap-hx/src/service/CatalogService.hx:197-233 -->
  - If the period covers the whole catalog, the maximum must be lower than the total number of distributions.

- **CAT-CAB-005** As a catalog coordinator, the absence period must lie inside the catalog dates. <!-- 03-features/catalogs-products-vendors-places.md R14; camap-hx/src/service/CatalogService.hx:197-233 -->

- **CAT-CAB-006** As a member, I can see the absence period and the distributions concerned on the catalog page. <!-- 03-features/catalogs-products-vendors-places.md S3.2; camap-hx/src/controller/api/Catalog.hx:48 -->
