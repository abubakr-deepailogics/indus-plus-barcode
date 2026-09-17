import { randomUUID } from "crypto";
import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Saves the Rework Coupon page's Cutting Detail + Operations Detail tables
// into dbo.ReworkCouponEntry (pitSystem) — one row per SELECTED bundle ×
// SELECTED operation combo, same cross-product shape coupon generation
// uses for cards, but this table is a plain record of what was entered, not
// a coupon-identity table (no CouponCode, nothing here is ever scanned).
// CutNo is never looked up — every selected bundle must have one typed in
// by the user before this succeeds (see BundleDetailTable's onCutNoChange).
interface BundleInput {
  id: number;
  cutNo: string;
  char?: string;
  bundleNo: string;
  inseam: string;
  size: string;
  pcs: number;
  sel: boolean;
}

interface OperationInput {
  id: number;
  section: string;
  seqNo: string;
  opNo: string;
  operationName: string;
  smv: string;
  rate: string;
  lastOpSection: boolean;
}

interface SaveRequestBody {
  workOrder: string;
  saleOrderNo?: string;
  customerName?: string;
  reworkQty?: number | string;
  remarks?: string;
  insertedBy?: string;
  bundles: BundleInput[];
  operations: OperationInput[];
}

// Chunked well under SQL Server's ~2100 parameter cap — each row here binds
// 13 params, so a chunk of 150 rows is 1950 params, same reasoning as
// coupon-history.service.ts's ROWS_PER_CHUNK for a similar multi-column
// VALUES insert.
const ROWS_PER_CHUNK = 150;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SaveRequestBody>;
    const { workOrder, saleOrderNo, customerName, reworkQty, remarks, insertedBy, bundles, operations } = body;

    if (!workOrder || !Array.isArray(bundles) || !Array.isArray(operations)) {
      return Response.json(
        { error: "workOrder, bundles, and operations are all required." },
        { status: 400 },
      );
    }

    const selectedBundles = bundles.filter((b) => b.sel);
    const selectedOperations = operations.filter((op) => op.lastOpSection);
    if (selectedBundles.length === 0) {
      return Response.json({ error: "Select at least one bundle." }, { status: 400 });
    }
    if (selectedOperations.length === 0) {
      return Response.json({ error: "Select at least one operation." }, { status: 400 });
    }

    // Cut # is manually entered on this page (never looked up) — every
    // selected bundle needs one before saving, otherwise a later report
    // reading this table would have no way to tell which cut a row
    // belongs to.
    const missingCut = selectedBundles.filter((b) => !b.cutNo?.trim());
    if (missingCut.length > 0) {
      return Response.json(
        {
          error: `Enter a Cut # for every selected bundle before saving (missing on ${missingCut.length} row${missingCut.length === 1 ? "" : "s"}).`,
        },
        { status: 400 },
      );
    }

    const by = insertedBy?.trim() || "system";
    const reworkQtyNum = reworkQty != null && reworkQty !== "" ? Number(reworkQty) : null;
    const batchId = randomUUID();

    const rows = selectedOperations.flatMap((op) =>
      selectedBundles.map((bundle) => ({ bundle, op })),
    );

    const pool = await getPool("pitSystem");
    let inserted = 0;
    for (const batch of chunk(rows, ROWS_PER_CHUNK)) {
      const req = pool.request();
      req.input("batchId", sql.UniqueIdentifier, batchId);
      req.input("workOrder", sql.NVarChar, workOrder);
      req.input("saleOrderNo", sql.NVarChar, saleOrderNo ?? null);
      req.input("customerName", sql.NVarChar, customerName ?? null);
      req.input("reworkQty", sql.Int, reworkQtyNum);
      req.input("remarks", sql.NVarChar, remarks ?? null);
      req.input("insertedBy", sql.NVarChar, by);

      const values = batch.map(({ bundle, op }, i) => {
        req.input(`cutNo${i}`, sql.NVarChar, bundle.cutNo.trim());
        req.input(`char${i}`, sql.NVarChar, bundle.char ?? null);
        req.input(`bundleNo${i}`, sql.NVarChar, bundle.bundleNo);
        req.input(`inseam${i}`, sql.NVarChar, bundle.inseam ?? null);
        req.input(`size${i}`, sql.NVarChar, bundle.size ?? null);
        req.input(`pcs${i}`, sql.Int, bundle.pcs ?? null);
        req.input(`section${i}`, sql.NVarChar, op.section ?? null);
        req.input(`seqNo${i}`, sql.NVarChar, op.seqNo ?? null);
        req.input(`opNo${i}`, sql.NVarChar, op.opNo);
        req.input(`opName${i}`, sql.NVarChar, op.operationName ?? null);
        req.input(`smv${i}`, sql.Float, op.smv ? Number(op.smv) : null);
        req.input(`rate${i}`, sql.Float, op.rate ? Number(op.rate) : null);
        return `(@batchId, @workOrder, @saleOrderNo, @customerName, @cutNo${i}, @char${i}, @bundleNo${i}, @inseam${i}, @size${i}, @pcs${i}, @section${i}, @seqNo${i}, @opNo${i}, @opName${i}, @smv${i}, @rate${i}, @reworkQty, @remarks, @insertedBy)`;
      });

      await req.query(`
        INSERT INTO dbo.ReworkCouponEntry
          (Id, WorkOrder, SaleOrderNo, CustomerName, CutNo, [Char], BundleNo, Inseam, Size, Pcs,
           Section, SeqNo, OpNo, OperationName, Smv, Rate, ReworkQty, Remarks, InsertedBy)
        VALUES ${values.join(", ")}
      `);
      inserted += batch.length;
    }

    return Response.json({ success: true, batchId, insertedCount: inserted });
  } catch (err: unknown) {
    console.error("Rework coupon save error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
