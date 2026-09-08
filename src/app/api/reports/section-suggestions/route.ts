import { getPool, STYLE_BULLETIN_TABLE } from "@/lib/db";

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

  try {
    const indusPool = await getPool("indusPlus");
    const result = await indusPool.request().query(`
      SELECT DISTINCT Section
      FROM ${STYLE_BULLETIN_TABLE}
      WHERE Section IS NOT NULL AND Section <> ''
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
