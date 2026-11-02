# Theme and page layout (NAV-THM)

Actors: visitor, user.

- **NAV-THM-001** As a user, pages show the platform name, logo and support contact of the current theme. <!-- 03-features/frontend-templates-i18n.md R4, R22-R23; camap-hx/lang/master/tpl/base.mtt:98-115 -->

- **NAV-THM-002** As a user, the interactive screens follow the platform theme for its name, sender, footer and terms; their colors stay on the built-in palette. <!-- 03-features/frontend-templates-i18n.md R24; camap-ts/packages/front-core/src/neo.tsx:12 -->
  - The theme is the same JSON the superadmin theme form saves.
  - Colors are set at build time; the theme has no color field.
  - **DECISION (UND-101, 2026-11-02)** TS reads the stored white-label theme (default theme as fallback, cache cleared on save); colors stay on the built-in palette.

- **NAV-THM-003** As a user, the terms-of-service, terms-of-sale and privacy links come from the theme. <!-- 03-features/frontend-templates-i18n.md R22; camap-hx/common/Common.hx:317-337 -->

- **NAV-THM-004** As a user, buttons protect me from submitting a form twice by accident. <!-- 03-features/frontend-templates-i18n.md R4; camap-hx/lang/master/tpl/base.mtt:98-115 -->

- **NAV-THM-005** As a user, date fields offer a date picker. <!-- 03-features/frontend-templates-i18n.md S8; camap-hx/src/form/CamapDatePicker.hx:27-46 -->
  - An empty date starts at the current date and time.
  - The picked value is in my browser's local time.
  - Birth date pickers open on the year.

- **NAV-THM-006** As a coordinator, long text fields offer a rich-text editor. <!-- 03-features/frontend-templates-i18n.md S8; camap-hx/src/form/CamapForm.hx:23-41 -->

- **NAV-THM-007** *Undecided (UND-119)*: As a user, pages open even when the service providing the interactive widgets is temporarily unavailable. <!-- 03-features/frontend-templates-i18n.md R5; camap-hx/src/service/BridgeService.hx:44-72; camap-hx/lang/master/tpl/base.mtt:118 -->
  - Currently every page fails to render when the widget list cannot be loaded.
  - **SUGGESTION** Degrade gracefully. Cache the last good bundle list on every success, not 1 time in 10. When no list is available, render the page without widgets and show a notice. Based on: `camap-hx/src/service/BridgeService.hx:62-72` (cache written 1 in 10, then a hard throw), `camap-hx/lang/master/tpl/base.mtt:118` (scripts at the page end, safe to omit). Confidence: medium.

- **NAV-THM-008** As a user, interactive screens are embedded inside the pages of the site. <!-- 03-features/frontend-templates-i18n.md S1; camap-ts/packages/front-core/src/neo.tsx:149-195 -->
  - Pages like the members list, vendor dashboard and vendor profile have their own address handling inside the page.

- **NAV-THM-009** As a user, the platform has no screen outside these pages. <!-- 03-features/frontend-templates-i18n.md R14; camap-ts/packages/api-core/src/main.ts:60-83 -->
