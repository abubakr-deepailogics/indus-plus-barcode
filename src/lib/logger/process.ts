import { loggerConfig } from "./config";
import { logger } from "./logger";

const REGISTERED = Symbol.for("indus.logger.processHandlers");

// Called once from instrumentation.ts register() (Node.js runtime only).
export function registerProcessHandlers(): void {
  const g = globalThis as unknown as Record<symbol, boolean | undefined>;
  if (g[REGISTERED]) return;
  g[REGISTERED] = true;

  logger.info("Server starting", {
    pid: process.pid,
    node: process.version,
    env: process.env.NODE_ENV,
    logLevel: loggerConfig.level,
    logDir: loggerConfig.fileEnabled ? loggerConfig.dir : "(file logging disabled)",
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { err: reason });
  });

  // The *Monitor* variant observes without changing Node's crash behavior.
  process.on("uncaughtExceptionMonitor", (err, origin) => {
    logger.error("Uncaught exception", { err, origin });
  });

  process.on("warning", (warning) => {
    logger.warn("Process warning", warning);
  });
}
