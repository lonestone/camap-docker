# 02 - Data model and schema ownership

Scope: the shared MySQL database used by camap-hx (Haxe `sys.db.Object` classes) and camap-ts (TypeORM entities): table inventory with ownership, per-entity detail, flags and enums, structured/serialized column encodings, timezone handling, schema management, and the `Variable` key inventory. Citation convention in this file: a bare `Name.hx:line` is `camap-hx/src/db/Name.hx`; `*.entity.ts` files are under `camap-ts/packages/api-core/src/<module>/` as given in the inventory table (section 2). "unverified" marks statements not provable from the repo.

Sources: drafts 02, 11 (section 4, Variable keys).

See inconsistencies-code.md / inconsistencies-documentation.md for hx-vs-ts divergences and doc errors in this area.

## 1. Overview

- One MySQL database (`db-camap`) is shared by both apps. Haxe reads/writes it through `sys.db.Object` classes (22 files in `camap-hx/src/db/`), NestJS through TypeORM `*.entity.ts` files (`camap-ts/packages/api-core/src/**/`).
- Count disagreement between drafts: draft 02 says 28 entity files in the overview and 29 in section 2/ownership; draft 10 counts 29 `@Entity(` classes in `api-core/src`. This file uses 29 (22 domain + 7 sugoi mirrors).
- Almost every table is described twice (hx + ts). The repo's own doc states this: `camap-ts/docs/future.md:30-32`.
- Table names equal the Haxe class names (PascalCase, singular, e.g. `Group`, `User`). TS forces this with `CamapNamingStrategy.getTableName` (`camap-ts/orm-naming-strategy.js:4-9`) and `@Entity('<Name>')` on every entity.
- Primary/foreign column names are the same on both sides (`groupId`, `userId`, ...). FK constraint names follow `<Table>_<column without "Id">` (`camap-ts/orm-naming-strategy.js:57`) with hard-coded legacy exceptions (`Group_contact`, `Group_mainPlace`, `Group_legalRepresentative`, `Catalog_contact`, `Error_user`, `Session_user`, `WaitingList_group`, `WConfig_contract`) at `camap-ts/orm-naming-strategy.js:19-52`. `WConfig` has no hx class and no ts entity in the repo (legacy table; whether it still exists in a DB is unverified).
- Haxe `db.*` tables store structured columns as JSON text (section 5). The only Haxe-serialized blobs are in sugoi's `Session` table (and sugoi `BufferedMail`).
- Timezone: both containers run with `TZ=Europe/Paris` (`camap-hx/camap-hx.Dockerfile:115`, `camap-ts/camap-ts.Dockerfile:54`, `mysql.Dockerfile:11`); DATETIME columns hold Paris wall-clock time (section 5.3).

## 2. Table inventory with ownership

Legend: hx = defined in `camap-hx/src/db`; sugoi = defined in the sugoi library (pinned at `camap-hx/backend/haxe_libraries/sugoi.hxml:1`, read from the local lix cache `~/haxe/haxe_libraries/sugoi/1.0.0/github/c3b8db8.../src/sugoi/db/`, outside the repo); ts = `*.entity.ts` under `camap-ts/packages/api-core/src/`.

| Table | hx class | ts entity | Side(s) | Notes |
|---|---|---|---|---|
| Basket | `db.Basket` (`camap-hx/src/db/Basket.hx:18`) | `BasketEntity` (`camap-ts/packages/api-core/src/shop/entities/basket.entity.ts:26`) | both | status enum differs |
| BufferedJsonMail | `db.BufferedJsonMail` (`camap-hx/src/db/BufferedJsonMail.hx:10`) | `BufferedJsonMailEntity` (`camap-ts/packages/api-core/src/mails/models/buffered-json-mail.entity.ts:5`) | both | JSON text columns |
| Catalog | `db.Catalog` (`camap-hx/src/db/Catalog.hx:18`) | `CatalogEntity` (`camap-ts/packages/api-core/src/vendors/entities/catalog.entity.ts:31` area) | both | ts flag enum partial |
| Distribution | `db.Distribution` (`camap-hx/src/db/Distribution.hx:11`) | `DistributionEntity` (`camap-ts/packages/api-core/src/shop/entities/distribution.entity.ts:26`) | both | |
| DistributionCycle | `db.DistributionCycle` (`camap-hx/src/db/DistributionCycle.hx:17`) | `DistributionCycleEntity` (`camap-ts/packages/api-core/src/shop/entities/distribution-cycle.entity.ts:26`) | both | |
| Group | `db.Group` (`camap-hx/src/db/Group.hx:43`) | `GroupEntity` (`camap-ts/packages/api-core/src/groups/entities/group.entity.ts:38`) | both | flags enum diverges |
| Membership | `db.Membership` (`camap-hx/src/db/Membership.hx:6`) | `MembershipEntity` (`camap-ts/packages/api-core/src/groups/entities/membership.entity.ts:11`) | both | composite PK (userId,groupId,year) |
| Message | `db.Message` (`camap-hx/src/db/Message.hx:12`) | `MessageEntity` (`camap-ts/packages/api-core/src/entities/message.entity.ts:16`) | both | |
| MultiDistrib | `db.MultiDistrib` (`camap-hx/src/db/MultiDistrib.hx:17`) | `MultiDistribEntity` (`camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts:25`) | both | |
| NotificationMail | `db.NotificationMail` (`camap-hx/src/db/NotificationMail.hx:6`) | `NotificationMailEntity` (`camap-ts/packages/api-core/src/mails/models/notification-mail.entity.ts:19`) | both | table created by ts migration `camap-ts/packages/api-core/src/migrations/1773912252829-EmailDigests.ts:7` |
| Operation | `db.Operation` (`camap-hx/src/db/Operation.hx:29`) | `OperationEntity` (`camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:44`) | both | |
| Place | `db.Place` (`camap-hx/src/db/Place.hx:7`) | `PlaceEntity` (`camap-ts/packages/api-core/src/places/models/place.entity.ts:18`) | both | |
| Product | `db.Product` (`camap-hx/src/db/Product.hx:12`) | `ProductEntity` (`camap-ts/packages/api-core/src/vendors/entities/product.entity.ts:19`) | both | |
| ProductDistributionStock | `db.ProductDistributionStock` (`camap-hx/src/db/ProductDistributionStock.hx:11`) | `ProductDistributionStockEntity` (`camap-ts/packages/api-core/src/vendors/entities/productDistributionStock.entity.ts:9`) | both | created by ts migration (misspelled name, later renamed) |
| Subscription | `db.Subscription` (`camap-hx/src/db/Subscription.hx:8`) | `CsaSubscriptionEntity` (`camap-ts/packages/api-core/src/groups/entities/csa-subscription.entity.ts:21`) | both | class name differs, table same |
| User | `db.User` (`camap-hx/src/db/User.hx:21`) | `UserEntity` (`camap-ts/packages/api-core/src/users/models/user.entity.ts:21`) | both | |
| UserGroup | `db.UserGroup` (`camap-hx/src/db/UserGroup.hx:20`) | `UserGroupEntity` (`camap-ts/packages/api-core/src/groups/entities/user-group.entity.ts:7`) | both | composite PK (userId,groupId) |
| UserOrder | `db.UserOrder` (`camap-hx/src/db/UserOrder.hx:9`) | `UserOrderEntity` (`camap-ts/packages/api-core/src/shop/entities/user-order.entity.ts:22`) | both | |
| Vendor | `db.Vendor` (`camap-hx/src/db/Vendor.hx:17`) | `VendorEntity` (`camap-ts/packages/api-core/src/vendors/entities/vendor.entity.ts:25`) | both | |
| Volunteer | `db.Volunteer` (`camap-hx/src/db/Volunteer.hx:7`) | `VolunteerEntity` (`camap-ts/packages/api-core/src/groups/entities/volunteer.entity.ts:9`) | both | PK (userId,multiDistribId,volunteerRoleId) |
| VolunteerRole | `db.VolunteerRole` (`camap-hx/src/db/VolunteerRole.hx:5`) | `VolunteerRoleEntity` (`camap-ts/packages/api-core/src/groups/entities/volunteer-role.entity.ts:17`) | both | |
| WaitingList | `db.WaitingList` (`camap-hx/src/db/WaitingList.hx:7`) | `WaitingListEntity` (`camap-ts/packages/api-core/src/entities/waiting-list.entity.ts:8`) | both | PK (userId,amapId) |
| Cache | `sugoi.db.Cache` (sugoi `db/Cache.hx:8`) | `CacheEntity` (`camap-ts/packages/api-core/src/tools/models/cache.entity.ts:4`) | sugoi + ts | |
| EntityFile | `sugoi.db.EntityFile` (sugoi `db/EntityFile.hx:9`) | `EntityFileEntity` (`camap-ts/packages/api-core/src/tools/models/entity-file.entity.ts:6`) | sugoi + ts | |
| Error | `sugoi.db.Error` (sugoi `db/Error.hx:5`) | `ErrorEntity` (`camap-ts/packages/api-core/src/tools/models/error.entity.ts:7`) | sugoi + ts | |
| File | `sugoi.db.File` (sugoi `db/File.hx:9`) | `FileEntity` (`camap-ts/packages/api-core/src/tools/models/file.entity.ts:13`) | sugoi + ts | binary file data stored in DB (`mediumblob`) |
| Permalink | `sugoi.db.Permalink` (sugoi `db/Permalink.hx:9`) | `PermalinkEntity` (`camap-ts/packages/api-core/src/tools/models/permalink.entity.ts:4`) | sugoi + ts | |
| Session | `sugoi.db.Session` (sugoi `db/Session.hx:9`) | `SessionEntity` (`camap-ts/packages/api-core/src/tools/models/session.entity.ts:8`) | sugoi + ts | serialized blobs (section 5.2) |
| Variable | `sugoi.db.Variable` (sugoi `db/Variable.hx:5`) | `VariableEntity` (`camap-ts/packages/api-core/src/tools/models/variable.entity.ts:4`) | sugoi + ts | key/value, see section 7 |
| BufferedMail | `sugoi.db.BufferedMail` (sugoi `db/BufferedMail.hx:10`) | none | sugoi only | `SData` columns; probably superseded by BufferedJsonMail (inference) |
| WConfig | none | none | unknown | only referenced in `camap-ts/orm-naming-strategy.js:27-34` |

Every `db.*` class has a ts entity (22/22) and every ts entity has an hx or sugoi counterpart (22 domain + 7 sugoi mirrors; sugoi `BufferedMail` has no ts mirror). No table is ts-only. `camap-hx/src/test/TestSuite.hx:61-63` still lists `db.Category`, `db.CategoryGroup`, `db.ProductCategory`, which no longer exist in `camap-hx/src/db`.

Table-level writers (from the integration side): Nest writes Session, User, UserGroup, Membership, WaitingList, Group, CsaSubscription, UserOrder, Basket, Operation, Vendor, Catalog, Product, Distribution, MultiDistrib, DistributionCycle, Message, BufferedJsonMail, Cache, Variable, File, EntityFile; hx writes the same families and is the sole creator of `Session` rows. See `05-cross-stack-integration.md` section 5.

## 3. Per-entity detail

Type mapping (sys.db / record-macros conventions; the library source is not in the repo so exact SQL types are unverified except where a ts entity or migration confirms them): `SId`=int auto-inc PK; `SInt`=int; `STinyInt`=tinyint; `SFloat`=double; `SBool`=tinyint(1); `SString<N>`=varchar(N); `SText`=mediumtext; `SSmallText`=text; `STinyText`=tinytext; `SDateTime`=datetime; `SDate`=date; `SEnum<E>`=tinyint (ordinal); `SFlags<E>`=int bitfield (bit i = enum ordinal i); `SNull<T>`=nullable. The ts side confirms several (`vendor.entity.ts:127` `disabled` tinyint for `SEnum`; `catalog.entity.ts` `flags` int; `product.entity.ts:26` double for `SFloat`).

Every relation is `@:relation(<col>)` in hx and `@ManyToOne` + `@JoinColumn` in ts with `onDelete`/`onUpdate` (ts only; Haxe has no cascade declarations; whether the live DB carries the FK rules is unverified; migrations add some, e.g. `camap-ts/packages/api-core/src/migrations/1719475818737-add-catalog-first-distrib.ts:7`).

### Basket (`Basket.hx:18-29`, `basket.entity.ts:25-71`)
Fields: id, cdate datetime, num int (basket number within a multidistrib), total double ("not reliable", `Basket.hx:24`), status, data mediumtext (JSON `TmpBasketData`, `Basket.hx:201-211`), userId (nullable FK User), multiDistribId (FK MultiDistrib). Indexes (ts) `Basket_userId`, `Basket_multiDistribId`. hx status enum `BasketStatus` = OPEN, CONFIRMED, VALIDATED (`Basket.hx:7-12`); ts adds PAYMENT_PROCESSING (`basket.entity.ts:15-21`). hx helpers: `get/getOrCreate` with in-memory `CACHE` (`Basket.hx:31`), next `num` via `select max(num)` (`Basket.hx:55,196`), payment/operation queries, total computation (`Basket.hx:105-232`).

### BufferedJsonMail (`BufferedJsonMail.hx:9-28`, `buffered-json-mail.entity.ts:3-120`)
id, title varchar(256), htmlBody/textBody mediumtext null, headers/sender/recipients/attachments mediumtext null (JSON), mailerType varchar(32), tries int, cdate, sdate null, rawStatus null. Index (sdate,cdate). hx helper: `send()` picks a mailer by `mailerType` (`BufferedJsonMail.hx:81-100`). ts exposes JSON through `raw_*` columns plus getters/setters (`buffered-json-mail.entity.ts:38-120`).

### Catalog (`Catalog.hx:8-51`, `catalog.entity.ts`)
Fields: id, name(64), type int (0 CSA constant, 1 variable: `Catalog.hx:53-54`), userId (contact, null), vendorId, groupId, firstDistribId (null FK MultiDistrib), startDate, endDate (hx null; ts `endDate: Date` non-null), description, distributorNum tinyint, flags, percentageValue/percentageName (null), orderStartDaysBeforeDistrib/orderEndHoursBeforeDistrib (null), distribMinOrdersTotal, catalogMinOrdersTotal, absentDistribsMaxNb, absencesStartDate/EndDate (null). Index (startDate,endDate). hx flags `CatalogFlags` (ordinal): UsersCanOrder 0, StockManagement 1, PercentageOnOrders 2, DisplayPricesOnGroupPage 3, NotifyVendorOnOrderEnd 4, NotifyContactOnOrderEnd 5 (`Catalog.hx:8-15`). hx helpers: `isUserOrderAvailable`, `hasActiveDistribs`, `getProducts`, `getDistribs`, `getOrders` (`Catalog.hx:76-395`).

### Distribution (`Distribution.hx:10-29`, `distribution.entity.ts:17-138`)
id, catalogId, multiDistribId, placeId, date (null), end (null), orderStartDate, orderEndDate, quantities int default 1 (added by migration `1720184612071-add-distrib-quantities.ts:7`). Index (date, orderStartDate, orderEndDate). hx `DISTRIBUTION_VALIDATION_LIMIT = 10` (`Distribution.hx:31`).

### DistributionCycle (`DistributionCycle.hx:7-30`, `distribution-cycle.entity.ts:16-135`)
id, groupId, placeId, cycleType (enum Weekly 0, Monthly 1, BiWeekly 2, TriWeekly 3), startDate, endDate, startHour, endHour, openingHour, closingHour (all datetime), daysBeforeOrderStart/End tinyint null.

### Group (`Group.hx:9-94`, `group.entity.ts:33-203`)
id, name(64), userId (contact, null), txtIntro/txtHome/txtDistrib (null), extUrl(64), membershipRenewalDate (date, null), membershipFee tinyint null, vatRates (text JSON, `Group.hx:422-427`), flags int, hasMembership bool, imageId (null FK File), cdate, placeId (null, "mainPlace"), regOption (enum Closed 0, WaitingList 1, Open 2, Full 3: `Group.hx:26-31`, ts `groups/types/interfaces.ts:13-18`), currency varchar(12), currencyCode varchar(3), legalReprId (null FK User), allowedPaymentsType (text JSON array of payment ids, `Group.hx:451-456`), checkOrder(64), IBAN(40), allowMoneyPotWithNegativeBalance bool null, daysAfterClosingBeforeHidingDutyPeriods tinyint unsigned (default 30 added by migration `1719302680137`), volunteersMailDaysBeforeDutyPeriod, volunteersMailContent, vacantVolunteerRolesMailDaysBeforeDutyPeriod, daysBeforeDutyPeriodsOpen, alertMailContent, disabled (null; values BLOCKED_BY_ADMIN / MOVED / SUSPENDED: `Group.hx:33-38`, `group.entity.ts:27-31`; real column is a MySQL ENUM since migration `1741445966001-group-disabled.ts:7`).
hx `GroupFlags` ordinals: `__HasMembership` 0, `__ShopMode` 1, `__HasPayments` 2, `__ComputeMargin` 3, `__CamapNetwork` 4, `__CustomizedCategories` 5, HidePhone 6, PhoneRequired 7, AddressRequired 8, `__UnUsed` 9, `__Show3rdCategoryLevel` 10, AllowInformationNotifs 11, AllowAlertNotifs 12 (`Group.hx:9-24`). Helpers: membership-year computation from `membershipRenewalDate` (`Group.hx:304-338`), main place guess (`Group.hx:136-161`), `getMembers`, `getVendors`, `getVatRates`.

### Membership (`Membership.hx:5-15`, `membership.entity.ts:10-70`)
PK (userId, groupId, year); distributionId (null FK MultiDistrib), operationId (null FK Operation), amount double, date (date, null). `year` is the earliest year of the membership period (`Membership.hx:14`).

### Message (`Message.hx:12-29`, `message.entity.ts:16-113`)
id, recipientListId varchar(12) null, title(128), body mediumtext, date, recipients mediumtext null, slateContent mediumtext (non-null), amapId (null FK Group), senderId (null FK User), attachments mediumtext null (JSON; ts accepts several legacy shapes, `message.entity.ts:65-90`).

### MultiDistrib (`MultiDistrib.hx:16-33`, `multi-distrib.entity.ts:24-143`)
id, distribStartDate, distribEndDate, orderStartDate, orderEndDate, groupId, placeId, distributionCycleId (null), volunteerRolesIds (comma separated ids; hx `String`, `MultiDistrib.hx:30,404`; ts `simple-array`, `multi-distrib.entity.ts:29`). Index on distribStartDate. hx has `@:skip` runtime fields (`contracts`, `extraHtml`, caches: `MultiDistrib.hx:32-33,194-195,410`).

### NotificationMail (`NotificationMail.hx:6-20`, `notification-mail.entity.ts:10-82`)
id, cdate, htmlBody, textBody, digest int (1 hourly, 2 daily, 11 coordinator hourly, 12 coordinator daily: `NotificationMail.hx:7-10`, `notification-mail.entity.ts:10-15`), subject varchar(256) (dedup key "SUBSCRIPTION(id)" etc., `notification-mail.entity.ts:34-41`), groupId, recipientId, attachments (JSON text). hx declares all text columns non-null (`NotificationMail.hx:14,15,20`) and relations `group`/`recipient` (`:18-19`); ts and DDL are nullable (`notification-mail.entity.ts:26-30,54`) and ts declares only `@JoinColumn` without `@ManyToOne` (`:45-52`). The migration-created DDL has no FK constraints and no indexes (`1773912252829-EmailDigests.ts:7`).

### Operation (`Operation.hx:5-47`, `operation.entity.ts:43-149`)
id, name(128), amount, date, type (enum ordinal: VOrder 0 (ts `Order`), SubscriptionTotal 1, Payment 2, Membership 3: `Operation.hx:5-10`, `camap-ts/packages/api-core/src/payments/OperationType.ts:1-6`), relationId (null, self FK), userId, groupId, pending bool, basketId (null), subscriptionId (null), data varchar(256) (JSON, `Operation.hx:47-58`; shape depends on type: `PaymentInfos {type, remoteOpId?}`, `{basketId}`, `{subscriptionId}`, `{year}`: `Operation.hx:12-25`, `operation.entity.ts:18-30`).

### Place (`Place.hx:6-22`, `place.entity.ts:15-70`)
id, name(64), address1/2 null, zipCode(32), city(64), country null, lat/lng double null, groupId. Index (lat,lng).

### Product (`Product.hx:12-39`, `product.entity.ts:16-112`)
id, name(128), ref(32) null, catalogId, price, vat, desc null, qt null, unitType (enum `Unit`: Piece 0, Kilogram 1, Gram 2, Litre 3, Centilitre 4, Millilitre 5: `camap-hx/common/Common.hx:90-97`, `camap-ts/packages/camap-common/src/products/interfaces.ts:1-8`), stockTracking (enum Disabled/Global/PerDistribution), stockTrackingPerDistrib (AlwaysTheSame/FrequencyBased/PerPeriod), stock null, organic, variablePrice, multiWeight, bulk, imageId null, active. hx helpers: `getDistribStock`/available stock using ProductDistributionStock (`Product.hx:84-180`).

### ProductDistributionStock (`ProductDistributionStock.hx:11-18`, `productDistributionStock.entity.ts:5-62`)
id, stockPerDistribution, frequencyRatio (1 = every distribution), productId, startDistributionId, endDistributionId (FKs with ON DELETE CASCADE). One row = one period for PerPeriod / FrequencyBased rules. hx declares `stockPerDistribution` as plain `Float` and `frequencyRatio` as `Int` (`ProductDistributionStock.hx:13`); the ts/migration columns are `float unsigned DEFAULT 0` and `tinyint unsigned default 1` (`productDistributionStock.entity.ts:13-14`, `1716452582359-stocksRework.ts:7`).

### Subscription (`Subscription.hx:8-17`, `csa-subscription.entity.ts:17-90`)
id, userId, userId2 (null), catalogId, startDate, endDate, defaultOrders (JSON text `[{productId, quantity}]`, `Subscription.hx:83-113`), absentDistribIds (comma separated ids, `Subscription.hx:139`). hx helpers: total price, balance from Payment operations (`Subscription.hx:35-73`).

### User (`User.hx:7-55`, `user.entity.ts:18-126`)
id, lang(2), pass tinytext (MD5 legacy), pass2 tinytext (bcrypt), rights int (bitfield; hx `RightSite{Admin}`, ts `RightSite{SuperAdmin}`, both bit 0: `User.hx:16-18`, `user.entity.ts:14-16`), firstName/lastName(32), email(64, unique index `User_email`), phone(19) null, firstName2/lastName2/email2/phone2 null (index `User_email2`), address1/2, zipCode(32), city(25), birthDate (date) null, nationality(2), countryOfResidence(2), cdate, ldate null, flags int (UserFlags: HasEmailNotif4h 0, HasEmailNotif24h 1, HasEmailNotifOuverture 2: `User.hx:7-11`, `camap-ts/packages/api-core/src/users/models/user-flags.ts:1-5`), apiKey(128) null, currentRefreshToken(255) null. Constructor defaults: lang "fr", flags with HasEmailNotif24h set (`User.hx:58-67`).

### UserGroup (`UserGroup.hx:19-26`, `user-group.entity.ts:5-27`)
PK (userId, groupId); rights text null (JSON array `[{right, params[]}]`, `JsonRights` `UserGroup.hx:17`; hx `SNull<SSmallText>` `:24`, ts nullable column but non-nullable array property `user-group.entity.ts:14-15`), balance double. hx `Right` enum: GroupAdmin, ContractAdmin(?cid), Membership, Messages (`UserGroup.hx:7-12`) serialized by name/params in JSON (`UserGroup.hx:60,108,147`). Helpers: `get/getOrCreate` with CACHE (`UserGroup.hx:26-46`), right granting/checking.

### UserOrder (`UserOrder.hx:9-41`, `user-order.entity.ts:21-112`)
id, userId, userId2 (null), quantity, productId, productPrice, feesRate, paid bool, distributionId, basketId, subscriptionId (null), date, flags int (`OrderFlags{InvertSharedOrder}` bit 0: `Common.hx:227-229`).

### Vendor (`Vendor.hx:8-56`, `vendor.entity.ts:23-165`)
id, name(128), userId (null FK User, added by migration `1760631262459-producteur.ts:7`), peopleName, profession/production2/production3 int null, email(128), showEmail, phone(19), showPhone, address1/2, zipCode(32), city(25), country(64), companyNumber(64), desc, cdate null, linkText/linkUrl(256), directory bool, longDesc, imageId null, disabled (tinyint null; `DisabledReason` IncompleteLegalInfos 0, NotCompliantWithPolicy 1, Banned 2: `Vendor.hx:8-12`, `vendor.entity.ts:15-19,127-165`), lat/lng null. `companyNumber` is `SNull<SString<64>>` in hx (`Vendor.hx:40`) and nullable in ts (`vendor.entity.ts:101-102`), while its migration creates it `varchar(64) NOT NULL` (`1721184612071-addCompanyNumber.ts:7`).

### Volunteer / VolunteerRole (`Volunteer.hx:6-11`, `VolunteerRole.hx:5-11`)
Volunteer: PK (userId, multiDistribId, volunteerRoleId). VolunteerRole: id, name(64), enabledByDefault bool (default 1 via migration `1716900422752-role-group-enabled-by-default.ts:7`), groupId, catalogId (null).

### WaitingList (`WaitingList.hx:6-12`, `waiting-list.entity.ts:7-39`)
PK (userId, amapId), date, message mediumtext. hx relation name `group` on column `amapId` (`WaitingList.hx:9`); ts `amap` (`waiting-list.entity.ts:29-34`).

### sugoi tables (hx source in sugoi library, ts mirrors in `camap-ts/packages/api-core/src/tools/models/`)
Cache(name PK, value, expire, cdate), EntityFile(id, fileId, entityType, documentType, data, entityId), Error(id, date, error, uid, ip, userAgent, url), File(id, name tinytext, cdate, data binary), Permalink(link PK, entityType, entityId), Session(sid PK, ip, lang, messages, lastTime, createTime, sdata, uid), Variable(name PK, value). The ts side mirrors them 1:1 and TS code references them in `tools/tools.module.ts`, `tools/permalink.service.ts`, `vendors/resolvers/*.ts` (under `camap-ts/packages/api-core/src/`).

### Other hx vs ts schema/semantic differences (facts)
- Property/relation renames over the same columns: hx `Group.contact`/`mainPlace`/`legalRepresentative`/`image` vs ts `user`/`place`/`legalRepr`/`image`; hx `WaitingList.group` vs ts `amap`; hx `Message.amap`; `Subscription` -> `CsaSubscriptionEntity` (`Group.hx:50,71,78`, `group.entity.ts:126-164`). Draft marks this list as only partially checked.
- ts relations are typed `Promise<...>` (lazy) in some entities and eager objects in others (`camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:79` vs `basket.entity.ts:65`).
- `Catalog.endDate`: hx `SNull<SDateTime>` (`Catalog.hx:30`), ts non-null (`catalog.entity.ts:41-42`).
- `Basket.status`: hx `SString<32>` with "Mysql enum" comment (`Basket.hx:25`); ts `enum` column with extra `PAYMENT_PROCESSING` (`basket.entity.ts:15-21,39-40`); hx never sees `PAYMENT_PROCESSING`.
- `Group.disabled`: hx `SNull<SString<32>>` (`Group.hx:94`), ts/migration real MySQL ENUM (`group.entity.ts:202-203`, `1741445966001-group-disabled.ts:7`).
- `Product.stockTracking` / `stockTrackingPerDistrib`: hx non-null `SEnum` (`Product.hx:28-29`), ts and migration nullable `tinyint unsigned` (`product.entity.ts:41-45`, `1716452582359-stocksRework.ts:8-9`).
- `StockTracking` is defined twice in ts: numeric in camap-common (`camap-ts/packages/camap-common/src/products/interfaces.ts:13`, used by `ProductEntity`) and string-valued in `camap-ts/packages/api-core/src/vendors/product.interface.ts:4` (used by `vendors/types/product.type.ts:2` and `products.resolver.ts:19,143-151`); DB stores the tinyint ordinal; GraphQL serialisation unverified.
- `MultiDistrib.volunteerRolesIds`: hx nullable plain `String` (`MultiDistrib.hx:30`), ts `simple-array` (`multi-distrib.entity.ts:29-30`); empty-string vs null handling unverified.
- `Distribution.quantities` is declared on both (hx `Int = 1` initialiser `Distribution.hx:29`, ts column default 1; production data gets the default via migration `1720184612071`).
- `Group.membershipRenewalDate` is `SDate` in hx, `string` in ts (`group.entity.ts:54-55`); `User.birthDate` is `Date` in ts for a `date` column.
- Stale Haxe test setup: `camap-hx/src/test/TestSuite.hx:59-91` omits `ProductDistributionStock`, `NotificationMail`, `Membership`, `WaitingList`, `Message`, `BufferedJsonMail` and still lists removed tables (`:61-63`).

## 4. Flags and enums

### 4.1 SFlags bitfields (`Group.flags`, `Catalog.flags`, `User.flags`, `User.rights`, `UserOrder.flags`)
- Stored as one `int`; bit `i` = ordinal `i` of the Haxe enum (`User.hx:62-63` initialises with `SFlags.ofInt(0)`).
- TS reads them with `hasFlag(enumIndex, value)` = `(value & (1 << i)) !== 0`, `setFlag`, `unsetFlag` in `camap-ts/packages/api-core/src/common/haxeCompat.ts:5-30` (limit 32 flags). The ts flag enums are hand-copied numeric enums, incomplete or renamed: `camap-ts/packages/api-core/src/groups/types/interfaces.ts:1-11`, `.../users/models/user-flags.ts:1-5`, `.../vendors/entities/catalog.entity.ts:20-24` (duplicated in `.../vendors/services/catalogs.service.ts:14-18`), `RightSite` in `.../users/models/user.entity.ts:14-16`. Group flags are consumed in `.../groups/services/groups.service.ts:43-56`, user flags in `.../users/user.utils.ts:6-14`.
- ts `GroupFlags` keeps only indices 0, 3-10 (renamed; only `__HasMembership` keeps the `__` prefix, verifier-corrected) and omits `__ShopMode` 1, `__HasPayments` 2, `AllowInformationNotifs` 11, `AllowAlertNotifs` 12 (`interfaces.ts:1-11` vs `Group.hx:9-24`).
- ts `CatalogFlags` defines 3 of 6 values (UsersCanOrder, StockManagement, PercentageOnOrders); DisplayPricesOnGroupPage, NotifyVendorOnOrderEnd, NotifyContactOnOrderEnd are omitted (`catalog.entity.ts:20-24`, `catalogs.service.ts:14-18` vs `Catalog.hx:8-15`).
- `RightSite`: hx `Admin` (`User.hx:16-18`) vs ts `SuperAdmin` (`user.entity.ts:14-16`), both bit 0. `OperationType`: hx `VOrder` vs ts `Order` for value 0 (`Operation.hx:5-10`, `payments/OperationType.ts:2`).
- `camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts:221` calls `setFlag(catalog.flags, CatalogFlags.UsersCanOrder)` with arguments reversed relative to `setFlag(enumIndex, flagValue)` (`haxeCompat.ts:18`) and discards the result; the correct form is used at `catalogs.service.ts:161` (verifier-corrected line references).
- A data migration adds `CONV('01100000000000',2,10)` (= 6144, bits 11 and 12) to every Group's `flags` with `+`, not bitwise OR (`1716557457926-update-group-flag-value.ts:7`); another sets `Product.stockTracking = 2` where `stock IS NOT NULL` (`1716452582359-stocksRework.ts:12`).

### 4.2 Enum columns (`SEnum`)
Stored as the 0-based ordinal (tinyint): `Operation.type`, `DistributionCycle.cycleType`, `Group.regOption`, `Product.unitType/stockTracking/stockTrackingPerDistrib`, `Vendor.disabled`. ts maps them with numeric enums (`payments/OperationType.ts:1-6`, `distribution-cycle.entity.ts:16-21`, `groups/types/interfaces.ts:13-18`, `camap-common/src/products/interfaces.ts`). Exceptions stored as strings: `Basket.status` (`Basket.hx:25`), `Group.disabled`.

## 5. Encodings and timezone handling

### 5.1 Haxe-specific constructors and defaults
hx constructors set defaults in code (e.g. `User.hx:58-67`, `Distribution.quantities = 1` at `Distribution.hx:29`); TS defaults come from column `default` (e.g. `Group.daysAfterClosingBeforeHidingDutyPeriods` default 30, `VolunteerRole.enabledByDefault`).

### 5.2 Serialized / JSON columns
- All `db.*` structured columns are JSON text produced by `haxe.Json.stringify` (`Basket.hx:211`, `BufferedJsonMail.hx:31-37`, `Group.hx:422,451`, `NotificationMail.hx:31`, `Operation.hx:50`, `UserGroup.hx:108,147`, `Subscription.hx:83`). No `haxe.Serializer`/`SData` in `camap-hx/src/db`.
- Comma-separated lists (no JSON): `MultiDistrib.volunteerRolesIds` (`MultiDistrib.hx:404`, ts `simple-array`), `Subscription.absentDistribIds` (`Subscription.hx:139`, ts keeps the raw string `csa-subscription.entity.ts:34-35`).
- TS access patterns: `simple-json` columns (`Group.vatRates`, `Group.allowedPaymentsType`, `UserGroup.rights`: `group.entity.ts:63,199`, `user-group.entity.ts:14`); `raw_*` columns with JSON getters/setters (`Operation.data` `operation.entity.ts:148-172`, `BufferedJsonMail.headers/sender/recipients/attachments`, `NotificationMail.attachments`, `Message.attachments`); plain strings left to callers (`Basket.data`, `Subscription.defaultOrders/absentDistribIds`). `NotificationMail.attachments` is `Array<String>` JSON in hx (`NotificationMail.hx:22-31`) but typed as `{filename,contentType,content,encoding,cid?}` objects in ts (`notification-mail.entity.ts:56-72`).
- Real Haxe-serialized blobs exist only in sugoi `Session`: `sdata` is `SNekoSerialized` under neko (sugoi `db/Session.hx:19-21`) and `messages` is `SData<Array<{error,text}>>` (`Session.hx:14`). ts declares both as `mediumblob` `Buffer` and does not decode them (`camap-ts/packages/api-core/src/tools/models/session.entity.ts:29-36`). `File.data` is a binary blob (`tools/models/file.entity.ts:20-21`). sugoi `BufferedMail` uses `SData` (not mirrored in ts).

### 5.3 Dates and timezone
- Haxe: `SDateTime` -> MySQL `datetime` written/read in the Neko process local time, `Europe/Paris` (`camap-hx/camap-hx.Dockerfile:115`). `camap-ts/docs/future.md:26` states that dates stored by Haxe code are French dates.
- TS: `ormconfig.js` sets no `timezone` option (mysql driver default applies; believed to be local time, unverified); the container runs `TZ=Europe/Paris` (`camap-ts.Dockerfile:54`) while tests run `TZ=UTC` (`camap-ts/packages/api-core/package.json:27,31`).
- Four entities convert Paris wall-clock <-> UTC in getters/setters with `date-fns-tz` (`zonedTimeToUtc(raw, 'Europe/Paris')` on read, `utcToZonedTime` on write; `TZ_PARIS` = `camap-ts/packages/api-core/src/common/constants.ts:1`): `DistributionCycle` (6 date fields, `distribution-cycle.entity.ts:70-135`), `Distribution` (`date,end,orderStartDate,orderEndDate`, `distribution.entity.ts:79-130`), `MultiDistrib` (4 fields, `multi-distrib.entity.ts:96-143`), `WaitingList.date` (`waiting-list.entity.ts:15-24`). Raw columns are exposed as `raw_<name>` and indexes reference the raw name (`multi-distrib.entity.ts:23`, `distribution.entity.ts:20-24`). The GraphQL fields on `DistributionCycle` apply the same conversion (`camap-ts/packages/api-core/src/shop/resolvers/distribution-cycles.resolver.ts:52-92`).
- All other datetime columns (Basket.cdate, Catalog.startDate/endDate/absences*, Operation.date, UserOrder.date, Subscription.startDate/endDate, Message.date, Group.cdate, User.cdate/ldate, Vendor.cdate, BufferedJsonMail.cdate/sdate, Session/Cache/Error dates) are mapped as plain `Date` with no conversion.
- `NotificationMail.cdate` is the only column using `@CreateDateColumn()` (DDL `datetime(6) DEFAULT CURRENT_TIMESTAMP(6)`: `1773912252829-EmailDigests.ts:7`), i.e. the DB server clock (MySQL container `TZ=Europe/Paris`, `mysql.Dockerfile:11`); hx declares it plain `SDateTime` (`NotificationMail.hx:13`) and sets nothing in `createNotification` (`NotificationMail.hx:22-34`).
- `date` columns (no time): `Group.membershipRenewalDate` (ts type `string`), `Membership.date`, `User.birthDate`.
- Charset: ormconfig uses utf8mb4 (`camap-ts/ormconfig.js:36-37`), MySQL server utf8mb4 / `utf8mb4_unicode_ci` (`camap-ts/mysql/my.cnf:8-10`). `camap-ts/docs/future.md:43` mentions latin1_swedish_ci; whether existing production DBs are still latin1 is unverified.

## 6. Schema management

### 6.1 Haxe side
- No Haxe code creates or migrates the production schema. `sys.db.TableCreate` is only used by the test harness (`camap-hx/src/test/TestSuite.hx:95-99`), which drops/recreates a `tests` database (`TestSuite.hx:55`).
- `/install` (`camap-hx/src/controller/Main.hx:218-219` -> `camap-hx/src/controller/Install.hx:18-100`) does NOT create tables. It refuses to run if `db.User` already has rows (`Install.hx:20`, which itself needs the `User` table to exist) and then inserts demo data: admin user `admin@camap.tld`/`admin`, a Group, UserGroup rights, a Place, Vendor, Catalog and two Products.
- `/db` (`Main.hx:302-306`, `@admin`) mounts `sys.db.admin.Admin.handler()`, the record-macros web DB admin tool (manual schema editing UI); `camap-ts/docs/schema.md:9` forbids using it for changes.
- `/admin` is a separate super-admin back-office (`Main.hx:334-336`); `/scripts` is the CLI maintenance entry (`Main.hx:341`).
- `Install.doDiagnostics` (`/install/diagnostics`) creates `<webroot>file/` and `../tmp` if missing and has no auth (`camap-hx/src/controller/Install.hx:106-122`).

### 6.2 TypeORM side
- Connection config: `camap-ts/ormconfig.js:28-39` (`entities` from `DB_ENTITIES`, `charset: utf8mb4`, `namingStrategy: CamapNamingStrategy`). `synchronize` is commented out (`ormconfig.js:34`); `DB_SYNCHRONIZE` in `.env.sample:21` / `.env.test:22` is not read by ormconfig.
- Nest boots with `TypeOrmModule.forRoot()` (`camap-ts/packages/api-core/src/app.module.ts:42`), reading `ormconfig` from the working directory (`camap-ts/packages/api-core/ormconfig.js`, which spreads the root config and adds `migrations: dist/migrations/*.js`, `migrationsTransactionMode: 'each'`: `:4-11`).
- Migrations: `camap-ts/packages/api-core/src/migrations/` (12 files, 2024-05-23 to 2026-03: stocksRework, update-group-flag-value, role-group-enabled-by-default, fix-typo, daysAfterClosingBeforeHidingDutyPeriods, add-catalog-first-distrib, add-distrib-quantities, addCompanyNumber, group-disabled, producteur, vendorShowPhone, EmailDigests). Only incremental changes: there is no baseline/initial migration (the first one already ALTERs `Product`, `1716452582359-stocksRework.ts:8`). Production start runs them: `camap-ts/packages/api-core/package.json:25` `start:prod = typeorm migration:run && node dist/main`; the Docker image `CMD` does not (`camap-ts/camap-ts.Dockerfile:65`).
- Sync paths: root `npm run schema:sync` (`camap-ts/package.json:30`) and api-core `dbsync` (`camap-ts/packages/api-core/package.json:35`) -> `typeorm schema:sync`; `camap-ts/packages/api-core/src/cli/sync-db.ts:5-16` (`synchronize: true` on dist entities; not wired in any package.json script found, unverified); `cli/dataset.ts:11` and test helper `test/utils.ts:59` call `connection.synchronize(true)` (drops and recreates the whole schema from entities).
- Dev DB bootstrap as documented: run `npm run schema:sync`, then visit `/install` (`camap-ts/docs/troubleshooting.md:23`). In dev, tables come from the TS entities; hx only seeds data. For pre-2024 DBs the schema came from Haxe (the legacy FK names in `orm-naming-strategy.js:19-52` reproduce it; inference, no baseline in repo).
- MySQL: image `mysql:8.0.36` with `camap-ts/mysql/my.cnf` (`mysql.Dockerfile:1,11`). `sql-mode` deliberately omits `STRICT_TRANS_TABLES` because of record-macros (`my.cnf:4-5`). `camap-ts/mysql/init-test-db.sql:1` creates a `test` DB for ts tests (`.env.test:20`).
- Workflow documentation: `camap-ts/docs/schema.md` (migration generate/show/run; every DB change must be a migration, `schema.md:9`).

### 6.3 Who changes what in practice
- ts-created objects: table `ProductDistributionStock` (initially misspelled `ProductDistibutionStock`, renamed by `1717668928327-fix-typo.ts:7`), table `NotificationMail`, columns `Product.stockTracking`/`stockTrackingPerDistrib`, `Group.daysAfterClosingBeforeHidingDutyPeriods`, `Catalog.firstDistribId`, `Distribution.quantities`, `Vendor.companyNumber`/`userId`/`showPhone`/`showEmail`, `VolunteerRole.enabledByDefault`. All are also declared in hx (`ProductDistributionStock.hx`, `NotificationMail.hx`, `Product.hx:28-29`, `Group.hx:87`, `Catalog.hx:29`, `Distribution.hx:29`, `Vendor.hx:21,31,33,40`, `VolunteerRole.hx:9`), so the Haxe class has to be kept in sync by hand.

## 7. `Variable` table keys

Shared table `Variable(name varchar(64) PK, value mediumtext)`: TS entity `camap-ts/packages/api-core/src/tools/models/variable.entity.ts:3-10`; HX side is `sugoi.db.Variable` (library class, not in the repo; used with `Variable.get/getInt/set`). A grep over `camap-hx/src`, `js`, `common`, `lang/*/tpl` and `camap-ts/packages/api-core/src` + `test` yields the inventory below.

### 7.1 Keys used by Haxe
| Key | Written by | Read by | Meaning / format | TS counterpart |
|---|---|---|---|---|
| `maintain` | nobody in repo (set manually in DB) | `camap-hx/src/controller/Main.hx:36` (`getInt("maintain") != 0`) | non-zero = maintenance: renders `maintain.mtt` instead of redirecting to `/home`; bypassed for `user.isAdmin()` (`Main.hx:39-41`) | none |
| `attMessage` | `Admin.doAttention` (`camap-hx/src/controller/admin/Admin.hx:173`) | `Main.hx:167` (flash message to every member on the group home page), `Admin.hx:167` | free text/HTML; ignored when `""`, null or the string `"null"` (`Main.hx:168`) | none |
| `attMessageAdmins` | `Admin.doAttentionAdmins` (`Admin.hx:197`) | `Main.hx:151`, `Admin.hx:186` | text for group admins; shown only to members with `ug.getRights().length > 0` or `isAdmin()` (`Main.hx:150`) | none |
| `attMessageAdminsAlert` | `Admin.hx:198` (checkbox `msgAlert`) | `Main.hx:153` (`== "true"` -> red flash), `Admin.hx:187,190` | boolean stored as string | none |
| `homeMessage` | `Admin.doMessages` (`Admin.hx:154`) | `Admin.hx:148`; template `camap-hx/lang/{master,fr}/tpl/user/choose.mtt:3-6` via `getVariable("homeMessage")`, output with `::raw::` (unescaped HTML) | banner on the group chooser page | none |
| `whiteLabel` | `Admin.doTheme` (`Admin.hx:52`, JSON of `Theme`) | `App.setTheme` raw SQL `SELECT value FROM Variable WHERE name='whiteLabel'` (`camap-hx/src/App.hx:145-147`); falls back to `defaultTheme` on null or any exception (`:148-150`); cached in static `App.theme` | theme JSON (names, links, email footer, terms links) | `VariableService.getTheme()` does NOT read it (`camap-ts/packages/api-core/src/tools/variable.service.ts:61-72`: returns `DEFAULT_THEME(CAMAP_HOST)` cached in a static) |
| `smtp_host`, `smtp_port` (Int), `smtp_user`, `smtp_pass` | nobody in repo | `camap-hx/src/db/BufferedJsonMail.hx:82-85` builds the SMTP config sent to the bridge | SMTP credentials stored in clear text in DB | TS mailer is configured by env (`MAILER_TRANSPORT`/`SMTP_HOST`, `camap-ts/packages/api-core/src/envSchema.ts:25-28`); `smtp_host` has no hit in api-core/src |

Keys read through the template helper `getVariable(...)` (implemented in the sugoi library; what backs it was not verified): `googleTagManagerId` (`camap-hx/lang/master/tpl/base.mtt:26,94`), `css` (`base.mtt:31,36,38,42`) and `js` (`base.mtt:50,52,53`), used as asset-version path segments. `camap-hx/src/controller/Install.hx:3` imports `sugoi.db.Variable` without using it; `camap-hx/src/test/TestSuite.hx:88` only registers the table for test DB creation. The admin pages that write these keys (`/admin/theme`, `/admin/attention`, `/admin/attentionAdmins`, `/admin/messages`) are `@admin` actions in `camap-hx/src/controller/admin/Admin.hx:41-62,146-204`; the `/admin/theme` form has no link in `camap-hx/lang/master/tpl/admin/basedesign.mtt:14-20`. In-memory theme is refreshed only by `/admin?reloadSettings=1` (`Admin.hx:34-38`) or restart (`App.hx:153-157`).

### 7.2 Keys used by TypeScript (`VariableNames`, `camap-ts/packages/api-core/src/tools/variable.service.ts:9-14`)
| Key (enum member) | Written by | Read by | Effect |
|---|---|---|---|
| `tosVersion` | seeded `'1'` by `camap-ts/packages/api-core/src/dev/dataset-generator.ts:746` only | no reader in `api-core/src` | none today |
| `platformtermsofservice` (`platformTermsOfServiceVersion`) | seeded `'1'` by `dataset-generator.ts:747` | `VendorService.create` -> `getInt(...)` stored into `Vendor.tosVersion` (`camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:183-195`) | stamps new vendors with the current ToS version; `getInt` tests `i === null` (`variable.service.ts:47`) while TypeORM 0.2.45 `findOne` returns `undefined` for a missing row (`typeorm/repository/Repository.d.ts:235`), so a missing row reaches `parseInt(i.value)` (`:48`) and throws; `set()` calls `variableRepo.save(v)` without `await` (`:59`) |
| `IPBlacklist` | none | `BlackListGuard` (`camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:26-39`): JSON array of IPs | the guard also rejects User-Agent containing `python` (`:45-47`); it is never applied (only its declaration is found in `api-core/src`) |
| `defaultShowcaseGroupIds` | none | none (declaration only, `variable.service.ts:14`) | dead |

`VariableService.set` (`variable.service.ts:49-59`) and `findOneByKey` (`:23`) are called only by the CLI helpers `loadAdminProcess` / `saveAdminProcess` (`camap-ts/packages/api-core/src/cli/utils.ts:55-72`), which store JSON state under an arbitrary `name`; no caller of those helpers exists in `api-core/src`. TS writes `Variable` only through the dataset seeder (and these helpers), while HX writes `attMessage*`, `homeMessage`, `whiteLabel`; front-core has no equivalent admin pages.
