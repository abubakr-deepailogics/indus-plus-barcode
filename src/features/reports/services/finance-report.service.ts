import { format } from "date-fns";
import {
  getPool,
  sql,
  currentPayCycleStart,
  WORKERS_VIEW,
  STYLE_BULLETIN_SNAPSHOT_TABLE,
  CUT_DETAIL_SNAPSHOT_TABLE,
  STYLE_BULLETIN_TABLE,
  OPERATIONS_CATALOG_TABLE,
} from "@/lib/db";
import { classifyDepartment } from "@/lib/department-classification";
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
}

async function fetchScansInRange(fromDate: Date, toDate: Date) {
  const pool = await getPool("pitSystem");
  const result = await pool
    .request()
    .input("from", sql.Date, format(fromDate, "yyyy-MM-dd"))
    .input("to", sql.Date, format(toDate, "yyyy-MM-dd")).query(`
      SELECT CouponCode, WorkOrder, BundleNo, OpNo, EmployeeCode, ScannedAt
      FROM dbo.QrCode_Coupon
      WHERE IsScanned = 1 AND IsDeleted = 0 AND ScannedAt IS NOT NULL
        AND ScannedAt >= @from AND ScannedAt < DATEADD(day, 1, @to)
    `);
  const rows = result.recordset as RawScanRow[];
  return enrichCouponRows(rows);
}

const DEPARTMENT_FILTER = "sewing" as const;

async function fetchSewingOpCodesByWorkOrder(
  workOrders: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const pool = await getPool("indusPlus");
  for (const batch of chunk(workOrders, IN_LIST_CHUNK_SIZE)) {
    const req = pool.request();
    const inClause = buildInClause(req, "wo", batch);
    const result = await req.query(`
      SELECT DISTINCT sb.[Order No] AS WorkOrder, sb.[Operation Code] AS OpNo, op.Department
      FROM ${STYLE_BULLETIN_TABLE} sb
      LEFT JOIN ${OPERATIONS_CATALOG_TABLE} op ON sb.[Operation Code] = op.OperationCode
      WHERE sb.[Order No] IN (${inClause})
    `);
    for (const row of result.recordset as {
      WorkOrder: string;
      OpNo: string;
      Department: string | null;
    }[]) {
      if (classifyDepartment(row) !== DEPARTMENT_FILTER) continue;
      if (!map.has(row.WorkOrder)) map.set(row.WorkOrder, new Set());
      map.get(row.WorkOrder)!.add(row.OpNo);
    }
  }
  return map;
}

// ── Order Wise Finishing Payment (Audit) ────────────────────────────────────

export async function buildOrderWiseReport(
  cycleStartParam?: string,
): Promise<OrderWiseReportResult> {
  const {
    period,
    fromDate: currentStart,
    toDate,
  } = resolvePeriod(cycleStartParam);
  const previousStart = previousPayCycleStart(currentStart);

  const allScans = await fetchScansInRange(previousStart, toDate);

  const scannedWorkOrders = [...new Set(allScans.map((r) => r.WorkOrder))];
  const sewingOpsByWo = await fetchSewingOpCodesByWorkOrder(scannedWorkOrders);
  const scans = allScans.filter((row) =>
    sewingOpsByWo.get(row.WorkOrder)?.has(row.OpNo),
  );

  const byWorkOrder = new Map<
    string,
    { previousPaid: number; currentClaim: number; qtyProduced: number }
  >();
  for (const row of scans) {
    const qty = Number(row.Qty) || 0;
    const rate = Number(row.Rate) || 0;
    const value = qty * rate;
    const isCurrentCycle = new Date(row.ScannedAt) >= currentStart;

    const existing = byWorkOrder.get(row.WorkOrder) ?? {
      previousPaid: 0,
      currentClaim: 0,
      qtyProduced: 0,
    };
    if (isCurrentCycle) {
      existing.currentClaim += value;
      existing.qtyProduced += qty;
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

  const bulletinTotals = new Map<
    string,
    { totalSam: number; totalRate: number }
  >();
  for (const workOrder of workOrders) {
    const sewingOps = [...(sewingOpsByWo.get(workOrder) ?? [])];
    if (sewingOps.length === 0) continue;
    for (const batch of chunk(sewingOps, IN_LIST_CHUNK_SIZE)) {
      const req = pitPool.request().input("wo", sql.NVarChar, workOrder);
      const inClause = buildInClause(req, "op", batch);
      const result = await req.query(`
        WITH Latest AS (
          SELECT
            [Operation Code] AS OpCode,
            [Piece Rate] AS Rate,
            [Smv/Sam] AS Smv,
            ROW_NUMBER() OVER (
              PARTITION BY [Order No], [Operation Code] ORDER BY InsertedAt DESC
            ) AS RowId
          FROM ${STYLE_BULLETIN_SNAPSHOT_TABLE}
          WHERE IsDeleted = 0 AND [Order No] = @wo AND [Operation Code] IN (${inClause})
        )
        SELECT SUM(ISNULL(Rate, 0)) AS TotalRate, SUM(ISNULL(Smv, 0)) AS TotalSam
        FROM Latest
        WHERE RowId = 1
      `);
      const row = result.recordset[0] as
        | { TotalRate: number; TotalSam: number }
        | undefined;
      const existing = bulletinTotals.get(workOrder) ?? {
        totalSam: 0,
        totalRate: 0,
      };
      existing.totalSam += Number(row?.TotalSam) || 0;
      existing.totalRate += Number(row?.TotalRate) || 0;
      bulletinTotals.set(workOrder, existing);
    }
  }

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
      const bulletin = bulletinTotals.get(workOrder);
      const washQty = washQtyByWo.get(workOrder) ?? null;
      const totalSam = bulletin?.totalSam ?? null;
      const totalRate = bulletin?.totalRate ?? null;
      const plan =
        totalRate != null && washQty != null ? totalRate * washQty : null;
      const totalClaim = scan.previousPaid + scan.currentClaim;
      return {
        workOrder,
        totalSam,
        totalRate,
        washQty,
        plan,
        previousPaid: scan.previousPaid,
        currentClaim: scan.currentClaim,
        totalClaim,
        balance: plan != null ? plan - totalClaim : null,
        minutesProduced: totalSam != null ? totalSam * scan.qtyProduced : 0,
        qtyProduced: scan.qtyProduced,
      };
    })
    .sort((a, b) => a.workOrder.localeCompare(b.workOrder));

  return { period, rows };
}

// ── Operator Wise Final Payment ─────────────────────────────────────────────

export async function buildOperatorWiseReport(
  cycleStartParam?: string,
): Promise<OperatorWiseReportResult> {
  const { period, fromDate, toDate } = resolvePeriod(cycleStartParam);
  const allScans = await fetchScansInRange(fromDate, toDate);

  const scannedWorkOrders = [...new Set(allScans.map((r) => r.WorkOrder))];
  const sewingOpsByWo = await fetchSewingOpCodesByWorkOrder(scannedWorkOrders);
  const scans = allScans.filter((row) =>
    sewingOpsByWo.get(row.WorkOrder)?.has(row.OpNo),
  );

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
