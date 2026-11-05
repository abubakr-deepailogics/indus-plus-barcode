// Scan-date ("tenure") filter shared by Coupon Tracing's list, PDF and
// Unscan / Delete routes. Dates travel as yyyy-MM-dd calendar days and match
// on QrCode_Coupon.ScannedAt, the same column and inclusive-day rule the
// reports use (ScannedAt >= from AND ScannedAt < to + 1 day). Unscanned
// coupons have no ScannedAt, so any scan-date filter excludes them.

export interface ScanDateRange {
  scannedFrom?: string;
  scannedTo?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// A lone bound is a single day (picking one date in the calendar), matching
// how the reports' range label treats it.
export function readScanDateRange(
  fromInput: unknown,
  toInput: unknown,
): ScanDateRange | { error: string } {
  const from = String(fromInput ?? "").trim();
  const to = String(toInput ?? "").trim();
  if (!from && !to) return {};
  if ((from && !isValidIsoDate(from)) || (to && !isValidIsoDate(to))) {
    return { error: "Scan dates must be valid yyyy-MM-dd dates." };
  }
  const scannedFrom = from || to;
  const scannedTo = to || from;
  if (scannedFrom > scannedTo) {
    return { error: "Scan date 'from' must be on or before 'to'." };
  }
  return { scannedFrom, scannedTo };
}

// SQL conditions for a ScannedAt range; the caller binds @scannedFrom and
// @scannedTo as sql.Date when this returns any conditions.
export function scanDateConditions(column: string, range: ScanDateRange): string[] {
  if (!range.scannedFrom || !range.scannedTo) return [];
  return [
    `${column} >= @scannedFrom`,
    `${column} < DATEADD(day, 1, @scannedTo)`,
  ];
}
