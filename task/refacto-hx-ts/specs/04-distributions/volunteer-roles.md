# Volunteer roles and duty settings (DIS-ROL)

Actors: group admin, catalog coordinator.

- **DIS-ROL-001** As a group admin, I can create group-wide volunteer roles (for example "Cashier"). <!-- 03-features/distributions-volunteers.md R23; camap-hx/src/controller/amapadmin/Volunteers.hx:90-115 -->
  - I choose whether the role is enabled by default.
  - A role enabled by default is added to all future sessions.

- **DIS-ROL-002** As a catalog coordinator, I can create volunteer roles for my catalog. <!-- 03-features/distributions-volunteers.md R23; camap-hx/src/controller/ContractAdmin.hx:178-210 -->
  - They are enabled by default and added to the future sessions where the catalog already takes part.
  - **ERRATUM** Adding the role to future sessions fails when a session has no role list yet. Source: `camap-hx/src/controller/ContractAdmin.hx:203` (CODE-064).

- **DIS-ROL-003** As a catalog coordinator creating a catalog, I can ask for N volunteers per distribution and the system creates N roles "Duty period <catalog> i", up to 20. <!-- 03-features/distributions-volunteers.md R23; camap-hx/src/service/VolunteerService.hx:198-210 -->

- **DIS-ROL-004** As a group admin, switching a role off by default only affects future sessions, and I must confirm before registered volunteers are removed. <!-- 03-features/distributions-volunteers.md R24; camap-hx/src/controller/amapadmin/Volunteers.hx:136-170 -->
  - If volunteers are registered on the role in future sessions, the change is refused with a warning and a "force" link, as role deletion does (DIS-ROL-005).
  - With "force", the role and its volunteers are removed from future sessions.
  - **ERRATUM** Today the role and its registered volunteers are removed from all future sessions without warning. Source: `camap-hx/src/controller/amapadmin/Volunteers.hx:136-170` (CODE-064).
  - **DECISION (UND-065, 2026-11-02)** Refuse, or confirm with a "force" link, before removing registered volunteers; role edit and delete check the rights on the role's catalog or group.

- **DIS-ROL-005** As a group admin, I can delete a role only when no volunteer is registered on it, unless I confirm "delete anyway". <!-- 03-features/distributions-volunteers.md R25; camap-hx/src/service/VolunteerService.hx:14-39 -->
  - Deleting a role removes it from every session of the group.

- **DIS-ROL-006** As a catalog coordinator, deleting a catalog deletes its volunteer roles. <!-- 03-features/distributions-volunteers.md R25; camap-hx/src/controller/ContractAdmin.hx:1195-1199 -->

- **DIS-ROL-007** As a group admin, I can choose which roles a session needs. <!-- 03-features/distributions-volunteers.md R26; camap-hx/src/controller/Distribution.hx:873-931 -->
  - The list shows the group-wide roles and the roles of the catalogs taking part in the session.
  - A role that has a volunteer cannot be unchecked.
  - **ERRATUM** The Haxe page that saves the roles of a session has no rights check. Source: `camap-hx/src/controller/Distribution.hx:873` (CODE-019).

- **DIS-ROL-008** As a group admin, I can set when volunteer duties open to members, between 7 and 365 days before the distribution (60 by default). <!-- 03-features/distributions-volunteers.md R29; camap-hx/src/service/VolunteerService.hx:218-224 -->

- **DIS-ROL-009** As a group admin, I can set how long catalog roles stay visible after the catalog ends, between 0 and 255 days (30 by default). <!-- 03-features/distributions-volunteers.md R31; camap-hx/src/service/VolunteerService.hx:386-409,239-244 -->

- **DIS-ROL-010** As a group admin or a coordinator, I can edit or delete only the roles of my group or my catalog. <!-- 03-features/distributions-volunteers.md S3.2, R24; camap-hx/src/controller/ContractAdmin.hx:221-249; camap-hx/src/controller/amapadmin/Volunteers.hx:166 -->
  - A catalog role needs the right to manage its catalog.
  - A group role needs the group admin right, and the role must belong to the current group.
  - The edit keeps the role's scope; it does not turn a catalog role into a group role.
  - **ERRATUM** Today the edit works on any role id with no rights check and forces a group-wide role. Source: `camap-hx/src/controller/ContractAdmin.hx:221-249`, `camap-hx/src/controller/amapadmin/Volunteers.hx:121-170` (CODE-064).
  - **DECISION (UND-065, 2026-11-02)** Refuse, or confirm with a "force" link, before removing registered volunteers; role edit and delete check the rights on the role's catalog or group.

- **DIS-ROL-011** As a group admin, I can open the volunteers settings page with the duty settings and the list of group-wide roles. <!-- 03-features/distributions-volunteers.md S3.3; camap-hx/src/controller/amapadmin/Volunteers.hx:13-84 -->
