# Group messages (COM-MSG)

Actors: messages manager.

- **COM-MSG-001** As a messages manager, I can open the group messages page. <!-- 03-features/messaging-mails.md S3; camap-hx/src/controller/Messages.hx:9-13 -->
  - Members without the messages right are sent to the home page.

- **COM-MSG-002** As a messages manager, I can write a rich-text message and send it by email to members of my group. <!-- 03-features/messaging-mails.md R7, F2; camap-ts/packages/api-core/src/messages/messages.resolver.ts:135-201 -->
  - I choose the sender name and email.
  - Replies go to the sender.
  - I can attach files.

- **COM-MSG-003** As a messages manager, I choose recipients from lists of members. <!-- 03-features/messaging-mails.md S3; camap-ts/packages/api-core/src/users/users.resolver.ts:99-119 -->
  - The list I chose is saved with the message.
  - Only a user with the messages right on the group gets the names and emails of its members.
  - **ERRATUM** Today the right check is not awaited, so any logged-in user gets the names and emails of the members of any group. Source: `camap-ts/packages/api-core/src/users/users.resolver.ts:105`.
  - **DECISION (UND-121, 2026-11-06)** The recipient lookup requires the messages right on the group; fixed in camap-ts at the start of the migration ([TS-FIXES-FIRST.md](../../TS-FIXES-FIRST.md)).

- **COM-MSG-004** As a recipient, each message email has a link to quit the group. <!-- 03-features/messaging-mails.md R7, F5; camap-ts/packages/api-core/src/mails/mails.service.ts:347-352 -->
  - I must log in to use it.
  - It is refused when I have active orders.

- **COM-MSG-005** As a messages manager, I can see the last 20 messages of my group. <!-- 03-features/messaging-mails.md S3; camap-ts/packages/api-core/src/messages/messages.service.ts:34-42 -->

- **COM-MSG-006** As a messages manager, I can see the last 20 messages I sent in a group. <!-- 03-features/messaging-mails.md S3; camap-ts/packages/api-core/src/messages/messages.resolver.ts:49-56 -->

- **COM-MSG-007** As a messages manager, I can open one message of my group with its recipients. <!-- 03-features/messaging-mails.md S3; camap-ts/packages/api-core/src/messages/messages.resolver.ts:58-81 -->
  - A message of a group where I have no messages right is refused.
  - An unknown message gives a clear "not found" answer.
  - **ERRATUM** Today the group of the message is read before checking that the message exists. Source: `camap-ts/packages/api-core/src/messages/messages.resolver.ts:63-67` (CODE-057).
  - **DECISION (UND-098, 2026-11-02)** Check that the message exists before reading its group, require the messages right on that group, and list latest messages only for groups where I still have that right.

- **COM-MSG-008** As a messages manager, I see the latest messages I sent, only for groups where I still have the messages right. <!-- 03-features/messaging-mails.md S3, S7; camap-ts/packages/api-core/src/messages/messages.resolver.ts:83-105 -->
  - Messages of groups where I lost the messages right are left out.
  - **ERRATUM** Today the list has no group-right check; it only filters on the author. Source: `camap-ts/packages/api-core/src/messages/messages.resolver.ts:83-105` (CODE-034).
  - **DECISION (UND-098, 2026-11-02)** Check that the message exists before reading its group, require the messages right on that group, and list latest messages only for groups where I still have that right.

- **COM-MSG-009** As the system, I delete messages older than 4 months every night. <!-- 03-features/messaging-mails.md R8; camap-ts/packages/api-core/src/messages/messages.service.ts:78-84 -->
  - **ERRATUM** The delete is not awaited, so it may not complete within the job. Source: `camap-ts/packages/api-core/src/messages/messages.service.ts:83` (CODE-059).

- **COM-MSG-010** As a messages manager, I cannot send a message without the messages right. <!-- 03-features/messaging-mails.md S3; camap-ts/packages/api-core/src/messages/messages.resolver.ts:206-218 -->
  - Nothing is stored and no email is queued.
  - **ERRATUM** Today `createMessage` only requires a login, so any logged-in user can send a message to the members of any group. Source: `camap-ts/packages/api-core/src/messages/messages.resolver.ts:135-218`.
  - **DECISION (UND-120, 2026-11-06)** Sending a message requires the messages right on the group; fixed in camap-ts at the start of the migration ([TS-FIXES-FIRST.md](../../TS-FIXES-FIRST.md)).

- **COM-MSG-011** As a messages manager, I see an error when none of the recipients of my message is valid. <!-- 03-features/messaging-mails.md R7; camap-ts/packages/api-core/src/messages/messages.resolver.ts:192-197 -->
  - No message is stored and no email is queued.
  - **ERRATUM** Today the code reads the queued email as if it always exists, so it fails when none was created. Source: `camap-ts/packages/api-core/src/messages/messages.resolver.ts:192-197` (CODE-058).
  - **DECISION (UND-099, 2026-11-02)** Return an error to the sender and store no message when no recipient is valid.
