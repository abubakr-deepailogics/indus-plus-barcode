import { getPool, sql } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = searchParams.get("work_order") || "";

  if (!workOrder) {
    return Response.json({ cutDetails: [], styleBulletins: [] });
  }

  try {
    const pool = await getPool();

    // Fetch Cut Detail
    const cutDetailResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .query("SELECT * FROM dbo.Order_Po_Cut_Detail WHERE Work_Order = @wo");

    // Fetch Style Bulletin
    const styleBulletinResult = await pool
      .request()
      .input("wo", sql.NVarChar, workOrder)
      .query("SELECT * FROM dbo.Order_STyleBulletin WHERE Order_No = @wo ORDER BY Operation_Sequeance ASC");

    return Response.json({
      cutDetails: cutDetailResult.recordset,
      styleBulletins: styleBulletinResult.recordset,
    });
  } catch (err: unknown) {
    console.error("Database API error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
