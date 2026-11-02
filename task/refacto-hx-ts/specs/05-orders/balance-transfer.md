# Balance transfer between subscriptions (ORD-BTR)

Actors: catalog coordinator.

- **ORD-BTR-001** As a catalog coordinator, I can transfer the balance of a subscription to another subscription of the same member and vendor. <!-- 03-features/orders-subscriptions.md R19, F5.5; camap-hx/src/service/SubscriptionService.hx:1099-1139 -->
  - Only subscriptions not yet ended are offered.
  - The transfer creates two payment operations of type transfer, minus the balance on the source and plus on the target.
  - Negative balances can be transferred.
  - **ERRATUM** On submit only "same member" is checked: a crafted target (other vendor, ended subscription, or the source itself) is accepted. Source: `camap-hx/src/service/SubscriptionService.hx:1099-1131` (CODE-036).

- **ORD-BTR-002** As a catalog coordinator, I get an error when the member has no other subscription to transfer to. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:391-394 -->

- **ORD-BTR-003** As a catalog coordinator, the transfer needs a security token. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/src/controller/SubscriptionAdmin.hx:382-415 -->

- **ORD-BTR-004** As a catalog coordinator, I can transfer only to a subscription of the same member, with the same vendor, that is not closed. <!-- 03-features/orders-subscriptions.md R19; camap-hx/src/service/SubscriptionService.hx:1100-1104 -->
  - The check is done on the server, not only by the choices offered in the form.
  - A missing source or target gives a clear error.
  - **ERRATUM** Today the server checks only "same member", and reads the source balance before checking it exists. Source: `camap-hx/src/service/SubscriptionService.hx:1100-1104` (CODE-036).
  - **DECISION (UND-080, 2026-11-02)** The service checks that the target is the same member, same vendor and not closed, and null-checks both subscriptions before reading the balance.

- **ORD-BTR-005** As a catalog coordinator, I can transfer any non-zero balance, positive or negative. <!-- 03-features/orders-subscriptions.md S3.2; camap-hx/lang/master/tpl/contractadmin/subscriptionpayments.mtt:23-33 -->
  - The transfer button shows whatever the sign of the balance.
  - The "balance above 0" condition was commented out on purpose; this is intended. See ORD-BTR-001.
  - **DECISION (UND-081, 2026-11-02)** Allow transferring any non-zero balance, negative included; there is no positive-only rule.
