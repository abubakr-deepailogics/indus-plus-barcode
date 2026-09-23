import { getPool, sql } from "@/lib/db";

import type { LockedRange } from "../types";

// ── Tenure locking ───────────────────────────────────────────────────────────
// Once a wage is generated for a tenure, every date inside FromDate..ToDate is
// closed to scanning — otherwise a coupon scanned into an already-paid date
// would never be paid for. This replaced the per-coupon IsWageCalculated flag
// (migration 028), which only marked rows that existed at generation time and
// so left later scans into a paid date unlocked.
//
// Every scan path funnels through here rather than re-deriving the condition,
// so a single guard covers single-scan, bulk-selection and batch scanning.

export interface WageLock {
  wageId: number;
  title: string;
  from: string;
  to: string;
}

// The wage whose tenure contains `date` (yyyy-MM-dd), or null when the date is
// open for scanning. Returns null for a blank/unparseable date — callers that
// require a date validate it themselves; an absent date isn't a locked one.
export async function findWageLockForDate(
  date: string,
): Promise<WageLock | null> {
  const trimmed = (date || "").trim();
  if (!trimmed) return null;

  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("scanDate", sql.Date, trimmed)
    .query(`
      SELECT TOP 1 WageId, Title, FromDate, ToDate
      FROM dbo.EmployeeWages WITH (NOLOCK)
      WHERE @scanDate BETWEEN FromDate AND ToDate
      ORDER BY WageId DESC
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return {
    wageId: Number(row.WageId),
    title: String(row.Title ?? ""),
    from: toIsoDate(row.FromDate),
    to: toIsoDate(row.ToDate),
  };
}

// Message shown when a scan is refused because its date is already paid.
export function wageLockMessage(lock: WageLock): string {
  return `Wages already generated for ${lock.from} to ${lock.to} ("${lock.title}"). Scanning is locked for this date — delete that wage first.`;
}

// Every locked tenure, for disabling dates in the scan page's date picker.
export async function fetchLockedRanges(): Promise<LockedRange[]> {
  const pool = await getPool("pitSystem");
  const result = await pool.request().query(`
    SELECT WageId, Title, FromDate, ToDate
    FROM dbo.EmployeeWages WITH (NOLOCK)
    ORDER BY FromDate
  `);

  return result.recordset.map((r) => ({
    wageId: Number(r.WageId),
    title: String(r.Title ?? ""),
    from: toIsoDate(r.FromDate),
    to: toIsoDate(r.ToDate),
  }));
}

export interface LockedDatesResult {
  lockedCount: number;
  locks: LockedRange[];
}

// Bulk equivalent of findWageLockForDate — checks many already-scanned dates
// (e.g. a whole unscan-by-filter batch) against every locked tenure in ONE
// query, rather than one round trip per coupon. Unlike a single new scan
// (which only ever tests one incoming date), a bulk unscan can span many
// dates at once and must know about every locked one it touches, not just
// the first.
//
// `dates` is `unknown[]`, not `string[]` — mssql hands DATETIME columns back
// as native JS Date objects, not strings, despite what a hand-written row
// interface may claim. Reuses the same toIsoDate() every other date read in
// this file goes through, rather than a naive String(date).slice(0, 10)
// (which stringifies a Date as "Mon Sep 15 2026 ...", silently matching
// nothing).
export async function findLockedDates(
  dates: unknown[],
): Promise<LockedDatesResult | null> {
  const ranges = await fetchLockedRanges();
  if (ranges.length === 0) return null;

  let lockedCount = 0;
  const locksHit = new Map<number, LockedRange>();
  for (const raw of dates) {
    if (!raw) continue;
    const d = toIsoDate(raw);
    const hit = ranges.find((r) => d >= r.from && d <= r.to);
    if (hit) {
      lockedCount++;
      locksHit.set(hit.wageId, hit);
    }
  }
  if (lockedCount === 0) return null;
  return { lockedCount, locks: [...locksHit.values()] };
}

// Does [from,to] overlap an existing tenure? A date may belong to only one
// wage, so creation rejects an overlap rather than double-paying it.
export async function findOverlappingWage(
  from: string,
  to: string,
): Promise<WageLock | null> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query(`
      SELECT TOP 1 WageId, Title, FromDate, ToDate
      FROM dbo.EmployeeWages WITH (NOLOCK)
      WHERE FromDate <= @to AND ToDate >= @from
      ORDER BY WageId DESC
    `);

  const row = result.recordset[0];
  if (!row) return null;

  return {
    wageId: Number(row.WageId),
    title: String(row.Title ?? ""),
    from: toIsoDate(row.FromDate),
    to: toIsoDate(row.ToDate),
  };
}

// mssql hands back DATE columns as JS Date objects; the API speaks yyyy-MM-dd.
// Built from the UTC parts because a DATE has no time zone — formatting it
// locally can roll it to the previous day west of UTC.
function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}
