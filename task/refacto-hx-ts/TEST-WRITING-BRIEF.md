# Brief for the agent writing one characterisation spec file

You write the characterisation tests for **one spec markdown file** of
`task/refacto-hx-ts/specs/<domain>/<file>.md`, in `tests/` (repo root:
`/Users/renaud/Lonestone/CAMAP/camap-docker`). The tests pin down how camap-hx
behaves **today**, so the same suite can run later against camap-ts.

## Read first
1. `tests/README.md` (conventions, fixtures, deviations, fake clock).
2. Your spec file. Each statement `- **XXX-YYY-NNN** ...` has an hx source
   comment (`<!-- camap-hx/src/... -->`) and maybe `Undecided (UND-n)` or a
   `**DECISION (UND-n, ...)**` line.
3. Two or three existing specs as patterns, chosen by layer, in
   `tests/specs/` (e.g. `05-orders/subscription-admin.forms.spec.ts` for hx
   form posts, `01-accounts/auth.graphql.spec.ts` for GraphQL,
   `04-distributions/volunteers.forms.spec.ts`, `06-payments/*.spec.ts`).
4. `tests/src/targets/types.ts` and `tests/src/targets/hx/api.ts` (the driver:
   what actions/views already exist; reuse and extend before adding),
   `tests/src/factories/*`, `tests/src/deviations.ts`.

## What to do
- Classify each statement: **A** cron/mail, **B** HTTP (JSON api, hx form POST/GET,
  GraphQL), **C** DB rule observable after A/B, **D** browser-only (page text,
  JS widgets, upload UI, PDF rendering). Write tests for A, B, C. Skip D
  and do not tag them.
- File name: `tests/specs/<NN-domain>/<topic>.<layer>.spec.ts` (layer: api, forms,
  views, graphql, cron). Tag every test with the statement IDs it checks:
  `{ tag: ['@CAT-XXX-001'] }`.
- Specs must know nothing about hx: no URLs, selectors or hx JSON in `specs/`.
  Add typed members to `src/targets/types.ts` and implement them in
  `src/targets/hx/api.ts` (+ `index.ts` wiring). Reuse existing helpers
  (`action`, `sugoiForm`, `urlForm`, `view`, `gql`, `csv`, `timeframe`).
  Extend factories only when needed.
- **Assert the decided behaviour, not the bug**: for `DECISION (UND-n)` or a
  known CODE fix not implemented in hx, call `deviation('UND-n')` and add the
  entry to `src/deviations.ts`. For `Undecided` or no decision: characterise
  what hx does today and comment the UND id.
- If hx behaviour differs from the spec statement, assert hx's actual behaviour,
  keep the test green, and report it as a finding.
- Read the hx source (`camap-hx/src/...`) to get field names, rights and
  redirects right; do not guess.

## Gotchas learnt so far
- sugoi forms post `<form>_<field>`, `<form>_formSubmitted=true`, `<form>_submit`
  and the hidden token; spod forms (CamapForm.fromSpod) have a generated prefix
  auto-detected from `name="(\w+)_formSubmitted"`. Date-picker fields post
  `YYYY-MM-DD HH:MM:SS`, even time pickers.
- Many admin pages need the session's current group: `GET /user/choose?group=ID`.
  Distribution/participation pages need `?_from/_to`.
- Neko dates overflow after 2038: keep timeframes near now. Relative
  `clock.set('+Nd')` is cumulative.
- The flash message is lost when a redirect target itself redirects: assert DB
  state/status instead. Errors under `/api/*` are never persisted: assert HTTP status.
- Factories must write what hx writes (no NULL where hx writes `''`/`{}`),
  otherwise hx pages crash.
- Nest GraphQL is reached through the hx origin (`app.graphql`); introspection
  is enabled.
- The DB is reset before every test; tests run one at a time on one stack.

## Rules
- The stack is already up (`neko-test` :8180, mysql :3307). **Run only your own
  spec files**: `cd tests && npx playwright test <path> --project=<same as the existing specs>`
  (check `playwright.config.ts`). Never run the whole suite, never
  start/stop the stack. Other agents may use it later, never at the same time.
- Iterate until your files are green (expected failures through `deviation()` count
  as green). Run `npx tsc --noEmit -p .` (or `npm run typecheck`) at the end.
- Do not commit, do not touch other specs, do not edit `PROGRESS.md` or
  `reports/`. Leave `.DS_Store`/`.gitmodules` alone.
- No CI, no worktrees, no network pushes.

## Final report (max 250 words, nothing else)
- Spec files written + test count, statement IDs covered.
- Statement IDs deferred as D (one line of reason each, grouped).
- Findings: hx behaviour that differs from the spec or looks like a bug/security
  issue (one line each, with statement ID).
- Harness changes (files/members added), deviations added.
