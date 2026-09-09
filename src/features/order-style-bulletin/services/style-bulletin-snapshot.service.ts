import {
  sql,
  getPool,
  styleBulletinByFilter,
  cutDetailByFilter,
} from "@/lib/db";

// Captures the current indusPlus style-bulletin/cut-detail rows for exactly
// the operations/bundles a coupon-generation run touched, into the
// pitSystem snapshot tables (see db/migrations/012_style_bulletin_snapshot.sql).
// Called once per successful coupon registration — see
// src/app/api/qr-code-generation/coupons/route.ts. Safe to call repeatedly
// for the same work order: MERGE upserts by natural key, refreshing the
// data columns but keeping the original InsertedAt/InsertedBy from the
// first capture.

interface StyleBulletinIndusRow {
  Sale_Order_No: unknown;
  Customer_Name: unknown;
  Operation_Code: string;
  Operation_Name: unknown;
  Section: unknown;
  Operation_Sequence: unknown;
  Machine_Type: unknown;
  Piece_Rate: unknown;
  Smv_Sam: unknown;
  First_Operation_Section_Wise: unknown;
  Last_Operation_Section_Wise: unknown;
}

interface CutDetailIndusRow {
  Sale_Order_No: unknown;
  Customer_Name: unknown;
  Bundle_Id: unknown;
  Order_Qty_After_Add: unknown;
  Inseam: unknown;
  Size: unknown;
  Color: unknown;
  Fabric_Code_Main_Body: unknown;
  Wash: unknown;
  Cut: unknown;
  Bundle_Qty: unknown;
  Shade: unknown;
  Shrinkage: unknown;
}

const IN_LIST_CHUNK_SIZE = 2000; // stays well under SQL Server's ~2100 parameter cap

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// A MERGE fails outright ("attempted to UPDATE or DELETE the same row more
// than once") if its source rowset has two rows with the same target key —
// Indus's real tables aren't guaranteed to have exactly one row per
// (Order No, Operation Code) / (Work Order #, Bundle Id), so this collapses
// the fetched rows to one-per-key (last one wins) before they're ever
// handed to sql.Table, rather than letting a rare duplicate blow up the
// whole batch.
function dedupeByKey<T>(rows: T[], keyOf: (row: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const row of rows) byKey.set(keyOf(row), row);
  return [...byKey.values()];
}

async function fetchStyleBulletinRows(
  workOrder: string,
  opNos: string[],
): Promise<StyleBulletinIndusRow[]> {
  const uniqueOps = [...new Set(opNos)];
  if (uniqueOps.length === 0) return [];
  const pool = await getPool("indusPlus");
  const rows: StyleBulletinIndusRow[] = [];
  for (const batch of chunk(uniqueOps, IN_LIST_CHUNK_SIZE)) {
    const request = pool.request().input("wo", sql.NVarChar, workOrder);
    const placeholders = batch.map((o, i) => {
      request.input(`o${i}`, sql.NVarChar, o);
      return `@o${i}`;
    });
    const result = await request.query(
      styleBulletinByFilter(
        `[Order No] = @wo AND [Operation Code] IN (${placeholders.join(", ")})`,
      ),
    );
    rows.push(...(result.recordset as StyleBulletinIndusRow[]));
  }
  return rows;
}

async function fetchCutDetailRows(
  workOrder: string,
  bundleIds: string[],
): Promise<CutDetailIndusRow[]> {
  const uniqueBundles = [...new Set(bundleIds)];
  if (uniqueBundles.length === 0) return [];
  const pool = await getPool("indusPlus");
  const rows: CutDetailIndusRow[] = [];
  for (const batch of chunk(uniqueBundles, IN_LIST_CHUNK_SIZE)) {
    const request = pool.request().input("wo", sql.NVarChar, workOrder);
    const placeholders = batch.map((b, i) => {
      request.input(`b${i}`, sql.NVarChar, b);
      return `@b${i}`;
    });
    const result = await request.query(
      cutDetailByFilter(
        `[Work Order #] = @wo AND CAST([Bundle Id] AS NVARCHAR(50)) IN (${placeholders.join(", ")})`,
      ),
    );
    rows.push(...(result.recordset as CutDetailIndusRow[]));
  }
  return rows;
}

function buildStyleBulletinRowsTable(rows: StyleBulletinIndusRow[], workOrder: string): sql.Table {
  const table = new sql.Table("dbo.StyleBulletinSnapshotRowType") as unknown as {
    columns: { add: (name: string, type: unknown, opts?: { nullable?: boolean }) => void };
    rows: { add: (...values: unknown[]) => void };
  };
  table.columns.add("SaleOrderNo", sql.NVarChar(100), { nullable: true });
  table.columns.add("CustomerName", sql.NVarChar(200), { nullable: true });
  table.columns.add("OrderNo", sql.NVarChar(50));
  table.columns.add("OperationCode", sql.NVarChar(50));
  table.columns.add("OperationName", sql.NVarChar(200), { nullable: true });
  table.columns.add("Section", sql.NVarChar(200), { nullable: true });
  table.columns.add("OperationSequence", sql.NVarChar(50), { nullable: true });
  table.columns.add("MachineType", sql.NVarChar(100), { nullable: true });
  table.columns.add("PieceRate", sql.Float, { nullable: true });
  table.columns.add("SmvSam", sql.Float, { nullable: true });
  table.columns.add("FirstOpSectionWise", sql.NVarChar(50), { nullable: true });
  table.columns.add("LastOpSectionWise", sql.NVarChar(50), { nullable: true });
  for (const row of rows) {
    table.rows.add(
      row.Sale_Order_No != null ? String(row.Sale_Order_No) : null,
      row.Customer_Name != null ? String(row.Customer_Name) : null,
      workOrder,
      row.Operation_Code,
      row.Operation_Name != null ? String(row.Operation_Name) : null,
      row.Section != null ? String(row.Section) : null,
      row.Operation_Sequence != null ? String(row.Operation_Sequence) : null,
      row.Machine_Type != null ? String(row.Machine_Type) : null,
      row.Piece_Rate != null ? Number(row.Piece_Rate) : null,
      row.Smv_Sam != null ? Number(row.Smv_Sam) : null,
      row.First_Operation_Section_Wise != null ? String(row.First_Operation_Section_Wise) : null,
      row.Last_Operation_Section_Wise != null ? String(row.Last_Operation_Section_Wise) : null,
    );
  }
  return table as unknown as sql.Table;
}

function buildCutDetailRowsTable(rows: CutDetailIndusRow[], workOrder: string): sql.Table {
  const table = new sql.Table("dbo.CutDetailSnapshotRowType") as unknown as {
    columns: { add: (name: string, type: unknown, opts?: { nullable?: boolean }) => void };
    rows: { add: (...values: unknown[]) => void };
  };
  table.columns.add("SaleOrderNo", sql.NVarChar(100), { nullable: true });
  table.columns.add("CustomerName", sql.NVarChar(200), { nullable: true });
  table.columns.add("WorkOrder", sql.NVarChar(50));
  table.columns.add("OrderQtyAfterAdd", sql.Float, { nullable: true });
  table.columns.add("Inseam", sql.NVarChar(50), { nullable: true });
  table.columns.add("Size", sql.NVarChar(50), { nullable: true });
  table.columns.add("Color", sql.NVarChar(50), { nullable: true });
  table.columns.add("FabricCodeMainBody", sql.NVarChar(100), { nullable: true });
  table.columns.add("Wash", sql.NVarChar(50), { nullable: true });
  table.columns.add("Cut", sql.NVarChar(50), { nullable: true });
  table.columns.add("BundleId", sql.NVarChar(50));
  table.columns.add("BundleQty", sql.Float, { nullable: true });
  table.columns.add("Shade", sql.NVarChar(50), { nullable: true });
  table.columns.add("Shrinkage", sql.NVarChar(50), { nullable: true });
  for (const row of rows) {
    table.rows.add(
      row.Sale_Order_No != null ? String(row.Sale_Order_No) : null,
      row.Customer_Name != null ? String(row.Customer_Name) : null,
      workOrder,
      row.Order_Qty_After_Add != null ? Number(row.Order_Qty_After_Add) : null,
      row.Inseam != null ? String(row.Inseam) : null,
      row.Size != null ? String(row.Size) : null,
      row.Color != null ? String(row.Color) : null,
      row.Fabric_Code_Main_Body != null ? String(row.Fabric_Code_Main_Body) : null,
      row.Wash != null ? String(row.Wash) : null,
      row.Cut != null ? String(row.Cut) : null,
      row.Bundle_Id != null ? String(row.Bundle_Id) : null,
      row.Bundle_Qty != null ? Number(row.Bundle_Qty) : null,
      row.Shade != null ? String(row.Shade) : null,
      row.Shrinkage != null ? String(row.Shrinkage) : null,
    );
  }
  return table as unknown as sql.Table;
}

async function mergeStyleBulletinSnapshot(
  rows: StyleBulletinIndusRow[],
  workOrder: string,
  insertedBy: string,
  generationId: string,
) {
  if (rows.length === 0) return;
  const deduped = dedupeByKey(rows, (r) => r.Operation_Code);
  const pool = await getPool("pitSystem");
  await pool
    .request()
    .input("insertedBy", sql.NVarChar, insertedBy)
    .input("generationId", sql.UniqueIdentifier, generationId)
    .input("Rows", buildStyleBulletinRowsTable(deduped, workOrder))
    .query(`
      MERGE INTO dbo.StyleBullettinInt AS target
      USING @Rows AS source
      ON target.[Order No] = source.OrderNo AND target.[Operation Code] = source.OperationCode
      WHEN MATCHED THEN
        UPDATE SET
          target.[Sale order No] = source.SaleOrderNo,
          target.[Customer Name] = source.CustomerName,
          target.[Operation Name] = source.OperationName,
          target.Section = source.Section,
          target.[Operation Sequeance] = source.OperationSequence,
          target.[Machine Type] = source.MachineType,
          target.[Piece Rate] = source.PieceRate,
          target.[Smv/Sam] = source.SmvSam,
          target.[First Operation Section Wise] = source.FirstOpSectionWise,
          target.[Last Operation Section Wise] = source.LastOpSectionWise,
          target.Id = @generationId
      WHEN NOT MATCHED THEN
        INSERT (
          Id, [Sale order No], [Customer Name], [Order No], [Operation Code], [Operation Name],
          Section, [Operation Sequeance], [Machine Type], [Piece Rate], [Smv/Sam],
          [First Operation Section Wise], [Last Operation Section Wise], InsertedBy
        )
        VALUES (
          @generationId, source.SaleOrderNo, source.CustomerName, source.OrderNo, source.OperationCode, source.OperationName,
          source.Section, source.OperationSequence, source.MachineType, source.PieceRate, source.SmvSam,
          source.FirstOpSectionWise, source.LastOpSectionWise, @insertedBy
        );
    `);
}

async function mergeCutDetailSnapshot(
  rows: CutDetailIndusRow[],
  workOrder: string,
  insertedBy: string,
  generationId: string,
) {
  if (rows.length === 0) return;
  const deduped = dedupeByKey(rows, (r) => String(r.Bundle_Id));
  const pool = await getPool("pitSystem");
  await pool
    .request()
    .input("insertedBy", sql.NVarChar, insertedBy)
    .input("generationId", sql.UniqueIdentifier, generationId)
    .input("Rows", buildCutDetailRowsTable(deduped, workOrder))
    .query(`
      MERGE INTO dbo.SaleOrderPOCutDetailViewV1 AS target
      USING @Rows AS source
      ON target.[Work Order #] = source.WorkOrder AND target.[Bundle Id] = source.BundleId
      WHEN MATCHED THEN
        UPDATE SET
          target.[Sale Order No] = source.SaleOrderNo,
          target.[Customer Name] = source.CustomerName,
          target.[Order Qty After % Add] = source.OrderQtyAfterAdd,
          target.Inseam = source.Inseam,
          target.Size = source.Size,
          target.Color = source.Color,
          target.[Fabric Code(Main Body)] = source.FabricCodeMainBody,
          target.Wash = source.Wash,
          target.[Cut #] = source.Cut,
          target.[Bundle Qty] = source.BundleQty,
          target.Shade = source.Shade,
          target.Shrinkage = source.Shrinkage,
          target.Id = @generationId
      WHEN NOT MATCHED THEN
        INSERT (
          Id, [Sale Order No], [Customer Name], [Work Order #], [Order Qty After % Add], Inseam, Size, Color,
          [Fabric Code(Main Body)], Wash, [Cut #], [Bundle Id], [Bundle Qty], Shade, Shrinkage, InsertedBy
        )
        VALUES (
          @generationId, source.SaleOrderNo, source.CustomerName, source.WorkOrder, source.OrderQtyAfterAdd, source.Inseam,
          source.Size, source.Color, source.FabricCodeMainBody, source.Wash, source.Cut, source.BundleId,
          source.BundleQty, source.Shade, source.Shrinkage, @insertedBy
        );
    `);
}

// insertedBy falls back to "system" (never left null/empty) so a missing
// client-supplied identity can't break attribution — see
// src/app/api/qr-code-generation/coupons/route.ts.
//
// generationId is caller-supplied (not generated here) so the SAME id can
// be shared with dbo.QrCode_Coupon's rows for this run too — see
// coupon-registration.service.ts's registerCoupons, which takes the same
// parameter — tying "the coupons this run created" together with "the
// style-bulletin/cut-detail rows this run touched" under one traceable id
// across all three tables for a single "Generate Coupons" action.
//
// Id on both snapshot tables is a per-GENERATION tracking key, not a
// per-row one (see db/migrations/016_style_bulletin_snapshot_generation_id.sql):
// every style-bulletin row and every cut-detail row this call touches —
// whether newly inserted or an existing row matched by natural key — gets
// stamped with the SAME generationId, so every row this one coupon-
// generation run produced or refreshed can be found later by that one Id,
// across both tables.
export async function snapshotWorkOrderBulletin(
  workOrder: string,
  opNos: string[],
  bundleIds: string[],
  insertedBy: string,
  generationId: string,
): Promise<void> {
  const by = insertedBy?.trim() || "system";
  const [styleBulletinRows, cutDetailRows] = await Promise.all([
    fetchStyleBulletinRows(workOrder, opNos),
    fetchCutDetailRows(workOrder, bundleIds),
  ]);
  await Promise.all([
    mergeStyleBulletinSnapshot(styleBulletinRows, workOrder, by, generationId),
    mergeCutDetailSnapshot(cutDetailRows, workOrder, by, generationId),
  ]);
}
