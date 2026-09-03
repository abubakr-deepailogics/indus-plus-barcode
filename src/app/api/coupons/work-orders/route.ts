import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Backs the shared Work Order search modal (src/components/work-order-search-modal.tsx)
// for Coupon Tracing — scoped to dbo.QrCode_Coupon (pitSystem), i.e. only
// work orders that actually have generated coupons, same scope as the
// existing ?only_generated=true branch of /api/open-order/suggestions.
// QrCode_Coupon has no Customer/Sale Order No columns (that data lives on a
// different SQL Server instance entirely — see CONNECTION_STRINGS in
// db.ts), so this route only ever takes/returns a Work Order field; the
// modal is told not to render those two columns for this page.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workOrder = (searchParams.get("work_order") || "").trim();

  try {
    const pool = await getPool("pitSystem");
    const request_ = pool.request();

    if (workOrder) {
      request_.input("workOrder", sql.NVarChar, `%${workOrder}%`);
    }

    const result = await request_.query(`
      SELECT DISTINCT TOP 40 WorkOrder AS workOrder
      FROM dbo.QrCode_Coupon
      ${workOrder ? "WHERE WorkOrder LIKE @workOrder" : ""}
      ORDER BY WorkOrder ${workOrder ? "ASC" : "DESC"}
    `);

    return Response.json(result.recordset);
  } catch (err: unknown) {
    console.error("Coupon work orders search API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
