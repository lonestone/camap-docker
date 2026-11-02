# Places (CAT-PLC)

Actors: group admin, member, visitor. A place is a distribution location of a group.

- **CAT-PLC-001** As a group admin, I can create, view, edit and delete the places of my group. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Place.hx:18-89 -->

- **CAT-PLC-002** As a group admin, a place has a name (64 characters), up to two address lines, zip code, city and country. <!-- 03-features/catalogs-products-vendors-places.md R42; camap-hx/src/db/Place.hx:8-30 -->
  - The country defaults to France.
  - Latitude and longitude are limited to valid ranges, and both are empty if one is.

- **CAT-PLC-003** *Undecided (UND-045)*: As a group admin, I can create a place in any country the form offers. <!-- 03-features/catalogs-products-vendors-places.md R42; camap-hx/src/controller/Place.hx:75-77; camap-hx/src/db/Place.hx:113-125 -->
  - The form offers 8 countries.
  - **SUGGESTION** Allow only France and Belgium, and offer only those two countries in the form. Based on: `camap-hx/src/controller/Place.hx:75-77` (explicit server rule and message), `camap-hx/src/db/Place.hx:113-125` (form offers 8 countries), `camap-ts/packages/front-core/src/utils/mapbox-geocoding.ts:24-25` (search covers FR, BE and French territories). Confidence: medium. Needs product input on foreign groups.

- **CAT-PLC-004** *Undecided (UND-044)*: As a group admin, a new or edited place is located on the map from its address. <!-- 03-features/catalogs-products-vendors-places.md R42; camap-hx/src/controller/Place.hx:50-56,79-82 -->
  - On edit, location happens when the address changed or no position is set; a failure only shows a warning.
  - On creation nothing is located.
  - **SUGGESTION** Geocode on the server whenever the address changes or coordinates are missing, and keep client-supplied coordinates from the address search otherwise. A failure blocks a vendor save and only warns for a place. Also geocode on place creation. Based on: `camap-hx/src/service/VendorService.hx:137-142` (vendor failure blocks), `camap-hx/src/controller/Place.hx:50-56` (place failure only warns; `doInsert` at 75-90 never geocodes), `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277` (trusts typed lat/lng). Confidence: medium.

- **CAT-PLC-005** As a group admin, I cannot delete a place used by a distribution. <!-- 03-features/catalogs-products-vendors-places.md R43; camap-hx/src/controller/Place.hx:93-94 -->
  - Only a group manager can delete a place.

- **CAT-PLC-006** *Undecided (UND-051)*: As a group admin, only group managers can list, create and edit places. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Place.hx:18-89 -->
  - **SUGGESTION** Group managers only. Require `isAmapManager()` on list, create and edit, and check that the place belongs to the current group on edit and delete. Based on: `camap-hx/src/controller/Place.hx:90` (delete already requires `isAmapManager()`), `camap-hx/src/controller/Place.hx:18-89` (list, insert and edit have no check). Confidence: high.

- **CAT-PLC-007** As a visitor, I can see on a map the groups and their places near a position. <!-- 03-features/catalogs-products-vendors-places.md R44; camap-ts/packages/api-core/src/places/services/places.service.ts:21-56 -->
  - The map shows at most 200 places in a zone and finds the closest places within about 2 degrees.

- **CAT-PLC-008** As a group admin, the address search suggests addresses in 13 French-speaking territories. <!-- 03-features/catalogs-products-vendors-places.md R44; camap-ts/packages/front-core/src/utils/mapbox-geocoding.ts:24-25 -->

- **CAT-PLC-009** As a member, I can read the name, address and position of a place. <!-- 03-features/catalogs-products-vendors-places.md S3.2, S3.3; camap-hx/src/controller/api/Places.hx:13; camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10 -->
  - **ERRATUM** Anyone can read a place through the API, without login. Source: `camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10` (CODE-021).

- **CAT-PLC-010** *Undecided (UND-043)*: As a logged-in user, I can read the details of a place. <!-- 03-features/catalogs-products-vendors-places.md S3.3, S7; camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10 -->
  - **SUGGESTION** Require login on all of them. Restrict catalog `subscriptions` to catalog managers and the subscriber, catalog `products` to group members or managers, and `place` to members of its group. Keep vendor professions and company-number search for logged-in users. Based on: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:66-68,83-85` (sibling queries use `GqlAuthGuard`), `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:52-65` (the `catalog` query checks `canManageCatalog`), `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:141-149` (subscription field has no check). Confidence: medium. Needs product input on public vendor pages.
