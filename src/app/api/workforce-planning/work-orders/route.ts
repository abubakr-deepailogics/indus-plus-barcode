import { NextResponse } from "next/server";
import { fetchAvailableWorkOrders } from "@/features/workforce-planning/services/workforce-planning.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await fetchAvailableWorkOrders();
    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch work orders";
    console.error("GET /api/workforce-planning/work-orders error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
