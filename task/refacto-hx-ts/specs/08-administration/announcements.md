# Announcements (ADM-ANN)

Actors: superadmin, member, group admin.

- **ADM-ANN-001** As a superadmin, I can post an announcement displayed to all members of every group. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:146-179; camap-hx/src/controller/Main.hx:166-170 -->
  - It appears as a flash message on the group home page.
  - An empty message shows nothing.

- **ADM-ANN-002** As a superadmin, I can post an announcement shown only to group admins and other members holding rights. <!-- 03-features/admin-superadmin.md S4 Variable keys; camap-hx/src/controller/admin/Admin.hx:184-204; camap-hx/src/controller/Main.hx:147-164 -->
  - I can show it with a red background to flag an alert.

- **ADM-ANN-003** As a superadmin, I can set a message (raw HTML) displayed on the group chooser page. <!-- 03-features/admin-superadmin.md S3; camap-hx/lang/master/tpl/user/choose.mtt:3-6 -->

- **ADM-ANN-004** As a member, I see the platform announcement on my home page. <!-- 03-features/admin-superadmin.md R3; camap-hx/src/controller/Main.hx:147-170 -->
