import { getPool, sql } from "@/lib/db";
import { softDeleteCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";
import { logCouponActionHistory } from "@/features/qr-code-generation/services/coupon-history.service";
import {
  readCouponFilter,
  findMatchingCoupons,
  chunk,
  IN_LIST_CHUNK_SIZE,
  type MatchedCoupon,
} from "../shared";
import { withRoute } from "@/lib/logger/with-route";
import { audit, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Bulk-delete by filter (Work Order optional — omitted means every work
// order in the department; Cut/Bundle ranges need one; other filters each
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
// All writes (history, coupon soft-delete, snapshot cascade) run in ONE
// transaction: either the whole batch is deleted with its snapshot cascade,
// or nothing is. Without it, a failure after the coupons were deleted left
// snapshot rows active with no way to retry (a retry no longer matches the
// already-deleted coupons). Trade-off: row locks on the deleted coupons are
// held until commit, so a concurrent scan of one of THESE coupons waits for
// the delete to finish (then correctly sees it deleted).
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

// Snapshot cascade for one work order's just-deleted coupons (see the module
// comment above for the rule). Scoped by Department on both sides: the
// snapshot rows and coupons are department-owned (migration 043), and the
// Department-leading indexes (IX_SaleOrderPOCutDetail_Department_WorkOrder_
// Bundle_InsertedAt, UX_QrCode_Coupon_Department_WorkItem) are only seekable
// with it — without it, plus the old CAST on [Bundle Id], this UPDATE scanned
// and hit the 15s request timeout on large work orders.
async function cascadeSnapshotDeletes(
  tx: sql.Transaction,
  department: string,
  workOrder: string,
  coupons: MatchedCoupon[],
  by: string,
) {
  const opNos = [...new Set(coupons.map((m) => m.OpNo))];
  const bundleNos = [...new Set(coupons.map((m) => m.BundleNo))];

  for (const opBatch of chunk(opNos, IN_LIST_CHUNK_SIZE)) {
    const req = tx
      .request()
      .input("deletedBy", sql.NVarChar, by)
      .input("department", sql.NVarChar, department)
      .input("wo", sql.NVarChar, workOrder);
    const inClause = opBatch
      .map((op, i) => {
        req.input(`op${i}`, sql.NVarChar, op);
        return `@op${i}`;
      })
      .join(", ");
    // Sequential, not Promise.all: a transaction is one connection, which
    // runs one request at a time.
    await req.query(`
        UPDATE sb
        SET sb.IsDeleted = 1, sb.DeletedAt = SYSUTCDATETIME(), sb.DeletedBy = @deletedBy
        FROM dbo.StyleBullettinInt sb
        WHERE sb.Department = @department
          AND sb.[Order No] = @wo
          AND sb.[Operation Code] IN (${inClause})
          AND sb.IsDeleted = 0
          AND NOT EXISTS (
            SELECT 1 FROM dbo.QrCode_Coupon c
            WHERE c.Department = @department AND c.WorkOrder = @wo
              AND c.OpNo = sb.[Operation Code] AND c.IsDeleted = 0
          )
      `);
  }

  for (const bundleBatch of chunk(bundleNos, IN_LIST_CHUNK_SIZE)) {
    const req = tx
      .request()
      .input("deletedBy", sql.NVarChar, by)
      .input("department", sql.NVarChar, department)
      .input("wo", sql.NVarChar, workOrder);
    const inClause = bundleBatch
      .map((bundle, i) => {
        req.input(`bundle${i}`, sql.NVarChar, bundle);
        return `@bundle${i}`;
      })
      .join(", ");
    await req.query(`
        UPDATE cd
        SET cd.IsDeleted = 1, cd.DeletedAt = SYSUTCDATETIME(), cd.DeletedBy = @deletedBy
        FROM dbo.SaleOrderPOCutDetailViewV1 cd
        WHERE cd.Department = @department
          AND cd.[Work Order #] = @wo
          AND cd.[Bundle Id] IN (${inClause})
          AND cd.IsDeleted = 0
          AND NOT EXISTS (
            SELECT 1 FROM dbo.QrCode_Coupon c
            WHERE c.Department = @department AND c.WorkOrder = @wo
              AND c.BundleNo = cd.[Bundle Id] AND c.IsDeleted = 0
          )
      `);
  }
}

export const POST = withRoute("/api/coupons/unscan-or-delete/delete", async function POST(request: Request) {
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

  // Defense in depth: an unscanned coupon should never carry a WageId (it's
  // only ever stamped on scanned coupons — see POST /api/wages), so this
  // should be unreachable in normal operation. It's still checked directly
  // here — cheap, since WageId is already fetched — so a hard-delete can
  // never wipe out a coupon that a wage batch's detail rows still reference.
  const wageLinked = unscanned.filter((m) => m.WageId != null);
  if (wageLinked.length > 0) {
    return Response.json(
      {
        error: `${wageLinked.length} of the matched coupon(s) are linked to a wage batch and cannot be deleted. Delete the wage batch first if these coupons should be removed.`,
      },
      { status: 409 },
    );
  }

  const by = String(actedBy).trim();
  const total = unscanned.length;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      };
      const tx = new sql.Transaction(pool);
      let began = false;
      try {
        await tx.begin();
        began = true;
        let done = 0;
        for (const batch of chunk(unscanned, PROGRESS_CHUNK_SIZE)) {
          await logCouponActionHistory(tx, "deleted", batch, by);
          const deleted = await softDeleteCoupons(tx, batch.map((m) => m.CouponCode), by);
          if (deleted !== batch.length) {
            // Some matched coupon was scanned or deleted by someone else
            // since the match query — roll everything back rather than
            // delete a partial, stale selection.
            throw new Error(
              "Some of the matched coupons were scanned or deleted by someone else in the meantime. Nothing was deleted — refresh and try again.",
            );
          }
          done += batch.length;
          send({ done, total });
        }

        // Snapshot cascade is keyed per work order; a delete without a work
        // order filter can span many, so cascade each one separately.
        const byWorkOrder = new Map<string, typeof unscanned>();
        for (const coupon of unscanned) {
          const rows = byWorkOrder.get(coupon.WorkOrder) ?? [];
          rows.push(coupon);
          byWorkOrder.set(coupon.WorkOrder, rows);
        }
        for (const [workOrder, coupons] of byWorkOrder) {
          await cascadeSnapshotDeletes(tx, parsed.department, workOrder, coupons, by);
        }

        await tx.commit();
        began = false;
        audit("coupon.bulk_delete", { filter: parsed, actedBy: by, count: total });

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
        logger.error("Bulk coupon delete error", err);
        if (began) {
          // May already be aborted server-side (e.g. after a timeout) — then
          // there's nothing left to roll back.
          await tx.rollback().catch((rollbackErr) =>
            logger.error("Bulk coupon delete rollback error", rollbackErr),
          );
        }
        const message = err instanceof Error ? err.message : "Internal Server Error";
        // Throws if the client already disconnected (which is also what
        // aborted the loop above) — nothing left to tell it.
        try {
          send({ status: "error", message });
          controller.close();
        } catch {}
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
});
