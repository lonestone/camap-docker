# 04 - Catalogs, products, vendors, places, stock, files (as implemented today)

NOTE: this is the content intended for `task/refacto-hx-ts/docs/_drafts/04-catalogs-products-vendors.md`. It was written here because the session was in plan mode (writes to any other file were not allowed). Copy it to the target path.

All paths relative to camap-docker root. Prefix H = camap-hx/src, T = camap-ts/packages. "unverified" = not confirmed in code read.

## 1. Overview

- A **catalog** (UI label "contrat") belongs to one group and one vendor, has a date window and a type (constant or variable orders) (H/db/Catalog.hx:18-54). Products belong to exactly one catalog (H/db/Product.hx:18).
- A **vendor** (producteur) is a shared record across groups (H/controller/Vendor.hx:68 message: "fiches producteurs partagées entre les AMAP"). Catalogs link a group to a vendor. A vendor can be "claimed" by a user (Vendor.user) (H/db/Vendor.hx:21-22, :214).
- A **place** is a per-group delivery location with optional lat/lng (H/db/Place.hx:8-30).
- **Stock** is per product, with 3 tracking modes (Disabled/Global/PerDistribution) and 3 per-distribution sub-modes, only active when the catalog flag `StockManagement` is set (H/db/Product.hx:28-30, H/db/Catalog.hx:133, common H/../common/Common.hx:90-138).
- **Files**: binary blobs in table File, linked to entities through EntityFile (entityType, entityId, documentType, data=visibility) (H/controller/Documents.hx:155-159, H/controller/Media.hx:119-125).
- Ownership: the whole back-office CRUD (catalog, product, vendor create, place, documents, media, CSV import/export, stock config) is **Haxe only**. TS owns: read-only GraphQL for catalog/product/vendor/place, vendor self-service dashboard + public profile, image upload (product/vendor/vendor gallery), generic PDF document create/delete, and a few React widgets embedded in Haxe pages.

## 2. Routes / endpoints

### 2.1 Haxe MVC (dispatch = /controller/action/args)

| Route | Handler | Purpose / guard |
|---|---|---|
| /contractAdmin | H/controller/ContractAdmin.hx:47 | list catalogs (active + ended <1 month; `?old=1` = ended). Whole controller gated by `isContractManager()` (:29-34); non-AMAP-managers see only catalogs they can manage (:63-68) |
| /contractAdmin/view/:id | :1014 | catalog dashboard; calls `catalog.check()` (UTF-8 sanity) (:1019); requires canManageContract (:1021) |
| /contractAdmin/edit/:id | :97 | edit catalog form; guard `isContractManager(catalog)` (:99); updates future distributions order dates (:121-126); moves ContractAdmin right to new contact (:128-144) |
| /contractAdmin/absences/:id | :1121 | absence period form (var: only when distribMinOrdersTotal>0, see rule 14) |
| /contractAdmin/products/:id | :259 | product list, batch enable/disable via `?enable=1|2&disable=` (:275-285) |
| /contractAdmin/stocks/:id | :295 | stock view; errors if stock management off (:300-301) |
| /contractAdmin/copyProducts/:id | :314 | hidden page, `@admin` only; copies only name+price of source products (:331-336); option "delete" removes all products first (:322-327) |
| /contractAdmin/duplicate/:id | :782 | duplicate catalog (rule 11) |
| /contractAdmin/updatePrices/:id | :753 | refreshes `UserOrder.productPrice` of existing orders from current product price (:767-774) |
| /contractAdmin/delete/:id | :1170 | delete; guard `canManageAllContracts` (:1171); refused if any order qty>0 (:1177-1184) |
| /contractAdmin/documents/... | :1027 | delegates to controller.Documents |
| /contractAdmin/subscriptions/... | :1031 | delegates to SubscriptionAdmin (other agent) |
| Distribution/order parts of ContractAdmin (not deep-dived): roles :164-256, ordersByTimeFrame :349, exportSubscriptions :431, ordersByDate :457, vendorsByTimeFrame :549, orders :668, ordersByProduct :917, ordersByProductList :940, distributions :957, participate :1001, stats :1036, selectDistrib :1090, batchOrder :1103, tmpBaskets :1112 |
| /contract/defineVendor | H/controller/Contract.hx:41 | step 1 of catalog creation: search vendors; needs `canManageAllContracts` (:42) |
| /contract/insertVendor | :87 | step 2: create vendor (GDPR checkbox) (:90-99) |
| /contract/insertChoose/:vendorId | :122 | step 3: pick type; refused if vendor disabled (:125-127) |
| /contract/insert/:vendorId?type= | :137 | step 4: create catalog (type default 1 = variable) (:137) |
| /contract/editVarOrders/:multiDistribId | :189 | member order edit (orders agent) |
| /product/insert/:catalogId | H/controller/Product.hx:103 | guard `isContractManager(contract)` |
| /product/edit/:id | :34 | guard canManageContract; price/qt/unit frozen if orders exist (rule 6) |
| /product/delete/:id | :149 | token + refused if any UserOrder references it (:156-159) |
| /product/copyAndDiscard/:id | :169 | clone product, deactivate original (:175-179) |
| /product/import/:catalogId | :187 | CSV import 3 steps, 4 MB multipart limit (:193) |
| /product/export/:catalogId | :286 | CSV export; **no permission check** (:286-290) |
| /vendor/view/:id | H/controller/Vendor.hx:22 | React `vendorProfile` module; error if vendor.disabled (:23-24) |
| /vendor/dashboard | :42 | React `vendorDashboard`; @logged, requires `isVendor()` (:43) |
| /vendor/edit/:id | :64 | legacy form; guard `canManageVendor` (:65) |
| /vendor/addImage/:id | :55 | image page |
| /place (list), /place/view/:id, /place/edit/:id, /place/insert, /place/delete/:id | H/controller/Place.hx:18,25,39,67,89 | group places. `doDelete` needs isAmapManager (:90) and no linked Distribution (:93-94). Edit/insert/list have no explicit rights check in the controller (unverified whether a parent guard exists) |
| /media, /media/edit, /media/insert, /media/delete | H/controller/Media.hx:16,29,83,61 | group images; isAmapManager; max 5 (:86-88), jpg/jpeg/png/bmp/gif (:108-114), multipart cap 4 MB (:97, comment says 3 Mo) |
| /documents (+ /contractAdmin/documents) | H/controller/Documents.hx:16,40,82,113 | PDF only (:148), 10 MB (:137), visibility subscribers/members/public (:60-62); catalog docs need canManageContract, group docs isAmapManager |

### 2.2 Haxe REST (/api/...)

| Route | Handler | Notes |
|---|---|---|
| GET /api/catalog/:id | H/controller/api/Catalog.hx:14 | catalog+products(active)+distribs+vendor+docs+constraints+absences. **No auth check in handler** (documents filtered by user, :29) |
| GET /api/catalog/catalogAbsences/:id | :48 | absence period + possible distribs |
| GET /api/catalog/stocksPerProductDistribution/:id | :57 | available stock per product per distribution; null when no stock management (:59,71) |
| GET/POST /api/catalog/subscriptionAbsences/:subId | :77 | owner or contract manager (:78); other agent |
| GET /api/product/:id ; /api/product/get?catalogId= | H/controller/api/Product.hx:13,22 | product infos; no auth |
| GET /api/places/:id | H/controller/api/Places.hx:13 | name/address/lat/lng; GET only (:14) |
(dispatch: H/controller/Api.hx:35,39,77)

### 2.3 TS GraphQL (api-core, no REST except /files)

| Operation | Ref | Guard / notes |
|---|---|---|
| Query catalog(id) | T/api-core/src/vendors/resolvers/catalogs.resolver.ts:53 | GqlAuthGuard (class :38) + canManageCatalog (:58-64) |
| Query getOrderableCatalogsFromMultiDistrib | :72 | only filters out disabled vendors (:84-88); name suggests more |
| Query getActiveCatalogs(groupId) | :91 | active window + vendor.disabled IS NULL (T/.../catalogs.service.ts:79-93) |
| Catalog fields: vendor,user,products,group,subscriptions,subscriptionsCount,documents | :98-196 | documents visibility see flaw C2 |
| Query vendor(id) | vendors.resolver.ts:54 | auth only, no ownership check |
| getVendorWithEmailCheck, getActiveVendorsFromGroup, getClaimableVendors, getVendorsByUserId, getDefaultVendorByUserId, hasVendorsByUserId | :68,85,95,106,119,132 | self-only checks on userId (:111,124,137) |
| getVendorsFromCompanyNumber, getVendorProfessions | :144,151 | **no guard** |
| Mutation claimVendor | :162 -> vendor.service.ts:210 | email must equal user.email/email2 (:221); adds user to groups of vendor's active catalogs (:225-234); merges into existing vendor of user (:237-241) |
| Mutation consolidateVendors | :172 -> vendor.service.ts:253 | merges all other vendors of the user into target |
| Mutation updateVendor | :182 | owner or catalog manager (:233); email regex (:238), desc <=1000 (:244), linkUrl http prefix (:249-252). **No server-side geocoding** (lat/lng passed by client) |
| Mutation setVendorImage / createVendorImage | :283,330 | permission via `userIsAllowedToManageCatalogOfVendor` (:548-566); compressImage; createVendorImage = gallery entity `vendor/media/public` (:364-370) |
| Vendor fields phone/email | :451-468 | see flaw C1 |
| Vendor.nextDistributions (4 per group) / allDistributions | :470-543 | |
| Mutation setProductImage | T/api-core/src/vendors/resolvers/products.resolver.ts:39 | canManageCatalog; deletes old image (:74-76) |
| Product fields price (adds fees), stockTracking (forced Disabled if catalog has no stock mgmt), qt default 1, unitType default 0 | :100-177 | |
| Query vendorProductsSample(vendorId) | :179 | dedupe by name similarity >0.75 (:196-198); no guard |
| Query place(id) | T/api-core/src/places/resolvers/places.resolver.ts:10 | no guard, read only |
| Mutations createDocument / deleteDocument | T/api-core/src/tools/resolvers/entity-file.resolver.ts:56,185 | entity group/catalog/vendor; PDF only (:66), 10 MB (:84-89) |
| REST GET /files/get/:id, /files/compress/:id, /files/compressAll/:page | T/api-core/src/files/file.controller.ts:33,51,90 | super-admin maintenance only (:39,58,96) |
Not present in TS: any mutation to create/update/delete catalog, product, place; stock configuration; CSV import/export; geocoding; vendor creation (vendor.service.ts `create` exists :183 but no resolver calls it - verified by reading resolver list only).

## 3. Business rules

### Catalogs
1. Types: 0 = constant orders (classic AMAP contract), 1 = variable orders (H/db/Catalog.hx:53-54; T/api-core/src/vendors/catalog.interface.ts:1-4).
2. Flags (bit enum): UsersCanOrder, StockManagement, PercentageOnOrders, DisplayPricesOnGroupPage, NotifyVendorOnOrderEnd, NotifyContactOnOrderEnd (H/db/Catalog.hx:8-15). New catalog starts with UsersCanOrder set (:63). TS knows only the first three (T/api-core/src/vendors/entities/catalog.entity.ts:20-24).
3. Dates are normalised on insert/update: start 00:00:00, end 23:59:59 (H/db/Catalog.hx:341-351). Start must be <= end (H/service/CatalogService.hx:118-120). All existing distributions must lie inside [start, end of day 23:59] (:123-135).
4. "Active" = start < now < end (H/db/Catalog.hx:108-111). Visible in shop = active && UsersCanOrder (:101-106). Open to orders: constant = visible; variable = visible and at least one Distribution of the catalog with orderStartDate <= now < orderEndDate (:116-126).
5. Default creation values: name "Contrat AMAP classique|variable - <vendor>", start now, end now+365.25 d (H/service/CatalogService.hx:89-91). Contact (userId) is required in form (:103). Percentage fields are removed from the form (:36-37) and `hasPercentageOnOrders()` is hard-coded false (H/db/Catalog.hx:128-131, "removal 1 Feb 2023" banner at H/controller/ContractAdmin.hx:83-88).
6. Product price/qt/unit frozen once the product has any UserOrder (any status): price field replaced by read-only text, server re-checks (H/controller/Product.hx:40-83). Workaround: "copyAndDiscard" (clone + deactivate) (:169-184).
7. Order window settings: constant catalog form hides orderStartDaysBeforeDistrib and the min-order fields; orderEndHoursBeforeDistrib becomes "min delay to enter a subscription" and is forced to 72 if empty/0 (H/service/CatalogService.hx:49-60, 169-177). Variable catalog: orderStartDaysBeforeDistrib cannot be 0 (empty = use distribution-cycle default) (:141-145).
8. Changing orderStartDays/orderEndHours on edit rewrites orderStartDate/orderEndDate of ALL future distributions of the catalog, overwriting customisations (H/service/CatalogService.hx:238-269; H/controller/ContractAdmin.hx:122-126).
9. Variable catalogs: minimums distribMinOrdersTotal / catalogMinOrdersTotal (EUR); `hasConstraints` = variable and either >0 (H/db/Catalog.hx:141-143). Setting distribMinOrdersTotal==0 wipes absence data (H/service/CatalogService.hx:152-156). Warning shown if catalogMinOrdersTotal>0 (:158-160).
10. Notifications: variable catalogs always notify the vendor at order end; flag hidden for them (H/db/Catalog.hx:162-164; H/service/CatalogService.hx:66-69).
11. Duplicate: copies name/dates/contact/description/flags/vendor/percentages/orderEndHours/absentDistribsMaxNb; absence dates NOT copied (commented, :823-824); type selectable; variable target gets orderStartDays = source's or 365 (H/controller/ContractAdmin.hx:810-834). Products: none/all/active only via `ProductService.duplicate` (stock tracking reset to Disabled) (:860-876; H/service/ProductService.hx:73-75). Distributions copied only for super-admin/group manager (:878-891). Volunteer roles copied (:894-903). Rights: contact (or current user) gets ContractAdmin(newId) (:842-858).
12. Create (Contract.doInsert): volunteer roles created for `distributorNum` (H/controller/Contract.hx:162); vendor's user auto-joined to group (:165-167); contact receives ContractAdmin(id)+Messages+Membership rights (:168-174).
13. Delete: only `canManageAllContracts`; blocked if sum(order qty)>0; removes contact's right and volunteer roles; Haxe comment claims products/orders/distributions are deleted too but code only deletes roles then the catalog (H/controller/ContractAdmin.hx:1166-1204) (cascade presumably DB-side, unverified).
14. Absences: available when constant, or variable with distribMinOrdersTotal>0, and maxNb>0 with both dates (H/db/Catalog.hx:145-152). Validation: if maxNb>0 dates required; start<end; maxNb <= number of distributions in the window; if window == catalog period, maxNb < total; window inside catalog dates (H/service/CatalogService.hx:197-233).
15. Document visibility for catalog docs: subscriber sees all; group member sees all except 'subscribers'; others only 'public' (H/db/Catalog.hx:310-331).
16. Catalog.check(): warns on invalid UTF-8 in description and product ref/name/desc (H/db/Catalog.hx:185-203).

### Products
17. Fields: name(128), ref(32), price (TTC, rounded to 2 decimals), vat(%), desc, qt, unitType (Piece, Kilogram, Gram, Litre, Centilitre, Millilitre), stockTracking, stockTrackingPerDistrib, stock, organic, variablePrice, multiWeight, bulk, image, active (H/db/Product.hx:14-40; H/../common/Common.hx:90-97). Defaults: vat 5.5, unit Piece, qt 1, active true (H/db/Product.hx:42-54). qt==0 is stored as null; vat null -> 0 (:269-273,282).
18. Price is TTC (H/db/Product.hx:20). HT = TTC/(1+vat/100) (H/service/ProductService.hx:51-53). vatValue = price - price/(1+vat/100) (H/db/Product.hx:232).
19. VAT choices come from the group's `vatRates` JSON (default: "TVA alimentaire" 5.5, "TVA standard" 20, auto-created on parse failure) (H/db/Group.hx:425-435; H/service/ProductService.hx:131-139). Price field is replaced client-side by the `vatBox` React widget that keeps HT/TTC/VAT in sync (H/js/App.hx:75-91; T/front-core/src/modules/vatBox/VatBox.module.tsx).
20. Constant catalogs: `bulk` and `variablePrice` removed from the form (H/service/ProductService.hx:105-108). Bulk requires unit and qt and is incompatible with multiWeight (:197-205). The code commenting out "multiWeight implies variablePrice" allows multiWeight alone (H/db/Product.hx:285-289).
21. Product delete refused if any order references it (H/controller/Product.hx:156-159). Batch enable/disable validates products belong to the first product's catalog (H/service/ProductService.hx:14-27,35-48).
22. Image: `/img/taxo/grey/legumes.png` fallback (H/db/Product.hx:191-197; T/api-core/src/vendors/services/products.service.ts:72-77). Upload through React ImageUploader module (`openImageUploader('product', id, 300, 300)`, H/lang/fr/tpl/contractadmin/products.mtt:167; H/js/App.hx:94-106), saved via GraphQL setProductImage.
23. CSV import columns: productName, price, ref, desc, vat, qt, unit, organic, bulk, variablePrice; unit parsing kg/g/l/cl/ml (+long names), default Piece; imported products have stock tracking Disabled, active default true (H/controller/Product.hx:194-269). Export columns: name, price, ref, desc, vat, quantity, unit (enum index), organic, bulk, variablePrice (:311-322). No active/image in export CSV even though `active` is in the data (:303).
24. Product `infos()` is the shape served to front-ends: includes catalogTax, orderable, stockTracking (H/db/Product.hx:224-248).

### Stock
25. Stock is only editable/visible when catalog flag StockManagement is on, else stock fields removed from the form (H/service/ProductService.hx:111-127). TS forces stockTracking=Disabled in GraphQL when the flag is off (T/api-core/src/vendors/resolvers/products.resolver.ts:142-151).
26. Modes: Disabled (always available); Global (one stock for the whole catalog, all orders with qty>0 decrement); PerDistribution with AlwaysTheSame (product.stock per distribution), FrequencyBased (stock only every Nth distribution from a start distribution: index % frequencyRatio == 0), PerPeriod (rows ProductDistributionStock with start/end distribution; first period containing the distribution's date, else 0) (H/db/Product.hx:64-125; H/../common/Common.hx:103-140).
27. Available stock = distribStock - sum(orders qty>0); multiWeight counts 1 per order line; clamped to 0 unless alwaysPositive=false; null when no tracking or stock==null (H/db/Product.hx:147-181).
28. Saving a product: all ProductDistributionStock rows of the product are deleted and rewritten (H/service/ProductService.hx:150). FrequencyBased writes one row with startDistribution=endDistribution (:159-169); PerPeriod writes one row per submitted period (:171-185). Row consistency: both distributions must belong to the product's catalog (H/db/ProductDistributionStock.hx:26-33).
29. Validation on save: stock required when tracking on; for every future distribution of the catalog the available stock must not be negative, else error with the minimum stock (H/service/ProductService.hx:207-222). Catalog save only warns when a tracked product has no stock (H/service/CatalogService.hx:185-193).
30. StockTool.dispatch / dispatchOffers split integer stock across groups/offers (H/tools/StockTool.hx:16-80); usages not traced here (unverified).
31. Duplicating a product resets stock tracking to Disabled and sets perDistrib null (H/service/ProductService.hx:73-75), while `Product.clone` (copyAndDiscard) keeps stock config (H/db/Product.hx:312-314) - note ProductDistributionStock rows are not copied by either.

### Vendors
32. Fields: name, peopleName, email (required, valid), phone, showEmail/showPhone, address, zipCode, city, country, companyNumber (SIRET, required in form), desc (<=1000 via service), longDesc, linkText/linkUrl, profession/production2/production3, image, lat/lng, disabled (IncompleteLegalInfos/NotCompliantWithPolicy/Banned), user (claim) (H/db/Vendor.hx:17-56, :190-198; H/service/VendorService.hx:92-113,131-135).
33. Creation requires a unique email across all vendors (H/service/VendorService.hx:82-84). Geocoding (Mapbox) happens on every create/update; failure blocks save ("unable to locate this address") (:137-142; H/service/Mapbox.hx:15-21; token `mapbox_server_token` :26).
34. Disabled vendor: public page errors (H/controller/Vendor.hx:23-24), cannot be chosen for a new catalog (H/controller/Contract.hx:125-127), excluded from TS active catalogs (T/.../catalogs.service.ts:89). Disabled only set by admins (`VendorService.ban/unban`, T/.../vendor.service.ts:196-207); Haxe code only reads it.
35. Rights: if the vendor is claimed only its owner may edit; else super-admin or anyone who can manage one of its catalogs (H/db/User.hx:176-189). TS: same idea but order of checks differs (see C4) (T/.../vendors.resolver.ts:548-566; T/.../user-groups.service.ts:128-150).
36. Claim: user email/email2 must equal vendor email and vendor unclaimed; claiming merges the vendor into an existing user vendor (T/.../vendor.service.ts:218-249). Haxe side exposes `claimableVendors` (H/db/User.hx:628-630) and shows the UI note (H/controller/Vendor.hx:70).
37. Search (catalog creation): name tokens (stopwords and sql keywords dropped), profession, proximity to group's main place; LIMIT 30; raw SQL with string interpolation (H/service/VendorService.hx:26-73).
38. Contact info exposure: email/phone hidden unless showEmail/showPhone (H/db/Vendor.hx:97-100).

### Places and geocoding
39. Place: name(64), address1/2, zip, city, country default FR, lat/lng (clamped to +-90/+-180, both null if one null) (H/db/Place.hx:8-30, :92-108). Insert allowed only for FR and BE (H/controller/Place.hx:75-77) but form offers 8 countries (H/db/Place.hx:113-125). Insert does NOT geocode (:79-82); edit geocodes when address changed or lat null; failure = warning only (:50-56).
40. Place cannot be deleted if a Distribution uses it (H/controller/Place.hx:93-94).
41. Front geocoding: TS GeoAutocomplete uses client-side Mapbox with countries fr,be,re,nc,gp,gy,mq,yt,bl,mf,pf,pm,wf (T/front-core/src/utils/mapbox-geocoding.ts:15-16; T/front-core/src/containers/geo/GeoAutocomplete.tsx:11). Group map uses `getGroupsOnMap` and `findInZone` (limit 200) / `find10ClosestPlacesfromCoordinates` (dist<2 degrees) (T/api-core/src/places/services/places.service.ts:21-56; T/front-core/src/modules/groupMap/groupMap.gql).

### Files
42. File bytes live in DB (mediumblob per docs; entity at T/api-core/src/tools/models/file.entity.ts - unverified column type). URL = `/file/<id>_<md5(id+CAMAP_KEY)>` (T/api-core/src/files/file.service.ts:59-78); Haxe equivalent sugoi.db.File.makeSign (H/controller/api/Catalog.hx:31; implementation not in repo, unverified).
43. TS image pipeline: client crop + compression (max 3 MB) in ImageUploader (T/front-core/src/modules/imageUploader/ImageUploader.tsx:189-190), server `compressImage(maxWidth)` then replaces previous file (T/.../products.resolver.ts:62-80, vendors.resolver.ts:303-319).
44. Cleanup: Haxe cron "Clean unused db.File entities" samples a 1000-id slice per run and deletes files not referenced by product, EntityFile, group or vendor (comments inverted) (H/controller/Cron.hx:289-316). No TS equivalent found.
45. Group media (images, max 5) are Haxe-only; group/catalog/vendor PDF docs can be managed in either (see 2.3).

## 4. Flows

- **Create catalog (Haxe)**: /contract/defineVendor -> (found) /contract/insertChoose/:v or (not found) /contract/insertVendor (create + geocode) -> insertChoose -> /contract/insert/:v?type= -> checkFormData -> insert -> roles/rights -> /contractAdmin/view/:id (H/controller/Contract.hx:41-183).
- **Edit product**: /product/edit/:id -> form (ProductService.getForm) -> toSpod -> updateProductStocksConfiguration (rewrites PDS rows BEFORE validation) -> price/qt/unit freeze check -> ProductService.check -> update (H/controller/Product.hx:71-91).
- **Vendor self-service (TS)**: Haxe page /vendor/dashboard mounts React `vendorDashboard`, tabs edit/contracts/distributions/documents/images (T/front-core/src/modules/vendorDashboard/VendorDashboard.module.tsx:202-228) -> GraphQL updateVendor/claim/consolidate/createDocument/setVendorImage.
- **Public vendor page**: /vendor/view/:id -> React vendorProfile (H/controller/Vendor.hx:22-38; T/front-core/.../VendorProfile.module.tsx:115-127).
- **CSA catalog subscription page (TS front on Haxe REST)**: csaCatalog module calls /catalog/:id, /catalog/stocksPerProductDistribution/:id, /catalog/catalogAbsences/:id and /subscription (T/front-core/src/modules/csaCatalog/requests.tsx:17-105).
- **Stock availability**: UI -> GET /api/catalog/stocksPerProductDistribution -> `Product.getAvailableStock` per future distribution (H/controller/api/Catalog.hx:57-72).

## 5. HX <-> TS ownership

| Area | Haxe | TS |
|---|---|---|
| Catalog CRUD, duplicate, delete, absences | full | read only (`catalog`, `getActiveCatalogs`); `CatalogsService.create/update/enableStockManagement` exist, create unused (T/.../catalogs.service.ts:159-226) |
| Catalog REST for CSA UI | /api/catalog | consumed by csaCatalog module |
| Product CRUD, CSV, stock config | full | image upload only + read fields |
| Vendor create/search/legacy edit | full | edit, claim, consolidate, images, docs, profile pages |
| Places CRUD + geocode | full | read-only place query, map, dialog (`place`, `place-dialog` modules, T/front-core/src/neo.tsx:108-113) |
| Files serve (/file/...) + cron | Haxe | create/delete, no serving route, maintenance REST |
| Media (group gallery) | Haxe | none |
| Docs (PDF) | Haxe forms | createDocument/deleteDocument (+vendor docs, TS-only) |
Both stacks write the same MySQL tables (Haxe SPOD vs TypeORM entities).

## 6. Documentation inconsistencies

D1. [CONFIRMED] T/docs/contracts.md:45 says absences range is `absencesStartDate` and `absencesStartDate` (second should be absencesEndDate).
D2. [CONFIRMED] T/docs/contracts.md:27 says percentageValue/percentageName "ne servent plus", but TS still applies them to product price (T/.../products.resolver.ts:100-112, catalogs.service.ts:146-153) whereas Haxe disables them (H/db/Catalog.hx:128-131).
D3. [CONFIRMED] T/docs/contracts.md:15 mentions only two types, omits flags/stock/min-orders/absences/notifications/documents; `orderStartDaysBeforeDistrib/EndHours` described as entered "à la création" without noting constant catalogs hide start days (H/service/CatalogService.hx:51). (verifier-corrected: the two-types sentence is at contracts.md:12, not :15; contracts.md:15 is a different paragraph.)
D4. [CONFIRMED] T/docs/products.md:38 lists only Litres/unités/Kg; code has 6 units (H/../common/Common.hx:90-97).
D5. [CONFIRMED] T/docs/products.md omits stockTracking/stockTrackingPerDistrib/stock/active/image/desc and ProductDistributionStock entirely. (grep of products.md: no occurrence of stock/active/image/desc.)
D6. [CONFIRMED] T/docs/products.md:46 says multiWeight only "in combination with variablePrice"; Haxe allows it alone (H/db/Product.hx:285-289) and forbids bulk+multiWeight (H/service/ProductService.hx:202-203).
D7. [CONFIRMED] T/docs/products.md:44 / :50 imply bulk/variablePrice apply to all catalogs; they are hidden for constant catalogs (H/service/ProductService.hx:105-108). (bulk is at products.md:48, variablePrice at :44.)
D8. [CONFIRMED] T/docs/files.md:19 "most mechanisms ported to TS module files": TS has create/delete/getUrl only; no `/file/<hash>` serving, no unused-file cron (T/api-core/src/files/file.service.ts; file.controller.ts exposes only super-admin utilities). (claim text is files.md:19; the Sugoi serving mechanism is :9 and the cron :17. TS FilesService also has findOne/findByIds/findOneAndConvertToFile/findImagesName/getExtension/makeSign, file.service.ts:26-60, so 'create/delete/getUrl only' is slightly understated; no `/file/<hash>` route exists in TS.)
D9. [CONFIRMED] T/docs/files.md does not mention EntityFile, documents (PDF 10 MB), media (5 images), or visibility rules. (files.md is 19 lines and never mentions EntityFile.)
D10. [PLAUSIBLE: scope of 'no doc covers them' only grep-checked] T/docs/contracts.md and products.md omit vendor claiming, disabled reasons, VAT-rate group setting, places, geocoding (no doc covers them within this area). (verifier note: conf.md:37,80 mention Mapbox tokens for geocoding, so geocoding config is documented, just not behaviour.)

## 7. Code inconsistencies

C1. [CONFIRMED] T/api-core/src/vendors/resolvers/vendors.resolver.ts:456-458 and :465-467: `userIsAllowedToManageCatalogOfVendor` is async but not awaited, so `editor` is a Promise (always truthy); vendor phone and email are returned regardless of showPhone/showEmail. Also phone/email resolvers declared `String` non-null (:451,460) though they return null/''. (verifier-added: the helper is `private async` at vendors.resolver.ts:548; phone/email resolvers are not async and not guarded. For anonymous callers `currentUser` is undefined, so the un-awaited call rejects with a TypeError at `currentUser.id` (:553) as an unhandled rejection while the field still returns the data. Security-relevant: contact data leak.)
C2. [CONFIRMED] T/api-core/src/vendors/resolvers/catalogs.resolver.ts:173: `canManageCatalog(...)` not awaited (and passes `parent.id` number), so branch always true and all documents (including 'subscribers'/'members') are exposed to any caller; the intended logic (:175-193) is never reached. (verifier-added: `canManageCatalog` is `async` at user-groups.service.ts:128, so the Promise is truthy and the whole `documents` list is returned to any authenticated user (class has `@UseGuards(GqlAuthGuard)`, catalogs.resolver.ts:38). Passing a numeric id is accepted by canManageCatalog (:133), so that part is not a bug. Also dead-code bug: `findByUserIdAndCatalogId(parent.id, currentUser.id)` at :178-181 has args swapped (signature is userId, catalogId, csa-subscriptions.service.ts:31). Security-relevant.)
C3. [CONFIRMED] T/api-core/src/vendors/resolvers/catalogs.resolver.ts:58-61: `canManageCatalog = !catalog || ...` (OK) but `catalog` query is manager-only, while CsaCatalog front for members uses REST instead; the vendor `catalog.products/subscriptions` fields are also reachable via `vendor.allCatalogs` (vendors.resolver.ts:434-436) without management check (subscriptionsCount exposed in claimable vendors query, front vendorDashboard.gql). (leakage unverified at field level: `subscriptions` field has no guard, catalogs.resolver.ts:141-149.) (guard: only authentication via class-level GqlAuthGuard, catalogs.resolver.ts:38; `allCatalogs` at vendors.resolver.ts:433-436 and `subscriptions` at catalogs.resolver.ts:141-149 do no rights check. Field-level data exposure depends on which Subscription fields are exposed: unchecked.)
C4. [REFUTED: updateVendor guard is not looser, userIsAllowedToManageCatalogOfVendor returns strictly owner-only when vendor.userId!==null (vendors.resolver.ts:552-553), same as Haxe User.hx:176-179] ~~Vendor rights differ: Haxe claimed -> owner only; unclaimed -> admin or catalog managers (H/db/User.hx:176-189). TS `canManageCatalog` lets the claimed vendor owner manage ANY of its catalogs in any group (user-groups.service.ts:138-140) and the `updateVendor` guard accepts owner OR catalog manager even if vendor is claimed (vendors.resolver.ts:233), whereas `setVendorImage`/`createVendorImage` use the strict helper (:299,346). Haxe `isAdmin()` vs TS `rights === 1` (:555) equivalence unverified.~~ VERIFIED PART: `canManageCatalog` does let the claimed vendor owner manage any catalog of its vendor (user-groups.service.ts:138-140), which has no Haxe equivalent in canManageContract. `rights === 1` (:555) vs Haxe `isAdmin()` = `rights.has(Admin)` (User.hx:74-76): equivalence unverified. (The refuted sub-claim: that updateVendor (:233) accepts a catalog manager when claimed and differs from setVendorImage/createVendorImage (:299,346); all three go through the same helper.)
C5. [CONFIRMED] Geocoding: Haxe geocodes vendor server-side on every save (H/service/VendorService.hx:137-145); TS `updateVendor` trusts client lat/lng and never geocodes (vendors.resolver.ts:224-277); lat/lng are plain editable text fields in the form (T/front-core/.../VendorForm.tsx:402-436). Place insert in Haxe never geocodes (H/controller/Place.hx:79-82) unlike edit (:50-56). (lat/lng form fields at VendorForm.tsx:402-436; Haxe geocoding VendorService.hx:137-145 and Place.hx:50-56 / insert :75-82 verified.)
C6. [CONFIRMED] Place country rule: insert only FR/BE (H/controller/Place.hx:75-77) vs country list with 8 options (H/db/Place.hx:113-125) vs front geocoding country list of 13 codes (T/front-core/src/utils/mapbox-geocoding.ts:15-16). (verifier-corrected line numbers: the front country list is mapbox-geocoding.ts:24-25, GEOCODING_COUNTRIES = 13 codes, used at :33.)
C7. [CONFIRMED] TS CatalogFlags has 3 entries vs Haxe 6 (T/.../catalog.entity.ts:20-24; T/.../catalogs.service.ts:14-18 duplicates it); DisplayPricesOnGroupPage/Notify* flags are invisible to TS. (catalog.entity.ts:20-24 and catalogs.service.ts:13-17; Haxe Catalog.hx:8-15 has 6.)
C8. [CONFIRMED] TS `CatalogsService.create` (T/.../catalogs.service.ts:206-226): `setFlag(...)` result discarded (:221), so UsersCanOrder is never set; default orderEndHoursBeforeDistrib 24 vs Haxe forced 72 (H/service/CatalogService.hx:173); has TODO for rights. Unused (no caller found by grep). (setFlag in haxeCompat.ts:18-20 is pure and returns the new value; catalogs.service.ts:221 discards it. Haxe 72 is a fallback when the form value is empty/0 (CatalogService.hx:171-173), not an unconditional force. No caller: grep for `.create(` on a catalogs service across api-core/src returned nothing.)
C9. [CONFIRMED] TS `hasPercentageOnOrders` honours flag + percentageValue (catalogs.service.ts:146-153) while Haxe always false (H/db/Catalog.hx:128-131); TS GraphQL price (products.resolver.ts:100-112) and `ProductEntity.getPriceWithMargins` (product.entity.ts:108-111, no flag check) can thus differ from Haxe `getPrice`. (computeFees, catalogs.service.ts:169-178, uses hasPercentageOnOrders; product.entity.ts:105-111 getPriceWithMargins has no flag check.)
C10. [CONFIRMED] StockTracking enum shape: T/api-core/src/vendors/product.interface.ts:4-20 declares a STRING enum registered with GraphQL, while T/camap-common/src/products/interfaces.ts:13-27 and DB (Haxe enum index, tinyint, product.entity.ts:41-45) are numeric; `Product.stockTracking` resolver returns the raw DB number (products.resolver.ts:150) for a string-enum GraphQL type (runtime serialization behaviour unverified). Entity imports the numeric one (product.entity.ts:14), resolver the string one (products.resolver.ts:19). (GraphQL runtime serialization of a numeric DB value for a string enum remains unverified but would normally raise 'Enum cannot represent value'.)
C11. [CONFIRMED] GraphQL `Product.wholesale` field (T/.../product.type.ts:42-43) has no entity column or resolver; `price` is not declared in the ObjectType but resolved in the resolver (products.resolver.ts:100). `Product.stockTrackingPerDistrib` is non-null in GraphQL but nullable in entity (product.type.ts:33; product.entity.ts:45). `unitType` returns 0 when null (products.resolver.ts:173-177). (product.type.ts:43 `wholesale: boolean` non-null, no column in product.entity.ts and no resolver; `price` absent from product.type.ts.)
C12. [CONFIRMED] `getOrderableCatalogsFromMultiDistrib` (catalogs.resolver.ts:72-89): name says orderable, but only excludes disabled vendors, not date/flag; unused var `distributionsIds` (:82).
C13. [CONFIRMED] H/controller/Product.hx:286-324 `doExport` lacks the `canManageContract` check present in sibling actions; /api/catalog, /api/product are unauthenticated (H/controller/api/Catalog.hx:14, Product.hx:13,22) and `api/product/get` returns inactive products too (`getProducts(false)`, :27). (security-relevant: Product.hx:286 doExport has no canManageContract, unlike :35,:150,:170,:188. api/Catalog.hx and api/Product.hx contain no auth check; whether sugoi routing requires login globally is PLAUSIBLE/unchecked.)
C14. [CONFIRMED] H/controller/Product.hx:71-73: stock rows are rewritten (`updateProductStocksConfiguration`) before `ProductService.check` and before the `hasOrders` freeze checks, so a rejected edit still has deleted/re-created ProductDistributionStock rows (exception rolls back only if the request is transactional - unverified). (order verified at Product.hx:70-76: toSpod, updateProductStocksConfiguration, then try{hasOrders throws}. Transaction behaviour unverified.)
C15. [CONFIRMED] H/service/ProductService.hx:14,35: batch enable/disable derives the catalog from the first id only and does not check manage rights in the service; rights checked by the caller for the contract in the URL, not the products (H/controller/ContractAdmin.hx:262,275-285), so a manager of catalog A could pass product ids of catalog B? Service compares to the first product's catalog, which can belong to B (unverified exploitability). (security-relevant, exploitable by reading: the rights check applies to URL catalog (ContractAdmin.hx:258-259) while batch*Products take the catalog from productIds[0] (ProductService.hx:14,35) and only verify that all ids belong to that catalog, so a manager of catalog A can enable/disable products of catalog B by passing only B ids.)
C16. [CONFIRMED] H/controller/ContractAdmin.hx:1166-1167 comment says deleting removes "products, orders & distributions", code does not explicitly (:1174-1203).
C17. [CONFIRMED] H/controller/ContractAdmin.hx:775: `args.d.id` dereferenced although `args.d` is null for constant catalogs (args.d only required for variable, :758-760) -> null error after updating prices for constant catalogs. (ContractAdmin.hx:775; d is only set for TYPE_VARORDER, :762-765.)
C18. [CONFIRMED] H/controller/Media.hx:97 comment "3Mb" vs 4 MB limit and error message "3 Mo" (:99); Media.doEdit offers only "public" visibility and default 'members' (:41-43).
C19. [CONFIRMED] H/controller/Cron.hx:303-309 comments swapped ("vendor logo" checks Group.image, "group logo" checks Vendor.image); behaviour fine. (Cron.hx:308-314 actual lines.)
C20. [CONFIRMED] T/api-core/src/files/file.service.ts:50-53 `getExtension` uses `split('.')[1]` (wrong for names with several dots); file.controller.ts:57 stray `4;` statement; makeSign cache `static CACHE=[]` keyed by id (:15,61). (`4;` at file.controller.ts:57.)
C21. [CONFIRMED] T/api-core/src/vendors/resolvers/vendors.resolver.ts:76 `currentUser.email2.toLowerCase()` throws if email2 is null (entity nullable, T/api-core/src/users/models/user.entity.ts:58). `getVendorsFromCompanyNumber` (:144) and `getVendorProfessions` (:151) have no auth guard (the other vendor queries carry `@UseGuards(GqlAuthGuard)`); the `place` query is also unguarded (T/api-core/src/places/resolvers/places.resolver.ts:10). (nuance: email2.toLowerCase() is only evaluated when the first comparison is already unequal, so impact is a TypeError/500 instead of UnauthorizedException. No APP_GUARD/global guard found in api-core/src. Security-relevant: unauthenticated queries.)
C22. [CONFIRMED] TS `vendor.disabled` field is declared non-nullable `VendorDisabledReason` (vendors.resolver.ts:423) while the type marks it nullable (vendor.type.ts:88-89).
C23. [CONFIRMED] TS `EntityFileService.updateOrCreate` never looks up an existing row (entityFile.service.ts, `save` without id), so it always inserts (used for vendor images, vendors.resolver.ts:364 and documents, entity-file.resolver.ts:171). (tools/entityFile.service.ts:73-75 `save` of DeepPartial without id; callers vendors.resolver.ts:364, entity-file.resolver.ts:~168.)
C24. [CONFIRMED] Document visibility lists differ: Haxe group documents allow subscribers/members/public (H/controller/Documents.hx:60-62) vs TS group docs only public/members (entity-file.resolver.ts:95-110); TS vendor documents only 'public' is valid and TS returns all vendor documents with no visibility filtering (vendors.resolver.ts:438-449). Haxe has no vendor documents. (Haxe Documents.hx:57-60 form is shared by group and catalog docs; TS group case allows only public+members, catalog allows members+subscribers: entity-file.resolver.ts:~112-126. Haxe vendor documents: no reference to 'vendor' in Documents.hx/Vendor.hx.)
C25. [CONFIRMED] H/service/VendorService.hx:43 and :55,63: SQL assembled by string interpolation (name sanitised only by removing `"` and a keyword denylist; profession/fromLat/fromLng interpolated unquoted). T/api-core/src/places/services/places.service.ts:31,47 and catalogs.service.ts:72,85 also interpolate numeric args into SQL. (VendorService.hx:43,55,63 verified. Whether the Haxe search args are typed as numbers upstream is unchecked; TS args are typed Int/Float GraphQL scalars so exploitability there is low.)


## Verification summary

Confirmed: 33 (D1-D9, C1-C3, C5-C25). Refuted: 1 (C4). Plausible: 1 (D10).
