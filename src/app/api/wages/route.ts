import { getPool, sql } from "@/lib/db";
import { chunk } from "@/features/qr-code-generation/services/coupon-registration.service";

export const dynamic = "force-dynamic";

interface CouponPayloadItem {
  couponCode: string;
  qty?: number | null;
  rate?: number | null;
  amount?: number | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const employeeCode = searchParams.get("employeeCode") || "";
  const wageIdStr = searchParams.get("wageId") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  try {
    const pool = await getPool("pitSystem");

    if (wageIdStr) {
      const wageId = parseInt(wageIdStr, 10);
      if (isNaN(wageId)) {
        return Response.json({ error: "Invalid wageId." }, { status: 400 });
      }
      const wageRes = await pool
        .request()
        .input("wageId", sql.Int, wageId)
        .query(`
          SELECT WageId, EmployeeCode, FromDate, ToDate, TotalCoupons, TotalQty, TotalAmount, CreatedBy, CreatedAt
          FROM dbo.EmployeeWages
          WHERE WageId = @wageId
        `);
      if (wageRes.recordset.length === 0) {
        return Response.json({ error: "Wage record not found." }, { status: 404 });
      }
      return Response.json({ wage: wageRes.recordset[0] });
    }

    if (!employeeCode.trim()) {
      return Response.json(
        { error: "Employee code is required." },
        { status: 400 },
      );
    }

    const req = pool.request().input("empCode", sql.NVarChar, employeeCode.trim());
    const conditions = ["EmployeeCode = @empCode"];

    if (from) {
      req.input("from", sql.Date, from);
      conditions.push("(FromDate IS NULL OR FromDate >= @from)");
    }
    if (to) {
      req.input("to", sql.Date, to);
      conditions.push("(ToDate IS NULL OR ToDate <= @to)");
    }

    const result = await req.query(`
      SELECT TOP 100 WageId, EmployeeCode, FromDate, ToDate, TotalCoupons, TotalQty, TotalAmount, CreatedBy, CreatedAt
      FROM dbo.EmployeeWages
      WHERE ${conditions.join(" AND ")}
      ORDER BY CreatedAt DESC
    `);

    return Response.json({ wages: result.recordset });
  } catch (err: unknown) {
    console.error("GET /api/wages error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const employeeCode = String(body.employeeCode || "").trim();
    const fromDate = body.from ? String(body.from) : null;
    const toDate = body.to ? String(body.to) : null;
    const createdBy = body.createdBy ? String(body.createdBy) : null;
    const rawCoupons: CouponPayloadItem[] = Array.isArray(body.coupons) ? body.coupons : [];

    if (!employeeCode) {
      return Response.json(
        { error: "Employee code is required to create wages." },
        { status: 400 },
      );
    }

    if (rawCoupons.length === 0) {
      return Response.json(
        { error: "No coupons provided for wage calculation." },
        { status: 400 },
      );
    }

    const pool = await getPool("pitSystem");

    // Clean and validate coupon items
    const validCoupons = rawCoupons
      .filter((c) => c && typeof c.couponCode === "string" && c.couponCode.trim())
      .map((c) => ({
        couponCode: c.couponCode.trim(),
        qty: Number(c.qty) || 0,
        rate: Number(c.rate) || 0,
        amount: Number(c.amount) || (Number(c.qty) || 0) * (Number(c.rate) || 0),
      }));

    if (validCoupons.length === 0) {
      return Response.json(
        { error: "No valid coupon codes found in payload." },
        { status: 400 },
      );
    }

    const totalCoupons = validCoupons.length;
    const totalQty = validCoupons.reduce((sum, c) => sum + c.qty, 0);
    const totalAmount = validCoupons.reduce((sum, c) => sum + c.amount, 0);

    // 1. Insert header row in EmployeeWages
    const headerResult = await pool
      .request()
      .input("empCode", sql.NVarChar, employeeCode)
      .input("fromDate", sql.Date, fromDate)
      .input("toDate", sql.Date, toDate)
      .input("totalCoupons", sql.Int, totalCoupons)
      .input("totalQty", sql.Int, totalQty)
      .input("totalAmount", sql.Decimal(18, 2), totalAmount)
      .input("createdBy", sql.NVarChar, createdBy)
      .query(`
        INSERT INTO dbo.EmployeeWages (EmployeeCode, FromDate, ToDate, TotalCoupons, TotalQty, TotalAmount, CreatedBy, CreatedAt)
        OUTPUT inserted.WageId
        VALUES (@empCode, @fromDate, @toDate, @totalCoupons, @totalQty, @totalAmount, @createdBy, GETDATE());
      `);

    const wageId = headerResult.recordset[0]?.WageId as number;
    if (!wageId) {
      throw new Error("Failed to insert wage header record.");
    }

    // 2. Batch insert detail rows into EmployeeWageCoupons & Update QrCode_Coupon in chunks
    for (const batch of chunk(validCoupons, 500)) {
      const detailReq = pool.request();
      detailReq.input("wageId", sql.Int, wageId);
      detailReq.input("empCode", sql.NVarChar, employeeCode);

      const valuePlaceholders: string[] = [];
      const codePlaceholders: string[] = [];

      batch.forEach((c, i) => {
        detailReq.input(`code${i}`, sql.NVarChar, c.couponCode);
        detailReq.input(`qty${i}`, sql.Int, c.qty);
        detailReq.input(`rate${i}`, sql.Decimal(18, 4), c.rate);
        detailReq.input(`amt${i}`, sql.Decimal(18, 2), c.amount);

        valuePlaceholders.push(`(@wageId, @code${i}, @empCode, @qty${i}, @rate${i}, @amt${i})`);
        codePlaceholders.push(`@code${i}`);
      });

      await detailReq.query(`
        INSERT INTO dbo.EmployeeWageCoupons (WageId, CouponCode, EmployeeCode, Qty, Rate, Amount)
        VALUES ${valuePlaceholders.join(", ")};

        UPDATE dbo.QrCode_Coupon
        SET IsWageCalculated = 1,
            WageId = @wageId
        WHERE CouponCode IN (${codePlaceholders.join(", ")});
      `);
    }

    return Response.json({
      ok: true,
      wageId,
      totalCoupons,
      totalAmount,
      message: "Wages created and saved successfully.",
    });
  } catch (err: unknown) {
    console.error("POST /api/wages error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wageIdStr = searchParams.get("wageId");
    const employeeCode = searchParams.get("employeeCode");

    const pool = await getPool("pitSystem");

    if (wageIdStr) {
      const wageId = parseInt(wageIdStr, 10);
      if (isNaN(wageId)) {
        return Response.json({ error: "Invalid wageId parameter." }, { status: 400 });
      }

      // Clear flag on QrCode_Coupon for coupons linked to this WageId
      await pool
        .request()
        .input("wageId", sql.Int, wageId)
        .query(`
          UPDATE dbo.QrCode_Coupon
          SET IsWageCalculated = 0,
              WageId = NULL
          WHERE WageId = @wageId;

          DELETE FROM dbo.EmployeeWages
          WHERE WageId = @wageId;
        `);

      return Response.json({
        ok: true,
        message: `Wage record #${wageId} deleted successfully.`,
      });
    }

    if (employeeCode?.trim()) {
      const empCode = employeeCode.trim();
      const from = searchParams.get("from");
      const to = searchParams.get("to");

      const req = pool.request().input("empCode", sql.NVarChar, empCode);
      const conditions = ["EmployeeCode = @empCode"];
      if (from) {
        req.input("from", sql.Date, from);
        conditions.push("(FromDate IS NULL OR FromDate >= @from)");
      }
      if (to) {
        req.input("to", sql.Date, to);
        conditions.push("(ToDate IS NULL OR ToDate <= @to)");
      }

      // Find matching WageIds
      const findRes = await req.query(`
        SELECT WageId FROM dbo.EmployeeWages
        WHERE ${conditions.join(" AND ")}
      `);

      const wageIds = findRes.recordset.map((r) => Number(r.WageId));
      if (wageIds.length === 0) {
        // Also clear any coupons directly matching employeeCode if flagged
        const resetReq = pool.request().input("empCode", sql.NVarChar, empCode);
        if (from) resetReq.input("from", sql.Date, from);
        if (to) resetReq.input("to", sql.Date, to);

        const couponConds = ["EmployeeCode = @empCode", "IsWageCalculated = 1"];
        if (from) couponConds.push("ScannedAt >= @from");
        if (to) couponConds.push("ScannedAt < DATEADD(day, 1, @to)");

        await resetReq.query(`
          UPDATE dbo.QrCode_Coupon
          SET IsWageCalculated = 0,
              WageId = NULL
          WHERE ${couponConds.join(" AND ")};
        `);

        return Response.json({
          ok: true,
          message: "Cleared wage flags for matching coupons.",
        });
      }

      for (const wId of wageIds) {
        await pool
          .request()
          .input("wageId", sql.Int, wId)
          .query(`
            UPDATE dbo.QrCode_Coupon
            SET IsWageCalculated = 0,
                WageId = NULL
            WHERE WageId = @wageId;

            DELETE FROM dbo.EmployeeWages
            WHERE WageId = @wageId;
          `);
      }

      return Response.json({
        ok: true,
        message: `Deleted ${wageIds.length} wage record(s) for employee ${empCode}.`,
      });
    }

    return Response.json(
      { error: "Either wageId or employeeCode is required to delete wages." },
      { status: 400 },
    );
  } catch (err: unknown) {
    console.error("DELETE /api/wages error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
