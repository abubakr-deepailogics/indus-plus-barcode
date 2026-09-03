import { getPool, sql, STYLE_BULLETIN_TABLE } from "@/lib/db";

export const dynamic = "force-dynamic";

// Backs the shared Work Order search modal (src/components/work-order-search-modal.tsx)
// for Style Bulletin — queries StyleBullettinInt's own columns directly
// (same reasoning as /api/style-bulletin/suggestions: a work order only
// present in the style bulletin table, not the cut-detail view, still needs
// to show up here). Distinct from /api/style-bulletin/suggestions (single
// `query` string, TOP 8/12, string[] response) — this returns the
// W/O + Customer + Sale Order No row shape the modal's table needs.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = (searchParams.get("work_order") || "").trim();
  const customer = (searchParams.get("customer") || "").trim();
  const saleOrderNo = (searchParams.get("sale_order_no") || "").trim();

  try {
    const pool = await getPool("indusPlus");
    const request_ = pool.request();
    const conditions: string[] = ["[Order No] IS NOT NULL AND [Order No] <> ''"];

    if (workOrder) {
      request_.input("workOrder", sql.NVarChar, `%${workOrder}%`);
      conditions.push("[Order No] LIKE @workOrder");
    }
    if (customer) {
      request_.input("customer", sql.NVarChar, `%${customer}%`);
      conditions.push("[Customer Name] LIKE @customer");
    }
    if (saleOrderNo) {
      request_.input("saleOrderNo", sql.NVarChar, `%${saleOrderNo}%`);
      conditions.push("[Sale order No] LIKE @saleOrderNo");
    }

    const hasFilter = !!(workOrder || customer || saleOrderNo);
    const orderDirection = hasFilter ? "ASC" : "DESC";

    const result = await request_.query(`
      SELECT DISTINCT TOP 40
        [Order No] AS workOrder,
        [Customer Name] AS customer,
        [Sale order No] AS saleOrderNo
      FROM ${STYLE_BULLETIN_TABLE}
      WHERE ${conditions.join(" AND ")}
      ORDER BY [Order No] ${orderDirection}
    `);

    return Response.json(result.recordset);
  } catch (err: unknown) {
    console.error("Style bulletin work orders search API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
