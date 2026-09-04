import {
  getPool,
  sql,
  WORKERS_VIEW,
  CUT_DETAIL_VIEW,
  STYLE_BULLETIN_TABLE,
  OPERATIONS_CATALOG_TABLE,
} from "@/lib/db";
import { enrichCouponRows } from "@/features/coupon-scanning/services/coupon-enrichment.service";
import type {
  CouponReportItem,
  EmployeeBreakdownItem,
  OperationReportItem,
  ReportSearchMode,
  ReportSubject,
  ReportSummary,
  WorkOrderReportItem,
} from "../types";

// Server-only: builds the report summary for /api/reports/summary. Kept out
// of the route handler per the "route files stay thin" convention — this is
// the actual cross-server query + aggregation logic.

export type BuildReportSummaryResult =
  | { ok: true; data: ReportSummary }
  | { ok: false; status: number; error: string };

// Raw QrCode_Coupon shape needed by enrichCouponRows (WorkOrder/BundleNo/OpNo)
// plus EmployeeCode, which every mode needs for the employee breakdown and
// coupon trail regardless of what was searched.
interface RawCouponRow {
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  EmployeeCode: string;
  ScannedAt: string | null;
}

// Which QrCode_Coupon column + bound value scopes every query to the
// searched dimension. Everything downstream (aggregation, breakdowns,
// coupon trail) is identical across modes once this is decided.
const COLUMN_BY_MODE: Record<ReportSearchMode, string> = {
  employee: "EmployeeCode",
  workOrder: "WorkOrder",
  operation: "OpNo",
};

async function resolveSubject(
  mode: ReportSearchMode,
  value: string,
): Promise<
  | { ok: true; subject: ReportSubject; boundValue: string }
  | { ok: false; status: number; error: string }
> {
  if (mode === "employee") {
    const employeeIdNum = parseInt(value, 10);
    if (isNaN(employeeIdNum)) {
      return { ok: false, status: 400, error: "Invalid employee code format." };
    }
    const hrmsPool = await getPool("hrms");
    const workerResult = await hrmsPool
      .request()
      .input("code", sql.Int, employeeIdNum).query(`
        SELECT TOP 1 EmployeeID, FirstName, DesignationName, ParentDepartment, DepartmentName
        FROM ${WORKERS_VIEW}
        WHERE EmployeeID = @code
      `);
    if (workerResult.recordset.length === 0) {
      return { ok: false, status: 404, error: "Employee not found." };
    }
    return {
      ok: true,
      subject: { mode: "employee", employee: workerResult.recordset[0] },
      boundValue: String(employeeIdNum),
    };
  }

  if (mode === "workOrder") {
    const indusPool = await getPool("indusPlus");
    const woResult = await indusPool.request().input("wo", sql.NVarChar, value)
      .query(`
        SELECT TOP 1
          [Work Order #] AS Work_Order,
          [Customer Name] AS Customer_Name,
          [Sale Order No] AS Sale_Order_No,
          [Order Qty After % Add] AS Order_Qty
        FROM ${CUT_DETAIL_VIEW}
        WHERE [Work Order #] = @wo
      `);
    if (woResult.recordset.length === 0) {
      return { ok: false, status: 404, error: "Work order not found." };
    }
    const row = woResult.recordset[0];
    return {
      ok: true,
      subject: {
        mode: "workOrder",
        workOrder: String(row.Work_Order),
        customerName: row.Customer_Name ?? null,
        saleOrderNo: row.Sale_Order_No ?? null,
        orderQty: row.Order_Qty != null ? Number(row.Order_Qty) : null,
      },
      boundValue: value,
    };
  }

  // mode === "operation" — Operation Code is a global catalog code (see
  // OPERATIONS_CATALOG_TABLE in db.ts), and StyleBullettinInt/S_OperationsCatalog
  // are both on indusPlus, so this is a plain single-server join.
  const indusPool = await getPool("indusPlus");
  const opResult = await indusPool.request().input("code", sql.NVarChar, value)
    .query(`
      SELECT TOP 1 sb.[Operation Code] AS Operation_Code, sb.[Operation Name] AS Operation_Name,
             op.Department, op.SkillLevel
      FROM ${STYLE_BULLETIN_TABLE} sb
      LEFT JOIN ${OPERATIONS_CATALOG_TABLE} op ON sb.[Operation Code] = op.OperationCode
      WHERE sb.[Operation Code] = @code
    `);
  if (opResult.recordset.length === 0) {
    return { ok: false, status: 404, error: "Operation not found." };
  }
  const row = opResult.recordset[0];
  return {
    ok: true,
    subject: {
      mode: "operation",
      operationCode: String(row.Operation_Code),
      operationName: row.Operation_Name ?? null,
      department: row.Department ?? null,
      skillLevel: row.SkillLevel ?? null,
    },
    boundValue: value,
  };
}

export async function buildReportSummary(
  mode: ReportSearchMode,
  rawValue: string,
  from: string,
  to: string,
  options: { all?: boolean } = {},
): Promise<BuildReportSummaryResult> {
  const isAllEmployees = mode === "employee" && options.all === true;
  const value = rawValue.trim();
  if (!isAllEmployees && !value) {
    return { ok: false, status: 400, error: "A search value is required." };
  }

  let subject: ReportSubject;
  let boundValue = value;
  if (isAllEmployees) {
    subject = { mode: "employee", all: true };
  } else {
    const subjectResult = await resolveSubject(mode, value);
    if (!subjectResult.ok) return subjectResult;
    subject = subjectResult.subject;
    boundValue = subjectResult.boundValue;
  }

  const pitPool = await getPool("pitSystem");
  const column = COLUMN_BY_MODE[mode];

  const couponConditions = ["IsScanned = 1"];
  const couponRequest = pitPool.request();
  if (isAllEmployees) {
    couponConditions.push(`${column} IS NOT NULL`);
  } else {
    couponRequest.input("value", sql.NVarChar, boundValue);
    couponConditions.push(`${column} = @value`);
  }
  if (from) {
    couponRequest.input("from", sql.Date, from);
    couponConditions.push("ScannedAt >= @from");
  }
  if (to) {
    couponRequest.input("to", sql.Date, to);
    // Exclusive upper bound one day out, so the `to` day itself is fully
    // included regardless of the time-of-day portion of ScannedAt.
    couponConditions.push("ScannedAt < DATEADD(day, 1, @to)");
  }

  const scanCountsRequest = pitPool.request();
  let scanCountsScope: string;
  if (isAllEmployees) {
    scanCountsScope = `${column} IS NOT NULL`;
  } else {
    scanCountsRequest.input("value", sql.NVarChar, boundValue);
    scanCountsScope = `${column} = @value`;
  }

  const [couponResult, scanCountsResult] = await Promise.all([
    couponRequest.query(`
      SELECT CouponCode, WorkOrder, BundleNo, OpNo, EmployeeCode, ScannedAt
      FROM dbo.QrCode_Coupon
      WHERE ${couponConditions.join(" AND ")}
      ORDER BY ScannedAt DESC
    `),
    scanCountsRequest.query(`
      SELECT
        (
          SELECT COUNT(*) FROM dbo.QrCode_Coupon
          WHERE ${scanCountsScope} AND IsScanned = 1 AND ScannedAt IS NOT NULL
            AND CAST(ScannedAt AS DATE) = CAST(GETDATE() AS DATE)
        ) AS TodayScans,
        (
          SELECT COUNT(*) FROM dbo.QrCode_Coupon
          WHERE ${scanCountsScope} AND IsScanned = 1 AND ScannedAt IS NOT NULL
            AND ScannedAt >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0)
        ) AS MonthScans
      `),
  ]);

  const rows = couponResult.recordset as RawCouponRow[];
  const enriched = await enrichCouponRows(rows);

  // Employee display names for the breakdown + coupon trail — one batch
  // lookup for every distinct EmployeeCode seen, rather than one per row.
  const employeeCodes = [
    ...new Set(enriched.map((r) => r.EmployeeCode).filter(Boolean)),
  ];
  const employeeInfoByCode = new Map<
    string,
    { name: string; designation: string | null }
  >();
  if (employeeCodes.length > 0) {
    const hrmsPool = await getPool("hrms");
    const empRequest = hrmsPool.request();
    const placeholders = employeeCodes.map((code, i) => {
      empRequest.input(`emp${i}`, sql.NVarChar, code);
      return `@emp${i}`;
    });
    const empResult = await empRequest.query(`
      SELECT EmployeeID, FirstName, DesignationName
      FROM ${WORKERS_VIEW}
      WHERE CAST(EmployeeID AS NVARCHAR(20)) IN (${placeholders.join(", ")})
    `);
    for (const row of empResult.recordset) {
      employeeInfoByCode.set(String(row.EmployeeID), {
        name: row.FirstName?.trim() || `#${row.EmployeeID}`,
        designation: row.DesignationName ?? null,
      });
    }
  }

  const totalAmount = enriched.reduce((sum, row) => sum + (row.Value ?? 0), 0);
  const totalQty = enriched.reduce(
    (sum, row) => sum + (Number(row.Qty) || 0),
    0,
  );
  const totalSam = enriched.reduce((sum, row) => {
    const qty = Number(row.Qty) || 0;
    const smv = Number(row.Smv) || 0;
    return sum + qty * smv;
  }, 0);
  const avgRatePerPiece = totalQty > 0 ? totalAmount / totalQty : 0;
  const totalWorkOrders = new Set(enriched.map((row) => row.WorkOrder)).size;
  const totalEmployees = new Set(enriched.map((row) => row.EmployeeCode)).size;

  const latest = enriched.length > 0 ? enriched[0] : null;

  const opMap = new Map<string, OperationReportItem>();
  const woMap = new Map<
    string,
    WorkOrderReportItem & { operations: Set<string> }
  >();
  const empMap = new Map<
    string,
    EmployeeBreakdownItem & {
      operationCodes: Set<string>;
      workOrderCodes: Set<string>;
    }
  >();
  const sectionCounts = new Map<string, number>();

  const couponItems: CouponReportItem[] = enriched.map((row) => {
    const qty = row.Qty != null ? Number(row.Qty) : null;
    const rate = row.Rate != null ? Number(row.Rate) : null;
    const smv = row.Smv != null ? Number(row.Smv) : null;
    const val = row.Value != null ? Number(row.Value) : null;
    const opCode = row.OprCode || row.OpNo || "UNKNOWN";
    const opName =
      row.OperationName != null ? String(row.OperationName) : opCode;
    const section =
      row.SectionName != null ? String(row.SectionName) : "General";
    const empInfo = employeeInfoByCode.get(row.EmployeeCode);
    const empName = empInfo?.name ?? row.EmployeeCode ?? null;

    if (section && section !== "General") {
      sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
    }

    // Aggregate Operation
    const existingOp = opMap.get(opCode);
    if (!existingOp) {
      opMap.set(opCode, {
        operationCode: opCode,
        operationName: opName,
        section,
        rate,
        smv,
        couponCount: 1,
        totalQty: qty || 0,
        totalSam: (qty || 0) * (smv || 0),
        totalAmount: val || 0,
      });
    } else {
      existingOp.couponCount += 1;
      existingOp.totalQty += qty || 0;
      existingOp.totalSam += (qty || 0) * (smv || 0);
      existingOp.totalAmount += val || 0;
      if (!existingOp.rate && rate) existingOp.rate = rate;
      if (!existingOp.smv && smv) existingOp.smv = smv;
    }

    // Aggregate Work Order
    const existingWo = woMap.get(row.WorkOrder);
    if (!existingWo) {
      woMap.set(row.WorkOrder, {
        workOrder: row.WorkOrder,
        couponCount: 1,
        totalQty: qty || 0,
        totalSam: (qty || 0) * (smv || 0),
        totalAmount: val || 0,
        operationsCount: 0,
        operations: new Set([opCode]),
      });
    } else {
      existingWo.couponCount += 1;
      existingWo.totalQty += qty || 0;
      existingWo.totalSam += (qty || 0) * (smv || 0);
      existingWo.totalAmount += val || 0;
      existingWo.operations.add(opCode);
    }

    // Aggregate Employee
    const existingEmp = empMap.get(row.EmployeeCode);
    if (!existingEmp) {
      empMap.set(row.EmployeeCode, {
        employeeCode: row.EmployeeCode,
        employeeName: empName ?? row.EmployeeCode,
        designation: empInfo?.designation ?? null,
        couponCount: 1,
        totalQty: qty || 0,
        totalSam: (qty || 0) * (smv || 0),
        totalAmount: val || 0,
        operationsCount: 0,
        workOrdersCount: 0,
        operationCodes: new Set([opCode]),
        workOrderCodes: new Set([row.WorkOrder]),
      });
    } else {
      existingEmp.couponCount += 1;
      existingEmp.totalQty += qty || 0;
      existingEmp.totalSam += (qty || 0) * (smv || 0);
      existingEmp.totalAmount += val || 0;
      existingEmp.operationCodes.add(opCode);
      existingEmp.workOrderCodes.add(row.WorkOrder);
    }

    return {
      couponCode: row.CouponCode,
      workOrder: row.WorkOrder,
      bundleNo: row.BundleNo,
      cutNo: row.CutNo != null ? String(row.CutNo) : null,
      qty,
      size: row.SizeCode != null ? String(row.SizeCode) : null,
      inseam: row.Inseam != null ? String(row.Inseam) : null,
      section,
      operationCode: opCode,
      operationName: opName,
      smv,
      rate,
      value: val,
      scannedAt: row.ScannedAt,
      employeeCode: row.EmployeeCode ?? null,
      employeeName: empName,
    };
  });

  let primarySection: string | null = null;
  let maxSectionCount = 0;
  for (const [sec, count] of sectionCounts.entries()) {
    if (count > maxSectionCount) {
      maxSectionCount = count;
      primarySection = sec;
    }
  }

  const operations = Array.from(opMap.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );
  const workOrders = Array.from(woMap.values())
    .map((w) => ({
      workOrder: w.workOrder,
      couponCount: w.couponCount,
      totalQty: w.totalQty,
      totalSam: w.totalSam,
      totalAmount: w.totalAmount,
      operationsCount: w.operations.size,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
  const employees = Array.from(empMap.values())
    .map((e) => ({
      employeeCode: e.employeeCode,
      employeeName: e.employeeName,
      designation: e.designation,
      couponCount: e.couponCount,
      totalQty: e.totalQty,
      totalSam: e.totalSam,
      totalAmount: e.totalAmount,
      operationsCount: e.operationCodes.size,
      workOrdersCount: e.workOrderCodes.size,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const scanCounts = scanCountsResult.recordset[0] || {};
  const todayScans = Number(scanCounts.TodayScans) || 0;
  const monthScans = Number(scanCounts.MonthScans) || 0;
  const latestEmpInfo = latest
    ? employeeInfoByCode.get(latest.EmployeeCode)
    : undefined;

  const summary: ReportSummary = {
    subject,
    todayScans,
    monthScans,
    primarySection,

    totalCoupons: enriched.length,
    lastScannedCoupon: latest?.CouponCode ?? null,
    lastScannedAt: latest?.ScannedAt ?? null,

    totalWorkOrders,
    totalEmployees,
    totalOperations: operations.length,

    recentWorkOrder: latest?.WorkOrder ?? null,
    recentCutNo: latest?.CutNo != null ? String(latest.CutNo) : null,
    recentBundleNo: latest?.BundleNo != null ? String(latest.BundleNo) : null,
    recentOperationName:
      latest?.OperationName != null ? String(latest.OperationName) : null,
    recentOperationCode: latest?.OprCode ?? latest?.OpNo ?? null,
    recentEmployeeCode: latest?.EmployeeCode ?? null,
    recentEmployeeName: latestEmpInfo?.name ?? latest?.EmployeeCode ?? null,

    totalAmount,
    totalQty,
    totalSam,
    avgRatePerPiece,

    operations,
    workOrders,
    employees,
    coupons: couponItems,
  };

  return { ok: true, data: summary };
}
