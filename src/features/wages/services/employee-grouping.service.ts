import { format } from "date-fns";

import type {
  CouponReportItem,
  EmployeeBreakdownItem,
} from "@/features/reports/types";
import type { EmployeeGrouped, EmployeeGroupedItem } from "../types";

// Rework bundle numbers are prefixed "RW" (see rework-coupon/page.tsx's
// assignedBundles) — no other bundle numbering scheme starts with "RW", so
// this is a reliable way to tell a rework coupon apart from a regular
// production one wherever only the operation name/coupon row is visible.
export function isReworkBundle(bundleNo?: string | null): boolean {
  return !!bundleNo && bundleNo.toUpperCase().startsWith("RW");
}

export function withReworkTag(
  operationLabel: string,
  bundleNo?: string | null,
): string {
  return isReworkBundle(bundleNo) ? `${operationLabel} (Rework)` : operationLabel;
}

// Groups an employee/coupon list (from any summary — a specific search or the
// "all employees" fetch) into per-employee, per-(workOrder, date, operation,
// rate) rows. Used both for the on-screen breakdown and for building wage
// rows, and pure so the wages API route can call it server-side.
export function groupEmployeeData(
  employeesList: EmployeeBreakdownItem[] | undefined,
  couponsList: CouponReportItem[] | undefined,
): EmployeeGrouped[] {
  if (!employeesList) return [];
  const coupons = couponsList || [];

  return employeesList.map((emp) => {
    const empCoupons = coupons.filter(
      (c) => c.employeeCode === emp.employeeCode,
    );

    if (empCoupons.length === 0) {
      return {
        employeeCode: emp.employeeCode,
        employeeName: emp.employeeName,
        items: [
          {
            workOrder: "—",
            date: "—",
            operation: "—",
            rate: null as number | null,
            bundleCount: emp.couponCount || 0,
            qty: emp.totalQty || 0,
            totalPay: emp.totalAmount || 0,
          },
        ],
        totalBundles: emp.couponCount || 0,
        totalQty: emp.totalQty || 0,
        totalPay: emp.totalAmount || 0,
      };
    }

    // Group by workOrder, date (dd-MM-yy), operation, rate
    const groupMap = new Map<string, EmployeeGroupedItem>();

    for (const c of empCoupons) {
      const wo = c.workOrder || "—";
      const dateStr = c.scannedAt
        ? format(new Date(c.scannedAt), "dd-MM-yy")
        : "—";
      const op = withReworkTag(
        c.operationName || c.operationCode || "—",
        c.bundleNo,
      );
      const rate = c.rate != null ? Number(c.rate) : null;
      const key = `${wo}__${dateStr}__${op}__${rate}`;

      const existing = groupMap.get(key);
      const qty = c.qty || 0;
      const pay =
        c.value != null ? Number(c.value) : rate != null ? qty * rate : 0;

      if (!existing) {
        groupMap.set(key, {
          workOrder: wo,
          date: dateStr,
          operation: op,
          rate,
          bundleCount: 1,
          qty,
          totalPay: pay,
        });
      } else {
        existing.bundleCount += 1;
        existing.qty += qty;
        existing.totalPay += pay;
      }
    }

    // Sort items by date then workOrder
    const items = Array.from(groupMap.values()).sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return a.workOrder.localeCompare(b.workOrder);
    });

    const totalBundles = items.reduce((acc, it) => acc + it.bundleCount, 0);
    const totalQty = items.reduce((acc, it) => acc + it.qty, 0);
    const totalPay = items.reduce((acc, it) => acc + it.totalPay, 0);

    return {
      employeeCode: emp.employeeCode,
      employeeName: emp.employeeName,
      items,
      totalBundles,
      totalQty,
      totalPay,
    };
  });
}

// One dimension-grouped row (work order / operation / section) for the
// Employees tab: who worked under that group, on which work order/operation/
// date/rate. Same aggregation as groupEmployeeData, but the primary group is
// whichever dimension the active search mode/top tab is, so the tab always
// reads as "who worked this X" for X = the thing being searched.
export interface DimensionGroupedItem {
  employeeCode: string;
  employeeName: string;
  workOrder: string;
  date: string;
  operation: string;
  rate: number | null;
  bundleCount: number;
  qty: number;
  totalPay: number;
}

export interface DimensionGrouped {
  groupKey: string;
  groupLabel: string;
  items: DimensionGroupedItem[];
  totalBundles: number;
  totalQty: number;
  totalPay: number;
}

// The four search modes, reused here as "which dimension is a breakdown tab
// grouped by" — every tab (Work Orders / Employees / Sections) groups its
// rows by whichever of these is the active search mode, except for the tab
// that IS that same dimension (e.g. the Employees tab in Employee mode),
// which stays flat since grouping a dimension by itself is a no-op.
export type SearchDimension = "employee" | "workOrder" | "operation" | "section";
// Employees tab specifically only ever needs to group by one of these three
// — "employee" is excluded there since the tab's own rows already are
// per-employee.
export type EmployeeGroupDimension = Exclude<SearchDimension, "employee">;

// One label per dimension's top-level breakdown rows (WorkOrderReportItem /
// OperationReportItem / SectionReportItem / EmployeeBreakdownItem) — each
// already carries the group key/label the top tab resolved to, so the
// coupon list just needs to be bucketed by the matching field.
function couponGroupKey(
  coupon: CouponReportItem,
  dimension: SearchDimension,
): string {
  if (dimension === "employee") return coupon.employeeCode || "—";
  if (dimension === "workOrder") return coupon.workOrder || "—";
  if (dimension === "operation")
    return coupon.operationCode || coupon.operationName || "—";
  return coupon.section || "—";
}

export function groupByDimension(
  dimension: EmployeeGroupDimension,
  groups: { key: string; label: string }[],
  couponsList: CouponReportItem[] | undefined,
): DimensionGrouped[] {
  const coupons = couponsList || [];

  return groups.map(({ key, label }) => {
    const groupCoupons = coupons.filter(
      (c) => couponGroupKey(c, dimension) === key,
    );

    // Group by employee, work order, date (dd-MM-yy), operation, rate
    const groupMap = new Map<string, DimensionGroupedItem>();

    for (const c of groupCoupons) {
      const empCode = c.employeeCode || "—";
      const empName = c.employeeName || empCode;
      const wo = c.workOrder || "—";
      const dateStr = c.scannedAt
        ? format(new Date(c.scannedAt), "dd-MM-yy")
        : "—";
      const op = withReworkTag(
        c.operationName || c.operationCode || "—",
        c.bundleNo,
      );
      const rate = c.rate != null ? Number(c.rate) : null;
      const mapKey = `${empCode}__${wo}__${dateStr}__${op}__${rate}`;

      const existing = groupMap.get(mapKey);
      const qty = c.qty || 0;
      const pay =
        c.value != null ? Number(c.value) : rate != null ? qty * rate : 0;

      if (!existing) {
        groupMap.set(mapKey, {
          employeeCode: empCode,
          employeeName: empName,
          workOrder: wo,
          date: dateStr,
          operation: op,
          rate,
          bundleCount: 1,
          qty,
          totalPay: pay,
        });
      } else {
        existing.bundleCount += 1;
        existing.qty += qty;
        existing.totalPay += pay;
      }
    }

    // Sort items by date then employee
    const items = Array.from(groupMap.values()).sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return a.employeeCode.localeCompare(b.employeeCode);
    });

    const totalBundles = items.reduce((acc, it) => acc + it.bundleCount, 0);
    const totalQty = items.reduce((acc, it) => acc + it.qty, 0);
    const totalPay = items.reduce((acc, it) => acc + it.totalPay, 0);

    return {
      groupKey: key,
      groupLabel: label,
      items,
      totalBundles,
      totalQty,
      totalPay,
    };
  });
}

// Generic nested-summary aggregation for the Work Orders, Operations and
// Sections breakdown tabs: buckets coupons first by the active search
// dimension (outer, e.g. "who worked this operation" groups), then by the
// tab's own row dimension within each bucket (inner, e.g. one row per work
// order) — same two-level shape as groupByDimension's Employees tab, but
// rows are plain aggregate totals rather than per-employee detail lines.
export type RowDimension = "workOrder" | "operation" | "section";

export interface DimensionRow {
  key: string;
  label: string;
  couponCount: number;
  totalQty: number;
  totalAmount: number;
  // Operation rows only — piece rate and SAM (Standard Allowed Minute), the
  // operation's own per-unit values (same source fields as
  // OperationReportItem.rate/smv), not summed across coupons. Null for work
  // order/section rows, which have no single rate/smv of their own.
  rate: number | null;
  sam: number | null;
}

export interface DimensionRowGroup {
  groupKey: string;
  groupLabel: string;
  rows: DimensionRow[];
  totalCoupons: number;
  totalQty: number;
  totalAmount: number;
}

function rowDimensionKey(
  coupon: CouponReportItem,
  rowDimension: RowDimension,
): string {
  if (rowDimension === "workOrder") return coupon.workOrder || "—";
  if (rowDimension === "operation")
    return coupon.operationCode || coupon.operationName || "—";
  return coupon.section || "—";
}

function rowDimensionLabel(
  coupon: CouponReportItem,
  rowDimension: RowDimension,
): string {
  if (rowDimension === "operation")
    return coupon.operationName || coupon.operationCode || "—";
  return rowDimensionKey(coupon, rowDimension);
}

export function groupRowsByDimension(
  outerDimension: SearchDimension,
  rowDimension: RowDimension,
  groups: { key: string; label: string }[],
  couponsList: CouponReportItem[] | undefined,
): DimensionRowGroup[] {
  const coupons = couponsList || [];

  return groups.map(({ key, label }) => {
    const groupCoupons = coupons.filter(
      (c) => couponGroupKey(c, outerDimension) === key,
    );

    const rowMap = new Map<string, DimensionRow>();
    for (const c of groupCoupons) {
      const rowKey = rowDimensionKey(c, rowDimension);
      const qty = c.qty || 0;
      const amount = c.value != null ? Number(c.value) : 0;
      const rate = c.rate != null ? Number(c.rate) : null;
      const sam = c.smv != null ? Number(c.smv) : null;

      const existing = rowMap.get(rowKey);
      if (!existing) {
        rowMap.set(rowKey, {
          key: rowKey,
          label: rowDimensionLabel(c, rowDimension),
          couponCount: 1,
          totalQty: qty,
          totalAmount: amount,
          rate: rowDimension === "operation" ? rate : null,
          sam: rowDimension === "operation" ? sam : null,
        });
      } else {
        existing.couponCount += 1;
        existing.totalQty += qty;
        existing.totalAmount += amount;
        if (rowDimension === "operation") {
          if (existing.rate == null && rate != null) existing.rate = rate;
          if (existing.sam == null && sam != null) existing.sam = sam;
        }
      }
    }

    const rows = Array.from(rowMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
    const totalCoupons = rows.reduce((acc, r) => acc + r.couponCount, 0);
    const totalQty = rows.reduce((acc, r) => acc + r.totalQty, 0);
    const totalAmount = rows.reduce((acc, r) => acc + r.totalAmount, 0);

    return {
      groupKey: key,
      groupLabel: label,
      rows,
      totalCoupons,
      totalQty,
      totalAmount,
    };
  });
}
