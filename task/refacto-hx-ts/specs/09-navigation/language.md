# Language (NAV-LNG)

Actors: user.

- **NAV-LNG-001** As a user, I read pages in French. <!-- 03-features/frontend-templates-i18n.md R18, R20; camap-hx/config.xml.dist:2-4; camap-ts/packages/front-core/src/lib/i18n.ts:16-17 -->
  - French is the only language shipped.

- **NAV-LNG-002** As a user, I read the whole interface in French. <!-- 03-features/frontend-templates-i18n.md R18, R20; camap-hx/js/App.hx:329; camap-ts/packages/front-core/src/lib/i18n.ts:16-17 -->
  - The TS screens take their text from the translation files; many Haxe pages have French text hard-coded in the code or the templates.
  - **DECISION (UND-118, 2026-11-02)** French only. This changes nothing in the current Haxe + TS system: exporting the hard-coded Haxe strings and dropping the language parameter happen when Haxe is ported to TS, see [TS-ONLY-STEP.md](../../TS-ONLY-STEP.md).

- **NAV-LNG-003** As a logged-in user, I cannot choose a language: there is no language selection. <!-- 03-features/users-auth.md R21; camap-hx/src/controller/Account.hx:46-51 -->
  - See ACC-PRO-006.
  - The account page shows no language choice, but it still accepts a hidden `?lang=` parameter that saves a language on my account. It has no visible effect because only French is shipped. Source: `camap-hx/src/controller/Account.hx:34-51`, `camap-hx/config.xml.dist:3-4`.
  - **DECISION (UND-118, 2026-11-02)** French only. This changes nothing in the current Haxe + TS system: exporting the hard-coded Haxe strings and dropping the language parameter happen when Haxe is ported to TS, see [TS-ONLY-STEP.md](../../TS-ONLY-STEP.md).

- **NAV-LNG-004** As a user, emails to me are in French. <!-- 03-features/crons-scheduled-jobs.md S4.1; camap-hx/src/controller/Cron.hx:458-622 -->
  - **DECISION (UND-118, 2026-11-02)** French only. This changes nothing in the current Haxe + TS system: exporting the hard-coded Haxe strings and dropping the language parameter happen when Haxe is ported to TS, see [TS-ONLY-STEP.md](../../TS-ONLY-STEP.md).

- **NAV-LNG-005** As a user, the rich-text editor of forms is in French. <!-- 03-features/frontend-templates-i18n.md S8; camap-hx/src/form/CamapForm.hx:23-41 -->
  - **DECISION (UND-118, 2026-11-02)** French only. This changes nothing in the current Haxe + TS system: exporting the hard-coded Haxe strings and dropping the language parameter happen when Haxe is ported to TS, see [TS-ONLY-STEP.md](../../TS-ONLY-STEP.md).
