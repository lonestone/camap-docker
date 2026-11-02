# Reports and exports (PAY-RPT)

Actors: catalog coordinator, group admin.

- **PAY-RPT-001** As a catalog coordinator, I can export the subscriptions of my active catalogs as CSV. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/ContractAdmin.hx:431-448 -->
  - Columns: subscription id, user id and name, email, phone, second person, vendor, catalog id and name, start, end, total, payments, balance, paid (yes or no).

- **PAY-RPT-002** As a catalog coordinator, I can see and export as CSV the products ordered over a period. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/ContractAdmin.hx:349,599-657 -->
  - Columns: quantity, product name, reference, price without and with VAT, total without and with VAT.
  - The CSV has one block per vendor with a total.

- **PAY-RPT-003** As a catalog coordinator, I can see and export totals per vendor over a period. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/ContractAdmin.hx:545-640 -->
  - Only active catalogs I can manage count, unless I am group admin.
  - A period with no delivery shows "There is no delivery during this period".

- **PAY-RPT-004** As a catalog coordinator, I can export the orders of one distribution per member as CSV. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/ContractAdmin.hx:668,725-747 -->
  - Columns: name, product, price, quantity, fees, total, paid.

- **PAY-RPT-005** As a catalog coordinator, I can see and export the orders of a distribution per product. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/ContractAdmin.hx:917,930; camap-hx/src/service/ReportService.hx:93-103 -->
  - Multi-weight products count one per order line.

- **PAY-RPT-006** As a catalog coordinator, I can print a purchase order listing what to buy from the vendor. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/ContractAdmin.hx:940 -->

- **PAY-RPT-007** As a catalog coordinator, I can export product statistics as CSV with quantity, product id, name, price and percentage. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/ContractAdmin.hx:1036-1079 -->

- **PAY-RPT-008** As a group admin, I can see the turnover by VAT rate. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/service/ReportService.hx:167-174 -->

- **PAY-RPT-009** *Undecided (UND-094)*: As a catalog coordinator, report totals without VAT are correct when the same product appears in several distributions of a session. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/service/ReportService.hx:125-174; 03-features/inconsistencies-code.md CODE-039,053,054 -->
  - Currently merged lines add quantity and total with VAT but not the total without VAT.
  - The VAT-exclusive amounts are not rounded and the invoice repeats the logic.
  - **SUGGESTION** Fix the sums: add the VAT-exclusive total when merging distributions, round each line VAT-exclusive amount to 2 decimals before summing, group by saved price instead of AVG, and reuse getOrdersByVAT in the invoice. Based on: `camap-hx/src/service/ReportService.hx:149-155` (merge adds quantity and totalTTC only), `camap-hx/src/service/ReportService.hx:23-37` (AVG of saved price), `camap-hx/src/controller/Member.hx:186-193` (invoice duplicates the VAT loop). Confidence: medium.

- **PAY-RPT-010** As a coordinator, I can choose the CSV format when printing daily attendance. <!-- 03-features/payments-operations-reports.md S3.2; camap-hx/src/controller/Distribution.hx:154-159,206-229 -->
  - CSV is offered in the format form next to the other formats.
  - The existing CSV export link keeps working.
  - **ERRATUM** Today the CSV export exists but the format form offers no choice for it. Source: `camap-hx/src/controller/Distribution.hx:153-158` (CODE-130).
  - **DECISION (UND-095, 2026-11-02)** Add a CSV choice to the attendance format form.

- **PAY-RPT-011** As a coordinator, I can export the members list as CSV. <!-- 03-features/payments-operations-reports.md S3.3; camap-ts/packages/front-core/src/modules/members/containers/MembersTableAndActions.tsx:161-171 -->

- **PAY-RPT-012** As a vendor, I can export my distributions as CSV with one column per distribution date. <!-- 03-features/payments-operations-reports.md S3.3; camap-ts/packages/front-core/src/modules/vendorDashboard/vendorDistribsCsv.utils.ts:10-73 -->
  - Columns: group, product, then one per date.
  - The file is separated by semicolons with a UTF-8 byte-order mark, named after the vendor and the date.

- **PAY-RPT-013** As a membership manager, I can print an invoice for a member and a distribution session, grouped by vendor and VAT. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Member.hx:177-200 -->
