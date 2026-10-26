import { format } from "date-fns";
import {
  getPool,
  sql,
  currentPayCycleStart,
  WORKERS_VIEW,
  CUT_DETAIL_SNAPSHOT_TABLE,
} from "@/lib/db";
import type { Department } from "@/lib/department-classification";
import { fetchDepartmentOpTotalsByWorkOrder } from "./department-op-totals.service";
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
// columns backed by a real, non-assumed source number. Both default to the
// current pay-cycle month (24th of last/this month → today, same rule as
// CURRENT_PAY_CYCLE_START_SQL) but accept an optional `cycleStart` (yyyy-MM-dd,
// always a 24th) to view any earlier month instead — see resolvePeriod. A
// past cycle's "to" is that cycle's own 23rd (it's closed), not today.

const IN_LIST_CHUNK_SIZE = 2000; // stays well under SQL Server's ~2100 parameter cap

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
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

function previousPayCycleStart(currentStart: Date): Date {
  const dayBefore = new Date(currentStart);
  dayBefore.setDate(dayBefore.getDate() - 1);
  return currentPayCycleStart(dayBefore);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function resolvePeriod(cycleStartParam?: string): {
  period: FinanceReportPeriod;
  fromDate: Date;
  toDate: Date;
} {
  const actualCurrentStart = currentPayCycleStart();
  let fromDate = actualCurrentStart;
  if (cycleStartParam) {
    const parsed = new Date(`${cycleStartParam}T00:00:00`);
    if (!isNaN(parsed.getTime())) fromDate = parsed;
  }

  const isLiveCycle = isSameDay(fromDate, actualCurrentStart);
  const toDate = isLiveCycle
    ? new Date()
    : new Date(
        new Date(
          fromDate.getFullYear(),
          fromDate.getMonth() + 1,
          24,
        ).getTime() -
          24 * 60 * 60 * 1000,
      );

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
  ScannedAt: string;
  // Normal scans are paid in their scan period. A settled arrear is paid in
  // the period containing the later wage's end date instead.
  PayableAt: string;
}

async function fetchScansInRange(fromDate: Date, toDate: Date, department: Department) {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("from", sql.Date, format(fromDate, "yyyy-MM-dd"))
    .input("to", sql.Date, format(toDate, "yyyy-MM-dd"))
    .input("department", sql.NVarChar, department).query(`
      SELECT c.CouponCode, c.WorkOrder, c.BundleNo, c.OpNo, c.EmployeeCode,
             c.ScannedAt,
             CAST(CASE
               -- A late coupon settled by a later wage is paid in that
               -- wage's period. ToDate gives each wage one unambiguous
               -- finance cycle even if a manually-selected tenure crosses a
               -- cycle boundary.
               WHEN c.WageId IS NOT NULL
                AND NOT (
                  c.ScannedAt >= paidWage.FromDate
                  AND c.ScannedAt < DATEADD(day, 1, paidWage.ToDate)
                )
                 THEN paidWage.ToDate
               ELSE c.ScannedAt
             END AS DATETIME) AS PayableAt
      FROM dbo.QrCode_Coupon c
      LEFT JOIN dbo.EmployeeWages paidWage
        ON paidWage.WageId = c.WageId
       AND paidWage.Department = c.Department
      WHERE c.IsScanned = 1 AND c.IsDeleted = 0 AND c.ScannedAt IS NOT NULL
        AND c.Department = @department
        AND (
          -- Regular coupons remain date-based. An unpaid coupon inside an
          -- already-paid tenure is pending arrears, so it must not appear in
          -- the old salary report a second time.
          (
            (
              (c.WageId IS NULL AND NOT EXISTS (
                SELECT 1 FROM dbo.EmployeeWages priorWage
                WHERE priorWage.Department = c.Department
                  AND c.ScannedAt >= priorWage.FromDate
                  AND c.ScannedAt < DATEADD(day, 1, priorWage.ToDate)
              ))
              OR
              (c.WageId IS NOT NULL AND c.ScannedAt >= paidWage.FromDate
               AND c.ScannedAt < DATEADD(day, 1, paidWage.ToDate))
            )
            AND c.ScannedAt >= @from AND c.ScannedAt < DATEADD(day, 1, @to)
          )
          OR
          -- A settled arrear is selected by the tenure of the wage that paid
          -- it, not by its original historic scan date.
          (
            c.WageId IS NOT NULL
            AND NOT (c.ScannedAt >= paidWage.FromDate
                     AND c.ScannedAt < DATEADD(day, 1, paidWage.ToDate))
            AND paidWage.ToDate >= @from
            AND paidWage.ToDate < DATEADD(day, 1, @to)
          )
        )
    `);
  const rows = result.recordset as RawScanRow[];
  return enrichCouponRows(rows, department);
}

async function fetchSewingOpCodesByWorkOrder(
  workOrders: string[],
  department: Department,
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const pool = await getPool("pitSystem");
  for (const batch of chunk(workOrders, IN_LIST_CHUNK_SIZE)) {
    const req = pool.request().input("department", sql.NVarChar, department);
    const inClause = buildInClause(req, "wo", batch);
    const result = await req.query(`
      SELECT DISTINCT WorkOrder, OpNo
      FROM dbo.QrCode_Coupon
      WHERE IsDeleted = 0 AND Department = @department AND WorkOrder IN (${inClause})
    `);
    for (const row of result.recordset as { WorkOrder: string; OpNo: string }[]) {
      if (!map.has(row.WorkOrder)) map.set(row.WorkOrder, new Set());
      map.get(row.WorkOrder)!.add(row.OpNo);
    }
  }
  return map;
}

// ── Order Wise Finishing Payment (Audit) ────────────────────────────────────

export async function buildOrderWiseReport(
  cycleStartParam?: string,
  department: Department = "sewing",
): Promise<OrderWiseReportResult> {
  const {
    period,
    fromDate: currentStart,
    toDate,
  } = resolvePeriod(cycleStartParam);
  const previousStart = previousPayCycleStart(currentStart);

  const allScans = await fetchScansInRange(previousStart, toDate, department);

  const scannedWorkOrders = [...new Set(allScans.map((r) => r.WorkOrder))];
  const sewingOpsByWo = await fetchSewingOpCodesByWorkOrder(scannedWorkOrders, department);
  const scans = allScans.filter((row) =>
    sewingOpsByWo.get(row.WorkOrder)?.has(row.OpNo),
  );

  const byWorkOrder = new Map<
    string,
    {
      previousPaid: number;
      currentClaim: number;
      opInc: number;
    }
  >();
  for (const row of scans) {
    const qty = Number(row.Qty) || 0;
    const rate = Number(row.Rate) || 0;
    const value = qty * rate;
    const opInc = qty * (Number(row.Incentive) || 0);
    const isCurrentCycle = new Date(row.PayableAt) >= currentStart;

    const existing = byWorkOrder.get(row.WorkOrder) ?? {
      previousPaid: 0,
      currentClaim: 0,
      opInc: 0,
    };
    existing.opInc += opInc;
    if (isCurrentCycle) {
      existing.currentClaim += value;
    } else {
      existing.previousPaid += value;
    }
    byWorkOrder.set(row.WorkOrder, existing);
  }

  const workOrders = [...byWorkOrder.keys()];
  if (workOrders.length === 0) {
    return { period, rows: [] };
  }

  const pitPool = await getPool("pitSystem");

  // Total SAM + Total Rate: sum of the department's operations for the work
  // order from the pitSystem style-bulletin snapshot (see
  // fetchDepartmentOpTotalsByWorkOrder). Total SAM excludes zero-rate ops.
  const totalSamByWo = await fetchDepartmentOpTotalsByWorkOrder(
    workOrders,
    department,
  );

  // Wash Qty (legacy column name) = the order's overall cut quantity — a
  // per-order constant repeated on every cut-detail row (MAX() per work
  // order rather than picking one arbitrary row), not scoped to a
  // department. Also the multiplicand for Plan (Total Rate × Wash Qty).
  const washQtyByWo = new Map<string, number>();
  for (const batch of chunk(workOrders, IN_LIST_CHUNK_SIZE)) {
    const req = pitPool.request();
    const inClause = buildInClause(req, "wo", batch);
    const result = await req.query(`
      SELECT [Work Order #] AS WorkOrder, MAX([Order Qty After % Add]) AS OrderQty
      FROM ${CUT_DETAIL_SNAPSHOT_TABLE}
      WHERE IsDeleted = 0 AND [Work Order #] IN (${inClause})
      GROUP BY [Work Order #]
    `);
    for (const row of result.recordset as {
      WorkOrder: string;
      OrderQty: number | null;
    }[]) {
      if (row.OrderQty != null)
        washQtyByWo.set(row.WorkOrder, Number(row.OrderQty));
    }
  }

  const rows: OrderWiseReportRow[] = workOrders
    .map((workOrder) => {
      const scan = byWorkOrder.get(workOrder)!;
      const bulletin = totalSamByWo.get(workOrder);
      const washQty = washQtyByWo.get(workOrder) ?? null;
      const totalSam = bulletin?.sam ?? null;
      const totalRate = bulletin?.rate ?? null;
      const totalIncentive = bulletin?.incentive ?? null;
      const plan =
        totalRate != null && totalIncentive != null && washQty != null
          ? (totalRate + totalIncentive) * washQty
          : null;
      const totalClaim = scan.previousPaid + scan.currentClaim;
      const total = totalClaim + scan.opInc;
      // Qty Produced = Current Claim ÷ Total Rate (not a bundle-scan count) —
      // Minutes Produced derives from that SAME ratio × Total SAM, rounded

      const qtyProducedExact =
        totalRate != null && totalRate > 0 ? scan.currentClaim / totalRate : 0;
      const qtyProduced = Math.round(qtyProducedExact);
      const minutesProduced =
        totalSam != null ? Math.round(totalSam * qtyProducedExact) : 0;
      return {
        workOrder,
        totalSam,
        totalRate,
        totalIncentive,
        washQty,
        plan,
        previousPaid: scan.previousPaid,
        currentClaim: scan.currentClaim,
        totalClaim,
        balance: plan != null ? plan - totalClaim : null,
        opInc: scan.opInc,
        total,
        minutesProduced,
        qtyProduced,
      };
    })
    .sort((a, b) => a.workOrder.localeCompare(b.workOrder));

  return { period, rows };
}

// ── Operator Wise Final Payment ─────────────────────────────────────────────

export async function buildOperatorWiseReport(
  cycleStartParam?: string,
  department: Department = "sewing",
  customFrom?: string,
  customTo?: string,
  allTime = false,
): Promise<OperatorWiseReportResult> {
  const customFromDate = customFrom ? new Date(`${customFrom}T00:00:00`) : null;
  const customToDate = customTo ? new Date(`${customTo}T00:00:00`) : null;
  const hasCustomRange = customFromDate && customToDate
    && !Number.isNaN(customFromDate.getTime())
    && !Number.isNaN(customToDate.getTime())
    && customFromDate <= customToDate;
  const { period, fromDate, toDate } = allTime
    ? { period: { from: "All time", to: "Present" }, fromDate: new Date(2000, 0, 1), toDate: new Date() }
    : hasCustomRange
    ? {
        period: { from: format(customFromDate, "yyyy-MM-dd"), to: format(customToDate, "yyyy-MM-dd") },
        fromDate: customFromDate,
        toDate: customToDate,
      }
    : resolvePeriod(cycleStartParam);
  const allScans = await fetchScansInRange(fromDate, toDate, department);

  const scannedWorkOrders = [...new Set(allScans.map((r) => r.WorkOrder))];
  const sewingOpsByWo = await fetchSewingOpCodesByWorkOrder(scannedWorkOrders, department);
  const scans = allScans.filter((row) =>
    sewingOpsByWo.get(row.WorkOrder)?.has(row.OpNo),
  );

  const pieceRateByEmployee = new Map<string, number>();
  const opIncByEmployee = new Map<string, number>();
  for (const row of scans) {
    if (!row.EmployeeCode) continue;
    const qty = Number(row.Qty) || 0;
    const rate = Number(row.Rate) || 0;
    const opInc = qty * (Number(row.Incentive) || 0);
    pieceRateByEmployee.set(
      row.EmployeeCode,
      (pieceRateByEmployee.get(row.EmployeeCode) ?? 0) + qty * rate,
    );
    opIncByEmployee.set(
      row.EmployeeCode,
      (opIncByEmployee.get(row.EmployeeCode) ?? 0) + opInc,
    );
  }

  const employeeCodes = [...pieceRateByEmployee.keys()];
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
      const pieceRateTotal = pieceRateByEmployee.get(employeeCode) ?? 0;
      const opInc = opIncByEmployee.get(employeeCode) ?? 0;
      return {
        employeeCode,
        employeeName: info?.name ?? employeeCode,
        section: info?.section ?? "Unassigned",
        joiningDate: info?.joiningDate ?? null,
        pieceRateTotal,
        opInc,
        total: pieceRateTotal + opInc,
      };
    })
    .sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.employeeName.localeCompare(b.employeeName);
    });

  return { period, rows };
}
