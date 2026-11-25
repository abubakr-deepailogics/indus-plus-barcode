import { searchCutPlanningWorkOrders } from "@/features/cut-planning/services/cut-planning.service";
import { withRoute } from "@/lib/logger/with-route";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withRoute("/api/cut-planning/work-orders", async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    return Response.json(await searchCutPlanningWorkOrders({
      workOrder: searchParams.get("work_order") || "",
      customer: searchParams.get("customer") || "",
      saleOrderNo: searchParams.get("sale_order_no") || "",
    }));
  } catch (error) {
    logger.error("Cut-planning work-order search error", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to search work orders." },
      { status: 500 },
    );
  }
});
