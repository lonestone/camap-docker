# Operations: debts and payments (PAY-OPE)

Actors: member, coordinator, the system. An operation is a money movement of a user in a group.

- **PAY-OPE-001** As a member, my money movements are of four types: order on a variable catalog, subscription total, payment, membership. <!-- 03-features/payments-operations-reports.md S2, R15; camap-hx/src/db/Operation.hx:5-10 -->
  - Debts are negative and payments are positive.

- **PAY-OPE-002** As a member, each of my subscriptions has one total operation named "Total Commandes" for the negative total of my orders. <!-- 03-features/payments-operations-reports.md R6; camap-hx/src/service/SubscriptionService.hx:1059-1091 -->
  - It is refreshed when I create the subscription or change orders.
  - It is also refreshed when a coordinator opens the subscription payments of an active catalog.
  - The date changes only when the amount changes.

- **PAY-OPE-003** As a member of a variable catalog, my order of a distribution session creates one debt operation named "Order for <date>" for my basket. <!-- 03-features/payments-operations-reports.md R7; camap-hx/src/service/PaymentService.hx:81-243 -->
  - The amount is the negative sum of my lines with fees.
  - Mixed catalog types in one basket are refused.
  - These operations appear in my history.

- **PAY-OPE-004** As a coordinator, a payment can point to the debt it pays. <!-- 03-features/payments-operations-reports.md R10; camap-hx/src/db/Operation.hx:36,119-121 -->

- **PAY-OPE-005** As a member, every operation amount is rounded to 2 decimals. <!-- 03-features/payments-operations-reports.md R11; camap-hx/src/db/Operation.hx:170 -->
  - A subscription total operation needs a subscription and an order operation needs a basket.
  - **ERRATUM** Today only Haxe rounds; operations written by TS are not rounded. Source: `camap-hx/src/db/Operation.hx:170` (CODE-103).
  - **DECISION (UND-089, 2026-11-06)** TS rounds every operation amount to 2 decimals on save (see PAY-OPE-006).

- **PAY-OPE-006** As a member, amounts created by the new interface are rounded the same way as by the old one. <!-- 03-features/payments-operations-reports.md R11; camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:51 -->
  - Every operation amount written by TS is rounded to 2 decimals on save, as Haxe does.
  - **ERRATUM** Today TS operations have no 2-decimal rounding on save. Source: `camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:51`, `camap-hx/src/db/Operation.hx:170` (CODE-103).
  - **DECISION (UND-089, 2026-11-06)** Round every operation amount to 2 decimals on save; when adding to an existing payment, lock the row, round the sum and await the balance update; reuse only pending on-the-spot payments.

- **PAY-OPE-007** As a membership manager, a membership creates a debt and an immediate payment, see GRP-COT-007. <!-- 03-features/payments-operations-reports.md R9; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:94-150 -->

- **PAY-OPE-008** As a coordinator, a balance transfer creates two payment operations of type transfer, see ORD-BTR-001. <!-- 03-features/payments-operations-reports.md R13; camap-hx/src/service/SubscriptionService.hx:1097-1130 -->

- **PAY-OPE-009** As a member, deleting a subscription removes all its operations and recomputes my balance. <!-- 03-features/payments-operations-reports.md R14; camap-hx/src/service/SubscriptionService.hx:822,833-836 -->
  - It is refused when payments exist.
