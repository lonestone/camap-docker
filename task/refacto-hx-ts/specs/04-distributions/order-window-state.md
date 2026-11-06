# Order window state (DIS-OWS)

Actors: member, the system.

- **DIS-OWS-001** As a member, a distribution session has one state: no order dates, not yet open, open, closed or distributed. <!-- 03-features/distributions-volunteers.md R15; camap-hx/src/db/MultiDistrib.hx:260-280 -->

- **DIS-OWS-002** As a member, before the distribution starts, the session is "not yet open" while the earliest opening date is in the future. <!-- 03-features/distributions-volunteers.md R15; camap-hx/src/db/MultiDistrib.hx:159-189,260-280 -->
  - The earliest opening date includes the exceptions of catalogs with their own order dates.

- **DIS-OWS-003** As a member, before the distribution starts, the session is "open" while the latest closing date is in the future, and "closed" afterwards. <!-- 03-features/distributions-volunteers.md R15; camap-hx/src/db/MultiDistrib.hx:260-280 -->
  - The latest closing date includes the exceptions of catalogs with their own order dates.

- **DIS-OWS-004** As a member, once the distribution has started the session is "distributed". <!-- 03-features/distributions-volunteers.md R15; camap-hx/src/db/MultiDistrib.hx:260-280 -->

- **DIS-OWS-005**: As a member, a session never shows a "validated" state: no validation step exists for a session. <!-- 03-features/distributions-volunteers.md R15, R17; camap-hx/lang/master/tpl/distribution/default.mtt:184; camap-ts/packages/api-core/src/shop/multi-distrib-status.ts:1-7 -->
  - The state function never returns "validated"; the TS `VALIDATED` value and the template branches stay only for Haxe/database compatibility and are exposed by no field. Source: `camap-hx/src/db/MultiDistrib.hx:260-280`, `camap-hx/lang/master/tpl/distribution/default.mtt:129,184`, `camap-ts/packages/api-core/src/shop/multi-distrib-status.ts:1-7`.
  - **DECISION (UND-057, 2026-11-04)** Keep the current behaviour: the dead "validated" state stays, kept only for Haxe/DB compatibility.

- **DIS-OWS-006** As a member, I can order from a catalog distribution only strictly between its opening and closing dates, when the catalog accepts user orders. <!-- 03-features/distributions-volunteers.md R16; camap-hx/src/db/Distribution.hx:154-165; camap-ts/packages/camap-common/src/distributions/distribution.ts:1-7 -->
  - Without a closing date, the catalog's own availability applies in Haxe and ordering is closed in TS.

- **DIS-OWS-007** As a coordinator, I can give one catalog distribution its own order opening and closing dates. <!-- 03-features/distributions-volunteers.md S3.1, R13; camap-hx/src/controller/Distribution.hx:285; camap-hx/src/service/DistributionService.hx:383-404 -->
  - This is not offered for constant-orders catalogs.
  - The new dates are checked against the distribution date.

- **DIS-OWS-008** As a coordinator, a catalog distribution date must lie within the catalog dates, and must not be before its order closing date. <!-- 03-features/distributions-volunteers.md R11; camap-hx/src/service/DistributionService.hx:79-96 -->
  - For a variable catalog the order opening date must not be after the closing date.
