import { sql } from "@/lib/db";
import { buildCouponCode } from "./coupon-code";
import type { CouponCard } from "./coupon-pairing.service";

// Number of TVP round trips a registration run is split into — a divisor
// of the row count, not a fixed row-count-per-chunk. A TVP has no 2100-param
// cap to dodge (unlike the old VALUES-list insert), so the split here is
// purely to give onProgress something to report between chunks; 4 gives the
// UI a handful of progress ticks without turning a huge work order into
// hundreds of tiny round trips. Small runs still get at least 1 row/chunk.
const CHUNK_COUNT = 4;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Splits into ~CHUNK_COUNT roughly even pieces (last chunk absorbs the
// remainder) rather than fixed-size chunks — a work order's row count is
// unpredictable, so this keeps chunk count stable instead of chunk size.
function chunkEvenly<T>(items: T[], count: number): T[][] {
  if (items.length === 0) return [];
  const size = Math.max(1, Math.ceil(items.length / count));
  return chunk(items, size);
}

interface CouponRow {
  couponCode: string;
  bundleNo: string;
  opNo: string;
  section: string;
  cutNo: string;
}

// mssql's TVP support (sql.Table) has no @types/mssql declarations, so it's
// typed loosely here the same way pool.request(conf) is cast elsewhere in
// this file — see the requestTimeout cast below.
function buildCouponRowsTable(batch: CouponRow[]): sql.Table {
  const table = new sql.Table("dbo.CouponRowType") as unknown as {
    columns: { add: (name: string, type: unknown, opts?: { nullable?: boolean }) => void };
    rows: { add: (...values: unknown[]) => void };
  };
  table.columns.add("CouponCode", sql.NVarChar(200));
  table.columns.add("BundleNo", sql.NVarChar(100));
  table.columns.add("OpNo", sql.NVarChar(50));
  table.columns.add("Section", sql.NVarChar(200), { nullable: true });
  table.columns.add("CutNo", sql.NVarChar(50), { nullable: true });
  for (const row of batch) {
    table.rows.add(row.couponCode, row.bundleNo, row.opNo, row.section || null, row.cutNo || null);
  }
  return table as unknown as sql.Table;
}

// INSERT...SELECT WHERE NOT EXISTS against a TVP rowset — one round trip
// per chunk regardless of chunk size, skips codes already registered.
// requestTimeout raised above the driver's 15s default — @types/mssql
// doesn't declare pool.request(conf), hence the cast (see pdf/route.ts).
async function insertCouponBatch(pool: sql.ConnectionPool, workOrder: string, batch: CouponRow[]) {
  const request = (pool.request as (conf?: { requestTimeout: number }) => sql.Request)({
    requestTimeout: 60_000,
  });
  await request
    .input("workOrder", sql.NVarChar, workOrder)
    .input("CouponRows", buildCouponRowsTable(batch))
    .query(`
      INSERT INTO dbo.QrCode_Coupon (CouponCode, WorkOrder, BundleNo, OpNo, Section, CutNo)
      SELECT src.CouponCode, @workOrder, src.BundleNo, src.OpNo, src.Section, src.CutNo
      FROM @CouponRows src
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.QrCode_Coupon existing WHERE existing.CouponCode = src.CouponCode
      )
    `);
}

// Registers every card's coupon identity in dbo.QrCode_Coupon, chunked so
// thousands of coupons take a handful of round trips instead of one per
// coupon. Safe to call repeatedly — codes already registered are skipped.
// onProgress (optional) fires after each chunk with the running count of
// rows attempted so far (dupes included) — it always reaches `total`
// regardless of how many rows turned out to be dupes/skipped.
export async function registerCoupons(
  pool: sql.ConnectionPool,
  workOrder: string,
  cards: CouponCard[],
  onProgress?: (done: number, total: number) => void,
) {
  const rows = cards.map(({ bundle, op }) => ({
    couponCode: buildCouponCode(workOrder, bundle.bundleNo, op.opNo),
    bundleNo: bundle.bundleNo,
    opNo: op.opNo,
    section: op.section,
    cutNo: bundle.cutNo,
  }));

  const total = rows.length;
  let done = 0;
  for (const batch of chunkEvenly(rows, CHUNK_COUNT)) {
    try {
      await insertCouponBatch(pool, workOrder, batch);
    } catch (err: unknown) {
      // 2627/2601 = unique constraint violation — two concurrent requests
      // raced on the same coupon(s) between the NOT EXISTS check and the
      // insert. Fall back to one-by-one for just this chunk so a rare
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
    done += batch.length;
    onProgress?.(done, total);
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
  CutNo?: string | null;
  OpName?: string | null;
  EmployeeCode?: string | null;
  EmployeeName?: string | null;
  ScannedAt?: string | null;
}

export interface CouponListFilters {
  bundleNo?: string;
  opNo?: string;
  section?: string;
  isScanned?: boolean;
  fromCut?: string;
  toCut?: string;
}

// Shared WHERE-clause builder for coupon lookups — bundleNo/opNo match by
// substring (coupons are looked up by partial entry); section/isScanned are
// exact matches (section comes from a dropdown of distinct values, see
// /api/coupons/suggestions?type=section). Applies the same inputs+conditions
// to whichever request object is passed in, so paginated and full-set
// queries stay in sync.
function applyCouponFilters(request: sql.Request, workOrder: string, filters: CouponListFilters) {
  const conditions = ["c.WorkOrder = @workOrder"];
  request.input("workOrder", sql.NVarChar, workOrder);

  if (filters.bundleNo) {
    conditions.push("c.BundleNo LIKE @bundleNo");
    request.input("bundleNo", sql.NVarChar, `%${filters.bundleNo}%`);
  }
  if (filters.opNo) {
    conditions.push("c.OpNo LIKE @opNo");
    request.input("opNo", sql.NVarChar, `%${filters.opNo}%`);
  }
  if (filters.section) {
    conditions.push("c.Section = @section");
    request.input("section", sql.NVarChar, filters.section);
  }
  if (filters.isScanned !== undefined) {
    conditions.push("c.IsScanned = @isScanned");
    request.input("isScanned", sql.Bit, filters.isScanned);
  }
  if (filters.fromCut) {
    conditions.push("TRY_CAST(c.CutNo AS INT) >= TRY_CAST(@fromCut AS INT)");
    request.input("fromCut", sql.NVarChar, filters.fromCut);
  }
  if (filters.toCut) {
    conditions.push("TRY_CAST(c.CutNo AS INT) <= TRY_CAST(@toCut AS INT)");
    request.input("toCut", sql.NVarChar, filters.toCut);
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
        SELECT 
          c.Id, c.CouponCode, c.WorkOrder, c.BundleNo, c.OpNo, c.Section, c.IsScanned, c.CreatedAt, c.CutNo,
          sb.Operation_Name AS OpName,
          c.EmployeeCode,
          w.FirstName AS EmployeeName,
          c.ScannedAt
        FROM dbo.QrCode_Coupon c
        OUTER APPLY (
          SELECT TOP 1 sb.Operation_Name
          FROM dbo.StyleBulletinInt sb
          WHERE sb.Order_No = c.WorkOrder AND sb.Operation_Code = c.OpNo
        ) sb
        LEFT JOIN dbo.Workers w ON w.EmployeeID = TRY_CAST(c.EmployeeCode AS INT)
        WHERE ${where}
        ORDER BY c.Id
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `),
    countRequest.query(`SELECT COUNT(*) AS total FROM dbo.QrCode_Coupon c WHERE ${where}`),
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
    SELECT 
      c.Id, c.CouponCode, c.WorkOrder, c.BundleNo, c.OpNo, c.Section, c.IsScanned, c.CreatedAt, c.CutNo,
      sb.Operation_Name AS OpName,
      c.EmployeeCode,
      w.FirstName AS EmployeeName,
      c.ScannedAt
    FROM dbo.QrCode_Coupon c
    OUTER APPLY (
      SELECT TOP 1 sb.Operation_Name
      FROM dbo.StyleBulletinInt sb
      WHERE sb.Order_No = c.WorkOrder AND sb.Operation_Code = c.OpNo
    ) sb
    LEFT JOIN dbo.Workers w ON w.EmployeeID = TRY_CAST(c.EmployeeCode AS INT)
    WHERE ${where}
    ORDER BY c.Id
  `);
  return result.recordset;
}
