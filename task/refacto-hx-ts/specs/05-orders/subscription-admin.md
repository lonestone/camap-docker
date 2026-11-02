# Subscription management by coordinators (ORD-SBM)

Actors: catalog coordinator, superadmin.

- **ORD-SBM-001** As a catalog coordinator, I can list the subscriptions of a catalog I manage. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:22-45 -->
  - The list is sorted by member name.
  - It counts members with a negative balance.

- **ORD-SBM-002** As a catalog coordinator, I can create a subscription for a member with a start date, an end date, a second person and default orders. <!-- 03-features/orders-subscriptions.md S3.2, F5.2; camap-hx/src/controller/SubscriptionAdmin.hx:63-189 -->

- **ORD-SBM-003** As a catalog coordinator, I can edit a subscription. <!-- 03-features/orders-subscriptions.md R16; camap-hx/src/service/SubscriptionService.hx:778-805 -->
  - Both dates are required.
  - The subscription rules are checked again.
  - Orders are recreated when the catalog manages default orders.
  - An absence date outside the new period is refused.

- **ORD-SBM-004** As a catalog coordinator, I can delete a subscription through a confirmation with a security token. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:47-61 -->

- **ORD-SBM-005** As a member or a coordinator, a subscription can be deleted only when it has no ordered quantity on past distributions and no payment. <!-- 03-features/orders-subscriptions.md R17; camap-hx/src/service/SubscriptionService.hx:814-838 -->
  - Balance transfers count as payments.
  - Deleting removes all its orders and operations, updates the balance, then the subscription.

- **ORD-SBM-006** As a catalog coordinator, I can export the subscriptions of my active catalogs as a CSV file. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/ContractAdmin.hx:431-450 -->

- **ORD-SBM-007** As a catalog coordinator, I can see the payments of a subscription, its balance and its total. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:357-380 -->
  - The total refreshes when the catalog is active.

- **ORD-SBM-008** As a catalog coordinator, I can record a payment on a subscription. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:420-466 -->
  - See 06-payments/payment-entry.md.
  - **ERRATUM** Today a coordinator of any single catalog can record this payment, for any catalog of the group. Source: `camap-hx/src/controller/SubscriptionAdmin.hx:421-422` (CODE-014).

- **ORD-SBM-009** As a catalog coordinator, I can record one payment per member for a whole catalog from a list. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:468-517 -->
  - Only rows with an amount produce a payment.
  - It needs a security token.

- **ORD-SBM-010** As a superadmin, I can move the subscription of a deleted user to another user. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/Subscriptions.hx:47-90 -->
  - It works only from the placeholder deleted user (or in debug mode).
  - The subscription, orders, baskets and operations move together.

- **ORD-SBM-011** As a catalog coordinator, I can pick any subscribed member in the batch ordering page. <!-- 03-features/orders-subscriptions.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:53-68,138-157 -->

- **ORD-SBM-012** As a coordinator, I can record a payment only on subscriptions of catalogs I manage. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:420-466 -->
  - The right is checked on the subscription's catalog, as for deleting or creating a subscription.
  - **ERRATUM** Today the check is `isContractManager()` without a catalog, so a coordinator of any catalog passes. Source: `camap-hx/src/controller/SubscriptionAdmin.hx:420-423` (CODE-014).
  - **DECISION (UND-071, 2026-11-02)** Check canManageContract on the subscription's catalog, and that the member belongs to the group, before recording a payment.

- **ORD-SBM-013** As a catalog coordinator, I can set a second person and the alternation on a constant-orders subscription. <!-- 03-features/orders-subscriptions.md R9; camap-hx/src/controller/SubscriptionAdmin.hx:109-137 -->
  - The member interface does not offer it.
