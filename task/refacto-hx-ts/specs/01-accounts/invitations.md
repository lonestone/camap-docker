# Invitations (ACC-INV)

Actors: membership manager, visitor, logged-in user. Bulk member import and creation is in 02-groups/members-import.md.

- **ACC-INV-001** As a membership manager, I can invite people to my group by email. <!-- 03-features/groups-membership.md R3; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:267-373 -->
  - Each invited person receives an email with a personal invitation link.
  - Inviting does not create the account.

- **ACC-INV-002** As a visitor opening my invitation link, I see the registration form prefilled with the data the manager entered. <!-- 03-features/users-auth.md S3.2; camap-ts/packages/api-core/src/users/users.resolver.ts:129-140 -->
  - Name, phone and address are prefilled.
  - The prefilled data is kept for 2 weeks.

- **ACC-INV-003** As a visitor, an invitation link with a wrong or altered key is refused. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Main.hx:308-324 -->
  - Only the email part of the link is protected by the key; the group and user parts are not signed. This is intended: see ACC-INV-005. Source: `camap-hx/src/controller/Main.hx:308-318` (CODE-003).
  - **DECISION (UND-018, 2026-11-06)** Keep the current behaviour for the signed part of the link.

- **ACC-INV-004** As an invited visitor, I join the group that invited me when I register from my invitation link, provided a valid invitation exists for my email or the group is open. <!-- 03-features/groups-membership.md R2, F3; camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104 -->
  - The registration checks the group's registration option, like the Haxe join, and looks up the invitation cache entry for the email.
  - **ERRATUM** Today TS registration adds the user to the group given as `invitedGroupId` with no registration-option or invitation check. Source: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104` (CODE-004).
  - **DECISION (UND-006, 2026-11-06)** Join the group at registration only when it is open or when a valid invitation exists for this email.

- **ACC-INV-005** As an existing user opening an invitation link addressed to me, I join the group named in the link, provided the key matches the email. <!-- 03-features/groups-membership.md R2, F3; camap-hx/src/controller/Main.hx:308-324 -->
  - The link identifies the invited user and the group.
  - The key covers the email only (`sha1(KEY + email)`); the group and user parts of the link are not signed. This is intended.
  - The session group is set before the key is validated.
  - **DECISION (UND-018, 2026-11-06)** Keep the current behaviour: the invitation key covers the email only (option b).

- **ACC-INV-006** As a visitor, I can look up the invitation data only for my own invitation, with the invitation hash from my link. <!-- 03-features/users-auth.md S3.2; camap-ts/packages/api-core/src/users/users.resolver.ts:129-140 -->
  - `getInvitedUserToRegister` takes the invitation hash from the link, not the email.
  - `getUsersFromEmails` is limited to group managers and needs a group id.
  - The single-user query `user(id)`, which no front component calls, is removed.
  - **ERRATUM** Today `user(id)` and `getUsersFromEmails` need only a login, and `getInvitedUserToRegister(email)` is public and returns the name, phone and address stored in the cache for any email. Source: `camap-ts/packages/api-core/src/users/users.resolver.ts:62-66,121-140` (CODE-006).
  - **DECISION (UND-017, 2026-11-06)** Restrict user reads to group managers, drop the unused `user(id)` query, and look up an invitation by its hash.
