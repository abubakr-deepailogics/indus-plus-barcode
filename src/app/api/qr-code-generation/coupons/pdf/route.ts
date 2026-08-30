import { getPool, sql, cutDetailByFilter, styleBulletinByFilter } from "@/lib/db";
import { generateCouponPdf } from "@/features/qr-code-generation/services/pdf-generation.service";
import type { CouponCard } from "@/features/qr-code-generation/services/coupon-pairing.service";
import {
  chunk,
  listAllCoupons,
} from "@/features/qr-code-generation/services/coupon-registration.service";
import type {
  BundleDetailRow,
  CouponLayout,
  OperationsDetailRow,
} from "@/features/qr-code-generation/types";

const VALID_LAYOUTS: CouponLayout[] = [
  "same-page",
  "same-line",
  "different-pages",
];

// Renders a PDF for coupons already registered against a work order,
// scoped by the same filters as the coupon-tracing table (bundle/op/
// section/scanned) — no filter means every coupon on the work order.
// Bundle/operation display data (size, rate, SMV, section name, …) is
// re-joined from the style bulletin/cut detail tables by the bundle and op
// numbers the matched coupons reference, since QrCode_Coupon only stores
// identity, not the full row. Nothing is written back to the DB: no coupon
// registration (these coupons already exist) and no QrCode_Pdf_Batch row —
// this is a plain render-and-stream, not a stored batch.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";
  const bundleNo = searchParams.get("bundle_no") || undefined;
  const opNo = searchParams.get("op_no") || undefined;
  const section = searchParams.get("section") || undefined;
  const scannedParam = searchParams.get("is_scanned");
  const isScanned = scannedParam === null ? undefined : scannedParam === "true";
  const layoutParam = searchParams.get("layout");
  const layout = VALID_LAYOUTS.includes(layoutParam as CouponLayout)
    ? (layoutParam as CouponLayout)
    : undefined;
  const fromCut = searchParams.get("from_cut") || undefined;
  const toCut = searchParams.get("to_cut") || undefined;
  const codeTypeParam = searchParams.get("code_type");
  const codeType = codeTypeParam === "barcode" ? "barcode" : "qr";

  if (!workOrder) {
    return Response.json({ error: "work_order is required." }, { status: 400 });
  }

  try {
    // Coupons live on pitSystem; bundle/op display data (cut detail, style
    // bulletin) is on indusPlus — genuinely different SQL Server instances,
    // so each gets queried on its own pool below and merged in JS.
    const pool = await getPool("pitSystem");

    const coupons = await listAllCoupons(pool, workOrder, {
      bundleNo,
      opNo,
      section,
      isScanned,
      fromCut,
      toCut,
    });
    if (coupons.length === 0) {
      return Response.json(
        { error: "No coupons match this work order/filters." },
        { status: 404 },
      );
    }

    const bundleNos = [...new Set(coupons.map((c) => c.BundleNo))];
    const opNos = [...new Set(coupons.map((c) => c.OpNo))];

    // Two joins with a variable-length IN() list — built with per-value
    // params (not string-interpolated) to stay injection-safe. Bundle_Id
    // is numeric in the source table but coupons store it as text, hence
    // the CAST on the cut-detail side. bundleNos is chunked because a work
    // order can have thousands of bundles and SQL Server caps params at
    // 2100 per query. Queried on indusPlus via the same filter builders
    // used elsewhere (cutDetailByFilter/styleBulletinByFilter) rather than
    // ad-hoc SQL, so the real (renamed) table names, RowId synthesis, and
    // the OPERATIONS_CATALOG_TABLE join all stay in one place.
    const indusPlusPool = await getPool("indusPlus");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches sql.Request#query's own recordset typing
    const cutRecordsets: any[][] = [];
    for (const batch of chunk(bundleNos, 2000)) {
      const cutRequest = indusPlusPool.request().input("wo", sql.NVarChar, workOrder);
      batch.forEach((b, i) => cutRequest.input(`bundle${i}`, sql.NVarChar, b));
      const result = await cutRequest.query(
        cutDetailByFilter(
          `[Work Order #] = @wo AND CAST([Bundle Id] AS NVARCHAR(50)) IN (${batch
            .map((_, i) => `@bundle${i}`)
            .join(", ")})`,
        ),
      );
      cutRecordsets.push(result.recordset);
    }
    const cutRows = { recordset: cutRecordsets.flat() };

    const opRequest = indusPlusPool.request().input("wo", sql.NVarChar, workOrder);
    opNos.forEach((o, i) => opRequest.input(`op${i}`, sql.NVarChar, o));
    const opRows = await opRequest.query(
      styleBulletinByFilter(
        `[Order No] = @wo AND [Operation Code] IN (${opNos.map((_, i) => `@op${i}`).join(", ")})`,
      ),
    );

    const bundles: BundleDetailRow[] = cutRows.recordset
      .map((row) => ({
        id: row.RowId,
        cutNo: String(row.Cut ?? "0"),
        line: "1",
        bundleNo: String(row.Bundle_Id ?? row.RowId),
        inseam: String(row.Inseam ?? ""),
        size: String(row.Size ?? ""),
        pcs: row.Bundle_Qty ?? 0,
        sel: true,
        code: row.Color ?? "",
      }))
      // Cut-major, bundle-minor — same order the generation screen sorts
      // in (see useQrCodeGenerationFacade) — so the printed B# 1,2,3...
      // rank matches what was shown when the coupons were first generated,
      // not whatever order SQL happened to return rows in.
      .sort((a, b) => {
        const cutCompare = a.cutNo.localeCompare(b.cutNo, undefined, {
          numeric: true,
        });
        if (cutCompare !== 0) return cutCompare;
        return a.bundleNo.localeCompare(b.bundleNo, undefined, {
          numeric: true,
        });
      });

    const operations: OperationsDetailRow[] = opRows.recordset
      .map((row) => ({
        id: row.RowId,
        section: row.Section ?? "",
        seqNo: String(row.Operation_Sequence ?? ""),
        opNo: row.Operation_Code ?? "",
        operationName: row.Operation_Name ?? "",
        smv: String(row.Smv_Sam ?? ""),
        rate: String(row.Piece_Rate ?? ""),
        skills: "",
        lastOpSection: row.Last_Operation_Section_Wise === 1,
        inc: row.Incentive !== undefined ? String(row.Incentive) : "-",
      }))
      // RowId encodes the intended Operation_Sequence order (see
      // styleBulletinByFilter) — SQL doesn't guarantee row order without an
      // explicit outer ORDER BY, so sort explicitly rather than rely on it,
      // same as bundles above.
      .sort((a, b) => a.id - b.id);

    if (bundles.length === 0 || operations.length === 0) {
      return Response.json(
        {
          error:
            "Coupons matched, but their bundle/operation data is no longer in the style bulletin.",
        },
        { status: 404 },
      );
    }

    // Cards must mirror exactly which (bundle, op) pairs matched the
    // filter — not every combination of matched bundles x matched ops.
    // E.g. a bundle-only filter can pull in coupons for several different
    // operations per bundle, but not necessarily every operation for every
    // bundle, so the cross product buildCouponCards would do internally
    // would over-render pairs that were never actually generated.
    const bundleByNo = new Map(bundles.map((b) => [b.bundleNo, b]));
    const opByNo = new Map(operations.map((o) => [o.opNo, o]));
    const cards: CouponCard[] = coupons.flatMap((c) => {
      const bundle = bundleByNo.get(c.BundleNo);
      const op = opByNo.get(c.OpNo);
      return bundle && op ? [{ bundle, op }] : [];
    });

    if (cards.length === 0) {
      return Response.json(
        {
          error:
            "Coupons matched, but their bundle/operation data is no longer in the style bulletin.",
        },
        { status: 404 },
      );
    }

    // No dedicated style code source here (same as Open Order's own coupon
    // generation — see activeStyle in open-order/page.tsx) — leave blank
    // rather than mislabeling the work order as a style code.
    const saleOrderNo = cutRows.recordset[0]?.Sale_Order_No ?? "";

    const { buffer } = await generateCouponPdf({
      workOrder,
      saleOrderNo,
      styleCode: "",
      bundles,
      operations,
      cards,
      layout,
      codeType,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="coupons-${workOrder}.pdf"`,
      },
    });
  } catch (err: unknown) {
    console.error("Coupon PDF (filtered) generation error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
