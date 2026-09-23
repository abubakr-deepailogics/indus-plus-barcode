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
