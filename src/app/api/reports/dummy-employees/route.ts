import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const department = (new URL(request.url).searchParams.get("department") || "sewing").trim().toLowerCase();
  try {
    const result = await (await getPool("pitSystem")).request().input("department", sql.NVarChar, department).query(`
      SELECT d.EmployeeCode AS employeeCode, d.EmployeeName AS employeeName, d.Department AS employeeDepartment,
        d.OperationCode AS operationCode, d.OperationName AS operationName,
        COUNT(c.CouponCode) AS couponCount, COUNT(DISTINCT c.WorkOrder) AS workOrdersCount,
        COUNT(c.CouponCode) AS totalQty,
        MAX(c.ScannedAt) AS lastScannedAt
      FROM dbo.DummyEmployee d
      LEFT JOIN dbo.QrCode_Coupon c ON c.EmployeeCode = d.EmployeeCode AND c.IsScanned = 1
        AND c.IsDeleted = 0 AND c.Department = @department
      GROUP BY d.EmployeeCode, d.EmployeeName, d.Department, d.OperationCode, d.OperationName
      ORDER BY lastScannedAt DESC, d.EmployeeName`);
    return Response.json(result.recordset);
  } catch (error) {
    console.error("Dummy employee report failed:", error);
    return Response.json({ error: "Could not load the dummy employee report." }, { status: 500 });
  }
}
