// Washing Cut Report Service - Department: Washing
import { getPool, sql, cutDetailByFilter, styleBulletinByFilter } from "@/lib/db";
import type {
  SaveWashingCutReportPayload,
  SavedWashingCutRecord,
  WashingOrderMetadata,
} from "../types";

const ROWS_PER_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Loads order metadata for the top cards from indusPlus (ERP),
 * and previously saved washing cuts from pitSystem's dedicated dbo.CutReport table.
 */
export async function getWashingCutReport(workOrder: string): Promise<{
  metadata: WashingOrderMetadata | null;
  cuts: SavedWashingCutRecord[];
}> {
  const trimmedWo = workOrder.trim();
  if (!trimmedWo) {
    return { metadata: null, cuts: [] };
  }

  // 1. Fetch live order metadata for the top cards component from indusPlus (ERP)
  let metadata: WashingOrderMetadata | null = null;

  try {
    const indusPool = await getPool("indusPlus");
    const [cutDetailResult, styleBulletinResult] = await Promise.all([
      indusPool
        .request()
        .input("wo", sql.NVarChar, trimmedWo)
        .query(cutDetailByFilter("[Work Order #] = @wo"))
        .catch((err) => {
          console.error("ERP cutDetailByFilter failed:", err);
          return { recordset: [] as Record<string, unknown>[] };
        }),
      indusPool
        .request()
        .input("wo", sql.NVarChar, trimmedWo)
        .query(styleBulletinByFilter("[Order No] = @wo"))
        .catch((err) => {
          console.error("ERP styleBulletinByFilter failed:", err);
          return { recordset: [] as Record<string, unknown>[] };
        }),
    ]);

    const firstCut = cutDetailResult.recordset[0];
    const firstSb = styleBulletinResult.recordset[0];

    if (firstCut || firstSb) {
      metadata = {
        workOrder: trimmedWo,
        saleOrderNo: String(firstCut?.Sale_Order_No ?? firstSb?.Sale_Order_No ?? ""),
        customerName: String(firstCut?.Customer_Name ?? firstSb?.Customer_Name ?? ""),
        orderQty: firstCut?.Order_Qty_After_Add != null ? Number(firstCut.Order_Qty_After_Add) : null,
        fabricCode: String(firstCut?.Fabric_Code_Main_Body ?? ""),
        wash: String(firstCut?.Wash ?? ""),
      };
    }
  } catch (erpErr) {
    console.error("Failed fetching live ERP metadata for washing cut report:", erpErr);
  }

  // 2. Fetch previously saved washing cuts from pitSystem's dedicated dbo.CutReport table
  const pitPool = await getPool("pitSystem");
  const savedCutsResult = await pitPool
    .request()
    .input("wo", sql.NVarChar, trimmedWo)
    .query(`
      SELECT
        [Id]        AS Id,
        [Cut]       AS Cut,
        [BundleId]  AS Bundle_Id,
        [BundleQty] AS Bundle_Qty,
        [Inseam],
        [Size],
        [InsertedAt]
      FROM dbo.CutReport
      WHERE [WorkOrder] = @wo
        AND [Department] = 'washing'
        AND [IsDeleted] = 0
      ORDER BY LEN([Cut]), [Cut],
               TRY_CAST([BundleId] AS BIGINT), [BundleId]
    `);

  const cuts: SavedWashingCutRecord[] = savedCutsResult.recordset.map((row) => ({
    Id: Number(row.Id),
    Cut: String(row.Cut ?? ""),
    Bundle_Id: String(row.Bundle_Id ?? ""),
    Bundle_Qty: Number(row.Bundle_Qty) || 0,
    Inseam: row.Inseam != null ? String(row.Inseam) : null,
    Size: row.Size != null ? String(row.Size) : null,
    InsertedAt: row.InsertedAt ? new Date(row.InsertedAt).toISOString() : undefined,
  }));

  // Fallback metadata from pitSystem dbo.CutReport when ERP has nothing
  if (!metadata && cuts.length > 0) {
    const fallbackRes = await pitPool
      .request()
      .input("wo", sql.NVarChar, trimmedWo)
      .query(`
        SELECT TOP 1
          [SaleOrderNo]  AS saleOrderNo,
          [CustomerName] AS customerName,
          [OrderQty]     AS orderQty,
          [FabricCode]   AS fabricCode,
          [Wash]         AS wash
        FROM dbo.CutReport
        WHERE [WorkOrder] = @wo
          AND [Department] = 'washing'
          AND [IsDeleted] = 0
      `);

    const fb = fallbackRes.recordset[0];
    if (fb) {
      metadata = {
        workOrder: trimmedWo,
        saleOrderNo: String(fb.saleOrderNo ?? ""),
        customerName: String(fb.customerName ?? ""),
        orderQty: fb.orderQty != null ? Number(fb.orderQty) : null,
        fabricCode: String(fb.fabricCode ?? ""),
        wash: String(fb.wash ?? ""),
      };
    }
  }

  return { metadata, cuts };
}

/**
 * Saves washing cut rows exclusively into pitSystem's dedicated dbo.CutReport table
 * with Department = 'washing'.
 * Enforces validation that Bundle Qty cannot exceed Order Qty.
 */
export async function saveWashingCutReport(
  payload: SaveWashingCutReportPayload,
  userEmail: string,
): Promise<{
  insertedCount: number;
  insertedRows: Array<{ id: number; bundleId: string }>;
}> {
  const { workOrder, saleOrderNo, customerName, orderQty, fabricCode, wash, cuts } = payload;

  const trimmedWo = workOrder?.trim();
  if (!trimmedWo) throw new Error("Work Order is required.");
  if (!Array.isArray(cuts) || cuts.length === 0)
    throw new Error("At least one cutting detail row is required.");

  const maxOrderQty = orderQty != null && Number(orderQty) > 0 ? Number(orderQty) : null;
  const newBundleQtyTotal = cuts.reduce(
    (total, row) => total + Number(row.bundleQty),
    0,
  );

  // Validate required fields and Order Qty constraint
  for (let i = 0; i < cuts.length; i++) {
    const row = cuts[i];
    if (!String(row.cut ?? "").trim()) throw new Error(`Row ${i + 1}: Cut # is required.`);
    const qty = Number(row.bundleQty);
    if (isNaN(qty) || qty <= 0) throw new Error(`Row ${i + 1}: Bundle Qty must be a positive number.`);

    if (maxOrderQty !== null && qty > maxOrderQty) {
      throw new Error(
        `Row ${i + 1}: Bundle Qty (${qty}) cannot be greater than Order Qty (${maxOrderQty}).`,
      );
    }
  }

  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const savedTotalResult = await new sql.Request(transaction)
      .input("wo", sql.NVarChar, trimmedWo)
      .query(`
        SELECT COALESCE(SUM([BundleQty]), 0) AS totalBundleQty
        FROM dbo.CutReport
        WHERE [WorkOrder] = @wo
          AND [Department] = 'washing'
          AND [IsDeleted] = 0
      `);
    const savedBundleQtyTotal = Number(savedTotalResult.recordset[0]?.totalBundleQty) || 0;

    if (
      maxOrderQty !== null &&
      savedBundleQtyTotal + newBundleQtyTotal > maxOrderQty
    ) {
      throw new Error(
        `Total Bundle Qty (${(savedBundleQtyTotal + newBundleQtyTotal).toLocaleString()}) cannot be greater than Order Qty (${maxOrderQty.toLocaleString()}).`,
      );
    }

    const by = userEmail?.trim() || "system";

    // 1. Insert new cut rows in chunks into dbo.CutReport (always append — never delete existing rows)
    let insertedCount = 0;
    const insertedRows: Array<{ id: number; bundleId: string }> = [];
    const batches = chunk(cuts, ROWS_PER_CHUNK);

    for (const batch of batches) {
      const req = new sql.Request(transaction);
      req.input("wo",           sql.NVarChar, trimmedWo);
      req.input("saleOrderNo",  sql.NVarChar, saleOrderNo?.trim() || null);
      req.input("customerName", sql.NVarChar, customerName?.trim() || null);
      req.input("orderQty",     sql.Float,    orderQty != null ? Number(orderQty) : null);
      req.input("fabricCode",   sql.NVarChar, fabricCode?.trim() || null);
      req.input("wash",         sql.NVarChar, wash?.trim() || null);
      req.input("insertedBy",   sql.NVarChar, by);

      const valueClauses = batch.map((item, idx) => {
        const globalIdx = insertedCount + idx + 1;
        const bundleId = item.bundleId?.trim() || String(globalIdx);

        req.input(`cut_${idx}`,        sql.NVarChar, String(item.cut).trim());
        req.input(`bundleId_${idx}`,   sql.NVarChar, bundleId);
        req.input(`bundleQty_${idx}`,  sql.Float,    Number(item.bundleQty));
        req.input(`inseam_${idx}`,     sql.NVarChar, item.inseam?.trim() || null);
        req.input(`size_${idx}`,       sql.NVarChar, item.size?.trim() || null);

        return `(
          @wo,
          @saleOrderNo,
          @customerName,
          @orderQty,
          @fabricCode,
          @wash,
          'washing',
          @cut_${idx},
          @bundleId_${idx},
          @bundleQty_${idx},
          @inseam_${idx},
          @size_${idx},
          SYSUTCDATETIME(),
          @insertedBy,
          0
        )`;
      });

      const insertResult = await req.query(`
        INSERT INTO dbo.CutReport (
          [WorkOrder],
          [SaleOrderNo],
          [CustomerName],
          [OrderQty],
          [FabricCode],
          [Wash],
          [Department],
          [Cut],
          [BundleId],
          [BundleQty],
          [Inseam],
          [Size],
          [InsertedAt],
          [InsertedBy],
          [IsDeleted]
        )
        OUTPUT INSERTED.[Id] AS id, INSERTED.[BundleId] AS bundleId
        VALUES ${valueClauses.join(", ")}
      `);

      insertedRows.push(
        ...insertResult.recordset.map((row) => ({
          id: Number(row.id),
          bundleId: String(row.bundleId),
        })),
      );

      insertedCount += batch.length;
    }

    await transaction.commit();
    return { insertedCount, insertedRows };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/** Marks one saved washing cut row as deleted without removing its audit history. */
export async function softDeleteWashingCutReportRow(
  recordId: number,
  workOrder: string,
  userEmail: string,
): Promise<void> {
  const trimmedWo = workOrder.trim();
  if (!Number.isSafeInteger(recordId) || recordId <= 0) {
    throw new Error("A valid cut report record ID is required.");
  }
  if (!trimmedWo) throw new Error("Work Order is required.");

  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("id", sql.BigInt, recordId)
    .input("wo", sql.NVarChar, trimmedWo)
    .input("deletedBy", sql.NVarChar, userEmail.trim() || "system")
    .query(`
      UPDATE dbo.CutReport
      SET [IsDeleted] = 1,
          [DeletedAt] = SYSUTCDATETIME(),
          [DeletedBy] = @deletedBy
      WHERE [Id] = @id
        AND [WorkOrder] = @wo
        AND [Department] = 'washing'
        AND [IsDeleted] = 0
    `);

  if ((result.rowsAffected[0] ?? 0) === 0) {
    throw new Error("The washing cut row was not found or was already deleted.");
  }
}
