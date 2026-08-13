import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wo = searchParams.get("wo") || "";
  const type = searchParams.get("type") || ""; // 'bundle' or 'operation'
  const query = searchParams.get("query") || "";

  if (!wo) {
    return Response.json({ error: "Work Order parameter is required." }, { status: 400 });
  }

  try {
    const pool = await getPool();

    if (type === "bundle") {
      const result = await pool
        .request()
        .input("wo", sql.NVarChar, wo.trim())
        .input("q", sql.NVarChar, `%${query.trim()}%`)
        .query(`
          SELECT DISTINCT TOP 10 Bundle_Id 
          FROM dbo.Order_Po_Cut_Detail 
          WHERE Work_Order = @wo 
            AND CAST(Bundle_Id AS VARCHAR(50)) LIKE @q
          ORDER BY Bundle_Id
        `);

      const list = result.recordset.map((r) => String(r.Bundle_Id));
      return Response.json(list);
    }

    if (type === "operation") {
      const result = await pool
        .request()
        .input("wo", sql.NVarChar, wo.trim())
        .input("q", sql.NVarChar, `%${query.trim()}%`)
        .query(`
          SELECT DISTINCT TOP 10 Operation_Code, Operation_Name 
          FROM dbo.Order_StyleBulletin 
          WHERE Order_No = @wo 
            AND (Operation_Code LIKE @q OR Operation_Name LIKE @q)
          ORDER BY Operation_Code
        `);

      return Response.json(result.recordset);
    }

    return Response.json([]);
  } catch (err: unknown) {
    console.error("Suggestions API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
