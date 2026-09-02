import { getPool, sql, WORKERS_VIEW } from "@/lib/db";
import { enrichCouponRows } from "@/features/coupon-scanning/services/coupon-enrichment.service";

export const dynamic = "force-dynamic";

// Raw QrCode_Coupon shape needed by enrichCouponRows (WorkOrder/BundleNo/OpNo)
// plus the extra columns this report surfaces per row.
interface ScannedCouponRow {
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  ScannedAt: string | null;
}

// GET /api/reports/employee-summary?code=<EmployeeID>&from=<yyyy-MM-dd>&to=<yyyy-MM-dd>
//
// `from`/`to` are optional and inclusive on both ends; omitting either (or
// both) reports all-time totals. Employee identity lives on hrms, scanned
// coupons live on pitSystem, and the per-operation rate (needed to price
// each scan) lives on indusPlus — three separate SQL Server instances, so
// this fetches each side separately and merges in JS (same reasoning as
// /api/workers and coupon-enrichment.service.ts).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();

  if (!code) {
    return Response.json({ error: "Employee code is required." }, { status: 400 });
  }

  const codeNum = parseInt(code, 10);
  if (isNaN(codeNum)) {
    return Response.json({ error: "Invalid employee code format." }, { status: 400 });
  }

  try {
    const [hrmsPool, pitPool] = await Promise.all([
      getPool("hrms"),
      getPool("pitSystem"),
    ]);

    const couponConditions = ["EmployeeCode = @code", "IsScanned = 1"];
    const couponRequest = pitPool.request().input("code", sql.NVarChar, String(codeNum));
    if (from) {
      couponRequest.input("from", sql.Date, from);
      couponConditions.push("ScannedAt >= @from");
    }
    if (to) {
      couponRequest.input("to", sql.Date, to);
      // Exclusive upper bound one day out, so the `to` day itself is fully
      // included regardless of the time-of-day portion of ScannedAt.
      couponConditions.push("ScannedAt < DATEADD(day, 1, @to)");
    }

    const [workerResult, couponResult] = await Promise.all([
      hrmsPool
        .request()
        .input("code", sql.Int, codeNum)
        .query(`
          SELECT TOP 1 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
          FROM ${WORKERS_VIEW}
          WHERE EmployeeID = @code
        `),
      couponRequest.query(`
        SELECT CouponCode, WorkOrder, BundleNo, OpNo, ScannedAt
        FROM dbo.QrCode_Coupon
        WHERE ${couponConditions.join(" AND ")}
        ORDER BY ScannedAt DESC
      `),
    ]);

    if (workerResult.recordset.length === 0) {
      return Response.json({ error: "Employee not found." }, { status: 404 });
    }

    const rows = couponResult.recordset as ScannedCouponRow[];
    const enriched = await enrichCouponRows(rows);
    const totalAmount = enriched.reduce((sum, row) => sum + (row.Value ?? 0), 0);
    const totalWorkOrders = new Set(enriched.map((row) => row.WorkOrder)).size;

    return Response.json({
      employee: workerResult.recordset[0],
      totalCoupons: enriched.length,
      totalWorkOrders,
      totalAmount,
    });
  } catch (err: unknown) {
    console.error("Employee report API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
