import { getPool, sql } from "@/lib/db";

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

  // Cut and Bundle_Id are numeric columns — binding them as strings would
  // never match, so validate + coerce before querying.
  const cut = Number(cutRaw);
  const bundleId = Number(bundleIdRaw);
  if (!Number.isFinite(cut) || !Number.isFinite(bundleId)) {
    return Response.json(
      { error: "cut and bundle_id must be numeric." },
      { status: 400 },
    );
  }

  try {
    const pool = await getPool();

    const cutDetailResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .input("cut", sql.Int, cut)
      .input("bundleId", sql.Int, bundleId)
      .query(
        "SELECT * FROM dbo.Order_Po_Cut_Detail WHERE Work_Order = @wo AND Cut = @cut AND Bundle_Id = @bundleId",
      );

    const styleBulletinResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .query(
        "SELECT * FROM dbo.Order_StyleBulletin WHERE Order_No = @wo ORDER BY Operation_Sequence ASC",
      );

    return Response.json({
      cutDetails: cutDetailResult.recordset,
      styleBulletins: styleBulletinResult.recordset,
    });
  } catch (err: unknown) {
    console.error("Rework coupon lookup API error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
