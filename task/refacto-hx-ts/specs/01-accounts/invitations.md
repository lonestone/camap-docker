# Invitations (ACC-INV)

Actors: membership manager, visitor, logged-in user. Bulk member import and creation is in 02-groups/members-import.md.

- **ACC-INV-001** As a membership manager, I can invite people to my group by email. <!-- 03-features/groups-membership.md R3; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:267-373 -->
  - Each invited person receives an email with a personal invitation link.
  - Inviting does not create the account.

- **ACC-INV-002** As a visitor opening my invitation link, I see the registration form prefilled with the data the manager entered. <!-- 03-features/users-auth.md S3.2; camap-ts/packages/api-core/src/users/users.resolver.ts:129-140 -->
  - Name, phone and address are prefilled.
  - The prefilled data is kept for 2 weeks.

- **ACC-INV-003** As a visitor, an invitation link with a wrong or altered key is refused. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Main.hx:308-324 -->
  - **ERRATUM** Only the email part of the link is protected by the key; the group and user parts can be changed freely. Source: `camap-hx/src/controller/Main.hx:308-318` (CODE-003).

- **ACC-INV-004** *Undecided (UND-006)*: As an invited visitor, I join the group that invited me when I register from my invitation link. <!-- 03-features/groups-membership.md R2, F3; camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104 -->
  - **SUGGESTION** Join the group only when it is open or when a valid invitation exists for this email. Check `regOption` like the Haxe join, and look up the invitation cache entry for the email. Based on: `camap-hx/src/controller/User.hx:238-239` (join refuses a non-open group), `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:201` (TS already tests `RegOption.Open`), `camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104` (no check today). Confidence: high.

- **ACC-INV-005** *Undecided (UND-018)*: As an existing user opening an invitation link addressed to me, I join the group that invited me. <!-- 03-features/groups-membership.md R2, F3; camap-hx/src/controller/Main.hx:308-324 -->
  - The link identifies the invited user and the group.
  - **SUGGESTION** Sign all link parameters. Make the hash cover email, group id and user id, like the quit-group key. Reject the link on mismatch, and set the session group only after validation. Based on: `camap-hx/src/controller/User.hx:272-273` (key is `sha1(KEY+group+user)`), `camap-ts/packages/api-core/src/common/utils.ts:63-75` (`isControlKeyValid`), `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:348-351` (TS builds the link, can sign it), `camap-hx/src/controller/Main.hx:308-314` (hash covers email only). Confidence: high.

- **ACC-INV-006** *Undecided (UND-017)*: As a visitor, I can look up the invitation data only for my own invitation. <!-- 03-features/users-auth.md S3.2; camap-ts/packages/api-core/src/users/users.resolver.ts:129-140 -->
  - **SUGGESTION** Restrict reads. Drop `user(id)`, which has no front caller. Limit `getUsersFromEmails` to group managers with a group id. Make `getInvitedUserToRegister` take the invitation hash from the link, not the email. Based on: `camap-ts/packages/api-core/src/users/users.resolver.ts:99-112` (`getEmailRecipientsByUserIds` checks `canManageMessages`), `camap-ts/packages/front-core/src/modules/members/containers/ImportOneMember.tsx:242` (only manager caller), `camap-ts/packages/api-core/src/users/users.resolver.ts:129-140` (public lookup by email). Confidence: medium.
