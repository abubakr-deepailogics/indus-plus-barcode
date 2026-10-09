import { getPool, sql } from "@/lib/db";
import type { CouponDepartment } from "@/lib/department-classification";
import type {
  ReworkEntriesResponse,
  SavedReworkCuttingDetail,
} from "@/features/rework-coupon/types";

export async function listReworkCuttingDetails(
  workOrder: string,
  department: CouponDepartment,
): Promise<ReworkEntriesResponse> {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("workOrder", sql.NVarChar(100), workOrder)
    .input("department", sql.NVarChar(50), department)
    .query(`
      SELECT RowId, CutNo, Inseam, Size, Pcs, BundleNo, ReworkQty, InsertedAt
      FROM dbo.ReworkCouponEntry
      WHERE WorkOrder = @workOrder AND Department = @department
      ORDER BY InsertedAt ASC, RowId ASC;
    `);

  const rows: SavedReworkCuttingDetail[] = result.recordset.map((row) => ({
    rowId: Number(row.RowId),
    cutNo: String(row.CutNo ?? ""),
    inseam: String(row.Inseam ?? ""),
    size: String(row.Size ?? ""),
    pcs: Number(row.Pcs) || 0,
    bundleNo: String(row.BundleNo ?? ""),
    reworkQty: row.ReworkQty == null ? null : Number(row.ReworkQty),
    insertedAt: new Date(row.InsertedAt).toISOString(),
  }));

  return { rows, latestReworkQty: rows.at(-1)?.reworkQty ?? null };
}
