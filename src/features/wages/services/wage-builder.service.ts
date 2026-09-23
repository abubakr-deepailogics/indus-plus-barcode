import { buildReportSummary } from "@/features/reports/services/report-summary-builder.service";

import type { WagePreview, WageRow } from "../types";
import { groupEmployeeData } from "./employee-grouping.service";

// ── Tenure-scoped wage building ──────────────────────────────────────────────
// A wage covers EVERY scanned coupon in its tenure, for every employee — the
// dashboard's search/filter state is deliberately ignored. Partial coverage
// plus date-range locking would lock dates for employees who were never paid.
//
// Preview and create both go through here, so the counts shown in the confirm
// modal are the same numbers that get written.

export type BuildWageDataResult =
  | { ok: true; rows: WageRow[]; preview: WagePreview }
  | { ok: false; status: number; error: string };

export async function buildWageData(
  from: string,
  to: string,
): Promise<BuildWageDataResult> {
  // "all employees" over the tenure — no search value, no filters.
  const summaryResult = await buildReportSummary("employee", "", from, to, {
    all: true,
  });
  if (!summaryResult.ok) return summaryResult;

  const { employees, coupons } = summaryResult.data;
  const grouped = groupEmployeeData(employees, coupons);

  const rows: WageRow[] = grouped.flatMap((eg) =>
    eg.items.map((item) => ({
      employeeCode: eg.employeeCode ?? "",
      employeeName: eg.employeeName ?? null,
      // "—" is the grouping placeholder for a missing value; persist NULL.
      workOrder: item.workOrder !== "—" ? item.workOrder : null,
      workDate: item.date !== "—" ? item.date : null,
      operation: item.operation !== "—" ? item.operation : null,
      rate: item.rate,
      bundleCount: item.bundleCount,
      qty: item.qty,
      totalPay: item.totalPay,
    })),
  );

  // Counted from the coupon trail rather than the grouped rows: one grouped
  // row covers many coupons, so summing bundleCount is the coupon count while
  // distinct WorkOrder gives the order count.
  const orderCount = new Set(
    coupons.map((c) => c.workOrder).filter((wo): wo is string => !!wo),
  ).size;
  const employeeCount = new Set(
    rows.map((r) => r.employeeCode).filter(Boolean),
  ).size;

  return {
    ok: true,
    rows,
    preview: {
      orderCount,
      couponCount: coupons.length,
      employeeCount,
      totalQty: rows.reduce((s, r) => s + r.qty, 0),
      totalAmount: rows.reduce((s, r) => s + r.totalPay, 0),
    },
  };
}

// yyyy-MM-dd, the only format the wage API accepts for a tenure bound.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TenureValidation =
  | { ok: true; from: string; to: string }
  | { ok: false; error: string };

// Validates a tenure at the trust boundary: both ends required, well-formed,
// real calendar dates, and ordered.
export function validateTenure(
  rawFrom: unknown,
  rawTo: unknown,
): TenureValidation {
  const from = typeof rawFrom === "string" ? rawFrom.trim() : "";
  const to = typeof rawTo === "string" ? rawTo.trim() : "";

  if (!from || !to) {
    return { ok: false, error: "A tenure (from and to date) is required." };
  }
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { ok: false, error: "Tenure dates must be in yyyy-MM-dd format." };
  }
  // Round-tripping catches impossible dates like 2026-02-31, which Date()
  // silently rolls forward into March.
  if (
    new Date(`${from}T00:00:00Z`).toISOString().slice(0, 10) !== from ||
    new Date(`${to}T00:00:00Z`).toISOString().slice(0, 10) !== to
  ) {
    return { ok: false, error: "Tenure contains an invalid calendar date." };
  }
  if (from > to) {
    return { ok: false, error: "Tenure start date must be on or before the end date." };
  }

  return { ok: true, from, to };
}
