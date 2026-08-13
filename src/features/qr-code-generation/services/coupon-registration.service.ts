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
  section: string;
}

// INSERT...SELECT WHERE NOT EXISTS against a VALUES rowset — one round
// trip per call regardless of row count, skips codes already registered.
// requestTimeout raised above the driver's 15s default — @types/mssql
// doesn't declare pool.request(conf), hence the cast (see pdf/route.ts).
async function insertCouponBatch(pool: sql.ConnectionPool, workOrder: string, batch: CouponRow[]) {
  const request = (pool.request as (conf?: { requestTimeout: number }) => sql.Request)({
    requestTimeout: 60_000,
  });
  const valueList = batch
    .map((row, i) => {
      request.input(`code${i}`, sql.NVarChar, row.couponCode);
      request.input(`bundle${i}`, sql.NVarChar, row.bundleNo);
      request.input(`op${i}`, sql.NVarChar, row.opNo);
      request.input(`section${i}`, sql.NVarChar, row.section || null);
      return `(@code${i}, @bundle${i}, @op${i}, @section${i})`;
    })
    .join(", ");
  await request.input("workOrder", sql.NVarChar, workOrder).query(`
    INSERT INTO dbo.QrCode_Coupon (CouponCode, WorkOrder, BundleNo, OpNo, Section)
    SELECT src.CouponCode, @workOrder, src.BundleNo, src.OpNo, src.Section
    FROM (VALUES ${valueList}) AS src(CouponCode, BundleNo, OpNo, Section)
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
    section: op.section,
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

export interface CouponListRow {
  Id: number;
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  Section: string | null;
  IsScanned: boolean;
  CreatedAt: string;
}

export interface CouponListFilters {
  bundleNo?: string;
  opNo?: string;
  section?: string;
  isScanned?: boolean;
}

// Shared WHERE-clause builder for coupon lookups — bundleNo/opNo match by
// substring (coupons are looked up by partial entry); section/isScanned are
// exact matches (section comes from a dropdown of distinct values, see
// /api/coupons/suggestions?type=section). Applies the same inputs+conditions
// to whichever request object is passed in, so paginated and full-set
// queries stay in sync.
function applyCouponFilters(request: sql.Request, workOrder: string, filters: CouponListFilters) {
  const conditions = ["WorkOrder = @workOrder"];
  request.input("workOrder", sql.NVarChar, workOrder);

  if (filters.bundleNo) {
    conditions.push("BundleNo LIKE @bundleNo");
    request.input("bundleNo", sql.NVarChar, `%${filters.bundleNo}%`);
  }
  if (filters.opNo) {
    conditions.push("OpNo LIKE @opNo");
    request.input("opNo", sql.NVarChar, `%${filters.opNo}%`);
  }
  if (filters.section) {
    conditions.push("Section = @section");
    request.input("section", sql.NVarChar, filters.section);
  }
  if (filters.isScanned !== undefined) {
    conditions.push("IsScanned = @isScanned");
    request.input("isScanned", sql.Bit, filters.isScanned);
  }
  return conditions.join(" AND ");
}

// Server-side page of a work order's coupons — a work order can have
// thousands of rows, so this never loads the full set into the app.
// Backed by IX_QrCode_Coupon_WorkOrder; OFFSET/FETCH needs an ORDER BY.
export async function listCoupons(
  pool: sql.ConnectionPool,
  workOrder: string,
  page: number,
  pageSize: number,
  filters: CouponListFilters = {},
): Promise<{ rows: CouponListRow[]; total: number }> {
  const request = pool.request();
  const where = applyCouponFilters(request, workOrder, filters);

  const countRequest = pool.request();
  applyCouponFilters(countRequest, workOrder, filters);

  const [dataResult, countResult] = await Promise.all([
    request
      .input("offset", sql.Int, (page - 1) * pageSize)
      .input("pageSize", sql.Int, pageSize)
      .query(`
        SELECT Id, CouponCode, WorkOrder, BundleNo, OpNo, Section, IsScanned, CreatedAt
        FROM dbo.QrCode_Coupon
        WHERE ${where}
        ORDER BY Id
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
    countRequest.query(`SELECT COUNT(*) AS total FROM dbo.QrCode_Coupon WHERE ${where}`),
  ]);
  return { rows: dataResult.recordset, total: countResult.recordset[0].total };
}

// Every coupon matching the filters, unpaginated — used for PDF generation
// where the whole filtered set has to be rendered, not one page of it.
export async function listAllCoupons(
  pool: sql.ConnectionPool,
  workOrder: string,
  filters: CouponListFilters = {},
): Promise<CouponListRow[]> {
  const request = pool.request();
  const where = applyCouponFilters(request, workOrder, filters);
  const result = await request.query(`
    SELECT Id, CouponCode, WorkOrder, BundleNo, OpNo, Section, IsScanned, CreatedAt
    FROM dbo.QrCode_Coupon
    WHERE ${where}
    ORDER BY Id
  `);
  return result.recordset;
}
