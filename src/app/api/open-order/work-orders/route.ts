import { getPool, sql, CUT_DETAIL_VIEW } from "@/lib/db";

export const dynamic = "force-dynamic";

// Backs the shared Work Order search modal (src/components/work-order-search-modal.tsx)
// for Cut Report and Coupon Generation — both read from the same indusPlus
// view, so one route serves them both. Distinct from /api/open-order/suggestions
// (single `query` string, TOP 8/12, string[] response) — this returns the
// W/O + Customer + Sale Order No row shape the modal's table needs, filtered
// by up to three independent fields at once.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = (searchParams.get("work_order") || "").trim();
  const customer = (searchParams.get("customer") || "").trim();
  const saleOrderNo = (searchParams.get("sale_order_no") || "").trim();

  try {
    const pool = await getPool("indusPlus");
    const request_ = pool.request();
    const conditions: string[] = [];

    if (workOrder) {
      request_.input("workOrder", sql.NVarChar, `%${workOrder}%`);
      conditions.push("[Work Order #] LIKE @workOrder");
    }
    if (customer) {
      request_.input("customer", sql.NVarChar, `%${customer}%`);
      conditions.push("UPPER([Customer Name]) LIKE UPPER(@customer)");
    }
    if (saleOrderNo) {
      request_.input("saleOrderNo", sql.NVarChar, `%${saleOrderNo}%`);
      conditions.push("[Sale Order No] LIKE @saleOrderNo");
    }

    // No filters yet → most-recent-first default list, mirroring the same
    // empty-query fallback /api/open-order/suggestions already uses.
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderDirection = conditions.length > 0 ? "ASC" : "DESC";

    const result = await request_.query(`
      SELECT DISTINCT TOP 40
        [Work Order #] AS workOrder,
        [Customer Name] AS customer,
        [Sale Order No] AS saleOrderNo
      FROM ${CUT_DETAIL_VIEW}
      ${where}
      ORDER BY [Work Order #] ${orderDirection}
    `);

    return Response.json(result.recordset);
  } catch (err: unknown) {
    console.error("Work orders search API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
