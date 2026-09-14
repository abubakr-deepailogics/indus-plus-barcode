import { sql } from "@/lib/db";
import type { MatchedCoupon } from "@/app/api/coupons/unscan-or-delete/shared";

// Append-only audit log for coupon unscan/delete actions — see
// db/migrations/023_coupon_action_history.sql. Never updated or deleted
// after being written; one row per coupon per action, capturing who did it,
// when, and (for unscan) who had it scanned immediately before.

const IN_LIST_CHUNK_SIZE = 2000; // stays well under SQL Server's ~2100 parameter cap

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function logCouponActionHistory(
  pool: sql.ConnectionPool,
  action: "unscanned" | "deleted",
  coupons: MatchedCoupon[],
  actedBy: string,
): Promise<void> {
  if (coupons.length === 0) return;
  for (const batch of chunk(coupons, IN_LIST_CHUNK_SIZE)) {
    const request = pool.request();
    request.input("action", sql.NVarChar(20), action);
    request.input("actedBy", sql.NVarChar(100), actedBy);
    const values = batch.map((c, i) => {
      request.input(`code${i}`, sql.NVarChar(200), c.CouponCode);
      request.input(`wo${i}`, sql.NVarChar(100), c.WorkOrder);
      request.input(`bundle${i}`, sql.NVarChar(100), c.BundleNo);
      request.input(`op${i}`, sql.NVarChar(50), c.OpNo);
      request.input(`cut${i}`, sql.NVarChar(50), c.CutNo);
      request.input(`section${i}`, sql.NVarChar(200), c.Section);
      request.input(`genId${i}`, sql.UniqueIdentifier, c.Id);
      request.input(`priorEmp${i}`, sql.NVarChar(50), c.IsScanned ? c.EmployeeCode : null);
      request.input(`priorScannedAt${i}`, sql.DateTime2, c.IsScanned ? c.ScannedAt : null);
      return `(@code${i}, @wo${i}, @bundle${i}, @op${i}, @cut${i}, @section${i}, @genId${i}, @action, @actedBy, @priorEmp${i}, @priorScannedAt${i})`;
    });
    await request.query(`
      INSERT INTO dbo.QrCode_Coupon_ActionHistory
        (CouponCode, WorkOrder, BundleNo, OpNo, CutNo, Section, GenerationId, Action, ActedBy, PriorEmployeeCode, PriorScannedAt)
      VALUES ${values.join(", ")}
    `);
  }
}
