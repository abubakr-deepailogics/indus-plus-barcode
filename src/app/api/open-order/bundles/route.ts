import {
  softDeleteGeneratedBundle,
  softDeleteGeneratedCut,
} from "@/features/cut-planning/services/cut-report-bundle.service";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const workOrder = typeof body?.workOrder === "string" ? body.workOrder : "";
    if (typeof body?.cutNo === "string") {
      const result = await softDeleteGeneratedCut(workOrder, body.cutNo, "system");
      return Response.json(result);
    }
    const reportRowId = Number(body?.reportRowId);
    const result = await softDeleteGeneratedBundle(workOrder, reportRowId, "system");
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete the Cut Report bundle.";
    const status = /required|valid/i.test(message) ? 400 : 409;
    return Response.json({ error: message }, { status });
  }
}
