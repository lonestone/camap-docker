# Recording and editing payments (PAY-ENT)

Actors: catalog coordinator, membership manager.

- **PAY-ENT-001** As a coordinator, I can record a payment for a member with a name, an amount, a date and a type. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Transaction.hx:21-80 -->
  - I can link it to one of the member's last 20 non-payment operations.
  - Linking with "unpaid" sets the link.
  - **ERRATUM** Today a coordinator of any single catalog can record a payment for any member, without a check that the member belongs to the group. Source: `camap-hx/src/controller/Transaction.hx:25` (CODE-014).

- **PAY-ENT-002** As a coordinator, when the payment exactly cancels the linked operation, both are marked as settled. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Transaction.hx:61-70 -->

- **PAY-ENT-003** As a coordinator, a payment and a debt are settled together when their sum is exactly zero. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Transaction.hx:64 -->
  - There is no cent tolerance in the comparison.
  - Amounts are stored rounded to 2 decimals. Source: `camap-hx/src/db/Operation.hx:170`.
  - **DECISION (UND-091, 2026-11-02)** Keep the current behaviour: the pair is settled when the sum is exactly zero, with no cent tolerance.

- **PAY-ENT-004** As a coordinator, I can record a payment only for a member of my group and for a subscription of a catalog I manage. <!-- 03-features/payments-operations-reports.md S3.1, S7; camap-hx/src/controller/Transaction.hx:25; camap-hx/src/controller/SubscriptionAdmin.hx:422 -->
  - A payment for a member outside the group, or on a catalog I do not manage, is refused.
  - **ERRATUM** Today the check is `isContractManager()` without a catalog, so a coordinator of any catalog passes. Source: `camap-hx/src/controller/SubscriptionAdmin.hx:420-423` (CODE-014).
  - **DECISION (UND-071, 2026-11-02)** Check canManageContract on the subscription's catalog, and that the member belongs to the group, before recording a payment.

- **PAY-ENT-005** As a coordinator, I can record a payment on a subscription. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/SubscriptionAdmin.hx:421-466 -->
  - The amount is pre-filled with the amount owed when the balance is negative.
  - The type defaults to check.
  - The payment is linked to the subscription and is not pending.
  - Only on subscriptions of catalogs I manage: see PAY-ENT-004.
  - **ERRATUM** Today a coordinator of any single catalog can record this payment, for any catalog of the group. Source: `camap-hx/src/controller/SubscriptionAdmin.hx:421-422` (CODE-014).

- **PAY-ENT-006** As a coordinator, I can record payments for all members of a catalog at once. <!-- 03-features/payments-operations-reports.md S3.1, R8; camap-hx/src/controller/SubscriptionAdmin.hx:469-517 -->
  - Rows with an empty amount are skipped.

- **PAY-ENT-007** As a membership manager, I can edit the name, amount and date of an operation of my group. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Transaction.hx:84-120 -->
  - Editing marks the operation as no longer pending.
  - **ERRATUM** Editing or deleting an operation not tied to a subscription (variable order, membership) fails with an error. Source: `camap-hx/src/controller/Transaction.hx:88-96,128-129` (CODE-062).

- **PAY-ENT-008** As a membership manager, I can delete an operation of my group, with a security token. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Transaction.hx:125-145 -->
  - Deleting an order or a subscription total operation needs a full admin.

- **PAY-ENT-009** As a coordinator, my balance recomputes after each payment I record, edit or delete. <!-- 03-features/payments-operations-reports.md R3; camap-hx/src/controller/Transaction.hx:73,115,144 -->

- **PAY-ENT-010** As a membership manager, editing or deleting a payment that has no subscription works without error. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Transaction.hx:89-96,128-132 -->
  - This covers operations for a variable order or a membership.
  - With no subscription, I return to the member payments page.
  - **ERRATUM** Today the edit and delete actions read the subscription before checking it, so they crash; edit also refuses operations without a subscription. Source: `camap-hx/src/controller/Transaction.hx:89-97,128-132` (CODE-062).
  - **DECISION (UND-090, 2026-11-02)** Null-check the subscription before building the return URL, and allow editing and deleting operations without a subscription.

- **PAY-ENT-011** As a membership manager, I can validate a pending payment or delete an operation from the new interface. <!-- 03-features/payments-operations-reports.md S3.3, R12; camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:27-54,91-103 -->
  - Validation can set the concrete on-the-spot type and recomputes the balance.
  - Both TS mutations require the membership right (`canManageMembers`), as the Haxe pages do (edit and delete need `canAccessMembership`).
  - **ERRATUM** Today the TS mutations require the all-catalogs coordinator right, and no component of the new interface uses them yet (they only exist in the generated client). Source: `camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:27-54,91-103`, `camap-hx/src/controller/Transaction.hx:92,132`.
  - **DECISION (UND-096, 2026-11-06)** Keep the validate and delete mutations in TS and require the membership right (`canManageMembers`).

- **PAY-ENT-012** As a member, a payment created through the payment service stays pending until a coordinator validates or edits it. <!-- 03-features/payments-operations-reports.md S2 pending, R8; camap-hx/src/service/PaymentService.hx:25-65 -->
  - A second on-the-spot payment on the same operation adds to the existing one.
  - **ERRATUM** Today Haxe adds to an existing on-the-spot payment even when it is no longer pending and never reuses transfers; TS reuses only pending payments and also reuses transfers. Source: `camap-hx/src/service/PaymentService.hx:34-41, camap-ts/packages/api-core/src/payments/services/payments.service.ts:205-232` (CODE-103).
  - **DECISION (UND-089, 2026-11-06)** Both stacks reuse only a pending on-the-spot payment and never reuse a transfer (see PAY-ENT-013).

- **PAY-ENT-013** As a member, adding to an existing on-the-spot payment is safe against concurrent updates and rounded to 2 decimals. <!-- 03-features/payments-operations-reports.md R8; camap-ts/packages/api-core/src/payments/services/payments.service.ts:186-275,377-380 -->
  - Only a pending on-the-spot payment is added to; transfers are never reused.
  - The row is locked, the sum is rounded and the balance update is awaited before the operation returns.
  - **ERRATUM** Today the TS update adds amounts without a lock or rounding and does not await the balance update; the reuse rules also differ between stacks (see PAY-ENT-012). Source: `camap-ts/packages/api-core/src/payments/services/payments.service.ts:186-275,377-380`, `camap-hx/src/service/PaymentService.hx:25-76` (CODE-061, CODE-103).
  - **DECISION (UND-089, 2026-11-06)** Round every operation amount to 2 decimals on save; when adding to an existing payment, lock the row, round the sum and await the balance update; reuse only pending on-the-spot payments.
