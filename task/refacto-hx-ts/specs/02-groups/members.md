# Members list and member sheet (GRP-MEM)

Actors: membership manager, group admin.

- **GRP-MEM-001** As a membership manager, I can open the members page of my group. <!-- 03-features/groups-membership.md R10, S3.1; camap-hx/src/controller/Member.hx:23-36 -->
  - A superadmin can open it too.
  - A group admin without the membership right cannot.

- **GRP-MEM-002** As a membership manager, I can see the lists of members of my group, and only of a group where I hold the membership right. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts:23-253 -->
  - Lists exist for the whole group, by catalog, by distribution, and with or without a valid membership.
  - The membership lists are empty when the group has no memberships.
  - Group admins and superadmins can also see them; any other user is refused, even when logged in.
  - **ERRATUM** Today `getUserLists`, `getContractsUserLists` and `getDistributionsUserLists` only require a login, so any logged-in user can read another group's lists. Source: `camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts` (CODE-006).
  - **DECISION (UND-029, 2026-11-06)** Require the membership right (or group admin, or superadmin) on the requested group for all member and waiting lists.

- **GRP-MEM-003** As a membership manager, I can open the sheet of a member. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/Member.hx:38-83 -->
  - The sheet shows the member's orders, subscriptions and notification settings.
  - The sheet offers the payments page, moving the member to the waiting list, logging in as the member, and the membership dialog.

- **GRP-MEM-004** As a membership manager, I can see a preview of my group's members. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:44-59 -->

- **GRP-MEM-005** As a membership manager, I can remove members from my group. <!-- 03-features/groups-membership.md R12; camap-hx/src/controller/Member.hx:116-135; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:61-108 -->
  - I cannot remove myself.
  - I cannot remove a group admin.
  - Removing a member deletes their membership of the group.
  - **ERRATUM** In the TS member list, removing several members at once can skip or fail on some of them, and TS does not check orders or balance as Haxe does. Source: `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:85-104, camap-hx/src/controller/Member.hx:121-124` (CODE-055).

- **GRP-MEM-006** *Undecided (UND-028)*: As a membership manager, I must confirm before removing a member who has orders in the group. <!-- 03-features/groups-membership.md R12; camap-hx/src/controller/Member.hx:116-135 -->
  - **SUGGESTION** Apply the Haxe confirmation in TS: ask for confirmation when the member has orders, and run a per-user loop (no splice) in batch removal. Based on: `camap-hx/src/controller/Member.hx:116-135` (token, own-account check, confirmation when quantity>0), `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:85-104` (no order check; splice misaligns users and flags). Confidence: medium.

- **GRP-MEM-007** *Undecided (UND-028)*: As a membership manager, I can remove several members at once and each one is handled correctly. <!-- 03-features/groups-membership.md R12; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:85-104 -->
  - A user who is not in the group is reported in the result.
  - **SUGGESTION** Apply the Haxe confirmation in TS: ask for confirmation when the member has orders, and run a per-user loop (no splice) in batch removal. Based on: `camap-hx/src/controller/Member.hx:116-135` (token, own-account check, confirmation when quantity>0), `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:85-104` (no order check; splice misaligns users and flags). Confidence: medium.

- **GRP-MEM-008** As a membership manager, a removal request is refused unless it carries a valid security token. <!-- 03-features/groups-membership.md R12, S3.1; camap-hx/src/controller/Member.hx:116-135 -->

- **GRP-MEM-009** As a group admin, a coordinator or a membership manager, I can read the data of a member in my group. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/userGroups.resolver.ts:29-45 -->

- **GRP-MEM-010** As a membership manager, I can tell which members are new, meaning they have never logged in. <!-- 03-features/users-auth.md R9; 03-features/inconsistencies-code.md CODE-101; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:177-200 -->
  - A member is new while their last-login date is empty (see ACC-LOG-006).
  - **ERRATUM** Today Haxe treats an empty password as new, so members created by TS are never new for Haxe; nothing in Haxe writes the last-login date. Source: `camap-hx/src/db/User.hx:495-505` (CODE-101).
  - **DECISION (UND-036, 2026-11-06)** A new member is one who never logged in (empty last-login date).
