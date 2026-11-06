# Login (ACC-LOG)

Actors: visitor, logged-in user.

- **ACC-LOG-001** As a visitor, I can log in with my email and my password. <!-- 03-features/users-auth.md R9; camap-ts/packages/api-core/src/auth/auth.service.ts:40-81 -->
  - My email and password are both required.
  - I land on the page I wanted to reach, or on the home page.
  - **ERRATUM** Today login only works if the Haxe app has already created a session for my browser. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:70-74` (CODE-105).
  - **DECISION (UND-021, 2026-11-06)** Login no longer depends on a session created by Haxe (see ACC-LOG-012).

- **ACC-LOG-002** As a visitor, I can log in with the secondary email of my household as well as the primary one. <!-- 03-features/users-auth.md R3; camap-ts/packages/api-core/src/users/users.service.ts:94-103 -->

- **ACC-LOG-003** As a visitor who registered before the password system changed, I can log in with my existing password. <!-- 03-features/users-auth.md R8; camap-ts/packages/api-core/src/auth/auth.service.ts:319-346 -->
  - The system upgrades my stored password silently at first login.
  - **ERRATUM** Today, after a password reset made in the Haxe pages, my old password keeps working until I log in once with the new one. Source: `camap-hx/src/db/User.hx:274-281, camap-ts/packages/api-core/src/auth/auth.service.ts:320-345` (CODE-005).
  - **DECISION (UND-007, 2026-11-06)** A reset clears `pass2`, so the old password stops working immediately (see ACC-PWD-009).

- **ACC-LOG-004** As a visitor, I see an error if my email or password is wrong. <!-- 03-features/users-auth.md F5.2; camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:65-68 -->

- **ACC-LOG-005** As a visitor, I am blocked for 10 minutes after 5 failed logins from the same IP address, whatever client I use. <!-- 03-features/users-auth.md R10; camap-ts/packages/api-core/src/auth/auth.service.ts:50-56,280-309 -->
  - The ban can be disabled by configuration.
  - The server counts each failed login itself, inside `login`, and the counter is committed outside the failing transaction so the error does not roll it back.
  - The client IP is read from the `X-Real-Ip` header in lower case, as Node delivers it.
  - **ERRATUM** Today the failed-login counter is incremented only by a separate mutation called by the React login box after a wrong-password error; `login` itself never counts, and the IP header is read with a case that never matches. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:50-56,280-309`, `camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:65-68`, `camap-ts/packages/api-core/src/common/decorators/user-ip.decorator.ts:8` (CODE-023).
  - **DECISION (UND-008, 2026-11-06)** Count failures inside login, committed outside the rolled-back transaction, and read the IP header in lower case.

- **ACC-LOG-006** As a user, the system records the date of my last login. <!-- 03-features/users-auth.md R9; camap-ts/packages/api-core/src/auth/auth.service.ts:40-81 -->
  - A user who never logged in has no last-login date.

- **ACC-LOG-007** As a logged-in user, I stay logged in without retyping my password while my session renews itself. <!-- 03-features/users-auth.md R11, R17; camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:160-228 -->
  - When my short-lived token has expired, a valid long-lived token silently gives me a new one.
  - When neither is valid, I am treated as logged out.

- **ACC-LOG-008** As a logged-in user already on the login page, I am sent to the home page. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/User.hx:24-49 -->

- **ACC-LOG-009** As a logged-in user, I am logged out and sent back to the login page if my two session cookies disagree. <!-- 03-features/users-auth.md R17, F5.2 step 5; camap-hx/src/controller/User.hx:32-37 -->

- **ACC-LOG-010** As a user, no language preference is applied when I log in: the interface is in French only. <!-- 03-features/users-auth.md R16; camap-ts/packages/api-core/src/auth/auth.service.ts:77 -->
  - Login does not copy a user language into the session, because only French is configured (`camap-hx/config.xml.dist:3`, see UND-118).
  - **ERRATUM** Today TS login does not copy the user language to the session either (a TODO in the code), while Haxe pages read it. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:77` (CODE-118).
  - **DECISION (UND-014, 2026-11-06)** Drop the session language copy.

- **ACC-LOG-011** As a user who shares an account with another person, the page remembers which of the two persons logged in. <!-- 03-features/users-auth.md R16; camap-ts/packages/api-core/src/auth/auth.service.ts:77 -->
  - At TS login, the person is 0 when the email matches the primary email and 1 when it matches the secondary email.
  - The Haxe greeting uses this to show the right first name (`camap-hx/src/View.hx:251-255`, `camap-hx/lang/master/tpl/user/choose.mtt:12`).
  - The session data is a Haxe-serialised blob, so TS needs a writer for it.
  - **ERRATUM** Today TS login does not set which of the two persons logged in (a TODO in the code), while Haxe pages read it. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:77` (CODE-118).
  - **DECISION (UND-014, 2026-11-06)** Set which person logged in at TS login.

- **ACC-LOG-012** As a visitor, I can log in even if my browser has no prior session with the site. <!-- 03-features/users-auth.md R9; camap-ts/packages/api-core/src/auth/auth.service.ts:40-81 -->
  - When the session row is missing, TS login creates it, with the given sid, French language, empty data and the client IP.
  - **ERRATUM** Today TS login fails with "Session not found" when the browser has no session row. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:40-81` (CODE-105).
  - **DECISION (UND-021, 2026-11-06)** Create the session row at login when it is missing.
