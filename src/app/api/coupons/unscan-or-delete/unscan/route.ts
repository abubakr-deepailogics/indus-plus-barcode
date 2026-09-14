import { getPool, sql } from "@/lib/db";
import { readCouponFilter, findMatchingCoupons } from "../shared";

export const dynamic = "force-dynamic";

// Bulk-unscan by filter (Work Order required, Cut/Bundle/Operation each
// optional and narrowing) — the "unscan" half of what used to be one
// combined unscan-or-delete action, now its own route. Only ever touches
// coupons that are CURRENTLY scanned in this same request's fresh match
// (re-queried here, not trusting an earlier GET /unscan-or-delete snapshot);
// an already-unscanned match in the same filter is left untouched — use
// .../delete for those. Never deletes anything.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = readCouponFilter(body);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const pool = await getPool("pitSystem");
    const matches = await findMatchingCoupons(pool, parsed);
    const scannedCodes = matches
      .filter((m) => m.IsScanned)
      .map((m) => m.CouponCode);

    if (scannedCodes.length === 0) {
      return Response.json(
        { error: "No matching scanned coupons found for the given filters." },
        { status: 404 },
      );
    }

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

    return Response.json({ success: true, unscannedCount: scannedCodes.length });
  } catch (err: unknown) {
    console.error("Bulk coupon unscan error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
