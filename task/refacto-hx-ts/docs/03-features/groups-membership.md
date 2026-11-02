# Groups, members, waiting lists, memberships (cotisation)

## 1. Scope

Group entity and settings, group public pages, group selection, joining/quitting a group, member lists and management (import, invite, remove), waiting lists, group rights editor, group creation/disabled state, and the yearly membership (cotisation). User identity and rights primitives are in `users-auth.md`.


Who does what today:
- HX owns: group creation (superadmin only), group public page, group settings forms (`/amap/edit`, `/amapadmin/*`), rights editor, group choice, join-open-group, quit-group email-link pages (render a React module), waiting-list registration, session group selection.
- TS owns: member lists, import, invitations, removal, waiting-list approve/cancel/move-back, membership CRUD, group previews/map, quit-group mutations, `setGroupImage`.

## 2. Concepts & glossary terms

- **Group** (`Group`): name, contact, texts, `regOption`, `flags`, `hasMembership`, `membershipFee`, `membershipRenewalDate`, `disabled` reason (`camap-hx/src/db/Group.hx:9-38,43-94`).
- **UserGroup**: membership of a user in a group, with balance and rights (`camap-hx/src/db/UserGroup.hx:19-32`).
- **WaitingList**: pending join request. **Membership**: one row per user/group/year (`camap-hx/src/db/Membership.hx:5-15`).
- **regOption**: `Closed=0, WaitingList=1, Open=2, Full=3` (`camap-hx/src/db/Group.hx:26-31`; TS numeric enum identical `camap-ts/packages/api-core/src/groups/types/interfaces.ts:14-19`).
- **Group disabled**: nullable enum `BLOCKED_BY_ADMIN | MOVED | SUSPENDED` (`camap-hx/src/db/Group.hx:33-38`, migration `camap-ts/packages/api-core/src/migrations/1741445966001-group-disabled.ts:7`).
- **Group flags**: only `HidePhone`, `PhoneRequired`, `AddressRequired` are editable in `/amap/edit`; legacy `__HasMembership` (ordinal 0) is a different thing from `hasMembership`.
- **Session group**: `Session.data.amapId`, selected group for HX (`camap-hx/src/App.hx:160-171`).
- **Group rights**: `GroupAdmin`, `ContractAdmin(cid?)`, `Membership`, `Messages` (see `users-auth.md`).
- **Membership year / period name**: see rule 17.

## 3. Routes & endpoints

### 3.1 HX

| side | route | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `/user/joingroup` | `camap-hx/src/controller/User.hx:231-266` | logged | none (redirect `/` with Ok) | joins the current session group if `regOption==Open`; mails group contact if not previously member |
| HX | `/user/quitGroup/<group>/<user>/<key>` | `camap-hx/src/controller/User.hx:271-307` | key `sha1(KEY+groupId+userId)` (MD5 legacy accepted `camap-hx/src/controller/User.hx:273-280`); works logged-out | `camap-hx/lang/master/tpl/account/quit.mtt` -> React `quitGroup` | email-footer quit link |
| HX | `/user/quitGroupFromMessage/<group>/<key>` | `camap-hx/src/controller/User.hx:312-349` | key `sha1(KEY+groupId)`; needs login (redirect with `__redirect`) | `camap-hx/lang/master/tpl/account/quit.mtt` | link from messaging footer |
| HX | `/member` | `camap-hx/src/controller/Member.hx:26-36` | constructor: superadmin or `canAccessMembership` (`camap-hx/src/controller/Member.hx:23`); `Main.doMember` `@logged` (`camap-hx/src/controller/Main.hx:222-226`) | `camap-hx/lang/master/tpl/member/default.mtt` -> React `members` (`camap-hx/lang/master/tpl/member/default.mtt:5-12`) | members list shell; passes `groupId`, CSRF `token`, `basePath` |
| HX | `/member/view/<id>` | `camap-hx/src/controller/Member.hx:38-83` | same | `camap-hx/lang/master/tpl/member/view.mtt` | member sheet (orders, subscriptions, notification flags); buttons payments, movetowl, loginas, `_Camap.membershipBox` (`camap-hx/lang/master/tpl/member/view.mtt:46,102,106,213`) |
| HX | `/member/edit/<id>` | `camap-hx/src/controller/Member.hx:108-111` | same | `form.mtt` | empty body (dead) |
| HX | `/member/delete/<id>?token=&confirm=` | `camap-hx/src/controller/Member.hx:116-135` | CSRF token + `canAccessMembership` | none | removes user from current group (rule 12) |
| HX | `/member/movetowl/<id>` | `camap-hx/src/controller/Member.hx:215-223` -> `camap-hx/src/service/WaitingListService.hx:75-93` | no CSRF token | none | move a member back to the waiting list |
| HX | `/member/payments/<id>`, `/member/balance`, `/member/invoice/<m>/<md>` | `camap-hx/src/controller/Member.hx:140-210` | same | `camap-hx/lang/master/tpl/member/{payments,balance,invoice}.mtt` | see `payments-operations-reports.md` |
| HX | `/group/<id>` | `camap-hx/src/controller/Group.hx:22-76` | public | `camap-hx/lang/master/tpl/group/view.mtt` | public group page; disabled -> `/group/disabled/<id>`; if `regOption==Open` stores group in session, even for anonymous visitors (`camap-hx/src/controller/Group.hx:29-36`) |
| HX | `/group/list/<id>` | `camap-hx/src/controller/Group.hx:82-115` | needs login, `regOption==WaitingList` | `form.mtt` | register to waiting list via `WaitingListService.registerToWl` |
| HX | `/group/listCancel/<id>` | `camap-hx/src/controller/Group.hx:120-127` | login (null handled with an error) | none | leave waiting list |
| HX | `/group/create` | `camap-hx/src/controller/Group.hx:132-187` | superadmin only (`camap-hx/src/controller/Group.hx:136-139`); method not `@logged`, dereferences `app.user` (`:132-136`) | `form.mtt` | create group |
| HX | `/group/map`, `/group/csa` | `camap-hx/src/controller/Group.hx:189-202` | public | `camap-hx/lang/master/tpl/group/map.mtt`, `camap-hx/lang/master/tpl/group/csa.mtt` | map / CSA landing |
| HX | `/group/disabled[/<id>]` | `camap-hx/src/controller/Group.hx:204-209` | public | `camap-hx/lang/master/tpl/group/disabled.mtt` -> React `groupDisabled` | blocked-group notice |
| HX | `/amap`, `/amap/edit` | `camap-hx/src/controller/Amap.hx:18-33,35-79` | `isAmapManager` for edit (`camap-hx/src/controller/Amap.hx:37-38`) | `camap-hx/lang/master/tpl/amap/default.mtt`, `form.mtt` | `default` = list of current/ended catalogs; `edit` = group settings (name, contact, texts, extUrl, regOption, flags HidePhone/PhoneRequired/AddressRequired, legalRepresentative) |
| HX | `/amapadmin` | `camap-hx/src/controller/AmapAdmin.hx:74-81` | constructor gate `isAmapManager` (`camap-hx/src/controller/AmapAdmin.hx:27`) | `camap-hx/lang/master/tpl/amapadmin/default.mtt` | group admin dashboard |
| HX | `/amapadmin/membership` | `camap-hx/src/controller/AmapAdmin.hx:39-72` | group manager | `camap-hx/lang/master/tpl/amapadmin/form.mtt` | edit `hasMembership`, `membershipFee` (IntInput), `membershipRenewalDate` |
| HX | `/amapadmin/rights` | `camap-hx/src/controller/AmapAdmin.hx:83-90` | group manager | `camap-hx/lang/master/tpl/amapadmin/rights.mtt` | list users with any stored right |
| HX | `/amapadmin/editRight[/<userId>]` | `camap-hx/src/controller/AmapAdmin.hx:93-199` | group manager | `camap-hx/lang/master/tpl/amapadmin/form.mtt` | grant/modify rights of a member |
| HX | `/amapadmin/vatRates`, `/currency`, `/payments`, `/volunteers`, `/documents`, `/media` | `camap-hx/src/controller/AmapAdmin.hx:201-340` | group manager | forms | settings of other areas (see other feature docs) |

### 3.2 TS GraphQL (`/graphql`)

| side | operation | handler path:line | auth/rights | consumer | purpose |
|---|---|---|---|---|---|
| TS | `query userGroup(groupId,userId)` + field `hasValidMembership` | `camap-ts/packages/api-core/src/groups/resolvers/userGroups.resolver.ts:23-67` | GroupAdmin / ContractAdmin(any) / Membership | front | user-in-group data |
| TS | `query group(id)` | `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:43-55` (`:44-58` `get`) | GroupAdmin (`:200-209`) | `camap-ts/packages/front-core/src/modules/users/UserAccountModule/userAccount.gql:79-92` | group entity |
| TS | `mutation quitGroup`, `quitGroupByControlKey` | `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:94-150` | self or control key | `camap-ts/packages/front-core/src/modules/users/QuitGroup/QuitGroup.module.tsx` | leave a group (rule 11) |
| TS | `mutation setGroupImage`; fields `Group.image`, `Group.multiDistribs` | `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:152-195` (`:67`, `:83`) | `GqlAuthGuard`, GroupAdmin | front | group image |
| TS | `query groupPreview(id)` | `camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts:38-50` | public | `camap-ts/packages/front-core/src/modules/groupDisabled/groupDisabled.module.gql:1-8` | public group info incl. `disabled`; `NotFoundException` if absent |
| TS | `groupPreviews`, `groupPreviews2` (`getAll`, `getAll2`), `getGroupsOnMap`, `myGroups` | `camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts:53-115` | see file | front | previews and map |
| TS | fields `GroupPreview.hasPhoneRequired`, `hasAddressRequired` | `camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts:128-136` | none | login/register UI | group flags |
| TS | `query groupPreviewMembers(id)` | `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:44-59` | Membership right | members module | members preview |
| TS | `mutation removeUsersFromGroup`, `importAndCreateMembers`, `sendInvitesToNewMembers` | `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:61-373` | Membership right | `camap-ts/packages/front-core/src/modules/members/members.gql.ts:94,150,167` | remove/import/invite |
| TS | `query groupPreviewCatalogs(id)` + fields `volunteerRoles`, `places`, `mainPlace`, `users` | `camap-ts/packages/api-core/src/groups/resolvers/group-previews-catalogs.resolver.ts:32-87` | class `GqlAuthGuard` + catalog-manage right | front | see `catalogs-products-vendors-places.md` |
| TS | `getUserLists(groupId)`, `getContractsUserLists`, `getDistributionsUserLists`, `getUserListInGroupByListType` | `camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts:23-25,38,176,203,253` | JWT only; no per-group right check | `camap-ts/packages/front-core/src/modules/members/members.gql.ts:8,25` | member lists |
| TS | `query getWaitingListsOfGroup(groupId)` | `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:40-45` | no right check | `members.gql.ts:53` | waiting list |
| TS | `mutation moveBackToWaitingList`, `approveRequest`, `cancelRequest` | `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:47-221` | Membership right | `members.gql.ts:71,109,117` | waiting-list management |
| TS | `query getUserMemberships`, `getMembershipFormData`; `mutation createMembership`, `createMemberships`, `deleteMembership` | `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:48-278` | Membership right (`:283-299`) | `camap-ts/packages/front-core/src/modules/membership/membership.gql.ts:4-40`, `members.gql.ts:125` | membership CRUD |

## 4. Business rules

### Groups
1. `regOption` default for a new `Group` object = Open (`camap-hx/src/db/Group.hx:102`); groups created through `/group/create` are set to WaitingList (`camap-hx/src/controller/Group.hx:159`). The `Full` option has no code path of its own besides its label (`camap-hx/src/App.hx:304`).
2. Joining. Open: direct join via `/user/joingroup` (creates `UserGroup`, mails group contact if not previously a member) (`camap-hx/src/controller/User.hx:231-266`), via TS registration with `invitedGroupId` (no regOption check: `camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104`), or via `/invite/...` links (`camap-hx/src/controller/Main.hx:308-324`; hash `sha1(KEY+email)` only covers the email, `userId` and `group` segments are separate params; `session.data.amapId` set before validation). WaitingList: `/group/list/<id>` creates a `WaitingList` row and mails GroupAdmin/Membership holders (`camap-hx/src/service/WaitingListService.hx:10-41`); a member with Membership right approves (creates `UserGroup`, deletes the WL entry, mails user and other member-managers) or refuses (mails user) in the React members module (`camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:113-221`). Closed/Full: only managers add members (`importAndCreateMembers`, `sendInvitesToNewMembers`).
3. Adding members (TS, Membership right): `importAndCreateMembers` registers missing users with an empty password (`pass`=md5(KEY+'') and `pass2`=bcrypt('')), creates `UserGroup`, stores `chp-<sha1(KEY+email)> -> "i<userId>"` in Cache (2 weeks) and mails a link `/user/forgottenPassword/<token>/<userId>/true` so the new user defines a password in HX; existing users are added and mailed `/group/<id>` (`camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:112-263`; token life `:171,295`). `sendInvitesToNewMembers` only mails: link `/invite/<sha1(KEY+email)>/<email>/<groupId>[/<userId>]`, invited-user data cached 2 weeks under `invitation-<sha1>` (`camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:267-373`).
4. HX group creation: superadmin only; creator becomes member with rights GroupAdmin, Membership, Messages, ContractAdmin(all); `hasMembership=true`, `regOption=WaitingList`, allowed payments cash+check; also creates the first Place and geocodes (`camap-hx/src/controller/Group.hx:132-187`, rights `:163-170`, geocode `:177` via `camap-hx/src/service/PlaceService.hx`). TS has no group creation mutation (grep `createGroup` in `API/`: none).
5. Group disabled effects: public page and `/home` redirect to `/group/disabled` (`camap-hx/src/controller/Group.hx:25-27`, `camap-hx/src/controller/Main.hx:84-86`), HX crons skip such groups (`camap-hx/src/controller/Cron.hx:110,170`); React page shows the reason label and, for `MOVED`, a button to `extUrl` (`camap-ts/packages/front-core/src/modules/groupDisabled/GroupDisabled.module.tsx:22-34`). No HX or TS code path that sets `Group.disabled` was found (grep); it is set via DB / `/db` admin.
6. Group flags editable in `/amap/edit`: `HidePhone`, `PhoneRequired`, `AddressRequired` (form excludes ordinals 0-5 and 9-12; 11/12 values preserved on save) (`camap-hx/src/controller/Amap.hx:44-73`; excluded ordinal `2` pushed twice `:48-49`). `PhoneRequired`/`AddressRequired` feed `loginBoxOptions` (`camap-hx/src/service/UserService.hx:61-74`). TS `GroupFlags` misses ordinals 1, 2, 11, 12 (`camap-ts/packages/api-core/src/groups/types/interfaces.ts:1-11`).
7. Group duplication helper `GroupService.duplicateGroup` copies settings without members (`camap-hx/src/service/GroupService.hx:23-48`; no caller checked). `GroupService.getGroupMembersWithRights` (`:53-72`).
8. Group selection: `/user/choose?group=ID` sets `session.data.amapId` without checking membership (`camap-hx/src/controller/User.hx:64-74`); `/home` requires a session group.
9. Rights editor (HX only, `/amapadmin/editRight`): form offers GroupAdmin, Membership, Messages + "All catalogs" / each active catalog; saving rewrites the whole stored list (`camap-hx/src/controller/AmapAdmin.hx:93-199`, `camap-hx/src/db/UserGroup.hx:89-110`); auto rights shown read-only (`camap-hx/src/controller/AmapAdmin.hx:143,148`); both CheckboxGroups use name `"rights"` (`:115,147`); `ua` dereferenced without null check when the selected user is not a member (`:155-158`); the self-lockout check runs after `giveRight` persisted each right (`camap-hx/src/db/UserGroup.hx:89-110` vs `camap-hx/src/controller/AmapAdmin.hx:174-179`; transaction rollback unverified). `removeRight(ContractAdmin)` pushes the right before removing (`camap-hx/src/db/UserGroup.hx:115-137`; no caller in files read).
10. `/member/*` access (HX): the controller constructor redirects to `/` unless superadmin or `canAccessMembership` (`camap-hx/src/controller/Member.hx:23`), so a GroupAdmin without the Membership right cannot open any `/member` page.
11. Quit group: allowed when `balance >= 0` and no recent orders. HX: no order in any active catalog (including ended < 1 month) distribution (`camap-hx/src/controller/User.hx:272-302`). TS: balance >= 0 and no recent user orders (< 1 month) via `OrdersService.findRecentUserOrders` (`camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:130-147`); then the `UserGroup` is deleted. Group id 16936 can never be quit (hard-coded, `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:124-128`). Quit by control key = `sha1(KEY+groupId+userId)` (`camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:104-117`, `camap-hx/src/db/User.hx:553-556`).
12. Removing a member. HX `/member/delete`: CSRF token required, needs `canAccessMembership`, cannot delete self, if the user has orders with `quantity>0` in the group `confirm=1` is required, then deletes the `UserGroup` row (`camap-hx/src/controller/Member.hx:116-135`). TS `removeUsersFromGroup`: needs Membership right, cannot remove self, cannot remove group admins (superadmins count as admin), then deletes the `UserGroup` rows with no order/balance check (`camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:61-108`). The TS loop pushes `userNotInGroup` errors but keeps `null` entries then calls `delete(ug)` on them (`camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:85-104`, `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:336-340`); `moveBackToWaitingList` has the same splice-inside-`forEach` misalignment (`camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:78-83`) and does not reject users already in the waiting list, unlike HX (`camap-hx/src/service/WaitingListService.hx:83-84`).
13. TS rights per resolver: see `users-auth.md` rule 32.

### Membership (cotisation)
14. Settings on `Group`: `hasMembership` bool, `membershipFee` (tinyint both sides, max 127; HX form uses `IntInput`), `membershipRenewalDate` (date), edited in HX `/amapadmin/membership` (`camap-hx/src/controller/AmapAdmin.hx:39-72`, `camap-hx/src/db/Group.hx:58-59,65`, `camap-ts/packages/api-core/src/groups/entities/group.entity.ts:54-58,111-112`).
15. Membership year: renewal date's month/day applied to the current year; if today is before it, year-1 else year (no renewal date: current year) (`camap-hx/src/db/Group.hx:312-330`, `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:233-253`). Period name: `YYYY` if renewal month is January or February, else `YYYY-YYYY+1` (`camap-hx/src/db/Group.hx:350-356`, `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:217-225`).
16. "Has a valid membership" iff the group has a renewal date and a `Membership` row exists for (user, group, current membership year); `hasMembership` is not consulted (`camap-hx/src/db/UserGroup.hx:223-228`, `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:198-212`); lists `membership`/`noMembership` return `[]` when `hasMembership` is false (`camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts`, `getUserListInGroupByListType`).
17. Create membership (TS, Membership right): group must have `hasMembership`; no existing row for same year (`membershipAlreayExists`); fee = given fee, else `group.membershipFee`, else error `You should define a membership fee` (a fee of `0` is treated as not given); creates a debt operation `-fee` (type Membership, label `Adhésion <period>`), then an immediate cash payment operation `+fee` linked to it, then the `Membership` row (`camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:147-191`, `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:96-152`). `createMemberships` = batch with per-user "already exists" errors (`camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:193-249`; relies on `findByIds` order `:224`). `paymentType` input is accepted but unused (always cash, `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:114`); no check that the user belongs to the group.
18. Delete membership: removes related payment operations and the debt operation, recomputes balance, then the row (`camap-ts/packages/api-core/src/groups/services/memberships.service.ts:154-193`).
19. Form data: fee proposal + 6 selectable years (from -4 to +1 around today) + distributions in [today-3 months, today+5 days] (`camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:89-119`).
20. HX helpers `MembershipService.getMembershipUsers/getNoMembershipUsers` (`camap-hx/src/service/MembershipService.hx:25-56`) are the HX equivalent of TS user lists; HX has no code creating `Membership` rows (grep `new db.Membership`: none); the member sheet only opens the React dialog (`camap-hx/lang/master/tpl/member/view.mtt:213`, `camap-hx/js/App.hx:286-296`).
21. Membership protects users from the inactive purge (`camap-ts/packages/api-core/src/groups/services/memberships.service.ts:77-87`).

## 5. Flows

1. Open group join: `/group/<id>` stores group in session (even anonymous) -> register/login -> `/user/joingroup` creates `UserGroup`.
2. WaitingList group: `/group/list/<id>` -> `WaitingList` row -> admin approves in React members module (`approveRequest`).
3. Invited: `sendInvitesToNewMembers` mail -> `/invite/...` -> register (prefilled, `invitedGroupId`) or join immediately when `userId` is given.
4. Quit: `/account` React module (`quitGroup` mutation, JWT) or email link `/user/quitGroup/...` (control key, `quitGroupByControlKey`) (`camap-ts/packages/front-core/src/modules/users/QuitGroup/QuitGroup.module.tsx`).
5. Group selection / home: `/home` -> no session group -> `/user/choose` -> `?group=ID` writes `session.data.amapId` -> `/home`.
6. Group creation (superadmin): `/group/create` form (name + first Place) -> `Group` (`hasMembership=true`, `regOption=WaitingList`) + `UserGroup` + 4 rights + Place + geocode -> session group = new group, `newGroup=true`, redirect `/` (`camap-hx/src/controller/Group.hx:132-187`).
7. Membership payment: React `membershipDialog` (`camap-ts/packages/front-core/src/modules/membership/MembershipDialog.module.tsx`, opened by `_Camap.membershipBox`) -> `getMembershipFormData` + `getUserMemberships` -> `createMembership`/`deleteMembership`; from the members list `createMemberships` (`camap-ts/packages/front-core/src/modules/members/components/MembershipFeeDialog.tsx`).

## 6. Ownership hx vs ts

| capability | HX | TS |
|---|---|---|
| Group creation | `/group/create` (superadmin) | none |
| Group settings (name, regOption, flags, membership settings, rights) | `/amap/edit`, `/amapadmin/*` | `setGroupImage` only |
| Group public page / map / disabled | `/group/*` | `groupPreview*`, `getGroupsOnMap` |
| Current group selection | `session.data.amapId` | none |
| Rights write | `/amapadmin/editRight` | none |
| Members list / import / invite / remove | `/member` page shell; `/member/delete` still routable | React members module + resolvers |
| Waiting list register | `/group/list`, `/group/listCancel` | none |
| Waiting list approve/refuse/move back | `/member/movetowl` | `approveRequest`, `cancelRequest`, `moveBackToWaitingList` |
| Quit group | `/user/quitGroup*` (page shell + checks) | `quitGroup`, `quitGroupByControlKey` |
| Membership settings | `/amapadmin/membership` | none |
| Membership CRUD | none (opens React dialog) | `memberships.resolver.ts` |

Group `disabled` is read in camap-hx/src/TS/React and written by no application code.

## 7. Known security/rights observations

Pointers only, see inconsistencies-code.md: missing authorization on TS member lists / waiting lists; `invitedGroupId` joins any group; `/invite` link scope; `/user/choose` without membership check; anonymous session group on open groups; `doCreate` not `@logged`; `doMovetowl` without CSRF; `/admin/group` string-concatenated SQL. Doc divergences for `groups.md` / `membership.md`: see inconsistencies-docs.md.
