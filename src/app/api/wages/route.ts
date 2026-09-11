import { getPool, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// One row per grouped operation entry — same shape as the Employees tab table
// in the report UI (EmpCode, EmployeeName, W/O, Date, Operation, Rate,
// BundleCount, Qty, TotalPay).
interface WageRowPayload {
  employeeCode: string;
  employeeName?: string | null;
  workOrder?: string | null;
  workDate?: string | null;
  operation?: string | null;
  rate?: number | null;
  bundleCount?: number | null;
  qty?: number | null;
  totalPay?: number | null;
}

// ── GET ──────────────────────────────────────────────────────────────────────
// ?wageId=<n>               → rows for a specific wage batch
// ?employeeCode=<code>      → most-recent wage batch for that employee
//   &from=yyyy-MM-dd &to=yyyy-MM-dd  (optional date filters)
// ?from=<d> &to=<d>         → all wage batches in the date range
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const wageIdStr = searchParams.get("wageId") || "";
  const employeeCode = searchParams.get("employeeCode") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  try {
    const pool = await getPool("pitSystem");

    // Fetch a specific wage batch by ID
    if (wageIdStr) {
      const wageId = parseInt(wageIdStr, 10);
      if (isNaN(wageId)) {
        return Response.json({ error: "Invalid wageId." }, { status: 400 });
      }

      const [headerRes, rowsRes] = await Promise.all([
        pool
          .request()
          .input("wageId", sql.Int, wageId)
          .query(`
            SELECT WageId, FromDate, ToDate, TotalCoupons AS TotalRows,
                   TotalQty, TotalAmount, CreatedBy, CreatedAt
            FROM dbo.EmployeeWages
            WHERE WageId = @wageId
          `),
        pool
          .request()
          .input("wageId", sql.Int, wageId)
          .query(`
            SELECT EmployeeCode AS employeeCode, EmployeeName AS employeeName,
                   WorkOrder AS workOrder, WorkDate AS workDate,
                   Operation AS operation, Rate AS rate,
                   BundleCount AS bundleCount, Qty AS qty, TotalPay AS totalPay
            FROM dbo.EmployeeWageRows
            WHERE WageId = @wageId
            ORDER BY EmployeeCode, WorkDate, WorkOrder, Operation
          `),
      ]);

      if (headerRes.recordset.length === 0) {
        return Response.json({ error: "Wage record not found." }, { status: 404 });
      }

      const rows = rowsRes.recordset.map((r) => ({
        employeeCode: String(r.employeeCode ?? ""),
        employeeName: r.employeeName ?? null,
        workOrder: r.workOrder ?? null,
        workDate: r.workDate ?? null,
        operation: r.operation ?? null,
        rate: r.rate != null ? Number(r.rate) : null,
        bundleCount: Number(r.bundleCount) || 0,
        qty: Number(r.qty) || 0,
        totalPay: Number(r.totalPay) || 0,
      }));

      return Response.json({
        wages: [{ ...headerRes.recordset[0], rows }],
      });
    }

    // Build header conditions
    const req = pool.request();
    const conditions: string[] = [];

    if (employeeCode.trim()) {
      req.input("empCode", sql.NVarChar, employeeCode.trim());
      // Filter: this wage batch covers at least one row for this employee
      conditions.push(`WageId IN (
        SELECT DISTINCT WageId FROM dbo.EmployeeWageRows WHERE EmployeeCode = @empCode
      )`);
    }
    if (from) {
      req.input("from", sql.Date, from);
      conditions.push("(FromDate IS NULL OR FromDate >= @from)");
    }
    if (to) {
      req.input("to", sql.Date, to);
      conditions.push("(ToDate IS NULL OR ToDate <= @to)");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const headersRes = await req.query(`
      SELECT TOP 50 WageId, FromDate, ToDate, TotalCoupons AS TotalRows,
             TotalQty, TotalAmount, CreatedBy, CreatedAt
      FROM dbo.EmployeeWages
      ${where}
      ORDER BY CreatedAt DESC
    `);

    if (headersRes.recordset.length === 0) {
      return Response.json({ wages: [] });
    }

    const wageIds: number[] = headersRes.recordset.map((r) => Number(r.WageId));
    const placeholders = wageIds.map((id, i) => {
      req.input(`wId${i}`, sql.Int, id);
      return `@wId${i}`;
    });

    const rowsRes = await req.query(`
      SELECT WageId, EmployeeCode AS employeeCode, EmployeeName AS employeeName,
             WorkOrder AS workOrder, WorkDate AS workDate,
             Operation AS operation, Rate AS rate,
             BundleCount AS bundleCount, Qty AS qty, TotalPay AS totalPay
      FROM dbo.EmployeeWageRows
      WHERE WageId IN (${placeholders.join(", ")})
      ORDER BY WageId, EmployeeCode, WorkDate, WorkOrder, Operation
    `);

    // Group rows under each header
    const rowsByWageId = new Map<number, any[]>();
    for (const row of rowsRes.recordset) {
      const wId = Number(row.WageId);
      if (!rowsByWageId.has(wId)) rowsByWageId.set(wId, []);
      rowsByWageId.get(wId)!.push({
        employeeCode: String(row.employeeCode ?? ""),
        employeeName: row.employeeName ?? null,
        workOrder: row.workOrder ?? null,
        workDate: row.workDate ?? null,
        operation: row.operation ?? null,
        rate: row.rate != null ? Number(row.rate) : null,
        bundleCount: Number(row.bundleCount) || 0,
        qty: Number(row.qty) || 0,
        totalPay: Number(row.totalPay) || 0,
      });
    }

    const wages = headersRes.recordset.map((h) => ({
      ...h,
      rows: rowsByWageId.get(Number(h.WageId)) ?? [],
    }));

    return Response.json({ wages });
  } catch (err: unknown) {
    console.error("GET /api/wages error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────
// Body: { from?, to?, createdBy?, rows: WageRowPayload[] }
// Inserts a wage batch header + operation-wise rows, then marks all
// QrCode_Coupon rows for the involved employee codes + date range as
// IsWageCalculated = 1.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fromDate: string | null = body.from ? String(body.from) : null;
    const toDate: string | null = body.to ? String(body.to) : null;
    const createdBy: string | null = body.createdBy ? String(body.createdBy) : null;
    const rawRows: WageRowPayload[] = Array.isArray(body.rows) ? body.rows : [];

    if (rawRows.length === 0) {
      return Response.json(
        { error: "No wage rows provided." },
        { status: 400 },
      );
    }

    const validRows = rawRows
      .filter((r) => r && typeof r.employeeCode === "string" && r.employeeCode.trim())
      .map((r) => ({
        employeeCode: r.employeeCode.trim(),
        employeeName: r.employeeName ? String(r.employeeName) : null,
        workOrder: r.workOrder ? String(r.workOrder) : null,
        workDate: r.workDate ? String(r.workDate) : null,
        operation: r.operation ? String(r.operation) : null,
        rate: r.rate != null ? Number(r.rate) : null,
        bundleCount: Number(r.bundleCount) || 0,
        qty: Number(r.qty) || 0,
        totalPay: Number(r.totalPay) || 0,
      }));

    if (validRows.length === 0) {
      return Response.json(
        { error: "No valid wage rows found in payload." },
        { status: 400 },
      );
    }

    const totalRows = validRows.length;
    const totalQty = validRows.reduce((s, r) => s + r.qty, 0);
    const totalAmount = validRows.reduce((s, r) => s + r.totalPay, 0);
    const employeeCodes = [...new Set(validRows.map((r) => r.employeeCode))];

    const pool = await getPool("pitSystem");

    // 1. Insert header
    const headerResult = await pool
      .request()
      .input("fromDate", sql.Date, fromDate)
      .input("toDate", sql.Date, toDate)
      .input("totalRows", sql.Int, totalRows)
      .input("totalQty", sql.Int, totalQty)
      .input("totalAmount", sql.Decimal(18, 2), totalAmount)
      .input("createdBy", sql.NVarChar, createdBy)
      .query(`
        INSERT INTO dbo.EmployeeWages
          (FromDate, ToDate, EmployeeCode, TotalCoupons, TotalQty, TotalAmount, CreatedBy, CreatedAt)
        OUTPUT inserted.WageId
        VALUES (@fromDate, @toDate, '', @totalRows, @totalQty, @totalAmount, @createdBy, GETDATE());
      `);

    const wageId = headerResult.recordset[0]?.WageId as number;
    if (!wageId) throw new Error("Failed to insert wage header.");

    // 2. Batch insert detail rows (up to 500 at a time to stay under param cap)
    const BATCH = 500;
    for (let start = 0; start < validRows.length; start += BATCH) {
      const batch = validRows.slice(start, start + BATCH);
      const detailReq = pool.request().input("wageId", sql.Int, wageId);
      const values: string[] = [];

      batch.forEach((r, i) => {
        detailReq.input(`ec${i}`, sql.NVarChar, r.employeeCode);
        detailReq.input(`en${i}`, sql.NVarChar, r.employeeName);
        detailReq.input(`wo${i}`, sql.NVarChar, r.workOrder);
        detailReq.input(`wd${i}`, sql.NVarChar, r.workDate);
        detailReq.input(`op${i}`, sql.NVarChar, r.operation);
        detailReq.input(`rt${i}`, sql.Decimal(18, 4), r.rate);
        detailReq.input(`bc${i}`, sql.Int, r.bundleCount);
        detailReq.input(`qt${i}`, sql.Int, r.qty);
        detailReq.input(`tp${i}`, sql.Decimal(18, 2), r.totalPay);
        values.push(
          `(@wageId, @ec${i}, @en${i}, @wo${i}, @wd${i}, @op${i}, @rt${i}, @bc${i}, @qt${i}, @tp${i})`,
        );
      });

      await detailReq.query(`
        INSERT INTO dbo.EmployeeWageRows
          (WageId, EmployeeCode, EmployeeName, WorkOrder, WorkDate,
           Operation, Rate, BundleCount, Qty, TotalPay)
        VALUES ${values.join(", ")};
      `);
    }

    // 3. Mark matching QrCode_Coupon rows as wage-calculated
    const markReq = pool.request().input("wageId", sql.Int, wageId);
    const empPlaceholders = employeeCodes.map((code, i) => {
      markReq.input(`emp${i}`, sql.NVarChar, code);
      return `@emp${i}`;
    });

    const dateConds: string[] = [];
    if (fromDate) {
      markReq.input("fromDate", sql.Date, fromDate);
      dateConds.push("ScannedAt >= @fromDate");
    }
    if (toDate) {
      markReq.input("toDate", sql.Date, toDate);
      dateConds.push("ScannedAt < DATEADD(day, 1, @toDate)");
    }

    const couponWhere = [
      `EmployeeCode IN (${empPlaceholders.join(", ")})`,
      "IsScanned = 1",
      "IsDeleted = 0",
      ...dateConds,
    ].join(" AND ");

    await markReq.query(`
      UPDATE dbo.QrCode_Coupon
      SET IsWageCalculated = 1, WageId = @wageId
      WHERE ${couponWhere};
    `);

    return Response.json({
      ok: true,
      wageId,
      totalRows,
      totalQty,
      totalAmount,
      message: "Wages created successfully.",
    });
  } catch (err: unknown) {
    console.error("POST /api/wages error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

// ── DELETE ───────────────────────────────────────────────────────────────────
// ?wageId=<n>  — hard-deletes the wage batch (cascade removes EmployeeWageRows)
// and resets IsWageCalculated = 0 on all linked QrCode_Coupon rows.
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const wageIdStr = searchParams.get("wageId") || "";

  if (!wageIdStr) {
    return Response.json(
      { error: "wageId query param is required." },
      { status: 400 },
    );
  }

  const wageId = parseInt(wageIdStr, 10);
  if (isNaN(wageId)) {
    return Response.json({ error: "Invalid wageId." }, { status: 400 });
  }

  try {
    const pool = await getPool("pitSystem");

    // Reset coupon flags first, then hard-delete (cascade handles rows table)
    await pool
      .request()
      .input("wageId", sql.Int, wageId)
      .query(`
        UPDATE dbo.QrCode_Coupon
        SET IsWageCalculated = 0, WageId = NULL
        WHERE WageId = @wageId;

        DELETE FROM dbo.EmployeeWages WHERE WageId = @wageId;
      `);

    return Response.json({
      ok: true,
      message: `Wage batch #${wageId} deleted and coupon flags reset.`,
    });
  } catch (err: unknown) {
    console.error("DELETE /api/wages error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
