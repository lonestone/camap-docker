# Tasks for after the migration

Work that is wanted but only makes sense once Haxe is ported to TS and removed. These are **not** part of the migration and change nothing in the current system or in the specs. They come from product decisions taken while settling the undecided points ([specs/UNDECIDED.md](specs/UNDECIDED.md)). For what happens *during* the port, see [TS-ONLY-STEP.md](TS-ONLY-STEP.md).

## 1. Soft delete for catalogs

- **Origin**: UND-047 (2026-11-06). Deleting a catalog stays a permanent delete in the current system ([CAT-CDD-005, CAT-CDD-006](specs/03-catalogs/catalog-duplicate-delete.md)).
- **Goal**: once the app is TS-only, deleting a catalog archives it (soft delete) instead of removing its rows, so that its products, distributions, orders and history are kept.
- **Why later**: today the deletion relies on database cascades that were never verified (`camap-hx/src/controller/ContractAdmin.hx:1166-1204`), and Haxe reads catalogs everywhere. A soft-delete flag would need every Haxe query to ignore archived catalogs. Doing it once, in TS, is cheaper and safer.
- **To specify when the task starts** (nothing here is decided):
  - the rule that blocks deletion when something was ordered (keep, relax or drop it);
  - what an archived catalog still shows (reports, invoices, member history);
  - whether an archived catalog can be restored, and by whom;
  - the effect on volunteer roles, the coordinator right and distributions of the catalog;
  - the data migration for catalogs already deleted (their rows are gone).
- **Link**: spec statements [CAT-CDD-005, CAT-CDD-006](specs/03-catalogs/catalog-duplicate-delete.md).
