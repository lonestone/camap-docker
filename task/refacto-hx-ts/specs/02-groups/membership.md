# Membership fee, cotisation (GRP-COT)

Actors: group admin, membership manager, member, the system.

- **GRP-COT-001** As a group admin, I can enable yearly memberships for my group, set a fee and set a renewal date. <!-- 03-features/groups-membership.md R14; camap-hx/src/controller/AmapAdmin.hx:39-72 -->

- **GRP-COT-002** As a group admin, I can set a membership fee of any non-zero amount, including amounts above 127; zero is not a valid fee. <!-- 03-features/groups-membership.md R14, R17; camap-ts/packages/api-core/src/groups/entities/group.entity.ts:54-58 -->
  - The fee is stored in a larger integer type, on both sides.
  - A fee of 0 is not accepted as a fee: for a membership it keeps meaning "use the group fee" (see GRP-COT-006). A free or variable group cotisation is not expressed with a 0 fee: it is managed another way, to be specified.
  - **ERRATUM** Today the fee is a tiny integer (maximum 127) on both sides. Source: `camap-ts/packages/api-core/src/groups/entities/group.entity.ts:54-58`, `camap-hx/src/controller/AmapAdmin.hx:48` (CODE-051).
  - **DECISION (UND-032, 2026-11-06)** Widen the fee type and accept any non-zero value; 0 stays "not a fee", and the group cotisation is managed another way.

- **GRP-COT-003** As a member, the membership year of my group runs from the renewal date. <!-- 03-features/groups-membership.md R15; camap-hx/src/db/Group.hx:312-330 -->
  - If today is before this year's renewal date, the membership year is the previous year.
  - With no renewal date, the year is the calendar year.

- **GRP-COT-004** As a member, the membership period is named with one year when renewal is in January or February, otherwise with two years (for example 2025-2026). <!-- 03-features/groups-membership.md R15; camap-hx/src/db/Group.hx:350-356 -->

- **GRP-COT-005** As a member, my membership is valid when it exists for the current membership year of a group that has memberships enabled. <!-- 03-features/groups-membership.md R16; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:198-212 -->
  - Validity needs all three: memberships enabled in the group, a renewal date, and a membership row for the current year.
  - When the group has memberships disabled, no membership is valid, which matches the empty membership lists and the refusal to create memberships.
  - **ERRATUM** Today validity needs only a renewal date and a row for the current year; the "memberships enabled" flag is not consulted. Source: `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:198-212`.
  - **DECISION (UND-035, 2026-11-06)** Gate membership validity on the group having memberships enabled.

- **GRP-COT-006** As a membership manager, I can record a membership for a member of my group. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:147-191 -->
  - The group must have memberships enabled.
  - A member has only one membership per year.
  - I can enter a fee, otherwise the group fee is used.
  - Without any fee an error asks me to define one.
  - The payment type is chosen as in GRP-COT-008 and the member must belong to the group as in GRP-COT-009.
  - A fee of 0 given to a membership is replaced by the group fee. This is intended: see GRP-COT-002. Source: `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:106` (CODE-038).
  - **DECISION (UND-032, 2026-11-06)** A 0 fee is not a valid value; it keeps meaning "use the group fee".
  - **DECISION (UND-033, 2026-11-06)** The payment type and the group membership check are handled in GRP-COT-008 and GRP-COT-009.

- **GRP-COT-007** As a membership manager, recording a membership adds the fee as a debt for the member and an immediate payment of the same amount, with the payment type I chose. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:96-152 -->
  - The debt is labelled "Adhésion" followed by the period.
  - The balance of the member stays unchanged.
  - **DECISION (UND-033, 2026-11-06)** The immediate payment uses the chosen payment type instead of always cash.

- **GRP-COT-008** As a membership manager, I can choose the payment type of the membership. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:114 -->
  - The immediate payment created with the membership uses the payment type I chose.
  - **ERRATUM** Today the payment type input is ignored and the payment is always cash. Source: `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:114` (CODE-038).
  - **DECISION (UND-033, 2026-11-06)** Honour the chosen payment type.

- **GRP-COT-009** As a membership manager, I can only record a membership for a user who belongs to my group. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:96-152 -->
  - A user who is not in the group is rejected, in single and batch creation.
  - **ERRATUM** Today the user is not checked to belong to the group. Source: `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:166-176`, `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:96-152` (CODE-038).
  - **DECISION (UND-033, 2026-11-06)** Reject a user who is not in the group.

- **GRP-COT-010** As a membership manager, I can record memberships for several members at once. <!-- 03-features/groups-membership.md R17; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:193-249 -->
  - A member who already has one for that year is reported as an error and skipped.
  - The results are matched to the requested users by user id, not by the order the database returns them.
  - **DECISION (UND-033, 2026-11-06)** Batch results are mapped on user id.

- **GRP-COT-011** As a membership manager, I can delete a membership. <!-- 03-features/groups-membership.md R18; camap-ts/packages/api-core/src/groups/services/memberships.service.ts:154-193 -->
  - The related payment and debt are deleted.
  - The balance of the member is recomputed.

- **GRP-COT-012** As a membership manager, the membership dialog offers a proposed fee, the years from 4 years back to 1 year ahead, and the recent distributions. <!-- 03-features/groups-membership.md R19; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:89-119 -->
  - Recent distributions are those between 3 months ago and 5 days ahead.

- **GRP-COT-013** As a membership manager, I can open the membership dialog from a member's sheet and from the members list. <!-- 03-features/groups-membership.md F7; camap-ts/packages/front-core/src/modules/membership/MembershipDialog.module.tsx -->

- **GRP-COT-014** As a membership manager, I can list the members with and without a valid membership. <!-- 03-features/groups-membership.md R16, R20; camap-hx/src/service/MembershipService.hx:25-56 -->

- **GRP-COT-015** As a membership manager, I can read the memberships of a member. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:48-278 -->
  - I need the membership right.
