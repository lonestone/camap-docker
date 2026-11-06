# Products (CAT-PRD)

Actors: catalog coordinator, member.

- **CAT-PRD-001** As a catalog coordinator, I can create a product in a catalog I manage. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Product.hx:103 -->
  - A product has a name (128 characters), reference (32), price, VAT rate, description, quantity, unit and image.
  - Options: organic, variable price, multi-weight, bulk, active.

- **CAT-PRD-002** As a catalog coordinator, a new product starts with VAT 5.5%, unit "piece", quantity 1 and active. <!-- 03-features/catalogs-products-vendors-places.md R18; camap-hx/src/db/Product.hx:42-54 -->
  - A quantity of 0 is stored as empty.
  - An empty VAT is read as 0.

- **CAT-PRD-003** As a catalog coordinator, I can edit a product I manage. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Product.hx:34 -->

- **CAT-PRD-004** As a catalog coordinator, the price, quantity and unit of a product are locked once the product has been ordered, whatever the status of the order. <!-- 03-features/catalogs-products-vendors-places.md R6; camap-hx/src/controller/Product.hx:40-83 -->
  - The price is shown as read-only text.
  - The server checks it again.

- **CAT-PRD-005** As a catalog coordinator, I can copy a product and deactivate the original, to change price, quantity or unit of an ordered product. <!-- 03-features/catalogs-products-vendors-places.md R6, S3.1; camap-hx/src/controller/Product.hx:169-184 -->
  - The copy keeps the stock settings.

- **CAT-PRD-006** As a catalog coordinator, I cannot delete a product referenced by any order. <!-- 03-features/catalogs-products-vendors-places.md R22; camap-hx/src/controller/Product.hx:149-159 -->
  - Deletion needs a valid security token.

- **CAT-PRD-007** As a catalog coordinator, I can enable or disable several products at once. <!-- 03-features/catalogs-products-vendors-places.md R22; camap-hx/src/service/ProductService.hx:14-48 -->
  - Only products of the catalog of the page are affected, see CAT-PRD-008.
  - **ERRATUM** Today the rights check uses the catalog of the page, but the products sent can belong to another catalog. Source: `camap-hx/src/service/ProductService.hx:14,35, camap-hx/src/controller/ContractAdmin.hx:258-259` (CODE-017).
  - **DECISION (UND-040, 2026-11-06)** Bind the batch to the catalog of the page, see CAT-PRD-008.

- **CAT-PRD-008**: As a catalog coordinator, a batch enable or disable only affects products of the catalog I manage. <!-- 03-features/catalogs-products-vendors-places.md R22; camap-hx/src/service/ProductService.hx:14-27,35-48; camap-hx/src/controller/ContractAdmin.hx:275-285 -->
  - The batch is bound to the catalog of the page: that catalog is passed to the service, which rejects any product id not in it before the event is fired.
  - **ERRATUM** Today the service takes the catalog from the first product id while rights are checked on the catalog of the URL, so a coordinator can act on another catalog's products. Source: `camap-hx/src/service/ProductService.hx:14-48`, `camap-hx/src/controller/ContractAdmin.hx:258-285` (CODE-017).
  - **DECISION (UND-040, 2026-11-06)** Bind the batch enable/disable to the catalog in the URL and reject foreign product ids.

- **CAT-PRD-009** As a catalog coordinator of a constant catalog, I do not see the bulk and variable-price options. <!-- 03-features/catalogs-products-vendors-places.md R21; camap-hx/src/service/ProductService.hx:105-108 -->

- **CAT-PRD-010** As a catalog coordinator, a bulk product needs a unit and a quantity and cannot be multi-weight. <!-- 03-features/catalogs-products-vendors-places.md R21; camap-hx/src/service/ProductService.hx:197-205 -->

- **CAT-PRD-011** As a catalog coordinator, I can make a product multi-weight without making it a variable-price product. <!-- 03-features/catalogs-products-vendors-places.md R21; camap-hx/src/db/Product.hx:285-289 -->
  - The rule "multi-weight implies variable price" is deliberately not enforced (commented out in `camap-hx/src/db/Product.hx:285-289`).
  - **DECISION (UND-049, 2026-11-06)** Keep the current behaviour: multi-weight is allowed alone.

- **CAT-PRD-012** As a member, I see a default vegetable picture for a product without image. <!-- 03-features/catalogs-products-vendors-places.md R23; camap-hx/src/db/Product.hx:191-197 -->

- **CAT-PRD-013** As a catalog coordinator, I can upload and crop a product image. <!-- 03-features/catalogs-products-vendors-places.md R23, R46; camap-hx/js/App.hx:94-106; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:39 -->
  - The new image replaces the previous one.
  - The image is compressed.

- **CAT-PRD-014** As a member, I can order quantities in units: piece, kilogram, gram, litre, centilitre or millilitre. <!-- 03-features/catalogs-products-vendors-places.md S2; camap-hx/common/Common.hx:90-97 -->

- **CAT-PRD-015** As a catalog coordinator, a product edit that fails validation leaves its stock settings untouched. <!-- 03-features/catalogs-products-vendors-places.md R26; camap-hx/src/controller/Product.hx:70-76; camap-hx/src/service/ProductService.hx:150 -->
  - The frozen-field and validation checks run before the stock rows are rewritten.
  - **ERRATUM** Today the edit action rewrites the stock rows first (`updateProductStocksConfiguration`), then runs the checks; rollback on error is unverified. Source: `camap-hx/src/controller/Product.hx:70-76`, `camap-hx/src/service/ProductService.hx:150` (CODE-043).
  - **DECISION (UND-038, 2026-11-06)** Validate first, then rewrite the stock rows.

- **CAT-PRD-016** As a member, I can see products with their unit, quantity, price and organic label in the catalog. <!-- 03-features/catalogs-products-vendors-places.md R25; camap-hx/src/db/Product.hx:224-248 -->

- **CAT-PRD-017** As a vendor, I can see a sample of products of my vendor record, with similar names merged. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:179-198 -->

- **CAT-PRD-018** As a logged-in user, I can see a sample of a vendor's products; a visitor cannot. <!-- 03-features/catalogs-products-vendors-places.md S3.3, S7; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:179 -->
  - **ERRATUM** Today `vendorProductsSample` has no guard. Source: `camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:179` (CODE-022).
  - **DECISION (UND-043, 2026-11-06)** Require login on all these TS queries; restrict catalog `subscriptions` to catalog managers and the subscriber, catalog `products` to group members or managers, and `place` to members of its group.
