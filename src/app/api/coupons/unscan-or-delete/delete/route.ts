import { getPool, sql } from "@/lib/db";
import { softDeleteCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";
import { logCouponActionHistory } from "@/features/qr-code-generation/services/coupon-history.service";
import { readCouponFilter, findMatchingCoupons, chunk, IN_LIST_CHUNK_SIZE } from "../shared";

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
//
// Streams newline-delimited JSON progress lines over the response body,
// same shape/protocol as POST /api/qr-code-generation/coupons — a large
// unscan/delete batch (the whole work order, thousands of coupons) used to
// look like a single frozen spinner for however long the request took; this
// lets the UI show live done/total progress instead, same as coupon
// generation already does. Validation still happens up front and still
// returns a plain JSON error response — the stream only starts once
// there's actually a matched batch to work through.
const PROGRESS_CHUNK_SIZE = 200; // matches logCouponActionHistory's own ROWS_PER_CHUNK

export async function POST(request: Request) {
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
  const workOrder = parsed.workOrder;
  const total = unscanned.length;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      };
      try {
        let done = 0;
        for (const batch of chunk(unscanned, PROGRESS_CHUNK_SIZE)) {
          await logCouponActionHistory(pool, "deleted", batch, by);
          await softDeleteCoupons(pool, batch.map((m) => m.CouponCode), by);
          done += batch.length;
          send({ done, total });
        }

        const opNos = [...new Set(unscanned.map((m) => m.OpNo))];
        const bundleNos = [...new Set(unscanned.map((m) => m.BundleNo))];
        const cascades: Promise<unknown>[] = [];

        for (const opBatch of chunk(opNos, IN_LIST_CHUNK_SIZE)) {
          const req = pool
            .request()
            .input("deletedBy", sql.NVarChar, by)
            .input("wo", sql.NVarChar, workOrder);
          const inClause = opBatch
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

        for (const bundleBatch of chunk(bundleNos, IN_LIST_CHUNK_SIZE)) {
          const req = pool
            .request()
            .input("deletedBy", sql.NVarChar, by)
            .input("wo", sql.NVarChar, workOrder);
          const inClause = bundleBatch
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

        send({
          done: total,
          total,
          status: "complete",
          success: true,
          deletedCount: total,
        });
      } catch (err: unknown) {
        // Headers are already committed once the stream starts, so an
        // error here can't fall back to a JSON error response/status code
        // — it goes in-band as a final line instead, same as the coupon
        // generation route.
        console.error("Bulk coupon delete error:", err);
        const message = err instanceof Error ? err.message : "Internal Server Error";
        send({ status: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
