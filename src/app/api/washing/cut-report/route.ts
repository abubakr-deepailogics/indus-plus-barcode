// Washing Cut Report API Route
import {
  getWashingCutReport,
  saveWashingCutReport,
  softDeleteWashingCutReportRow,
} from "@/features/washing/services/washing-cut-report-service";
import type { SaveWashingCutReportPayload } from "@/features/washing/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";

  if (!workOrder) {
    return Response.json({ metadata: null, cuts: [] });
  }

  try {
    const data = await getWashingCutReport(workOrder);
    return Response.json(data);
  } catch (err: unknown) {
    console.error("Washing Cut Report GET error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveWashingCutReportPayload;

    if (!body?.workOrder?.trim()) {
      return Response.json(
        { error: "Work Order (workOrder) is required." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body?.cuts) || body.cuts.length === 0) {
      return Response.json(
        { error: "At least one cut detail row is required." },
        { status: 400 },
      );
    }

    // Optional user email from headers or body
    const userEmail = "system";

    const result = await saveWashingCutReport(body, userEmail);

    return Response.json({
      success: true,
      insertedCount: result.insertedCount,
      insertedRows: result.insertedRows,
      message: `Successfully saved ${result.insertedCount} washing cut detail row(s).`,
    });
  } catch (err: unknown) {
    console.error("Washing Cut Report POST error:", err);
    const message = err instanceof Error ? err.message : "Failed to save washing cut details.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown; workOrder?: unknown };
    const recordId = Number(body?.id);
    const workOrder = typeof body?.workOrder === "string" ? body.workOrder : "";

    if (!Number.isSafeInteger(recordId) || recordId <= 0) {
      return Response.json(
        { error: "A valid cut report record ID is required." },
        { status: 400 },
      );
    }
    if (!workOrder.trim()) {
      return Response.json({ error: "Work Order is required." }, { status: 400 });
    }

    await softDeleteWashingCutReportRow(recordId, workOrder, "system");
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error("Washing Cut Report DELETE error:", err);
    const message = err instanceof Error ? err.message : "Failed to delete washing cut detail.";
    return Response.json({ error: message }, { status: 500 });
  }
}
