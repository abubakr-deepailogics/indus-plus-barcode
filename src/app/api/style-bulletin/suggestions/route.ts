import { getPool, sql, STYLE_BULLETIN_TABLE } from "@/lib/db";

// Style Bulletin's own Work Order autocomplete — queries StyleBullettinInt's
// [Order No] column directly instead of piggybacking on Cut Report's
// SaleOrderPOCutDetailViewV1 (see /api/open-order/suggestions), so a work
// order only present in the style bulletin table still autocompletes here.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();

  try {
    const pool = await getPool("indusPlus");

    if (query.length < 2) {
      const result = await pool.request().query(`
        SELECT DISTINCT TOP 12 [Order No] AS Order_No
        FROM ${STYLE_BULLETIN_TABLE}
        WHERE [Order No] IS NOT NULL AND [Order No] <> ''
        ORDER BY Order_No DESC
      `);
      return Response.json(result.recordset.map((r) => r.Order_No));
    }

    const result = await pool
      .request()
      .input("q", sql.NVarChar, `%${query}%`).query(`
        SELECT DISTINCT TOP 8 [Order No] AS Order_No
        FROM ${STYLE_BULLETIN_TABLE}
        WHERE [Order No] LIKE @q
        ORDER BY Order_No
      `);

    return Response.json(result.recordset.map((r) => r.Order_No));
  } catch (err: unknown) {
    console.error("Style bulletin suggestions API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
