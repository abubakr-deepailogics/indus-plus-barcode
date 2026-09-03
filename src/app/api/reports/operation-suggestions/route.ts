import { getPool, sql, STYLE_BULLETIN_TABLE } from "@/lib/db";

export const dynamic = "force-dynamic";

const IN_LIST_CHUNK_SIZE = 2000; // stays well under SQL Server's ~2100 parameter cap

// GET /api/reports/operation-suggestions?query=<text>
//
// Global operation-code lookup for the reports page's "search by operation"
// field — distinct from /api/coupons/suggestions?type=operation, which is
// scoped to a single work order's style bulletin. Sourced from coupons that
// have actually been scanned (pitSystem), so suggestions only ever surface
// operations with real report data behind them; names are then resolved
// from the style bulletin (indusPlus) and matched/filtered in JS, same
// pattern as the per-work-order variant's `only_generated` branch.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("query") || "").trim().toLowerCase();

  try {
    const pitPool = await getPool("pitSystem");
    const opNoResult = await pitPool.request().query(`
      SELECT DISTINCT OpNo FROM dbo.QrCode_Coupon
      WHERE IsScanned = 1 AND OpNo IS NOT NULL AND OpNo <> ''
    `);
    const opNos = opNoResult.recordset.map((r) => r.OpNo as string).filter(Boolean);
    if (opNos.length === 0) return Response.json([]);

    const indusPool = await getPool("indusPlus");
    const nameByCode = new Map<string, string | null>();
    for (let i = 0; i < opNos.length; i += IN_LIST_CHUNK_SIZE) {
      const batch = opNos.slice(i, i + IN_LIST_CHUNK_SIZE);
      const request2 = indusPool.request();
      const placeholders = batch.map((code, idx) => {
        request2.input(`op${idx}`, sql.NVarChar, code);
        return `@op${idx}`;
      });
      const nameResult = await request2.query(`
        SELECT DISTINCT [Operation Code] AS Operation_Code, [Operation Name] AS Operation_Name
        FROM ${STYLE_BULLETIN_TABLE}
        WHERE [Operation Code] IN (${placeholders.join(", ")})
      `);
      for (const row of nameResult.recordset) {
        if (!nameByCode.has(row.Operation_Code)) nameByCode.set(row.Operation_Code, row.Operation_Name ?? null);
      }
    }

    const suggestions = opNos
      .map((code) => ({ operationCode: code, operationName: nameByCode.get(code) ?? null }))
      .filter(
        (s) =>
          !q ||
          s.operationCode.toLowerCase().includes(q) ||
          s.operationName?.toLowerCase().includes(q),
      )
      .sort((a, b) => a.operationCode.localeCompare(b.operationCode))
      .slice(0, 12);

    return Response.json(suggestions);
  } catch (err: unknown) {
    console.error("Operation suggestions API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
