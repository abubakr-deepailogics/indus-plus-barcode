import {
  approveGeneratedBundle,
  approveGeneratedCut,
  softDeleteGeneratedBundle,
  softDeleteGeneratedCut,
} from "@/features/cut-planning/services/cut-report-bundle.service";

export const dynamic = "force-dynamic";

const errorStatus = (message: string) => (/required|valid/i.test(message) ? 400 : 409);

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
    return Response.json({ error: message }, { status: errorStatus(message) });
  }
}

// Approves one bundle ({ workOrder, reportRowId }) or every active bundle of a
// Cut ({ workOrder, cutNo }). Only approved bundles reach Coupon Generation.
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const workOrder = typeof body?.workOrder === "string" ? body.workOrder : "";
    const approvedBy =
      typeof body?.approvedBy === "string" && body.approvedBy.trim()
        ? body.approvedBy.trim().slice(0, 256)
        : "system";
    if (typeof body?.cutNo === "string") {
      const result = await approveGeneratedCut(workOrder, body.cutNo, approvedBy);
      return Response.json(result);
    }
    const reportRowId = Number(body?.reportRowId);
    const result = await approveGeneratedBundle(workOrder, reportRowId, approvedBy);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to approve the Cut Report bundle.";
    return Response.json({ error: message }, { status: errorStatus(message) });
  }
}
