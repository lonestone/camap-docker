# Choosing the current group (NAV-SEL)

Actors: logged-in user, vendor.

- **NAV-SEL-001** As a logged-in user, I can see the groups I belong to and the waiting lists I joined, and choose one. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/User.hx:54-80 -->
  - Choosing a group makes it my current group and opens its home page.
  - Any pending order and new-group flag are cleared.
  - The list shows only my groups, but the chooser accepts any group id, including a group I do not belong to. This is intended: see NAV-SEL-002.

- **NAV-SEL-002** As a logged-in user, I can choose any group as my current group, even one I do not belong to. <!-- 03-features/users-auth.md S3.1; 03-features/groups-membership.md R8; camap-hx/src/controller/User.hx:64-74 -->
  - The chooser lists only my groups; any other group id passed to it is accepted as is.
  - In a group I do not belong to, I see every page and component that does not check membership (for example the group home page with its open catalogs and distributions).
  - Components that check membership or rights stay closed to me.
  - As a superadmin, I have full rights in any group I choose.
  - **DECISION (UND-117, 2026-11-02)** Keep the current behaviour: a user can open any group and see every component that does not check membership.

- **NAV-SEL-003** As a vendor, I see my vendor widget on the group chooser page. <!-- 03-features/frontend-templates-i18n.md S5 user; camap-hx/lang/master/tpl/user/choose.mtt -->

- **NAV-SEL-004** As a logged-in user, quitting a group clears my current group if it was that one. <!-- 03-features/users-auth.md S3.1; camap-hx/src/controller/Account.hx:70-74 -->

- **NAV-SEL-005** As a member, my current group is remembered for the whole session. <!-- 03-features/users-auth.md S2; camap-hx/src/App.hx:160-171 -->

- **NAV-SEL-006** As a logged-in user with several groups, I can switch group from the chooser page at any time. <!-- 03-features/groups-membership.md F5; camap-hx/src/controller/User.hx:54-80 -->

- **NAV-SEL-007** As a logged-in user, I see a message set by the platform on the chooser page. <!-- 03-features/admin-superadmin.md S3; camap-hx/lang/master/tpl/user/choose.mtt:3-6 -->
  - See ADM-ANN-003.
