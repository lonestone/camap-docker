# Subscribing to a catalog (ORD-SUB)

Actors: member, catalog coordinator, group admin. A subscription is a member's commitment to a catalog for a date range, and every order belongs to one.

- **ORD-SUB-001** As a member, I can subscribe to a catalog from its subscription page. <!-- 03-features/orders-subscriptions.md S3.2, F5.1; camap-hx/src/controller/Subscriptions.hx:22-30 -->
  - The wizard has a presentation step, an absences step if absences are allowed, a required-orders step for constant catalogs or catalogs with a minimum, then creation.

- **ORD-SUB-002** As a member, I can subscribe only to a catalog that is open to orders. <!-- 03-features/orders-subscriptions.md R13; camap-hx/src/service/SubscriptionService.hx:363; camap-hx/src/controller/api/Subscription.hx:45-47 -->
  - A catalog is open when it accepts user orders, is inside its dates and, for variable orders, has a distribution currently open.
  - A coordinator or admin can subscribe a member even when it is closed.
  - **ERRATUM** The subscription API returns a subscription's details, orders and balance without any login or ownership check. Source: `camap-hx/src/controller/api/Subscription.hx:27-58` (CODE-013). Decided fix: see ORD-SUB-016 (UND-068).

- **ORD-SUB-003** As a member, my subscription starts at the next distribution still open to orders and ends at the catalog end. <!-- 03-features/orders-subscriptions.md R10; camap-hx/src/service/SubscriptionService.hx:152-159,630-653 -->
  - For a variable catalog, "open" means the order window of the distribution is open.
  - For a constant catalog, "open" means its closing date is in the future.

- **ORD-SUB-004** As a coordinator, I can choose the start and end dates of a member's subscription. <!-- 03-features/orders-subscriptions.md R10; camap-hx/src/controller/SubscriptionAdmin.hx:73-100,159 -->
  - Dates are set from the first second of the start day to the last second of the end day.
  - The start is before the end.
  - Both dates are inside the catalog dates.

- **ORD-SUB-005** As a member, the subscription must contain at least one distribution that is not past. <!-- 03-features/orders-subscriptions.md R13; camap-hx/src/service/SubscriptionService.hx:367-370 -->

- **ORD-SUB-006** As a member, I cannot have two overlapping subscriptions to the same catalog. <!-- 03-features/orders-subscriptions.md R13; camap-hx/src/service/SubscriptionService.hx:417-466 -->
  - The check is per catalog, not per vendor.

- **ORD-SUB-007** As a member, my subscription cannot start before the next open distribution. <!-- 03-features/orders-subscriptions.md R13; camap-hx/src/service/SubscriptionService.hx:377-400 -->
  - A coordinator or admin can choose an earlier start.

- **ORD-SUB-008** As a member subscribing to a constant catalog, my range cannot contain a past distribution without an order. <!-- 03-features/orders-subscriptions.md R13; camap-hx/src/service/SubscriptionService.hx:475-478,874-888 -->
  - A coordinator or admin is exempt.

- **ORD-SUB-009** As a user who is not a member of the catalog's group, I join the group automatically when it is open, otherwise I get an error. <!-- 03-features/orders-subscriptions.md R11; camap-hx/src/service/SubscriptionService.hx:654-661 -->

- **ORD-SUB-010** As a member, my subscription is validated with the same rules whether it is created by me or by an admin, except those reserved to admins. <!-- 03-features/orders-subscriptions.md R15; camap-hx/src/controller/api/Subscription.hx:35-50 -->
  - When I subscribe myself, the member checks apply: the catalog is open, the start is not before the next open distribution, and for constant orders no past distribution is left without an order.
  - Admin mode, which skips those checks, applies only when the caller is an admin or a coordinator of the catalog.
  - The admin and coordinator rights are checked on the catalog's group, not the session's current group.
  - **ERRATUM** Today creation through the member interface always runs in admin mode and skips those three checks; the group-manager test uses the session group. Source: `camap-hx/src/controller/api/Subscription.hx:35-50`, `camap-hx/src/service/SubscriptionService.hx:363,378,475` (CODE-078, CODE-047).
  - **DECISION (UND-067, 2026-11-02)** A member creating their own subscription runs in member mode with all checks; admin mode is only for admins or coordinators of the catalog.

- **ORD-SUB-011** As a member, creating a subscription also records my default orders and my initial orders. <!-- 03-features/orders-subscriptions.md R14; camap-hx/src/service/SubscriptionService.hx:687-697 -->
  - A total amount operation for the subscription is created.
  - My balance is updated.
  - Variable orders are checked against the catalog minimums.

- **ORD-SUB-012** As a member and as a coordinator, I receive a notification email when a subscription is created. <!-- 03-features/orders-subscriptions.md R14; camap-hx/src/service/SubscriptionService.hx:705-757 -->
  - The member's email links to the subscription page and to the vendor page.
  - Each recipient can switch this notification off.

- **ORD-SUB-013** As a member, I see my current or coming subscription for a catalog: the one with an end date after the next open distribution (or now). <!-- 03-features/orders-subscriptions.md R18; camap-hx/src/service/SubscriptionService.hx:176-180 -->

- **ORD-SUB-014** As a member, when a season ends, I subscribe again to the next catalog myself: there is no subscription renewal. <!-- 03-features/orders-subscriptions.md S2 Renewal; camap-hx/src/controller/ContractAdmin.hx:782-900 -->
  - A new season is a new catalog, and members create new subscriptions to it.
  - Duplicating a catalog does not copy its subscriptions (`camap-hx/src/controller/ContractAdmin.hx:782-900`). This is intended.
  - **DECISION (UND-083, 2026-11-06)** Keep the manual new-catalog process; subscription renewal stays out of scope (option b).

- **ORD-SUB-015** As a member, I can read the data of my subscription. <!-- 03-features/orders-subscriptions.md S3.1; camap-hx/src/controller/api/Subscription.hx:149-203 -->
  - It shows the distributions with their orders, the constraints, the total ordered, the balance and the minimum required.

- **ORD-SUB-016** As a logged-in member, I can read only my own subscription, or those of my catalogs if I am a coordinator. <!-- 03-features/orders-subscriptions.md S3.1, S7; camap-hx/src/controller/api/Subscription.hx:27-58 -->
  - Admins can read any subscription of their group.
  - Visitors who are not logged in, and other members, are refused.
  - The rule matches the one for updating orders.
  - **ERRATUM** Today `GET /api/subscription/:id` needs no login and checks no ownership. Source: `camap-hx/src/controller/api/Subscription.hx:27-58` (CODE-013).
  - **DECISION (UND-068, 2026-11-02)** Require login, and allow reading a subscription only to its owner, a coordinator of its catalog, or an admin.

- **ORD-SUB-017** As a member, I can delete my own subscription. <!-- 03-features/orders-subscriptions.md R17, F5.3; camap-hx/src/controller/Subscriptions.hx:35-44 -->
  - See ORD-SBM-005 for the conditions.
  - **ERRATUM** Deletion is a plain link with no security token, unlike the coordinator deletion. Source: `camap-hx/src/controller/Subscriptions.hx:35-44` (CODE-020). Decided fix: see ORD-SUB-018 (UND-070).

- **ORD-SUB-018** As a member, deleting my subscription needs a confirmation step with a security token. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/Subscriptions.hx:35-44 -->
  - I confirm the deletion first; the request is a POST carrying a CSRF token.
  - A request without a valid token is refused.
  - **ERRATUM** Today the member deletion link is a plain GET with no token. Source: `camap-hx/src/controller/Subscriptions.hx:35-44`, `camap-ts/packages/front-core/src/modules/csaCatalog/containers/CsaCatalogSubscription.tsx:192-198` (CODE-020).
  - **DECISION (UND-070, 2026-11-02)** Member deletion becomes a confirmed POST with a CSRF token, like the admin route.
