# Disabled groups (GRP-DSB)

Actors: member, visitor, the system, superadmin.

- **GRP-DSB-001** As a member of a disabled group, I am sent to a notice page instead of the group home. <!-- 03-features/groups-membership.md R5; camap-hx/src/controller/Main.hx:84-86 -->

- **GRP-DSB-002** As a visitor opening the public page of a disabled group, I see the notice page. <!-- 03-features/groups-membership.md R5; camap-hx/src/controller/Group.hx:25-27 -->

- **GRP-DSB-003** As a member, the notice tells me why the group is disabled. <!-- 03-features/groups-membership.md R5; camap-ts/packages/front-core/src/modules/groupDisabled/GroupDisabled.module.tsx:22-34 -->
  - Reasons: blocked by an administrator, moved, suspended.
  - For a moved group, a button leads to the group's new website.

- **GRP-DSB-004** As the system, I skip disabled groups in scheduled jobs. <!-- 03-features/groups-membership.md R5; camap-hx/src/controller/Cron.hx:110,170 -->

- **GRP-DSB-005** *Undecided (UND-025)*: As a superadmin, I can disable or re-enable a group and choose the reason. <!-- 03-features/groups-membership.md R5, S6; camap-ts/packages/api-core/src/migrations/1741445966001-group-disabled.ts:7 -->
  - **SUGGESTION** Add a superadmin-only mutation to set or clear the disabled reason (blocked by admin, moved, suspended). Based on: `camap-ts/packages/front-core/src/modules/groupDisabled/GroupDisabled.module.tsx:22-34` (notice already shows these reasons), `camap-hx/src/controller/Main.hx:84-86` (disabled groups are redirected), `camap-hx/src/controller/Group.hx:25-27` (public page redirects); no code writes the field. Confidence: medium.
