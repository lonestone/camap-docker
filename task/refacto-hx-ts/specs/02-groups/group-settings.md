# Group settings (GRP-SET)

Actors: group admin.

- **GRP-SET-001** As a group admin, I can open the group administration dashboard. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/AmapAdmin.hx:74-81 -->
  - Members without the group admin right are sent back to the home page.

- **GRP-SET-002** As a group admin, I can edit the name, contact, texts, external website and legal representative of my group. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/Amap.hx:35-79 -->

- **GRP-SET-003** As a group admin, I can choose how new members join my group. <!-- 03-features/groups-membership.md R2, S2; camap-hx/src/controller/Amap.hx:35-79 -->
  - Closed: only managers add members.
  - Waiting list: people request to join and a manager approves.
  - Open: anyone joins directly.

- **GRP-SET-004** *Undecided (UND-023)*: As a group admin, I can mark my group as full. <!-- 03-features/groups-membership.md R1; camap-hx/src/App.hx:304 -->
  - A full group behaves like a closed group for new joiners.
  - **SUGGESTION** Keep `Full` as a closed state with a notice: the public page says the group is full, with no join and no waiting-list request. Based on: `camap-hx/lang/master/tpl/group/view.mtt:462` (public page shows the "group is full" message), `camap-hx/src/App.hx:304` (label "Complet : n'accepte plus de nouveaux membres"), `camap-hx/src/controller/Group.hx:89` (waiting-list request only for WaitingList). Confidence: high.

- **GRP-SET-005** As a group admin, I can switch three options of my group. <!-- 03-features/groups-membership.md R6; camap-hx/src/controller/Amap.hx:44-73 -->
  - Hide phone numbers.
  - Require a phone number from members.
  - Require an address from members.

- **GRP-SET-006** As a visitor registering to a group that requires a phone number or an address, the registration form asks for them. <!-- 03-features/groups-membership.md R6; camap-hx/src/service/UserService.hx:61-74 -->
  - The login form shows the same requirement.

- **GRP-SET-007** As a group admin, I can set the image of my group. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:152-195 -->

- **GRP-SET-008** As a group admin, I can read the data of my group. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:43-55,200-209 -->

- **GRP-SET-009** As a group admin, I can reach the settings of VAT rates, currency, payment types, volunteers, documents and media from the dashboard. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/AmapAdmin.hx:201-340 -->
  - Each setting is described in its own domain.

- **GRP-SET-010** As a member, I can see the list of my group's current and ended catalogs on the group page. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/Amap.hx:18-33 -->

- **GRP-SET-011** As a group admin, I can edit membership settings from the dashboard. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/AmapAdmin.hx:39-72 -->
  - See 02-groups/membership.md.
