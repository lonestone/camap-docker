# Back-office access and home (ADM-DSH)

Actors: superadmin, logged-in user.

- **ADM-DSH-001** As a superadmin, I can open the back-office home page. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:29-39 -->
  - Every back-office page is reserved to superadmins; other users are sent to the home page.

- **ADM-DSH-002** As a superadmin, I can reload the platform settings without restarting. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:34-38 -->
  - The page confirms "Theme reloaded".

- **ADM-DSH-003** As a superadmin, I see a sidebar linking to errors, unsent emails, group-chooser message, announcements, admin announcements, groups and users. <!-- 03-features/admin-superadmin.md S3 admin layout; camap-hx/lang/master/tpl/admin/basedesign.mtt:14-20 -->

- **ADM-DSH-004** As a superadmin, I can reach the theme page and the superadmin list from the buttons of the back-office home page, not from the sidebar. <!-- 03-features/admin-superadmin.md S3 admin layout; camap-hx/src/controller/admin/Admin.hx:42,207 -->
  - Both pages exist and the sidebar does not link to either of them. This is intended.
  - The theme is cached in memory until I reload the settings or the application restarts (see ADM-DSH-002, ADM-THM-002). This is intended.
  - **DECISION (UND-112, 2026-11-06)** Keep the current behaviour: the pages stay unlinked in the sidebar and the theme is not reloaded automatically on save (option b).

- **ADM-DSH-005** As a superadmin, I can list all superadmins. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:207-209 -->

- **ADM-DSH-006** As a superadmin, I can still open the raw database administration tool by its address, until it is removed. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/Main.hx:302-306 -->
  - The route works for superadmins; its sidebar link is commented out because of a database upgrade incompatibility (MySQL 8) (`camap-hx/lang/master/tpl/admin/basedesign.mtt:11-13`).
  - It is used to edit the disabled state of groups (see GRP-DSB-005, ADM-GRP-006).
  - The raw route is to be removed once dedicated screens exist for what it is used for. Until then operators can use a database client.
  - **DECISION (UND-114, 2026-11-06)** Remove the raw `/db` route once dedicated screens exist; operators use a database client meanwhile.
