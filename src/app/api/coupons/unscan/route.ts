import { getPool, sql } from "@/lib/db";
import { isCouponDepartment } from "@/lib/department-classification";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { couponCode, department } = await request.json();

    if (!couponCode) {
      return Response.json(
        { error: "Coupon Code is required." },
        { status: 400 }
      );
    }
    const normalizedDepartment = String(department || "sewing").trim().toLowerCase();
    if (!isCouponDepartment(normalizedDepartment)) {
      return Response.json({ error: "Invalid department." }, { status: 400 });
    }

    const pool = await getPool("pitSystem");

    // Reset IsScanned, EmployeeCode, and ScanBy columns to unscan the coupon
    const result = await pool
      .request()
      .input("couponCode", sql.NVarChar, couponCode.trim())
      .input("department", sql.NVarChar, normalizedDepartment)
      .query(`
        UPDATE dbo.QrCode_Coupon
        SET IsScanned = 0,
            EmployeeCode = NULL,
            ScanBy = NULL,
            ScannedAt = NULL,
            SystemScannedAt = NULL
        WHERE CouponCode = @couponCode AND IsDeleted = 0 AND Department = @department
      `);

    if (result.rowsAffected[0] === 0) {
      return Response.json(
        { error: "No matching coupon code found in the database." },
        { status: 404 }
      );
    }

    return Response.json({ success: true, message: "Coupon successfully unscanned." });
  } catch (err: unknown) {
    console.error("Coupon unscan error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
