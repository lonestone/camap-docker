# Messaging, email pipeline, notifications

## 1. Scope

The outgoing email pipeline (queue table `BufferedJsonMail`, HX and TS writers, TS sender), digest notifications (`NotificationMail`), mail templates (HX Templo and TS Twing), group messaging ("Messagerie"), notification preferences, and the mail-related admin/preview endpoints. Scheduled job logic and triggers are in `crons-scheduled-jobs.md`.

Ownership summary: every outgoing email is first written as a row in `BufferedJsonMail`. Writers: HX (`App.sendMail`) and TS (`MailsService.createBufferedJsonMail`). The only consumer is TS (`MailsService.sendEmailsFromBuffer`, every minute); HX's own "really send" code is commented out (`camap-hx/src/db/BufferedJsonMail.hx:77-123`). Group mailing is fully TS (GraphQL + React); HX only serves a shell page. Digest notifications (`NotificationMail`) are written and consumed only by HX; TS has an entity but no reader/writer.

## 2. Concepts & glossary terms

- **BufferedJsonMail**: queue table: title, htmlBody, textBody, headers/sender/recipients/attachments as JSON text, mailerType, tries, cdate, sdate, rawStatus (`camap-hx/src/db/BufferedJsonMail.hx:12-28`; TS mirror `camap-ts/packages/api-core/src/mails/models/buffered-json-mail.entity.ts`).
- **NotificationMail** (digest queue): id, cdate, htmlBody, textBody, digest, subject, group, recipient, attachments; digest 1 = hourly, 2 = daily, 11 = coordinator hourly, 12 = coordinator daily (`camap-hx/src/db/NotificationMail.hx:7-39`); subject convention `SUBSCRIPTION(catalogId)` (`:36-38`).
- **Message**: stored group message (TS `Message` table): recipients (JSON emails), `recipientListId=list.type`, slateContent, attachments.
- **Templates**: HX Templo `.mtt` (`camap-hx/lang/fr/tpl/mail/`) rendered by `app.processTemplate`; TS Twing `.twig` (`camap-ts/packages/api-core/mails/src/*.twig`, built to `mails/dist`).
- **Notification flags**: user `HasEmailNotif4h/24h/Ouverture` (`camap-hx/src/db/User.hx:8-10`); group `AllowInformationNotifs`, `AllowAlertNotifs` (`camap-hx/src/db/Group.hx:21-22`).
- **Control key / quit link**: `quitGroupFromMessage` footer link with `sha1(KEY+groupId)` (see `users-auth.md`).
- **Bridge**: REST endpoints guarded by the `bridge` strategy (`CAMAP_KEY`).

## 3. Routes & endpoints

| side | route/operation | handler path:line | auth/rights | template/component | purpose |
|---|---|---|---|---|---|
| HX | `/messages` | `camap-hx/src/controller/Messages.hx:9-13` | `canAccessMessages` (user right `Messages` in current group, `camap-hx/src/db/User.hx:203-207`) else redirect `/` | `camap-hx/lang/fr/tpl/messages/default.mtt:3-11` -> neo module `messages` (groupId, whichUser) | shell page for the React module |
| HX | `/attention` | `camap-hx/src/controller/Attention.hx` | `canAccessAttention` | `attention/default.mtt` (content unread) | |
| HX | `/user/quitGroupFromMessage/:groupId/:key` | `camap-hx/src/controller/User.hx:312-349` (`:313-330` in the mail draft) | login; key `sha1(KEY+groupId)`; refuses if active orders | `camap-hx/lang/master/tpl/account/quit.mtt` | link built by TS (`camap-ts/packages/api-core/src/mails/mails.service.ts:347-352`) |
| HX | `/admin/emails` | `camap-hx/src/controller/admin/Admin.hx:64-71` | `@admin` | `camap-hx/lang/master/tpl/admin/emails.mtt` | list unsent mails via TS bridge, can reset `tries=0` |
| TS | `GET /bridge/mail/getUnsentMails` | `camap-ts/packages/api-core/src/mails/controllers/mail-bridge.controller.ts:5-13` (service `camap-ts/packages/api-core/src/mails/mails.service.ts:170-178`) | guard `bridge` | | returns unsent BufferedJsonMail (id, cdate, tries, title, htmlBody, rawStatus) |
| TS | `GET /mails/get/:templateName/:params` (`getMail`) | `camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:36-65` | class `GqlAuthGuard` (`:28`) + superadmin (`:42-44`) | | renders a twig preview: `JSON.parse(params)`, fills `text` (faker lorem) for `message.twig` and random `groupName` when absent (`:46-52`), adds theme when `THEME_ID !== 'default'` (`:54-57`), returns `mailsService.renderTwing(...)` |
| TS | `GET /mails/list` | `camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:67-86` | superadmin (`:69-71`) | | HTML list of `*.twig` in `api-core/mails/dist` as links to `${FRONT_URL}/mails/get/<file>/%7B%7D` |
| TS | `query getMessagesForGroup(groupId)` | `camap-ts/packages/api-core/src/messages/messages.resolver.ts:40-47` (service `camap-ts/packages/api-core/src/messages/messages.service.ts:34-42`) | Messages right | | last 20 messages of the group |
| TS | `query getUserMessagesForGroup(groupId)` | `camap-ts/packages/api-core/src/messages/messages.resolver.ts:49-56` | | | last 20 messages sent by current user in group |
| TS | `query message(id)` (`getMessage`) | `camap-ts/packages/api-core/src/messages/messages.resolver.ts:58-81` | class `GqlAuthGuard` (`:28`); `userIsAllowedToAccessMessages(currentUser, message.amapId)` (= `UserGroupsService.canManageMessages`, `camap-ts/packages/api-core/src/groups/services/user-groups.service.ts:206-218`) | | one message with parsed `recipients`; `message.amapId` read (`:65`) before the null check (`:67`) |
| TS | `query getLatestMessages` | `camap-ts/packages/api-core/src/messages/messages.resolver.ts:83-105` (service `camap-ts/packages/api-core/src/messages/messages.service.ts:64-73`) | no group-right check (only own messages, `:84-100`) | | last 20 messages by current user in any group |
| TS | `mutation createMessage(input)` | `camap-ts/packages/api-core/src/messages/messages.resolver.ts:135-201` | Messages right (`:206-218`) | | queue mail + store Message |
| TS | `query getEmailRecipientsByUserIds` | `camap-ts/packages/api-core/src/users/users.resolver.ts:99-119` | see `users-auth.md` | | recipients selection |
| TS | React front | `camap-ts/packages/front-core/src/modules/messages` (gql `messages.gql.ts`) | | | messaging UI; rich text uses Slate (`camap-ts/packages/front-core/src/modules/messages/components/MessageTextEditor.tsx`) |

## 4. Business rules

1. Mails are queued, never sent inline (`camap-hx/src/mail/BufferedJsonMailer.hx:24-50`, `camap-ts/packages/api-core/src/mails/mails.service.ts:135`).
2. HX write path: `App.sendMail(mail, ?group, ?sender)` sets sender = `group.contact.email` (or theme `senderEmail`) with group name, fires `SendEmail` event, then `getMailer().send` = `BufferedJsonMailer`, which only inserts a row (`camap-hx/src/App.hx:351-369`; sender `:362`). `App.quickMail(to, subject, html, ?group)` wraps with `mail/message.mtt` (`camap-hx/src/App.hx:371-379`). `defineFinalMailer` has no caller (definition `camap-hx/src/mail/BufferedJsonMailer.hx:20`), so `mailerType` is null on HX inserts. HX ctor sets `tries=0` (`camap-hx/src/db/BufferedJsonMail.hx:64-68`); `isSent()` `:70`.
3. TS write path: `createBufferedJsonMail(template, params, subject, recipients, sender?, replyToSender, attachments)` renders a Twing template from `mails/dist/`, inlines CSS, drops invalid recipients (returns null if none, `:117`), stores sender/recipients/headers (Reply-To `firstName<email>`) (`camap-ts/packages/api-core/src/mails/mails.service.ts:83-167,354-378`); skipped entirely when `NODE_ENV==='test'` (`:99`). It saves rows without `tries`, `mailerType` (`:135-163`) although columns are non-nullable (`camap-ts/packages/api-core/src/mails/models/buffered-json-mail.entity.ts:18-22`); DB defaults unverified.
4. Consumer (TS only): `sendEmailsFromBuffer` every minute selects up to 100 oldest rows with `sdate IS NULL AND tries < 30` under a pessimistic write lock (`camap-ts/packages/api-core/src/mails/mails.service.ts:186-195`); deletes rows without recipients; splits recipients in chunks of 99 (`:222-233`); sends each chunk via nodemailer with ALL recipients in `bcc`, `from = {name: sender.name, address: theme.email.senderEmail}` (`:256-273`; the stored sender address is ignored `:257-261`); on success deletes the row (`:319`); partial rejection: keeps the row with remaining recipients, tries+1; exception: tries+1, `rawStatus=error` (`:280-338`); finally deletes rows with `sdate` older than 10 days (`:340-341`). `sdate` is never set by either side (HX `finallySend` commented; TS deletes on success).
5. Transport: `MAILER_TRANSPORT=smtp` uses SMTP_HOST/PORT/SECURE/IGNORE_TLS/AUTH_USER/AUTH_PASS/TLS_SERVERNAME (default localhost:1025) (`camap-ts/packages/api-core/src/mails/mails.module.ts:27-50`); otherwise no transport is configured and `MailerService` throws (`camap-ts/packages/api-core/src/common/mailer/mailer.service.ts`). HX SMTP settings live in `Variable` keys `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass` read by `BufferedJsonMail` (`camap-hx/src/db/BufferedJsonMail.hx:82-85`), with no TS reader (`camap-ts/packages/api-core/src/envSchema.ts:25-28`).
6. Invalid email addresses (regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`) are dropped; a mail with no valid recipient is not created / is deleted (`camap-ts/packages/api-core/src/mails/mails.service.ts:56-60,109-118,216-220`).
7. Group message: sender name/email from input; Reply-To = sender; footer quit link `quitGroupFromMessage` with sha1 key; Message stored with recipients, `recipientListId=list.type`, slateContent, attachments; user needs Messages right (`camap-ts/packages/api-core/src/messages/messages.resolver.ts:152-200,206-218`). `createMessage` dereferences `mail.htmlBody`/`mail.cdate` (`:192,196,197`) although `createBufferedJsonMail` can return null/undefined.
8. Messages older than 4 months are deleted nightly (`camap-ts/packages/api-core/src/messages/messages.service.ts:78-84`; delete not awaited `:83`).
9. Digest pipeline (HX only): producers: subscription creation (user: digest HOURLY if CSA/default-order/min-total catalog, `camap-hx/src/service/SubscriptionService.hx:732`; coordinator: COORDINATOR_HOURLY if first distribution already past, `:754`), default automated orders (`camap-hx/src/controller/Cron.hx:267`). Consumer `sendEmailDigest` loads all rows of the digest type, keeps only the last row per (recipient, group, subject), deletes all rows, and sends one mail per recipient+group using `mail/digest.mtt` or `mail/digest-coordinator.mtt` (`camap-hx/src/controller/Cron.hx:405-451`, `:407-421`).
10. Transactional mails (password reset, invitations, deletion warnings, waiting list) are not preference-gated. Distribution reminders at 4h/24h only go to users with the matching flag, once per distribution/day via cache; zero-quantity orders excluded (`camap-hx/src/controller/Cron.hx:458-560`). Opening notification excludes constant-orders catalogs and requires `HasEmailNotifOuverture` (`camap-hx/src/controller/Cron.hx:633,662`). Vendor and contact recaps are gated by catalog notify options (`camap-hx/src/controller/Cron.hx:748-749,793`). Volunteer mails require `AllowInformationNotifs` / `AllowAlertNotifs` (see `crons-scheduled-jobs.md`).
11. Group settings: `volunteersMailDaysBeforeDutyPeriod` (default 4), `volunteersMailContent`, `vacantVolunteerRolesMailDaysBeforeDutyPeriod` (default 7), `alertMailContent` (`camap-hx/src/db/Group.hx:88-122`).
12. User default: new HX users get flag 24h (`camap-hx/src/db/User.hx:64`; remaining defaults unverified).
13. TS theme for mails: `VariableService.getTheme()` returns `DEFAULT_THEME(CAMAP_HOST)` cached in a static and never reads `Variable.whiteLabel` (`camap-ts/packages/api-core/src/tools/variable.service.ts:61-72`; used `camap-ts/packages/api-core/src/mails/mails.service.ts:65,102,240`, `camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:191,306`, `camap-ts/packages/api-core/src/users/users.service.ts:515`). HX theme is read from `Variable.whiteLabel` (`camap-hx/src/App.hx:145-150`); mail layouts use theme `email.brandedEmailLayoutFooter` (`camap-hx/src/App.hx:121-136`).

### Templates inventory
HX `camap-hx/lang/fr/tpl/mail/`: default, digest, digest-coordinator, digest_html (0 bytes; only in `lang/fr`), forgottenPassword, layout-camap, layout-group, message, newPasswordConfirmed, orderNotif, orderSummaryForMember, ordersByProduct, ordersForGroupContact, volunteerUnsuscribed, notifications/subscription-created-user, notifications/subscription-created-coordinator. Used in code: message, volunteerUnsuscribed, forgottenPassword, newPasswordConfirmed, digest(-coordinator), ordersByProduct, orderSummaryForMember, orderNotif, notifications/*, ordersForGroupContact. HX callers outside Cron: `camap-hx/src/controller/User.hx:171` (forgotten password), `:213` (new password confirmed), `camap-hx/src/service/VolunteerService.hx:160` (volunteer unsubscribed -> all members), `camap-hx/src/service/OrderService.hx:520` `sendOrdersByProductReport`, `:555` `sendOrderSummaryToMembers` (no callers found in `camap-hx/src`); `orderSummaryForMember.mtt` rendered at `OrderService.hx:542`. `layout-camap.mtt` and `layout-group.mtt` are the HTML shells.

TS `camap-ts/packages/api-core/mails/src/*.twig`: _base, _layout-camap, _layout-group, aMemberOfYourGroupDeletedHisAccount, accountCreatedByOther, addedToGroupByOther, anticheat, deletionWarning, existingVendorInvitation, invitationToCreateAccount, invitationToJoinGroup, message, newVendorInvitation, time-slots-resolution, validateDistributedDistribution, validateDistributedDistribution-reminder, vendorCertificationInProgress, vendorCertificationRefused, plus styles/utils. Used in `camap-ts/packages/api-core/src`: `message.twig` (`camap-ts/packages/api-core/src/messages/messages.resolver.ts:153`, `camap-ts/packages/api-core/src/groups/resolvers/waitingLists.resolver.ts:129,149,187,208`), `accountCreatedByOther` / `addedToGroupByOther` / `invitationToCreateAccount` / `invitationToJoinGroup` (`camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:205,244,318,354`), `deletionWarning` (`camap-ts/packages/api-core/src/users/users.service.ts:519-535`), `aMemberOfYourGroupDeletedHisAccount` (`camap-ts/packages/api-core/src/users/users.resolver.ts:234`). `anticheat`, `newVendorInvitation`, `existingVendorInvitation`, `time-slots-resolution`, `validateDistributedDistribution*`, `vendorCertification*` have no reference in `api-core/src` (use elsewhere unverified). Build: `camap-ts/packages/api-core/mails/scripts/build.ts` = clean + sass + copy twigs to `mails/dist` (loaded `camap-ts/packages/api-core/src/mails/mails.service.ts:51`).

## 5. Flows

1. Queue and send: producer (HX job or TS resolver) -> row in `BufferedJsonMail` -> TS minute cron selects <= 100 rows -> chunks of 99 BCC -> SMTP -> row deleted on success, retried up to 30 tries.
2. Group message: React `messages` module (shell from HX `/messages`) -> `createMessage` -> Twing `message.twig` rendered -> buffered mail + `Message` row -> flushed by the cron.
3. Digest: producer writes `NotificationMail` -> HX hourly/daily job `sendEmailDigest` -> one digest mail per recipient+group queued via `App.sendMail`.
4. Unsent monitoring: `/admin/emails` -> bridge `GET /bridge/mail/getUnsentMails` -> optional reset of `tries`.
5. Quit via message footer: mail footer link -> HX `/user/quitGroupFromMessage/:groupId/:key` -> React quit page.

## 6. Ownership hx vs ts

| concern | owner |
|---|---|
| Mail queue write | HX (legacy flows, jobs) and TS (messaging, invitations, waiting list, deletion warning) |
| Mail queue read/send | TS only |
| Digest queue (`NotificationMail`) | HX only |
| Group messaging (UI + API + `Message` table) | TS (HX hosts the shell page and right check) |
| Quit-group-from-message page | HX |
| Unsent mail admin screen | HX (data via TS bridge) |
| Message purge | TS |

## 7. Known security/rights observations

Pointers only, see inconsistencies-code.md: `message(id)` null-dereference ordering; `getLatestMessages` without group check; un-awaited deletes in purge jobs; TS sender address ignoring stored sender; `NotificationMail` entity mismatch; `/mails/get` and `/mails/list` superadmin-only. Doc divergences for `emails.md`, `messages.md`, `templates.md`: see inconsistencies-docs.md.
