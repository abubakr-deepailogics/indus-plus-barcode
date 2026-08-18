import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const code = searchParams.get("code") || "";

  if (!query && !code) {
    return Response.json([]);
  }

  try {
    const pool = await getPool();

    // 1. Fetch details for a specific EmployeeID (exact match)
    if (code) {
      const codeNum = parseInt(code);
      if (isNaN(codeNum)) {
        return Response.json({ error: "Invalid employee code format." }, { status: 400 });
      }

      // Run auto-migration check in a separate query to avoid compile-time issues
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.columns
          WHERE object_id = OBJECT_ID('dbo.QrCode_Coupon') AND name = 'ScannedAt'
        )
        BEGIN
          ALTER TABLE dbo.QrCode_Coupon ADD ScannedAt DATETIME NULL;
        END
      `);

      const result = await pool
        .request()
        .input("code", sql.Int, codeNum)
        .query(`
          SELECT TOP 1 
            EmployeeID, 
            FirstName, 
            DesignationName, 
            ParentDepartment, 
            DepartmentName,
            (
              SELECT COUNT(*) 
              FROM dbo.QrCode_Coupon 
              WHERE EmployeeCode = CAST(@code AS NVARCHAR(100)) 
                AND IsScanned = 1 
                AND ScannedAt IS NOT NULL 
                AND CAST(ScannedAt AS DATE) = CAST(GETDATE() AS DATE)
            ) AS AlreadyDailyScan,
            (
              SELECT COUNT(*) 
              FROM dbo.QrCode_Coupon 
              WHERE EmployeeCode = CAST(@code AS NVARCHAR(100)) 
                AND IsScanned = 1 
                AND ScannedAt IS NOT NULL 
                AND ScannedAt >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
            ) AS AlreadyMonthlyScan
          FROM dbo.Workers
          WHERE EmployeeID = @code
        `);

      if (result.recordset.length > 0) {
        return Response.json(result.recordset[0]);
      } else {
        return Response.json(null);
      }
    }

    // 2. Fetch autocomplete suggestions matching EmployeeID or FirstName
    if (query) {
      const result = await pool
        .request()
        .input("q", sql.NVarChar, `%${query.trim()}%`)
        .query(`
          SELECT DISTINCT TOP 10 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
          FROM dbo.Workers
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
