# Sessions and login state (ACC-SES)

Actors: visitor, logged-in user, the system.

- **ACC-SES-001** As a visitor, I get an anonymous session when I open any page. <!-- 03-features/users-auth.md S2 sid; camap-hx/src/App.hx:160-171 -->
  - The session remembers the group I selected.

- **ACC-SES-002** As a logged-in user, I stay logged in for about 30 days of activity on the site. <!-- 03-features/users-auth.md R13; camap-hx/src/controller/Cron.hx:378-382 -->
  - The system deletes logged-in sessions older than 30 days.
  - The system deletes anonymous sessions older than 3 days.

- **ACC-SES-003** As a logged-in user, my login is valid on the pages and on the interactive widgets of the same page. <!-- 03-features/users-auth.md S2, F5.2; camap-ts/packages/api-core/src/auth/auth.service.ts:70-78 -->
  - Logging in once authenticates me everywhere.

- **ACC-SES-004** As a logged-in user, I am logged out when my login state is inconsistent between the pages and the widgets. <!-- 03-features/users-auth.md R17; camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:81-92 -->
  - The site shows a "logged state sync" error before I am logged out.

- **ACC-SES-005** As a logged-in user, my login is dropped when my access and renewal tokens are both invalid. <!-- 03-features/users-auth.md R17(d); camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:160-228 -->
  - My session is deleted and my cookies are cleared.
  - Pages open to everyone stay available to me as a visitor.

- **ACC-SES-006** As a logged-in user, I have only one renewal token at a time. <!-- 03-features/users-auth.md R11; camap-ts/packages/api-core/src/users/users.service.ts:188-220 -->
  - A new login replaces the previous renewal token.

- **ACC-SES-007** As a logged-in user, my login cookies cannot be read by scripts running in the page. <!-- 03-features/users-auth.md R11; camap-ts/packages/api-core/src/auth/auth.service.ts:348-357 -->
  - This protection is relaxed in development environments.

- **ACC-SES-008** *Undecided (UND-020)*: As the system, I refuse requests coming from blacklisted IP addresses and from clients identifying as "python". <!-- 03-features/users-auth.md R18; camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50 -->
  - **SUGGESTION** Drop this feature: the guard has no caller. Rely on the login ban. Based on: `camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50` (not referenced anywhere, from the first commit), `camap-hx/src` (no blacklist or user-agent rule in Haxe). Confidence: medium. Needs product input: are bot blocks wanted?

- **ACC-SES-009** *Undecided (UND-019)*: As a logged-in user, my login cookies apply to the same domain whatever application issues them. <!-- 03-features/users-auth.md R33; camap-hx/src/controller/User.hx:84-88; camap-ts/packages/api-core/src/auth/auth.service.ts:348-357 -->
  - **SUGGESTION** Use one shared rule in TS: cookie domain is the host without scheme and without a leading `app.`. Make logout a single step that clears all three cookies, as TS already does. Based on: `camap-hx/src/controller/User.hx:84-88` (strips `app.`), `camap-ts/packages/api-core/src/auth/auth.service.ts:183-188,348-357` (one response with three cookies; strips only `https://`). Confidence: medium.
