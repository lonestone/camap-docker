# Constant orders (ORD-CST)

Actors: member, catalog coordinator. A constant catalog repeats the same basket at every distribution.

- **ORD-CST-001** As a member, my default order of a constant catalog is my order at every distribution of my subscription. <!-- 03-features/orders-subscriptions.md R4; camap-hx/src/service/SubscriptionService.hx:899-965 -->
  - One order line per product per distribution is created.
  - A distribution counted twice gets the order twice.
  - The same user, product and distribution merge into one line, except multi-weight products which stay separate.

- **ORD-CST-002** As a member, I can change my default order of a constant catalog while I have no past orders. <!-- 03-features/orders-subscriptions.md R6; camap-hx/src/service/SubscriptionService.hx:989-993 -->
  - A coordinator or admin can change it even with past orders.

- **ORD-CST-003** *Undecided (UND-079)*: As a coordinator, changing the default order of a constant catalog only affects distributions not yet closed. <!-- 03-features/orders-subscriptions.md R6, R34; camap-hx/src/service/SubscriptionService.hx:909; camap-hx/src/service/OrderService.hx:77 -->
  - Currently all orders including past ones are deleted and recreated at the current product price.
  - **SUGGESTION** Preserve past orders and manual edits: on saving a default order, rewrite only unclosed distributions (constant catalogs too) and keep each existing order saved price; only new lines take the current price. Based on: `camap-hx/src/service/SubscriptionService.hx:908-912,921-925` (variable branch skips closed distributions), `camap-hx/src/service/SubscriptionService.hx:988-991` (past orders must not be modified), `camap-hx/src/service/OrderService.hx:77,362` (price saved at creation, prepare uses it). Confidence: medium. Needs product input on manual edits.

- **ORD-CST-004** As a coordinator, saving a constant subscription from the admin form always recreates its orders. <!-- 03-features/orders-subscriptions.md R6; camap-hx/src/controller/SubscriptionAdmin.hx:223-272; camap-hx/src/service/SubscriptionService.hx:802-804 -->

- **ORD-CST-005** As a member sharing a basket with a second person, our basket alternates each distribution. <!-- 03-features/orders-subscriptions.md R9; camap-hx/src/db/UserOrder.hx:63-74 -->
  - Only constant catalogs support it.
  - The turn depends on the parity of the number of distributions since the catalog start, which an "invert" option flips.
  - Only one second person per subscription is allowed.
  - Orders of the second person show on the distribution of a constant catalog.

- **ORD-CST-006** As a member, I can order from a constant catalog only while the catalog accepts user orders. <!-- 03-features/orders-subscriptions.md R26; camap-hx/src/db/UserOrder.hx:89-107 -->
  - A paid order cannot be modified.
