# Product CSV import and export (CAT-PCS)

Actors: catalog coordinator.

- **CAT-PCS-001** As a catalog coordinator, I can import products from a CSV file in three steps. <!-- 03-features/catalogs-products-vendors-places.md S3.1, R24; camap-hx/src/controller/Product.hx:187-269 -->
  - Columns: product name, price, reference, description, VAT, quantity, unit, organic, bulk, variable price.
  - Units kg, g, l, cl, ml and their long names are understood. Other values mean piece.
  - Imported products are active and have no stock tracking.
  - The file is limited to 4 MB.

- **CAT-PCS-002** *Undecided (UND-039)*: As a catalog coordinator, I can export the products of a catalog I manage as CSV. <!-- 03-features/catalogs-products-vendors-places.md S3.1, R24; camap-hx/src/controller/Product.hx:286-322 -->
  - Columns: name, price, reference, description, VAT, quantity, unit, organic, bulk, variable price.
  - Active status and image are not exported.
  - **SUGGESTION** Restrict both. Product export needs `canManageContract(catalog)`. REST catalog and product reads need a logged-in member of the catalog's group, and the product list hides inactive products. Based on: `camap-hx/src/controller/Product.hx:34` (edit mirrors this check), `camap-hx/src/controller/Product.hx:286-290` (export has no check), `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:150` (only caller is the logged-in order box). Confidence: medium.
