import { getPool } from "@/lib/db";

export async function GET() {
  const pool = await getPool();
  const result = await pool
    .request()
    .query("SELECT * FROM dbo.Order_Po_Cut_Detail");
  return Response.json(result.recordset);
}
