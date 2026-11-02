# Email sending (COM-EML)

Actors: the system, recipient.

- **COM-EML-001** As the system, I queue every email and send it within about a minute. <!-- 03-features/messaging-mails.md R1, R4; camap-ts/packages/api-core/src/mails/mails.service.ts:135,186-195 -->
  - Pages and actions never wait for the email to be sent.

- **COM-EML-002** As the system, I process up to 100 queued emails per minute, oldest first. <!-- 03-features/messaging-mails.md R4; camap-ts/packages/api-core/src/mails/mails.service.ts:186-195 -->

- **COM-EML-003** As a recipient, other recipients of the same message are hidden from me. <!-- 03-features/messaging-mails.md R4; camap-ts/packages/api-core/src/mails/mails.service.ts:256-273 -->
  - Recipients are sent in groups of at most 99 as blind copies.

- **COM-EML-004** As the system, I drop invalid email addresses and do not send an email left with no recipient. <!-- 03-features/messaging-mails.md R6; camap-ts/packages/api-core/src/mails/mails.service.ts:56-60,109-118,216-220 -->

- **COM-EML-005** As the system, I retry a failed email up to 30 times. <!-- 03-features/messaging-mails.md R4; camap-ts/packages/api-core/src/mails/mails.service.ts:280-338 -->
  - If only some recipients were rejected, I keep the email for them only.

- **COM-EML-006** As the system, I remove an email from the queue once sent, and purge old sent entries after 10 days. <!-- 03-features/messaging-mails.md R4; camap-ts/packages/api-core/src/mails/mails.service.ts:319,340-341 -->

- **COM-EML-007** *Undecided (UND-100)*: As a recipient of a group email, the sender shown is the group contact name, and replies go to the sender. <!-- 03-features/messaging-mails.md R2, R3, R4; camap-hx/src/App.hx:351-369; camap-ts/packages/api-core/src/mails/mails.service.ts:256-273 -->
  - Currently TS sends from the platform sender address whatever the stored sender, while Haxe stores the group contact as sender.
  - **SUGGESTION** Show the sender name with the platform address, and reply to the sender through Reply-To. Based on: `camap-ts/packages/api-core/src/mails/mails.service.ts:256-262` (from = sender name + theme senderEmail), `camap-ts/packages/api-core/src/mails/mails.service.ts:104-105,156` (Reply-To set from sender when requested), `camap-hx/src/controller/Cron.hx:594,685` (Haxe jobs set Reply-To to the group contact). Confidence: medium. Needs product input on shown address.

- **COM-EML-008** As a recipient, emails use the branding of my platform (theme). <!-- 03-features/messaging-mails.md R13; camap-ts/packages/api-core/src/tools/variable.service.ts:61-72; camap-hx/src/App.hx:121-150 -->
  - TS emails read the white-label theme saved by the superadmin.
  - When none is saved or it cannot be read, the default theme is used.
  - **ERRATUM** Today TS emails always use the default theme and ignore the white-label setting. Source: `camap-ts/packages/api-core/src/tools/variable.service.ts:61-72` (CODE-104).
  - **DECISION (UND-101, 2026-11-02)** TS reads the stored white-label theme (default theme as fallback, cache cleared on save); colors stay on the built-in palette.

- **COM-EML-009** As a recipient, emails are rendered in a shared layout for the platform or the group. <!-- 03-features/messaging-mails.md S2 Templates, R3; camap-hx/lang/fr/tpl/mail/layout-camap.mtt -->

- **COM-EML-010** As a visitor, I receive emails in French. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:458-622 -->
  - **DECISION (UND-118, 2026-11-02)** When porting Haxe to TS, export every hard-coded string to the translation files, and remove the language selection.
