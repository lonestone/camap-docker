# Group rights (GRP-RIG)

Actors: group admin, membership manager, catalog coordinator, messages manager, superadmin.

- **GRP-RIG-001** As a member, I can hold four kinds of rights in a group. <!-- 03-features/users-auth.md R29; camap-hx/src/db/UserGroup.hx:7-12 -->
  - Group admin.
  - Catalog coordinator, for all catalogs or for a chosen list of catalogs.
  - Membership manager.
  - Messages manager.

- **GRP-RIG-002** As a member, a right never grants another one. <!-- 03-features/users-auth.md R29; camap-hx/src/db/UserGroup.hx:151-176 -->
  - A group admin does not automatically manage memberships, messages or catalogs.
  - **ERRATUM** In TS, a coordinator of one catalog is treated as coordinator of all catalogs, and a superadmin is treated as a member of every group. Source: `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-105,138-140` (CODE-028).

- **GRP-RIG-003** As a superadmin, I hold every right in every group. <!-- 03-features/users-auth.md R28-R29; camap-hx/src/db/UserGroup.hx:151-153 -->

- **GRP-RIG-004** *Undecided (UND-031)*: As a superadmin, I am treated as a member of any group. <!-- 03-features/users-auth.md R28; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-105; camap-hx/src/db/User.hx:342-344 -->
  - **SUGGESTION** Keep the Haxe semantics: "all catalogs" means a coordinator right with no catalog list; superadmin passes rights checks but is not a group member; vendor auto rights are per claimed catalog. Based on: `camap-hx/src/db/UserGroup.hx:151-168` (null params = all, otherwise listed ids), `camap-hx/src/db/User.hx:342-344` (`isMemberOf` ignores superadmin), `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112-114` (TS treats any catalog right as "all"). Confidence: medium.

- **GRP-RIG-005** *Undecided (UND-031)*: As a catalog coordinator for all catalogs, I can manage every catalog of the group. <!-- 03-features/users-auth.md R30; camap-hx/src/db/User.hx:191-195; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112-114 -->
  - A coordinator for only some catalogs manages those catalogs only.
  - **SUGGESTION** Keep the Haxe semantics: "all catalogs" means a coordinator right with no catalog list; superadmin passes rights checks but is not a group member; vendor auto rights are per claimed catalog. Based on: `camap-hx/src/db/UserGroup.hx:151-168` (null params = all, otherwise listed ids), `camap-hx/src/db/User.hx:342-344` (`isMemberOf` ignores superadmin), `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112-114` (TS treats any catalog right as "all"). Confidence: medium.

- **GRP-RIG-006** *Undecided (UND-031)*: As a vendor who claimed my vendor record, I automatically manage the catalogs of that vendor. <!-- 03-features/users-auth.md R25-R30; camap-hx/src/db/UserGroup.hx:72-79; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:139-140 -->
  - These automatic rights are shown read-only in the rights editor.
  - **SUGGESTION** Keep the Haxe semantics: "all catalogs" means a coordinator right with no catalog list; superadmin passes rights checks but is not a group member; vendor auto rights are per claimed catalog. Based on: `camap-hx/src/db/UserGroup.hx:151-168` (null params = all, otherwise listed ids), `camap-hx/src/db/User.hx:342-344` (`isMemberOf` ignores superadmin), `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112-114` (TS treats any catalog right as "all"). Confidence: medium.

- **GRP-RIG-007** As a group admin, I can see the list of members holding rights. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/AmapAdmin.hx:83-90 -->

- **GRP-RIG-008** As a group admin, I can give or remove rights to a member of my group. <!-- 03-features/groups-membership.md R9; camap-hx/src/controller/AmapAdmin.hx:93-199 -->
  - I can pick group admin, membership, messages, all catalogs, or each active catalog.
  - Saving replaces the full list of rights of that member.
  - **ERRATUM** The rights are saved before the check that stops me from removing my own admin right. Source: `camap-hx/src/controller/AmapAdmin.hx:155-158,174-179` (CODE-029).

- **GRP-RIG-009** *Undecided (UND-030)*: As a group admin, I cannot remove my own group admin right. <!-- 03-features/users-auth.md R31; camap-hx/src/controller/AmapAdmin.hx:174-179 -->
  - The refusal leaves my rights unchanged.
  - **SUGGESTION** Validate before saving: reject a non-member user and run the self-lockout test before any write, in one transaction. Based on: `camap-hx/src/controller/AmapAdmin.hx:108-114` (edit path already rejects a non-member with "no user"), `camap-hx/src/controller/AmapAdmin.hx:155-179` (create path crashes on null, lockout test after saving). Confidence: high.

- **GRP-RIG-010** *Undecided (UND-030)*: As a group admin, choosing a person who is not a member of my group gives a clear error in the rights editor. <!-- 03-features/groups-membership.md R9; camap-hx/src/controller/AmapAdmin.hx:155-158 -->
  - **SUGGESTION** Validate before saving: reject a non-member user and run the self-lockout test before any write, in one transaction. Based on: `camap-hx/src/controller/AmapAdmin.hx:108-114` (edit path already rejects a non-member with "no user"), `camap-hx/src/controller/AmapAdmin.hx:155-179` (create path crashes on null, lockout test after saving). Confidence: high.

- **GRP-RIG-011** As a group manager, I am anyone who is superadmin or group admin of the current group. <!-- 03-features/users-auth.md R30; camap-hx/src/db/User.hx:120-134 -->
  - Pages of group administration are open to group managers only.

- **GRP-RIG-012** As a membership manager, I can manage members, memberships and the waiting list of the group. <!-- 03-features/users-auth.md R32; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:120-126,160-171 -->

- **GRP-RIG-013** As a group admin, I can read and edit the group data and image. <!-- 03-features/users-auth.md R32; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:200-209 -->
