# Digest emails (COM-DGT)

Actors: the system, member, coordinator.

- **COM-DGT-001** As a member who subscribed to a constant catalog or a variable catalog with default orders or a minimum, I receive my subscription notification grouped in an hourly digest. <!-- 03-features/messaging-mails.md R9; camap-hx/src/service/SubscriptionService.hx:732 -->

- **COM-DGT-002** As a catalog coordinator, I receive the notification of a new subscription in an hourly coordinator digest when the first distribution is already past. <!-- 03-features/messaging-mails.md R9; camap-hx/src/service/SubscriptionService.hx:754 -->

- **COM-DGT-003** As a member, I am notified by digest when a default order was placed for me automatically. <!-- 03-features/messaging-mails.md R9; camap-hx/src/controller/Cron.hx:267 -->

- **COM-DGT-004** As a recipient, a digest keeps only the last notification per group and subject, and I receive one email per group. <!-- 03-features/messaging-mails.md R9; camap-hx/src/controller/Cron.hx:405-451 -->

- **COM-DGT-005** As the system, I send hourly digests every hour and daily digests every day. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:281-286,346-351 -->
  - Coordinator digests use a different template.
