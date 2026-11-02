# Back-office access and home (ADM-DSH)

Actors: superadmin, logged-in user.

- **ADM-DSH-001** As a superadmin, I can open the back-office home page. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:29-39 -->
  - Every back-office page is reserved to superadmins; other users are sent to the home page.

- **ADM-DSH-002** As a superadmin, I can reload the platform settings without restarting. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:34-38 -->
  - The page confirms "Theme reloaded".

- **ADM-DSH-003** As a superadmin, I see a sidebar linking to errors, unsent emails, group-chooser message, announcements, admin announcements, groups and users. <!-- 03-features/admin-superadmin.md S3 admin layout; camap-hx/lang/master/tpl/admin/basedesign.mtt:14-20 -->

- **ADM-DSH-004** *Undecided (UND-112)*: As a superadmin, I can reach the theme page and the superadmin list from the sidebar. <!-- 03-features/admin-superadmin.md S3 admin layout; camap-hx/src/controller/admin/Admin.hx:42,207 -->
  - Currently both pages exist without a sidebar link.
  - **SUGGESTION** Link the theme and superadmin pages in the sidebar and reload the theme right after saving. Based on: `camap-hx/lang/master/tpl/admin/default.mtt:28-30` (buttons already exist on the dashboard), `camap-hx/lang/master/tpl/admin/basedesign.mtt:14-20` (sidebar lacks them), `camap-hx/src/controller/admin/Admin.hx:34-37,52` (reload is manual). Confidence: medium.

- **ADM-DSH-005** As a superadmin, I can list all superadmins. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:207-209 -->

- **ADM-DSH-006** *Undecided (UND-114)*: As a superadmin, I can open the raw database administration tool. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/Main.hx:302-306 -->
  - Currently the route works but its sidebar link is commented out because of a database upgrade incompatibility.
  - It is used to edit rights and the disabled state of groups.
  - **SUGGESTION** Remove the raw `/db` route once dedicated screens exist for disabling a group and editing rights. Operators use a database client meanwhile. Based on: `camap-hx/lang/master/tpl/admin/basedesign.mtt:11-13` (link disabled, MySQL 8 incompatibility), `camap-hx/src/controller/Main.hx:302-306` (route still open to `@admin`). Confidence: low. Product input needed: operators' need for raw DB access.
