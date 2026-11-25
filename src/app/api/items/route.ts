import { getPool, CUT_DETAIL_VIEW, CUT_DETAIL_COLUMNS_SQL } from "@/lib/db";
import { withRoute } from "@/lib/logger/with-route";

export const GET = withRoute("/api/items", async function GET() {
  const pool = await getPool("indusPlus");
  const result = await pool.request().query(`
    SELECT ${CUT_DETAIL_COLUMNS_SQL}
    FROM ${CUT_DETAIL_VIEW}
  `);
  return Response.json(result.recordset);
});
