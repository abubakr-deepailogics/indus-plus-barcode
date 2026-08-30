import { getPool, sql } from "@/lib/db";
import {
  enrichCouponRows,
  withinCutRange,
} from "@/features/coupon-scanning/services/coupon-enrichment.service";
import { chunk } from "@/features/qr-code-generation/services/coupon-registration.service";

export const dynamic = "force-dynamic";

interface CouponRow {
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  IsScanned: boolean;
  ScannedAt: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode") || "";
  const wo = searchParams.get("wo") || "";
  const bundle = searchParams.get("bundle") || "";
  const op = searchParams.get("op") || "";
  const fromCut = searchParams.get("fromCut") || "";
  const toCut = searchParams.get("toCut") || "";

  const employeeCode = searchParams.get("employeeCode") || "";
  const scanBy = searchParams.get("scanBy") || "";
  const scanDate = searchParams.get("scanDate") || "";
  // "fetch" = lookup only, does not mark coupons as scanned in the DB
  const mode = searchParams.get("mode") || "scan";

  if (!barcode && !wo) {
    return Response.json(
      { error: "Work Order is required in the header before scanning." },
      { status: 400 },
    );
  }

  try {
    // QrCode_Coupon lives on pitSystem; bundle/op display data (cut,
    // size, section, rate, …) is on indusPlus — see coupon-enrichment
    // service for why those can't be joined in one query.
    const pool = await getPool("pitSystem");

    // EmployeeCode/ScanBy/ScannedAt columns are ensured by db/migrations
    // (005, 004) — not re-checked here on every request; see AGENTS.md.

    const result = await pool
      .request()
      .input("barcode", sql.NVarChar, barcode.trim())
      .input("wo", sql.NVarChar, wo.trim())
      .input("bundle", sql.NVarChar, bundle.trim())
      .input("op", sql.NVarChar, op.trim())
      .query(
        barcode.trim() !== ""
          ? `
            SELECT CouponCode, WorkOrder, BundleNo, OpNo, IsScanned, ScannedAt
            FROM dbo.QrCode_Coupon WITH (NOLOCK)
            WHERE CouponCode = @barcode
              AND (@wo = '' OR WorkOrder = @wo)
          `
          : `
            SELECT CouponCode, WorkOrder, BundleNo, OpNo, IsScanned, ScannedAt
            FROM dbo.QrCode_Coupon WITH (NOLOCK)
            WHERE WorkOrder = @wo
              AND (@bundle = '' OR BundleNo = @bundle)
              AND (@op = '' OR OpNo = @op)
          `,
      );

    let records = await enrichCouponRows(result.recordset as CouponRow[]);

    // Cut-range filter only applies to the wo/bundle/op (bulk/selection)
    // path — the barcode path never used it, same as the old query.
    if (!barcode.trim() && (fromCut || toCut)) {
      records = records.filter((r) => withinCutRange(r.CutNo, fromCut, toCut));
    }

    if (records.length === 0) {
      return Response.json(
        { error: "No matching coupon code found in the database." },
        { status: 404 },
      );
    }

    if (barcode) {
      const match = records[0];
      if (match.IsScanned) {
        return Response.json(
          { error: "This coupon barcode has already been scanned!" },
          { status: 400 },
        );
      }

      // Fetch-only mode: return the looked-up coupon without marking it scanned.
      if (mode === "fetch") {
        return Response.json(records);
      }

      // Mark coupon as scanned in the database in a single query
      await pool
        .request()
        .input("barcode", sql.NVarChar, barcode.trim())
        .input("employeeCode", sql.NVarChar, employeeCode.trim())
        .input("scanBy", sql.NVarChar, scanBy.trim())
        .input("scanDate", sql.NVarChar, scanDate.trim()).query(`
          UPDATE dbo.QrCode_Coupon
          SET IsScanned = 1,
              EmployeeCode = NULLIF(@employeeCode, ''),
              ScanBy = NULLIF(@scanBy, ''),
              ScannedAt = COALESCE(TRY_CAST(NULLIF(@scanDate, '') AS DATETIME), GETDATE())
          WHERE CouponCode = @barcode
        `);

      return Response.json(records);
    }

    // If scanning via selection components (WorkOrder / Bundle)
    const unscanned = records.filter((r) => !r.IsScanned);

    if (unscanned.length === 0) {
      return Response.json(
        {
          error:
            "All matching coupons for this selection have already been scanned!",
        },
        { status: 400 },
      );
    }

    // Fetch-only mode: return the looked-up coupons without marking them scanned.
    if (mode === "fetch") {
      return Response.json(unscanned);
    }

    // Mark all matched coupons as scanned — the fromCut/toCut range no
    // longer narrows this in SQL (it's an indusPlus-only field, resolved
    // above in JS), so update exactly the coupon codes that passed the
    // filter rather than re-deriving the condition in a query. Chunked to
    // stay under SQL Server's ~2100 parameter cap for a large selection.
    for (const batch of chunk(unscanned, 2000)) {
      const request_ = pool.request();
      const placeholders = batch.map((r, i) => {
        request_.input(`code${i}`, sql.NVarChar, r.CouponCode);
        return `@code${i}`;
      });
      await request_
        .input("employeeCode", sql.NVarChar, employeeCode.trim())
        .input("scanBy", sql.NVarChar, scanBy.trim())
        .input("scanDate", sql.NVarChar, scanDate.trim()).query(`
          UPDATE dbo.QrCode_Coupon
          SET IsScanned = 1,
              EmployeeCode = NULLIF(@employeeCode, ''),
              ScanBy = NULLIF(@scanBy, ''),
              ScannedAt = COALESCE(TRY_CAST(NULLIF(@scanDate, '') AS DATETIME), GETDATE())
          WHERE CouponCode IN (${placeholders.join(", ")})
        `);
    }

    return Response.json(unscanned);
  } catch (err: unknown) {
    console.error("Coupon scan validation error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
