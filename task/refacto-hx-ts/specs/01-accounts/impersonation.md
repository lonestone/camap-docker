# Log in as a member (ACC-IMP)

Actors: superadmin, group admin.

- **ACC-IMP-001** As a superadmin, I can log in as any member from the member sheet. <!-- 03-features/users-auth.md R15; camap-hx/src/controller/Member.hx:89-103 -->
  - My session switches to that member.
  - The selected group is cleared, then I land on the home page.

- **ACC-IMP-002** As a group admin, I can log in as a member who is not a superadmin and belongs to at most one group. <!-- 03-features/users-auth.md R15; camap-hx/src/controller/Member.hx:92-96 -->
  - **ERRATUM** Today any logged-in user can do this through the API: the group-admin check is not awaited and tests the target user instead of me. Source: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:137-140` (CODE-002).

- **ACC-IMP-003** As a group admin, I see the "log in as" button on the sheet of a member who belongs to exactly one group. <!-- 03-features/users-auth.md R15; camap-hx/src/controller/Member.hx:49 -->
  - A superadmin sees the button on every member sheet.

- **ACC-IMP-004** *Undecided (UND-010)*: As a logged-in user who is neither superadmin nor group admin, I cannot log in as another user. <!-- 03-features/users-auth.md R15; camap-ts/packages/api-core/src/auth/auth.resolver.ts:126-152 -->
  - **SUGGESTION** Keep the Haxe rule, awaited. Superadmin, or group manager of the group when the target is not a superadmin, is a member of that group, and belongs to only one group. Await the group-admin check on the current user. Based on: `camap-hx/src/controller/Member.hx:90-95` (Haxe rule), `camap-hx/src/controller/Member.hx:43-49` (member of the group required in the view), `camap-ts/packages/api-core/src/auth/auth.resolver.ts:137-146` (check not awaited, uses the target). Confidence: high.
