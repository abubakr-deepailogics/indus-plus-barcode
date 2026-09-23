import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();

  try {
    const pool = await getPool("pitSystem");
    const req = pool.request();

    let where = "";
    if (query) {
      const likeSafe = query.replace(/[%_[\]]/g, (c) => `[${c}]`);
      req.input("query", sql.NVarChar, `%${likeSafe}%`);
      where = "WHERE Title LIKE @query";
    }

    const result = await req.query(`
      SELECT DISTINCT TOP 10 Title
      FROM dbo.EmployeeWages
      ${where}
      ORDER BY Title
    `);

    return Response.json(result.recordset.map((r) => String(r.Title)));
  } catch (err: unknown) {
    console.error("GET /api/wages/suggestions error:", err);
    return Response.json([], { status: 200 });
  }
}
