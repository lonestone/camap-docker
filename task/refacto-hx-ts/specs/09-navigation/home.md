# Home page (NAV-HOM)

Actors: visitor, logged-in user, member.

- **NAV-HOM-001** As a visitor without a selected group, I am sent to the login page when I open the home page. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Main.hx:66-174 -->
  - A visitor who opened the page of an open group can see that group's home page.

- **NAV-HOM-002** As a logged-in user with no group, I am sent to the group chooser page. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Main.hx:66-174 -->

- **NAV-HOM-003** As a member of a disabled group, I am sent to the disabled-group notice instead of the home page. <!-- 03-features/groups-membership.md R5; camap-hx/src/controller/Main.hx:84-86 -->

- **NAV-HOM-004** As a member, I see on the home page the open orders of my group and links to the subscription pages of its catalogs. <!-- 03-features/orders-subscriptions.md F5.1; camap-hx/lang/master/tpl/home.mtt:75-80,156 -->

- **NAV-HOM-005** As a member, I see on the home page the announcement of the platform, and, if I hold group rights, the announcement for group admins. <!-- 03-features/admin-superadmin.md R3; camap-hx/src/controller/Main.hx:147-170 -->

- **NAV-HOM-006** As a member of a group that requires them, I see on the home page a reminder to give my phone number and address. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Main.hx:135-145 -->

- **NAV-HOM-007** As a visitor, a platform in maintenance mode shows me a maintenance page instead of the home page. <!-- 03-features/admin-superadmin.md S4; camap-hx/src/controller/Main.hx:36-41 -->
  - A superadmin still sees the platform.

- **NAV-HOM-008** As a visitor, a path with no matching page leads to the home page. <!-- 03-features/frontend-templates-i18n.md R1; camap-hx/src/controller/Main.hx:34-53 -->

- **NAV-HOM-009** As a logged-in user whose two login cookies disagree, I am logged out and sent to the login page when I open the home page. <!-- 03-features/users-auth.md F5.2; camap-hx/src/controller/Main.hx:70-77 -->
