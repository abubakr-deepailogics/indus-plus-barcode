import { getPool, sql } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";

  if (!query || query.trim().length < 2) {
    return Response.json([]);
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("q", sql.NVarChar, `%${query.trim()}%`)
      .query(`
        SELECT DISTINCT TOP 8 Work_Order 
        FROM dbo.Order_Po_Cut_Detail 
        WHERE Work_Order LIKE @q
        ORDER BY Work_Order
      `);

    const suggestions = result.recordset.map((r) => r.Work_Order);
    return Response.json(suggestions);
  } catch (err: unknown) {
    console.error("Suggestions API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
