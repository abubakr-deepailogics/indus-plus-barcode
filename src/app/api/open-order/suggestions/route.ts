import { getPool, sql, CUT_DETAIL_VIEW, WORKERS_VIEW } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const type = searchParams.get("type") || "work_order";
  const onlyGenerated = searchParams.get("only_generated") === "true";

  try {
    // Cross-server: SaleOrderPOCutDetailViewV1 lives on indusPlus, the
    // workers view on hrms, QrCode_Coupon on pitSystem — three distinct SQL
    // Server instances (see CONNECTION_STRINGS in db.ts), so each branch
    // below gets its own pool rather than sharing one.
    if (type === "customer") {
      const pool = await getPool("indusPlus");
      const result = await pool.request().query(`
        SELECT DISTINCT TOP 20 [Customer Name] AS Customer_Name
        FROM ${CUT_DETAIL_VIEW}
        WHERE [Customer Name] IS NOT NULL AND [Customer Name] <> ''
        ORDER BY Customer_Name
      `);
      const list = result.recordset.map((r) => r.Customer_Name);
      return Response.json(list);
    }

    if (type === "workers") {
      const pool = await getPool("hrms");
      const q = searchParams.get("query") || "";
      if (q.trim()) {
        const result = await pool
          .request()
          .input("q", sql.NVarChar, `%${q.trim()}%`).query(`
            SELECT DISTINCT TOP 20 EmployeeID, FirstName
            FROM ${WORKERS_VIEW}
            WHERE FirstName IS NOT NULL
              AND (CAST(EmployeeID AS VARCHAR(20)) LIKE @q OR FirstName LIKE @q)
            ORDER BY EmployeeID
          `);
        return Response.json(result.recordset);
      } else {
        const result = await pool.request().query(`
          SELECT DISTINCT TOP 20 EmployeeID, FirstName
          FROM ${WORKERS_VIEW}
          WHERE FirstName IS NOT NULL
          ORDER BY EmployeeID
        `);
        return Response.json(result.recordset);
      }
    }

    // Default: work_order suggestions
    if (onlyGenerated) {
      const pool = await getPool("pitSystem");
      if (!query || query.trim().length < 2) {
        const result = await pool.request().query(`
          SELECT DISTINCT TOP 12 WorkOrder
          FROM dbo.QrCode_Coupon
          ORDER BY WorkOrder DESC
        `);
        return Response.json(result.recordset.map((r) => r.WorkOrder));
      }

      const result = await pool
        .request()
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT DISTINCT TOP 8 WorkOrder
          FROM dbo.QrCode_Coupon
          WHERE WorkOrder LIKE @q OR CouponCode LIKE @q OR BundleNo LIKE @q
          ORDER BY WorkOrder
        `);

      const suggestions = result.recordset.map((r) => r.WorkOrder);
      return Response.json(suggestions);
    }

    const pool = await getPool("indusPlus");
    if (!query || query.trim().length < 2) {
      // If empty query, return top 12 general work orders
      const result = await pool.request().query(`
        SELECT DISTINCT TOP 12 [Work Order #] AS Work_Order
        FROM ${CUT_DETAIL_VIEW}
        ORDER BY Work_Order DESC
      `);
      return Response.json(result.recordset.map((r) => r.Work_Order));
    }

    const result = await pool
      .request()
      .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
        SELECT DISTINCT TOP 8 [Work Order #] AS Work_Order
        FROM ${CUT_DETAIL_VIEW}
        WHERE [Work Order #] LIKE @q
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
