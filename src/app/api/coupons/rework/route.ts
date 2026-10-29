import { getPool, sql, cutDetailByFilter, styleBulletinByFilter } from "@/lib/db";
import { normalizeCutNo, normalizedCutSql } from "@/lib/cut-number";

// Rework coupon lookup: scoped to one work order + cut + bundle (bundle ids
// aren't unique across work orders, same reasoning as /api/open-order).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";
  const cutRaw = searchParams.get("cut") || "";
  const bundleIdRaw = searchParams.get("bundle_id") || "";

  if (!workOrder || !cutRaw || !bundleIdRaw) {
    return Response.json(
      { error: "work_order, cut, and bundle_id are all required." },
      { status: 400 },
    );
  }

  // Cut # is alphanumeric; Bundle_Id is a numeric column — validate + coerce it.
  const cut = normalizeCutNo(cutRaw);
  const bundleId = Number(bundleIdRaw);
  if (!Number.isFinite(bundleId)) {
    return Response.json(
      { error: "bundle_id must be numeric." },
      { status: 400 },
    );
  }

  try {
    const pool = await getPool("indusPlus");

    const cutDetailResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .input("cut", sql.NVarChar(50), cut)
      .input("bundleId", sql.Int, bundleId)
      .query(
        cutDetailByFilter(
          `[Work Order #] = @wo AND [Bundle Id] = @bundleId AND ${normalizedCutSql("CAST([Cut #] AS NVARCHAR(50))")} = @cut`,
        ),
      );

    const styleBulletinResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .query(styleBulletinByFilter("[Order No] = @wo"));

    return Response.json({
      cutDetails: cutDetailResult.recordset,
      styleBulletins: styleBulletinResult.recordset,
    });
  } catch (err: unknown) {
    console.error("Rework coupon lookup API error:", err);
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
