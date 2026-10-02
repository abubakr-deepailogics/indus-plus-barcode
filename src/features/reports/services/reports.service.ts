import { format } from "date-fns";
import type {
  OperatorWiseReportResult,
  OrderWiseReportResult,
  ReportDateRange,
  ReportSearchMode,
  ReportSearchSuggestion,
  ReportSummary,
} from "../types";
import type { CouponDepartment } from "@/lib/department-classification";

// Employee search reuses coupon-scanning's worker lookup (same /api/workers
// endpoint) rather than duplicating an identical fetch here.
import { fetchWorkerSuggestions as fetchWorkerRows } from "@/features/coupon-scanning/services/coupon-scanning.service";

async function fetchSummaryByParams(
  params: URLSearchParams,
): Promise<{ ok: true; data: ReportSummary } | { ok: false; error: string }> {
  const response = await fetch(`/api/reports/summary?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to fetch report." };
  }
  return { ok: true, data };
}

export async function fetchReportSummary(
  mode: ReportSearchMode,
  value: string,
  range?: ReportDateRange,
  department: CouponDepartment = "sewing",
): Promise<{ ok: true; data: ReportSummary } | { ok: false; error: string }> {
  const params = new URLSearchParams({ by: mode, value });
  params.set("department", department);
  if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"));
  if (range?.to) params.set("to", format(range.to, "yyyy-MM-dd"));
  return fetchSummaryByParams(params);
}

// Same report shape as a single-value search in the given mode, aggregated
// across every employee/work order/operation instead of one — used by the
// "All" action beside the search field.
export async function fetchAllReportSummary(
  mode: ReportSearchMode,
  range?: ReportDateRange,
  department: CouponDepartment = "sewing",
): Promise<{ ok: true; data: ReportSummary } | { ok: false; error: string }> {
  const params = new URLSearchParams({ by: mode, all: "true" });
  params.set("department", department);
  if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"));
  if (range?.to) params.set("to", format(range.to, "yyyy-MM-dd"));
  return fetchSummaryByParams(params);
}

export async function fetchEmployeeSearchSuggestions(
  query: string,
): Promise<ReportSearchSuggestion[]> {
  const workers = await fetchWorkerRows(query);
  return workers.map((w) => ({
    value: String(w.EmployeeID),
    label: `${w.EmployeeID} — ${w.FirstName?.trim() || "Unknown"}`,
    sublabel: w.ParentDepartment || undefined,
  }));
}

export async function fetchWorkOrderSearchSuggestions(
  query: string,
  department: CouponDepartment = "sewing",
): Promise<ReportSearchSuggestion[]> {
  // Reuses the existing "work orders that actually have generated coupons"
  // lookup rather than a new endpoint — it's exactly the scope reports need.
  const params = new URLSearchParams({ only_generated: "true", query, department });
  const response = await fetch(
    `/api/open-order/suggestions?${params.toString()}`,
  );
  if (!response.ok) return [];
  const workOrders: string[] = await response.json();
  return workOrders.map((wo) => ({ value: wo, label: wo }));
}

export async function fetchOperationSearchSuggestions(
  query: string,
  department: CouponDepartment = "sewing",
): Promise<ReportSearchSuggestion[]> {
  const params = new URLSearchParams({ query, department });
  const response = await fetch(
    `/api/reports/operation-suggestions?${params.toString()}`,
  );
  if (!response.ok) return [];
  const operations: { operationCode: string; operationName: string | null }[] =
    await response.json();
  return operations.map((op) => ({
    value: op.operationCode,
    label: op.operationName
      ? `${op.operationCode} — ${op.operationName}`
      : op.operationCode,
  }));
}

export async function fetchSectionSearchSuggestions(
  query: string,
  department: CouponDepartment = "sewing",
): Promise<ReportSearchSuggestion[]> {
  const params = new URLSearchParams({ query, department });
  const response = await fetch(
    `/api/reports/section-suggestions?${params.toString()}`,
  );
  if (!response.ok) return [];
  const sections: string[] = await response.json();
  return sections.map((s) => ({ value: s, label: s }));
}

// ── Finance reports (Order Wise / Operator Wise) ────────────────────────────
// Both default to the current pay-cycle month server-side — pass
// `cycleStart` (yyyy-MM-dd, a 24th — see the report pages' month picker) to
// view an earlier month instead.

export async function fetchOrderWiseReport(
  cycleStart?: string,
  department: CouponDepartment = "sewing",
): Promise<{ ok: true; data: OrderWiseReportResult } | { ok: false; error: string }> {
  const params = new URLSearchParams({ department });
  if (cycleStart) params.set("cycleStart", cycleStart);
  const qp = `?${params.toString()}`;
  const response = await fetch(`/api/reports/order-wise${qp}`);
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to fetch order-wise report." };
  }
  return { ok: true, data };
}

export async function fetchOperatorWiseReport(
  cycleStart?: string,
  department: CouponDepartment = "sewing",
): Promise<{ ok: true; data: OperatorWiseReportResult } | { ok: false; error: string }> {
  const params = new URLSearchParams({ department });
  if (cycleStart) params.set("cycleStart", cycleStart);
  const qp = `?${params.toString()}`;
  const response = await fetch(`/api/reports/operator-wise${qp}`);
  const data = await response.json();
  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to fetch operator-wise report." };
  }
  return { ok: true, data };
}

