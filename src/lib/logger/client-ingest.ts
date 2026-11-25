import { emit } from "./logger";
import { sanitize } from "./sanitize";
import { isLogLevel } from "./types";

// Validates and records a batch of browser log entries posted to /api/logs.
// The endpoint is reachable unauthenticated (errors on /login matter too),
// so everything here is treated as untrusted: bounded size, bounded count,
// sanitized, rate-limited per client.

export const MAX_INGEST_BODY_BYTES = 64 * 1024;
const MAX_ENTRIES_PER_BATCH = 50;
const RATE_WINDOW_MS = 5 * 60_000;
const MAX_ENTRIES_PER_WINDOW = 300;

type Bucket = { windowStart: number; count: number };
const BUCKETS_KEY = Symbol.for("indus.logger.ingestBuckets");
const g = globalThis as unknown as Record<symbol, Map<string, Bucket> | undefined>;
const buckets = (g[BUCKETS_KEY] ??= new Map<string, Bucket>());

function takeQuota(clientKey: string, wanted: number): number {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [key, b] of buckets) if (now - b.windowStart > RATE_WINDOW_MS) buckets.delete(key);
  }
  let bucket = buckets.get(clientKey);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    buckets.set(clientKey, bucket);
  }
  const granted = Math.max(0, Math.min(wanted, MAX_ENTRIES_PER_WINDOW - bucket.count));
  bucket.count += granted;
  return granted;
}

function str(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

export type IngestMeta = {
  clientKey: string; // ip or ip+session, for rate limiting
  userAgent?: string;
  userId?: number;
  userEmail?: string;
};

export type IngestResult = { ok: true; accepted: number } | { ok: false; status: number; error: string };

export function ingestClientLogs(rawBody: string, meta: IngestMeta): IngestResult {
  if (!rawBody) return { ok: false, status: 400, error: "Empty body." };
  if (rawBody.length > MAX_INGEST_BODY_BYTES) return { ok: false, status: 413, error: "Log batch too large." };

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON." };
  }
  const batch = body as { sessionId?: unknown; droppedForRateLimit?: unknown; entries?: unknown };
  if (!batch || !Array.isArray(batch.entries)) return { ok: false, status: 400, error: "entries[] is required." };

  const entries = batch.entries.slice(0, MAX_ENTRIES_PER_BATCH);
  const granted = takeQuota(meta.clientKey, entries.length);
  const sessionId = str(batch.sessionId, 64);

  for (const raw of entries.slice(0, granted)) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const level = isLogLevel(entry.level) ? entry.level : "info";
    const msg = str(entry.msg, 500) || "(no message)";
    emit(level, `client: ${msg}`, {
      source: "client",
      clientTabId: sessionId,
      clientTime: str(entry.time, 40),
      page: str(entry.url, 500),
      userAgent: meta.userAgent?.slice(0, 300),
      ...(meta.userId !== undefined && { userId: meta.userId, user: meta.userEmail }),
      data: sanitize(entry.data),
      breadcrumbs: Array.isArray(entry.breadcrumbs) ? sanitize(entry.breadcrumbs.slice(-30)) : undefined,
    }, {});
  }

  const dropped = Number(batch.droppedForRateLimit) || 0;
  if (granted < entries.length || dropped > 0) {
    emit("warn", "client: log entries dropped by rate limit", {
      source: "client",
      clientTabId: sessionId,
      droppedServerSide: entries.length - granted,
      droppedClientSide: dropped,
    }, {});
  }
  return { ok: true, accepted: granted };
}
