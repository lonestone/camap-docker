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

- **CAT-VEN-004** *Undecided (UND-044)*: As a vendor, my address is located on the map when I save my profile. <!-- 03-features/catalogs-products-vendors-places.md R36; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277 -->
  - **SUGGESTION** Geocode on the server whenever the address changes or coordinates are missing, and keep client-supplied coordinates from the address search otherwise. A failure blocks a vendor save and only warns for a place. Also geocode on place creation. Based on: `camap-hx/src/service/VendorService.hx:137-142` (vendor failure blocks), `camap-hx/src/controller/Place.hx:50-56` (place failure only warns; `doInsert` at 75-90 never geocodes), `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:224-277` (trusts typed lat/lng). Confidence: medium.

- **CAT-VEN-005** As a vendor or a coordinator, the vendor email must be valid, the description at most 1000 characters and the link must start with http. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:238-252 -->

- **CAT-VEN-006** As a coordinator, I can edit an unclaimed vendor if I manage one of its catalogs. <!-- 03-features/catalogs-products-vendors-places.md R35; camap-hx/src/db/User.hx:176-189 -->
  - A superadmin can edit any vendor.

- **CAT-VEN-007** As a vendor owner of a claimed record, I am the only one who can edit it. <!-- 03-features/catalogs-products-vendors-places.md R35; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:548-566 -->

- **CAT-VEN-008** As a member or a visitor, I cannot open the page of a disabled vendor. <!-- 03-features/catalogs-products-vendors-places.md R37; camap-hx/src/controller/Vendor.hx:23-24 -->
  - A disabled vendor cannot be chosen for a new catalog and its catalogs are not listed as active.

- **CAT-VEN-009** *Undecided (UND-052)*: As a superadmin, I can disable and re-enable a vendor and choose the reason. <!-- 03-features/catalogs-products-vendors-places.md R37; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:196-207 -->
  - Reasons: incomplete legal information, not compliant with the policy, banned.
  - **SUGGESTION** Add superadmin-only ban and unban mutations with the three reasons. Reuse the existing service functions. Based on: `camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:196-207` (`ban` and `unban` exist, no caller), `camap-hx/src/db/Vendor.hx:8-12,181-185` (reasons and user-facing messages exist), `camap-hx/src/controller/Vendor.hx:23` (disabled vendors are blocked). Confidence: medium.

- **CAT-VEN-010** As a member or a visitor, I see the vendor's email and phone only when the vendor chose to show them; managers of the vendor's catalogs always see them. <!-- 03-features/catalogs-products-vendors-places.md R40; camap-hx/src/db/Vendor.hx:97-100; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:456-467 -->
  - The vendor's show-email and show-phone choices are honoured separately.
  - The rights check is awaited before the contact fields are returned.
  - **ERRATUM** Today TS field resolvers call the async rights check without awaiting it, so email and phone are exposed whatever the vendor's settings. Haxe honours them. Source: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:456-467` (CODE-007).
  - **DECISION (UND-041, 2026-11-06)** Honour show-email and show-phone and await the rights check; managers always see the contacts.

- **CAT-VEN-011** As a vendor creating a record, the version of the terms of service I accepted is stored. <!-- 03-features/catalogs-products-vendors-places.md R41; camap-ts/packages/api-core/src/vendors/services/vendor.service.ts:183-195 -->
  - **ERRATUM** Creating a vendor in TS fails when the terms-of-service version setting does not exist yet. Source: `camap-ts/packages/api-core/src/tools/variable.service.ts:47-48` (CODE-060).

- **CAT-VEN-012** *Undecided (UND-043)*: As a logged-in user, I can list vendor professions and search vendors by company number. <!-- 03-features/catalogs-products-vendors-places.md S3.3, S7; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:144,151 -->
  - **SUGGESTION** Require login on all of them. Restrict catalog `subscriptions` to catalog managers and the subscriber, catalog `products` to group members or managers, and `place` to members of its group. Keep vendor professions and company-number search for logged-in users. Based on: `camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:66-68,83-85` (sibling queries use `GqlAuthGuard`), `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:52-65` (the `catalog` query checks `canManageCatalog`), `camap-ts/packages/api-core/src/vendors/resolvers/catalogs.resolver.ts:141-149` (subscription field has no check). Confidence: medium. Needs product input on public vendor pages.

- **CAT-VEN-013** As a vendor, I can see the vendors that I own, my default vendor, and whether I own any. <!-- 03-features/catalogs-products-vendors-places.md S3.3; camap-ts/packages/api-core/src/vendors/resolvers/vendors.resolver.ts:106-132 -->
  - I can only ask these questions about myself.
