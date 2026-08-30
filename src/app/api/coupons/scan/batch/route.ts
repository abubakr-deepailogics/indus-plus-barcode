import { getPool, sql } from "@/lib/db";
import { enrichCouponRows } from "@/features/coupon-scanning/services/coupon-enrichment.service";

export const dynamic = "force-dynamic";

// mssql's TVP support (sql.Table) has no @types/mssql declarations — same
// cast pattern as coupon-registration.service.ts's buildCouponRowsTable.
function buildCodeListTable(codes: string[]): sql.Table {
  const table = new sql.Table("dbo.CouponCodeListType") as unknown as {
    columns: { add: (name: string, type: unknown) => void };
    rows: { add: (...values: unknown[]) => void };
  };
  table.columns.add("CouponCode", sql.NVarChar(200));
  for (const code of codes) table.rows.add(code);
  return table as unknown as sql.Table;
}

interface ScannedRecord {
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  IsScanned: boolean;
  ScannedAt?: string;
}

// Batch version of GET /api/coupons/scan — a scanner gun fires codes fast,
// so the client debounces a burst of codes and POSTs them here as one
// array. One TVP-driven UPDATE (with OUTPUT to capture exactly which codes
// were actually flipped) plus one join SELECT for full row detail — two
// round trips total regardless of batch size, instead of one HTTP+DB round
// trip per coupon.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const codes: string[] = Array.isArray(body.barcodes)
      ? body.barcodes.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];
    const employeeCode = String(body.employeeCode || "").trim();
    const scanBy = String(body.scanBy || "").trim();
    const scanDate = String(body.scanDate || "").trim();

    if (codes.length === 0) {
      return Response.json(
        { error: "No coupon codes provided." },
        { status: 400 },
      );
    }

    // QrCode_Coupon lives on pitSystem; bundle/op display data is on
    // indusPlus — see coupon-enrichment service for why those can't be
    // joined in one query.
    const pool = await getPool("pitSystem");
    const request_ = pool.request();
    request_.input("Codes", buildCodeListTable(codes));
    request_.input("employeeCode", sql.NVarChar, employeeCode);
    request_.input("scanBy", sql.NVarChar, scanBy);
    request_.input("scanDate", sql.NVarChar, scanDate);

    // Only flips codes that exist AND aren't already scanned — codes that
    // don't match or were already scanned are silently excluded from
    // `updated` (and cross-referenced against the input below) so the
    // client can report them separately without a second query.
    const updateResult = await request_.query(`
      DECLARE @Updated TABLE (CouponCode NVARCHAR(200));

      UPDATE c
      SET IsScanned = 1,
          EmployeeCode = NULLIF(@employeeCode, ''),
          ScanBy = NULLIF(@scanBy, ''),
          ScannedAt = COALESCE(TRY_CAST(NULLIF(@scanDate, '') AS DATETIME), GETDATE())
      OUTPUT inserted.CouponCode INTO @Updated
      FROM dbo.QrCode_Coupon c
      INNER JOIN @Codes src ON src.CouponCode = c.CouponCode
      WHERE c.IsScanned = 0;

      SELECT c.CouponCode, c.WorkOrder, c.BundleNo, c.OpNo, c.IsScanned, c.ScannedAt
      FROM @Updated u
      INNER JOIN dbo.QrCode_Coupon c ON c.CouponCode = u.CouponCode;
    `);

    // mssql returns one recordset per SELECT; the bare UPDATE...OUTPUT
    // doesn't add one, so the join SELECT is recordsets[0]. @types/mssql
    // types `recordsets` as array-or-map, hence the cast (same pattern as
    // the sql.Table casts above).
    const recordsets = updateResult.recordsets as unknown as ScannedRecord[][];
    const scannedRows: ScannedRecord[] =
      updateResult.recordset ?? recordsets[0] ?? [];
    const scanned = await enrichCouponRows(scannedRows);
    const scannedCodes = new Set(scanned.map((r) => r.CouponCode));
    const failed = codes.filter((c) => !scannedCodes.has(c));

    return Response.json({ scanned, failed });
  } catch (err: unknown) {
    console.error("Batch coupon scan error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
