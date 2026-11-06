# Attendance sheets and exports (DIS-ATT)

Actors: catalog coordinator, coordinator of all catalogs, volunteer.

- **DIS-ATT-001** As a coordinator, I can print an attendance sheet for a whole day and place. <!-- 03-features/distributions-volunteers.md S3.1, R49; camap-hx/src/controller/Distribution.hx:143-229 -->
  - It covers all catalogs active in the group, with orders prepared per member, and the volunteers of the session appended.
  - I choose the layout: one member per page with prices, one member per page by contract, or a short list.
  - I choose the font size: small, medium, large or extra large.

- **DIS-ATT-002** As a coordinator, the short sheet shows one block per member with name, contact details, quantity, product and a signature column. <!-- 03-features/distributions-volunteers.md R50; camap-hx/lang/master/tpl/distribution/listByDateShort.mtt:22-26 -->
  - It shows the basket number and phone numbers.
  - It shows "alternately with" for the second person of the household.
  - It shows "Canceled" for orders of quantity 0.
  - It shows no prices.

- **DIS-ATT-003** As a coordinator, the contract sheet shows one member per page, sorted by catalog, with quantity, product, unit price, fees, total and a signature column. <!-- 03-features/distributions-volunteers.md R50; camap-hx/lang/master/tpl/distribution/listByDateOnePageContract.mtt:19-30 -->

- **DIS-ATT-004** As a coordinator, I can export the daily attendance as CSV. <!-- 03-features/distributions-volunteers.md R49; camap-hx/src/controller/Distribution.hx:206-229 -->
  - Columns: user id, user name, product name, reference, catalog name and id, vendor id, price, quantity, fees, total, paid.

- **DIS-ATT-005** As a coordinator, I can open the attendance sheet of a catalog distribution. <!-- 03-features/distributions-volunteers.md S3.1, F-F; camap-hx/src/controller/Distribution.hx:68-69 -->
  - The page for a constant catalog and for a variable catalog differ.
  - It needs the right to manage the catalog.

- **DIS-ATT-006** As a coordinator or a volunteer, I can see the attendance of a constant-orders catalog over a period. <!-- 03-features/distributions-volunteers.md R51; camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:44-69 -->
  - The period defaults to the catalog dates.
  - It lists the subscriptions overlapping the period and the distributions in it.
  - It shows the absences of each subscription.
  - Access: coordinator of all catalogs, coordinator of this catalog, or volunteer on a session of this catalog.

- **DIS-ATT-007** As a coordinator or a volunteer, I can see the attendance of a variable-orders catalog for one distribution only if I may manage that catalog or volunteer there. <!-- 03-features/distributions-volunteers.md R51; camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:90-138 -->
  - The rule is the same as for the classic sheet: manager of all catalogs, manager of the catalog, or volunteer of the session.
  - Other logged-in users are refused.
  - **ERRATUM** Today the variable-orders sheet only needs a login. Source: `camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:90-138` (CODE-009).
  - **DECISION (UND-062, 2026-11-02)** Apply the classic attendance rule: manager of all catalogs, manager of the catalog, or volunteer of the session.

- **DIS-ATT-008** As a coordinator, I can export the attendance sheet as CSV or XLSX. <!-- 03-features/distributions-volunteers.md R52; camap-ts/packages/front-core/src/components/attendanceSheet/attendanceSheet.utils.ts:9-234 -->
  - The header shows group, catalog, coordinator, vendor, instructions and volunteers.

- **DIS-ATT-009** As a coordinator, my display options of the attendance sheet are remembered in my browser. <!-- 03-features/distributions-volunteers.md S3.7; camap-ts/packages/front-core/src/components/attendanceSheet/attendanceSheet.utils.ts:297-323 -->

- **DIS-ATT-010** As a coordinator, I can see a table of products by member for one distribution. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:78 -->

- **DIS-ATT-011**: As a coordinator, I can open the products-by-member table of a distribution; no explicit catalog right is checked. <!-- 03-features/distributions-volunteers.md S3.1, S7; camap-hx/src/controller/Distribution.hx:78 -->
  - This is intended: `listByProductUser` has no explicit catalog check. Source: `camap-hx/src/controller/Distribution.hx:78` (CODE-019).
  - **DECISION (UND-060, 2026-11-04)** Keep the current behaviour: no explicit rights checks are added to these distribution handlers.
