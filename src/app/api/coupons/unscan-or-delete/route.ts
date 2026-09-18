import { getPool } from "@/lib/db";
import { readCouponFilter, findMatchingCoupons } from "./shared";

export const dynamic = "force-dynamic";

// Status-only lookup — lets the modal show how many coupons match the
// current filter, and their scanned/unscanned split, before anything is
// actually changed. The two actions this feeds (unscan, delete) are separate
// routes — see ./unscan/route.ts and ./delete/route.ts — each independently
// re-matching against current DB state rather than trusting this snapshot.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = readCouponFilter({
      workOrder: searchParams.get("workOrder"),
      bundleNo: searchParams.get("bundleNo"),
      opNo: searchParams.get("opNo"),
      section: searchParams.get("section"),
      isScanned: searchParams.get("isScanned"),
      fromCut: searchParams.get("fromCut"),
      toCut: searchParams.get("toCut"),
    });
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const pool = await getPool("pitSystem");
    const matches = await findMatchingCoupons(pool, parsed);
    if (matches.length === 0) {
      return Response.json(
        { error: "No matching coupons found for the given filters." },
        { status: 404 },
      );
    }
    const scannedCount = matches.filter((m) => m.IsScanned).length;
    return Response.json({
      totalCount: matches.length,
      scannedCount,
      unscannedCount: matches.length - scannedCount,
    });
  } catch (err: unknown) {
    console.error("Coupon status lookup error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
