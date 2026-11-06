# Orders entered by coordinators (ORD-ADO)

Actors: catalog coordinator, coordinator of all catalogs.

- **ORD-ADO-001** As a coordinator, I can place orders for a member from the batch ordering page. <!-- 03-features/orders-subscriptions.md F5.2; camap-ts/packages/front-core/src/modules/batchOrder/BatchOrder.module.tsx:119-167 -->
  - I choose the member, and the same ordering screen opens in admin mode.
  - The member's subscription is the first one ending in the future.
  - If there is none, I can create a subscription from the page.

- **ORD-ADO-002** As a coordinator, I can see the baskets of a distribution of a catalog on the orders page. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/ContractAdmin.hx:667-748 -->
  - I can delete an order of quantity 0.
  - I can export it as CSV.

- **ORD-ADO-003** As a coordinator, I can change an order quantity directly in the orders page. <!-- 03-features/orders-subscriptions.md R31; camap-hx/src/service/OrderService.hx:805-882 -->
  - I can type a weight and the system converts it.
  - The sub-total, total, fees and basket total update.

- **ORD-ADO-004** As a coordinator, the sub-total shown after editing a quantity uses the price saved with the order. <!-- 03-features/orders-subscriptions.md R31; camap-hx/src/service/OrderService.hx:863,357,381 -->
  - It matches the order totals, which also use the saved price.
  - **ERRATUM** Today the inline edit sub-total uses the current product price. Source: `camap-hx/src/service/OrderService.hx:863` (CODE-041).
  - **DECISION (UND-075, 2026-11-02)** The sub-total uses the price saved with the order.

- **ORD-ADO-005** As a coordinator, I can edit the orders of a member in a dialog, with products, quantities and paid status. <!-- 03-features/orders-subscriptions.md R30, F5.6; camap-hx/src/service/OrderService.hx:694-787 -->
  - An empty order list is an error.
  - A line uses the subscription covering that distribution date.
  - A missing subscription is an error.
  - The basket total and the subscription total are refreshed.

- **ORD-ADO-006** As a coordinator, I am told which line of my edit could not be saved and why. <!-- 03-features/orders-subscriptions.md R30, S3.1; camap-hx/src/controller/api/Order.hx:76-97; camap-hx/src/service/OrderService.hx:734-762 -->
  - The dialog answers with the per-line errors and a failure status (success false) when a line could not be saved.
  - The lines that were saved stay saved.
  - **ERRATUM** Today the dialog endpoint always answers success; line-level errors only go to session messages. Source: `camap-hx/src/service/OrderService.hx:734-762`, `camap-hx/src/controller/api/Order.hx:76-97`.
  - **DECISION (UND-074, 2026-11-06)** Return per-line errors with success false in the dialog response, and keep the saved lines.

- **ORD-ADO-007** As a coordinator, I can read and update the orders of a user only for catalogs I manage, or any catalog if I manage all. <!-- 03-features/orders-subscriptions.md S3.1; camap-hx/src/controller/api/Order.hx:32-97 -->
  - A constant catalog together with a given distribution is refused.

- **ORD-ADO-008** As a coordinator, I can list the catalogs open for a distribution session in the order dialog, without disabled vendors. <!-- 03-features/orders-subscriptions.md S3.1; camap-hx/src/controller/api/Order.hx:12-30 -->
  - **ERRATUM** The catalog list behind this dialog answers without login. Source: `camap-hx/src/controller/api/Order.hx:12-30` (CODE-016).

- **ORD-ADO-009** As a coordinator, I can search in the order dialog a product among those of the selected catalog and the members of my group. <!-- 03-features/orders-subscriptions.md F5.6; camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:21-156 -->

- **ORD-ADO-010** As a member of a group in shop mode, I edit my variable orders through the ordering screen only; there is no separate order edit page. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/Contract.hx:188-251 -->
  - **ERRATUM** Today a legacy edit page still exists, with no incoming link; it truncates quantities and can fail when no operation exists. Source: `camap-hx/src/controller/Contract.hx:188-251` (CODE-076).
  - **DECISION (UND-085, 2026-11-02)** Remove the legacy shop-mode order edit page.

- **ORD-ADO-011** As a coordinator, I can bulk-edit the orders of variable catalogs of a distribution session. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/ContractAdmin.hx:1090-1115 -->
