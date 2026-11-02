# 08 - Messaging, emails, notifications, crons, scripts (DRAFT)

NOTE: plan mode was active, so this draft is stored here instead of
task/refacto-hx-ts/docs/_drafts/08-messaging-crons.md. Copy it there.
All paths relative to camap-docker root. HX = camap-hx, TS = camap-ts.

## 1. Overview

- Every outgoing email is first written as a row in table `BufferedJsonMail` (queue). Writers: HX (`App.sendMail`) and TS (`MailsService.createBufferedJsonMail`). The ONLY consumer is TS: `MailsService.sendEmailsFromBuffer` (every minute). HX's own "really send" code is commented out (camap-hx/src/db/BufferedJsonMail.hx:77-123).
- Scheduled jobs are written in Haxe (`controller/Cron.hx`: minute/hour/daily) but are TRIGGERED by the TS app, which HTTP-GETs `${CAMAP_LOCAL_HOST}/cron/{minute,hour,daily}` when env `HX_TRIGGER_CRONS` is set (camap-ts/packages/api-core/src/tools/crontab.service.ts:15-60).
- TS has its own native crons: mail buffer flush, cache clean, user purge, message purge.
- Group mailing ("Messagerie") is fully TS (GraphQL + React); HX only serves a shell page embedding the React module (camap-hx/lang/fr/tpl/messages/default.mtt:3-11).
- Digest "notifications" (`NotificationMail` table) are written and consumed only by HX; TS has an entity but no reader/writer.

## 2. Cron job table

### 2a. HX jobs (camap-hx/src/controller/Cron.hx) - triggered via TS CrontabService (or manual `neko index.n cron/<x>`, Cron.hx:90)

`canRun()` always returns true (Cron.hx:36-38); auth code is commented out (Cron.hx:40-52). `?now=` param fakes the clock (Cron.hx:24).

| Trigger | Job (TransactionWrappedTask name) | What it does / side effects | Ref |
|---|---|---|---|
| /cron/minute | `MinutelyCron` event | Only fires `app.event(MinutelyCron(now, jobs, mode))`; with `json=1` prints jobs JSON and logs it to error table. No listener found in camap-hx/src (listeners elsewhere: unverified) | Cron.hx:58-86 |
| /cron/hour | Volunteers instruction mail | Multidistribs starting in [now-hour + g.volunteersMailDaysBeforeDutyPeriod days, +1h). Skips disabled groups and groups without flag `AllowInformationNotifs`. One mail to all volunteers (email + email2), body = `group.volunteersMailContent` with tokens [DATE_DISTRIBUTION] [LIEU_DISTRIBUTION] [LISTE_BENEVOLES], template `mail/message.mtt`; queued via App.sendMail | Cron.hx:97-154 |
| /cron/hour | Volunteers alerts | Same window using `vacantVolunteerRolesMailDaysBeforeDutyPeriod`; only multidistribs with vacant roles; needs flag `AllowAlertNotifs`; mail to ALL group members, body `group.alertMailContent` tokens [DATE_DISTRIBUTION] [LIEU_DISTRIBUTION] [ROLES_MISSING list]; subject hard-coded French | Cron.hx:156-210 |
| /cron/hour | Distrib notifications | `distribNotif` 4h (flag `HasEmailNotif4h`) and 24h (`HasEmailNotif24h`) before distribution: per user+group mail listing orders (skips zero-quantity totals, also notifies `user2` of alternated orders), template `mail/orderNotif.mtt`, user's language, Reply-To group contact. De-dup via Cache key `<date>+<flag>` 24h (skipped in DEBUG) | Cron.hx:213-218, 458-622 |
| /cron/hour | Opening orders notifications | Distributions whose `orderStartDate` is in the current hour, excluding constant-orders (CSA) catalogs; mail to every group member with flag `HasEmailNotifOuverture`; `mail/orderNotif.mtt` | Cron.hx:221-225, 624-714 |
| /cron/hour | Default automated orders for CSA variable contracts | For distributions whose `orderEndDate` fell in last hour and `Catalog.distribMinOrdersTotal > 0`: for each subscription active that day, not absent, with no order: creates orders from subscription default orders, queues a `NotificationMail` (digest HOURLY, subject `DEFAULT_ORDER(catalogId)`), then recomputes subscription total operation | Cron.hx:227-278 |
| /cron/hour | Email digest | `sendEmailDigest` for digests HOURLY(1) and COORDINATOR_HOURLY(11) | Cron.hx:281-286 |
| /cron/hour | Clean unused db.File | Picks a random 1000-id slice of `File`; deletes files not referenced by Product.image, EntityFile, Group.image, Vendor.image. Runs with `execute(false)` (no transaction wrap flag) | Cron.hx:289-320 |
| /cron/hour | `HourlyCron` event | Fired AFTER default automated orders ("orders notif in cpro"); listeners: none found in camap-hx/src (unverified) | Cron.hx:322-325 |
| /cron/hour | Send orders list to vendor on order closing | Distributions whose `orderEndDate` fell in last hour: (a) if `catalog.shouldNotifyVendorOnOrderEnd()` and vendor email set, mail `mail/ordersByProduct.mtt` to vendor incl. new subscriptions since last distrib; (b) per catalog contact, if `shouldNotifyContactOnOrderEnd()`, one mail `mail/ordersForGroupContact.mtt` | Cron.hx:330-334, 716-816 |
| /cron/daily | `DailyCron` event | Fired first; listeners none found in camap-hx/src (unverified) | Cron.hx:344 |
| /cron/daily | Email digest | digests DAILY(2) and COORDINATOR_DAILY(12) | Cron.hx:346-351 |
| /cron/daily | Send errors to admin | Yesterday's `sugoi.db.Error` rows mailed to `webmaster_email` config, `mail/message.mtt` | Cron.hx:353-376 |
| /cron/daily | Old datas cleaning | `sugoi.db.Session.clean()` | Cron.hx:378-383 |
| /cron/daily | Delete old documents | Catalogs ended 18 months (30-day months) ago in a 24h window: deletes their EntityFile type `document` and File | Cron.hx:385-402 |

Tasks wrapped with `task.execute(!App.config.DEBUG)` (arg semantic: unverified), except File clean and vendor orders list which pass `false` (Cron.hx:320, 334).

### 2b. TS jobs (@nestjs/schedule; `ScheduleModule.forRoot()` camap-ts/packages/api-core/src/app.module.ts:53)

| Schedule | Method | Behavior | Ref (under camap-ts/packages/api-core/src) |
|---|---|---|---|
| every minute | `CrontabService.minutely` | GET `${CAMAP_LOCAL_HOST}/cron/minute` if `HX_TRIGGER_CRONS` set | tools/crontab.service.ts:15-27 |
| every hour (minute 0) | `CrontabService.hourly` | GET `/cron/hour` | tools/crontab.service.ts:29-41 |
| daily 00:00 | `CrontabService.daily` | GET `/cron/daily` | tools/crontab.service.ts:43-55 |
| every minute | `MailsService.sendEmailsFromBuffer` | flush queue (see section 3) | mails/mails.service.ts:184-342 |
| daily 00:00 | `MessagesService.cleanOldMessages` | deletes `Message` rows older than 4 months (not awaited) | messages/messages.service.ts:78-84 |
| daily 01:00 | `CacheService.cleanCache` | deletes expired Cache rows (not awaited) | tools/cache.service.ts:55-59 |
| daily 01:00 | `UsersService.cleanUsers` | 3 warning mails (`deletionWarning.twig`) at 1 month, 2 weeks, 3 days before 2-year inactivity deletion; skips users with active membership; then deletes users with ldate < 2y (or never logged in and created >6 months ago) having no active membership and no orders <2y, reassigning to `deleted@camap.tld` | users/users.service.ts:439-600 |

Note: `multi-distribs.service.ts:2` imports Cron but no `@Cron` is used there (grep of @Cron shows 7 usages only).

## 3. Email pipeline

1. Write (queue). Table `BufferedJsonMail`: title, htmlBody, textBody, headers/sender/recipients/attachments as JSON text, mailerType, tries, cdate, sdate, rawStatus (camap-hx/src/db/BufferedJsonMail.hx:12-28; TS mirror camap-ts/packages/api-core/src/mails/models/buffered-json-mail.entity.ts).
   - HX: `App.sendMail(mail, ?group, ?sender)` sets sender = group.contact.email (or theme senderEmail) with group name, fires `SendEmail` event, then `getMailer().send` = `mail.BufferedJsonMailer` which only inserts a row (camap-hx/src/App.hx:351-369; camap-hx/src/mail/BufferedJsonMailer.hx:24-50). `App.quickMail` wraps with `mail/message.mtt` (App.hx:371-379). Templates: Templo `.mtt` rendered by `app.processTemplate`.
   - TS: `createBufferedJsonMail(template, params, subject, recipients, sender?, replyToSender, attachments)` renders Twing template from `mails/dist/`, inlines CSS, drops invalid recipients (returns null if none), stores sender/recipients/headers (Reply-To `firstName<email>`) (mails/mails.service.ts:83-167, 354-378). Skipped entirely when `NODE_ENV==='test'` (line 99).
2. Consume (TS only). `sendEmailsFromBuffer` every minute: selects up to 100 oldest rows with `sdate IS NULL AND tries < 30`, pessimistic write lock (mails.service.ts:186-195); deletes rows without recipients; splits recipients in chunks of 99 (:222-233); sends each chunk via nodemailer with ALL recipients in `bcc`, `from = {name: sender.name, address: theme.email.senderEmail}` (:256-273); on success deletes the row; partial rejection: keeps row with remaining recipients, tries+1; exception: tries+1, rawStatus=error (:280-338); finally deletes rows with `sdate` older than 10 days (:340-341).
3. Transport: `MAILER_TRANSPORT=smtp` uses SMTP_HOST/PORT/SECURE/IGNORE_TLS/AUTH_USER/AUTH_PASS/TLS_SERVERNAME (default localhost:1025) (mails/mails.module.ts:27-50); otherwise no transport configured in options (MailerService throws if none, common/mailer/mailer.service.ts:~40).
4. Monitoring: HX admin page `/admin/emails` calls TS bridge `GET /bridge/mail/getUnsentMails`, can reset `tries=0` (camap-hx/src/controller/admin/Admin.hx:64-71; camap-ts/.../mails/controllers/mail-bridge.controller.ts:5-13).

### Digest notifications (HX only)
- `NotificationMail`(id, cdate, htmlBody, textBody, digest, subject, group, recipient, attachments) with digest 1 hourly, 2 daily, 11 coordinator hourly, 12 coordinator daily (camap-hx/src/db/NotificationMail.hx:7-39).
- Producers: subscription creation (user: digest HOURLY if CSA/default-order/min-total catalog, SubscriptionService.hx:732; coordinator: COORDINATOR_HOURLY if first distrib already past, :754), default automated orders (Cron.hx:267). Subject = `SUBSCRIPTION(catalogId)` (NotificationMail.hx:36-38).
- Consumer: `sendEmailDigest`: loads all rows of the digest type, keeps only the LAST row per (recipient, group, subject), DELETES all rows, sends one mail per recipient+group using `mail/digest.mtt` or `mail/digest-coordinator.mtt` (Cron.hx:405-451).

### Templates
HX (camap-hx/lang/fr/tpl/mail/): default, digest, digest-coordinator, digest_html (0 bytes), forgottenPassword, layout-camap, layout-group, message, newPasswordConfirmed, orderNotif, orderSummaryForMember, ordersByProduct, ordersForGroupContact, volunteerUnsuscribed, notifications/subscription-created-user, notifications/subscription-created-coordinator. Used in code: message, volunteerUnsuscribed, forgottenPassword, newPasswordConfirmed, digest(-coordinator), ordersByProduct, orderSummaryForMember, orderNotif, notifications/*, ordersForGroupContact (grep of `mail/*.mtt` in camap-hx/src).
HX callers outside Cron: User.hx:171 (forgotten password), User.hx:213 (new password confirmed), VolunteerService.hx:160 (volunteer unsubscribed -> all members), OrderService.hx:520 `sendOrdersByProductReport`, OrderService.hx:555 `sendOrderSummaryToMembers` (callers of these two: none found in camap-hx/src, unverified elsewhere).

TS (camap-ts/packages/api-core/mails/src/*.twig): _base, _layout-camap, _layout-group, aMemberOfYourGroupDeletedHisAccount, accountCreatedByOther, addedToGroupByOther, anticheat, deletionWarning, existingVendorInvitation, invitationToCreateAccount, invitationToJoinGroup, message, newVendorInvitation, time-slots-resolution, validateDistributedDistribution, validateDistributedDistribution-reminder, vendorCertificationInProgress, vendorCertificationRefused, plus styles/utils. Used in api-core/src: message.twig (messages.resolver.ts:153, waitingLists.resolver.ts:129,149,187,208), accountCreatedByOther / addedToGroupByOther / invitationToCreateAccount / invitationToJoinGroup (groups/resolvers/group-previews-members.resolver.ts:205,244,318,354), deletionWarning (users.service.ts:519-535), aMemberOfYourGroupDeletedHisAccount (users.resolver.ts:234). Others (anticheat, newVendorInvitation, existingVendorInvitation, time-slots-resolution, validateDistributedDistribution*, vendorCertification*) have no `.twig'` reference in api-core/src (may be used from elsewhere, unverified).
Build: `mails/scripts/build.ts` = clean + sass + copy twigs to `mails/dist` (loaded at mails.service.ts:51).

## 4. Notification types and user preferences

- User flags (HX): `HasEmailNotif4h`, `HasEmailNotif24h`, `HasEmailNotifOuverture` (camap-hx/src/db/User.hx:8-10); default new user sets 24h (User.hx:64, remaining defaults unverified).
- Group flags: `AllowInformationNotifs` (volunteer info mail), `AllowAlertNotifs` (vacant roles alert) (camap-hx/src/db/Group.hx:21-22). Group settings: `volunteersMailDaysBeforeDutyPeriod` (default 4), `volunteersMailContent`, `vacantVolunteerRolesMailDaysBeforeDutyPeriod` (default 7), `alertMailContent` (Group.hx:88-122).
- Catalog options: `shouldNotifyVendorOnOrderEnd`, `shouldNotifyContactOnOrderEnd` (Cron.hx:749, 793).
- Digest types in 3 above.
- Transactional mails (password, invitations, deletion warnings, waiting list) are not preference-gated.

## 5. Routes / endpoints

| Route | Type | Owner | Behavior | Ref |
|---|---|---|---|---|
| GET /cron/minute, /cron/hour, /cron/daily | HTTP (no auth) | HX | run jobs of section 2a; `?now=`, `?json=1` | Cron.hx:20-29,58,92,340 |
| /messages | HX page | HX shell + React | requires `canAccessMessages` (user right `Messages` in current group) else redirect "/"; mounts neo module "messages" with groupId, whichUser | camap-hx/src/controller/Messages.hx:9-13; db/User.hx:203-207 |
| /attention | HX page | HX | requires `canAccessAttention`; template attention/default.mtt (content unread) | camap-hx/src/controller/Attention.hx |
| /user/quitGroupFromMessage/:groupId/:key | HX page | HX (link built by TS) | requires login, key = sha1(KEY+groupId); refuses if active orders | camap-hx/src/controller/User.hx:313-330; camap-ts/.../mails.service.ts:347-352 |
| /admin/emails | HX admin | HX -> TS bridge | list unsent mails, reset tries | Admin.hx:64-71 |
| GET /bridge/mail/getUnsentMails | REST, guard `bridge` | TS | returns unsent BufferedJsonMail (id,cdate,tries,title,htmlBody,rawStatus) | mails/controllers/mail-bridge.controller.ts; mails.service.ts:170-178 |
| GET /mails/get/:templateName/:params | REST, GqlAuthGuard + superadmin | TS | renders twig preview with JSON params (faker defaults) | mails/controllers/mails.controller.ts:36-65 |
| GET /mails/list | REST, superadmin | TS | HTML list of twig templates | mails.controller.ts:67-86 |
| GraphQL Query getMessagesForGroup(groupId) | GQL | TS | last 20 messages of group; requires Messages right | messages/messages.resolver.ts:40-47; messages.service.ts:34-42 |
| Query getUserMessagesForGroup(groupId) | GQL | TS | last 20 messages sent by current user in group | resolver:49-56 |
| Query message(id) | GQL | TS | one message with parsed recipients | resolver:58-81 |
| Query getLatestMessages | GQL | TS | last 20 messages by current user in any group (no right check) | resolver:83-105; service:64-73 |
| Mutation createMessage(input) | GQL | TS | queue mail + store Message | resolver:135-201 |
| Front | React | TS | camap-ts/packages/front-core/src/modules/messages (gql in messages.gql.ts) | |

## 6. Business rules

1. Mails are queued, never sent inline (HX BufferedJsonMailer.hx:24-50; TS mails.service.ts:135).
2. Queue is flushed every minute, max 100 mails per run, retried until tries >= 30 (mails.service.ts:189).
3. Recipients are BCC'd in chunks of 99 (mails.service.ts:222-233, 266).
4. Successful mail rows are deleted, not marked sent (mails.service.ts:319); `sdate` purge after 10 days (:340).
5. Invalid email addresses (regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`) are dropped; mail with no valid recipient is not created/deleted (mails.service.ts:56-60,109-118,216-220).
6. Group message: sender name/email from input; Reply-To set to sender; footer quit link `quitGroupFromMessage` with sha1 key; Message stored with recipients emails (JSON), `recipientListId=list.type`, slateContent, attachments; user needs Messages right in group (messages.resolver.ts:152-200, 206-218).
7. Messages older than 4 months are deleted nightly (messages.service.ts:81).
8. Volunteer reminder: N days before duty (group setting), needs `AllowInformationNotifs`, not for disabled groups (Cron.hx:96-154).
9. Vacant-role alert needs `AllowAlertNotifs`; sent to whole group (Cron.hx:156-210).
10. Distribution reminders at 4h/24h only to users with matching flag; once per distribution/day via cache; zero-quantity orders excluded (Cron.hx:458-560).
11. Opening notification excludes constant-orders catalogs, requires `HasEmailNotifOuverture` (Cron.hx:633, 662).
12. Digest keeps only the latest notification per subject per recipient/group (Cron.hx:407-421).
13. CSA variable contracts with `distribMinOrdersTotal>0`: default orders auto-created when none and not absent; user is notified via digest (Cron.hx:227-278).
14. Vendor and contact order recaps sent on order closing, gated by catalog notify options (Cron.hx:748-749, 793).
15. User purge: warnings at -1 month/-2 weeks/-3 days; deletion after 2 years inactivity unless membership/recent orders (users.service.ts:439-600).
16. Documents of catalogs ended 18 months ago are deleted (Cron.hx:385-402).

## 7. CLI / maintenance scripts

- HX `controller/Scripts.hx` (CLI only: throws "CLI only" under mod_neko, Scripts.hx:14-16; run `neko index.n /scripts/<action>` Scripts.hx:4-5): `recomputeBasketTotal(from,to)` (Scripts.hx:32-50: recomputes Basket.total for all groups in range) and `cleannonamapdata(groupMinId,userMinId,vendorMinId)` (Scripts.hx:55-83: deletes ShopMode groups with id > min, users without UserGroup, vendors without catalogs).
- HX manual cron: `neko index.n cron/hour > cron.log` (Cron.hx:90).
- TS (camap-ts/packages/api-core/package.json:19-20): `dataset` -> dist/cli/dataset, `dataset-server` -> dist/cli/dataset-server; `src/cli/sync-db.ts` runs TypeORM `synchronize:true`; `src/cli/index.ts` is a commander skeleton with all commands commented out (cli/index.ts:7-18). Dataset/other CLI detail: out of this area (unread beyond index/sync-db).

## 8. HX <-> TS ownership

| Concern | Owner |
|---|---|
| Cron schedule/trigger | TS (CrontabService) |
| Cron job logic (reminders, digests, recaps, auto orders, cleanup) | HX |
| Mail queue write | HX (legacy flows, jobs) + TS (messaging, invitations, waiting list, deletion warning) |
| Mail queue read/send | TS only |
| Digest queue (NotificationMail) | HX only |
| Group messaging (UI + API + Message table) | TS (HX only hosts the shell page/right check) |
| Quit-group-from-message page | HX |
| Unsent mail admin screen | HX (data via TS bridge) |
| Cache/user/message purge | TS |
| Maintenance scripts | HX (Scripts.hx) |

Removing camap-hx requires porting: all rows of 2a, NotificationMail digest, Mail templates used by them, quitGroupFromMessage, /admin/emails, Scripts.hx.

## 9. Documentation inconsistencies

1. [CONFIRMED] camap-ts/docs/emails.md:11 names the table `BufferedJsonEmail`; code table is `BufferedJsonMail` (camap-hx/src/db/BufferedJsonMail.hx:10, TS entity `@Entity('BufferedJsonMail')`).
2. [CONFIRMED] docs/crons.md:15-17 shows daily at `15 0 * * *`; TS daily trigger is `EVERY_DAY_AT_MIDNIGHT` (00:00) (crontab.service.ts:43). The old crontab comment repeats 15 0 (crontab.service.ts:11).
3. [CONFIRMED] docs/crons.md "En Ts" says Node handles crons directly; in reality HX cron logic still runs in HX, triggered by TS HTTP GET (crontab.service.ts:15-60), and is inert unless `HX_TRIGGER_CRONS` set. Doc also lists only `sendEmailsFromBuffer`, omitting cleanOldMessages, cleanCache, cleanUsers.
4. [CONFIRMED] docs/crons.md lists hx crontab path `/var/vhosts/camap/www/` vs comment `/var/vhosts/appcamap/app.camap.net/www/` (crontab.service.ts:9) - cosmetic.
5. [CONFIRMED] docs/emails.md describes a cron that "vide la pile" via HX/SMTP in general; HX no longer sends (BufferedJsonMail.hx:77-123 commented). Does not mention NotificationMail digests, 99-recipient BCC chunking, or retry limit 30.
6. [CONFIRMED] docs/messages.md says nothing about 4-month purge (messages.service.ts:81) nor Reply-To/quit link; says Messages back is `messages.module.ts` - correct.
7. [CONFIRMED] docs/templates.md covers only Templo; Twing (TS) templates and `mails/dist` build not described; no doc for `/mails/list` preview.
8. [CONFIRMED] docs/tests/mail/330-2-multiples-coller.md is empty (0 lines).
9. [CONFIRMED: App.hx:371 quickMail(to,subject,html,?group); View.hx:186 hDate(date) match the doc examples] docs/emails.md example `app.view.hDate` / `App.quickMail` signature not re-verified.

## 10. Code inconsistencies

1. [CONFIRMED: no /cron restriction in camap-hx/apache.conf, apache/camap-static.conf or traefik config either; reachable only if exposed on the network] Cron.hx:36-38 `canRun()` always true; /cron/* GET endpoints unauthenticated (auth commented, :40-52).
2. [CONFIRMED] Cron.hx:308-313 comments swapped: `Group.image` labelled "vendor logo", `Vendor.image` labelled "group logo" (harmless).
3. [CONFIRMED] Cron.hx:353-376 daily error report uses `Date.now()` not `this.now` (fake-now ignored); comment variable names `yest24h/yest0h` ok.
4. [CONFIRMED] Cron.hx:197 vacant-role subject hard-coded French while sibling uses `t._` (:138); Cron.hx:200 date string hard-coded French.
5. [CONFIRMED: Cron.hx:281 and :346] Cron.hx:346 and :281 both name tasks "Email digest" (hourly vs daily) - logging ambiguity only.
6. [CONFIRMED] Cron.hx:464-466 comment mentions HasEmailNotifOuverture/orderStartDate in `distribNotif` which does not handle it (dead comment).
7. [CONFIRMED] Cron.hx:716-724 SQL (`sendOrdersLists`) joins with `AND` instead of `WHERE`, no `distribMinOrdersTotal` filter, unlike :231-236 (works but different style; not a bug by itself).
8. [PLAUSIBLE: DateTool.setHourMinute (DateTool.hx:45) does new Date(y,m,d,24,0,0); normalization of hour 24 is runtime Neko/Haxe behaviour] Cron.hx:98-107 and :156-165 hourly window uses `now.setHourMinute(h+1)`; at 23h `getHours()+1` = 24 behavior depends on DateTool (unverified).
9. [PLAUSIBLE: mails.service.ts:135-163 omits tries/mailerType and entity columns are non-null (entity.ts:18-22) so DB defaults/strict mode decide; HX ctor sets tries=0 (BufferedJsonMail.hx:64-68) and defineFinalMailer has no caller in camap-hx/src, confirmed] TS saves buffer rows without `tries`, `mailerType`, `cdate`-only (mails.service.ts:135-163) though columns are non-nullable (buffered-json-mail.entity.ts: `tries int`, `mailerType varchar(32)`): relies on DB defaults - unverified. HX never calls `defineFinalMailer` (grep: only definition BufferedJsonMailer.hx:20), so mailerType null on HX inserts too.
10. [CONFIRMED: grep sdate in api-core/src finds only reads/filters (mails.service.ts:173,189,341); HX sets it only in commented finallySend (BufferedJsonMail.hx:77-123)] `sdate` is never set by either side (HX finallySend commented; TS deletes on success), so `delete sdate < 10 days` (mails.service.ts:340-341) and `isSent()` (BufferedJsonMail.hx:70) are effectively dead.
11. [CONFIRMED: mails.service.ts:257-261 (address at :260); App.hx:362] TS sender: `from.address` is always theme senderEmail, ignoring stored sender email (mails.service.ts:257-261), while HX writes group.contact.email as sender (App.hx:362); reply-to only via headers.
12. [CONFIRMED: only migration 1773912252829-EmailDigests.ts references it; entity has Promise props with JoinColumn only, no ManyToOne] HX `NotificationMail` has a TS entity (notification-mail.entity.ts) with no reader/writer in TS; entity lacks `@ManyToOne` on group/recipient (only JoinColumn) and makes htmlBody/textBody nullable vs HX non-null.
13. [CONFIRMED: actual lines are messages.resolver.ts:63-67 (deref :65, null check :67); fixed line numbers] (verifier-corrected) messages.resolver.ts:65-67 reads `message.amapId` for permission check BEFORE null check (NPE if message missing instead of NotFound).
14. [CONFIRMED: actual lines messages.resolver.ts:192,196,197 (not :198); createBufferedJsonMail returns null at mails.service.ts:117 and undefined at :99] messages.resolver.ts:192,198 `mail.htmlBody`/`mail.cdate` and `list.type` dereference: `createBufferedJsonMail` can return null/undefined (no valid recipients: mails.service.ts:117; test env: :99) -> createMessage throws TypeError.
15. [CONFIRMED: messages.service.ts:83 (deleteMessageOlderThanDate is async, returns promise, not awaited); cache.service.ts:58] messages.service.ts:83 and cache.service.ts:58 launch deletes without `await` inside `@Transactional` jobs (transaction may complete before delete).
16. [CONFIRMED: messages.resolver.ts:84-100 uses only getUserMessages(currentUser.id)] `getLatestMessages` (resolver:83) has no group-right check (only own messages).
17. [CONFIRMED: both at midnight (crontab.service.ts:43, messages.service.ts:79); HX-side lock absence not checked] crontab.service.ts: `daily` at 00:00 coincides with `cleanOldMessages` 00:00; HX hour job + TS minute flush concurrency: no explicit lock on HX side (unverified).
18. [CONFIRMED: Scripts.hx:55-60; guard is constructor throw if isModNeko (Scripts.hx:12-14)] Scripts.hx:55-60 `doCleannonamapdata` deletes groups with `ShopMode` flag - destructive, no confirmation; `canRun` style guard only mod_neko check (Scripts.hx:14).
19. [CONFIRMED] cli/index.ts: empty commander skeleton (no commands registered).
20. [CONFIRMED in camap-hx/src, common (only Common.hx:296-298 enum + Cron.hx emitters); PLAUSIBLE for plugins/sugoi libs not checked] MinutelyCron/HourlyCron/DailyCron events have no visible listeners in camap-hx/src (Cron.hx:65,325,344), unverified in plugins.


## Verification summary

Confirmed: 27; Refuted: 0; Plausible: 2. Security note: no Apache/Traefik/middleware restriction on /cron/* found in repo configs; canRun() always true.
