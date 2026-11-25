/* eslint-disable no-console -- this module IS the console sink. */
import fs from "node:fs";
import path from "node:path";
import { loggerConfig } from "./config";
import type { LogChannel, LogLevel, LogRecord } from "./types";

// ---------------------------------------------------------------------------
// Console sink
// ---------------------------------------------------------------------------

const useColor = Boolean(process.stdout?.isTTY) && !process.env.NO_COLOR;
const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

// Fields already shown in the pretty line's prefix, or printed separately.
const PRETTY_SKIP = new Set(["time", "level", "msg", "requestId", "err"]);

function formatValue(value: unknown): string {
  if (typeof value === "string") return /\s/.test(value) ? JSON.stringify(value) : value;
  return JSON.stringify(value);
}

function formatPretty(record: LogRecord): string {
  const time = record.time.slice(11, 23);
  const level = record.level.toUpperCase().padEnd(5);
  const rid = typeof record.requestId === "string" ? ` [${record.requestId.slice(0, 8)}]` : "";
  const fields = Object.entries(record)
    .filter(([key, value]) => !PRETTY_SKIP.has(key) && value !== undefined)
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(" ");

  const head = useColor
    ? `${DIM}${time}${RESET} ${COLORS[record.level]}${level}${RESET}${DIM}${rid}${RESET} ${record.msg}`
    : `${time} ${level}${rid} ${record.msg}`;
  let line = fields ? `${head} ${useColor ? DIM : ""}${fields}${useColor ? RESET : ""}` : head;

  const err = record.err as { stack?: string; message?: string; sqlText?: string } | undefined;
  if (err) {
    line += `\n  ${err.stack ?? err.message ?? ""}`.replace(/\n/g, "\n  ");
    if (err.sqlText) line += `\n  SQL: ${err.sqlText.trim().slice(0, 1000).replace(/\s+/g, " ")}`;
  }
  return line;
}

export function writeConsole(record: LogRecord, line: string): void {
  const out = loggerConfig.consoleFormat === "pretty" ? formatPretty(record) : line;
  if (record.level === "error") console.error(out);
  else if (record.level === "warn") console.warn(out);
  else console.log(out);
}

// ---------------------------------------------------------------------------
// File sink: <LOG_DIR>/<channel>-YYYY-MM-DD.log, JSON lines, one file per
// day per channel, old files pruned by retention. Errors are also copied to
// error-YYYY-MM-DD.log so triage doesn't require grepping the full app log.
// ---------------------------------------------------------------------------

type FileName = LogChannel | "error";

type FileState = {
  disabled: boolean;
  streams: Map<FileName, { date: string; stream: fs.WriteStream }>;
  lastPruneDate?: string;
};

// globalThis so dev HMR doesn't leak a new set of open file handles per reload.
const STATE_KEY = Symbol.for("indus.logger.fileSink");
const globalState = globalThis as unknown as Record<symbol, FileState | undefined>;
const state: FileState = (globalState[STATE_KEY] ??= { disabled: !loggerConfig.fileEnabled, streams: new Map() });

const FILE_PATTERN = /^(app|audit|error)-(\d{4}-\d{2}-\d{2})\.log$/;

function localDate(d = new Date()): string {
  // Local date (factory timezone), not UTC, so a day's file matches a shift day.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function disableFileSink(err: unknown): void {
  if (state.disabled) return;
  state.disabled = true;
  for (const { stream } of state.streams.values()) stream.end();
  state.streams.clear();
  console.error(
    `[logger] File logging disabled — cannot write to ${loggerConfig.dir}. Console logging continues.`,
    err,
  );
}

function pruneOldFiles(today: string): void {
  if (state.lastPruneDate === today) return;
  state.lastPruneDate = today;
  fs.readdir(loggerConfig.dir, (readErr, files) => {
    if (readErr) return;
    const now = Date.now();
    for (const file of files) {
      const match = FILE_PATTERN.exec(file);
      if (!match) continue;
      const days = match[1] === "audit" ? loggerConfig.auditRetentionDays : loggerConfig.retentionDays;
      const fileTime = new Date(`${match[2]}T00:00:00`).getTime();
      if (Number.isNaN(fileTime) || now - fileTime <= days * 86_400_000) continue;
      fs.unlink(path.join(loggerConfig.dir, file), () => {});
    }
  });
}

function getStream(name: FileName): fs.WriteStream | null {
  const today = localDate();
  const current = state.streams.get(name);
  if (current?.date === today) return current.stream;

  try {
    current?.stream.end();
    fs.mkdirSync(loggerConfig.dir, { recursive: true });
    const stream = fs.createWriteStream(path.join(loggerConfig.dir, `${name}-${today}.log`), { flags: "a" });
    stream.on("error", disableFileSink);
    state.streams.set(name, { date: today, stream });
    pruneOldFiles(today);
    return stream;
  } catch (err) {
    disableFileSink(err);
    return null;
  }
}

export function writeFile(record: LogRecord, line: string, channel: LogChannel): void {
  if (state.disabled) return;
  getStream(channel)?.write(`${line}\n`);
  if (channel === "audit") getStream("app")?.write(`${line}\n`);
  if (record.level === "error") getStream("error")?.write(`${line}\n`);
}
