# Order reminders and recaps (COM-NTF)

Actors: the system, member, vendor, catalog contact.

- **COM-NTF-001** As a member, I receive a reminder email 24 hours before a distribution where I have orders, if I enabled it. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:213-218,458-622 -->
  - The email lists my orders of the distribution, in French, with the group contact as reply address.
  - Orders of quantity 0 are not listed.
  - The second person of an alternated basket is notified for the baskets of their turn.
  - I get at most one reminder per distribution and delay.

- **COM-NTF-002** As a member, I receive the same reminder 4 hours before a distribution, if I enabled it. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:458-622 -->

- **COM-NTF-003** As a member, I receive an email when ordering opens for variable catalogs, if I enabled the notification. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:221-225,624-714 -->
  - It is sent for distributions whose ordering opens in the current hour.
  - Constant-orders catalogs are excluded.

- **COM-NTF-004** As a vendor, I receive the list of ordered products when orders close, if the catalog notifies the vendor and my email is set. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:330-334,716-816 -->
  - It includes the new subscriptions since the last distribution.

- **COM-NTF-005** As a catalog contact, I receive a recap of orders when orders close, if the catalog notifies the contact. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:716-816 -->

- **COM-NTF-006** As a member, automatic emails are written in French, like the rest of the platform. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:197,200 -->
  - There is no per-user language: the interface and the emails are French only (see UND-118).
  - The subject and the date format of the volunteer alerts are hard-coded French in the code. This is kept in the current system.
  - The volunteer-alert token in use is `[ROLES_MANQUANTS]` (`camap-hx/src/controller/Cron.hx:204`, `camap-hx/src/controller/amapadmin/Volunteers.hx:46`); the `[ROLES_MISSING]` found at `Cron.hx:197,200` and in an older description is not the one to document.
  - When the cron emails are ported to TS, their subjects and dates go into the translation files: see `task/refacto-hx-ts/TS-ONLY-STEP.md`.
  - **DECISION (UND-104, 2026-11-06)** Automatic emails are French only (UND-118) instead of following the user language; the subject and date texts move to the translation files at the port.

- **COM-NTF-007** As a vendor or catalog contact, the order recap covers exactly the distributions that just closed. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:716-724 -->
  - The recap query selects the distributions with a WHERE clause (same shape as `camap-hx/src/controller/Cron.hx:232-236`).
  - **ERRATUM** Today the query joins with AND instead of WHERE; with an inner join the rows are the same, so this fix is cosmetic. Source: `camap-hx/src/controller/Cron.hx:716-724` (CODE-082).
  - **DECISION (UND-105, 2026-11-06)** Use WHERE in the recap query, the faked clock in the errors email, and a per-job lock across replicas.

- **COM-NTF-008** As a member, the in-app and email notification options are my own preferences. <!-- 03-features/messaging-mails.md R10; camap-hx/src/db/User.hx:8-10 -->
  - See 01-accounts/notifications.md.
