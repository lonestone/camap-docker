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

- **COM-AUT-003** *Undecided (UND-106)*: As a coordinator or a vendor, I receive an email asking me to validate a distribution that took place, and reminders. <!-- 03-features/messaging-mails.md S4 Templates; camap-ts/packages/api-core/mails/src/validateDistributedDistribution.twig -->
  - The templates exist but no code sends them.
  - **SUGGESTION** Remove the unused templates (distribution validation and reminder, vendor invitations, vendor certification, anti-cheat, time-slot resolution) until their flows are specified. Based on: `camap-ts/packages/api-core/mails/src/validateDistributedDistribution.twig` (no sender in code; only listed in the preview controller `mails/controllers/mails.controller.ts:19-20`), `camap-hx/src/db/MultiDistrib.hx:260-280` (validated state never returned, see UND-057), no vendor invitation or certification code in `camap-hx/src` or `camap-ts/packages/api-core/src`. Confidence: medium. Needs product input on vendor onboarding plans.

- **COM-AUT-004** *Undecided (UND-106)*: As a vendor, I receive emails about my invitation and certification status. <!-- 03-features/messaging-mails.md S4 Templates; camap-ts/packages/api-core/mails/src/newVendorInvitation.twig -->
  - Templates exist for new-vendor invitation, existing-vendor invitation, certification in progress and refused, anti-cheat and time-slot resolution, but no code sends them.
  - **SUGGESTION** Remove the unused templates (distribution validation and reminder, vendor invitations, vendor certification, anti-cheat, time-slot resolution) until their flows are specified. Based on: `camap-ts/packages/api-core/mails/src/validateDistributedDistribution.twig` (no sender in code; only listed in the preview controller `mails/controllers/mails.controller.ts:19-20`), `camap-hx/src/db/MultiDistrib.hx:260-280` (validated state never returned, see UND-057), no vendor invitation or certification code in `camap-hx/src` or `camap-ts/packages/api-core/src`. Confidence: medium. Needs product input on vendor onboarding plans.

- **COM-AUT-005** As the system, I put group admins' contact as the reply address of group emails I send for the group. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:458-622 -->
