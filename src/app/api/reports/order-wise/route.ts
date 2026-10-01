import { buildOrderWiseReport } from "@/features/reports/services/finance-report.service";
import { isStyleBulletinDepartment, type Department } from "@/lib/department-classification";

export const dynamic = "force-dynamic";

// Defaults to the current pay-cycle month (24th → today) — see
// finance-report.service.ts. ?cycleStart=yyyy-MM-dd (a 24th) selects any
// earlier pay-cycle month instead, for the report page's month picker.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cycleStart = searchParams.get("cycleStart") || undefined;
  const department = (searchParams.get("department") || "sewing").trim().toLowerCase();
  if (!isStyleBulletinDepartment(department)) return Response.json({ error: "Invalid department." }, { status: 400 });

  try {
    const data = await buildOrderWiseReport(cycleStart, department as Department);
    return Response.json(data);
  } catch (err: unknown) {
    console.error("Order-wise report error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
