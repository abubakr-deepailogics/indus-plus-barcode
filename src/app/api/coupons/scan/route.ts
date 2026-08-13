import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode") || "";
  const wo = searchParams.get("wo") || "";
  const bundle = searchParams.get("bundle") || "";
  const op = searchParams.get("op") || "";

  if (!wo) {
    return Response.json(
      { error: "Work Order is required in the header before scanning." },
      { status: 400 }
    );
  }

  if (!barcode && !bundle) {
    return Response.json(
      { error: "Either Barcode or Bundle No is required to scan." },
      { status: 400 }
    );
  }

  try {
    const pool = await getPool();

    // Optimize execution plan by running distinct lookup logic depending on whether barcode is provided.
    // This avoids slow OR queries which prevent index seeks on index tables.
    const queryStr = barcode.trim() !== "" 
      ? `
        SELECT 
            c.CouponCode,
            c.WorkOrder,
            c.BundleNo,
            c.OpNo,
            c.IsScanned,
            d.Inseam,
            d.Size AS SizeCode,
            d.Cut AS CutNo,
            d.Shade AS Category,
            d.Bundle_Qty AS Qty,
            s.Section AS SectionCode,
            s.Section AS SectionName,
            s.Operation_Code AS OprCode,
            s.Operation_Name AS OperationName,
            o.SkillLevel AS SkillCode,
            s.Smv_Sam AS Smv,
            s.Piece_Rate AS Rate,
            (d.Bundle_Qty * s.Piece_Rate) AS Value
        FROM dbo.QrCode_Coupon c WITH (NOLOCK)
        OUTER APPLY (
            SELECT TOP 1 *
            FROM dbo.Order_Po_Cut_Detail cd WITH (NOLOCK)
            WHERE cd.Work_Order = c.WorkOrder 
              AND cd.Bundle_Id = TRY_CAST(c.BundleNo AS INT)
            ORDER BY cd.RowId
        ) d
        OUTER APPLY (
            SELECT TOP 1 *
            FROM dbo.Order_StyleBulletin sb WITH (NOLOCK)
            WHERE sb.Order_No = c.WorkOrder 
              AND sb.Operation_Code = c.OpNo
            ORDER BY sb.RowId
        ) s
        LEFT JOIN dbo.Operations o WITH (NOLOCK)
            ON o.OperationCode = s.Operation_Code
        WHERE c.CouponCode = @barcode 
          AND c.WorkOrder = @wo
      `
      : `
        SELECT 
            c.CouponCode,
            c.WorkOrder,
            c.BundleNo,
            c.OpNo,
            c.IsScanned,
            d.Inseam,
            d.Size AS SizeCode,
            d.Cut AS CutNo,
            d.Shade AS Category,
            d.Bundle_Qty AS Qty,
            s.Section AS SectionCode,
            s.Section AS SectionName,
            s.Operation_Code AS OprCode,
            s.Operation_Name AS OperationName,
            o.SkillLevel AS SkillCode,
            s.Smv_Sam AS Smv,
            s.Piece_Rate AS Rate,
            (d.Bundle_Qty * s.Piece_Rate) AS Value
        FROM dbo.QrCode_Coupon c WITH (NOLOCK)
        OUTER APPLY (
            SELECT TOP 1 *
            FROM dbo.Order_Po_Cut_Detail cd WITH (NOLOCK)
            WHERE cd.Work_Order = c.WorkOrder 
              AND cd.Bundle_Id = TRY_CAST(c.BundleNo AS INT)
            ORDER BY cd.RowId
        ) d
        OUTER APPLY (
            SELECT TOP 1 *
            FROM dbo.Order_StyleBulletin sb WITH (NOLOCK)
            WHERE sb.Order_No = c.WorkOrder 
              AND sb.Operation_Code = c.OpNo
            ORDER BY sb.RowId
        ) s
        LEFT JOIN dbo.Operations o WITH (NOLOCK)
            ON o.OperationCode = s.Operation_Code
        WHERE c.WorkOrder = @wo
          AND c.BundleNo = @bundle 
          AND (@op = '' OR c.OpNo = @op)
      `;

    const result = await pool
      .request()
      .input("barcode", sql.NVarChar, barcode.trim())
      .input("wo", sql.NVarChar, wo.trim())
      .input("bundle", sql.NVarChar, bundle.trim())
      .input("op", sql.NVarChar, op.trim())
      .query(queryStr);

    const records = result.recordset;

    if (records.length === 0) {
      return Response.json(
        { error: "No matching coupon code found in the database." },
        { status: 404 }
      );
    }

    if (barcode) {
      const match = records[0];
      if (match.IsScanned) {
        return Response.json(
          { error: "This coupon barcode has already been scanned!" },
          { status: 400 }
        );
      }

      // Mark coupon as scanned in the database in a single query
      await pool
        .request()
        .input("barcode", sql.NVarChar, barcode.trim())
        .query(`UPDATE dbo.QrCode_Coupon SET IsScanned = 1 WHERE CouponCode = @barcode`);

      return Response.json(records);
    }

    // If scanning via selection components (WorkOrder / Bundle)
    const unscanned = records.filter((r) => !r.IsScanned);

    if (unscanned.length === 0) {
      return Response.json(
        { error: "All matching coupons for this selection have already been scanned!" },
        { status: 400 }
      );
    }

    // Mark all matched coupons as scanned in a single bulk query (avoiding loop)
    await pool
      .request()
      .input("wo", sql.NVarChar, wo.trim())
      .input("bundle", sql.NVarChar, bundle.trim())
      .input("op", sql.NVarChar, op.trim())
      .query(`
        UPDATE dbo.QrCode_Coupon 
        SET IsScanned = 1 
        WHERE WorkOrder = @wo 
          AND BundleNo = @bundle 
          AND (@op = '' OR OpNo = @op)
          AND IsScanned = 0
      `);

    return Response.json(unscanned);
  } catch (err: unknown) {
    console.error("Coupon scan validation error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
