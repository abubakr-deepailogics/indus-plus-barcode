# Logging & Tracing, Explained Simply

This page explains, in plain words, what we built so the app keeps a "diary" of everything it does.

---

## 1. What is logging?

Think of the app as a shop worker. **Logging** means the worker writes in a diary every time something happens:

> "10:05 — Ali opened the Cut Report page."
> "10:06 — Saving coupons failed because the database was slow."

When something breaks, we read the diary and see what happened instead of guessing.

## 2. What is tracing?

One click in the app can cause many small jobs: ask the server, talk to the database three times, send an answer back.

**Tracing** gives every click a **tracking number**, like a courier parcel. Every diary line for that click carries the same number. Search for the number and you see the whole story of that one click, from start to end.

In our app this tracking number is called the **request id** (`x-request-id`).

---

## 3. What we built

### 3.1 One diary-writer for the whole app (the "logger")

**Before:** the code used `console.log` / `console.error` about 100 times, each in its own style. Messages were scattered, had no time, no user and no tracking number, and disappeared when the server restarted.

**Now:** all code uses one diary-writer:

- On the server: `logger` (from `src/lib/logger`)
- In the browser: `clientLogger` (from `src/lib/logger/client`)

Every line it writes has:

- **when** it happened (time)
- **how serious** it is: `debug` (tiny detail), `info` (normal), `warn` (something looks wrong), `error` (something broke)
- **the tracking number** (request id)
- **who** was logged in (if anyone)
- **which page or API** it came from

Using `console.log` in our code is now **blocked by the lint check**, so everyone uses the logger.

### 3.2 A tracking number on every request

- **What:** every request to the app gets a tracking number.
- **How:** a small gatekeeper file, `src/proxy.ts`, stands at the door. Every request gets a number stamped on it before it goes in.
- The number is sent back to the browser too. In Chrome you can see it under **DevTools → Network → (click a request) → Headers → `x-request-id`**.

### 3.3 Every API recorded automatically (`withRoute`)

- **What:** each of our 74 API handlers is wrapped in a helper called `withRoute`.
- **How it helps:** it automatically writes one line per request, like:

  ```
  GET /api/open-order/work-orders 200 5441ms  dbQueries=2 dbMs=2815
  ```

  That means: someone asked for work orders, it worked (200), it took 5.4 seconds, and 2.8 seconds of that was the database.
- If an API crashes in a way nobody planned for, `withRoute` catches it, writes the full error in the diary, and tells the user "Internal server error" along with the tracking number. It does **not** show scary database details to the user.
- Slow requests (over 3 seconds) are marked `slow` so we can spot them.

### 3.4 Database watching

- **What:** every database question (SQL query) is timed.
- **How:** we hooked into the database library once in `src/lib/db.ts`.
  - A query that takes **more than 1 second** is written as a warning, with the SQL, so we know what to speed up.
  - When a query **fails**, the SQL text is attached to the error, so we know exactly which query broke.
  - It also notes **which database** was used (indusPlus, pitSystem or hrms).
  - **Customer data / values are never written**, only the SQL shape.

### 3.5 Catching server crashes

File: `src/instrumentation.ts`

- If a page crashes while the server is building it, the error is written down.
- If the server has a hidden crash (a "promise rejection" or "uncaught exception"), it's written down.
- When the server starts, it writes "Server starting" with its settings.

### 3.6 Catching browser problems

File: `src/instrumentation-client.ts`

The user's browser is watched too:

- **JavaScript errors** on the page → sent to the server diary.
- **API calls that fail** (server error or no network) → sent along with their tracking number. So we can match "the browser saw a failure" with "here is what the server did".
- **Breadcrumbs:** the browser remembers the user's last 30 steps (pages opened, API calls made). When an error happens, those steps are sent too, so we know what the user did just before it broke.
- Browser messages arrive at a new API, **`/api/logs`**, which:
  - refuses very big or broken messages
  - limits how many messages one person can send, so it can't be spammed
  - hides secrets

### 3.7 Friendly crash screen

Files: `src/app/error.tsx`, `src/app/global-error.tsx`

**Before:** if a page crashed, the user saw a blank or broken screen.

**Now:** they see **"Something went wrong"**, a **Try again** button, and a **Ref code**. The crash is written in the diary automatically. If the user tells support the Ref code, we can find the matching error.

### 3.8 Audit log (who did what)

The audit log is a special diary that answers: **"Who changed what, and when?"**

It records:

| Area | What is recorded |
|---|---|
| Login | log in, failed log in, log out, password change |
| Users | create, edit, delete, reset password, change permissions |
| Coupons | generate, rework, unscan, bulk unscan, bulk delete |
| Wages | create, delete |
| Cut planning | save, delete row, generate bundles |
| Washing cut report | save, delete |
| Style bulletin | save details, upload/delete attachment |
| Dummy employees | create, edit |

The audit log is kept for **1 year**, and it is always written, whatever the log level is.

### 3.9 Secrets are hidden

If anything named like `password`, `token`, `secret`, `cookie`, `session` or `connection string` is about to be written, it is replaced with `[REDACTED]`.

---

## 4. Where do the logs go?

Two places:

1. **The terminal/console** where the server runs: easy to read while developing.
2. **Files** in the `logs/` folder, one new file each day:

| File | What's inside | Kept for |
|---|---|---|
| `app-2026-11-25.log` | everything | 14 days |
| `error-2026-11-25.log` | only errors (quick to check) | 14 days |
| `audit-2026-11-25.log` | only "who did what" | 365 days |

Old files are deleted automatically. The `logs/` folder is not saved to git.

---

## 5. How to find a problem (step by step)

**Example:** a user says *"Saving failed!"*

1. Ask them for the **Ref code** on the screen, or get the `x-request-id` from DevTools → Network.
2. Open PowerShell in the project folder.
3. Search today's log for that number:

   ```powershell
   Select-String -Path logs\app-2026-11-25.log -Pattern "PUT-THE-NUMBER-HERE"
   ```

4. You'll see the whole story: who did it, which API, every database query, the exact error and how long it took.

**Quick checks:**

```powershell
# Today's errors only
Get-Content logs\error-2026-11-25.log

# Who deleted coupons today?
Select-String -Path logs\audit-2026-11-25.log -Pattern "coupon.bulk_delete"

# Slow database queries today
Select-String -Path logs\app-2026-11-25.log -Pattern "Slow DB query"
```

---

## 6. Settings (optional)

These go in the `.env` file. If you don't set them, sensible defaults are used. All of them are listed in `.env.local.example`.

| Setting | What it does | Default |
|---|---|---|
| `LOG_LEVEL` | How much detail: `debug` / `info` / `warn` / `error` | `debug` in dev, `info` in production |
| `LOG_FORMAT` | Console style: `pretty` (easy to read) or `json` | pretty in dev, json in prod |
| `LOG_TO_FILE` | Write log files? | `true` |
| `LOG_DIR` | Folder for log files | `./logs` |
| `LOG_RETENTION_DAYS` | Days to keep app/error logs | `14` |
| `LOG_AUDIT_RETENTION_DAYS` | Days to keep audit logs | `365` |
| `LOG_SLOW_QUERY_MS` | A DB query slower than this counts as slow | `1000` (1 sec) |
| `LOG_SLOW_REQUEST_MS` | A request slower than this counts as slow | `3000` (3 sec) |
| `NEXT_PUBLIC_CLIENT_LOG_LEVEL` | Which browser messages are sent to the server | `warn` |

---

## 7. For developers: how to use it in new code

**A new API route:** always wrap it.

```ts
import { withRoute } from "@/lib/logger/with-route";

export const GET = withRoute("/api/my-thing", async function GET(request: Request) {
  // your code
});
```

**Write a message on the server:**

```ts
import { logger, audit } from "@/lib/logger";

logger.info("Cut plan saved", { workOrder, rows: 12 });
logger.error("Cut plan save failed", err);
audit("coupon.delete", { couponCode, department });   // after the change worked
```

**Write a message in the browser:**

```ts
import { clientLogger } from "@/lib/logger/client";

clientLogger.error("Scan failed", err);
```

**Return a clean error to the user** (for example "not found"):

```ts
import { HttpError } from "@/lib/http-error";
throw new HttpError("Coupon not found", 404);
```

**Rules:**

- Don't use `console.log`. The lint check will stop you.
- Never log passwords or secrets.
- Add `audit(...)` whenever you change important business data.

---

## 8. Map of the files

| File | Its job, in short |
|---|---|
| `src/lib/logger/index.ts` | Main door: `logger`, `audit` |
| `src/lib/logger/logger.ts` | Builds each diary line |
| `src/lib/logger/sinks.ts` | Writes to the console and the daily files |
| `src/lib/logger/config.ts` | Reads settings from `.env` |
| `src/lib/logger/context.ts` | Remembers the tracking number and user during a request |
| `src/lib/logger/with-route.ts` | Wrapper that records every API request |
| `src/lib/logger/sanitize.ts` | Hides secrets and cuts huge data short |
| `src/lib/logger/audit.ts` | "Who did what" diary |
| `src/lib/logger/request-id.ts` | Makes tracking numbers |
| `src/lib/logger/client.ts` | Browser diary-writer + breadcrumbs |
| `src/lib/logger/client-ingest.ts` | Checks browser messages that arrive |
| `src/lib/logger/process.ts` | Watches for server crashes |
| `src/app/api/logs/route.ts` | API that receives browser messages |
| `src/proxy.ts` | Gatekeeper: stamps a tracking number on every request |
| `src/instrumentation.ts` | Server crash catcher |
| `src/instrumentation-client.ts` | Browser error catcher |
| `src/app/error.tsx`, `src/app/global-error.tsx`, `src/components/error-fallback.tsx` | Friendly crash screen |
| `src/lib/http-error.ts` | `HttpError` / `AuthError` for clean error replies |
| `src/lib/db.ts` | Times every database query |
| `docs/logging.md` | Detailed technical guide |

---

## 9. Things we noticed while building this

1. **Work-order search is slow.** In testing it took about 5.4 seconds. Each of its two database queries took 1.2–1.6s, and the rest was the first database connection being opened. The new logs will keep flagging it.
2. **Some write APIs don't check who is logged in.** Coupon delete/unscan, wages and cut planning trust a name sent by the browser (`actedBy` / `createdBy`). The audit log records that name, and also the logged-in user when there is one, but these APIs should require a login. That is a good next task.
