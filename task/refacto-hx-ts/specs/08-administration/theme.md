# Theme and branding (ADM-THM)

Actors: superadmin, member.

- **ADM-THM-001** As a superadmin, I can edit the platform theme as a block of settings. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:41-62 -->
  - An invalid block is refused with an error message.
  - A valid block is saved and I return to the back-office home.
  - **ERRATUM** The saved theme is ignored by TS: emails and invitations sent by TS always use the default theme. Source: `camap-ts/packages/api-core/src/tools/variable.service.ts:61-72` (CODE-104).

- **ADM-THM-002** As a superadmin, my theme change shows on pages after the settings reload. <!-- 03-features/admin-superadmin.md S3, F1; camap-hx/src/controller/admin/Admin.hx:34-38; camap-hx/src/App.hx:153-157 -->

- **ADM-THM-003** As a member, new pages and emails use the saved theme. <!-- 03-features/admin-superadmin.md R2; camap-ts/packages/api-core/src/tools/variable.service.ts:61-72 -->
  - TS reads the stored white-label setting, with the default theme as fallback.
  - Saving the theme clears the TS cache, so the change shows without a restart.
  - **ERRATUM** Today the TS side always uses the default theme, cached forever. Source: `camap-ts/packages/api-core/src/tools/variable.service.ts:61-72` (CODE-104).
  - **DECISION (UND-101, 2026-11-02)** TS reads the stored white-label theme (default theme as fallback, cache cleared on save); colors stay on the built-in palette.

- **ADM-THM-004** As a visitor, the platform shows a default theme when none is saved or the saved one is unreadable. <!-- 03-features/admin-superadmin.md S4 Variable keys; camap-hx/src/App.hx:145-150 -->
