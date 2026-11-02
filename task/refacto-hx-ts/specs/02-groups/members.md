# Members list and member sheet (GRP-MEM)

Actors: membership manager, group admin.

- **GRP-MEM-001** As a membership manager, I can open the members page of my group. <!-- 03-features/groups-membership.md R10, S3.1; camap-hx/src/controller/Member.hx:23-36 -->
  - A superadmin can open it too.
  - A group admin without the membership right cannot.

- **GRP-MEM-002** *Undecided (UND-029)*: As a membership manager, I can see the lists of members of my group. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts:23-253 -->
  - Lists exist for the whole group, by catalog, by distribution, and with or without a valid membership.
  - The membership lists are empty when the group has no memberships.
  - **SUGGESTION** Require the membership right (or group admin, or superadmin) on the requested group for all member and waiting lists. Mirrors `userIsAllowedToManageMembers`. Based on: `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:378-391` (rights check on members mutations), `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:62-67` (same check in `moveBackToWaitingList`), while `waitingLists.resolver.ts:40-45` has none. Confidence: high.

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

- **GRP-MEM-010** *Undecided (UND-036)*: As a membership manager, I can tell which members have never logged in. <!-- 03-features/users-auth.md R9; 03-features/inconsistencies-code.md CODE-101; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:177-200 -->
  - **SUGGESTION** Define a new member as one who never logged in (empty last-login date). Based on: `camap-hx/lang/master/tpl/member/view.mtt:78-83` (Haxe UI shows "never logged in" from `ldate`), `camap-ts/packages/api-core/src/auth/auth.service.ts:64-68` (TS login writes `ldate`), `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:177-200` (TS list uses `ldate` null). Confidence: high.
