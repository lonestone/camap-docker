# 05 - Distributions, volunteers, absences, waiting lists, attendance sheets

Paths relative to `camap-docker/`. "unverified" = not confirmed by reading code. Documents what the code does today, no plans.

## 1. Overview

**Model**
- `MultiDistrib` = one distribution session: group, place, `distribStartDate/EndDate`, `orderStartDate/EndDate`, optional cycle, and `volunteerRolesIds` (comma-separated role ids stored in a text column) (camap-hx/src/db/MultiDistrib.hx:17-30). In TS `volunteerRolesIds` is a `simple-array` of numbers (camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:25-26).
- `Distribution` = participation of one catalog in a MultiDistrib. Holds its own `orderStartDate/orderEndDate` (per-catalog exception) and `quantities` (default 1; incremented when two distributions are merged by a "shift") (camap-hx/src/db/Distribution.hx:15-29, camap-hx/src/service/DistributionService.hx:446). `date`, `end`, `place` are flagged "deprecated" duplicates of the MultiDistrib (Distribution.hx:18-21); `Distribution.populate()` is a "retrocompat trick" copying MD values (Distribution.hx:189-199).
- `DistributionCycle` = recurrence template (Weekly | Monthly | BiWeekly | TriWeekly) from which MultiDistribs are bulk-created (camap-hx/src/db/DistributionCycle.hx:7-30). Enum order identical in TS (camap-ts/packages/api-core/src/shop/entities/distribution-cycle.entity.ts:16-21) - matters because hx `SEnum` stores the index.
- `VolunteerRole` (generic when `catalog==null`, else tied to a catalog, `enabledByDefault` flag) and `Volunteer` (PK user+multiDistrib+role) (camap-hx/src/db/VolunteerRole.hx:5-15, camap-hx/src/db/Volunteer.hx:6-11; TS entities camap-ts/packages/api-core/src/groups/entities/volunteer-role.entity.ts:16-50, volunteer.entity.ts:8-40).
- `WaitingList` (PK user+group, `date`, `message`) (camap-hx/src/db/WaitingList.hx:6-18; TS camap-ts/packages/api-core/src/entities/waiting-list.entity.ts:6-39).
- Absences: stored as comma-separated distribution ids in `Subscription.absentDistribIds`; limits on `Catalog.absentDistribsMaxNb/absencesStartDate/absencesEndDate` (camap-hx/src/db/Subscription.hx:17,136-146; AbsencesService.hx:62-67).

**Who owns what today (summary)**: all writes (create/edit/delete MD, cycles, participation, shifts, volunteers, roles, absences, waiting-list registration) are Haxe. TS (NestJS GraphQL) is read-only for distributions/volunteers/cycles; TS writes only for waiting list (approve / refuse / move-back). See section 5.

## 2. Routes / endpoints

### 2.1 Haxe `/distribution/*` (camap-hx/src/controller/Distribution.hx) - server-rendered
Access = `canManageAllContracts()` via `checkHasDistributionSectionAccess` (Distribution.hx:24-27) where noted.

| Route | Handler (line) | Purpose / access |
|---|---|---|
| `/distribution` | doDefault (29) | admin page: MDs from yesterday 00:00 to +84 days (28*3), plus cycles overlapping that timeframe; overridable with `_from/_to` (Distribution.hx:33-54, tools/Timeframe.hx:9-21). Section access check |
| `/distribution/list/:d` | doList (63) | redirects to `csaList` (64) |
| `/distribution/csaList/:d` | doCsaList (68) | mounts neo module `classicContractAttendance` (type 0) or `variableContractAttendance` (type 1) (camap-hx/lang/master/tpl/distribution/CSAList.mtt). Needs `canManageContract(d.catalog)` (69) |
| `/distribution/listByProductUser/:d` | (78) | HTML table user x product for one distribution; no access check in handler (unverified global guard) |
| `/distribution/listByDate/:date/:place/[:type/:fontSize]` | (143) | printable attendance sheet of a whole day+place. Section access (144). Without `type`: radio form one/contract/all/allshort + font S/M/L/XL (151-174); with type: templates `listByDateOnePage`, `...Short`, `...OnePageContract`; `type=csv` prints a CSV (206-229) |
| `/distribution/delete/:d` and `/distribution/notAttend/:d` | doDelete (237), doNotAttend (250) | `cancelParticipation(d,false)`; require `isContractManager(d.catalog)` |
| `/distribution/deleteMd/:md?token=` | (265) | section access + token; `deleteMd` |
| `/distribution/edit/:d` | doEdit (285) | change a distribution's own `orderStartDate/orderEndDate` (not for CONSTORDERS catalogs, 288) |
| `/distribution/shift/:d` | doShift (336) | move participation to another MD (merge if already participating) |
| `/distribution/inviteFarmers/:md` | (479) | checkbox list of active catalogs; participate / cancel participation; no explicit access check |
| `/distribution/inviteFarmersCycle/:cycle` | (549) | stub "Fonctionnalité bientôt disponible" |
| `/distribution/insertMd` / `editMd/:md` | (558, 615) | create / edit one MD (section access) |
| `/distribution/insertMdCycle` | (780) | create cycle of MDs (section access) |
| `/distribution/deleteCycle/:cycle` | (858) | delete cycle and its MDs (section access; no token check in handler) |
| `/distribution/editCycle/:c`, `insertCycle/:contract`, `insert/:contract` | (399, 684, 418) | bodies commented out: no-ops (empty/renders nothing) |
| `/distribution/volunteerRoles/:md` | (873) | choose which roles the MD needs; no explicit access check |
| `/distribution/volunteers/:md` | (937) | admin assigns one member per role; no explicit access check |
| `/distribution/volunteersCalendar[?distrib=&role=&returnUrl=]` | (986) | members' calendar page (neo module) AND, when `distrib`+`role` present, registers current user to the role (GET with side effect) (993-1002) |
| `/distribution/unsubscribeFromRole/:md/:role` | (976) | legacy: only redirects to `returnUrl` |
| `/distribution/volunteersParticipation[?_from&_to]` | (1025) | per-member duties done / to be done table |
| `/distribution/missingProduct/:md`, `changePrice/:md` | (1066, 1107) | bulk edit of orders of variable catalogs of an MD (section access) |
| `/distribution/validate/:md` | **no handler** | redirected to at 1096, 1144 and linked in default.mtt:87 |

### 2.2 Haxe `/contractAdmin/*` (camap-hx/src/controller/ContractAdmin.hx; constructor requires `isContractManager()`, ContractAdmin.hx:28-33)
`distributions/:catalog` (957: list MDs, from first distrib date to end date, capped at +1 year unless `_from/_to`; `participateToAllDistributions=1` bulk participate 971-985), `participate/:md/:catalog` (1001), `selectDistrib/:c` (1090), `tmpBaskets/:md` (1112), `absences/:catalog` (1121-1165: sets `absentDistribsMaxNb`, start 00:00:00 / end 23:59:59, then `CatalogService.checkAbsences`), role CRUD `roles/:catalog`, `insertRole`, `editRole`, `deleteRole` (165-250), `ordersByDate` (456), catalog delete removes its roles (ContractAdmin.hx:1170,1195-1199).

### 2.3 Haxe `/amapadmin/volunteers/*` (camap-hx/src/controller/amapadmin/Volunteers.hx; AmapAdmin ctor requires `isAmapManager` camap-hx/src/controller/AmapAdmin.hx:27)
`default` (13-84: duty settings form + generic role list), `insertRole` (90), `editRole/:role` (155), `deleteRole/:role?token&force` (181).

### 2.4 Haxe REST `/api/distributions/*` (camap-hx/src/controller/Api.hx:31-33 -> controller/api/Distributions.hx)
| Route | Behaviour |
|---|---|
| `GET /api/distributions/volunteerRolesCalendar/:from/:to` | `{multiDistribs[{id,distribStartDate,hasVacantVolunteerRoles,canVolunteersJoin,volunteersRequired,volunteersRegistered,hasVolunteerRole{roleId:bool},volunteerForRole{roleId:{id,coupleName}|null}}], roles[{id,name}]}` (Distributions.hx:36-86). No login check in handler (uses `app.getCurrentGroup()`) |
| `POST /api/distributions/unsubscribeFromRole/:md/:role` | login required; 422 if nobody on role, 403 if volunteer != current user; calls `removeUserFromRole` (Distributions.hx:21-31) |
Other hx REST used by my area: `/api/catalog/catalogAbsences/:catalog`, `/api/catalog/subscriptionAbsences/:sub` (GET/POST `{absentDistribIds:[]}`) (camap-hx/src/controller/api/Catalog.hx:48-53, 77-122).

### 2.5 Haxe group waiting list
`/group/list/:group` register (Group.hx:82-114), `/group/listCancel/:group` (Group.hx:119-127), `/member/movetowl/:user` (Member.hx:215-224).

### 2.6 TS GraphQL (camap-ts/packages/api-core/src, schema camap-ts/packages/api-core/src/schema.gql:540-546, 571, 605-607)
| Operation | File:line | Guard |
|---|---|---|
| `distribution(id)` | shop/resolvers/distributions.resolver.ts:33 | none (class has no `@UseGuards`) |
| `multiDistribution(id)` | shop/resolvers/multi-distribs.resolver.ts:62-74 | GqlAuthGuard only (login, no group-membership check) |
| `multiDistribs(groupId,fromDate,toDate,nextMultiDistribIfEmpty)` | multi-distribs.resolver.ts:78-105 | login + `canManageAllCatalogs` |
| `distributedMultiDistribs(groupId)` | multi-distribs.resolver.ts:107-120 | login + `canManageAllCatalogs` |
| `distributionCycles(groupId)` | shop/resolvers/distribution-cycles.resolver.ts:38-46 | `canManageAllCatalogs`; only cycles with `endDate > now` (shop/services/distribution-cycles.service.ts:21-26) |
| `attendanceClassicContract(catalogId,startDate,endDate)` | shop/resolvers/attendance-list.resolver.ts:30-88 | login + (manage all catalogs OR manage catalog OR volunteer of a MD of that catalog) |
| `attendanceVariableContract(catalogId,distributionId)` | attendance-list.resolver.ts:90-138 | login only (no rights check) |
| `getWaitingListsOfGroup(groupId)` | groups/resolvers/waitingLists.resolver.ts:40-45 | login only (no `canManageMembers`) |
| `moveBackToWaitingList(userIds,groupId,message)` | waitingLists.resolver.ts:47-111 | `canManageMembers` |
| `cancelRequest(userId,groupId)` (refuse) / `approveRequest(userId,groupId)` | waitingLists.resolver.ts:113-221 | `canManageMembers` (231-247) |
| fields `MultiDistrib.volunteers`, `volunteerRoles` | multi-distribs.resolver.ts:155-181 | inherits |
No TS mutation exists for MD/distribution/cycle/volunteer/role/absence.

### 2.7 Front modules (camap-ts/packages/front-core/src)
- `volunteersCalendar` (neo module; props userId,toBeDone,done,fromDate,toDate,daysBeforeDutyPeriodsOpen,focusedMultiDistribId given by camap-hx/lang/master/tpl/distribution/volunteersCalendar.mtt). Calls hx REST GET `/distributions/volunteerRolesCalendar/<from>/<to>` with `yyyy-MM-dd 00:00:00` (modules/volunteersCalendar/requests.tsx:28-34, VolunteersCalendar.module.tsx:129-135), window +-4 months, lazy loading more; unsubscribe = POST (requests.tsx:36-42); **register = plain link to the hx page** `/distribution/volunteersCalendar?distrib=..&role=..` (components/VolunteersCalendarDistributionRole.tsx:114-120).
- `csaAttendanceSheet` (neo `classicContractAttendance`, `variableContractAttendance`, camap-ts/packages/front-core/src/neo.tsx:51-53,124-126). Uses GraphQL above; CSV and XLSX export client-side (components/attendanceSheet/attendanceSheet.utils.ts:9-83, 85+), display options (`cellHeight`, `onePersonPerPage`, contact/product/date columns) persisted in `localStorage['ATTENDANCE_LIST_FORMAT']` (attendanceSheet.utils.ts:297-323).
- `haxe-date-picker` (neo module `haxeDatePicker`): rendered by hx form element `CamapDatePicker` (camap-hx/src/form/CamapDatePicker.hx:30-55); writes a hidden `<input name=...>` formatted `YYYY-MM-DD HH:mm:ss` in browser local time (modules/haxe-date-picker/HaxeDatePicker.tsx:21-28,99-103); hx parses with `Date.fromString` (CamapDatePicker.hx:25-28). Empty initial value becomes "now" (HaxeDatePicker.tsx:37-42).

## 3. Business rules

### 3.1 Dates, timezones
1. DB stores Paris wall-clock `datetime`s. hx server runs `TZ=Europe/Paris` (camap-hx/camap-hx.Dockerfile:115), so Haxe `Date` = Paris wall time and no conversion code is needed in hx for DB.
2. TS entities expose `raw_*` columns (wall clock) and getters/setters `zonedTimeToUtc` / `utcToZonedTime` with `Europe/Paris` (multi-distrib.entity.ts:90-142; distribution-cycle.entity.ts:70-135; waiting-list.entity.ts:15-24). GraphQL resolvers re-apply `zonedTimeToUtc(raw_x, TZ_PARIS)` on every date field (multi-distribs.resolver.ts:125-152, distributions.resolver.ts:48-74, distribution-cycles.resolver.ts:52-98, waitingLists.resolver.ts:223-226). `Distribution.orderStartDate` resolver returns `new Date(0)` when invalid (distributions.resolver.ts:66).
3. hx JSON API sends dates through `Formatting.dateToIso`, which appends `+01:00` / `+02:00` using fixed boundaries "29 March 02:00" and "25 October 03:00" every year (camap-hx/common/Formatting.hx:226-255, used by Controller.json -> Formatting.jsonReplacer :256).
4. `tools/DateTool.fromJs/toJs` convert JS-UTC <-> French time with a hardcoded table of DST ranges for 2019..2024 only and throw `out of range` outside (camap-hx/src/tools/DateTool.hx:10-35, 93-139). No call site found in camap-hx/src (grep): dead code.
5. Volunteer calendar REST receives `from/to` as `yyyy-MM-dd 00:00:00` strings parsed by hx as Paris local (VolunteersCalendar.module.tsx:129-135 + Distributions.hx:36).
6. Whole-day lookups: `MultiDistrib.get(date,place)` = same place and `distribStartDate` between 00:00 and 23:59 of the date; used to forbid two MDs same day+place (MultiDistrib.hx:44-49, DistributionService.hx:160-162, 198).

### 3.2 MultiDistrib / Distribution lifecycle
7. Create MD: error if an MD exists same day+place; default general roles (`catalog==null && enabledByDefault`) are written into `volunteerRolesIds`; `checkMultiDistrib` runs AFTER `insert` (so a failing check leaves the row; hx tx behaviour unverified) (DistributionService.hx:157-189). `checkMultiDistrib`: start date required; `distribEndDate` is forced to the same day as start (and `update()`d inside the check, 22-28); order dates both required; `distribStartDate >= orderEndDate`; `orderStartDate <= orderEndDate` (30-40). TS has the same two comparisons in `checkMultiDistrib` (multi-distribs.service.ts:180-202) but no caller.
8. Edit MD (`editMd`): MD uniqueness vs other MDs; updates every child `Distribution` date/end/place; order dates: if `override` or the distribution had no `orderStartDate`, copy MD's; else only copy each of start/end if it equalled the previous MD value (DistributionService.hx:194-245). UI rounds minutes down to multiples of 5 (Distribution.hx:628-636).
9. Delete MD: fires `PreDeleteMultiDistrib`, cancels every participation (`cancelParticipation(d,false)`), deletes MD; failures bubble as error messages (DistributionService.hx:253-266).
10. Participate (catalog joins an MD): error if already participating; variable catalogs need MD order dates; existing subscriptions: CONSTORDERS -> forbidden, others -> warning; per-catalog override `orderStartDaysBeforeDistrib` (days) and `orderEndHoursBeforeDistrib` (hours) recompute that distribution's order window relative to `distribStartDate`, else MD dates are used (DistributionService.hx:271-311). `create` (deprecated) adds the catalog's roles to the MD's role ids and runs `checkDistrib` (103-155).
11. `checkDistrib`: distribution date within catalog start 00:00 .. end 23:59; `date >= orderEndDate`; for variable catalogs `orderStartDate <= orderEndDate` (DistributionService.hx:79-96). Overlap check is commented out (54-77).
12. Cancel participation: for CONSTORDERS or `distribMinOrdersTotal>0` catalogs it fails if any subscription is paid, warns if subscriptions exist; `canDelete`: CONSTORDERS -> no distribution of the catalog already past; others -> total order quantity 0; deletes zero-qty orders, removes the catalog's roles from the MD, clears products excerpt cache, deletes the distribution (DistributionService.hx:560-630). NOTE: volunteers registered on the removed roles are not deleted here (unverified: DB cascade only on role/MD delete).
13. Edit attendance (order window of one distribution): only on non-CONSTORDERS in UI (Distribution.hx:288); `editAttendance` sets orderEnd (and orderStart for variable) then `checkDistrib` (DistributionService.hx:383-404).
14. Shift (`shiftDistribution`): new MD must be within catalog start/end; if the catalog already participates in the target MD, orders are moved onto the existing distribution and `quantities++` (blocked if a subscriber is absent on the target but not on the source, 431-446); else the distribution is moved and takes the target's dates. Volunteers on the catalog's roles in the old MD are deleted, those roles moved from old MD to new MD role list; baskets re-created in the new MD and renumbered; catalog end extended if needed; subscriptions ending before the new date are extended (409-552). Warning texts in Distribution.hx:341-349.

### 3.3 Order window state
15. `MultiDistrib.getState()`: `null` if no MD order dates; before distribution: `notYetOpen` (earliest start incl. exceptions in future), `open` (latest end incl. exceptions in future), else `closed`; after `distribStartDate`: `distributed` (MultiDistrib.hx:260-280). "Including exceptions" = min of start / max of end across MD and its variable-order distributions (159-189). `isActive()` uses inclusive `>=`/`<=` (147-157).
16. `Distribution.canOrderNow()`: if `orderEndDate==null` -> catalog availability, else catalog flag `UsersCanOrder` AND strictly `start < now < end` (Distribution.hx:154-165). TS `ordersAreOpen` also strict, and `false` when end is null (camap-ts/packages/camap-common/src/distributions/distribution.ts:1-7).
17. TS `getOrdersStartDate/EndDate(includingExceptions)` replicate 15 on `raw_*` values (multi-distribs.service.ts:119-178), with unit tests (camap-ts/packages/api-core/src/shop/services/multi-distrib.service.spec.ts:95-140). TS enum `MultiDistribOpenStatus` has OPEN/CLOSED/NOT_YET_OPEN/VALIDATED/DISTRIBUTED (shop/multi-distrib-status.ts:1-7) registered in GraphQL (multi-distribs.resolver.ts:45) but not exposed by any field of `MultiDistrib` type (shop/types/multi-distrib.type.ts).
18. Cron "Distrib notifications" at 4h/24h before distributions use `Distribution.date` (camap-hx/src/controller/Cron.hx:458-468) (outside this area, listed for completeness).

### 3.4 Cycles
19. `createCycle` stores the cycle then immediately generates MDs; no group-level or catalog-level validation (commented out) (DistributionService.hx:752-790). From the MD form, `contractIds` is always `[]` (Distribution.hx:841) so cycle MDs are created without participations.
20. Generation (`createCycleDistribs`, 664-724): end date forced to 23:59; pointer starts at start date 12:00 (avoids DST day shift, 677); max 100 iterations; step +7/+14/+21 days; Monthly = same weekday and same Nth-of-month as the first date (`getWhichNthDayOfMonth`), falls back to N-1 when the month lacks it (695-702, tools/DateTool.hx:83-90); stops when pointer > end date. Each occurrence calls `createMd` which throws on same day+place conflict, aborting the loop mid-way (no per-occurrence catch).
21. Per-occurrence dates (`getDates`, 637-658): start = pointer day + `startHour`; order start = (start - `daysBeforeOrderStart` days) at `openingHour`; order end = (start - `daysBeforeOrderEnd` days) at `closingHour`; both `days*` required (throws). Defaults on the form: 10 days / 08:00 opening, 2 days / 23:55 closing, 19:00-20:00 (Distribution.hx:788-816). Tests of the four frequencies: camap-hx/src/test/TestDistributions.hx:100-221 (monthly case Oct 30 -> Nov 27 -> Dec 25 -> Jan 29 shows the N/N-1 rule).
22. Delete cycle: deletes each MD through `deleteMd` (errors collected as flash messages), then the cycle (DistributionService.hx:730-747). TS FK `MultiDistrib.distributionCycleId` is `ON DELETE SET NULL` (multi-distrib.entity.ts:41-47).
23. Admin page lists cycles with `startDate`/`endDate` inside the timeframe or spanning it (DistributionCycle.hx:43-52).

### 3.5 Volunteer roles and assignments
24. Roles: group-wide ("generic") created by amap admin (`insertRole`, `enabledByDefault` choice; if true, added to all future MDs) (Volunteers.hx:90-115, 117-150); contract roles created by contract admin with `enabledByDefault=true` and added to future MDs where the catalog already has a distribution (ContractAdmin.hx:178-210) or generated N at a time ("Duty period <catalog> i", max 20) (VolunteerService.hx:198-210).
25. Editing a generic role with `enabledByDefault` false calls `updateRoleToFuturesDistribs(role,false)`, which removes the role AND its registered volunteers from all future MDs (Volunteers.hx:170 -> 136-146).
26. Deleting a role: refuses if volunteers exist (message with a "Supprimer quand-même" `force=1` link), otherwise removes it and strips its id from every MD of the group (VolunteerService.hx:14-39). Deleting a catalog deletes its roles (ContractAdmin.hx:1195-1199).
27. MD roles update (`doVolunteerRoles`): shown = generic roles + roles of catalogs participating in the MD, + "(?)" for ids still on the MD but no longer legitimate; saving refuses to uncheck a role that has a volunteer (VolunteerService.hx:176-196; Distribution.hx:873-931). Adding the first vendor to an empty MD adds the default generic roles (Distribution.hx:528-540).
28. Admin assignment (`updateVolunteers`) syncs MD volunteers with a role->user map (ListSynchronizer: create / delete) (VolunteerService.hx:44-80); user choices = all members of the admin's current group (Distribution.hx:948).
29. Member self-registration: hx page with `distrib`+`role` -> `addUserToRole`: only check is "role not already filled"; a user may hold several roles in the same MD (check commented out) (VolunteerService.hx:86-111). Not checked server-side: `canVolunteersJoin`, that the role belongs to the MD, that the user is a group member (unverified elsewhere).
30. `canVolunteersJoin`: now >= `distribStartDate - group.daysBeforeDutyPeriodsOpen` days (MultiDistrib.hx:463-466); default 60 days (db/Group.hx:108); allowed range 7..365 (VolunteerService.hx:218-224).
31. Self-unsubscribe (REST): must be the volunteer; if now is later than `distribStartDate - vacantVolunteerRolesMailDaysBeforeDutyPeriod` days, a mail "A role has been left for <date> distribution" is sent to ALL group members (email + email2) via `mail/volunteerUnsuscribed.mtt`, then the row is deleted (VolunteerService.hx:126-171). Before that date no mail (the scheduled alert covers it).
32. Visibility of roles in calendar: generic roles always; contract roles only until `catalog.endDate + daysAfterClosingBeforeHidingDutyPeriods` days (default 30, range 0..255) (VolunteerService.hx:386-409, Volunteers.hx:62, VolunteerService.hx:239-244, Group.hx:109).
33. Participation counters (`getUserParticipation`) over the group "membership year" (renewal date, default 1 September) (Group.hx:332-345): generic roles to do = ceil(#generic role slots in period / #group members); contract roles to do for a user = sum over contracts where user (or `user2`) has an order in some distribution of the period of ceil(#slots of that contract / #such members); done = Volunteer rows of the user split generic/contract (VolunteerService.hx:260-380). Same figures shown in members' page (`toBeDone`,`done`) (Distribution.hx:1005-1014) and admin table (1025-1060).
34. `hasVacantVolunteerRoles` = `canVolunteersJoin` AND roles count > volunteers count of the MD (MultiDistrib.hx:419-428).
35. Notifications (hx cron hourly, `Cron.doHour`, triggered by Nest `CrontabService` every hour -> HTTP `/cron/hour` camap-ts/packages/api-core/src/tools/crontab.service.ts:29-36):
   - "Volunteers instruction mail": MDs starting in the next hourly slot shifted by `group.volunteersMailDaysBeforeDutyPeriod` days (default 4, allowed 2..15); skip disabled groups; requires flag `AllowInformationNotifs`; only if at least one volunteer; mail to volunteers (email + email2), body = `volunteersMailContent` with `[DATE_DISTRIBUTION]`, `[LIEU_DISTRIBUTION]`, `[LISTE_BENEVOLES]` (camap-hx/src/controller/Cron.hx:96-153; Volunteers.hx:35-38).
   - "Volunteers alerts": same slot logic with `vacantVolunteerRolesMailDaysBeforeDutyPeriod` (default 7, 2..15); requires `AllowAlertNotifs` and `hasVacantVolunteerRoles`; mail to all group members, tokens `[DATE_DISTRIBUTION]`, `[LIEU_DISTRIBUTION]`, `[ROLES_MANQUANTS]` (Cron.hx:156-205; Volunteers.hx:43-46).
   - No TS implementation.

### 3.6 Absences (CSA subscriptions) - Haxe only
36. Management available when catalog is CONSTORDERS or variable with `distribMinOrdersTotal>0`, AND `absentDistribsMaxNb>0` AND start/end dates set (db/Catalog.hx:145-152). Description text rules in AbsencesService.getAbsencesDescription (21-26).
37. Candidate distributions of a catalog: `date >= absencesStartDate`, `end <= absencesEndDate`, `quantities==1` (merged/shifted distributions excluded) (AbsencesService.hx:13-19; per subscription also within subscription dates, Subscription.hx:161-182).
38. Catalog validation (`checkAbsences`): max requires dates; start < end; max <= #distributions in period; if absence period == catalog period, max must be < #distributions; period within catalog dates (service/CatalogService.hx:197-233). Called from contractAdmin absences form after saving (ContractAdmin.hx:1154).
39. `setAbsences`: no duplicate ids; count must equal `subscription.getAbsencesNb()` unless admin mode and the subscription already exists; every id must be in possible absent distribs; stored sorted ascending (AbsencesService.hx:31-60). Number editable only at subscription creation (94-109). Automatic absences = the last N distributions of the period (72-89).
40. `updateAbsencesDates`: past distributions (by `date < now`) cannot be added or removed; CONSTORDERS -> recurrent orders regenerated; variable -> orders on newly absent distributions deleted and default orders re-created on newly present ones (AbsencesService.hx:114-194). REST layer instead uses `orderEndDate` to decide which possible absences are selectable (`orderEndDate > now`) and which are locked (`orderEndDate < now`) (camap-hx/src/controller/api/Catalog.hx:86-90). Non-admin users cannot post an empty list (api/Catalog.hx:102-104); access = contract manager or the subscriber (78-80).
41. Subscription distributions exclude absence ones unless `allIncludingAbsences` (service/SubscriptionService.hx:190-239); distribution count minus absences (245-262).
42. TS: only stores `absentDistribIds` (csa-subscription.entity.ts:35) and displays it in the classic attendance sheet (front-core/src/modules/csaAttendanceSheet/ClassicContractAttendanceModule.tsx:236); editing UI (csaCatalog module) calls hx REST (front-core/src/modules/csaCatalog/requests.tsx:44-50,125-150).

### 3.7 Waiting list
43. Registration (hx): only when group `regOption == WaitingList` and user logged in (Group.hx:89); error if already in the list or already a member (WaitingListService.hx:43-52); inserts row, then mails each user holding `GroupAdmin` or `Membership` right (WaitingListService.hx:10-41).
44. User cancels own request (`removeFromWl`): must be logged and in list (57-69).
45. Move member back (hx `moveBackToWl`): target must be member, not self, not GroupAdmin, not already waiting; deletes UserGroup and creates WaitingList row with message "Remis en liste d'attente par <name>" (WaitingListService.hx:75-93; Member.hx:215-224).
46. TS `moveBackToWaitingList`: collects per-user errors `cannotSetSelfToWaitingList`, `userNotInGroup`, `cannotSetAdminToWaitingLIst`; deletes membership; inserts WaitingList rows (`create` with `raw_date = utcToZonedTime(now)`) (waitingLists.resolver.ts:47-111, services/waitingLists.service.ts:33-45). No "already in waiting list" check (PK collision handled by `save` upsert) and no email.
47. TS `approveRequest`: creates membership (if absent) + deletes WL row + buffered mail to the requester ("acceptée") and one mail to other member-managing admins. `cancelRequest`: deletes WL row, mail to requester ("refusée") and to other admins (waitingLists.resolver.ts:113-221). hx has no approve/refuse UI (grep: only register/cancel/move) -> approval is TS-only (front-core/src/modules/members/components/WaitingListButtons.tsx:39-46).
48. TS front shows waiting list as a member list type `waitingList` (modules/members/containers/MembersTableAndActions.tsx:193-200, WaitingListTable.tsx:52-82).

### 3.8 Attendance sheets / exports
49. hx per-day sheet `listByDate` (all catalogs active in the group, that day+place, orders prepared by user, volunteers of the MD appended) + CSV export columns userId,userName,productName,ref,catalogName,catalogId,vendorId,price,quantity,fees,total,paid (Distribution.hx:195-229). CSV link comes from contractadmin/ordersByDate.mtt:22; radio form has no csv choice.
50. hx per-distribution CSA sheet delegated to TS front modules (classic: by date range of catalog, default catalog start/end; variable: by distribution). Rights: classic = manage all catalogs OR manage catalog OR volunteer of one of the catalog's MDs; variable = login only (attendance-list.resolver.ts:44-69 vs 90-138). Classic requires `catalog.type==0`, variable `==1` (40, 99) matching hx constants (db/Catalog.hx:53-54). Classic: subscriptions overlapping the range (`findByCatalogIdInRange`) + distributions in range; variable: subscriptions derived from the distribution's user orders (112-136).
51. Export: CSV (`data:text/csv` blob, header with group/catalog/coordinator/vendor/instructions/volunteers) and XLSX, generated in the browser from the displayed table (attendanceSheet.utils.ts:9-83, 85-234).

## 4. Flows

**A. Admin creates a cycle**: `/distribution/insertMdCycle` form (hx) -> `DistributionService.createCycle` -> insert cycle -> loop dates -> `createMd` per date (default generic roles) -> flash. Participation of catalogs is then done per MD (`inviteFarmers`) or per catalog (`contractAdmin/distributions` + `participateToAllDistributions`).

**B. Catalog joins an MD**: `participate` -> create Distribution (order window from catalog overrides) -> catalog's contract roles added to MD (`create`:132-138) -> `NewDistrib` event fired.

**C. Volunteer self-registration**: neo `volunteersCalendar` loads `/api/distributions/volunteerRolesCalendar/<from>/<to>` -> user clicks "register" -> browser navigates to hx `/distribution/volunteersCalendar?distrib&role` -> `addUserToRole` -> redirect/flash. Unsubscribe is an XHR POST to `/api/distributions/unsubscribeFromRole/...`; mail to everyone if the vacancy alert date is passed. Reminder mails run from the hourly cron.

**D. Absences**: admin sets period (`contractAdmin/absences`) -> at subscription creation either explicit ids or `absenceNb` (auto last N) -> user later edits ids via `/api/catalog/subscriptionAbsences/:sub` until each distribution's order close -> orders regenerated.

**E. Waiting list**: user -> hx `/group/list/:id` -> admins mailed -> admin in TS members page approves (membership created) or refuses (mail); or admin moves a member back (hx button or TS bulk action).

**F. Attendance sheet**: from orders/selectDistrib pages (hx) -> `/distribution/csaList/:id` -> neo module -> GraphQL attendance query -> print / CSV / XLSX.

## 5. HX <-> TS ownership

| Capability | Owner | Evidence |
|---|---|---|
| Create/edit/delete MD, distribution, cycle, participation, shift | Haxe only | Distribution.hx, DistributionService.hx; no TS mutation (schema.gql:584+) |
| Read MD/distribution/cycle (admin, shop pages) | TS GraphQL (also hx) | resolvers in 2.6 |
| Order window checks | both (hx `canOrderNow`/`getState`, TS `ordersAreOpen`/service helpers) | 3.3 |
| Volunteer roles CRUD and assignments | Haxe only | Volunteers.hx, ContractAdmin.hx, VolunteerService.hx |
| Volunteer calendar | UI TS (neo) / data + register + unsubscribe Haxe | 2.4, 2.7 |
| Volunteer mails (instructions, alerts, unsubscribe) | Haxe | Cron.hx:96-205, VolunteerService.hx:126-171 |
| Volunteers read in GraphQL | TS (`MultiDistrib.volunteers/volunteerRoles`, loader) | multi-distribs.resolver.ts:155-181, groups/loaders/volunteers.loader.ts |
| Absences logic | Haxe only (TS display) | 3.6 |
| Waiting list register / cancel own | Haxe | Group.hx |
| Waiting list list / approve / refuse / move back (bulk) | TS (move back also hx) | waitingLists.resolver.ts, Member.hx:215 |
| Attendance sheets CSA | TS front + GraphQL; per-day print + CSV Haxe | 3.8 |
| Date pickers in hx forms | TS neo module | 2.7 |
| Crons | Haxe, triggered by Nest HTTP | crontab.service.ts |

## 6. Documentation inconsistencies

1. [CONFIRMED] camap-ts/docs/volunteers.md:25 says backend controller is `controller/api/Distribution`; file is `controller/api/Distributions` (camap-hx/src/controller/api/Distributions.hx). Also the doc omits that registration is a hx GET page (Distribution.hx:986-1002) and that unsubscribe is a hx REST POST. (verifier-corrected: the sentence is at volunteers.md:21, not :25; file is controller/api/Distributions.hx, api dir has Catalog/Distributions/Order/Places/Product/Subscription/User only. Distribution.hx:986-1002 GET registration verified.)
2. [CONFIRMED] camap-ts/docs/distributions.md:11 says `MultiDistrib` carries order opening/closing dates and Distribution's may differ - true, but the doc does not mention that TS read/write conversions Paris<->UTC (entities), nor `quantities`, nor `volunteerRolesIds` (documented only in volunteers.md:9-11). (verifier note: Paris/UTC date handling is documented in future.md:24-30, just not in distributions.md; the 'could be removed' remark is at distributions.md:15 and the MultiDistrib sentence at :11/:17.)
3. [CONFIRMED] camap-ts/docs/distributions.md:13 says `Distribution.date/end` duplicates "could be removed"; code still reads them everywhere (e.g. AbsencesService.hx:17, Cron.hx:468, TS `distributions.service.ts:46-64`). (verifier-corrected: the sentence is at distributions.md:15, not :13.)
4. [CONFIRMED] camap-ts/docs/contracts.md:41 titles absences "contrats variables" while code supports CONSTORDERS and variable with `distribMinOrdersTotal>0` (camap-hx/src/db/Catalog.hx:145-152); line 45 names `absencesStartDate` twice (end date is `absencesEndDate`). (contracts.md:41 titles the section 'contrats variables'; Catalog.hx:143-152 hasAbsencesManagement allows constant orders or distribMinOrdersTotal>0; :45 duplicates absencesStartDate.)
5. [CONFIRMED] camap-ts/docs/messages.md:15 describes `WaitingList` as "structured like UserGroup" - it also holds `date` and `message` (WaitingList.hx:11-12). (messages.md:15; WaitingList.hx:11-12 `date`, `message`.)
6. [CONFIRMED] No doc covers: cycles generation rules, waiting-list approval living in TS, attendance sheets, `daysBeforeDutyPeriodsOpen` and mail settings (group fields), volunteer calendar REST contract. (distributions.md mentions DistributionCycle at :19 but not generation rules; others not documented anywhere by grep.)
7. [CONFIRMED] camap-ts/docs/volunteers.md says emails are sent by crons `Volunteers instruction mail` / `Volunteers alerts` - correct (Cron.hx:97,156) but omits the third mail sent on self-unsubscribe (VolunteerService.hx:140-160). (Cron.hx:97,156 task names; VolunteerService.hx:140-160 mail volunteerUnsuscribed, sent only if now > alertDate, i.e. after the scheduled vacant-roles mail was due.)

## 7. Code inconsistencies

1. [CONFIRMED] Dead redirect: `/distribution/validate/:md` is targeted (camap-hx/src/controller/Distribution.hx:1096,1144; camap-hx/lang/master/tpl/distribution/default.mtt:87,131,173,188) but no `doValidate` exists in camap-hx/src. `getState()` never returns `validated` (MultiDistrib.hx:260-280) while default.mtt:~185 branches on it, and default.mtt:~127 hardcodes dates `2021-03-10/11`. TS still carries `VALIDATED`, `MULTI_DISTRIB_IS_ALREADY_VALIDATED`, `NOT_YET_DISTRIBUTED` (shop/multi-distrib-status.ts:5, shop/services/distributions.service.error.ts:4-5). (grep: no `doValidate` anywhere in camap-hx/src; Distribution.hx:1096,1144 and default.mtt:87 `validateUrl`; getStatus() just returns getState(), MultiDistrib.hx:282-284; default.mtt:129 has the hardcoded 2021-03-10/11, :184 the `validated` branch. TS enum values grep-verified.)
2. [CONFIRMED] TS error enum value clash: `DISTRIBUTION_DATE_AFTER_ORDER_END_DATE = 'DISTRIBUTION_DATE_BEFORE_ORDER_END_DATE'` (distributions.service.error.ts:16-17). Enum carries ~17 reasons but TS only emits two (multi-distribs.service.ts:180-202); `MultiDistribsService` imports unused `Cron`, `format`, `fr`... (multi-distribs.service.ts:2-6) and has `Transactional`/`mailsService` unused. (verified: distributions.service.error.ts:16-17 clash; only MULTI_DISTRIB_START_DATE_BEFORE_ORDER_END_DATE and ..._ORDER_START_DATE_AFTER_ORDER_END_DATE are thrown anywhere in api-core/src; 17 enum values; unused imports Cron/format/fr/Transactional/mailsService verified.)
3. [CONFIRMED] Authorization gaps: `attendanceVariableContract` has no rights check (attendance-list.resolver.ts:90-138) vs classic (44-69); `getWaitingListsOfGroup` has no `canManageMembers` while all other waiting-list operations do (waitingLists.resolver.ts:40-45 vs 231-247); `distribution(id)` query has no guard (distributions.resolver.ts:33); `multiDistribution(id)` needs only login (multi-distribs.resolver.ts:62-74). Private helper `checkAndGetMultiDistribAndGroup` is never called and contains unreachable branches (multi-distribs.resolver.ts:187-214). (security-relevant, all four verified: attendance-list.resolver.ts:90-138 has only class-level GqlAuthGuard (:19), so any logged-in user can read subscriptions of any variable catalog; waitingLists.resolver.ts:40-45 no canManageMembers; distributions.resolver.ts:33 `distribution` has no guard at all (no UseGuards in file); multi-distribs.resolver.ts:62-74 login only. Helper checkAndGetMultiDistribAndGroup (:187-214) is never called and its nested `if (!currentUser)` is inside `!currentUser &&`, so the second inner check is unreachable.)
4. [CONFIRMED] hx `Distribution.hx` handlers without explicit rights checks: doInviteFarmers (479), doVolunteerRoles (873), doVolunteers (937), doListByProductUser (78), doDeleteCycle checks section only and no token (858-867). `ContractAdmin.doParticipate` has no `canManageContract` check (ContractAdmin.hx:1001-1011) and `doEditRole`/`doDeleteRole` do not verify the role belongs to the contract/group (ContractAdmin.hx:221-249). All unverified against a global guard. (security-relevant, by reading: doInviteFarmers Distribution.hx:479, doVolunteerRoles :873, doVolunteers :937, doListByProductUser :78 have no rights check in the body; only some sibling handlers call checkHasDistributionSectionAccess (:24). ContractAdmin.doParticipate :1001 no check; doEditRole/doDeleteRole :221-249 do not check the role belongs to a managed catalog. Global sugoi guard not verifiable, hence 'unverified' in original text stands. doDeleteCycle :858 does call checkHasDistributionSectionAccess but no token.)
5. [CONFIRMED] `Distribution.doVolunteersCalendar` dereferences `args.returnUrl` before testing `args != null` (Distribution.hx:991 vs 993). State change on GET (role registration) (993-1002). (Distribution.hx:991 reads args.returnUrl before the :993 null test. Haxe/sugoi may always instantiate args for ?args; unverified.)
6. [CONFIRMED] `Volunteers.doEditRole` forces `role.catalog = null` and is reachable for any role id (Volunteers.hx:166); `updateRoleToFuturesDistribs` does `md.volunteerRolesIds.split` before the future-date guard, NPE if column NULL (Volunteers.hx:121,124); same in ContractAdmin.doInsertRole (ContractAdmin.hx:203). `getActiveMultiDistribs` returns all MDs of the group, not only active (db/Group.hx:198-200). (verifier-corrected: Volunteers.hx is camap-hx/src/controller/amapadmin/Volunteers.hx; doEditRole there sets role.catalog=null, no check the role belongs to the user's group. `md.volunteerRolesIds.split` at :121 precedes the future guard at :124 (NPE if null); ContractAdmin.hx:~203 same; Group.hx:198-200 verified. Whether amapadmin routes are admin-gated is unverified.)
7. [CONFIRMED] `createCycle` message/UX: stub `doInsertCycle`/`doEditCycle`/`doInsert` bodies are fully commented out but routes/exports remain (Distribution.hx:399-413, 418-473, 684-774). (verifier-corrected: only doInsert (:418-473) is entirely commented out including its signature; doEditCycle (:398) and doInsertCycle (:684) remain as routes with commented bodies, i.e. empty stubs.)
8. [CONFIRMED] `isActive()` inclusive vs `canOrderNow()` strict (MultiDistrib.hx:152 vs Distribution.hx:162). `hasVacantVolunteerRoles` compares role count to total Volunteer rows (MultiDistrib.hx:423).
9. [CONFIRMED] Absence lock criterion differs: service uses `distribution.date < now` (AbsencesService.hx:121,131), REST uses `orderEndDate` vs now (api/Catalog.hx:89-90). `isNumberOfDaysValid("vacantRolesMail")` upper-bound message says "instructions mail to all members" (VolunteerService.hx:236).
10. [CONFIRMED] Timezone handling is heterogeneous: TS `getFromTimeRange` mutates its arguments and compares raw column to server-local `setHours` values without Paris conversion (multi-distribs.service.ts:79-85); `getNextMultiDistribInGroup`, `findDistributedByGroup`, `byGroupAndAfterDate` compare `raw_` column with `new Date()` unconverted (multi-distribs.service.ts:50-53,99,109) while `findMultiDistribsByDates` and `findNextDistributionsOfCatalogs` convert with `utcToZonedTime` (multi-distribs.service.ts:62-70, distributions.service.ts:53). Correct only if the API process TZ is Europe/Paris (not configured in repo; tests run `TZ=UTC`, api-core/package.json:27) - unverified at runtime. `CatalogEntity.startDate/endDate/absences*` are plain `Date` without Paris conversion (vendors/entities/catalog.entity.ts:39-42,60-66) unlike all entities above. (code facts verified; runtime effect depends on process TZ, so the 'correct only if' part is PLAUSIBLE. Actual TS line ranges are approx :76-92 for getFromTimeRange and :94-115 for the other finders; test scripts use TZ=UTC at package.json:27,31.)
11. [CONFIRMED] `Formatting.dateToIso` fixed DST boundaries (common/Formatting.hx:230-231) and `DateTool.fromJs/toJs` table limited to 2024 (tools/DateTool.hx:10-35) are both approximations; the latter is unused. (Formatting.hx:229-231 hardcodes 29 Mar / 25 Oct; DateTool.hx:10-35 table covers 2019-2024; fromJs/toJs (:93,118) have no callers outside DateTool.hx in camap-hx/src.)
12. [CONFIRMED] `MultiDistrib.getFromTimeRange` upper bound is `<` while `to` is set to 23:59 (MultiDistrib.hx:55-57) vs TS `Between` inclusive (multi-distribs.service.ts:85). hx comment says "sort by date desc" but sorts ascending (MultiDistrib.hx:59-62).
13. [CONFIRMED] `moveBackToWaitingList` (TS) removes elements with `splice` while iterating with `forEach`, which can skip entries/misalign `userGroups` and `users` (waitingLists.resolver.ts:78-83); the error keys differ from hx messages; typo key `cannotSetAdminToWaitingLIst` (92). (forEach+splice on userGroups/users at waitingLists.resolver.ts:~76-83 verified; note the later admin loop iterates backwards and is fine.)
14. [PLAUSIBLE: effect of the typo depends on Haxe resolving `attributes` to an inherited field vs compile] `form.CamapDatePicker` constructor parameter typo `attibutes` passes undefined `attributes` to super (camap-hx/src/form/CamapDatePicker.hx:12,18) (unverified effect). (typo `?attibutes` and `attributes` in super call verified at CamapDatePicker.hx:15,18.)
15. [CONFIRMED] `Distribution.getKey/makeKey` use `date` and `place` (deprecated columns) (db/Distribution.hx:206-212) while `populate()` sets `place=null` (197).
16. [CONFIRMED] Nest crontab daily job `EVERY_DAY_AT_MIDNIGHT` vs comment/crontab `15 0 * * *` (tools/crontab.service.ts:11 vs 43) (outside area; noted). (crontab.service.ts:43 EVERY_DAY_AT_MIDNIGHT vs comment :11 `15 0 * * *`.)


## Verification summary

Confirmed: 22. Refuted: 0. Plausible: 1 (C14). Security-relevant confirmed: C3 (missing rights checks), C4 (missing rights checks).
