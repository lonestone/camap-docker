# Minimum order amounts (ORD-MIN)

Actors: member.

- **ORD-MIN-001** As a member of a variable catalog with a per-distribution minimum, every distribution not yet closed in my orders must reach that minimum. <!-- 03-features/orders-subscriptions.md R20; camap-hx/src/service/SubscriptionService.hx:581-602 -->
  - Each line is the quantity times the price, rounded to 2 decimals.
  - Closed distributions are skipped.
  - Otherwise I get a "catalog requirements not met" error.

- **ORD-MIN-002** As a member of a variable catalog with a catalog minimum, my total over the whole subscription must reach a share of that minimum. <!-- 03-features/orders-subscriptions.md R21; camap-hx/src/service/SubscriptionService.hx:485-515,604-622 -->
  - The required total is rounded down.
  - The share is my distributions (without absences) divided by all catalog distributions.
  - Without a subscription, it counts distributions from the next open one.
  - All orders of the subscription count.

- **ORD-MIN-003** As a member of a catalog with minimums, I cannot have a subscription with no order at all. <!-- 03-features/orders-subscriptions.md R21; camap-hx/src/service/SubscriptionService.hx:555-559 -->
  - The check runs at creation, when I update orders and when I update my default order.

- **ORD-MIN-004** As a member, the ordering screen warns me and blocks saving when my default order is below the distribution minimum or my total is below the catalog minimum. <!-- 03-features/orders-subscriptions.md R21; camap-ts/packages/front-core/src/modules/csaCatalog/containers/CsaCatalogOrdersMobile.tsx:297-373 -->
  - The screen estimates the minimum with the same share rule.

- **ORD-MIN-005** As a member, I can check my default order before saving it. <!-- 03-features/orders-subscriptions.md S3.1; camap-hx/src/controller/api/Subscription.hx:111-132 -->
  - The check covers stock when stock management is on and the minimums of variable catalogs.
  - It answers "valid" at once when the catalog has no minimum.

- **ORD-MIN-006** As a member, my absences are excluded from the minimum computation and from the default-order job. <!-- 03-features/orders-subscriptions.md R22; camap-hx/src/service/AbsencesService.hx:114-190 -->

- **ORD-MIN-007** As a member, the error message for a total below the minimum shows the same rounded amount as the check. <!-- 03-features/orders-subscriptions.md R21; camap-hx/src/service/SubscriptionService.hx:613,618 -->
  - The amount is rounded to 2 decimals and formatted as a price.
  - **ERRATUM** Today the check compares the rounded total but the message prints the raw one. Source: `camap-hx/src/service/SubscriptionService.hx:613,618` (CODE-046).
  - **DECISION (UND-084, 2026-11-02)** Print the rounded total in the minimum error message.
