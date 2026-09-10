import { getPool, sql } from "@/lib/db";
import { softDeleteCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";

export const dynamic = "force-dynamic";

// Manual lookup-and-act: a user keys in Work Order + Cut + Bundle + Op (as
// printed on the physical coupon) rather than picking a row from the table.
// The coupon is located by matching all four stored columns (buildCouponCode
// doesn't account for CutNo). The action is derived from the coupon's own
// state rather than chosen by the user — a scanned coupon gets unscanned
// (same field reset as /api/coupons/unscan), an unscanned one gets
// soft-deleted (see coupon-registration.service.ts's softDeleteCoupons —
// dbo.QrCode_Coupon rows must never be hard DELETEd). A coupon is therefore
// never deleted while scanned; it always passes through "unscanned" first.
export async function POST(request: Request) {
  try {
    const { workOrder, cutNo, bundleNo, opNo, actedBy } = await request.json();

    const fields: Record<string, unknown> = { workOrder, cutNo, bundleNo, opNo };
    const missing = Object.keys(fields).filter((key) => !String(fields[key] ?? "").trim());
    if (missing.length > 0) {
      return Response.json(
        { error: `Missing required field(s): ${missing.join(", ")}.` },
        { status: 400 },
      );
    }
    if (!actedBy || !String(actedBy).trim()) {
      return Response.json({ error: "Could not determine current user." }, { status: 400 });
    }

    const pool = await getPool("pitSystem");
    const lookup = await pool
      .request()
      .input("workOrder", sql.NVarChar, String(workOrder).trim())
      .input("cutNo", sql.NVarChar, String(cutNo).trim())
      .input("bundleNo", sql.NVarChar, String(bundleNo).trim())
      .input("opNo", sql.NVarChar, String(opNo).trim())
      .query(`
        SELECT TOP 1 CouponCode, IsScanned
        FROM dbo.QrCode_Coupon
        WHERE WorkOrder = @workOrder AND CutNo = @cutNo AND BundleNo = @bundleNo AND OpNo = @opNo
          AND IsDeleted = 0
      `);

    const coupon = lookup.recordset[0];
    if (!coupon) {
      return Response.json(
        { error: "No matching coupon found for the given Work Order, Cut, Bundle and Operation." },
        { status: 404 },
      );
    }

    if (coupon.IsScanned) {
      await pool
        .request()
        .input("couponCode", sql.NVarChar, coupon.CouponCode)
        .query(`
          UPDATE dbo.QrCode_Coupon
          SET IsScanned = 0,
              EmployeeCode = NULL,
              ScanBy = NULL,
              ScannedAt = NULL,
              SystemScannedAt = NULL
          WHERE CouponCode = @couponCode AND IsDeleted = 0
        `);
      return Response.json({ success: true, action: "unscanned", couponCode: coupon.CouponCode });
    }

    await softDeleteCoupons(pool, [coupon.CouponCode], String(actedBy).trim());
    return Response.json({ success: true, action: "deleted", couponCode: coupon.CouponCode });
  } catch (err: unknown) {
    console.error("Coupon unscan/delete error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
