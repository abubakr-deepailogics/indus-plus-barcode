import { getPool, CUT_DETAIL_VIEW, CUT_DETAIL_COLUMNS_SQL } from "@/lib/db";

export async function GET() {
  const pool = await getPool("indusPlus");
  const result = await pool.request().query(`
    SELECT ${CUT_DETAIL_COLUMNS_SQL}
    FROM ${CUT_DETAIL_VIEW}
  `);
  return Response.json(result.recordset);
}
