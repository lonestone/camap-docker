# Vendors (CAT-VEN)

Actors: catalog coordinator, vendor, member, visitor, superadmin. A vendor record is shared by all groups.

- **CAT-VEN-001** As a catalog coordinator, I can create a vendor record with name, contact person, email, phone, address, SIRET, descriptions, link, profession and productions. <!-- 03-features/catalogs-products-vendors-places.md R35; camap-hx/src/db/Vendor.hx:17-56; camap-hx/src/service/VendorService.hx:92-113 -->
  - The email is required and valid.
  - The SIRET number is required in the form.
  - The short description has at most 1000 characters.
  - **ERRATUM** The database migration makes the SIRET column mandatory, while both apps treat it as optional. Source: `camap-ts/packages/api-core/src/migrations/1721184612071-addCompanyNumber.ts:7` (CODE-089).

- **CAT-VEN-002** As a catalog coordinator, I cannot create a vendor with an email already used by another vendor. <!-- 03-features/catalogs-products-vendors-places.md R36; camap-hx/src/service/VendorService.hx:82-84 -->

- **CAT-VEN-003** As a catalog coordinator, the address of the vendor is located on the map when I save it. <!-- 03-features/catalogs-products-vendors-places.md R36; camap-hx/src/service/VendorService.hx:137-142 -->
  - If the address cannot be located I see "unable to locate this address" and the vendor is not saved.
  - **ERRATUM** From the vendor dashboard (TS) the address is not located; the position fields are taken as entered. Source: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277` (CODE-098).

- **CAT-VEN-004** As a vendor, my address is located on the map when I save my profile, and I cannot save it if the address cannot be located. <!-- 03-features/catalogs-products-vendors-places.md R36; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277 -->
  - The server geocodes the address whenever it changed or the coordinates are missing; otherwise the coordinates coming from the address search are kept.
  - A geocoding failure blocks the vendor save.
  - **ERRATUM** Today TS `updateVendor` never geocodes and trusts the latitude and longitude typed by the user, while Haxe geocodes vendors on every save and a failure blocks it. Source: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277`, `camap-hx/src/service/VendorService.hx:137-142` (CODE-098).
  - **DECISION (UND-044, 2026-11-06)** Geocode on the server whenever the address changes or coordinates are missing and keep client-supplied coordinates otherwise; a failure blocks a vendor save and only warns for a place; also geocode on place creation.

- **CAT-VEN-005** As a vendor or a coordinator, the vendor email must be valid, the description at most 1000 characters and the link must start with http. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:238-252 -->

- **CAT-VEN-006** As a coordinator, I can edit an unclaimed vendor if I manage one of its catalogs. <!-- 03-features/catalogs-products-vendors-places.md R35; camap-hx/src/db/User.hx:176-189 -->
  - A superadmin can edit any vendor.

- **CAT-VEN-007** As a vendor owner of a claimed record, I am the only one who can edit it. <!-- 03-features/catalogs-products-vendors-places.md R35; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:548-566 -->

- **CAT-VEN-008** As a member or a visitor, I cannot open the page of a disabled vendor. <!-- 03-features/catalogs-products-vendors-places.md R37; camap-hx/src/controller/Vendor.hx:23-24 -->
  - A disabled vendor cannot be chosen for a new catalog and its catalogs are not listed as active.

- **CAT-VEN-009** As a superadmin, I have no screen or API to disable or re-enable a vendor: the disabled state can only be set directly in the database. <!-- 03-features/catalogs-products-vendors-places.md R37; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:196-207 -->
  - The disabled state is read by Haxe and TS (see CAT-VEN-008). Reasons exist: incomplete legal information, not compliant with the policy, banned.
  - The TS `ban` and `unban` service functions exist but no resolver or Haxe page calls them. This is intended for now.
  - **DECISION (UND-052, 2026-11-06)** Keep the current behaviour (option b): no UI or mutation is added; the vendor is disabled in the database only.

- **CAT-VEN-010** As a member or a visitor, I see the vendor's email and phone only when the vendor chose to show them; managers of the vendor's catalogs always see them. <!-- 03-features/catalogs-products-vendors-places.md R40; camap-hx/src/db/Vendor.hx:97-100; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:456-467 -->
  - The vendor's show-email and show-phone choices are honoured separately.
  - The rights check is awaited before the contact fields are returned.
  - **ERRATUM** Today TS field resolvers call the async rights check without awaiting it, so email and phone are exposed whatever the vendor's settings. Haxe honours them. Source: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:456-467` (CODE-007).
  - **DECISION (UND-041, 2026-11-06)** Honour show-email and show-phone and await the rights check; managers always see the contacts.

- **CAT-VEN-011** As a vendor creating a record, the version of the terms of service I accepted is stored. <!-- 03-features/catalogs-products-vendors-places.md R41; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:183-195 -->
  - **ERRATUM** Today creating a vendor in TS fails when the terms-of-service version setting does not exist yet. Source: `camap-ts/packages/api-core/src/tools/variable.service.ts:47-48` (CODE-060).
  - **DECISION (UND-115, 2026-11-06)** Reading a missing setting no longer fails, so creating a vendor works (see ADM-TLS-006).

- **CAT-VEN-012** As a logged-in user, I can list vendor professions and search vendors by company number; a visitor cannot. <!-- 03-features/catalogs-products-vendors-places.md S3.3, S7; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:144,151 -->
  - **ERRATUM** Today `getVendorsFromCompanyNumber` and `getVendorProfessions` have no guard. Source: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:144,151` (CODE-022).
  - **DECISION (UND-043, 2026-11-06)** Require login on all these TS queries; restrict catalog `subscriptions` to catalog managers and the subscriber, catalog `products` to group members or managers, and `place` to members of its group.

- **CAT-VEN-013** As a vendor, I can see the vendors that I own, my default vendor, and whether I own any. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:106-132 -->
  - I can only ask these questions about myself.
