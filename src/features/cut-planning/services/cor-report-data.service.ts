import { getPool, sql, cutDetailByFilter } from "@/lib/db";
import { getCutPlanning } from "./cut-planning.service";
import { assignSerialRanges, type CorReportBundleRow, type CorReportMeta } from "./cor-report-pdf.service";

// Same bundle source as /api/open-order's Cut Report branch: generated
// bundles (dbo.SewingCutReport joined to dbo.BundleGeneration, active rows
// only) when any exist, otherwise indusPlus's cut-detail view — plus Cut Planning's per-Cut Marker plies and indusPlus's cut-detail view
// for header fields (Sale Order No, Wash, Order Qty) that Cut Report itself
// doesn't carry on the generated-bundle row.
export async function fetchCorReportData(
  workOrderInput: string,
): Promise<{ meta: CorReportMeta; rows: CorReportBundleRow[] } | null> {
  const workOrder = workOrderInput.trim();
  if (!workOrder) return null;

  const pitPool = await getPool("pitSystem");
  const generatedResult = await pitPool.request().input("wo", sql.NVarChar, workOrder).query(`
    SELECT report.CutNo AS Cut, report.BundleId AS Bundle_Id, report.BundleQty AS Bundle_Qty,
      report.Inseam, report.Size, report.Color, report.Shade, report.Shrinkage,
      generation.BundleSequence
    FROM dbo.SewingCutReport AS report
    INNER JOIN dbo.BundleGeneration AS generation
      ON generation.Id = report.BundleGenerationId
    WHERE report.WorkOrder = @wo
      AND report.IsDeleted = 0
      AND generation.IsDeleted = 0
    ORDER BY generation.BundleSequence
  `);
  const hasGeneratedBundles = generatedResult.recordset.length > 0;

  const [planning, indusPool] = await Promise.all([
    getCutPlanning(workOrder),
    getPool("indusPlus"),
  ]);
  const markerPliesByCutNo = new Map(
    planning.plans.map((plan) => [String(plan.cutNo ?? "").trim().toLowerCase(), plan.markerPlies]),
  );

  // With generated bundles, the ERP cut-detail view only supplies header
  // fields — a work order generated entirely inside Cut Planning/PIT returns
  // zero rows there, so Sale Order No/Wash stay blank while Will Cut Qty and
  // Fabric fall back to Cut Planning's own data below.
  // Without generated bundles, Cut Report shows indusPlus's cut detail (same
  // fallback as /api/open-order), so the bundles themselves come from there
  // and a failed lookup must surface instead of reading as "no bundles".
  const cutDetailQuery = indusPool
    .request()
    .input("wo", sql.NVarChar, workOrder)
    .query(cutDetailByFilter("[Work Order #] = @wo"));
  const cutDetailResult = hasGeneratedBundles
    ? await cutDetailQuery.catch(() => ({ recordset: [] as Array<Record<string, unknown>> }))
    : await cutDetailQuery;
  const cutDetailRows = cutDetailResult.recordset as Array<Record<string, unknown>>;
  const firstCutDetail = cutDetailRows[0] as
    | { Sale_Order_No?: string; Wash?: string; Order_Qty_After_Add?: number; Fabric_Code_Main_Body?: string }
    | undefined;

  // cutDetailByFilter numbers rows by Cut, Bundle_Id but doesn't ORDER the
  // outer SELECT, so sort by RowId to get a stable bundle sequence.
  const bundleSourceRows = hasGeneratedBundles
    ? generatedResult.recordset
    : [...cutDetailRows].sort((a, b) => Number(a.RowId ?? 0) - Number(b.RowId ?? 0));
  if (bundleSourceRows.length === 0) return null;

  const rows: CorReportBundleRow[] = assignSerialRanges(bundleSourceRows.map((row) => ({
    cutNo: String(row.Cut ?? ""),
    bundleNo: String(row.Bundle_Id ?? ""),
    size: String(row.Size ?? ""),
    inseam: String(row.Inseam ?? ""),
    color: String(row.Color ?? ""),
    shade: String(row.Shade ?? ""),
    shrinkage: String(row.Shrinkage ?? ""),
    markerPlies: markerPliesByCutNo.get(String(row.Cut ?? "").trim().toLowerCase()) ?? null,
    bundleQty: Number(row.Bundle_Qty ?? 0),
  })));

  const willCutQtyFromPlanning = planning.inseamGroups.reduce(
    (sum, group) => sum + Object.values(group.willCutQuantities).reduce((s, qty) => s + qty, 0),
    0,
  );
  const accessFabric = planning.metadata?.accessItems.map((item) => item.itemName).join(", ") ?? "";

  const meta: CorReportMeta = {
    workOrder,
    saleOrderNo: String(firstCutDetail?.Sale_Order_No ?? ""),
    customerName: planning.metadata?.customerName ?? "",
    styleCode: planning.metadata?.styleCode ?? "",
    styleName: planning.metadata?.styleName ?? "",
    fabricCode: accessFabric || String(firstCutDetail?.Fabric_Code_Main_Body ?? ""),
    wash: String(firstCutDetail?.Wash ?? ""),
    willCutQty: Number(firstCutDetail?.Order_Qty_After_Add ?? 0) || willCutQtyFromPlanning,
  };

  return { meta, rows };
}
