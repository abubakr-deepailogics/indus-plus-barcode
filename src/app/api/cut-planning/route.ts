import { getCutPlanning, saveCutPlanning, softDeleteCutPlanningRow } from "@/features/cut-planning/services/cut-planning.service";
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

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order")?.trim() || "";
  const id = Number(searchParams.get("id"));
  if (!workOrder || !Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ error: "A valid Work Order and planning row are required." }, { status: 400 });
  }
  try {
    await softDeleteCutPlanningRow(workOrder, id, "system");
    return Response.json({ success: true, message: "Planning row removed." });
  } catch (error) {
    console.error("Cut planning DELETE error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Failed to remove planning row." }, { status: 400 });
  }
}
