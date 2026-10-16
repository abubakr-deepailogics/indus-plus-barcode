import {
  CUT_DETAIL_VIEW,
  getPool,
  sql,
  STYLE_CARD_BOM_CONSUMPTION_TABLE,
} from "@/lib/db";
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

export async function searchCutPlanningWorkOrders(filters: {
  workOrder?: string;
  customer?: string;
  saleOrderNo?: string;
}): Promise<Array<{ workOrder: string; customer: string | null; saleOrderNo: string | null }>> {
  const workOrder = filters.workOrder?.trim() || "";
  const customer = filters.customer?.trim() || "";
  const saleOrderNo = filters.saleOrderNo?.trim() || "";
  const pool = await getPool("indusPlus");
  const request = pool.request();
  const conditions = ["NULLIF(LTRIM(RTRIM(source.WorkOrderNo)), '') IS NOT NULL"];

  if (workOrder) {
    request.input("workOrder", sql.NVarChar, `%${workOrder}%`);
    conditions.push("source.WorkOrderNo LIKE @workOrder");
  }
  if (customer) {
    request.input("customer", sql.NVarChar, `%${customer}%`);
    conditions.push("UPPER(source.Customer) LIKE UPPER(@customer)");
  }
  if (saleOrderNo) {
    request.input("saleOrderNo", sql.NVarChar, `%${saleOrderNo}%`);
    conditions.push("saleOrder.SaleOrderNo LIKE @saleOrderNo");
  }

  const result = await request.query(`
    SELECT DISTINCT TOP (40)
      source.WorkOrderNo AS workOrder,
      source.Customer AS customer,
      saleOrder.SaleOrderNo AS saleOrderNo
    FROM ${SOURCE_TABLE} source
    OUTER APPLY (
      SELECT TOP (1) cd.[Sale Order No] AS SaleOrderNo
      FROM ${CUT_DETAIL_VIEW} cd
      WHERE cd.[Work Order #] = source.WorkOrderNo
    ) saleOrder
    WHERE ${conditions.join(" AND ")}
    ORDER BY source.WorkOrderNo ${workOrder || customer || saleOrderNo ? "ASC" : "DESC"}
  `);
  return result.recordset.map((row) => ({
    workOrder: String(row.workOrder ?? ""),
    customer: row.customer == null ? null : String(row.customer),
    saleOrderNo: row.saleOrderNo == null ? null : String(row.saleOrderNo),
  }));
}

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
  const styleCode = String(sourceRows[0]?.StyleCode ?? "").trim();
  const accessCodeResult = styleCode
    ? await indusPool.request()
      .input("styleCode", sql.NVarChar, styleCode)
      .query(`
        SELECT DISTINCT LTRIM(RTRIM(AccessCode)) AS AccessCode
        FROM ${STYLE_CARD_BOM_CONSUMPTION_TABLE}
        WHERE StyleCode = @styleCode
          AND NULLIF(LTRIM(RTRIM(AccessCode)), '') IS NOT NULL
          AND UPPER(LTRIM(RTRIM(AccessCode))) <> 'NULL'
        ORDER BY AccessCode
      `)
    : { recordset: [] as Array<{ AccessCode?: unknown }> };
  const accessCodes = [...new Set(
    accessCodeResult.recordset
      .map((row) => String(row.AccessCode ?? "").trim())
      .filter((accessCode) => accessCode && accessCode.toUpperCase() !== "NULL"),
  )];
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
    accessCodes,
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
  if (!Array.isArray(payload.plans)) throw new Error("Planning rows are required.");
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

export async function softDeleteCutPlanningRow(
  workOrderInput: string,
  id: number,
  userEmail: string,
) {
  const workOrder = workOrderInput.trim();
  if (!workOrder) throw new Error("Work Order is required.");
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("A valid planning row is required.");

  const pool = await getPool("pitSystem");
  const result = await pool.request()
    .input("id", sql.BigInt, id)
    .input("workOrder", sql.NVarChar, workOrder)
    .input("updatedBy", sql.NVarChar, userEmail || "system")
    .query(`
      UPDATE dbo.CutPlanning
      SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
      WHERE Id = @id AND WorkOrder = @workOrder AND IsDeleted = 0
    `);

  if ((result.rowsAffected[0] ?? 0) === 0) {
    throw new Error("Planning row was not found or was already deleted.");
  }
}
