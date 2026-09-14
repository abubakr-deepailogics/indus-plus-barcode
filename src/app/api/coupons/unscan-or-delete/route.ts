import { getPool, sql } from "@/lib/db";
import { softDeleteCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";

export const dynamic = "force-dynamic";

// Manual lookup-and-act: a user keys in whichever of Cut / Bundle / Operation
// they have printed on the coupon(s) in hand — none of the three is
// required. Only Work Order is always required (it's already selected on
// the page this modal is opened from). Whatever subset of Cut/Bundle/Op is
// filled in narrows the match; leaving all three empty scopes the action to
// every coupon on the work order. The match is therefore a set, not a
// single row, and the action is derived per-coupon from its own state (same
// rule as /api/coupons/unscan for the scanned ones) rather than chosen by
// the user: scanned coupons in the set are unscanned, unscanned ones are
// soft-deleted — dbo.QrCode_Coupon rows must never be hard DELETEd, so a
// coupon is never deleted while still scanned.

interface CouponFilter {
  workOrder: string;
  cutNo: string;
  bundleNo: string;
  opNo: string;
}

function readCouponFilter(
  source: Record<string, unknown>,
): CouponFilter | { error: string } {
  const workOrder = String(source.workOrder ?? "").trim();
  if (!workOrder) {
    return { error: "Missing required field: workOrder." };
  }
  return {
    workOrder,
    cutNo: String(source.cutNo ?? "").trim(),
    bundleNo: String(source.bundleNo ?? "").trim(),
    opNo: String(source.opNo ?? "").trim(),
  };
}

async function findMatchingCoupons(
  pool: Awaited<ReturnType<typeof getPool>>,
  filter: CouponFilter,
) {
  const request = pool
    .request()
    .input("workOrder", sql.NVarChar, filter.workOrder);
  const conditions = ["WorkOrder = @workOrder", "IsDeleted = 0"];
  if (filter.cutNo) {
    request.input("cutNo", sql.NVarChar, filter.cutNo);
    conditions.push("CutNo = @cutNo");
  }
  if (filter.bundleNo) {
    request.input("bundleNo", sql.NVarChar, filter.bundleNo);
    conditions.push("BundleNo = @bundleNo");
  }
  if (filter.opNo) {
    request.input("opNo", sql.NVarChar, filter.opNo);
    conditions.push("OpNo = @opNo");
  }
  const result = await request.query(`
    SELECT CouponCode, IsScanned
    FROM dbo.QrCode_Coupon
    WHERE ${conditions.join(" AND ")}
  `);
  return result.recordset as { CouponCode: string; IsScanned: boolean }[];
}

// Status-only lookup — lets the modal show how many coupons match the
// current filter, and their scanned/unscanned split, before anything is
// actually changed.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = readCouponFilter({
      workOrder: searchParams.get("workOrder"),
      cutNo: searchParams.get("cutNo"),
      bundleNo: searchParams.get("bundleNo"),
      opNo: searchParams.get("opNo"),
    });
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const pool = await getPool("pitSystem");
    const matches = await findMatchingCoupons(pool, parsed);
    if (matches.length === 0) {
      return Response.json(
        { error: "No matching coupons found for the given filters." },
        { status: 404 },
      );
    }
    const scannedCount = matches.filter((m) => m.IsScanned).length;
    return Response.json({
      totalCount: matches.length,
      scannedCount,
      unscannedCount: matches.length - scannedCount,
    });
  } catch (err: unknown) {
    console.error("Coupon status lookup error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = readCouponFilter(body);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }
    const { actedBy } = body;
    if (!actedBy || !String(actedBy).trim()) {
      return Response.json(
        { error: "Could not determine current user." },
        { status: 400 },
      );
    }

    const pool = await getPool("pitSystem");

    const matches = await findMatchingCoupons(pool, parsed);
    if (matches.length === 0) {
      return Response.json(
        { error: "No matching coupons found for the given filters." },
        { status: 404 },
      );
    }

    const scannedCodes = matches
      .filter((m) => m.IsScanned)
      .map((m) => m.CouponCode);
    const unscannedCodes = matches
      .filter((m) => !m.IsScanned)
      .map((m) => m.CouponCode);

    if (scannedCodes.length > 0) {
      const request2 = pool.request();
      const placeholders = scannedCodes.map((code, i) => {
        request2.input(`code${i}`, sql.NVarChar, code);
        return `@code${i}`;
      });
      await request2.query(`
        UPDATE dbo.QrCode_Coupon
        SET IsScanned = 0,
            EmployeeCode = NULL,
            ScanBy = NULL,
            ScannedAt = NULL,
            SystemScannedAt = NULL
        WHERE CouponCode IN (${placeholders.join(", ")}) AND IsDeleted = 0
      `);
    }

    if (unscannedCodes.length > 0) {
      await softDeleteCoupons(pool, unscannedCodes, String(actedBy).trim());
    }

    return Response.json({
      success: true,
      unscannedCount: scannedCodes.length,
      deletedCount: unscannedCodes.length,
      totalCount: matches.length,
    });
  } catch (err: unknown) {
    console.error("Coupon unscan/delete error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
