import { generateBundles } from "@/features/cut-planning/services/cut-planning.service";
import type { GenerateBundlesPayload } from "@/features/cut-planning/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workOrder = new URL(request.url).searchParams.get("work_order")?.trim();
  if (!workOrder) return Response.json({ nextSequence: 1 });
  try {
    const { getPool, sql } = await import("@/lib/db");
    const pool = await getPool("pitSystem");
    const result = await pool.request().input("workOrder", sql.NVarChar, workOrder).query(
      "SELECT LastSequence FROM dbo.BundleGenerationSequence WHERE WorkOrder = @workOrder",
    );
    return Response.json({ nextSequence: Number(result.recordset[0]?.LastSequence ?? 0) + 1 });
  } catch {
    return Response.json({ nextSequence: 1 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as GenerateBundlesPayload;
    const result = await generateBundles(payload, "system");
    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("Bundle generation POST error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate bundles." },
      { status: 400 },
    );
  }
}
