# Logging & tracing

Every log line in this app, on the server or in the browser, goes through one system. Lines are structured (JSON), tied together by a `requestId`, and written to disk.

## What gets logged automatically

| Source | What | Where it's wired |
|---|---|---|
| Every API request | `GET /api/x 200 123ms` with status, duration, number of DB queries and DB time. 4xx → warn, 5xx → error, slow (≥ `LOG_SLOW_REQUEST_MS`) → warn | `withRoute()` on each handler |
| Unhandled errors in routes | Full error + stack + SQL text; client gets `{ error: "Internal server error.", requestId }` | `withRoute()` |
| DB queries | Slow queries (≥ `LOG_SLOW_QUERY_MS`) → warn with SQL; every query at `debug`; pool connect/fail/error | `src/lib/db.ts` |
| Server render errors | Server Component / server action failures (with `digest`) | `src/instrumentation.ts` `onRequestError` |
| Process | Startup, unhandled rejections, uncaught exceptions | `src/lib/logger/process.ts` |
| Browser | Uncaught errors, unhandled rejections, error-boundary crashes, `/api` calls that fail with 5xx or a network error. Each comes with the last 30 breadcrumbs (navigations, API calls) | `src/instrumentation-client.ts`, `src/app/error.tsx`, `src/app/global-error.tsx` |
| Audit trail | Login/logout, password changes, user management, coupon generation/unscan/delete, wages, cut planning, washing cut report, attachments | `audit()` calls in routes |

The user is attached to every line once `getSession()`/`requireSession()` has run in that request.

## Tracing a problem end to end

1. Every request gets an `x-request-id` (`src/proxy.ts`). The browser's fetch wrapper also generates one for each `/api` call, so browser and server share it.
2. The response echoes the id in the `x-request-id` header. You can see it in DevTools → Network.
3. Search the logs for it:

   ```powershell
   Select-String -Path logs\app-2026-11-25.log -Pattern "a1b2c3d4"
   ```

   You get the request line, every DB query/slow query and error logged during it, plus any browser-side `client: API request failed` entry with the same `data.requestId`.

Error boundaries show a `Ref:` digest. Search for that value to find the matching server-side `err.digest`.

## Files

`LOG_DIR` (default `./logs`), one file per local day:

- `app-YYYY-MM-DD.log`: everything at or above `LOG_LEVEL`
- `error-YYYY-MM-DD.log`: errors only, for quick triage
- `audit-YYYY-MM-DD.log`: audit events only; always written, regardless of `LOG_LEVEL`

Files are JSON lines and are deleted after `LOG_RETENTION_DAYS` (default 14) or `LOG_AUDIT_RETENTION_DAYS` (default 365). If the directory isn't writable, file logging switches itself off with one console error and console logging continues. All settings are listed in `.env.local.example`.

## Writing code

**Route handlers**: wrap every exported method:

```ts
import { withRoute } from "@/lib/logger/with-route";

export const GET = withRoute("/api/things", async function GET(request: Request) {
  // throw new HttpError("Not found", 404) from @/lib/http-error for a clean 4xx
});
```

Pass `{ level: "debug" }` as the third argument for chatty endpoints.

**Server code** (routes, services, Server Components):

```ts
import { logger, audit } from "@/lib/logger";

logger.info("Cut plan saved", { workOrder, rows: plans.length });
logger.error("Cut plan save failed", err);            // Error → err with stack + sqlText
const log = logger.child({ module: "wages" });         // extra fields on every line
audit("coupon.delete", { couponCodes, department });   // after the change succeeds
```

**Browser code** (`"use client"` components, hooks):

```ts
import { clientLogger } from "@/lib/logger/client";
clientLogger.error("Batch scan failed", err);
```

`warn`/`error` are shipped to the server (rate-limited and deduplicated). `debug`/`info` only show in the dev console.

**Rules**

- `console.*` is a lint error in `src/`. Use the loggers.
- Never log passwords, tokens, cookies or connection strings. Keys that look sensitive are redacted automatically (`[REDACTED]`), but don't rely on it.
- DB query parameter values are never logged, only SQL text.
- Streaming (NDJSON) routes: the request line is written when the stream starts. Errors inside the stream still carry the requestId.
