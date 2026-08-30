import { getPool, sql, CUT_DETAIL_VIEW, STYLE_BULLETIN_TABLE } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wo = searchParams.get("wo") || "";
  const type = searchParams.get("type") || ""; // 'bundle' or 'operation'
  const query = searchParams.get("query") || "";
  const onlyGenerated = searchParams.get("only_generated") === "true";

  if (!wo) {
    return Response.json(
      { error: "Work Order parameter is required." },
      { status: 400 },
    );
  }

  try {
    // Cross-server: QrCode_Coupon lives on pitSystem; SaleOrderPOCutDetailViewV1/
    // StyleBullettinInt live on indusPlus — different SQL Server instances,
    // so each branch below queries its own pool rather than sharing one,
    // and the two "only_generated" branches that need both sides fetch them
    // separately and merge in JS instead of joining across servers.
    if (type === "bundle") {
      if (onlyGenerated) {
        const pool = await getPool("pitSystem");
        const result = await pool
          .request()
          .input("wo", sql.NVarChar, wo.trim())
          .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
            SELECT DISTINCT TOP 10 BundleNo
            FROM dbo.QrCode_Coupon
            WHERE WorkOrder = @wo
              AND BundleNo LIKE @q
            ORDER BY BundleNo
          `);
        const list = result.recordset.map((r) => String(r.BundleNo));
        return Response.json(list);
      }

      const pool = await getPool("indusPlus");
      const result = await pool
        .request()
        .input("wo", sql.NVarChar, wo.trim())
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT DISTINCT TOP 10 [Bundle Id] AS Bundle_Id
          FROM ${CUT_DETAIL_VIEW}
          WHERE [Work Order #] = @wo
            AND CAST([Bundle Id] AS VARCHAR(50)) LIKE @q
          ORDER BY Bundle_Id
        `);

      const list = result.recordset.map((r) => String(r.Bundle_Id));
      return Response.json(list);
    }

    if (type === "operation") {
      if (onlyGenerated) {
        const q = query.trim().toLowerCase();
        const [couponOps, opNames] = await Promise.all([
          (await getPool("pitSystem"))
            .request()
            .input("wo", sql.NVarChar, wo.trim())
            .query(`SELECT DISTINCT OpNo FROM dbo.QrCode_Coupon WHERE WorkOrder = @wo`),
          (await getPool("indusPlus"))
            .request()
            .input("wo", sql.NVarChar, wo.trim())
            .query(`
              SELECT DISTINCT [Operation Code] AS Operation_Code, [Operation Name] AS Operation_Name
              FROM ${STYLE_BULLETIN_TABLE}
              WHERE [Order No] = @wo
            `),
        ]);
        const nameByOpNo = new Map(
          opNames.recordset.map((r) => [r.Operation_Code as string, r.Operation_Name as string]),
        );
        const suggestions = couponOps.recordset
          .map((r) => {
            const opNo = r.OpNo as string;
            return { Operation_Code: opNo, Operation_Name: nameByOpNo.get(opNo) ?? null };
          })
          .filter(
            (r) =>
              !q ||
              r.Operation_Code.toLowerCase().includes(q) ||
              r.Operation_Name?.toLowerCase().includes(q),
          )
          .sort((a, b) => a.Operation_Code.localeCompare(b.Operation_Code))
          .slice(0, 10);
        return Response.json(suggestions);
      }

      const pool = await getPool("indusPlus");
      const result = await pool
        .request()
        .input("wo", sql.NVarChar, wo.trim())
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT DISTINCT TOP 10 [Operation Code] AS Operation_Code, [Operation Name] AS Operation_Name
          FROM ${STYLE_BULLETIN_TABLE}
          WHERE [Order No] = @wo
            AND ([Operation Code] LIKE @q OR [Operation Name] LIKE @q)
          ORDER BY Operation_Code
        `);

      return Response.json(result.recordset);
    }

    if (type === "section") {
      // Sourced from QrCode_Coupon (not the style bulletin) — Section is
      // whatever was recorded on the coupon at generation time, so the
      // filter's options always match what's actually in this work order's
      // coupons rather than the full style bulletin's section list.
      const pool = await getPool("pitSystem");
      const result = await pool.request().input("wo", sql.NVarChar, wo.trim())
        .query(`
          SELECT DISTINCT Section
          FROM dbo.QrCode_Coupon
          WHERE WorkOrder = @wo AND Section IS NOT NULL AND Section <> ''
          ORDER BY Section
        `);

      return Response.json(result.recordset.map((r) => r.Section as string));
    }

    if (type === "cut") {
      const pool = await getPool("pitSystem");
      const result = await pool
        .request()
        .input("wo", sql.NVarChar, wo.trim())
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT CutNo FROM (
            SELECT DISTINCT CutNo
            FROM dbo.QrCode_Coupon
            WHERE WorkOrder = @wo
              AND CutNo IS NOT NULL
              AND CutNo <> ''
              AND CutNo LIKE @q
          ) t
          ORDER BY TRY_CAST(CutNo AS INT), CutNo
        `);

      return Response.json(result.recordset.map((r) => String(r.CutNo)));
    }

    return Response.json([]);
  } catch (err: unknown) {
    console.error("Suggestions API error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
