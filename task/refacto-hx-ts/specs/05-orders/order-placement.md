# Placing and editing orders (ORD-OPL)

Actors: member, coordinator.

- **ORD-OPL-001** As a member, I can order a quantity of a product for a distribution. <!-- 03-features/orders-subscriptions.md R23; camap-hx/src/service/OrderService.hx:30-139 -->
  - Quantities cannot be negative.
  - A disabled vendor's products cannot be ordered.
  - A quantity of 0 creates no order.
  - The price is saved with the order.
  - **ERRATUM** Today, when an existing order is edited, the stock limit is computed differently (multiplied by the product quantity) than when it is created. Source: `camap-hx/src/service/OrderService.hx:130,216` (CODE-040).
  - **DECISION (UND-072, 2026-11-06)** Editing uses the creation stock limit (see ORD-OPL-007).

- **ORD-OPL-002** As a member, I can order a decimal quantity only for products sold by weight or at a variable price. <!-- 03-features/orders-subscriptions.md R23; camap-hx/src/service/OrderService.hx:19-21,44-48 -->
  - Other products need whole quantities.

- **ORD-OPL-003** As a member, I order a multi-weight product N times as N separate lines of quantity 1, with a whole quantity. <!-- 03-features/orders-subscriptions.md R23; camap-hx/src/service/OrderService.hx:52-65 -->

- **ORD-OPL-004** As a member, ordering the same product at the same distribution again adds to my existing line. <!-- 03-features/orders-subscriptions.md R23; camap-hx/src/service/OrderService.hx:71,90-97 -->

- **ORD-OPL-005** As a member, every order belongs to a subscription. <!-- 03-features/orders-subscriptions.md S2, R23; camap-hx/src/service/OrderService.hx:108-109 -->
  - Ordering without a subscription is refused.

- **ORD-OPL-006** As a member, an order is attached to my basket for that distribution session. <!-- 03-features/orders-subscriptions.md R23; camap-hx/src/service/OrderService.hx:100-103 -->

- **ORD-OPL-007** As a member, when the stock is insufficient my order is limited to the available quantity and I see an error, the same way when I create an order and when I edit it. <!-- 03-features/orders-subscriptions.md R24, R25; camap-hx/src/service/OrderService.hx:116-135,199-222 -->
  - When stock is 0 the quantity becomes 0.
  - Stock counts only when the catalog manages stock.
  - A multi-weight line counts as 1.
  - The available stock is counted in order units, so there is no multiplication by the product quantity when editing.
  - For a multi-weight product the check uses the new quantity, not the old one.
  - **ERRATUM** Today creation clamps to the available stock, while edit writes the available stock times the product quantity and tests multi-weight with the old quantity. Source: `camap-hx/src/service/OrderService.hx:116-135,199-222` (CODE-040).
  - **DECISION (UND-072, 2026-11-06)** Apply the creation clamp rule everywhere: the available stock in order units.

- **ORD-OPL-008** As a member, I can edit the quantity of an order. <!-- 03-features/orders-subscriptions.md R25; camap-hx/src/service/OrderService.hx:166-240 -->
  - Negative quantities are refused, and so are decimals for products that do not allow them.
  - A quantity of 0 keeps the line, shown as "Canceled".
  - Increasing a quantity marks the line as not paid.

- **ORD-OPL-009** As a member or coordinator, an order line can be deleted only when its quantity is 0, or when forced by the system. <!-- 03-features/orders-subscriptions.md R25; camap-hx/src/service/OrderService.hx:298-325 -->
  - The subscription total is refreshed afterwards.

- **ORD-OPL-010** As a member, I cannot place or change an order outside the order window of its distribution, whatever the screen I use. <!-- 03-features/orders-subscriptions.md R27; camap-hx/src/service/OrderService.hx:30-240; camap-hx/src/controller/api/Subscription.hx:70-73 -->
  - The server (the order service) refuses the order, for non-managers; the ordering screen also enforces it.
  - Managers (coordinators and admins) can still edit orders after the window closed.
  - **ERRATUM** Today `make`, `edit` and the subscription order update do not test the order window; the server checks only that the catalog has some open distribution for non-managers, and only the TS screen and a legacy page test the window. Source: `camap-hx/src/service/OrderService.hx:30-240`, `camap-hx/src/controller/api/Subscription.hx:70-73`, `camap-hx/src/controller/Contract.hx:229`.
  - **DECISION (UND-073, 2026-11-06)** Enforce the order window in the service for non-managers; managers may bypass it.

- **ORD-OPL-011** As a member, the ordering screen shows each distribution as open, not yet open, closed or absent. <!-- 03-features/orders-subscriptions.md R27; camap-ts/packages/front-core/src/modules/csaCatalog/interfaces.ts:77-100 -->

- **ORD-OPL-012** As a member, I can update my orders per distribution in a subscription. <!-- 03-features/orders-subscriptions.md R29, S3.1; camap-hx/src/controller/api/Subscription.hx:60-81 -->
  - Updating refreshes the subscription total and re-checks the minimums.
  - Only the owner, a coordinator or an admin can update.
  - A non-manager needs the catalog to have an open distribution.

- **ORD-OPL-013** As a member, I can update my default order only as the owner, a coordinator or an admin. <!-- 03-features/orders-subscriptions.md S3.1; camap-hx/src/controller/api/Subscription.hx:83-106 -->

- **ORD-OPL-014** As a member, order lines carry the order quantity in product units. <!-- 03-features/orders-subscriptions.md R32; camap-ts/packages/camap-common/src/products/format.ts:57-91 -->
  - For products sold by weight or at a variable price, the displayed amount is the quantity times the product quantity with its unit.
  - Typing a weight divides by the product quantity.

- **ORD-OPL-015** As a member, order lines carry a fee rate that is always 0 for new orders. <!-- 03-features/orders-subscriptions.md R23, R35; camap-hx/src/service/OrderService.hx:78-80; camap-hx/src/db/Catalog.hx:128-131 -->
  - The rate field is kept on order lines for existing data and compatibility.
  - **ERRATUM** Today TS can apply a non-zero percentage fee rate when computing fees. Source: `camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:146-178` (CODE-097).
  - **DECISION (UND-037, 2026-11-06)** Deactivate percentage fees everywhere without removing them from the data model: the field is not offered, no fee is applied, and the stored flag and percentage are ignored.
