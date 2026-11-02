# DRAFT for task/refacto-hx-ts/docs/_drafts/07-payments-reports.md
(Not written to the target path because plan mode forbids edits. Move this content there once plan mode is lifted. All paths are relative to camap-docker/.)

# 07 - Payments, operations, balances, reports and exports

## Overview

- All money movements live in one table, `Operation`, scoped to (user, group). The Haxe entity is `camap-hx/src/db/Operation.hx:29`. The TS entity is `camap-ts/packages/api-core/src/payments/entities/operation.entity.ts:43`. Both map the same MySQL table.
- Operation types are an enum stored as a tinyint (`camap-hx/src/db/Operation.hx:5-10`, `camap-ts/packages/api-core/src/payments/OperationType.ts:1-6`):
  - 0 = order on a variable-order catalog (debt). It is named `VOrder` in hx and `Order` in TS.
  - 1 = `SubscriptionTotal` (debt).
  - 2 = `Payment`.
  - 3 = `Membership` (debt).
- The per-user, per-group balance is cached in `UserGroup.balance` and recomputed by `PaymentService.updateUserBalance`:
  - hx: `camap-hx/src/service/PaymentService.hx:343-354`
  - TS: `camap-ts/packages/api-core/src/payments/services/payments.service.ts:280-296`
- Payment types are fixed in code (not in the DB). Which ones a group accepts is stored as a JSON array in `Group.allowedPaymentsType`:
  - hx getter and setter: `camap-hx/src/db/Group.hx:450-459`
  - TS column: `camap-ts/packages/api-core/src/groups/entities/group.entity.ts:200`
- Reports and exports are almost entirely in Haxe (server-side CSV and printable HTML). The TS side only has client-side exports in front-core.
- No PDF or XLS generation exists in hx (only CSV and print-styled HTML). TS front-core builds CSV and XLSX in the browser (ExcelJS, react-csv, file-saver).

## Payment types

All values are taken from `camap-hx/src/payment/*.hx`, mirrored in `camap-ts/packages/api-core/src/payments/interfaces.ts:8-50`.

| id | onTheSpot flag | hx | TS |
|---|---|---|---|
| `cash` | true | `payment/Cash.hx:10,15` | `interfaces.ts:22-25` |
| `check` | true | `payment/Check.hx:9,14` | `interfaces.ts:27-30` |
| `transfer` | false | `payment/Transfer.hx:10,15` | `interfaces.ts:32-35` |
| `card-terminal` | true | `payment/OnTheSpotCardTerminal.hx:9,14` | `interfaces.ts:47-50` |
| `onthespot` (virtual) | false | `payment/OnTheSpotPayment.hx:11,17` | `interfaces.ts:42-45` |
| `moneypot` | false | `payment/MoneyPot.hx:10,15` | `interfaces.ts:37-40` |

`MoneyPot` is commented out of the "all types" list in both stacks (`PaymentService.hx:263`, `payments.service.ts:84`). It is therefore never offered, although the string is still referenced by the admin validation (rule 4) and by `PCManualEntry`.

Per-context lists. Haxe is `PaymentService.getPaymentTypes` (`camap-hx/src/service/PaymentService.hx:251-313`), and the TS version is `payments.service.ts:64-134`.

| Context | Result |
|---|---|
| `PCAll` | cash, check, transfer, onthespot, card-terminal. Haxe also fires the plugin event `GetPaymentTypes` and uses its result (`PaymentService.hx:267-271`). TS has no such hook. |
| `PCGroupAdmin` | `PCAll` minus `onthespot`. |
| `PCPayment` | Walks the group's allowed types. Non-onTheSpot types are kept. If any onTheSpot type (cash, check, card-terminal) is allowed, a single virtual `onthespot` entry is appended. It returns `[]` if the group has no allowed types. |
| `PCManualEntry` | `PCGroupAdmin` minus `moneypot`. |

## Routes and endpoints

### Haxe (server-rendered, Haxe web dispatch: `/<controller>/<action>/<args>`)

| Route | Code | Purpose | Access check |
|---|---|---|---|
| `/transaction/insertPayment/<userId>` | `camap-hx/src/controller/Transaction.hx:21` | Coordinator manually records a payment for a member. Form fields: name, amount, date, type (`PCManualEntry`), optional related operation (last 20 non-payment ops). | `isContractManager()` (:25) |
| `/transaction/edit/<opId>` | `Transaction.hx:84` | Edit name, amount and date of an operation. Sets `pending=false` (:113). | `canAccessMembership()` and same group (:92) |
| `/transaction/delete/<opId>` | `Transaction.hx:125` | Delete an operation, then recompute the balance. Needs a CSRF token (:141). Order-type ops (VOrder, SubscriptionTotal) need an admin (:137). | `canAccessMembership()` and same group (:132) |
| `/contractAdmin/subscriptions/payments/<subId>` | `camap-hx/src/controller/SubscriptionAdmin.hx:358` | Lists a subscription's total operation and payments. For an active catalog it calls `createOrUpdateTotalOperation` (:363-364). | `canManageContract` (:359) |
| `.../insertPayment/<subId>` | `SubscriptionAdmin.hx:421` | Record a payment on a subscription. The amount is pre-filled with the absolute value of a negative balance (:434-437). Check is the default type (:442-447). It creates an op with `subscription` set and `pending=false` (:451-459). | `isContractManager()` (:422) |
| `.../masspayments/<catalogId>` | `SubscriptionAdmin.hx:469` | Bulk payment entry for all subscriptions of a catalog. It calls `makePaymentOperation`, then sets `subscription` and `pending=false` (:506-509). Rows with an empty amount are skipped. | `canManageContract` (:471) |
| `/member/payments/<userId>` | `camap-hx/src/controller/Member.hx:141` | Member operations history, 10 per page, newest first. Recomputes the balance first (:143). | unverified |
| `/member/balance` | `Member.hx:161` | Group-wide lists: balance == 0, > 0 (credit), < 0 (debt). `?refresh=1` recomputes everyone's balance (:163-168). | unverified |
| `/member/invoice/<userId>/<multiDistribId>` | `Member.hx:177` | Printable invoice grouped by vendor and by VAT. | unverified |
| `/history` | `camap-hx/src/controller/History.hx:28` | The current user's own history. Recomputes the balance (:31). | `@logged` |
| `/amapadmin/payments` | `camap-hx/src/controller/AmapAdmin.hx:292` | Group admin: choose allowed payment types and IBAN. | group admin (unverified) |
| `/transaction/cash`, `/check`, `/transfer`, `/cardTerminal`, `/onthespot` | `link` fields in `payment/*.hx` (`Cash.hx:19`, `Transfer.hx:19`, etc.) | These URLs are referenced as links but no `do*` handler exists in `Transaction.hx`. Probably a leftover from the removed online-payment flow (unverified). | n/a |

### Haxe exports and reports

| Route | Code | Format and columns | Notes |
|---|---|---|---|
| `/contractAdmin/exportSubscriptions` | `camap-hx/src/controller/ContractAdmin.hx:431` | CSV. Columns (:444-448): subscriptionId, userId, userName, userEmail, userPhone, user2Name, vendorName, catalogId, catalogName, startDate, endDate, totalPrice, paymentsTotal, balance, paid. | Data from `SubscriptionService.getSubscriptionsExportData` (`SubscriptionService.hx:71-95`). `paid` is the string "oui" or "non". |
| `/contractAdmin/ordersByTimeFrame?csv` | `ContractAdmin.hx:349`, CSV at :599-657 | CSV. Columns: quantity, pname, ref, priceHT, priceTTC, totalHT, totalTTC. It has a blank line, a vendor-name line, product lines and a total line per vendor. | The route name is inferred from `doOrdersByTimeFrame` (:349). The CSV block at :599 sits in a different function, whose declaration I did not read, so the route name is unverified. |
| `/contractAdmin/orders/<catalogId>?d=<distribId>&csv=1` | `ContractAdmin.hx:668`, CSV at :725-747 | CSV. Columns: name, productName, price, quantity, fees, total, paid. | File name: `<group> - Delivery <catalog> <date> - Per member`. |
| `/contractAdmin/ordersByProduct/<catalogId>?d=&csv` | `ContractAdmin.hx:917`, calls `ReportService.getOrdersByProduct(d, csv)` (:930) | CSV. Columns (`ReportService.hx:93-103`): quantity, pname, ref, priceHT, priceTTC, totalHT, totalTTC. | File name `Export-<name>-par produits`. |
| `/contractAdmin/ordersByProductList/<catalogId>` | `ContractAdmin.hx:940` | HTML "purchase order to print". | no CSV |
| `/contractAdmin/stats` (stat=1) `?csv` | `ContractAdmin.hx:1077-1079` | CSV. Columns: quantity, productId, name, price, percent. | The function name is not shown in the lines I read, so the route is unverified. |
| `/distribution/listByDate/<date>/<placeId>/<type>/<fontSize>` | `camap-hx/src/controller/Distribution.hx:143` | HTML attendance sheets, types one, contract, all, allshort (:154-159). When `type=="csv"` (:206-229) it returns CSV. Columns: userId, userName, productName, ref, catalogName, catalogId, vendorId, price, quantity, fees, total, paid. | The form never offers "csv" (:154-159). The CSV is reachable by URL only. |
| `/product/export/<catalogId>` | `camap-hx/src/controller/Product.hx:286` | CSV of products (:311-322). | Out of scope (products). |

`ReportService` (`camap-hx/src/service/ReportService.hx`):

- `getOrdersByProduct` (:13) is a raw SQL aggregate.
  - It groups by ref, name and price.
  - The price is `AVG(productPrice)` and the VAT is `AVG(vat)` (:29-30).
  - The total is `SUM(quantity*productPrice)` (:32).
  - `priceHT` and `totalHT` come from `ProductService.getHTPrice` (:51,55).
  - For multi-weight products, the quantity is the record count, not the sum (:75-84).
- `getTurnoverFromOrdersByProducts` (:111) sums HT and TTC.
- `getMultiDistribVendorOrdersByProduct` (:125) merges per-vendor distributions across a multi-distribution.
- `getOrdersByVAT` (:167) groups totals by VAT rate, with key `round(vat*100)`.
- Tests: `camap-hx/src/test/TestReports.hx:28`, `camap-hx/src/test/TestPayments.hx:24,67`.

### TS (GraphQL, NestJS)

| Operation | Code | Notes |
|---|---|---|
| Mutation `validateOperation(id, type?)` | `camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts:27-37`, `schema.gql:608` | Sets `pending=false`, optionally rewrites `data.type`, recomputes the balance (`payments.service.ts:383-402`). Requires `canManageAllCatalogs` (:91-103). |
| Mutation `deleteOperation(id)` | `operation.resolver.ts:39-54`, `schema.gql:609` | Deletes the op, then recomputes the balance. Same right check. |
| Field resolvers `Operation.data` and `Operation.relatedPayments` | `operation.resolver.ts:56-70` | `relatedPayments` is loaded through a DataLoader. |
| Mutations `createMembership(s)` | `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts:149,195` | Creates the Membership op (debt) plus a payment op (see rule 9). |
| Client exports | see "TS exports" below | |

TS exports (front-core, client-side only):

- Attendance sheet CSV (`;` delimiter) and XLSX through ExcelJS: `camap-ts/packages/front-core/src/components/attendanceSheet/attendanceSheet.utils.ts:2,24-78,99,224-227`. Buttons are in `components/attendanceSheet/components/AttendanceActions.tsx:30,40`.
- Vendor distributions CSV with columns AMAP, Produit and one per distribution date. It uses a UTF-8 BOM and a `;` delimiter, and the file name is `distributions_<vendor>_<date>.csv`: `camap-ts/packages/front-core/src/modules/vendorDashboard/vendorDistribsCsv.utils.ts:10-73`.
- Members list CSV through react-csv: `camap-ts/packages/front-core/src/modules/members/containers/MembersTableAndActions.tsx:20,161-171,310`.
- No TS payment page or payment CSV export was found in `front-core` or `api-core`. There is no TS controller or REST endpoint for payments. Front-core only displays `subscription.balance` (`modules/csaCatalog/containers/CsaCatalogSubscriptionSold.tsx:28-43`).
- Apart from `createMembership(s)`, nothing in api-core creates operations. `makePaymentOperation` and `makeNonPaymentOperation` have no other non-test caller (grep of `payments.service.ts` consumers).

## Business rules

1. **Sign convention.** Debts (SubscriptionTotal, VOrder, Membership) are negative amounts. Payments are positive.
   - hx: `PaymentService.hx:119`, `SubscriptionService.hx:1079`.
   - TS: `memberships.service.ts:121-126`, `csa-subscriptions.service.ts:167`.
2. **Balance.** `UserGroup.balance = round2(SUM(Operation.amount))` for (user, group), but only operations joined to a Subscription whose `YEAR(startDate) > 2022`.
   - hx: `PaymentService.hx:350-352`.
   - TS: `payments.service.ts:282-294`. Same SQL, same hardcoded 2022.
   - Consequence: operations with `subscriptionId = NULL` (VOrder, Membership and its payment, manual payments from `Transaction.doInsertPayment`) are NOT counted in the balance.
   - The older pending-aware query is commented out (`PaymentService.hx:346`). Pending is not considered at all in the current query.
   - The comment at :347-349 ("delete all operations with subscription.endDate < 1 Jan 2021") does not match the code (startDate year > 2022).
3. **Balance triggers.** `updateUserBalance` is called after every create, update or delete of an operation:
   - `PaymentService.hx:62,74,128,165`
   - `Transaction.hx:73,115,144`
   - `SubscriptionAdmin.hx:460`
   - `SubscriptionService.hx:701,836,1087,1127-1129`
   - `Member.hx:143,166`
   - `History.hx:31`
   - Viewing the pages `/member/payments`, `/history` and `/member/balance?refresh=1` also recomputes it.
   - In TS it is called from `payments.service.ts` (`makePaymentOperation`, `updatePaymentOperation`, `validatePayment`), `operation.resolver.ts:48` and `memberships.service.ts:175`.
4. **Group payment configuration.**
   - The admin form offers `PCGroupAdmin` types (`AmapAdmin.hx:292-296`).
   - Saving requires at least one type (:321-323).
   - `moneypot` cannot be combined with other types (:325-327).
   - It also stores the group IBAN (:329).
   - New groups default to `[cash, check]` (`camap-hx/src/controller/Group.hx:160`).
   - A null or invalid JSON value yields `[]` (`Group.hx:454-459` in db) or null.
5. **Subscription balance** (separate from the group balance).
   - `getBalance() = round2(paymentsTotal - totalPrice)` (`camap-hx/src/db/Subscription.hx:65-67`).
   - `paymentsTotal` sums only the `Payment` operations with this subscription (:50-60).
   - `totalPrice` sums `round2(quantity*productPrice)` over the subscription's orders (:32-39).
   - `paid()` is `balance >= 0` (:24-27).
   - TS equivalent: `csa-subscriptions.service.ts:104-137`. It does not round, and it uses `computeUserOrdersAmount` from camap-common (`camap-common/src/utils/index.ts:39-48`).
6. **SubscriptionTotal operation.** One per (user, subscription). It is created or updated by `createOrUpdateTotalOperation` (`SubscriptionService.hx:1059-1091`).
   - Name "Total Commandes", `amount = -getTotalPrice()`, `date = now` when the amount changed, `pending=false`.
   - Called when a subscription is created or its orders change (`SubscriptionService.hx:696,962,1017`) and when `/contractAdmin/subscriptions/payments` is opened on an active catalog (`SubscriptionAdmin.hx:363`).
   - `Operation.check()` refuses a SubscriptionTotal without a subscription (`Operation.hx:164-168`).
7. **VOrder operation (hx only).**
   - `makeOrderOperation` / `updateOrderOperation` / `onOrderConfirm` (`PaymentService.hx:81-243`) maintain one operation per basket for variable-order catalogs.
   - Name: "Order for <date>". `amount = -sum(round2(quantity*productPrice*(1+feesRate/100)))`, with a "neko float bug" workaround via a string round-trip (:96-105).
   - It throws if catalogs are of mixed types or if the order has no basket (:89-92,111-114).
   - `updateOrderOperation` has a CSA-constant branch that multiplies by the number of deliveries (:152-156).
   - `Operation.check()` requires a basket for VOrder (`Operation.hx:160-162`).
   - Because of rule 2, these ops are stored but do not enter the balance. They are visible in the member history.
   - `docs/payments.md` says "Order: not used on CAMAP" (see doc inconsistencies).
8. **Payment operation creation.**
   - hx `makePaymentOperation` (`PaymentService.hx:25-65`) always creates `pending=true`, `date=now`, `type=Payment`, data `{type, remoteOpId?}`.
   - If `type == onthespot`:
     - If the group has exactly one allowed onTheSpot type, `type` is replaced by it (:27-31).
     - If a related op already has an onTheSpot payment (any pending state), it is reused and incremented by `abs(amount)` (:33-41,70-76).
   - TS `makePaymentOperation` (`payments.service.ts:186-275`) defaults `pending=true`.
     - It reuses a related payment only if it is still pending, for `onthespot` (:211-222) and also for `transfer` (:223-229).
     - It adds using `roundPrice` (:232-234), and the type is adapted afterwards (:246-254).
   - Manual entry paths (`Transaction.doInsertPayment`, `SubscriptionAdmin.doInsertPayment`) build the Operation directly and bypass `makePaymentOperation`. Only `doMassPayments` calls it.
9. **Membership (TS).** `createMembership` (`memberships.service.ts:94-150`) creates:
   - a Membership op, amount `-fee`, name `Adhésion <period>`, `pending=false`, data `{year}`;
   - a Payment op, amount `+fee`, `pending=false`, `relation` set to the membership op, payment type always `cash` (:112,130-139);
   - the `Membership` row with `operationId`.
   - `deleteMembership` deletes the related payments and the debt, then recomputes the balance (:156-179).
   - The input's `paymentType` is accepted but ignored (see code inconsistencies).
   - No hx code creating a Membership operation was found in `camap-hx/src` (unverified whether a plugin does it).
10. **Linking.**
    - `Operation.relation` points to another operation: a payment pays a debt (`Operation.hx:36`, `getRelatedPayments` :119-121, TS `getRelatedPayments` :322-333).
    - `basket` is set only for VOrder.
    - `subscription` is set for SubscriptionTotal and for subscription payments. These are the only operations that count in the balance.
    - `data` is varchar(256) JSON (`Operation.hx:47`, `operation.entity.ts:148`).
11. **Rounding.**
    - hx `Operation.check()` rounds `amount` to 2 decimals on insert and update (`Operation.hx:170`). It uses `Formatting.roundTo` = `Math.round(n*10^r)/10^r` (`camap-hx/common/Formatting.hx:30-32`).
    - The balance is rounded to 2 decimals (`PaymentService.hx:351`).
    - TS `roundPrice(v) = Math.round(v*100)/100` (`camap-common/src/utils/index.ts:60`). It is used in `makePaymentOperation` (:232) and `computeUserOrdersAmount`.
    - TS `OperationEntity` has no equivalent of `Operation.check()`, so TS-written amounts are not forced to 2 decimals (except in `updateUserBalance`, :294).
    - `amount` is a double in the DB (`operation.entity.ts:51`).
12. **Permissions (hx).**
    - Insert payment needs `isContractManager()`. Edit and delete need `canAccessMembership()` plus the same group.
    - Deleting a VOrder or SubscriptionTotal needs a full admin (`Transaction.hx:137`).
    - Hooks: `PreOperationEdit` and `PreOperationDelete` events are fired (`Transaction.hx:100,134`).
13. **Transfer of balance.** `SubscriptionService.transferBalance` (`SubscriptionService.hx:1097-1130`) creates two `Payment` operations of type `transfer` (a debit on the source subscription and a credit on the destination, both `pending=false`). The same user must own both subscriptions. Negative balances may be transferred.
14. **Subscription deletion.** It is refused if there are payment operations (`SubscriptionService.hx:822`). Otherwise all its operations are deleted and the balance is recomputed (:833-836). The details of this function were not read in full.

## Flows

- **CSA subscription.**
  1. Subscription created or orders edited.
  2. `createOrUpdateTotalOperation` writes `-total`.
  3. The coordinator records payments (`insertPayment` or `masspayments`).
  4. `updateUserBalance` writes `UserGroup.balance`.
  5. The subscription balance is displayed as `paymentsTotal - totalPrice`.
- **Variable order (hx).**
  1. `OrderService` triggers `PaymentService.onOrderConfirm`.
  2. It groups orders per basket and creates or updates the VOrder operation.
  3. Payments are recorded through `makePaymentOperation` (checked against `PCPayment`).
  4. A coordinator validates or edits them via `/transaction/edit` (sets `pending=false`).
- **Membership (TS).** The GraphQL `createMembership` creates the debt and the cash payment. `deleteMembership` reverses both.
- **Validation.** The TS `validateOperation` mutation is the TS counterpart of hx `Transaction.doEdit`. It sets `pending=false`, with an optional concrete on-the-spot type.

## HX and TS ownership

| Capability | Owner today | Evidence |
|---|---|---|
| Payment type catalogue and per-context filtering | Duplicated hx and TS. The TS version is missing the plugin event and the display metadata (name, icon, link, descriptions). | `PaymentService.hx:251-313`, `payments.service.ts:64-134`, `interfaces.ts:17-20` |
| Group payment config (admin UI and validation) | hx only. TS only reads the column. | `AmapAdmin.hx:292-335`; no setter in api-core (grep `allowedPaymentsType`) |
| Balance computation | Duplicated, same SQL. | `PaymentService.hx:343-354`, `payments.service.ts:280-316` |
| Order-type operations (VOrder) | hx only. | `PaymentService.hx:81-243` |
| SubscriptionTotal operation | hx only in practice. The TS function exists but is not referenced and is buggy. | `SubscriptionService.hx:1059`, `csa-subscriptions.service.ts:148-189` |
| Manual payment entry, edit and delete UI | hx only. | `Transaction.hx`, `SubscriptionAdmin.hx` |
| Validate and delete operation (API) | TS GraphQL. Whether the front uses them: they appear in `front-core/src/gql/index.tsx` only, so no component usage found. | `operation.resolver.ts:27-54` |
| Membership operations | TS only. | `memberships.service.ts:94-179` |
| Server-side CSV (orders, subscriptions, stats, attendance) | hx only. | see the exports table |
| Client-side CSV/XLSX (attendance sheet, vendor distributions, members) | TS front-core only. | see TS exports |
| Operation entity | Duplicated. Both are shaped alike, but hx `check()` has no TS counterpart. | `Operation.hx:156-171` |

## Documentation inconsistencies

1. [CONFIRMED] `camap-ts/docs/payments.md:21` says `Order` is "Non utilisé sur CAMAP". hx actively creates VOrder operations (`camap-hx/src/service/PaymentService.hx:81-130`). Both the hx enum (`Operation.hx:6`) and the TS enum and GraphQL schema (`OperationType.ts:2`, `schema.gql:340`) still define it. The hx name is `VOrder` and the TS name is `Order`. (verifier-corrected: the sentence is payments.md:24. VOrder creation is reachable: PaymentService.onOrderConfirm (:175) calls makeOrderOperation (:229); its non-test callers are Distribution.hx:1092,1138 only. TS OperationType.ts:2 and schema.gql:340-342 `Order` verified.)
2. [CONFIRMED] `docs/payments.md:31` says the Basket relation is "not used". hx sets `op.basket` on VOrder (`PaymentService.hx:122`) and requires it (`Operation.hx:160`). (verifier-corrected: payments.md:35, not :31; Operation.hx:160-161, PaymentService.hx:121-122 verified.)
3. [CONFIRMED] `docs/payments.md:29` says `pending` is no longer used and payments are certain. Code still creates payments with `pending=true` (`PaymentService.hx:50`, `payments.service.ts:193`), and the TS `makePaymentOperation` reuse logic depends on it (:217,227). The balance ignores it (rule 2). (verifier-corrected: payments.md:33, not :29. payments.service.ts default `pending = true` and `o.pending` reuse filter verified; hx PaymentService.hx:~49.)
4. [CONFIRMED] `docs/payments.md:25-26` says the balance is the sum of "toutes ces opérations". In code only operations linked to a subscription with `startDate` year > 2022 are summed (`PaymentService.hx:350`, `payments.service.ts:287`). (verifier-corrected: the 'addition de toutes ces opérations' sentence is payments.md:12 (and :14), not :25-26. Code: PaymentService.hx:~350 and payments.service.ts:~287 join on Subscription with YEAR(startDate) > 2022.)
5. [CONFIRMED] `docs/payments.md:49` links to "SubscriptionService.hx#L1003" as the place where the "payment operation" is updated with `subscription.getTotalPrice()`. The code at that location is `createOrUpdateTotalOperation` (now at :1059-1091). It writes the SubscriptionTotal debt, not a payment, and the line anchor is stale. (verifier-corrected: the SubscriptionService link is payments.md:51; :49 is the PaymentService.hx#L343 balance link. createOrUpdateTotalOperation is at SubscriptionService.hx:1059.)
6. [CONFIRMED] `docs/payments.md:39` links `operation.entity.ts` with the label "group.entity.ts". Line 29 states the `Relation` links a payment to a debt. In practice the subscription payment forms do not set `relation` (`SubscriptionAdmin.hx:451-459`). Only `Transaction.doInsertPayment` (:61-70), `makePaymentOperation` callers and TS memberships do. (verifier-corrected lines: the operation.entity.ts link labelled group.entity.ts is payments.md:45, the Relation description is :39. SubscriptionAdmin.hx:450-460 insert sets no `relation`; Transaction.doInsertPayment sets it only when 'unpaid' is chosen.)
7. [CONFIRMED] `camap-ts/docs/archives/api-core/transactions.md` and `camap-ts/packages/api-core/docs/transactions.md` are byte-identical (`diff -q` shows no difference). One is an archive copy of the other. (diff -q reports no difference.)
8. [CONFIRMED] In both transactions.md files: (verifier-corrected: the Transactional rule is transactions.md:7, the empty '## Lock' heading is :9. Nuance: TransactionalMutation is a composite, applyDecorators(Transactional(), Mutation(...)) (transactional-mutation.decorator.ts:5-7), so the resolver does satisfy the rule, the doc simply does not mention the decorator. The sample uses `Promise.all([basket.map(...)])` (array of arrays, effectively not awaited) and an undefined `input`, rather than `await decreaseStock(...)`.)
   - Line 5 says `Transactional` must decorate resolver mutations. The payments resolver uses a custom `@TransactionalMutation` instead (`operation.resolver.ts:27,39`; `common/decorators/transactional-mutation.decorator.ts:5`).
   - The "## Lock" section (line 11) is empty, although `findOneById(id, lock)` implements `pessimistic_write` (`payments.service.ts:45-49`).
   - The sample `await decreaseStock(...)` is not valid TS as written.
9. [CONFIRMED] No doc describes the CSV/XLSX exports, the payment-type per-group config, or the balance cut-off. (grep for csv/xlsx in camap-ts/docs and api-core/docs returns no file.)

## Code inconsistencies

1. [CONFIRMED] **Dead and buggy TS function.** `csa-subscriptions.service.ts:159-161` does `if (!totalOperation) { totalOperation.subscription = ... }`, which dereferences null. `totalOperation.userId` is also read at :182 after the branch. The function has no caller in api-core (grep), so the SubscriptionTotal debt is written only by hx. (verifier-corrected lines: csa-subscriptions.service.ts:160-161 and :182-183; same as 04/06 finding, no other caller.)
2. [CONFIRMED] **Balance excludes non-subscription ops.** VOrder, Membership, membership payments and `Transaction.doInsertPayment` ops have `subscriptionId = NULL` and are dropped by the inner join (`PaymentService.hx:350`, `payments.service.ts:287`). The hardcoded year 2022 is duplicated in both. The query ignores `pending`. The comment at `PaymentService.hx:347-349` describes a different rule. TS membership payments are therefore not reflected in `UserGroup.balance`. This is worth confirming against intent. (inner join on Subscription verified in both implementations; comment mismatch verified: comment says endDate < 2021, code uses YEAR(startDate) > 2022.)
3. [CONFIRMED] **Duplicated `updateUserBalance` and `getUserBalance`** in TS (`payments.service.ts:280-316`). (payments.service.ts updateUserBalance :~281 and getUserBalance :~301 have identical queries; getUserBalance has no caller.)
4. [CONFIRMED] **`pending` reuse differs.** hx reuses any existing onTheSpot payment regardless of pending state (`PaymentService.hx:35-40`) and does not reuse transfers. TS reuses only pending ones and also reuses `transfer` (`payments.service.ts:211-229`). (hx reuse only requires an OnTheSpot-type related payment, no pending test, PaymentService.hx:34-41; TS :~205-230 requires o.pending and also handles 'transfer'.)
5. [CONFIRMED] **`updatePaymentOperation` differs.** (hx PaymentService.hx:67-75; TS updatePaymentOperation payments.service.ts:~365-380 un-awaited `this.updateUserBalance` of an async method; makePaymentOperation uses roundPrice(old + amount), no abs.)
   - hx locks the row and adds `abs(amount)` (`PaymentService.hx:70-76`).
   - TS adds `abs(amount)` with no lock and no rounding, and does not `await` `updateUserBalance` (`payments.service.ts:377-380`).
   - `makePaymentOperation` in TS uses `roundPrice(old + amount)` without `abs` (:232).
6. [CONFIRMED] **Rounding.** (Operation.hx:170 rounds in check(); TS operation.entity.ts has no BeforeInsert/BeforeUpdate/round; computeUserOrdersAmount is camap-common utils/index.ts:44-49 and rounds per line and running total; Subscription.hx:32-39 verified.)
   - The hx `Operation.check()` rounds every amount (`Operation.hx:170`).
   - TS `OperationEntity` has no such hook.
   - TS subscription `getBalance` and `getPaymentsTotal` do not round (`csa-subscriptions.service.ts:113-130`), while hx does (`Subscription.hx:50-67`).
   - TS `getTotalPrice` uses `computeUserOrdersAmount`, which rounds each line and the running total (`camap-common/src/utils/index.ts:39-48`).
   - hx `getTotalPrice` rounds each line and the total (`Subscription.hx:32-39`), but VOrder includes fees (`PaymentService.hx:98-104`) while the subscription total does not.
9. [CONFIRMED] **Membership payment type ignored.** The GraphQL inputs accept `paymentType` (`schema.gql:679,688`, `memberships.resolver.ts:202,239`), but `createMembership` has no such parameter and hardcodes `PaymentTypeId.cash` (`memberships.service.ts:112,130-133`). (memberships.service.ts:114 `let usedPaymentType = PaymentTypeId.cash;` and createMembership signature :97-104 has no paymentType; the resolver destructures paymentType at memberships.resolver.ts:202,239 but never forwards it; schema.gql:679,688.)
10. [CONFIRMED] **hx null dereference before a check.** `Transaction.doEdit` reads `operation.subscription.id` at :89 and only checks null at :96. `doDelete` does the same at :129. For VOrder and Membership operations (no subscription) this will fail with an error instead of the intended message. (Transaction.hx:88-89 `operation.subscription.id` before the null check at :92-94, and doDelete :128 likewise. Verifier note: the check `canAccessMembership` at :92 is evaluated after the deref as well. Line numbers approx +-3.)
11. [CONFIRMED] **Float equality.** `Transaction.doInsertPayment` marks both ops non-pending if `t2.amount + operation.amount == 0` with no rounding (`Transaction.hx:64`). The check is also done before `Operation.check()` rounding. (Transaction.hx:~64 `t2.amount + operation.amount == 0`.)
12. [CONFIRMED] **Permission mismatch.** Insert uses `isContractManager()`, while edit and delete use `canAccessMembership()` (`Transaction.hx:25,92,132`). TS uses `canManageAllCatalogs` (`operation.resolver.ts:91-103`). (security-relevant: Transaction.doInsertPayment :25 only needs isContractManager() (any ContractAdmin right), and does not verify that the target user belongs to the session group; edit/delete use canAccessMembership + same-group check; TS uses canManageAllCatalogs, operation.resolver.ts:91-103.)
13. [CONFIRMED] **`/transaction/<type>` links with no handler.** The `link` fields (`payment/Cash.hx:19` etc.) point to routes not present in `Transaction.hx`. The controller only has insertPayment, edit and delete. (payment/*.hx set links like /transaction/cash, /check, /moneypot, /onthespot, /transfer, /cardTerminal; Transaction.hx defines only doInsertPayment (:21), doEdit (:84), doDelete (:125).)
14. [CONFIRMED] **`ReportService.getMultiDistribVendorOrdersByProduct`** merges duplicate products by adding `quantity` and `totalTTC` only (`ReportService.hx:153-154`). `totalHT` is not incremented, so it is wrong for merged lines. The CSV export of the time-frame report (`ContractAdmin.hx:599-657`) uses `o.totalHT` as is. It recomputes `priceHT` from `priceTTC` and `vat`, but not `totalHT`. (ReportService.hx:153-154 verified; ContractAdmin.hx:537 calls the function and the CSV block (:~599-657) writes o.totalHT as is.)
15. [CONFIRMED] **`ReportService.getOrdersByProduct`** groups by `ref,pname,price` but selects `AVG(up.productPrice)` and `AVG(p.vat)`. The "price" is therefore an average, as the comment at :24 says. The grouping by price column vs. the aggregate alias is MySQL-dependent (unverified). (query verified at ReportService.hx:~27-37. External note: per MySQL docs, an unqualified name in GROUP BY resolves to a FROM-clause column before a select alias, so `price` would be Product.price; not checked against a live DB.)
16. [CONFIRMED] **Hidden CSV.** The `listByDate` form offers only one, contract, all and allshort. The CSV type exists only if typed in the URL (`Distribution.hx:154-159` vs :206).
17. [CONFIRMED] **Enum naming.** The hx and TS operation enums use `VOrder` vs `Order`. The index values match (0 to 3). (hx Operation.hx:6-9 and TS enum order both VOrder/Order, SubscriptionTotal, Payment, Membership.)
18. [CONFIRMED] **VAT-HT rounding.** `getOrdersByVAT` and `Member.doInvoice` compute HT as `total/(1+vat/100)` without rounding (`ReportService.hx:174`, `Member.hx:~195`). The invoice duplicates the `ReportService.getOrdersByVAT` logic instead of calling it (`Member.hx:177-200` vs `ReportService.hx:167-177`). (ReportService.hx:173-174 and Member.hx:~188-195 verified; the invoice code is duplicated inline.)
19. [REFUTED: findBySubscriptionId has a second caller at camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:25] ~~**Dead code.** `OperationsService.findBySubscriptionId` is used only by `getPaymentsTotal`. `PaymentsService.getUserBalance` is unreferenced in `api-core/src` (no non-test caller found).~~ (second sentence CONFIRMED: PaymentsService.getUserBalance, payments.service.ts:301, has no caller in api-core/src or other packages.)

## Unverified

- Access rules on `Member.doPayments`, `doBalance` and `doInvoice`.
- Route names for the CSV blocks at `ContractAdmin.hx:599` and `:1077`.
- Which front-core component calls `validateOperation` or `deleteOperation`.
- Whether a plugin creates Membership operations in hx.
- The `sugoi.tools.Csv` library behavior (delimiter, encoding), which is outside this repo.


## Verification summary

Confirmed: 25. Refuted: 1 (code item 19, first sentence). Plausible: 0. Security-relevant confirmed: code item 12 (weak rights check on Transaction.doInsertPayment).
