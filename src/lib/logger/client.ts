/* eslint-disable no-console -- this module is the browser console sink. */
// Browser-side logging. Mirrors the server logger's API:
//
//   import { clientLogger } from "@/lib/logger/client";
//   clientLogger.error("Batch scan failed", err);
//
// warn/error entries (and anything at or above NEXT_PUBLIC_CLIENT_LOG_LEVEL)
// are batched and shipped to POST /api/logs, where they are written to the
// server log with the user, page and last ~30 breadcrumbs (navigations, API
// calls, earlier log lines) attached. Uncaught errors, unhandled rejections and
// failed /api calls are captured automatically by installClientObservability()
// (called from src/instrumentation-client.ts).

import { REQUEST_ID_HEADER, generateRequestId } from "./request-id";
import { isErrorLike, sanitize } from "./sanitize";
import { LEVEL_WEIGHT, isLogLevel, type LogLevel } from "./types";

type Breadcrumb = { time: string; category: string; message: string; data?: unknown };

export type ClientLogEntry = {
  level: LogLevel;
  msg: string;
  time: string;
  url: string;
  data?: unknown;
  breadcrumbs?: Breadcrumb[];
};

const INGEST_PATH = "/api/logs";
const MAX_BREADCRUMBS = 30;
const MAX_QUEUE = 50;
const FLUSH_DELAY_MS = 2000;
const RATE_LIMIT_PER_MINUTE = 30;
const DEDUPE_WINDOW_MS = 10_000;

const isBrowser = typeof window !== "undefined";
const isDev = process.env.NODE_ENV !== "production";
const configuredLevel = process.env.NEXT_PUBLIC_CLIENT_LOG_LEVEL?.toLowerCase();
const shipWeight = LEVEL_WEIGHT[isLogLevel(configuredLevel) ? configuredLevel : "warn"];

const breadcrumbs: Breadcrumb[] = [];
let queue: ClientLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let shippedThisMinute = 0;
let minuteStartedAt = 0;
let droppedForRateLimit = 0;
const recentFingerprints = new Map<string, number>();

// Captured before installFetchTracing() patches window.fetch, so shipping
// logs never recurses through the tracing wrapper.
let nativeFetch: typeof fetch | undefined = isBrowser ? window.fetch.bind(window) : undefined;

function clientSessionId(): string {
  try {
    const key = "indus.logSessionId";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = generateRequestId();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "unavailable";
  }
}

function normalize(data: unknown): unknown {
  if (data === undefined) return undefined;
  return isErrorLike(data) ? { err: sanitize(data) } : sanitize(data);
}

export function addBreadcrumb(category: string, message: string, data?: unknown): void {
  breadcrumbs.push({ time: new Date().toISOString(), category, message, data: normalize(data) });
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.shift();
}

function allowedByRateLimit(entry: ClientLogEntry): boolean {
  const now = Date.now();
  // Same error firing in a render loop: ship it once per window.
  const fingerprint = `${entry.level}|${entry.msg}|${JSON.stringify(entry.data ?? "").slice(0, 300)}`;
  const last = recentFingerprints.get(fingerprint);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false;
  recentFingerprints.set(fingerprint, now);
  if (recentFingerprints.size > 200) recentFingerprints.clear();

  if (now - minuteStartedAt > 60_000) {
    minuteStartedAt = now;
    shippedThisMinute = 0;
  }
  if (shippedThisMinute >= RATE_LIMIT_PER_MINUTE) {
    droppedForRateLimit++;
    return false;
  }
  shippedThisMinute++;
  return true;
}

function flush(useBeacon = false): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (!queue.length || !isBrowser) return;
  const entries = queue;
  queue = [];
  const body = JSON.stringify({
    sessionId: clientSessionId(),
    droppedForRateLimit,
    entries,
  });
  droppedForRateLimit = 0;

  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(INGEST_PATH, new Blob([body], { type: "application/json" }));
      return;
    }
    void (nativeFetch ?? fetch)(INGEST_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // Server unreachable — nothing more we can do; don't loop.
    });
  } catch {
    // Never let log shipping throw into app code.
  }
}

function scheduleFlush(): void {
  if (flushTimer || !isBrowser) return;
  flushTimer = setTimeout(() => flush(), FLUSH_DELAY_MS);
}

function log(level: LogLevel, msg: string, data?: unknown): void {
  if (isDev || LEVEL_WEIGHT[level] >= LEVEL_WEIGHT.warn) {
    const method = level === "debug" ? "debug" : level;
    if (data === undefined) console[method](msg);
    else console[method](msg, data);
  }
  if (!isBrowser || LEVEL_WEIGHT[level] < shipWeight) {
    addBreadcrumb("log", `${level}: ${msg}`);
    return;
  }

  const entry: ClientLogEntry = {
    level,
    msg: msg.slice(0, 500),
    time: new Date().toISOString(),
    url: window.location.pathname + window.location.search,
    data: normalize(data),
    ...(level === "error" && { breadcrumbs: breadcrumbs.slice() }),
  };
  addBreadcrumb("log", `${level}: ${msg}`);
  if (!allowedByRateLimit(entry)) return;

  queue.push(entry);
  if (queue.length >= MAX_QUEUE) flush();
  else scheduleFlush();
}

export const clientLogger = {
  debug: (msg: string, data?: unknown) => log("debug", msg, data),
  info: (msg: string, data?: unknown) => log("info", msg, data),
  warn: (msg: string, data?: unknown) => log("warn", msg, data),
  error: (msg: string, data?: unknown) => log("error", msg, data),
};

// ---------------------------------------------------------------------------
// Automatic capture
// ---------------------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

function resolveApiUrl(input: RequestInfo | URL): URL | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (!url.pathname.startsWith("/api/") || url.pathname === INGEST_PATH) return null;
    return url;
  } catch {
    return null;
  }
}

// Tags every same-origin /api call with an x-request-id (so its server log
// lines carry the same id), records it as a breadcrumb, and reports 5xx and
// network failures with that id — the bridge between browser and server logs.
function installFetchTracing(): void {
  const original = nativeFetch ?? window.fetch.bind(window);
  nativeFetch = original;

  window.fetch = async function tracedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = resolveApiUrl(input);
    if (!url) return original(input, init);

    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const requestId = headers.get(REQUEST_ID_HEADER) ?? generateRequestId();
    headers.set(REQUEST_ID_HEADER, requestId);
    const path = url.pathname + url.search;
    const started = performance.now();

    try {
      const response =
        input instanceof Request ? await original(new Request(input, { ...init, headers })) : await original(input, { ...init, headers });
      const durationMs = Math.round(performance.now() - started);
      addBreadcrumb("fetch", `${method} ${path} ${response.status} ${durationMs}ms`, { requestId });
      if (response.status >= 500) {
        clientLogger.error("API request failed", { method, path, status: response.status, durationMs, requestId });
      }
      return response;
    } catch (err) {
      const durationMs = Math.round(performance.now() - started);
      if (isAbortError(err)) {
        addBreadcrumb("fetch", `${method} ${path} aborted ${durationMs}ms`, { requestId });
      } else {
        clientLogger.warn("API network error", { method, path, durationMs, requestId, err });
      }
      throw err;
    }
  };
}

let installed = false;

export function installClientObservability(): void {
  if (!isBrowser || installed) return;
  installed = true;

  try {
    installFetchTracing();
  } catch (err) {
    console.error("[logger] fetch tracing not installed", err);
  }

  window.addEventListener("error", (event) => {
    // Resource load failures (img/script) have no `error` and aren't app bugs.
    if (!event.error && !event.message) return;
    clientLogger.error("Uncaught error", {
      err: event.error ?? event.message,
      source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isAbortError(event.reason)) return;
    clientLogger.error("Unhandled promise rejection", { err: event.reason });
  });

  // Ship whatever is queued before the tab goes away.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}
