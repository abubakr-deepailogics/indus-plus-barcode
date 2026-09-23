import { fetchLockedRanges } from "@/features/wages/services/wage-lock.service";

export const dynamic = "force-dynamic";

// ── GET /api/wages/locked-ranges ─────────────────────────────────────────────
// Every tenure that already has a wage. The coupon-scanning date picker uses
// these to disable locked dates; the scan routes still enforce the lock
// server-side, since a disabled calendar is UX, not a trust boundary.
export async function GET() {
  try {
    return Response.json({ ranges: await fetchLockedRanges() });
  } catch (err: unknown) {
    console.error("GET /api/wages/locked-ranges error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
