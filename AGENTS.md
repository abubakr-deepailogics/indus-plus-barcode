<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architecture & code standards

- **Feature-based architecture.** Code lives under `src/features/<feature-name>/`, not grouped by technical type (no global `components/`, `services/` catch-alls for feature logic). Each feature owns its components, services, hooks, and types. Shared/cross-feature code goes in a common location, not duplicated per feature.
- **Reusable & scalable.** Before writing new logic, check if it already exists (a hook, util, service, type) and reuse or extend it. Don't hardcode what will plausibly need to vary; don't over-abstract what won't.
- **Cover edge cases.** For every change, explicitly consider: empty/null/undefined input, loading and error states, network/API failures, boundary values (0, negative, very large, duplicate), and race conditions where relevant. Don't skip error handling to keep a diff small.

# Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict), Tailwind v4.
- DB: MSSQL via `mssql`, pooled through `@/lib/db` (`getPool()`/`sql`). Always parameterize queries (`.input(...)`) — never string-interpolate user input into SQL.
- Auth: Firebase, wired via `@/lib/firebase` and `@/lib/auth-context.tsx` / `src/features/auth`. Routes are protected client-side with `@/components/auth-guard.tsx`.
- UI primitives: shadcn-style components in `@/components/ui/*` (Base UI + `class-variance-authority` + `tailwind-merge`). Reuse/extend these instead of adding new one-off styled elements or a new UI library.
- PDF/coupon generation: `pdfkit` + `qrcode`, plus a hand-rolled Code128 barcode encoder in `src/features/qr-code-generation/services`. Reuse those services for any new label/coupon/print work rather than re-implementing encoding.
- Path alias: `@/*` → `src/*`.

# Project layout

- `src/app/` — routes only (pages + `api/*` route handlers). Keep route files thin: parse request → call a feature service/hook → respond. No business logic embedded in route handlers or page components.
- `src/app/api/*` — REST-ish route handlers, mostly thin wrappers over MSSQL queries. Return `Response.json({ error }, { status })` on failure with a clear message; validate required query/body params before hitting the DB.
- `src/features/<name>/` — one folder per feature (`auth`, `dashboard`, `qr-code-generation`, `order-style-bulletin`, ...), each with its own `components/`, `services/`, `hooks/`, `data/`, `types.ts` as needed. New features follow this shape; don't invent a different internal layout per feature.
- `src/components/` — cross-feature/shared UI only (`ui/*` primitives, `AppShell`, `auth-guard`). If something is used by 2+ features, it belongs here, not duplicated.
- `src/lib/` — cross-cutting singletons/utilities (db pool, firebase client, print helpers, generic utils). Not feature-specific logic.

# Conventions

- Types: define feature-specific types in that feature's `types.ts`; don't scatter inline duplicate interfaces across components.
- Server vs client: default to Server Components; add `"use client"` only where interactivity/hooks require it. Never slap `"use client"` on a whole page/component just because one small part needs it (a button handler, a form field, a hook) — extract that part into its own small client component and keep the parent a Server Component rendering it as a child. This keeps data fetching, SEO, and bundle size on the server by default.
- Route handlers: mark `export const dynamic = "force-dynamic"` when a route must not be statically cached (DB-backed reads that need to be live).
- DB schema changes: do not run `ALTER TABLE`/schema auto-migration logic inside request handlers (an existing anti-pattern in `api/coupons/scan`) — schema changes belong in a migration script, not on the hot path of every request.
- Secrets/config: all secrets via env vars, documented in `.env.local.example` (never commit real values in `.env`). Firebase `NEXT_PUBLIC_*` keys are client-exposed by design; MSSQL connection string is server-only, never used in client components.
- Lint/build gates: `npm run lint` and `npm run build` must pass before considering a change done.

# Testing & verification

- No test framework is configured in this repo yet. Until one exists, verify changes via `npm run lint`, `npm run build`, and manually exercising the affected route/page.
- If you add non-trivial logic (parsing, encoding, calculations), leave it in a plain function that's easy to unit test later rather than inlined in a component — don't add a test framework speculatively.
