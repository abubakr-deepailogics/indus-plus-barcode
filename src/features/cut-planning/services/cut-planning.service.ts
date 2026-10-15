import { getPool, sql } from "@/lib/db";
import type {
  CutPlanningData,
  CutPlanningInseamGroup,
  CutPlanningMetadata,
  CutPlanRow,
  SaveCutPlanningPayload,
  SizeQuantities,
} from "../types";

const SOURCE_TABLE = "dbo.S_WorkOrderSizeWiseQtyViewPITS";
const MAX_PLANS = 250;

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseQuantities(value: unknown): SizeQuantities {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([name, quantity]) => name.trim() && Number.isFinite(Number(quantity)))
        .map(([name, quantity]) => [name, number(quantity)]),
    );
  } catch {
    return {};
  }
}

function normalizeSavedRow(row: Record<string, unknown>): CutPlanRow {
  const value = (name: string) => row[name];
  return {
    id: number(value("Id")) || undefined,
    sourceInseam: value("SourceInseam") == null ? null : number(value("SourceInseam")),
    planDate: value("PlanDate") ? new Date(String(value("PlanDate"))).toISOString().slice(0, 10) : "",
    sizeQuantities: parseQuantities(value("SizeQuantitiesJson")),
    reCutQty: number(value("ReCutQty")),
    markerNo: String(value("MarkerNo") ?? ""),
    cutNo: String(value("CutNo") ?? ""),
    markerPlies: number(value("MarkerPlies")),
    shrinkage: String(value("Shrinkage") ?? ""),
    shade: String(value("Shade") ?? ""),
    calculatedRequired: value("CalculatedRequired") == null ? null : number(value("CalculatedRequired")),
    markerWidthCm: value("MarkerWidthCm") == null ? null : number(value("MarkerWidthCm")),
    markerLengthM: value("MarkerLengthM") == null ? null : number(value("MarkerLengthM")),
  };
}

function sortSizes(a: string, b: string) {
  const asNumber = Number(a);
  const bsNumber = Number(b);
  if (Number.isFinite(asNumber) && Number.isFinite(bsNumber)) return asNumber - bsNumber;
  return a.localeCompare(b, undefined, { numeric: true });
}

export async function getCutPlanning(workOrder: string): Promise<CutPlanningData> {
  const trimmedWorkOrder = workOrder.trim();
  if (!trimmedWorkOrder) {
    return { metadata: null, inseamGroups: [], plans: [] };
  }

  const [indusPool, pitPool] = await Promise.all([getPool("indusPlus"), getPool("pitSystem")]);
  const sourceRowsResult = await indusPool.request()
    .input("workOrder", sql.NVarChar, trimmedWorkOrder)
    .query(`
      SELECT Customer, WorkOrderNo, WorkOrderDate, Color, StyleCode, StyleName,
        StyleNo, Inseam, Size, SubNo, OrderQty, WillCutQty
      FROM ${SOURCE_TABLE}
      WHERE WorkOrderNo = @workOrder
      ORDER BY Inseam, TRY_CONVERT(INT, Size), Size, SubNo
    `);
  const sourceRows = sourceRowsResult.recordset as Array<Record<string, unknown>>;
  const grouped = new Map<string, CutPlanningInseamGroup>();
  for (const row of sourceRows) {
    const size = String(row.Size ?? "").trim();
    if (!size) continue;
    const inseam = row.Inseam == null ? null : number(row.Inseam);
    const groupKey = inseam == null ? "none" : String(inseam);
    const group = grouped.get(groupKey) ?? {
      inseam,
      sizeColumns: [],
      orderQuantities: {},
      willCutQuantities: {},
    };
    group.orderQuantities[size] = (group.orderQuantities[size] ?? 0) + number(row.OrderQty);
    group.willCutQuantities[size] = (group.willCutQuantities[size] ?? 0) + number(row.WillCutQty);
    grouped.set(groupKey, group);
  }

  const first = sourceRows[0];
  const metadata: CutPlanningMetadata | null = first ? {
    workOrder: trimmedWorkOrder,
    customerName: String(first.Customer ?? ""),
    workOrderDate: String(first.WorkOrderDate ?? ""),
    color: String(first.Color ?? ""),
    styleCode: String(first.StyleCode ?? ""),
    styleName: String(first.StyleName ?? ""),
    styleNo: String(first.StyleNo ?? ""),
  } : null;

  const plansResult = await pitPool.request().input("workOrder", sql.NVarChar, trimmedWorkOrder).query(`
    SELECT Id, SourceInseam, PlanDate, SizeQuantitiesJson, ReCutQty, MarkerNo, CutNo,
      MarkerPlies, Shrinkage, Shade, CalculatedRequired, MarkerWidthCm, MarkerLengthM
    FROM dbo.CutPlanning
    WHERE WorkOrder = @workOrder AND IsDeleted = 0
    ORDER BY PlanDate, Id
  `);
  const plans = plansResult.recordset.map(normalizeSavedRow);
  const inseamGroups = [...grouped.values()]
    .map((group) => ({
      ...group,
      sizeColumns: [...new Set([...Object.keys(group.orderQuantities), ...Object.keys(group.willCutQuantities)])].sort(sortSizes),
    }))
    .sort((a, b) => (a.inseam ?? Number.MAX_SAFE_INTEGER) - (b.inseam ?? Number.MAX_SAFE_INTEGER));
  // Plans saved before the Inseam column existed remain usable. They are
  // shown under the first ERP Inseam until the user saves them again.
  const plansWithInseam = plans.map((plan) =>
    plan.sourceInseam === null && inseamGroups[0]
      ? { ...plan, sourceInseam: inseamGroups[0].inseam }
      : plan,
  );
  return { metadata, inseamGroups, plans: plansWithInseam };
}

function validatePlan(row: CutPlanRow, index: number) {
  const prefix = `Row ${index + 1}`;
  if (row.planDate && Number.isNaN(new Date(`${row.planDate}T00:00:00`).getTime())) throw new Error(`${prefix}: Date is invalid.`);
  const values = [...Object.values(row.sizeQuantities), row.reCutQty, row.markerPlies, row.calculatedRequired, row.markerWidthCm, row.markerLengthM];
  if (values.some((value) => value != null && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
    throw new Error(`${prefix}: numeric values must be zero or greater.`);
  }
}

export async function saveCutPlanning(payload: SaveCutPlanningPayload, userEmail: string) {
  const workOrder = payload.workOrder?.trim();
  if (!workOrder) throw new Error("Work Order is required.");
  if (!Array.isArray(payload.plans) || !payload.plans.length) throw new Error("Add at least one planning row.");
  if (payload.plans.length > MAX_PLANS) throw new Error(`A maximum of ${MAX_PLANS} planning rows can be saved at once.`);
  payload.plans.forEach(validatePlan);

  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).input("workOrder", sql.NVarChar, workOrder).input("updatedBy", sql.NVarChar, userEmail || "system").query(`
      UPDATE dbo.CutPlanning
      SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
      WHERE WorkOrder = @workOrder AND IsDeleted = 0
    `);
    for (const row of payload.plans) {
      await new sql.Request(transaction)
        .input("workOrder", sql.NVarChar, workOrder)
        .input("sourceInseam", sql.Int, row.sourceInseam)
        .input("planDate", sql.Date, row.planDate || null)
        .input("quantities", sql.NVarChar, JSON.stringify(row.sizeQuantities))
        .input("reCutQty", sql.Decimal(18, 3), number(row.reCutQty))
        .input("markerNo", sql.NVarChar, row.markerNo.trim() || null)
        .input("cutNo", sql.NVarChar, row.cutNo.trim() || null)
        .input("markerPlies", sql.Decimal(18, 3), number(row.markerPlies))
        .input("shrinkage", sql.NVarChar, row.shrinkage.trim() || null)
        .input("shade", sql.NVarChar, row.shade.trim() || null)
        .input("calculatedRequired", sql.Decimal(18, 3), row.calculatedRequired == null ? null : number(row.calculatedRequired))
        .input("markerWidthCm", sql.Decimal(18, 3), row.markerWidthCm == null ? null : number(row.markerWidthCm))
        .input("markerLengthM", sql.Decimal(18, 3), row.markerLengthM == null ? null : number(row.markerLengthM))
        .input("insertedBy", sql.NVarChar, userEmail || "system")
        .query(`INSERT INTO dbo.CutPlanning (WorkOrder, SourceInseam, PlanDate, SizeQuantitiesJson, ReCutQty, MarkerNo, CutNo, MarkerPlies, Shrinkage, Shade, CalculatedRequired, MarkerWidthCm, MarkerLengthM, InsertedBy)
          VALUES (@workOrder, @sourceInseam, @planDate, @quantities, @reCutQty, @markerNo, @cutNo, @markerPlies, @shrinkage, @shade, @calculatedRequired, @markerWidthCm, @markerLengthM, @insertedBy)`);
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
