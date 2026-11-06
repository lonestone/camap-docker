# Code inconsistencies (HX/TS bugs, divergences, dead code, config)

Source: "Code inconsistencies" sections of drafts 01 to 11 (`task/refacto-hx-ts/docs/_drafts/`; draft 11 table I-1 to I-17; doc-side items of draft 11 are in `inconsistencies-documentation.md`). Factual only: no fix recommendations. Items tagged REFUTED by the verification pass are excluded and listed in the appendix.

Conventions
- Paths are repo-relative to the `camap-docker` root; draft aliases (HX/, API/, FE/, COMMON/, TPL/) are expanded. `SUGOI` = Haxe lib `sugoi`, now the `sugoi/` submodule at the pinned commit `c3b8db8` (`SUGOI src/…` = `sugoi/src/…`; earlier entries were read in the lix cache of the same commit). Lines marked `~` are approximate as given by the verifier.
- Refs: draft number + item (`03#C5` = draft 03 item C5, `05#3` = draft 05 item 3, `11#I-2` = draft 11 table row I-2). Several refs on one entry mean the same finding was reported by several drafts and was merged (dedup). Where several closely related findings of one draft share one root area they are merged in one entry; the title lists all aspects.
- Severity: High = authentication/rights bypass or data loss (or, for Config/build, a blocker that prevents the app from starting or building); Medium = incorrect behaviour or weaker rights with limited reach, or likely data inconsistency; Low = cosmetic, dead code, or unverified/limited effect. The justification is given on entries rated High and on some Medium ones.
- Verdict tags: CONFIRMED (verifier read the cited lines) or PLAUSIBLE with the reason it could not be fully confirmed. Findings about runtime behaviour that nobody executed say so in the description.
- Entries CODE-164 and later, and the "Observed" lines, come from the characterisation suite (`camap-docker/tests`, see `PROGRESS.md`): their Refs name the test file instead of a draft.

## Index

| ID | Category | Severity | One-line |
|---|---|---|---|
| CODE-001 | Security/rights | High | HX password reset step 4 does not verify the reset token |
| CODE-002 | Security/rights | High | TS `loginAs` authorization check is un-awaited and uses the target user |
| CODE-003 | Security/rights | High | HX invite link hash covers only the email |
| CODE-004 | Security/rights | High | TS `invitedGroupId` adds the user to any group (register path) |
| CODE-005 | Security/rights | High | Stale password keeps working after HX reset (`pass` vs `pass2`) |
| CODE-006 | Security/rights | High | TS reads without rights checks (user lists, waiting lists, users) |
| CODE-007 | Security/rights | High | Vendor `phone` / `email` field resolvers un-awaited rights check |
| CODE-008 | Security/rights | High | Catalog `documents` rights check un-awaited; arguments swapped |
| CODE-009 | Security/rights | High | TS `attendanceVariableContract` has no rights check |
| CODE-010 | Security/rights | High | `Distribution.userOrders` and `distribution(id)` reachable without authentication |
| CODE-011 | Security/rights | High | HX `Distribution.doEditMd` / `doChangePrice` do not scope to the session group |
| CODE-012 | Security/rights | High | HX `History.doSubscriptionPayments` / `doBasket` / `doSubscriptionOrders` do not check ownership |
| CODE-013 | Security/rights | High | HX REST `api/Subscription` with no login/ownership check |
| CODE-014 | Security/rights | High | HX `SubscriptionAdmin.doInsertPayment` / `Transaction.doInsertPayment` use the weak `isContractManager()` |
| CODE-015 | Security/rights | High | HX `/cron/*` endpoints unauthenticated |
| CODE-016 | Security/rights | High | HX `Product.doExport` lacks `canManageContract`; `/api/catalog` and `/api/product` unauthenticated |
| CODE-017 | Security/rights | High | HX batch product enable/disable derives the catalog from the first product id |
| CODE-018 | Security/rights | Medium | TS `multiDistribution(id)` needs only a login |
| CODE-019 | Security/rights | Medium | HX Distribution / ContractAdmin handlers without explicit rights checks |
| CODE-020 | Security/rights | Medium | HX member subscription delete is a GET without CSRF token |
| CODE-021 | Security/rights | Medium | TS unauthenticated vendor/place queries |
| CODE-022 | Security/rights | Medium | Catalog `products` / `subscriptions` fields reachable without management check |
| CODE-023 | Security/rights | Medium | Brute-force counter depends on the client; `X-Real-Ip` header case |
| CODE-024 | Security/rights | Medium | `/user/choose?group=ID` and `Group.doDefault` write `amapId` without membership check |
| CODE-025 | Security/rights | Medium | Auth-less or CSRF-less HX group/member actions; SQL concatenation |
| CODE-026 | Security/rights | Medium | Unauthenticated `Install.doDiagnostics` and `/cssdemo` |
| CODE-027 | Security/rights | Medium | SQL assembled by string interpolation |
| CODE-028 | Security/rights | Medium | TS `canManageAllCatalogs` broader than HX; auto rights and superadmin handling differ |
| CODE-029 | Security/rights | Medium | HX rights editor issues |
| CODE-030 | Security/rights | Low | `Admin.doErrors` empties the `Error` table on GET without CSRF token |
| CODE-031 | Security/rights | Low | Bridge `GET /bridge/auth/delete-user/:id` is state-changing |
| CODE-032 | Security/rights | Low | Reset-password link and token lifetimes |
| CODE-033 | Security/rights | Low | Document type validated by file-name extension only |
| CODE-034 | Security/rights | Low | `getLatestMessages` has no group-right check |
| CODE-035 | Data integrity | High | `Scripts.doCleannonamapdata` deletes groups with the `ShopMode` flag |
| CODE-036 | Data integrity | Medium | HX `doBalanceTransfer` target subscription validated only for "same user" |
| CODE-037 | Data integrity | Medium | Balance query excludes non-subscription operations; hard-coded year 2022 |
| CODE-038 | Data integrity | Medium | Membership `paymentType` input ignored; other membership create gaps |
| CODE-039 | Data integrity | Medium | Reports: merged product lines do not add `totalHT` |
| CODE-040 | Data integrity | Medium | `OrderService.edit` stock clamp and over-stock test differ from `make` |
| CODE-041 | Data integrity | Medium | `updateOrderQuantity` subTotal uses current product price |
| CODE-042 | Data integrity | Medium | `Basket.getOrCreate` creates a second basket when the existing one is OPEN |
| CODE-043 | Data integrity | Medium | `Product.doEdit` rewrites stock rows before validation |
| CODE-044 | Data integrity | Low | Float equality in `Transaction.doInsertPayment` |
| CODE-045 | Data integrity | Low | "Past" subscription distributions defined two ways |
| CODE-046 | Data integrity | Low | `checkVarOrders` error message prints unrounded total |
| CODE-047 | Data integrity | Low | `createSubscription` passes `adminMode=false` to `setAbsences` even in admin mode |
| CODE-048 | Data integrity | Low | Stored `productPrice` in `defaultOrders` JSON never used |
| CODE-049 | Data integrity | Low | Absence lock criterion differs between service and REST |
| CODE-050 | Data integrity | Low | `Distribution.getKey/makeKey` use deprecated `date` and `place` columns |
| CODE-051 | Data integrity | Low | `membershipFee` is `tinyint` (max 127) |
| CODE-052 | Data integrity | Low | TS `register` accepts an empty password |
| CODE-053 | Data integrity | Low | VAT-HT computed without rounding; invoice duplicates the report logic |
| CODE-054 | Data integrity | Low | `ReportService.getOrdersByProduct` groups by `price` but selects `AVG(productPrice)` |
| CODE-055 | Bug/crash (null deref, un-awaited async) | Medium | TS `removeUsersFromGroup` / `moveBackToWaitingList` splice-in-loop and null entries |
| CODE-056 | Bug/crash (null deref, un-awaited async) | Medium | `deleteAccount` continues after a `null` result |
| CODE-057 | Bug/crash (null deref, un-awaited async) | Medium | `message(id)` dereferences before the null check |
| CODE-058 | Bug/crash (null deref, un-awaited async) | Medium | `createMessage` dereferences a possibly null/undefined buffered mail |
| CODE-059 | Bug/crash (null deref, un-awaited async) | Medium | Deletes launched without `await` inside `@Transactional` jobs |
| CODE-060 | Bug/crash (null deref, un-awaited async) | Medium | `VariableService.getInt` / `set` mishandle missing rows and async |
| CODE-061 | Bug/crash (null deref, un-awaited async) | Medium | TS `updatePaymentOperation` / `makePaymentOperation` differ from HX; un-awaited balance update |
| CODE-062 | Bug/crash (null deref, un-awaited async) | Medium | HX `Transaction.doEdit` / `doDelete` dereference `operation.subscription` before the null check |
| CODE-063 | Bug/crash (null deref, un-awaited async) | Medium | `ContractAdmin.doUpdatePrices` dereferences `args.d.id` for constant catalogs |
| CODE-064 | Bug/crash (null deref, un-awaited async) | Medium | Volunteer role handlers: null/unchecked access |
| CODE-065 | Bug/crash (null deref, un-awaited async) | Medium | `EntityFileService.updateOrCreate` always inserts |
| CODE-066 | Bug/crash (null deref, un-awaited async) | Medium | TS `CatalogsService.create` discards `setFlag` result and has reversed arguments |
| CODE-067 | Bug/crash (null deref, un-awaited async) | Low | TS inactive-user purge: async handler in stream callback, exact-day warning |
| CODE-068 | Bug/crash (null deref, un-awaited async) | Low | HX `doLogin` redirect Bool and `Auth_sid` comparison |
| CODE-069 | Bug/crash (null deref, un-awaited async) | Low | `Distribution.doVolunteersCalendar` reads `args.returnUrl` before the null test |
| CODE-070 | Bug/crash (null deref, un-awaited async) | Low | `CamapDatePicker` constructor parameter typo `attibutes` |
| CODE-071 | Bug/crash (null deref, un-awaited async) | Low | Mail template double slash in contract link |
| CODE-072 | Bug/crash (null deref, un-awaited async) | Low | Media upload limit 4 MB vs "3 Mb" comment and "3 Mo" messages; visibility options |
| CODE-073 | Bug/crash (null deref, un-awaited async) | Low | `FilesController` stray statement, `@Res()` return and in-place overwrite; `getExtension` split |
| CODE-074 | Bug/crash (null deref, un-awaited async) | Low | `vendors.resolver` `currentUser.email2.toLowerCase()` on null |
| CODE-075 | Bug/crash (null deref, un-awaited async) | Low | `createOrUpdateOrders` / `updateOrderQuantity` dereference `multiDistrib` when only a catalog is passed |
| CODE-076 | Bug/crash (null deref, un-awaited async) | Low | `Contract.doEditVarOrders` truncates quantities and dereferences a null operation |
| CODE-077 | Bug/crash (null deref, un-awaited async) | Low | `OrderService.confirmTmpBasket` calls `make` with a Basket as `paid` |
| CODE-078 | Bug/crash (null deref, un-awaited async) | Low | Orders/basket: REST `adminMode` handling |
| CODE-079 | Bug/crash (null deref, un-awaited async) | Low | TS error enum value clash and unused imports |
| CODE-080 | Bug/crash (null deref, un-awaited async) | Low | `getFromTimeRange` upper bound and sort comment (HX); `isActive` vs `canOrderNow` |
| CODE-081 | Bug/crash (null deref, un-awaited async) | Low | Date helper approximations (`dateToIso`, `DateTool`) |
| CODE-082 | Bug/crash (null deref, un-awaited async) | Low | Cron small bugs and hard-coded French |
| CODE-083 | Bug/crash (null deref, un-awaited async) | Low | `/distribution/validate/:md` redirect has no handler |
| CODE-084 | Bug/crash (null deref, un-awaited async) | Low | Neo module `attention` not registered |
| CODE-085 | Bug/crash (null deref, un-awaited async) | Low | `View.neoArgs` mishandles Bool and arrays; `HttpUtil.PATCH = 'GET'` |
| CODE-086 | Bug/crash (null deref, un-awaited async) | Low | `BASE_URL` evaluated at import in `useRestGetApi`; `/env.js` ordering; hard-coded dev story URL |
| CODE-087 | Bug/crash (null deref, un-awaited async) | Low | HX `api/Distributions` handlers declared without `public` |
| CODE-088 | Bug/crash (null deref, un-awaited async) | Low | Cron concurrency: daily job at 00:00 coincides with `cleanOldMessages` |
| CODE-089 | HX↔TS divergence | Medium | `Vendor.companyNumber` nullability vs migration |
| CODE-090 | HX↔TS divergence | Medium | `Catalog.endDate` nullable in HX, non-null in TS |
| CODE-091 | HX↔TS divergence | Medium | `Basket.status`: TS-only `PAYMENT_PROCESSING`; varchar vs enum |
| CODE-092 | HX↔TS divergence | Medium | `NotificationMail` entity: nullability, attachments shape, relations |
| CODE-093 | HX↔TS divergence | Medium | `GroupFlags` subset and renamed in TS |
| CODE-094 | HX↔TS divergence | Medium | `CatalogFlags` defined twice in TS with 3 of 6 values |
| CODE-095 | HX↔TS divergence | Medium | `StockTracking` defined twice in TS (numeric vs string enum) |
| CODE-096 | HX↔TS divergence | Medium | Date handling asymmetry (Paris wall-clock vs UTC) |
| CODE-097 | HX↔TS divergence | Medium | Percentage fees honoured in TS, disabled in HX |
| CODE-098 | HX↔TS divergence | Medium | Geocoding: HX server-side, TS trusts client lat/lng |
| CODE-099 | HX↔TS divergence | Medium | Document visibility lists differ |
| CODE-100 | HX↔TS divergence | Medium | Quit-group rules differ; hard-coded group id |
| CODE-101 | HX↔TS divergence | Medium | "New user" detection differs |
| CODE-102 | HX↔TS divergence | Medium | TS balance computation differs from service and from HX |
| CODE-103 | HX↔TS divergence | Medium | Operation rounding and `pending` reuse differ |
| CODE-104 | HX↔TS divergence | Medium | TS theme ignores the white-label theme edited in HX |
| CODE-105 | HX↔TS divergence | Medium | TS login requires a pre-existing HX session row |
| CODE-106 | HX↔TS divergence | Low | `Group.disabled` varchar vs MySQL ENUM; never written by application code |
| CODE-107 | HX↔TS divergence | Low | `Product.stockTracking` / `stockTrackingPerDistrib` nullability |
| CODE-108 | HX↔TS divergence | Low | `ProductDistributionStock` column types |
| CODE-109 | HX↔TS divergence | Low | `UserGroup.rights` typed non-nullable in TS |
| CODE-110 | HX↔TS divergence | Low | Property/relation renames between HX and TS with same columns |
| CODE-111 | HX↔TS divergence | Low | TS relations typed lazy (`Promise`) in some entities and eager in others |
| CODE-112 | HX↔TS divergence | Low | `RightSite.Admin` (HX) vs `SuperAdmin` (TS) |
| CODE-113 | HX↔TS divergence | Low | `OperationType` `VOrder` (HX) vs `Order` (TS) |
| CODE-114 | HX↔TS divergence | Low | `Distribution.quantities` default |
| CODE-115 | HX↔TS divergence | Low | `MultiDistrib.volunteerRolesIds` null/empty-string handling |
| CODE-116 | HX↔TS divergence | Low | GraphQL `Product` type mismatches |
| CODE-117 | HX↔TS divergence | Low | Cookie domain computation differs |
| CODE-118 | HX↔TS divergence | Low | TS login does not copy `User.lang` to `Session.lang` nor set `whichUser` |
| CODE-119 | HX↔TS divergence | Low | TS registration vs HX `User.check()` |
| CODE-120 | HX↔TS divergence | Low | Client/server contract-minimum estimates differ |
| CODE-121 | HX↔TS divergence | Low | Two "version" notions |
| CODE-122 | HX↔TS divergence | Low | Front theme/i18n/terms hard-coded vs HX dynamic |
| CODE-123 | HX↔TS divergence | Low | Sender address and Reply-To differ between HX and TS mailers |
| CODE-124 | Dead code/unused | Medium | `OrdersResolver.checkRights` is declared and never called |
| CODE-125 | Dead code/unused | Medium | `BlackListGuard` is never applied |
| CODE-126 | Dead code/unused | Low | Other: `createCycle` stub routes, `ContractAdmin` delete comment, comment swaps, `getOrderableCatalogsFromMultiDistrib` |
| CODE-127 | Dead code/unused | Low | TS `createOrUpdateTotalOperation` is buggy and has no caller |
| CODE-128 | Dead code/unused | Low | Duplicated/unreferenced TS balance functions |
| CODE-129 | Dead code/unused | Low | HX payment `link` fields point to `/transaction/<type>` routes with no handler |
| CODE-130 | Dead code/unused | Low | CSV report type is hidden |
| CODE-131 | Dead code/unused | Low | Dead or unused HX/TS auth artefacts |
| CODE-132 | Dead code/unused | Low | Unused imports in HX controllers |
| CODE-133 | Dead code/unused | Low | Cron scaffolding: empty CLI, events without listeners |
| CODE-134 | Dead code/unused | Low | Dead `_Camap` functions, unused layouts, stale generated template |
| CODE-135 | Dead code/unused | Low | Unused front envSchema, unused config variables, unused import |
| CODE-136 | Dead code/unused | Low | `camap-common` helpers with no callers; unread header |
| CODE-137 | Dead code/unused | Low | Scripts and wrappers not wired |
| CODE-138 | Config/build | High | Production compose build paths broken |
| CODE-139 | Config/build | High | Prod/easy compose: configuration cannot reach the Neko app |
| CODE-140 | Config/build | Medium | HX Apache proxy target host `nest-devcamap` exists only in dev compose |
| CODE-141 | Config/build | Medium | Traefik static config conflict |
| CODE-142 | Config/build | Medium | Nest start command and migrations differ by compose; easy runs watch mode |
| CODE-143 | Config/build | Medium | Dev compose `NODE_ENV=development` disables HttpOnly and cookie domain logic |
| CODE-144 | Config/build | Medium | HX template compile directories inconsistent |
| CODE-145 | Config/build | Medium | Secrets/tokens committed in the repo |
| CODE-146 | Config/build | Medium | Neo manifest cached for the process lifetime in `BridgeService` |
| CODE-147 | Config/build | Low | `serviceheaders` middleware and `service` router dangling; typo `adress` |
| CODE-148 | Config/build | Low | Easy compose uses image tag `:master` |
| CODE-149 | Config/build | Low | MySQL port 3306 published in dev and easy compose |
| CODE-150 | Config/build | Low | One `.env` file mounted for both runtimes with different parsing |
| CODE-151 | Config/build | Low | `HX_TRIGGER_CRONS=false` still triggers; unset `CAMAP_LOCAL_HOST` |
| CODE-152 | Config/build | Low | SMTP schema vs defaults |
| CODE-153 | Config/build | Low | Broken npm scripts (container names) |
| CODE-154 | Config/build | Low | Dev compose mounts shadow image-built artefacts |
| CODE-155 | Config/build | Low | Haxe-JS frontend always built in debug mode |
| CODE-156 | Config/build | Low | Two React/router generations on the same pages |
| CODE-157 | Config/build | Low | Wrong file-path comment in `set-public-path.ts` |
| CODE-158 | Config/build | Low | Front webpack build mutates the source tree and depends on `THEME_ID` |
| CODE-159 | Tests | Medium | HX test suite out of sync with code |
| CODE-160 | Tests | Medium | front-core Jest config references a missing setup file |
| CODE-161 | Tests | Low | Dataset generator `reset()` truncates `db.<table>`; test DB is `test` |
| CODE-162 | Tests | Low | e2e utils: unused `resetDb` parameter; `cleanDB` used by one spec |
| CODE-163 | Tests | Low | `test:cov` omits `TZ=UTC` |
| CODE-164 | Security/rights | High | TS message recipient lookup: rights check un-awaited |
| CODE-165 | Security/rights | High | TS `createMessage` does not check the messages right |
| CODE-166 | Bug/crash (null deref, un-awaited async) | Low | `/files/compressAll` never answers when the first file of the page is not an image |
| CODE-167 | Bug/crash (null deref, un-awaited async) | Low | Sugoi file signature cache is a Neko array indexed by file id |
| CODE-168 | Bug/crash (null deref, un-awaited async) | Low | Nest email layouts: unquoted `src` / `alt` attributes |
| CODE-169 | Dead code/unused | Low | HX `OrderService.sendOrderSummaryToMembers` has no caller |
| CODE-170 | Dead code/unused | Low | Email templates that no flow sends |
| CODE-171 | Dead code/unused | Low | HX reads the `smtp_*` platform variables only in commented-out code |
| CODE-172 | Config/build | Low | GraphQL Playground served whenever `NODE_ENV` is not `production` |
| CODE-173 | Config/build | Low | Superadmin email template list: layouts listed, links built on `FRONT_URL` |
| CODE-174 | Bug/crash (null deref, un-awaited async) | Medium | HX `/api/*` errors are rolled back out of the `Error` table |
| CODE-175 | Bug/crash (null deref, un-awaited async) | Low | HX `/api/catalog/subscriptionAbsences/:id` answers 500 to an anonymous call |
| CODE-176 | Bug/crash (null deref, un-awaited async) | Low | HX `/cron/minute?json=1` writes an `Error` row on every call |
| CODE-177 | Security/rights | High | Sugoi `/file/*` 404 discloses the valid file signature |
| CODE-178 | Security/rights | High | Session fixation: `?sid=` adopted and planted as cookie; no new id at login |
| CODE-179 | Security/rights | Medium | Weak session ids and cookie flags |
| CODE-180 | Bug/crash (null deref, un-awaited async) | Low | `TransactionWrappedTask` commits a failed task's partial writes |
| CODE-181 | Bug/crash (null deref, un-awaited async) | Low | CSV export does not escape quotes; `Csv.escape` is partly a no-op |
| CODE-182 | Config/build | Low | Last-resort error handler re-initialises the database schema |
| CODE-183 | Data integrity | Low | IPv4-sized `ip` columns truncate IPv6 addresses |
| CODE-184 | Bug/crash (null deref, un-awaited async) | Low | Deadlock retry ends without the error once its budget is spent |
| CODE-185 | Dead code/unused | Low | GraphQL multipart upload middleware mounted, no resolver takes an upload |

### Counts

| Category | High | Medium | Low | Total |
|---|---|---|---|---|
| Security/rights | 17 | 12 | 5 | 34 |
| Data integrity | 1 | 8 | 11 | 20 |
| Bug/crash (null deref, un-awaited async) | 0 | 12 | 22 | 34 |
| HX↔TS divergence | 0 | 17 | 18 | 35 |
| Dead code/unused | 0 | 2 | 12 | 14 |
| Config/build | 2 | 7 | 12 | 21 |
| Tests | 0 | 2 | 3 | 5 |
| **Total** | 20 | 60 | 83 | 163 |

---

## Security/rights

### CODE-001 - HX password reset step 4 does not verify the reset token
- Category: Security/rights
- Severity: High (Account takeover without authentication.)
- Description: The final step of HX password reset only checks the form fields; the target user id comes from the hidden `uid` field and the key is only checked in step 3 for display. Anyone who can POST the `chpass` form can set the password of any user id. (Reading of the code, not exercised.)
- Evidence: camap-hx/src/controller/User.hx:118-197 (hidden `uid` IntInput :141-143, step 4 :174-197); SUGOI form/Form.hx:460-474 (`isValid`), :507-514 (`isSubmitted`)
- Verdict: CONFIRMED
- Refs: 03#C1

### CODE-002 - TS `loginAs` authorization check is un-awaited and uses the target user
- Category: Security/rights
- Severity: High (Impersonation (auth bypass).)
- Description: `isGroupAdmin(user, groupId)` is async and not awaited (always a truthy Promise) and is called with the target user instead of `currentUser`; `user` is not null-checked. Any authenticated non-superadmin passing a `groupId` can impersonate any non-superadmin who belongs to <= 1 group. The HX counterpart is correct but the GraphQL mutation is callable directly. `loginAs` also does not update `Session.uid`.
- Evidence: camap-ts/packages/api-core/src/auth/auth.resolver.ts:127-148 (:135 null check, :137-140 call); camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:90-100; HX counterpart camap-hx/src/controller/Member.hx:92-96
- Verdict: CONFIRMED
- Refs: 03#C3

### CODE-003 - HX invite link hash covers only the email
- Category: Security/rights
- Severity: High (Rights bypass: arbitrary group membership.)
- Description: `/invite/<hash>/<email>/<group>/<user>`: the hash is `sha1(KEY+email)` only, so the `group` and `user` segments are unauthenticated; a valid hash for any email lets the visitor add any `user` id to any group. `session.data.amapId` is set before the membership check.
- Evidence: camap-hx/src/controller/Main.hx:308-318 (hash check at :310)
- Verdict: CONFIRMED
- Refs: 03#C7

### CODE-004 - TS `invitedGroupId` adds the user to any group (register path)
- Category: Security/rights
- Severity: High (Rights bypass: join a closed group.)
- Description: TS registration with `invitedGroupId` creates a user-group with no `regOption` check and no invite-hash check, while HX `doJoingroup` requires `Open`. Related register divergences are in CODE (HX-TS) "TS register vs HX `User.check()`".
- Evidence: camap-ts/packages/api-core/src/auth/auth.resolver.ts:99-104; camap-hx/src/controller/User.hx:238-239
- Verdict: CONFIRMED
- Refs: 03#C6

### CODE-005 - Stale password keeps working after HX reset (`pass` vs `pass2`)
- Category: Security/rights
- Severity: High (Authentication: a replaced password remains valid.)
- Description: HX `setPass` updates only `pass` (md5, trimmed) and leaves `pass2` (bcrypt) untouched; TS checks `pass2` first. After an HX reset the old password keeps working until the user logs in once with the new one (md5 fallback then overwrites `pass2`). HX also trims the password; TS does not.
- Evidence: camap-hx/src/db/User.hx:274-281; camap-ts/packages/api-core/src/auth/auth.service.ts:320-345 (bcrypt :324-330, md5 fallback :332-336, overwrite :338-343); camap-ts/packages/api-core/src/tools/crypto.service.ts:22-24
- Verdict: CONFIRMED
- Refs: 03#C2

### CODE-006 - TS reads without rights checks (user lists, waiting lists, users)
- Category: Security/rights
- Severity: High (Any logged user can read member data of any group.)
- Description: `getUserListInGroupByListType`, `getUserLists`, `getContractsUserLists`, `getDistributionsUserLists` need only a login (no `canManage*` call in the file); `getWaitingListsOfGroup` has no check while all other waiting-list operations require `canManageMembers`; `user(id)` and `getUsersFromEmails` are open to any user; `getInvitedUserToRegister` is public and returns cached personal data by email; `getEmailRecipientsByUserIds` right check is un-awaited.
- Evidence: camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts:23 (class-level GqlAuthGuard only); camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:40-45 vs :231-247; camap-ts/packages/api-core/src/users/users.resolver.ts:62-66, :106, :121-127, :129-140
- Verdict: CONFIRMED
- Refs: 03#C5, 05#3

### CODE-007 - Vendor `phone` / `email` field resolvers un-awaited rights check
- Category: Security/rights
- Severity: High (Privacy flags bypassed, including for unauthenticated callers.)
- Description: `userIsAllowedToManageCatalogOfVendor` is `private async` but called without `await`, so `editor` is a Promise (always truthy): vendor phone and email are returned regardless of `showPhone`/`showEmail`. The field resolvers have no `@UseGuards`; for anonymous callers `currentUser` is undefined so the helper rejects with a TypeError (unhandled rejection) while the data is still returned. The fields are declared non-null `String` though they can return null/empty. The three other call sites do `await` (:233,299,346).
- Evidence: camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:451-468 (calls :456-458, :465-467), :548-565 (`currentUser.id` :553)
- Verdict: CONFIRMED
- Refs: 04#C1, 11#I-2

### CODE-008 - Catalog `documents` rights check un-awaited; arguments swapped
- Category: Security/rights
- Severity: High (Document visibility restrictions bypassed.)
- Description: `canManageCatalog(...)` (async, user-groups.service.ts:128) is not awaited, so the branch is always true and every document (including `subscribers`/`members` visibility) is returned to any authenticated user; the intended logic (:175-193) is never reached. In that dead branch `findByUserIdAndCatalogId(parent.id, currentUser.id)` has swapped arguments (signature is `userId, catalogId`).
- Evidence: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:173, :175-193, :178-181 (class guard :38); camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:128,133; camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:29-39
- Verdict: CONFIRMED
- Refs: 04#C2, 06#C2

### CODE-009 - TS `attendanceVariableContract` has no rights check
- Category: Security/rights
- Severity: High (Rights bypass: reads subscriber data.)
- Description: Only the class-level `GqlAuthGuard` applies, so any logged-in user can read the subscriptions of any variable catalog; the classic variant requires manager or volunteer.
- Evidence: camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:90-139 (class guard :19) vs :44-70
- Verdict: CONFIRMED
- Refs: 05#3, 06#C3

### CODE-010 - `Distribution.userOrders` and `distribution(id)` reachable without authentication
- Category: Security/rights
- Severity: High (Unauthenticated read of order data.)
- Description: The distributions resolver class has only `@Resolver`; the `distribution(id)` query has no guard; there is no `APP_GUARD` and no `useGlobalGuards`. `Distribution.userOrders` exposes `userId`, `productId`, `quantity`, `productPrice`, `distributionId`, `subscriptionId`. HX requires `@logged` plus rights for the same data.
- Evidence: camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:19-20, :32-33, :96-104; camap-ts/packages/api-core/src/app.module.ts:66-75; camap-ts/packages/api-core/src/shop/types/user-order.type.ts
- Verdict: CONFIRMED
- Refs: 05#3, 11#I-4

### CODE-011 - HX `Distribution.doEditMd` / `doChangePrice` do not scope to the session group
- Category: Security/rights
- Severity: High (Cross-group modification.)
- Description: Only `canManageAllContracts()` of the current group is checked; the `MultiDistrib` from the URL is never compared with `app.user.getGroup()`, and `DistributionService.editMd` accepts the form `placeId` without checking it belongs to the group.
- Evidence: camap-hx/src/controller/Distribution.hx:24-27, :614-678, :1106-1151; camap-hx/src/service/DistributionService.hx:194-248
- Verdict: CONFIRMED
- Refs: 11#I-6

### CODE-012 - HX `History.doSubscriptionPayments` / `doBasket` / `doSubscriptionOrders` do not check ownership
- Category: Security/rights
- Severity: High (Any member can read (and trigger writes on) any subscription by id.)
- Description: `doSubscriptionPayments(subscription)` only checks that the caller is a member of the current group; it never compares `subscription.user` with `app.user` nor the subscription group, then lists that subscription payments and total operation, and it writes (`createOrUpdateTotalOperation`, :115). `doBasket` (:64-70, only `@logged`) and `doSubscriptionOrders` (:93-105) have the same limit.
- Evidence: camap-hx/src/controller/History.hx:64-70, :93-120 (:111-112, :113-120)
- Verdict: CONFIRMED
- Refs: 06#C8, 11#I-5

### CODE-013 - HX REST `api/Subscription` with no login/ownership check
- Category: Security/rights
- Severity: High (Possible unauthenticated read of subscription data.)
- Description: `GET /api/subscription/:id` (`doDefault` without POST goes to `getSubscription`) returns user info, constraints, orders and balance with no login or ownership test; POST branches dereference `app.user` without `checkIsLogged()`; `getSubscription(null)` dereferences `sub`; `doUpdateOrders`, `doUpdateDefaultOrder`, `doCheckDefaultOrder` have no login or rights check. Whether sugoi or the Api controller adds a global login guard was not checked.
- Evidence: camap-hx/src/controller/api/Subscription.hx:27-58 (:35,:66,:89 `app.user`), :60-80, :83-108, :111, :149-203
- Verdict: PLAUSIBLE: global login guard for `/api` not checked (draft 06 CONFIRMED by reading; draft 10 notes the same caveat)
- Refs: 06#C7, 10#9

### CODE-014 - HX `SubscriptionAdmin.doInsertPayment` / `Transaction.doInsertPayment` use the weak `isContractManager()`
- Category: Security/rights
- Severity: High (Payment insertion by managers of unrelated catalogs/users.)
- Description: `isContractManager()` without a catalog argument is true for any `ContractAdmin` right, while sibling actions use `canManageContract(catalog)`; the target user is not verified to belong to the session group; edit/delete use `canAccessMembership` plus a same-group check; TS uses `canManageAllCatalogs`.
- Evidence: camap-hx/src/controller/SubscriptionAdmin.hx:421-422; camap-hx/src/controller/Transaction.hx:25, :92, :132; camap-hx/src/db/User.hx:162-171; camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:91-103
- Verdict: CONFIRMED
- Refs: 06#C9, 07#12

### CODE-015 - HX `/cron/*` endpoints unauthenticated
- Category: Security/rights
- Severity: High (Anyone reaching the HX port can trigger mail/cron jobs.)
- Description: `Cron.canRun()` returns `true` unconditionally (auth/CLI checks commented out, intended guard in the comment :39-50); `doMinute`/`doHour`/`doDaily` call it; Apache rewrites any path to `index.n`; no Apache or Traefik rule blocks `/cron`; Nest calls it with plain `axios.get` and no credentials. Reachable only if the HX port is exposed.
- Evidence: camap-hx/src/controller/Cron.hx:36-38, :59, :93, :341; camap-hx/www/.htaccess:5-8; camap-hx/apache/camap-static.conf; camap-hx/apache.conf; camap-ts/packages/api-core/src/tools/crontab.service.ts:19-20
- Verdict: CONFIRMED
- Observed (characterisation suite, 2026-11-02): the controller constructor prints `now is <server time>` for any `/cron/*` URL, `doDefault` included, unless `json=1` (`camap-hx/src/controller/Cron.hx:26-28`): the server clock is public. The test harness uses it to check its fake clock.
- Refs: 01#14, 08#1, 10#5

### CODE-016 - HX `Product.doExport` lacks `canManageContract`; `/api/catalog` and `/api/product` unauthenticated
- Category: Security/rights
- Severity: High (Export without rights check (read access).)
- Description: `doExport` has no `canManageContract` check unlike sibling actions (:35,:150,:170,:188); `api/Catalog` and `api/Product` have no auth check and `api/product/get` returns inactive products too (`getProducts(false)`, :27); `api/Order.doCatalogs` (`/api/order/catalogs`) and `api/Product` have no `checkIsLogged()` while the other order endpoints do (Order.hx:52,78,105). Whether a global guard exists was not checked.
- Evidence: camap-hx/src/controller/Product.hx:286-324; camap-hx/src/controller/api/Catalog.hx:14; camap-hx/src/controller/api/Product.hx:13-29; camap-hx/src/controller/api/Order.hx:12-30
- Verdict: PLAUSIBLE: for the unauthenticated API reads a global sugoi login requirement was not verifiable; `doExport` missing check CONFIRMED by reading
- Refs: 04#C13, 10#10

### CODE-017 - HX batch product enable/disable derives the catalog from the first product id
- Category: Security/rights
- Severity: High (Cross-catalog write (verifier: exploitable by reading).)
- Description: The rights check applies to the catalog in the URL (`ContractAdmin.hx:258-259`), while `batchEnableProducts`/`batchDisableProducts` take the catalog from `productIds[0]` and only verify that all ids belong to that catalog; a manager of catalog A can enable/disable products of catalog B by passing only B ids.
- Evidence: camap-hx/src/service/ProductService.hx:14,35; camap-hx/src/controller/ContractAdmin.hx:258-259,262,275-285
- Verdict: CONFIRMED
- Refs: 04#C15

### CODE-018 - TS `multiDistribution(id)` needs only a login
- Category: Security/rights
- Severity: Medium (Authenticated read without group scoping.)
- Description: No rights check beyond authentication.
- Evidence: camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:62-74 (private helper `checkAndGetMultiDistribAndGroup` :187-214 is never called and has unreachable branches)
- Verdict: CONFIRMED
- Refs: 05#3

### CODE-019 - HX Distribution / ContractAdmin handlers without explicit rights checks
- Category: Security/rights
- Severity: Medium (Missing checks, exploitability depends on routing.)
- Description: `doInviteFarmers` (479), `doVolunteerRoles` (873), `doVolunteers` (937), `doListByProductUser` (78) have no rights check in the body; `doDeleteCycle` checks the section only and has no token (858-867); `ContractAdmin.doParticipate` has no `canManageContract` (1001-1011); `doEditRole` / `doDeleteRole` do not verify that the role belongs to the contract/group (221-249). Not checked against a global guard.
- Evidence: camap-hx/src/controller/Distribution.hx:78,479,858-867,873,937 (sibling check at :24); camap-hx/src/controller/ContractAdmin.hx:221-249,1001-1011
- Verdict: PLAUSIBLE: by reading only; a global/route guard (sugoi or Main) was not checked
- Observed (characterisation suite, 2026-11-06): `ContractAdmin.doBatchOrder` (:1102-1109) has no check of its own either: the controller constructor's `isContractManager()` (:29-31) lets a coordinator of any one catalog open the batch-order page of every catalog (`tests/specs/05-orders/order-pages.views.spec.ts`, ORD-ADO-001/011).
- Refs: 05#4

### CODE-020 - HX member subscription delete is a GET without CSRF token
- Category: Security/rights
- Severity: Medium (CSRF-style deletion.)
- Description: Member delete has no `checkToken`; the TS front links to it with a plain `href`; the admin delete requires a token.
- Evidence: camap-hx/src/controller/Subscriptions.hx:35-44; camap-ts/packages/front-core/src/modules/csaCatalog/containers/CsaCatalogSubscription.tsx:192-198; camap-hx/src/controller/SubscriptionAdmin.hx:52
- Verdict: CONFIRMED
- Refs: 06#C10

### CODE-021 - TS unauthenticated vendor/place queries
- Category: Security/rights
- Severity: Medium (Public queries.)
- Description: `getVendorsFromCompanyNumber` and `getVendorProfessions` carry no auth guard (other vendor queries have `@UseGuards(GqlAuthGuard)`); the `place` query is also unguarded. No `APP_GUARD` found.
- Evidence: camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:144,151; camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10
- Verdict: CONFIRMED
- Refs: 04#C21

### CODE-022 - Catalog `products` / `subscriptions` fields reachable without management check
- Category: Security/rights
- Severity: Medium
- Description: The `catalog` query is manager-only but `vendor.allCatalogs` and the `subscriptions` field do no rights check (only class-level authentication); field-level exposure depends on which Subscription fields are exposed.
- Evidence: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:38, :58-61, :141-149; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:433-436
- Verdict: PLAUSIBLE: leakage at field level not verified
- Refs: 04#C3

### CODE-023 - Brute-force counter depends on the client; `X-Real-Ip` header case
- Category: Security/rights
- Severity: Medium (Protection can be skipped by not calling the mutation.)
- Description: `login` never increments the counter; only the public `recordBadLogin` mutation (called by the React box) does. `UserIp` reads `request.headers['X-Real-Ip']` (mixed case; Node lowercases header names) so it always falls back to `request.ip`.
- Evidence: camap-ts/packages/api-core/src/auth/auth.service.ts:58-61, :295-309; camap-ts/packages/front-core/src/modules/loginRegistration/LoginBox.tsx:66; camap-ts/packages/api-core/src/common/decorators/user-ip.decorator.ts:7-9
- Verdict: CONFIRMED
- Refs: 03#C4

### CODE-024 - `/user/choose?group=ID` and `Group.doDefault` write `amapId` without membership check
- Category: Security/rights
- Severity: Medium
- Description: `/user/choose` accepts any group id with no membership check (page is `@logged`; downstream use of `amapId` not traced); `Group.doDefault` sets `amapId` for anonymous visitors of Open groups.
- Evidence: camap-hx/src/controller/User.hx:60-74; camap-hx/src/controller/Group.hx:25-36
- Verdict: CONFIRMED
- Refs: 03#C19

### CODE-025 - Auth-less or CSRF-less HX group/member actions; SQL concatenation
- Category: Security/rights
- Severity: Medium
- Description: `Group.doCreate` is not `@logged` and dereferences `app.user`; `Member.doMovetowl` has no CSRF token and no explicit `canAccessMembership` (whereas `doDelete` has both); `/admin/group` default has no `@admin` on the method (guarded by `Main.doAdmin`) and builds SQL by concatenating `groupName` and zip inputs.
- Evidence: camap-hx/src/controller/Group.hx:132-136; camap-hx/src/controller/Member.hx:118-120 vs :213-223; camap-hx/src/controller/admin/Group.hx:31-55; camap-hx/src/controller/Main.hx:333-336
- Verdict: CONFIRMED
- Refs: 03#C20

### CODE-026 - Unauthenticated `Install.doDiagnostics` and `/cssdemo`
- Category: Security/rights
- Severity: Medium
- Description: `doDiagnostics` has side effects (creates `file/` and `../tmp`), writes with `Sys.println` into the HTTP response and only prints a missing `.htaccess`; `/cssdemo` is also unauthenticated.
- Evidence: camap-hx/src/controller/Install.hx:106-122 (:114-116); camap-hx/src/controller/Main.hx:209-215
- Verdict: CONFIRMED
- Refs: 11#I-15

### CODE-027 - SQL assembled by string interpolation
- Category: Security/rights
- Severity: Medium
- Description: HX vendor search interpolates name (sanitised by removing `"` and a keyword denylist), profession and lat/lng unquoted; TS places/catalogs services interpolate numeric args (typed Int/Float GraphQL scalars, low exploitability).
- Evidence: camap-hx/src/service/VendorService.hx:43,55,63; camap-ts/packages/api-core/src/places/services/places.service.ts:31,47; camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:72,85
- Verdict: PLAUSIBLE: types of the HX search args upstream not checked
- Refs: 04#C25

### CODE-028 - TS `canManageAllCatalogs` broader than HX; auto rights and superadmin handling differ
- Category: Security/rights
- Severity: Medium (Rights semantics differ between HX and TS.)
- Description: HX `canManageAllCatalogs` = `ContractAdmin(null)` (params == null); TS = any `ContractAdmin` entry, including single-catalog ones. TS ignores HX auto rights (claimed vendors) in every check except `canManageCatalog`, which lets a claimed vendor owner manage any catalog of its vendor (no HX equivalent in `canManageContract`). `isGroupMember` returns true for superadmins for any group (HX `isMemberOf` does not). The superadmin test is written three ways in TS (`rights === 1`, `hasFlag`, ...). Equivalence of `rights === 1` and HX `isAdmin()` unverified.
- Evidence: camap-hx/src/db/User.hx:191-195, :342-344, :74-76; camap-hx/src/db/UserGroup.hx:155-168; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:102-105, :112-114, :138-140, :160-171; camap-ts/packages/api-core/src/users/models/user.entity.ts:123-125; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:555
- Verdict: CONFIRMED
- Observed (characterisation suite, 2026-11-06): `validateOperation` / `deleteOperation` require `canManageAllCatalogs`, which `hasRight(catalogAdmin)` grants to any `ContractAdmin` row whatever its catalog (`user-groups.service.ts:112-114,160-171`): a single-catalog coordinator validates and deletes payments (`tests/specs/06-payments/operation-mutations.graphql.spec.ts`, PAY-ENT-011).
- Refs: 03#C12, 03#C13, 04#C4 (verified part)

### CODE-029 - HX rights editor issues
- Category: Security/rights
- Severity: Medium
- Description: Both CheckboxGroups use name `"rights"`; `ua` is dereferenced without null check when the selected user is not a member; the self-lockout check runs after `giveRight` already persisted each right (rollback on the thrown Error unverified); `removeRight(ContractAdmin)` pushes the right before removing, leaving `params: []` entries (no caller found).
- Evidence: camap-hx/src/controller/AmapAdmin.hx:115,147,155-158,174-179; camap-hx/src/db/UserGroup.hx:89-137
- Verdict: CONFIRMED
- Refs: 03#C18

### CODE-030 - `Admin.doErrors` empties the `Error` table on GET without CSRF token
- Category: Security/rights
- Severity: Low (Guarded by admin; limited data (error log).)
- Description: Empty on `GET ?empty=1`; the `like` filter is parsed but its SQL is commented out; the admin side nav lacks links to `/admin/theme` and `/admin/superadmins`.
- Evidence: camap-hx/src/controller/admin/Admin.hx:101-129 (:110-113); camap-hx/lang/master/tpl/admin/basedesign.mtt:14-20
- Verdict: CONFIRMED
- Refs: 11#I-16

### CODE-031 - Bridge `GET /bridge/auth/delete-user/:id` is state-changing
- Category: Security/rights
- Severity: Low
- Description: User deletion exposed as a GET (class guarded by `AuthGuard('bridge')`), invoked from HX which swallows errors with `Sys.println`.
- Evidence: camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:13,47-48; camap-hx/src/controller/admin/User.hx:49-52
- Verdict: CONFIRMED
- Refs: 10#12

### CODE-032 - Reset-password link and token lifetimes
- Category: Security/rights
- Severity: Low
- Description: HX reset-password link uses `http://` while quit/notification links use `https://` unless DEBUG; reset token life 30 days vs 2 weeks for TS invitation/define-password tokens; `/user/choose` template links to `/group/create/` which is superadmin-only.
- Evidence: camap-hx/src/controller/User.hx:163,170; camap-hx/src/db/User.hx:554,562; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:171,295; camap-hx/lang/master/tpl/user/choose.mtt:63; camap-hx/src/controller/Group.hx:136-139
- Verdict: CONFIRMED
- Refs: 03#C21 (only choose.mtt:63 re-checked by the verifier)

### CODE-033 - Document type validated by file-name extension only
- Category: Security/rights
- Severity: Low
- Description: HX document upload and TS `createDocument` both validate "PDF" by extension, not content; both cap at 10 MB.
- Evidence: camap-hx/src/controller/Documents.hx:148; camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:66
- Verdict: CONFIRMED
- Refs: 11#I-14

### CODE-034 - `getLatestMessages` has no group-right check
- Category: Security/rights
- Severity: Low
- Description: Uses only `getUserMessages(currentUser.id)` (own messages).
- Evidence: camap-ts/packages/api-core/src/messages/messages.resolver.ts:83-100
- Verdict: CONFIRMED
- Refs: 08#16

### CODE-164 - TS message recipient lookup: rights check un-awaited
- Category: Security/rights
- Severity: High
- Description: `getEmailRecipientsByUserIds` tests `canManageMessages(...)` without `await`; a pending promise is always truthy, so any logged-in user gets the names and emails of the members of any group.
- Evidence: camap-ts/packages/api-core/src/users/users.resolver.ts:100-112 (:106); camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:116-118
- Verdict: CONFIRMED (observed: a member without the messages right gets other members' emails)
- Refs: characterisation suite `tests/specs/07-communication/message-recipients.graphql.spec.ts`; UND-121

### CODE-165 - TS `createMessage` does not check the messages right
- Category: Security/rights
- Severity: High
- Description: `createMessage` needs only a login: unlike the read queries it never calls `userIsAllowedToAccessMessages`, so any logged-in user can store a message and queue emails to the members of any group.
- Evidence: camap-ts/packages/api-core/src/messages/messages.resolver.ts:136-201 (no check), :206-218 (the check, used at :45, :54, :65)
- Verdict: CONFIRMED (observed: a plain member sends a group message)
- Refs: characterisation suite `tests/specs/07-communication/group-messages.graphql.spec.ts`; UND-120

### CODE-177 - Sugoi `/file/*` 404 discloses the valid file signature
- Category: Security/rights
- Severity: High
- Description: When the signature in a `/file/<id>_<sign>` URL is wrong, `doFile` answers `404 - File signature do not match '<given>' != '<valid>'`, printing the valid signature. Requesting `/file/<valid>` then serves the file, without login. Every stored file (catalog and group documents with `members`/`subscribers` visibility, contracts, images) can be downloaded by walking the ids. It defeats the signing scheme entirely.
- Evidence: SUGOI src/sugoi/BaseController.hx:49-62 (message :60); camap-hx/www/.htaccess (`/file/` not rewritten, `ErrorDocument 404 /index.n`)
- Verdict: CONFIRMED on the test stack: `GET /file/1_x` printed the signature of file 1, and `GET /file/<it>` returned the PDF (200 after the `?reload=1` redirect)
- Refs: Sugoi read (docs/08-sugoi.md)

### CODE-178 - Session fixation: `?sid=` adopted and planted as cookie; no new id at login
- Category: Security/rights
- Severity: High
- Description: `mainLoop` takes the session id from the `sid` URL parameter before the cookie, and `setCookie` then sends that id as the visitor's `sid` cookie. Logging in keeps the id: Haxe `Session.setUser` only sets `uid`, and TS login sets `uid` on the existing row. A link carrying an attacker's anonymous `sid` therefore plants it in the victim's browser; once the victim logs in, the attacker's browser shares the logged-in session.
- Evidence: SUGOI src/sugoi/BaseApp.hx:203-207,213-217,238; SUGOI src/sugoi/db/Session.hx:41-48; camap-ts/packages/api-core/src/auth/auth.service.ts:71-78
- Verdict: PLAUSIBLE: the cookie planting is CONFIRMED on the test stack (`GET /user/login?sid=<A>` answers `Set-Cookie: sid=<A>`); the takeover after the victim's login was not run end to end
- Refs: Sugoi read (docs/08-sugoi.md)

### CODE-179 - Weak session ids and cookie flags
- Category: Security/rights
- Severity: Medium
- Description: Session ids are 32 characters drawn with `Std.random` (not cryptographic) from a 60-character alphabet that misses `g`/`G` and has `j`/`J` twice. The `sid` cookie is sent without `HttpOnly`, `Secure` or `SameSite`, so scripts can read it and it travels over plain http.
- Evidence: SUGOI src/sugoi/db/Session.hx:107-115; SUGOI src/sugoi/BaseApp.hx:205
- Verdict: CONFIRMED (by reading; cookie observed on the test stack)
- Refs: Sugoi read (docs/08-sugoi.md)


---

## Data integrity

### CODE-035 - `Scripts.doCleannonamapdata` deletes groups with the `ShopMode` flag
- Category: Data integrity
- Severity: High (Bulk deletion of groups (data loss) if reachable.)
- Description: Destructive script with no confirmation; the only guard is a constructor throw when running under mod_neko.
- Evidence: camap-hx/src/controller/Scripts.hx:12-14, :55-60
- Verdict: CONFIRMED
- Refs: 08#18

### CODE-036 - HX `doBalanceTransfer` target subscription validated only for "same user"
- Category: Data integrity
- Severity: Medium
- Description: The form offers same-user, same-vendor, non-closed subscriptions, but the POSTed target id is validated only for same user, so a crafted id (the source itself, another vendor, or a closed subscription) is accepted. `fromSubscription.getBalance()` runs before the null check.
- Evidence: camap-hx/src/controller/SubscriptionAdmin.hx:396-409; camap-hx/src/service/SubscriptionService.hx:118-127, :1099-1131 (:1100 getBalance, :1102 null check, :1104 same-user check)
- Verdict: CONFIRMED
- Refs: 11#I-7

### CODE-037 - Balance query excludes non-subscription operations; hard-coded year 2022
- Category: Data integrity
- Severity: Medium
- Description: VOrder, Membership, membership payments and `Transaction.doInsertPayment` operations have `subscriptionId = NULL` and are dropped by the inner join in the balance query; the year 2022 is duplicated in both implementations; the query ignores `pending`; the comment says endDate < 2021 while the code uses `YEAR(startDate) > 2022`. TS membership payments are therefore not reflected in `UserGroup.balance`.
- Evidence: camap-hx/src/service/PaymentService.hx:347-350; camap-ts/packages/api-core/src/payments/services/payments.service.ts:287
- Verdict: CONFIRMED
- Refs: 07#2

### CODE-038 - Membership `paymentType` input ignored; other membership create gaps
- Category: Data integrity
- Severity: Medium
- Description: GraphQL inputs accept `paymentType` but `createMembership` has no such parameter and hard-codes cash; the resolver destructures it but never forwards it. Fee `0` is replaced by the group fee; no check that the user belongs to the group; `users[index]` indexing in `createMemberships` assumes `findByIds` preserves order.
- Evidence: camap-ts/packages/api-core/src/groups/services/memberships.service.ts:97-104, :112-114, :130-133, :224; camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:147-191, :202, :239; schema.gql:679,688
- Verdict: CONFIRMED
- Refs: 03#C14, 07#9

### CODE-039 - Reports: merged product lines do not add `totalHT`
- Category: Data integrity
- Severity: Medium
- Description: `getMultiDistribVendorOrdersByProduct` merges duplicates by adding `quantity` and `totalTTC` only, so `totalHT` is wrong for merged lines; the CSV export writes `o.totalHT` as is.
- Evidence: camap-hx/src/service/ReportService.hx:153-154; camap-hx/src/controller/ContractAdmin.hx:537, :599-657
- Verdict: CONFIRMED
- Refs: 07#14

### CODE-040 - `OrderService.edit` stock clamp and over-stock test differ from `make`
- Category: Data integrity
- Severity: Medium
- Description: Edit clamps with `availableStock * product.qt` whereas `make` writes `availableStock`; the over-stock test uses the old `order.quantity` for multiWeight; `paid = true` is left on zeroed orders.
- Evidence: camap-hx/src/service/OrderService.hx:130, :207, :214-217 (clamp :216), :227
- Verdict: CONFIRMED
- Refs: 06#C11

### CODE-041 - `updateOrderQuantity` subTotal uses current product price
- Category: Data integrity
- Severity: Medium
- Description: Returns `product.price * quantity`, whereas `prepare` and `Subscription.getTotalPrice` use the stored `productPrice`.
- Evidence: camap-hx/src/service/OrderService.hx:863 vs :357, :381; camap-hx/src/db/Subscription.hx:37
- Verdict: CONFIRMED
- Refs: 06#C12

### CODE-042 - `Basket.getOrCreate` creates a second basket when the existing one is OPEN
- Category: Data integrity
- Severity: Medium
- Description: Condition `b == null || status == OPEN` creates a new basket with status CONFIRMED instead of reusing/confirming it.
- Evidence: camap-hx/src/db/Basket.hx:52-61
- Verdict: CONFIRMED
- Refs: 06#C18

### CODE-043 - `Product.doEdit` rewrites stock rows before validation
- Category: Data integrity
- Severity: Medium
- Description: `updateProductStocksConfiguration` runs before `ProductService.check` and the `hasOrders` freeze checks, so a rejected edit still has deleted/re-created `ProductDistributionStock` rows (rollback only if the request is transactional: unverified).
- Evidence: camap-hx/src/controller/Product.hx:70-76
- Verdict: CONFIRMED
- Refs: 04#C14

### CODE-044 - Float equality in `Transaction.doInsertPayment`
- Category: Data integrity
- Severity: Low
- Description: Both operations are marked non-pending if `t2.amount + operation.amount == 0` with no rounding, evaluated before `Operation.check()` rounding.
- Evidence: camap-hx/src/controller/Transaction.hx:~64
- Verdict: CONFIRMED
- Refs: 07#11

### CODE-045 - "Past" subscription distributions defined two ways
- Category: Data integrity
- Severity: Low
- Description: `getSubscriptionDistributions("past")` uses `$end <= endOfToday`; `getSubscriptionDistribsNb("past")` uses `$date <= endOfToday`; `getSubscriptionRemainingDistribsNb` uses `$date >= now`.
- Evidence: camap-hx/src/service/SubscriptionService.hx:212, :232, :256
- Verdict: CONFIRMED
- Refs: 06#C15

### CODE-046 - `checkVarOrders` error message prints unrounded total
- Category: Data integrity
- Severity: Low
- Description: The message prints `$ordersTotal` unrounded while the check sums rounded lines.
- Evidence: camap-hx/src/service/SubscriptionService.hx:613, :618
- Verdict: CONFIRMED
- Refs: 06#C21

### CODE-047 - `createSubscription` passes `adminMode=false` to `setAbsences` even in admin mode
- Category: Data integrity
- Severity: Low
- Description: Third parameter of `AbsencesService.setAbsences` is `adminMode`.
- Evidence: camap-hx/src/service/SubscriptionService.hx:677, :681; camap-hx/src/service/AbsencesService.hx:31
- Verdict: CONFIRMED
- Refs: 06#C22

### CODE-048 - Stored `productPrice` in `defaultOrders` JSON never used
- Category: Data integrity
- Severity: Low
- Description: `CSAOrder` stores `productPrice` but `getDefaultOrdersTotal`/`getDefaultOrdersToString` recompute from the current product price and `createRecurrentOrders` re-reads `product.price`.
- Evidence: camap-hx/src/service/SubscriptionService.hx:24; camap-hx/src/controller/SubscriptionAdmin.hx:132-138; camap-hx/src/db/Subscription.hx:94-129; camap-hx/src/service/OrderService.hx:77
- Verdict: CONFIRMED
- Refs: 06#C23

### CODE-049 - Absence lock criterion differs between service and REST
- Category: Data integrity
- Severity: Low
- Description: Service uses `distribution.date < now`; REST uses `orderEndDate` vs now. `isNumberOfDaysValid("vacantRolesMail")` upper-bound message says "instructions mail to all members".
- Evidence: camap-hx/src/service/AbsencesService.hx:121,131; camap-hx/src/controller/api/Catalog.hx:89-90; camap-hx/src/service/VolunteerService.hx:236
- Verdict: CONFIRMED
- Refs: 05#9

### CODE-050 - `Distribution.getKey/makeKey` use deprecated `date` and `place` columns
- Category: Data integrity
- Severity: Low
- Description: `populate()` sets `place=null` while `getKey` uses it.
- Evidence: camap-hx/src/db/Distribution.hx:197, :206-212
- Verdict: CONFIRMED
- Refs: 05#15

### CODE-051 - `membershipFee` is `tinyint` (max 127)
- Category: Data integrity
- Severity: Low
- Description: Both HX and TS declare a tinyint while the HX form uses `IntInput`.
- Evidence: camap-hx/src/db/Group.hx:59; camap-ts/packages/api-core/src/groups/entities/group.entity.ts:57-58; camap-hx/src/controller/AmapAdmin.hx:48
- Verdict: CONFIRMED
- Refs: 03#C25

### CODE-052 - TS `register` accepts an empty password
- Category: Data integrity
- Severity: Low
- Description: Stores `pass=md5(KEY+'')` and `pass2=bcrypt('')` (known hash) but `loginSchema` requires a non-empty password, so such accounts cannot log in until reset. Used also by member import.
- Evidence: camap-ts/packages/api-core/src/auth/auth.service.ts:114-115; camap-ts/packages/api-core/src/auth/auth.resolver.ts:53; camap-ts/packages/camap-common/src/validators/loginSchema/loginSchema.ts
- Verdict: CONFIRMED
- Refs: 03#C26

### CODE-053 - VAT-HT computed without rounding; invoice duplicates the report logic
- Category: Data integrity
- Severity: Low
- Description: `getOrdersByVAT` and `Member.doInvoice` compute HT as `total/(1+vat/100)` without rounding; the invoice code is duplicated inline.
- Evidence: camap-hx/src/service/ReportService.hx:167-177; camap-hx/src/controller/Member.hx:177-200
- Verdict: CONFIRMED
- Refs: 07#18

### CODE-054 - `ReportService.getOrdersByProduct` groups by `price` but selects `AVG(productPrice)`
- Category: Data integrity
- Severity: Low
- Description: The "price" is an average (as the comment says); the GROUP BY on a column vs aggregate alias is MySQL-dependent (not checked against a live DB).
- Evidence: camap-hx/src/service/ReportService.hx:24, :27-37
- Verdict: CONFIRMED
- Refs: 07#15

### CODE-183 - IPv4-sized `ip` columns truncate IPv6 addresses
- Category: Data integrity
- Severity: Low
- Description: `Session.ip` and `Error.ip` are `SString<15>`. MySQL runs without strict mode, so IPv6 client addresses are cut silently.
- Evidence: SUGOI src/sugoi/db/Session.hx:12; SUGOI src/sugoi/db/Error.hx:11; docs/07-production-deployment.md §2 (`sql-mode`)
- Verdict: PLAUSIBLE (by reading; no IPv6 client on the test stack)
- Refs: Sugoi read (docs/08-sugoi.md)


---

## Bug/crash (null deref, un-awaited async)

### CODE-055 - TS `removeUsersFromGroup` / `moveBackToWaitingList` splice-in-loop and null entries
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `removeUsersFromGroup` pushes `userNotInGroup` errors but keeps `null` entries then calls `delete(ug)` on them (`userGroup.groupId` on null throws); index shifting after `splice` misaligns `users`/`userGroups`. `moveBackToWaitingList` has the same splice-inside-`forEach` misalignment, error keys differ from HX, typo key `cannotSetAdminToWaitingLIst`, and it does not reject users already in the waiting list (HX does). TS removal has no order/balance check unlike HX `Member.doDelete`.
- Evidence: camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:76, :85-104 (:93-100); camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:336-340; camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:76-83, :92; camap-hx/src/service/WaitingListService.hx:83-84; camap-hx/src/controller/Member.hx:121-124
- Verdict: CONFIRMED
- Refs: 03#C9, 05#13

### CODE-056 - `deleteAccount` continues after a `null` result
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: If the placeholder user `deleted@camap.tld` is missing the user is not deleted, yet the session is logged out and admins are emailed "deleted his account".
- Evidence: camap-ts/packages/api-core/src/users/users.resolver.ts:224-246; camap-ts/packages/api-core/src/users/users.service.ts:333-337
- Verdict: CONFIRMED
- Refs: 03#C10

### CODE-057 - `message(id)` dereferences before the null check
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: The rights check reads `message.amapId` before `if (!message) throw NotFoundException`, so an unknown id yields a TypeError (GraphQL internal error) instead of "Message not found".
- Evidence: camap-ts/packages/api-core/src/messages/messages.resolver.ts:58-81 (:63-67, deref :65, null check :67)
- Verdict: CONFIRMED
- Refs: 08#13, 11#I-3

### CODE-058 - `createMessage` dereferences a possibly null/undefined buffered mail
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `createBufferedJsonMail` returns null (no valid recipients) or undefined (test env); the resolver then reads `mail.htmlBody`, `mail.cdate` and `list.type`, throwing a TypeError.
- Evidence: camap-ts/packages/api-core/src/messages/messages.resolver.ts:192-197; camap-ts/packages/api-core/src/mails/mails.service.ts:99, :117
- Verdict: CONFIRMED
- Refs: 08#14

### CODE-059 - Deletes launched without `await` inside `@Transactional` jobs
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `deleteMessageOlderThanDate` is async and not awaited; the same pattern in the cache service, so the transaction may complete before the delete.
- Evidence: camap-ts/packages/api-core/src/messages/messages.service.ts:83; camap-ts/packages/api-core/src/tools/cache.service.ts:58
- Verdict: CONFIRMED
- Refs: 08#15

### CODE-060 - `VariableService.getInt` / `set` mishandle missing rows and async
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `getInt` tests `i === null` but TypeORM 0.2.45 `findOne` returns `undefined`, so a missing row throws at `parseInt(i.value)`; caller `VendorService.create` would fail on a DB without `platformtermsofservice`. `set()` calls `variableRepo.save(v)` without `await`. (`get()` uses `!v` correctly.)
- Evidence: camap-ts/packages/api-core/src/tools/variable.service.ts:36-60 (:47-48, :59); camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:183-195; typeorm/repository/Repository.d.ts:235
- Verdict: CONFIRMED
- Refs: 11#I-10

### CODE-061 - TS `updatePaymentOperation` / `makePaymentOperation` differ from HX; un-awaited balance update
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: HX locks the row and adds `abs(amount)`; TS adds `abs(amount)` with no lock and no rounding and does not `await` the async `updateUserBalance`; TS `makePaymentOperation` uses `roundPrice(old + amount)` without `abs`.
- Evidence: camap-hx/src/service/PaymentService.hx:67-76; camap-ts/packages/api-core/src/payments/services/payments.service.ts:232, :377-380
- Verdict: CONFIRMED
- Refs: 07#5

### CODE-062 - HX `Transaction.doEdit` / `doDelete` dereference `operation.subscription` before the null check
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: For VOrder and Membership operations (no subscription) the code fails instead of returning the intended message; `canAccessMembership` at :92 is also evaluated after the deref.
- Evidence: camap-hx/src/controller/Transaction.hx:88-96, :128-129
- Verdict: CONFIRMED
- Refs: 07#10

### CODE-063 - `ContractAdmin.doUpdatePrices` dereferences `args.d.id` for constant catalogs
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `args.d` is set only for variable catalogs, so a null error occurs after prices were updated for constant catalogs; the action also has no token check.
- Evidence: camap-hx/src/controller/ContractAdmin.hx:753-776 (:758-765, :775)
- Verdict: CONFIRMED
- Refs: 04#C17, 06#C17

### CODE-064 - Volunteer role handlers: null/unchecked access
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `Volunteers.doEditRole` forces `role.catalog = null` and is reachable for any role id; `updateRoleToFuturesDistribs` does `md.volunteerRolesIds.split` before the future-date guard (NPE if the column is NULL); same in `ContractAdmin.doInsertRole`; `getActiveMultiDistribs` returns all MDs of the group, not only active. Whether amapadmin routes are admin-gated is unverified.
- Evidence: camap-hx/src/controller/amapadmin/Volunteers.hx:121,124,166; camap-hx/src/controller/ContractAdmin.hx:203; camap-hx/src/db/Group.hx:198-200
- Verdict: CONFIRMED
- Refs: 05#6

### CODE-065 - `EntityFileService.updateOrCreate` always inserts
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: It never looks up an existing row (`save` of a DeepPartial without id), so it always inserts; used for vendor images and documents.
- Evidence: camap-ts/packages/api-core/src/tools/entityFile.service.ts:73-75; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:364; camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:~168-171
- Verdict: CONFIRMED
- Refs: 04#C23

### CODE-066 - TS `CatalogsService.create` discards `setFlag` result and has reversed arguments
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `setFlag(catalog.flags, CatalogFlags.UsersCanOrder)` has arguments reversed relative to `setFlag(enumIndex, flagValue)` and the (pure) result is discarded, so the flag is never set; default `orderEndHoursBeforeDistrib` 24 vs HX fallback 72 (when the form value is empty/0); TODO for rights. The method has no caller found by grep (latent bug).
- Evidence: camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:161, :206-226 (:221); camap-ts/packages/api-core/src/common/haxeCompat.ts:18-20; camap-hx/src/service/CatalogService.hx:171-173
- Verdict: CONFIRMED
- Refs: 02#16, 04#C8

### CODE-067 - TS inactive-user purge: async handler in stream callback, exact-day warning
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Handler declared `async` inside a stream `data` callback and not awaited; warns only on exact-day equality (a missed cron day skips the warning); first warning date is `twoYearsAgo + 1 month + 1 day - 1 ms`.
- Evidence: camap-ts/packages/api-core/src/users/users.service.ts:453-456, :567-603
- Verdict: CONFIRMED
- Refs: 03#C22

### CODE-068 - HX `doLogin` redirect Bool and `Auth_sid` comparison
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `view.redirect = app.params.exists("redirect")` assigns a Bool; `Main.doHome` compares `Auth_sid` to `view.sid`, which is only set in `User.doLogin`, so a non-null `Auth_sid` and no user always redirects to logout; the `@logged` redirect param goes to `/` then `/home`, dropping it (end-to-end unverified).
- Evidence: camap-hx/src/controller/User.hx:30, :42-43; camap-hx/src/controller/Main.hx:34-47, :70-77; SUGOI BaseApp.hx:131
- Verdict: CONFIRMED
- Refs: 03#C8

### CODE-069 - `Distribution.doVolunteersCalendar` reads `args.returnUrl` before the null test
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Also changes state (role registration) on GET. Sugoi may always instantiate `args` (unverified).
- Evidence: camap-hx/src/controller/Distribution.hx:991-1002
- Verdict: CONFIRMED
- Refs: 05#5

### CODE-070 - `CamapDatePicker` constructor parameter typo `attibutes`
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: The constructor parameter is spelled `attibutes` while `super(...)` passes `attributes` (the inherited field), so the argument is silently ignored.
- Evidence: camap-hx/src/form/CamapDatePicker.hx:12-21 (:15, :18)
- Verdict: PLAUSIBLE: effect depends on how Haxe resolves `attributes` (inherited field) at compile time; typo itself verified
- Refs: 05#14 (PLAUSIBLE), 11#I-8 (CONFIRMED)

### CODE-071 - Mail template double slash in contract link
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `https://::HOST:://subscriptions/contract/<id>`; the vendor link on the next line uses a single slash.
- Evidence: camap-hx/lang/master/tpl/mail/notifications/subscription-created-user.mtt:2-3
- Verdict: CONFIRMED
- Refs: 11#I-9

### CODE-072 - Media upload limit 4 MB vs "3 Mb" comment and "3 Mo" messages; visibility options
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Limit coded `getMultipart(1024*1024*4)`, comment says 3 Mb, error message and template label say 3 Mo; `Media.doEdit` offers only "public" visibility and default 'members'.
- Evidence: camap-hx/src/controller/Media.hx:41-43, :97-99; camap-hx/lang/master/tpl/contractadmin/addmedia.mtt:12
- Verdict: CONFIRMED
- Refs: 04#C18, 11#I-12

### CODE-073 - `FilesController` stray statement, `@Res()` return and in-place overwrite; `getExtension` split
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `compressFile` contains a stray `4;` before the rights check; `compressFiles` injects `@Res()` yet returns `'No page'` when `page` is falsy (the request may hang: unverified); the three routes overwrite blobs in place with no backup. `getExtension` uses `split('.')[1]` (wrong for names with several dots); `makeSign` cache is a `static CACHE=[]` keyed by id.
- Evidence: camap-ts/packages/api-core/src/files/file.controller.ts:51-150 (:57, :77, :99, :131); camap-ts/packages/api-core/src/files/file.service.ts:15, :50-53, :61
- Verdict: CONFIRMED
- Refs: 04#C20, 11#I-13

### CODE-074 - `vendors.resolver` `currentUser.email2.toLowerCase()` on null
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Throws if `email2` is null (entity nullable); only evaluated when the first comparison is already unequal, so impact is a TypeError/500 instead of `UnauthorizedException`. Also `vendor.disabled` is declared non-nullable in the resolver and nullable in the type.
- Evidence: camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:76, :423; camap-ts/packages/api-core/src/users/models/user.entity.ts:58; camap-ts/packages/api-core/src/vendors/types/vendor.type.ts:88-89
- Verdict: CONFIRMED
- Refs: 04#C21, 04#C22

### CODE-075 - `createOrUpdateOrders` / `updateOrderQuantity` dereference `multiDistrib` when only a catalog is passed
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `checkRights` allows catalog-only calls, but the service reads `multiDistrib.distribStartDate` unguarded.
- Evidence: camap-hx/src/service/OrderService.hx:696-709, :712, :828; camap-hx/src/controller/api/Order.hx:32-40
- Verdict: CONFIRMED
- Refs: 06#C19

### CODE-076 - `Contract.doEditVarOrders` truncates quantities and dereferences a null operation
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Uses `Std.parseInt` and `basket.getOrderOperation(false)` without a null check; no incoming link found.
- Evidence: camap-hx/src/controller/Contract.hx:188, :225, :242-244
- Verdict: CONFIRMED
- Refs: 06#C14

### CODE-077 - `OrderService.confirmTmpBasket` calls `make` with a Basket as `paid`
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: 5th parameter of `make` is `?paid:Bool`; `make` throws without a subscription; no callers of `confirmTmpBasket`; a Haxe compile error is expected so a build check is needed.
- Evidence: camap-hx/src/service/OrderService.hx:30, :109, :476
- Verdict: PLAUSIBLE: could not check whether the Haxe build type-checks this code
- Observed (characterisation suite, 2026-11-06): `/contractAdmin/tmpBaskets` fails as soon as an OPEN basket exists (`camap-hx/src/db/Basket.hx:231`), although nothing creates one any more (`tests/specs/05-orders/order-pages.views.spec.ts`, ORD-BSK-003; feature removed by UND-077).
- Refs: 06#C13

### CODE-078 - Orders/basket: REST `adminMode` handling
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: HX REST `api/Subscription` forces `adminMode = true` on create and `updateOrders` but computes it for `updateDefaultOrder`; `adminMode` is not read in `updateOrders`/`setOrders`; `isGroupManager()` uses the session group while `canManageContract` uses `c.group`.
- Evidence: camap-hx/src/controller/api/Subscription.hx:49-50, :75-76, :93-96; camap-hx/src/service/SubscriptionService.hx:363,378,475,983,990; camap-hx/src/db/User.hx:120-134, :215-222
- Verdict: CONFIRMED
- Refs: 06#C6

### CODE-079 - TS error enum value clash and unused imports
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `DISTRIBUTION_DATE_AFTER_ORDER_END_DATE = 'DISTRIBUTION_DATE_BEFORE_ORDER_END_DATE'`; the enum has 17 reasons but TS emits only two; `MultiDistribsService` has unused `Cron`, `format`, `fr` imports and unused `Transactional`/`mailsService`.
- Evidence: camap-ts/packages/api-core/src/shop/services/distributions.service.error.ts:4-5,16-17; camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:2-6, :180-202
- Verdict: CONFIRMED
- Refs: 05#2

### CODE-080 - `getFromTimeRange` upper bound and sort comment (HX); `isActive` vs `canOrderNow`
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: HX upper bound is `<` while `to` is set to 23:59, TS uses inclusive `Between`; the HX comment says "sort by date desc" but sorts ascending. `isActive()` is inclusive vs `canOrderNow()` strict; `hasVacantVolunteerRoles` compares role count with the total Volunteer rows.
- Evidence: camap-hx/src/db/MultiDistrib.hx:55-62, :152, :423; camap-hx/src/controller/Distribution.hx:162; camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:85
- Verdict: CONFIRMED
- Refs: 05#8, 05#12

### CODE-081 - Date helper approximations (`dateToIso`, `DateTool`)
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `Formatting.dateToIso` hard-codes DST boundaries (29 Mar / 25 Oct); `DateTool.fromJs/toJs` table covers 2019-2024 and has no callers outside DateTool.
- Evidence: camap-hx/common/Formatting.hx:229-231; camap-hx/src/tools/DateTool.hx:10-35, :93, :118
- Verdict: CONFIRMED
- Refs: 05#11

### CODE-082 - Cron small bugs and hard-coded French
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Daily error report uses `Date.now()` instead of `this.now`; vacant-role subject and date string hard-coded in French; two tasks both named "Email digest"; stale comment about `distribNotif`; `sendOrdersLists` SQL joins with `AND` instead of `WHERE` and has no `distribMinOrdersTotal` filter; hourly window `setHourMinute(h+1)` at 23h gives 24 (normalisation depends on DateTool).
- Evidence: camap-hx/src/controller/Cron.hx:98-107, :138, :156-165, :197, :200, :281, :346, :353-376, :464-466, :716-724; camap-hx/src/tools/DateTool.hx:45
- Verdict: PLAUSIBLE: the 23h case depends on runtime Date normalisation (not run); other sub-items CONFIRMED
- Refs: 08#3, 08#4, 08#5, 08#6, 08#7, 08#8

### CODE-083 - `/distribution/validate/:md` redirect has no handler
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Targeted by controller and template but no `doValidate` exists; `getState()` never returns `validated` while the template branches on it; the template hard-codes dates `2021-03-10/11`. TS still carries `VALIDATED`, `MULTI_DISTRIB_IS_ALREADY_VALIDATED`, `NOT_YET_DISTRIBUTED`.
- Evidence: camap-hx/src/controller/Distribution.hx:1096,1144; camap-hx/lang/master/tpl/distribution/default.mtt:87,129,131,173,184,188; camap-hx/src/db/MultiDistrib.hx:260-284; camap-ts/packages/api-core/src/shop/multi-distrib-status.ts:5; camap-ts/packages/api-core/src/shop/services/distributions.service.error.ts:4-5
- Verdict: CONFIRMED
- Refs: 05#1

### CODE-084 - Neo module `attention` not registered
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Template mounts `attention` but `modules` has no such key; `createNeoModule` would throw `Unknown module: attention`. The admin layout lists `/admin/attention` routes but is itself unused.
- Evidence: camap-hx/lang/master/tpl/attention/default.mtt:7; camap-ts/packages/front-core/src/neo.tsx:42-147, :172-174; camap-ts/packages/front-core/src/layout/AdminLayout.tsx:26,31
- Verdict: CONFIRMED
- Refs: 09#C1

### CODE-085 - `View.neoArgs` mishandles Bool and arrays; `HttpUtil.PATCH = 'GET'`
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `neoArgs` serialises only String/Int/Float/null/objects; Bool and arrays fall to the nested branch (inferred from code, not executed); `HttpUtil.HttpMethod.PATCH` is `'GET'` (unused today).
- Evidence: camap-hx/src/View.hx:285-302; camap-hx/lang/master/tpl/attention/default.mtt:9; camap-hx/js/utils/HttpUtil.hx:16
- Verdict: CONFIRMED
- Refs: 09#C6, 09#C2

### CODE-086 - `BASE_URL` evaluated at import in `useRestGetApi`; `/env.js` ordering; hard-coded dev story URL
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `BASE_URL` is a module constant; if `/env.js` has not defined `__APP_CONFIG__` it falls back to `window.location.origin`, correct only if `BridgeService` puts `/env.js` first. `datasets.story.tsx` hard-codes `http://localhost/api/createSid` (HX `DEBUG=true` only) and the dataset password `'admin'`.
- Evidence: camap-ts/packages/front-core/src/lib/REST/useRestGetApi.tsx:5; camap-ts/packages/front-core/src/lib/runtimeCfg.ts:52-55; camap-hx/src/service/BridgeService.hx:53; camap-ts/packages/front-core/src/dev-tools/datasets.story.tsx:188,197; camap-hx/src/controller/Api.hx:86
- Verdict: CONFIRMED
- Refs: 10#14, 10#15

### CODE-087 - HX `api/Distributions` handlers declared without `public`
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `Distributions.hx:21,36` are the only `do*` without `public`; the front calls `unsubscribeFromRole` with POST though the handler is method-agnostic. Runtime dispatch by sugoi likely works (visibility is compile-time).
- Evidence: camap-hx/src/controller/api/Distributions.hx:21,36; camap-ts/packages/front-core/src/modules/volunteersCalendar/requests.tsx:37-41
- Verdict: PLAUSIBLE: runtime dispatch by sugoi not verified
- Refs: 10#11

### CODE-088 - Cron concurrency: daily job at 00:00 coincides with `cleanOldMessages`
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: Both at midnight; HX hour job and TS minute flush run without an explicit lock on the HX side (not checked).
- Evidence: camap-ts/packages/api-core/src/tools/crontab.service.ts:43; camap-ts/packages/api-core/src/messages/messages.service.ts:79
- Verdict: CONFIRMED
- Refs: 08#17

### CODE-166 - `/files/compressAll` never answers when the first file of the page is not an image
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: The response is written only inside the loop, when it reaches index 0 and that file was recompressed. If the first file of the page fails (not an image) or the page is empty, the request hangs until a timeout, although the other images are recompressed. Production's ingress cuts it at 30 s anyway (docs/07 §4).
- Evidence: camap-ts/packages/api-core/src/files/file.controller.ts:90-150 (response only at :132-140)
- Verdict: CONFIRMED (observed: no answer within 5 s, image recompressed)
- Refs: characterisation suite `tests/specs/08-administration/maintenance-tools.api.spec.ts`; related CODE-073

### CODE-167 - Sugoi file signature cache is a Neko array indexed by file id
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `File.makeSign` caches signatures in `CACHE[id]`, a Neko array: a very large id (beyond the Neko array limit, about 2^29) fails. Production ids are far below, so this is latent; it made two tests fail depending on the time of day when ids came from `Date.now()`.
- Evidence: SUGOI src/sugoi/db/File.hx:28-36 (`CACHE[id]` read :31, written :34, at `c3b8db8`)
- Verdict: CONFIRMED (observed in the test suite before the id range was narrowed)
- Refs: characterisation suite `tests/specs/03-catalogs/documents-files.views.spec.ts`

### CODE-168 - Nest email layouts: unquoted `src` / `alt` attributes
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: The logo `<img>` of the twig layouts writes `src={{ ... }}` and `alt={{ ... }}` without quotes, so a theme name with a space breaks the attribute: `alt=logo CAMAP` gives `alt="logo"` plus a stray attribute `camap=""`.
- Evidence: camap-ts/packages/api-core/mails/src/_layout-camap.twig:10; camap-ts/packages/api-core/mails/src/_layout-group.twig:34
- Verdict: CONFIRMED (by reading the templates; the stray `camap=""` attribute was seen in rendered emails during the test pass, no test asserts it)
- Refs: characterisation suite `tests/specs/07-communication/mail-content.cron.spec.ts`

### CODE-174 - HX `/api/*` errors are rolled back out of the `Error` table
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Medium
- Description: `Main.doApi` logs an unexpected error with `logError()` and then calls `app.rollback()`, which removes the row it just wrote; service errors (`tink.core.Error`) are not logged at all. Errors raised under `/api/*` (the JSON API used by the ordering widgets) leave no trace in the error log nor in the daily errors email.
- Evidence: camap-hx/src/controller/Main.hx:189-206 (logError :203, rollback :198, :205)
- Verdict: CONFIRMED (observed: an API 500 leaves no `Error` row)
- Refs: characterisation suite `tests/specs/00-stack/smoke.spec.ts`

### CODE-175 - HX `/api/catalog/subscriptionAbsences/:id` answers 500 to an anonymous call
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `doSubscriptionAbsences` calls `app.user.canManageContract(...)` and reads `app.user.id` with no login check, so a visitor gets a null-dereference 500 instead of a refusal. No data is returned. Related: CODE-016 (unauthenticated `/api/catalog`), CODE-174 (the error is not logged).
- Evidence: camap-hx/src/controller/api/Catalog.hx:77-80
- Verdict: CONFIRMED (observed: anonymous call → 500)
- Refs: characterisation suite `tests/specs/00-stack/smoke.spec.ts`

### CODE-176 - HX `/cron/minute?json=1` writes an `Error` row on every call
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: On purpose ("debug in error log db"), the JSON mode of the minute job logs its clock and job list with `logError` on every run. This pollutes the error log and the daily errors email (COM-JOB-006) with non-errors.
- Evidence: camap-hx/src/controller/Cron.hx:80-84
- Verdict: CONFIRMED (by reading; seen in the `Error` table while building the harness, no test asserts it)
- Refs: Phase 0 harness work (`PROGRESS.md`, 2026-11-02)

### CODE-180 - `TransactionWrappedTask` commits a failed task's partial writes
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: With `noException` (what the cron jobs pass in production, `!App.config.DEBUG`), an exception is logged and the task then **commits**, keeping whatever it wrote before failing. Its `START TRANSACTION` also implicitly commits the pending work of the surrounding request transaction.
- Evidence: SUGOI src/sugoi/tools/TransactionWrappedTask.hx:38-60; camap-hx/src/controller/Cron.hx:154,210,218,225,278,286,351,376
- Verdict: CONFIRMED (by reading)
- Refs: Sugoi read (docs/08-sugoi.md)

### CODE-181 - CSV export does not escape quotes; `Csv.escape` is partly a no-op
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: `printCsvDataFromObjects` / `printCsvDataFromStringArray` wrap each value in `"` without doubling inner quotes, so a value containing `"` or `;` breaks the row. `Csv.escape` replaces `"` but its newline and tab replacements discard their result.
- Evidence: SUGOI src/sugoi/tools/Csv.hx:244-293
- Verdict: CONFIRMED (by reading)
- Refs: Sugoi read (docs/08-sugoi.md)


---

### CODE-184 - Deadlock retry ends without the error once its budget is spent
- Category: Bug/crash (null deref, un-awaited async)
- Severity: Low
- Description: The global `DeadlockInterceptor` re-runs the whole handler on `ER_LOCK_DEADLOCK` with `retryWhen(errors => errors.pipe(tap(...), take(5)))`. When `take(5)` completes the notifier, `retryWhen` completes the result stream without a value instead of re-throwing the deadlock, so after the last retry the caller gets an empty result (Nest then reports a generic "no elements in sequence" error) and the deadlock is not logged as such. There is no delay between retries, and `retryWhen` is deprecated in RxJS 7.
- Evidence: camap-ts/packages/api-core/src/common/interceptors/dealock.interceptor.ts:10-23; registered globally in camap-ts/packages/api-core/src/app.module.ts (`APP_INTERCEPTOR`)
- Verdict: PLAUSIBLE (by reading the RxJS semantics; no test provokes a deadlock)
- Refs: E1 inventory ([09-camap-ts-upgrade.md](09-camap-ts-upgrade.md) §3)

## HX↔TS divergence

### CODE-089 - `Vendor.companyNumber` nullability vs migration
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX `SNull<SString<64>>`, TS entity nullable, but the migration creates `varchar(64) NOT NULL`.
- Evidence: camap-hx/src/db/Vendor.hx:40; camap-ts/packages/api-core/src/vendors/entities/vendor.entity.ts:101-102; camap-ts/packages/api-core/src/migrations/1721184612071-addCompanyNumber.ts:7
- Verdict: CONFIRMED
- Refs: 02#1

### CODE-090 - `Catalog.endDate` nullable in HX, non-null in TS
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX `SNull<SDateTime>`; TS `datetime` non-null `endDate: Date`.
- Evidence: camap-hx/src/db/Catalog.hx:30; camap-ts/packages/api-core/src/vendors/entities/catalog.entity.ts:41-42
- Verdict: CONFIRMED
- Refs: 02#2

### CODE-091 - `Basket.status`: TS-only `PAYMENT_PROCESSING`; varchar vs enum
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX `SString<32>` with values OPEN/CONFIRMED/VALIDATED; TS `enum` column adds `PAYMENT_PROCESSING`, never seen by HX.
- Evidence: camap-hx/src/db/Basket.hx:7-12, :25; camap-ts/packages/api-core/src/shop/entities/basket.entity.ts:15-21, :39-40
- Verdict: CONFIRMED
- Refs: 02#3

### CODE-092 - `NotificationMail` entity: nullability, attachments shape, relations
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX all non-null (`htmlBody`, `textBody`, `attachments`); TS and DDL nullable. HX `attachments` stores `Array<String>` JSON; TS getter types it as objects `{filename,contentType,content,encoding,cid?}`. HX declares relations `group`/`recipient`; TS has only `@JoinColumn` without `@ManyToOne` and the DDL has no FK/indexes. The TS entity has no reader/writer in TS (only the migration `1773912252829-EmailDigests.ts` references it).
- Evidence: camap-hx/src/db/NotificationMail.hx:14-31; camap-ts/packages/api-core/src/mails/models/notification-mail.entity.ts:26-72; camap-ts/packages/api-core/src/migrations/1773912252829-EmailDigests.ts:7
- Verdict: CONFIRMED
- Refs: 02#7, 08#12

### CODE-093 - `GroupFlags` subset and renamed in TS
- Category: HX↔TS divergence
- Severity: Medium
- Description: TS keeps indices 0, 3-10, renamed without `__` (only `__HasMembership` keeps it), and omits `__ShopMode` (1), `__HasPayments` (2), `AllowInformationNotifs` (11), `AllowAlertNotifs` (12). HX translation key `AmapAdmin` is used for the right named `GroupAdmin`; `Amap.doEdit` pushes excluded ordinal `2` twice.
- Evidence: camap-ts/packages/api-core/src/groups/types/interfaces.ts:1-11; camap-hx/src/db/Group.hx:9-24; camap-hx/src/App.hx:285; camap-hx/src/controller/Amap.hx:48-49
- Verdict: CONFIRMED
- Refs: 02#11, 03#C24

### CODE-094 - `CatalogFlags` defined twice in TS with 3 of 6 values
- Category: HX↔TS divergence
- Severity: Medium
- Description: TS defines UsersCanOrder, StockManagement, PercentageOnOrders; omits DisplayPricesOnGroupPage, NotifyVendorOnOrderEnd, NotifyContactOnOrderEnd, which are invisible to TS.
- Evidence: camap-ts/packages/api-core/src/vendors/entities/catalog.entity.ts:20-24; camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:14-18; camap-hx/src/db/Catalog.hx:8-15
- Verdict: CONFIRMED
- Refs: 02#12, 04#C7

### CODE-095 - `StockTracking` defined twice in TS (numeric vs string enum)
- Category: HX↔TS divergence
- Severity: Medium
- Description: Numeric in camap-common (used by `ProductEntity`, DB tinyint ordinal) and string-valued in `vendors/product.interface.ts` (registered in GraphQL, used by the resolver). The resolver returns the raw DB number (:150) or `StockTracking.Disabled` string for a string-enum GraphQL type; serialisation not verified (would normally raise "Enum cannot represent value").
- Evidence: camap-ts/packages/camap-common/src/products/interfaces.ts:13-27; camap-ts/packages/api-core/src/vendors/product.interface.ts:4-20; camap-ts/packages/api-core/src/vendors/entities/product.entity.ts:14,16,41-45; camap-ts/packages/api-core/src/vendors/types/product.type.ts:2; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:19,143-151
- Verdict: CONFIRMED (enums); PLAUSIBLE for GraphQL runtime behaviour (not verified)
- Refs: 02#15, 04#C10

### CODE-096 - Date handling asymmetry (Paris wall-clock vs UTC)
- Category: HX↔TS divergence
- Severity: Medium
- Description: Four TS entities convert Paris/UTC while other datetime columns do not; `Group.membershipRenewalDate` is `string` in TS vs `SDate` in HX; `User.birthDate` is `Date` in TS for a `date` column. In `multi-distribs.service.ts`, `getFromTimeRange` mutates its arguments and compares the raw column to server-local `setHours` values without Paris conversion; `getNextMultiDistribInGroup`, `findDistributedByGroup`, `byGroupAndAfterDate` compare `raw_` with `new Date()` unconverted while `findMultiDistribsByDates` and `findNextDistributionsOfCatalogs` convert with `utcToZonedTime`. Correct only if the API process TZ is Europe/Paris (not configured in repo; tests run `TZ=UTC`). `CatalogEntity` dates are plain `Date`.
- Evidence: camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:50-53, :62-70, :79-85, :99, :109; camap-ts/packages/api-core/src/shop/services/distributions.service.ts:53; camap-ts/packages/api-core/src/shop/entities/distribution.entity.ts:82-90; camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:99-106; camap-ts/packages/api-core/package.json:27
- Verdict: CONFIRMED (code); PLAUSIBLE for runtime effect (process TZ not verified)
- Refs: 02#18, 05#10

### CODE-097 - Percentage fees honoured in TS, disabled in HX
- Category: HX↔TS divergence
- Severity: Medium
- Description: TS `hasPercentageOnOrders` honours the flag + `percentageValue` while HX always returns false; TS GraphQL price and `ProductEntity.getPriceWithMargins` (no flag check) can differ from HX `getPrice`.
- Evidence: camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:146-153, :169-178; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:100-112; camap-ts/packages/api-core/src/vendors/entities/product.entity.ts:105-111; camap-hx/src/db/Catalog.hx:128-131
- Verdict: CONFIRMED
- Refs: 04#C9

### CODE-098 - Geocoding: HX server-side, TS trusts client lat/lng
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX geocodes the vendor on every save; TS `updateVendor` never geocodes and lat/lng are plain editable fields; HX place insert never geocodes unlike edit. Place country rule: insert only FR/BE vs 8 options in the form vs 13 codes in the front.
- Evidence: camap-hx/src/service/VendorService.hx:137-145; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277; camap-ts/packages/front-core/src/modules/vendorDashboard/VendorForm.tsx:402-436; camap-hx/src/controller/Place.hx:50-56, :75-82; camap-hx/src/db/Place.hx:113-125; camap-ts/packages/front-core/src/utils/mapbox-geocoding.ts:24-25,33
- Verdict: CONFIRMED
- Observed (characterisation suite, 2026-11-06): when a place's address changes, hx geocodes it and overwrites the coordinates typed in the same form (`camap-hx/src/controller/Place.hx:49-55`; `tests/specs/03-catalogs/places.forms.spec.ts`).
- Refs: 04#C5, 04#C6

### CODE-099 - Document visibility lists differ
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX group documents allow subscribers/members/public; TS group docs only public/members, catalog docs members+subscribers; TS vendor documents only `public` is valid and TS returns all vendor documents with no visibility filtering. HX has no vendor documents.
- Evidence: camap-hx/src/controller/Documents.hx:57-62; camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:95-126; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:438-449
- Verdict: CONFIRMED
- Refs: 04#C24

### CODE-100 - Quit-group rules differ; hard-coded group id
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX checks orders in distributions of active catalogs (+ended <1 month); TS `findRecentUserOrders` < 1 month; TS hard-codes group id 16936.
- Evidence: camap-hx/src/controller/User.hx:272-302; camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts:124-128, :141-147
- Verdict: CONFIRMED
- Refs: 03#C11

### CODE-101 - "New user" detection differs
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX `pass == ""`; TS `ldate IS NULL`; TS-created members have a non-empty md5 `pass` so HX never sees them as new; nothing in HX writes `ldate`.
- Evidence: camap-hx/src/db/User.hx:495-505; camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:177-200; camap-ts/packages/api-core/src/auth/auth.service.ts:115
- Verdict: CONFIRMED
- Refs: 03#C17

### CODE-102 - TS balance computation differs from service and from HX
- Category: HX↔TS divergence
- Severity: Medium
- Description: The resolver `balance` sums all operations of the subscription (including the negative SubscriptionTotal), while `CsaSubscriptionsService.getBalance` = payments - total price with no rounding; the `balance` type field is commented out but exposed via `@ResolveField`; HX rounds every step. TS `getBalance`/`getPaymentsTotal` do not round; TS `getTotalPrice` rounds each line and the running total.
- Evidence: camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:~15-35 (:22-30); camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:109-135; camap-ts/packages/api-core/src/groups/types/csa-subscription.type.ts:17-20; camap-hx/src/db/Subscription.hx:23-67; camap-ts/packages/camap-common/src/utils/index.ts:39-48
- Verdict: CONFIRMED
- Refs: 06#C5, 07#6

### CODE-103 - Operation rounding and `pending` reuse differ
- Category: HX↔TS divergence
- Severity: Medium
- Description: HX `Operation.check()` rounds every amount, TS `OperationEntity` has no such hook; VOrder includes fees while the subscription total does not. HX reuses any existing onTheSpot payment regardless of `pending` and does not reuse transfers; TS reuses only pending ones and also reuses `transfer`.
- Evidence: camap-hx/src/db/Operation.hx:170; camap-hx/src/service/PaymentService.hx:34-41, :98-104; camap-ts/packages/api-core/src/payments/services/payments.service.ts:205-232; camap-ts/packages/api-core/src/payments/entities/operation.entity.ts
- Verdict: CONFIRMED
- Refs: 07#4, 07#6

### CODE-104 - TS theme ignores the white-label theme edited in HX
- Category: HX↔TS divergence
- Severity: Medium
- Description: Theme edited through HX `/admin/theme` is stored in `Variable.whiteLabel` and read by HX; TS `VariableService.getTheme()` never reads the DB and returns `DEFAULT_THEME(CAMAP_HOST)` cached forever; TS mails, invitations and `users.service.ts:515` ignore white-label customisation.
- Evidence: camap-hx/src/controller/admin/Admin.hx:52; camap-hx/src/App.hx:145-150; camap-ts/packages/api-core/src/tools/variable.service.ts:61-72; camap-ts/packages/api-core/src/mails/mails.service.ts:65,102,240; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:191,306; camap-ts/packages/api-core/src/users/users.service.ts:515
- Verdict: CONFIRMED
- Refs: 11#I-1

### CODE-105 - TS login requires a pre-existing HX session row
- Category: HX↔TS divergence
- Severity: Medium
- Description: Login throws `Session not found with sid` if HX has not created a session first, so Nest login cannot work standalone; the docs do not state this coupling.
- Evidence: camap-ts/packages/api-core/src/auth/auth.service.ts:70-74
- Verdict: CONFIRMED
- Refs: 10#16

### CODE-106 - `Group.disabled` varchar vs MySQL ENUM; never written by application code
- Category: HX↔TS divergence
- Severity: Low
- Description: HX `SNull<SString<32>>`; TS and migration use a real ENUM. The field is read in HX/TS/React but never written by application code (grep).
- Evidence: camap-hx/src/db/Group.hx:94; camap-ts/packages/api-core/src/groups/entities/group.entity.ts:202-203; camap-ts/packages/api-core/src/migrations/1741445966001-group-disabled.ts:7
- Verdict: CONFIRMED
- Refs: 02#4, 03#C27

### CODE-107 - `Product.stockTracking` / `stockTrackingPerDistrib` nullability
- Category: HX↔TS divergence
- Severity: Low
- Description: HX non-null `SEnum`; TS and migration nullable `tinyint unsigned`.
- Evidence: camap-hx/src/db/Product.hx:28-29; camap-ts/packages/api-core/src/vendors/entities/product.entity.ts:41-45; camap-ts/packages/api-core/src/migrations/1716452582359-stocksRework.ts:8-9
- Verdict: CONFIRMED
- Refs: 02#5

### CODE-108 - `ProductDistributionStock` column types
- Category: HX↔TS divergence
- Severity: Low
- Description: `stockPerDistribution` HX `Float` (double) vs TS/migration `float unsigned DEFAULT 0`; `frequencyRatio` HX `Int` vs `tinyint unsigned default 1`.
- Evidence: camap-hx/src/db/ProductDistributionStock.hx:13; camap-ts/packages/api-core/src/migrations/1716452582359-stocksRework.ts:7
- Verdict: CONFIRMED
- Refs: 02#6

### CODE-109 - `UserGroup.rights` typed non-nullable in TS
- Category: HX↔TS divergence
- Severity: Low
- Description: HX `SNull<SSmallText>`; TS column nullable but property typed as non-nullable array.
- Evidence: camap-hx/src/db/UserGroup.hx:24; camap-ts/packages/api-core/src/groups/entities/user-group.entity.ts:14-15
- Verdict: CONFIRMED
- Refs: 02#8

### CODE-110 - Property/relation renames between HX and TS with same columns
- Category: HX↔TS divergence
- Severity: Low
- Description: HX `Group.contact/mainPlace/legalRepresentative/image` vs TS `user/place/legalRepr/image`; `WaitingList.group` (column `amapId`) vs `amap`; `Subscription` vs `CsaSubscriptionEntity`; `Operation.relation`.
- Evidence: camap-hx/src/db/Group.hx:50,71,78; camap-ts/packages/api-core/src/groups/entities/group.entity.ts:126-164; camap-hx/src/db/WaitingList.hx:9; camap-ts/packages/api-core/src/groups/entities/waiting-list.entity.ts:29-34
- Verdict: PLAUSIBLE: rename list only partially checked
- Refs: 02#9

### CODE-111 - TS relations typed lazy (`Promise`) in some entities and eager in others
- Category: HX↔TS divergence
- Severity: Low
- Description: Mixed style inside TS.
- Evidence: camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:79; camap-ts/packages/api-core/src/shop/entities/basket.entity.ts:65
- Verdict: CONFIRMED
- Refs: 02#10

### CODE-112 - `RightSite.Admin` (HX) vs `SuperAdmin` (TS)
- Category: HX↔TS divergence
- Severity: Low
- Description: Both bit 0.
- Evidence: camap-hx/src/db/User.hx:16-18; camap-ts/packages/api-core/src/users/models/user.entity.ts:14-16
- Verdict: CONFIRMED
- Refs: 02#13

### CODE-113 - `OperationType` `VOrder` (HX) vs `Order` (TS)
- Category: HX↔TS divergence
- Severity: Low
- Description: Same index values 0 to 3 (VOrder/Order, SubscriptionTotal, Payment, Membership).
- Evidence: camap-hx/src/db/Operation.hx:5-10; camap-ts/packages/api-core/src/payments/OperationType.ts:2; camap-ts/packages/api-core/schema.gql:340
- Verdict: CONFIRMED
- Refs: 02#14, 07#17

### CODE-114 - `Distribution.quantities` default
- Category: HX↔TS divergence
- Severity: Low
- Description: Declared on both (HX initialiser `Int = 1`, TS column default 1); production data gets the default via migration.
- Evidence: camap-hx/src/db/Distribution.hx; camap-ts/packages/api-core/src/migrations/1720184612071-add-distrib-quantities.ts
- Verdict: CONFIRMED
- Refs: 02#17

### CODE-115 - `MultiDistrib.volunteerRolesIds` null/empty-string handling
- Category: HX↔TS divergence
- Severity: Low
- Description: HX nullable plain String; TS `simple-array` giving `number[]`; empty-string vs null handling not aligned.
- Evidence: camap-hx/src/db/MultiDistrib.hx:30; camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:29-30
- Verdict: PLAUSIBLE: runtime null vs empty-string handling not checked; types verified
- Refs: 02#19

### CODE-116 - GraphQL `Product` type mismatches
- Category: HX↔TS divergence
- Severity: Low
- Description: `wholesale: boolean` non-null has no entity column or resolver; `price` not declared in the ObjectType but resolved; `stockTrackingPerDistrib` non-null in GraphQL but nullable in entity; `unitType` returns 0 when null.
- Evidence: camap-ts/packages/api-core/src/vendors/types/product.type.ts:33,42-43; camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:100,173-177; camap-ts/packages/api-core/src/vendors/entities/product.entity.ts:45
- Verdict: CONFIRMED
- Refs: 04#C11

### CODE-117 - Cookie domain computation differs
- Category: HX↔TS divergence
- Severity: Low
- Description: HX strips a leading `app.` from `HOST`; TS strips only `https://` from `CAMAP_HOST`; an expiry cookie must match Domain to delete, so deletion may fail when `HOST` starts with `app.` (runtime unverified).
- Evidence: camap-hx/src/controller/User.hx:84-88, :99-102, :108-111; camap-ts/packages/api-core/src/auth/auth.service.ts:348-357
- Verdict: CONFIRMED
- Observed (characterisation suite, 2026-11-02): since only `https://` is stripped, an `http://` `CAMAP_HOST` gives `Domain=http://…`, an invalid cookie domain: browsers drop the cookie and login fails on any non-development http deployment (`auth.service.ts:348-357`; development returns no Domain at all, which is why the test stack works).
- Refs: 03#C16

### CODE-118 - TS login does not copy `User.lang` to `Session.lang` nor set `whichUser`
- Category: HX↔TS divergence
- Severity: Low
- Description: `// TODO ?session.sdata.whichUser`; sugoi `Session.setUser` does both; `whichUser` is read by HX and passed to messages React.
- Evidence: camap-ts/packages/api-core/src/auth/auth.service.ts:77; SUGOI db/Session.hx:41-48; camap-hx/src/View.hx:251-255; camap-hx/lang/master/tpl/user/choose.mtt:12; camap-hx/lang/master/tpl/messages/default.mtt:9
- Verdict: CONFIRMED
- Refs: 03#C15

### CODE-119 - TS registration vs HX `User.check()`
- Category: HX↔TS divergence
- Severity: Low
- Description: email2 not checked for collisions; no lower/upper-case normalisation. (The `invitedGroupId` part is listed under Security/rights.)
- Evidence: camap-ts/packages/api-core/src/auth/auth.service.ts:98-120; camap-hx/src/db/User.hx:524-545
- Verdict: CONFIRMED
- Refs: 03#C6

### CODE-120 - Client/server contract-minimum estimates differ
- Category: HX↔TS divergence
- Severity: Low
- Description: TS `floor(catalogMin / distributions.length * remainingDistributions)` vs HX `floor(subscriptionDistribs/allDistribs * catalogMin)` with a "date >= next open distribution" numerator when no subscription.
- Evidence: camap-ts/packages/front-core/src/modules/csaCatalog/CsaCatalog.context.tsx:286-290; camap-hx/src/service/SubscriptionService.hx:490-504
- Verdict: CONFIRMED
- Refs: 06#C20

### CODE-121 - Two "version" notions
- Category: HX↔TS divergence
- Severity: Low
- Description: HX `VERSION = [3,0,12]` hard-coded (git macros commented out); TS `/ping` and `/health` return `process.env.VERSION` or `0`.
- Evidence: camap-hx/src/App.hx:21; camap-ts/packages/api-core/src/tools/tools.controller.ts:11-21
- Verdict: CONFIRMED
- Refs: 11#I-17

### CODE-122 - Front theme/i18n/terms hard-coded vs HX dynamic
- Category: HX↔TS divergence
- Severity: Low
- Description: React i18n language hard-coded `fr` (Haxe injects `_Camap.lang`); `neo.tsx` hard-codes date-fns `frLocale`; React theme always `theme/default/theme` while the HX theme id is dynamic; `Theme.terms` fields differ (HX has `platformTermsOfServiceLink`, `privacyPolicyLink`; TS has `platformTermsLink`); French literals hard-coded in HX-JS and controllers.
- Evidence: camap-ts/packages/front-core/src/lib/i18n.ts:16-17; camap-ts/packages/front-core/src/neo.tsx:7,12,29; camap-hx/lang/master/tpl/base.mtt:31,106; camap-hx/common/Common.hx:332-335; camap-ts/packages/camap-common/src/theme.ts:16-18; camap-hx/js/App.hx:329; camap-hx/src/controller/Main.hx:31,68; camap-hx/src/controller/Vendor.hx:68,70
- Verdict: CONFIRMED
- Refs: 09#C8, 09#C9, 09#C10, 09#C15

### CODE-123 - Sender address and Reply-To differ between HX and TS mailers
- Category: HX↔TS divergence
- Severity: Low
- Description: TS sender `from.address` is always the theme `senderEmail`, ignoring the stored sender; HX writes `group.contact.email` as sender; reply-to only via headers. TS saves buffer rows without `tries`/`mailerType` (relying on DB defaults); HX never calls `defineFinalMailer` so `mailerType` is null on HX inserts; `sdate` is never set by either side so `delete sdate < 10 days` and `isSent()` are effectively dead.
- Evidence: camap-ts/packages/api-core/src/mails/mails.service.ts:135-163, :173, :189, :257-261, :340-341; camap-hx/src/App.hx:362; camap-hx/src/db/BufferedJsonMail.hx:64-70, :77-123; camap-hx/src/mail/BufferedJsonMailer.hx:20
- Verdict: CONFIRMED (sender, sdate); PLAUSIBLE for `tries`/`mailerType` DB-default behaviour (not verified)
- Refs: 08#9, 08#10, 08#11

---

## Dead code/unused

### CODE-124 - `OrdersResolver.checkRights` is declared and never called
- Category: Dead code/unused
- Severity: Medium (Rights helper that protects nothing.)
- Description: Inside the dead helper the `canManageAllCatalogs(...)` call is also un-awaited (async, user-groups.service.ts:112), so that branch could never forbid.
- Evidence: camap-ts/packages/api-core/src/shop/resolvers/orders.resolver.ts:54-85 (~:80); camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:112
- Verdict: CONFIRMED
- Refs: 06#C4

### CODE-125 - `BlackListGuard` is never applied
- Category: Dead code/unused
- Severity: Medium (Security control present but inactive.)
- Description: IP blacklist from `Variable.IPBlacklist` (also rejects User-Agent containing `python`); grep finds only its own declaration: no `@UseGuards`, no `APP_GUARD`; the `IPBlacklist` key is read nowhere else.
- Evidence: camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50 (:26-39, :45-47)
- Verdict: CONFIRMED
- Refs: 11#I-11

### CODE-126 - Other: `createCycle` stub routes, `ContractAdmin` delete comment, comment swaps, `getOrderableCatalogsFromMultiDistrib`
- Category: Dead code/unused
- Severity: Low
- Description: `doEditCycle`/`doInsertCycle` remain as routes with commented-out bodies (`doInsert` fully commented); ContractAdmin delete comment says it removes "products, orders & distributions" but the code does not explicitly; `Cron.hx` comments swapped ("vendor logo" checks `Group.image`); `getOrderableCatalogsFromMultiDistrib` only excludes disabled vendors (not date/flag) and has an unused `distributionsIds`.
- Evidence: camap-hx/src/controller/Distribution.hx:398-413, :418-473, :684-774; camap-hx/src/controller/ContractAdmin.hx:1166-1167, :1174-1203; camap-hx/src/controller/Cron.hx:308-314; camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:72-89 (:82)
- Verdict: CONFIRMED
- Refs: 05#7, 04#C16, 04#C19, 08#2, 04#C12

### CODE-127 - TS `createOrUpdateTotalOperation` is buggy and has no caller
- Category: Dead code/unused
- Severity: Low
- Description: When no total operation exists it dereferences the null result (`totalOperation.subscription = ...` inside `if (!totalOperation)`), later reads `totalOperation.userId/groupId` on the create branch and returns undefined. No caller in api-core, so the SubscriptionTotal debt is written only by HX.
- Evidence: camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:159-161, :180-183
- Verdict: CONFIRMED
- Refs: 06#C1, 07#1

### CODE-128 - Duplicated/unreferenced TS balance functions
- Category: Dead code/unused
- Severity: Low
- Description: `updateUserBalance` and `getUserBalance` have identical queries; `getUserBalance` has no caller in api-core or other packages.
- Evidence: camap-ts/packages/api-core/src/payments/services/payments.service.ts:~280-316 (:281, :301)
- Verdict: CONFIRMED
- Refs: 07#3, 07#19 (second sentence)

### CODE-129 - HX payment `link` fields point to `/transaction/<type>` routes with no handler
- Category: Dead code/unused
- Severity: Low
- Description: `payment/*.hx` set links like /transaction/cash, /check, /moneypot, /onthespot, /transfer, /cardTerminal; `Transaction.hx` defines only insertPayment, edit, delete.
- Evidence: camap-hx/src/payment/Cash.hx:19; camap-hx/src/controller/Transaction.hx:21, :84, :125
- Verdict: CONFIRMED
- Refs: 07#13

### CODE-130 - CSV report type is hidden
- Category: Dead code/unused
- Severity: Low
- Description: The `listByDate` form offers only one, contract, all and allshort; the CSV type exists only if typed in the URL.
- Evidence: camap-hx/src/controller/Distribution.hx:154-159, :206
- Verdict: CONFIRMED
- Refs: 07#16

### CODE-131 - Dead or unused HX/TS auth artefacts
- Category: Dead code/unused
- Severity: Low
- Description: `Member.doEdit` (empty), `User.doDefault` and `api User.doDefault` empty; `BridgeService.getAuthToken` + bridge `GET /bridge/auth/tokens/:id` + HX `/api/user/getToken` (signs with HX `key`, a different secret from the TS access secret) have no caller; TS `CookieStrategy` and `defaultStrategy: ['jwt','cookie']` registered but all guards use explicit `jwt`/`void`/`bridge`; `UsersService.findOneBySid` returns a lazy `Promise`; `UserService.get` in HX is a thin finder with large commented code.
- Evidence: camap-hx/src/controller/Member.hx:108-111; camap-hx/src/controller/User.hx:21-22; camap-hx/src/controller/api/User.hx:14-16, :56-64; camap-hx/src/service/BridgeService.hx:88-93; camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts:21-32; camap-ts/packages/api-core/src/auth/auth.module.ts:23-25,44; camap-ts/packages/api-core/src/users/users.service.ts:111-114
- Verdict: CONFIRMED
- Refs: 03#C23, 10#7

### CODE-132 - Unused imports in HX controllers
- Category: Dead code/unused
- Severity: Low
- Description: `Group.hx` imports `service.BridgeService` and `Member.hx` imports `haxe.Http` with no use found.
- Evidence: camap-hx/src/controller/Group.hx:6; camap-hx/src/controller/Member.hx:6
- Verdict: CONFIRMED
- Refs: 10#13

### CODE-133 - Cron scaffolding: empty CLI, events without listeners
- Category: Dead code/unused
- Severity: Low
- Description: `cli/index.ts` is an empty commander skeleton; MinutelyCron/HourlyCron/DailyCron events have no listeners in camap-hx/src (plugins and sugoi libs not checked).
- Evidence: camap-ts/packages/api-core/src/cli/index.ts; camap-hx/src/controller/Cron.hx:65, :325, :344; camap-hx/common/Common.hx:296-298
- Verdict: CONFIRMED in camap-hx/src and common; PLAUSIBLE for plugins/sugoi libs (not checked)
- Refs: 08#19, 08#20

### CODE-134 - Dead `_Camap` functions, unused layouts, stale generated template
- Category: Dead code/unused
- Severity: Low
- Description: Eight `_Camap` functions (`roundTo`, `modal`, `goto`, `toggle`, `show`, `hide`, `setWarningOnUnload`, `resetGroupInSession`) have no caller in camap-hx/src, common, lang/master (vendored libs not checked); `AdminLayout`, `PublicLayout`, `GroupLayout` have no importers outside the layout folder; `lang/fr/tpl/mail/digest_html.mtt` (0 bytes) exists only in the gitignored generated fr folder.
- Evidence: camap-hx/js/App.hx:223,249,319,358,400,406,412,448; camap-ts/packages/front-core/src/layout/AdminLayout.tsx; camap-ts/packages/front-core/src/layout/GroupLayout.tsx; camap-ts/packages/front-core/src/layout/PublicLayout.tsx; camap-hx/lang/fr/tpl/mail/digest_html.mtt; camap-hx/.gitignore:18
- Verdict: CONFIRMED
- Refs: 09#C13, 09#C14, 09#C4

### CODE-135 - Unused front envSchema, unused config variables, unused import
- Category: Dead code/unused
- Severity: Low
- Description: `front-core/src/envSchema.ts` (requires FRONT_URL, FRONT_GRAPHQL_URL, CAMAP_HOST, MAPBOX_KEY, CACHE_KEY) is imported nowhere (webpack defines `__CACHE_KEY__`); `DB_SYNCHRONIZE` is in sample/docs but not read (`ormconfig.js:34` comment uses `env.SYNCHRONIZE`); `SMTP_REQUIRE_TLS` is set in `.env.sample`/dev compose but never read (`requireTLS = !secure && !ignoreTLS`); `main.ts` imports `resolve` unused and hard-codes `/srv`.
- Evidence: camap-ts/packages/front-core/src/envSchema.ts; camap-ts/packages/front-core/webpack.config.js:79; camap-ts/ormconfig.js:33-34; camap-ts/packages/api-core/src/envSchema.ts:19; camap-ts/packages/api-core/src/mails/mails.module.ts:39; docker-compose.dev.yml:91; camap-ts/packages/api-core/src/main.ts:10, :57-58, :83
- Verdict: CONFIRMED
- Refs: 01#15, 01#16, 01#18, 01#20

### CODE-136 - `camap-common` helpers with no callers; unread header
- Category: Dead code/unused
- Severity: Low
- Description: `containsEmail` and `CONTAINS_EMAIL_REGEX` have no caller; `isEmail` is used only by `MessageRecipientsSelect.tsx`; `URL_CUSTOM_HEADER = 'X-CAVEA-URL'` is added by the Apollo client and allowed in CORS but no server code reads it (old "CAVEA" name).
- Evidence: camap-ts/packages/camap-common/src/email.ts:1-13; camap-ts/packages/camap-common/src/header.ts:1; camap-ts/packages/front-core/src/modules/messages/components/MessageRecipientsSelect.tsx:527,547; camap-ts/packages/front-core/src/lib/initApollo.tsx:33-40; camap-ts/packages/api-core/src/main.ts:37-45
- Verdict: CONFIRMED
- Refs: 11#D-6 (code side)

### CODE-137 - Scripts and wrappers not wired
- Category: Dead code/unused
- Severity: Low
- Description: `camap-ts/scripts/start.sh` and `tune-env-file.pl` are not referenced by Dockerfiles/compose (appear to serve a Scalingo/buildpack deployment; `tune-env-file.pl` maps `PW_HASH_KEY` to `CAMAP_KEY`, a name used nowhere else); `scripts/iso-3166-1.sh` is not wired into any npm script; `scripts/setup.sh` copies `.env.sample` if `.env` is missing but `camap-ts/.env` is a symlink (behaviour not run).
- Evidence: camap-ts/scripts/start.sh:25-26; camap-ts/scripts/tune-env-file.pl:20-22; camap-ts/camap-ts.Dockerfile:36,65; camap-ts/scripts/iso-3166-1.sh:9; camap-ts/scripts/setup.sh:3-11; camap-ts/README.md:22
- Verdict: CONFIRMED for start.sh / tune-env-file.pl / iso-3166-1.sh; PLAUSIBLE for setup.sh (shell behaviour on symlink not run)
- Refs: 01#22, 01#23, 01#24

### CODE-169 - HX `OrderService.sendOrderSummaryToMembers` has no caller
- Category: Dead code/unused
- Severity: Low
- Description: The order summary email to members is implemented but nothing calls it, so hx never sends it.
- Evidence: camap-hx/src/service/OrderService.hx:528
- Verdict: CONFIRMED (no caller in camap-hx or camap-ts; observed: no such email)
- Refs: characterisation suite `tests/specs/05-orders/subscription-rules.api.spec.ts` (ORD-HIS-008)

### CODE-170 - Email templates that no flow sends
- Category: Dead code/unused
- Severity: Low
- Description: Eight twig templates are shipped and listed by the superadmin template list but no code sends them: `anticheat`, `existingVendorInvitation`, `newVendorInvitation`, `time-slots-resolution`, `validateDistributedDistribution`, `validateDistributedDistribution-reminder`, `vendorCertificationInProgress`, `vendorCertificationRefused`.
- Evidence: camap-ts/packages/api-core/mails/src/ (and dist/); camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:70-86
- Verdict: CONFIRMED (observed in the template list)
- Refs: characterisation suite `tests/specs/08-administration/maintenance-tools.api.spec.ts`; UND-106

### CODE-171 - HX reads the `smtp_*` platform variables only in commented-out code
- Category: Dead code/unused
- Severity: Low
- Description: `BufferedJsonMail.finallySend`, the only reader of `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, is commented out: those stored variables have no effect; Nest sends the mail with its own `SMTP_*` settings.
- Evidence: camap-hx/src/db/BufferedJsonMail.hx:75-90
- Verdict: CONFIRMED
- Refs: characterisation suite `tests/specs/08-administration/platform-settings.views.spec.ts` (ADM-MNT-009)


---

### CODE-185 - GraphQL multipart upload middleware mounted, no resolver takes an upload
- Category: Dead code/unused
- Severity: Low
- Description: `main.ts` mounts `graphqlUploadExpress` (1 GB, 10 files) on every request, but no resolver declares an `Upload` argument and the generated schema has no `Upload` scalar; files go through the REST file controller and Haxe. The middleware only widens the accepted request formats (multipart GraphQL requests are a known CSRF vector), and `graphql-upload` 14+ is ESM-only, which blocks the dependency upgrade.
- Evidence: camap-ts/packages/api-core/src/main.ts:8,27; camap-ts/packages/api-core/src/schema.gql (no `Upload`); camap-ts/packages/api-core/src/app.module.ts (`uploads: false`)
- Verdict: CONFIRMED (by reading)
- Refs: E1 inventory ([09-camap-ts-upgrade.md](09-camap-ts-upgrade.md) §4)

## Config/build

### CODE-138 - Production compose build paths broken
- Category: Config/build
- Severity: High (Production build cannot succeed as written (build-time failure, not data loss; rated High as deployment blocker).)
- Description: `docker-compose.prod.yml` uses `context: .` with `dockerfile: camap-hx.Dockerfile` / `camap-ts.Dockerfile` but neither file exists at the repo root (dev uses `./camap-hx`, `./camap-ts`).
- Evidence: docker-compose.prod.yml:79-80, :108-109; docker-compose.dev.yml:78-80, :119-121
- Verdict: CONFIRMED
- Refs: 01#1

### CODE-139 - Prod/easy compose: configuration cannot reach the Neko app
- Category: Config/build
- Severity: High (HX cannot start without `config.xml`.)
- Description: Prod uses `env_file: camap-ts/.env` while dev/easy use the root `.env`; prod has no `.env` mount; easy and prod neko containers have no `config.xml` and no `camapts.env` mount, and the HX image does not contain `config.xml` (Sugoi reads it unconditionally).
- Evidence: docker-compose.prod.yml:81; docker-compose.dev.yml:81-83, :109, :140-141; docker-compose.easy.yml:66; camap-hx/camap-hx.Dockerfile:138-141; SUGOI Config.hx:22
- Verdict: CONFIRMED
- Refs: 01#2

### CODE-140 - HX Apache proxy target host `nest-devcamap` exists only in dev compose
- Category: Config/build
- Severity: Medium
- Description: `camap-static.conf` proxies `/neostatic`, `/graphql`, `/locales` to `nest-devcamap` (alias defined only in dev compose); prod/easy nest containers have no alias; `config.xml` uses `nest-loc-camap` for the bridge and `config.xml.dist` uses `nest-camap`. Runtime DNS resolution not tested.
- Evidence: camap-hx/apache/camap-static.conf:13-27; docker-compose.dev.yml:72,113-115; docker-compose.prod.yml:74-104; docker-compose.easy.yml:63-82; config.xml:20; camap-hx/config.xml.dist:19-20
- Verdict: PLAUSIBLE: runtime DNS resolution not testable; alias only in dev compose verified
- Refs: 01#4, 09#C7, 10#8

### CODE-141 - Traefik static config conflict
- Category: Config/build
- Severity: Medium
- Description: CLI flags say `exposedbydefault=false`, `traefik.yml:30` says `exposedByDefault: true`; `traefik.yml` defines a `web->websecure` redirect that CLI flags do not; the file is mounted at `/traefik.yml`, not the default `/etc/traefik/traefik.yml`; nest/neko have no `traefik.enable=true` so they rely on `exposedByDefault: true`.
- Evidence: docker-compose.dev.yml:12-20, :36, :70, :98-105, :128-135, :153; traefik.yml:7-12, :30
- Verdict: PLAUSIBLE: which static source wins depends on Traefik runtime; file contents verified
- Refs: 01#5

### CODE-142 - Nest start command and migrations differ by compose; easy runs watch mode
- Category: Config/build
- Severity: Medium
- Description: The image `CMD` runs `node dist/main.js` without migrations; only `start:prod` runs `typeorm migration:run` (used only by prod compose); dev and easy use `start:dev` (`nest start --watch`); easy runs watch mode on a production image with pruned dev deps (`@nestjs/cli` is in `dependencies`).
- Evidence: camap-ts/camap-ts.Dockerfile:29, :65; camap-ts/packages/api-core/package.json:25, :79; docker-compose.prod.yml:86; docker-compose.dev.yml:97; docker-compose.easy.yml:71
- Verdict: CONFIRMED
- Refs: 01#7

### CODE-143 - Dev compose `NODE_ENV=development` disables HttpOnly and cookie domain logic
- Category: Config/build
- Severity: Medium
- Description: Dockerfile sets production; with `development` the auth cookies lose `HttpOnly` and the cookie domain logic is skipped.
- Evidence: docker-compose.dev.yml:84; camap-ts/camap-ts.Dockerfile:55; camap-ts/packages/api-core/src/auth/auth.service.ts:194-274, :349
- Verdict: CONFIRMED
- Refs: 01#9

### CODE-144 - HX template compile directories inconsistent
- Category: Config/build
- Severity: Medium
- Description: Dockerfile compiles `lang/fr/tpl` (gitignored; exists only after the backend build with `-D i18n_generation`) while `backend/package.json:11 build:tmpl` compiles `lang/master/tpl`; the Dockerfile comment says `lang/master/tmp` but the command writes `lang/fr/tmp`; at runtime `debug=1` reads `lang/master`, `debug=0` reads `lang/fr` (Sugoi BaseApp); dev compose mounts local `./camap-hx/lang` over `/srv/lang`, hiding the precompiled `lang/fr/tmp`.
- Evidence: camap-hx/camap-hx.Dockerfile:80, :87, :88-90; camap-hx/backend/package.json:11; camap-hx/.gitignore:18; docker-compose.dev.yml:138; SUGOI BaseApp.hx:80-85
- Verdict: CONFIRMED for the Dockerfile comment vs command; PLAUSIBLE for runtime template resolution (Sugoi BaseApp and image output not re-checked)
- Refs: 01#25, 09#C5

### CODE-145 - Secrets/tokens committed in the repo
- Category: Config/build
- Severity: Medium
- Description: `config.xml` key and a Mapbox token; `.env.test` SMTP credentials and Mapbox key; `camap-ts/packages/front-core/localhost-key.pem` present (contents not inspected). Observation only.
- Evidence: config.xml:15,17-18,22; camap-ts/.env.test; camap-ts/packages/front-core/localhost-key.pem
- Verdict: PLAUSIBLE: key and Mapbox token seen at config.xml:15,17-18; `.env.test` and the pem not inspected
- Refs: 01#30

### CODE-146 - Neo manifest cached for the process lifetime in `BridgeService`
- Category: Config/build
- Severity: Medium
- Description: The manifest is fetched through curl at render time once per process, with no invalidation (`static _neoManifest`): after a front redeploy with new hashes a long-lived Neko process keeps old bundle URLs (Neko process lifetime under mod_neko not verified).
- Evidence: camap-hx/src/service/BridgeService.hx:10-20
- Verdict: CONFIRMED in code; PLAUSIBLE for the runtime effect
- Refs: 09#C12

### CODE-147 - `serviceheaders` middleware and `service` router dangling; typo `adress`
- Category: Config/build
- Severity: Low
- Description: `serviceheaders` and `traefik.http.routers.service.middlewares` are labels on the reverse-proxy container which has no `traefik.enable=true`; router `service` has no rule/service; hard-coded origins `https://camap.localdomain`. `--entrypoints.nest.adress=:3010` typo in easy/prod (dev has `address`); the nest entrypoint is defined but no router uses it.
- Evidence: docker-compose.dev.yml:20, :29-38; docker-compose.easy.yml:13; docker-compose.prod.yml:13
- Verdict: CONFIRMED
- Refs: 01#6, 01#3

### CODE-148 - Easy compose uses image tag `:master`
- Category: Config/build
- Severity: Low
- Description: TS workflows found tag `vX.Y.Z`, `major.minor`, `major`, `latest`, `staging`; no `master` tag in these two workflows (other workflows not checked).
- Evidence: docker-compose.easy.yml:42,65,84; camap-ts/.github/workflows/docker-publish.yml:101-105; camap-ts/.github/workflows/publish-staging.yml:87-90
- Verdict: PLAUSIBLE: CI workflows not fully opened
- Refs: 01#8

### CODE-149 - MySQL port 3306 published in dev and easy compose
- Category: Config/build
- Severity: Low
- Description: Contradicts the `my.cnf` comment about not exposing the database in production (the comment is about `bind-address`).
- Evidence: docker-compose.dev.yml:62-63; docker-compose.easy.yml:50-52; camap-ts/mysql/my.cnf:12-14
- Verdict: CONFIRMED
- Refs: 01#10

### CODE-150 - One `.env` file mounted for both runtimes with different parsing
- Category: Config/build
- Severity: Low
- Description: Root `.env` is mounted as nest `/srv/.env` and HX `/srv/camapts.env`; `entrypoint.sh` normalises `KEY = value`; Node dotenv handles spaces itself. `ormconfig.js:20` lets the file override process env whereas Nest `ConfigModule` prefers process env, so the same variable set in both places can resolve differently.
- Evidence: docker-compose.dev.yml:109, :141; camap-hx/entrypoint.sh:9-26; camap-ts/ormconfig.js:20
- Verdict: CONFIRMED for the shared mount; PLAUSIBLE for the precedence difference (ConfigModule not opened)
- Refs: 01#11, 01#19

### CODE-151 - `HX_TRIGGER_CRONS=false` still triggers; unset `CAMAP_LOCAL_HOST`
- Category: Config/build
- Severity: Low
- Description: `!process.env.HX_TRIGGER_CRONS` tests the string (`false`/`0` are truthy); `getCamapHaxeUrl()` returns `undefined` when `CAMAP_LOCAL_HOST` is unset (URL `undefined/cron/minute`); `CAMAP_LOCAL_HOST` is not in `envSchema.ts`. Daily job is `EVERY_DAY_AT_MIDNIGHT` while the comment says `15 0 * * *`.
- Evidence: camap-ts/packages/api-core/src/tools/crontab.service.ts:11, :17, :31, :43, :45, :60; camap-ts/packages/api-core/src/envSchema.ts:10-12; .env.sample
- Verdict: CONFIRMED
- Refs: 01#12, 01#13, 10#6

### CODE-152 - SMTP schema vs defaults
- Category: Config/build
- Severity: Low
- Description: `envSchema.ts` makes `SMTP_AUTH_USER/PASS` required and requires host and port, yet `mails.module.ts` defaults host/port when unset (unreachable in practice).
- Evidence: camap-ts/packages/api-core/src/envSchema.ts:27-34, :39-46; camap-ts/packages/api-core/src/mails/mails.module.ts:36-37
- Verdict: CONFIRMED
- Refs: 01#17

### CODE-153 - Broken npm scripts (container names)
- Category: Config/build
- Severity: Low
- Description: Root scripts restart `neko-camap` / `nest-camap` and api-core logs `nest-camap`; compose services are `neko-loc-camap` / `nest-loc-camap`.
- Evidence: camap-ts/package.json:20-21; camap-ts/packages/api-core/package.json:37
- Verdict: CONFIRMED
- Refs: 01#21

### CODE-154 - Dev compose mounts shadow image-built artefacts
- Category: Config/build
- Severity: Low
- Description: Local `./camap-hx/www:/srv/www` shadows `www/index.n`, `www/js/app.js`, `texts_fr.mo` (must be built on the host; `.gitignore` excludes `*.n`, `www/lang/*.mo`); the entrypoint writes `env.js` into this mounted dir (git-ignored).
- Evidence: docker-compose.dev.yml:138-139; camap-hx/entrypoint.sh:4; camap-hx/.gitignore:55
- Verdict: CONFIRMED
- Refs: 01#26

### CODE-155 - Haxe-JS frontend always built in debug mode
- Category: Config/build
- Severity: Low
- Description: `frontend/build.hxml` compiles `-debug -D debug -dce no` and the output goes to `www/js/app.js` even in the production image; `libs:prod` refers to `libs/rollup.config.js` (not examined).
- Evidence: camap-hx/frontend/build.hxml:21-25; camap-hx/camap-hx.Dockerfile:83-91; camap-hx/frontend/package.json:34
- Verdict: CONFIRMED
- Refs: 01#27, 09#C3

### CODE-156 - Two React/router generations on the same pages
- Category: Config/build
- Severity: Low
- Description: HX frontend React 16 + react-router 5 vs front-core React 18 + router 6 (neo modules loaded from HX templates).
- Evidence: camap-hx/frontend/package.json:13,16; camap-ts/packages/front-core/package.json:70,78
- Verdict: CONFIRMED
- Refs: 01#28

### CODE-157 - Wrong file-path comment in `set-public-path.ts`
- Category: Config/build
- Severity: Low
- Description: Header says `packages/api-core/src/set-public-path.ts`.
- Evidence: camap-ts/packages/front-core/src/set-public-path.ts:1
- Verdict: CONFIRMED
- Refs: 01#29

### CODE-158 - Front webpack build mutates the source tree and depends on `THEME_ID`
- Category: Config/build
- Severity: Low
- Description: Copies `src/theme/<THEME_ID>/palette.ts` over `src/palette.ts` and restores it at the end; if `THEME_ID` is unset the source path is `src/theme/undefined/palette.ts`; mitigated since `.env.sample` sets `THEME_ID=default`.
- Evidence: camap-ts/packages/front-core/webpack.config.js:80-100 (:86); camap-ts/.env.sample:55
- Verdict: CONFIRMED
- Refs: 09#C11

### CODE-172 - GraphQL Playground served whenever `NODE_ENV` is not `production`
- Category: Config/build
- Severity: Low
- Description: `GET /graphql` with `Accept: text/html` serves the GraphQL Playground unless `NODE_ENV=production`. The test and dev stacks run `development`, and so does the production chart template (`camapConfig.nodeEnv`), so a deployment that keeps that value exposes it publicly.
- Evidence: camap-ts/packages/api-core/src/app.module.ts:47; minikube-camap/deployments/camap/values.yaml (`nodeEnv: development`)
- Verdict: CONFIRMED on the test stack; production value not known
- Refs: characterisation suite `tests/specs/09-navigation/platform-pages.views.spec.ts`; docs/07-production-deployment.md

### CODE-173 - Superadmin email template list: layouts listed, links built on `FRONT_URL`
- Category: Config/build
- Severity: Low
- Description: `/mails/list` lists every `.twig` file, the shared layouts `_base`, `_layout-camap`, `_layout-group` included, and builds each preview link on `FRONT_URL`. The routes are served on the API origin, and the production chart sets `FRONT_URL` to the in-cluster API URL (`http://camap-api:3010`), so the links do not open from a browser. Anonymous calls get 403 (not 401).
- Evidence: camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:70-86 (:81); minikube-camap/deployments/camap/templates/deployment-api.yaml (`FRONT_URL` = `camapApiUrl`)
- Verdict: CONFIRMED on the test stack
- Refs: characterisation suite `tests/specs/08-administration/maintenance-tools.api.spec.ts`; docs/07-production-deployment.md

### CODE-182 - Last-resort error handler re-initialises the database schema
- Category: Config/build
- Severity: Low
- Description: If rendering the error page fails and `Error` can't be read, `errorHandler` calls `sys.db.admin.Admin.initializeDatabase()`, which creates the missing tables from the Haxe classes. A transient DB fault during an error could therefore run schema changes against production.
- Evidence: SUGOI src/sugoi/BaseApp.hx:358-370
- Verdict: CONFIRMED (by reading; not provoked)
- Refs: Sugoi read (docs/08-sugoi.md)


---

## Tests

### CODE-159 - HX test suite out of sync with code
- Category: Tests
- Severity: Medium
- Description: `TestSuite` setup lists removed tables (Category/CategoryGroup/ProductCategory classes do not exist) and omits ProductDistributionStock, NotificationMail, Membership, WaitingList, Message, BufferedJsonMail; `TestSubscriptions` calls `SubscriptionService.createSubscription/updateSubscription` statically (instance methods) and uses `subscription.isValidated` (does not exist); `TestOrders.testOrderEdit` expects stock decrement and `StockMove` events whereas current code computes stock from existing orders. Whether the suite compiles/runs is unverified. `TestSuite` also always drops/recreates database `tests`, ignoring the dbname CLI arg used by `connectDb`.
- Evidence: camap-hx/src/test/TestSuite.hx:32-49, :55-91; camap-hx/src/test/TestSubscriptions.hx:88, :149, :304, :318; camap-hx/src/test/TestOrders.hx:127-170; camap-hx/src/service/SubscriptionService.hx:644, :778; camap-hx/src/db/Product.hx:147-179; camap-hx/src/service/OrderService.hx:309-316
- Verdict: CONFIRMED
- Refs: 02#20, 06#C16, 10#4

### CODE-160 - front-core Jest config references a missing setup file
- Category: Tests
- Severity: Medium
- Description: `jest.config.js` sets `setupFilesAfterEnv: ['./test/setupTests.js']` but `front-core/test/` has no `setupTests.js`; Jest would fail at startup.
- Evidence: camap-ts/packages/front-core/jest.config.js:124; camap-ts/packages/front-core/test/
- Verdict: CONFIRMED
- Refs: 10#1

### CODE-161 - Dataset generator `reset()` truncates `db.<table>`; test DB is `test`
- Category: Tests
- Severity: Low
- Description: Hard-coded schema `db.` in `TRUNCATE TABLE db.${meta.tableName}`; test DB name `test`. Whether `reset()` runs against the test DB not checked.
- Evidence: camap-ts/packages/api-core/src/dev/dataset-generator.ts:784; camap-ts/.env.test:20
- Verdict: CONFIRMED
- Refs: 10#2

### CODE-162 - e2e utils: unused `resetDb` parameter; `cleanDB` used by one spec
- Category: Tests
- Severity: Low
- Description: `initTestApp(resetDb)` never uses the parameter; `groups.e2e-spec.ts` passes `false` with no effect; `cleanDB` is called only by `multi-distrib.service.e2e-spec.ts`.
- Evidence: camap-ts/packages/api-core/test/utils.ts:57, :75; camap-ts/packages/api-core/test/groups.e2e-spec.ts:66; camap-ts/packages/api-core/test/multi-distrib.service.e2e-spec.ts:33
- Verdict: CONFIRMED
- Refs: 10#3

### CODE-163 - `test:cov` omits `TZ=UTC`
- Category: Tests
- Severity: Low
- Description: `timezones.spec.ts` asserts UTC; `test` sets `TZ=UTC` (:27) but `test:cov` (:29) does not.
- Evidence: camap-ts/packages/api-core/package.json:27, :29; camap-ts/packages/api-core/src/timezones.spec.ts
- Verdict: CONFIRMED
- Refs: 10#17

---

## Appendix: Refuted during verification

| Draft ref | Claim | Why refuted |
|---|---|---|
| 04#C4 (sub-claim) | TS `updateVendor` guard accepts owner OR catalog manager even when the vendor is claimed, unlike `setVendorImage`/`createVendorImage` | `userIsAllowedToManageCatalogOfVendor` returns strictly owner-only when `vendor.userId !== null` (`camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:552-553`), same as HX `camap-hx/src/db/User.hx:176-179`; all three call sites go through the same helper. The verified remainder (`canManageCatalog` lets a claimed vendor owner manage any catalog of its vendor; `rights === 1` vs `isAdmin()` equivalence unverified) is kept in the "TS `canManageAllCatalogs` broader than HX" entry. |
| 07#19 (first sentence) | `OperationsService.findBySubscriptionId` is used only by `getPaymentsTotal` | It has a second caller at `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:25`. The second sentence (`PaymentsService.getUserBalance` has no caller) stays CONFIRMED (entry "Duplicated/unreferenced TS balance functions"). |
