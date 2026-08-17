import { getPool, sql } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const type = searchParams.get("type") || "work_order";

  try {
    const pool = await getPool();

    if (type === "customer") {
      const result = await pool.request().query(`
        SELECT DISTINCT TOP 20 Customer_Name 
        FROM dbo.Order_Po_Cut_Detail 
        WHERE Customer_Name IS NOT NULL AND Customer_Name <> ''
        ORDER BY Customer_Name
      `);
      const list = result.recordset.map((r) => r.Customer_Name);
      return Response.json(list);
    }

    if (type === "workers") {
      const q = searchParams.get("query") || "";
      if (q.trim()) {
        const result = await pool
          .request()
          .input("q", sql.NVarChar, `%${q.trim()}%`)
          .query(`
            SELECT DISTINCT TOP 20 EmployeeID, FirstName
            FROM dbo.Workers
            WHERE FirstName IS NOT NULL
              AND (CAST(EmployeeID AS VARCHAR(20)) LIKE @q OR FirstName LIKE @q)
            ORDER BY EmployeeID
          `);
        return Response.json(result.recordset);
      } else {
        const result = await pool.request().query(`
          SELECT DISTINCT TOP 20 EmployeeID, FirstName
          FROM dbo.Workers
          WHERE FirstName IS NOT NULL
          ORDER BY EmployeeID
        `);
        return Response.json(result.recordset);
      }
    }

    // Default: work_order suggestions
    if (!query || query.trim().length < 2) {
      // If empty query, return top 12 general work orders
      const result = await pool.request().query(`
        SELECT DISTINCT TOP 12 Work_Order 
        FROM dbo.Order_Po_Cut_Detail 
        ORDER BY Work_Order DESC
      `);
      return Response.json(result.recordset.map((r) => r.Work_Order));
    }

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
