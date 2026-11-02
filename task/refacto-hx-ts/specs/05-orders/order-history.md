# My orders and history (ORD-HIS)

Actors: member.

- **ORD-HIS-001** As a member, I can open my history page. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/History.hx:25-58 -->
  - It shows my balance, my active subscriptions per catalog and the sessions from 30 days ago to 6 months ahead.
  - It needs a login and membership in the current group.

- **ORD-HIS-002** As a member, I can see the products of one of my baskets. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/History.hx:64-70 -->
  - **ERRATUM** Today any member of the current group can open any basket by its id, not only their own. Source: `camap-hx/src/controller/History.hx:64-70,93-120` (CODE-012).

- **ORD-HIS-003** As a member, I can see my orders of a catalog. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/History.hx:75-88 -->

- **ORD-HIS-004** As a member, I can see the orders and payments of one of my subscriptions. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/History.hx:93-121 -->

- **ORD-HIS-005** As a member, I can see only my own baskets, subscriptions and payments. <!-- 03-features/orders-subscriptions.md S3.2, S7; camap-hx/src/controller/History.hx:64-121 -->
  - The basket, subscription orders and subscription payments pages open only for the owner, a coordinator of the catalog, or an admin.
  - Anyone else is refused.
  - **ERRATUM** Today any logged-in member of the group can open another member's pages by id. Source: `camap-hx/src/controller/History.hx:64-121` (CODE-012).
  - **DECISION (UND-069, 2026-11-02)** Limit the history pages to the owner, a coordinator of the catalog or an admin, and make the payments page read-only.

- **ORD-HIS-006** As a member, opening my payments page does not change anything. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/History.hx:115 -->
  - The total is computed on read; viewing the page does not refresh the subscription total operation.
  - **ERRATUM** Today viewing the page refreshes (writes) the subscription total operation. Source: `camap-hx/src/controller/History.hx:112-115` (CODE-012).
  - **DECISION (UND-069, 2026-11-02)** Limit the history pages to the owner, a coordinator of the catalog or an admin, and make the payments page read-only.

- **ORD-HIS-007** As a member, I can open the product information popup of a product. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/Shop.hx:7-13 -->

- **ORD-HIS-008** As a member, I receive an order summary email after my order is confirmed. <!-- 03-features/orders-subscriptions.md R39; camap-hx/lang/master/tpl/mail/orderSummaryForMember.mtt -->
  - It shows date, hours and place of the distribution, and each line with quantity, product, price and sub-total.
  - See 07-communication/emails.md.
