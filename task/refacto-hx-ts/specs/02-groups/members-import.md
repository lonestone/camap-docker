# Adding members by import (GRP-IMP)

Actors: membership manager, new member. Invitation by email is in 01-accounts/invitations.md.

- **GRP-IMP-001** As a membership manager, I can add people to my group by entering their emails and details. <!-- 03-features/groups-membership.md R3; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:112-263 -->
  - This works whatever the group's join option, including closed groups.

- **GRP-IMP-002** As a membership manager, people with no account get an account created for them. <!-- 03-features/groups-membership.md R3; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:112-263 -->
  - They receive an email with a link to choose their password, valid for 2 weeks.

- **GRP-IMP-003** As a membership manager, people who already have an account are added to the group. <!-- 03-features/groups-membership.md R3; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:112-263 -->
  - They receive an email with a link to the group page.

- **GRP-IMP-004** As a membership manager, I can send invitations by email instead of creating accounts. <!-- 03-features/groups-membership.md R3; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:267-373 -->
  - See ACC-INV-001.

- **GRP-IMP-005** As a membership manager, I cannot import members unless I hold the membership right. <!-- 03-features/groups-membership.md S3.2; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:61-373 -->
