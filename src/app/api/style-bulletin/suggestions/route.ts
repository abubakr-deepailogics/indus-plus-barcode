import {
  getPool,
  OPERATIONS_CATALOG_TABLE,
  sql,
  STYLE_BULLETIN_TABLE,
} from "@/lib/db";
import { isStyleBulletinDepartment } from "@/lib/department-classification";

// Style Bulletin's own Work Order autocomplete — queries StyleBullettinInt's
// [Order No] column directly instead of piggybacking on Cut Report's
// SaleOrderPOCutDetailViewV1 (see /api/open-order/suggestions), so a work
// order only present in the style bulletin table still autocompletes here.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const department = (searchParams.get("department") || "sewing")
    .trim()
    .toLowerCase();

  if (!isStyleBulletinDepartment(department)) {
    return Response.json({ error: "Invalid department." }, { status: 400 });
  }

  try {
    const pool = await getPool("indusPlus");

    if (query.length < 2) {
      const result = await pool.request()
        .input("department", sql.NVarChar, department).query(`
        SELECT DISTINCT TOP 12 [Order No] AS Order_No
        FROM ${STYLE_BULLETIN_TABLE} sb
        INNER JOIN ${OPERATIONS_CATALOG_TABLE} op
          ON sb.[Operation Code] = op.OperationCode
        WHERE sb.[Order No] IS NOT NULL AND sb.[Order No] <> ''
          AND LOWER(ISNULL(op.Department, '')) = @department
        ORDER BY Order_No DESC
      `);
      return Response.json(result.recordset.map((r) => r.Order_No));
    }

    const result = await pool
      .request()
      .input("q", sql.NVarChar, `%${query}%`)
      .input("department", sql.NVarChar, department).query(`
        SELECT DISTINCT TOP 8 [Order No] AS Order_No
        FROM ${STYLE_BULLETIN_TABLE} sb
        INNER JOIN ${OPERATIONS_CATALOG_TABLE} op
          ON sb.[Operation Code] = op.OperationCode
        WHERE sb.[Order No] LIKE @q
          AND LOWER(ISNULL(op.Department, '')) = @department
        ORDER BY Order_No
      `);

    return Response.json(result.recordset.map((r) => r.Order_No));
  } catch (err: unknown) {
    console.error("Style bulletin suggestions API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
