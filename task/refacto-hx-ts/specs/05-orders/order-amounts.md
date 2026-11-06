# Order amounts and balances (ORD-AMT)

Actors: member.

- **ORD-AMT-001** As a member, the amount of an order line is its quantity times the price saved with the order, rounded to 2 decimals. <!-- 03-features/orders-subscriptions.md R33; camap-hx/src/db/Subscription.hx:32-40 -->
  - The total of a subscription is the sum of rounded lines, rounded again.
  - **ERRATUM** When a coordinator changes a quantity in the orders page, the returned subtotal uses the current product price, not the saved one. Source: `camap-hx/src/service/OrderService.hx:863` (CODE-041).

- **ORD-AMT-002** As a member, the amount of a basket line includes the fee rate of the line (always 0 for new orders, see ORD-OPL-015). <!-- 03-features/orders-subscriptions.md R33; camap-ts/packages/camap-common/src/utils/index.ts:33-60 -->
  - TS and Haxe round each line the same way.
  - **DECISION (UND-037, 2026-11-06)** Percentage fees are deactivated, so the fee rate of new lines is 0; the fee rate of older lines is still honoured (confirmed).

- **ORD-AMT-003** As a member, the balance of a subscription is the sum of its payments minus its total, rounded to cents, and the subscription is paid when the balance is 0 or more. <!-- 03-features/orders-subscriptions.md R34; camap-hx/src/db/Subscription.hx:23-59 -->
  - **ERRATUM** TS computes this balance two other ways: the API field sums all operations, the service subtracts without rounding. Source: `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:22-30, camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:109-135` (CODE-102).
  - **DECISION (UND-088, 2026-11-02)** Use the Haxe formula everywhere: payments minus subscription total, rounded to 2 decimals.

- **ORD-AMT-004** As a member, the subscription total is recorded as a negative operation, rewritten only when the amount changes. <!-- 03-features/orders-subscriptions.md R34; camap-hx/src/service/SubscriptionService.hx:1059-1091 -->

- **ORD-AMT-005** *Undecided (UND-079)*: As a member, the price of an order is the price saved with the order. <!-- 03-features/orders-subscriptions.md R34; camap-hx/src/db/Subscription.hx:94-129; camap-hx/src/service/OrderService.hx:77 -->
  - Currently totals and recreated orders use the current product price although default orders store a price.
  - **SUGGESTION** Preserve past orders and manual edits: on saving a default order, rewrite only unclosed distributions (constant catalogs too) and keep each existing order saved price; only new lines take the current price. Based on: `camap-hx/src/service/SubscriptionService.hx:908-912,921-925` (variable branch skips closed distributions), `camap-hx/src/service/SubscriptionService.hx:988-991` (past orders must not be modified), `camap-hx/src/service/OrderService.hx:77,362` (price saved at creation, prepare uses it). Confidence: medium. Needs product input on manual edits.

- **ORD-AMT-006** As a member, the "paid" mark of an order can be set by a coordinator and blocks changes. <!-- 03-features/orders-subscriptions.md R35; camap-hx/src/service/OrderService.hx:183-187,227; camap-hx/src/db/UserOrder.hx:105-106 -->
