# Stock management (CAT-STK)

Actors: catalog coordinator, member.

- **CAT-STK-001** As a catalog coordinator, I can manage product stock only in catalogs where stock management is on. <!-- 03-features/catalogs-products-vendors-places.md R28; camap-hx/src/service/ProductService.hx:111-127 -->
  - The stocks page shows an error when it is off.

- **CAT-STK-002** As a catalog coordinator, I choose for each product one stock mode: none, global, or per distribution. <!-- 03-features/catalogs-products-vendors-places.md R29; camap-hx/src/db/Product.hx:64-125 -->
  - None: the product is always available.
  - Global: one stock for the catalog; every order with a quantity above 0 reduces it.
  - Per distribution: three sub-modes below.

- **CAT-STK-003** As a catalog coordinator, in per-distribution mode I can give the same stock at every distribution. <!-- 03-features/catalogs-products-vendors-places.md R29; camap-hx/common/Common.hx:103-140 -->

- **CAT-STK-004** As a catalog coordinator, in per-distribution mode I can give a stock only every 2nd, 3rd or 4th distribution, starting from a chosen distribution. <!-- 03-features/catalogs-products-vendors-places.md R29, R32; camap-hx/src/form/StockTrackingPerDistribForm.hx:36-70 -->

- **CAT-STK-005** As a catalog coordinator, in per-distribution mode I can give a stock per period between two distributions. <!-- 03-features/catalogs-products-vendors-places.md R29; camap-hx/src/service/ProductService.hx:171-185 -->
  - A distribution outside every period has a stock of 0.

- **CAT-STK-006** As a member, the stock available for a distribution is the stock minus the quantities already ordered. <!-- 03-features/catalogs-products-vendors-places.md R30; camap-hx/src/db/Product.hx:147-181 -->
  - A multi-weight product counts 1 per order line.
  - The available stock never goes below 0 in the display.
  - No stock tracking or an empty stock means no limit.

- **CAT-STK-007** As a member, I can see the available stock of each product for each future distribution. <!-- 03-features/catalogs-products-vendors-places.md F6; camap-hx/src/controller/api/Catalog.hx:57-72 -->
  - Nothing is shown when the catalog has no stock management.

- **CAT-STK-008** As a catalog coordinator, a stock is required when stock tracking is on. <!-- 03-features/catalogs-products-vendors-places.md R32; camap-hx/src/service/ProductService.hx:207-222 -->

- **CAT-STK-009** As a catalog coordinator, I cannot save a stock that would make the available stock negative at a future distribution. <!-- 03-features/catalogs-products-vendors-places.md R32; camap-hx/src/service/ProductService.hx:207-222 -->
  - The error shows the minimum stock allowed.

- **CAT-STK-010** As a catalog coordinator, I only get a warning when I save a catalog containing a tracked product without stock. <!-- 03-features/catalogs-products-vendors-places.md R32; camap-hx/src/service/CatalogService.hx:185-193 -->

- **CAT-STK-011** As a catalog coordinator, the distributions used by a stock period must belong to the product's catalog. <!-- 03-features/catalogs-products-vendors-places.md R31; camap-hx/src/db/ProductDistributionStock.hx:26-33 -->

- **CAT-STK-012** As a catalog coordinator, stock tracking is turned off on a product when the catalog has no stock management. <!-- 03-features/catalogs-products-vendors-places.md R28; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:142-151 -->

- **CAT-STK-013** As a catalog coordinator, a duplicated product starts with stock tracking off and no stock periods. <!-- 03-features/catalogs-products-vendors-places.md R34; camap-hx/src/service/ProductService.hx:73-75 -->
