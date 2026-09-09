import { NextRequest, NextResponse } from "next/server";
import { generateWorkforcePrediction } from "@/features/workforce-planning/services/workforce-planning.service";
import type { WorkforceSimulationParams } from "@/features/workforce-planning/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WorkforceSimulationParams;

    if (!body || !body.workOrder || typeof body.workOrder !== "string" || !body.workOrder.trim()) {
      return NextResponse.json(
        { success: false, error: "A valid 'workOrder' parameter is required." },
        { status: 400 }
      );
    }

    const prediction = await generateWorkforcePrediction({
      workOrder: body.workOrder.trim(),
      targetDays: body.targetDays ? Math.max(1, Math.min(60, Number(body.targetDays))) : 5,
      shiftHours: body.shiftHours ? Math.max(4, Math.min(16, Number(body.shiftHours))) : 8,
      targetEfficiency: body.targetEfficiency
        ? Math.max(0.4, Math.min(1.0, Number(body.targetEfficiency) > 1 ? Number(body.targetEfficiency) / 100 : Number(body.targetEfficiency)))
        : 0.85,
      absenteeismBuffer: body.absenteeismBuffer
        ? Math.max(0, Math.min(0.3, Number(body.absenteeismBuffer) > 1 ? Number(body.absenteeismBuffer) / 100 : Number(body.absenteeismBuffer)))
        : 0.05,
      sectionFilter: body.sectionFilter || "All",
      customQuantity: body.customQuantity ? Math.max(1, Math.min(1000000, Number(body.customQuantity))) : undefined,
    });

    return NextResponse.json({ success: true, data: prediction });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate workforce prediction";
    console.error("POST /api/workforce-planning/predict error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
