import { buildReportSummary } from "@/features/reports/services/report-summary-builder.service";
import type { ReportSearchMode } from "@/features/reports/types";

export const dynamic = "force-dynamic";

const VALID_MODES: ReportSearchMode[] = ["employee", "workOrder", "operation"];

// GET /api/reports/summary?by=employee|workOrder|operation&value=<...>&from=<yyyy-MM-dd>&to=<yyyy-MM-dd>
//
// Single endpoint behind all three "search by" modes on the reports page —
// `by` picks which QrCode_Coupon column scopes the report (see
// report-summary-builder.service.ts), everything else about the response
// shape is identical across modes. `from`/`to` are optional and inclusive on
// both ends; omitting either (or both) reports all-time totals.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const by = searchParams.get("by");
  const value = (searchParams.get("value") || "").trim();
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const isAllEmployees =
    by === "employee" && searchParams.get("all") === "true";

  if (!by || !VALID_MODES.includes(by as ReportSearchMode)) {
    return Response.json(
      {
        error:
          "A valid 'by' parameter (employee, workOrder, or operation) is required.",
      },
      { status: 400 },
    );
  }
  if (!isAllEmployees && !value) {
    return Response.json(
      { error: "A search value is required." },
      { status: 400 },
    );
  }

  try {
    const result = await buildReportSummary(
      by as ReportSearchMode,
      value,
      from,
      to,
      { all: isAllEmployees },
    );
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(result.data);
  } catch (err: unknown) {
    console.error("Report summary API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
