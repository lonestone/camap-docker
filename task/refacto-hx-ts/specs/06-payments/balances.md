# Balances (PAY-BAL)

Actors: member, membership manager, the system.

- **PAY-BAL-001**: As a member, my balance in a group is the sum of my operations linked to a subscription that starts after 2022. <!-- 03-features/payments-operations-reports.md R2; camap-hx/src/service/PaymentService.hx:343-354; camap-ts/packages/api-core/src/payments/services/payments.service.ts:280-296 -->
  - Order operations, memberships and manual payments without a subscription are not counted.
  - The 2022 cut-off is kept for legacy compatibility: it rectified old data, and its comment (1 Jan 2021) does not match the code.
  - This is intended: see PAY-BAL-002 for the rounding. Source: `camap-hx/src/service/PaymentService.hx:343-354`, `camap-ts/packages/api-core/src/payments/services/payments.service.ts:280-296` (CODE-037).
  - **DECISION (UND-087, 2026-11-06)** Keep the current behaviour for legacy compatibility: the balance counts only subscription operations of subscriptions starting after 2022.

- **PAY-BAL-002** As a member, my balance is rounded to 2 decimals. <!-- 03-features/payments-operations-reports.md R2; camap-hx/src/service/PaymentService.hx:351 -->

- **PAY-BAL-003** As a member, my balance updates after every creation, change or deletion of one of my operations. <!-- 03-features/payments-operations-reports.md R3; camap-hx/src/service/PaymentService.hx:62,74,128,165 -->
  - Opening my history or the payments page also refreshes it.
  - **ERRATUM** Today in TS, the balance update after a payment change is not awaited and the payment amount is not rounded. Source: `camap-ts/packages/api-core/src/payments/services/payments.service.ts:377-380` (CODE-061).
  - **DECISION (UND-089, 2026-11-06)** TS awaits the balance update and rounds the payment amount (see PAY-ENT-013).

- **PAY-BAL-004** As a membership manager, I can see a member's operations, newest first, 10 per page. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Member.hx:140-157 -->
  - Opening the page refreshes the balance.

- **PAY-BAL-005** As a membership manager, I can see the members of my group with a zero, positive or negative balance. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/Member.hx:161-175 -->
  - I can recompute the balance of everyone.

- **PAY-BAL-006** As a member, I can see my balance in my history. <!-- 03-features/payments-operations-reports.md S3.1; camap-hx/src/controller/History.hx:28 -->

- **PAY-BAL-007** As a member, the balance of a subscription is my payments on it minus its total, rounded to cents, and the subscription is paid when it is 0 or more. <!-- 03-features/payments-operations-reports.md R5; camap-hx/src/db/Subscription.hx:65-67,24-27 -->
  - Only payment operations of that subscription count as payments.
  - **ERRATUM** TS computes this balance two other ways: the API field sums all operations, the service subtracts without rounding. Source: `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:22-30` (CODE-102).
  - **DECISION (UND-088, 2026-11-02)** Use the Haxe formula everywhere: payments minus subscription total, rounded to 2 decimals. Fixed in camap-ts at the start of the migration ([TS-FIXES-FIRST.md](../../TS-FIXES-FIRST.md)).
- **PAY-BAL-008** As a member, every screen shows the same subscription balance: payments minus total, rounded to cents. <!-- 03-features/payments-operations-reports.md R5; camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:22-30; camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:104-137 -->
  - This covers the ordering screen, the payments pages, the history, the coordinator's subscriptions table and the attendance sheet.
  - Fees and the subscription-total operation do not change the balance; only payments and the order total count.
  - **ERRATUM** Today the attendance sheet of variable-order contracts uses a TS field that sums all operations of the subscription, without rounding. Source: `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:17-35`, `camap-ts/packages/front-core/src/modules/csaAttendanceSheet/attendanceSheetCsa.gql:104-106` (CODE-102).
  - **ERRATUM** Today the TS service subtracts without rounding, and three Haxe templates compute the balance inline without rounding. Source: `camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:111-116`, `camap-hx/lang/master/tpl/macros.mtt:251`, `camap-hx/lang/master/tpl/contractadmin/subscriptionadmin/default.mtt:103`, `camap-hx/lang/master/tpl/history/default.mtt:67`.
  - **DECISION (UND-088, 2026-11-02)** Use the Haxe formula everywhere: payments minus subscription total, rounded to 2 decimals. Fixed in camap-ts at the start of the migration ([TS-FIXES-FIRST.md](../../TS-FIXES-FIRST.md)).