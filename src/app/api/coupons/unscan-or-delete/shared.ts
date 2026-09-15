import { getPool, sql } from "@/lib/db";

// Shared by the three routes in this folder (GET status check, POST
// .../unscan, POST .../delete): a user keys in whichever of Cut / Bundle /
// Operation they have printed on the coupon(s) in hand — none of the three
// is required. Only Work Order is always required (it's already selected on
// the page this modal is opened from). Whatever subset of Cut/Bundle/Op is
// filled in narrows the match; leaving all three empty scopes the action to
// every coupon on the work order. The match is therefore a set, not a
// single row.

export interface CouponFilter {
  workOrder: string;
  cutNo: string;
  bundleNo: string;
  opNo: string;
}

export function readCouponFilter(
  source: Record<string, unknown>,
): CouponFilter | { error: string } {
  const workOrder = String(source.workOrder ?? "").trim();
  if (!workOrder) {
    return { error: "Missing required field: workOrder." };
  }
  return {
    workOrder,
    cutNo: String(source.cutNo ?? "").trim(),
    bundleNo: String(source.bundleNo ?? "").trim(),
    opNo: String(source.opNo ?? "").trim(),
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
  if (filter.cutNo) {
    request.input("cutNo", sql.NVarChar, filter.cutNo);
    conditions.push("CutNo = @cutNo");
  }
  if (filter.bundleNo) {
    request.input("bundleNo", sql.NVarChar, filter.bundleNo);
    conditions.push("BundleNo = @bundleNo");
  }
  if (filter.opNo) {
    request.input("opNo", sql.NVarChar, filter.opNo);
    conditions.push("OpNo = @opNo");
  }
  const result = await request.query(`
    SELECT CouponCode, IsScanned, WorkOrder, BundleNo, OpNo, CutNo, Section, Id, EmployeeCode, ScannedAt
    FROM dbo.QrCode_Coupon
    WHERE ${conditions.join(" AND ")}
  `);
  return result.recordset as MatchedCoupon[];
}
