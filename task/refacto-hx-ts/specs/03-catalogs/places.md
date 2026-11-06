# Places (CAT-PLC)

Actors: group admin, member, visitor. A place is a distribution location of a group.

- **CAT-PLC-001** As a group admin, I can create, view, edit and delete the places of my group. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Place.hx:18-89 -->

- **CAT-PLC-002** As a group admin, a place has a name (64 characters), up to two address lines, zip code, city and country. <!-- 03-features/catalogs-products-vendors-places.md R42; camap-hx/src/db/Place.hx:8-30 -->
  - The country defaults to France.
  - Latitude and longitude are limited to valid ranges, and both are empty if one is.

- **CAT-PLC-003** As a group admin, I can create a place only in France or Belgium, although the form offers more countries. <!-- 03-features/catalogs-products-vendors-places.md R42; camap-hx/src/controller/Place.hx:75-77; camap-hx/src/db/Place.hx:113-125 -->
  - The form offers 8 countries (`camap-hx/src/db/Place.hx:113-125`); a place in any other country is refused with an explicit message (`camap-hx/src/controller/Place.hx:75-77`). This is intended.
  - The front address search covers 13 country codes (France, Belgium and French territories), more than the creation rule accepts (`camap-ts/packages/front-core/src/utils/mapbox-geocoding.ts:24-25`). This is intended.
  - **DECISION (UND-045, 2026-11-06)** Keep the current behaviour: the creation rule stays France and Belgium, the form list and the address search are not changed.

- **CAT-PLC-004** As a group admin, a new or edited place is located on the map from its address. <!-- 03-features/catalogs-products-vendors-places.md R42; camap-hx/src/controller/Place.hx:50-56,79-82 -->
  - The server geocodes the address on creation, and on edit whenever the address changed or no position is set; otherwise the coordinates coming from the address search are kept.
  - A failure only shows a warning and the place is saved.
  - **ERRATUM** Today Haxe geocodes a place only on edit (when the address changed or no position is set), never on creation. Source: `camap-hx/src/controller/Place.hx:50-56,75-90` (CODE-098).
  - **DECISION (UND-044, 2026-11-06)** Geocode on the server whenever the address changes or coordinates are missing and keep client-supplied coordinates otherwise; a failure blocks a vendor save and only warns for a place; also geocode on place creation.

- **CAT-PLC-005** As a group admin, I cannot delete a place used by a distribution. <!-- 03-features/catalogs-products-vendors-places.md R43; camap-hx/src/controller/Place.hx:93-94 -->
  - Only a group manager can delete a place.

- **CAT-PLC-006** As a group admin, I can delete a place only if I am a group manager. <!-- 03-features/catalogs-products-vendors-places.md S3.1; camap-hx/src/controller/Place.hx:18-89 -->
  - Listing, creating and editing places have no explicit rights check of their own in the place controller (whether a parent guard covers them is unverified).
  - No same-group check is added on edit or delete.
  - **DECISION (UND-051, 2026-11-06)** Keep the current behaviour: only delete requires a group manager (option a is not applied).

- **CAT-PLC-007** As a visitor, I can see on a map the groups and their places near a position. <!-- 03-features/catalogs-products-vendors-places.md R44; camap-ts/packages/api-core/src/places/services/places.service.ts:21-56 -->
  - The map shows at most 200 places in a zone and finds the closest places within about 2 degrees.

- **CAT-PLC-008** As a group admin, the address search suggests addresses in 13 French-speaking territories. <!-- 03-features/catalogs-products-vendors-places.md R44; camap-ts/packages/front-core/src/utils/mapbox-geocoding.ts:24-25 -->

- **CAT-PLC-009** As a member, I can read the name, address and position of a place. <!-- 03-features/catalogs-products-vendors-places.md S3.2, S3.3; camap-hx/src/controller/api/Places.hx:13; camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10 -->
  - **ERRATUM** Today anyone can read a place through the API, without login. Source: `camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10` (CODE-021).
  - **DECISION (UND-043, 2026-11-06)** Reading a place needs login and membership of the place's group (see CAT-PLC-010).

- **CAT-PLC-010** As a member of the group of a place, I can read the details of that place; a visitor or a member of another group cannot. <!-- 03-features/catalogs-products-vendors-places.md S3.3, S7; camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10 -->
  - **ERRATUM** Today the `place` query has no guard, so anyone can read a place. Source: `camap-ts/packages/api-core/src/places/resolvers/places.resolver.ts:10` (CODE-021).
  - **DECISION (UND-043, 2026-11-06)** Require login on all these TS queries; restrict catalog `subscriptions` to catalog managers and the subscriber, catalog `products` to group members or managers, and `place` to members of its group.
