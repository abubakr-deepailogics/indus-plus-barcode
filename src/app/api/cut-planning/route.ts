import { getCutPlanning, saveCutPlanning } from "@/features/cut-planning/services/cut-planning.service";
import type { SaveCutPlanningPayload } from "@/features/cut-planning/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const workOrder = new URL(request.url).searchParams.get("work_order")?.trim() || "";
  if (!workOrder) {
    return Response.json({
      metadata: null,
      inseamGroups: [],
      plans: [],
    });
  }
  try {
    return Response.json(await getCutPlanning(workOrder));
  } catch (error) {
    console.error("Cut planning GET error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to load cut planning." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as SaveCutPlanningPayload;
    await saveCutPlanning(payload, "system");
    return Response.json({ success: true, message: "Cut planning saved successfully." });
  } catch (error) {
    console.error("Cut planning POST error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to save cut planning." }, { status: 400 });
  }
}
