# Public group pages and map (GRP-PUB)

Actors: visitor, logged-in user.

- **GRP-PUB-001** As a visitor, I can open the public page of a group. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/Group.hx:22-76 -->

- **GRP-PUB-002** As a visitor, I can browse a map of groups and a landing page about CSA. <!-- 03-features/groups-membership.md S3.1, S3.2; camap-hx/src/controller/Group.hx:189-202 -->

- **GRP-PUB-003** As a visitor, I can read the public information of a group without logging in. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts:38-50 -->
  - An unknown group gives a "not found" answer.

- **GRP-PUB-004** As a visitor, I see on a group's page whether the group lets me join directly, through a waiting list, or not at all. <!-- 03-features/groups-membership.md R2; camap-hx/src/controller/Group.hx:22-76 -->

- **GRP-PUB-005** As a visitor opening the page of an open group, I can then register or log in and join that group, and browse its shop. <!-- 03-features/groups-membership.md R2, F1; camap-hx/src/controller/Group.hx:29-36 -->
  - The open group is remembered in my visitor session, even before I log in (`camap-hx/src/controller/Group.hx:25-36`). This is intended.
  - Anonymous visitors can browse the shop only when the session group is open (`camap-hx/src/controller/Main.hx:82-84`), and the join step reads the session group and requires it to be open (`camap-hx/src/controller/User.hx:231-239`).
  - **DECISION (UND-026, 2026-11-06)** Keep remembering the open group in the visitor session (option a); it is not passed through a redirect instead.

- **GRP-PUB-006** As a logged-in user, I can list the groups I belong to. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts:53-115 -->

- **GRP-PUB-007** As a visitor, I can see whether a group requires a phone number or an address before registering. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts:128-136 -->
