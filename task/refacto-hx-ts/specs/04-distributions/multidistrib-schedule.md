# Distribution sessions: create, edit, delete (DIS-MDS)

Actors: coordinator of all catalogs, member. A distribution session (multi-distribution) is one date, one place and one order window of a group.

- **DIS-MDS-001** As a coordinator of all catalogs, I can open the distributions page of my group. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:24-54 -->
  - It lists sessions from yesterday to 12 weeks ahead, plus the cycles overlapping that period.
  - I can choose another period.
  - Other members are refused.

- **DIS-MDS-002** As a coordinator of all catalogs, I can create one distribution session with a date, start and end times, a place and an order opening and closing date. <!-- 03-features/distributions-volunteers.md S3.1, R7; camap-hx/src/controller/Distribution.hx:558; camap-hx/src/service/DistributionService.hx:157-189 -->

- **DIS-MDS-003** As a coordinator of all catalogs, I cannot create a session when another one exists on the same day at the same place. <!-- 03-features/distributions-volunteers.md R6, R7; camap-hx/src/db/MultiDistrib.hx:44-49; camap-hx/src/service/DistributionService.hx:157-162 -->

- **DIS-MDS-004** As a coordinator of all catalogs, the end time of a session is always on the same day as its start. <!-- 03-features/distributions-volunteers.md R7; camap-hx/src/service/DistributionService.hx:22-28 -->

- **DIS-MDS-005** As a coordinator of all catalogs, I must give an order opening date and an order closing date. <!-- 03-features/distributions-volunteers.md R7; camap-hx/src/service/DistributionService.hx:30-40 -->
  - The distribution starts at or after the order closing date.
  - The order opening date is at or before the order closing date.

- **DIS-MDS-006** As a coordinator of all catalogs, a new session starts with the group's default volunteer roles. <!-- 03-features/distributions-volunteers.md R7; camap-hx/src/service/DistributionService.hx:157-189 -->

- **DIS-MDS-007** As a coordinator of all catalogs, I can edit a session. <!-- 03-features/distributions-volunteers.md S3.1, R8; camap-hx/src/controller/Distribution.hx:614-678 -->
  - Times are chosen with a date picker in 5-minute steps.
  - The same day-and-place uniqueness applies.
  - Every catalog distribution of the session takes the new date, end time and place.

- **DIS-MDS-008** As a coordinator of all catalogs, I can tick "align all vendors on these times" when editing a session. <!-- 03-features/distributions-volunteers.md S3.1, R8; camap-hx/src/controller/Distribution.hx:642 -->
  - Ticked: every catalog distribution takes the session's order dates.
  - Not ticked: a catalog distribution follows a new session date only if it was equal to the previous session date, and keeps its own date otherwise.

- **DIS-MDS-009** *Undecided (UND-059)*: As a coordinator of all catalogs, I can edit or change prices only on sessions of my own group, and choose only places of my group. <!-- 03-features/distributions-volunteers.md R8, S3.1; camap-hx/src/controller/Distribution.hx:614-678,1106-1151 -->
  - **SUGGESTION** Limit to the current group. Reject a session whose group differs from the user's group, and accept only a place of that group. Mirror the TS group-bound check. Based on: `camap-hx/src/controller/Distribution.hx:24-27,614-618,1106-1109` (section right only, no group comparison), `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:216-218` (rights checked against the group id). Confidence: high.

- **DIS-MDS-010** As a coordinator of all catalogs, I can delete a session. <!-- 03-features/distributions-volunteers.md S3.1, R9; camap-hx/src/service/DistributionService.hx:253-266 -->
  - Deletion needs a security token.
  - All catalog participations of the session are cancelled first, under the cancel rules.

- **DIS-MDS-011** As a coordinator of all catalogs, I can print or export attendance for a session. <!-- 03-features/distributions-volunteers.md S3.1, F; camap-hx/src/controller/Distribution.hx:143 -->
  - See 04-distributions/attendance-sheets.md.

- **DIS-MDS-012** *Undecided (UND-055)*: As a member, every date and time is shown in the group's local time (Paris time), whichever application shows it. <!-- 03-features/distributions-volunteers.md R1-R3, R5; camap-hx/camap-hx.Dockerfile:115; camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:90-142 -->
  - **SUGGESTION** Keep Paris wall-clock storage in the shared database, and convert only through the entity getters and setters. Wrap every raw-column comparison with `utcToZonedTime(date, TZ_PARIS)`. Based on: `camap-hx/camap-hx.Dockerfile:115` (Haxe runs in Europe/Paris), `camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:99-105` (getters convert), `camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:50-87` (finders compare raw columns with unconverted dates). Confidence: high.

- **DIS-MDS-013** *Undecided (UND-056)*: As a member, summer and winter time changes are applied on the real change dates each year. <!-- 03-features/distributions-volunteers.md R3, R4; camap-hx/common/Formatting.hx:226-255 -->
  - **SUGGESTION** Use a time-zone library (Europe/Paris rules) instead of a hard-coded table of change dates. Based on: `camap-hx/src/tools/DateTool.hx:10-35` (fixed DST ranges that stop at 2024). Confidence: high.

- **DIS-MDS-014** As a coordinator of all catalogs, I can list the distribution sessions of a period from the TS side. <!-- 03-features/distributions-volunteers.md S3.6; camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:78-120 -->
  - Sessions already distributed are listed separately.
  - A next session can be returned when none is found.

- **DIS-MDS-015** As a member of a group, I can read the sessions and distributions of my own group only. <!-- 03-features/distributions-volunteers.md S3.6, S7; camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:62-74; camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:33 -->
  - Reading a session or a distribution requires login and membership of its group.
  - The orders of a distribution are visible only to their owner and to managers of the catalog.
  - **ERRATUM** Today `distribution(id)` and its user orders need no login, and `multiDistribution(id)` needs only a login. Source: `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:19-33,96-104`, `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:62-74` (CODE-010, CODE-018).
  - **DECISION (UND-061, 2026-11-02)** Require login and group membership to read distributions and sessions; a distribution's user orders are visible only to their owner and to managers of the catalog.
