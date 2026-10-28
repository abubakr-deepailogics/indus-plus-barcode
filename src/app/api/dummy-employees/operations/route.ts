import { getPool, sql, OPERATIONS_CATALOG_TABLE } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const department = (searchParams.get("department") || "").trim();
  const validDepartments = ["Sewing", "Washing", "Finishing"];
  if (!validDepartments.includes(department)) {
    return Response.json({ error: "Choose a valid department first." }, { status: 400 });
  }
  try {
    const result = await (await getPool("indusPlus")).request()
      .input("query", sql.NVarChar, `%${query}%`)
      .input("department", sql.NVarChar, department).query(`
      SELECT TOP 50 OperationCode AS operationCode, OperationName AS operationName, Department AS department
      FROM ${OPERATIONS_CATALOG_TABLE}
      WHERE Department = @department
        AND (OperationCode LIKE @query OR OperationName LIKE @query)
      ORDER BY OperationCode`);
    return Response.json(result.recordset);
  } catch (error) {
    console.error("ERP operation lookup failed:", error);
    return Response.json({ error: "Could not load ERP operations." }, { status: 500 });
  }
}
