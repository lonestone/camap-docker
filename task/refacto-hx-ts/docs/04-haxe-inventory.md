# 04 - Haxe application inventory (`camap-hx`)

Scope: every unit of the Haxe app and its status against `camap-ts`. Built from the route tables of drafts 01 to 10, `11-gaps.md`, `99-coverage-critic.md`, and from a read-only scan of `camap-hx/src/controller/**` (action list, annotations, rights calls, templates).

How to read
- Action list: the 243 `function do*` declarations found in `camap-hx/src/controller/**` (the coverage critic counted 242 with a looser regexp; 243 includes `Cron.doMinute` and similar declared on one line; it was not reconciled further). Line numbers are the declaration line.
- URL: computed from the sugoi convention (`/<controller>/<action>`; `Main.do<X>` are root-level routes; `admin.Admin` actions are `/admin/<x>`; sub-folder controllers are `/<folder>/<controller>/<x>`; `doDefault` has no suffix). Where a draft gives a different URL the draft is authoritative.
- Rights: `@logged` / `@admin` annotations and rights/token helper calls found in the action body (`checkToken`, `canManageContract`, `isAmapManager`, ...) by mechanical scan; "none visible in source" means no such call in the action body (checks may live in the constructor, a dispatcher such as `Main.doAdmin`, or sugoi). It is not a security verdict; see `inconsistencies-code.md` for missing-check findings.
- Template: `@tpl(...)` annotation or `setTemplate(...)` call in the body; `-` when none found (redirect, JSON, raw output or template chosen elsewhere).
- Purpose: last column of the draft route-table row that mentions the action; rows tagged `[draft NN text]` are the first free-text mention; rows with "(no draft description...)" are not described in any draft (gaps).
- TS status: `none` = no equivalent TS handler; `partial` = TS covers part (read, UI, or a sub-feature); `full` = TS replaces it. Status is assigned at controller level with per-action overrides from the ownership tables of drafts 03 to 09; no action is `full` because the drafts state that Haxe still owns the write side of every area. Status is not a verification of each individual action.
- Feature doc: `03-features/<file>.md` that covers the action (files: users-auth, groups-membership, catalogs-products-vendors, distributions-volunteers, orders-subscriptions, payments-operations-reports, messaging-mails, crons-scheduled-jobs, admin-superadmin, frontend-templates-i18n).

## 1. Controllers (`camap-hx/src/controller/**`)

### 1.0 Controller summary

| Controller | File | Actions | TS status (controller level) | Feature doc |
|---|---|---|---|---|
| Account | `camap-hx/src/controller/Account.hx` | 3 | partial 2, none 1 | `03-features/groups-membership.md, 03-features/users-auth.md` |
| Amap | `camap-hx/src/controller/Amap.hx` | 2 | none 2 | `03-features/groups-membership.md` |
| AmapAdmin | `camap-hx/src/controller/AmapAdmin.hx` | 10 | partial 1, none 9 | `03-features/groups-membership.md, 03-features/payments-operations-reports.md` |
| Api | `camap-hx/src/controller/Api.hx` | 10 | none 10 | `03-features/admin-superadmin.md` |
| Attention | `camap-hx/src/controller/Attention.hx` | 1 | none 1 | `03-features/frontend-templates-i18n.md` |
| Contract | `camap-hx/src/controller/Contract.hx` | 6 | none 6 | `03-features/orders-subscriptions.md` |
| ContractAdmin | `camap-hx/src/controller/ContractAdmin.hx` | 30 | partial 29, none 1 | `03-features/catalogs-products-vendors.md, 03-features/orders-subscriptions.md` |
| Cron | `camap-hx/src/controller/Cron.hx` | 4 | partial 4 | `03-features/crons-scheduled-jobs.md` |
| Distribution | `camap-hx/src/controller/Distribution.hx` | 26 | partial 25, none 1 | `03-features/distributions-volunteers.md, 03-features/payments-operations-reports.md` |
| Documents | `camap-hx/src/controller/Documents.hx` | 4 | partial 4 | `03-features/catalogs-products-vendors.md` |
| Group | `camap-hx/src/controller/Group.hx` | 7 | partial 4, none 3 | `03-features/groups-membership.md` |
| History | `camap-hx/src/controller/History.hx` | 5 | none 5 | `03-features/orders-subscriptions.md` |
| Install | `camap-hx/src/controller/Install.hx` | 2 | none 2 | `03-features/admin-superadmin.md` |
| Main | `camap-hx/src/controller/Main.hx` | 31 | none 31 | `03-features/frontend-templates-i18n.md` |
| Media | `camap-hx/src/controller/Media.hx` | 4 | none 4 | `03-features/catalogs-products-vendors.md` |
| Member | `camap-hx/src/controller/Member.hx` | 9 | partial 8, none 1 | `03-features/groups-membership.md, 03-features/users-auth.md` |
| Messages | `camap-hx/src/controller/Messages.hx` | 1 | partial 1 | `03-features/messaging-mails.md` |
| Place | `camap-hx/src/controller/Place.hx` | 5 | partial 5 | `03-features/catalogs-products-vendors.md` |
| Product | `camap-hx/src/controller/Product.hx` | 6 | partial 6 | `03-features/catalogs-products-vendors.md` |
| Scripts | `camap-hx/src/controller/Scripts.hx` | 3 | none 3 | `03-features/crons-scheduled-jobs.md` |
| Shop | `camap-hx/src/controller/Shop.hx` | 1 | none 1 | `03-features/orders-subscriptions.md` |
| SubscriptionAdmin | `camap-hx/src/controller/SubscriptionAdmin.hx` | 8 | none 8 | `03-features/orders-subscriptions.md` |
| Subscriptions | `camap-hx/src/controller/Subscriptions.hx` | 3 | none 3 | `03-features/orders-subscriptions.md` |
| Transaction | `camap-hx/src/controller/Transaction.hx` | 3 | none 3 | `03-features/payments-operations-reports.md` |
| User | `camap-hx/src/controller/User.hx` | 10 | partial 7, none 3 | `03-features/groups-membership.md, 03-features/messaging-mails.md, 03-features/users-auth.md` |
| Vendor | `camap-hx/src/controller/Vendor.hx` | 5 | partial 5 | `03-features/catalogs-products-vendors.md` |
| admin/Admin | `camap-hx/src/controller/admin/Admin.hx` | 10 | none 10 | `03-features/admin-superadmin.md` |
| admin/Group | `camap-hx/src/controller/admin/Group.hx` | 4 | none 4 | `03-features/admin-superadmin.md` |
| admin/User | `camap-hx/src/controller/admin/User.hx` | 5 | partial 5 | `03-features/admin-superadmin.md` |
| amapadmin/Volunteers | `camap-hx/src/controller/amapadmin/Volunteers.hx` | 4 | none 4 | `03-features/distributions-volunteers.md` |
| api/Catalog | `camap-hx/src/controller/api/Catalog.hx` | 4 | none 4 | `03-features/catalogs-products-vendors.md` |
| api/Distributions | `camap-hx/src/controller/api/Distributions.hx` | 2 | none 2 | `03-features/distributions-volunteers.md` |
| api/Order | `camap-hx/src/controller/api/Order.hx` | 4 | none 4 | `03-features/orders-subscriptions.md` |
| api/Places | `camap-hx/src/controller/api/Places.hx` | 1 | none 1 | `03-features/catalogs-products-vendors.md` |
| api/Product | `camap-hx/src/controller/api/Product.hx` | 2 | none 2 | `03-features/catalogs-products-vendors.md` |
| api/Subscription | `camap-hx/src/controller/api/Subscription.hx` | 4 | none 4 | `03-features/orders-subscriptions.md` |
| api/User | `camap-hx/src/controller/api/User.hx` | 4 | none 4 | `03-features/users-auth.md` |

### 1.1 `camap-hx/src/controller/Account.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (25) | `/account` | `TPL/account/default.mtt` -> React `userAccount` + `deleteAccount` | logged | `account/default.mtt` | `updateUser`, `updateUserNotifications`, `deleteAccount` (camap-ts/packages/api-core/src/users/users.resolver.ts); page shell stays HX | partial | users-auth |
| `doEditNotif` (60) | `/account/editNotif` | email-footer link; key = `sha1(KEY+userId)` | none visible in source | - | `updateUserNotifications` | partial | users-auth |
| `doQuitGroup` (70) | `/account/quitGroup` | clears `session.data.amapId` if it equals groupId (no output; called after TS quit, caller unverified) | none visible in source | - | none | none | groups-membership |

### 1.2 `camap-hx/src/controller/Amap.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (19) | `/amap` | (default = list of current/ended catalogs, other area). `edit` = group settings form (name, contact, texts, extUrl, regOption, flags HidePhone/PhoneRequired/AddressRequired, legalRepresentat... | none visible in source | `amap/default.mtt` | none (TS only `setGroupImage`) | none | groups-membership |
| `doEdit` (36) | `/amap/edit` | (default = list of current/ended catalogs, other area). `edit` = group settings form (name, contact, texts, extUrl, regOption, flags HidePhone/PhoneRequired/AddressRequired, legalRepresentat... | checkToken, isAmapManager | `form.mtt` | none (TS only `setGroupImage`) | none | groups-membership |

### 1.3 `camap-hx/src/controller/AmapAdmin.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doMembership` (40) | `/amapadmin/membership` | edit `hasMembership`, `membershipFee` (IntInput), `membershipRenewalDate` | checkToken | `amapadmin/form.mtt` | membership CRUD in TS (`memberships.resolver.ts`); settings form HX only | partial | groups-membership |
| `doDefault` (75) | `/amapadmin` | group admin dashboard; constructor gate `isAmapManager` (`AmapAdmin.hx:27`) | none visible in source | `amapadmin/default.mtt` | none (TS only reads the columns) | none | groups-membership |
| `doRights` (84) | `/amapadmin/rights` | list users having any stored right | none visible in source | `amapadmin/rights.mtt` | none (TS only reads the columns) | none | groups-membership |
| `doEditRight` (94) | `/amapadmin/editRight` | grant/modify rights of a member | checkToken, hasRight, isGroupManager | `amapadmin/form.mtt` | none (TS only reads the columns) | none | groups-membership |
| `doVatRates` (202) | `/amapadmin/vatRates` | group settings of other areas (not detailed here) | none visible in source | - | none (TS only reads the columns) | none | groups-membership |
| `doVolunteers` (244) | `/amapadmin/volunteers` | (no draft description; from action name) volunteers | none visible in source | - | none (TS only reads the columns) | none | groups-membership |
| `doDocuments` (249) | `/amapadmin/documents` | (no draft description; from action name) documents | none visible in source | - | none (TS only reads the columns) | none | groups-membership |
| `doMedia` (254) | `/amapadmin/media` | (no draft description; from action name) media | none visible in source | - | none (TS only reads the columns) | none | groups-membership |
| `doCurrency` (263) | `/amapadmin/currency` | (no draft description; from action name and template) currency | none visible in source | `amapadmin/form.mtt` | none (TS only reads the columns) | none | groups-membership |
| `doPayments` (288) | `/amapadmin/payments` | Group admin: choose allowed payment types and IBAN. | none visible in source | `form.mtt` | none (TS only reads `allowedPaymentsType`) | none | payments-operations-reports |

### 1.4 `camap-hx/src/controller/Api.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (18) | `/api` | (no draft description; from action name) default | none visible in source | - | none | none | admin-superadmin |
| `doOrder` (27) | `/api/order` | Dispatcher to `controller/api/Order.hx` (REST, see section 1 entry for that file) | none visible in source | - | none | none | admin-superadmin |
| `doDistributions` (31) | `/api/distributions` | Dispatcher to `controller/api/Distributions.hx` (REST, see section 1 entry for that file) | none visible in source | - | none | none | admin-superadmin |
| `doPlaces` (35) | `/api/places` | Dispatcher to `controller/api/Places.hx` (REST, see section 1 entry for that file) | none visible in source | - | none | none | admin-superadmin |
| `doCatalog` (39) | `/api/catalog` | Dispatcher to `controller/api/Catalog.hx` (REST, see section 1 entry for that file) | none visible in source | - | none | none | admin-superadmin |
| `doSubscription` (43) | `/api/subscription` | Dispatcher to `controller/api/Subscription.hx` (REST, see section 1 entry for that file) | none visible in source | - | none | none | admin-superadmin |
| `doPlanning` (52) | `/api/planning` | (no draft description; from action name) planning | none visible in source | - | none | none | admin-superadmin |
| `doUser` (73) | `/api/user` | Dispatcher to `controller/api/User.hx` (REST, see section 1 entry for that file) | none visible in source | - | none | none | admin-superadmin |
| `doProduct` (77) | `/api/product` | Dispatcher to `controller/api/Product.hx` (REST, see section 1 entry for that file) | none visible in source | - | none | none | admin-superadmin |
| `doCreateSid` (84) | `/api/createSid` | Dev only (`config.DEBUG`): creates an anonymous session (draft 10) | none visible in source | - | none | none | admin-superadmin |

### 1.5 `camap-hx/src/controller/Attention.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (13) | `/attention` | (no draft description; from action name and template) default | none visible in source | `attention/default.mtt` | none (page mounts neo module `attention`, not registered in camap-ts/packages/front-core/src/neo.tsx) | none | frontend-templates-i18n |

### 1.6 `camap-hx/src/controller/Contract.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (33) | `/contract` | legacy "shop mode" edit of the current user's var orders; refused after `multiDistrib.getDate()` (193). No template/link to it found (`grep editVarOrders`: only the controller and its own te... | logged | - | none (TS React `csaCatalog` calls HX REST) | none | orders-subscriptions |
| `doDefineVendor` (41) | `/contract/defineVendor` | (no draft description; from action name and template) define vendor | logged @tpl("form.mtt"), canManageAllContracts | `form.mtt` | none (TS React `csaCatalog` calls HX REST) | none | orders-subscriptions |
| `doInsertVendor` (87) | `/contract/insertVendor` | (no draft description; from action name and template) insert vendor | logged @tpl("form.mtt") | `form.mtt` | none (TS React `csaCatalog` calls HX REST) | none | orders-subscriptions |
| `doInsertChoose` (122) | `/contract/insertChoose` | (no draft description; from action name and template) insert choose | canManageAllContracts | `contract/insertChoose.mtt` | none (TS React `csaCatalog` calls HX REST) | none | orders-subscriptions |
| `doInsert` (137) | `/contract/insert` | [draft 04 text] 12. Create (Contract.doInsert): volunteer roles created for `distributorNum` (H/controller/Contract.hx:162); vendor's user auto-joined to group (:165-167); contact receiv... | logged @tpl("contract/insert.mtt"), canManageAllContracts, checkToken | `contract/insert.mtt` | none (TS React `csaCatalog` calls HX REST) | none | orders-subscriptions |
| `doEditVarOrders` (189) | `/contract/editVarOrders` | legacy "shop mode" edit of the current user's var orders; refused after `multiDistrib.getDate()` (193). No template/link to it found (`grep editVarOrders`: only the controller and its own te... | logged @tpl("contract/editVarOrders.mtt"), checkToken, isContractManager | `contract/editVarOrders.mtt` | none (TS React `csaCatalog` calls HX REST) | none | orders-subscriptions |

### 1.7 `camap-hx/src/controller/ContractAdmin.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (47) | `/contractadmin` | list, sorted by user name, counts negative balances. | canManageContract, checkToken, isAmapManager | `contractadmin/default.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doEdit` (97) | `/contractadmin/edit` | (no draft description; from action name and template) edit | logged @tpl("form.mtt"), checkToken, isContractManager | `form.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doRoles` (165) | `/contractadmin/roles` | (no draft description; from action name and template) roles | checkToken | `contractadmin/roles.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doInsertRole` (181) | `/contractadmin/insertRole` | [draft 05 text] 6. [CONFIRMED] `Volunteers.doEditRole` forces `role.catalog = null` and is reachable for any role id (Volunteers.hx:166); `updateRoleToFuturesDistribs` does `md.volunteer... | none visible in source | `form.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doEditRole` (221) | `/contractadmin/editRole` | (no draft description; from action name) edit role | none visible in source | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doDeleteRole` (241) | `/contractadmin/deleteRole` | (no draft description; from action name) delete role | checkToken | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doProducts` (259) | `/contractadmin/products` | (no draft description; from action name and template) products | canManageContract, checkToken | `contractadmin/products.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doStocks` (295) | `/contractadmin/stocks` | (no draft description; from action name and template) stocks | canManageContract | `contractadmin/stocks.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doCopyProducts` (314) | `/contractadmin/copyProducts` | (no draft description; from action name and template) copy products | admin @tpl("form.mtt"), checkToken | `form.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doOrdersByTimeFrame` (349) | `/contractadmin/ordersByTimeFrame` | The route name is inferred from `doOrdersByTimeFrame` (:349). The CSV block at :599 sits in a different function, whose declaration I did not read, so the route name is unverified. | canManageAllContracts, canManageContract, checkToken, isAmapManager | `form.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doExportSubscriptions` (431) | `/contractadmin/exportSubscriptions` | managers of active contracts | canManageAllContracts, canManageContract, isAmapManager | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doOrdersByDate` (457) | `/contractadmin/ordersByDate` | (no draft description; from action name and template) orders by date | canManageAllContracts, canManageContract, checkToken, isAmapManager | `form.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doVendorsByDate` (533) | `/contractadmin/vendorsByDate` | (no draft description; from action name) vendors by date | none visible in source | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doVendorsByTimeFrame` (549) | `/contractadmin/vendorsByTimeFrame` | "Totals per supplier" report: finds active catalogs of the group (restricted to catalogs the user can manage unless `isAmapManager`, 556-561), distributions in range (error "There is no deli... | canManageContract, isAmapManager | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doOrders` (668) | `/contractadmin/orders` | per-distribution basket list, delete zero-qty order (`OrderService.delete`, 678-690), CSV. | canManageContract, checkToken | `contractadmin/orders.mtt` | none | none | orders-subscriptions |
| `doUpdatePrices` (753) | `/contractadmin/updatePrices` | overwrite `productPrice` of orders with current product price. | canManageContract | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doDuplicate` (782) | `/contractadmin/duplicate` | [draft 06 text] - There is no "renewal" feature in either code base: grep for renew/reconduct finds only memberships (camap-ts/packages/api-core/src/groups/services/memberships.service.t... | canManageContract, checkToken, isAdmin, isGroupManager, isMemberOf | `form.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doOrdersByProduct` (917) | `/contractadmin/ordersByProduct` | CSV. Columns (`ReportService.hx:93-103`): quantity, pname, ref, priceHT, priceTTC, totalHT, totalTTC. | canManageContract | `contractadmin/ordersByProduct.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doOrdersByProductList` (940) | `/contractadmin/ordersByProductList` | HTML "purchase order to print". | canManageContract | `contractadmin/ordersByProductList.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doDistributions` (957) | `/contractadmin/distributions` | (no draft description; from action name and template) distributions | canManageContract | `contractadmin/distributions.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doParticipate` (1001) | `/contractadmin/participate` | [draft 05 text] 4. [CONFIRMED] hx `Distribution.hx` handlers without explicit rights checks: doInviteFarmers (479), doVolunteerRoles (873), doVolunteers (937), doListByProductUser (78), ... | none visible in source | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doView` (1014) | `/contractadmin/view` | (no draft description; from action name and template) view | canManageContract, checkToken | `contractadmin/view.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doDocuments` (1027) | `/contractadmin/documents` | (no draft description; from action name) documents | none visible in source | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doSubscriptions` (1031) | `/contractadmin/subscriptions` | list, sorted by user name, counts negative balances. | none visible in source | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doStats` (1036) | `/contractadmin/stats` | The function name is not shown in the lines I read, so the route is unverified. | canManageContract | `contractadmin/stats.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doSelectDistrib` (1090) | `/contractadmin/selectDistrib` | (no draft description; from action name and template) select distrib | none visible in source | `contractadmin/selectDistrib.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doBatchOrder` (1103) | `/contractadmin/batchOrder` | `/contractAdmin/batchOrder/:catalog`, `/selectDistrib/:catalog`, `/ordersByDate`, `/ordersByTimeFrame`, `/ordersByProduct`, `/vendorsByDate`, `/tmpBaskets/:md` | none visible in source | `contractadmin/batchOrder.mtt` | TS `batchOrder` module + HX REST | partial | orders-subscriptions |
| `doTmpBaskets` (1112) | `/contractadmin/tmpBaskets` | (no draft description; from action name and template) tmp baskets | none visible in source | `contractadmin/tmpBaskets.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doAbsences` (1121) | `/contractadmin/absences` | (no draft description; from action name and template) absences | checkToken, isContractManager | `contractadmin/form.mtt` | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |
| `doDelete` (1170) | `/contractadmin/delete` | (no draft description; from action name) delete | logged, canManageAllContracts, checkToken | - | TS reads (`catalog`, `getActiveCatalogs`: camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts); React `batchOrder` module calls HX REST | partial | catalogs-products-vendors |

### 1.8 `camap-hx/src/controller/Cron.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (31) | `/cron` | TS triggers HX crons | none visible in source | - | TS `CrontabService` only triggers the HX endpoints (camap-ts/packages/api-core/src/tools/crontab.service.ts); job logic stays HX | partial | crons-scheduled-jobs |
| `doMinute` (58) | `/cron/minute` | (no draft description; from action name) minute | none visible in source | - | `CrontabService` triggers; mail buffer flush TS (`mails.service.ts`) | partial | crons-scheduled-jobs |
| `doHour` (92) | `/cron/hour` | every hour (minute 0) | none visible in source | - | `CrontabService` triggers; logic HX | partial | crons-scheduled-jobs |
| `doDaily` (340) | `/cron/daily` | daily 00:00 | none visible in source | - | `CrontabService` triggers; logic HX | partial | crons-scheduled-jobs |

### 1.9 `camap-hx/src/controller/Distribution.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (30) | `/distribution` | admin page: MDs from yesterday 00:00 to +84 days (28*3), plus cycles overlapping that timeframe; overridable with `_from/_to` (Distribution.hx:33-54, tools/Timeframe.hx:9-21). Section access... | checkHasDistributionSectionAccess, checkToken | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doList` (63) | `/distribution/list` | redirects to `csaList` (64) | none visible in source | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doCsaList` (68) | `/distribution/csaList` | mounts neo module `classicContractAttendance` (type 0) or `variableContractAttendance` (type 1) (camap-hx/lang/master/tpl/distribution/CSAList.mtt). Needs `canManageContract(d.catalog)` (69) | canManageContract | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doListByProductUser` (79) | `/distribution/listByProductUser` | HTML table user x product for one distribution; no access check in handler (unverified global guard) | none visible in source | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doListByDate` (143) | `/distribution/listByDate` | printable attendance sheet of a whole day+place. Section access (144). Without `type`: radio form one/contract/all/allshort + font S/M/L/XL (151-174); with type: templates `listByDateOnePage... | checkHasDistributionSectionAccess, checkToken | `form.mtt`, `distribution/listByDateOnePage.mtt`, `distribution/listByDateShort.mtt`, `distribution/listByDateOnePageContract.mtt` | none (server-side lists/CSV) | none | payments-operations-reports |
| `doDelete` (237) | `/distribution/delete` | doDelete (237), doNotAttend (250) | isContractManager | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doNotAttend` (250) | `/distribution/notAttend` | doDelete (237), doNotAttend (250) | isContractManager | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doDeleteMd` (265) | `/distribution/deleteMd` | section access + token; `deleteMd` | canManageAllContracts, checkToken | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doEdit` (285) | `/distribution/edit` | change a distribution's own `orderStartDate/orderEndDate` (not for CONSTORDERS catalogs, 288) | isContractManager | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doShift` (336) | `/distribution/shift` | move participation to another MD (merge if already participating) | isContractManager | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doEditCycle` (399) | `/distribution/editCycle` | bodies commented out: no-ops (empty/renders nothing) | checkHasDistributionSectionAccess | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doInsert` (419) | `/distribution/insert` | (no draft description; from action name) insert | isContractManager | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doInviteFarmers` (479) | `/distribution/inviteFarmers` | checkbox list of active catalogs; participate / cancel participation; no explicit access check | none visible in source | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doInviteFarmersCycle` (549) | `/distribution/inviteFarmersCycle` | stub "Fonctionnalité bientôt disponible" | none visible in source | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doInsertMd` (558) | `/distribution/insertMd` | create / edit one MD (section access) | checkHasDistributionSectionAccess | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doEditMd` (615) | `/distribution/editMd` | Edit a MultiDistrib. Builds a form from the spod, replaces date/start/end with `CamapDatePicker`s (minutes rounded to multiples of 5, 628-629, 635-636), adds checkbox "Recaler tous les produ... | checkHasDistributionSectionAccess | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doInsertCycle` (684) | `/distribution/insertCycle` | (no draft description; from action name and template) insert cycle | isContractManager | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doInsertMdCycle` (780) | `/distribution/insertMdCycle` | create cycle of MDs (section access) | checkHasDistributionSectionAccess | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doDeleteCycle` (858) | `/distribution/deleteCycle` | delete cycle and its MDs (section access; no token check in handler) | checkHasDistributionSectionAccess | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doVolunteerRoles` (873) | `/distribution/volunteerRoles` | choose which roles the MD needs; no explicit access check | none visible in source | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doVolunteers` (937) | `/distribution/volunteers` | admin assigns one member per role; no explicit access check | none visible in source | `form.mtt` | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doUnsubscribeFromRole` (976) | `/distribution/unsubscribeFromRole` | legacy: only redirects to `returnUrl` | none visible in source | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doVolunteersCalendar` (986) | `/distribution/volunteersCalendar` | members' calendar page (neo module) AND, when `distrib`+`role` present, registers current user to the role (GET with side effect) (993-1002) | none visible in source | - | TS `volunteersCalendar` module (UI); data and registration HX | partial | distributions-volunteers |
| `doVolunteersParticipation` (1025) | `/distribution/volunteersParticipation` | per-member duties done / to be done table | none visible in source | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doMissingProduct` (1066) | `/distribution/missingProduct` | bulk edit of orders of variable catalogs of an MD (section access) | checkHasDistributionSectionAccess | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |
| `doChangePrice` (1107) | `/distribution/changePrice` | Form: select a product among the var-order catalogs of the MD + new price. For each order of that product in the MD: `order.productPrice = price`, `update()`, then `PaymentService.onOrderCon... | checkHasDistributionSectionAccess | - | TS read resolvers (camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts, multi-distribs.resolver.ts); no TS write mutation | partial | distributions-volunteers |

### 1.10 `camap-hx/src/controller/Documents.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (16) | `/documents` | group settings of other areas (not detailed here) | canManageContract, checkToken, isAmapManager | `contractadmin/documents.mtt` | `createDocument`/`deleteDocument` (camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts) | partial | catalogs-products-vendors |
| `doEdit` (40) | `/documents/edit` | (no draft description; from action name and template) edit | canManageContract, isAmapManager | `form.mtt` | `createDocument`/`deleteDocument` (camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts) | partial | catalogs-products-vendors |
| `doDelete` (82) | `/documents/delete` | (no draft description; from action name) delete | canManageContract, checkToken, isAmapManager | - | `createDocument`/`deleteDocument` (camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts) | partial | catalogs-products-vendors |
| `doInsert` (113) | `/documents/insert` | see 2.1 (template adddocument/addmedia) | canManageContract, isAmapManager | `contractadmin/adddocument.mtt` | `createDocument`/`deleteDocument` (camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts) | partial | catalogs-products-vendors |

### 1.11 `camap-hx/src/controller/Group.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (23) | `/group` | public group page; disabled -> redirect `/group/disabled/<id>`; if `regOption==Open` stores group in session (`Group.hx:29-36`, even for anonymous visitors) | isMemberOf | - | `groupPreview*`, `getGroupsOnMap` (camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts); waiting-list register and group creation have no TS equivalent | partial | groups-membership |
| `doList` (83) | `/group/list` | register to waiting list (needs login, `regOption==WaitingList`) via `WaitingListService.registerToWl` | none visible in source | - | none | none | groups-membership |
| `doListCancel` (120) | `/group/listCancel` | leave waiting list | none visible in source | - | none | none | groups-membership |
| `doCreate` (133) | `/group/create` | create group: **only superadmin** (`Group.hx:136-139`) | checkToken, isAdmin | `form.mtt` | none | none | groups-membership |
| `doCsa` (190) | `/group/csa` | map / CSA landing | none visible in source | `group/csa.mtt` | `groupPreview*`, `getGroupsOnMap` (camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts); waiting-list register and group creation have no TS equivalent | partial | groups-membership |
| `doMap` (195) | `/group/map` | map / CSA landing | none visible in source | `group/map.mtt` | `getGroupsOnMap` | partial | groups-membership |
| `doDisabled` (205) | `/group/disabled` | public group page; disabled -> redirect `/group/disabled/<id>`; if `regOption==Open` stores group in session (`Group.hx:29-36`, even for anonymous visitors) | none visible in source | `group/disabled.mtt` | `groupPreview*`, `getGroupsOnMap` (camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts); waiting-list register and group creation have no TS equivalent | partial | groups-membership |

### 1.12 `camap-hx/src/controller/History.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (27) | `/history` | refreshes user balance (31), lists active subscriptions by catalog (40) and MultiDistribs from -30d to +6 months (36-37). | logged, checkToken | `history/default.mtt` | none | none | orders-subscriptions |
| `doBasket` (66) | `/history/basket` | logged only; **no ownership check** | logged | - | none | none | orders-subscriptions |
| `doOrders` (77) | `/history/orders` | current user's orders of a catalog. No template link found to this route (unverified at runtime). | logged | `history/csaorders.mtt` | none | none | orders-subscriptions |
| `doSubscriptionOrders` (95) | `/history/subscriptionOrders` | member of current group; **no ownership check** | logged | `history/csaorders.mtt` | none | none | orders-subscriptions |
| `doSubscriptionPayments` (109) | `/history/subscriptionPayments` | also calls `createOrUpdateTotalOperation` (115), i.e. a read page that writes. | logged | `history/subscriptionpayments.mtt` | none | none | orders-subscriptions |

### 1.13 `camap-hx/src/controller/Install.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (18) | `/install` | If `User` table is empty: creates group + user `admin@camap.tld` / password `admin`, flag Admin (`Install.hx:25-100`). Otherwise `throw "CAMAP est deja installe"`. | checkToken | `form.mtt` | none (TS seeds via `camap-ts/packages/api-core/src/dev/dataset-generator.ts`) | none | admin-superadmin |
| `doDiagnostics` (106) | `/install/diagnostics` | Prints diagnostics to stdout with `Sys.println`: creates `<webroot>file/` if missing (110-113), prints a warning (does not create) if `file/.htaccess` is missing (114-116), creates `<webroot... | none visible in source | - | none (TS seeds via `camap-ts/packages/api-core/src/dev/dataset-generator.ts`) | none | admin-superadmin |

### 1.14 `camap-hx/src/controller/Main.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (34) | `/default` | Maintenance gate (`maintain` Variable, admins bypass), then permalink dispatcher; no permalink redirects to `/home` (Main.hx:34-) | isAdmin | `maintain.mtt` | none | none | frontend-templates-i18n |
| `doTransaction` (55) | `/transaction` | Dispatcher to controller `Transaction` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doGroup` (62) | `/group` | Dispatcher to `Group` controller with login/group gate | none visible in source | - | none | none | frontend-templates-i18n |
| `doHome` (67) | `/home` | login gate: no user + no open group -> `/user/login`; user w/o group -> `/user/choose`; disabled group -> `/group/disabled`; shows PhoneRequired/AddressRequired nags (`Main.hx:135-145`) | isAdmin, isMemberOf | `home.mtt` | none | none | frontend-templates-i18n |
| `doUser` (177) | `/user` | Dispatcher to controller `User` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doCron` (182) | `/cron` | Dispatcher to `Cron` controller | none visible in source | - | none | none | frontend-templates-i18n |
| `doApi` (189) | `/api` | Dispatcher to controller `Api` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doCssdemo` (210) | `/cssdemo` | Dev style-guide page (buttons, alerts). Puts a `Map<String,String>` `users` in the view (`bob` -> "is a nice fellow") to debug Haxe 4 StringMap in templates. Template `cssDemo.mtt` (196 line... | none visible in source | `cssDemo.mtt` | none | none | frontend-templates-i18n |
| `doInstall` (218) | `/install` | Dispatcher to `Install` | none visible in source | `form.mtt` | none | none | frontend-templates-i18n |
| `doMember` (223) | `/member` | Dispatcher to controller `Member` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doHistory` (228) | `/history` | Dispatcher to controller `History` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doAccount` (233) | `/account` | Dispatcher to controller `Account` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doVendor` (238) | `/vendor` | Dispatcher to controller `Vendor` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doPlace` (244) | `/place` | Dispatcher to controller `Place` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doDistribution` (249) | `/distribution` | Dispatcher to controller `Distribution` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doShop` (254) | `/shop` | Dispatcher to controller `Shop` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doProduct` (259) | `/product` | Dispatcher to controller `Product` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doAmap` (264) | `/amap` | Dispatcher to controller `Amap` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doContract` (269) | `/contract` | Dispatcher to controller `Contract` (sub-actions listed in its own section) | none visible in source | - | none | none | frontend-templates-i18n |
| `doContractAdmin` (275) | `/contractAdmin` | Dispatcher to controller `ContractAdmin` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doDocuments` (281) | `/documents` | Dispatcher to controller `Documents` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doSubscriptions` (286) | `/subscriptions` | Dispatcher to controller `Subscriptions` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doMessages` (291) | `/messages` | Dispatcher to controller `Messages` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doAmapadmin` (297) | `/amapadmin` | Dispatcher to controller `AmapAdmin` (sub-actions listed in its own section) | logged | - | none | none | frontend-templates-i18n |
| `doDb` (303) | `/db` | Raw sugoi DB admin (`sys.db.admin.Admin.handler()`, Dispatch disabled) | admin | - | none | none | frontend-templates-i18n |
| `doInvite` (309) | `/invite` | invitation link, `hash=sha1(KEY+email)`; if `userId` given: `UserGroup.getOrCreate` immediately | none visible in source | - | none | none | frontend-templates-i18n |
| `doPing` (326) | `/ping` | Prints JSON `{version}` from `App.VERSION` | none visible in source | - | none | none | frontend-templates-i18n |
| `doAdmin` (334) | `/admin` | Dispatcher to `admin.Admin` (superadmin back-office) | admin | - | none | none | frontend-templates-i18n |
| `doScripts` (341) | `/scripts` | Dispatcher to `Scripts` (CLI only) | none visible in source | - | none | none | frontend-templates-i18n |
| `doTos` (358) | `/tos` | Redirect to theme `terms.termsOfServiceLink` | none visible in source | - | none | none | frontend-templates-i18n |
| `doCgu` (362) | `/cgu` | Redirect to `/tos` | none visible in source | - | none | none | frontend-templates-i18n |

### 1.15 `camap-hx/src/controller/Media.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (16) | `/media` | group settings of other areas (not detailed here) | checkToken, isAmapManager | `contractadmin/media.mtt` | none | none | catalogs-products-vendors |
| `doEdit` (29) | `/media/edit` | [draft 04 text] C18. [CONFIRMED] H/controller/Media.hx:97 comment "3Mb" vs 4 MB limit and error message "3 Mo" (:99); Media.doEdit offers only "public" visibility and default 'members' (... | isAmapManager | `form.mtt` | none | none | catalogs-products-vendors |
| `doDelete` (61) | `/media/delete` | (no draft description; from action name) delete | checkToken, isAmapManager | - | none | none | catalogs-products-vendors |
| `doInsert` (83) | `/media/insert` | see 2.1 (template adddocument/addmedia) | isAmapManager | `contractadmin/addmedia.mtt` | none | none | catalogs-products-vendors |

### 1.16 `camap-hx/src/controller/Member.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (28) | `/member` | members list; passes `groupId`, CSRF `token`, `basePath` | logged, checkToken | - | React members module shell | partial | groups-membership |
| `doView` (39) | `/member/view` | member sheet (orders, subscriptions, notification flags); `canLoginAs` flag (`Member.hx:49`); buttons: payments, movetowl, loginas, `_Camap.membershipBox` (`TPL/member/view.mtt:46,102,106,21... | canLoginAs, checkToken, isAdmin, isAmapManager | `member/view.mtt` | React members module + resolvers (camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts, waitingLists.resolver.ts) | partial | groups-membership |
| `doLoginas` (90) | `/member/loginas` | HX session switched to member (`session.setUser`), `amapId` cleared; the React module then calls GraphQL `loginAs` and `goTo('/')` (`FE/modules/loginRegistration/LoginAs.module.tsx:22-37`) | isAdmin, isAmapManager | - | `loginAs` mutation (auth.resolver.ts) | partial | users-auth |
| `doEdit` (109) | `/member/edit` | **empty body** (dead) | none visible in source | - | none (empty body, dead) | none | groups-membership |
| `doDelete` (116) | `/member/delete` | remove user from current group (see rule R30) | canAccessMembership, checkToken | - | `removeUsersFromGroup` (group-previews-members.resolver.ts) | partial | groups-membership |
| `doPayments` (141) | `/member/payments` | payments/balance/invoice (payments area; listed for completeness) | checkToken | - | React members module + resolvers (camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts, waitingLists.resolver.ts) | partial | groups-membership |
| `doBalance` (161) | `/member/balance` | payments/balance/invoice (payments area; listed for completeness) | none visible in source | - | React members module + resolvers (camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts, waitingLists.resolver.ts) | partial | groups-membership |
| `doInvoice` (179) | `/member/invoice` | payments/balance/invoice (payments area; listed for completeness) | none visible in source | - | React members module + resolvers (camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts, waitingLists.resolver.ts) | partial | groups-membership |
| `doMovetowl` (215) | `/member/movetowl` | move a member back to waiting list | none visible in source | - | `moveBackToWaitingList` (waitingLists.resolver.ts) | partial | groups-membership |

### 1.17 `camap-hx/src/controller/Messages.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (13) | `/messages` | (no draft description; from action name and template) default | none visible in source | `messages/default.mtt` | messages resolver (camap-ts/packages/api-core/src/messages/messages.resolver.ts); HX hosts the shell page | partial | messaging-mails |

### 1.18 `camap-hx/src/controller/Place.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (18) | `/place` | (no draft description; from action name) default | checkToken | - | read-only `place` query (camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts); no write | partial | catalogs-products-vendors |
| `doView` (25) | `/place/view` | (no draft description; from action name) view | none visible in source | - | read-only `place` query (camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts); no write | partial | catalogs-products-vendors |
| `doEdit` (39) | `/place/edit` | (no draft description; from action name) edit | none visible in source | - | read-only `place` query (camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts); no write | partial | catalogs-products-vendors |
| `doInsert` (67) | `/place/insert` | (no draft description; from action name and template) insert | none visible in source | `amapadmin/form.mtt` | read-only `place` query (camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts); no write | partial | catalogs-products-vendors |
| `doDelete` (89) | `/place/delete` | (no draft description; from action name) delete | checkToken, isAmapManager | - | read-only `place` query (camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts); no write | partial | catalogs-products-vendors |

### 1.19 `camap-hx/src/controller/Product.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doEdit` (34) | `/product/edit` | (no draft description; from action name) edit | canManageContract, checkToken | - | read fields and image upload only (camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts) | partial | catalogs-products-vendors |
| `doInsert` (103) | `/product/insert` | (no draft description; from action name and template) insert | isContractManager | `form.mtt` | read fields and image upload only (camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts) | partial | catalogs-products-vendors |
| `doDelete` (149) | `/product/delete` | (no draft description; from action name) delete | canManageContract, checkToken | - | read fields and image upload only (camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts) | partial | catalogs-products-vendors |
| `doCopyAndDiscard` (169) | `/product/copyAndDiscard` | (no draft description; from action name) copy and discard | canManageContract, checkToken | - | read fields and image upload only (camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts) | partial | catalogs-products-vendors |
| `doImport` (187) | `/product/import` | (no draft description; from action name) import | canManageContract | - | read fields and image upload only (camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts) | partial | catalogs-products-vendors |
| `doExport` (286) | `/product/export` | CSV of products (:311-322). | none visible in source | - | read fields and image upload only (camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts) | partial | catalogs-products-vendors |

### 1.20 `camap-hx/src/controller/Scripts.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (27) | `/scripts` | (no draft description; from action name) default | none visible in source | - | none | none | crons-scheduled-jobs |
| `doRecomputeBasketTotal` (32) | `/scripts/recomputeBasketTotal` | For every group, loads MDs in range, for every `Basket` of those MDs sets `b.total = b.getOrdersTotal()` (36-48). Dated 2023-01-06 in comment. | none visible in source | - | none | none | crons-scheduled-jobs |
| `doCleannonamapdata` (55) | `/scripts/cleannonamapdata` | (no draft description; from action name) cleannonamapdata | none visible in source | - | none | none | crons-scheduled-jobs |

### 1.21 `camap-hx/src/controller/Shop.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doProductInfo` (8) | `/shop/productInfo` | product popup only; the old shop controller is reduced to this. | none visible in source | - | none | none | orders-subscriptions |

### 1.22 `camap-hx/src/controller/SubscriptionAdmin.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (23) | `/subscriptionadmin` | (no draft description; from action name and template) default | canManageContract, checkToken | `contractadmin/subscriptionadmin/default.mtt` | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |
| `doDelete` (47) | `/subscriptionadmin/delete` | (no draft description; from action name) delete | canManageContract, checkToken | - | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |
| `doInsert` (64) | `/subscriptionadmin/insert` | Form POST: member select when creating (`::if !edit::`, 18-26), default-orders block if `catalog.hasDefaultOrdersManagement()` (35), per-product quantity + `user2` alternate member select fo... | canManageContract, checkToken, isMemberOf | `contractadmin/subscriptionadmin/editsubscription.mtt` | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |
| `doEdit` (195) | `/subscriptionadmin/edit` | (no draft description; from action name and template) edit | canManageContract, checkToken, isMemberOf | `contractadmin/subscriptionadmin/editsubscription.mtt` | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |
| `doPayments` (358) | `/subscriptionadmin/payments` | `SubscriptionAdmin.doPayments`, `doInsert`, `doEdit` (template-only gaps, see section 2) | canManageContract, checkToken | `contractadmin/subscriptionpayments.mtt` | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |
| `doBalanceTransfer` (383) | `/subscriptionadmin/balanceTransfer` | Shows the other not-closed subscriptions of the same user and same vendor (`SubscriptionService.getUserVendorNotClosedSubscriptions`, `SubscriptionService.hx:118-127`); with token, calls `Su... | canManageContract, checkToken | `contractadmin/subscriptionbalancetransfer.mtt` | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |
| `doInsertPayment` (421) | `/subscriptionadmin/insertPayment` | [draft 06 text] C9. [CONFIRMED] HX `SubscriptionAdmin.doInsertPayment` checks `isContractManager()` with no catalog (SubscriptionAdmin.hx:422) while all sibling actions use `canManageCon... | isContractManager | - | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |
| `doMassPayments` (469) | `/subscriptionadmin/massPayments` | (no draft description; from action name and template) mass payments | canManageContract, checkToken | `contractadmin/masspayments.mtt` | none (TS read-only: `catalog.subscriptions`, attendance sheets) | none | orders-subscriptions |

### 1.23 `camap-hx/src/controller/Subscriptions.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doContract` (23) | `/subscriptions/contract` | renders Neo `csaCatalog` with `getCurrentOrComingSubscription(app.user, catalog)` id. | none visible in source | `contract/order.mtt` | none (TS front links to it) | none | orders-subscriptions |
| `doDelete` (35) | `/subscriptions/delete` | `SubscriptionService.deleteSubscription`. GET link from the TS front (camap-ts/packages/front-core/src/modules/csaCatalog/containers/CsaCatalogSubscription.tsx:192-198). | none visible in source | - | none (TS front links to it) | none | orders-subscriptions |
| `doReattribute` (49) | `/subscriptions/reattribute` | `@admin`; only if user email is `deleted@camap.tld` or DEBUG (51) | admin | - | none (TS front links to it) | none | orders-subscriptions |

### 1.24 `camap-hx/src/controller/Transaction.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doInsertPayment` (21) | `/transaction/insertPayment` | Coordinator manually records a payment for a member. Form fields: name, amount, date, type (`PCManualEntry`), optional related operation (last 20 non-payment ops). | isContractManager | - | none (TS only validate/delete operation in camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts) | none | payments-operations-reports |
| `doEdit` (84) | `/transaction/edit` | Edit name, amount and date of an operation. Sets `pending=false` (:113). | canAccessMembership | - | none (TS only validate/delete operation in camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts) | none | payments-operations-reports |
| `doDelete` (125) | `/transaction/delete` | Delete an operation, then recompute the balance. Needs a CSRF token (:141). Order-type ops (VOrder, SubscriptionTotal) need an admin (:137). | canAccessMembership, checkToken, isAdmin | - | none (TS only validate/delete operation in camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts) | none | payments-operations-reports |

### 1.25 `camap-hx/src/controller/User.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (22) | `/user` | redirects to `/` if already logged; exposes `sid`; if cookie `Auth_sid` exists and differs from current sid -> `/user/logout`; sets `loginBoxOptions` (phone/address required from group flags... | none visible in source | `user/default.mtt` | `login`/`logout` (camap-ts/packages/api-core/src/auth/auth.resolver.ts), `quitGroup`/`quitGroupByControlKey` (camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts); password reset and join-group have no TS equivalent | partial | users-auth |
| `doLogin` (25) | `/user/login` | redirects to `/` if already logged; exposes `sid`; if cookie `Auth_sid` exists and differs from current sid -> `/user/logout`; sets `loginBoxOptions` (phone/address required from group flags... | none visible in source | `user/login.mtt` | `login` mutation (camap-ts/packages/api-core/src/auth/auth.resolver.ts); HX page hosts React `loginRegistration` | partial | users-auth |
| `doChoose` (56) | `/user/choose` | lists user's groups + waiting lists; selecting a group writes `session.data.amapId`, clears `order`/`newGroup`, redirect `/home` | logged, isGroupManager | `user/choose.mtt` | none (group selection is HX session `amapId`) | none | groups-membership |
| `doLogout` (82) | `/user/logout` | redirects to `/` if already logged; exposes `sid`; if cookie `Auth_sid` exists and differs from current sid -> `/user/logout`; sets `loginBoxOptions` (phone/address required from group flags... | none visible in source | - | `logout` mutation (camap-ts/packages/api-core/src/auth/auth.resolver.ts) | partial | users-auth |
| `doLogoutDeleteAuthenticationCookie` (98) | `/user/logoutDeleteAuthenticationCookie` | expire `Authentication` cookie (one cookie per redirect because Neko cannot send several Set-Cookie, comment `User.hx:92-94`) | none visible in source | - | `login`/`logout` (camap-ts/packages/api-core/src/auth/auth.resolver.ts), `quitGroup`/`quitGroupByControlKey` (camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts); password reset and join-group have no TS equivalent | partial | users-auth |
| `doLogoutDeleteAuthSidCookie` (107) | `/user/logoutDeleteAuthSidCookie` | expire `Auth_sid`, redirect `/user/login` | none visible in source | - | `login`/`logout` (camap-ts/packages/api-core/src/auth/auth.resolver.ts), `quitGroup`/`quitGroupByControlKey` (camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts); password reset and join-group have no TS equivalent | partial | users-auth |
| `doForgottenPassword` (121) | `/user/forgottenPassword` | 4-step password reset (see Flow 3.3) | none visible in source | `user/forgottenPassword.mtt` | none (only place where password is changed) | none | users-auth |
| `doJoingroup` (231) | `/user/joingroup` | logged user joins the **current session group** if `regOption==Open`; mails group contact if user was not yet member | isMemberOf | - | none | none | groups-membership |
| `doQuitGroup` (272) | `/user/quitGroup` | email-footer link, works logged-out; key = `sha1(KEY+groupId+userId)` (MD5 legacy accepted `User.hx:273-280`) | none visible in source | - | `quitGroup`, `quitGroupByControlKey` | partial | groups-membership |
| `doQuitGroupFromMessage` (313) | `/user/quitGroupFromMessage` | link from messaging footer; key = `sha1(KEY+groupId)`; needs login (redirects with `__redirect` if not) | none visible in source | - | `quitGroup` (HX hosts page) | partial | messaging-mails |

### 1.26 `camap-hx/src/controller/Vendor.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (15) | `/vendor` | Mail to the new subscriber: link to `https://::HOST:://subscriptions/contract/<catalogId>` (line 2: a literal double slash after the host, see I-9) and vendor page `/vendor/view/<id>`; text ... | none visible in source | - | TS vendors resolver: edit, claim, images, docs (camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts); create/search legacy HX | partial | catalogs-products-vendors |
| `doView` (22) | `/vendor/view` | `vendorProfile/VendorProfile.module` (BrowserRouter + `layout/VendorLayout`) | none visible in source | - | TS vendors resolver: edit, claim, images, docs (camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts); create/search legacy HX | partial | catalogs-products-vendors |
| `doDashboard` (42) | `/vendor/dashboard` | `vendorDashboard/VendorDashboard.module` (BrowserRouter + `layout/DashboardLayout`) | logged | - | TS vendors resolver: edit, claim, images, docs (camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts); create/search legacy HX | partial | catalogs-products-vendors |
| `doAddImage` (56) | `/vendor/addImage` | (no draft description; from action name) add image | logged, canManageVendor | - | TS vendors resolver: edit, claim, images, docs (camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts); create/search legacy HX | partial | catalogs-products-vendors |
| `doEdit` (64) | `/vendor/edit` | (no draft description; from action name) edit | logged, canManageVendor | - | TS vendors resolver: edit, claim, images, docs (camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts); create/search legacy HX | partial | catalogs-products-vendors |

### 1.27 `camap-hx/src/controller/admin/Admin.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (30) | `/admin` | superadmin user search/view/delete/usergroup sheet; delete calls TS bridge `delete-user` (`admin/User.hx:44-55`) | none visible in source | `admin/default.mtt` | none | none | admin-superadmin |
| `doTheme` (42) | `/admin/theme` | Form with one TextArea holding `Json.stringify(app.getTheme())`; on submit parses JSON and stores it in `Variable` key `whiteLabel` (`Admin.hx:52`). Parse error -> redirect `/admin/theme` wi... | none visible in source | `form.mtt` | none | none | admin-superadmin |
| `doEmails` (65) | `/admin/emails` | Super-admin sidebar. Links: `/admin/errors`, `/admin/emails`, `/admin/messages`, `/admin/attention`, `/admin/attentionAdmins`, `/admin/group`, `/admin/user` (14-20). `/db` link commented out... | none visible in source | `admin/emails.mtt` | none | none | admin-superadmin |
| `doUser` (90) | `/admin/user` | superadmin user search/view/delete/usergroup sheet; delete calls TS bridge `delete-user` (`admin/User.hx:44-55`) | none visible in source | - | none | none | admin-superadmin |
| `doGroup` (94) | `/admin/group` | superadmin group list (raw SQL with string concatenation `admin/Group.hx:21-55`), view, add self as member (`:98-102`), delete group (`:104-112`) | none visible in source | - | none | none | admin-superadmin |
| `doErrors` (102) | `/admin/errors` | Lists `sugoi.db.Error` rows (20/page, `ResultsBrowser`), 1-month per-day stats; optional `?user=<id>`; `?empty=1` runs `truncate table Error` | none visible in source | `admin/errors.mtt` | none | none | admin-superadmin |
| `doMessages` (147) | `/admin/messages` | `attMessage` (flash shown to ALL members of every group, `Main.hx:166-170`) and `homeMessage` (raw HTML on the group chooser page `lang/master/tpl/user/choose.mtt:3-6`) | none visible in source | - | none | none | admin-superadmin |
| `doAttention` (166) | `/admin/attention` | `attMessage` (flash shown to ALL members of every group, `Main.hx:166-170`) and `homeMessage` (raw HTML on the group chooser page `lang/master/tpl/user/choose.mtt:3-6`) | none visible in source | - | none | none | admin-superadmin |
| `doAttentionAdmins` (185) | `/admin/attentionAdmins` | Form (TextArea `attMessageAdmins` + Checkbox `msgAlert` "fond rouge"); writes `Variable` `attMessageAdmins` and `attMessageAdminsAlert` (`Admin.hx:197-198`). The message is shown as a sessio... | none visible in source | - | none | none | admin-superadmin |
| `doSuperadmins` (207) | `/admin/superadmins` | list users with `rights.has(Admin)` | none visible in source | - | none | none | admin-superadmin |

### 1.28 `camap-hx/src/controller/admin/Group.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (11) | `/admin/group` | superadmin group list (raw SQL with string concatenation `admin/Group.hx:21-55`), view, add self as member (`:98-102`), delete group (`:104-112`) | none visible in source | `admin/group/default.mtt` | none | none | admin-superadmin |
| `doView` (75) | `/admin/group/view` | (no draft description; from action name and template) view | admin, checkToken | `admin/group/view.mtt` | none | none | admin-superadmin |
| `doAddMe` (99) | `/admin/group/addMe` | (no draft description; from action name) add me | admin | - | none | none | admin-superadmin |
| `doDeleteGroup` (105) | `/admin/group/deleteGroup` | (no draft description; from action name) delete group | admin, checkToken | - | none | none | admin-superadmin |

### 1.29 `camap-hx/src/controller/admin/User.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (11) | `/admin/user` | superadmin user search/view/delete/usergroup sheet; delete calls TS bridge `delete-user` (`admin/User.hx:44-55`) | admin @tpl("admin/user/default.mtt") | `admin/user/default.mtt` | TS bridge `GET /bridge/auth/delete-user/:id` (camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts) called from HX | partial | admin-superadmin |
| `doSearch` (17) | `/admin/user/search` | (no draft description; from action name and template) search | admin @tpl("admin/user/search.mtt") | `admin/user/search.mtt` | TS bridge `GET /bridge/auth/delete-user/:id` (camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts) called from HX | partial | admin-superadmin |
| `doView` (36) | `/admin/user/view` | [draft 03 text] Notification flags / `Member.doView` display only / `updateUserNotifications` | admin @tpl("admin/user/view.mtt") | `admin/user/view.mtt` | TS bridge `GET /bridge/auth/delete-user/:id` (camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts) called from HX | partial | admin-superadmin |
| `doDelete` (44) | `/admin/user/delete` | [draft 03 text] C9. [CONFIRMED] TS `removeUsersFromGroup` pushes `userNotInGroup` errors but keeps the `null` entries, then calls `delete(ug)` on them (`group-previews-members.resolver.t... | admin, isAdmin | - | TS bridge `GET /bridge/auth/delete-user/:id` (camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts) called from HX | partial | admin-superadmin |
| `doUserGroup` (63) | `/admin/user/userGroup` | [draft 11 text] `admin/user/usergroup.mtt` (46 l.) / `controller/admin/User.hx:62-77` (`@admin` `doUserGroup(u,g)`) / Shows a member's `UserGroup`, last operations (`db.Operation.getLast... | admin | `admin/user/usergroup.mtt` | TS bridge `GET /bridge/auth/delete-user/:id` (camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts) called from HX | partial | admin-superadmin |

### 1.30 `camap-hx/src/controller/amapadmin/Volunteers.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (14) | `/amapadmin/volunteers` | [draft 03 text] HX / `/amapadmin` / `AmapAdmin.doDefault` `HX/controller/AmapAdmin.hx:74-81` / `TPL/amapadmin/default.mtt` / group admin dashboard; constructor gate `isAmapManager` (`Ama... | checkToken | `amapadmin/volunteers/default.mtt` | none (volunteer roles CRUD is HX only) | none | distributions-volunteers |
| `doInsertRole` (90) | `/amapadmin/volunteers/insertRole` | [draft 05 text] 6. [CONFIRMED] `Volunteers.doEditRole` forces `role.catalog = null` and is reachable for any role id (Volunteers.hx:166); `updateRoleToFuturesDistribs` does `md.volunteer... | none visible in source | `form.mtt` | none (volunteer roles CRUD is HX only) | none | distributions-volunteers |
| `doEditRole` (155) | `/amapadmin/volunteers/editRole` | [draft 05 text] 4. [CONFIRMED] hx `Distribution.hx` handlers without explicit rights checks: doInviteFarmers (479), doVolunteerRoles (873), doVolunteers (937), doListByProductUser (78), ... | none visible in source | - | none (volunteer roles CRUD is HX only) | none | distributions-volunteers |
| `doDeleteRole` (181) | `/amapadmin/volunteers/deleteRole` | [draft 05 text] 4. [CONFIRMED] hx `Distribution.hx` handlers without explicit rights checks: doInviteFarmers (479), doVolunteerRoles (873), doVolunteers (937), doListByProductUser (78), ... | checkToken | - | none (volunteer roles CRUD is HX only) | none | distributions-volunteers |

### 1.31 `camap-hx/src/controller/api/Catalog.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (14) | `/api/catalog` | catalog + products + vendor + distributions + constraints + absences | none visible in source | - | HX REST consumed by TS `csaCatalog` module | none | catalogs-products-vendors |
| `doCatalogAbsences` (48) | `/api/catalog/catalogAbsences` | absence window + possible absent distribs | none visible in source | - | HX REST consumed by TS `csaCatalog` module | none | catalogs-products-vendors |
| `doStocksPerProductDistribution` (57) | `/api/catalog/stocksPerProductDistribution` | `{productId:{distribId:stock}}` or empty | none visible in source | - | HX REST consumed by TS `csaCatalog` module | none | catalogs-products-vendors |
| `doSubscriptionAbsences` (77) | `/api/catalog/subscriptionAbsences` | owner or `canManageContract`; 403 if catalog has no absence management; 400 on empty list for non-manager | canManageContract, isContractManager | - | HX REST consumed by TS `csaCatalog` module | none | catalogs-products-vendors |

### 1.32 `camap-hx/src/controller/api/Distributions.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doUnsubscribeFromRole` (21) | `/api/distributions/unsubscribeFromRole` | `checkIsLogged`, caller must be the volunteer | checkIsLogged | - | HX REST consumed by TS `volunteersCalendar` module | none | distributions-volunteers |
| `doVolunteerRolesCalendar` (36) | `/api/distributions/volunteerRolesCalendar` | none explicit; uses `app.getCurrentGroup()` | none visible in source | - | HX REST consumed by TS `volunteersCalendar` module | none | distributions-volunteers |

### 1.33 `camap-hx/src/controller/api/Order.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doCatalogs` (12) | `/api/order/catalogs` | `{success, catalogs[{id,name,image}]}`, skips disabled vendors | none visible in source | - | HX REST consumed by TS front | none | orders-subscriptions |
| `doGet` (50) | `/api/order/get` | `checkIsLogged` + `canManageContract`/`canManageAllContracts` | checkIsLogged | - | HX REST consumed by TS front | none | orders-subscriptions |
| `doUpdate` (76) | `/api/order/update` | POST JSON `{orders:[{id,productId,qt,paid,invertSharedOrder,userId2}]}` | checkIsLogged | - | HX REST consumed by TS front | none | orders-subscriptions |
| `doUpdateOrderQuantity` (103) | `/api/order/updateOrderQuantity` | POST JSON `{id, qt}` | checkIsLogged | - | HX REST consumed by TS front | none | orders-subscriptions |

### 1.34 `camap-hx/src/controller/api/Places.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (13) | `/api/places` | GET only (405 otherwise) | none visible in source | - | none | none | catalogs-products-vendors |

### 1.35 `camap-hx/src/controller/api/Product.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (13) | `/api/product` | none found | none visible in source | - | HX REST consumed by TS front | none | catalogs-products-vendors |
| `doGet` (22) | `/api/product/get` | GET | none visible in source | - | HX REST consumed by TS front | none | catalogs-products-vendors |

### 1.36 `camap-hx/src/controller/api/Subscription.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (27) | `/api/subscription` | create: admin / catalog manager / group manager / self; closed orders blocked for non-managers | canManageContract, isAdmin, isGroupManager | - | HX REST consumed by TS `csaCatalog` / `batchOrder` modules | none | orders-subscriptions |
| `doUpdateOrders` (60) | `/api/subscription/updateOrders` | owner / admin / catalog manager | canManageContract, isAdmin, isGroupManager | - | HX REST consumed by TS `csaCatalog` / `batchOrder` modules | none | orders-subscriptions |
| `doUpdateDefaultOrder` (83) | `/api/subscription/updateDefaultOrder` | subscription JSON; `InvalidParameters` typed error on failure | canManageContract, isAdmin, isGroupManager | - | HX REST consumed by TS `csaCatalog` / `batchOrder` modules | none | orders-subscriptions |
| `doCheckDefaultOrder` (111) | `/api/subscription/checkDefaultOrder` | POST JSON `CSAOrder[]` | none visible in source | - | HX REST consumed by TS `csaCatalog` / `batchOrder` modules | none | orders-subscriptions |

### 1.37 `camap-hx/src/controller/api/User.hx`

| Action (line) | URL | Purpose | Rights (source scan) | Template | TS counterpart | TS status | Feature doc |
|---|---|---|---|---|---|---|---|
| `doDefault` (14) | `/api/user` | GET `infos()`; POST updates address1/address2/city/zipCode/phone for the **HX-session** user | none visible in source | - | none (`getToken` has no caller; `me` POST edits profile) | none | users-auth |
| `doMe` (18) | `/api/user/me` | GET `infos()`; POST updates address1/address2/city/zipCode/phone for the **HX-session** user | none visible in source | - | none (`getToken` has no caller; `me` POST edits profile) | none | users-auth |
| `doGetFromGroup` (45) | `/api/user/getFromGroup` | members of current group (needs Membership right or contract-manager); used by `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx:44` | logged, canAccessMembership, isContractManager | - | none (`getToken` has no caller; `me` POST edits profile) | none | users-auth |
| `doGetToken` (57) | `/api/user/getToken` | JWT signed with HX `key`; **no caller found** (grep) | logged | - | none (`getToken` has no caller; `me` POST edits profile) | none | users-auth |


## 2. Services (`camap-hx/src/service/`)

| Class | File (lines) | TS counterpart | Status | Feature doc |
|---|---|---|---|---|
| `AbsencesService` | `camap-hx/src/service/AbsencesService.hx` (197) | none (absences logic HX only, TS display) | none | distributions-volunteers |
| `BridgeService` | `camap-hx/src/service/BridgeService.hx` (112) | `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts` (+ `strategies/bridge.strategy.ts`) | partial | users-auth |
| `CatalogService` | `camap-hx/src/service/CatalogService.hx` (274) | `camap-ts/packages/api-core/src/vendors/services/catalogs.service.ts` (`create`/`update` exist, create has no caller) | partial | catalogs-products-vendors |
| `DistributionService` | `camap-hx/src/service/DistributionService.hx` (793) | none (no TS mutation for distributions) | none | distributions-volunteers |
| `GroupService` | `camap-hx/src/service/GroupService.hx` (74) | none (`camap-ts/packages/api-core/src/groups/services/groups.service.ts` is read/other, no equivalent logic cited) | none | groups-membership |
| `Mapbox` | `camap-hx/src/service/Mapbox.hx` (60) | front-core `utils/mapbox-geocoding.ts` (client geocoding); no server geocoding in TS | partial | catalogs-products-vendors |
| `MembershipService` | `camap-hx/src/service/MembershipService.hx` (57) | `camap-ts/packages/api-core/src/groups/services/memberships.service.ts` (membership CRUD TS only) | partial | groups-membership |
| `OrderService` | `camap-hx/src/service/OrderService.hx` (883) | none (read helpers only in `camap-ts/packages/api-core/src/payments/services/orders.service.ts`) | none | orders-subscriptions |
| `PaymentService` | `camap-hx/src/service/PaymentService.hx` (357) | `camap-ts/packages/api-core/src/payments/services/payments.service.ts` (duplicated; missing plugin event and display metadata) | partial | payments-operations-reports |
| `PlaceService` | `camap-hx/src/service/PlaceService.hx` (29) | none | none | catalogs-products-vendors |
| `ProductService` | `camap-hx/src/service/ProductService.hx` (224) | `camap-ts/packages/api-core/src/vendors/services/products.service.ts` (read/image only) | none | catalogs-products-vendors |
| `ReportService` | `camap-hx/src/service/ReportService.hx` (179) | none (client-side CSV/XLSX in front-core only) | none | payments-operations-reports |
| `SubscriptionService` | `camap-hx/src/service/SubscriptionService.hx` (1147) | none (`createOrUpdateTotalOperation` in csa-subscriptions.service.ts is buggy and unused) | none | orders-subscriptions |
| `UserService` | `camap-hx/src/service/UserService.hx` (76) | none (HX finder, mostly commented) | none | users-auth |
| `VendorService` | `camap-hx/src/service/VendorService.hx` (161) | `camap-ts/packages/api-core/src/vendors/services/vendor.service.ts` | partial | catalogs-products-vendors |
| `VolunteerService` | `camap-hx/src/service/VolunteerService.hx` (413) | `camap-ts/packages/api-core/src/groups/services/volunteers.service.ts` (read via loaders/resolvers) | partial | distributions-volunteers |
| `WaitingListService` | `camap-hx/src/service/WaitingListService.hx` (95) | `camap-ts/packages/api-core/src/groups/services/waitingLists.service.ts` | partial | groups-membership |


## 3. DB classes (`camap-hx/src/db/`, Haxe SPOD)

| Class (table) | File (lines) | TS counterpart (entity) | Status | Feature doc |
|---|---|---|---|---|
| `Basket` | `camap-hx/src/db/Basket.hx` (239) | `camap-ts/packages/api-core/src/shop/entities/basket.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | orders-subscriptions |
| `BufferedJsonMail` | `camap-hx/src/db/BufferedJsonMail.hx` (134) | `camap-ts/packages/api-core/src/mails/models/buffered-json-mail.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | messaging-mails |
| `Catalog` | `camap-hx/src/db/Catalog.hx` (423) | `camap-ts/packages/api-core/src/vendors/entities/catalog.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | catalogs-products-vendors |
| `Distribution` | `camap-hx/src/db/Distribution.hx` (229) | `camap-ts/packages/api-core/src/shop/entities/distribution.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | distributions-volunteers |
| `DistributionCycle` | `camap-hx/src/db/DistributionCycle.hx` (73) | `camap-ts/packages/api-core/src/shop/entities/distribution-cycle.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | distributions-volunteers |
| `Group` | `camap-hx/src/db/Group.hx` (466) | `camap-ts/packages/api-core/src/groups/entities/group.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | groups-membership |
| `Membership` | `camap-hx/src/db/Membership.hx` (21) | `camap-ts/packages/api-core/src/groups/entities/membership.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | groups-membership |
| `Message` | `camap-hx/src/db/Message.hx` (31) | `camap-ts/packages/api-core/src/entities/message.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | messaging-mails |
| `MultiDistrib` | `camap-hx/src/db/MultiDistrib.hx` (477) | `camap-ts/packages/api-core/src/shop/entities/multi-distrib.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | distributions-volunteers |
| `NotificationMail` | `camap-hx/src/db/NotificationMail.hx` (39) | `camap-ts/packages/api-core/src/mails/models/notification-mail.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | messaging-mails |
| `Operation` | `camap-hx/src/db/Operation.hx` (190) | `camap-ts/packages/api-core/src/payments/entities/operation.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | payments-operations-reports |
| `Place` | `camap-hx/src/db/Place.hx` (127) | `camap-ts/packages/api-core/src/places/models/place.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | catalogs-products-vendors |
| `Product` | `camap-hx/src/db/Product.hx` (348) | `camap-ts/packages/api-core/src/vendors/entities/product.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | catalogs-products-vendors |
| `ProductDistributionStock` | `camap-hx/src/db/ProductDistributionStock.hx` (54) | `camap-ts/packages/api-core/src/vendors/entities/productDistributionStock.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | catalogs-products-vendors |
| `Subscription` | `camap-hx/src/db/Subscription.hx` (196) | `camap-ts/packages/api-core/src/groups/entities/csa-subscription.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | orders-subscriptions |
| `User` | `camap-hx/src/db/User.hx` (631) | `camap-ts/packages/api-core/src/users/models/user.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | users-auth |
| `UserGroup` | `camap-hx/src/db/UserGroup.hx` (256) | `camap-ts/packages/api-core/src/groups/entities/user-group.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | groups-membership |
| `UserOrder` | `camap-hx/src/db/UserOrder.hx` (120) | `camap-ts/packages/api-core/src/shop/entities/user-order.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | orders-subscriptions |
| `Vendor` | `camap-hx/src/db/Vendor.hx` (217) | `camap-ts/packages/api-core/src/vendors/entities/vendor.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | catalogs-products-vendors |
| `Volunteer` | `camap-hx/src/db/Volunteer.hx` (19) | `camap-ts/packages/api-core/src/groups/entities/volunteer.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | distributions-volunteers |
| `VolunteerRole` | `camap-hx/src/db/VolunteerRole.hx` (16) | `camap-ts/packages/api-core/src/groups/entities/volunteer-role.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | distributions-volunteers |
| `WaitingList` | `camap-hx/src/db/WaitingList.hx` (20) | `camap-ts/packages/api-core/src/entities/waiting-list.entity.ts` (schema duplicated; business methods stay HX; field divergences in `inconsistencies-code.md`) | full (schema only) | groups-membership |

Note: draft 02 verified that 22 of 22 HX `db.*` classes are duplicated as TS entities. Sugoi tables (Session, Variable, File, EntityFile, Error, Cache, Permalink) live in the external sugoi library, not in this directory; TS has entities for them under `camap-ts/packages/api-core/src/tools/models/`.

## 4. Payment types (`camap-hx/src/payment/`)

| File | File (lines) | TS counterpart / note | Status | Feature doc |
|---|---|---|---|---|
| `Cash.hx` | `camap-hx/src/payment/Cash.hx` (23) | payment type catalogue duplicated in `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` (missing plugin event and display metadata) | partial | payments-operations-reports |
| `Check.hx` | `camap-hx/src/payment/Check.hx` (26) | payment type catalogue duplicated in `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` (missing plugin event and display metadata) | partial | payments-operations-reports |
| `MoneyPot.hx` | `camap-hx/src/payment/MoneyPot.hx` (24) | payment type catalogue duplicated in `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` (missing plugin event and display metadata) | partial | payments-operations-reports |
| `OnTheSpotCardTerminal.hx` | `camap-hx/src/payment/OnTheSpotCardTerminal.hx` (24) | payment type catalogue duplicated in `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` (missing plugin event and display metadata) | partial | payments-operations-reports |
| `OnTheSpotPayment.hx` | `camap-hx/src/payment/OnTheSpotPayment.hx` (31) | payment type catalogue duplicated in `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` (missing plugin event and display metadata) | partial | payments-operations-reports |
| `PaymentType.hx` | `camap-hx/src/payment/PaymentType.hx` (19) | payment type catalogue duplicated in `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` (missing plugin event and display metadata) | partial | payments-operations-reports |
| `Transfer.hx` | `camap-hx/src/payment/Transfer.hx` (23) | payment type catalogue duplicated in `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` (missing plugin event and display metadata) | partial | payments-operations-reports |


## 5. Tools (`camap-hx/src/tools/`)

| File | File (lines) | TS counterpart / note | Status | Feature doc |
|---|---|---|---|---|
| `ArrayTool.hx` | `camap-hx/src/tools/ArrayTool.hx` (61) | no counterpart cited in drafts | none | frontend-templates-i18n |
| `DateTool.hx` | `camap-hx/src/tools/DateTool.hx` (140) | TS uses date-fns-tz Paris conversions in entities; no equivalent file; `fromJs/toJs` unused (inconsistencies-code.md) | none | distributions-volunteers |
| `FloatTool.hx` | `camap-hx/src/tools/FloatTool.hx` (25) | rounding helpers: `roundPrice` in `camap-ts/packages/camap-common/src/utils/index.ts` (draft 06) | partial | payments-operations-reports |
| `ListSynchronizer.hx` | `camap-hx/src/tools/ListSynchronizer.hx` (67) | no counterpart cited in drafts | none | frontend-templates-i18n |
| `ObjectListTool.hx` | `camap-hx/src/tools/ObjectListTool.hx` (157) | no counterpart cited in drafts | none | frontend-templates-i18n |
| `StockTool.hx` | `camap-hx/src/tools/StockTool.hx` (82) | no counterpart cited in drafts | none | catalogs-products-vendors |
| `StringTool.hx` | `camap-hx/src/tools/StringTool.hx` (35) | no counterpart cited in drafts | none | frontend-templates-i18n |
| `Timeframe.hx` | `camap-hx/src/tools/Timeframe.hx` (43) | no counterpart cited in drafts | none | distributions-volunteers |


## 6. Server-side form widgets (`camap-hx/src/form/`)

| File | File (lines) | TS counterpart / note | Status | Feature doc |
|---|---|---|---|---|
| `CamapDatePicker.hx` | `camap-hx/src/form/CamapDatePicker.hx` (48) | TS neo module `haxe-date-picker` (date pickers in HX forms are rendered by TS, draft 05) | partial | frontend-templates-i18n |
| `CamapDateTimePicker.hx` | `camap-hx/src/form/CamapDateTimePicker.hx` (12) | TS neo module `haxe-date-picker` | partial | frontend-templates-i18n |
| `CamapForm.hx` | `camap-hx/src/form/CamapForm.hx` (58) | server-side sugoi form widget rendered by `form.mtt`; no TS equivalent | none | frontend-templates-i18n |
| `CamapTimePicker.hx` | `camap-hx/src/form/CamapTimePicker.hx` (12) | TS neo module `haxe-date-picker` | partial | frontend-templates-i18n |
| `ColorRadioGroup.hx` | `camap-hx/src/form/ColorRadioGroup.hx` (46) | server-side sugoi form widget rendered by `form.mtt`; no TS equivalent | none | frontend-templates-i18n |
| `ProductTypeRadioGroup.hx` | `camap-hx/src/form/ProductTypeRadioGroup.hx` (50) | server-side sugoi form widget rendered by `form.mtt`; no TS equivalent | none | frontend-templates-i18n |
| `RawHtml.hx` | `camap-hx/src/form/RawHtml.hx` (26) | server-side sugoi form widget rendered by `form.mtt`; no TS equivalent | none | frontend-templates-i18n |
| `StockTrackingPerDistribForm.hx` | `camap-hx/src/form/StockTrackingPerDistribForm.hx` (234) | server-side sugoi form widget rendered by `form.mtt`; no TS equivalent | none | frontend-templates-i18n |
| `UnitQuantity.hx` | `camap-hx/src/form/UnitQuantity.hx` (27) | server-side sugoi form widget rendered by `form.mtt`; no TS equivalent | none | frontend-templates-i18n |


## 7. Mail (`camap-hx/src/mail/`)

| File | File (lines) | TS counterpart / note | Status | Feature doc |
|---|---|---|---|---|
| `BufferedJsonMailer.hx` | `camap-hx/src/mail/BufferedJsonMailer.hx` (60) | TS sends the queue (`camap-ts/packages/api-core/src/mails/mails.service.ts`); HX only writes rows (sending code commented in `db/BufferedJsonMail.hx:77-123`) | partial | messaging-mails |


## 8. Haxe tests (`camap-hx/src/test/`)

| File | File (lines) | TS counterpart / note | Status | Feature doc |
|---|---|---|---|---|
| `TestDistributions.hx` | `camap-hx/src/test/TestDistributions.hx` (409) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |
| `TestOrders.hx` | `camap-hx/src/test/TestOrders.hx` (440) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |
| `TestPayments.hx` | `camap-hx/src/test/TestPayments.hx` (91) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |
| `TestReports.hx` | `camap-hx/src/test/TestReports.hx` (84) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |
| `TestSubscriptions.hx` | `camap-hx/src/test/TestSubscriptions.hx` (548) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |
| `TestSuite.hx` | `camap-hx/src/test/TestSuite.hx` (483) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |
| `TestTools.hx` | `camap-hx/src/test/TestTools.hx` (151) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |
| `TestUser.hx` | `camap-hx/src/test/TestUser.hx` (38) | Haxe test, not wired in any build file (draft 10); TS tests are separate Jest specs | none | frontend-templates-i18n |


## 9. Haxe-JS / Haxe-React (`camap-hx/js/**`, compiled to `camap-hx/www/js/app.js`)

Legacy client layer: `_Camap` global helpers called from template `onclick` handlers, plus a Haxe-React 16 + Redux + material-ui v4 "order box". Built by `camap-hx/frontend/build.hxml` (always `-debug`).

| File | File (lines) | TS counterpart / note | Status | Feature doc |
|---|---|---|---|---|
| `App.hx` | `camap-hx/js/App.hx` (676) | `_Camap` helpers (login box, membership box, etc.) mount TS neo modules (`camap-ts/packages/front-core/src/neo.tsx`); 8 helper functions have no caller (inconsistencies-code.md) | partial | frontend-templates-i18n |
| `bootstrap/Modal.hx` | `camap-hx/js/bootstrap/Modal.hx` (9) | Bootstrap modal wrapper | none | frontend-templates-i18n |
| `react/mui/CamapTheme.hx` | `camap-hx/js/react/mui/CamapTheme.hx` (149) | TS theme in front-core (`theme/default/theme.ts`) | partial | frontend-templates-i18n |
| `react/order/OrdersDialog.hx` | `camap-hx/js/react/order/OrdersDialog.hx` (66) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/actions/OrderBoxAction.hx` | `camap-hx/js/react/order/redux/actions/OrderBoxAction.hx` (23) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/actions/thunk/OrderBoxThunk.hx` | `camap-hx/js/react/order/redux/actions/thunk/OrderBoxThunk.hx` (198) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/components/Catalog.hx` | `camap-hx/js/react/order/redux/components/Catalog.hx` (33) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/components/CatalogSelector.hx` | `camap-hx/js/react/order/redux/components/CatalogSelector.hx` (71) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/components/CatalogsBox.hx` | `camap-hx/js/react/order/redux/components/CatalogsBox.hx` (42) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/components/Error.hx` | `camap-hx/js/react/order/redux/components/Error.hx` (29) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/components/InsertOrder.hx` | `camap-hx/js/react/order/redux/components/InsertOrder.hx` (58) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/components/Order.hx` | `camap-hx/js/react/order/redux/components/Order.hx` (245) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/components/OrderBox.hx` | `camap-hx/js/react/order/redux/components/OrderBox.hx` (252) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/order/redux/reducers/OrderBoxReducer.hx` | `camap-hx/js/react/order/redux/reducers/OrderBoxReducer.hx` (157) | legacy order box (HX REST + Haxe-React); TS replacement for members is the `csaCatalog` module, back-office orders stay HX (draft 06) | none | orders-subscriptions |
| `react/product/Product.hx` | `camap-hx/js/react/product/Product.hx` (39) | none | none | catalogs-products-vendors |
| `react/product/redux/components/ProductSelect.hx` | `camap-hx/js/react/product/redux/components/ProductSelect.hx` (68) | none | none | catalogs-products-vendors |
| `react/user/redux/components/UserSelector.hx` | `camap-hx/js/react/user/redux/components/UserSelector.hx` (102) | none | none | orders-subscriptions |
| `utils/HttpUtil.hx` | `camap-hx/js/utils/HttpUtil.hx` (104) | HTTP helper (PATCH sends GET, unused) | none | frontend-templates-i18n |

## 10. Shared (`camap-hx/common/`)

| File (lines) | TS counterpart | Status | Feature doc |
|---|---|---|---|
| `camap-hx/common/Common.hx` (337) | `camap-ts/packages/camap-common/src/` (theme.ts, products/interfaces.ts, ...): enums and Theme duplicated, fields differ (inconsistencies-code.md) | partial | frontend-templates-i18n |
| `camap-hx/common/Formatting.hx` (284) | `camap-ts/packages/camap-common/src/utils/index.ts`, `products/format.ts` (formatting helpers) | partial | frontend-templates-i18n |
| `camap-hx/common/GitMacros.hx` (82) | none (build macro; git macros commented out in `App.hx:21`) | none | admin-superadmin |

## 11. Templates (`camap-hx/lang/master/tpl/**`, Templo `.mtt`)

| Directory | Count | Note |
|---|---|---|
| `.vscode/` | 0 |  |
| `account/` | 3 | account page, quit-group, notification edit; shells for React `userAccount`, `quitGroup`, `editNotifications` |
| `admin/` | 12 | superadmin back-office (admin/*, `basedesign.mtt`) |
| `amap/` | 1 | group page and settings form |
| `amapadmin/` | 6 | group admin dashboard, rights, forms |
| `attention/` | 1 | attention page (mounts unregistered neo module, see code inconsistencies) |
| `block/` | 1 | shared block(s) |
| `contract/` | 4 | member-side contract/order pages and legacy insert flow |
| `contractadmin/` | 29 | catalog back-office (incl. `subscriptionadmin/`), orders, roles, documents, media |
| `distribution/` | 10 | distribution planning, lists (`listByDate*`), cycles, volunteers |
| `group/` | 4 | group public page, list, create |
| `history/` | 4 | member history, baskets, subscription orders/payments |
| `mail/` | 14 | Templo mail templates (14, including `notifications/`); TS mails use Twing under api-core `mails/` |
| `member/` | 6 | members shells and member sheet, invoice, payments |
| `messages/` | 1 | shell for React messages module |
| `place/` | 1 | place views |
| `product/` | 1 | product form/import views |
| `shop/` | 1 | product popup |
| `user/` | 4 | login, choose group, forgotten password |
| `vendor/` | 1 |  |
| (root) | 12 | `base.mtt`, `cssDemo.mtt`, `design.mtt`, `empty.mtt`, `error.mtt`, `form.mtt`, `home.mtt`, `invite.mtt`, `macros.mtt`, `maintain.mtt`, `neo.mtt`, `neoPublic.mtt` |
| **Total** | **116** | `lang/fr/tpl` is a generated, gitignored copy |

## 12. Coverage summary

Units counted: controller actions, services, DB classes, payment types, tools, form widgets, mail, tests, Haxe-JS files, common files. Templates (116 files) are not statused (views of the HX controllers; they disappear with them). "full (schema only)" = DB class duplicated as TS entity; business methods stay in Haxe.

| Kind | none | partial | full | full (schema only) | Total |
|---|---|---|---|---|---|
| Controller action | 137 | 106 | 0 | 0 | 243 |
| Service | 9 | 8 | 0 | 0 | 17 |
| DB class | 0 | 0 | 0 | 22 | 22 |
| Payment type | 0 | 7 | 0 | 0 | 7 |
| Tool | 7 | 1 | 0 | 0 | 8 |
| Form widget | 6 | 3 | 0 | 0 | 9 |
| Mail | 0 | 1 | 0 | 0 | 1 |
| Test | 8 | 0 | 0 | 0 | 8 |
| Haxe-JS/React | 16 | 2 | 0 | 0 | 18 |
| Common | 1 | 2 | 0 | 0 | 3 |
| **Total** | **184** | **130** | **0** | **22** | 336 |

Documentation gaps: 55 of 243 controller actions have no description in any draft (purpose column reads "(no draft description ...)"); 13 have only a free-text mention. Items the coverage critic flagged as uncovered and that remain thin: `Distribution.doEditMd`, `Distribution.doChangePrice`, `Install.doDiagnostics`, `Main.doCssdemo`, `Admin.doTheme`, `Admin.doAttentionAdmins`, `ContractAdmin.doVendorsByTimeFrame`, `Scripts.doRecomputeBasketTotal`, `SubscriptionAdmin.doBalanceTransfer` (described in `11-gaps.md` section 1.1).

Caveats: TS status at action level is coarse (controller default plus overrides from the ownership tables); purpose text is mechanically extracted from draft route-table rows and can be imprecise on rows shared by several actions; rights are a source scan, not an audit.
