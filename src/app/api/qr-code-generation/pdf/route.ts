import { getPool } from "@/lib/db";
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
  margins: { top: number; bottom: number; left: number; right: number };
  codeType: "qr" | "barcode";
}

// Renders the PDF and streams it straight back in this response — nothing
// is persisted server-side. Coupon *identity* is still registered in
// dbo.QrCode_Coupon (that's the durable record scan/rework rely on); the
// rendered bytes themselves are print-and-discard, regenerated on demand.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<GenerateRequestBody>;
  const { workOrder, saleOrderNo, styleCode, bundles, operations, layout, margins, codeType } = body;

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
      margins,
      codeType,
    });

    const pool = await getPool("pitSystem");

    // Register each card's coupon identity, skipping ones already
    // generated for this work order/bundle/operation — reprints never
    // add rows. Batched (see coupon-registration.service) so thousands
    // of coupons don't mean thousands of round trips.
    await registerCoupons(pool, workOrder, buildCouponCards(selectedBundles, selectedOperations));

    // Distinct coupons registered for this work order so far (post-dedup) —
    // the real "coupons generated" count, not this batch's render size.
    const couponCount = await countCoupons(pool, workOrder);

    // Counts travel as headers since the body is the PDF itself, not JSON —
    // the caller reads X-Card-Count/X-Coupon-Count off the response.
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="coupons-${workOrder}.pdf"`,
        "X-Card-Count": String(cardCount),
        "X-Coupon-Count": String(couponCount),
      },
    });
  } catch (err: unknown) {
    console.error("PDF generation error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// Coupon count for a work order, shown next to the Generate button —
// independent of any stored PDF (there isn't one); backed by
// dbo.QrCode_Coupon directly.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";

  if (!workOrder) {
    return Response.json({ error: "work_order is required." }, { status: 400 });
  }

  try {
    const pool = await getPool("pitSystem");
    const couponCount = await countCoupons(pool, workOrder);
    return Response.json({ couponCount });
  } catch (err: unknown) {
    console.error("Coupon count lookup error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
