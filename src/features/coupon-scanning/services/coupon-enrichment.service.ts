import {
  getPool,
  sql,
  cutDetailByFilter,
  styleBulletinByFilter,
} from "@/lib/db";

// Bundle/op display data (size, rate, SMV, section name, cut, …) for a
// scanned coupon lives on indusPlus (cut detail / style bulletin), while
// QrCode_Coupon itself lives on pitSystem — genuinely different SQL Server
// instances (see CONNECTION_STRINGS in db.ts), so this can never be a single
// joined query. This fetches both sides separately, scoped to just the
// bundle/op numbers actually present in the coupon rows being enriched, and
// merges them in JS.

const IN_LIST_CHUNK_SIZE = 2000; // stays well under SQL Server's ~2100 parameter cap

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface CutDetailRow {
  RowId: number;
  Bundle_Id: unknown;
  Inseam: unknown;
  Size: unknown;
  Cut: unknown;
  Shade: unknown;
  Bundle_Qty: unknown;
}

interface StyleBulletinRow {
  RowId: number;
  Operation_Code: string;
  Operation_Name: unknown;
  Section: unknown;
  SkillLevel: unknown;
  Smv_Sam: unknown;
  Piece_Rate: unknown;
}

// Bundle/op numbers are only unique within their own work order (same
// reasoning as open-order/rework routes), so both maps are scoped to a
// single work order's rows at a time — callers spanning multiple work
// orders (a scanner-gun batch could in theory mix them) fetch one map per
// work order rather than keying globally.

async function fetchCutDetailByBundle(
  workOrder: string,
  bundleNos: string[],
): Promise<Map<string, CutDetailRow>> {
  const map = new Map<string, CutDetailRow>();
  const uniqueBundles = [...new Set(bundleNos)];
  if (uniqueBundles.length === 0) return map;

  const pool = await getPool("indusPlus");
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
    // Old (broken) query picked "TOP 1 ... ORDER BY RowId" per bundle as a
    // defensive tie-break — Bundle_Id should be unique per work order in
    // practice, but this keeps the lowest-RowId row if it ever isn't.
    for (const row of result.recordset as CutDetailRow[]) {
      const key = String(row.Bundle_Id);
      const existing = map.get(key);
      if (!existing || row.RowId < existing.RowId) map.set(key, row);
    }
  }
  return map;
}

async function fetchStyleBulletinByOp(
  workOrder: string,
  opNos: string[],
): Promise<Map<string, StyleBulletinRow>> {
  const map = new Map<string, StyleBulletinRow>();
  const uniqueOps = [...new Set(opNos)];
  if (uniqueOps.length === 0) return map;

  const pool = await getPool("indusPlus");
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
    for (const row of result.recordset as StyleBulletinRow[]) {
      const existing = map.get(row.Operation_Code);
      if (!existing || row.RowId < existing.RowId) map.set(row.Operation_Code, row);
    }
  }
  return map;
}

export interface EnrichmentFields {
  Inseam: unknown;
  SizeCode: unknown;
  CutNo: unknown;
  Category: unknown;
  Qty: unknown;
  SectionCode: unknown;
  SectionName: unknown;
  OprCode: string | null;
  OperationName: unknown;
  SkillCode: unknown;
  Smv: unknown;
  Rate: unknown;
  Value: number | null;
}

// Adds the same display fields the old single cross-server query used to
// join in (Inseam/SizeCode/CutNo/Category/Qty from cut detail;
// SectionCode/SectionName/OprCode/OperationName/SkillCode/Smv/Rate/Value
// from the style bulletin + operations catalog). Rows with no match on
// either side (bundle/op no longer in the current bulletin) get null
// fields rather than being dropped — same as the old OUTER APPLY semantics.
export async function enrichCouponRows<
  T extends { WorkOrder: string; BundleNo: string; OpNo: string },
>(rows: T[]): Promise<(T & EnrichmentFields)[]> {
  if (rows.length === 0) return [];

  const workOrders = [...new Set(rows.map((r) => r.WorkOrder))];
  const cutMaps = new Map<string, Map<string, CutDetailRow>>();
  const opMaps = new Map<string, Map<string, StyleBulletinRow>>();

  await Promise.all(
    workOrders.map(async (wo) => {
      const woRows = rows.filter((r) => r.WorkOrder === wo);
      const [cutMap, opMap] = await Promise.all([
        fetchCutDetailByBundle(wo, woRows.map((r) => r.BundleNo)),
        fetchStyleBulletinByOp(wo, woRows.map((r) => r.OpNo)),
      ]);
      cutMaps.set(wo, cutMap);
      opMaps.set(wo, opMap);
    }),
  );

  return rows.map((row) => {
    const cut = cutMaps.get(row.WorkOrder)?.get(row.BundleNo);
    const op = opMaps.get(row.WorkOrder)?.get(row.OpNo);
    const qty = (cut?.Bundle_Qty as number | null | undefined) ?? null;
    const rate = (op?.Piece_Rate as number | null | undefined) ?? null;
    return {
      ...row,
      Inseam: cut?.Inseam ?? null,
      SizeCode: cut?.Size ?? null,
      CutNo: cut?.Cut ?? null,
      Category: cut?.Shade ?? null,
      Qty: qty,
      SectionCode: op?.Section ?? null,
      SectionName: op?.Section ?? null,
      OprCode: op?.Operation_Code ?? null,
      OperationName: op?.Operation_Name ?? null,
      SkillCode: op?.SkillLevel ?? null,
      Smv: op?.Smv_Sam ?? null,
      Rate: rate,
      Value: qty != null && rate != null ? Number(qty) * Number(rate) : null,
    };
  });
}

// Mirrors the old SQL's `TRY_CAST(d.Cut AS INT) >= / <= TRY_CAST(@cut AS INT)`
// range filter — now applied in JS after enrichment instead of inside the
// (impossible) cross-server query. A non-numeric CutNo fails the check
// whenever a cut filter is active, same as TRY_CAST returning NULL in SQL.
export function withinCutRange(
  cutNo: unknown,
  fromCut: string,
  toCut: string,
): boolean {
  if (!fromCut && !toCut) return true;
  const cut = Number(cutNo);
  if (!Number.isFinite(cut)) return false;
  if (fromCut && cut < Number(fromCut)) return false;
  if (toCut && cut > Number(toCut)) return false;
  return true;
}
