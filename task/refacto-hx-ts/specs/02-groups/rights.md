# Group rights (GRP-RIG)

Actors: group admin, membership manager, catalog coordinator, messages manager, superadmin.

- **GRP-RIG-001** As a member, I can hold four kinds of rights in a group. <!-- 03-features/users-auth.md R29; camap-hx/src/db/UserGroup.hx:7-12 -->
  - Group admin.
  - Catalog coordinator, for all catalogs or for a chosen list of catalogs.
  - Membership manager.
  - Messages manager.

- **GRP-RIG-002** As a member, a right never grants another one. <!-- 03-features/users-auth.md R29; camap-hx/src/db/UserGroup.hx:151-176 -->
  - A group admin does not automatically manage memberships, messages or catalogs.
  - **ERRATUM** Today, in TS, a coordinator of one catalog is treated as coordinator of all catalogs. Source: `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-105,138-140` (CODE-028).
  - A superadmin is treated as a member of every group. This is intended: see GRP-RIG-004.
  - **DECISION (UND-031, 2026-11-06)** A right never grants another; "all catalogs" means a coordinator right with no catalog list.

- **GRP-RIG-003** As a superadmin, I hold every right in every group. <!-- 03-features/users-auth.md R28-R29; camap-hx/src/db/UserGroup.hx:151-153 -->

- **GRP-RIG-004** As a superadmin, I am treated as a member of any group. <!-- 03-features/users-auth.md R28; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-105; camap-hx/src/db/User.hx:342-344 -->
  - This is the TS behaviour and it becomes the rule in both stacks, so the superadmin also passes member checks everywhere.
  - **ERRATUM** Today Haxe does not treat a superadmin as a member (`isMemberOf` ignores superadmin), and the superadmin test is written in two different ways in TS. Source: `camap-hx/src/db/User.hx:342-344`, `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-105` (CODE-028).
  - **DECISION (UND-031, 2026-11-06)** A superadmin is treated as a member of every group (TS behaviour kept, Haxe aligned).

- **GRP-RIG-005** As a catalog coordinator for all catalogs, I can manage every catalog of the group. <!-- 03-features/users-auth.md R30; camap-hx/src/db/User.hx:191-195; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112-114 -->
  - A coordinator for only some catalogs manages those catalogs only.
  - "All catalogs" means a coordinator right with no catalog list (Haxe semantics).
  - **ERRATUM** Today TS treats any catalog-coordinator right, including a right limited to some catalogs, as "all catalogs". Source: `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112-114`, `camap-hx/src/db/UserGroup.hx:151-168` (CODE-028).
  - **DECISION (UND-031, 2026-11-06)** Keep the Haxe meaning for catalogs: no-list coordinator right = all catalogs, listed catalogs only otherwise.

- **GRP-RIG-006** As a vendor who claimed my vendor record, I automatically manage the catalogs of that vendor. <!-- 03-features/users-auth.md R25-R30; camap-hx/src/db/UserGroup.hx:72-79; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:139-140 -->
  - These automatic rights are shown read-only in the rights editor.
  - The automatic right is given per claimed catalog.
  - **ERRATUM** Today TS applies the vendor automatic rights only when the vendor manages a single catalog. Source: `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:139-140`, `camap-hx/src/db/UserGroup.hx:72-79` (CODE-028).
  - **DECISION (UND-031, 2026-11-06)** Keep the Haxe meaning: vendor automatic rights are per claimed catalog.

- **GRP-RIG-007** As a group admin, I can see the list of members holding rights. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/AmapAdmin.hx:83-90 -->

- **GRP-RIG-008** As a group admin, I can give or remove rights to a member of my group. <!-- 03-features/groups-membership.md R9; camap-hx/src/controller/AmapAdmin.hx:93-199 -->
  - I can pick group admin, membership, messages, all catalogs, or each active catalog.
  - Saving replaces the full list of rights of that member.
  - A rights update is atomic: the non-member and self-lockout checks run first, then all rights are saved in one transaction (see GRP-RIG-009, GRP-RIG-010).
  - **ERRATUM** Today the rights are saved before the check that stops me from removing my own admin right. Source: `camap-hx/src/controller/AmapAdmin.hx:155-158,174-179` (CODE-029).
  - **DECISION (UND-030, 2026-11-06)** Validate first, then save in one transaction.

- **GRP-RIG-009** As a group admin, I cannot remove my own group admin right. <!-- 03-features/users-auth.md R31; camap-hx/src/controller/AmapAdmin.hx:174-179 -->
  - The refusal leaves my rights unchanged.
  - The self-lockout test runs before anything is saved, in the same transaction as the rights update.
  - **ERRATUM** Today the test runs after each right was already saved. Source: `camap-hx/src/controller/AmapAdmin.hx:155-158,174-179` (CODE-029).
  - **DECISION (UND-030, 2026-11-06)** Run the self-lockout test before any write, in one transaction.

- **GRP-RIG-010** As a group admin, choosing a person who is not a member of my group gives a clear error in the rights editor. <!-- 03-features/groups-membership.md R9; camap-hx/src/controller/AmapAdmin.hx:155-158 -->
  - The error is raised before anything is saved.
  - **ERRATUM** Today the create path crashes on a non-member user, while the edit path already refuses with "no user". Source: `camap-hx/src/controller/AmapAdmin.hx:108-114,155-158` (CODE-029).
  - **DECISION (UND-030, 2026-11-06)** Reject a non-member user before any write.

- **GRP-RIG-011** As a group manager, I am anyone who is superadmin or group admin of the current group. <!-- 03-features/users-auth.md R30; camap-hx/src/db/User.hx:120-134 -->
  - Pages of group administration are open to group managers only.

- **GRP-RIG-012** As a membership manager, I can manage members, memberships and the waiting list of the group. <!-- 03-features/users-auth.md R32; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:120-126,160-171 -->

- **GRP-RIG-013** As a group admin, I can read and edit the group data and image. <!-- 03-features/users-auth.md R32; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:200-209 -->
