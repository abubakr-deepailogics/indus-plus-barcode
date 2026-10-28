import {
  getPool,
  sql,
  WORKERS_VIEW,
  CURRENT_PAY_CYCLE_START_SQL,
} from "@/lib/db";
import { fetchPieceRates } from "@/features/coupon-scanning/services/coupon-enrichment.service";
import { findDummyEmployee, searchDummyEmployees } from "@/features/dummy-employees/services/dummy-employees.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const code = searchParams.get("code") || "";

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
      const dummy = await findDummyEmployee(code);
      if (dummy?.isActive) {
        return Response.json({
          EmployeeID: dummy.employeeCode,
          FirstName: dummy.employeeName,
          ParentDepartment: dummy.department,
          DepartmentName: dummy.department,
          DesignationName: "Tracing employee",
          IsDummy: true,
          RestrictedOperationCode: dummy.operationCode,
          AlreadyDailyScan: 0, AlreadyMonthlyScan: 0,
          AlreadyDailyScanPrice: 0, AlreadyMonthlyScanPrice: 0,
        });
      }
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
            WHERE EmployeeID = @code AND EmpStatus = 'Active'
          `),
        (await getPool("pitSystem"))
          .request()
          .input("code", sql.NVarChar, String(codeNum)).query(`
            SELECT WorkOrder, OpNo,
              CASE WHEN CAST(ScannedAt AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS IsToday
            FROM dbo.QrCode_Coupon
            WHERE EmployeeCode = @code
              AND IsScanned = 1
              AND IsDeleted = 0
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

    // 2. Fetch autocomplete suggestions. On focus with an empty query, the
    // bounded active-worker list lets the user choose immediately; typing
    // narrows that same list by employee code or name.
    if (query) {
      const [result, dummyEmployees] = await Promise.all([hrmsPool
        .request()
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT DISTINCT TOP 10 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
          FROM ${WORKERS_VIEW}
          WHERE (CAST(EmployeeID AS VARCHAR(50)) LIKE @q OR FirstName LIKE @q)
            AND EmpStatus = 'Active'
          ORDER BY EmployeeID
        `), searchDummyEmployees(query)]);

      return Response.json([...dummyEmployees.map((employee) => ({
        EmployeeID: employee.employeeCode, FirstName: employee.employeeName,
        ParentDepartment: employee.department, DepartmentName: employee.department,
        DesignationName: "Tracing employee", IsDummy: true,
        RestrictedOperationCode: employee.operationCode,
      })), ...result.recordset].slice(0, 10));
    }

    const [result, dummyEmployees] = await Promise.all([hrmsPool.request().query(`
      SELECT DISTINCT TOP 20 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
      FROM ${WORKERS_VIEW}
      WHERE EmpStatus = 'Active'
      ORDER BY EmployeeID
    `), searchDummyEmployees("")]);
    return Response.json([...dummyEmployees.map((employee) => ({
      EmployeeID: employee.employeeCode, FirstName: employee.employeeName,
      ParentDepartment: employee.department, DepartmentName: employee.department,
      DesignationName: "Tracing employee", IsDummy: true,
      RestrictedOperationCode: employee.operationCode,
    })), ...result.recordset].slice(0, 20));
  } catch (err: unknown) {
    console.error("Workers API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
