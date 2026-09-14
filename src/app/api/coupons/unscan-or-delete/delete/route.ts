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
// Snapshot cascade: a StyleBullettinInt row (keyed by Operation Code) is
// marked IsDeleted only once NO active coupon remains for that
// WorkOrder+OpNo (i.e. this delete removed the last coupon still using that
// operation); a SaleOrderPOCutDetailViewV1 row (keyed by Bundle Id) only
// once NO active coupon remains for that WorkOrder+BundleNo. Deliberately
// NOT scoped by the shared generation Id — one "Generate Coupons" run's
// coupons can span many bundles/operations, so cascading by Id alone would
// mark rows for OTHER still-active operations/bundles from that same run as
// deleted too, hiding their report data incorrectly. If more than one
// coupon still references that operation/bundle, the corresponding
// snapshot row's IsDeleted stays 0 — nothing else about it changes.
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

    const workOrder = parsed.workOrder;
    const opNos = [...new Set(unscanned.map((m) => m.OpNo))];
    const bundleNos = [...new Set(unscanned.map((m) => m.BundleNo))];
    const cascades: Promise<unknown>[] = [];

    if (opNos.length > 0) {
      const req = pool
        .request()
        .input("deletedBy", sql.NVarChar, by)
        .input("wo", sql.NVarChar, workOrder);
      const inClause = opNos
        .map((op, i) => {
          req.input(`op${i}`, sql.NVarChar, op);
          return `@op${i}`;
        })
        .join(", ");
      cascades.push(
        req.query(`
          UPDATE sb
          SET sb.IsDeleted = 1, sb.DeletedAt = SYSUTCDATETIME(), sb.DeletedBy = @deletedBy
          FROM dbo.StyleBullettinInt sb
          WHERE sb.[Order No] = @wo
            AND sb.[Operation Code] IN (${inClause})
            AND sb.IsDeleted = 0
            AND NOT EXISTS (
              SELECT 1 FROM dbo.QrCode_Coupon c
              WHERE c.WorkOrder = @wo AND c.OpNo = sb.[Operation Code] AND c.IsDeleted = 0
            )
        `),
      );
    }

    if (bundleNos.length > 0) {
      const req = pool
        .request()
        .input("deletedBy", sql.NVarChar, by)
        .input("wo", sql.NVarChar, workOrder);
      const inClause = bundleNos
        .map((bundle, i) => {
          req.input(`bundle${i}`, sql.NVarChar, bundle);
          return `@bundle${i}`;
        })
        .join(", ");
      cascades.push(
        req.query(`
          UPDATE cd
          SET cd.IsDeleted = 1, cd.DeletedAt = SYSUTCDATETIME(), cd.DeletedBy = @deletedBy
          FROM dbo.SaleOrderPOCutDetailViewV1 cd
          WHERE cd.[Work Order #] = @wo
            AND CAST(cd.[Bundle Id] AS NVARCHAR(50)) IN (${inClause})
            AND cd.IsDeleted = 0
            AND NOT EXISTS (
              SELECT 1 FROM dbo.QrCode_Coupon c
              WHERE c.WorkOrder = @wo AND c.BundleNo = CAST(cd.[Bundle Id] AS NVARCHAR(50)) AND c.IsDeleted = 0
            )
        `),
      );
    }

    await Promise.all(cascades);

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
