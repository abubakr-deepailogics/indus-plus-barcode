import { fetchLockedRanges } from "@/features/wages/services/wage-lock.service";
import { isCouponDepartment, type CouponDepartment } from "@/lib/department-classification";

export const dynamic = "force-dynamic";

// ── GET /api/wages/locked-ranges ─────────────────────────────────────────────
// Every tenure that already has a wage. The coupon-scanning date picker uses
// these to disable locked dates; the scan routes still enforce the lock
// server-side, since a disabled calendar is UX, not a trust boundary.
export async function GET(request: Request) {
  try {
    const department = (new URL(request.url).searchParams.get("department") || "sewing").trim().toLowerCase();
    if (!isCouponDepartment(department)) return Response.json({ error: "Invalid department." }, { status: 400 });
    return Response.json({ ranges: await fetchLockedRanges(department as CouponDepartment) });
  } catch (err: unknown) {
    console.error("GET /api/wages/locked-ranges error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
