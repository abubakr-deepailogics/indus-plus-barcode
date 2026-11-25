import { AsyncLocalStorage } from "node:async_hooks";

// Per-request trace context. Everything logged while handling a request —
// in the route, in feature services, in DB queries — automatically carries
// the same requestId/user, without passing a logger around.
export type RequestContext = {
  requestId: string;
  method: string;
  path: string;
  route: string;
  startedAt: number;
  userId?: number;
  userEmail?: string;
  db: { queries: number; durationMs: number };
};

// Kept on globalThis so dev-mode HMR re-evaluating this module doesn't split
// the store between old and new module instances.
const STORE_KEY = Symbol.for("indus.logger.requestContext");
const globalStore = globalThis as unknown as Record<symbol, AsyncLocalStorage<RequestContext> | undefined>;
const storage = (globalStore[STORE_KEY] ??= new AsyncLocalStorage<RequestContext>());

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Attributes the current request to a user (called from getSession). */
export function setRequestUser(user: { userId: number; email: string }): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.userId = user.userId;
  ctx.userEmail = user.email;
}

export function recordDbQuery(durationMs: number): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  ctx.db.queries += 1;
  ctx.db.durationMs += durationMs;
}
