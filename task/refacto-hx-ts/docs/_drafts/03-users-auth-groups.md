# 03 - Users, authentication/sessions, rights, groups, membership

Scope: what the code does today. Read-only analysis, no plans.

Path convention (all relative to the `camap-docker` root; prefixes are shortcuts):
- `HX/` = `camap-hx/src/`
- `TPL/` = `camap-hx/lang/master/tpl/`
- `API/` = `camap-ts/packages/api-core/src/`
- `FE/` = `camap-ts/packages/front-core/src/`
- `COMMON/` = `camap-ts/packages/camap-common/src/`
- `SUGOI/` = external Haxe lib `sugoi` (not in the repo), pinned at `camap-hx/backend/haxe_libraries/sugoi.hxml:1` (commit c3b8db85...), read from `~/haxe/haxe_libraries/sugoi/1.0.0/github/c3b8db853ccedf4be0eb15d6f27b16940ffcd37b/src/sugoi/` (outside the repo, so refs there are only reproducible with the lix cache).

---

## 1. Overview

**Who does what today**
- HX (Neko/Apache) still serves every HTML page and keeps the "classic" session (cookie `sid` -> table `Session`). HX has **no** code that creates accounts or checks a login password: the login/registration form is a React module (`neo` bundle, `loginRegistration`) mounted by the HX template `TPL/user/login.mtt:29-33` and talks GraphQL to TS.
- TS (NestJS) owns: login, register, logout, JWT cookies, bridge auth endpoints, user profile edit, notification flags, account deletion, inactive-user purge (cron), group membership lists/waiting list/invitations, membership (cotisation) CRUD, rights queries.
- HX still owns: password reset ("forgotten password"), group creation (superadmin only), group public page, group settings forms (membership settings, regOption/flags, rights editor), group choice (`/user/choose`), join-open-group, quit-group email-link pages (render a React module), superadmin back-office, session group selection (`Session.data.amapId`).

**Session model (two parallel systems)**
- HX: cookie `sid` (set by sugoi `BaseApp.setCookie`, `Max-Age=2629746`, path `/`, optional `cookie_domain`) -> row in `Session` (`SUGOI/BaseApp.hx:204-206`, `SUGOI/BaseApp.hx:212-221`, `SUGOI/db/Session.hx:79-102`). `Session.uid` != null means logged in; `Session.sdata` is Haxe/Neko-serialized (`SUGOI/db/Session.hx:50-58`) so TS cannot read it (TS never reads `sdata`/`amapId`: `API/tools/models/session.entity.ts:29-30`, grep). The selected group is `Session.data.amapId` (`HX/App.hx:160-171`, `HX/db/User.hx:318-329`).
- TS: JWT access token cookie `Authentication`, refresh token cookie `Refresh` (bcrypt hash stored in `User.currentRefreshToken`), plus `Auth_sid` cookie that mirrors the HX sid (`API/auth/auth.service.ts:16-18`, `:234-278`).
- Bridge: login from TS "hacks" HX by writing `Session.uid` for the sid passed in by the browser (`API/auth/auth.service.ts:70-78`). HX calls TS with `Authorization: Bearer <key>` (`HX/service/BridgeService.hx:103-111`), TS checks it equals `CAMAP_KEY` (`API/auth/strategies/bridge.strategy.ts:12-14`).

**Rights model**
- Site-wide: `User.rights` int flags; bit 0 = super admin (HX enum `RightSite.Admin`, `HX/db/User.hx:16-18`; TS `RightSite.SuperAdmin`, `API/users/models/user.entity.ts:14-16`).
- Per group: `UserGroup.rights` JSON array `{right, params}` with `GroupAdmin | ContractAdmin(cid?) | Membership | Messages` (`HX/db/UserGroup.hx:7-12`, `API/groups/services/user-groups.service.ts:24-29`). Plus HX-only computed "auto rights" `ContractAdmin(cid)` for every catalog of a vendor claimed by the user (`HX/db/UserGroup.hx:72-79`).

**Group model**: `Group` (name, contact, texts, `regOption` Closed|WaitingList|Open|Full, `flags`, `hasMembership`, `membershipFee`, `membershipRenewalDate`, `disabled` reason) + `UserGroup` (membership of a user in a group, balance, rights) + `WaitingList` + `Membership` (one row per user/group/year) (`HX/db/Group.hx:9-38,43-94`, `HX/db/UserGroup.hx:19-32`, `HX/db/Membership.hx:5-15`).

---

## 2. Routes / endpoints

HX routing = sugoi `haxe.web.Dispatch`: URL `/<a>/<b>/<args>` calls `Main.do<A>` which dispatches to controller `<A>`, method `do<B>`; `@logged` redirects to `/?__redirect=<uri>` if no user (`SUGOI/BaseApp.hx:128-132`); `@admin` requires `user.isAdmin()` else redirect `/` (`SUGOI/BaseApp.hx:133-141`); `@tpl` selects template.

### 2.1 HX routes (users / auth / account)

| side | route | handler | template/component | purpose |
|---|---|---|---|---|
| HX | `/user/login` | `User.doLogin` `HX/controller/User.hx:24-49` | `TPL/user/login.mtt` -> React `loginRegistration` via `_Camap.loginBox` (`camap-hx/js/App.hx:259-280`) | redirects to `/` if already logged; exposes `sid`; if cookie `Auth_sid` exists and differs from current sid -> `/user/logout`; sets `loginBoxOptions` (phone/address required from group flags) |
| HX | `/user/choose[?group=ID&redirect=]` | `User.doChoose` `User.hx:54-80`, `@logged` | `TPL/user/choose.mtt` | lists user's groups + waiting lists; selecting a group writes `session.data.amapId`, clears `order`/`newGroup`, redirect `/home` |
| HX | `/user/logout` | `User.doLogout` `User.hx:82-96` | none | `BridgeService.logout(user)` (-> TS `GET /bridge/auth/logout/:id`), expire cookie `Refresh`, delete HX session, redirect chain |
| HX | `/user/logoutDeleteAuthenticationCookie` | `User.hx:98-105` | none | expire `Authentication` cookie (one cookie per redirect because Neko cannot send several Set-Cookie, comment `User.hx:92-94`) |
| HX | `/user/logoutDeleteAuthSidCookie` | `User.hx:107-114` | none | expire `Auth_sid`, redirect `/user/login` |
| HX | `/user/forgottenPassword[/<key>/<uid>[/<definePassword>]]` | `User.doForgottenPassword` `User.hx:120-226` | `TPL/user/forgottenPassword.mtt`, mails `TPL/mail/forgottenPassword.mtt`, `TPL/mail/newPasswordConfirmed.mtt` | 4-step password reset (see Flow 3.3) |
| HX | `/user/joingroup` | `User.doJoingroup` `User.hx:231-266` | none (redirect `/` with Ok message) | logged user joins the **current session group** if `regOption==Open`; mails group contact if user was not yet member |
| HX | `/user/quitGroup/<group>/<user>/<key>` | `User.doQuitGroup` `User.hx:271-307` | `TPL/account/quit.mtt` -> React `quitGroup` | email-footer link, works logged-out; key = `sha1(KEY+groupId+userId)` (MD5 legacy accepted `User.hx:273-280`) |
| HX | `/user/quitGroupFromMessage/<group>/<key>` | `User.doQuitGroupFromMessage` `User.hx:312-349` | `TPL/account/quit.mtt` | link from messaging footer; key = `sha1(KEY+groupId)`; needs login (redirects with `__redirect` if not) |
| HX | `/account` | `Account.doDefault` `HX/controller/Account.hx:23-54`, `@logged` | `TPL/account/default.mtt` -> React `userAccount` + `deleteAccount` | "my account"; `?lang=xx` stores `User.lang` (`Account.hx:46-51`) |
| HX | `/account/editNotif/<user>/<key>` | `Account.doEditNotif` `Account.hx:59-68` | `TPL/account/editNotif.mtt` -> React `editNotifications` | email-footer link; key = `sha1(KEY+userId)` |
| HX | `/account/quitGroup/<groupId>` | `Account.doQuitGroup` `Account.hx:70-74` | none | clears `session.data.amapId` if it equals groupId (no output; called after TS quit, caller unverified) |
| HX | `/member` | `Member.doDefault` `HX/controller/Member.hx:26-36` | `TPL/member/default.mtt` -> React `members` (`TPL/member/default.mtt:5-12`) | members list; passes `groupId`, CSRF `token`, `basePath` |
| HX | `/member/view/<id>` | `Member.doView` `Member.hx:38-83` | `TPL/member/view.mtt` | member sheet (orders, subscriptions, notification flags); `canLoginAs` flag (`Member.hx:49`); buttons: payments, movetowl, loginas, `_Camap.membershipBox` (`TPL/member/view.mtt:46,102,106,213`) |
| HX | `/member/loginas/<id>` | `Member.doLoginas` `Member.hx:89-103` | `TPL/member/loginAs.mtt` -> React `loginAs` | HX session switched to member (`session.setUser`), `amapId` cleared; the React module then calls GraphQL `loginAs` and `goTo('/')` (`FE/modules/loginRegistration/LoginAs.module.tsx:22-37`) |
| HX | `/member/edit/<id>` | `Member.doEdit` `Member.hx:108-111` | `form.mtt` | **empty body** (dead) |
| HX | `/member/delete/<id>?token=&confirm=` | `Member.doDelete` `Member.hx:116-135` | none | remove user from current group (see rule R30) |
| HX | `/member/movetowl/<id>` | `Member.doMovetowl` `Member.hx:215-223` -> `WaitingListService.moveBackToWl` (`HX/service/WaitingListService.hx:75-93`) | none | move a member back to waiting list |
| HX | `/member/payments/<id>`, `/member/balance`, `/member/invoice/<m>/<md>` | `Member.hx:140-210` | `TPL/member/{payments,balance,invoice}.mtt` | payments/balance/invoice (payments area; listed for completeness) |
| HX | `/home` | `Main.doHome` `HX/controller/Main.hx:66-174` | `TPL/home.mtt` | login gate: no user + no open group -> `/user/login`; user w/o group -> `/user/choose`; disabled group -> `/group/disabled`; shows PhoneRequired/AddressRequired nags (`Main.hx:135-145`) |
| HX | `/invite/<hash>/<email>/<group>[/<userId>]` | `Main.doInvite` `Main.hx:308-324` | `TPL/invite.mtt` -> `_Camap.registerBox` pre-filled | invitation link, `hash=sha1(KEY+email)`; if `userId` given: `UserGroup.getOrCreate` immediately |
| HX | `/` (permalink), `/ping`, `/tos`, `/cgu` | `Main.hx:34-53,326,358-364` | none | maintenance gate (admins bypass `Main.hx:36-41`), permalink dispatcher, version JSON, TOS redirect |
| HX | `/api/user/me` (GET/POST) | `controller.api.User.doMe` `HX/controller/api/User.hx:18-39` | JSON | GET `infos()`; POST updates address1/address2/city/zipCode/phone for the **HX-session** user |
| HX | `/api/user/getFromGroup` | `api/User.hx:44-53`, `@logged` | JSON | members of current group (needs Membership right or contract-manager); used by `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:44` |
| HX | `/api/user/getToken` | `api/User.hx:56-64`, `@logged` | JSON | JWT signed with HX `key`; **no caller found** (grep) |
| HX | `/api/createSid` | `HX/controller/Api.hx:76-90` | JSON | dev only (`config.DEBUG`), creates anonymous session |

### 2.2 HX routes (groups / amapadmin / admin)

| side | route | handler | template/component | purpose |
|---|---|---|---|---|
| HX | `/group/<id>` | `Group.doDefault` `HX/controller/Group.hx:22-76` | `TPL/group/view.mtt` | public group page; disabled -> redirect `/group/disabled/<id>`; if `regOption==Open` stores group in session (`Group.hx:29-36`, even for anonymous visitors) |
| HX | `/group/list/<id>` | `Group.doList` `Group.hx:82-115` | `form.mtt` | register to waiting list (needs login, `regOption==WaitingList`) via `WaitingListService.registerToWl` |
| HX | `/group/listCancel/<id>` | `Group.doListCancel` `Group.hx:120-127` | none | leave waiting list |
| HX | `/group/create` | `Group.doCreate` `Group.hx:132-187` | `form.mtt` | create group: **only superadmin** (`Group.hx:136-139`) |
| HX | `/group/map`, `/group/csa` | `Group.hx:189-202` | `TPL/group/map.mtt`, `csa.mtt` | map / CSA landing |
| HX | `/group/disabled[/<id>]` | `Group.doDisabled` `Group.hx:204-209` | `TPL/group/disabled.mtt` -> React `groupDisabled` | blocked-group notice |
| HX | `/amap`, `/amap/edit` | `HX/controller/Amap.hx:18-33,35-79` | `TPL/amap/default.mtt`, `form.mtt` | (default = list of current/ended catalogs, other area). `edit` = group settings form (name, contact, texts, extUrl, regOption, flags HidePhone/PhoneRequired/AddressRequired, legalRepresentative); needs `isAmapManager` (`Amap.hx:37-38`) |
| HX | `/amapadmin` | `AmapAdmin.doDefault` `HX/controller/AmapAdmin.hx:74-81` | `TPL/amapadmin/default.mtt` | group admin dashboard; constructor gate `isAmapManager` (`AmapAdmin.hx:27`) |
| HX | `/amapadmin/membership` | `AmapAdmin.doMembership` `AmapAdmin.hx:39-72` | `TPL/amapadmin/form.mtt` | edit `hasMembership`, `membershipFee` (IntInput), `membershipRenewalDate` |
| HX | `/amapadmin/rights` | `AmapAdmin.doRights` `AmapAdmin.hx:83-90` | `TPL/amapadmin/rights.mtt` | list users having any stored right |
| HX | `/amapadmin/editRight[/<userId>]` | `AmapAdmin.doEditRight` `AmapAdmin.hx:93-199` | `TPL/amapadmin/form.mtt` | grant/modify rights of a member |
| HX | `/amapadmin/vatRates`, `/currency`, `/payments`, `/volunteers`, `/documents`, `/media` | `AmapAdmin.hx:201-340` | forms | group settings of other areas (not detailed here) |
| HX | `/admin/user[/search/view/delete/userGroup]` | `HX/controller/admin/User.hx:10-74`, `@admin` | `TPL/admin/user/*.mtt` | superadmin user search/view/delete/usergroup sheet; delete calls TS bridge `delete-user` (`admin/User.hx:44-55`) |
| HX | `/admin/group[/view/addMe/deleteGroup]` | `HX/controller/admin/Group.hx:10-112` | `TPL/admin/group/*.mtt` | superadmin group list (raw SQL with string concatenation `admin/Group.hx:21-55`), view, add self as member (`:98-102`), delete group (`:104-112`) |
| HX | `/admin/superadmins` | `HX/controller/admin/Admin.hx:207-209` | `TPL/admin/superadmins.mtt` | list users with `rights.has(Admin)` |
| HX | `/db` | `Main.doDb` `Main.hx:302-306`, `@admin` | sugoi DB admin | raw DB admin (can edit `User.rights`, `Group.disabled`...) |

### 2.3 TS GraphQL (all at `/graphql`)

Guard legend: `GqlAuthGuard` = JWT required (`API/common/guards/gql-auth.guard.ts:5`), `MaybeAuthGuard` = JWT or anonymous (`maybe-auth.guard.ts:5`). Guard behaviour in Flow 3.2.

| side | operation | handler | consumer | purpose / authorization actually enforced |
|---|---|---|---|---|
| TS | `mutation login(input{email,password,sid})` | `API/auth/auth.resolver.ts:46-62` | `FE/modules/loginRegistration/LoginBox.tsx:48` | validates `loginSchema`, login, sets 3 cookies; public |
| TS | `mutation recordBadLogin` | `auth.resolver.ts:64-67` | `LoginBox.tsx:66` | increments IP ban counter; public, unauthenticated |
| TS | `mutation register(input)` | `auth.resolver.ts:69-107` | `FE/modules/loginRegistration/RegistrationBox.tsx:75,105` | register + login + optional join `invitedGroupId`; public |
| TS | `mutation logout` | `auth.resolver.ts:109-124` (`MaybeAuthGuard`) | `FE/gql/mutations/auth.gql:7` | deletes Session row + refresh token, expires 3 cookies |
| TS | `mutation loginAs(userId, groupId?)` | `auth.resolver.ts:126-152` (`GqlAuthGuard`) | `FE/modules/loginRegistration/LoginAs.module.tsx:22` | impersonation (authorization is defective, see C3) |
| TS | `query isEmailRegistered(email)` | `auth.resolver.ts:154-159` | `FE/modules/loginRegistration/loginRegistration.gql:18-20` | public; matches `email` or `email2` |
| TS | `query me` | `API/users/users.resolver.ts:56-60` | front | current user |
| TS | `query user(id)` | `users.resolver.ts:62-66` | front | **any authenticated user can read any user by id** (no rights check) |
| TS | `query getUserFromControlKey(id, controlKey, groupId?)` | `users.resolver.ts:68-79` | `FE/modules/users/EditNotifications` etc. | public; `controlKey = sha1(CAMAP_KEY + [groupId] + userId)` (`API/common/utils.ts:63-75`, `API/tools/crypto.service.ts:15-20`) |
| TS | `query isGroupAdmin(groupId)`, `canManageAllCatalogs(groupId)` | `users.resolver.ts:81-97` | front | rights probes for current user |
| TS | `query getEmailRecipientsByUserIds(inGroup, ids)` | `users.resolver.ts:99-119` | messages module | **bug**: `canManageMessages` is async and not awaited, so the `if` is always truthy (`users.resolver.ts:106`, `user-groups.service.ts:116-118`) |
| TS | `query getUsersFromEmails(emails)` | `users.resolver.ts:121-127` | `FE/modules/members/members.gql.ts:140` | any authenticated user can resolve emails to full user records |
| TS | `query getInvitedUserToRegister(email)` | `users.resolver.ts:129-140` | `loginRegistration.gql:1-16` | **public**; reads cache `invitation-<sha1(KEY+email)>` -> prefill data (name, phone, address) |
| TS | `mutation updateUser(input)` | `users.resolver.ts:159-176` | `FE/modules/users/UserAccountModule/userAccount.gql:49` | self only (`input.id === currentUser.id`); validates yup schemas; email uniqueness check |
| TS | `mutation updateUserNotifications(input{userId,controlKey?,flags})` | `users.resolver.ts:178-196` (`MaybeAuthGuard`) | `userAccount.gql:66`, `EditNotifications.module.tsx` | JWT user = self, or valid control key |
| TS | `mutation deleteAccount(userId, password)` | `users.resolver.ts:198-247` | `FE/modules/users/DeleteAccountModule/deleteAccount.gql:1-3` | self only + password re-check |
| TS | `query userGroup(groupId,userId)` + field `hasValidMembership` | `API/groups/resolvers/userGroups.resolver.ts:23-67` | front | needs GroupAdmin/ContractAdmin(any)/Membership right |
| TS | `query group(id)`, `mutation quitGroup`, `quitGroupByControlKey`, `setGroupImage` | `API/groups/resolvers/groups.resolver.ts:43-55,94-150,152-195` | `userAccount.gql:79-92`, `QuitGroup.module.tsx` | group read needs GroupAdmin; quit = self or control key |
| TS | `query groupPreview(id)` (public), `groupPreviews`, `groupPreviews2`, `getGroupsOnMap`, `myGroups` | `API/groups/resolvers/group-previews.resolver.ts:38-115` | `FE/modules/groupDisabled/groupDisabled.module.gql:1-8` | public group info incl. `disabled` |
| TS | `query groupPreviewMembers(id)` | `API/groups/resolvers/group-previews-members.resolver.ts:44-59` | members module | needs Membership right |
| TS | `mutation removeUsersFromGroup`, `importAndCreateMembers`, `sendInvitesToNewMembers` | `group-previews-members.resolver.ts:61-373` | `FE/modules/members/members.gql.ts:94,150,167` | need Membership right |
| TS | `query getUserLists(groupId)`, `getContractsUserLists`, `getDistributionsUserLists`, `getUserListInGroupByListType` | `API/groups/resolvers/userLists.resolver.ts:23-25,38,176,203,253` | `members.gql.ts:8,25` | **only JWT required, no per-group right check** (C5) |
| TS | `query getWaitingListsOfGroup(groupId)` | `API/groups/resolvers/waitingLists.resolver.ts:40-45` | `members.gql.ts:53` | **no right check** (C5) |
| TS | `mutation moveBackToWaitingList`, `approveRequest`, `cancelRequest` | `waitingLists.resolver.ts:47-221` | `members.gql.ts:71,109,117` | need Membership right |
| TS | `query getUserMemberships`, `getMembershipFormData`; `mutation createMembership`, `createMemberships`, `deleteMembership` | `API/groups/resolvers/memberships.resolver.ts:48-278` | `FE/modules/membership/membership.gql.ts:4-40`, `members.gql.ts:125` | need Membership right (`memberships.resolver.ts:283-299`) |

### 2.4 TS REST (bridge, bearer = `CAMAP_KEY`)

| side | route | handler | purpose |
|---|---|---|---|
| TS | `GET /bridge/auth/tokens/:id` | `API/auth/controllers/auth-bridge.controller.ts:21-32` | returns a signed JWT (access secret) for user; HX wrapper `BridgeService.getAuthToken` (`HX/service/BridgeService.hx:88-93`) has **no caller** (grep) |
| TS | `GET /bridge/auth/logout/:id` | `auth-bridge.controller.ts:34-46` | clears `currentRefreshToken` (called by `User.doLogout`) |
| TS | `GET /bridge/auth/delete-user/:id` | `auth-bridge.controller.ts:48-60` | `UsersService.delete` (called by `HX/controller/admin/User.hx:44-55`) |

---

## 3. Business rules (numbered)

### Identity, registration, login
1. A User = one household: up to 2 persons (`firstName/lastName/email/phone` + `*2`) (`HX/db/User.hx:30-38`, `API/users/models/user.entity.ts:39-61`).
2. DB uniqueness: unique index on `email` only; `email2` has a non-unique index (`API/users/models/user.entity.ts:18-19`, `HX/db/User.hx:20`). Application rule: a primary or secondary email cannot be used by another account (HX `User.check()` `HX/db/User.hx:537-548`; TS `UsersService.update` `API/users/users.service.ts:137-145`). TS `register` only checks the primary email via `findOneByEmail` (matches `email` OR `email2`) (`API/auth/auth.service.ts:98-101`).
3. Login accepts primary or secondary email (`API/users/users.service.ts:94-103`).
4. HX normalizes on every save: emails lower-cased, last names upper-cased (`HX/db/User.hx:524-535`). TS does not (no normalization in `register`/`update`; grep `toLowerCase`/`toUpperCase` in `API/auth`, `API/users` finds none).
5. Registration (TS only): yup `userRegistrationSchema` = firstName, lastName, email required, password >= 8, `confirmPassword` must match, `tos` must be true (`COMMON/validators/registrationSchema/userRegistrationSchema.ts`, `userSchema.ts`); phone validated if given (`COMMON/validators/registrationSchema/phoneSchema.ts`), address validated (non-required) if any of zip/address/city given (`auth.resolver.ts:76-80`). Phone/address "required by group" is enforced only client-side (`RegistrationBox.tsx:186-202`).
6. New user defaults: `lang='fr'`, flags `HasEmailNotif24h` set, `cdate=now`, `email2` dropped if equal to `email` (`API/auth/auth.service.ts:103-120`, `API/users/users.service.ts:318-324`); HX defaults identical (`HX/db/User.hx:57-68`).
7. Password hashing: `pass` = `md5(KEY + password)` (legacy), `pass2` = bcrypt(cost 10) (`API/tools/crypto.service.ts:22-28`, `auth.service.ts:311-317`). HX `setPass` = `md5(KEY + trim(password))`, writes only `pass` (`HX/db/User.hx:274-281`). `KEY` = HX config `key` = TS `CAMAP_KEY` (`API/tools/crypto.service.ts:12`).
8. Password check order (TS): bcrypt on `pass2` if non-empty; else MD5 on `pass`; on MD5 match, bcrypt is computed and stored in `pass2` (lazy migration) (`auth.service.ts:319-346`). `pass` is still written on registration (`auth.service.ts:115`).
9. Login: lookup by email (row lock); optional IP ban check; password check; set `ldate=now`; load HX `Session` by `sid` (error `Session not found with sid ...` if missing), set `uid` and `lastTime`; build JWT cookies (`auth.service.ts:40-81`). `ldate IS NULL` means "never logged in" (used for "new users" list: `API/groups/services/user-groups.service.ts:190-200`).
10. Brute-force: ban when the cache counter for the IP is >= 5; counter TTL 10 min, TTL refreshed on every increment; disabled when env `DISABLE_BRUTE_FORCE=='true'` (`auth.service.ts:50-56,280-309`). The counter is incremented only by the separate public mutation `recordBadLogin`, which the React login box calls after a `wrongPassword` error (`LoginBox.tsx:65-68`); the `login` mutation does not increment it.
11. Tokens: access token payload `{email,id}` signed with `JWT_ACCESS_TOKEN_SECRET`, TTL `JWT_ACCESS_TOKEN_EXPIRATION_TIME` seconds; refresh token signed with `JWT_REFRESH_TOKEN_SECRET`, TTL `JWT_REFRESH_TOKEN_EXPIRATION_TIME`; refresh token bcrypt-hashed into `User.currentRefreshToken` (one refresh token per user, so one active browser login at a time) (`auth.service.ts:224-270`, `API/users/users.service.ts:188-220`, env schema `API/envSchema.ts:12-16`). Cookie attributes: `HttpOnly` except when `NODE_ENV=development`, `Path=/`, `Domain=<CAMAP_HOST without https://>` (none in dev) (`auth.service.ts:348-357`). `Auth_sid` cookie lifetime = refresh TTL (`auth.service.ts:272-278`).
12. Logout (TS): delete Session row for cookie `Auth_sid`, null the refresh token, expire the 3 cookies in one `Set-Cookie` array (`auth.service.ts:175-203`). Logout (HX): bridge call, `Refresh` cookie expired with `Domain` = HOST minus leading `app.`, delete Session, then 2 more redirects to expire `Authentication` and `Auth_sid`, finally `/user/login` (`User.hx:82-114`).
13. HX sessions are purged by the HX cron `sugoi.db.Session.clean()`: logged sessions older than 30 days, anonymous older than 3 days (`HX/controller/Cron.hx:378-382`, `SUGOI/db/Session.hx:120-125`). TS never purges sessions.
14. Sessions also accept a `sid` URL/POST parameter before the cookie (`SUGOI/BaseApp.hx:212-216`).
15. Superadmin impersonation, HX side: `/member/loginas/<id>` allowed for superadmin, or for a group manager (`isAmapManager`) when target is not superadmin and belongs to exactly <= 1 group (`HX/controller/Member.hx:92-96`); the member sheet shows the button when target has exactly 1 group and viewer is group manager, or viewer is admin (`Member.hx:49`). TS side `loginAs` mirrors this but see C3.

### Guard behaviour (TS)
16. `GqlAuthGuard` flow: (a) if cookies `Auth_sid` and `sid` both exist and differ -> error `Neko/Nest logged state sync error`; (b) valid access token -> passport jwt; (c) else refresh token cookie must verify AND match the bcrypt hash in DB, then new access+refresh tokens are issued and cookies written; (d) on any failure (outside `NODE_ENV=test`): delete session + refresh token of `Auth_sid`, clear the 3 cookies, deny (or, for `MaybeAuthGuard`, continue anonymously via `void` strategy) (`API/common/guards/gql-auth-abstract-guard.ts:81-92,160-228`). `getUserIfRefreshTokenMatches` can return `undefined` and the guard then calls `getAccessToken(user)` on it (`gql-auth-abstract-guard.ts:195-200`, `users.service.ts:188-202`), which throws and is caught by (d).
17. `BlackListGuard` (IP list in variable `ipBlacklist`, UA containing "python") exists (`API/common/guards/black-list.guard.ts`); where it is applied is not covered here (unverified).

### Users profile / account
18. Self edit (`updateUser`): only own id, yup validated, email must not be used by another account (incl. as `email2`), empty strings stored as NULL (`users.resolver.ts:159-176`, `users.service.ts:124-147`). Changing email needs no password and no verification mail; JWT payload still carries the old email until next token issue (payload email never read back: `jwt.strategy.ts:22-29`).
19. Editable via TS: names, emails, phones, address1/2, zip, city, nationality, countryOfResidence, birthDate (`API/users/dto/update-user.input.ts:3-52`). Not editable via TS: password, lang. Password can only be changed through the HX reset flow. `lang` is editable via HX `/account?lang=xx` (`Account.hx:46-51`). Birthday >= 18 years rule exists only in HX `UserService.isBirthdayValid` (`HX/service/UserService.hx:55-59`), no TS equivalent found.
20. Notification flags (`HasEmailNotif4h`=0, `HasEmailNotif24h`=1, `HasEmailNotifOuverture`=2, identical in both sides: `HX/db/User.hx:7-11`, `API/users/models/user-flags.ts:1-5`) editable by self (JWT) or with control key = `sha1(KEY + userId)` (`users.resolver.ts:178-196`; HX link `HX/db/User.hx:561-564`).
21. Display names (`LASTNAME Firstname`, couple name) are duplicated on purpose in `COMMON/utils/user-utils.ts:1-17` "please keep consistent with methods found on db.User" (`HX/db/User.hx:228-261`).

### Account deletion / RGPD
22. Self deletion (`deleteAccount`): user must be the current user and give the password (`users.resolver.ts:200-212`); then `UsersService.delete` (rules 23), logout, then email to each group admin ("a member deleted his account") (`users.resolver.ts:214-246`).
23. `UsersService.delete` refuses (HTTP 401) if: the user has any user-order (as user or user2) dated in the last 2 months, or any `UserGroup.balance < 0`; then re-attributes to the placeholder user `deleted@camap.tld` (not created by code, must exist): catalog contacts, group contacts (`Group.userId`), baskets/orders, operations with non-zero amount (zero-amount ops are deleted), CSA subscriptions; finally deletes the user (`users.service.ts:331-436`). If the placeholder does not exist or is the user itself it returns `null` without deleting (`users.service.ts:333-340`). Memberships and UserGroups are not touched explicitly (DB cascades on `UserGroup` FK: `API/groups/entities/user-group.entity.ts:23-24`; cascade for `Membership` unverified).
24. Superadmin deletion (HX `/admin/user/delete/<id>`) = same TS delete through bridge; errors are swallowed (`HX/controller/admin/User.hx:44-55`).
25. Inactive purge (TS cron `UsersService.cleanUsers`, daily 01:00): warning emails (template `deletionWarning.twig`) to users whose `ldate` is exactly 1 month, 2 weeks and 3 days before the 2-year mark (day-equality match; users with `ldate NULL` are never warned); users with an active membership (any group, membership year = current or previous calendar year) are excluded from warnings (`users.service.ts:441-517`). Deletion: `ldate < now-2y` OR (`ldate IS NULL` AND `cdate < now-6 months`), excluding users with an active membership or any order newer than 2 years, then `delete()` (so rule 23 also applies) (`users.service.ts:545-604`). The purge is per-row async callbacks on a stream, not awaited (`users.service.ts:567-603`). Documented as "crons" elsewhere (see doc 08).

### Rights
26. Superadmin: `User.rights` bit 0. HX: `rights.has(Admin)` (`HX/db/User.hx:74-76`). TS: `hasFlag(0, rights)` in `UserEntity.isSuperAdmin` (`user.entity.ts:123-125`) but most checks use the literal `user.rights === 1` (`API/groups/services/user-groups.service.ts:95,104,136,166`, `API/common/decorators/is-admin.decorator.ts:19`; 8 occurrences of `rights === 1` vs 8 of `isSuperAdmin()` in `API/`, count by grep).
27. Group rights JSON examples and semantics (HX `UserGroup`): `hasRight` returns true for any superadmin (`HX/db/UserGroup.hx:151-153`); `ContractAdmin` with `params==null` = all catalogs, otherwise list of catalog ids as strings (`UserGroup.hx:155-168`); other rights are boolean by name (`:170-176`). Rights do not imply each other (GroupAdmin does not grant Membership/Messages/ContractAdmin). `getRights()` = stored rights + auto rights (vendor-claimed catalogs) (`UserGroup.hx:72-84`).
28. Capability map (HX): group manager = `isAmapManager` = superadmin, or `UserGroup` with `GroupAdmin`, evaluated on the **session group** (`HX/db/User.hx:120-134`); `canAccessMembership` / `canAccessMessages` / `canManageAllContracts` / `isContractManager` / `canManageContract` / `canManageVendor` (`User.hx:162-222`, `:203-213`). TS equivalents: `UserGroupsService.isGroupAdmin/canManageMembers/canManageMessages/canManageAllCatalogs/canManageCatalog` (`user-groups.service.ts:90-171`). TS does **not** compute auto rights except in `canManageCatalog` (claimed vendor check, `:139-140`).
29. Rights editing (HX only): `/amapadmin/editRight` — group manager only; form offers GroupAdmin, Membership, Messages + "All catalogs" / each active catalog; saving rewrites the whole stored list (`ua.rights="[]"` then `giveRight` per choice, each call persists) (`AmapAdmin.hx:93-199`, `HX/db/UserGroup.hx:89-110`); a manager cannot remove their own GroupAdmin (`AmapAdmin.hx:174-179`); auto rights shown read-only (`:143,148`). No TS mutation edits `UserGroup.rights`.
   Group creation grants the creator GroupAdmin, Membership, Messages, ContractAdmin(all) (`Group.hx:163-170`).
30. Removing a member (HX `/member/delete`): CSRF token required, needs `canAccessMembership`, cannot delete self, if the user has orders with `quantity>0` in the group a `confirm=1` is required, then deletes the `UserGroup` row (`Member.hx:116-135`). TS `removeUsersFromGroup`: needs Membership right, cannot remove self, cannot remove group admins (superadmins count as admin), then deletes the `UserGroup` rows (no order/balance check) (`group-previews-members.resolver.ts:61-108`).
31. `/member/*` access (HX): the controller constructor redirects to `/` unless superadmin or `canAccessMembership` (`Member.hx:23`), so a GroupAdmin without the `Membership` right cannot open any `/member` page; `Main.doMember` is `@logged` (`Main.hx:222-226`).
32. TS rights checks per resolver: Membership right for group member management, waiting list approve/cancel/move, memberships CRUD (`canManageMembers` -> `hasRight(Membership)`: `user-groups.service.ts:120-126,160-171`); `group(id)` and `setGroupImage` need GroupAdmin (`groups.resolver.ts:200-209`); `userGroup(...)` accepts GroupAdmin OR any ContractAdmin OR Membership (`userGroups.resolver.ts:29-45`).

### Groups
33. `regOption`: HX enum order Closed=0, WaitingList=1, Open=2, Full=3 (`HX/db/Group.hx:26-31`), TS numeric enum identical (`API/groups/types/interfaces.ts:14-19`). Default for new `Group` object = Open (`Group.hx:102`); groups created through `/group/create` are set to WaitingList (`HX/controller/Group.hx:159`).
34. Joining: Open -> user can join directly: via `/user/joingroup` (creates `UserGroup`, mails group contact if not member before) (`User.hx:231-266`), via registration with `invitedGroupId` (TS `register`, no regOption check: `auth.resolver.ts:99-104`), via `/invite/...` links (`Main.hx:308-324`). WaitingList -> `/group/list/<id>` creates a `WaitingList` row and mails GroupAdmin/Membership holders (`WaitingListService.hx:10-41`), a member with Membership right approves (creates `UserGroup`, deletes the WL entry, mails user + other member-managers) or refuses (mails user) in the React members module (`waitingLists.resolver.ts:113-221`, `:114-162`). Closed/Full -> only managers add members (`importAndCreateMembers`, `sendInvitesToNewMembers`). The `Full` option has no code path of its own besides the label (`HX/App.hx:304`).
35. Adding members (TS, Membership right): `importAndCreateMembers` registers missing users with empty password (`pass`=md5(KEY+'') and `pass2`=bcrypt('')), creates `UserGroup`, stores `chp-<sha1(KEY+email)> -> "i<userId>"` in Cache (2 weeks) and mails a link `/user/forgottenPassword/<token>/<userId>/true` so the new user defines a password in HX; existing users are added and mailed `/group/<id>` (`group-previews-members.resolver.ts:112-263`). `sendInvitesToNewMembers` only mails: link `/invite/<sha1(KEY+email)>/<email>/<groupId>[/<userId>]`, invited-user data cached 2 weeks under `invitation-<sha1>` (`:267-373`).
36. Quit group: allowed when `balance >= 0` and no recent orders. HX: no order in any active catalog (incl. ended <1 month) distribution (`User.hx:281-302`). TS: balance >= 0 and no "recent" user orders (< 1 month per message) via `OrdersService.findRecentUserOrders` (`groups.resolver.ts:130-147`); then delete the `UserGroup`. Group id 16936 can never be quit (hard-coded) (`groups.resolver.ts:124-128`). Quit by control key = `sha1(KEY+groupId+userId)` (`groups.resolver.ts:104-117`, `HX/db/User.hx:553-556`).
37. Group "disabled": `Group.disabled` nullable enum `BLOCKED_BY_ADMIN | MOVED | SUSPENDED` (`HX/db/Group.hx:33-38`, migration `API/migrations/1741445966001-group-disabled.ts:7`). Effects: group public page and `/home` redirect to `/group/disabled` (`Group.hx:25-27`, `Main.hx:84-86`), HX crons skip such groups (`HX/controller/Cron.hx:110,170`); React page shows reason label, and for `MOVED` a button to `extUrl` (`FE/modules/groupDisabled/GroupDisabled.module.tsx:22-34`). No HX or TS code path that **sets** `Group.disabled` was found (grep), so it is set by DB/`/db` admin or externally.
38. Group flags: only `HidePhone`, `PhoneRequired`, `AddressRequired` are editable in `/amap/edit` (form excludes ordinals 0-5 and 9-12; 11/12 values preserved on save) (`HX/controller/Amap.hx:44-73`). Flags used for auth UX: `PhoneRequired`/`AddressRequired` feed `loginBoxOptions` (`HX/service/UserService.hx:61-74`).
39. Group duplication helper `GroupService.duplicateGroup` (copies settings, no member) (`HX/service/GroupService.hx:23-48`); no caller checked here (unverified). `GroupService.getGroupMembersWithRights` returns users with any / given rights (`:53-72`).
40. Group creation: HX only, superadmin only; creator becomes member with 4 rights; `hasMembership=true`, `regOption=WaitingList`, allowed payments cash+check; also creates the first Place and geocodes (`Group.hx:132-187`). TS has no group creation mutation (grep `createGroup` in `API/`: none).

### Membership (cotisation)
41. Settings on `Group`: `hasMembership` bool, `membershipFee` (tinyint both sides: max 127), `membershipRenewalDate` (date) — edited in HX `/amapadmin/membership` (`AmapAdmin.hx:39-72`, `HX/db/Group.hx:58-59,65`, `API/groups/entities/group.entity.ts:54-58,111-112`). Legacy deprecated flag `__HasMembership` (ordinal 0) is a different thing.
42. Membership year: renewal date's month/day applied to the current year; if today is before it, year-1 else year (no renewal date: current year) (`HX/db/Group.hx:312-330`, `API/groups/services/memberships.service.ts:233-253`). Period name: `YYYY` if renewal month is January or February, else `YYYY-YYYY+1` (`Group.hx:350-356`, `memberships.service.ts:217-225`).
43. A user "has a valid membership" iff the group has a renewal date and a `Membership` row exists for (user, group, current membership year) — it does not look at `hasMembership` in HX (`HX/db/UserGroup.hx:223-228`) nor in TS `hasValidMembership` (`memberships.service.ts:198-212`); lists `membership`/`noMembership` return `[]` when `hasMembership` is false (`userLists.resolver.ts` `getUserListInGroupByListType`).
44. Create membership (TS, Membership right): group must have `hasMembership`; no existing row for same year (`membershipAlreayExists`); fee = given fee, else `group.membershipFee`, else error `You should define a membership fee` (a fee of `0` is treated as "not given"); creates a debt operation `-fee` (type Membership, label `Adhésion <period>`), then an immediate cash payment operation `+fee` linked to it, then the `Membership` row (`memberships.resolver.ts:147-191`, `memberships.service.ts:96-152`). `createMemberships` = batch with per-user "already exists" errors (`memberships.resolver.ts:193-249`). The input field `paymentType` is accepted but not used (payment is always cash: `memberships.service.ts:114`).
45. Delete membership: removes the related payment operations, the debt operation, recomputes balance, then the row (`memberships.service.ts:154-193`).
46. Form data: fee proposal + 6 selectable years (from -4 to +1 years around today) + distributions in [today-3 months, today+5 days] (`memberships.resolver.ts:89-119`).
47. HX membership helpers `MembershipService.getMembershipUsers/getNoMembershipUsers` (`HX/service/MembershipService.hx:25-56`) are the HX equivalent of TS user lists; HX itself has no code creating `Membership` rows (grep `new db.Membership`: none); the HX member sheet only opens the React dialog (`TPL/member/view.mtt:213`, `camap-hx/js/App.hx:286-296`).
48. Purge protection: any membership in current or previous calendar year (any group) protects a user from the inactive purge (`memberships.service.ts:77-87`).

---

## 4. Flows

### 4.1 Registration (TS)
1. Browser on an HX page (`/user/login` or invite page) mounts React `loginRegistration` with the HX `sid` (`TPL/user/login.mtt:29-33`, `TPL/invite.mtt`, `camap-hx/js/App.hx:259-284`). Registration tab prefilled from `getInvitedUserToRegister(email)` when invited (`RegistrationBox.tsx`).
2. `register` mutation: yup validation, `AuthService.registerAndLogin` -> `register` (email-not-registered check, md5+bcrypt hashes, flags, `lang='fr'`) -> `login` (see 4.2) (`auth.resolver.ts:69-107`, `auth.service.ts:84-156`).
3. If `invitedGroupId` is present: `UserGroup` row created for that group (`auth.resolver.ts:99-104`).
4. Response sets cookies `Authentication`, `Refresh`, `Auth_sid` (`auth.resolver.ts:164-183`); React redirects to `redirectUrl` (e.g. `/home` or `/user/joingroup`).
5. No welcome/confirmation email and no email verification in TS or HX registration path (none found in `auth.service.ts`/`auth.resolver.ts`).

### 4.2 Login / session sharing
1. HX page renders; sugoi creates/loads `Session` from cookie `sid` (`SUGOI/BaseApp.hx:210-221`); HX template passes `session.sid` to React.
2. `login(email,password,sid)` -> `AuthService.login` -> sets `User.ldate`, `Session.uid`, `Session.lastTime` for that sid -> returns JWT cookies + `Auth_sid=<sid>`.
3. Next HX request: sugoi loads `Session.user` => `app.user` set; HX has no further proof of identity.
4. Next GraphQL request: `GqlAuthGuard` checks `Auth_sid == sid` cookies (state sync), then JWT.
5. Mismatch handling: HX `/user/login` and `/home` redirect to `/user/logout` if `Auth_sid` is present but differs/user missing (`User.hx:32-37`, `Main.hx:70-77`).
6. Redirect after login: `view.redirect` from `redirect`/`__redirect` params (see C8) (`User.hx:41-48`).

### 4.3 Password reset (HX)
1. `GET /user/forgottenPassword` shows email form (step 1).
2. Submitted email: lookup `email` then `email2`; unknown -> error "This E-mail is not linked to a known account"; token = `md5("chp" + random(1e9))` stored in `Cache` (value user id, 30 days); mail with link `http://<HOST>/user/forgottenPassword/<token>/<userId>` (step 2) (`User.hx:146-172`).
3. Link: if `Cache.get(token) == userId` shows the 2-field new-password form with hidden `uid`; else "Invalid request" (step 3) (`User.hx:174-183`).
4. Submit `chpass`: if `pass1 == pass2` -> `setPass` (md5 into `pass`), `update`, destroy token, send "new password confirmed" mail (`User.hx:185-213`; the template does not print the password, `TPL/mail/newPasswordConfirmed.mtt`). See C1/C2.
5. `/user/forgottenPassword/<token>/<uid>/true` is the "create your password" variant used by TS member import (`definePassword`, title change only, `User.hx:225`).

### 4.4 Join / quit group
- Open group: `/group/<id>` stores the group in session (even anonymous) -> register/login -> `/user/joingroup` creates `UserGroup`.
- WaitingList group: `/group/list/<id>` -> `WaitingList` row -> admin approves in React members module (`approveRequest`).
- Invited: `sendInvitesToNewMembers` mail -> `/invite/...` -> register (prefilled, `invitedGroupId`) or join immediately.
- Quit: `/account` React module (`quitGroup` mutation, JWT) or email link `/user/quitGroup/...` (control key, `quitGroupByControlKey`) (`FE/modules/users/QuitGroup/QuitGroup.module.tsx`).

### 4.5 Group selection / home
`/home` requires a session group: logged without group -> `/user/choose`; `/user/choose?group=ID` sets `session.data.amapId` WITHOUT checking that the user is a member of that group (`User.hx:64-74`); subsequent HX rights are computed against that group.

### 4.6 Group creation (superadmin) 
`/group/create` form (group name + first Place) -> `Group` (`hasMembership=true`, `regOption=WaitingList`) + `UserGroup` + 4 rights + Place + geocode -> session group = new group, `newGroup=true`, redirect `/` (`Group.hx:132-187`).

### 4.7 Membership payment
React `membershipDialog` (`FE/modules/membership/MembershipDialog.module.tsx`, opened by `_Camap.membershipBox`) -> `getMembershipFormData` + `getUserMemberships` -> `createMembership`/`deleteMembership` (rules 44-45). From the members list: `createMemberships` (batch, `FE/modules/members/components/MembershipFeeDialog.tsx`).

### 4.8 Account deletion
`/account` -> React `deleteAccount` (password) -> `deleteAccount` mutation -> rule 22/23 -> logout cookies cleared -> mails to group admins.

---

## 5. HX <-> TS ownership today

| capability | HX | TS |
|---|---|---|
| Register | none | `register` |
| Login / logout | session write side effect only; logout redirect chain `User.hx:82-114` | `login`, `logout`, JWT, `Auth_sid` |
| Password reset / change | **yes** (only place) `User.hx:120-226` | none (only consumes the `chp-` cache key format in member import) |
| Email change | none (HX forms for users removed except API `/api/user/me` w/o email) | `updateUser` |
| Profile edit | `/api/user/me` POST (address/phone) | `updateUser` (React `userAccount`) |
| Notification flags | `Member.doView` display only | `updateUserNotifications` |
| Account deletion | superadmin delete -> bridge | `deleteAccount`, bridge `delete-user`, cron purge |
| Superadmin flag, backoffice | `/admin/*`, `/db` | `loginAs` only |
| Group creation | `/group/create` (superadmin) | none |
| Group settings (name, regOption, flags, membership settings, rights) | forms in `/amap/edit`, `/amapadmin/*` | `setGroupImage` only |
| Group public page / map / disabled | `/group/*` (map/disabled React) | `groupPreview*`, `getGroupsOnMap` |
| Current group selection | `session.data.amapId` | none (group passed as ids by HX to React/GraphQL) |
| Rights read | `HX/db/User.hx`, `UserGroup.hx` | `UserGroupsService` |
| Rights write | `/amapadmin/editRight` | none |
| Members list / import / invite / remove | `/member` page shell only; `/member/delete` still routable | React members module + resolvers |
| Waiting list: register | `/group/list`, `/group/listCancel` | none |
| Waiting list: approve/refuse/move back | `/member/movetowl` (still routable) | `approveRequest`, `cancelRequest`, `moveBackToWaitingList` |
| Quit group | `/user/quitGroup*` (page shell + checks) | `quitGroup`, `quitGroupByControlKey` |
| Membership settings | `/amapadmin/membership` | none |
| Membership CRUD | none (opens React dialog) | `memberships.resolver.ts` |
| Session purge | `Cron.hx:381` | none |
| Inactive user purge | none | `UsersService.cleanUsers` |

---

## 6. Documentation inconsistencies

(docs = `camap-ts/docs/users.md`, `groups.md`, `membership.md`)

D1. [CONFIRMED] `users.md` "Le champs `User.pass` n'est plus utilisé": false. TS still writes `pass=md5(KEY+password)` at registration (`API/auth/auth.service.ts:115`), still verifies against it as fallback (`:332-336`); HX `setPass` writes only `pass` (`HX/db/User.hx:274-281`); HX "new users" query uses `pass == ""` (`User.hx:500`). (verifier note: auth.service.ts:~114 writes `pass`)
D2. [CONFIRMED] `users.md` "Accès à un groupe ... aller chercher `amapId` dans `Session.data`": only possible in HX; `sdata` is a Neko-serialized blob that TS never decodes (`API/tools/models/session.entity.ts:29-30`; `SUGOI/db/Session.hx:50-58`). TS gets group ids from the caller.
D3. [CONFIRMED] `users.md` fail2ban paragraph: omits that the counter is only incremented by the separate `recordBadLogin` mutation called by the React client (`LoginBox.tsx:66`), threshold 5 failures, TTL 10 minutes, and the `DISABLE_BRUTE_FORCE` switch (`auth.service.ts:50-56,280-309`).
D4. [CONFIRMED] `users.md` authentication section describes only the JWT; it does not mention the refresh token cookie, `Auth_sid` cookie and sid-sync check, bridge bearer endpoints (`auth.service.ts:16-18`, `API/common/guards/gql-auth-abstract-guard.ts:81-92`, `auth-bridge.controller.ts`).
D5. [CONFIRMED] `users.md` "Le champs email est unique": only `email` has a unique index; `email2` uniqueness is application-level and not enforced by TS `register` (`API/users/models/user.entity.ts:18-19`; `auth.service.ts:98-120`).
D6. [CONFIRMED] `users.md` inactive purge section: omits conditions: never-logged users purged after 6 months, active membership and recent orders (2 years) excluded, `deleted@camap.tld` must exist else nothing is deleted, deletion also blocked by orders < 2 months / negative balance, and `ldate NULL` users get no warning (`users.service.ts:441-604`, `:333-359,373-388`).
D7. [CONFIRMED] `users.md` says registration/login "hacke camap-hx"; does not state that HX password reset is the only password-change path (no TS mutation), nor that password reset only updates `pass` (see C2).
D8. [CONFIRMED] `users.md` link "Main.hx#L77 ... URL /home": the group read is now at `HX/controller/Main.hx:79` (`doHome` starts `:66`); line 77 is the closing `}` of the `if (app.user == null)` block.
D9. [CONFIRMED] `groups.md` "regOption ... Ouvert, par liste d'attente, fermé...": incomplete, enum has 4 values Closed, WaitingList, Open, Full (`HX/db/Group.hx:26-31`). `disabled` values not listed (BLOCKED_BY_ADMIN, MOVED, SUSPENDED: `Group.hx:33-38`).
D10. [CONFIRMED] `groups.md` "Les droits sont cumulables. Si quelqu'un veut pouvoir tout faire ... cumuler tous les droits": superadmin has every right implicitly (`HX/db/UserGroup.hx:151-153`; `API/groups/services/user-groups.service.ts:95,166`); undocumented HX "auto rights" `ContractAdmin(cid)` for claimed-vendor catalogs (`UserGroup.hx:72-84`); right `params` semantics: `null` = all catalogs (the example JSON shows `["8"]` for one catalog, correct).
D11. [CONFIRMED] `groups.md` does not document: group creation (HX, superadmin only), waiting list (`WaitingList` table, HX register / TS approve), invitations, quit-group rules, `Group.disabled` behaviour, HX-only rights editor `/amapadmin/editRight`.
D12. [CONFIRMED] `membership.md` file names: says `membership.resolver.ts` / `membership.service.ts`; actual files are `memberships.resolver.ts` / `memberships.service.ts` (`API/groups/resolvers/`, `API/groups/services/`). "Le front et le back sont codés en TS" is incomplete: the settings form (`hasMembership`, fee, renewal date) is HX (`AmapAdmin.hx:39-72`) and the dialog is launched from HX templates (`TPL/member/view.mtt:213`).
D13. [CONFIRMED] `membership.md` "`Group.membershipFee` ... (optionnel)": creation fails if neither the request nor the group defines a fee, and `0` is treated as undefined (`memberships.service.ts:105-112`). Also: tinyint column limits fee to 127 (`group.entity.ts:57-58`).
D14. [CONFIRMED] `membership.md` omits: a membership both creates a debt and a cash payment operation (`memberships.service.ts:117-139`), membership protects users from inactive purge (`users.service.ts:478-486`), year/period naming rule (`memberships.service.ts:217-253`), `hasMembership` is not consulted by `hasValidMembership` (`:198-212`).

---

## 7. Code inconsistencies (hx/ts divergences, bugs, dead code)

Security-relevant ones first.

C1. [CONFIRMED] HX password reset step 4 does not verify the reset token. `chpassform.isValid()` only checks the form fields (sugoi `Form.isValid` does not check a token, `SUGOI/form/Form.hx` `isValid`/`isSubmitted` = `<name>_formSubmitted=="true"`); the target user id is taken from the hidden `uid` field and the key is only checked in step 3 for display (`HX/controller/User.hx:174-197`). Anyone who can POST the `chpass` form can set the password of any user id. (Reading of the code; not exercised.) (verifier note: SECURITY-RELEVANT; HX User.hx:~118-197: chpassform (Form "chpass") has hidden `uid` IntInput (:141-143); step 4 `chpassform.isValid()` only checks form fields (sugoi Form.hx:460-474, isSubmitted :507-514) and loads `User.manager.get(uid)` without validating `key`)
C2. [CONFIRMED] HX `setPass` updates only `pass` (md5), leaving `pass2` (bcrypt) untouched (`HX/db/User.hx:274-281`), while TS checks `pass2` first (`API/auth/auth.service.ts:324-330`): after an HX reset the **old** password keeps working until the user logs in once with the new one (md5 fallback then overwrites `pass2`, `auth.service.ts:338-343`). Also HX trims the password (`User.hx:278`), TS does not (`crypto.service.ts:22-24`). (verifier note: User.hx:274-281 setPass writes only `pass` (trim, md5); auth.service.ts isValidPassword (:~320-345) checks bcrypt pass2 first, then md5. SECURITY-RELEVANT (stale password keeps working))
C3. [CONFIRMED] TS `loginAs` authorization: `userGroupsService.isGroupAdmin(user, groupId)` is async and not awaited (always a truthy Promise), and it is called with the **target** user instead of `currentUser` (`API/auth/auth.resolver.ts:137-140`, `API/groups/services/user-groups.service.ts:90-100`); `user` is not null-checked (`:135`). Effect: any authenticated non-superadmin passing a `groupId` can impersonate any non-superadmin who belongs to <= 1 group. HX counterpart is correct (`HX/controller/Member.hx:92-96`) but the GraphQL mutation is callable directly. Also `loginAs` does not update `Session.uid` (HX session switch relies on the prior HX `/member/loginas` hop). (verifier note: SECURITY-RELEVANT; auth.resolver.ts:~127-148: `isGroupAdmin(user, groupId)` is `async` (user-groups.service.ts:90-100 returns Promise<boolean>) and not awaited, called with target `user`; only guard is GqlAuthGuard; `user` not null-checked)
C4. [CONFIRMED] Brute-force protection depends on the client: `login` never increments the counter (`auth.service.ts:58-61`); only `recordBadLogin` does (`:295-309`), public and called by the React box (`LoginBox.tsx:66`). `UserIp` reads `request.headers['X-Real-Ip']` (mixed-case key; Node lowercases header names) so it always falls back to `request.ip` (`API/common/decorators/user-ip.decorator.ts:7-9`). (verifier note: SECURITY-RELEVANT; user-ip.decorator.ts:7-9 reads headers["X-Real-Ip"] (Express lowercases header names so never set))
C5. [CONFIRMED] Missing authorization on TS reads: `getUserListInGroupByListType`, `getUserLists`, `getContractsUserLists`, `getDistributionsUserLists` only need a login (`API/groups/resolvers/userLists.resolver.ts:23`, no `canManage*` call in the file, grep); `getWaitingListsOfGroup` no check (`waitingLists.resolver.ts:40-45`); `user(id)` (`users.resolver.ts:62-66`), `getUsersFromEmails` (`:121-127`) any user; `getInvitedUserToRegister` is public and returns cached personal data by email (`:129-140`); `getEmailRecipientsByUserIds` right check un-awaited (`:106`). (verifier note: SECURITY-RELEVANT; userLists.resolver.ts has class-level GqlAuthGuard only and no canManage/isGroup* call (grep empty); waitingLists.resolver.ts:~36-41 same; users.resolver.ts: getUser (:62-66) and getUsersFromEmails guarded by login only, getInvitedUserToRegister has no guard, getEmailRecipientsByUserIds (:99-112) calls async canManageMessages un-awaited. Which fields are exposed depends on the GraphQL User type (not checked))
C6. [CONFIRMED] TS registration vs HX `User.check()`: email2 not checked for collisions (`auth.service.ts:98-120` vs `HX/db/User.hx:543-545`); no lower/upper-case normalization (`HX/db/User.hx:524-535`); `invitedGroupId` adds the user to **any** group with no `regOption` check and no invite-hash check (`auth.resolver.ts:99-104`), while HX `doJoingroup` requires `Open` (`User.hx:238-239`). (verifier note: SECURITY-RELEVANT; auth.resolver.ts:~99-104 `invitedGroupId` -> userGroupsService.create with no regOption/invite-hash check (hash check not present in the shown block))
C7. [CONFIRMED] HX `/invite/<hash>/<email>/<group>/<user>`: hash is `sha1(KEY+email)` only, so the `group` and `user` segments are not authenticated; a valid hash for any email lets the visitor add any `user` id to any group (`HX/controller/Main.hx:308-318`). Also sets `session.data.amapId` before validation of membership. (verifier note: SECURITY-RELEVANT; Main.hx:~308-318 verifies only sha1(KEY+userEmail); `group` and `user` are dispatch params not covered by the hash; getOrCreate(user, group))
C8. [CONFIRMED] HX `doLogin`: `view.redirect = app.params.exists("redirect")` assigns a Bool instead of the param value (`HX/controller/User.hx:42-43`); `Main.doHome` compares `Auth_sid` to `view.sid` that is never set there (`Main.hx:70-77`; only `User.doLogin` sets `view.sid`, `User.hx:30`), so with a non-null `Auth_sid` cookie and no user it always redirects to logout. `@logged` redirect param `__redirect` goes to `/`, whose handler redirects to `/home` dropping it (`SUGOI/BaseApp.hx:131`, `Main.hx:34-47`; end-to-end behaviour unverified). (verifier note: User.hx:42-43 `view.redirect = app.params.exists("redirect")` (Bool); Main.hx:~70-77 compares to `view.sid`)
C9. [CONFIRMED] TS `removeUsersFromGroup` pushes `userNotInGroup` errors but keeps the `null` entries, then calls `delete(ug)` on them (`group-previews-members.resolver.ts:85-104`): `userGroup.groupId` on `null` throws; index shifting after `splice` also misaligns `users`/`userGroups` (`:93-100`). `moveBackToWaitingList` has the same splice-inside-`forEach` misalignment (`waitingLists.resolver.ts:78-83`); unlike HX it does not reject users already in the waiting list (`HX/service/WaitingListService.hx:83-84`). TS removal has no order/balance check unlike HX `Member.doDelete` (`Member.hx:121-124`). (verifier note: resolver does call userIsAllowedToManageMembers (group-previews-members.resolver.ts:76); `userGroups` keeps null entries and user-groups.service.ts:336-340 `delete(ug)` dereferences ug.groupId)
C10. [CONFIRMED] `deleteAccount` continues after a `null` result (placeholder user `deleted@camap.tld` missing): the user is not deleted yet is logged out and admins are emailed "deleted his account" (`users.resolver.ts:224-246`, `users.service.ts:333-337`). (verifier note: users.service.ts:333-337 returns null when deleted@camap.tld is missing; users.resolver.ts continues to logout + email)
C11. [CONFIRMED] Quit-group rules differ: HX checks orders in distributions of active catalogs (+ended <1 month) (`HX/controller/User.hx:272-302`, `doQuitGroup`), TS `findRecentUserOrders` < 1 month (`groups.resolver.ts:141-147`); TS hard-codes group id 16936 (`groups.resolver.ts:124-128`).
C12. [CONFIRMED] `canManageAllCatalogs` differs: HX = `ContractAdmin(null)` i.e. params==null (`HX/db/User.hx:191-195`, `UserGroup.hx:155-168`); TS = any `ContractAdmin` entry, including single-catalog ones (`user-groups.service.ts:112-114,160-171`). TS ignores auto rights (claimed vendors) in every check except `canManageCatalog`.
C13. [CONFIRMED] Superadmin test written 3 ways in TS: `rights === 1` (breaks if more `RightSite` flags are added), `hasFlag` (`user.entity.ts:123-125`), see rule 26. `isGroupMember` returns true for superadmins for any group (`user-groups.service.ts:102-105`), HX `isMemberOf` does not (`HX/db/User.hx:342-344`).
C14. [CONFIRMED] TS `createMemberships/createMembership`: `paymentType` input unused (always cash, `memberships.service.ts:114`); fee `0` replaced by group fee; no check that the user belongs to the group (`memberships.resolver.ts:147-191`); `users[index]` indexing in `createMemberships` assumes `findByIds` preserves order (`:224`).
C15. [CONFIRMED] TS login does not copy `User.lang` to `Session.lang` nor set `whichUser` (`// TODO ?session.sdata.whichUser` `auth.service.ts:77`), unlike sugoi `Session.setUser` (`SUGOI/db/Session.hx:41-48`). `whichUser` (0/1 = first/second person logged) is read by HX (`HX/View.hx:251-255`, `TPL/user/choose.mtt:12`) and passed to messages React (`TPL/messages/default.mtt:9`).
C16. [CONFIRMED] Cookie domain computation differs: HX strips a leading `app.` from `HOST` (`HX/controller/User.hx:84-88`, also `:99-102,:108-111`), TS uses `CAMAP_HOST` stripped of `https://` only (`auth.service.ts:348-357`); an expiry cookie must match Domain to delete the cookie, so deletion may fail when `HOST` starts with `app.` (unverified at runtime).
C17. [CONFIRMED] "New user" detection differs: HX `pass == ""` (`HX/db/User.hx:495-505`), TS `ldate IS NULL` (`user-groups.service.ts:177-200`); TS-created members have a non-empty md5 `pass` (`auth.service.ts:115` with password `''`), so HX never sees them as new. Nothing in HX writes `ldate` (grep).
C18. [CONFIRMED] HX rights editor: both CheckboxGroups use name `"rights"` (`AmapAdmin.hx:115,147`); `ua` is dereferenced without null check when the selected user is not a member (`:155-158`); the self-lockout check runs after `giveRight` already persisted each right (`UserGroup.hx:89-110` vs `AmapAdmin.hx:174-179`; whether the request transaction rolls back on the thrown Error is unverified). `removeRight(ContractAdmin)` pushes the right before removing, leaving `params: []` entries (`UserGroup.hx:115-137`) (function has no caller in the files read).
C19. [CONFIRMED] `/user/choose?group=ID` accepts any group id without membership check (`User.hx:64-74`); `Group.doDefault` writes `amapId` for anonymous visitors of Open groups (`Group.hx:29-36`). (verifier note: SECURITY-RELEVANT; User.hx:~60-72 sets session amapId from args.group with no membership check (page is `@logged`; downstream use of amapId in Main/App not traced); Group.hx:25-36 sets amapId for anonymous visitors of Open groups)
C20. [CONFIRMED] Auth-less HX actions: `Group.doCreate` is not `@logged` and dereferences `app.user` (`Group.hx:132-136`); `Group.doListCancel` calls `removeFromWl(app.user)` (handles null with an error); `Member.doMovetowl` has no CSRF token whereas `doDelete` does (`Member.hx:215-223` vs `:118`); `/admin/group` default has no `@admin` on the method (guarded by `Main.doAdmin` `@admin`, `Main.hx:333-336`) and builds SQL by concatenating the `groupName` and zip inputs (`admin/Group.hx:31-44,55`). (verifier note: SECURITY-RELEVANT; Group.hx:~132-136 doCreate dereferences app.user (no @logged on method seen); Member.hx:~213 doMovetowl has no checkToken and no explicit canAccessMembership check in the method (doDelete has both, :118-120); admin/Group.hx:~44-55 string-concatenated SQL but only reachable via @admin Main.doAdmin (superadmin))
C21. [CONFIRMED] UX/data: `/user/choose` template links to `/group/create/` (`TPL/user/choose.mtt:63`) although `doCreate` only allows superadmins (`Group.hx:136-139`); the reset-password link uses `http://` (`User.hx:170`) while quit/notification links use `https://` unless DEBUG (`HX/db/User.hx:554,562`). Reset token life 30 days (`User.hx:163`) vs 2 weeks for TS invitations/define-password tokens (`group-previews-members.resolver.ts:171,295`). (verifier note: choose.mtt:63 links /group/create/ (camap-hx/lang/master/tpl/user/choose.mtt); other sub-claims not re-checked)
C22. [CONFIRMED] TS cron purge: handler declared `async` inside a stream `'data'` callback, not awaited; warns only on exact-day equality, so a missed cron day skips the warning; the first warning date is `twoYearsAgo + 1 month + 1 day - 1 ms` (`users.service.ts:453-456,567-603`).
C23. [CONFIRMED] Dead / unused: `Member.doEdit` (empty, `Member.hx:108-111`), `User.doDefault` (`User.hx:21-22`) and `api User.doDefault` (`api/User.hx:14-16`) empty; `BridgeService.getAuthToken` + bridge `GET /bridge/auth/tokens/:id` + HX `/api/user/getToken` (signs with HX `key`, different secret from TS access secret) have no caller found (`BridgeService.hx:88-93`, `auth-bridge.controller.ts:21-32`, `api/User.hx:56-64`); TS `CookieStrategy` (cookie `sid`) and `defaultStrategy: ['jwt','cookie']` are registered (`API/auth/auth.module.ts:23-25,44`) but all guards use explicit `jwt`/`void`/`bridge` (grep `AuthGuard(`); `UsersService.findOneBySid` returns `session.user` which is a lazy `Promise` (`users.service.ts:111-114`); `UserService.get` in HX is a thin finder with large commented code (`HX/service/UserService.hx:20-39`). (verifier note: getAuthToken has no caller (grep of hx/src, ts packages); other sub-claims not re-checked)
C24. [CONFIRMED] Known elsewhere, not repeated: ts GroupFlags misses ordinals 1,2,11,12 (`API/groups/types/interfaces.ts:1-11`); `RightSite` naming (Admin vs SuperAdmin). Related here: HX translation key `AmapAdmin` for the right named `GroupAdmin` (`HX/App.hx:285`), and `Amap.doEdit` pushes excluded ordinal `2` twice (`HX/controller/Amap.hx:48-49`).
C25. [CONFIRMED] `membershipFee` is `STinyInt`/`tinyint` (max 127) in both HX and TS, while HX form uses `IntInput` (`HX/db/Group.hx:59`, `API/groups/entities/group.entity.ts:57-58`, `AmapAdmin.hx:48`).
C26. [CONFIRMED] TS `register` (also used by member import) accepts `''` as password: `pass=md5(KEY+'')` and `pass2=bcrypt('')` are stored, i.e. a known-hash password, but `loginSchema` requires a non-empty password (`COMMON/validators/loginSchema/loginSchema.ts`, `auth.resolver.ts:53`) so such accounts cannot be logged into until reset. (verifier note: auth.service.ts:~114-115 md5+bcrypt of the given password with no emptiness check; loginSchema not opened)
C27. [CONFIRMED] Group `disabled` is read in HX/TS/React but never written by application code (grep), see rule 37.



## Verification summary

Confirmed: 41, Refuted: 0, Plausible: 0 (sections 6 and 7). Second pass re-read all cited code. Corrections made: D4 guard path is `API/common/guards/gql-auth-abstract-guard.ts`; D8 line 77 is a closing brace; C11 HX quit logic is in `HX/controller/User.hx:272-302`; C16 HX cookie logic is in `HX/controller/User.hx`. C18 runtime rollback sub-claim remains unverifiable at runtime (stated as such in the item). Paths in citations: API=camap-ts/packages/api-core/src, HX=camap-hx/src.
