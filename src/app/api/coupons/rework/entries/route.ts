import { isCouponDepartment } from "@/lib/department-classification";
import { listReworkCuttingDetails } from "@/features/rework-coupon/services/rework-entry.service";
import { withRoute } from "@/lib/logger/with-route";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withRoute("/api/coupons/rework/entries", async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = (searchParams.get("work_order") || "").trim();
  const department = (searchParams.get("department") || "").trim().toLowerCase();

  if (!workOrder) {
    return Response.json({ error: "work_order is required." }, { status: 400 });
  }
  if (!isCouponDepartment(department)) {
    return Response.json({ error: "Invalid department." }, { status: 400 });
  }

  try {
    return Response.json(await listReworkCuttingDetails(workOrder, department));
  } catch (error) {
    logger.error("Rework cutting-detail lookup error", error);
    return Response.json(
      { error: "Failed to load saved rework cutting details." },
      { status: 500 },
    );
  }
});
