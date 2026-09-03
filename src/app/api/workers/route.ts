import {
  getPool,
  sql,
  WORKERS_VIEW,
  CURRENT_PAY_CYCLE_START_SQL,
} from "@/lib/db";
import { fetchPieceRates } from "@/features/coupon-scanning/services/coupon-enrichment.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const code = searchParams.get("code") || "";

  if (!query && !code) {
    return Response.json([]);
  }

  try {
    // Cross-server: Workers lives in hrms (172.16.0.15), QrCode_Coupon in
    // pitSystem (localhost) — genuinely different SQL Server instances, not
    // just different databases on one server. A bare `dbo.QrCode_Coupon`
    // reference from the hrms pool resolves against HRMS_Central, where
    // that table doesn't exist ("Invalid object name") — so the two lookups
    // have to run on their own pools and get merged here in JS.
    const hrmsPool = await getPool("hrms");

    // 1. Fetch details for a specific EmployeeID (exact match)
    if (code) {
      const codeNum = parseInt(code);
      if (isNaN(codeNum)) {
        return Response.json(
          { error: "Invalid employee code format." },
          { status: 400 },
        );
      }

      const [workerResult, scanRowsResult] = await Promise.all([
        hrmsPool.request().input("code", sql.Int, codeNum).query(`
            SELECT TOP 1 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
            FROM ${WORKERS_VIEW}
            WHERE EmployeeID = @code
          `),
        (await getPool("pitSystem"))
          .request()
          .input("code", sql.NVarChar, String(codeNum)).query(`
            SELECT WorkOrder, OpNo,
              CASE WHEN CAST(ScannedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS IsToday
            FROM dbo.QrCode_Coupon
            WHERE EmployeeCode = @code
              AND IsScanned = 1
              AND ScannedAt IS NOT NULL
              AND ScannedAt >= ${CURRENT_PAY_CYCLE_START_SQL}
          `),
      ]);

      if (workerResult.recordset.length === 0) {
        return Response.json(null);
      }

      const scanRows = scanRowsResult.recordset as {
        WorkOrder: string;
        OpNo: string;
        IsToday: number;
      }[];
      const withRates = await fetchPieceRates(scanRows);

      let dailyScan = 0;
      let monthlyScan = 0;
      let dailyScanPrice = 0;
      let monthlyScanPrice = 0;
      for (const row of withRates) {
        monthlyScan++;
        monthlyScanPrice += row.Rate ?? 0;
        if (row.IsToday) {
          dailyScan++;
          dailyScanPrice += row.Rate ?? 0;
        }
      }

      return Response.json({
        ...workerResult.recordset[0],
        AlreadyDailyScan: dailyScan,
        AlreadyMonthlyScan: monthlyScan,
        AlreadyDailyScanPrice: dailyScanPrice,
        AlreadyMonthlyScanPrice: monthlyScanPrice,
      });
    }

    // 2. Fetch autocomplete suggestions matching EmployeeID or FirstName
    if (query) {
      const result = await hrmsPool
        .request()
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT DISTINCT TOP 10 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
          FROM ${WORKERS_VIEW}
          WHERE CAST(EmployeeID AS VARCHAR(50)) LIKE @q OR FirstName LIKE @q
          ORDER BY EmployeeID
        `);

      return Response.json(result.recordset);
    }
  } catch (err: unknown) {
    console.error("Workers API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
