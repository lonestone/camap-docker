# Membership fee, cotisation (GRP-COT)

Actors: group admin, membership manager, member, the system.

- **GRP-COT-001** As a group admin, I can enable yearly memberships for my group, set a fee and set a renewal date. <!-- 03-features/groups-membership.md R14; camap-hx/src/controller/AmapAdmin.hx:39-72 -->

- **GRP-COT-002** *Undecided (UND-032)*: As a group admin, I can set any membership fee, including 0 and amounts above 127. <!-- 03-features/groups-membership.md R14, R17; camap-ts/packages/api-core/src/groups/entities/group.entity.ts:54-58 -->
  - **SUGGESTION** Widen the fee column to a larger integer, let the fee be empty (variable) or at least 0, and treat an explicit 0 as a free membership. Based on: `camap-ts/packages/api-core/src/groups/entities/group.entity.ts:57-58` (tinyint, max 127), `camap-hx/src/controller/AmapAdmin.hx:48` (label says empty means variable), `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:106` (`!fee` turns 0 into the group fee). Confidence: medium. Product input needed: free memberships allowed?

- **GRP-COT-003** As a member, the membership year of my group runs from the renewal date. <!-- 03-features/groups-membership.md R15; camap-hx/src/db/Group.hx:312-330 -->
  - If today is before this year's renewal date, the membership year is the previous year.
  - With no renewal date, the year is the calendar year.

- **GRP-COT-004** As a member, the membership period is named with one year when renewal is in January or February, otherwise with two years (for example 2025-2026). <!-- 03-features/groups-membership.md R15; camap-hx/src/db/Group.hx:350-356 -->

- **GRP-COT-005** *Undecided (UND-035)*: As a member, my membership is valid when it exists for the current membership year of a group that has memberships enabled. <!-- 03-features/groups-membership.md R16; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:198-212 -->
  - **SUGGESTION** Gate validity on the group having memberships enabled, in addition to the renewal date and current-year row. Based on: `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:175-176` (creation refused when memberships are off), `camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts:52` (lists empty when off), `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:198-212` (validity ignores the flag). Confidence: medium.

- **GRP-COT-006** As a membership manager, I can record a membership for a member of my group. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:147-191 -->
  - The group must have memberships enabled.
  - A member has only one membership per year.
  - I can enter a fee, otherwise the group fee is used.
  - Without any fee an error asks me to define one.
  - **ERRATUM** The payment type I choose is ignored (always cash), a fee of 0 is replaced by the group fee, and the member is not checked to belong to the group. Source: `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:97-114` (CODE-038).

- **GRP-COT-007** As a membership manager, recording a membership adds the fee as a debt for the member and an immediate cash payment of the same amount. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:96-152 -->
  - The debt is labelled "Adhésion" followed by the period.
  - The balance of the member stays unchanged.

- **GRP-COT-008** *Undecided (UND-033)*: As a membership manager, I can choose the payment type of the membership. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:114 -->
  - **SUGGESTION** Fix both: honour the chosen payment type and reject a user who is not in the group; keep result order by mapping on user id. Based on: `camap-ts/packages/front-core/src/modules/members/components/MembersTableToolbar.tsx:137` (front sends `check`), `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:114` (always cash), `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:166-176` (no membership of the group checked). Confidence: high.

- **GRP-COT-009** *Undecided (UND-033)*: As a membership manager, I can only record a membership for a user who belongs to my group. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:96-152 -->
  - **SUGGESTION** Fix both: honour the chosen payment type and reject a user who is not in the group; keep result order by mapping on user id. Based on: `camap-ts/packages/front-core/src/modules/members/components/MembersTableToolbar.tsx:137` (front sends `check`), `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:114` (always cash), `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:166-176` (no membership of the group checked). Confidence: high.

- **GRP-COT-010** As a membership manager, I can record memberships for several members at once. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:193-249 -->
  - A member who already has one for that year is reported as an error and skipped.

- **GRP-COT-011** As a membership manager, I can delete a membership. <!-- 03-features/groups-membership.md R18; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:154-193 -->
  - The related payment and debt are deleted.
  - The balance of the member is recomputed.

- **GRP-COT-012** As a membership manager, the membership dialog offers a proposed fee, the years from 4 years back to 1 year ahead, and the recent distributions. <!-- 03-features/groups-membership.md R19; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:89-119 -->
  - Recent distributions are those between 3 months ago and 5 days ahead.

- **GRP-COT-013** As a membership manager, I can open the membership dialog from a member's sheet and from the members list. <!-- 03-features/groups-membership.md F7; camap-ts/packages/front-core/src/modules/membership/MembershipDialog.module.tsx -->

- **GRP-COT-014** As a membership manager, I can list the members with and without a valid membership. <!-- 03-features/groups-membership.md R16, R20; camap-hx/src/service/MembershipService.hx:25-56 -->

- **GRP-COT-015** As a membership manager, I can read the memberships of a member. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:48-278 -->
  - I need the membership right.
