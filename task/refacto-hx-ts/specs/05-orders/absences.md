# Absences (ORD-ABS)

Actors: member, catalog coordinator. Absences are distributions a subscriber will miss, within the limits set by the catalog (see 03-catalogs/catalog-absences-settings.md).

- **ORD-ABS-001** As a member, I can declare absences when subscribing, either by choosing distributions or by giving a number of absences. <!-- 03-features/distributions-volunteers.md R39, F-D; camap-hx/src/service/AbsencesService.hx:31-109 -->
  - A number of absences means the last N distributions of the period.

- **ORD-ABS-002** As a member, I can choose as absent only distributions inside the absence period of the catalog and of my subscription, and not merged or shifted ones. <!-- 03-features/distributions-volunteers.md R37; camap-hx/src/service/AbsencesService.hx:13-19; camap-hx/src/db/Subscription.hx:161-182 -->

- **ORD-ABS-003** As a member, my absences contain no duplicate distribution, and their number equals the number allowed. <!-- 03-features/distributions-volunteers.md R39; camap-hx/src/service/AbsencesService.hx:31-60 -->
  - A coordinator can have another number on an existing subscription.
  - Absences are stored in date order.

- **ORD-ABS-004** *Undecided (UND-078)*: As a member, I can change my absences until the order window of each distribution closes. <!-- 03-features/distributions-volunteers.md R40; camap-hx/src/controller/api/Catalog.hx:86-90; camap-hx/src/service/AbsencesService.hx:121,131 -->
  - The member interface locks a distribution by its order closing date. The service locks it by its date.
  - **SUGGESTION** Lock each distribution by its order closing date, in the service as well as the REST layer. Based on: `camap-hx/src/controller/api/Catalog.hx:86-90` (REST filters by orderEndDate), `camap-hx/src/controller/SubscriptionAdmin.hx:179-180` (admin also uses orderEndDate), `camap-hx/src/service/AbsencesService.hx:122,133` (service uses distribution date). Confidence: medium.

- **ORD-ABS-005** As a member, I can change the dates of my absences later, but not the number. <!-- 03-features/distributions-volunteers.md R39-R40; camap-hx/src/service/AbsencesService.hx:94-109,114-194 -->
  - Past distributions cannot be added or removed.

- **ORD-ABS-006** As a member, when an absence changes, my orders follow. <!-- 03-features/distributions-volunteers.md R40; camap-hx/src/service/AbsencesService.hx:114-194 -->
  - Constant catalog: the recurrent orders are regenerated.
  - Variable catalog: orders on newly absent distributions are deleted and default orders are recreated on newly present ones.

- **ORD-ABS-007** As a member, I cannot post an empty list of absences. <!-- 03-features/distributions-volunteers.md R40; camap-hx/src/controller/api/Catalog.hx:102-104 -->
  - A coordinator can.

- **ORD-ABS-008** As a member or a coordinator, I can read and update the absences of a subscription only as its owner or as a coordinator. <!-- 03-features/distributions-volunteers.md S3.4; camap-hx/src/controller/api/Catalog.hx:77-122 -->
  - The catalog must allow absences.

- **ORD-ABS-009** As a member, a subscription's distributions and distribution count exclude my absences unless asked otherwise. <!-- 03-features/distributions-volunteers.md R41; camap-hx/src/service/SubscriptionService.hx:190-262 -->

- **ORD-ABS-010** As a coordinator, I can see the absences of subscribers in the attendance sheet of a constant catalog. <!-- 03-features/distributions-volunteers.md R42; camap-ts/packages/front-core/src/modules/csaAttendanceSheet/ClassicContractAttendanceModule.tsx:236 -->

- **ORD-ABS-011** *Undecided (UND-078)*: As a coordinator creating a subscription for a member, the absence rules of admin mode apply. <!-- 03-features/orders-subscriptions.md R12; camap-hx/src/service/SubscriptionService.hx:675-682 -->
  - Currently absences are always applied in non-admin mode.
  - **SUGGESTION** Pass the service admin mode to setAbsences when a coordinator creates the subscription. Based on: `camap-hx/src/service/SubscriptionService.hx:675,682` (setAbsences always gets false), `camap-hx/src/controller/api/Catalog.hx:96-110` (update path passes manager flag as admin mode), `camap-hx/src/service/AbsencesService.hx:39` (admin mode lifts the absence count rule). Confidence: high.
