# Waiting list (GRP-WAI)

Actors: logged-in user, membership manager.

- **GRP-WAI-001** As a logged-in user, I can ask to join a group that works with a waiting list. <!-- 03-features/groups-membership.md R2, S3.1; camap-hx/src/controller/Group.hx:82-115 -->
  - I must be logged in.
  - The group must use the waiting-list option.

- **GRP-WAI-002** As a membership manager or group admin, I receive an email when someone joins the waiting list. <!-- 03-features/groups-membership.md R2; camap-hx/src/service/WaitingListService.hx:10-41 -->

- **GRP-WAI-003** As a logged-in user, I can leave the waiting list of a group. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/Group.hx:120-127 -->

- **GRP-WAI-004** As a membership manager, I can see the waiting list of my group, and only of a group where I hold the membership right. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:40-45 -->
  - Group admins and superadmins can also see it; any other user is refused, even when logged in.
  - **ERRATUM** Today `getWaitingListsOfGroup` only requires a login. Source: `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:40-45` (CODE-006).
  - **DECISION (UND-029, 2026-11-06)** Require the membership right (or group admin, or superadmin) on the requested group for all member and waiting lists.

- **GRP-WAI-005** As a membership manager, I can approve a waiting-list request. <!-- 03-features/groups-membership.md R2; camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:113-221 -->
  - The person becomes a member.
  - The request disappears from the waiting list.
  - The person and the other membership managers receive an email.

- **GRP-WAI-006** As a membership manager, I can refuse a waiting-list request. <!-- 03-features/groups-membership.md R2; camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:113-221 -->
  - The person receives an email.

- **GRP-WAI-007** As a membership manager, I can move a member back to the waiting list. <!-- 03-features/groups-membership.md R12, S3.1; camap-hx/src/service/WaitingListService.hx:75-93 -->
  - A person already on the waiting list is refused, in Haxe and in TS, and is not added twice.
  - The action needs a security token and the membership right, in both stacks.
  - The Haxe self and admin checks stay (see GRP-WAI-011), and a batch is handled without the splice-in-loop misalignment.
  - **ERRATUM** Today TS does not reject people already on the waiting list and misaligns a batch (splice inside the loop); the Haxe action has no security token and no explicit rights check. Source: `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:59-83`, `camap-hx/src/controller/Member.hx:213-223` (CODE-025, CODE-055).
  - **DECISION (UND-034, 2026-11-06)** Reject users already on the waiting list, require the membership right (and the security token), keep the Haxe self and admin checks, and remove the splice-in-loop.

- **GRP-WAI-008** As a membership manager, I cannot approve, refuse or move requests without the membership right. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:47-221 -->

- **GRP-WAI-009** As a logged-in user, I cannot join the waiting list of a group I already belong to, nor twice. <!-- 03-features/distributions-volunteers.md R43; camap-hx/src/service/WaitingListService.hx:43-52 -->

- **GRP-WAI-010** As a logged-in user, I can leave the waiting list only when I am on it. <!-- 03-features/distributions-volunteers.md R44; camap-hx/src/service/WaitingListService.hx:57-69 -->

- **GRP-WAI-011** As a membership manager, I cannot move myself or a group admin back to the waiting list. <!-- 03-features/distributions-volunteers.md R45-R46; camap-hx/src/service/WaitingListService.hx:75-93 -->
  - The person must be a member of the group.
  - The waiting-list entry carries the message "Remis en liste d'attente par" and my name.
  - **ERRATUM** Today the Haxe move-back action has no security token and no explicit membership-right check. Source: `camap-hx/src/controller/Member.hx:118-120` (CODE-025).
  - **DECISION (UND-034, 2026-11-06)** The Haxe move-back action gets the security token and the membership-right check (see GRP-WAI-007).

- **GRP-WAI-012** As a membership manager, approving a request creates the membership only if the person is not yet a member. <!-- 03-features/distributions-volunteers.md R47; camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:113-221 -->

- **GRP-WAI-013** As a membership manager, I see the waiting list as a member list type of the members page. <!-- 03-features/distributions-volunteers.md R48; camap-ts/packages/front-core/src/modules/members/containers/MembersTableAndActions.tsx:193-200 -->
