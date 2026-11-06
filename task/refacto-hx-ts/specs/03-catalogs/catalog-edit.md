# Catalog settings (CAT-CED)

Actors: catalog coordinator.

- **CAT-CED-001** As a catalog coordinator, I can edit the settings of a catalog I manage. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/ContractAdmin.hx:97-99 -->

- **CAT-CED-002** As a coordinator of a constant-orders catalog, I set the minimum delay before a distribution to enter a subscription. <!-- 03-features/catalogs-products-vendors-places.md R7; camap-hx/src/service/CatalogService.hx:49-60,169-177 -->
  - The delay is 72 hours when I leave it empty or 0.
  - The opening-delay and minimum-amount fields are hidden for constant catalogs.

- **CAT-CED-003** As a coordinator of a variable-orders catalog, I set when ordering opens before each distribution. <!-- 03-features/catalogs-products-vendors-places.md R7; camap-hx/src/service/CatalogService.hx:141-145 -->
  - The number of days cannot be 0.
  - Empty means the default of the distribution cycle.

- **CAT-CED-004** As a coordinator, changing the opening delay or the closing delay updates the order window of all future distributions of the catalog. <!-- 03-features/catalogs-products-vendors-places.md R8; camap-hx/src/service/CatalogService.hx:238-269; camap-hx/src/controller/ContractAdmin.hx:122-126 -->
  - Customised order dates of those distributions are replaced. This is intended: there is no marker of customised dates on a distribution (`camap-hx/src/db/Distribution.hx:24-25`).
  - Only a delay that really changed is passed on and rewrites the dates (`camap-hx/src/controller/ContractAdmin.hx:122-126`), and the coordinator is warned that customisations are overwritten (`camap-hx/src/service/CatalogService.hx:238-269`).
  - **DECISION (UND-054, 2026-11-06)** Keep the current behaviour (option b): the overwrite and its warning stay as they are.

- **CAT-CED-005** As a coordinator of a variable-orders catalog, I can set a minimum order total per distribution and a minimum order total for the whole catalog. <!-- 03-features/catalogs-products-vendors-places.md R9; camap-hx/src/db/Catalog.hx:141-143 -->
  - Amounts are in the group currency.
  - A catalog has constraints when it is variable and either minimum is above 0.
  - Setting the per-distribution minimum to 0 clears the absence settings.
  - I get a warning when the catalog minimum is above 0.

- **CAT-CED-006** As a coordinator of a variable-orders catalog, the vendor is always notified when orders close. <!-- 03-features/catalogs-products-vendors-places.md R10; camap-hx/src/db/Catalog.hx:162-164 -->
  - The option is hidden for variable catalogs.

- **CAT-CED-007** As a coordinator, when I change the catalog contact, the coordinator right moves to the new contact. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/ContractAdmin.hx:128-144 -->

- **CAT-CED-008** As a coordinator, I can choose to notify the vendor and the contact when orders close. <!-- 03-features/catalogs-products-vendors-places.md S2; camap-hx/src/db/Catalog.hx:8-15 -->

- **CAT-CED-009** As a coordinator, I can show product prices on the group page. <!-- 03-features/catalogs-products-vendors-places.md S2; camap-hx/src/db/Catalog.hx:8-15 -->

- **CAT-CED-010** As a coordinator, I can enable stock management for a catalog. <!-- 03-features/catalogs-products-vendors-places.md R28; camap-hx/src/db/Catalog.hx:133 -->
  - Without it, stock fields are not shown on products.

- **CAT-CED-011** As a coordinator, I can switch off user ordering on a catalog. <!-- 03-features/catalogs-products-vendors-places.md R2, R4; camap-hx/src/db/Catalog.hx:101-106 -->
  - The catalog then disappears from the shop.

- **CAT-CED-012** As a coordinator, I can refresh the price on the existing orders of a catalog with the current product prices. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/ContractAdmin.hx:753-774 -->
  - **ERRATUM** Today, for a constant-orders catalog the page fails with an error after the prices are updated; the action has no security token. Source: `camap-hx/src/controller/ContractAdmin.hx:753-776` (CODE-063).
  - **DECISION (UND-050, 2026-11-06)** The page failure is fixed (see CAT-CED-013); the missing security token is not part of this decision.

- **CAT-CED-013** As a coordinator of a constant-orders catalog, refreshing prices works without error. <!-- 03-features/catalogs-products-vendors-places.md R11; camap-hx/src/controller/ContractAdmin.hx:758-775 -->
  - For a constant catalog the action does not use the distribution argument and redirects to the orders page without `?d=`.
  - **ERRATUM** Today the refresh dereferences `args.d.id`, a distribution argument set only for variable catalogs, so it crashes on a constant catalog. The action is flagged "hidden feature". Source: `camap-hx/src/controller/ContractAdmin.hx:758-775` (CODE-063).
  - **DECISION (UND-050, 2026-11-06)** Fix the crash: skip the distribution argument and redirect without `?d` for constant catalogs.
