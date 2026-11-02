# Payments, operations, balances, reports and exports

## 1. Scope

The `Operation` table (debts and payments), per-user-per-group balance, payment types and group payment configuration, subscription balance and total operations, manual payment entry/edit/delete, TS validate/delete operation mutations, membership operations, and the server-side and client-side reports/exports (orders, subscriptions, stats, attendance, invoice). Subscription lifecycle is in `orders-subscriptions.md`; membership settings in `groups-membership.md`.

Ownership summary: reports and exports are almost entirely Haxe (server-side CSV and printable HTML); no PDF/XLS generation in HX. TS front-core builds CSV and XLSX in the browser (ExcelJS, react-csv, file-saver). There is no TS controller or REST endpoint for payments.

## 2. Concepts & glossary terms

- **Operation**: all money movements, scoped to (user, group). HX entity `camap-hx/src/db/Operation.hx:29`, TS entity `camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:43`; both map the same MySQL table.
- **Operation types** (tinyint; `camap-hx/src/db/Operation.hx:5-10`, `camap-ts/packages/api-core/src/payments/OperationType.ts:1-6`): 0 = order on a variable-order catalog (debt; `VOrder` in HX, `Order` in TS), 1 = `SubscriptionTotal` (debt), 2 = `Payment`, 3 = `Membership` (debt).
- **Balance**: `UserGroup.balance`, recomputed by `PaymentService.updateUserBalance` (HX `camap-hx/src/service/PaymentService.hx:343-354`, TS `camap-ts/packages/api-core/src/payments/services/payments.service.ts:280-296`).
- **Subscription balance**: separate from the group balance (rule 5).
- **Payment types**: fixed in code; group acceptance stored as JSON array in `Group.allowedPaymentsType` (HX getter/setter `camap-hx/src/db/Group.hx:450-459`, TS column `camap-ts/packages/api-core/src/groups/entities/group.entity.ts:200`).
- **`PaymentType` base class** (HX `camap-hx/src/payment/PaymentType.hx`, 18 l.): fields `type` (unique id), `icon`, `name`, `link`, `onTheSpot`, `publicDesc`, `adminDesc`, `docLink`; subclasses `Cash`, `Check`, `OnTheSpotPayment`, `MoneyPot`, `Transfer`, `OnTheSpotCardTerminal`; `OnTheSpotPayment.allowedPaymentTypes` (`camap-hx/src/payment/OnTheSpotPayment.hx:12`); `Operation.getPaymentType()` returns the string id (`camap-hx/src/db/Operation.hx:89`). TS has the enum `camap-ts/packages/api-core/src/payments/OperationType.ts` and `camap-ts/packages/api-core/src/payments/interfaces.ts:8-50`, no class hierarchy.
- **Payment contexts** (`PCAll`, `PCGroupAdmin`, `PCPayment`, `PCManualEntry`).
- **pending**: operation flag; created `true` by `makePaymentOperation`, cleared by validate/edit; ignored by the balance query.
- **Operation.relation**: a payment points to the debt operation it pays.

Payment types (values from `camap-hx/src/payment/*.hx`, mirrored in `camap-ts/packages/api-core/src/payments/interfaces.ts:8-50`):

| id | onTheSpot | HX | TS |
|---|---|---|---|
| `cash` | true | `camap-hx/src/payment/Cash.hx:10,15` | `camap-ts/packages/api-core/src/payments/interfaces.ts:22-25` |
| `check` | true | `camap-hx/src/payment/Check.hx:9,14` | `interfaces.ts:27-30` |
| `transfer` | false | `camap-hx/src/payment/Transfer.hx:10,15` | `interfaces.ts:32-35` |
| `card-terminal` | true | `camap-hx/src/payment/OnTheSpotCardTerminal.hx:9,14` | `interfaces.ts:47-50` |
| `onthespot` (virtual) | false | `camap-hx/src/payment/OnTheSpotPayment.hx:11,17` | `interfaces.ts:42-45` |
| `moneypot` | false | `camap-hx/src/payment/MoneyPot.hx:10,15` | `interfaces.ts:37-40` |

`MoneyPot` is commented out of the "all types" list in both stacks (`camap-hx/src/service/PaymentService.hx:263`, `camap-ts/packages/api-core/src/payments/services/payments.service.ts:84`) but still referenced by admin validation (rule 4) and `PCManualEntry`.

Per-context lists: HX `PaymentService.getPaymentTypes` (`camap-hx/src/service/PaymentService.hx:251-313`), TS `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134`.

| context | result |
|---|---|
| `PCAll` | cash, check, transfer, onthespot, card-terminal. HX also fires plugin event `GetPaymentTypes` and uses its result (`camap-hx/src/service/PaymentService.hx:267-271`); TS has no such hook |
| `PCGroupAdmin` | `PCAll` minus `onthespot` |
| `PCPayment` | walks the group's allowed types; non-onTheSpot types kept; if any onTheSpot type (cash, check, card-terminal) allowed, a single virtual `onthespot` entry is appended; `[]` if none allowed |
| `PCManualEntry` | `PCGroupAdmin` minus `moneypot` |

## 3. Routes & endpoints

### 3.1 HX payment pages

| side | route | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `/transaction/insertPayment/<userId>` | `camap-hx/src/controller/Transaction.hx:21` | `isContractManager()` (`:25`) (any ContractAdmin right; target user not verified to belong to the session group) | `form.mtt` | coordinator records a payment for a member; fields name, amount, date, type (`PCManualEntry`), optional related operation (last 20 non-payment ops); marks both ops non-pending if `t2.amount + operation.amount == 0` (no rounding, `:64`); sets `relation` only when "unpaid" chosen (`:61-70`) |
| HX | `/transaction/edit/<opId>` | `camap-hx/src/controller/Transaction.hx:84` | `canAccessMembership()` and same group (`:92`) | `form.mtt` | edit name, amount, date; sets `pending=false` (`:113`); fires `PreOperationEdit` (`:100`); `operation.subscription.id` read at `:89` before the null check (`:96`) |
| HX | `/transaction/delete/<opId>` | `camap-hx/src/controller/Transaction.hx:125` | `canAccessMembership()` and same group (`:132`); CSRF token (`:141`); VOrder/SubscriptionTotal need admin (`:137`) | none | delete then recompute balance; fires `PreOperationDelete` (`:134`); same early deref (`:128-129`) |
| HX | `/contractAdmin/subscriptions/payments/<subId>` | `camap-hx/src/controller/SubscriptionAdmin.hx:358` | `canManageContract` (`:359`) | `camap-hx/lang/master/tpl/contractadmin/subscriptionpayments.mtt` | lists total operation and payments; active catalog -> `createOrUpdateTotalOperation` (`:363-364`) |
| HX | `/contractAdmin/subscriptions/insertPayment/<subId>` | `camap-hx/src/controller/SubscriptionAdmin.hx:421` | `isContractManager()` (`:422`) | form | amount pre-filled with abs of a negative balance (`:434-437`); check default type (`:442-447`); op with `subscription` set, `pending=false` (`:451-459`); sets no `relation` |
| HX | `/contractAdmin/subscriptions/masspayments/<catalogId>` | `camap-hx/src/controller/SubscriptionAdmin.hx:469` | `canManageContract` (`:471`) | form | bulk entry; calls `makePaymentOperation`, then sets `subscription` and `pending=false` (`:506-509`); empty-amount rows skipped |
| HX | `/contractAdmin/subscriptions/balanceTransfer/<subId>` | `camap-hx/src/controller/SubscriptionAdmin.hx:382-415` | `canManageContract` | `contractadmin/subscriptionbalancetransfer.mtt` | see `orders-subscriptions.md` rule 19 |
| HX | `/history/subscriptionPayments/<subId>` | `camap-hx/src/controller/History.hx:107-121` | logged + member of current group; no ownership check | `camap-hx/lang/master/tpl/history/subscriptionpayments.mtt` | member view of the same table |
| HX | `/member/payments/<userId>` | `camap-hx/src/controller/Member.hx:141` | `/member` constructor gate (`:23`) | `camap-hx/lang/master/tpl/member/payments.mtt` | operations history, 10 per page, newest first; recomputes balance first (`:143`) |
| HX | `/member/balance` | `camap-hx/src/controller/Member.hx:161` | same | `camap-hx/lang/master/tpl/member/balance.mtt` | group-wide lists balance == 0, > 0, < 0; `?refresh=1` recomputes everyone (`:163-168`) |
| HX | `/member/invoice/<userId>/<multiDistribId>` | `camap-hx/src/controller/Member.hx:177` | same | `camap-hx/lang/master/tpl/member/invoice.mtt` | printable invoice grouped by vendor and VAT |
| HX | `/history` | `camap-hx/src/controller/History.hx:28` | `@logged` | `camap-hx/lang/master/tpl/history/default.mtt` | current user's history; recomputes balance (`:31`) |
| HX | `/amapadmin/payments` | `camap-hx/src/controller/AmapAdmin.hx:292` | group admin | form | allowed payment types and IBAN (`:292-335`) |
| HX | `/transaction/cash`, `/check`, `/transfer`, `/cardTerminal`, `/onthespot`, `/moneypot` | `link` fields in `camap-hx/src/payment/*.hx` (e.g. `Cash.hx:19`, `Transfer.hx:19`) | n/a | n/a | referenced as links; `Transaction.hx` defines only `doInsertPayment` (`:21`), `doEdit` (`:84`), `doDelete` (`:125`) |

### 3.2 HX exports and reports

| side | route | handler path:line | format and columns | notes |
|---|---|---|---|---|
| HX | `/contractAdmin/exportSubscriptions` | `camap-hx/src/controller/ContractAdmin.hx:431` | CSV `:444-448`: subscriptionId, userId, userName, userEmail, userPhone, user2Name, vendorName, catalogId, catalogName, startDate, endDate, totalPrice, paymentsTotal, balance, paid | data from `getSubscriptionsExportData` (`camap-hx/src/service/SubscriptionService.hx:71-95`); `paid` = "oui"/"non" |
| HX | `/contractAdmin/ordersByTimeFrame?csv` | `camap-hx/src/controller/ContractAdmin.hx:349`, CSV `:599-657` | CSV: quantity, pname, ref, priceHT, priceTTC, totalHT, totalTTC; blank line, vendor-name line, product lines, total per vendor | route name inferred from `doOrdersByTimeFrame`; the CSV block `:599` sits in a different function (declaration not read); uses `o.totalHT` as is (merge bug, rule 15) |
| HX | `/contractAdmin/vendorsByTimeFrame/<from>/<to>[?csv=1]` | `camap-hx/src/controller/ContractAdmin.hx:545-640` | "Totals per supplier": active catalogs of the group (restricted to manageable unless `isAmapManager`, `:556-561`); distributions in range (error "There is no delivery during this period" if none, `:566-568`); aggregates `ReportService.getOrdersByProduct(d)` per vendor summing quantity/totalHT/totalTTC (`:572-595`); `?csv=1` CSV (`:599+`) | auth: `ContractAdmin` constructor `isContractManager()` (`:29-33`); template `camap-hx/lang/master/tpl/contractadmin/vendorsByTimeFrame.mtt` (67 l.; export button `:9`); linked from `ordersByTimeFrame.mtt:13` and `ordersByDate.mtt:31`; TS counterpart none (attendance queries are per-contract sheets) |
| HX | `/contractAdmin/orders/<catalogId>?d=<distribId>&csv=1` | `camap-hx/src/controller/ContractAdmin.hx:668`, CSV `:725-747` | CSV: name, productName, price, quantity, fees, total, paid | file name `<group> - Delivery <catalog> <date> - Per member` |
| HX | `/contractAdmin/ordersByProduct/<catalogId>?d=&csv` | `camap-hx/src/controller/ContractAdmin.hx:917`, `ReportService.getOrdersByProduct(d, csv)` `:930` | CSV (`camap-hx/src/service/ReportService.hx:93-103`): quantity, pname, ref, priceHT, priceTTC, totalHT, totalTTC | file name `Export-<name>-par produits` |
| HX | `/contractAdmin/ordersByProductList/<catalogId>` | `camap-hx/src/controller/ContractAdmin.hx:940` | HTML "purchase order to print" | no CSV |
| HX | `/contractAdmin/stats` (stat=1) `?csv` | `camap-hx/src/controller/ContractAdmin.hx:1077-1079` (`doStats` `:1036`) | CSV: quantity, productId, name, price, percent | |
| HX | `/distribution/listByDate/<date>/<placeId>/<type>/<fontSize>` | `camap-hx/src/controller/Distribution.hx:143` | HTML sheets; `type=="csv"` (`:206-229`) CSV: userId, userName, productName, ref, catalogName, catalogId, vendorId, price, quantity, fees, total, paid | form never offers "csv" (`:154-159`); see `distributions-volunteers.md` |
| HX | `/product/export/<catalogId>` | `camap-hx/src/controller/Product.hx:286` | CSV of products (`:311-322`) | see `catalogs-products-vendors-places.md` |

`ReportService` (`camap-hx/src/service/ReportService.hx`): `getOrdersByProduct` (`:13`) raw SQL aggregate grouped by ref, name and price, `AVG(productPrice)` and `AVG(vat)` (`:29-30`), total `SUM(quantity*productPrice)` (`:32`), `priceHT`/`totalHT` from `ProductService.getHTPrice` (`:51,55`), multi-weight quantity = record count (`:75-84`); `getTurnoverFromOrdersByProducts` (`:111`) sums HT and TTC; `getMultiDistribVendorOrdersByProduct` (`:125`) merges per-vendor distributions across a multi-distribution, adding only `quantity` and `totalTTC` for duplicates (`:153-154`); `getOrdersByVAT` (`:167`) groups totals by VAT rate, key `round(vat*100)`, HT = `total/(1+vat/100)` unrounded (`:173-174`); `Member.doInvoice` duplicates that logic inline (`camap-hx/src/controller/Member.hx:177-200`, HT `:~188-195`). Tests: `camap-hx/src/test/TestReports.hx:28`, `camap-hx/src/test/TestPayments.hx:24,67`.

### 3.3 TS (GraphQL, NestJS)

| side | operation | handler path:line | auth/rights | purpose |
|---|---|---|---|---|
| TS | mutation `validateOperation(id, type?)` | `camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:27-37` (`schema.gql:608`) | `canManageAllCatalogs` (`:91-103`) | sets `pending=false`, optionally rewrites `data.type`, recomputes balance (`camap-ts/packages/api-core/src/payments/services/payments.service.ts:383-402`); `@TransactionalMutation` |
| TS | mutation `deleteOperation(id)` | `camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:39-54` (`schema.gql:609`) | same | deletes op then recomputes balance (`:48`) |
| TS | fields `Operation.data`, `Operation.relatedPayments` | `camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:56-70` | | `relatedPayments` via DataLoader |
| TS | mutations `createMembership(s)` | `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:149,195` | Membership right | debt + payment op (rule 9) |
| TS | field `CsaSubscription.balance` | `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:12-66` | | see `orders-subscriptions.md` |

Client-side exports (front-core): attendance sheet CSV (`;` delimiter) and XLSX through ExcelJS (`camap-ts/packages/front-core/src/components/attendanceSheet/attendanceSheet.utils.ts:2,24-78,99,224-227`; buttons `camap-ts/packages/front-core/src/components/attendanceSheet/components/AttendanceActions.tsx:30,40`); vendor distributions CSV with columns AMAP, Produit and one per distribution date, UTF-8 BOM, `;`, file `distributions_<vendor>_<date>.csv` (`camap-ts/packages/front-core/src/modules/vendorDashboard/vendorDistribsCsv.utils.ts:10-73`); members list CSV via react-csv (`camap-ts/packages/front-core/src/modules/members/containers/MembersTableAndActions.tsx:20,161-171,310`). No TS payment page or payment CSV exists; front-core only displays `subscription.balance` (`camap-ts/packages/front-core/src/modules/csaCatalog/containers/CsaCatalogSubscriptionSold.tsx:28-43`). Apart from `createMembership(s)`, nothing in api-core creates operations; `makePaymentOperation` and `makeNonPaymentOperation` have no other non-test caller. `validateOperation`/`deleteOperation` appear in `camap-ts/packages/front-core/src/gql/index.tsx` only (no component usage found).

## 4. Business rules

1. Sign convention: debts (SubscriptionTotal, VOrder, Membership) are negative; payments positive (`camap-hx/src/service/PaymentService.hx:119`, `camap-hx/src/service/SubscriptionService.hx:1079`, `camap-ts/packages/api-core/src/groups/services/memberships.service.ts:121-126`, `camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:167`).
2. Balance: `UserGroup.balance = round2(SUM(Operation.amount))` for (user, group), but only operations joined to a Subscription whose `YEAR(startDate) > 2022` (`camap-hx/src/service/PaymentService.hx:350-352`; TS `camap-ts/packages/api-core/src/payments/services/payments.service.ts:282-294`, same SQL, same hardcoded 2022). Operations with `subscriptionId = NULL` (VOrder, Membership and its payment, manual payments from `Transaction.doInsertPayment`) are not counted. The pending-aware query is commented out (`camap-hx/src/service/PaymentService.hx:346`); the comment at `:347-349` ("subscription.endDate < 1 Jan 2021") does not match the code. TS has a duplicated `getUserBalance` with an identical query and no caller (`camap-ts/packages/api-core/src/payments/services/payments.service.ts:280-316`).
3. Balance triggers: `updateUserBalance` after every create/update/delete of an operation: `camap-hx/src/service/PaymentService.hx:62,74,128,165`; `camap-hx/src/controller/Transaction.hx:73,115,144`; `camap-hx/src/controller/SubscriptionAdmin.hx:460`; `camap-hx/src/service/SubscriptionService.hx:701,836,1087,1127-1129`; `camap-hx/src/controller/Member.hx:143,166`; `camap-hx/src/controller/History.hx:31`. Viewing `/member/payments`, `/history`, `/member/balance?refresh=1` also recomputes. TS: `makePaymentOperation`, `updatePaymentOperation`, `validatePayment` in `payments.service.ts`, `operation.resolver.ts:48`, `memberships.service.ts:175`.
4. Group payment configuration: admin form offers `PCGroupAdmin` types (`camap-hx/src/controller/AmapAdmin.hx:292-296`); saving requires at least one type (`:321-323`); `moneypot` cannot be combined with others (`:325-327`); stores group IBAN (`:329`); new groups default `[cash, check]` (`camap-hx/src/controller/Group.hx:160`); null/invalid JSON yields `[]` (`camap-hx/src/db/Group.hx:454-459`). TS only reads the column (no setter in api-core).
5. Subscription balance: `getBalance() = round2(paymentsTotal - totalPrice)` (`camap-hx/src/db/Subscription.hx:65-67`); `paymentsTotal` sums only `Payment` operations with this subscription (`:50-60`); `totalPrice` sums `round2(quantity*productPrice)` (`:32-39`); `paid()` = `balance >= 0` (`:24-27`). TS equivalent `camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:104-137` does not round (`:113-130`) and uses `computeUserOrdersAmount` (`camap-ts/packages/camap-common/src/utils/index.ts:39-48`). The TS resolver `balance` sums all operations including the negative total (`camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:22-30`). HX VOrder includes fees (`camap-hx/src/service/PaymentService.hx:98-104`) while the subscription total does not.
6. SubscriptionTotal operation: one per (user, subscription), created/updated by `createOrUpdateTotalOperation` (`camap-hx/src/service/SubscriptionService.hx:1059-1091`): name "Total Commandes", `amount = -getTotalPrice()`, `date = now` when the amount changed, `pending=false`. Called at subscription creation/orders change (`camap-hx/src/service/SubscriptionService.hx:696,962,1017`) and when `/contractAdmin/subscriptions/payments` is opened on an active catalog (`camap-hx/src/controller/SubscriptionAdmin.hx:363`). `Operation.check()` refuses a SubscriptionTotal without subscription (`camap-hx/src/db/Operation.hx:164-168`). The TS `createOrUpdateTotalOperation` (`camap-ts/packages/api-core/src/groups/services/csa-subscriptions.service.ts:148-189`) has no caller and dereferences null (`:160-161`, `:182-183`), so only HX writes the debt.
7. VOrder operation (HX only): `makeOrderOperation` / `updateOrderOperation` / `onOrderConfirm` (`camap-hx/src/service/PaymentService.hx:81-243`) maintain one operation per basket for variable-order catalogs; name "Order for <date>"; `amount = -sum(round2(quantity*productPrice*(1+feesRate/100)))` with a "neko float bug" string round-trip workaround (`:96-105`); throws if catalogs are of mixed types or the order has no basket (`:89-92,111-114`); `updateOrderOperation` has a CSA-constant branch multiplying by number of deliveries (`:152-156`); `Operation.check()` requires a basket for VOrder (`camap-hx/src/db/Operation.hx:160-162`). Non-test callers of `onOrderConfirm`/`makeOrderOperation`: `camap-hx/src/controller/Distribution.hx:1092,1138` (`:175`, `:229` inside `PaymentService`). By rule 2 these ops do not enter the balance but show in the member history.
8. Payment operation creation: HX `makePaymentOperation` (`camap-hx/src/service/PaymentService.hx:25-65`) creates `pending=true`, `date=now`, `type=Payment`, data `{type, remoteOpId?}`; if `type == onthespot` and the group has exactly one allowed onTheSpot type it is replaced by it (`:27-31`); if a related op already has an onTheSpot payment (any pending state) it is reused and incremented by `abs(amount)` with a row lock (`:33-41,70-76`). TS `makePaymentOperation` (`camap-ts/packages/api-core/src/payments/services/payments.service.ts:186-275`) defaults `pending=true`, reuses a related payment only if still pending for `onthespot` (`:211-222`) and `transfer` (`:223-229`), adds with `roundPrice(old + amount)` (`:232-234`), adapts type afterwards (`:246-254`). TS `updatePaymentOperation` adds `abs(amount)` without lock/rounding and does not `await` `updateUserBalance` (`:377-380`). Manual entry paths (`Transaction.doInsertPayment`, `SubscriptionAdmin.doInsertPayment`) build the Operation directly; only `doMassPayments` calls `makePaymentOperation`.
9. Membership (TS): `createMembership` (`camap-ts/packages/api-core/src/groups/services/memberships.service.ts:94-150`) creates a Membership op (`-fee`, name `Adhésion <period>`, `pending=false`, data `{year}`), a Payment op (`+fee`, `pending=false`, `relation` = membership op, type always `cash`, `:112,130-139`; `usedPaymentType` hardcoded `:114`), and the `Membership` row with `operationId`. `deleteMembership` deletes related payments and the debt, then recomputes balance (`:156-179`). Input `paymentType` is accepted (`schema.gql:679,688`, `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:202,239`) but never forwarded. No HX code creates a Membership operation (plugins unverified).
10. Linking: `Operation.relation` points to another operation (`camap-hx/src/db/Operation.hx:36`, `getRelatedPayments` `:119-121`, TS `:322-333`); `basket` set only for VOrder; `subscription` set for SubscriptionTotal and subscription payments (the only operations counted in the balance); `data` is varchar(256) JSON (`camap-hx/src/db/Operation.hx:47`, `camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:148`).
11. Rounding: HX `Operation.check()` rounds `amount` to 2 decimals on insert/update (`camap-hx/src/db/Operation.hx:170`) using `Formatting.roundTo` (`camap-hx/common/Formatting.hx:30-32`); balance rounded (`camap-hx/src/service/PaymentService.hx:351`). TS `roundPrice(v) = Math.round(v*100)/100` (`camap-ts/packages/camap-common/src/utils/index.ts:60`) used in `makePaymentOperation` (`:232`) and `computeUserOrdersAmount`; `OperationEntity` has no `check()` equivalent (amounts not forced to 2 decimals except in `updateUserBalance`, `:294`); `amount` is a double (`operation.entity.ts:51`).
12. Permissions (HX): insert payment needs `isContractManager()`; edit and delete need `canAccessMembership()` plus same group; deleting a VOrder or SubscriptionTotal needs a full admin (`camap-hx/src/controller/Transaction.hx:25,92,132,137`). TS uses `canManageAllCatalogs` (`camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:91-103`).
13. Balance transfer: `SubscriptionService.transferBalance` (`camap-hx/src/service/SubscriptionService.hx:1097-1130`) creates two `Payment` operations of type `transfer` (debit on source, credit on destination, both `pending=false`); same user must own both; negative balances transferable.
14. Subscription deletion is refused if payment operations exist (`camap-hx/src/service/SubscriptionService.hx:822`); otherwise all its operations are deleted and the balance recomputed (`:833-836`).
15. TS `OperationType` enum uses `Order` where HX uses `VOrder`; index values match (0 to 3) (`camap-hx/src/db/Operation.hx:6-9`, `camap-ts/packages/api-core/src/payments/OperationType.ts:2`, `schema.gql:340-342`).
16. TS `findOneById(id, lock)` implements `pessimistic_write` (`camap-ts/packages/api-core/src/payments/services/payments.service.ts:45-49`); `OperationsService.findBySubscriptionId` has a second caller `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:25`.

## 5. Flows

1. CSA subscription: subscription created or orders edited -> `createOrUpdateTotalOperation` writes `-total` -> coordinator records payments (`insertPayment` or `masspayments`) -> `updateUserBalance` writes `UserGroup.balance` -> subscription balance shown as `paymentsTotal - totalPrice`.
2. Variable order (HX): `OrderService` triggers `PaymentService.onOrderConfirm` -> groups orders per basket, creates/updates the VOrder operation -> payments recorded through `makePaymentOperation` (checked against `PCPayment`) -> coordinator validates or edits via `/transaction/edit` (sets `pending=false`).
3. Membership (TS): `createMembership` creates debt + cash payment; `deleteMembership` reverses both.
4. Validation: TS `validateOperation` is the counterpart of HX `Transaction.doEdit` (sets `pending=false`, optional concrete on-the-spot type).

## 6. Ownership hx vs ts

| capability | owner today | evidence |
|---|---|---|
| Payment type catalogue and per-context filtering | duplicated HX and TS; TS lacks the plugin event and display metadata | `camap-hx/src/service/PaymentService.hx:251-313`, `camap-ts/packages/api-core/src/payments/services/payments.service.ts:64-134` |
| Group payment config (admin UI and validation) | HX only; TS reads the column | `camap-hx/src/controller/AmapAdmin.hx:292-335` |
| Balance computation | duplicated, same SQL | `camap-hx/src/service/PaymentService.hx:343-354`, `payments.service.ts:280-316` |
| Order-type operations (VOrder) | HX only | `camap-hx/src/service/PaymentService.hx:81-243` |
| SubscriptionTotal operation | HX only in practice | `camap-hx/src/service/SubscriptionService.hx:1059` |
| Manual payment entry, edit, delete UI | HX only | `camap-hx/src/controller/Transaction.hx`, `camap-hx/src/controller/SubscriptionAdmin.hx` |
| Validate and delete operation (API) | TS GraphQL | `operation.resolver.ts:27-54` |
| Membership operations | TS only | `memberships.service.ts:94-179` |
| Server-side CSV (orders, subscriptions, stats, attendance) | HX only | section 3.2 |
| Client-side CSV/XLSX (attendance sheet, vendor distributions, members) | TS front-core only | section 3.3 |
| Operation entity | duplicated; HX `check()` has no TS counterpart | `camap-hx/src/db/Operation.hx:156-171` |

## 7. Known security/rights observations

Pointers only, see inconsistencies-code.md: weak rights on `Transaction.doInsertPayment` and `SubscriptionAdmin.doInsertPayment`; early null dereference in `Transaction.doEdit/doDelete`; balance excluding non-subscription operations and hardcoded year 2022; TS payment functions un-awaited/unrounded; membership `paymentType` ignored; `/transaction/<type>` links without handler; report totals bug (`getMultiDistribVendorOrdersByProduct`). Doc divergences for `payments.md` and `transactions.md`: see inconsistencies-docs.md.
