# Error log (ADM-ERR)

Actors: superadmin, the system.

- **ADM-ERR-001** As the system, I record unexpected errors with their address, user, IP and date. <!-- 03-features/admin-superadmin.md S4 Logging; camap-hx/src/controller/Main.hx:187-207 -->

- **ADM-ERR-002** As a superadmin, I can browse recorded errors, 20 per page, with daily counts over the last month. <!-- 03-features/admin-superadmin.md S3; camap-hx/src/controller/admin/Admin.hx:101-129 -->
  - I can filter by user.

- **ADM-ERR-003** As a superadmin, I can empty the error log only through a protected action. <!-- 03-features/admin-superadmin.md S3, S7; camap-hx/src/controller/admin/Admin.hx:111-113 -->
  - The purge is a POST with a CSRF token.
  - I confirm before the table is emptied.
  - **ERRATUM** Today a simple GET link with a flag empties the table, with no token. Source: `camap-hx/src/controller/admin/Admin.hx:111-113` (CODE-030).
  - **DECISION (UND-108, 2026-11-02)** The error-log purge needs a POST with a CSRF token and a confirmation; the clean-up script runs from the command line only, with a dry-run by default and explicit minimum ids.

- **ADM-ERR-004** As a superadmin, I receive yesterday's errors by email every day. <!-- 03-features/admin-superadmin.md S4 Logging; camap-hx/src/controller/Cron.hx:353-377 -->
  - See COM-JOB-006.

- **ADM-ERR-005** As an API client, a failing request returns an error code and message. <!-- 03-features/admin-superadmin.md S4 Logging; camap-hx/src/controller/Main.hx:193-198 -->
  - The error is rolled back.

- **ADM-ERR-006** As an API client, I never receive internal stack traces. <!-- 03-features/admin-superadmin.md S4 Logging; camap-hx/src/controller/Main.hx:199-206 -->
  - For an unexpected error, the stack trace is logged on the server; the response only contains the error code and message.
  - **ERRATUM** Today an unexpected error returns the stack trace in the response body. Source: `camap-hx/src/controller/Main.hx:199-206`.
  - **DECISION (UND-116, 2026-11-02)** Keep stack traces server-side: log them and return only the code and message.

- **ADM-ERR-007** As a user, expected errors show as a message on the page and are not logged. <!-- 03-features/admin-superadmin.md S4 Logging; camap-hx/src/controller/*.hx -->

- **ADM-ERR-008** As the system, I retry a request up to 5 times when the database reports a deadlock. <!-- 03-features/admin-superadmin.md S4 Logging; camap-ts/packages/api-core/src/common/interceptors/dealock.interceptor.ts:5-33 -->
