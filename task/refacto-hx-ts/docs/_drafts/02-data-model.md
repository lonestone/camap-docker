# 02 - Data model and schema ownership (draft)

All paths relative to the camap-docker root. "hx" = `camap-hx/src/db/*.hx` (sys.db SPOD objects), "ts" = TypeORM entities under `camap-ts/packages/api-core/src`. Statements not backed by a line reference are marked "unverified".

## 1. Overview

- One MySQL database (`db-camap`) is shared by both apps. Haxe reads/writes it through `sys.db.Object` classes (22 files in `camap-hx/src/db/`), NestJS through 28 TypeORM `*.entity.ts` files (`camap-ts/packages/api-core/src/**/`). `camap-hx/config.xml.dist:10` holds the Haxe connection string `mysql://root:root@mysql/db-camap`; `camap-ts/.env.sample:15-23` the TypeORM one (`DB_CONNECTION=mysql`, `DB_DATABASE=db-camap`).
- Almost every table is described twice (hx + ts). The repo's own doc states this: `camap-ts/docs/future.md:30-32` ("quasiment toutes les entités ... à la fois en TS, à la fois en Haxe").
- Table names equal the Haxe class names (PascalCase, singular, e.g. `Group`, `User`). TS forces this with `CamapNamingStrategy.getTableName` (`camap-ts/orm-naming-strategy.js:4-9`) and `@Entity('<Name>')` on every entity.
- Primary/foreign column names are the same on both sides (`groupId`, `userId`, ...). FK constraint names follow `<Table>_<column without "Id">` (`camap-ts/orm-naming-strategy.js:57`) with hard-coded legacy exceptions (`Group_contact`, `Group_mainPlace`, `Group_legalRepresentative`, `Catalog_contact`, `Error_user`, `Session_user`, `WaitingList_group`, `WConfig_contract`) at `orm-naming-strategy.js:19-52`. `WConfig` has no hx class and no ts entity in the repo (legacy table, unverified whether it still exists in a DB).
- Haxe never stores Haxe-serialized blobs in its own `db.*` tables: every "structured" column is JSON text (see section 5). The only serialized blobs are in sugoi's `Session` table.
- Timezone: both containers run with `TZ=Europe/Paris` (`camap-hx/camap-hx.Dockerfile:115`, `camap-ts/camap-ts.Dockerfile:54`, `mysql.Dockerfile:11`); DATETIME columns hold Paris wall-clock time (see section 5.3).

## 2. Table inventory

Legend: hx = defined in `camap-hx/src/db` ; sugoi = defined in the sugoi library (pinned at `camap-hx/backend/haxe_libraries/sugoi.hxml:1`, read from the local lix cache `~/haxe/haxe_libraries/sugoi/1.0.0/github/c3b8db8.../src/sugoi/db/`, outside the repo) ; ts = `*.entity.ts`.

| Table | hx class | ts entity | Side(s) | Notes |
|---|---|---|---|---|
| Basket | `db.Basket` (`Basket.hx:18`) | `BasketEntity` (`shop/entities/basket.entity.ts:26`) | both | status enum differs (sec. 7) |
| BufferedJsonMail | `db.BufferedJsonMail` (`BufferedJsonMail.hx:10`) | `BufferedJsonMailEntity` (`mails/models/buffered-json-mail.entity.ts:5`) | both | JSON text columns |
| Catalog | `db.Catalog` (`Catalog.hx:18`) | `CatalogEntity` (`vendors/entities/catalog.entity.ts:31` area) | both | ts flag enum partial |
| Distribution | `db.Distribution` (`Distribution.hx:11`) | `DistributionEntity` (`shop/entities/distribution.entity.ts:26`) | both | |
| DistributionCycle | `db.DistributionCycle` (`DistributionCycle.hx:17`) | `DistributionCycleEntity` (`shop/entities/distribution-cycle.entity.ts:26`) | both | |
| Group | `db.Group` (`Group.hx:43`) | `GroupEntity` (`groups/entities/group.entity.ts:38`) | both | flags enum diverges |
| Membership | `db.Membership` (`Membership.hx:6`) | `MembershipEntity` (`groups/entities/membership.entity.ts:11`) | both | composite PK (userId,groupId,year) |
| Message | `db.Message` (`Message.hx:12`) | `MessageEntity` (`entities/message.entity.ts:16`) | both | |
| MultiDistrib | `db.MultiDistrib` (`MultiDistrib.hx:17`) | `MultiDistribEntity` (`shop/entities/multi-distrib.entity.ts:25`) | both | |
| NotificationMail | `db.NotificationMail` (`NotificationMail.hx:6`) | `NotificationMailEntity` (`mails/models/notification-mail.entity.ts:19`) | both | table created by ts migration `1773912252829-EmailDigests.ts:7` |
| Operation | `db.Operation` (`Operation.hx:29`) | `OperationEntity` (`payments/entities/operation.entity.ts:44`) | both | |
| Place | `db.Place` (`Place.hx:7`) | `PlaceEntity` (`places/models/place.entity.ts:18`) | both | |
| Product | `db.Product` (`Product.hx:12`) | `ProductEntity` (`vendors/entities/product.entity.ts:19`) | both | |
| ProductDistributionStock | `db.ProductDistributionStock` (`ProductDistributionStock.hx:11`) | `ProductDistributionStockEntity` (`vendors/entities/productDistributionStock.entity.ts:9`) | both | created by ts migration (typo name, later renamed) |
| Subscription | `db.Subscription` (`Subscription.hx:8`) | `CsaSubscriptionEntity` (`groups/entities/csa-subscription.entity.ts:21`) | both | class name differs, table same |
| User | `db.User` (`User.hx:21`) | `UserEntity` (`users/models/user.entity.ts:21`) | both | |
| UserGroup | `db.UserGroup` (`UserGroup.hx:20`) | `UserGroupEntity` (`groups/entities/user-group.entity.ts:7`) | both | composite PK (userId,groupId) |
| UserOrder | `db.UserOrder` (`UserOrder.hx:9`) | `UserOrderEntity` (`shop/entities/user-order.entity.ts:22`) | both | |
| Vendor | `db.Vendor` (`Vendor.hx:17`) | `VendorEntity` (`vendors/entities/vendor.entity.ts:25`) | both | |
| Volunteer | `db.Volunteer` (`Volunteer.hx:7`) | `VolunteerEntity` (`groups/entities/volunteer.entity.ts:9`) | both | PK (userId,multiDistribId,volunteerRoleId) |
| VolunteerRole | `db.VolunteerRole` (`VolunteerRole.hx:5`) | `VolunteerRoleEntity` (`groups/entities/volunteer-role.entity.ts:17`) | both | |
| WaitingList | `db.WaitingList` (`WaitingList.hx:7`) | `WaitingListEntity` (`entities/waiting-list.entity.ts:8`) | both | PK (userId,amapId) |
| Cache | `sugoi.db.Cache` (`sugoi/db/Cache.hx:8`) | `CacheEntity` (`tools/models/cache.entity.ts:4`) | sugoi + ts | |
| EntityFile | `sugoi.db.EntityFile` (`EntityFile.hx:9`) | `EntityFileEntity` (`tools/models/entity-file.entity.ts:6`) | sugoi + ts | |
| Error | `sugoi.db.Error` (`Error.hx:5`) | `ErrorEntity` (`tools/models/error.entity.ts:7`) | sugoi + ts | |
| File | `sugoi.db.File` (`File.hx:9`) | `FileEntity` (`tools/models/file.entity.ts:13`) | sugoi + ts | binary file data stored in DB (`mediumblob`) |
| Permalink | `sugoi.db.Permalink` (`Permalink.hx:9`) | `PermalinkEntity` (`tools/models/permalink.entity.ts:4`) | sugoi + ts | |
| Session | `sugoi.db.Session` (`Session.hx:9`) | `SessionEntity` (`tools/models/session.entity.ts:8`) | sugoi + ts | serialized blobs (sec. 5.2) |
| Variable | `sugoi.db.Variable` (`Variable.hx:5`) | `VariableEntity` (`tools/models/variable.entity.ts:4`) | sugoi + ts | |
| BufferedMail | `sugoi.db.BufferedMail` (`BufferedMail.hx:10`) | none | sugoi only | `SData` columns; superseded by BufferedJsonMail (inference, not verified) |
| WConfig | none | none | unknown | only referenced in `orm-naming-strategy.js:27-34` |

Every `db.*` class has a ts entity (22/22) and every ts entity has an hx or sugoi counterpart (29 `*.entity.ts` files = 22 domain + 7 sugoi mirrors; sugoi `BufferedMail` has no ts mirror). No table is ts-only. `camap-hx/src/test/TestSuite.hx:61-63` still lists `db.Category`, `db.CategoryGroup`, `db.ProductCategory`, which no longer exist in `camap-hx/src/db` (stale test setup).

## 3. Per-entity detail

Type mapping used below (sys.db / record-macros conventions; the library source is not in the repo so exact SQL types are "unverified" except where a ts entity or migration confirms them): `SId`=int auto-inc PK; `SInt`=int; `STinyInt`=tinyint; `SFloat`=double; `SBool`=tinyint(1); `SString<N>`=varchar(N); `SText`=mediumtext; `SSmallText`=text; `STinyText`=tinytext; `SDateTime`=datetime; `SDate`=date; `SEnum<E>`=tinyint (ordinal); `SFlags<E>`=int bitfield (bit i = enum ordinal i); `SNull<T>`=nullable. ts side confirms several (e.g. `vendor.entity.ts:127` `disabled` tinyint for `SEnum`; `catalog.entity.ts` `flags` int; `product.entity.ts:26` double for `SFloat`).

Every relation below is `@:relation(<col>)` in hx and `@ManyToOne` + `@JoinColumn` in ts with `onDelete`/`onUpdate` (ts only; Haxe has no cascade declarations: unverified whether the live DB carries the FK rules, the ts side declares them and migrations add them, e.g. `1719475818737-add-catalog-first-distrib.ts:7`).

### Basket (`Basket.hx:18-29`, `basket.entity.ts:25-71`)
Fields: id, cdate datetime, num int (basket number within a multidistrib), total double ("not reliable", `Basket.hx:24`), status, data mediumtext (JSON `TmpBasketData`, `Basket.hx:201-211`), userId (nullable FK User), multiDistribId (FK MultiDistrib). Indexes (ts) `Basket_userId`, `Basket_multiDistribId`. hx status enum `BasketStatus` = OPEN, CONFIRMED, VALIDATED (`Basket.hx:7-12`); ts adds PAYMENT_PROCESSING (`basket.entity.ts:15-21`). hx helpers: `get/getOrCreate` with in-memory `CACHE` (`Basket.hx:31`), next `num` via `select max(num)` (`Basket.hx:55,196`), payment/operation queries, total computation (`Basket.hx:105-232`).

### BufferedJsonMail (`BufferedJsonMail.hx:9-28`, `buffered-json-mail.entity.ts:3-120`)
id, title varchar(256), htmlBody/textBody mediumtext null, headers/sender/recipients/attachments mediumtext null (JSON), mailerType varchar(32), tries int, cdate, sdate null, rawStatus null. Index (sdate,cdate). hx helper: `send()` picks a mailer by `mailerType` (`BufferedJsonMail.hx:81-100`). ts exposes JSON through `raw_*` columns plus getters/setters (`buffered-json-mail.entity.ts:38-120`).

### Catalog (`Catalog.hx:8-51`, `catalog.entity.ts`)
Fields: id, name(64), type int (0 CSA constant, 1 variable: `Catalog.hx:53-54`), userId (contact, null), vendorId, groupId, firstDistribId (null FK MultiDistrib), startDate, endDate (hx null; ts `endDate: Date` non-null), description, distributorNum tinyint, flags, percentageValue/percentageName (null), orderStartDaysBeforeDistrib/orderEndHoursBeforeDistrib (null), distribMinOrdersTotal, catalogMinOrdersTotal, absentDistribsMaxNb, absencesStartDate/EndDate (null). Index (startDate,endDate). hx flags `CatalogFlags` (ordinal): UsersCanOrder 0, StockManagement 1, PercentageOnOrders 2, DisplayPricesOnGroupPage 3, NotifyVendorOnOrderEnd 4, NotifyContactOnOrderEnd 5 (`Catalog.hx:8-15`). hx helpers (domain logic covered elsewhere): `isUserOrderAvailable`, `hasActiveDistribs`, `getProducts`, `getDistribs`, `getOrders`... (`Catalog.hx:76-395`).

### Distribution (`Distribution.hx:10-29`, `distribution.entity.ts:17-138`)
id, catalogId, multiDistribId, placeId, date (null), end (null), orderStartDate, orderEndDate, quantities int default 1 (added by migration `1720184612071-add-distrib-quantities.ts:7`). Index (date, orderStartDate, orderEndDate). hx `DISTRIBUTION_VALIDATION_LIMIT = 10` (`Distribution.hx:31`).

### DistributionCycle (`DistributionCycle.hx:7-30`, `distribution-cycle.entity.ts:16-135`)
id, groupId, placeId, cycleType (enum Weekly 0, Monthly 1, BiWeekly 2, TriWeekly 3), startDate, endDate, startHour, endHour, openingHour, closingHour (all datetime), daysBeforeOrderStart/End tinyint null.

### Group (`Group.hx:9-94`, `group.entity.ts:33-203`)
id, name(64), userId (contact, null), txtIntro/txtHome/txtDistrib (null), extUrl(64), membershipRenewalDate (date, null), membershipFee tinyint null, vatRates (text JSON, `Group.hx:422-427`), flags int, hasMembership bool, imageId (null FK File), cdate, placeId (null, "mainPlace"), regOption (enum Closed 0, WaitingList 1, Open 2, Full 3: `Group.hx:26-31`, ts `groups/types/interfaces.ts:13-18`), currency varchar(12), currencyCode varchar(3), legalReprId (null FK User), allowedPaymentsType (text JSON array of payment ids, `Group.hx:451-456`), checkOrder(64), IBAN(40), allowMoneyPotWithNegativeBalance bool null, daysAfterClosingBeforeHidingDutyPeriods tinyint unsigned (default 30 added by migration `1719302680137`), volunteersMailDaysBeforeDutyPeriod, volunteersMailContent, vacantVolunteerRolesMailDaysBeforeDutyPeriod, daysBeforeDutyPeriodsOpen, alertMailContent, disabled (null; values BLOCKED_BY_ADMIN / MOVED / SUSPENDED: `Group.hx:33-38`, `group.entity.ts:27-31`; real column is a MySQL ENUM since migration `1741445966001-group-disabled.ts:7`).
hx `GroupFlags` ordinals: `__HasMembership` 0, `__ShopMode` 1, `__HasPayments` 2, `__ComputeMargin` 3, `__CamapNetwork` 4, `__CustomizedCategories` 5, HidePhone 6, PhoneRequired 7, AddressRequired 8, `__UnUsed` 9, `__Show3rdCategoryLevel` 10, AllowInformationNotifs 11, AllowAlertNotifs 12 (`Group.hx:9-24`). Helpers (brief): membership-year computation from `membershipRenewalDate` (`Group.hx:304-338`), main place guess (`Group.hx:136-161`), `getMembers`, `getVendors`, `getVatRates`.

### Membership (`Membership.hx:5-15`, `membership.entity.ts:10-70`)
PK (userId, groupId, year); distributionId (null FK MultiDistrib), operationId (null FK Operation), amount double, date (date, null). `year` is the earliest year of the membership period (`Membership.hx:14`).

### Message (`Message.hx:12-29`, `message.entity.ts:16-113`)
id, recipientListId varchar(12) null, title(128), body mediumtext, date, recipients mediumtext null, slateContent mediumtext (non-null), amapId (null FK Group), senderId (null FK User), attachments mediumtext null (JSON; ts accepts several legacy shapes, `message.entity.ts:65-90`).

### MultiDistrib (`MultiDistrib.hx:16-33`, `multi-distrib.entity.ts:24-143`)
id, distribStartDate, distribEndDate, orderStartDate, orderEndDate, groupId, placeId, distributionCycleId (null), volunteerRolesIds (comma separated ids; hx `String`, `MultiDistrib.hx:30,404`; ts `simple-array`, `multi-distrib.entity.ts:29`). Index on distribStartDate. hx has `@:skip` runtime fields (`contracts`, `extraHtml`, caches: `MultiDistrib.hx:32-33,194-195,410`). Many helpers (volunteer roles, orders, validation); domain logic covered by other drafts.

### NotificationMail (`NotificationMail.hx:6-20`, `notification-mail.entity.ts:10-82`)
id, cdate, htmlBody, textBody, digest int (1 hourly, 2 daily, 11 coordinator hourly, 12 coordinator daily: `NotificationMail.hx:7-10`, `notification-mail.entity.ts:10-15`), subject varchar(256) (used as dedup key "SUBSCRIPTION(id)" etc., `notification-mail.entity.ts:34-41`), groupId, recipientId, attachments (JSON text). Migration-created DDL has no FK constraints and no indexes (`1773912252829-EmailDigests.ts:7`).

### Operation (`Operation.hx:5-47`, `operation.entity.ts:43-149`)
id, name(128), amount, date, type (enum ordinal: VOrder 0 (ts `Order`), SubscriptionTotal 1, Payment 2, Membership 3: `Operation.hx:5-10`, `payments/OperationType.ts:1-6`), relationId (null, self FK), userId, groupId, pending bool, basketId (null), subscriptionId (null), data varchar(256) (JSON, `Operation.hx:47-58`; shape depends on type: `PaymentInfos {type, remoteOpId?}`, `{basketId}`, `{subscriptionId}`, `{year}`: `Operation.hx:12-25`, `operation.entity.ts:18-30`).

### Place (`Place.hx:6-22`, `place.entity.ts:15-70`)
id, name(64), address1/2 null, zipCode(32), city(64), country null, lat/lng double null, groupId. Index (lat,lng).

### Product (`Product.hx:12-39`, `product.entity.ts:16-112`)
id, name(128), ref(32) null, catalogId, price, vat, desc null, qt null, unitType (enum `Unit`: Piece 0, Kilogram 1, Gram 2, Litre 3, Centilitre 4, Millilitre 5: `camap-hx/common/Common.hx:90-97`, `camap-ts/packages/camap-common/src/products/interfaces.ts:1-8`), stockTracking (enum Disabled/Global/PerDistribution), stockTrackingPerDistrib (AlwaysTheSame/FrequencyBased/PerPeriod), stock null, organic, variablePrice, multiWeight, bulk, imageId null, active. hx helpers: `getDistribStock`/available stock using ProductDistributionStock (`Product.hx:84-180`).

### ProductDistributionStock (`ProductDistributionStock.hx:11-18`, `productDistributionStock.entity.ts:5-62`)
id, stockPerDistribution, frequencyRatio (1 = every distribution), productId, startDistributionId, endDistributionId (FKs with ON DELETE CASCADE). One row = one period for PerPeriod / FrequencyBased rules.

### Subscription (`Subscription.hx:8-17`, `csa-subscription.entity.ts:17-90`)
id, userId, userId2 (null), catalogId, startDate, endDate, defaultOrders (JSON text `[{productId, quantity}]`, `Subscription.hx:83-113`), absentDistribIds (comma separated ids, `Subscription.hx:139`). hx helpers: total price, balance from Payment operations (`Subscription.hx:35-73`).

### User (`User.hx:7-55`, `user.entity.ts:18-126`)
id, lang(2), pass tinytext (MD5 legacy), pass2 tinytext (bcrypt), rights int (bitfield; hx `RightSite{Admin}`, ts `RightSite{SuperAdmin}`, both bit 0), firstName/lastName(32), email(64, unique index `User_email`), phone(19) null, firstName2/lastName2/email2/phone2 null (index `User_email2`), address1/2, zipCode(32), city(25), birthDate (date) null, nationality(2), countryOfResidence(2), cdate, ldate null, flags int (UserFlags: HasEmailNotif4h 0, HasEmailNotif24h 1, HasEmailNotifOuverture 2: `User.hx:7-11`, `users/models/user-flags.ts:1-5`), apiKey(128) null, currentRefreshToken(255) null. Constructor defaults: lang "fr", flags with HasEmailNotif24h set (`User.hx:58-67`).

### UserGroup (`UserGroup.hx:19-26`, `user-group.entity.ts:5-27`)
PK (userId, groupId); rights text null (JSON array `[{right, params[]}]`, `JsonRights` `UserGroup.hx:17`), balance double. hx `Right` enum: GroupAdmin, ContractAdmin(?cid), Membership, Messages (`UserGroup.hx:7-12`) serialized by name/params in JSON (`UserGroup.hx:60,108,147`). Helpers: `get/getOrCreate` with CACHE (`UserGroup.hx:26-46`), right granting/checking.

### UserOrder (`UserOrder.hx:9-41`, `user-order.entity.ts:21-112`)
id, userId, userId2 (null), quantity, productId, productPrice, feesRate, paid bool, distributionId, basketId, subscriptionId (null), date, flags int (`OrderFlags{InvertSharedOrder}` bit 0: `Common.hx:227-229`).

### Vendor (`Vendor.hx:8-56`, `vendor.entity.ts:23-165`)
id, name(128), userId (null FK User, added by migration `1760631262459-producteur.ts:7`), peopleName, profession/production2/production3 int null, email(128), showEmail, phone(19), showPhone, address1/2, zipCode(32), city(25), country(64), companyNumber(64), desc, cdate null, linkText/linkUrl(256), directory bool, longDesc, imageId null, disabled (tinyint null; `DisabledReason` IncompleteLegalInfos 0, NotCompliantWithPolicy 1, Banned 2: `Vendor.hx:8-12`, `vendor.entity.ts:15-19,127-165`), lat/lng null.

### Volunteer / VolunteerRole (`Volunteer.hx:6-11`, `VolunteerRole.hx:5-11`)
Volunteer: PK (userId, multiDistribId, volunteerRoleId). VolunteerRole: id, name(64), enabledByDefault bool (default 1 via migration `1716900422752-role-group-enabled-by-default.ts:7`), groupId, catalogId (null).

### WaitingList (`WaitingList.hx:6-12`, `waiting-list.entity.ts:7-39`)
PK (userId, amapId), date, message mediumtext. hx relation name `group` on column `amapId`; ts `amap`.

### sugoi tables (hx source in sugoi library, ts in `tools/models`)
Cache(name PK, value, expire, cdate), EntityFile(id, fileId, entityType, documentType, data, entityId), Error(id, date, error, uid, ip, userAgent, url), File(id, name tinytext, cdate, data binary), Permalink(link PK, entityType, entityId), Session(sid PK, ip, lang, messages, lastTime, createTime, sdata, uid), Variable(name PK, value). The ts side mirrors them 1:1 (see `tools/models/*.entity.ts`) and TS code references them in `tools/tools.module.ts`, `tools/permalink.service.ts`, `vendors/resolvers/*.ts`.

## 4. Schema management

### 4.1 Haxe side
- No Haxe code creates or migrates the production schema. `sys.db.TableCreate` is only used by the test harness (`camap-hx/src/test/TestSuite.hx:95-99`), which drops/recreates a `tests` database (`TestSuite.hx:55`).
- `/install` (`camap-hx/src/controller/Main.hx:218-219` -> `camap-hx/src/controller/Install.hx:18-100`) does NOT create tables. It refuses to run if `db.User` already has rows (`Install.hx:20`, which itself needs the `User` table to exist) and then inserts demo data: admin user `admin@camap.tld`/`admin`, a Group, UserGroup rights, a Place, Vendor, Catalog and two Products.
- `/db` (`Main.hx:302-306`, `@admin`) mounts `sys.db.admin.Admin.handler()`, the record-macros web DB admin tool (a manual schema editing UI). `camap-ts/docs/schema.md:9` forbids using it for changes.
- `/admin` is a different super-admin back-office (`Main.hx:334-336`); `/scripts` is the CLI maintenance entry (`Main.hx:341`).

### 4.2 TypeORM side
- Connection config: `camap-ts/ormconfig.js:28-39` (`entities` from `DB_ENTITIES`, `charset: utf8mb4`, `namingStrategy: CamapNamingStrategy`). `synchronize` is commented out (`ormconfig.js:34`); `DB_SYNCHRONIZE` in `.env.sample:21` / `.env.test:22` is therefore not read by ormconfig (it is not referenced there).
- Nest boots with `TypeOrmModule.forRoot()` (`camap-ts/packages/api-core/src/app.module.ts:42`), i.e. reads `ormconfig` from the working directory (`packages/api-core/ormconfig.js`, which spreads the root config and adds `migrations: dist/migrations/*.js`, `migrationsTransactionMode: 'each'`: `packages/api-core/ormconfig.js:4-11`).
- Migrations: `camap-ts/packages/api-core/src/migrations/` (12 files, 2024-05-23 to 2026-03; list: stocksRework, update-group-flag-value, role-group-enabled-by-default, fix-typo, daysAfterClosingBeforeHidingDutyPeriods, add-catalog-first-distrib, add-distrib-quantities, addCompanyNumber, group-disabled, producteur, vendorShowPhone, EmailDigests). They only contain incremental changes: there is no baseline/initial migration (the first one already ALTERs `Product`, `1716452582359-stocksRework.ts:8`). Production start runs them: `packages/api-core/package.json:25` `start:prod = typeorm migration:run && node dist/main`.
- Sync paths that exist: root `npm run schema:sync` (`camap-ts/package.json:30`) and api-core `dbsync` (`packages/api-core/package.json:35`) -> `typeorm schema:sync`; `src/cli/sync-db.ts:5-16` (`synchronize: true` on dist entities; not wired in any package.json script that I found: unverified); `cli/dataset.ts:11` and test helper `test/utils.ts:59` call `connection.synchronize(true)` (drop-and-recreate the whole schema from entities).
- Dev DB bootstrap (as documented): run `npm run schema:sync`, then visit `/install` (`camap-ts/docs/troubleshooting.md:23`). So in dev, tables come from the TS entities; hx only seeds data. For existing DBs, the pre-2024 schema came from Haxe (the TS migration names/FK names in `orm-naming-strategy.js:19-52` reproduce legacy constraint names) - inference, no baseline in repo.
- MySQL: image `mysql:8.0.36` with `camap-ts/mysql/my.cnf` copied in (`mysql.Dockerfile:1,11`). `sql-mode` deliberately omits `STRICT_TRANS_TABLES` because of record-macros (`my.cnf:4-5`), server charset utf8mb4 / `utf8mb4_unicode_ci` (`my.cnf:8-10`). `camap-ts/mysql/init-test-db.sql:1` creates a `test` DB for ts tests (`.env.test:20`).
- Workflow documentation: `camap-ts/docs/schema.md` (migration generate/show/run; every DB change must be a migration, `schema.md:9`).

### 4.3 Who changes what, in practice
- ts-created objects: table `ProductDistributionStock` (initially misspelled `ProductDistibutionStock`, renamed by `1717668928327-fix-typo.ts:7`), table `NotificationMail`, columns `Product.stockTracking`/`stockTrackingPerDistrib`, `Group.daysAfterClosingBeforeHidingDutyPeriods`, `Catalog.firstDistribId`, `Distribution.quantities`, `Vendor.companyNumber`/`userId`/`showPhone`/`showEmail`, `VolunteerRole.enabledByDefault`. All of them are also declared in hx (`ProductDistributionStock.hx`, `NotificationMail.hx`, `Product.hx:28-29`, `Group.hx:87`, `Catalog.hx:29`, `Distribution.hx:29`, `Vendor.hx:21,31,33,40`, `VolunteerRole.hx:9`), so the Haxe class must be kept in sync by hand.
- Data migrations inside schema migrations: `1716557457926-update-group-flag-value.ts:7` adds `CONV('01100000000000',2,10)` (= 6144 = bits 11 and 12, `AllowInformationNotifs` + `AllowAlertNotifs`) to every Group's `flags` with `+`, not bitwise OR; `1716452582359-stocksRework.ts:12` sets `Product.stockTracking = 2` where `stock IS NOT NULL`.

## 5. Haxe-specific encodings and TS handling

### 5.1 SFlags bitfields (`Group.flags`, `Catalog.flags`, `User.flags`, `User.rights`, `UserOrder.flags`)
- Stored as one `int`; bit `i` = ordinal `i` of the Haxe enum (`User.hx:62-63` initialises with `SFlags.ofInt(0)`).
- TS reads them with `hasFlag(enumIndex, value)` = `(value & (1 << i)) !== 0`, `setFlag`, `unsetFlag` in `camap-ts/packages/api-core/src/common/haxeCompat.ts:5-30` (limit 32 flags). The ts flag enums are hand-copied numeric enums and are incomplete or renamed (sec. 7): `groups/types/interfaces.ts:1-11`, `users/models/user-flags.ts:1-5`, `vendors/entities/catalog.entity.ts:20-24`, duplicated in `vendors/services/catalogs.service.ts:14-18`, `RightSite` in `users/models/user.entity.ts:14-16`. Group flags are consumed in `groups/services/groups.service.ts:43-56`, user flags in `users/user.utils.ts:6-14`.
- Enum columns (`SEnum`) are stored as the 0-based ordinal (tinyint): `Operation.type`, `DistributionCycle.cycleType`, `Group.regOption`, `Product.unitType/stockTracking/stockTrackingPerDistrib`, `Vendor.disabled`, none for Subscription. ts maps them with numeric enums (`OperationType.ts:1-6`, `distribution-cycle.entity.ts:16-21`, `groups/types/interfaces.ts:13-18`, `camap-common/src/products/interfaces.ts`). Exceptions stored as strings: `Basket.status` (`Basket.hx:25` comment "Mysql enum"), `Group.disabled`.

### 5.2 Serialized / JSON columns
- All `db.*` structured columns are JSON text produced by `haxe.Json.stringify` (grep of `camap-hx/src/db`: `Basket.hx:211`, `BufferedJsonMail.hx:31-37`, `Group.hx:422,451`, `NotificationMail.hx:31`, `Operation.hx:50`, `UserGroup.hx:108,147`, `Subscription.hx:83`). No `haxe.Serializer`/`SData` in `camap-hx/src/db`.
- Comma-separated lists (no JSON): `MultiDistrib.volunteerRolesIds` (`MultiDistrib.hx:404`, ts `simple-array`), `Subscription.absentDistribIds` (`Subscription.hx:139`, ts keeps raw string `csa-subscription.entity.ts:34-35`).
- TS access patterns: `simple-json` columns (`Group.vatRates`, `Group.allowedPaymentsType`, `UserGroup.rights`: `group.entity.ts:63,199`, `user-group.entity.ts:14`); `raw_*` columns with JSON getters/setters (`Operation.data` `operation.entity.ts:148-172`, `BufferedJsonMail.headers/sender/recipients/attachments`, `NotificationMail.attachments`, `Message.attachments`); plain strings left to callers (`Basket.data`, `Subscription.defaultOrders/absentDistribIds`).
- Real Haxe-serialized blobs exist only in sugoi `Session`: `sdata` is `SNekoSerialized` under neko (`sugoi/db/Session.hx:19-21`) and `messages` is `SData<Array<{error,text}>>` (`Session.hx:14`). ts declares both as `mediumblob` `Buffer` and does not decode them (`tools/models/session.entity.ts:29-36`). `File.data` is a binary blob (`tools/models/file.entity.ts:20-21`). sugoi `BufferedMail` uses `SData` (not mirrored in ts).
- hx constructors set defaults in code (e.g. `User.hx:58-67`, `Distribution.quantities = 1` at `Distribution.hx:29`); TS defaults come from column `default` (e.g. `Group.daysAfterClosingBeforeHidingDutyPeriods` default 30, `VolunteerRole.enabledByDefault`).

### 5.3 Dates and timezone
- Haxe: `SDateTime` -> MySQL `datetime` written/read in the Neko process local time, which is `Europe/Paris` (`camap-hx/camap-hx.Dockerfile:115`). `future.md:26` confirms: "dates stockées ... par le code Haxe sont donc des dates Françaises".
- TS: `ormconfig.js` sets no `timezone` option (so the mysql driver default applies: unverified, believed to be local time); the container runs `TZ=Europe/Paris` (`camap-ts.Dockerfile:54`) while tests run `TZ=UTC` (`packages/api-core/package.json:27,31`).
- Four entities convert Paris wall-clock <-> UTC in getters/setters with `date-fns-tz` (`zonedTimeToUtc(raw, 'Europe/Paris')` on read, `utcToZonedTime` on write; `TZ_PARIS` = `common/constants.ts:1`): `DistributionCycle` (6 date fields, `distribution-cycle.entity.ts:70-135`), `Distribution` (`date,end,orderStartDate,orderEndDate`, `distribution.entity.ts:79-130`), `MultiDistrib` (4 fields, `multi-distrib.entity.ts:96-143`), `WaitingList.date` (`waiting-list.entity.ts:15-24`). Raw columns are exposed as `raw_<name>` and indexes reference the raw name (`multi-distrib.entity.ts:23`, `distribution.entity.ts:20-24`).
- All other datetime columns (Basket.cdate, Catalog.startDate/endDate/absences*, Operation.date, UserOrder.date, Subscription.startDate/endDate, Message.date, Group.cdate, User.cdate/ldate, Vendor.cdate, BufferedJsonMail.cdate/sdate, Session/Cache/Error dates) are mapped as plain `Date` with no conversion.
- `NotificationMail.cdate` is the only column using `@CreateDateColumn()` (DDL `datetime(6) DEFAULT CURRENT_TIMESTAMP(6)`: `1773912252829-EmailDigests.ts:7`), i.e. the DB server clock (MySQL container `TZ=Europe/Paris`, `mysql.Dockerfile:11`) rather than app code; hx declares it plain `SDateTime` (`NotificationMail.hx:13`) and sets nothing in `createNotification` (`NotificationMail.hx:22-34`).
- `date` columns (no time): `Group.membershipRenewalDate` (ts type `string`, `group.entity.ts:54-55`), `Membership.date`, `User.birthDate` (ts type `Date`).
- Charset: ormconfig uses utf8mb4 (`ormconfig.js:36-37`), MySQL server utf8mb4 (`my.cnf:9-10`).

## 6. Documentation inconsistencies

1. [CONFIRMED] `README.md:96` says a first visit to `/install` "initialise la bdd". Code: `/install` only seeds demo rows and requires existing tables (`camap-hx/src/controller/Install.hx:20,25-100`); `camap-ts/docs/troubleshooting.md:23` instead says run `npm run schema:sync` first.
2. [CONFIRMED] `camap-ts/docs/troubleshooting.md:18` says not to create the DB yourself and let camap-hx create it; all compose files create `db-camap` through the mysql image (`docker-compose.dev.yml:58`, `docker-compose.easy.yml:45`, `docker-compose.prod.yml:53`), and no Haxe code creates a database outside tests (`TestSuite.hx:55`).
3. [CONFIRMED] `camap-ts/docs/future.md:28` says camap-ts "fonctionne avec des dates UTC"; entities actually store Paris wall-clock datetimes and convert in getters (`distribution.entity.ts:82-90`, `multi-distrib.entity.ts:99-106`), and the other datetime columns are untouched.
4. [CONFIRMED] `camap-ts/docs/future.md:43` says the DB uses latin1_swedish_ci with UTF-8 strings; repo config is utf8mb4 on both sides (`camap-ts/mysql/my.cnf:8-10`, `camap-ts/ormconfig.js:36-37`). Whether existing production DBs are still latin1 is unverified.
5. [PLAUSIBLE: which side creates the DB / clean schema:log needs a live DB; docs/schema.md:5-9 text verified] `camap-ts/docs/schema.md:5-9` says every DB change must go through a TypeORM migration and that `typeorm schema:log` should show no diff; but there is no baseline migration, dev DBs are built by `schema:sync` (`troubleshooting.md:23`), and the entities differ from hx declarations (sec. 7), so a clean `schema:log` depends on which side created the DB (unverified).
6. [CONFIRMED] `camap-ts/docs/schema.md:25,38-39` uses `npm run typeorm ...` while the archived copy `camap-ts/docs/archives/api-core/schema.md` uses bare `typeorm ...`; the archive is otherwise identical text (cosmetic).
7. [CONFIRMED] `camap-ts/docs/dataset.md` (`--clean`, "supprimer toutes les données") vs `cli/dataset.ts:9-13` which calls `connection.synchronize(true)` = drops and recreates the whole schema (not just data).
8. [PLAUSIBLE: .env.sample/.env.test not readable in this session; ormconfig.js:34 comment verified (camap-ts/ormconfig.js); DB_SYNCHRONIZE only in docs/conf.md:64 and commented in api-core/src/envSchema.ts:19] `.env.sample:21` / `.env.test:22` define `DB_SYNCHRONIZE=false` but `ormconfig.js:34` does not read it (commented out).
9. [PLAUSIBLE: 22/22 count and the "7 sugoi tables" not recounted] `camap-ts/docs/future.md:30-32` claims "quasiment toutes les entités" are duplicated; verified: 22/22 hx `db.*` classes are duplicated (accurate, but docs do not mention the 7 sugoi tables or `BufferedMail`).

## 7. Code inconsistencies (hx vs ts)

Schema-level (field/type/nullability/relation):
1. [CONFIRMED] `Vendor.companyNumber`: hx `SNull<SString<64>>` (`Vendor.hx:40`), ts nullable (`vendor.entity.ts:101-102`), but migration creates it `varchar(64) NOT NULL` (`1721184612071-addCompanyNumber.ts:7`).
2. [CONFIRMED] `Catalog.endDate`: hx `SNull<SDateTime>` (`Catalog.hx:30`), ts `datetime` non-null `endDate: Date` (`catalog.entity.ts:41-42`).
3. [CONFIRMED] `Basket.status`: hx `SString<32>` varchar with "Mysql enum" comment (`Basket.hx:25`), values OPEN/CONFIRMED/VALIDATED (`Basket.hx:7-12`); ts `enum` column with extra `PAYMENT_PROCESSING` (`basket.entity.ts:15-21,39-40`). hx never sees PAYMENT_PROCESSING (only in ts: grep over `camap-hx/src` and `api-core/src`).
4. [CONFIRMED] `Group.disabled`: hx `SNull<SString<32>>` (`Group.hx:94`), ts/migration real MySQL ENUM (`group.entity.ts:202-203`, `1741445966001-group-disabled.ts:7`).
5. [CONFIRMED] `Product.stockTracking` / `stockTrackingPerDistrib`: hx non-null `SEnum` (`Product.hx:28-29`), ts and migration nullable `tinyint unsigned` (`product.entity.ts:41-45`, `1716452582359-stocksRework.ts:8-9`).
6. [CONFIRMED] `ProductDistributionStock.stockPerDistribution`: hx plain `Float` (`ProductDistributionStock.hx:13`, double by sys.db convention) vs ts/migration `float unsigned DEFAULT 0` (`productDistributionStock.entity.ts:13-14`, `1716452582359-stocksRework.ts:7`); `frequencyRatio` hx `Int` vs ts `tinyint unsigned default 1`.
7. [CONFIRMED] `NotificationMail`: hx all non-null (`htmlBody`, `textBody`, `attachments` SText: `NotificationMail.hx:14,15,20`); ts and DDL nullable (`notification-mail.entity.ts:26-30,54`, migration `...EmailDigests.ts:7`). `attachments` content: hx stores `Array<String>` JSON (`NotificationMail.hx:22-31`), ts getter types it as array of `{filename,contentType,content,encoding,cid?}` objects (`notification-mail.entity.ts:56-72`). hx declares relations `group`/`recipient` (`NotificationMail.hx:18-19`); ts declares only `@JoinColumn` without `@ManyToOne` (`notification-mail.entity.ts:45-52`) and the DDL has no FK/indexes.
8. [CONFIRMED] `UserGroup.rights`: hx `SNull<SSmallText>` (`UserGroup.hx:24`), ts column nullable but property typed non-nullable array (`user-group.entity.ts:14-15`).
9. [PLAUSIBLE: rename list partially checked (Group.hx/WaitingList.hx lines not all opened)] Property/relation renames with same columns: hx `Group.contact`/`mainPlace`/`legalRepresentative`/`image` vs ts `user`/`place`/`legalRepr`/`image`; hx `WaitingList.group` (column `amapId`) vs ts `amap`; hx `Message.amap`; `Subscription`->`CsaSubscriptionEntity`; hx `Operation.relation` etc. (`Group.hx:50,71,78`, `group.entity.ts:126-164`; `WaitingList.hx:9`, `waiting-list.entity.ts:29-34`).
10. [CONFIRMED] ts relations typed as `Promise<...>` (lazy) in some entities and eager objects in others (e.g. `OperationEntity.group: GroupEntity` `operation.entity.ts:79` vs `BasketEntity.user: Promise` `basket.entity.ts:65`): mixed style (ts internal). (verifier-corrected: operation.entity.ts is payments/entities/operation.entity.ts:79; basket.entity.ts:65 verified)

Enum / flag / semantic:
11. [CONFIRMED] `GroupFlags`: ts keeps only indices 0, 3-10, renamed without `__` prefix, and omits `__ShopMode` 1, `__HasPayments` 2, `AllowInformationNotifs` 11, `AllowAlertNotifs` 12 (`groups/types/interfaces.ts:1-11` vs `Group.hx:9-24`). (verifier-corrected: only __HasMembership keeps the `__` prefix in ts; others renamed (interfaces.ts:1-11))
12. [CONFIRMED] `CatalogFlags`: ts defines 3 of 6 values (UsersCanOrder, StockManagement, PercentageOnOrders), omitting DisplayPricesOnGroupPage, NotifyVendorOnOrderEnd, NotifyContactOnOrderEnd (`catalog.entity.ts:20-24`, `catalogs.service.ts:14-18` vs `Catalog.hx:8-15`); the enum is defined twice in ts.
13. [CONFIRMED] `RightSite`: hx `Admin` (`User.hx:16-18`) vs ts `SuperAdmin` (`user.entity.ts:14-16`), both bit 0.
14. [CONFIRMED] `OperationType`: hx `VOrder` vs ts `Order` for value 0 (`Operation.hx:5-10`, `payments/OperationType.ts:2`).
15. [CONFIRMED] `StockTracking` is defined twice in ts: numeric in camap-common (used by `ProductEntity`, `product.entity.ts:16 import`; hx ordinals) and string-valued in `vendors/product.interface.ts:4-10` (used by `vendors/types/product.type.ts:2` and `products.resolver.ts:19,143-151`); DB stores tinyint ordinal. The resolver returns `StockTracking.Disabled` (string) or the raw DB value, so GraphQL output depends on how the enum is serialised (unverified). (verifier-corrected: enums at camap-common/src/products/interfaces.ts:13 and api-core/src/vendors/product.interface.ts:4; GraphQL serialization not checked)
16. [CONFIRMED] `catalogs.service.ts:221` calls `setFlag(catalog.flags, CatalogFlags.UsersCanOrder)` with arguments reversed relative to `setFlag(enumIndex, flagValue)` (`haxeCompat.ts:19`) and discards the result, so the flag is not set there (the correct form is used at `catalogs.service.ts:161`). (verifier-corrected: setFlag is common/haxeCompat.ts:18; call at vendors/services/catalogs.service.ts:~221, correct form :161. Latent bug.)
17. [CONFIRMED] `Distribution.quantities`: declared on both, hx via `Int = 1` initialiser, ts column default 1; data in prod gets default via migration (`1720184612071`). (verifier-corrected: migration 1720184612071-add-distrib-quantities.ts exists)
18. [CONFIRMED] Date handling asymmetry: 4 entities convert Paris/UTC, other datetime columns do not (sec. 5.3); `Group.membershipRenewalDate` is `string` in ts vs `SDate` in hx; `User.birthDate` is `Date` in ts for a `date` column.
19. [PLAUSIBLE: runtime null vs empty-string handling not checked; types verified] hx `MultiDistrib.volunteerRolesIds` is a nullable plain `String` (`MultiDistrib.hx:30`), ts `simple-array` giving `number[]` (`multi-distrib.entity.ts:29-30`); empty-string vs null handling is not aligned (unverified).
20. [CONFIRMED] Stale Haxe test setup lists removed tables (`TestSuite.hx:61-63`) and its table list (`TestSuite.hx:59-91`) omits `ProductDistributionStock`, `NotificationMail`, `Membership`, `WaitingList`, `Message`, `BufferedJsonMail` (grep of `TestSuite.hx` finds none of them). (verifier-corrected: Category/CategoryGroup/ProductCategory classes do not exist in camap-hx/src/db; list is TestSuite.hx:~57-80)


## Verification summary

Confirmed: 24, Refuted: 0, Plausible: 5 (sections 6 and 7). Entity paths in the cited lines are under camap-ts/packages/api-core/src/<module>/entities/ (e.g. vendors/entities/, shop/entities/).
