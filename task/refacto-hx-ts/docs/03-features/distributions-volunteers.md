# Distributions, cycles, volunteers, absences, waiting list, attendance sheets

## 1. Scope

MultiDistrib and Distribution lifecycle, distribution cycles, order-window state, volunteer roles and assignments (including the volunteer calendar and its reminder mails), absences on CSA subscriptions, the group waiting list, and attendance/print sheets. Orders and subscriptions themselves are in `orders-subscriptions.md`; the cron scheduler in `crons-scheduled-jobs.md`.

Ownership summary: all writes (create/edit/delete MD, cycles, participation, shifts, volunteers, roles, absences, waiting-list registration) are Haxe. TS (NestJS GraphQL) is read-only for distributions/volunteers/cycles; TS writes only for the waiting list (approve / refuse / move back).

## 2. Concepts & glossary terms

- **MultiDistrib (MD)**: one distribution session: group, place, `distribStartDate/EndDate`, `orderStartDate/EndDate`, optional cycle, and `volunteerRolesIds` (comma-separated role ids in a text column) (`camap-hx/src/db/MultiDistrib.hx:17-30`). In TS `volunteerRolesIds` is a `simple-array` of numbers (`camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:25-26`).
- **Distribution**: participation of one catalog in an MD. Holds its own `orderStartDate/orderEndDate` (per-catalog exception) and `quantities` (default 1; incremented when two distributions are merged by a shift) (`camap-hx/src/db/Distribution.hx:15-29`, `camap-hx/src/service/DistributionService.hx:446`). `date`, `end`, `place` are "deprecated" duplicates of the MD (`camap-hx/src/db/Distribution.hx:18-21`); `populate()` is a "retrocompat trick" copying MD values (`:189-199`). `getKey/makeKey` still use `date` and `place` (`:206-212`) while `populate()` sets `place=null` (`:197`).
- **DistributionCycle**: recurrence template Weekly | Monthly | BiWeekly | TriWeekly generating MDs (`camap-hx/src/db/DistributionCycle.hx:7-30`); enum order identical in TS (`camap-ts/packages/api-core/src/shop/entities/distribution-cycle.entity.ts:16-21`), which matters because HX `SEnum` stores the index.
- **VolunteerRole**: generic when `catalog==null`, else tied to a catalog; `enabledByDefault` flag. **Volunteer**: PK user+multiDistrib+role (`camap-hx/src/db/VolunteerRole.hx:5-15`, `camap-hx/src/db/Volunteer.hx:6-11`; TS `camap-ts/packages/api-core/src/groups/entities/volunteer-role.entity.ts:16-50`, `camap-ts/packages/api-core/src/groups/entities/volunteer.entity.ts:8-40`).
- **WaitingList**: PK user+group, `date`, `message` (`camap-hx/src/db/WaitingList.hx:6-18`; TS `camap-ts/packages/api-core/src/entities/waiting-list.entity.ts:6-39`).
- **Absences**: comma-separated distribution ids in `Subscription.absentDistribIds`; limits on `Catalog.absentDistribsMaxNb/absencesStartDate/absencesEndDate` (`camap-hx/src/db/Subscription.hx:17,136-146`, `camap-hx/src/service/AbsencesService.hx:62-67`).
- **Order window state** (`MultiDistrib.getState`): null / notYetOpen / open / closed / distributed (rule 15).
- **Duty period**: a volunteer role slot on an MD.
- **Time zone**: DB stores Paris wall-clock datetimes; TS entities expose `raw_*` columns and convert (rule 2).

## 3. Routes & endpoints

### 3.1 HX `/distribution/*` (`camap-hx/src/controller/Distribution.hx`)

"Section access" = `checkHasDistributionSectionAccess` = `app.user.canManageAllContracts()` else Error (`camap-hx/src/controller/Distribution.hx:24-27`).

| side | route | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `/distribution` | `camap-hx/src/controller/Distribution.hx:29` | section access | `camap-hx/lang/master/tpl/distribution/default.mtt` | MDs from yesterday 00:00 to +84 days (28*3), plus overlapping cycles; override `_from/_to` (`:33-54`, `camap-hx/src/tools/Timeframe.hx:9-21`) |
| HX | `/distribution/list/:d` | `camap-hx/src/controller/Distribution.hx:63` | | | redirects to `csaList` (`:64`) |
| HX | `/distribution/csaList/:d` | `camap-hx/src/controller/Distribution.hx:68` | `canManageContract(d.catalog)` (`:69`) | `camap-hx/lang/master/tpl/distribution/CSAList.mtt` -> neo `classicContractAttendance` (type 0) / `variableContractAttendance` (type 1) | CSA attendance sheet |
| HX | `/distribution/listByProductUser/:d` | `camap-hx/src/controller/Distribution.hx:78` | none in handler (global guard unverified) | | HTML table user x product for one distribution |
| HX | `/distribution/listByDate/:date/:place/[:type/:fontSize]` | `camap-hx/src/controller/Distribution.hx:143` | section access (`:144`) | `camap-hx/lang/master/tpl/distribution/listByDateOnePage.mtt` (164 l., `type=one`, `:188-189`), `listByDateShort.mtt` (116 l., `type=allshort`, `:190-191`), `listByDateOnePageContract.mtt` (179 l., `type=contract`, `:192-193`) | printable attendance sheet of a whole day+place; without `type` a radio form one/contract/all/allshort + font S/M/L/XL (`:151-174`; font ratios S 0.75, M 1, L 1.25, XL 1.5 `:178-183`); `type=csv` prints CSV (`:206-229`) |
| HX | `/distribution/delete/:d`, `/distribution/notAttend/:d` | `camap-hx/src/controller/Distribution.hx:237,250` | `isContractManager(d.catalog)` | | `cancelParticipation(d,false)` |
| HX | `/distribution/deleteMd/:md?token=` | `camap-hx/src/controller/Distribution.hx:265` | section access + token | | `deleteMd` |
| HX | `/distribution/edit/:d` | `camap-hx/src/controller/Distribution.hx:285` | | | change a distribution's own order dates (not for CONSTORDERS, `:288`) |
| HX | `/distribution/shift/:d` | `camap-hx/src/controller/Distribution.hx:336` | | | move participation to another MD (merge if already participating) |
| HX | `/distribution/inviteFarmers/:md` | `camap-hx/src/controller/Distribution.hx:479` | no explicit check | | checkbox list of active catalogs; participate / cancel |
| HX | `/distribution/inviteFarmersCycle/:cycle` | `camap-hx/src/controller/Distribution.hx:549` | | | stub "Fonctionnalité bientôt disponible" |
| HX | `/distribution/insertMd` | `camap-hx/src/controller/Distribution.hx:558` | section access | | create one MD |
| HX | `/distribution/editMd/:md` | `camap-hx/src/controller/Distribution.hx:614-678` (`:615`) | section access (`:616`); MD not compared to user's group | `form.mtt` | edit an MD: form from spod, date/start/end replaced by `CamapDatePicker`s (minutes rounded to multiples of 5, `:628-629,635-636`), checkbox "Recaler tous les producteurs sur ces horaires" (`override`, `:642`); submit -> `DistributionService.editMd` (`camap-hx/src/service/DistributionService.hx:194-248`); redirect `/distribution` |
| HX | `/distribution/insertMdCycle` | `camap-hx/src/controller/Distribution.hx:780` | section access | | create cycle of MDs |
| HX | `/distribution/deleteCycle/:cycle` | `camap-hx/src/controller/Distribution.hx:858` | section access; no token | | delete cycle and its MDs |
| HX | `/distribution/editCycle/:c`, `insertCycle/:contract`, `insert/:contract` | `camap-hx/src/controller/Distribution.hx:399,684,418` | | | bodies commented out (no-ops; only `doInsert` `:418-473` is fully commented out including signature) |
| HX | `/distribution/volunteerRoles/:md` | `camap-hx/src/controller/Distribution.hx:873` | no explicit check | | choose roles needed by the MD |
| HX | `/distribution/volunteers/:md` | `camap-hx/src/controller/Distribution.hx:937` | no explicit check | | admin assigns one member per role |
| HX | `/distribution/volunteersCalendar[?distrib=&role=&returnUrl=]` | `camap-hx/src/controller/Distribution.hx:986` | | `camap-hx/lang/master/tpl/distribution/volunteersCalendar.mtt` -> neo `volunteersCalendar` | calendar page; when `distrib`+`role` present registers the current user to the role (GET with side effect, `:993-1002`); `args.returnUrl` read at `:991` before the `args != null` test at `:993` |
| HX | `/distribution/unsubscribeFromRole/:md/:role` | `camap-hx/src/controller/Distribution.hx:976` | | | legacy: only redirects to `returnUrl` |
| HX | `/distribution/volunteersParticipation[?_from&_to]` | `camap-hx/src/controller/Distribution.hx:1025` | | | per-member duties done / to be done (`:1025-1060`) |
| HX | `/distribution/missingProduct/:md` | `camap-hx/src/controller/Distribution.hx:1066` | section access | | bulk edit of orders of variable catalogs of an MD |
| HX | `/distribution/changePrice/:md` | `camap-hx/src/controller/Distribution.hx:1106-1151` (`:1107`) | section access (`:1108`); no group-ownership check on the MD | | form: select a product among var-order catalogs of the MD + new price; for each order of that product in the MD: `order.productPrice = price`, `update()`, then `PaymentService.onOrderConfirm([order])` (`:1131-1141`); does not change the catalog price (warning `:1150`); redirect `/distribution/validate/<id>` |
| HX | `/distribution/validate/:md` | none | | | no handler exists; targeted at `camap-hx/src/controller/Distribution.hx:1096,1144` and `camap-hx/lang/master/tpl/distribution/default.mtt:87,131,173,188` |

### 3.2 HX `/contractAdmin/*` (constructor requires `isContractManager()`, `camap-hx/src/controller/ContractAdmin.hx:28-33`)

| side | route | handler path:line | auth/rights | purpose |
|---|---|---|---|---|
| HX | `/contractAdmin/distributions/:catalog` | `camap-hx/src/controller/ContractAdmin.hx:957` | | list MDs from first distrib date to end date, capped at +1 year unless `_from/_to`; `participateToAllDistributions=1` bulk participate (`:971-985`) |
| HX | `/contractAdmin/participate/:md/:catalog` | `camap-hx/src/controller/ContractAdmin.hx:1001` | no `canManageContract` (`:1001-1011`) | catalog joins an MD |
| HX | `/contractAdmin/selectDistrib/:c`, `tmpBaskets/:md` | `camap-hx/src/controller/ContractAdmin.hx:1090,1112` | | order-related pages |
| HX | `/contractAdmin/absences/:catalog` | `camap-hx/src/controller/ContractAdmin.hx:1121-1165` | | sets `absentDistribsMaxNb`, start 00:00:00 / end 23:59:59, then `CatalogService.checkAbsences` (`:1154`) |
| HX | `/contractAdmin/roles/:catalog`, `insertRole`, `editRole`, `deleteRole` | `camap-hx/src/controller/ContractAdmin.hx:165-250` | `doEditRole`/`doDeleteRole` do not verify the role belongs to the catalog/group (`:221-249`) | contract role CRUD |
| HX | `/contractAdmin/ordersByDate` | `camap-hx/src/controller/ContractAdmin.hx:456` | | CSV link to `listByDate` from `camap-hx/lang/master/tpl/contractadmin/ordersByDate.mtt:22` |

### 3.3 HX `/amapadmin/volunteers/*` (`camap-hx/src/controller/amapadmin/Volunteers.hx`; AmapAdmin constructor requires `isAmapManager`, `camap-hx/src/controller/AmapAdmin.hx:27`)

`default` (`:13-84`, duty settings form + generic role list), `insertRole` (`:90`), `editRole/:role` (`:155`), `deleteRole/:role?token&force` (`:181`).

### 3.4 HX REST (`camap-hx/src/controller/Api.hx:31-33` -> `camap-hx/src/controller/api/Distributions.hx`)

| side | route | handler path:line | auth/rights | purpose |
|---|---|---|---|---|
| HX | `GET /api/distributions/volunteerRolesCalendar/:from/:to` | `camap-hx/src/controller/api/Distributions.hx:36-86` | no login check (uses `app.getCurrentGroup()`) | `{multiDistribs[{id,distribStartDate,hasVacantVolunteerRoles,canVolunteersJoin,volunteersRequired,volunteersRegistered,hasVolunteerRole{roleId:bool},volunteerForRole{roleId:{id,coupleName}|null}}], roles[{id,name}]}` |
| HX | `POST /api/distributions/unsubscribeFromRole/:md/:role` | `camap-hx/src/controller/api/Distributions.hx:21-31` | login; 422 if nobody on role, 403 if volunteer != current user | `removeUserFromRole` |
| HX | `/api/catalog/catalogAbsences/:catalog`, `/api/catalog/subscriptionAbsences/:sub` (GET/POST `{absentDistribIds:[]}`) | `camap-hx/src/controller/api/Catalog.hx:48-53,77-122` | contract manager or subscriber (`:78-80`) | absences |

### 3.5 HX waiting list

`/group/list/:group` register (`camap-hx/src/controller/Group.hx:82-114`), `/group/listCancel/:group` (`camap-hx/src/controller/Group.hx:119-127`), `/member/movetowl/:user` (`camap-hx/src/controller/Member.hx:215-224`).

### 3.6 TS GraphQL (schema `camap-ts/packages/api-core/src/schema.gql:540-546,571,605-607`)

| side | operation | handler path:line | auth/rights | purpose |
|---|---|---|---|---|
| TS | `distribution(id)` | `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:33` | none (class has no `@UseGuards`, `:19-20`; no `APP_GUARD` in `camap-ts/packages/api-core/src/app.module.ts:66-75`) | read distribution |
| TS | fields `Distribution.userOrders`, `Distribution.multiDistrib`, date fields | `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:96-104`, `:106-121`, `:48-74` | none | `userOrders` returns preloaded or `ordersService.findUserOrdersByDistributionIds([parent.id])` (`camap-ts/packages/api-core/src/payments/services/orders.service.ts:21`); exposes `id, quantity, productPrice, productId, userId, distributionId, subscriptionId` (`camap-ts/packages/api-core/src/shop/types/user-order.type.ts`); `multiDistrib` -> `finder.one(multiDistribId)` else `NotFoundException`; `orderStartDate` returns `new Date(0)` when invalid (`:66`) |
| TS | `multiDistribution(id)` | `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:62-74` | login only, no membership check | |
| TS | `multiDistribs(groupId,fromDate,toDate,nextMultiDistribIfEmpty)` | `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:78-105` | login + `canManageAllCatalogs` | |
| TS | `distributedMultiDistribs(groupId)` | `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:107-120` | login + `canManageAllCatalogs` | |
| TS | `distributionCycles(groupId)` | `camap-ts/packages/api-core/src/shop/resolvers/distribution-cycles.resolver.ts:38-46` | `canManageAllCatalogs`; only cycles with `endDate > now` (`camap-ts/packages/api-core/src/shop/services/distribution-cycles.service.ts:21-26`) | cycle list |
| TS | `DistributionCycle.startDate/endDate/startHour/endHour/openingHour/closingHour` | `camap-ts/packages/api-core/src/shop/resolvers/distribution-cycles.resolver.ts:52,60,68,76,84,92` | class `MaybeAuthGuard` | each `zonedTimeToUtc(parent.raw_<field>, TZ_PARIS)` |
| TS | `attendanceClassicContract(catalogId,startDate,endDate)` | `camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:30-88` | login + (manage all catalogs OR manage catalog OR volunteer of an MD of that catalog) (`:44-69`) | classic attendance |
| TS | `attendanceVariableContract(catalogId,distributionId)` | `camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:90-138` | login only | variable attendance |
| TS | `getWaitingListsOfGroup(groupId)` | `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:40-45` | login only | |
| TS | `moveBackToWaitingList(userIds,groupId,message)` | `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:47-111` | `canManageMembers` | |
| TS | `cancelRequest(userId,groupId)` (refuse), `approveRequest(userId,groupId)` | `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:113-221` | `canManageMembers` (`:231-247`) | |
| TS | fields `MultiDistrib.volunteers`, `volunteerRoles` | `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:155-181` | inherits | loader `camap-ts/packages/api-core/src/groups/loaders/volunteers.loader.ts` |

No TS mutation exists for MD/distribution/cycle/volunteer/role/absence.

### 3.7 Front modules (`camap-ts/packages/front-core/src`)

- `volunteersCalendar` (neo module; props from `camap-hx/lang/master/tpl/distribution/volunteersCalendar.mtt`): calls HX REST `GET /distributions/volunteerRolesCalendar/<from>/<to>` with `yyyy-MM-dd 00:00:00` (`camap-ts/packages/front-core/src/modules/volunteersCalendar/requests.tsx:28-34`, `camap-ts/packages/front-core/src/modules/volunteersCalendar/VolunteersCalendar.module.tsx:129-135`), window +-4 months, lazy loading; unsubscribe = POST (`requests.tsx:36-42`); register = plain link to the HX page (`camap-ts/packages/front-core/src/modules/volunteersCalendar/components/VolunteersCalendarDistributionRole.tsx:114-120`).
- `csaAttendanceSheet` (neo `classicContractAttendance`, `variableContractAttendance`, `camap-ts/packages/front-core/src/neo.tsx:51-53,124-126`): GraphQL above; CSV and XLSX export client-side (`camap-ts/packages/front-core/src/components/attendanceSheet/attendanceSheet.utils.ts:9-83,85-234`); display options persisted in `localStorage['ATTENDANCE_LIST_FORMAT']` (`attendanceSheet.utils.ts:297-323`).
- `haxe-date-picker`: rendered by HX form element `CamapDatePicker` (see `frontend-templates-i18n.md`); writes hidden input `YYYY-MM-DD HH:mm:ss` in browser local time (`camap-ts/packages/front-core/src/modules/haxe-date-picker/HaxeDatePicker.tsx:21-28,99-103`); empty initial value becomes "now" (`:37-42`).

## 4. Business rules

### Dates and time zones
1. DB stores Paris wall-clock `datetime`s. The HX server runs `TZ=Europe/Paris` (`camap-hx/camap-hx.Dockerfile:115`).
2. TS entities expose `raw_*` columns plus getters/setters using `zonedTimeToUtc` / `utcToZonedTime` with `Europe/Paris` (`camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:90-142`, `camap-ts/packages/api-core/src/shop/entities/distribution-cycle.entity.ts:70-135`, `camap-ts/packages/api-core/src/entities/waiting-list.entity.ts:15-24`). Resolvers re-apply `zonedTimeToUtc(raw_x, TZ_PARIS)` on every date field (`camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:125-152`, `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:48-74`, `camap-ts/packages/api-core/src/shop/resolvers/distribution-cycles.resolver.ts:52-98`, `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:223-226`). Some TS finders compare `raw_` columns with unconverted `new Date()` (`camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:50-53,76-115`) while others convert (`:62-70`, `camap-ts/packages/api-core/src/shop/services/distributions.service.ts:53`); tests run with `TZ=UTC` (`camap-ts/packages/api-core/package.json:27,31`). `CatalogEntity.startDate/endDate/absences*` are plain `Date` without Paris conversion (`camap-ts/packages/api-core/src/vendors/entities/catalog.entity.ts:39-42,60-66`).
3. HX JSON API sends dates through `Formatting.dateToIso`, which appends `+01:00` / `+02:00` using fixed boundaries "29 March 02:00" and "25 October 03:00" every year (`camap-hx/common/Formatting.hx:226-255`, `jsonReplacer` `:256`).
4. `tools/DateTool.fromJs/toJs` use a hardcoded DST table for 2019..2024 only and throw `out of range` outside (`camap-hx/src/tools/DateTool.hx:10-35,93-139`); no call site found.
5. The volunteer calendar REST receives `from/to` as `yyyy-MM-dd 00:00:00` strings parsed by HX as Paris local (`camap-ts/packages/front-core/src/modules/volunteersCalendar/VolunteersCalendar.module.tsx:129-135`, `camap-hx/src/controller/api/Distributions.hx:36`).
6. Whole-day lookup `MultiDistrib.get(date,place)`: same place and `distribStartDate` between 00:00 and 23:59 of the date; used to forbid two MDs same day+place (`camap-hx/src/db/MultiDistrib.hx:44-49`, `camap-hx/src/service/DistributionService.hx:160-162,198`). `getFromTimeRange` upper bound is `<` while `to` is 23:59 (`camap-hx/src/db/MultiDistrib.hx:55-57`); TS uses `Between` inclusive (`camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:85`).

### MultiDistrib / Distribution lifecycle
7. Create MD: error if an MD exists same day+place; default general roles (`catalog==null && enabledByDefault`) written into `volunteerRolesIds`; `checkMultiDistrib` runs after `insert` (`camap-hx/src/service/DistributionService.hx:157-189`). `checkMultiDistrib`: start date required; `distribEndDate` forced to the same day as start (and `update()`d inside the check, `:22-28`); both order dates required; `distribStartDate >= orderEndDate`; `orderStartDate <= orderEndDate` (`:30-40`). TS has the same two comparisons (`camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:180-202`) but no caller.
8. Edit MD (`editMd`): uniqueness vs other MDs; updates every child `Distribution` date/end/place; order dates: if `override` or the distribution had no `orderStartDate`, copy MD's; else copy each of start/end only if it equalled the previous MD value (`camap-hx/src/service/DistributionService.hx:194-245`, conflict `:198-200`, overwrite `:225-236`). The posted `placeId` is not checked against the group.
9. Delete MD: fires `PreDeleteMultiDistrib`, cancels every participation (`cancelParticipation(d,false)`), deletes MD (`camap-hx/src/service/DistributionService.hx:253-266`).
10. Participate (catalog joins an MD): error if already participating; variable catalogs need MD order dates; existing subscriptions: CONSTORDERS forbidden, others warning; per-catalog override `orderStartDaysBeforeDistrib`/`orderEndHoursBeforeDistrib` recomputes that distribution's order window relative to `distribStartDate`, else MD dates (`camap-hx/src/service/DistributionService.hx:271-311`). `create` (deprecated) adds the catalog's roles to the MD's role ids and runs `checkDistrib` (`:103-155`).
11. `checkDistrib`: date within catalog start 00:00 .. end 23:59; `date >= orderEndDate`; for variable catalogs `orderStartDate <= orderEndDate` (`camap-hx/src/service/DistributionService.hx:79-96`); overlap check commented out (`:54-77`).
12. Cancel participation: for CONSTORDERS or `distribMinOrdersTotal>0` catalogs fails if any subscription is paid, warns if subscriptions exist; `canDelete`: CONSTORDERS -> no distribution of the catalog already past; others -> total order quantity 0; deletes zero-qty orders, removes the catalog's roles from the MD, clears products excerpt cache, deletes the distribution (`camap-hx/src/service/DistributionService.hx:560-630`). Volunteers registered on removed roles are not deleted here (DB cascade unverified).
13. Edit attendance (one distribution's order window): UI only for non-CONSTORDERS (`camap-hx/src/controller/Distribution.hx:288`); `editAttendance` sets orderEnd (and orderStart for variable) then `checkDistrib` (`camap-hx/src/service/DistributionService.hx:383-404`).
14. Shift (`shiftDistribution`): new MD within catalog start/end; if the catalog already participates in the target MD, orders move onto the existing distribution and `quantities++` (blocked if a subscriber is absent on target but not on source, `:431-446`); else the distribution is moved and takes the target's dates. Volunteers on the catalog's roles in the old MD are deleted, those roles moved to the new MD role list; baskets re-created and renumbered; catalog end extended if needed; subscriptions ending before the new date extended (`camap-hx/src/service/DistributionService.hx:409-552`). Warning texts `camap-hx/src/controller/Distribution.hx:341-349`.
15. Order-window state `MultiDistrib.getState()`: null if no MD order dates; before distribution: `notYetOpen` (earliest start incl. exceptions in future), `open` (latest end incl. exceptions in future), else `closed`; after `distribStartDate`: `distributed` (`camap-hx/src/db/MultiDistrib.hx:260-280`). "Including exceptions" = min start / max end across the MD and its variable-order distributions (`:159-189`). `isActive()` uses inclusive `>=`/`<=` (`:147-157`). `getState()` never returns `validated` (`:260-280`) while `camap-hx/lang/master/tpl/distribution/default.mtt:184` branches on it, and `default.mtt:129` hardcodes dates `2021-03-10/11`.
16. `Distribution.canOrderNow()`: if `orderEndDate==null` -> catalog availability, else catalog flag `UsersCanOrder` AND strictly `start < now < end` (`camap-hx/src/db/Distribution.hx:154-165`). TS `ordersAreOpen` also strict, false when end is null (`camap-ts/packages/camap-common/src/distributions/distribution.ts:1-7`).
17. TS `getOrdersStartDate/EndDate(includingExceptions)` replicate rule 15 on `raw_*` values (`camap-ts/packages/api-core/src/shop/services/multi-distribs.service.ts:119-178`, tests `camap-ts/packages/api-core/src/shop/services/multi-distrib.service.spec.ts:95-140`). TS enum `MultiDistribOpenStatus` has OPEN/CLOSED/NOT_YET_OPEN/VALIDATED/DISTRIBUTED (`camap-ts/packages/api-core/src/shop/multi-distrib-status.ts:1-7`), registered in GraphQL (`camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:45`), not exposed by any `MultiDistrib` field (`camap-ts/packages/api-core/src/shop/types/multi-distrib.type.ts`). TS error enum carries ~17 reasons, only two emitted; value clash `DISTRIBUTION_DATE_AFTER_ORDER_END_DATE = 'DISTRIBUTION_DATE_BEFORE_ORDER_END_DATE'` (`camap-ts/packages/api-core/src/shop/services/distributions.service.error.ts:4-5,16-17`).

### Cycles
18. `createCycle` stores the cycle then immediately generates MDs; validation commented out (`camap-hx/src/service/DistributionService.hx:752-790`). From the MD form `contractIds` is always `[]` (`camap-hx/src/controller/Distribution.hx:841`), so cycle MDs have no participations.
19. Generation (`createCycleDistribs`, `camap-hx/src/service/DistributionService.hx:664-724`): end date forced to 23:59; pointer starts at start date 12:00 (`:677`); max 100 iterations; step +7/+14/+21 days; Monthly = same weekday and same Nth-of-month as the first date (`getWhichNthDayOfMonth`), falling back to N-1 when the month lacks it (`:695-702`, `camap-hx/src/tools/DateTool.hx:83-90`); stops when pointer > end date. Each occurrence calls `createMd` which throws on same day+place conflict, aborting the loop (no per-occurrence catch).
20. Per-occurrence dates (`getDates`, `camap-hx/src/service/DistributionService.hx:637-658`): start = pointer day + `startHour`; order start = (start - `daysBeforeOrderStart` days) at `openingHour`; order end = (start - `daysBeforeOrderEnd` days) at `closingHour`; both `days*` required. Form defaults: 10 days / 08:00, 2 days / 23:55, 19:00-20:00 (`camap-hx/src/controller/Distribution.hx:788-816`). Tests: `camap-hx/src/test/TestDistributions.hx:100-221`.
21. Delete cycle: deletes each MD through `deleteMd` (errors as flash messages), then the cycle (`camap-hx/src/service/DistributionService.hx:730-747`). TS FK `MultiDistrib.distributionCycleId` is `ON DELETE SET NULL` (`camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:41-47`).
22. Admin page lists cycles with `startDate`/`endDate` inside the timeframe or spanning it (`camap-hx/src/db/DistributionCycle.hx:43-52`).

### Volunteer roles and assignments
23. Roles: group-wide ("generic") created by amap admin (`insertRole`, `enabledByDefault` choice; if true, added to all future MDs) (`camap-hx/src/controller/amapadmin/Volunteers.hx:90-115,117-150`); contract roles created by contract admin with `enabledByDefault=true`, added to future MDs where the catalog already has a distribution (`camap-hx/src/controller/ContractAdmin.hx:178-210`) or generated N at a time ("Duty period <catalog> i", max 20) (`camap-hx/src/service/VolunteerService.hx:198-210`).
24. Editing a generic role with `enabledByDefault` false calls `updateRoleToFuturesDistribs(role,false)`, removing the role AND its registered volunteers from all future MDs (`camap-hx/src/controller/amapadmin/Volunteers.hx:170`, `:136-146`); `doEditRole` forces `role.catalog = null` and is reachable for any role id (`:166`); `md.volunteerRolesIds.split` at `:121` precedes the future-date guard at `:124` (same in `camap-hx/src/controller/ContractAdmin.hx:203`).
25. Deleting a role: refuses if volunteers exist (message with "Supprimer quand-même" `force=1` link), otherwise removes it and strips its id from every MD of the group (`camap-hx/src/service/VolunteerService.hx:14-39`). Deleting a catalog deletes its roles (`camap-hx/src/controller/ContractAdmin.hx:1195-1199`).
26. MD roles update (`doVolunteerRoles`): shown = generic roles + roles of catalogs participating in the MD, + "(?)" for ids still on the MD but no longer legitimate; saving refuses to uncheck a role that has a volunteer (`camap-hx/src/service/VolunteerService.hx:176-196`, `camap-hx/src/controller/Distribution.hx:873-931`). Adding the first vendor to an empty MD adds the default generic roles (`camap-hx/src/controller/Distribution.hx:528-540`).
27. Admin assignment (`updateVolunteers`) syncs MD volunteers with a role->user map (ListSynchronizer) (`camap-hx/src/service/VolunteerService.hx:44-80`); user choices = all members of the admin's current group (`camap-hx/src/controller/Distribution.hx:948`).
28. Member self-registration: HX page with `distrib`+`role` -> `addUserToRole`: only check is "role not already filled"; a user may hold several roles in the same MD (check commented out) (`camap-hx/src/service/VolunteerService.hx:86-111`). Not checked server-side: `canVolunteersJoin`, that the role belongs to the MD, that the user is a group member (unverified elsewhere).
29. `canVolunteersJoin`: now >= `distribStartDate - group.daysBeforeDutyPeriodsOpen` days (`camap-hx/src/db/MultiDistrib.hx:463-466`); default 60 (`camap-hx/src/db/Group.hx:108`); allowed range 7..365 (`camap-hx/src/service/VolunteerService.hx:218-224`).
30. Self-unsubscribe (REST): must be the volunteer; if now is later than `distribStartDate - vacantVolunteerRolesMailDaysBeforeDutyPeriod` days, a mail "A role has been left for <date> distribution" is sent to ALL group members (email + email2) via `camap-hx/lang/master/tpl/mail/volunteerUnsuscribed.mtt`, then the row is deleted (`camap-hx/src/service/VolunteerService.hx:126-171`). Before that date no mail.
31. Role visibility in calendar: generic roles always; contract roles only until `catalog.endDate + daysAfterClosingBeforeHidingDutyPeriods` days (default 30, range 0..255) (`camap-hx/src/service/VolunteerService.hx:386-409,239-244`, `camap-hx/src/controller/amapadmin/Volunteers.hx:62`, `camap-hx/src/db/Group.hx:109`). `isNumberOfDaysValid("vacantRolesMail")` upper-bound message wording (`camap-hx/src/service/VolunteerService.hx:236`).
32. Participation counters (`getUserParticipation`) over the group membership year (renewal date, default 1 September) (`camap-hx/src/db/Group.hx:332-345`): generic roles to do = ceil(#generic role slots in period / #group members); contract roles to do per user = sum over contracts where the user (or `user2`) has an order in a distribution of the period of ceil(#slots / #such members); done = Volunteer rows split generic/contract (`camap-hx/src/service/VolunteerService.hx:260-380`). Same figures in members' page (`toBeDone`,`done`) (`camap-hx/src/controller/Distribution.hx:1005-1014`) and admin table (`:1025-1060`).
33. `hasVacantVolunteerRoles` = `canVolunteersJoin` AND roles count > volunteers count of the MD (`camap-hx/src/db/MultiDistrib.hx:419-428`; compares to total Volunteer rows `:423`).
34. Reminder mails (HX `Cron.doHour`, triggered by Nest `CrontabService` every hour, `camap-ts/packages/api-core/src/tools/crontab.service.ts:29-36`): "Volunteers instruction mail": MDs starting in the next hourly slot shifted by `group.volunteersMailDaysBeforeDutyPeriod` days (default 4, allowed 2..15); skip disabled groups; requires flag `AllowInformationNotifs`; only if at least one volunteer; mail to volunteers (email + email2), body = `volunteersMailContent` with `[DATE_DISTRIBUTION]`, `[LIEU_DISTRIBUTION]`, `[LISTE_BENEVOLES]` (`camap-hx/src/controller/Cron.hx:96-153`, `camap-hx/src/controller/amapadmin/Volunteers.hx:35-38`). "Volunteers alerts": same slot logic with `vacantVolunteerRolesMailDaysBeforeDutyPeriod` (default 7, 2..15); requires `AllowAlertNotifs` and `hasVacantVolunteerRoles`; mail to all group members, tokens `[DATE_DISTRIBUTION]`, `[LIEU_DISTRIBUTION]`, `[ROLES_MANQUANTS]` (`camap-hx/src/controller/Cron.hx:156-205`, `camap-hx/src/controller/amapadmin/Volunteers.hx:43-46`). No TS implementation. "Distrib notifications" at 4h/24h use `Distribution.date` (`camap-hx/src/controller/Cron.hx:458-468`). See `crons-scheduled-jobs.md`.
35. `Group.getActiveMultiDistribs` returns all MDs of the group, not only active (`camap-hx/src/db/Group.hx:198-200`).

### Absences (CSA subscriptions), HX only
36. Management available when catalog is CONSTORDERS or variable with `distribMinOrdersTotal>0`, AND `absentDistribsMaxNb>0` AND start/end dates set (`camap-hx/src/db/Catalog.hx:145-152`). Description text rules `camap-hx/src/service/AbsencesService.hx:21-26`.
37. Candidate distributions of a catalog: `date >= absencesStartDate`, `end <= absencesEndDate`, `quantities==1` (merged/shifted excluded) (`camap-hx/src/service/AbsencesService.hx:13-19`; per subscription also within subscription dates, `camap-hx/src/db/Subscription.hx:161-182`).
38. Catalog validation (`checkAbsences`): see `catalogs-products-vendors-places.md` rule 14 (`camap-hx/src/service/CatalogService.hx:197-233`).
39. `setAbsences`: no duplicate ids; count must equal `subscription.getAbsencesNb()` unless admin mode and subscription already exists; every id in possible absent distribs; stored sorted ascending (`camap-hx/src/service/AbsencesService.hx:31-60`). Number editable only at subscription creation (`:94-109`). Automatic absences = last N distributions of the period (`:72-89`).
40. `updateAbsencesDates`: past distributions (`date < now`) cannot be added or removed; CONSTORDERS -> recurrent orders regenerated; variable -> orders on newly absent distributions deleted and default orders re-created on newly present ones (`camap-hx/src/service/AbsencesService.hx:114-194`, `:121,131`). The REST layer instead uses `orderEndDate` (`> now` selectable, `< now` locked) (`camap-hx/src/controller/api/Catalog.hx:86-90`); non-admin users cannot post an empty list (`:102-104`).
41. Subscription distributions exclude absence ones unless `allIncludingAbsences` (`camap-hx/src/service/SubscriptionService.hx:190-239`); distribution count minus absences (`:245-262`).
42. TS only stores `absentDistribIds` (`camap-ts/packages/api-core/src/groups/entities/csa-subscription.entity.ts:35`) and displays it in the classic attendance sheet (`camap-ts/packages/front-core/src/modules/csaAttendanceSheet/ClassicContractAttendanceModule.tsx:236`); editing UI (`csaCatalog` module) calls HX REST (`camap-ts/packages/front-core/src/modules/csaCatalog/requests.tsx:44-50,125-150`).

### Waiting list
43. Registration (HX): only when group `regOption == WaitingList` and user logged in (`camap-hx/src/controller/Group.hx:89`); error if already in the list or already a member (`camap-hx/src/service/WaitingListService.hx:43-52`); inserts row, then mails each user holding `GroupAdmin` or `Membership` right (`:10-41`).
44. User cancels own request (`removeFromWl`): must be logged and in the list (`camap-hx/src/service/WaitingListService.hx:57-69`).
45. Move member back (HX `moveBackToWl`): target must be member, not self, not GroupAdmin, not already waiting; deletes UserGroup and creates WaitingList row with message "Remis en liste d'attente par <name>" (`camap-hx/src/service/WaitingListService.hx:75-93`, `camap-hx/src/controller/Member.hx:215-224`).
46. TS `moveBackToWaitingList`: collects per-user errors `cannotSetSelfToWaitingList`, `userNotInGroup`, `cannotSetAdminToWaitingLIst` (typo, `:92`); deletes membership; inserts WaitingList rows (`create` with `raw_date = utcToZonedTime(now)`) (`camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:47-111`, `camap-ts/packages/api-core/src/groups/services/waitingLists.service.ts:33-45`); no "already waiting" check and no email; `splice` inside `forEach` (`:78-83`).
47. TS `approveRequest`: creates membership (if absent) + deletes WL row + buffered mail to the requester ("acceptée") and one mail to other member-managing admins. `cancelRequest`: deletes WL row, mail to requester ("refusée") and to other admins (`camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:113-221`). HX has no approve/refuse UI; approval is TS-only (`camap-ts/packages/front-core/src/modules/members/components/WaitingListButtons.tsx:39-46`).
48. TS front shows the waiting list as member list type `waitingList` (`camap-ts/packages/front-core/src/modules/members/containers/MembersTableAndActions.tsx:193-200`, `WaitingListTable.tsx:52-82`).

### Attendance sheets / exports
49. HX per-day sheet `listByDate`: all catalogs active in the group, that day+place, orders prepared by user, volunteers of the MD appended; CSV columns userId,userName,productName,ref,catalogName,catalogId,vendorId,price,quantity,fees,total,paid (`camap-hx/src/controller/Distribution.hx:195-229`); the CSV link comes from `camap-hx/lang/master/tpl/contractadmin/ordersByDate.mtt:22` (radio form has no csv choice).
50. `listByDateShort.mtt`: group name, "Livraison du <date>", columns Name / Contact details / Qty / Product / Signature (`:22-26`); one row group per user, basket number (`:43-44`), phone (`:58-67`), "alternately with" for `userName2` (`:48-50`), "Canceled" for qty 0 (`:75-76`); no prices. `listByDateOnePageContract.mtt`: one member per page sorted by catalog, columns Contract / Qty / Product / U.P. / Fees / Total / Signature (`:19-30`), header (`:11-16`), new table + `<hr/>` per user (`:40-46`), phone (`:58-61`). `listByDateOnePage.mtt`: one member per page with prices. (All under `camap-hx/lang/master/tpl/distribution/`.)
51. CSA sheet: classic by date range of catalog (default catalog start/end), variable by distribution; rights classic = manage all catalogs OR manage catalog OR volunteer of one of the catalog's MDs; variable = login only (`camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:44-69` vs `:90-138`). Classic requires `catalog.type==0`, variable `==1` (`:40,99`). Classic: subscriptions overlapping the range (`findByCatalogIdInRange`) + distributions in range; variable: subscriptions derived from the distribution's user orders (`:112-136`).
52. Export: CSV (`data:text/csv` blob, header with group/catalog/coordinator/vendor/instructions/volunteers) and XLSX, generated in the browser (`camap-ts/packages/front-core/src/components/attendanceSheet/attendanceSheet.utils.ts:9-83,85-234`).
53. TS `checkAndGetMultiDistribAndGroup` helper is never called and contains unreachable branches (`camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:187-214`).

## 5. Flows

A. Admin creates a cycle: `/distribution/insertMdCycle` form (HX) -> `DistributionService.createCycle` -> insert cycle -> loop dates -> `createMd` per date (default generic roles) -> flash. Participation of catalogs is then done per MD (`inviteFarmers`) or per catalog (`contractAdmin/distributions` + `participateToAllDistributions`).

B. Catalog joins an MD: `participate` -> create Distribution (order window from catalog overrides) -> catalog's contract roles added to MD (`camap-hx/src/service/DistributionService.hx:132-138`) -> `NewDistrib` event fired.

C. Volunteer self-registration: neo `volunteersCalendar` loads `/api/distributions/volunteerRolesCalendar/<from>/<to>` -> user clicks "register" -> browser navigates to HX `/distribution/volunteersCalendar?distrib&role` -> `addUserToRole` -> redirect/flash. Unsubscribe is an XHR POST to `/api/distributions/unsubscribeFromRole/...`; mail to everyone if the vacancy alert date has passed. Reminder mails run from the hourly cron.

D. Absences: admin sets period (`contractAdmin/absences`) -> at subscription creation either explicit ids or `absenceNb` (auto last N) -> user later edits ids via `/api/catalog/subscriptionAbsences/:sub` until each distribution's order close -> orders regenerated.

E. Waiting list: user -> HX `/group/list/:id` -> admins mailed -> admin in TS members page approves (membership created) or refuses (mail); or admin moves a member back (HX button or TS bulk action).

F. Attendance sheet: from orders/selectDistrib pages (HX) -> `/distribution/csaList/:id` -> neo module -> GraphQL attendance query -> print / CSV / XLSX.

G. Edit MD / change price (HX): `editMd` -> form -> `DistributionService.editMd` -> children updated; `changePrice` -> per-order price rewrite -> `PaymentService.onOrderConfirm`.

## 6. Ownership hx vs ts

| capability | owner | evidence |
|---|---|---|
| Create/edit/delete MD, distribution, cycle, participation, shift | HX only | `camap-hx/src/controller/Distribution.hx`, `camap-hx/src/service/DistributionService.hx`; no TS mutation |
| Read MD/distribution/cycle | TS GraphQL (also HX) | section 3.6 |
| Order window checks | both (HX `canOrderNow`/`getState`, TS `ordersAreOpen`/service helpers) | rules 15-17 |
| Volunteer roles CRUD and assignments | HX only | `camap-hx/src/controller/amapadmin/Volunteers.hx`, `camap-hx/src/controller/ContractAdmin.hx`, `camap-hx/src/service/VolunteerService.hx` |
| Volunteer calendar | UI TS (neo); data + register + unsubscribe HX | 3.4, 3.7 |
| Volunteer mails | HX | `camap-hx/src/controller/Cron.hx:96-205`, `camap-hx/src/service/VolunteerService.hx:126-171` |
| Volunteers read in GraphQL | TS (`MultiDistrib.volunteers/volunteerRoles`) | `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts:155-181` |
| Absences logic | HX only (TS display) | rules 36-42 |
| Waiting list register / cancel own | HX | `camap-hx/src/controller/Group.hx` |
| Waiting list list / approve / refuse / move back | TS (move back also HX) | `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts`, `camap-hx/src/controller/Member.hx:215` |
| CSA attendance sheets | TS front + GraphQL; per-day print + CSV HX | rules 49-52 |
| Date pickers in HX forms | TS neo module | 3.7 |

## 7. Known security/rights observations

Pointers only, see inconsistencies-code.md: `distribution(id)` / `Distribution.userOrders` unauthenticated; `attendanceVariableContract` and `getWaitingListsOfGroup` without rights checks; `multiDistribution` login-only; HX handlers without explicit rights checks (`inviteFarmers`, `volunteerRoles`, `volunteers`, `listByProductUser`, `participate`, role edit/delete); `doEditMd` / `doChangePrice` not scoped to the user's group; role registration by GET. Doc divergences for `volunteers.md`, `distributions.md`: see inconsistencies-docs.md.
