# Automatic emails overview (COM-AUT)

Actors: the system, member. Details of each email are in the feature that triggers it; this file records the rules common to all.

- **COM-AUT-001** As a user, transactional emails reach me whatever my notification settings. <!-- 03-features/messaging-mails.md R10; camap-hx/src/controller/Cron.hx:458-560 -->
  - They include password reset, invitations, deletion warnings and waiting-list emails.

- **COM-AUT-002** As a member, I receive these automatic emails. <!-- 03-features/messaging-mails.md S2 Templates; camap-ts/packages/api-core/src/groups/resolvers/group-previews-members.resolver.ts:205,244,318,354 -->
  - Account created by a manager, with a link to set my password (GRP-IMP-002).
  - Added to a group by a manager (GRP-IMP-003).
  - Invitation to create an account or join a group (ACC-INV-001).
  - Waiting-list request accepted or refused (GRP-WAI-005, GRP-WAI-006).
  - Deletion warning before account purge (ACC-PUR-002).
  - A member of my group deleted their account, for group admins (ACC-DEL-006).
  - Password reset and password changed (ACC-PWD-002, ACC-PWD-008).
  - A volunteer left a role (DIS-VOL-007).
  - Subscription created (ORD-SUB-012).

- **COM-AUT-003** As a coordinator or a vendor, I receive no email asking me to validate a distribution that took place: no such flow exists and its templates are removed. <!-- 03-features/messaging-mails.md S4 Templates; camap-ts/packages/api-core/mails/src/validateDistributedDistribution.twig -->
  - The distribution validation and reminder templates are removed. The "validated" state they relate to is dead (see UND-057).
  - **ERRATUM** Today the templates exist but no code sends them; they are only listed by the preview controller. Source: `camap-ts/packages/api-core/mails/src/validateDistributedDistribution.twig`, `camap-ts/packages/api-core/src/mails/controllers/mails.controller.ts:19-20`.
  - **DECISION (UND-106, 2026-11-06)** Remove the templates with no sender (distribution validation and reminder, vendor invitations, vendor certification, anti-cheat, time-slot resolution) until their flows are specified. Fixed in camap-ts at the start of the migration ([TS-FIXES-FIRST.md](../../TS-FIXES-FIRST.md)).
- **COM-AUT-004** As a vendor, I receive no email about an invitation or a certification status: no such flow exists and its templates are removed. <!-- 03-features/messaging-mails.md S4 Templates; camap-ts/packages/api-core/mails/src/newVendorInvitation.twig -->
  - The new-vendor invitation, existing-vendor invitation, certification in progress and refused, anti-cheat and time-slot resolution templates are removed.
  - They can come back when the matching flows are specified (vendor onboarding plans).
  - **ERRATUM** Today these templates exist but no code sends them. Source: `camap-ts/packages/api-core/mails/src/newVendorInvitation.twig` and the other unused `.twig` files in `camap-ts/packages/api-core/mails/src/`.
  - **DECISION (UND-106, 2026-11-06)** Remove the templates with no sender (distribution validation and reminder, vendor invitations, vendor certification, anti-cheat, time-slot resolution) until their flows are specified. Fixed in camap-ts at the start of the migration ([TS-FIXES-FIRST.md](../../TS-FIXES-FIRST.md)).
- **COM-AUT-005** As the system, I put group admins' contact as the reply address of group emails I send for the group. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:458-622 -->
