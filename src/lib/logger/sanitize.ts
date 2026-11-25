// Turns arbitrary values into JSON-safe, size-bounded, secret-free data.
// Shared by the server logger and the client-log ingest endpoint, so it must
// not import node-only modules.

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 100;
const MAX_STRING_LENGTH = 4000;
const REDACTED = "[REDACTED]";

// Matched against object keys (case-insensitive). Covers the session cookie,
// password fields on auth/user routes and DB connection strings.
const SENSITIVE_KEY =
  /pass(word|wd)?|secret|token|authorization|cookie|session|connection_?string|api_?key|credential|private_?key/i;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key);
}

function truncate(value: string, max = MAX_STRING_LENGTH): string {
  return value.length > max ? `${value.slice(0, max)}…[+${value.length - max} chars]` : value;
}

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  code?: unknown;
  number?: unknown;
  lineNumber?: unknown;
  state?: unknown;
  sqlText?: string;
  digest?: unknown;
  status?: unknown;
  cause?: SerializedError | unknown;
};

export function isErrorLike(value: unknown): value is Error {
  return (
    value instanceof Error ||
    (typeof value === "object" &&
      value !== null &&
      typeof (value as { message?: unknown }).message === "string" &&
      typeof (value as { stack?: unknown }).stack === "string")
  );
}

// Keeps the fields that matter for diagnosis: mssql errors carry
// `number`/`lineNumber`/`state` plus the `sqlText` that src/lib/db.ts
// attaches; Next.js render errors carry `digest`.
export function serializeError(err: unknown, depth = 0): SerializedError {
  if (!isErrorLike(err)) {
    return { name: "NonError", message: truncate(String(err)) };
  }
  const e = err as Error & Record<string, unknown>;
  const out: SerializedError = {
    name: e.name || "Error",
    message: truncate(e.message ?? ""),
  };
  if (typeof e.stack === "string") out.stack = truncate(e.stack, 8000);
  for (const key of ["code", "number", "lineNumber", "state", "digest", "status"] as const) {
    if (e[key] !== undefined) out[key] = e[key];
  }
  if (typeof e.sqlText === "string") out.sqlText = truncate(e.sqlText);
  // mssql wraps the driver error as `originalError`; `cause` is the standard.
  const nested = e.cause ?? e.originalError;
  if (nested !== undefined && depth < 3) {
    out.cause = isErrorLike(nested) ? serializeError(nested, depth + 1) : sanitize(nested, depth + 1);
  }
  return out;
}

export function sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;

  switch (typeof value) {
    case "string":
      return truncate(value);
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "symbol":
      return value.toString();
    case "function":
      return `[Function ${(value as { name?: string }).name || "anonymous"}]`;
  }

  const obj = value as object;
  if (isErrorLike(obj)) return serializeError(obj, depth);
  if (obj instanceof Date) return Number.isNaN(obj.getTime()) ? "Invalid Date" : obj.toISOString();
  if (typeof Uint8Array !== "undefined" && obj instanceof Uint8Array) return `[Binary ${obj.byteLength} bytes]`;
  if (typeof URL !== "undefined" && obj instanceof URL) return obj.toString();
  if (depth >= MAX_DEPTH) return "[Truncated]";
  if (seen.has(obj)) return "[Circular]";
  seen.add(obj);

  if (Array.isArray(obj)) {
    const items = obj.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitize(item, depth + 1, seen));
    if (obj.length > MAX_ARRAY_ITEMS) items.push(`…[+${obj.length - MAX_ARRAY_ITEMS} items]`);
    return items;
  }
  if (obj instanceof Map) return sanitize(Object.fromEntries(obj), depth, seen);
  if (obj instanceof Set) return sanitize(Array.from(obj), depth, seen);

  const out: Record<string, unknown> = {};
  const keys = Object.keys(obj);
  for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
    out[key] = isSensitiveKey(key) ? REDACTED : sanitize((obj as Record<string, unknown>)[key], depth + 1, seen);
  }
  if (keys.length > MAX_OBJECT_KEYS) out["…"] = `+${keys.length - MAX_OBJECT_KEYS} keys`;
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Normalizes the `data` argument of a log call into record fields:
 * an Error becomes `{ err }`, a plain object is spread, anything else is
 * kept under `data`.
 */
export function normalizeLogData(data: unknown): Record<string, unknown> {
  if (data === undefined) return {};
  if (isErrorLike(data)) return { err: serializeError(data) };
  if (isPlainObject(data)) {
    const out = sanitize(data) as Record<string, unknown>;
    // Conventional spelling: always surface errors as `err`.
    if (out.error !== undefined && out.err === undefined && isErrorLike(data.error)) {
      out.err = out.error;
      delete out.error;
    }
    return out;
  }
  return { data: sanitize(data) };
}
