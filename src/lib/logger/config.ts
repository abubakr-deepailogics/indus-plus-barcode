import path from "node:path";
import { isLogLevel, type LogLevel } from "./types";

// All knobs are env vars (documented in .env.local.example). Read once per
// process; restart to change.

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return !/^(0|false|no|off)$/i.test(value.trim());
}

const isProduction = process.env.NODE_ENV === "production";
const levelEnv = process.env.LOG_LEVEL?.trim().toLowerCase();
const formatEnv = process.env.LOG_FORMAT?.trim().toLowerCase();

export const loggerConfig = {
  level: (isLogLevel(levelEnv) ? levelEnv : isProduction ? "info" : "debug") as LogLevel,
  /** "pretty" = human-readable console lines; "json" = one JSON object per line. */
  consoleFormat: (formatEnv === "json" || formatEnv === "pretty" ? formatEnv : isProduction ? "json" : "pretty") as
    | "json"
    | "pretty",
  fileEnabled: bool(process.env.LOG_TO_FILE, true),
  dir: path.resolve(process.env.LOG_DIR?.trim() || path.join(process.cwd(), "logs")),
  retentionDays: positiveInt(process.env.LOG_RETENTION_DAYS, 14),
  auditRetentionDays: positiveInt(process.env.LOG_AUDIT_RETENTION_DAYS, 365),
  slowQueryMs: positiveInt(process.env.LOG_SLOW_QUERY_MS, 1000),
  slowRequestMs: positiveInt(process.env.LOG_SLOW_REQUEST_MS, 3000),
} as const;
