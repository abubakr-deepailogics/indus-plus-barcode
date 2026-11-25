import { HttpError } from "@/lib/http-error";
import { loggerConfig } from "./config";
import { runWithRequestContext, type RequestContext } from "./context";
import { logger } from "./logger";
import { REQUEST_ID_HEADER, resolveRequestId } from "./request-id";
import type { LogLevel } from "./types";

type WithRouteOptions = {
  /**
   * Level for the per-request completion line on success. Use "debug" for
   * chatty endpoints (log ingest, autocomplete) so they don't drown the log.
   * 4xx are always at least "warn", 5xx/slow are always logged.
   */
  level?: LogLevel;
};

function withRequestIdHeader(response: Response, requestId: string): Response {
  try {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  } catch {
    // Headers are immutable on some responses (e.g. a proxied fetch()). Copy.
    const headers = new Headers(response.headers);
    headers.set(REQUEST_ID_HEADER, requestId);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

function responseForUnhandled(err: unknown, requestId: string): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  // Don't leak internals (SQL text, stack) to the client — the requestId lets
  // support find the full error in the server log.
  logger.error("Unhandled error in route handler", err);
  return Response.json({ error: "Internal server error.", requestId }, { status: 500 });
}

/**
 * Wraps a Route Handler with request tracing:
 * - establishes the request context (requestId, route, user) so every log
 *   line emitted during the request is correlated,
 * - logs one completion line with status, duration and DB time/queries,
 * - turns thrown HttpError/AuthError into their status, and any other thrown
 *   error into a logged 500,
 * - echoes `x-request-id` on the response.
 *
 *   export const GET = withRoute("/api/items", async function GET(request) { ... });
 */
export function withRoute<Req extends Request, Rest extends unknown[]>(
  route: string,
  handler: (request: Req, ...rest: Rest) => Response | Promise<Response>,
  options: WithRouteOptions = {},
): (request: Req, ...rest: Rest) => Promise<Response> {
  return async function tracedHandler(request: Req, ...rest: Rest): Promise<Response> {
    const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
    const url = new URL(request.url);
    const context: RequestContext = {
      requestId,
      method: request.method,
      path: url.pathname,
      route,
      startedAt: performance.now(),
      db: { queries: 0, durationMs: 0 },
    };

    return runWithRequestContext(context, async () => {
      let response: Response;
      try {
        response = await handler(request, ...rest);
      } catch (err) {
        response = responseForUnhandled(err, requestId);
      }

      const durationMs = Math.round(performance.now() - context.startedAt);
      const status = response.status;
      const slow = durationMs >= loggerConfig.slowRequestMs;
      const level: LogLevel =
        status >= 500 ? "error" : status >= 400 || slow ? "warn" : (options.level ?? "info");

      logger[level](`${request.method} ${url.pathname} ${status} ${durationMs}ms`, {
        status,
        durationMs,
        ...(url.search && { query: url.search.slice(0, 500) }),
        ...(context.db.queries > 0 && {
          dbQueries: context.db.queries,
          dbMs: Math.round(context.db.durationMs),
        }),
        ...(slow && { slow: true }),
      });

      return withRequestIdHeader(response, requestId);
    });
  };
}
