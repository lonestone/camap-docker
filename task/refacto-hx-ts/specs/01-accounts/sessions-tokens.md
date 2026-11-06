# Sessions and login state (ACC-SES)

Actors: visitor, logged-in user, the system.

- **ACC-SES-001** As a visitor, I get an anonymous session when I open any page. <!-- 03-features/users-auth.md S2 sid; camap-hx/src/App.hx:160-171 -->
  - The session remembers the group I selected.
  - **ERRATUM** Today a session id given in the address (`?sid=`) is adopted and set as my session cookie, the id is not renewed when I log in, and ids come from a non-cryptographic generator. Source: `sugoi/src/sugoi/BaseApp.hx:203-217`, `sugoi/src/sugoi/db/Session.hx:41-48,107-115`, `camap-ts/packages/api-core/src/auth/auth.service.ts:71-78` (CODE-178, CODE-179). Fixed when Haxe is ported to TS, not in the current system: see [TS-ONLY-STEP.md](../../TS-ONLY-STEP.md).

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
  - **ERRATUM** Today the platform session cookie `sid` set by Haxe has no `HttpOnly`, `Secure` or `SameSite` flag. Source: `sugoi/src/sugoi/BaseApp.hx:205` (CODE-179). Fixed when Haxe is ported to TS, not in the current system: see [TS-ONLY-STEP.md](../../TS-ONLY-STEP.md).

- **ACC-SES-008** As the system, I do not refuse requests on the sender's IP address or user agent: there is no IP or user-agent blacklist. <!-- 03-features/users-auth.md R18; camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50 -->
  - The login ban is the only protection against abusive sign-ins; the IP blacklist setting is removed too (see ADM-TLS-006, UND-115).
  - **ERRATUM** Today a blacklist guard exists (blacklist in a stored variable, rejecting "python" user agents) but is used nowhere. Source: `camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50` (CODE-125).
  - **DECISION (UND-020, 2026-11-06)** Drop the blacklist guard: it has no caller and no Haxe equivalent.

- **ACC-SES-009** As a logged-in user, my login cookies apply to the same domain whatever application issues them. <!-- 03-features/users-auth.md R33; camap-hx/src/controller/User.hx:84-88; camap-ts/packages/api-core/src/auth/auth.service.ts:348-357 -->
  - The cookie domain is the host without the scheme and without a leading `app.`, computed by one shared rule in Haxe and in TS.
  - **ERRATUM** Today Haxe strips a leading `app.` from HOST, while TS strips only `https://` from CAMAP_HOST. Source: `camap-hx/src/controller/User.hx:84-88`, `camap-ts/packages/api-core/src/auth/auth.service.ts:348-357` (CODE-117).
  - **DECISION (UND-019, 2026-11-06)** Use one cookie-domain rule in both stacks (host without scheme and without a leading `app.`) and make logout a single step that clears all three cookies.
