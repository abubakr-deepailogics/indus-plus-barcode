import { getPool } from "@/lib/db";
import {
  isCouponDepartment,
  type CouponDepartment,
} from "@/lib/department-classification";
import { listManualCouponCutDetails } from "@/features/qr-code-generation/services/manual-coupon-cut-detail.service";
import { withRoute } from "@/lib/logger/with-route";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const GET = withRoute("/api/manual-coupon-cut-details", async function GET(request: Request) {
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
    const pool = await getPool("pitSystem");
    const rows = await listManualCouponCutDetails(
      pool,
      workOrder,
      department as CouponDepartment,
    );
    return Response.json({ rows });
  } catch (error: unknown) {
    logger.error("Manual coupon cut-detail lookup failed", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
});
