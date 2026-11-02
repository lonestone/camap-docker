# Volunteer reminder emails (DIS-VRM)

Actors: the system, volunteer, member.

- **DIS-VRM-001** As a volunteer, I receive an instruction email a few days before the distribution I volunteer for. <!-- 03-features/distributions-volunteers.md R34; camap-hx/src/controller/Cron.hx:96-153 -->
  - The delay is set by the group admin, between 2 and 15 days (4 by default).
  - It is sent to the primary and secondary emails of volunteers.
  - It is sent only if the group allows information notifications and at least one volunteer is registered.
  - The text is the group's message with the date, place and list of volunteers filled in.

- **DIS-VRM-002** As a member, I receive an alert email when a distribution still has vacant volunteer roles. <!-- 03-features/distributions-volunteers.md R34; camap-hx/src/controller/Cron.hx:156-205 -->
  - The delay is set by the group admin, between 2 and 15 days before (7 by default).
  - It is sent to all members of the group.
  - It is sent only if the group allows alert notifications and roles are vacant.
  - The text lists the date, place and the missing roles.

- **DIS-VRM-003** As the system, I skip disabled groups when sending volunteer emails. <!-- 03-features/distributions-volunteers.md R34; camap-hx/src/controller/Cron.hx:110,170 -->

- **DIS-VRM-004** As the system, I run these checks every hour for the sessions starting in the targeted hour. <!-- 03-features/distributions-volunteers.md R34; camap-ts/packages/api-core/src/tools/crontab.service.ts:29-36 -->

- **DIS-VRM-005** As a group admin, I can edit the text of the instruction and alert emails. <!-- 03-features/distributions-volunteers.md R34; camap-hx/src/controller/amapadmin/Volunteers.hx:35-46 -->
