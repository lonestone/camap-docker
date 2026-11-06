# Group creation (GRP-CRE)

Actors: superadmin, logged-in user.

- **GRP-CRE-001** As a superadmin, I can create a group by giving its name and the address of its first place. <!-- 03-features/groups-membership.md R4, F6; camap-hx/src/controller/Group.hx:132-187 -->

- **GRP-CRE-002** As a superadmin creating a group, I become a member of it with the group admin, membership, messages and all-catalogs rights. <!-- 03-features/groups-membership.md R4; camap-hx/src/controller/Group.hx:163-170 -->

- **GRP-CRE-003** As a superadmin, a newly created group starts with memberships enabled, registration through a waiting list, and cash and check payments allowed. <!-- 03-features/groups-membership.md R1, R4; camap-hx/src/controller/Group.hx:159-170 -->

- **GRP-CRE-004** As a superadmin, the first place of the new group is located on the map automatically. <!-- 03-features/groups-membership.md R4; camap-hx/src/controller/Group.hx:177; camap-hx/src/service/PlaceService.hx -->

- **GRP-CRE-005** As a superadmin, after creating a group, it becomes my selected group and I land on the home page. <!-- 03-features/groups-membership.md F6; camap-hx/src/controller/Group.hx:132-187 -->

- **GRP-CRE-006** As a logged-in user who is not a superadmin, I cannot create a group. <!-- 03-features/groups-membership.md R4; camap-hx/src/controller/Group.hx:136-139 -->
  - There is no self-service creation: group creation stays reserved to superadmins.
  - **DECISION (UND-024, 2026-11-06)** Group creation stays superadmin-only.

- **GRP-CRE-007** As a visitor who is not logged in, I am asked to log in when I open the group creation page. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/Group.hx:132-136 -->
  - The login check runs before the superadmin check (`@logged` on the page, like `doAmapadmin` in `camap-hx/src/controller/Main.hx:295-296`).
  - **ERRATUM** Today the page is not behind login and dereferences the user, so a visitor triggers an error instead of a login request. Source: `camap-hx/src/controller/Group.hx:132-139` (CODE-025).
  - **DECISION (UND-024, 2026-11-06)** Keep group creation reserved to superadmins and add the login guard before the superadmin test.
