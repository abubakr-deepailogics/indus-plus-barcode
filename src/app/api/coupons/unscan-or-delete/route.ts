import { getPool, sql } from "@/lib/db";
import { softDeleteCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";

export const dynamic = "force-dynamic";

// Manual lookup-and-act: a user keys in Work Order + Bundle + Op (as printed
// on the physical coupon), with Cut optional, rather than picking a row from
// the table. WorkOrder+BundleNo+OpNo alone already uniquely identifies a
// coupon — CouponCode (the table's PK) is built from exactly those three
// (see coupon-code.ts's buildCouponCode, which doesn't factor in CutNo) — so
// Cut is only used as an extra match when the user happens to have it; it's
// never required to find the row. The action is derived from the coupon's
// own state rather than chosen by the user — a scanned coupon gets unscanned
// (same field reset as /api/coupons/unscan), an unscanned one gets
// soft-deleted (see coupon-registration.service.ts's softDeleteCoupons —
// dbo.QrCode_Coupon rows must never be hard DELETEd). A coupon is therefore
// never deleted while scanned; it always passes through "unscanned" first.

interface CouponFields {
  workOrder: string;
  cutNo: string;
  bundleNo: string;
  opNo: string;
}

function readCouponFields(source: Record<string, unknown>): CouponFields | { error: string } {
  const required: Record<string, unknown> = {
    workOrder: source.workOrder,
    bundleNo: source.bundleNo,
    opNo: source.opNo,
  };
  const missing = Object.keys(required).filter((key) => !String(required[key] ?? "").trim());
  if (missing.length > 0) {
    return { error: `Missing required field(s): ${missing.join(", ")}.` };
  }
  return {
    workOrder: String(source.workOrder).trim(),
    cutNo: String(source.cutNo ?? "").trim(),
    bundleNo: String(source.bundleNo).trim(),
    opNo: String(source.opNo).trim(),
  };
}

async function findCoupon(pool: Awaited<ReturnType<typeof getPool>>, fields: CouponFields) {
  const request = pool
    .request()
    .input("workOrder", sql.NVarChar, fields.workOrder)
    .input("bundleNo", sql.NVarChar, fields.bundleNo)
    .input("opNo", sql.NVarChar, fields.opNo);
  const conditions = ["WorkOrder = @workOrder", "BundleNo = @bundleNo", "OpNo = @opNo", "IsDeleted = 0"];
  if (fields.cutNo) {
    request.input("cutNo", sql.NVarChar, fields.cutNo);
    conditions.push("CutNo = @cutNo");
  }
  const result = await request.query(`
    SELECT TOP 1 CouponCode, IsScanned
    FROM dbo.QrCode_Coupon
    WHERE ${conditions.join(" AND ")}
  `);
  return result.recordset[0] as { CouponCode: string; IsScanned: boolean } | undefined;
}

// Status-only lookup — lets the modal show "Unscan Coupon" vs "Delete
// Coupon" on its action button before anything is actually changed.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = readCouponFields({
      workOrder: searchParams.get("workOrder"),
      cutNo: searchParams.get("cutNo"),
      bundleNo: searchParams.get("bundleNo"),
      opNo: searchParams.get("opNo"),
    });
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const pool = await getPool("pitSystem");
    const coupon = await findCoupon(pool, parsed);
    if (!coupon) {
      return Response.json(
        { error: "No matching coupon found for the given Work Order, Bundle and Operation." },
        { status: 404 },
      );
    }
    return Response.json({ couponCode: coupon.CouponCode, isScanned: !!coupon.IsScanned });
  } catch (err: unknown) {
    console.error("Coupon status lookup error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = readCouponFields(body);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const { actedBy } = body;
    if (!actedBy || !String(actedBy).trim()) {
      return Response.json({ error: "Could not determine current user." }, { status: 400 });
    }

    const pool = await getPool("pitSystem");
    const coupon = await findCoupon(pool, parsed);
    if (!coupon) {
      return Response.json(
        { error: "No matching coupon found for the given Work Order, Bundle and Operation." },
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
