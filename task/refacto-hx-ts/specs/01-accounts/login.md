# Login (ACC-LOG)

Actors: visitor, logged-in user.

- **ACC-LOG-001** As a visitor, I can log in with my email and my password. <!-- 03-features/users-auth.md R9; camap-ts/packages/api-core/src/auth/auth.service.ts:40-81 -->
  - My email and password are both required.
  - I land on the page I wanted to reach, or on the home page.
  - **ERRATUM** Login only works if the Haxe app has already created a session for my browser. Source: `camap-ts/packages/api-core/src/auth/auth.service.ts:70-74` (CODE-105).

- **ACC-LOG-002** As a visitor, I can log in with the secondary email of my household as well as the primary one. <!-- 03-features/users-auth.md R3; camap-ts/packages/api-core/src/users/users.service.ts:94-103 -->

- **ACC-LOG-003** As a visitor who registered before the password system changed, I can log in with my existing password. <!-- 03-features/users-auth.md R8; camap-ts/packages/api-core/src/auth/auth.service.ts:319-346 -->
  - The system upgrades my stored password silently at first login.
  - **ERRATUM** Today, after a password reset made in the Haxe pages, my old password keeps working until I log in once with the new one. Source: `camap-hx/src/db/User.hx:274-281, camap-ts/packages/api-core/src/auth/auth.service.ts:320-345` (CODE-005).
  - **DECISION (UND-007, 2026-11-06)** A reset clears `pass2`, so the old password stops working immediately (see ACC-PWD-009).

- **ACC-LOG-004** As a visitor, I see an error if my email or password is wrong. <!-- 03-features/users-auth.md F5.2; camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:65-68 -->

- **ACC-LOG-005** *Undecided (UND-008)*: As a visitor, I am blocked for 10 minutes after 5 failed logins from the same IP address. <!-- 03-features/users-auth.md R10; camap-ts/packages/api-core/src/auth/auth.service.ts:50-56,280-309 -->
  - The ban can be disabled by configuration.
  - **SUGGESTION** Count failures inside `login`, but commit the counter outside the failing transaction. Read the IP header in lower case. Based on: `camap-ts/packages/api-core/src/auth/auth.service.ts:50-56,295-307` (ban check in login, counter in a separate method), `camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:65-68` (client calls the counter), `camap-ts/packages/api-core/src/common/decorators/user-ip.decorator.ts:8` (`X-Real-Ip` never matches, Node lower-cases headers). Likely reason for the split: a thrown error rolls back the cache write. Confidence: medium.

- **ACC-LOG-006** As a user, the system records the date of my last login. <!-- 03-features/users-auth.md R9; camap-ts/packages/api-core/src/auth/auth.service.ts:40-81 -->
  - A user who never logged in has no last-login date.

- **ACC-LOG-007** As a logged-in user, I stay logged in without retyping my password while my session renews itself. <!-- 03-features/users-auth.md R11, R17; camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:160-228 -->
  - When my short-lived token has expired, a valid long-lived token silently gives me a new one.
  - When neither is valid, I am treated as logged out.

- **ACC-LOG-008** As a logged-in user already on the login page, I am sent to the home page. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/User.hx:24-49 -->

- **ACC-LOG-009** As a logged-in user, I am logged out and sent back to the login page if my two session cookies disagree. <!-- 03-features/users-auth.md R17, F5.2 step 5; camap-hx/src/controller/User.hx:32-37 -->

- **ACC-LOG-010** *Undecided (UND-014)*: As a user, my language preference applies right after I log in. <!-- 03-features/users-auth.md R16; camap-ts/packages/api-core/src/auth/auth.service.ts:77 -->
  - **SUGGESTION** Set which person logged in at TS login: 0 if the email matches the primary, 1 if the secondary. Drop the session language copy, because only French is configured. Based on: `camap-ts/packages/api-core/src/auth/auth.service.ts:77` (TODO), `camap-hx/src/View.hx:251-255` and `camap-hx/lang/master/tpl/user/choose.mtt:12` (greeting uses first name 2), `camap-hx/config.xml.dist:3` (`langs="fr"`). The session data is a Haxe-serialised blob, so TS needs a writer. Confidence: low. Needs product input: keep the two-person greeting?

- **ACC-LOG-011** *Undecided (UND-014)*: As a user who shares an account with another person, the page remembers which of the two persons logged in. <!-- 03-features/users-auth.md R16; camap-ts/packages/api-core/src/auth/auth.service.ts:77 -->
  - **SUGGESTION** Set which person logged in at TS login: 0 if the email matches the primary, 1 if the secondary. Drop the session language copy, because only French is configured. Based on: `camap-ts/packages/api-core/src/auth/auth.service.ts:77` (TODO), `camap-hx/src/View.hx:251-255` and `camap-hx/lang/master/tpl/user/choose.mtt:12` (greeting uses first name 2), `camap-hx/config.xml.dist:3` (`langs="fr"`). The session data is a Haxe-serialised blob, so TS needs a writer. Confidence: low. Needs product input: keep the two-person greeting?

- **ACC-LOG-012** *Undecided (UND-021)*: As a visitor, I can log in even if my browser has no prior session with the site. <!-- 03-features/users-auth.md R9; camap-ts/packages/api-core/src/auth/auth.service.ts:40-81 -->
  - **SUGGESTION** Create the session row at login when it is missing, with the given sid, French language, empty data and the client IP. Based on: `camap-ts/packages/api-core/src/auth/auth.service.ts:68-73` (throws `Session not found`), `camap-ts/packages/api-core/src/tools/models/session.entity.ts:5-38` (all columns can be filled by TS), `camap-hx/src/controller/User.hx:30-37` (Haxe passes its own sid to the login box). Confidence: medium.
