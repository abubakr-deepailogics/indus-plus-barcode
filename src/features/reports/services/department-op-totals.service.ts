import { getPool, sql, STYLE_BULLETIN_SNAPSHOT_TABLE } from "@/lib/db";
import type { CouponDepartment } from "@/lib/department-classification";

const IN_LIST_CHUNK_SIZE = 2000; // stays well under SQL Server's ~2100 parameter cap

export interface DepartmentOpTotals {
  sam: number; // excludes zero-rate operations (matches the Style Bulletin "Excl 0" total)
  rate: number;
  incentive: number;
}

// Per work order, the sum of Piece Rate / SAM across the department's
// operations — entirely from pitSystem. Department membership comes from
// QrCode_Coupon.Department (an op belongs to a department once its coupons
// were generated under it), and rate/SAM from the latest style-bulletin
// snapshot row for that (work order, op). No indusPlus / S_OperationsCatalog.
export async function fetchDepartmentOpTotalsByWorkOrder(
  workOrders: string[],
  department: CouponDepartment,
): Promise<Map<string, DepartmentOpTotals>> {
  const map = new Map<string, DepartmentOpTotals>();
  if (workOrders.length === 0) return map;

  const pool = await getPool("pitSystem");
  for (let i = 0; i < workOrders.length; i += IN_LIST_CHUNK_SIZE) {
    const req = pool.request().input("department", sql.NVarChar, department);
    const inClause = workOrders
      .slice(i, i + IN_LIST_CHUNK_SIZE)
      .map((wo, idx) => {
        req.input(`wo${idx}`, sql.NVarChar, wo);
        return `@wo${idx}`;
      })
      .join(", ");
    const result = await req.query(`
      WITH Ops AS (
        SELECT DISTINCT WorkOrder, OpNo
        FROM dbo.QrCode_Coupon
        WHERE IsDeleted = 0 AND Department = @department AND WorkOrder IN (${inClause})
      ),
      Latest AS (
        SELECT [Order No] AS WorkOrder, [Operation Code] AS OpNo,
               TRY_CAST([Piece Rate] AS FLOAT) AS PieceRate,
               TRY_CAST(Incentive AS FLOAT) AS Incentive,
               TRY_CAST([Smv/Sam] AS FLOAT) AS Sam,
               ROW_NUMBER() OVER (PARTITION BY [Order No], [Operation Code] ORDER BY InsertedAt DESC) AS rn
        FROM ${STYLE_BULLETIN_SNAPSHOT_TABLE}
        WHERE IsDeleted = 0
          AND Department = @department
          AND [Order No] IN (${inClause})
      )
      SELECT o.WorkOrder,
             SUM(CASE WHEN l.PieceRate <> 0 THEN l.Sam ELSE 0 END) AS TotalSam,
             SUM(l.PieceRate) AS TotalRate,
             SUM(l.Incentive) AS TotalIncentive
      FROM Ops o
      JOIN Latest l ON l.WorkOrder = o.WorkOrder AND l.OpNo = o.OpNo AND l.rn = 1
      GROUP BY o.WorkOrder
    `);
    for (const row of result.recordset as {
      WorkOrder: string;
      TotalSam: number | null;
      TotalRate: number | null;
      TotalIncentive: number | null;
    }[]) {
      const sam = Number(row.TotalSam) || 0;
      const rate = Number(row.TotalRate) || 0;
      const incentive = Number(row.TotalIncentive) || 0;
      if (sam > 0 || rate > 0 || incentive > 0) {
        map.set(row.WorkOrder, { sam, rate, incentive });
      }
    }
  }
  return map;
}
