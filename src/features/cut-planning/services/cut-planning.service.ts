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
  GenerateBundlesPayload,
  GeneratedBundle,
  SaveCutPlanningPayload,
  SizeQuantities,
} from "../types";
import { calculateRequiredFabricMetres } from "./calculated-requirement";

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

function splitShadeCodes(value: unknown): string[] {
  const shade = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2,}$/.test(shade) ? [...new Set(shade)] : [shade || "UNSHADED"];
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
  const accessItemResult = styleCode
    ? await indusPool.request()
      .input("styleCode", sql.NVarChar, styleCode)
      .query(`
        SELECT DISTINCT
          LTRIM(RTRIM(AccessCode)) AS AccessCode,
          COALESCE(
            NULLIF(LTRIM(RTRIM(ItemName)), ''),
            NULLIF(LTRIM(RTRIM(ItemCode)), '')
          ) AS ItemName
        FROM ${STYLE_CARD_BOM_CONSUMPTION_TABLE}
        WHERE StyleCode = @styleCode
          AND NULLIF(LTRIM(RTRIM(AccessCode)), '') IS NOT NULL
          AND UPPER(LTRIM(RTRIM(AccessCode))) = 'FABRIC'
          AND (
            NULLIF(LTRIM(RTRIM(ItemName)), '') IS NOT NULL
            OR NULLIF(LTRIM(RTRIM(ItemCode)), '') IS NOT NULL
          )
        ORDER BY AccessCode, ItemName
      `)
    : { recordset: [] as Array<{ AccessCode?: unknown; ItemName?: unknown }> };
  const accessItems = accessItemResult.recordset
    .map((row) => ({
      accessCode: String(row.AccessCode ?? "").trim(),
      itemName: String(row.ItemName ?? "").trim(),
    }))
    .filter(({ accessCode, itemName }) => accessCode && accessCode.toUpperCase() !== "NULL" && itemName);
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
    accessItems,
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
  if (!row || typeof row !== "object" || !row.sizeQuantities || typeof row.sizeQuantities !== "object" || Array.isArray(row.sizeQuantities)) {
    throw new Error(`${prefix}: Size quantities are invalid.`);
  }
  if (row.sourceInseam != null && (!Number.isSafeInteger(row.sourceInseam) || row.sourceInseam < 0)) {
    throw new Error(`${prefix}: Inseam is invalid.`);
  }
  if (Object.keys(row.sizeQuantities).length > 100) throw new Error(`${prefix}: Too many size values.`);
  if (row.planDate) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(row.planDate) ? new Date(`${row.planDate}T00:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row.planDate) {
      throw new Error(`${prefix}: Date is invalid.`);
    }
  }
  const values = [...Object.values(row.sizeQuantities), row.reCutQty, row.markerPlies, row.calculatedRequired, row.markerWidthCm, row.markerLengthM];
  if (values.some((value) => value != null && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
    throw new Error(`${prefix}: numeric values must be zero or greater.`);
  }
}

async function validatePlanningRowsAgainstErp(workOrder: string, plans: CutPlanRow[]) {
  const indusPool = await getPool("indusPlus");
  const result = await indusPool.request().input("workOrder", sql.NVarChar, workOrder).query(`
    SELECT DISTINCT Inseam, LTRIM(RTRIM(Size)) AS Size
    FROM ${SOURCE_TABLE}
    WHERE WorkOrderNo = @workOrder AND NULLIF(LTRIM(RTRIM(Size)), '') IS NOT NULL
  `);
  const allowed = new Map<string, Set<string>>();
  for (const row of result.recordset as Array<Record<string, unknown>>) {
    const inseam = row.Inseam == null ? "null" : String(number(row.Inseam));
    const sizes = allowed.get(inseam) ?? new Set<string>();
    sizes.add(String(row.Size ?? "").trim());
    allowed.set(inseam, sizes);
  }
  if (allowed.size === 0) throw new Error("No ERP size-wise rows were found for this Work Order.");
  for (const [index, plan] of plans.entries()) {
    const inseam = plan.sourceInseam == null ? "null" : String(plan.sourceInseam);
    const sizes = allowed.get(inseam);
    if (!sizes) throw new Error(`Row ${index + 1}: Inseam does not belong to this Work Order.`);
    for (const size of Object.keys(plan.sizeQuantities)) {
      if (!sizes.has(size)) throw new Error(`Row ${index + 1}: Size ${size} does not belong to inseam ${plan.sourceInseam ?? "blank"}.`);
    }
  }
}

async function getAllocatedCutNos(pool: Awaited<ReturnType<typeof getPool>>, workOrder: string) {
  const result = await pool.request().input("workOrder", sql.NVarChar, workOrder).query(`
    SELECT DISTINCT CutNo
    FROM dbo.BundleGenerationAllocation
    WHERE WorkOrder = @workOrder AND IsDeleted = 0
  `);
  return new Set(
    result.recordset
      .map((row) => String(row.CutNo ?? "").trim().toLocaleLowerCase())
      .filter(Boolean),
  );
}

function planSignature(plan: CutPlanRow) {
  return JSON.stringify({
    sourceInseam: plan.sourceInseam,
    planDate: plan.planDate || "",
    sizeQuantities: Object.fromEntries(
      // Older plans can retain zero-only size keys from another inseam. The
      // matrix intentionally drops those display-only cells before saving;
      // they carry no allocated quantity and must not make an untouched
      // generated cut look modified. Any positive quantity remains locked.
      Object.entries(plan.sizeQuantities)
        .filter(([, quantity]) => number(quantity) > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    reCutQty: plan.reCutQty,
    markerNo: plan.markerNo.trim(),
    cutNo: plan.cutNo.trim(),
    markerPlies: plan.markerPlies,
    shrinkage: plan.shrinkage.trim(),
    shade: plan.shade.trim(),
    calculatedRequired: calculateRequiredFabricMetres(plan.markerLengthM, plan.markerPlies),
    markerWidthCm: plan.markerWidthCm,
    markerLengthM: plan.markerLengthM,
  });
}

function samePlanSet(left: CutPlanRow[], right: CutPlanRow[]) {
  const signatures = (plans: CutPlanRow[]) => plans.map(planSignature).sort();
  return JSON.stringify(signatures(left)) === JSON.stringify(signatures(right));
}

function generatedCutsLockedMessage(cutNos: Iterable<string>) {
  const cuts = [...cutNos].filter(Boolean);
  const label = cuts.length === 1 ? "Cut" : "Cuts";
  const verb = cuts.length === 1 ? "is" : "are";
  return `${label} ${cuts.join(", ")} ${verb} locked by generated bundles. Delete ${cuts.length === 1 ? "its" : "their"} bundles in Cut Report before editing or removing ${cuts.length === 1 ? "it" : "them"}. Delete active coupons first.`;
}

export async function saveCutPlanning(payload: SaveCutPlanningPayload, userEmail: string) {
  const workOrder = payload.workOrder?.trim();
  if (!workOrder) throw new Error("Work Order is required.");
  if (!Array.isArray(payload.plans)) throw new Error("Planning rows are required.");
  if (payload.plans.length === 0) throw new Error("At least one planning row is required. Use the row removal controls instead of saving a blank plan.");
  if (payload.plans.length > MAX_PLANS) throw new Error(`A maximum of ${MAX_PLANS} planning rows can be saved at once.`);
  const plans = payload.plans.map((plan) => ({
    ...plan,
    calculatedRequired: calculateRequiredFabricMetres(plan.markerLengthM, plan.markerPlies),
  }));
  plans.forEach(validatePlan);
  await validatePlanningRowsAgainstErp(workOrder, plans);

  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const lockedCutNos = await getAllocatedCutNos(pool, workOrder);
    const currentResult = await new sql.Request(transaction)
      .input("workOrder", sql.NVarChar, workOrder)
      .query(`
        SELECT Id, SourceInseam, PlanDate, SizeQuantitiesJson, ReCutQty, MarkerNo, CutNo,
          MarkerPlies, Shrinkage, Shade, CalculatedRequired, MarkerWidthCm, MarkerLengthM
        FROM dbo.CutPlanning
        WHERE WorkOrder = @workOrder AND IsDeleted = 0
      `);
    const lockedCurrentPlans = currentResult.recordset
      .map(normalizeSavedRow)
      .filter((plan) => lockedCutNos.has(plan.cutNo.trim().toLocaleLowerCase()));
    const lockedSubmittedPlans = plans
      .filter((plan) => lockedCutNos.has(plan.cutNo.trim().toLocaleLowerCase()));
    if (!samePlanSet(lockedCurrentPlans, lockedSubmittedPlans)) {
      throw new Error(generatedCutsLockedMessage(lockedCutNos));
    }

    const editablePlans = plans.filter(
      (plan) => !lockedCutNos.has(plan.cutNo.trim().toLocaleLowerCase()),
    );
    const deleteRequest = new sql.Request(transaction)
      .input("workOrder", sql.NVarChar, workOrder)
      .input("updatedBy", sql.NVarChar, userEmail || "system");
    const lockedPlaceholders = [...lockedCutNos].map((cutNo, index) => {
      deleteRequest.input(`lockedCut${index}`, sql.NVarChar, cutNo);
      return `@lockedCut${index}`;
    });
    await deleteRequest.query(`
      UPDATE dbo.CutPlanning
      SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
      WHERE WorkOrder = @workOrder AND IsDeleted = 0
        ${lockedPlaceholders.length ? `AND (CutNo IS NULL OR LOWER(LTRIM(RTRIM(CutNo))) NOT IN (${lockedPlaceholders.join(", ")}))` : ""}
    `);
    for (const row of editablePlans) {
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
  const planResult = await pool.request()
    .input("id", sql.BigInt, id)
    .input("workOrder", sql.NVarChar, workOrder)
    .query(`SELECT CutNo FROM dbo.CutPlanning WHERE Id = @id AND WorkOrder = @workOrder AND IsDeleted = 0`);
  if (planResult.recordset.length === 0) {
    throw new Error("Planning row was not found or was already deleted.");
  }
  const lockedCutNos = await getAllocatedCutNos(pool, workOrder);
  const cutNo = String(planResult.recordset[0].CutNo ?? "").trim().toLocaleLowerCase();
  if (cutNo && lockedCutNos.has(cutNo)) {
    throw new Error(`Cut ${String(planResult.recordset[0].CutNo).trim()} has generated bundles and cannot be removed.`);
  }
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

export function getBundleIdPrefix(workOrder: string) {
  const digits = workOrder.replace(/\D/g, "");
  return (digits.slice(-6) || "0").padStart(6, "0");
}

export async function getNextBundleSequence(workOrderInput: string) {
  const workOrder = workOrderInput.trim();
  if (!workOrder) return 1;
  const pool = await getPool("pitSystem");
  const result = await pool.request()
    .input("workOrder", sql.NVarChar, workOrder)
    .query("SELECT LastSequence FROM dbo.BundleGenerationSequence WHERE WorkOrder = @workOrder");
  return Math.max(1, number(result.recordset[0]?.LastSequence) + 1);
}

export async function generateBundles(
  payload: GenerateBundlesPayload,
  userEmail: string,
): Promise<{ totalTransactionQty: number; bundles: GeneratedBundle[] }> {
  const workOrder = payload.workOrder?.trim();
  const cutNos = [...new Set((payload.cutNos ?? []).map((cut) => cut.trim()).filter(Boolean))];
  const bundleQty = number(payload.bundleQty);
  const expectedNextSequence = payload.expectedNextSequence;
  const expectedBundleCount = payload.expectedBundleCount;
  if (!workOrder) throw new Error("Work Order is required.");
  if (cutNos.length !== 1) throw new Error("Select exactly one Cut no.");
  if (!Number.isFinite(bundleQty) || bundleQty < 0) throw new Error("Bundle quantity cannot be negative.");
  if (expectedNextSequence != null && (!Number.isSafeInteger(expectedNextSequence) || expectedNextSequence <= 0)) {
    throw new Error("Bundle preview sequence is invalid. Preview bundles again.");
  }
  if (expectedBundleCount != null && (!Number.isSafeInteger(expectedBundleCount) || expectedBundleCount <= 0)) {
    throw new Error("Bundle preview count is invalid. Preview bundles again.");
  }

  // A Cut Report row is a generation-time snapshot. Read the associated
  // planning metadata before creating the PIT transaction that writes it.
  const planningSnapshot = await getCutPlanning(workOrder);
  const pool = await getPool("pitSystem");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    if (expectedNextSequence != null) {
      const sequenceResult = await new sql.Request(transaction)
        .input("workOrder", sql.NVarChar, workOrder)
        .query(`
          SELECT LastSequence
          FROM dbo.BundleGenerationSequence WITH (UPDLOCK, HOLDLOCK)
          WHERE WorkOrder = @workOrder
        `);
      const nextSequence = number(sequenceResult.recordset[0]?.LastSequence) + 1;
      if (nextSequence !== expectedNextSequence) {
        throw new Error("Bundle preview is out of date. Preview bundles again before confirming.");
      }
    }
    const placeholders = cutNos.map((_, index) => `@cut${index}`).join(", ");
    const sourceRequest = new sql.Request(transaction).input("workOrder", sql.NVarChar, workOrder);
    cutNos.forEach((cutNo, index) => sourceRequest.input(`cut${index}`, sql.NVarChar, cutNo));
    const source = await sourceRequest.query(`
      SELECT CutNo, SourceInseam, SizeQuantitiesJson, MarkerPlies, Shade, Shrinkage
      FROM dbo.CutPlanning
      WHERE WorkOrder = @workOrder AND IsDeleted = 0 AND CutNo IN (${placeholders})
    `);
    const markerPlies = Math.max(
      0,
      ...(source.recordset as Array<Record<string, unknown>>).map((row) => number(row.MarkerPlies)),
    );
    if (markerPlies > 0 && bundleQty > markerPlies) {
      throw new Error(`Bundle quantity cannot exceed Marker plies (${markerPlies}).`);
    }
    const sourceRows: Array<{
      cutNo: string;
      inseam: number | null;
      size: string;
      qty: number;
      shade: string;
      shrinkage: string;
    }> = [];
    for (const row of source.recordset as Array<Record<string, unknown>>) {
      const cutNo = String(row.CutNo ?? "").trim();
      const inseam = row.SourceInseam == null ? null : number(row.SourceInseam);
      for (const [size, quantity] of Object.entries(parseQuantities(row.SizeQuantitiesJson))) {
        const qty = quantity * number(row.MarkerPlies);
        if (qty > 0) {
          sourceRows.push({
            cutNo,
            inseam,
            size,
            qty,
            shade: String(row.Shade ?? "").trim(),
            shrinkage: String(row.Shrinkage ?? "").trim(),
          });
        }
      }
    }
    const missingCuts = cutNos.filter((cutNo) => !sourceRows.some((row) => row.cutNo === cutNo));
    if (missingCuts.length) throw new Error(`No saved Cut Planning quantity was found for: ${missingCuts.join(", ")}.`);

    const allocationRequest = new sql.Request(transaction).input("workOrder", sql.NVarChar, workOrder);
    cutNos.forEach((cutNo, index) => allocationRequest.input(`allocatedCut${index}`, sql.NVarChar, cutNo));
    const allocated = await allocationRequest.query(`
      SELECT CutNo, SourceInseam, SourceSize, COALESCE(SUM(AllocatedQty), 0) AS AllocatedQty
      FROM dbo.BundleGenerationAllocation WITH (UPDLOCK, HOLDLOCK)
      WHERE WorkOrder = @workOrder AND IsDeleted = 0
        AND CutNo IN (${cutNos.map((_, index) => `@allocatedCut${index}`).join(", ")})
      GROUP BY CutNo, SourceInseam, SourceSize
    `);
    const sourceKey = (cutNo: string, inseam: number | null, size: string) =>
      `${cutNo}|${inseam ?? ""}|${size}`;
    const allocatedTotals = new Map(
      allocated.recordset.map((row) => [
        sourceKey(
          String(row.CutNo ?? ""),
          row.SourceInseam == null ? null : number(row.SourceInseam),
          String(row.SourceSize ?? ""),
        ),
        number(row.AllocatedQty),
      ]),
    );
    const available = sourceRows.map((row) => ({
      ...row,
      qty: Math.max(0, row.qty - (allocatedTotals.get(sourceKey(row.cutNo, row.inseam, row.size)) ?? 0)),
    })).filter((row) => row.qty > 0);
    const totalTransactionQty = available.reduce((sum, item) => sum + item.qty, 0);
    if (totalTransactionQty <= 0) throw new Error("The selected Cut no(s) have no remaining quantity to bundle.");

    const requiredShades = [...new Set(sourceRows.flatMap((row) => splitShadeCodes(row.shade)))];
    const requiresShadeSplit = requiredShades.length > 1;
    const shadeAllocations = (payload.shadeAllocations ?? []).map((allocation) => ({
      shade: String(allocation.shade ?? "").trim().toUpperCase(),
      qty: number(allocation.quantity),
      cutNo: String(allocation.cutNo ?? "").trim(),
    })).filter((allocation) => allocation.shade);
    const isShadeSplit = shadeAllocations.length > 0;
    const allocatedShadeQty = shadeAllocations.reduce((sum, allocation) => sum + allocation.qty, 0);
    if (requiresShadeSplit && !isShadeSplit) {
      throw new Error(`Shade split is required for shades: ${requiredShades.join(", ")}.`);
    }
    if (isShadeSplit) {
      const suppliedShades = new Set(shadeAllocations.map((allocation) => allocation.shade));
      const suppliedCutNos = new Set(shadeAllocations.map((allocation) => allocation.cutNo.toLocaleLowerCase()));
      if (
        shadeAllocations.length !== requiredShades.length ||
        requiredShades.some((shade) => !suppliedShades.has(shade)) ||
        shadeAllocations.some((allocation) => allocation.qty <= 0 || !allocation.cutNo) ||
        suppliedCutNos.size !== shadeAllocations.length
      ) {
        throw new Error("Every split shade needs a positive ply quantity and a unique Cut no.");
      }
    }
    if (!isShadeSplit && (!Number.isInteger(bundleQty) || bundleQty <= 0)) {
      throw new Error("Bundle quantity must be a whole number greater than zero.");
    }
    if (isShadeSplit && shadeAllocations.some((allocation) => !Number.isInteger(allocation.qty))) {
      throw new Error("Shade plies must be whole numbers.");
    }
    if (isShadeSplit && Math.abs(allocatedShadeQty - markerPlies) > 0.0001) {
      throw new Error(`Shade plies must equal Marker plies (${markerPlies}).`);
    }

    const createBundle = async (allocations: Array<{ sourceCutNo: string; cutNo: string; inseam: number | null; size: string; shade: string; shrinkage: string; qty: number }>) => {
      const sequenceRequest = new sql.Request(transaction).input("workOrder", sql.NVarChar, workOrder);
      const sequenceResult = await sequenceRequest.query(`
        IF EXISTS (SELECT 1 FROM dbo.BundleGenerationSequence WITH (UPDLOCK, HOLDLOCK) WHERE WorkOrder = @workOrder)
          UPDATE dbo.BundleGenerationSequence SET LastSequence = LastSequence + 1, UpdatedAt = SYSUTCDATETIME()
          OUTPUT INSERTED.LastSequence AS Sequence WHERE WorkOrder = @workOrder;
        ELSE
          INSERT INTO dbo.BundleGenerationSequence (WorkOrder, LastSequence) OUTPUT INSERTED.LastSequence AS Sequence VALUES (@workOrder, 1);
      `);
      const sequence = number(sequenceResult.recordset[0]?.Sequence);
      const id = `${getBundleIdPrefix(workOrder)}-${String(sequence).padStart(4, "0")}`;
      const qty = allocations.reduce((sum, item) => sum + item.qty, 0);
      if (!Number.isInteger(qty)) {
        throw new Error("Generated Bundle quantity must be a whole number. Check size quantities and Marker plies.");
      }
      const insert = await new sql.Request(transaction)
        .input("workOrder", sql.NVarChar, workOrder)
        .input("sequence", sql.Int, sequence)
        .input("bundleId", sql.NVarChar, id)
        .input("bundleQty", sql.Decimal(18, 3), qty)
        .input("sourceQty", sql.Decimal(18, 3), totalTransactionQty)
        .input("sourceInseam", sql.Int, allocations[0]?.inseam ?? null)
        .input("sourceSize", sql.NVarChar, allocations[0]?.size ?? null)
        .input("sourceShade", sql.NVarChar, allocations[0]?.shade ?? null)
        // Merge is a modal display option only. Every generated bundle stays
        // tied to its own Cut no. for the normal Cut Report flow.
        .input("isMerged", sql.Bit, false)
        .input("cutNos", sql.NVarChar, JSON.stringify(allocations.map((item) => item.cutNo)))
        .input("insertedBy", sql.NVarChar, userEmail || "system")
        .query(`INSERT INTO dbo.BundleGeneration (WorkOrder, BundleSequence, BundleId, BundleQty, SourceTransactionQty, SourceInseam, SourceSize, SourceShade, IsMerged, CutNosJson, InsertedBy)
          OUTPUT INSERTED.Id AS Id VALUES (@workOrder, @sequence, @bundleId, @bundleQty, @sourceQty, @sourceInseam, @sourceSize, @sourceShade, @isMerged, @cutNos, @insertedBy)`);
      const bundleId = number(insert.recordset[0]?.Id);
      await new sql.Request(transaction)
        .input("bundleGenerationId", sql.BigInt, bundleId)
        .input("workOrder", sql.NVarChar, workOrder)
        .input("inseam", sql.Int, allocations[0]?.inseam ?? null)
        .input("size", sql.NVarChar, allocations[0]?.size ?? null)
        .input("color", sql.NVarChar, planningSnapshot.metadata?.color || null)
          .input("cutNo", sql.NVarChar, allocations[0]?.cutNo ?? null)
        .input("bundleId", sql.NVarChar, id)
        .input("bundleQty", sql.Decimal(18, 3), qty)
        .input("shade", sql.NVarChar, allocations[0]?.shade ?? null)
        .input("shrinkage", sql.NVarChar, allocations[0]?.shrinkage ?? null)
        .input("createdBy", sql.NVarChar, userEmail || "system")
        .query(`INSERT INTO dbo.SewingCutReport (BundleGenerationId, WorkOrder, Inseam, Size, Color, CutNo, BundleId, BundleQty, Shade, Shrinkage, CreatedBy)
          VALUES (@bundleGenerationId, @workOrder, @inseam, @size, @color, @cutNo, @bundleId, @bundleQty, @shade, @shrinkage, @createdBy)`);
      for (const allocation of allocations) {
        await new sql.Request(transaction)
          .input("bundleGenerationId", sql.BigInt, bundleId)
          .input("workOrder", sql.NVarChar, workOrder)
          // Allocations retain the original planning Cut No. so future
          // availability checks stay tied to the physical source quantity.
          .input("cutNo", sql.NVarChar, allocation.sourceCutNo)
          .input("sourceInseam", sql.Int, allocation.inseam)
          .input("sourceSize", sql.NVarChar, allocation.size)
          .input("qty", sql.Decimal(18, 3), allocation.qty)
          .query(`INSERT INTO dbo.BundleGenerationAllocation (BundleGenerationId, WorkOrder, CutNo, SourceInseam, SourceSize, AllocatedQty)
            VALUES (@bundleGenerationId, @workOrder, @cutNo, @sourceInseam, @sourceSize, @qty)`);
      }
      return { bundleId: id, bundleQty: qty, cutNos: allocations.map((item) => item.cutNo) };
    };

    const bundles: GeneratedBundle[] = [];
    if (!isShadeSplit) {
      for (const item of available) {
        let remaining = item.qty;
        while (remaining > 0) {
          const qty = Math.min(bundleQty, remaining);
          bundles.push(await createBundle([{ sourceCutNo: item.cutNo, cutNo: item.cutNo, inseam: item.inseam, size: item.size, shade: item.shade || "UNSHADED", shrinkage: item.shrinkage, qty }]));
          remaining -= qty;
        }
      }
      if (expectedBundleCount != null && bundles.length !== expectedBundleCount) {
        throw new Error("Bundle preview is out of date. Preview bundles again before confirming.");
      }
      await transaction.commit();
      return { totalTransactionQty, bundles };
    }

    for (const item of available) {
      for (const allocation of shadeAllocations) {
        const qty = item.qty * (allocation.qty / markerPlies);
        if (qty > 0) {
          bundles.push(await createBundle([{ sourceCutNo: item.cutNo, cutNo: allocation.cutNo, inseam: item.inseam, size: item.size, shade: allocation.shade, shrinkage: item.shrinkage, qty }]));
        }
      }
    }
    if (expectedBundleCount != null && bundles.length !== expectedBundleCount) {
      throw new Error("Bundle preview is out of date. Preview bundles again before confirming.");
    }
    await transaction.commit();
    return { totalTransactionQty, bundles };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
