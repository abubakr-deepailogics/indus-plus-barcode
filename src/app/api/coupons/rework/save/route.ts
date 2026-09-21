import { randomUUID } from "crypto";
import { getPool, sql } from "@/lib/db";
import { buildCouponCards } from "@/features/qr-code-generation/services/coupon-pairing.service";
import {
  registerCoupons,
  countCoupons,
} from "@/features/qr-code-generation/services/coupon-registration.service";
import { snapshotWorkOrderBulletin } from "@/features/order-style-bulletin/services/style-bulletin-snapshot.service";
import type {
  BundleDetailRow,
  OperationsDetailRow,
} from "@/features/qr-code-generation/types";

export const dynamic = "force-dynamic";

interface SaveRequestBody {
  workOrder: string;
  saleOrderNo?: string;
  customerName?: string;
  reworkQty?: number | string;
  remarks?: string;
  insertedBy?: string;
  bundles: BundleDetailRow[];
  operations: OperationsDetailRow[];
}

const ROWS_PER_CHUNK = 150;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SaveRequestBody>;
    const {
      workOrder,
      saleOrderNo,
      customerName,
      reworkQty,
      remarks,
      insertedBy,
      bundles,
      operations,
    } = body;

    if (!workOrder || !Array.isArray(bundles) || !Array.isArray(operations)) {
      return Response.json(
        { error: "workOrder, bundles, and operations are all required." },
        { status: 400 },
      );
    }

    const selectedBundles = bundles.filter((b) => b.sel);
    const selectedOperations = operations.filter((op) => op.lastOpSection);
    if (selectedBundles.length === 0) {
      return Response.json(
        { error: "Add at least one Cutting Detail row." },
        { status: 400 },
      );
    }
    if (selectedOperations.length === 0) {
      return Response.json(
        { error: "Select at least one operation under Operations Detail." },
        { status: 400 },
      );
    }

    const missingCut = selectedBundles.filter((b) => !b.cutNo?.trim());
    if (missingCut.length > 0) {
      return Response.json(
        {
          error: `Enter a Cut # for every row (missing on ${missingCut.length} row${missingCut.length === 1 ? "" : "s"}).`,
        },
        { status: 400 },
      );
    }

    const missingPcs = selectedBundles.filter((b) => !b.pcs || Number(b.pcs) <= 0);
    if (missingPcs.length > 0) {
      return Response.json(
        {
          error: `Enter Pcs greater than 0 for every row (invalid on ${missingPcs.length} row${missingPcs.length === 1 ? "" : "s"}).`,
        },
        { status: 400 },
      );
    }

    const pool = await getPool("pitSystem");
    const by = insertedBy?.trim() || "system";
    const reworkQtyNum =
      reworkQty != null && reworkQty !== "" ? Number(reworkQty) : null;
    const batchId = randomUUID();

    // 0. Verify that original production coupons were generated for this work order.
    // Rework coupons cannot be created if coupons were never generated for this work order.
    const origCouponsCheck = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .query(`
        SELECT TOP 1 1 AS hasCoupons
        FROM dbo.QrCode_Coupon
        WHERE WorkOrder = @wo AND IsDeleted = 0 AND BundleNo NOT LIKE 'RW%'
      `);

    if (origCouponsCheck.recordset.length === 0) {
      return Response.json(
        {
          error:
            "Coupons have not been generated for this Work Order yet. Rework coupons can only be created for work orders with generated coupons.",
        },
        { status: 400 },
      );
    }

    // 1. Assign sequential unique rework bundle numbers following the same
    // convention as ERP bundles: RW + raw work-order digits (leading zeros
    // preserved) + 3-digit sequence. e.g. W/O-002653 → RW002653001, RW002653002.
    // Globally unique across work orders; trimBundleNo strips "RW002653" so the
    // barcode and card only show the short "RW001" form.
    const workOrderRawDigits = workOrder.replace(/\D/g, ""); // "002653" for "W/O-002653"
    const rwPrefix = `RW${workOrderRawDigits}`; // "RW002653"
    const maxRes = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .input("prefix", sql.NVarChar, rwPrefix)
      .query(`
        SELECT MAX(TRY_CAST(SUBSTRING(BundleNo, LEN(@prefix) + 1, 20) AS INT)) AS maxNum
        FROM dbo.QrCode_Coupon
        WHERE WorkOrder = @wo AND BundleNo LIKE @prefix + '%'
      `);
    let nextSeq = (Number(maxRes.recordset[0]?.maxNum) || 0) + 1;

    const assignedBundles: BundleDetailRow[] = selectedBundles.map((b) => {
      const bundleNo = `${rwPrefix}${String(nextSeq++).padStart(3, "0")}`;
      return {
        ...b,
        bundleNo,
        cutNo: b.cutNo.trim(),
        char: b.char || "",
        pcs: Number(b.pcs) || 0,
      };
    });

    // 2. Insert ONLY the manual cut rows into dbo.ReworkCouponEntry.
    // Operation details are NOT duplicated here — they are already in the style bulletin.
    for (const batch of chunk(assignedBundles, ROWS_PER_CHUNK)) {
      const req = pool.request();
      req.input("batchId", sql.UniqueIdentifier, batchId);
      req.input("workOrder", sql.NVarChar, workOrder);
      req.input("saleOrderNo", sql.NVarChar, saleOrderNo ?? null);
      req.input("customerName", sql.NVarChar, customerName ?? null);
      req.input("reworkQty", sql.Int, reworkQtyNum);
      req.input("remarks", sql.NVarChar, remarks ?? null);
      req.input("insertedBy", sql.NVarChar, by);

      const values = batch.map((bundle, i) => {
        req.input(`cutNo${i}`, sql.NVarChar, bundle.cutNo);
        req.input(`char${i}`, sql.NVarChar, bundle.char ?? null);
        req.input(`bundleNo${i}`, sql.NVarChar, bundle.bundleNo);
        req.input(`inseam${i}`, sql.NVarChar, bundle.inseam ? String(bundle.inseam) : null);
        req.input(`size${i}`, sql.NVarChar, bundle.size ? String(bundle.size) : null);
        req.input(`pcs${i}`, sql.Int, bundle.pcs);
        return `(@batchId, @workOrder, @saleOrderNo, @customerName, @cutNo${i}, @char${i}, @bundleNo${i}, @inseam${i}, @size${i}, @pcs${i}, @reworkQty, @remarks, @insertedBy)`;
      });

      await req.query(`
        INSERT INTO dbo.ReworkCouponEntry
          (Id, WorkOrder, SaleOrderNo, CustomerName, CutNo, [Char], BundleNo, Inseam, Size, Pcs,
           ReworkQty, Remarks, InsertedBy)
        VALUES ${values.join(", ")}
      `);
    }

    // 3. Build cards and register coupons in dbo.QrCode_Coupon with the shared batchId
    const cards = buildCouponCards(assignedBundles, selectedOperations);
    const { insertedCount } = await registerCoupons(
      pool,
      workOrder,
      cards,
      by,
      batchId,
    );

    // 4. Snapshot operations to pitSystem dbo.StyleBullettinInt with the shared batchId
    try {
      await snapshotWorkOrderBulletin(
        workOrder,
        selectedOperations.map((o) => o.opNo),
        assignedBundles.map((b) => b.bundleNo),
        by,
        batchId,
      );
    } catch (snapshotErr) {
      console.warn("Rework operation snapshot warning:", snapshotErr);
    }

    // 5. Query updated total coupon count
    const couponCount = await countCoupons(pool, workOrder);

    return Response.json({
      success: true,
      batchId,
      insertedCutCount: assignedBundles.length,
      cardCount: cards.length,
      insertedCount,
      couponCount,
      bundles: assignedBundles,
    });
  } catch (err: unknown) {
    console.error("Rework coupon save error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}

