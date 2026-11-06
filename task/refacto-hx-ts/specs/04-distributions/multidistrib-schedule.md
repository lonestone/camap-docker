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

- **DIS-MDS-009**: As a coordinator of all catalogs, I can edit a session or change its prices with my section right; the session and the chosen place are not compared with my group. <!-- 03-features/distributions-volunteers.md R8, S3.1; camap-hx/src/controller/Distribution.hx:614-678,1106-1151 -->
  - This is intended: `editMd` and `changePrice` check only the section right. Source: `camap-hx/src/controller/Distribution.hx:614-678,1106-1151`, `camap-hx/src/service/DistributionService.hx:194-248` (CODE-011).
  - **DECISION (UND-059, 2026-11-04)** Keep the current behaviour: no group scoping is added to session edit and price change.

- **DIS-MDS-010** As a coordinator of all catalogs, I can delete a session. <!-- 03-features/distributions-volunteers.md S3.1, R9; camap-hx/src/service/DistributionService.hx:253-266 -->
  - Deletion needs a security token.
  - All catalog participations of the session are cancelled first, under the cancel rules.

- **DIS-MDS-011** As a coordinator of all catalogs, I can print or export attendance for a session. <!-- 03-features/distributions-volunteers.md S3.1, F; camap-hx/src/controller/Distribution.hx:143 -->
  - See 04-distributions/attendance-sheets.md.

- **DIS-MDS-012**: As a member, every date and time is shown in the group's local time (Paris time), whichever application shows it. <!-- 03-features/distributions-volunteers.md R1-R3, R5; camap-hx/camap-hx.Dockerfile:115; camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:90-142 -->
  - The shared database keeps Paris wall-clock times; they are converted only through the entity getters and setters.
  - Every comparison of a raw date column is wrapped with `utcToZonedTime(date, TZ_PARIS)`.
  - **ERRATUM** Today some TS finders compare raw columns with unconverted dates, the catalog dates are plain dates without conversion, and tests run in UTC. Source: `camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:50-115`, `camap-ts/packages/api-core/src/vendors/entities/catalog.entity.ts:39-66` (CODE-096).
  - **DECISION (UND-055, 2026-11-04)** Keep Paris wall-clock storage and wrap raw-column comparisons with `utcToZonedTime`.

- **DIS-MDS-013**: As a member, summer and winter time changes are applied on the real change dates each year. <!-- 03-features/distributions-volunteers.md R3, R4; camap-hx/common/Formatting.hx:226-255 -->
  - The change dates follow the Europe/Paris rules (last Sunday of March and of October), through a time-zone library.
  - **ERRATUM** Today the Haxe JSON API appends +01:00 or +02:00 using fixed dates every year ("29 March 02:00" and "25 October 03:00"), and a date tool holds a table for 2019 to 2024 only. Source: `camap-hx/common/Formatting.hx:226-255`, `camap-hx/src/tools/DateTool.hx:10-35,93-139` (CODE-081).
  - **DECISION (UND-056, 2026-11-04)** Follow the real DST calendar with a time-zone library instead of a hard-coded table.

- **DIS-MDS-014** As a coordinator of all catalogs, I can list the distribution sessions of a period from the TS side. <!-- 03-features/distributions-volunteers.md S3.6; camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:78-120 -->
  - Sessions already distributed are listed separately.
  - A next session can be returned when none is found.

- **DIS-MDS-015** As a member of a group, I can read the sessions and distributions of my own group only. <!-- 03-features/distributions-volunteers.md S3.6, S7; camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:62-74; camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:33 -->
  - Reading a session or a distribution requires login and membership of its group.
  - The orders of a distribution are visible only to their owner and to managers of the catalog.
  - **ERRATUM** Today `distribution(id)` and its user orders need no login, and `multiDistribution(id)` needs only a login. Source: `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:19-33,96-104`, `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:62-74` (CODE-010, CODE-018).
  - **DECISION (UND-061, 2026-11-02)** Require login and group membership to read distributions and sessions; a distribution's user orders are visible only to their owner and to managers of the catalog.
