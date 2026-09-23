import { getPool, sql } from "@/lib/db";
import { logCouponActionHistory } from "@/features/qr-code-generation/services/coupon-history.service";
import { findLockedDates } from "@/features/wages/services/wage-lock.service";
import { readCouponFilter, findMatchingCoupons, chunk } from "../shared";

export const dynamic = "force-dynamic";

// Bulk-unscan by filter (Work Order required, Cut/Bundle/Operation each
// optional and narrowing) — the "unscan" half of what used to be one
// combined unscan-or-delete action, now its own route. Only ever touches
// coupons that are CURRENTLY scanned in this same request's fresh match
// (re-queried here, not trusting an earlier GET /unscan-or-delete snapshot);
// an already-unscanned match in the same filter is left untouched — use
// .../delete for those. Never deletes anything.
//
// Streams newline-delimited JSON progress lines over the response body,
// same protocol as .../delete and POST /api/qr-code-generation/coupons —
// see delete/route.ts for why (a big batch shouldn't look like one frozen
// spinner). Validation still happens up front and still returns a plain
// JSON error response.
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
  const scanned = matches.filter((m) => m.IsScanned);

  if (scanned.length === 0) {
    return Response.json(
      { error: "No matching scanned coupons found for the given filters." },
      { status: 404 },
    );
  }

  // A coupon inside a paid wage's tenure can never be unscanned — unscanning
  // clears EmployeeCode/ScannedAt but NOT WageId, so it would silently
  // desync that wage's recorded totals from live coupon data, and the
  // coupon could later be rescanned into a different (unlocked) date and
  // paid a second time with nothing to catch it. Same hard rule as the scan
  // endpoints' lock, checked in bulk here instead of one date at a time.
  const lockCheck = await findLockedDates(scanned.map((m) => m.ScannedAt));
  if (lockCheck) {
    const titles = lockCheck.locks
      .map((l) => `"${l.title}" (${l.from} to ${l.to})`)
      .join(", ");
    return Response.json(
      {
        error: `${lockCheck.lockedCount} of the matched coupon(s) fall inside a paid wage tenure — ${titles}. Delete ${
          lockCheck.locks.length === 1 ? "that wage" : "those wages"
        } first, or narrow the filter to exclude them.`,
      },
      { status: 409 },
    );
  }

  const by = String(actedBy).trim();
  const total = scanned.length;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      };
      try {
        let done = 0;
        for (const batch of chunk(scanned, PROGRESS_CHUNK_SIZE)) {
          await logCouponActionHistory(pool, "unscanned", batch, by);

          const req = pool.request();
          const placeholders = batch.map((m, i) => {
            req.input(`code${i}`, sql.NVarChar, m.CouponCode);
            return `@code${i}`;
          });
          await req.query(`
            UPDATE dbo.QrCode_Coupon
            SET IsScanned = 0,
                EmployeeCode = NULL,
                ScanBy = NULL,
                ScannedAt = NULL,
                SystemScannedAt = NULL
            WHERE CouponCode IN (${placeholders.join(", ")}) AND IsDeleted = 0
          `);

          done += batch.length;
          send({ done, total });
        }

        send({
          done: total,
          total,
          status: "complete",
          success: true,
          unscannedCount: total,
        });
      } catch (err: unknown) {
        console.error("Bulk coupon unscan error:", err);
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
