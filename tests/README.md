# CAMAP characterisation tests

Black-box tests that pin down how **camap-hx behaves today**, so that the
TypeScript port can be checked against the same suite
(`task/refacto-hx-ts/OVERVIEW.md` §4 and §7.1, ROADBLOCKS F1–F4, C1, D1).

The tests use the apps only through **HTTP and a browser**. They arrange and
assert data in the **shared MySQL database**, which both stacks use, so
DB-state assertions carry over to the TS target unchanged. The Haxe utest suite
(`camap-hx/src/test`) is not used.

```
tests/
  stack/      test-only images and config (libfaketime Neko image, hx config, Nest env)
  db/         schema.sql (generated baseline) + seed.sql (rows present before every test)
  src/        the harness: fixtures, factories, encodings, clock, target drivers
  specs/      the tests, one folder per spec domain (00-stack, 01-accounts …)
  scripts/    stack.sh, baseline-schema.sh, spec-coverage.ts
  reports/    spec-coverage.md (generated)
```

## Prerequisites

- Docker with Compose v2.17 or later (images are `linux/amd64`; on Apple silicon they
  run under emulation, so the first build is slow).
- Node 20 or later.
- Submodules checked out: `git submodule update --init`.

## Running

```bash
cd tests
npm ci && npx playwright install chromium

npm run stack:up          # build missing images, start, wait until healthy
npm test                  # TARGET=hx: unit tests of the harness + all specs
npm run test:ui           # Playwright UI mode
npm run stack:down        # MySQL lives on tmpfs: everything is gone
```

The stack runs as compose project `camap-test` (`docker-compose.test.yml` at the
repo root), next to the dev stack without touching it:

| Service | Host port | Notes |
|---|---|---|
| `neko-test` | 8180 | camap-hx + libfaketime. Apache proxies `/graphql`, `/neostatic/`, `/locales/` to Nest |
| `nest-test` | – | camap-ts built image (`dist/main.js`), network alias `nest-devcamap` |
| `mysql-test` | 3307 | `camap_test`, root/root, loads `db/schema.sql` and `db/seed.sql` on start |
| `mailpit-test` | 8026 | web UI, for debugging only (tests read the mail queue table) |

Other commands:

- `./scripts/stack.sh build` rebuilds the images. Run it after changing a
  submodule. `up` never rebuilds an image that already exists.
- `./scripts/stack.sh logs neko-test` shows a service's logs.
- `npm run schema:baseline` regenerates `db/schema.sql`. Then run
  `stack:down` and `stack:up` to load it.
- `npm run coverage:spec` writes `reports/spec-coverage.md`.
- `TARGET=ts npm test` runs the suite against the TS driver; see "Targets" below.

Report and traces: `playwright-report/` and `test-results/`
(`npx playwright show-report`).

## How a test is written

```ts
import { test, expect } from '../../src/fixtures.js';
import { deviation } from '../../src/deviations.js';
import * as make from '../../src/factories/index.js';

test('a member cannot post an empty list of absences', { tag: ['@ORD-ABS-007'] }, async ({ app, as }) => {
  const s = await make.amapScenario();                       // arrange in the DB
  const sub = await make.subscription({ user: s.users.member, catalog: s.constCatalog, ... });
  const member = await as(s.users.member);                    // real login

  const res = await app.api.catalog.subscriptionAbsences.post(member.request, sub.id, { absentDistribIds: [] });

  expect(res.status).toBe(400);                               // assert over HTTP…
  expect(await storedAbsences(sub.id)).toEqual([d2, d3]);     // …and in the DB
});
```

### Conventions

- **Tags = spec IDs.** Every test carries the IDs of the statements it checks
  (`{ tag: ['@ORD-ABS-007'] }`). The coverage report is built from these tags.
- **Specs know nothing about hx.** No URLs, selectors or hx-specific JSON in
  `specs/`. Use `app.urls`, `app.api`, `app.pages` (`src/targets/types.ts`).
  Selectors live in page objects (`src/targets/hx/pages`). Prefer role and text
  locators; add a `data-testid` to a template only if there is no other way.
- **Assert the decided behaviour, not the bug.** When an `UND-NNN` decision or
  a `CODE-NNN` fix is not implemented on a target yet, call
  `deviation('UND-NNN')` at the top of the test and add the entry to
  `src/deviations.ts`. The test is then reported as an *expected failure* on
  that target. Once the fix lands, it shows up as an unexpected pass, and you
  remove the entry. Without a deviation, characterise what the code does today.
- **Isolation.** Before every test, the DB is truncated and `db/seed.sql` is
  replayed (`admin@camap.tld`/`admin`, `deleted@camap.tld`, ToS variables), and
  the clock is set back to real time. There is one DB and one clock, so tests
  run one at a time (`workers: 1`).
- **Factories** (`src/factories`) build rows with hx's own defaults and return
  them with their ids. `make.amapScenario()` gives a group, a place, a vendor, a
  constant catalog (absences allowed) and a variable catalog, 4 weekly
  distribution days, and one user per actor: `member`, `member2`,
  `coordinator`, `membershipManager`, `messagesManager`, `groupAdmin`,
  `vendor`, `superadmin`, `nonMember`. Every user's password is `test1234`.
- **Encodings** (`src/encodings`) are the only place that knows how hx stores
  things: SFlags bit ordinals (taken from the Haxe enums, since TS drops some),
  rights JSON, md5/bcrypt passwords, CSV and JSON text columns, and Paris
  wall-clock `DATETIME`s. They have unit tests (`*.test.ts`, project `unit`).
- **Never forge sessions in SQL** (`Session.sdata` is neko-serialised).
  `as(user)` logs in for real. hx creates the `sid` session, then the Nest
  GraphQL `login` mutation sets the JWT cookies. Everything goes through the hx
  origin, so a single cookie jar holds all four cookies. `anon` is a visitor.

### Fixtures (`src/fixtures.ts`)

| Fixture | |
|---|---|
| `app` | `CamapApp` driver of the current `TARGET` |
| `as(user)` / `anon` | `{ request, page }`: API context and browser page, sharing the cookies |
| `clock` | `clock.set('+4d')`, `clock.set('2026-11-10 18:15:00')` (Paris), `clock.set(date)`, `clock.now()`. Factories use `clock.now()` |
| `cron` | `cron.run('minute' \| 'hour' \| 'daily')`: GET `/cron/<job>` with the shared key |
| `mails` | `mails.mark()`, `mails.since(mark)`, `mails.to(email, mark)`: rows of `BufferedJsonMail` |
| `errors` | fails the test when the app logs new `Error` rows; `errors.expect(/pattern/)` to allow them |

### The fake clock

`neko-test` preloads libfaketime into Apache, so only Neko is faked. Nest and
MySQL keep real time. That is safe: hx writes its own timestamps, and JWT
expiry is checked by Nest only. `clock.set()` writes an *offset* (`+<seconds>`)
to `tests/.faketime/faketime.rc`, which is re-read on every call. The
libfaketime `@date` format is not used, because it counts from the start of the
process and Apache workers are long-lived. `GET /cron` prints `now is …`, as
seen by Neko.

### The Mapbox stub

hx geocodes addresses through the external `curl` binary (group creation, place
and vendor saves). `neko-test` installs `tests/stack/curl-stub.sh` as
`/usr/local/bin/curl`. Every Mapbox geocoding request gets a fixed point
(lat 48.1173, lng -1.6778), except an address containing `NOWHERE`, which gets
no result. Use `NOWHERE` to test the "cannot be located" paths. Any other curl
call goes to the real binary.

### Things the harness found out

- Errors raised under `/api/*` never reach the `Error` table: `doApi` logs, then
  rolls back. The `errors` fixture cannot see them, so API tests must assert the
  HTTP status.
- Nest runs with `NODE_ENV=development`. With any other value its cookies get
  `Domain=<CAMAP_HOST>`, which is invalid for `http://localhost:8180`
  (`auth.service.ts` `getDomainProperty`).
- `HX_TRIGGER_CRONS` is unset in the test stack: any value, including `false`,
  enables Nest's cron trigger (CODE-015), and tests trigger jobs themselves.

## Targets: running the same suite against camap-ts

`TARGET=hx|ts` selects the driver (`src/targets/<target>`). The TS driver
(`src/targets/ts/index.ts`) has nothing ported yet. Every member it lacks is a
stub, and the first time a test calls one, the test is **skipped** with a
`not-ported: ts.pages.login` annotation. The DB-only smoke tests already run
on both targets.

To port a domain:

1. Implement the members it needs (urls, api clients, page objects) with the
   same signatures as `src/targets/hx`, and add them to `ported` in
   `src/targets/ts/index.ts`.
2. Point `CAMAP_BASE_URL` (and the `CAMAP_DB_*` variables if needed) at the TS
   deployment, then run `TARGET=ts npm test`. The domain's tests now run.
3. Decided fixes that TS already has: drop `'ts'` from the deviation's
   `targets` in `src/deviations.ts`.

## Environment variables

| Variable | Default |
|---|---|
| `TARGET` | `hx` |
| `CAMAP_BASE_URL` | `http://localhost:8180` |
| `CAMAP_DB_HOST` / `_PORT` / `_USER` / `_PASSWORD` / `_NAME` | `127.0.0.1` / `3307` / `root` / `root` / `camap_test` |
| `CAMAP_KEY` | `camap-test-key-0123456789` (= hx `key` = Nest `CAMAP_KEY`) |
| `CAMAP_FAKETIME_DIR` | `tests/.faketime` |
| `CAMAP_SPECS_DIR` | `task/refacto-hx-ts/specs` |

## Before merging

There is no CI job: the suite runs locally before merging.

```bash
cd tests
./scripts/stack.sh build    # only if a submodule changed
npm run stack:up
npm test                    # must be all green (expected failures count as green)
npm run coverage:spec       # commit the updated reports/spec-coverage.md with new tests
```
