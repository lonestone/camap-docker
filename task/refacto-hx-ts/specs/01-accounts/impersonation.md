# Log in as a member (ACC-IMP)

Actors: superadmin, group admin.

- **ACC-IMP-001** As a superadmin, I can log in as any member from the member sheet. <!-- 03-features/users-auth.md R15; camap-hx/src/controller/Member.hx:89-103 -->
  - My session switches to that member.
  - The selected group is cleared, then I land on the home page.

- **ACC-IMP-002** As a group admin, I can log in as a member who is not a superadmin and belongs to at most one group. <!-- 03-features/users-auth.md R15; camap-hx/src/controller/Member.hx:92-96 -->
  - **ERRATUM** Today any logged-in user can do this through the API: the group-admin check is not awaited and tests the target user instead of me. Source: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:137-140` (CODE-002).
  - **DECISION (UND-010, 2026-11-06)** The Haxe rule is kept; TS is aligned on it (see ACC-IMP-004).

- **ACC-IMP-003** As a group admin, I see the "log in as" button on the sheet of a member who belongs to exactly one group. <!-- 03-features/users-auth.md R15; camap-hx/src/controller/Member.hx:49 -->
  - A superadmin sees the button on every member sheet.

- **ACC-IMP-004** As a logged-in user who is neither superadmin nor group manager of the target's group, I cannot log in as another user. <!-- 03-features/users-auth.md R15; camap-ts/packages/api-core/src/auth/auth.resolver.ts:126-152 -->
  - The Haxe rule applies in TS and the group-manager check is awaited on the current user: superadmin, or group manager of the group when the target is not a superadmin, is a member of that group, and belongs to only one group.
  - **DECISION (UND-010, 2026-11-06)** Keep the Haxe rule (option a), awaited, in the TS API.
