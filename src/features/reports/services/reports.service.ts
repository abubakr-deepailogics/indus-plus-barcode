import { format } from "date-fns";
import type { EmployeeReportSummary, ReportDateRange } from "../types";

// Employee search box reuses coupon-scanning's worker lookup (same
// /api/workers endpoint) rather than duplicating an identical fetch here.
export { fetchWorkerSuggestions } from "@/features/coupon-scanning/services/coupon-scanning.service";
export type { Worker } from "@/features/coupon-scanning/types";

export async function fetchEmployeeReport(
  employeeCode: string,
  range?: ReportDateRange,
): Promise<
  | { ok: true; data: EmployeeReportSummary }
  | { ok: false; error: string }
> {
  const params = new URLSearchParams({ code: employeeCode });
  if (range?.from) params.set("from", format(range.from, "yyyy-MM-dd"));
  if (range?.to) params.set("to", format(range.to, "yyyy-MM-dd"));

  const response = await fetch(`/api/reports/employee-summary?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    return { ok: false, error: data.error || "Failed to fetch employee report." };
  }
  return { ok: true, data };
}
