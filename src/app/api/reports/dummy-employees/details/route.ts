import { getPool, sql } from "@/lib/db";
import { enrichCouponRows } from "@/features/coupon-scanning/services/coupon-enrichment.service";
import { findDummyEmployeesByCodes } from "@/features/dummy-employees/services/dummy-employees.service";
import { isCouponDepartment, type CouponDepartment } from "@/lib/department-classification";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = (searchParams.get("department") || "sewing").trim().toLowerCase();
  const employeeCode = (searchParams.get("employee") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  if (!isCouponDepartment(department)) return Response.json({ error: "Invalid department." }, { status: 400 });
  try {
    const db = await getPool("pitSystem");
    const query = db.request().input("department", sql.NVarChar, department).input("employee", sql.NVarChar, employeeCode);
    const conditions = ["c.IsScanned = 1", "c.IsDeleted = 0", "c.Department = @department", "d.IsActive IN (0, 1)", "(@employee = '' OR c.EmployeeCode = @employee)"];
    if (from) { query.input("from", sql.Date, from); conditions.push("c.ScannedAt >= @from"); }
    if (to) { query.input("to", sql.Date, to); conditions.push("c.ScannedAt < DATEADD(day, 1, @to)"); }
    const result = await query.query(`SELECT c.CouponCode, c.WorkOrder, c.BundleNo, c.OpNo, c.EmployeeCode, c.ScannedAt
      FROM dbo.QrCode_Coupon c INNER JOIN dbo.DummyEmployee d ON d.EmployeeCode = c.EmployeeCode
      WHERE ${conditions.join(" AND ")} ORDER BY c.ScannedAt DESC`);
    const enriched = await enrichCouponRows(result.recordset, department as CouponDepartment);
    const employees = await findDummyEmployeesByCodes([...new Set(enriched.map((row) => row.EmployeeCode).filter(Boolean))]);
    return Response.json(enriched.map((row) => ({
      employeeCode: row.EmployeeCode,
      employeeName: employees.get(row.EmployeeCode)?.employeeName ?? row.EmployeeCode,
      workOrder: row.WorkOrder,
      scannedAt: row.ScannedAt,
      operation: row.OperationName || row.OprCode || row.OpNo,
      sam: Number(row.Smv) || 0,
      bundleNo: row.BundleNo,
      quantity: Number(row.Qty) || 0,
      rate: 0,
      incentive: 0,
      totalPay: 0,
    })));
  } catch (error) {
    console.error("Dummy employee detail report failed:", error);
    return Response.json({ error: "Could not load trace activity." }, { status: 500 });
  }
}
