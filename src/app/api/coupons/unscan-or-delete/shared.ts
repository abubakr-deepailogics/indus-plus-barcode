import { getPool, sql } from "@/lib/db";

// Shared by the three routes in this folder (GET status check, POST
// .../unscan, POST .../delete). These filters intentionally mirror Coupon
// Tracing's table filters so the bulk action works against exactly the same
// visible set the user narrowed down on the page.

export interface CouponFilter {
  workOrder: string;
  bundleNo: string;
  opNo: string;
  section: string;
  isScanned?: boolean;
  fromCut: string;
  toCut: string;
}

export function readCouponFilter(
  source: Record<string, unknown>,
): CouponFilter | { error: string } {
  const workOrder = String(source.workOrder ?? "").trim();
  if (!workOrder) {
    return { error: "Missing required field: workOrder." };
  }
  const scannedValue = String(source.isScanned ?? "").trim();
  return {
    workOrder,
    bundleNo: String(source.bundleNo ?? "").trim(),
    opNo: String(source.opNo ?? "").trim(),
    section: String(source.section ?? "").trim(),
    isScanned:
      scannedValue === ""
        ? undefined
        : scannedValue === "true"
          ? true
          : scannedValue === "false"
            ? false
            : undefined,
    fromCut: String(source.fromCut ?? "").trim(),
    toCut: String(source.toCut ?? "").trim(),
  };
}

// Chunked well under SQL Server's ~2100 parameter cap — a single-value IN
// list (1 param per item) can afford a much bigger chunk than a multi-column
// VALUES insert (see coupon-history.service.ts's ROWS_PER_CHUNK for that
// case). Shared by delete/route.ts (opNos/bundleNos cascade) and
// unscan/route.ts (CouponCode IN list) — both can plausibly exceed 2100
// items when a filter matches an entire large work order.
export const IN_LIST_CHUNK_SIZE = 2000;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface MatchedCoupon {
  CouponCode: string;
  IsScanned: boolean;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  CutNo: string | null;
  Section: string | null;
  Id: string | null; // per-generation tracking key, shared by every coupon one "Generate Coupons" run produced
  EmployeeCode: string | null;
  ScannedAt: string | null;
}

export async function findMatchingCoupons(
  pool: Awaited<ReturnType<typeof getPool>>,
  filter: CouponFilter,
): Promise<MatchedCoupon[]> {
  const request = pool
    .request()
    .input("workOrder", sql.NVarChar, filter.workOrder);
  const conditions = ["WorkOrder = @workOrder", "IsDeleted = 0"];
  if (filter.bundleNo) {
    request.input("bundleNo", sql.NVarChar, `%${filter.bundleNo}%`);
    conditions.push("BundleNo LIKE @bundleNo");
  }
  if (filter.opNo) {
    request.input("opNo", sql.NVarChar, `%${filter.opNo}%`);
    conditions.push("OpNo LIKE @opNo");
  }
  if (filter.section) {
    request.input("section", sql.NVarChar, filter.section);
    conditions.push("Section = @section");
  }
  if (filter.isScanned !== undefined) {
    request.input("isScanned", sql.Bit, filter.isScanned);
    conditions.push("IsScanned = @isScanned");
  }
  if (filter.fromCut) {
    request.input("fromCut", sql.NVarChar, filter.fromCut);
    conditions.push("TRY_CAST(CutNo AS INT) >= TRY_CAST(@fromCut AS INT)");
  }
  if (filter.toCut) {
    request.input("toCut", sql.NVarChar, filter.toCut);
    conditions.push("TRY_CAST(CutNo AS INT) <= TRY_CAST(@toCut AS INT)");
  }
  const result = await request.query(`
    SELECT CouponCode, IsScanned, WorkOrder, BundleNo, OpNo, CutNo, Section, Id, EmployeeCode, ScannedAt
    FROM dbo.QrCode_Coupon
    WHERE ${conditions.join(" AND ")}
  `);
  return result.recordset as MatchedCoupon[];
}
