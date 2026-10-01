import { getPool, sql } from "@/lib/db";
import { isCouponDepartment } from "@/lib/department-classification";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const department = (searchParams.get("department") || "sewing").trim().toLowerCase();
  if (!isCouponDepartment(department)) return Response.json({ error: "Invalid department." }, { status: 400 });

  try {
    const pool = await getPool("pitSystem");
    const req = pool.request();
    req.input("department", sql.NVarChar, department);

    let where = "WHERE Department = @department";
    if (query) {
      const likeSafe = query.replace(/[%_[\]]/g, (c) => `[${c}]`);
      req.input("query", sql.NVarChar, `%${likeSafe}%`);
      where += " AND Title LIKE @query";
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
