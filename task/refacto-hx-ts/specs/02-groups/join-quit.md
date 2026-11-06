# Joining and quitting a group (GRP-JOI)

Actors: logged-in user, member, visitor holding an email link.

- **GRP-JOI-001** As a logged-in user, I can join a group directly when it is open. <!-- 03-features/groups-membership.md R2; camap-hx/src/controller/User.hx:231-266 -->
  - After joining I land on the home page.

- **GRP-JOI-002** As a group contact, I receive an email when someone who was not previously a member joins my open group. <!-- 03-features/groups-membership.md R2; camap-hx/src/controller/User.hx:231-266 -->

- **GRP-JOI-003** As a logged-in user, I cannot join a closed group by myself. <!-- 03-features/groups-membership.md R2; camap-hx/src/controller/User.hx:238-239 -->
  - Only a manager can add me.
  - **ERRATUM** Today, registering through the API with an invited group id adds me to any group, closed or not, without an invitation check. Source: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104` (CODE-004).
  - **DECISION (UND-006, 2026-11-06)** TS registration joins a closed group only with a valid invitation (see ACC-REG-012).

- **GRP-JOI-004** As a member, I can quit a group from my account page. <!-- 03-features/groups-membership.md R11, F4; camap-ts/packages/front-core/src/modules/users/QuitGroup/QuitGroup.module.tsx -->

- **GRP-JOI-005** As a visitor, I can quit a group from the link in an email footer without logging in. <!-- 03-features/groups-membership.md R11, S3.1; camap-hx/src/controller/User.hx:271-307 -->
  - The link carries a personal key.

- **GRP-JOI-006** As a member, I can quit a group from the link in a group message footer after I log in. <!-- 03-features/groups-membership.md S3.1; camap-hx/src/controller/User.hx:312-349 -->

- **GRP-JOI-007** As a member, I cannot quit a group while my balance in it is negative. <!-- 03-features/groups-membership.md R11; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:130-147 -->

- **GRP-JOI-008** *Undecided (UND-027)*: As a member, I cannot quit a group while I have recent orders in it. <!-- 03-features/groups-membership.md R11; camap-hx/src/controller/User.hx:272-302; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:141-147 -->
  - Recent means an order in an active catalog or in a catalog ended less than one month ago.
  - **SUGGESTION** Use the Haxe rule: refuse when orders exist in active catalogs, or ended less than a month ago, based on distributions. Drop the hard-coded group 16936. Based on: `camap-hx/src/controller/User.hx:272-302` (rule uses active catalogs and their distributions), `camap-ts/packages/api-core/src/payments/services/orders.service.ts:79-95` (TS tests only the order creation date), `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:124-128` (hard-coded id, no explanation; added in an InterAMAP44 merge). Confidence: medium.

- **GRP-JOI-009** As a member who quit, I am no longer a member of the group. <!-- 03-features/groups-membership.md R11; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:94-150 -->
  - If the quit group was my selected group, my selection is cleared.

- **GRP-JOI-010** *Undecided (UND-027)*: As a member of any group, I can quit it whatever its identity. <!-- 03-features/groups-membership.md R11; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:124-128 -->
  - **SUGGESTION** Use the Haxe rule: refuse when orders exist in active catalogs, or ended less than a month ago, based on distributions. Drop the hard-coded group 16936. Based on: `camap-hx/src/controller/User.hx:272-302` (rule uses active catalogs and their distributions), `camap-ts/packages/api-core/src/payments/services/orders.service.ts:79-95` (TS tests only the order creation date), `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:124-128` (hard-coded id, no explanation; added in an InterAMAP44 merge). Confidence: medium.
