# Prices, VAT and fees (CAT-PPR)

Actors: catalog coordinator, member.

- **CAT-PPR-001** As a catalog coordinator, I enter product prices including VAT. <!-- 03-features/catalogs-products-vendors-places.md R19; camap-hx/src/db/Product.hx:20 -->
  - The price has 2 decimals.

- **CAT-PPR-002** As a catalog coordinator, the price without VAT is the price with VAT divided by 1 plus the VAT rate. <!-- 03-features/catalogs-products-vendors-places.md R19; camap-hx/src/service/ProductService.hx:51-53 -->
  - The VAT amount is the price minus the price without VAT.

- **CAT-PPR-003** As a catalog coordinator, I can type the price with or without VAT and the other fields stay in sync. <!-- 03-features/catalogs-products-vendors-places.md R20; camap-hx/js/App.hx:75-91 -->

- **CAT-PPR-004** As a catalog coordinator, I choose the VAT rate among the rates defined by my group. <!-- 03-features/catalogs-products-vendors-places.md R20; camap-hx/src/service/ProductService.hx:131-139 -->
  - A group starts with "TVA alimentaire" at 5.5% and "TVA standard" at 20%.
  - The two rates are recreated if the group's rate list is invalid.

- **CAT-PPR-005** As a member, the displayed price of a product never includes a percentage fee, whatever the stored catalog settings. <!-- 03-features/catalogs-products-vendors-places.md R5, R17; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:100-112 -->
  - TS no longer adds the catalog percentage to the displayed price.
  - **ERRATUM** Today TS adds the catalog percentage fee to the displayed price when the flag is set. Source: `camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:100-112` (CODE-097).
  - **DECISION (UND-037, 2026-11-06)** Deactivate percentage fees everywhere without removing them from the data model: the field is not offered, no fee is applied, and the stored flag and percentage are ignored.
