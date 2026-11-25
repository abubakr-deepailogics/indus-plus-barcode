import type { Instrumentation } from "next";

// Server-side observability hooks (see docs/logging.md). The logger uses
// node:fs, so it is only loaded in the Node.js runtime.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerProcessHandlers } = await import("@/lib/logger/process");
  registerProcessHandlers();
}

// Errors Next.js itself catches: Server Component render failures, server
// actions, and anything thrown out of a Route Handler not wrapped with
// withRoute (wrapped ones handle and log their own errors).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("@/lib/logger");
  const requestIdHeader = request.headers["x-request-id"];
  logger.error("Unhandled server error", {
    err,
    requestId: Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader,
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: "renderSource" in context ? context.renderSource : undefined,
  });
};
