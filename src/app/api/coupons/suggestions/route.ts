import { getPool, sql } from "@/lib/db";

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
    // ponytail: cross-DB — this route queries QrCode_Coupon (pit-system)
    // for "only_generated" branches and SaleOrderPOCutDetailViewV1/
    // StyleBulletinInt (indus-plus) for the rest, on one shared pool.
    // Left on pit-system's pool; split per-DB if/when these move to
    // separate servers.
    const pool = await getPool("pitSystem");

    if (type === "bundle") {
      if (onlyGenerated) {
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

      const result = await pool
        .request()
        .input("wo", sql.NVarChar, wo.trim())
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT DISTINCT TOP 10 Bundle_Id 
          FROM dbo.SaleOrderPOCutDetailViewV1 
          WHERE Work_Order = @wo 
            AND CAST(Bundle_Id AS VARCHAR(50)) LIKE @q
          ORDER BY Bundle_Id
        `);

      const list = result.recordset.map((r) => String(r.Bundle_Id));
      return Response.json(list);
    }

    if (type === "operation") {
      if (onlyGenerated) {
        const result = await pool
          .request()
          .input("wo", sql.NVarChar, wo.trim())
          .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
            SELECT DISTINCT TOP 10 c.OpNo AS Operation_Code, sb.Operation_Name
            FROM dbo.QrCode_Coupon c
            OUTER APPLY (
              SELECT TOP 1 sb.Operation_Name
              FROM dbo.StyleBulletinInt sb
              WHERE sb.Order_No = c.WorkOrder AND sb.Operation_Code = c.OpNo
            ) sb
            WHERE c.WorkOrder = @wo
              AND (c.OpNo LIKE @q OR sb.Operation_Name LIKE @q)
            ORDER BY c.OpNo
          `);
        return Response.json(result.recordset);
      }

      const result = await pool
        .request()
        .input("wo", sql.NVarChar, wo.trim())
        .input("q", sql.NVarChar, `%${query.trim()}%`).query(`
          SELECT DISTINCT TOP 10 Operation_Code, Operation_Name
          FROM dbo.StyleBulletinInt
          WHERE Order_No = @wo
            AND (Operation_Code LIKE @q OR Operation_Name LIKE @q)
          ORDER BY Operation_Code
        `);

      return Response.json(result.recordset);
    }

    if (type === "section") {
      // Sourced from QrCode_Coupon (not StyleBulletinInt) — Section is
      // whatever was recorded on the coupon at generation time, so the
      // filter's options always match what's actually in this work order's
      // coupons rather than the full style bulletin's section list.
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
