export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];

export const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value);
}

/** Which file a record is persisted to. Audit records also go to the app log. */
export type LogChannel = "app" | "audit";

export type LogRecord = {
  time: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
};

/**
 * Second argument to every log method. Pass an Error directly
 * (`logger.error("Save failed", err)`) or an object of fields
 * (`logger.info("Saved", { workOrder, rows })`). Error values under any key
 * are serialized with stack/SQL details.
 */
export type LogData = unknown;

export interface Logger {
  debug(msg: string, data?: LogData): void;
  info(msg: string, data?: LogData): void;
  warn(msg: string, data?: LogData): void;
  error(msg: string, data?: LogData): void;
  /** Returns a logger that adds `bindings` to every record (e.g. `{ module: "wages" }`). */
  child(bindings: Record<string, unknown>): Logger;
}
