# 99 - Coverage critic report

Method: mechanical grep of basenames / action names / handler names against the concatenation of drafts 01-10 (draft 99 excluded). Heuristics are loose (a match anywhere counts as "covered"), so real coverage is at most what is shown here. Handler counts for api-core only include decorators whose next line is the method signature (87 of ~169 decorator occurrences; the rest use multi-line decorator options or @ResolveField).

## Summary (counts)

| Source set | Total | Not mentioned at all | Notes |
|---|---|---|---|
| hx `.hx` (src, js, common) | 134 | 17 | 6 more are mentioned by basename only, never as `X.hx` |
| hx `.mtt` templates | ~150 in 17+ dirs | 10 | dir `block/`, `mail/notifications/`, `contractadmin/subscriptionadmin/` have 0-1 mentions |
| hx `function do*` actions | 242 | 17 by strict match (7 truly absent) | many `Main.do*` are dispatchers |
| api-core top-level dirs | 14 | 0 | all mentioned |
| api-core @Query/@Mutation/@Get/@Post handlers | 87 detected | 10 (name not found) | 4 of those are actually covered under other names (see below) |
| front-core modules | 17 | 0 | `haxe-date-picker`, `groupMap`, `groupDisabled`, `imageUploader`, `vatBox`, `csaAttendanceSheet` only 3-6 mentions |
| camap-common src files | 10 | 2 (`email.ts`, `header.ts`) | |
| camap-ts docs (*.md) | ~36 | 2 (`api-core/docs/dataloader.md`, `utils.md` mentioned once, listed only) | `docs/archives/*` mentioned 9x |

## Missing units table

| Unit | Type | Suggested draft area |
|---|---|---|
| camap-hx/common/GitMacros.hx | hx build macro | 01-infra (build) |
| camap-hx/src/form/CamapForm.hx, CamapTimePicker.hx, CamapDateTimePicker.hx, RawHtml.hx, ColorRadioGroup.hx, ProductTypeRadioGroup.hx, UnitQuantity.hx | hx form widgets | 09-frontend-templates-i18n (server-side form widgets, replaced by React forms) |
| camap-hx/src/tools/StringTool.hx, ObjectListTool.hx | hx util | 09 or 02 (helper list) |
| camap-hx/src/payment/PaymentType.hx | hx payment type interface | 07-payments-reports |
| camap-hx/src/service/PlaceService.hx | hx service | 05-distributions-volunteers (places) |
| camap-hx/js/react/order/redux/components/CatalogsBox.hx, CatalogSelector.hx | hx react | 06-orders-subscriptions / 09 |
| camap-hx/js/react/order/redux/actions/OrderBoxAction.hx, reducers/OrderBoxReducer.hx | hx redux | 06 / 09 |
| camap-hx/js/react/product/redux/components/ProductSelect.hx | hx react | 04 / 09 |
| tpl/cssDemo.mtt | template (dev CSS demo, `Main.doCssdemo` Main.hx:210) | 09 (drop or keep decision) |
| tpl/admin/basedesign.mtt | template | 09 |
| tpl/distribution/listByDateOnePageContract.mtt, listByDateShort.mtt | templates (print/list views) | 05 |
| tpl/contractadmin/adddocument.mtt, addmedia.mtt | templates (Documents/Media) | 04 |
| tpl/contractadmin/subscriptionbalancetransfer.mtt, subscriptionpayments.mtt, tpl/history/subscriptionpayments.mtt | templates | 06 / 07 |
| tpl/contractadmin/subscriptionadmin/editsubscription.mtt | template | 06 |
| camap-common/src/email.ts, header.ts | shared TS | 03 / 09 |
| camap-ts/packages/api-core/docs/dataloader.md, transactions.md, utils.md | docs | 01 / 02 (mention-only: dataloader, utils) |
| camap-hx/src/import.hx, tools/ArrayTool.hx, controller/Controller.hx, js/react/order/OrdersDialog.hx, OrderBox.hx, InsertOrder.hx | mentioned-only (by class name, never `X.hx`) | various |

## Uncovered hx routes per controller

Strict match (controller name and action on one draft line, or `doX`/`/ctrl/x` text) - none of the following appear:

- Distribution: `doEditMd` (Distribution.hx:615), `doChangePrice` (Distribution.hx:1107; non-public)
- Install: `doDiagnostics` (Install.hx:106) - creates `file/` and `tmp/` dirs, checks `.htaccess`
- Main: `doCssdemo` (Main.hx:210). Dispatchers `doTransaction/doHistory/doShop/doProduct/doContract/doContractAdmin/doDocuments/doSubscriptions/doMessages/doAmapadmin/doPing/doCgu` not matched by the strict regexp, but `/ping`, `/cgu`, `/transaction` appear in drafts under path form (verify they are tabulated).
- Admin (admin/Admin.hx): `doTheme` (Admin.hx:42, edits theme JSON), `doAttentionAdmins` (Admin.hx:185, writes `Variable` keys `attMessageAdmins`, `attMessageAdminsAlert`)
- ContractAdmin: `doVendorsByTimeFrame` (1 loose mention only)
- Scripts: `doRecomputeBasketTotal` (1 loose mention only)
- SubscriptionAdmin: `doBalanceTransfer` (1 loose mention only)

## Uncovered TS handlers

Name not found in any draft:
- `messages/messages.resolver.ts` getMessage
- `mails/controllers/mails.controller.ts` getMail (dev mail preview; only `FRONT_URL`/`THEME_ID` env use mentioned)
- `groups/resolvers/group-previews.resolver.ts` getAll, getAll2 (covered under GraphQL names `groupPreviews`, `groupPreviews2` in 03:623 - OK, just not by method name)
- `users/users.resolver.ts` getMe (verify the `me` query is tabulated)
- `files/file.controller.ts` getFile, compressFile, compressFiles (draft 01/04 only mention `file.service.ts` and `/file/` signing; the controller routes are not tabulated - check)
- `auth/controllers/auth-bridge.controller.ts` getTokenforUser, deleteUser: covered at 03:635-637 as routes (OK).

Real gaps: file controller routes, mail preview controller, getMessage.

## Cross-cutting gaps

Evidence column cites source; "0 hits" means no occurrence in drafts 01-10.

| Gap | Evidence | Status |
|---|---|---|
| Admin super-user pages (`/admin/theme`, `/admin/attentionAdmins`, global alert banner via `Variable`) | camap-hx/src/controller/admin/Admin.hx:42,185-191; "attMessageAdmins" 0 hits | missing |
| `Variable` table keys inventory | Admin.hx:186; draft mentions of `db.Variable` = 1 | thin; list all keys used by hx and `variable.service.ts` |
| Install diagnostics / `file/` dir bootstrap and `.htaccess` | Install.hx:106-118; "Diagnostics" 0 hits | missing (01-infra) |
| Distribution `doEditMd` and `doChangePrice` | Distribution.hx:615,1107 | missing (05) |
| Logging / error reporting (Nest `Logger`, hx error log, Sentry) | messages.service.ts:12 uses `Logger`; "logger" 0 hits in drafts | missing (01) |
| Rate limiting / throttling / captcha | no source occurrence either (grep over api-core, hx, front) | not present today; flag as new requirement, not a gap in docs |
| PDF handling | Documents.hx:148 (PDF-only upload), entity-file.resolver.ts:65; drafts: 7 pdf hits | partially covered; verify upload validation rules documented |
| RGPD text / data export | Contract.hx:90-94 embeds a GDPR notice; drafts 2 hits for "rgpd/gdpr/data export"; no export-user-data feature exists | verify the Contract.hx GDPR block is documented (04) |
| Payments providers (Stripe/MangoPay/wallet) | 0 hits in hx src and 0 in drafts | consistent (none exist) |
| QR codes, html-to-text | 0 hits in source | none |
| Dev-only pages (`/cssdemo`, `/mail` preview, `/install`) | Main.hx:210, mails.controller.ts | decide keep/drop in 09/01 |
| Print/short distribution list templates | tpl/distribution/listByDateShort.mtt, listByDateOnePageContract.mtt | missing (05) |
| i18n pipeline files (`i18n.js`, `potGeneration.hxml`, `temploc2.n`) | camap-hx/backend/; 8 hits | covered |
| Timezone in crons | 17 hits for timezone/Europe/Paris | covered |
| Map/geo | 15 hits | covered |
| Sessions, cookies, CSRF | 61 / 37 / many hits | covered |
| Uploads / file serving | 16 hits for upload; file.service.ts:57,77 | covered at service level, controller routes missing |
| `camap-ts/docs/archives/*` (legacy docs) | 9 mentions | mention-only |
| CODEOWNERS | 1 mention | mention-only |
