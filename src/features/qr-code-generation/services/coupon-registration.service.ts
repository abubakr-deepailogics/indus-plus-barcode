import { sql } from "@/lib/db";
import { buildCouponCode } from "./coupon-code";
import type { CouponCard } from "./coupon-pairing.service";

// 4 params/row (couponCode, workOrder, bundleNo, opNo) — SQL Server caps
// query params at 2100, so this stays comfortably under that per batch.
const CHUNK_SIZE = 500;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface CouponRow {
  couponCode: string;
  bundleNo: string;
  opNo: string;
}

// INSERT...SELECT WHERE NOT EXISTS against a VALUES rowset — one round
// trip per call regardless of row count, skips codes already registered.
async function insertCouponBatch(pool: sql.ConnectionPool, workOrder: string, batch: CouponRow[]) {
  const request = pool.request();
  const valueList = batch
    .map((row, i) => {
      request.input(`code${i}`, sql.NVarChar, row.couponCode);
      request.input(`bundle${i}`, sql.NVarChar, row.bundleNo);
      request.input(`op${i}`, sql.NVarChar, row.opNo);
      return `(@code${i}, @bundle${i}, @op${i})`;
    })
    .join(", ");
  await request.input("workOrder", sql.NVarChar, workOrder).query(`
    INSERT INTO dbo.QrCode_Coupon (CouponCode, WorkOrder, BundleNo, OpNo)
    SELECT src.CouponCode, @workOrder, src.BundleNo, src.OpNo
    FROM (VALUES ${valueList}) AS src(CouponCode, BundleNo, OpNo)
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.QrCode_Coupon existing WHERE existing.CouponCode = src.CouponCode
    )
  `);
}

// Registers every card's coupon identity in dbo.QrCode_Coupon, chunked so
// thousands of coupons take a handful of round trips instead of one per
// coupon. Safe to call repeatedly — codes already registered are skipped.
export async function registerCoupons(pool: sql.ConnectionPool, workOrder: string, cards: CouponCard[]) {
  const rows = cards.map(({ bundle, op }) => ({
    couponCode: buildCouponCode(workOrder, bundle.bundleNo, op.opNo),
    bundleNo: bundle.bundleNo,
    opNo: op.opNo,
  }));

  for (const batch of chunk(rows, CHUNK_SIZE)) {
    try {
      await insertCouponBatch(pool, workOrder, batch);
    } catch (err: unknown) {
      // 2627/2601 = unique constraint violation — two concurrent requests
      // raced on the same coupon(s) between the NOT EXISTS check and the
      // insert. Fall back to one-by-one for just this batch so a rare
      // race doesn't fail the whole run; anything else is a real error.
      const num = (err as { number?: number }).number;
      if (num !== 2627 && num !== 2601) throw err;
      for (const row of batch) {
        try {
          await insertCouponBatch(pool, workOrder, [row]);
        } catch (rowErr: unknown) {
          const rowNum = (rowErr as { number?: number }).number;
          if (rowNum !== 2627 && rowNum !== 2601) throw rowErr;
        }
      }
    }
  }
}

export async function countCoupons(pool: sql.ConnectionPool, workOrder: string): Promise<number> {
  const result = await pool
    .request()
    .input("workOrder", sql.NVarChar, workOrder)
    .query(`SELECT COUNT(*) AS total FROM dbo.QrCode_Coupon WHERE WorkOrder = @workOrder`);
  return result.recordset[0].total;
}
