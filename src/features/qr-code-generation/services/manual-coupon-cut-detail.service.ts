import { sql } from "@/lib/db";
import type { CouponDepartment } from "@/lib/department-classification";
import type { BundleDetailRow } from "../types";

export interface ManualCouponCutDetail {
  RowId: number;
  BundleNo: string;
  Inseam: string | null;
  Size: string | null;
  Pcs: number;
}

export async function listManualCouponCutDetails(
  pool: sql.ConnectionPool,
  workOrder: string,
  department: CouponDepartment,
): Promise<ManualCouponCutDetail[]> {
  const result = await pool
    .request()
    .input("workOrder", sql.NVarChar, workOrder)
    .input("department", sql.NVarChar, department)
    .query<ManualCouponCutDetail>(`
      SELECT RowId, BundleNo, Inseam, Size, Pcs
      FROM dbo.ManualCouponCutDetail
      WHERE WorkOrder = @workOrder AND Department = @department
      ORDER BY TRY_CONVERT(INT, BundleNo), BundleNo;
    `);
  return result.recordset;
}

export async function saveManualCouponCutDetails(
  pool: sql.ConnectionPool,
  workOrder: string,
  department: CouponDepartment,
  bundles: BundleDetailRow[],
): Promise<void> {
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  try {
    await transaction.begin();
    transactionStarted = true;
    for (const bundle of bundles) {
      const request = new sql.Request(transaction);
      await request
        .input("workOrder", sql.NVarChar, workOrder)
        .input("department", sql.NVarChar, department)
        .input("bundleNo", sql.NVarChar, bundle.bundleNo.trim())
        .input("inseam", sql.NVarChar, bundle.inseam.trim() || null)
        .input("size", sql.NVarChar, bundle.size.trim() || null)
        .input("pcs", sql.Int, bundle.pcs).query(`
        MERGE dbo.ManualCouponCutDetail WITH (HOLDLOCK) AS target
        USING (
          SELECT @workOrder AS WorkOrder, @department AS Department, @bundleNo AS BundleNo
        ) AS source
        ON target.WorkOrder = source.WorkOrder
          AND target.Department = source.Department
          AND target.BundleNo = source.BundleNo
        WHEN MATCHED THEN
          UPDATE SET Inseam = @inseam, Size = @size, Pcs = @pcs
        WHEN NOT MATCHED THEN
          INSERT (WorkOrder, Department, BundleNo, Inseam, Size, Pcs)
          VALUES (@workOrder, @department, @bundleNo, @inseam, @size, @pcs);
      `);
    }
    await transaction.commit();
  } catch (error) {
    if (transactionStarted) await transaction.rollback();
    throw error;
  }
}
