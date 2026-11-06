# Volunteer registration and calendar (DIS-VOL)

Actors: member, group admin.

- **DIS-VOL-001** As a member, I can see a calendar of the duty slots of my group, four months before and after today. <!-- 03-features/distributions-volunteers.md S3.7; camap-ts/packages/front-core/src/modules/volunteersCalendar/VolunteersCalendar.module.tsx:129-135 -->
  - For each session I see the required and registered volunteers, the vacant roles and who holds each role.

- **DIS-VOL-002** As a member, I can see in the calendar which roles I already hold and whether volunteers can still join. <!-- 03-features/distributions-volunteers.md S3.4; camap-hx/src/controller/api/Distributions.hx:36-86 -->

- **DIS-VOL-003** As a member, I can register for a vacant volunteer role from the calendar. <!-- 03-features/distributions-volunteers.md R28, F-C; camap-hx/src/service/VolunteerService.hx:86-111 -->
  - A role already filled cannot be taken.
  - I can take several roles in the same session.
  - **DECISION (UND-064, 2026-11-06)** Several roles in the same session stay allowed (the one-role rule stays commented out).

- **DIS-VOL-004** As a member, I can register only for a role that belongs to the session, within the opening period, as a member of the group. <!-- 03-features/distributions-volunteers.md R28, R29; camap-hx/src/service/VolunteerService.hx:86-111; camap-hx/src/db/MultiDistrib.hx:463-466 -->
  - Duties open "days before" the distribution as set by the group admin.
  - The server checks all three conditions: the role belongs to the session, registration is open (`canVolunteersJoin`), and the user is a member of the group.
  - **ERRATUM** Today the only server check is that the role is not filled; the opening period (check exists but is unused here), the role belonging to the session and the group membership are not checked. Source: `camap-hx/src/service/VolunteerService.hx:86-111`, `camap-hx/src/db/MultiDistrib.hx:463-466`.
  - **DECISION (UND-064, 2026-11-06)** Register by POST with a security token and all checks (role in the session, registration open, user in the group); several roles per user stay allowed.

- **DIS-VOL-005** As a member, registering for a role is an explicit action and not a link that acts when opened. <!-- 03-features/distributions-volunteers.md S3.1; camap-hx/src/controller/Distribution.hx:993-1002 -->
  - Registering is a POST with a security token, not a GET on the calendar page.
  - **ERRATUM** Today registering is a GET with parameters on the calendar page, so opening a link registers. Source: `camap-hx/src/controller/Distribution.hx:993-1002`, `camap-ts/packages/front-core/src/modules/volunteersCalendar/components/VolunteersCalendarDistributionRole.tsx:117`.
  - **DECISION (UND-064, 2026-11-06)** Register by POST with a security token and all checks (role in the session, registration open, user in the group); several roles per user stay allowed.

- **DIS-VOL-006** As a member, I can unregister from a role I hold. <!-- 03-features/distributions-volunteers.md R30; camap-hx/src/controller/api/Distributions.hx:21-31 -->
  - Only the volunteer himself can unregister.
  - Unregistering from an empty role is refused.

- **DIS-VOL-007** As a member of the group, I receive an email when a volunteer leaves a role close to the distribution. <!-- 03-features/distributions-volunteers.md R30; camap-hx/src/service/VolunteerService.hx:126-171 -->
  - It is sent to everyone in the group, to primary and secondary emails.
  - It is sent only if the departure is within the "vacant role alert" delay before the distribution.

- **DIS-VOL-008** As a group admin, I can assign one member per role on a session. <!-- 03-features/distributions-volunteers.md R27, S3.1; camap-hx/src/service/VolunteerService.hx:44-80 -->
  - The choice lists all members of my group.
  - The volunteers of the session match what I submit.

- **DIS-VOL-009**: As a group admin, I can assign volunteers on a session; the action has no explicit rights check and does not verify that the session belongs to my group. <!-- 03-features/distributions-volunteers.md S3.1, S7; camap-hx/src/controller/Distribution.hx:937,873 -->
  - This is intended: `volunteerRoles` and `volunteers` have no explicit right check. Source: `camap-hx/src/controller/Distribution.hx:873,937` (CODE-019).
  - **DECISION (UND-060, 2026-11-04)** Keep the current behaviour: no explicit rights checks are added to these distribution handlers.

- **DIS-VOL-010** As a member, I can see in the calendar that a session has vacant roles when duties are open and at least one role has no volunteer (see DIS-VOL-011). <!-- 03-features/distributions-volunteers.md R33; camap-hx/src/db/MultiDistrib.hx:419-428 -->
  - **DECISION (UND-066, 2026-11-04)** The vacancy test is per role, not a count comparison.

- **DIS-VOL-011**: As a member, a session counts as having vacant roles when at least one role has no volunteer. <!-- 03-features/distributions-volunteers.md R33; camap-hx/src/db/MultiDistrib.hx:423 -->
  - Vacancy is decided per role, as `getVacantVolunteerRoles` already does.
  - **ERRATUM** Today the count compares the number of roles with the total number of volunteer rows, so two volunteers on one role hide an empty role. Source: `camap-hx/src/db/MultiDistrib.hx:419-428`.
  - **DECISION (UND-066, 2026-11-04)** Vacant when at least one role has no volunteer, decided per role.

- **DIS-VOL-012** As a member, I can see in the calendar the generic roles always, and catalog roles until some days after the catalog ends. <!-- 03-features/distributions-volunteers.md R31; camap-hx/src/service/VolunteerService.hx:386-409 -->

- **DIS-VOL-013** As a member, I can see how many duties I have done and how many I still have to do over the membership year. <!-- 03-features/distributions-volunteers.md R32; camap-hx/src/service/VolunteerService.hx:260-380 -->
  - Group-wide duties to do = number of such slots in the period divided by the number of members, rounded up.
  - Catalog duties to do = for each catalog where I (or the second person) ordered, slots divided by the members who ordered, rounded up.

- **DIS-VOL-014** As a group admin, I can see for every member the duties done and to be done. <!-- 03-features/distributions-volunteers.md R32, S3.1; camap-hx/src/controller/Distribution.hx:1025-1060 -->

- **DIS-VOL-015** As a member, I can see the volunteers and roles of a session. <!-- 03-features/distributions-volunteers.md S3.6; camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:155-181 -->
