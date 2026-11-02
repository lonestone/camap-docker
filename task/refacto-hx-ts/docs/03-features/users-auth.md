# Users, authentication, sessions, rights

## 1. Scope

Covers today's behaviour of: user accounts (household model), registration, login/logout, the two parallel session systems (HX `sid` session and TS JWT cookies), the HX/TS bridge, password reset, profile edit, notification flags, account deletion and the inactive-user purge, and the rights model (site-wide superadmin and per-group rights). Group membership, groups and waiting lists are in `groups-membership.md`; superadmin back-office pages are in `admin-superadmin.md`.

Citation convention: all paths are repo-relative to the `camap-docker` root. `SUGOI/` = external Haxe library `sugoi` (not in the repo; pinned at `camap-hx/backend/haxe_libraries/sugoi.hxml:1`, read from the lix cache `~/haxe/haxe_libraries/sugoi/1.0.0/github/c3b8db853ccedf4be0eb15d6f27b16940ffcd37b/src/sugoi/`), so `SUGOI/` references are reproducible only with that cache.

Who does what today:
- HX (Neko/Apache) serves every HTML page and keeps the classic session (cookie `sid` -> table `Session`). HX has no code that creates accounts or checks a login password: the login/registration form is a React module (`loginRegistration`) mounted by `camap-hx/lang/master/tpl/user/login.mtt:29-33` that talks GraphQL to TS.
- TS (NestJS) owns login, register, logout, JWT cookies, bridge auth endpoints, profile edit, notification flags, account deletion and the inactive-user purge cron.
- HX still owns password reset, group selection in session (`Session.data.amapId`), the superadmin back-office and the rights editor.

## 2. Concepts & glossary terms

- **User**: one household, up to two persons (`firstName/lastName/email/phone` plus `*2` fields).
- **`sid` / `Session`**: HX session cookie `sid` (set by sugoi `BaseApp.setCookie`, `Max-Age=2629746`, path `/`, optional `cookie_domain`) mapping to a row in table `Session` (`SUGOI/BaseApp.hx:204-206`, `SUGOI/BaseApp.hx:212-221`, `SUGOI/db/Session.hx:79-102`). `Session.uid != null` means logged in. `Session.sdata` is Haxe/Neko-serialized (`SUGOI/db/Session.hx:50-58`) so TS cannot read it (`camap-ts/packages/api-core/src/tools/models/session.entity.ts:29-30`). The selected group is `Session.data.amapId` (`camap-hx/src/App.hx:160-171`, `camap-hx/src/db/User.hx:318-329`).
- **JWT cookies**: access cookie `Authentication`, refresh cookie `Refresh` (bcrypt hash stored in `User.currentRefreshToken`), and `Auth_sid` mirroring the HX sid (`camap-ts/packages/api-core/src/auth/auth.service.ts:16-18`, `:234-278`).
- **Bridge**: TS login writes `Session.uid` for the sid supplied by the browser (`camap-ts/packages/api-core/src/auth/auth.service.ts:70-78`); HX calls TS with `Authorization: Bearer <key>` (`camap-hx/src/service/BridgeService.hx:103-111`), TS compares to `CAMAP_KEY` (`camap-ts/packages/api-core/src/auth/strategies/bridge.strategy.ts:12-14`).
- **`KEY` / `CAMAP_KEY`**: shared secret (HX config `key` = TS env `CAMAP_KEY`) (`camap-ts/packages/api-core/src/tools/crypto.service.ts:12`); used for password md5 and control keys.
- **Control key**: `sha1(CAMAP_KEY + [groupId] + userId)` link token used in email footers to edit notifications / quit a group while logged out (`camap-ts/packages/api-core/src/common/utils.ts:63-75`, `camap-ts/packages/api-core/src/tools/crypto.service.ts:15-20`; HX `camap-hx/src/db/User.hx:553-564`).
- **`pass` / `pass2`**: legacy md5 password hash / bcrypt hash.
- **Site rights**: `User.rights` int flags; bit 0 = super admin (HX enum `RightSite.Admin`, `camap-hx/src/db/User.hx:16-18`; TS `RightSite.SuperAdmin`, `camap-ts/packages/api-core/src/users/models/user.entity.ts:14-16`).
- **Group rights**: `UserGroup.rights` JSON array of `{right, params}` with `GroupAdmin | ContractAdmin(cid?) | Membership | Messages` (`camap-hx/src/db/UserGroup.hx:7-12`, `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:24-29`).
- **Auto rights** (HX only): computed `ContractAdmin(cid)` for every catalog of a vendor claimed by the user (`camap-hx/src/db/UserGroup.hx:72-79`).
- **Notification flags**: `HasEmailNotif4h`=0, `HasEmailNotif24h`=1, `HasEmailNotifOuverture`=2, identical in both sides (`camap-hx/src/db/User.hx:7-11`, `camap-ts/packages/api-core/src/users/models/user-flags.ts:1-5`).
- **Placeholder user** `deleted@camap.tld`: must exist; receives re-attributed data on account deletion.
- **Routing (HX)**: sugoi `haxe.web.Dispatch`: `/<a>/<b>/<args>` calls `Main.do<A>` then controller `<A>.do<B>`; `@logged` redirects to `/?__redirect=<uri>` without a user (`SUGOI/BaseApp.hx:128-132`); `@admin` requires `user.isAdmin()` else redirects `/` (`SUGOI/BaseApp.hx:133-141`).
- **Guards (TS)**: `GqlAuthGuard` = JWT required (`camap-ts/packages/api-core/src/common/guards/gql-auth.guard.ts:5`); `MaybeAuthGuard` = JWT or anonymous (`camap-ts/packages/api-core/src/common/guards/maybe-auth.guard.ts:5`).

## 3. Routes & endpoints

### 3.1 HX routes

| side | route | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `/user/login` | `camap-hx/src/controller/User.hx:24-49` | public; redirects to `/` if already logged | `camap-hx/lang/master/tpl/user/login.mtt` -> React `loginRegistration` via `_Camap.loginBox` (`camap-hx/js/App.hx:259-280`) | exposes `sid`; if cookie `Auth_sid` exists and differs from sid -> `/user/logout`; sets `loginBoxOptions` (phone/address required from group flags) |
| HX | `/user/choose[?group=ID&redirect=]` | `camap-hx/src/controller/User.hx:54-80` | `@logged` | `camap-hx/lang/master/tpl/user/choose.mtt` | lists user's groups + waiting lists; selecting writes `session.data.amapId`, clears `order`/`newGroup`, redirects `/home` |
| HX | `/user/logout` | `camap-hx/src/controller/User.hx:82-96` | none | none | `BridgeService.logout(user)` (-> TS `GET /bridge/auth/logout/:id`), expires cookie `Refresh`, deletes HX session, redirect chain |
| HX | `/user/logoutDeleteAuthenticationCookie` | `camap-hx/src/controller/User.hx:98-105` | none | none | expires `Authentication` cookie (one cookie per redirect because Neko cannot send several Set-Cookie, comment `camap-hx/src/controller/User.hx:92-94`) |
| HX | `/user/logoutDeleteAuthSidCookie` | `camap-hx/src/controller/User.hx:107-114` | none | none | expires `Auth_sid`, redirects `/user/login` |
| HX | `/user/forgottenPassword[/<key>/<uid>[/<definePassword>]]` | `camap-hx/src/controller/User.hx:120-226` | public | `camap-hx/lang/master/tpl/user/forgottenPassword.mtt`; mails `camap-hx/lang/master/tpl/mail/forgottenPassword.mtt`, `camap-hx/lang/master/tpl/mail/newPasswordConfirmed.mtt` | 4-step password reset (Flow 5.3) |
| HX | `/account` | `camap-hx/src/controller/Account.hx:23-54` | `@logged` | `camap-hx/lang/master/tpl/account/default.mtt` -> React `userAccount` + `deleteAccount` | "my account"; `?lang=xx` stores `User.lang` (`camap-hx/src/controller/Account.hx:46-51`) |
| HX | `/account/editNotif/<user>/<key>` | `camap-hx/src/controller/Account.hx:59-68` | control key `sha1(KEY+userId)` | `camap-hx/lang/master/tpl/account/editNotif.mtt` -> React `editNotifications` | email-footer notification editor |
| HX | `/account/quitGroup/<groupId>` | `camap-hx/src/controller/Account.hx:70-74` | none | none | clears `session.data.amapId` if equal to groupId (no output; caller unverified) |
| HX | `/home` | `camap-hx/src/controller/Main.hx:66-174` | login gate | `camap-hx/lang/master/tpl/home.mtt` | no user + no open group -> `/user/login`; user without group -> `/user/choose`; disabled group -> `/group/disabled`; shows PhoneRequired/AddressRequired nags (`camap-hx/src/controller/Main.hx:135-145`) |
| HX | `/invite/<hash>/<email>/<group>[/<userId>]` | `camap-hx/src/controller/Main.hx:308-324` | `hash=sha1(KEY+email)` | `camap-hx/lang/master/tpl/invite.mtt` -> `_Camap.registerBox` prefilled | invitation link; if `userId` given, `UserGroup.getOrCreate` immediately (see `groups-membership.md`) |
| HX | `/` (permalink), `/ping`, `/tos`, `/cgu` | `camap-hx/src/controller/Main.hx:34-53,326,358-364` | none; maintenance gate bypassed for admins (`camap-hx/src/controller/Main.hx:36-41`) | none | permalink dispatcher, version JSON, TOS redirect |
| HX | `/api/user/me` (GET/POST) | `camap-hx/src/controller/api/User.hx:18-39` | HX-session user | JSON | GET `infos()`; POST updates address1/address2/city/zipCode/phone |
| HX | `/api/user/getFromGroup` | `camap-hx/src/controller/api/User.hx:44-53` | `@logged`; Membership right or contract manager | JSON | members of the current group; used by `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:44` |
| HX | `/api/user/getToken` | `camap-hx/src/controller/api/User.hx:56-64` | `@logged` | JSON | JWT signed with HX `key`; no caller found |
| HX | `/api/createSid` | `camap-hx/src/controller/Api.hx:76-90` | dev only (`config.DEBUG`) | JSON | creates anonymous session |
| HX | `/member/loginas/<id>` | `camap-hx/src/controller/Member.hx:89-103` | see rule 15 | `camap-hx/lang/master/tpl/member/loginAs.mtt` -> React `loginAs` | HX session switched to member (`session.setUser`), `amapId` cleared; React then calls GraphQL `loginAs` and `goTo('/')` (`camap-ts/packages/front-core/src/modules/loginRegistration/LoginAs.module.tsx:22-37`) |
| HX | `/db` | `camap-hx/src/controller/Main.hx:302-306` | `@admin` | sugoi DB admin | raw DB admin (can edit `User.rights`, `Group.disabled`...) |

### 3.2 TS GraphQL (`/graphql`)

| side | operation | handler path:line | auth/rights | consumer | purpose |
|---|---|---|---|---|---|
| TS | `mutation login(input{email,password,sid})` | `camap-ts/packages/api-core/src/auth/auth.resolver.ts:46-62` | public | `camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:48` | validates `loginSchema`, logs in, sets 3 cookies |
| TS | `mutation recordBadLogin` | `camap-ts/packages/api-core/src/auth/auth.resolver.ts:64-67` | public | `camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:66` | increments IP ban counter |
| TS | `mutation register(input)` | `camap-ts/packages/api-core/src/auth/auth.resolver.ts:69-107` | public | `camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx:75,105` | register + login + optional join of `invitedGroupId` |
| TS | `mutation logout` | `camap-ts/packages/api-core/src/auth/auth.resolver.ts:109-124` | `MaybeAuthGuard` | `camap-ts/packages/front-core/src/gql/mutations/auth.gql:7` | deletes Session row + refresh token, expires 3 cookies |
| TS | `mutation loginAs(userId, groupId?)` | `camap-ts/packages/api-core/src/auth/auth.resolver.ts:126-152` | `GqlAuthGuard` | `camap-ts/packages/front-core/src/modules/loginRegistration/LoginAs.module.tsx:22` | impersonation (see inconsistencies-code.md) |
| TS | `query isEmailRegistered(email)` | `camap-ts/packages/api-core/src/auth/auth.resolver.ts:154-159` | public | `camap-ts/packages/front-core/src/modules/loginRegistration/loginRegistration.gql:18-20` | matches `email` or `email2` |
| TS | `query me` (`getMe`) | `camap-ts/packages/api-core/src/users/users.resolver.ts:56-60` | `GqlAuthGuard` | front | returns the JWT user |
| TS | `query user(id)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:62-66` | any authenticated user, no rights check | front | read a user by id |
| TS | `query getUserFromControlKey(id, controlKey, groupId?)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:68-79` | public; control key | `camap-ts/packages/front-core/src/modules/users/EditNotifications` | user lookup via email-footer key |
| TS | `query isGroupAdmin(groupId)`, `canManageAllCatalogs(groupId)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:81-97` | current user | front | rights probes |
| TS | `query getEmailRecipientsByUserIds(inGroup, ids)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:99-119` | `canManageMessages` check (see inconsistencies-code.md) | messages module | recipients for messaging |
| TS | `query getUsersFromEmails(emails)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:121-127` | any authenticated user | `camap-ts/packages/front-core/src/modules/members/members.gql.ts:140` | resolve emails to user records |
| TS | `query getInvitedUserToRegister(email)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:129-140` | public | `camap-ts/packages/front-core/src/modules/loginRegistration/loginRegistration.gql:1-16` | reads cache `invitation-<sha1(KEY+email)>` -> prefill data (name, phone, address) |
| TS | field `User.notifications` | `camap-ts/packages/api-core/src/users/users.resolver.ts:141-150` | none on the field | front | `{hasEmailNotif4h, hasEmailNotif24h, hasEmailNotifOuverture}` computed from flag bits, re-reads user by id |
| TS | `mutation updateUser(input)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:159-176` (`@MutationFail`, `:161`) | self only (`input.id === currentUser.id`) | `camap-ts/packages/front-core/src/modules/users/UserAccountModule/userAccount.gql:49` | profile edit; yup validation; email uniqueness check |
| TS | `mutation updateUserNotifications(input{userId,controlKey?,flags})` | `camap-ts/packages/api-core/src/users/users.resolver.ts:178-196` | `MaybeAuthGuard`: JWT user = self, or valid control key | `camap-ts/packages/front-core/src/modules/users/UserAccountModule/userAccount.gql:66`, `EditNotifications.module.tsx` | notification flags |
| TS | `mutation deleteAccount(userId, password)` | `camap-ts/packages/api-core/src/users/users.resolver.ts:198-247` | self only + password re-check | `camap-ts/packages/front-core/src/modules/users/DeleteAccountModule/deleteAccount.gql:1-3` | account deletion |

### 3.3 TS REST (bridge, bearer = `CAMAP_KEY`, class guard `AuthGuard('bridge')`)

| side | route | handler path:line | auth | purpose |
|---|---|---|---|---|
| TS | `GET /bridge/auth/tokens/:id` (`getTokenforUser`) | `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:21-32` | bearer | returns `jwtService.sign({email,id})` (access secret); HX wrapper `BridgeService.getAuthToken` (`camap-hx/src/service/BridgeService.hx:88-93`) has no caller |
| TS | `GET /bridge/auth/logout/:id` | `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:34-46` | bearer | `usersService.removeRefreshToken(user.id)` (called by `User.doLogout`) |
| TS | `GET /bridge/auth/delete-user/:id` (`deleteUser`) | `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:48-60` | bearer | `usersService.delete(user)` (state change through GET; called by `camap-hx/src/controller/admin/User.hx:44-55`) |

### 3.4 TS cron

| side | schedule | handler path:line | purpose |
|---|---|---|---|
| TS | daily 01:00 | `camap-ts/packages/api-core/src/users/users.service.ts:441-604` (`cleanUsers`) | inactive-user warnings and purge (rules 23-24; see also `crons-scheduled-jobs.md`) |

## 4. Business rules

### Identity, registration, login
1. A User = one household: up to 2 persons (`camap-hx/src/db/User.hx:30-38`, `camap-ts/packages/api-core/src/users/models/user.entity.ts:39-61`).
2. DB uniqueness: unique index on `email` only; `email2` has a non-unique index (`camap-ts/packages/api-core/src/users/models/user.entity.ts:18-19`, `camap-hx/src/db/User.hx:20`). Application rule: a primary or secondary email cannot be used by another account (HX `User.check()` `camap-hx/src/db/User.hx:537-548`; TS `UsersService.update` `camap-ts/packages/api-core/src/users/users.service.ts:137-145`). TS `register` only checks the primary email via `findOneByEmail` (matches `email` OR `email2`) (`camap-ts/packages/api-core/src/auth/auth.service.ts:98-101`).
3. Login accepts primary or secondary email (`camap-ts/packages/api-core/src/users/users.service.ts:94-103`).
4. HX normalizes on every save: emails lower-cased, last names upper-cased (`camap-hx/src/db/User.hx:524-535`). TS does not (no `toLowerCase`/`toUpperCase` in `camap-ts/packages/api-core/src/auth` or `camap-ts/packages/api-core/src/users`, by grep).
5. Registration (TS only): yup `userRegistrationSchema` = firstName, lastName, email required, password >= 8, `confirmPassword` must match, `tos` must be true (`camap-ts/packages/camap-common/src/validators/registrationSchema/userRegistrationSchema.ts`, `userSchema.ts`); phone validated if given (`camap-ts/packages/camap-common/src/validators/registrationSchema/phoneSchema.ts`); address validated (non-required) if any of zip/address/city given (`camap-ts/packages/api-core/src/auth/auth.resolver.ts:76-80`). Phone/address "required by group" is enforced only client-side (`camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx:186-202`).
6. New user defaults: `lang='fr'`, flag `HasEmailNotif24h` set, `cdate=now`, `email2` dropped if equal to `email` (`camap-ts/packages/api-core/src/auth/auth.service.ts:103-120`, `camap-ts/packages/api-core/src/users/users.service.ts:318-324`); HX defaults identical (`camap-hx/src/db/User.hx:57-68`).
7. Password hashing: `pass` = `md5(KEY + password)` (legacy), `pass2` = bcrypt cost 10 (`camap-ts/packages/api-core/src/tools/crypto.service.ts:22-28`, `camap-ts/packages/api-core/src/auth/auth.service.ts:311-317`). HX `setPass` = `md5(KEY + trim(password))`, writes only `pass` (`camap-hx/src/db/User.hx:274-281`). TS does not trim (`camap-ts/packages/api-core/src/tools/crypto.service.ts:22-24`).
8. Password check order (TS): bcrypt on `pass2` if non-empty; else MD5 on `pass`; on MD5 match, bcrypt is computed and stored in `pass2` (lazy migration) (`camap-ts/packages/api-core/src/auth/auth.service.ts:319-346`). `pass` is still written on registration (`camap-ts/packages/api-core/src/auth/auth.service.ts:115`).
9. Login: lookup by email (row lock); optional IP ban check; password check; set `ldate=now`; load HX `Session` by `sid` (error `Session not found with sid ...` if missing), set `uid` and `lastTime`; build JWT cookies (`camap-ts/packages/api-core/src/auth/auth.service.ts:40-81`). `ldate IS NULL` means "never logged in" (`camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:190-200`). Nothing in HX writes `ldate` (grep).
10. Brute force: ban when the cache counter for the IP is >= 5; counter TTL 10 min, refreshed on every increment; disabled when env `DISABLE_BRUTE_FORCE=='true'` (`camap-ts/packages/api-core/src/auth/auth.service.ts:50-56,280-309`). The counter is incremented only by the public mutation `recordBadLogin`, which the React box calls after a `wrongPassword` error (`camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:65-68`); `login` does not increment it. `UserIp` reads `request.headers['X-Real-Ip']` (`camap-ts/packages/api-core/src/common/decorators/user-ip.decorator.ts:7-9`).
11. Tokens: access token payload `{email,id}` signed with `JWT_ACCESS_TOKEN_SECRET`, TTL `JWT_ACCESS_TOKEN_EXPIRATION_TIME` seconds; refresh token signed with `JWT_REFRESH_TOKEN_SECRET`, TTL `JWT_REFRESH_TOKEN_EXPIRATION_TIME`; refresh token bcrypt-hashed into `User.currentRefreshToken` (one refresh token per user) (`camap-ts/packages/api-core/src/auth/auth.service.ts:224-270`, `camap-ts/packages/api-core/src/users/users.service.ts:188-220`, `camap-ts/packages/api-core/src/envSchema.ts:12-16`). Cookies: `HttpOnly` except when `NODE_ENV=development`, `Path=/`, `Domain=<CAMAP_HOST without https://>` (none in dev) (`camap-ts/packages/api-core/src/auth/auth.service.ts:348-357`). `Auth_sid` lifetime = refresh TTL (`camap-ts/packages/api-core/src/auth/auth.service.ts:272-278`).
12. Logout (TS): delete Session row for cookie `Auth_sid`, null the refresh token, expire the 3 cookies in one `Set-Cookie` array (`camap-ts/packages/api-core/src/auth/auth.service.ts:175-203`). Logout (HX): bridge call, `Refresh` cookie expired with `Domain` = HOST minus leading `app.`, delete Session, then 2 more redirects to expire `Authentication` and `Auth_sid`, finally `/user/login` (`camap-hx/src/controller/User.hx:82-114`; domain logic `:84-88,99-102,108-111`).
13. HX sessions are purged by the HX cron `sugoi.db.Session.clean()`: logged sessions older than 30 days, anonymous older than 3 days (`camap-hx/src/controller/Cron.hx:378-382`, `SUGOI/db/Session.hx:120-125`). TS never purges sessions.
14. Sessions also accept a `sid` URL/POST parameter before the cookie (`SUGOI/BaseApp.hx:212-216`).
15. Impersonation, HX side: `/member/loginas/<id>` allowed for superadmin, or for a group manager (`isAmapManager`) when the target is not superadmin and belongs to at most 1 group (`camap-hx/src/controller/Member.hx:92-96`); the member sheet shows the button when the target has exactly 1 group and the viewer is group manager, or the viewer is admin (`camap-hx/src/controller/Member.hx:49`). TS `loginAs` mirrors this (`camap-ts/packages/api-core/src/auth/auth.resolver.ts:137-140`) and does not update `Session.uid`; the HX session switch relies on the prior HX `/member/loginas` hop.
16. TS login does not copy `User.lang` to `Session.lang` nor set `whichUser` (`// TODO ?session.sdata.whichUser` at `camap-ts/packages/api-core/src/auth/auth.service.ts:77`), unlike sugoi `Session.setUser` (`SUGOI/db/Session.hx:41-48`). `whichUser` (0/1 = first/second person) is read by HX (`camap-hx/src/View.hx:251-255`, `camap-hx/lang/master/tpl/user/choose.mtt:12`, `camap-hx/lang/master/tpl/messages/default.mtt:9`).

### Guard behaviour (TS)
17. `GqlAuthGuard` flow: (a) if cookies `Auth_sid` and `sid` both exist and differ -> error `Neko/Nest logged state sync error`; (b) valid access token -> passport jwt; (c) else the refresh cookie must verify AND match the bcrypt hash in DB, then new access+refresh tokens are issued and cookies written; (d) on failure (outside `NODE_ENV=test`): delete session + refresh token of `Auth_sid`, clear the 3 cookies, deny (or for `MaybeAuthGuard`, continue anonymously via the `void` strategy) (`camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:81-92,160-228`). `getUserIfRefreshTokenMatches` can return `undefined` and the guard then calls `getAccessToken(user)` on it (`camap-ts/packages/api-core/src/common/guards/gql-auth-abstract-guard.ts:195-200`, `camap-ts/packages/api-core/src/users/users.service.ts:188-202`), which throws and is caught by (d).
18. `BlackListGuard` (IP list in `Variable.IPBlacklist`, rejects User-Agent containing "python") exists (`camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50`) and is applied nowhere (grep).
19. TS also registers `CookieStrategy` (cookie `sid`) with `defaultStrategy: ['jwt','cookie']` (`camap-ts/packages/api-core/src/auth/auth.module.ts:23-25,44`); all guards use explicit `jwt`/`void`/`bridge`.

### Profile / account
20. Self edit (`updateUser`): only own id, yup validated, email must not be used by another account (incl. as `email2`), empty strings stored as NULL (`camap-ts/packages/api-core/src/users/users.resolver.ts:159-176`, `camap-ts/packages/api-core/src/users/users.service.ts:124-147`). Changing email needs no password and no verification mail; the JWT payload keeps the old email until next token issue (payload email never read back: `camap-ts/packages/api-core/src/auth/strategies/jwt.strategy.ts:22-29`).
21. Editable via TS: names, emails, phones, address1/2, zip, city, nationality, countryOfResidence, birthDate (`camap-ts/packages/api-core/src/users/dto/update-user.input.ts:3-52`). Not editable via TS: password, lang. Password can only be changed through the HX reset flow; `lang` via HX `/account?lang=xx` (`camap-hx/src/controller/Account.hx:46-51`). A birthday >= 18 years rule exists only in HX `UserService.isBirthdayValid` (`camap-hx/src/service/UserService.hx:55-59`).
22. Notification flags are editable by self (JWT) or with a control key `sha1(KEY + userId)` (`camap-ts/packages/api-core/src/users/users.resolver.ts:178-196`; HX link `camap-hx/src/db/User.hx:561-564`).
23. Display names (`LASTNAME Firstname`, couple name) are duplicated on purpose in `camap-ts/packages/camap-common/src/utils/user-utils.ts:1-17` ("keep consistent with methods found on db.User", `camap-hx/src/db/User.hx:228-261`).

### Account deletion / purge
24. Self deletion (`deleteAccount`): user must be the current user and give the password (`camap-ts/packages/api-core/src/users/users.resolver.ts:200-212`); then `UsersService.delete` (rule 25), logout, then email to each group admin ("a member deleted his account") (`camap-ts/packages/api-core/src/users/users.resolver.ts:214-246`). The flow continues to logout and mail even when `delete` returned `null` (`camap-ts/packages/api-core/src/users/users.resolver.ts:224-246`, `camap-ts/packages/api-core/src/users/users.service.ts:333-337`).
25. `UsersService.delete` refuses (HTTP 401) if the user has any user-order (as user or user2) dated in the last 2 months, or any `UserGroup.balance < 0`; then re-attributes to the placeholder user `deleted@camap.tld` (not created by code): catalog contacts, group contacts (`Group.userId`), baskets/orders, operations with non-zero amount (zero-amount operations are deleted), CSA subscriptions; finally deletes the user (`camap-ts/packages/api-core/src/users/users.service.ts:331-436`). If the placeholder does not exist or is the user itself it returns `null` without deleting (`camap-ts/packages/api-core/src/users/users.service.ts:333-340`). Memberships and UserGroups are not touched explicitly (DB cascades on `UserGroup` FK: `camap-ts/packages/api-core/src/groups/entities/user-group.entity.ts:23-24`; cascade for `Membership` unverified).
26. Superadmin deletion (HX `/admin/user/delete/<id>`) = the same TS delete through the bridge; errors are swallowed (`camap-hx/src/controller/admin/User.hx:44-55`).
27. Inactive purge (TS cron `UsersService.cleanUsers`, daily 01:00): warning emails (template `deletionWarning.twig`) to users whose `ldate` is exactly 1 month, 2 weeks and 3 days before the 2-year mark (day-equality match; users with `ldate NULL` never warned); users with an active membership (any group, membership year = current or previous calendar year) are excluded (`camap-ts/packages/api-core/src/users/users.service.ts:441-517`). Deletion: `ldate < now-2y` OR (`ldate IS NULL` AND `cdate < now-6 months`), excluding users with an active membership or any order newer than 2 years, then `delete()` (so rule 25 applies) (`camap-ts/packages/api-core/src/users/users.service.ts:545-604`). The purge runs per-row async callbacks inside a stream `'data'` handler, not awaited (`camap-ts/packages/api-core/src/users/users.service.ts:567-603`); first warning date is `twoYearsAgo + 1 month + 1 day - 1 ms` (`:453-456`). Membership protection: `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:77-87`.

### Rights
28. Superadmin: `User.rights` bit 0. HX `rights.has(Admin)` (`camap-hx/src/db/User.hx:74-76`). TS `hasFlag(0, rights)` in `UserEntity.isSuperAdmin` (`camap-ts/packages/api-core/src/users/models/user.entity.ts:123-125`) but most checks use the literal `user.rights === 1` (`camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:95,104,136,166`, `camap-ts/packages/api-core/src/common/decorators/is-admin.decorator.ts:19`; 8 occurrences of `rights === 1` vs 8 of `isSuperAdmin()` in `camap-ts/packages/api-core/src`, by grep). TS `isGroupMember` returns true for superadmins (`camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-105`); HX `isMemberOf` does not (`camap-hx/src/db/User.hx:342-344`).
29. HX `UserGroup.hasRight` returns true for any superadmin (`camap-hx/src/db/UserGroup.hx:151-153`); `ContractAdmin` with `params==null` = all catalogs, otherwise a list of catalog ids as strings (`camap-hx/src/db/UserGroup.hx:155-168`); other rights are boolean by name (`:170-176`). Rights do not imply each other (GroupAdmin does not grant Membership/Messages/ContractAdmin). `getRights()` = stored rights + auto rights (`camap-hx/src/db/UserGroup.hx:72-84`).
30. Capability map (HX): group manager = `isAmapManager` = superadmin, or `UserGroup` with `GroupAdmin`, evaluated on the session group (`camap-hx/src/db/User.hx:120-134`); also `canAccessMembership` / `canAccessMessages` / `canManageAllContracts` / `isContractManager` / `canManageContract` / `canManageVendor` (`camap-hx/src/db/User.hx:162-222`, `:203-213`). TS equivalents: `UserGroupsService.isGroupAdmin/canManageMembers/canManageMessages/canManageAllCatalogs/canManageCatalog` (`camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:90-171`). TS computes auto rights only in `canManageCatalog` (claimed vendor check, `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:139-140`). HX `canManageAllContracts` = `ContractAdmin(null)` (`camap-hx/src/db/User.hx:191-195`); TS `canManageAllCatalogs` = any `ContractAdmin` entry (`camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112-114,160-171`).
31. Rights editing (HX only): `/amapadmin/editRight` rewrites the whole stored list (`ua.rights="[]"` then `giveRight` per choice) (`camap-hx/src/controller/AmapAdmin.hx:93-199`, `camap-hx/src/db/UserGroup.hx:89-110`); a manager cannot remove their own GroupAdmin (`camap-hx/src/controller/AmapAdmin.hx:174-179`). No TS mutation edits `UserGroup.rights`. See `groups-membership.md`.
32. TS rights checks per resolver: Membership right for member management, waiting list approve/cancel/move, memberships CRUD (`canManageMembers` -> `hasRight(Membership)`: `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:120-126,160-171`); `group(id)` and `setGroupImage` need GroupAdmin (`camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:200-209`); `userGroup(...)` accepts GroupAdmin OR any ContractAdmin OR Membership (`camap-ts/packages/api-core/src/groups/resolvers/userGroups.resolver.ts:29-45`).
33. Other cookie details: HX computes the cookie domain by stripping a leading `app.` from `HOST` (`camap-hx/src/controller/User.hx:84-88`); TS uses `CAMAP_HOST` stripped of `https://` only (`camap-ts/packages/api-core/src/auth/auth.service.ts:348-357`).
34. Dev/legacy: `User.doDefault` (`camap-hx/src/controller/User.hx:21-22`) and api `User.doDefault` (`camap-hx/src/controller/api/User.hx:14-16`) are empty.

## 5. Flows

### 5.1 Registration (TS)
1. Browser on an HX page (`/user/login` or invite page) mounts React `loginRegistration` with the HX `sid` (`camap-hx/lang/master/tpl/user/login.mtt:29-33`, `camap-hx/lang/master/tpl/invite.mtt`, `camap-hx/js/App.hx:259-284`). Registration tab is prefilled from `getInvitedUserToRegister(email)` when invited (`camap-ts/packages/front-core/src/modules/loginRegistration/RegistrationBox.tsx`).
2. `register` mutation: yup validation, `AuthService.registerAndLogin` -> `register` (email-not-registered check, md5+bcrypt hashes, flags, `lang='fr'`) -> `login` (flow 5.2) (`camap-ts/packages/api-core/src/auth/auth.resolver.ts:69-107`, `camap-ts/packages/api-core/src/auth/auth.service.ts:84-156`).
3. If `invitedGroupId` is present: a `UserGroup` row is created for that group, with no `regOption` check (`camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104`).
4. Response sets cookies `Authentication`, `Refresh`, `Auth_sid` (`camap-ts/packages/api-core/src/auth/auth.resolver.ts:164-183`); React redirects to `redirectUrl` (for example `/home` or `/user/joingroup`).
5. No welcome/confirmation email and no email verification exist in the registration path (none in `auth.service.ts`/`auth.resolver.ts`). `register` accepts `''` as password (stored as `md5(KEY+'')` and `bcrypt('')`), but `loginSchema` requires a non-empty password (`camap-ts/packages/camap-common/src/validators/loginSchema/loginSchema.ts`, `camap-ts/packages/api-core/src/auth/auth.resolver.ts:53`).

### 5.2 Login / session sharing
1. HX page renders; sugoi creates/loads `Session` from cookie `sid` (`SUGOI/BaseApp.hx:210-221`); the HX template passes `session.sid` to React.
2. `login(email,password,sid)` -> `AuthService.login` -> sets `User.ldate`, `Session.uid`, `Session.lastTime` for that sid -> returns JWT cookies + `Auth_sid=<sid>`.
3. Next HX request: sugoi loads `Session.user` and `app.user` is set; HX requires no further proof of identity.
4. Next GraphQL request: `GqlAuthGuard` checks `Auth_sid == sid` cookies, then the JWT (rule 17).
5. Mismatch handling: HX `/user/login` and `/home` redirect to `/user/logout` if `Auth_sid` is present but differs/user missing (`camap-hx/src/controller/User.hx:32-37`, `camap-hx/src/controller/Main.hx:70-77`).
6. Redirect after login: `view.redirect` from `redirect`/`__redirect` params (`camap-hx/src/controller/User.hx:41-48`); the code assigns `app.params.exists("redirect")` (a Bool) to `view.redirect` (`camap-hx/src/controller/User.hx:42-43`).

### 5.3 Password reset (HX)
1. `GET /user/forgottenPassword` shows the email form (step 1).
2. Submitted email: lookup `email` then `email2`; unknown -> error "This E-mail is not linked to a known account"; token = `md5("chp" + random(1e9))` stored in `Cache` (value = user id, 30 days); mail with link `http://<HOST>/user/forgottenPassword/<token>/<userId>` (step 2) (`camap-hx/src/controller/User.hx:146-172`).
3. Link: if `Cache.get(token) == userId`, show the 2-field new-password form with hidden `uid`; else "Invalid request" (step 3) (`camap-hx/src/controller/User.hx:174-183`).
4. Submit `chpass`: if `pass1 == pass2` -> `setPass` (md5 into `pass` only), `update`, destroy token, send "new password confirmed" mail (`camap-hx/src/controller/User.hx:185-213`; template does not print the password, `camap-hx/lang/master/tpl/mail/newPasswordConfirmed.mtt`). The form's `isValid()` checks only form fields; the target user id comes from the hidden `uid` field and the token is checked only in step 3 (`camap-hx/src/controller/User.hx:174-197`).
5. `/user/forgottenPassword/<token>/<uid>/true` is the "create your password" variant used by TS member import (`definePassword`, title change only, `camap-hx/src/controller/User.hx:225`).

### 5.4 Account deletion
`/account` -> React `deleteAccount` (password) -> `deleteAccount` mutation -> rules 24-25 -> logout cookies cleared -> mails to group admins.

## 6. Ownership hx vs ts

| capability | HX | TS |
|---|---|---|
| Register | none | `register` |
| Login / logout | session write side effect only; logout redirect chain `camap-hx/src/controller/User.hx:82-114` | `login`, `logout`, JWT, `Auth_sid` |
| Password reset / change | yes, only place (`camap-hx/src/controller/User.hx:120-226`) | none (only consumes the `chp-` cache key format in member import) |
| Email change | none | `updateUser` |
| Profile edit | `/api/user/me` POST (address/phone) | `updateUser` (React `userAccount`) |
| Notification flags | `Member.doView` display only | `updateUserNotifications` |
| Account deletion | superadmin delete -> bridge | `deleteAccount`, bridge `delete-user`, cron purge |
| Superadmin flag, back-office | `/admin/*`, `/db` | `loginAs` only |
| Rights read | `camap-hx/src/db/User.hx`, `camap-hx/src/db/UserGroup.hx` | `UserGroupsService` |
| Rights write | `/amapadmin/editRight` | none |
| Current group selection | `session.data.amapId` | none (group ids passed by HX to React/GraphQL) |
| Session purge | `camap-hx/src/controller/Cron.hx:381` | none |
| Inactive user purge | none | `UsersService.cleanUsers` |

Shared tables: `User`, `Session` (HX owns the row lifecycle except login `uid` write by TS), `Cache` (reset tokens, invitation data), `Variable`.

## 7. Known security/rights observations

Pointers only; details in `inconsistencies-code.md`:
- HX password reset step 4 token check, stale `pass2` after HX reset, TS `loginAs` authorization, client-dependent brute-force counter, unauthenticated TS reads (`user`, `getUsersFromEmails`, `getInvitedUserToRegister`, user lists), `invitedGroupId` without regOption check, `/invite` hash scope, `/user/choose` group id without membership check: see inconsistencies-code.md.
- Doc/code divergences for `camap-ts/docs/users.md` (pass no longer used, `Session.data` access, fail2ban, email uniqueness, purge conditions): see inconsistencies-docs.md.
