# Catalog participation in a session (DIS-PAR)

Actors: coordinator, coordinator of all catalogs.

- **DIS-PAR-001** As a coordinator of all catalogs, I can make a catalog take part in a distribution session. <!-- 03-features/distributions-volunteers.md R10, F-B; camap-hx/src/service/DistributionService.hx:271-311 -->
  - A catalog cannot take part twice in the same session.
  - A variable catalog needs the session to have order dates.

- **DIS-PAR-002** As a coordinator, the order window of a catalog distribution follows the catalog's own delays when set, otherwise the session's dates. <!-- 03-features/distributions-volunteers.md R10; camap-hx/src/service/DistributionService.hx:271-311 -->

- **DIS-PAR-003** As a coordinator, when a catalog joins a session, its volunteer roles are added to the session. <!-- 03-features/distributions-volunteers.md F-B; camap-hx/src/service/DistributionService.hx:132-138 -->

- **DIS-PAR-004** As a coordinator, I see a warning when a catalog with existing subscriptions joins a session, and a refusal for constant-orders catalogs. <!-- 03-features/distributions-volunteers.md R10; camap-hx/src/service/DistributionService.hx:271-311 -->

- **DIS-PAR-005** As a coordinator, I can list the sessions of a catalog from its first distribution up to its end date, within one year unless I choose a period. <!-- 03-features/distributions-volunteers.md S3.2; camap-hx/src/controller/ContractAdmin.hx:957-985 -->

- **DIS-PAR-006** As a coordinator, I can make a catalog take part in all its sessions at once. <!-- 03-features/distributions-volunteers.md S3.2, F-A; camap-hx/src/controller/ContractAdmin.hx:971-985 -->

- **DIS-PAR-007** As a coordinator of all catalogs, I can tick or untick the active catalogs taking part in a session. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:479 -->
  - Adding the first vendor to an empty session adds the default volunteer roles.

- **DIS-PAR-008**: As a coordinator, I can make a catalog take part in a session; the action does not check that I manage that catalog. <!-- 03-features/distributions-volunteers.md S3.2, S7; camap-hx/src/controller/ContractAdmin.hx:1001-1011; camap-hx/src/controller/Distribution.hx:479 -->
  - This is intended: `participate` has no explicit right check. Source: `camap-hx/src/controller/Distribution.hx:479`, `camap-hx/src/controller/ContractAdmin.hx:1001-1011` (CODE-019).
  - **DECISION (UND-060, 2026-11-04)** Keep the current behaviour: no explicit rights checks are added to these distribution handlers.

- **DIS-PAR-009** As a coordinator, I can cancel a catalog's participation in a session. <!-- 03-features/distributions-volunteers.md R12; camap-hx/src/service/DistributionService.hx:560-630 -->
  - For constant catalogs, and for variable catalogs with a per-distribution minimum, cancelling fails if any subscription is paid.
  - A warning appears when subscriptions exist.
  - Constant catalog: allowed only if no distribution of the catalog is already past.
  - Other catalogs: allowed only if the total ordered quantity is 0.
  - Zero-quantity orders are deleted and the catalog's volunteer roles are removed from the session.

- **DIS-PAR-010** As a coordinator, I can move a catalog's participation to another session. <!-- 03-features/distributions-volunteers.md R14; camap-hx/src/service/DistributionService.hx:409-552 -->
  - The new session date must be inside the catalog dates.
  - If the catalog already takes part in the target session, the orders move there and the distribution counts twice.
  - The move is refused if a subscriber is absent on the target but not on the source.
  - Otherwise the distribution takes the target's dates.
  - Volunteers on the catalog's roles in the old session are removed.
  - The catalog end date and the subscriptions ending earlier are extended when needed.
  - Baskets are recreated and renumbered.

- **DIS-PAR-011** As a coordinator, I see warnings before shifting a participation. <!-- 03-features/distributions-volunteers.md R14; camap-hx/src/controller/Distribution.hx:341-349 -->

- **DIS-PAR-012**: As a coordinator, after changing the price of a product on a session, I land back on the distributions page. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:1096,1144 -->
  - The redirect goes to `/distribution`, as the sibling actions do.
  - The "validate" buttons of the distribution page are removed.
  - **ERRATUM** Today the user is redirected to `/distribution/validate/<id>`, which has no handler. Source: `camap-hx/src/controller/Distribution.hx:1096,1144` (CODE-083).
  - **DECISION (UND-058, 2026-11-04)** Redirect to `/distribution` and remove the validate buttons.

- **DIS-PAR-013** As a coordinator of all catalogs, I can change the price of a product of variable catalogs on one session. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:1106-1151 -->
  - Every order of that product in the session gets the new price.
  - The catalog price itself is unchanged, and a warning says so.
  - The payments and balances of the affected orders are updated.

- **DIS-PAR-014** As a coordinator of all catalogs, I can bulk-edit missing products on the orders of variable catalogs of a session. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:1066 -->
