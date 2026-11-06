# Disabled groups (GRP-DSB)

Actors: member, visitor, the system, superadmin.

- **GRP-DSB-001** As a member of a disabled group, I am sent to a notice page instead of the group home. <!-- 03-features/groups-membership.md R5; camap-hx/src/controller/Main.hx:84-86 -->

- **GRP-DSB-002** As a visitor opening the public page of a disabled group, I see the notice page. <!-- 03-features/groups-membership.md R5; camap-hx/src/controller/Group.hx:25-27 -->

- **GRP-DSB-003** As a member, the notice tells me why the group is disabled. <!-- 03-features/groups-membership.md R5; camap-ts/packages/front-core/src/modules/groupDisabled/GroupDisabled.module.tsx:22-34 -->
  - Reasons: blocked by an administrator, moved, suspended.
  - For a moved group, a button leads to the group's new website.

- **GRP-DSB-004** As the system, I skip disabled groups in scheduled jobs. <!-- 03-features/groups-membership.md R5; camap-hx/src/controller/Cron.hx:110,170 -->

- **GRP-DSB-005** As a superadmin, I have no screen or API to disable or re-enable a group: the disabled state and its reason can only be set directly in the database. <!-- 03-features/groups-membership.md R5, S6; camap-ts/packages/api-core/src/migrations/1741445966001-group-disabled.ts:7 -->
  - `Group.disabled` is read by Haxe and TS (disabled groups are redirected and show the notice with the reason) but written by no application code. This is intended for now (`camap-ts/packages/api-core/src/migrations/1741445966001-group-disabled.ts`, CODE-106).
  - **DECISION (UND-025, 2026-11-06)** Keep the current behaviour (option b): a group is disabled in the database only; no screen or mutation is added.
