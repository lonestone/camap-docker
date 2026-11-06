# Baskets (ORD-BSK)

Actors: member, coordinator. A basket groups one member's order lines of all catalogs for one distribution session.

- **ORD-BSK-001** As a member, I have one basket per distribution session, numbered in sequence inside the session. <!-- 03-features/orders-subscriptions.md S2, R36; camap-hx/src/db/Basket.hx:15-27,48-66 -->
  - **ERRATUM** If my basket for the session is still open, a second, confirmed basket is created instead of reusing it. Source: `camap-hx/src/db/Basket.hx:52-61` (CODE-042).

- **ORD-BSK-002** As a member, ordering again for the same session reuses my existing basket. <!-- 03-features/orders-subscriptions.md R36; camap-hx/src/db/Basket.hx:48-66 -->
  - I have at most one basket per session, whatever its status.
  - A leftover basket in the "open" status (from the removed temporary baskets, see ORD-BSK-003) is switched to "confirmed" when it is reused, so it shows in the session lists and totals.
  - **ERRATUM** Today a second basket is created when the existing one is in the "open" status. Source: `camap-hx/src/db/Basket.hx:48-66` (CODE-042).
  - **DECISION (UND-076, 2026-11-02)** Reuse any existing basket of the member for the session and remove the OPEN branch; a leftover OPEN basket is switched to CONFIRMED when reused.

- **ORD-BSK-003** As a coordinator, I have no temporary-basket page: temporary baskets do not exist. <!-- 03-features/orders-subscriptions.md R37; camap-hx/src/controller/ContractAdmin.hx:1112-1115; camap-hx/src/service/OrderService.hx:419-494 -->
  - The create, confirm and read functions for temporary baskets are not ported.
  - **ERRATUM** Today the coordinator page still lists temporary baskets, although nothing creates or confirms them. Source: `camap-hx/src/controller/ContractAdmin.hx:1112-1115`, `camap-hx/src/service/OrderService.hx:419-494,581-621` (CODE-077).
  - **DECISION (UND-077, 2026-11-02)** Remove temporary baskets, their coordinator page and the confirm function.

- **ORD-BSK-004** As a coordinator, the sessions' baskets exclude temporary baskets. <!-- 03-features/orders-subscriptions.md R37; camap-hx/src/db/MultiDistrib.hx:330-346 -->
  - Temporary baskets are no longer created (see ORD-BSK-003); any old temporary rows stay excluded.

- **ORD-BSK-005** *Undecided (UND-086)*: As a coordinator, the total of a basket is reliable. <!-- 03-features/orders-subscriptions.md R38; camap-hx/src/db/Basket.hx:24 -->
  - The total is refreshed by some actions and not by subscription orders.
  - **SUGGESTION** Compute the basket total on read from its orders; do not store it. Based on: `camap-hx/src/db/Basket.hx:24` (comment: total not reliable), `camap-hx/src/db/Basket.hx:132-144` (getOrdersTotal already computes it with fees), `camap-hx/src/controller/api/Order.hx:128` (only reader is the order dialog). Confidence: high.

- **ORD-BSK-006**: As a coordinator, no step marks a basket as validated: no session validation exists. <!-- 03-features/orders-subscriptions.md R36; camap-hx/src/db/Basket.hx:172-175 -->
  - The validated basket state stays only for Haxe/database compatibility. Source: `camap-hx/src/db/MultiDistrib.hx:260-280`, `camap-ts/packages/api-core/src/shop/multi-distrib-status.ts:5`.
  - **DECISION (UND-057, 2026-11-04)** Keep the current behaviour: the dead validated state is kept for compatibility, see DIS-OWS-005.
