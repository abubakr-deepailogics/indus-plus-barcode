import { buildOperatorWiseReport } from "@/features/reports/services/finance-report.service";

export const dynamic = "force-dynamic";

// Always scoped to the current pay-cycle month (24th → today) — see
// finance-report.service.ts. No query params.
export async function GET() {
  try {
    const data = await buildOperatorWiseReport();
    return Response.json(data);
  } catch (err: unknown) {
    console.error("Operator-wise report error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
