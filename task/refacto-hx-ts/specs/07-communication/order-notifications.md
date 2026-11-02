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

- **COM-NTF-006** *Undecided (UND-104)*: As a member, automatic emails are written in my language. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:197,200 -->
  - Some texts and the date format of volunteer alerts are hard-coded in French.
  - **SUGGESTION** Write automatic emails in the recipient language: switch locale to the user lang and translate subject and date text. Keep the group-authored body as is. Based on: `camap-hx/src/controller/Cron.hx:567,665` (sibling jobs call Locale.init(user.lang)), `camap-hx/src/controller/Cron.hx:197,200` (volunteer alert subject and date hard-coded French), `camap-hx/src/db/User.hx:24` (user lang field). Confidence: medium. The token in use is [ROLES_MANQUANTS] (`Cron.hx:204`, `amapadmin/Volunteers.hx:46`).
  - **IMPACT OF UND-118** With no language selection, automatic emails are in French; their hard-coded subjects and dates are exported to the translation files like every other string.

- **COM-NTF-007** *Undecided (UND-105)*: As a vendor or catalog contact, the order recap covers exactly the distributions that just closed. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:716-724 -->
  - The query joins with AND instead of WHERE.
  - **SUGGESTION** Fix all three: use WHERE in the recap query (same shape as `Cron.hx:232-236`), use the faked clock `now` in the errors email, and take a lock per daily job so only one replica runs it (for example a row in the cache table, or run jobs from one replica only). Based on: `camap-hx/src/controller/Cron.hx:716-724` (join on AND), `camap-hx/src/controller/Cron.hx:353-357` (errors email uses Date.now), `camap-ts/packages/api-core/src/tools/crontab.service.ts:15-55` (every replica fires jobs, no lock). Confidence: medium. Note: with an INNER JOIN the AND form returns the same rows, so that fix is cosmetic.

- **COM-NTF-008** As a member, the in-app and email notification options are my own preferences. <!-- 03-features/messaging-mails.md R10; camap-hx/src/db/User.hx:8-10 -->
  - See 01-accounts/notifications.md.
