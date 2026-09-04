import { format } from "date-fns";
import type {
  ReportDateRange,
  ReportSearchMode,
  ReportSearchSuggestion,
  ReportSummary,
} from "../types";

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
): Promise<{ ok: true; data: ReportSummary } | { ok: false; error: string }> {
  const params = new URLSearchParams({ by: mode, value });
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
): Promise<{ ok: true; data: ReportSummary } | { ok: false; error: string }> {
  const params = new URLSearchParams({ by: mode, all: "true" });
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
): Promise<ReportSearchSuggestion[]> {
  // Reuses the existing "work orders that actually have generated coupons"
  // lookup rather than a new endpoint — it's exactly the scope reports need.
  const params = new URLSearchParams({ only_generated: "true", query });
  const response = await fetch(
    `/api/open-order/suggestions?${params.toString()}`,
  );
  if (!response.ok) return [];
  const workOrders: string[] = await response.json();
  return workOrders.map((wo) => ({ value: wo, label: wo }));
}

export async function fetchOperationSearchSuggestions(
  query: string,
): Promise<ReportSearchSuggestion[]> {
  const params = new URLSearchParams({ query });
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
