import { getPool, sql } from "@/lib/db";
import { isCouponDepartment } from "@/lib/department-classification";

export const dynamic = "force-dynamic";

// GET /api/reports/section-suggestions?query=<text>
//
// Distinct section names from the style bulletin (indusPlus), for the
// reports page's "search by section" field — same source
// operation-suggestions reads Operation Code/Name from, just the Section
// column instead. Filtered/sorted in JS, same pattern as the other
// suggestion endpoints in this folder.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("query") || "").trim().toLowerCase();
  const department = (searchParams.get("department") || "sewing").trim().toLowerCase();
  if (!isCouponDepartment(department)) return Response.json({ error: "Invalid department." }, { status: 400 });

  try {
    const pitPool = await getPool("pitSystem");
    const result = await pitPool.request().input("department", sql.NVarChar, department).query(`
      SELECT DISTINCT Section
      FROM dbo.QrCode_Coupon
      WHERE Department = @department AND IsDeleted = 0 AND Section IS NOT NULL AND Section <> ''
    `);
    const sections = result.recordset
      .map((r) => String(r.Section))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 12);

    return Response.json(sections);
  } catch (err: unknown) {
    console.error("Section suggestions API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
