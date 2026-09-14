import { getPool, sql } from "@/lib/db";
import { softDeleteCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";
import { logCouponActionHistory } from "@/features/qr-code-generation/services/coupon-history.service";
import { readCouponFilter, findMatchingCoupons } from "../shared";

export const dynamic = "force-dynamic";

// Bulk-delete by filter (Work Order required, Cut/Bundle/Operation each
// optional and narrowing) — the "delete" half of what used to be one
// combined unscan-or-delete action, now its own route. Only ever touches
// coupons that are CURRENTLY unscanned in this same request's fresh match
// (re-queried here, not trusting an earlier GET /unscan-or-delete
// snapshot); a still-scanned match in the same filter is deliberately
// excluded and left untouched — use .../unscan for those first. This is
// the one hard rule that must never change: a coupon can never be deleted
// while it's scanned, and dbo.QrCode_Coupon rows are never hard-DELETEd
// (softDeleteCoupons only sets IsDeleted/DeletedAt/DeletedBy) — once
// deleted, a coupon cannot be scanned again.
//

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
    const unscanned = matches.filter((m) => !m.IsScanned);

    if (unscanned.length === 0) {
      return Response.json(
        { error: "No matching unscanned coupons found for the given filters." },
        { status: 404 },
      );
    }

    const by = String(actedBy).trim();
    await logCouponActionHistory(pool, "deleted", unscanned, by);

    const unscannedCodes = unscanned.map((m) => m.CouponCode);
    await softDeleteCoupons(pool, unscannedCodes, by);

    const generationIds = [
      ...new Set(unscanned.map((m) => m.Id).filter((id): id is string => !!id)),
    ];
    if (generationIds.length > 0) {
      const bindGenerationIds = (req: sql.Request) =>
        generationIds
          .map((id, i) => {
            req.input(`gen${i}`, sql.UniqueIdentifier, id);
            return `@gen${i}`;
          })
          .join(", ");
      const styleBulletinRequest = pool.request();
      const styleBulletinInClause = bindGenerationIds(styleBulletinRequest);
      const cutDetailRequest = pool.request();
      const cutDetailInClause = bindGenerationIds(cutDetailRequest);
      await Promise.all([
        styleBulletinRequest.query(
          `UPDATE dbo.StyleBullettinInt SET IsDeleted = 1 WHERE Id IN (${styleBulletinInClause})`,
        ),
        cutDetailRequest.query(
          `UPDATE dbo.SaleOrderPOCutDetailViewV1 SET IsDeleted = 1 WHERE Id IN (${cutDetailInClause})`,
        ),
      ]);
    }

    return Response.json({
      success: true,
      deletedCount: unscannedCodes.length,
    });
  } catch (err: unknown) {
    console.error("Bulk coupon delete error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
