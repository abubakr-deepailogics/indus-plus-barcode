import { format } from "date-fns";
import {
  getPool,
  sql,
  currentPayCycleStart,
  WORKERS_VIEW,
  STYLE_BULLETIN_SNAPSHOT_TABLE,
} from "@/lib/db";
import { enrichCouponRows } from "@/features/coupon-scanning/services/coupon-enrichment.service";
import type {
  FinanceReportPeriod,
  OrderWiseReportResult,
  OrderWiseReportRow,
  OperatorWiseReportResult,
  OperatorWiseReportRow,
} from "../types";

// Builds the two legacy Azgard-9 finance printouts ("Order Wise Finishing
// Payment (Audit)" and "Operator Wise Final Payment") — but only the
// columns backed by a real, non-assumed source number. Both are hard-scoped
// to the current pay-cycle month (24th of last/this month → today, same
// rule as CURRENT_PAY_CYCLE_START_SQL) — there is no date picker for these
// reports, by design, matching how the legacy printouts are always run "for
// the current period."
//
// Columns the legacy printouts have that this system has NO source data
// for at all (incentive-scheme amounts, production-line assignment,
// wash-specific quantity, a stored "planned value" per order) are left out
// entirely rather than shown as 0/estimated — there's nothing to compute
// them from, and this app never had that engine.
//
// What's included, and where it's from:
// - Total SAM / Total Rate (Order Wise): summed straight from the style
//   bulletin snapshot's per-operation Smv/Sam and Piece Rate for that work
//   order — genuine source data, not scan-derived.
// - Previous Paid (Order Wise): summed from dbo.EmployeeWageRows for wage
//   batches created before this pay-cycle started — a real historical
//   ledger figure.
// - Current Claim / Minutes Produced / Qty Produced (Order Wise) and Total
//   Amt. (Operator Wise): summed directly from this pay-cycle's scanned
//   coupons (qty, rate, smv) — the same aggregation
//   report-summary-builder.service.ts already does for the main Reports
//   dashboard.
// - Joining Date (Operator Wise): HRMS's S_EmpDataPITSView genuinely
//   carries a JoiningDate column.
// - Section (Operator Wise): HRMS DepartmentName — the closest available
//   analogue to the legacy "Section :" grouping (the legacy buckets like
//   "FINISHING-A" don't exist anywhere in this app's data, so this isn't
//   claimed to match exactly).

const IN_LIST_CHUNK_SIZE = 2000; // stays well under SQL Server's ~2100 parameter cap

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function buildInClause(
  request: sql.Request,
  prefix: string,
  values: string[],
): string {
  return values
    .map((v, i) => {
      request.input(`${prefix}${i}`, sql.NVarChar, v);
      return `@${prefix}${i}`;
    })
    .join(", ");
}

function currentPeriod(): { period: FinanceReportPeriod; fromDate: Date; toDate: Date } {
  const fromDate = currentPayCycleStart();
  const toDate = new Date();
  return {
    period: {
      from: format(fromDate, "yyyy-MM-dd"),
      to: format(toDate, "yyyy-MM-dd"),
    },
    fromDate,
    toDate,
  };
}

interface RawScanRow {
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  EmployeeCode: string;
}

// This pay-cycle's scanned coupons, enriched with Qty/Rate/Smv/Value — the
// same shape report-summary-builder.service.ts builds for the main
// dashboard, reused here rather than re-implemented.
async function fetchCurrentCycleScans(fromDate: Date) {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("from", sql.Date, format(fromDate, "yyyy-MM-dd")).query(`
      SELECT CouponCode, WorkOrder, BundleNo, OpNo, EmployeeCode
      FROM dbo.QrCode_Coupon
      WHERE IsScanned = 1 AND IsDeleted = 0 AND ScannedAt IS NOT NULL AND ScannedAt >= @from
    `);
  const rows = result.recordset as RawScanRow[];
  return enrichCouponRows(rows);
}

// ── Order Wise Finishing Payment (Audit) ────────────────────────────────────

export async function buildOrderWiseReport(): Promise<OrderWiseReportResult> {
  const { period, fromDate } = currentPeriod();
  const scans = await fetchCurrentCycleScans(fromDate);

  const byWorkOrder = new Map<
    string,
    { currentClaim: number; minutesProduced: number; qtyProduced: number }
  >();
  for (const row of scans) {
    const qty = Number(row.Qty) || 0;
    const rate = Number(row.Rate) || 0;
    const smv = Number(row.Smv) || 0;
    const existing = byWorkOrder.get(row.WorkOrder);
    const value = qty * rate;
    const minutes = qty * smv;
    if (!existing) {
      byWorkOrder.set(row.WorkOrder, {
        currentClaim: value,
        minutesProduced: minutes,
        qtyProduced: qty,
      });
    } else {
      existing.currentClaim += value;
      existing.minutesProduced += minutes;
      existing.qtyProduced += qty;
    }
  }

  const workOrders = [...byWorkOrder.keys()];
  if (workOrders.length === 0) {
    return { period, rows: [] };
  }

  const pool = await getPool("pitSystem");

  // Order-level Total SAM / Total Rate: latest snapshot row per (WorkOrder,
  // OperationCode), summed — a garment's full SMV/rate cost across every
  // operation in its bulletin, independent of how much has been scanned.
  const bulletinTotals = new Map<string, { totalSam: number; totalRate: number }>();
  for (const batch of chunk(workOrders, IN_LIST_CHUNK_SIZE)) {
    const req = pool.request();
    const inClause = buildInClause(req, "wo", batch);
    const result = await req.query(`
      WITH Latest AS (
        SELECT
          [Order No] AS WorkOrder,
          [Operation Code] AS OpCode,
          [Piece Rate] AS Rate,
          [Smv/Sam] AS Smv,
          ROW_NUMBER() OVER (
            PARTITION BY [Order No], [Operation Code] ORDER BY InsertedAt DESC
          ) AS RowId
        FROM ${STYLE_BULLETIN_SNAPSHOT_TABLE}
        WHERE IsDeleted = 0 AND [Order No] IN (${inClause})
      )
      SELECT WorkOrder, SUM(ISNULL(Rate, 0)) AS TotalRate, SUM(ISNULL(Smv, 0)) AS TotalSam
      FROM Latest
      WHERE RowId = 1
      GROUP BY WorkOrder
    `);
    for (const row of result.recordset as { WorkOrder: string; TotalRate: number; TotalSam: number }[]) {
      bulletinTotals.set(row.WorkOrder, {
        totalSam: Number(row.TotalSam) || 0,
        totalRate: Number(row.TotalRate) || 0,
      });
    }
  }

  // Previous Paid — every wage batch already created for this work order
  // *before* the current pay-cycle started. Real historical ledger data,
  // not derived from scans.
  const previousPaidByWo = new Map<string, number>();
  for (const batch of chunk(workOrders, IN_LIST_CHUNK_SIZE)) {
    const req = pool.request().input("cycleStart", sql.Date, format(fromDate, "yyyy-MM-dd"));
    const inClause = buildInClause(req, "wo", batch);
    const result = await req.query(`
      SELECT r.WorkOrder, SUM(r.TotalPay) AS PreviousPaid
      FROM dbo.EmployeeWageRows r
      INNER JOIN dbo.EmployeeWages w ON w.WageId = r.WageId
      WHERE r.WorkOrder IN (${inClause}) AND w.CreatedAt < @cycleStart
      GROUP BY r.WorkOrder
    `);
    for (const row of result.recordset as { WorkOrder: string; PreviousPaid: number }[]) {
      previousPaidByWo.set(row.WorkOrder, Number(row.PreviousPaid) || 0);
    }
  }

  const rows: OrderWiseReportRow[] = workOrders
    .map((workOrder) => {
      const scan = byWorkOrder.get(workOrder)!;
      const bulletin = bulletinTotals.get(workOrder);
      const previousPaid = previousPaidByWo.get(workOrder) ?? 0;
      const currentClaim = scan.currentClaim;
      return {
        workOrder,
        totalSam: bulletin?.totalSam ?? null,
        totalRate: bulletin?.totalRate ?? null,
        previousPaid,
        currentClaim,
        totalClaim: previousPaid + currentClaim,
        minutesProduced: scan.minutesProduced,
        qtyProduced: scan.qtyProduced,
      };
    })
    .sort((a, b) => a.workOrder.localeCompare(b.workOrder));

  return { period, rows };
}

// ── Operator Wise Final Payment ─────────────────────────────────────────────

export async function buildOperatorWiseReport(): Promise<OperatorWiseReportResult> {
  const { period, fromDate } = currentPeriod();
  const scans = await fetchCurrentCycleScans(fromDate);

  const totalAmtByEmployee = new Map<string, number>();
  for (const row of scans) {
    if (!row.EmployeeCode) continue;
    const qty = Number(row.Qty) || 0;
    const rate = Number(row.Rate) || 0;
    totalAmtByEmployee.set(
      row.EmployeeCode,
      (totalAmtByEmployee.get(row.EmployeeCode) ?? 0) + qty * rate,
    );
  }

  const employeeCodes = [...totalAmtByEmployee.keys()];
  if (employeeCodes.length === 0) {
    return { period, rows: [] };
  }

  const hrmsPool = await getPool("hrms");
  const employeeInfo = new Map<
    string,
    { name: string; joiningDate: string | null; section: string }
  >();
  for (const batch of chunk(employeeCodes, IN_LIST_CHUNK_SIZE)) {
    const req = hrmsPool.request();
    const inClause = buildInClause(req, "emp", batch);
    const result = await req.query(`
      SELECT EmployeeID, FirstName, JoiningDate, DepartmentName
      FROM ${WORKERS_VIEW}
      WHERE CAST(EmployeeID AS NVARCHAR(20)) IN (${inClause})
    `);
    for (const row of result.recordset as {
      EmployeeID: number;
      FirstName: string | null;
      JoiningDate: string | null;
      DepartmentName: string | null;
    }[]) {
      employeeInfo.set(String(row.EmployeeID), {
        name: row.FirstName?.trim() || `#${row.EmployeeID}`,
        joiningDate: row.JoiningDate ?? null,
        section: row.DepartmentName?.trim() || "Unassigned",
      });
    }
  }

  const rows: OperatorWiseReportRow[] = employeeCodes
    .map((employeeCode) => {
      const info = employeeInfo.get(employeeCode);
      return {
        employeeCode,
        employeeName: info?.name ?? employeeCode,
        section: info?.section ?? "Unassigned",
        joiningDate: info?.joiningDate ?? null,
        totalAmt: totalAmtByEmployee.get(employeeCode) ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.employeeName.localeCompare(b.employeeName);
    });

  return { period, rows };
}
