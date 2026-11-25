/* eslint-disable no-console -- last-resort fallback when a sink itself throws. */
import { loggerConfig } from "./config";
import { getRequestContext } from "./context";
import { normalizeLogData } from "./sanitize";
import { writeConsole, writeFile } from "./sinks";
import { LEVEL_WEIGHT, type LogChannel, type LogLevel, type LogRecord, type Logger } from "./types";

const minWeight = LEVEL_WEIGHT[loggerConfig.level];

export function emit(
  level: LogLevel,
  msg: string,
  data: unknown,
  bindings: Record<string, unknown>,
  channel: LogChannel = "app",
): void {
  // Audit records are never filtered out by LOG_LEVEL.
  if (channel !== "audit" && LEVEL_WEIGHT[level] < minWeight) return;

  try {
    const ctx = getRequestContext();
    // Order matters: explicit data overrides bindings, which override the
    // ambient request context (e.g. onRequestError passes its own requestId).
    const record: LogRecord = {
      time: new Date().toISOString(),
      level,
      msg,
      ...(ctx && {
        requestId: ctx.requestId,
        method: ctx.method,
        route: ctx.route,
        ...(ctx.userId !== undefined && { userId: ctx.userId, user: ctx.userEmail }),
      }),
      ...bindings,
      ...normalizeLogData(data),
    };
    const line = JSON.stringify(record);
    writeConsole(record, line);
    writeFile(record, line, channel);
  } catch (err) {
    // Logging must never take a request down with it.
    console.error("[logger] failed to write log record", msg, err);
  }
}

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  return {
    debug: (msg, data) => emit("debug", msg, data, bindings),
    info: (msg, data) => emit("info", msg, data, bindings),
    warn: (msg, data) => emit("warn", msg, data, bindings),
    error: (msg, data) => emit("error", msg, data, bindings),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger: Logger = createLogger();

export function isLevelEnabled(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= minWeight;
}
