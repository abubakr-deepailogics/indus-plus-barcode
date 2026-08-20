import { getPool, sql } from "@/lib/db";
import { generateCouponPdf } from "@/features/qr-code-generation/services/pdf-generation.service";
import { buildCouponCards } from "@/features/qr-code-generation/services/coupon-pairing.service";
import { registerCoupons, countCoupons } from "@/features/qr-code-generation/services/coupon-registration.service";
import type { BundleDetailRow, CouponLayout, OperationsDetailRow } from "@/features/qr-code-generation/types";

interface GenerateRequestBody {
  workOrder: string;
  saleOrderNo: string;
  styleCode: string;
  bundles: BundleDetailRow[];
  operations: OperationsDetailRow[];
  layout: CouponLayout;
}

// Generates the QR-coupon PDF once and stores it — repeat downloads read
// the stored bytes (GET /api/qr-code-generation/pdf/[id]) instead of
// re-rendering thousands of QR codes every time.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<GenerateRequestBody>;
  const { workOrder, saleOrderNo, styleCode, bundles, operations, layout } = body;

  // styleCode is only a display label in the PDF header — some sources
  // (e.g. Open Order) have no real style code and legitimately send "".
  // saleOrderNo is likewise best-effort — not every source has one.
  if (!workOrder || !Array.isArray(bundles) || !Array.isArray(operations)) {
    return Response.json(
      { error: "workOrder, bundles, and operations are all required." },
      { status: 400 },
    );
  }

  const selectedBundles = bundles.filter((b) => b.sel);
  const selectedOperations = operations.filter((op) => op.lastOpSection);
  if (selectedBundles.length === 0 || selectedOperations.length === 0) {
    return Response.json(
      { error: "No bundles or operations selected to generate." },
      { status: 400 },
    );
  }

  try {
    const { buffer, cardCount } = await generateCouponPdf({
      workOrder,
      saleOrderNo: saleOrderNo ?? "",
      styleCode: styleCode ?? "",
      bundles: selectedBundles,
      operations: selectedOperations,
      layout,
    });

    const pool = await getPool();

    // Register each card's coupon identity, skipping ones already
    // generated for this work order/bundle/operation — reprints never
    // add rows. Batched (see coupon-registration.service) so thousands
    // of coupons don't mean thousands of round trips.
    await registerCoupons(pool, workOrder, buildCouponCards(selectedBundles, selectedOperations));

    // Explicit timeout override — the driver default (15s) can be too
    // tight for a large work order's PDF blob (thousands of coupons =
    // tens of MB) going over the wire in one INSERT. @types/mssql doesn't
    // declare the per-request conf overload that the JS lib supports
    // (mssql/lib/base/connection-pool.js `request(conf)`), hence the cast.
    const result = await (pool.request as (conf?: { requestTimeout: number }) => sql.Request)({
      requestTimeout: 120_000,
    })
      .input("workOrder", sql.NVarChar, workOrder)
      .input("saleOrderNo", sql.NVarChar, saleOrderNo || null)
      .input("styleCode", sql.NVarChar, styleCode ?? "")
      .input("cardCount", sql.Int, cardCount)
      .input("pdf", sql.VarBinary(sql.MAX), buffer)
      .query(
        `INSERT INTO dbo.QrCode_Pdf_Batch (WorkOrder, SaleOrderNo, StyleCode, CardCount, Pdf)
         OUTPUT INSERTED.Id, INSERTED.CreatedAt
         VALUES (@workOrder, @saleOrderNo, @styleCode, @cardCount, @pdf)`,
      );

    // Distinct coupons registered for this work order so far (post-dedup) —
    // the real "coupons generated" count, not this batch's render size.
    const couponCount = await countCoupons(pool, workOrder);

    const row = result.recordset[0];
    return Response.json({
      id: row.Id,
      cardCount,
      couponCount,
      createdAt: row.CreatedAt,
    });
  } catch (err: unknown) {
    console.error("PDF batch generation error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// Lists past batches so the UI can offer re-download without regenerating.
// No work_order → lists every batch (most recent first); with work_order →
// scoped to that order, and also returns the distinct coupon count for it.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";

  try {
    const pool = await getPool();
    if (workOrder) {
      const [batchResult, couponCount] = await Promise.all([
        pool
          .request()
          .input("workOrder", sql.NVarChar, workOrder)
          .query(
            `SELECT Id, WorkOrder, SaleOrderNo, StyleCode, CardCount, CreatedAt
             FROM dbo.QrCode_Pdf_Batch
             WHERE WorkOrder = @workOrder
             ORDER BY CreatedAt DESC`,
          ),
        countCoupons(pool, workOrder),
      ]);
      return Response.json({ batches: batchResult.recordset, couponCount });
    }

    const result = await pool
      .request()
      .query(
        `SELECT TOP 200 Id, WorkOrder, SaleOrderNo, StyleCode, CardCount, CreatedAt
         FROM dbo.QrCode_Pdf_Batch
         ORDER BY CreatedAt DESC`,
      );
    return Response.json({ batches: result.recordset });
  } catch (err: unknown) {
    console.error("PDF batch list error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
