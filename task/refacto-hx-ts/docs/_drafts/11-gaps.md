# 11 - Gaps (fills 99-coverage-critic.md)

Scope: documents what code does today. Every claim cites path:line (paths relative to repo root `camap-docker/`).

## 1. Haxe units

Paths are relative to the repo root. "TS counterpart: none" means no handler/file with equivalent behaviour was found in `camap-ts/packages/*/src` (grep of names + reading the resolver lists in section 3).

### 1.1 Uncovered `do*` actions

| Action / route | What it does | Auth / rights | Handler path:line | TS counterpart |
|---|---|---|---|---|
| `Install.doDiagnostics` -> `GET /install/diagnostics` (reached via `Main.doInstall` dispatch, `camap-hx/src/controller/Main.hx:217-220`) | Prints diagnostics to stdout with `Sys.println`: creates `<webroot>file/` if missing (110-113), prints a warning (does not create) if `file/.htaccess` is missing (114-116), creates `<webroot>../tmp` if missing (117-120). Returns no template. | NONE. Neither `Main.doInstall` (no `@logged`/`@admin`) nor `Install` (no constructor guard; only `doDefault` self-guards at `Install.hx:19-21` with "CAMAP est deja installe") restricts it. | `camap-hx/src/controller/Install.hx:106-122` | none (`FilesService` stores files in DB table, see `camap-ts/packages/api-core/src/files/file.service.ts`) |
| `Install.doDefault` (first install, context for the above) | If `User` table is empty: creates group + user `admin@camap.tld` / password `admin`, flag Admin (`Install.hx:25-100`). Otherwise `throw "CAMAP est deja installe"`. | Self-guard by `db.User.manager.count(true) > 0` (`Install.hx:19`) | `camap-hx/src/controller/Install.hx:17-104` | none (TS seeds via `camap-ts/packages/api-core/src/dev/dataset-generator.ts`) |
| `Main.doCssdemo` -> `GET /cssdemo` | Dev style-guide page (buttons, alerts). Puts a `Map<String,String>` `users` in the view (`bob` -> "is a nice fellow") to debug Haxe 4 StringMap in templates. Template `cssDemo.mtt` (196 lines). | NONE (no `@logged`, `@admin`) | `camap-hx/src/controller/Main.hx:209-215` | none |
| `Admin.doTheme` -> `/admin/theme` | Form with one TextArea holding `Json.stringify(app.getTheme())`; on submit parses JSON and stores it in `Variable` key `whiteLabel` (`Admin.hx:52`). Parse error -> redirect `/admin/theme` with "Erreur : ...". Success redirect `/admin/`. NB the in-memory theme (`App.theme`, static) is refreshed only by `/admin?reloadSettings=1` (`Admin.hx:34-38`) or restart (`App.hx:153-157`). | `Main.doAdmin` is `@admin` (`Main.hx:333-336`) -> super admin only | `camap-hx/src/controller/admin/Admin.hx:41-62` | none. `VariableService.getTheme()` never reads `whiteLabel` (see section 6, I-1) |
| `Admin.doAttentionAdmins` -> `/admin/attentionAdmins` | Form (TextArea `attMessageAdmins` + Checkbox `msgAlert` "fond rouge"); writes `Variable` `attMessageAdmins` and `attMessageAdminsAlert` (`Admin.hx:197-198`). The message is shown as a session flash message (red if alert) to members of the current group that have any right (`ug.getRights().length > 0`) or are admin (`Main.hx:148-163`). | `@admin` via `Main.doAdmin` | `camap-hx/src/controller/admin/Admin.hx:184-204`; read side `camap-hx/src/controller/Main.hx:147-164` | none |
| `Admin.doAttention` / `doMessages` (sister pages, also unmentioned) -> `/admin/attention`, `/admin/messages` | `attMessage` (flash shown to ALL members of every group, `Main.hx:166-170`) and `homeMessage` (raw HTML on the group chooser page `lang/master/tpl/user/choose.mtt:3-6`) | `@admin` | `camap-hx/src/controller/admin/Admin.hx:146-179` | none |
| `Admin.doDefault` -> `/admin` | Back-office home; `?reloadSettings=1` calls `app.setTheme()` then redirect "Theme reloaded" | `@admin` | `camap-hx/src/controller/admin/Admin.hx:29-39` | none |
| `Admin.doErrors` -> `/admin/errors` | Lists `sugoi.db.Error` rows (20/page, `ResultsBrowser`), 1-month per-day stats; optional `?user=<id>`; `?empty=1` runs `truncate table Error` | `@admin`. NB truncation is a GET parameter with no CSRF token | `camap-hx/src/controller/admin/Admin.hx:101-129` | none |
| `Distribution.doEditMd` -> `/distribution/editMd/<mdId>` | Edit a MultiDistrib. Builds a form from the spod, replaces date/start/end with `CamapDatePicker`s (minutes rounded to multiples of 5, 628-629, 635-636), adds checkbox "Recaler tous les producteurs sur ces horaires" (`override`, 642). Submit -> `DistributionService.editMd` (`camap-hx/src/service/DistributionService.hx:194-248`): `md.lock()`, rejects another MD at same start+place (`Conflict`, 198-200), updates md and each child `Distribution` (date/end/place; order dates overwritten if `override`, or if null, or if they equalled the old md dates, 225-236). Redirect `/distribution` "The distribution has been updated". | `checkHasDistributionSectionAccess()` = `app.user.canManageAllContracts()` else Error (`Distribution.hx:24-27`, 616). No check that `md` belongs to the user's group (see I-6) | `camap-hx/src/controller/Distribution.hx:614-678` | none (TS only has queries on distributions, no distribution mutation: see section 3 list) |
| `Distribution.doChangePrice` -> `/distribution/changePrice/<mdId>` | Form: select a product among the var-order catalogs of the MD + new price. For each order of that product in the MD: `order.productPrice = price`, `update()`, then `PaymentService.onOrderConfirm([order])` to recompute payments (1131-1141). Does NOT change the catalog price (warning text at 1150). Redirect `/distribution/validate/<id>`. | Same `checkHasDistributionSectionAccess()` (1108); no group-ownership check on `distrib` | `camap-hx/src/controller/Distribution.hx:1106-1151` | none |
| `Scripts.doRecomputeBasketTotal(from,to)` -> CLI `neko index.n scripts/recomputeBasketTotal ...` | For every group, loads MDs in range, for every `Basket` of those MDs sets `b.total = b.getOrdersTotal()` (36-48). Dated 2023-01-06 in comment. | Class constructor throws "CLI only" when `sugoi.Web.isModNeko` (`Scripts.hx:14-16`); dispatcher `Main.doScripts` (`Main.hx:341-358`) catches errors, logs with `App.current.logError` and rolls back | `camap-hx/src/controller/Scripts.hx:29-50` | none |
| `ContractAdmin.doVendorsByTimeFrame(from,to)` -> `/contractAdmin/vendorsByTimeFrame/<from>/<to>[?csv=1]` | "Totals per supplier" report: finds active catalogs of the group (restricted to catalogs the user can manage unless `isAmapManager`, 556-561), distributions in range (error "There is no delivery during this period" if none, 566-568), aggregates `ReportService.getOrdersByProduct(d)` per vendor summing quantity/totalHT/totalTTC (572-595); `?csv=1` exports CSV (599+). Template `contractadmin/vendorsByTimeFrame.mtt`. Linked from `ordersByTimeFrame.mtt:13` and `ordersByDate.mtt:31`. | `ContractAdmin` constructor: `isContractManager()` else Error (`ContractAdmin.hx:29-33`) | `camap-hx/src/controller/ContractAdmin.hx:545-640` | none (TS: `attendanceClassicContract`/`attendanceVariableContract`, `camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:30,90`, are per-contract attendance sheets, not vendor totals) |
| `SubscriptionAdmin.doBalanceTransfer(subscription)` -> `/contractAdmin/subscriptions/balanceTransfer/<subId>` | Shows the other not-closed subscriptions of the same user and same vendor (`SubscriptionService.getUserVendorNotClosedSubscriptions`, `SubscriptionService.hx:118-127`); with token, calls `SubscriptionService.transferBalance(from,to)` which writes two `Operation`s of type Payment `{type:'transfer'}` (amount `-balance` on source, `+balance` on target; negative balances allowed, `SubscriptionService.hx:1099-1130`). Error if user has no other subscription (`SubscriptionAdmin.hx:391-394`). | `app.user.canManageContract(subscription.catalog)` (384). Target subscription is only checked for same user (`SubscriptionService.hx:1104`), not against the offered list (see I-7) | `camap-hx/src/controller/SubscriptionAdmin.hx:382-415` | none (TS only exposes `CsaSubscription.balance`, `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts:16`) |
| `SubscriptionAdmin.doPayments`, `doInsert`, `doEdit` (template-only gaps, see section 2) | see 2.1 | `canManageContract` | `camap-hx/src/controller/SubscriptionAdmin.hx:357,63,194` | none |
| `History.doSubscriptionPayments` -> `/history/subscriptionPayments/<subId>` | Member-side page listing payments of a subscription, creates/updates the total operation (`SubscriptionService.createOrUpdateTotalOperation`) | `@logged` + must be member of current group (`History.hx:111-112`); no check that `subscription.user == app.user` (see I-5) | `camap-hx/src/controller/History.hx:107-121` | none |
| `Documents.doInsert(?catalog)` / `Media.doInsert` | see 2.1 (template adddocument/addmedia) | see 2.1 | `camap-hx/src/controller/Documents.hx:112-153`, `Media.hx:82-` | `createDocument` mutation `camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:55` |

### 1.2 Missing `.hx` units

| File | What it is / does | Used by | Auth | TS counterpart |
|---|---|---|---|---|
| `camap-hx/common/GitMacros.hx` (82 l.) | Build-time Haxe macros `getGitCommitDate()` (`git log -1 --format=%ci`, separators turned into `.`, cut to 16 chars, 13-27), `getGitShortSHA()` (`"C"+%h`, 33-50), `getGitBranch()` (`git symbolic-ref HEAD --short`, 56-73). They shell out to git at compile time; under `#if display` they return stubs. | Imported by `camap-hx/src/App.hx:2` but the only uses are commented out: `App.hx:21` (`VERSION = [3,0,12] /*.withPre(GitMacros...)*/`) and `camap-hx/js/App.hx:40`. So version is a hard-coded literal today and `/ping` prints it (`Main.hx:326-328`). | n/a | `/ping` and `/health`: `camap-ts/packages/api-core/src/tools/tools.controller.ts:11,19` (no git info) |
| `camap-hx/src/tools/StringTool.hx` (35 l.) | `toSortingKey` (accent folding table + lowercase, 21-27) and `compare` (`Reflect.compare` on keys, 32-34) | `Amap.hx:26`, `History.hx:43`, `ContractAdmin.hx:59,75`, `Main.hx:92` (sort catalogs/vendors by name) | n/a | none in api-core (sorting done in SQL / front). `db.User.sortCompare` is used for users (`SubscriptionAdmin.hx:32`) |
| `camap-hx/src/tools/ObjectListTool.hx` (156 l.) | Helpers on `sys.db.Object` lists: `getIds` (49), `deduplicate` (58), `toIdMap` (67), `deduplicateOrders` (merge orders with same user-userId2-product key summing qty/fees/subTotal/total, 78-104), `deduplicateDistribsByKey` (110), `groupDistribsByKey` (121), `groupOrdersByKey` (137). Usage count in src/js: `deduplicate` x8, `getIds` x4, `groupOrdersByKey` x1, `toIdMap` x1; the 3 others unused by grep. | many controllers via `using tools.ObjectListTool` (e.g. `ContractAdmin.hx:27`) | n/a | none (DataLoader batching, `camap-ts/packages/api-core/docs/dataloader.md`) |
| `camap-hx/src/tools/ArrayTool.hx` (60 l.; only mentioned by class name) | `groupByDate`, `mapLength`, `deduplicate` (O(n^2) `indexOf`, 52-60); `shuffle` commented out | `db/MultiDistrib.hx:405`, `service/VolunteerService.hx:193,397`, `service/AbsencesService.hx:34` | n/a | none |
| `camap-hx/src/import.hx` (3 l.) | Global imports `using Lambda; using Std;` | whole `src/` | n/a | n/a |
| `camap-hx/src/payment/PaymentType.hx` (18 l.) | Abstract-ish base class: fields `type` (unique id), `icon`, `name`, `link`, `onTheSpot`, `publicDesc`, `adminDesc`, `docLink`. Subclasses: `Cash`, `Check`, `OnTheSpotPayment`, `MoneyPot`, `Transfer`, `OnTheSpotCardTerminal` (`camap-hx/src/payment/*.hx`, `extends payment.PaymentType`). `OnTheSpotPayment.allowedPaymentTypes : Array<PaymentType>` (`OnTheSpotPayment.hx:12`). | `db/Operation.hx:89` `getPaymentType():String` returns the string id | n/a | TS: `camap-ts/packages/api-core/src/payments/OperationType.ts` (enum) - no payment-type class hierarchy |
| `camap-hx/src/service/PlaceService.hx` (28 l.) | `geocode(p:db.Place)`: `Mapbox.geocode(p.getAddress())`; throws `tink.core.Error("unable to locate this address")` if coordinate[0] null (14-16); else `p.lock()`, sets `lat`/`lng` from coordinates [1]/[0], `update()` | `controller/Place.hx:52`, `controller/Group.hx:177` | whatever the callers require | none: no geocode mutation in `camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts` (query `place` only, :9); map queries use stored coordinates (`group-previews.resolver.ts:67`) |
| `camap-hx/src/controller/Controller.hx` (mentioned by class only) | Base class `extends sugoi.BaseController` (7) shared by all controllers | all | n/a | NestJS guards (`camap-ts/packages/api-core/src/common/guards/`) |

### 1.3 Server-side form widgets `camap-hx/src/form/*` (all `sugoi.form` based, rendered by `form.mtt`)

| File | Behaviour | Used by (path:line) | TS / React counterpart |
|---|---|---|---|
| `CamapForm.hx` (57 l.) | Extends `sugoi.form.Form`. `fromSpod` maps DDate/DTimeStamp/DDateTime to `CamapDatePicker` (`renderDDate` opens on "year" when field name is `birthdate`/`birthday`, 38-44; `renderDTimeStamp` 48). `addRichText(form,selector)` injects a RawHtml with inline TinyMCE init (`/js/tinymce/tinymce.min.js`, plugins autolink emoticons image code link lists, `language` = session lang, GPL licence key, 23-41). Throws `thx.Error("richtext already added to form.")` if called twice. | `Place.hx:43,70`, `Amap.hx:42,77`, `Distribution.hx:294`; `addRichText`: `Amap.hx:77`, `Product.hx:96,144`, `ContractAdmin.hx:156`, `amapadmin/Volunteers.hx:79` (6 call sites) | React forms in `camap-ts/packages/front-core`; rich text for messages uses Slate (`front-core/src/modules/messages/components/MessageTextEditor.tsx`) |
| `CamapDatePicker.hx` (47 l.) | Extends `NativeDatePicker`; `render()` outputs a `<div id=...>` plus inline script calling `neo.createNeoModule(id,"haxeDatePicker",{name,type,value,required,openTo})` on DOMContentLoaded (27-46) -> the React `haxe-date-picker` module. `getTypedValue` returns null for empty string else `Date.fromString`. Default display format string `"EEEE d MMM yyyy"`. NB constructor param is spelled `attibutes` and passes the field `attributes` to `super` (13-21), see I-8. | `Transaction.hx:35,107`, `Distribution.hx:429,437,438,566`, `Distribution.hx:622,630,637` (editMd) | `camap-ts/packages/front-core/src/modules/haxe-date-picker` |
| `CamapDateTimePicker.hx` (11 l.) | Subclass fixing type `datetime` | `Distribution.hx:300-301` (orderStartDate / orderEndDate) | same |
| `CamapTimePicker.hx` (11 l.) | Subclass fixing type `time` | no usage found in `src/` or `js/` | same |
| `RawHtml.hx` (26 l.) | Form element that renders arbitrary HTML between fields; `getTypedValue` returns null, `getFullRow` returns the raw html (no label column) | `Contract.hx:99` (GDPR disclaimer), `amapadmin/Volunteers.hx:25,29` (section titles), `CamapForm.hx:25` (TinyMCE) | none |
| `ColorRadioGroup.hx` (45 l.) | Radio group of colored squares from `db.CategoryGroup.COLORS`; value stored is the index (`label`), colour via `view.intToHex` | no usage found in `src/`/`js/` | none |
| `ProductTypeRadioGroup.hx` (49 l.) | Radio group with image `/img/<type>.png` for each `ProductType` enum constructor | no usage found | none |
| `UnitQuantity.hx` (26 l.) | `FloatInput` wrapped in bootstrap input-group with unit label `Formatting.unit(unit)` | no usage found | `camap-common/src/products/format.ts` |
| `StockTrackingPerDistribForm.hx` (234 l.) | Composite `FormElement<Int>`: validates and renders the "stock per distribution" config for a Product (modes AlwaysTheSame, FrequencyBased (needs `firstDistrib`, `frequencyRatio` 1/2,1/3,1/4), PerPeriod) reading raw `App.current.params` keys `<form>_stock_AlwaysTheSame`, `_stock_FrequencyBased`, `_firstDistrib`, `_frequencyRatio` (`StockTrackingPerDistribForm.hx:36-70`); errors are French strings wrapped in `_()` | `service/ProductService.hx:119` | stock tracking fields exposed in GraphQL `Product.stockTracking` (`camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts:142`) |

### 1.4 Missing React/redux units `camap-hx/js/react/...` (legacy order box)

| File | Behaviour | Server calls | TS counterpart |
|---|---|---|---|
| `order/redux/components/CatalogsBox.hx` (41 l.) | Screen "Choisissez le catalogue dont vous voulez voir les produits" with back button (`location.hash="/"`) and `<CatalogSelector multiDistribId>` | via CatalogSelector | none (order box replaced by front-core shop modules) |
| `order/redux/components/CatalogSelector.hx` (70 l.) | `@:connect` component; on mount dispatches `OrderBoxThunk.fetchCatalogs(multiDistribId)`; if exactly one catalog, auto-selects it (28-31, render side effect); on select dispatches `SelectCatalog` and sets `location.hash="/insert"` | `GET /api/order/catalogs/<multiDistribId>?catalogType=1` (`OrderBoxThunk.hx:120`) | none |
| `order/redux/actions/OrderBoxAction.hx` (22 l.) | Redux action enum: FetchOrdersSuccess, FetchUsersSuccess, SelectUser, UpdateOrderQuantity, ReverseOrderRotation, UpdateOrderUserId2, UpdatePaid, FetchCatalogsSuccess, SelectCatalog, FetchProductsSuccess, SelectProduct, FetchFailure | n/a | n/a |
| `order/redux/reducers/OrderBoxReducer.hx` (156 l.) | State `{orders, ordersWereFetched, users, selectedUserId/Name, catalogs, selectedCatalogId, products, error}` (12-21). `SelectProduct` (116-148): increments quantity of an existing line unless product `multiWeight`, else pushes a new `UserOrder` with a negative random temporary id `0 - Std.random(1000000)` (131) | n/a | none |
| `product/redux/components/ProductSelect.hx` (67 l.) | On mount `fetchProducts(catalogId)`; click -> `SelectProduct`, `location.hash="/"` | `GET /api/product/get/?catalogId=` (`OrderBoxThunk.hx:150,156`) | `ResolveField`s of `Product` in `products.resolver.ts` |
| (for context) `OrderBoxThunk.hx` endpoints | `GET /api/order/get/<userId>`, `POST /api/order/update/<userId>`, `GET /api/user/getFromGroup/` (`OrderBoxThunk.hx:21,44,99`) | | `camap-hx/src/controller/Api.hx` is the server side (`Main.doApi`, `Main.hx:190-207`) |

## 2. Templates

Templates live in `camap-hx/lang/master/tpl/` (116 files) with a translated copy in `camap-hx/lang/fr/tpl/` (117 files; the only extra one is `mail/digest_html.mtt`). The ten files below are the ones whose name (path or basename) appears in none of drafts 01-10; 7 more with only 1-2 incidental mentions are added in 2.2. Template layout uses Templo (`::use 'x.mtt'::` inheritance, `::cond::`, `$$macro(...)`).

### 2.1 Templates with zero mentions

| Template (master, same size in fr) | Rendered by (controller:line) | Auth of that action | What it shows / posts | TS / front-core counterpart |
|---|---|---|---|---|
| `cssDemo.mtt` (196 l.) | `Main.doCssdemo`, `camap-hx/src/controller/Main.hx:209-215` | none | Static design demo (alerts `alert-danger`/`alert-success`, buttons large/default/primary..., `btn-noAntiDoubleClick`); prints `users.get("bob")` (`cssDemo.mtt:5`). Extends `design.mtt` | none (Storybook in `camap-ts/packages/front-core/stories/`) |
| `admin/basedesign.mtt` (28 l.) | not rendered directly: `admin/design.mtt:1` does `::use 'admin/basedesign.mtt'::`, and `admin/default.mtt`, `emails.mtt`, `errors.mtt` use `admin/design.mtt` | `@admin` (`Main.hx:333`) | Super-admin sidebar. Links: `/admin/errors`, `/admin/emails`, `/admin/messages`, `/admin/attention`, `/admin/attentionAdmins`, `/admin/group`, `/admin/user` (14-20). `/db` link commented out ("incompatibility with mysql upgrade to v8", 11-13). No link to `/admin/theme` nor `/admin/superadmins` although both routes exist (`Admin.hx:42,207`) | none |
| `distribution/listByDateShort.mtt` (116 l.) | `Distribution.doListByDate`, chosen when `type == "allshort"` (`camap-hx/src/controller/Distribution.hx:190-191`); radio label "All but without prices and totals" (`Distribution.hx:155-160`) | `/distribution/listByDate/<date>/<placeId>/<type>/<fontSize>`; section requires `canManageAllContracts` (`Distribution.hx:24-27`) | Printable attendance sheet: group name, "Livraison du <date>", columns Name / Contact details / Qty / Product / Signature (22-26); one row group per user, shows basket number (`getBasket(m.basketId)`, 43-44), phone via `getUser(...)` + `$$nullSafe` (58-67), "alternately with" for `userName2` (48-50), "Canceled" for qty 0 canceled (75-76). No prices. Font ratio comes from `view.fontRatio` (S 0.75, M 1, L 1.25, XL 1.5, `Distribution.hx:178-183`) | `attendanceClassicContract` / `attendanceVariableContract` queries (`camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts:30,90`) + front `csaAttendanceSheet` module; no equivalent of the per-date, all-contracts print |
| `distribution/listByDateOnePageContract.mtt` (179 l.) | same action, `type == "contract"` (`Distribution.hx:192-193`), label "One person per page sorted by catalog" | same | One member per page, rows sorted by catalog: columns Contract / Qty / Product / U.P. / Fees / Total / Signature (`tableHeader` fill, 19-30); header right-aligned with group name and "Delivery of the <date>" (11-16); new `<table>` + `<hr/>` per user change (40-46); shows member phone "Tel: ..." (58-61) | none |
| `contractadmin/adddocument.mtt` (49 l.) | `Documents.doInsert(?catalog)`, `camap-hx/src/controller/Documents.hx:112-153`. Layout switches between `contractadmin/design.mtt` (catalog given) and `amapadmin/design.mtt` (group) (`adddocument.mtt:1-7`) | catalog: `canManageContract(catalog)`; group: `isAmapManager()` (`Documents.hx:116-129`) | multipart form: file input "PDF uniquement", optional name, visibility radio `subscribers` (only if catalog), `members` (default), `public` (34-38). Server: max 10 MB (`getMultipart(1024*1024*10)`, `Documents.hx:137`), PDF accepted by checking only the filename ends with `.pdf` (148), stores `sugoi.db.File` + `EntityFile` with `documentType='document'`, `data=<visibility>` (154-160) | `createDocument` mutation `camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts:55-` (same .pdf-name check at 66 and 10 MB at 83-84; entity types switch at ~100) + `front-core/src/components/DocumentUploader.tsx` |
| `contractadmin/addmedia.mtt` (39 l.) | `Media.doInsert`, `camap-hx/src/controller/Media.hx:82-` (layout `amapadmin/design.mtt`) | `isAmapManager()` (`Media.hx:85`); max 5 media per group (`Media.hx:86-89`) | multipart form, file `.png,.jpg,.jpeg,.bmp,.gif`, label says "limite a 3 Mo", visibility fixed to "public" (25-30) | `VendorImage` / `Vendor.media` is vendor-scoped (`vendors.resolver.ts:408`, `entityFile.service.ts:58-66` filters `entityType:'vendor', documentType:'media'`); no group-level media in TS |
| `contractadmin/subscriptionbalancetransfer.mtt` (55 l.) | `SubscriptionAdmin.doBalanceTransfer`, `camap-hx/src/controller/SubscriptionAdmin.hx:382-415` | `canManageContract` | Form with CSRF `token`, select `subscription` listing the other subscriptions "Souscription au <catalog> du <start> au <end> - Solde ..." (30-32), submit "OK" | none |
| `contractadmin/subscriptionpayments.mtt` (104 l.) | `SubscriptionAdmin.doPayments`, `SubscriptionAdmin.hx:357-380` | `canManageContract` (358) | Title "Paiements pour la souscription de <couple name>", balance cell (red if <0, green otherwise, 12-22) + button "Transferer le solde" to `/contractAdmin/subscriptions/balanceTransfer/<id>` (the `balance > 0` condition is commented out, 23-33, so negative balances can be transferred), payments table (date / type / description / amount / actions, 36+), total operation row (70-84). Controller refreshes the total operation (`createOrUpdateTotalOperation`) only if the catalog is active (359-363) | `CsaSubscription.balance` field only (`csa-subscriptions.resolver.ts:16`) |
| `history/subscriptionpayments.mtt` (95 l.) | `History.doSubscriptionPayments`, `camap-hx/src/controller/History.hx:107-121` | `@logged` + member of current group; no ownership test (I-5) | Same table as above for the member view; the transfer button block is wrapped in an HTML comment "desactiver le transfert de solde dans cet ecran" (27-37) | none |
| `contractadmin/subscriptionadmin/editsubscription.mtt` (181 l.) | `SubscriptionAdmin.doInsert(catalog)` (`SubscriptionAdmin.hx:63`) and `doEdit(subscription)` (`SubscriptionAdmin.hx:194`) | `canManageContract` (both) | Form POST: member select when creating (`::if !edit::`, 18-26), default-orders block if `catalog.hasDefaultOrdersManagement()` (35), per-product quantity + `user2` alternate member select for constant-order catalogs (58-100), for variable catalogs a link "page commandes de ce contrat" `/contractAdmin/selectDistrib/<id>` (105-109), start/end dates rendered by `startDate.render()` (120-129), absences selects `absence<i>` up to `catalog.absentDistribsMaxNb` when `hasAbsencesManagement()` (134-165), admin-only button "Reattribuer souscription" -> `/contractAdmin/subscriptions/reattribute/<id>` (176-177) | subscription GraphQL type fields only (`csa-subscriptions.resolver.ts`); no subscription mutation in TS handler list |

### 2.2 Templates with only 1-2 incidental mentions

| Template | Rendered by | Notes |
|---|---|---|
| `admin/user/usergroup.mtt` (46 l.) | `controller/admin/User.hx:62-77` (`@admin` `doUserGroup(u,g)`) | Shows a member's `UserGroup`, last operations (`db.Operation.getLastOperations`), MDs +/- 3 months (`timeframe` = now -3 / +3 months of 30.5 days) with their orders |
| `contractadmin/vendorsByTimeFrame.mtt` (67 l.) | `ContractAdmin.doVendorsByTimeFrame` (see 1.1) | `$$export(/contractAdmin/vendorsByTimeFrame/<from>/<to>?csv=1)` button (9) |
| `distribution/listByDateOnePage.mtt` (164 l.) | `Distribution.doListByDate`, `type == "one"` (`Distribution.hx:188-189`) | One member per page, with prices |
| `mail/notifications/subscription-created-user.mtt` (73 l.) | `SubscriptionService.hx:713` via `App.current.processTemplate` | Mail to the new subscriber: link to `https://::HOST:://subscriptions/contract/<catalogId>` (line 2: a literal double slash after the host, see I-9) and vendor page `/vendor/view/<id>`; text depends on `isVarWithMin`/`isVarWithDefault` (flags built at `SubscriptionService.hx:721-722`) |
| `mail/notifications/subscription-created-coordinator.mtt` (34 l.) | `SubscriptionService.hx:739` | Mail to the catalog coordinator, same flags (`SubscriptionService.hx:748-749`) |
| `mail/orderSummaryForMember.mtt` (77 l.) | `OrderService.hx:542` | Order recap: distribution date/hours/place address (11-17), lines with `m.smartQt`, `m.productName`, price/subtotal (35-52). Layout `mail/layout-group.mtt` |
| `mail/layout-camap.mtt`, `mail/layout-group.mtt` | `use`d by the mail templates | HTML mail shells (branded footer from theme `email.brandedEmailLayoutFooter`, `camap-hx/src/App.hx:121-136`). TS counterpart: twing templates in `camap-ts/packages/api-core/mails/dist/*.twig` listed by `MailsController.list` (`mails.controller.ts:67-86`) |

## 3. TS handlers (full unmentioned list)

Method: every `@Query`, `@Mutation`, `@TransactionalMutation` (custom wrapper = `Transactional()` + `Mutation()`, `camap-ts/packages/api-core/src/common/decorators/transactional-mutation.decorator.ts:5-7`), `@ResolveField`, `@Get`, `@Cron` under `camap-ts/packages/api-core/src` (specs excluded) was extracted with a multi-line-aware script (decorator may span several lines; method name taken from the first signature line). No `@Post`, `@Put`, `@Delete`, `@Patch`, `@Subscription` exists. Each method name was then searched as a whole word in drafts 01-10, and a second time restricted to lines that also contain the resolver file name.

Result: **181 handlers** = 50 `@Query`, 26 `@Mutation`, 5 `@TransactionalMutation`, 82 `@ResolveField`, 11 `@Get`, 7 `@Cron` (the critic detected 87 of them). Per file (A = total, B = method name found in no draft, C = name found but never on a line naming the resolver file):

| File | A | B | C | B names |
|---|---|---|---|---|
| `camap-ts/packages/api-core/src/auth/auth.resolver.ts` | 6 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/auth/controllers/auth-bridge.controller.ts` | 3 | 2 | 0 | getTokenforUser, deleteUser |
| `camap-ts/packages/api-core/src/files/file.controller.ts` | 3 | 3 | 0 | getFile, compressFile, compressFiles |
| `camap-ts/packages/api-core/src/groups/resolvers/csa-subscriptions.resolver.ts` | 3 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/groups/resolvers/group-previews-catalogs.resolver.ts` | 5 | 0 | 5 | - |
| `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts` | 4 | 0 | 1 | - |
| `camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts` | 7 | 4 | 1 | getAll, getAll2, hasPhoneRequired, hasAddressRequired |
| `camap-ts/packages/api-core/src/groups/resolvers/groups.resolver.ts` | 8 | 0 | 3 | - |
| `camap-ts/packages/api-core/src/groups/resolvers/memberships.resolver.ts` | 10 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/groups/resolvers/userGroups.resolver.ts` | 3 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/groups/resolvers/userLists.resolver.ts` | 4 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts` | 5 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/mails/controllers/mail-bridge.controller.ts` | 1 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts` | 2 | 1 | 0 | getMail |
| `camap-ts/packages/api-core/src/mails/mails.service.ts` | 1 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/messages/messages.resolver.ts` | 8 | 1 | 0 | getMessage |
| `camap-ts/packages/api-core/src/messages/messages.service.ts` | 1 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/payments/resolvers/operation.resolver.ts` | 4 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts` | 1 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/shop/resolvers/attendance-list.resolver.ts` | 2 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/shop/resolvers/distribution-cycles.resolver.ts` | 7 | 0 | 5 | - |
| `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts` | 9 | 1 | 1 | userOrders |
| `camap-ts/packages/api-core/src/shop/resolvers/multi-distribs.resolver.ts` | 9 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/shop/resolvers/orders.resolver.ts` | 2 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/tools/cache.service.ts` | 1 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/tools/crontab.service.ts` | 3 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/tools/resolvers/entity-file.resolver.ts` | 5 | 0 | 2 | - |
| `camap-ts/packages/api-core/src/tools/tools.controller.ts` | 2 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/users/users.resolver.ts` | 13 | 1 | 1 | getMe |
| `camap-ts/packages/api-core/src/users/users.service.ts` | 1 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts` | 10 | 0 | 0 | - |
| `camap-ts/packages/api-core/src/vendors/resolvers/products.resolver.ts` | 11 | 0 | 4 | - |
| `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts` | 27 | 3 | 4 | imageFile, portrait, activeCatalogs |

Totals: A=181, B=16, C=27.

### 3.1 The 16 "name not found" handlers: 10 are in fact documented under their route / GraphQL name

| Handler (path:line) | Documented as | Where |
|---|---|---|
| `auth/controllers/auth-bridge.controller.ts:21` `getTokenforUser` = `GET /bridge/auth/tokens/:id` | route | `03-users-auth-groups.md:127`, `10-integration-tests.md:62,149` |
| same file `:48` `deleteUser` = `GET /bridge/auth/delete-user/:id` | route | `03:129`, `10:60,151` |
| `files/file.controller.ts:33,51,90` `getFile`/`compressFile`/`compressFiles` = `GET /files/get/:id`, `/files/compress/:id`, `/files/compressAll/:page` | route | `04-catalogs-products-vendors.md:88`, `10:155` |
| `mails/controllers/mails.controller.ts:36` `getMail` = `GET /mails/get/:templateName/:params` | route | `08-messaging-crons.md:94`, `10:153` |
| `groups/resolvers/group-previews.resolver.ts:53,58` `getAll`/`getAll2` = queries `groupPreviews`, `groupPreviews2` | GraphQL name | `03:115`, `10:119` |
| `messages/messages.resolver.ts:58` `getMessage` = query `message(id)` | GraphQL name | `08:98` |
| `users/users.resolver.ts:57` `getMe` = query `me` | GraphQL name | `03:103` |

Critic statement "real gaps: file controller routes, mail preview controller, getMessage" is therefore outdated/incorrect for those items; what these entries still lack is behaviour detail, given here:

| Handler | Behaviour (read) | Guard |
|---|---|---|
| `GET /files/get/:id` (`file.controller.ts:33-49`) | Loads `FileEntity` by id, writes an HTML page `<img src="data:image/*;base64,...">` with the raw blob | class `@UseGuards(GqlAuthGuard)` (25) + `currentUser.isSuperAdmin()` else `UnauthorizedException` (39-41) |
| `GET /files/compress/:id` (`:51-88`) | Re-encodes one file with `sharp`: jpeg(mozjpeg) if extension jpg/jpeg else png quality 80, `resize(null,500,{withoutEnlargement})`, then **overwrites** `data` in DB (77); on error replies "Not an image" | superadmin (58-60) |
| `GET /files/compressAll/:page` (`:90-150`) | Same compression over 500 files per page (`take:500, skip:(page-1)*500`, 102-105) with `Promise.allSettled`, updates each row, logs with `console.log` | superadmin (96-98) |
| `GET /mails/get/:templateName/:params` (`mails.controller.ts:36-65`) | `JSON.parse(params)`, fills `text` (faker lorem) for `message.twig` and a random `groupName` when absent (46-52), adds theme when `THEME_ID !== 'default'` (54-57), returns `mailsService.renderTwing(...)` HTML | class guard `GqlAuthGuard` (28) + superadmin (42-44) |
| `GET /mails/list` (`:67-86`) | Lists `*.twig` in `api-core/mails/dist` as links to `${FRONT_URL}/mails/get/<file>/%7B%7D` | superadmin (69-71) |
| `GET /bridge/auth/tokens/:id` (`auth-bridge.controller.ts:21-32`) | Returns `jwtService.sign({email,id})` for a user | class guard `AuthGuard('bridge')` (13) |
| `GET /bridge/auth/logout/:id` (`:34-46`) | `usersService.removeRefreshToken(user.id)` | same |
| `GET /bridge/auth/delete-user/:id` (`:48-60`) | `usersService.delete(user)` (state change through GET) | same |
| `query message(id)` (`messages.resolver.ts:58-81`) | Loads message, `userIsAllowedToAccessMessages(currentUser, message.amapId)` (= `UserGroupsService.canManageMessages`, 206-218), parses `recipients` JSON | class `GqlAuthGuard` (28); ordering bug I-3 |
| `query me` (`users.resolver.ts:56-60`) | Returns the JWT user | `GqlAuthGuard` (56) |

### 3.2 The 6 handlers whose name appears nowhere (not even as GraphQL field name)

| Handler (GraphQL type.field) | path:line | What it does | Auth | HX counterpart |
|---|---|---|---|---|
| `Vendor.imageFile` | `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:388-392` | Returns `File` object for `imageId` via `filesService.findOneAndConvertToFile` (null when no image) | none on resolver class (class declaration has no `@UseGuards`; vendor.resolver guards are per method) and none on the field | not verified (no hx read for this field) |
| `Vendor.portrait` | `vendors.resolver.ts:394-406` | URL of the vendor "portrait" image through `VendorPortraitsLoader` (DataLoader on `EntityFile`), empty string when none | none | not verified |
| `Vendor.activeCatalogs` | `vendors.resolver.ts:428-431` | `catalogsService.findByVendor(parent.id, true)` (active catalogs only) | none | not verified |
| `Distribution.userOrders` | `camap-ts/packages/api-core/src/shop/resolvers/distributions.resolver.ts:96-104` | Returns `parent.userOrders` if preloaded, else `ordersService.findUserOrdersByDistributionIds([parent.id])` (`payments/services/orders.service.ts:21`); fields exposed: `id, quantity, productPrice, productId, userId, distributionId, subscriptionId` (`shop/types/user-order.type.ts`) | **none**: the class has only `@Resolver(() => Distribution)` (19-20), query `distribution(id)` has no guard (32-33), there is no `APP_GUARD`/global guard in `app.module.ts:66-75` (see I-4) | `UserOrder` in `db/UserOrder.hx`; HX shows orders only after `@logged` + rights |
| `GroupPreview.hasPhoneRequired` | `camap-ts/packages/api-core/src/groups/resolvers/group-previews.resolver.ts:128-131` | `groupsService.hasPhoneRequired(group)` (group flag) | none (class has no guard; `groupPreview(id)` is public, :38) | `db.Group.GroupFlags.PhoneRequired` (checked at `Main.hx:142` for the address variant) |
| `GroupPreview.hasAddressRequired` | `group-previews.resolver.ts:133-136` | `groupsService.hasAddressRequired(group)` | none | `GroupFlags.AddressRequired` (`camap-hx/src/controller/Main.hx:142`) |

### 3.3 27 handlers whose name is mentioned but never next to their resolver

Name matches in drafts are generic (`get`, `users`, `image`, `places`...), so these are effectively undocumented. Guard column: "class" = class-level `@UseGuards`.

| Handler | path:line | What it does | Guard |
|---|---|---|---|
| `Product.currency` | `vendors/resolvers/products.resolver.ts:114` | `catalog.group.currencyCode` of the product's catalog | class `GqlAuthGuard` (23) |
| `Product.vendorId` | `:119` | `catalog.vendorId` via `CatalogsLoader` | class |
| `Product.vendorName` | `:129` | `vendor.name` via `CatalogsLoader` + `VendorsLoader` | class |
| `Product.catalogName` | `:153` | `catalog.name` via loader | class |
| `Vendor.media` | `vendors/resolvers/vendors.resolver.ts:408` | `VendorImage[]` {id,name,url} from `entityFilesService.findVendorImages` (`entityFile.service.ts:58-66`: `entityType='vendor'`, `documentType='media'`) | none |
| `Vendor.profession` | `:418` | `parent.profession` (Int) | none |
| `Vendor.nextDistributions` | `:470-509` | Next distributions of active catalogs grouped by group, sorted by date, only first 4 per group (`slice(0,4)`) | none |
| `Vendor.allDistributions(fromDate?)` | `:511-546` | Same over all catalogs (active or not), optional `fromDate` | none |
| `EntityFile.url` | `tools/resolvers/entity-file.resolver.ts:38` | `filesService.getUrl(fileId)` | none (only `createDocument`/`deleteDocument` have `GqlAuthGuard`, :53-55, 184) |
| `EntityFile.name` | `:43` | `(await filesService.findOne(fileId)).name` (one query per row) | none |
| `DistributionCycle.startDate/endDate/startHour/endHour/openingHour/closingHour` (5 not matched: startDate, startHour, endHour, openingHour, closingHour) | `shop/resolvers/distribution-cycles.resolver.ts:52,60,68,76,84,92` | each = `zonedTimeToUtc(parent.raw_<field>, TZ_PARIS)`: DB values are Paris local time | class `MaybeAuthGuard` (line before resolver class) |
| `Distribution.multiDistrib` | `shop/resolvers/distributions.resolver.ts:106-121` | preloaded -> `finder.one(multiDistribId)` -> else `NotFoundException` | none |
| `GroupPreviewCatalogs.get` (query `groupPreviewCatalogs(id)`) | `groups/resolvers/group-previews-catalogs.resolver.ts:32-49` | `userIsAllowedToManageCatalogs` then `group.getPreviewCatalogs()` | class `GqlAuthGuard` (21) + catalog-manage right |
| `GroupPreviewCatalogs.volunteerRoles` | `:53` | `volunteersService.findRolesFromGroupId` | class |
| `GroupPreviewCatalogs.places` | `:66` | `placesService.findFromGroup` | class |
| `GroupPreviewCatalogs.mainPlace` | `:79` | `groupsService.getMainPlace` | class |
| `GroupPreviewCatalogs.users` | `:87` | `userGroupsService.findAllUsersOfGroupId(group.id, [], true)` | class |
| `Query group(id)` (method `get`) | `groups/resolvers/groups.resolver.ts:44-58` | group entity after `userIsAllowedToManageGroup` | `GqlAuthGuard` (43) + group admin |
| `Group.image` | `:67` | `filesService.getUrl(imageId)` | `GqlAuthGuard` |
| `Group.multiDistribs` | `:83` | `multiDistribsService.finder.byGroupId` | `GqlAuthGuard` |
| `Query groupPreview(id)` (method `get`) | `groups/resolvers/group-previews.resolver.ts:38-50` | public group preview; `NotFoundException` if absent | none |
| `Query groupPreviewMembers(id)` (method `get`) | `groups/resolvers/group-previews-members.resolver.ts:44-60` | `userIsAllowedToManageMembers` then `group.getPreviewMembers()` | class `GqlAuthGuard` + member-manage right |
| `User.notifications` | `users/users.resolver.ts:141-150` | `{hasEmailNotif4h, hasEmailNotif24h, hasEmailNotifOuverture}` computed from the user flag bits (`userHasEmailNotif4h/24h/Ouverture`), re-reads user by id | none on the field |

Related unguarded-field detail: `Vendor.phone` and `Vendor.email` (`vendors.resolver.ts:451-468`) are documented elsewhere but see I-2.

## 4. Variable keys

Shared table `Variable(name varchar(64) PK, value mediumtext)`: TS entity `camap-ts/packages/api-core/src/tools/models/variable.entity.ts:3-10`; HX side is `sugoi.db.Variable` (library class, not in the repo; used with `Variable.get/getInt/set`). A grep of `Variable` over `camap-hx/src`, `js`, `common`, `lang/*/tpl` and `camap-ts/packages/api-core/src` + `test` yields the complete inventory below (11 keys + 3 template keys + 4 TS enum keys).

### 4.1 Keys used by Haxe

| Key | Written by | Read by | Meaning / format | Reader auth effect | TS counterpart |
|---|---|---|---|---|---|
| `maintain` | nobody in repo (set manually in DB) | `Main.doDefault` `sugoi.db.Variable.getInt("maintain") != 0` (`camap-hx/src/controller/Main.hx:36`) | non-zero = maintenance: renders `maintain.mtt` instead of redirecting to `/home`; bypassed for `user.isAdmin()` (39-41) | admin bypass | none |
| `attMessage` | `Admin.doAttention` (`camap-hx/src/controller/admin/Admin.hx:173`) | `Main.hx:167` (flash message to every member on the group home page), `Admin.hx:167` (form default) | free text/HTML; ignored when `""`, null or the string `"null"` (`Main.hx:168`) | all members | none |
| `attMessageAdmins` | `Admin.doAttentionAdmins` (`Admin.hx:197`) | `Main.hx:151`, `Admin.hx:186` | text for group admins | only members with `ug.getRights().length > 0` or `isAdmin()` (`Main.hx:150`) | none |
| `attMessageAdminsAlert` | `Admin.hx:198` (value of checkbox `msgAlert`) | `Main.hx:153` (`== "true"` -> red flash), `Admin.hx:187,190` (`== "true"` to pre-tick) | boolean stored as string | same | none |
| `homeMessage` | `Admin.doMessages` (`Admin.hx:154`) | `Admin.hx:148`; template `camap-hx/lang/{master,fr}/tpl/user/choose.mtt:3-6` via `getVariable("homeMessage")`, output with `::raw::` (unescaped HTML) | banner on the group chooser page | public page after login | none |
| `whiteLabel` | `Admin.doTheme` (`Admin.hx:52`, JSON of `Theme`) | `App.setTheme` raw SQL `SELECT value FROM Variable WHERE name='whiteLabel'` (`camap-hx/src/App.hx:145-147`); falls back to `defaultTheme` on null or any exception (148-150); cached in static `App.theme` | theme JSON (names, links, email footer, terms links ...) | n/a | `VariableService.getTheme()` does NOT read it (I-1) |
| `smtp_host`, `smtp_port` (Int), `smtp_user`, `smtp_pass` | nobody in repo | `BufferedJsonMail` builds the SMTP config sent to the bridge (`camap-hx/src/db/BufferedJsonMail.hx:82-85`) | SMTP credentials stored in clear text in DB | n/a | TS mailer is configured by env `MAILER_TRANSPORT`/`SMTP_HOST` (`camap-ts/packages/api-core/src/envSchema.ts:25-28`), not by Variable (`smtp_host` has no hit in api-core/src) |

Keys read through the template helper `getVariable(...)` (helper implemented in the sugoi library, not in this repo, so what backs it was not verified): `googleTagManagerId` (`lang/master/tpl/base.mtt:26,94`), `css` (`base.mtt:31,36,38,42`) and `js` (`base.mtt:50,52,53`), used as asset-version path segments.

`camap-hx/src/controller/Install.hx:3` imports `sugoi.db.Variable` but makes no use of it. `camap-hx/src/test/TestSuite.hx:88` only registers the table for test DB creation.

### 4.2 Keys used by TypeScript (`VariableNames`, `camap-ts/packages/api-core/src/tools/variable.service.ts:9-14`)

| Key (enum member) | Written by | Read by | Effect |
|---|---|---|---|
| `tosVersion` (comment: "Terms Of Service (for users)") | seeded `'1'` by `dev/dataset-generator.ts:746` only | no reader in `api-core/src` | none today |
| `platformtermsofservice` (`platformTermsOfServiceVersion`, comment: vendors' platform ToS) | seeded `'1'` by `dataset-generator.ts:747` | `VendorService.create` -> `getInt(...)` stored into `Vendor.tosVersion` (`camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:183-195`) | stamps new vendors with the current ToS version; if the row is missing `getInt` crashes (I-10) |
| `IPBlacklist` | none | `BlackListGuard` (`camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:26-39`): JSON array of IPs (also tests IP without `::ffff:` prefix) | guard also rejects User-Agent containing `python` (45-47) but the guard is never used (I-11) |
| `defaultShowcaseGroupIds` | none | none (declaration only, `variable.service.ts:14`) | dead |

`VariableService.set` (`variable.service.ts:49-59`) and `findOneByKey` (:23) are called only by the CLI helpers `loadAdminProcess` / `saveAdminProcess` (`cli/utils.ts:55-72`), which store JSON state under an arbitrary `name`; no caller of those helpers exists in `api-core/src`. So TS writes `Variable` only through the dataset seeder (and these unused helpers), while HX writes `attMessage*`, `homeMessage`, `whiteLabel`; front-core has no equivalent admin pages.

## 5. Logging & errors

### 5.1 Error reporting services (Sentry etc.)

No Sentry (or Rollbar/Bugsnag/Datadog) integration exists in sources: a case-insensitive grep for `sentry` over `camap-hx` and `camap-ts` (excluding `node_modules`, `dist`, `haxe_libraries`) matches only compiled third-party bundles `camap-ts/public/neostatic/vendors.*.bundle.js` (build artefacts) and the previous coverage report; nothing in any `package.json`, `*.ts`, `*.tsx`, `*.hx`. The critic's "Sentry" item is therefore "not present today".

### 5.2 Haxe (neko / Apache) side

| Mechanism | Behaviour | path:line |
|---|---|---|
| `App.log(t)` | Only when `App.config.DEBUG`: `neko.Web.logMessage(Std.string(t))` -> Apache error log; optional `Weblog.log` under `#if weblog` | `camap-hx/src/App.hx:188-195` |
| `App.current.logError(e[, stack])` (implemented in the sugoi library, not in repo; table `sugoi.db.Error` with fields read at `Cron.hx:365`: `error`, `url`, `user`, `ip`, `date`) | Persist an error row. Called: API catch-all (`Main.hx:203`), scripts catch-all (`Main.hx:348`), cron mail failures (`Cron.hx:615,706`), cron JSON dump when `?json=1` ("debug in error log db", `Cron.hx:81`), `PaymentService.hx:202` (logs `OrderService.prepare(orders)` dump on a payment inconsistency) | listed |
| REST API errors | `controller.Api` dispatch wrapped in try/catch: `tink.core.Error` -> HTTP `e.code`, body `{error:{code,message,stack}}`, rollback (`Main.hx:193-198`); any other exception -> HTTP 500, `logError(e,stack)`, body includes the **stack trace** to the client, rollback (`Main.hx:199-206`) | `camap-hx/src/controller/Main.hx:187-207` |
| CLI scripts (`neko index.n scripts/<x>`) | Catch-all: `setReturnCode(500)`, prints message and each stack line with `Sys.println`, `logError`, `rollback` (`Main.hx:341-358`); each script prints progress with `Sys.println` (`Scripts.hx:19-25`) | `camap-hx/src/controller/Scripts.hx`, `Main.hx` |
| Cron tasks | `TransactionWrappedTask(name)` with `task.log` / `task.warning` (e.g. `Cron.hx:616-617,707-708` print exception + call stack); `task.execute(!App.config.DEBUG)` | `camap-hx/src/controller/Cron.hx` |
| Daily error digest | Cron task "Send errors to admin by email" (`Cron.hx:353-377`): selects `Error` rows between yesterday 00:00 and 24:00 (`$date < yest24h && $date > yest0h`), builds HTML `error at URL (user, IP)` and mails it to `App.config.get("webmaster_email")` with subject "<theme name> Errors"; no mail when none | `camap-hx/src/controller/Cron.hx:353-377` |
| Back-office viewer | `/admin/errors` (see 1.1): paginated list + 30-day chart; `?empty=1` truncates the table | `camap-hx/src/controller/admin/Admin.hx:101-129` |
| Application-level user errors | `throw Error(url,msg)` / `throw Ok(url,msg)` / `throw Redirect(url)` (sugoi dispatcher; about 174 `throw Error(`/`Std.string(e)` occurrences in `camap-hx/src`) become session flash messages, not log rows | `camap-hx/src/controller/*.hx` |
| `trace(...)` | Only 3 live uses: `VolunteerService.hx:146,152` (invalid member email), `OrderBoxThunk.hx:173` (browser console) | listed |
| Browser | no global error handler in Haxe React code | n/a |

### 5.3 TypeScript side

| Mechanism | Behaviour | path:line |
|---|---|---|
| Bootstrap log | `console.log("Server started on <url>. Production: ...")` | `camap-ts/packages/api-core/src/main.ts:93-97` |
| Nest `Logger` instances | `'MessageService'` (info on purge, `messages.service.ts:12,82`); `'MailService'` (errors: no valid recipients -> mail skipped/deleted `mails.service.ts:114,217`, SMTP rejections `:301`, send failure with stringified error `:328`); `'UsersService CRON'` (`users.service.ts:54,444,498,597,601`); `'FileService'` (`file.service.ts:17`) | listed |
| Raw `console.log` | `CrontabService` (calls to HX `/cron/minute|hour|daily`, success/failure only logged, `crontab.service.ts:18-53`; only when env `HX_TRIGGER_CRONS` set), `file.controller.ts:84,133,144`, `vendor.service.ts:228` (`console.log(group.name)` leftover), dataset CLIs | listed |
| CLI logger | `CliNestLogger` buffers log/warn/error in memory and prints errors in red; `debug`/`verbose` are no-ops (`camap-ts/packages/api-core/src/cli/cli-logger.ts:14-45`, used by `cli/utils.ts:30-47`); `ActionLogger` prefixes timestamps (`cli/utils.ts:73-76`) | listed |
| GraphQL | Apollo `debug` and `playground` enabled when `NODE_ENV !== 'production'` (`app.module.ts:46-47`): stack traces in error extensions outside production. No `formatError`, no global exception filter (`grep ExceptionFilter|@Catch|formatError` in `api-core/src`: no hit) | `camap-ts/packages/api-core/src/app.module.ts:41-52` |
| Exceptions thrown | Nest HTTP exceptions: `NotFoundException` x59, `UnauthorizedException` x37, `ForbiddenException` x37, `BadRequestException` x11, `InternalServerErrorException` x5 (grep `new <X>Exception(` in `api-core/src`, specs excluded) | listed |
| Domain errors | `CamapError(type)` (`camap-ts/packages/api-core/src/common/errors/camap.error.ts:3-14`) + `@MutationFail([types])` decorator that rolls back the transaction and returns `error.toObj()` as a normal GraphQL result instead of throwing (`common/decorators/mutation-fail.decorator.ts:5-25`); single use: `updateUser` (`users/users.resolver.ts:161`) | listed |
| Deadlocks | `DeadlockInterceptor` retries a request up to 5 times on MySQL `ER_LOCK_DEADLOCK` / Postgres `deadlock_detected` (`common/interceptors/dealock.interceptor.ts:5-33`, registered `app.module.ts:66-70`); HX has no equivalent | listed |
| Env validation | `Env error: ...` thrown at boot if `envSchema` fails (`app.module.ts:35-38`) | listed |
| Front-core | `utils/logger.ts` logs/warns/errors only if `NODE_ENV` is neither production nor test (`front-core/src/utils/logger.ts:3-14`); 30 files use the `ApolloErrorAlert` component; `CommonAlertError.tsx` in `components/`; many bare `console.error` (`VendorForm.tsx:139,159`, `ImageUploader.tsx:271`, etc.); Apollo client has only a scalar link and a custom-header link, no `onError` link (`front-core/src/lib/initApollo.tsx:33-75`) | listed |

Gap summary: HX persists errors in DB and mails a daily digest; TS has no persistence, no digest, no alerting: errors only go to stdout through Nest `Logger`/`console`.

## 6. Inconsistencies (doc / code)

`[CONFIRMED]` = I read the cited lines and they prove the statement. Everything else is tagged `[NOT VERIFIED]`.

### 6.1 Code inconsistencies

| # | Tag | Finding | Evidence |
|---|---|---|---|
| I-1 | [CONFIRMED] | The theme edited through HX `/admin/theme` is stored in `Variable.whiteLabel` and read by HX (`App.hx:145-147`), but TS `VariableService.getTheme()` never reads the DB: it returns `DEFAULT_THEME(CAMAP_HOST)` cached forever in a static (`variable.service.ts:61-72`). TS mails (`mails.service.ts:65,102,240`), invitations (`group-previews-members.resolver.ts:191,306`) and `users.service.ts:515` therefore ignore any white-label customisation. | `camap-hx/src/controller/admin/Admin.hx:52`, `camap-hx/src/App.hx:145-150`, `camap-ts/packages/api-core/src/tools/variable.service.ts:61-72` |
| I-2 | [CONFIRMED] | `Vendor.phone` and `Vendor.email` resolvers call the **async** `userIsAllowedToManageCatalogOfVendor` without `await` (`vendors.resolver.ts:456,465`; function declared `private async` at `:548`). `editor` is a Promise (always truthy), so the vendor phone/email are always returned and the vendor's `showPhone`/`showEmail` privacy flags are never applied. The three other call sites do `await` it (`:233,299,346`). The resolver also has no `@UseGuards` and `currentUser` can be undefined on a public query. | `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:451-468,548-565` |
| I-3 | [CONFIRMED] | Query `message(id)`: rights check dereferences `message.amapId` (`messages.resolver.ts:65`) before the `if (!message) throw NotFoundException` at `:67`, so an unknown id yields a TypeError (HTTP 200 with a GraphQL internal error) instead of "Message not found". | `camap-ts/packages/api-core/src/messages/messages.resolver.ts:58-81` |
| I-4 | [CONFIRMED] | `Distribution.userOrders` (`distributions.resolver.ts:96-104`) is reachable without authentication: class has only `@Resolver` (19-20), query `distribution(id)` has no guard (32-33), `app.module.ts:66-75` registers no `APP_GUARD`, `main.ts` has no `useGlobalGuards` (grep over `src`: no hit). `UserOrder` exposes `userId`, `productId`, `quantity`, `productPrice`, `distributionId`, `subscriptionId` (`shop/types/user-order.type.ts`). Compare HX, where orders need `@logged` + rights. | see left |
| I-5 | [CONFIRMED] | `History.doSubscriptionPayments(subscription)` only checks that the caller is a member of the current group (`History.hx:111-112`); it never compares `subscription.user` with `app.user` nor the subscription's group, then lists that subscription's payments and the total operation (113-120). Any logged member can read any subscription's payments by id. | `camap-hx/src/controller/History.hx:107-121` |
| I-6 | [CONFIRMED] | `Distribution.doEditMd` and `doChangePrice` check only `canManageAllContracts()` of the current group (`Distribution.hx:24-27,616,1108`); the `MultiDistrib` taken from the URL is never compared to `app.user.getGroup()`, and `DistributionService.editMd` (`DistributionService.hx:194-248`) accepts the form `placeId` without checking it belongs to the group. | `camap-hx/src/controller/Distribution.hx:614-678,1106-1151` |
| I-7 | [CONFIRMED] | `doBalanceTransfer` offers only same-user, same-vendor, non-closed subscriptions (`SubscriptionService.hx:118-127`) but the POSTed target id is validated only for "same user" (`SubscriptionService.hx:1104`); a crafted `subscription` id (including the source itself, another vendor's, or a closed one) is accepted. Also `fromSubscription.getBalance()` runs (1100) before the null check (1102). | `camap-hx/src/controller/SubscriptionAdmin.hx:396-409`, `camap-hx/src/service/SubscriptionService.hx:1099-1131` |
| I-8 | [CONFIRMED] | `CamapDatePicker` constructor parameter is spelled `attibutes` while the `super(...)` call passes `attributes` (the inherited field), so the constructor argument is silently ignored. | `camap-hx/src/form/CamapDatePicker.hx:13-21` |
| I-9 | [CONFIRMED] | Mail template builds the contract link as `https://::HOST:://subscriptions/contract/<id>`, i.e. a double slash after the host (`//subscriptions/...`). Vendor link on the next line uses a single slash. | `camap-hx/lang/master/tpl/mail/notifications/subscription-created-user.mtt:2-3` |
| I-10 | [CONFIRMED] | `VariableService.getInt` tests `if (i === null)` (`variable.service.ts:47`) but TypeORM 0.2.45 `findOne` returns `Promise<Entity \| undefined>` (`typeorm/repository/Repository.d.ts:235`), so a missing row goes on to `parseInt(i.value)` (:48) and throws TypeError. Caller `VendorService.create` (`vendor.service.ts:183-195`) would fail on a DB without `platformtermsofservice`. `get()` (:36-40) uses `!v` correctly. Also `set()` calls `this.variableRepo.save(v)` without `await` (`:59`) and returns before the write is done. | `camap-ts/packages/api-core/src/tools/variable.service.ts:36-60` |
| I-11 | [CONFIRMED] | `BlackListGuard` (IP blacklist from `Variable.IPBlacklist`, rejects UA containing "python") is never applied: grep of `BlackListGuard` in `api-core/src` finds only its own declaration; no `@UseGuards(BlackListGuard)`, no `APP_GUARD`. The `IPBlacklist` key is read nowhere else. | `camap-ts/packages/api-core/src/common/guards/black-list.guard.ts:11-50` |
| I-12 | [CONFIRMED] | Media upload: limit coded as 4 MB (`getMultipart(1024*1024*4)`), comment says 3 Mb, error message and template label say 3 Mo. | `camap-hx/src/controller/Media.hx:97-99`, `camap-hx/lang/master/tpl/contractadmin/addmedia.mtt:12` |
| I-13 | [CONFIRMED] | `FilesController.compressFile` contains a stray statement `4;` before the rights check (`file.controller.ts:57`). `compressFiles` injects `@Res()` yet `return 'No page'` when `page` is falsy (`:99`) [NOT VERIFIED: with `@Res()` Nest does not send a returned value, so the request may hang]. The three routes overwrite blobs in place (`:77,131`) with no backup. | `camap-ts/packages/api-core/src/files/file.controller.ts:51-150` |
| I-14 | [CONFIRMED] | HX document upload and TS `createDocument` both validate "PDF" by file-name extension only (`Documents.hx:148`; `entity-file.resolver.ts:66`), not by content; both cap at 10 MB. | listed |
| I-15 | [CONFIRMED] | `Install.doDiagnostics` is unauthenticated and has side effects (creates `file/` and `../tmp`), writes with `Sys.println` into the HTTP response, and only prints (does not repair) a missing `.htaccess`. `/cssdemo` is also unauthenticated (`Main.hx:209-215`). | `camap-hx/src/controller/Install.hx:106-122` |
| I-16 | [CONFIRMED] | `Admin.doErrors` empties the `Error` table on `GET ?empty=1` without CSRF token (`Admin.hx:111-113`); the `like` filter is parsed but its SQL is commented out (`Admin.hx:110`) so `?like=` does nothing. Admin side nav (`admin/basedesign.mtt:14-20`) lacks links to `/admin/theme` and `/admin/superadmins`. | `camap-hx/src/controller/admin/Admin.hx:101-129` |
| I-17 | [CONFIRMED] | Two separate "version" notions: HX `VERSION = [3,0,12]` hard-coded (`App.hx:21`, git macros commented out), TS `/ping` and `/health` return `process.env.VERSION` or `0` (`tools.controller.ts:11-21`). | listed |

### 6.2 Doc inconsistencies

| # | Tag | Finding | Evidence |
|---|---|---|---|
| D-1 | [CONFIRMED] | `99-coverage-critic.md` "Uncovered TS handlers / Real gaps" lists file controller routes, mail preview controller and `getMessage` as undocumented, but they are documented by route or GraphQL name (`04-catalogs-products-vendors.md:88`, `08-messaging-crons.md:94-95,98`, `10-integration-tests.md:153-155`). The critic matched on method name only. | section 3.1 above |
| D-2 | [CONFIRMED] | Critic counts "87 of ~169" decorators; the real count is 181 (+ the `@TransactionalMutation` wrapper decorator, which the critic's regex missed). | section 3 |
| D-3 | [CONFIRMED] | Critic says `Install.doDiagnostics` "checks `.htaccess`"; code only prints a message when it is missing (`Install.hx:114-116`). | `camap-hx/src/controller/Install.hx` |
| D-4 | [CONFIRMED] | `camap-ts/packages/api-core/docs/transactions.md` says `Transactional` must decorate `post`/`put`/`delete` controller methods, but api-core has no `@Post/@Put/@Delete` handler (only 11 `@Get`); it has an empty `## Lock` heading (line 9) and a non-compilable example `@Transactional() await decreaseStock(...)`. The codebase uses a combined `@TransactionalMutation` decorator (`transactional-mutation.decorator.ts`) that the doc does not mention. | `camap-ts/packages/api-core/docs/transactions.md` |
| D-5 | [CONFIRMED] | `camap-ts/packages/api-core/docs/dataloader.md` example names the loader `GroupLoader` in `group.loader.ts`; the actual class is `GroupsLoader` in `groups/loaders/groups.loader.ts:8` (and `AppModule` registers `DataLoaderInterceptor` as `APP_INTERCEPTOR`, `app.module.ts:72-75`, matching the doc's step 2bis). | `camap-ts/packages/api-core/docs/dataloader.md:12-35` |
| D-6 | [CONFIRMED] | `camap-common/src/email.ts` (`CONTAINS_EMAIL_REGEX`, `isEmail`, `containsEmail`) and `header.ts` (`URL_CUSTOM_HEADER = 'X-CAVEA-URL'`) were unmentioned. Findings: `isEmail` (yup `string().email().required()`) is used only by front `MessageRecipientsSelect.tsx:527,547`; `containsEmail` / the regex have no caller in `api-core/src` or `front-core/src` (grep); the header is added by the Apollo client with `window.location.pathname` (`front-core/src/lib/initApollo.tsx:33-40`) and allowed in CORS `allowedHeaders` (`api-core/src/main.ts:37-45`) but no server code reads it (the only api-core hit is the CORS list; the name still carries the old "CAVEA" product name). | `camap-ts/packages/camap-common/src/email.ts:1-13`, `header.ts:1` |
| D-7 | [CONFIRMED] | `camap-ts/packages/api-core/docs/utils.md` documents only `checkDeleted` (`common/utils.ts:7`); `common/` also contains `dataloader.ts`, `haxeCompat.ts`, `image.ts`, `constants.ts`, decorators (`current-user`, `maybe-current-user`, `is-admin`, `user-ip`, `mutation-fail`, `transactional-mutation`, `dataloder.decorator`) and guards that the doc does not cover (`ls camap-ts/packages/api-core/src/common`). | listed |
| D-8 | [CONFIRMED] | Typo in source file name `common/decorators/dataloder.decorator.ts` (missing "a"), harmless but searchable. | `camap-ts/packages/api-core/src/common/decorators/` |

Files written: this document only (`task/refacto-hx-ts/docs/_drafts/11-gaps.md`). Other drafts untouched.
