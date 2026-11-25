// Server-side logging & tracing entry point. Server code only (Route
// Handlers, Server Components, services, instrumentation) — this pulls in
// node:fs. Browser code uses `@/lib/logger/client` instead.
//
//   import { logger, audit } from "@/lib/logger";
//   logger.info("Cut plan saved", { workOrder, rows: plans.length });
//   logger.error("Cut plan save failed", err);
//   audit("coupon.delete", { couponCodes });
//
// Route handlers are wrapped with `withRoute` from "@/lib/logger/with-route".
// See docs/logging.md.
export { logger, isLevelEnabled } from "./logger";
export { audit } from "./audit";
export { getRequestContext, setRequestUser } from "./context";
export { loggerConfig } from "./config";
export type { Logger, LogLevel } from "./types";
