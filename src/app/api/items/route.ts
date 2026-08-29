import { getPool } from "@/lib/db";

export async function GET() {
  const pool = await getPool("indusPlus");
  const result = await pool
    .request()
    .query("SELECT * FROM dbo.SaleOrderPOCutDetailViewV1");
  return Response.json(result.recordset);
}
