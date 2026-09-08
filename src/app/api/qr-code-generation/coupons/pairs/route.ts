import { getPool } from "@/lib/db";
import { getGeneratedPairs } from "@/features/qr-code-generation/services/coupon-registration.service";

export const dynamic = "force-dynamic";

// Distinct bundle/operation pairs already generated for a work order — used
// by the coupon generation page to enable Print for a selection that was
// generated in an earlier session, not just the current one.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";

  if (!workOrder) {
    return Response.json({ error: "work_order is required." }, { status: 400 });
  }

  try {
    const pool = await getPool("pitSystem");
    const pairs = await getGeneratedPairs(pool, workOrder);
    return Response.json({ pairs });
  } catch (err: unknown) {
    console.error("Generated pairs lookup error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
