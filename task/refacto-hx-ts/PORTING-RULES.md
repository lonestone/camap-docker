# Porting rules

How Haxe code is ported to TS. These rules apply to every domain, to the analysis docs that prepare the port (e.g. [docs/08-sugoi.md](docs/08-sugoi.md)) and to the plan. They were set by the user on 2026-11-06.

The *what* is fixed elsewhere: the specs ([specs/](specs/README.md)) and the decisions ([specs/UNDECIDED.md](specs/UNDECIDED.md), [TS-ONLY-STEP.md](TS-ONLY-STEP.md)) say what the system must do, and the characterisation suite checks it. These rules are about the *how*.

## 1. Reproduce the framework only where existing data requires it

Haxe runs on sugoi (a CAMAP fork, the `sugoi/` submodule) and on other Haxe libraries. Their mechanisms are **not** a model for the TS code.

- **Match the Haxe/sugoi implementation exactly only when compatibility with existing data or with live contracts requires it.** For example:
  - formats stored in the database: serialized blobs, flag bitfields, enum indexes, CSV/JSON text columns, `Variable` keys, password hashes;
  - rows both apps read and write while they run side by side (sessions, the mail queue);
  - values already handed out that must keep working: signed file URLs in sent emails and pages, invitation links, bookmarked URLs.
- **Everywhere else, use standard NestJS / React practice to produce the same observable result** (the result the specs and tests check):
  - request handling, transactions, validation, CSRF, rights;
  - caching, error logging, flash messages, i18n, form handling, mail rendering.
  Use Nest guards, pipes, interceptors, DTOs with class-validator, TypeORM transactions, i18next and React forms, not a port of the sugoi equivalent.
- When a compatibility constraint applies only while Haxe still runs (for example the shared session row), say so. The constraint is then listed in [TS-ONLY-STEP.md](TS-ONLY-STEP.md) §3 to be dropped later.
- Analysis docs mark each mechanism with one of two labels: **Match** (with the data or contract that forces it) or **Reimplement** (with the Nest/React tool that replaces it).

## 2. Pages keep the Haxe structure and use the TS design

When a Haxe template (`.mtt`) becomes a React page:

- **Keep the structure of the Haxe page**: the same sections in the same order, the same fields, columns, actions and information, and the same navigation entry points. Users must find their page as they know it. The specs and the end-to-end tests rely on this.
- **Build it from the existing TS/React design elements when they exist**: the front-core components, MUI theme, layouts, tables, forms, dialogs and buttons already used by the neo modules. Don't reproduce Haxe/Bootstrap markup or CSS. Only create a new component when no existing one fits, and follow the same design.
- Where the Haxe page and an existing TS screen show the same thing differently, the Haxe structure decides *what* is shown and the TS components decide *how* it looks.
