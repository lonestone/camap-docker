# Payment types and group payment settings (PAY-TYP)

Actors: group admin, member, coordinator.

- **PAY-TYP-001** As a member, I can pay or be recorded as paying with one of these types: cash, check, bank transfer, card terminal, on the spot, or money pot. <!-- 03-features/payments-operations-reports.md S2; camap-hx/src/payment/PaymentType.hx; camap-ts/packages/api-core/src/payments/interfaces.ts:8-50 -->
  - Cash, check and card terminal are paid on the spot.
  - "On the spot" is a combined choice standing for the allowed on-the-spot types.

- **PAY-TYP-002** As a group admin, I can choose which payment types my group accepts and set the group IBAN. <!-- 03-features/payments-operations-reports.md S3.1, R4; camap-hx/src/controller/AmapAdmin.hx:292-335 -->
  - At least one type is required.
  - "Money pot" cannot be combined with other types.

- **PAY-TYP-003** *Undecided (UND-093)*: As a group admin, I can choose "money pot" among the payment types. <!-- 03-features/payments-operations-reports.md S2, R4; camap-hx/src/service/PaymentService.hx:263; camap-ts/packages/api-core/src/payments/services/payments.service.ts:84 -->
  - It is hidden from the list of all types but still accepted for validation and manual entry.
  - **SUGGESTION** Remove money pot as a choosable type and refuse it in validation and manual entry. Based on: `camap-hx/src/service/PaymentService.hx:263` (commented out of all types), `camap-hx/src/service/PaymentService.hx:306-308` (excluded from manual entry), `camap-ts/packages/api-core/src/payments/services/payments.service.ts:84,123-124` (same exclusion in TS). Confidence: medium.

- **PAY-TYP-004** As a group, a new group accepts cash and check by default. <!-- 03-features/payments-operations-reports.md R4; camap-hx/src/controller/Group.hx:160 -->
  - An unreadable setting means no type allowed.

- **PAY-TYP-005** As a member paying, I see the types my group allows. <!-- 03-features/payments-operations-reports.md S2 Payment contexts; camap-hx/src/service/PaymentService.hx:251-313 -->
  - If any on-the-spot type is allowed, a single "on the spot" choice appears.
  - Types not paid on the spot appear individually.
  - With no allowed type I see none.

- **PAY-TYP-006** As a group admin, the types I can configure are all types except "on the spot". <!-- 03-features/payments-operations-reports.md S2 Payment contexts; camap-hx/src/service/PaymentService.hx:251-313 -->

- **PAY-TYP-007** As a coordinator entering a payment by hand, I can choose among the group admin types except "money pot". <!-- 03-features/payments-operations-reports.md S2 Payment contexts; camap-hx/src/service/PaymentService.hx:251-313 -->

- **PAY-TYP-008** As a member, when the group allows exactly one on-the-spot type, "on the spot" means that type. <!-- 03-features/payments-operations-reports.md R8; camap-hx/src/service/PaymentService.hx:27-31 -->

- **PAY-TYP-009** As a member, I see no help link per payment type; payment types have no link field. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/payment/Cash.hx:19; camap-hx/src/payment/Transfer.hx:19 -->
  - The documentation link (docLink) shown in the admin form stays.
  - **ERRATUM** Today each payment type has a link to a `/transaction/<type>` page that does not exist. Source: `camap-hx/src/payment/Cash.hx:19` (CODE-129).
  - **DECISION (UND-092, 2026-11-02)** Remove the unused link field of payment types; keep docLink.
