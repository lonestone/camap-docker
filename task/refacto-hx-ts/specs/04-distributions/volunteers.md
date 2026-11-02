# Volunteer registration and calendar (DIS-VOL)

Actors: member, group admin.

- **DIS-VOL-001** As a member, I can see a calendar of the duty slots of my group, four months before and after today. <!-- 03-features/distributions-volunteers.md S3.7; camap-ts/packages/front-core/src/modules/volunteersCalendar/VolunteersCalendar.module.tsx:129-135 -->
  - For each session I see the required and registered volunteers, the vacant roles and who holds each role.

- **DIS-VOL-002** As a member, I can see in the calendar which roles I already hold and whether volunteers can still join. <!-- 03-features/distributions-volunteers.md S3.4; camap-hx/src/controller/api/Distributions.hx:36-86 -->

- **DIS-VOL-003** As a member, I can register for a vacant volunteer role from the calendar. <!-- 03-features/distributions-volunteers.md R28, F-C; camap-hx/src/service/VolunteerService.hx:86-111 -->
  - A role already filled cannot be taken.
  - I can take several roles in the same session.

- **DIS-VOL-004** *Undecided (UND-064)*: As a member, I can register only for a role that belongs to the session, within the opening period, as a member of the group. <!-- 03-features/distributions-volunteers.md R28, R29; camap-hx/src/service/VolunteerService.hx:86-111; camap-hx/src/db/MultiDistrib.hx:463-466 -->
  - Duties open "days before" the distribution as set by the group admin.
  - **SUGGESTION** Register by POST with the token. Check that the role belongs to the session, that registration is open (`canVolunteersJoin`), and that the user is a member of the group. Keep several roles per user allowed. Based on: `camap-hx/src/controller/Distribution.hx:993-1002` (GET with side effect), `camap-hx/src/db/MultiDistrib.hx:463-466` (open-period check exists, unused here), `camap-hx/src/service/VolunteerService.hx:86-111` (one-role rule commented out), `camap-ts/packages/front-core/src/modules/volunteersCalendar/components/VolunteersCalendarDistributionRole.tsx:117` (link). Confidence: medium.

- **DIS-VOL-005** *Undecided (UND-064)*: As a member, registering for a role is an explicit action and not a link that acts when opened. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:993-1002 -->
  - **SUGGESTION** Register by POST with the token. Check that the role belongs to the session, that registration is open (`canVolunteersJoin`), and that the user is a member of the group. Keep several roles per user allowed. Based on: `camap-hx/src/controller/Distribution.hx:993-1002` (GET with side effect), `camap-hx/src/db/MultiDistrib.hx:463-466` (open-period check exists, unused here), `camap-hx/src/service/VolunteerService.hx:86-111` (one-role rule commented out), `camap-ts/packages/front-core/src/modules/volunteersCalendar/components/VolunteersCalendarDistributionRole.tsx:117` (link). Confidence: medium.

- **DIS-VOL-006** As a member, I can unregister from a role I hold. <!-- 03-features/distributions-volunteers.md R30; camap-hx/src/controller/api/Distributions.hx:21-31 -->
  - Only the volunteer himself can unregister.
  - Unregistering from an empty role is refused.

- **DIS-VOL-007** As a member of the group, I receive an email when a volunteer leaves a role close to the distribution. <!-- 03-features/distributions-volunteers.md R30; camap-hx/src/service/VolunteerService.hx:126-171 -->
  - It is sent to everyone in the group, to primary and secondary emails.
  - It is sent only if the departure is within the "vacant role alert" delay before the distribution.

- **DIS-VOL-008** As a group admin, I can assign one member per role on a session. <!-- 03-features/distributions-volunteers.md R27, S3.1; camap-hx/src/service/VolunteerService.hx:44-80 -->
  - The choice lists all members of my group.
  - The volunteers of the session match what I submit.

- **DIS-VOL-009** *Undecided (UND-060)*: As a group admin, I can assign volunteers only on sessions of my group. <!-- 03-features/distributions-volunteers.md S3.1, S7; camap-hx/src/controller/Distribution.hx:937,873 -->
  - **SUGGESTION** Guard every handler. Catalog actions need `canManageContract(catalog)` and the object must belong to that catalog. Session actions need the distribution section right and a session of the current group. Based on: `camap-hx/src/controller/Distribution.hx:24-27` (section check used by siblings), `camap-hx/src/controller/Product.hx:34` (catalog check pattern), `camap-hx/src/controller/Distribution.hx:78,479,873,937` and `camap-hx/src/controller/ContractAdmin.hx:1001-1011` (no check). Confidence: high.

- **DIS-VOL-010** As a member, I can see in the calendar that a session has vacant roles when duties are open and roles outnumber volunteers. <!-- 03-features/distributions-volunteers.md R33; camap-hx/src/db/MultiDistrib.hx:419-428 -->

- **DIS-VOL-011** *Undecided (UND-066)*: As a member, a session counts as having vacant roles when at least one role has no volunteer. <!-- 03-features/distributions-volunteers.md R33; camap-hx/src/db/MultiDistrib.hx:423 -->
  - Currently the count compares roles with the total number of volunteer rows.
  - **SUGGESTION** Decide vacancy per role: a session has vacant roles when at least one of its roles has no volunteer. Based on: `camap-hx/src/db/MultiDistrib.hx:419-427` (compares role count with volunteer count, so two volunteers on one role hide an empty role) vs `:430-438` (`getVacantVolunteerRoles` already works per role). Confidence: high.

- **DIS-VOL-012** As a member, I can see in the calendar the generic roles always, and catalog roles until some days after the catalog ends. <!-- 03-features/distributions-volunteers.md R31; camap-hx/src/service/VolunteerService.hx:386-409 -->

- **DIS-VOL-013** As a member, I can see how many duties I have done and how many I still have to do over the membership year. <!-- 03-features/distributions-volunteers.md R32; camap-hx/src/service/VolunteerService.hx:260-380 -->
  - Group-wide duties to do = number of such slots in the period divided by the number of members, rounded up.
  - Catalog duties to do = for each catalog where I (or the second person) ordered, slots divided by the members who ordered, rounded up.

- **DIS-VOL-014** As a group admin, I can see for every member the duties done and to be done. <!-- 03-features/distributions-volunteers.md R32, S3.1; camap-hx/src/controller/Distribution.hx:1025-1060 -->

- **DIS-VOL-015** As a member, I can see the volunteers and roles of a session. <!-- 03-features/distributions-volunteers.md S3.6; camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:155-181 -->
