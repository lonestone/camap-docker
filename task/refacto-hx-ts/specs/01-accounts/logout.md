# Logout (ACC-OUT)

Actors: logged-in user.

- **ACC-OUT-001** As a logged-in user, I can log out. <!-- 03-features/users-auth.md R12; camap-hx/src/controller/User.hx:82-96; camap-ts/packages/api-core/src/auth/auth.resolver.ts:109-124 -->
  - My session ends on the whole site.
  - I am sent back to the login page.

- **ACC-OUT-002** As a logged-in user, after logout I can no longer be recognised from my previous login cookies. <!-- 03-features/users-auth.md R12; camap-ts/packages/api-core/src/auth/auth.service.ts:175-203 -->
  - My renewal token is invalidated.
  - All three login cookies are removed from my browser.

- **ACC-OUT-003** *Undecided (UND-019)*: As a logged-in user, logging out removes my login cookies whichever application handles the logout. <!-- 03-features/users-auth.md R12, R33; camap-hx/src/controller/User.hx:84-88; camap-ts/packages/api-core/src/auth/auth.service.ts:348-357 -->
  - **SUGGESTION** Use one shared rule in TS: cookie domain is the host without scheme and without a leading `app.`. Make logout a single step that clears all three cookies, as TS already does. Based on: `camap-hx/src/controller/User.hx:84-88` (strips `app.`), `camap-ts/packages/api-core/src/auth/auth.service.ts:183-188,348-357` (one response with three cookies; strips only `https://`). Confidence: medium.
