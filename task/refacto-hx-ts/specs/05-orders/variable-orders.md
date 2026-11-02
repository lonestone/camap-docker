# Variable orders and default orders (ORD-VAR)

Actors: member, the system. A variable catalog lets each member order per distribution.

- **ORD-VAR-001** As a member of a variable catalog, I order per distribution while its order window is open. <!-- 03-features/orders-subscriptions.md R5, R26; camap-hx/src/db/UserOrder.hx:89-107 -->
  - I can modify an order only when now is strictly inside the window.

- **ORD-VAR-002** As a member of a variable catalog without minimum, I have no default order and skip the "required orders" step. <!-- 03-features/orders-subscriptions.md R7; camap-ts/packages/front-core/src/modules/csaCatalog/CsaCatalogRouter.tsx:101-108 -->

- **ORD-VAR-003** As a member of a variable catalog with a per-distribution minimum, I have a default order applied to my subscription distributions. <!-- 03-features/orders-subscriptions.md R5; camap-hx/src/service/SubscriptionService.hx:1010,922-925 -->
  - It applies to every subscription distribution whose closing date is not past.

- **ORD-VAR-004** *Undecided (UND-079)*: As a member, saving my default order keeps the changes I made to individual distributions. <!-- 03-features/orders-subscriptions.md R5; camap-hx/src/service/SubscriptionService.hx:906-916 -->
  - Currently saving the default order deletes existing orders of all non-closed distributions and recreates them.
  - **SUGGESTION** Preserve past orders and manual edits: on saving a default order, rewrite only unclosed distributions (constant catalogs too) and keep each existing order saved price; only new lines take the current price. Based on: `camap-hx/src/service/SubscriptionService.hx:908-912,921-925` (variable branch skips closed distributions), `camap-hx/src/service/SubscriptionService.hx:988-991` (past orders must not be modified), `camap-hx/src/service/OrderService.hx:77,362` (price saved at creation, prepare uses it). Confidence: medium. Needs product input on manual edits.

- **ORD-VAR-005** As the system, every hour I apply the default order to subscribers who placed no order at a distribution that just closed. <!-- 03-features/orders-subscriptions.md R8, F5.4; camap-hx/src/controller/Cron.hx:227-278 -->
  - It covers catalogs with a per-distribution minimum.
  - Distributions where the member is absent are skipped.
  - The member gets an in-app notification "default order".
  - The subscription total is refreshed.

- **ORD-VAR-006** As the system, one failing subscription does not stop the default order for the others. <!-- 03-features/orders-subscriptions.md R8; camap-hx/src/controller/Cron.hx:227-278 -->
  - The error is logged to the job's task log, and the job continues with the next subscription.
  - **ERRATUM** Today a failure is not caught per subscription, unlike sibling jobs. Source: `camap-hx/src/controller/Cron.hx:227-278`.
  - **DECISION (UND-082, 2026-11-02)** Catch errors per subscription in the default-order job, log them and continue.
