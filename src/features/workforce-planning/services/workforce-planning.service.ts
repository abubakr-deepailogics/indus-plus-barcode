import { getPool, STYLE_BULLETIN_TABLE, OPERATIONS_CATALOG_TABLE, CUT_DETAIL_VIEW } from "@/lib/db";
import type {
  AvailableWorkOrder,
  WorkforcePredictionResponse,
  WorkforceSimulationParams,
} from "../types";
import { calculateLineBalancing } from "./workforce-regression.service";
import { optimizeWorkerAssignments } from "./assignment-optimizer.service";

/**
 * Fetches distinct work orders available in Style Bulletin with summary metrics.
 */
export async function fetchAvailableWorkOrders(): Promise<AvailableWorkOrder[]> {
  try {
    const pool = await getPool("indusPlus");

    // Get distinct orders with operations count and total SMV
    const sbResult = await pool.request().query(`
      WITH OrderSections AS (
        SELECT DISTINCT [Order No], [Section]
        FROM ${STYLE_BULLETIN_TABLE}
        WHERE [Order No] IS NOT NULL AND [Order No] <> ''
      ),
      AggregatedSections AS (
        SELECT [Order No], STRING_AGG([Section], ', ') AS SectionsAgg
        FROM OrderSections
        GROUP BY [Order No]
      )
      SELECT 
        sb.[Order No] AS WorkOrder,
        MAX(sb.[Sale order No]) AS SaleOrderNo,
        MAX(sb.[Customer Name]) AS CustomerName,
        COUNT(*) AS TotalOperations,
        SUM(TRY_CAST(sb.[Smv/Sam] AS FLOAT)) AS TotalSmv,
        MAX(sec.SectionsAgg) AS SectionsAgg
      FROM ${STYLE_BULLETIN_TABLE} sb
      LEFT JOIN AggregatedSections sec ON sb.[Order No] = sec.[Order No]
      WHERE sb.[Order No] IS NOT NULL AND sb.[Order No] <> ''
      GROUP BY sb.[Order No]
      ORDER BY TotalOperations DESC, sb.[Order No] ASC
    `);

    // Get order quantities from cut detail view
    const cutResult = await pool.request().query(`
      SELECT 
        [Work Order #] AS WorkOrder,
        SUM(TRY_CAST([Bundle Qty] AS INT)) AS TotalQuantity
      FROM ${CUT_DETAIL_VIEW}
      WHERE [Work Order #] IS NOT NULL
      GROUP BY [Work Order #]
    `);

    const cutQtyMap = new Map<string, number>();
    for (const row of cutResult.recordset) {
      if (row.WorkOrder) {
        cutQtyMap.set(String(row.WorkOrder).trim(), Number(row.TotalQuantity) || 0);
      }
    }

    return sbResult.recordset.map((row) => {
      const wo = String(row.WorkOrder).trim();
      const sections = (row.SectionsAgg || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      return {
        workOrder: wo,
        saleOrderNo: row.SaleOrderNo || undefined,
        customerName: row.CustomerName || undefined,
        totalOperations: Number(row.TotalOperations) || 0,
        totalSmv: Number((Number(row.TotalSmv) || 0).toFixed(2)),
        totalCutQuantity: cutQtyMap.get(wo) || 1200, // fallback to typical order size if cut report not generated yet
        sections,
      };
    });
  } catch (error) {
    console.error("Error fetching available work orders for workforce planning:", error);
    throw error;
  }
}

/**
 * Generates an AI Workforce Prediction for a specified Work Order.
 */
export async function generateWorkforcePrediction(
  params: WorkforceSimulationParams
): Promise<WorkforcePredictionResponse> {
  const {
    workOrder,
    targetDays = 5,
    shiftHours = 8,
    targetEfficiency = 0.85,
    absenteeismBuffer = 0.05,
    sectionFilter = "All",
  } = params;

  const pool = await getPool("indusPlus");

  // 1. Fetch style bulletin operations for this work order
  let whereSql = `sb.[Order No] = @wo`;
  if (sectionFilter && sectionFilter !== "All") {
    whereSql += ` AND sb.[Section] = @section`;
  }

  const req = pool.request().input("wo", workOrder);
  if (sectionFilter && sectionFilter !== "All") {
    req.input("section", sectionFilter);
  }

  const opResult = await req.query(`
    SELECT
      ROW_NUMBER() OVER (ORDER BY TRY_CAST(sb.[Operation Sequeance] AS INT), sb.[Operation Code]) AS RowId,
      sb.[Sale order No] AS SaleOrderNo,
      sb.[Customer Name] AS CustomerName,
      sb.[Order No] AS OrderNo,
      sb.[Operation Code] AS OperationCode,
      sb.[Operation Name] AS OperationName,
      sb.[Section] AS Section,
      TRY_CAST(sb.[Operation Sequeance] AS INT) AS OperationSequence,
      sb.[Machine Type] AS MachineType,
      TRY_CAST(sb.[Piece Rate] AS FLOAT) AS PieceRate,
      TRY_CAST(sb.[Smv/Sam] AS FLOAT) AS SmvSam,
      op.SkillLevel,
      op.Department
    FROM ${STYLE_BULLETIN_TABLE} sb
    LEFT JOIN ${OPERATIONS_CATALOG_TABLE} op ON sb.[Operation Code] = op.OperationCode
    WHERE ${whereSql}
    ORDER BY RowId ASC
  `);

  const rawRows = opResult.recordset || [];
  if (rawRows.length === 0) {
    throw new Error(`No style bulletin operations found for Work Order "${workOrder}"`);
  }

  // 2. Fetch total order quantity from cut detail view or use custom override
  let totalQuantity = params.customQuantity && params.customQuantity > 0 ? params.customQuantity : 0;
  let isCustom = Boolean(params.customQuantity && params.customQuantity > 0);

  if (!totalQuantity) {
    const qtyResult = await pool
      .request()
      .input("wo", workOrder)
      .query(`
        SELECT 
          SUM(TRY_CAST([Bundle Qty] AS INT)) AS TotalQuantity,
          MAX(TRY_CAST([Order Qty After % Add] AS INT)) AS OrderQtyAfterAdd
        FROM ${CUT_DETAIL_VIEW}
        WHERE [Work Order #] = @wo
      `);

    const dbQty = Number(qtyResult.recordset[0]?.TotalQuantity) || Number(qtyResult.recordset[0]?.OrderQtyAfterAdd);
    if (dbQty && dbQty > 0) {
      totalQuantity = dbQty;
    } else {
      totalQuantity = 1200; // default planning batch size if order has not been cut yet
      isCustom = false;
    }
  }

  // 3. Normalize operation rows
  const normalizedOps = rawRows.map((r, idx) => ({
    rowId: r.RowId || idx + 1,
    operationCode: String(r.OperationCode || `OP-${idx + 1}`).trim(),
    operationName: String(r.OperationName || "General Operation").trim(),
    section: String(r.Section || "Sewing").trim(),
    operationSequence: Number(r.OperationSequence) || idx + 1,
    machineType: r.MachineType ? String(r.MachineType).trim() : undefined,
    smv: Math.max(0.05, Number(r.SmvSam) || 0.2),
    pieceRate: Number(r.PieceRate) || 0,
    skillLevel: r.SkillLevel ? String(r.SkillLevel).trim() : undefined,
  }));

  // 4. Run Industrial Engineering Line Balancing & Regression calculation
  const balancingResult = calculateLineBalancing({
    operations: normalizedOps,
    totalQuantity,
    targetDays,
    shiftHours,
    targetEfficiency,
    absenteeismBuffer,
  });

  // 5. Optimize worker assignment from the 2,021 active HRMS workers pool
  const optimizedOperations = await optimizeWorkerAssignments(
    balancingResult.operationStats
  );

  const totalMismatches = optimizedOperations.filter((o) => o.isSkillMismatch).length;

  return {
    workOrder,
    saleOrderNo: rawRows[0]?.SaleOrderNo ? String(rawRows[0].SaleOrderNo).trim() : undefined,
    customerName: rawRows[0]?.CustomerName ? String(rawRows[0].CustomerName).trim() : undefined,
    totalQuantity,
    isCustomQuantity: isCustom,
    parametersUsed: {
      targetDays,
      shiftHours,
      targetEfficiency: Math.round(targetEfficiency * 100),
      absenteeismBuffer: Math.round(absenteeismBuffer * 100),
      sectionFilter,
      orderQuantity: totalQuantity,
    },
    metrics: {
      ...balancingResult.metrics,
      totalMismatches,
    },
    operations: optimizedOperations,
    timeline: balancingResult.timeline,
    generatedAt: new Date().toISOString(),
  };
}
