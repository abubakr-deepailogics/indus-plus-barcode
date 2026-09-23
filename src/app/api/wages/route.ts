import { getPool, sql } from "@/lib/db";
import {
  buildWageData,
  validateTenure,
} from "@/features/wages/services/wage-builder.service";
import { findOverlappingWage } from "@/features/wages/services/wage-lock.service";

export const dynamic = "force-dynamic";

// ── GET ──────────────────────────────────────────────────────────────────────
// ?wageId=<n>               → rows for a specific wage batch
// ?employeeCode=<code>      → wage batches covering that employee
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
            SELECT WageId, Title, FromDate, ToDate, TotalCoupons AS TotalRows,
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

      return Response.json({
        wages: [{ ...headerRes.recordset[0], rows: rowsRes.recordset.map(mapRow) }],
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
    // A batch is in scope when its tenure overlaps the requested window —
    // containment would hide a wage that merely straddles the range edge.
    if (from) {
      req.input("from", sql.Date, from);
      conditions.push("ToDate >= @from");
    }
    if (to) {
      req.input("to", sql.Date, to);
      conditions.push("FromDate <= @to");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const headersRes = await req.query(`
      SELECT TOP 50 WageId, Title, FromDate, ToDate, TotalCoupons AS TotalRows,
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
    const rowsByWageId = new Map<number, ReturnType<typeof mapRow>[]>();
    for (const row of rowsRes.recordset) {
      const wId = Number(row.WageId);
      if (!rowsByWageId.has(wId)) rowsByWageId.set(wId, []);
      rowsByWageId.get(wId)!.push(mapRow(row));
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
// Body: { title, from, to, createdBy? }
//
// The tenure is the whole scope: the server builds the wage rows itself from
// every scanned coupon in the range (no client-supplied rows, no filters), so
// what the confirm modal previewed is exactly what gets written. Scanning is
// then locked for the tenure — see wage-lock.service.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return Response.json({ error: "A wage title is required." }, { status: 400 });
    }
    if (title.length > 200) {
      return Response.json(
        { error: "Wage title must be 200 characters or fewer." },
        { status: 400 },
      );
    }

    const tenure = validateTenure(body?.from, body?.to);
    if (!tenure.ok) {
      return Response.json({ error: tenure.error }, { status: 400 });
    }
    const { from: fromDate, to: toDate } = tenure;

    const createdBy = body?.createdBy ? String(body.createdBy) : null;

    // A date may belong to only one wage — otherwise the same coupons get
    // paid twice and the lock can't say which wage owns the date.
    const overlap = await findOverlappingWage(fromDate, toDate);
    if (overlap) {
      return Response.json(
        {
          error: `This tenure overlaps wage "${overlap.title}" (${overlap.from} to ${overlap.to}). Delete that wage first or pick a different tenure.`,
        },
        { status: 409 },
      );
    }

    const built = await buildWageData(fromDate, toDate);
    if (!built.ok) {
      return Response.json({ error: built.error }, { status: built.status });
    }

    const { rows, preview } = built;
    if (rows.length === 0) {
      return Response.json(
        { error: "No scanned coupons found in this tenure — nothing to pay." },
        { status: 400 },
      );
    }

    const totalRows = rows.length;
    const pool = await getPool("pitSystem");

    // 1. Insert header
    const headerResult = await pool
      .request()
      .input("title", sql.NVarChar(200), title)
      .input("fromDate", sql.Date, fromDate)
      .input("toDate", sql.Date, toDate)
      .input("totalRows", sql.Int, totalRows)
      .input("totalQty", sql.Int, preview.totalQty)
      .input("totalAmount", sql.Decimal(18, 2), preview.totalAmount)
      .input("createdBy", sql.NVarChar, createdBy)
      .query(`
        INSERT INTO dbo.EmployeeWages
          (Title, FromDate, ToDate, TotalCoupons, TotalQty, TotalAmount, CreatedBy, CreatedAt)
        OUTPUT inserted.WageId
        VALUES (@title, @fromDate, @toDate, @totalRows, @totalQty, @totalAmount, @createdBy, GETDATE());
      `);

    const wageId = headerResult.recordset[0]?.WageId as number;
    if (!wageId) throw new Error("Failed to insert wage header.");

    // 2. Batch insert detail rows (up to 200 at a time — 9 params per row
    //    keeps this under SQL Server's ~2100 parameter cap).
    const BATCH = 200;
    for (let start = 0; start < rows.length; start += BATCH) {
      const batch = rows.slice(start, start + BATCH);
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

    // 3. Stamp WageId on every coupon in the tenure — the audit link of which
    //    wage paid a coupon, and what DELETE uses to unwind the batch. The
    //    scan lock itself is the tenure, not this column.
    await pool
      .request()
      .input("wageId", sql.Int, wageId)
      .input("fromDate", sql.Date, fromDate)
      .input("toDate", sql.Date, toDate)
      .query(`
        UPDATE dbo.QrCode_Coupon
        SET WageId = @wageId
        WHERE IsScanned = 1
          AND IsDeleted = 0
          AND ScannedAt >= @fromDate
          AND ScannedAt < DATEADD(day, 1, @toDate);
      `);

    return Response.json({
      ok: true,
      wageId,
      title,
      from: fromDate,
      to: toDate,
      totalRows,
      totalQty: preview.totalQty,
      totalAmount: preview.totalAmount,
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
// and clears WageId on its coupons, which reopens the tenure for scanning.
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

    // Clear coupon links first, then hard-delete (cascade handles rows table)
    const result = await pool
      .request()
      .input("wageId", sql.Int, wageId)
      .query(`
        UPDATE dbo.QrCode_Coupon
        SET WageId = NULL
        WHERE WageId = @wageId;

        DELETE FROM dbo.EmployeeWages WHERE WageId = @wageId;
        SELECT @@ROWCOUNT AS Deleted;
      `);

    const deleted = Number(result.recordset?.[0]?.Deleted ?? 0);
    if (deleted === 0) {
      return Response.json({ error: "Wage record not found." }, { status: 404 });
    }

    return Response.json({
      ok: true,
      message: `Wage batch #${wageId} deleted — scanning reopened for its tenure.`,
    });
  } catch (err: unknown) {
    console.error("DELETE /api/wages error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}

// Detail rows come back straight from SQL; normalise the numerics so the
// client never has to guard against mssql's decimal-as-string.
function mapRow(r: Record<string, unknown>) {
  return {
    employeeCode: String(r.employeeCode ?? ""),
    employeeName: (r.employeeName as string | null) ?? null,
    workOrder: (r.workOrder as string | null) ?? null,
    workDate: (r.workDate as string | null) ?? null,
    operation: (r.operation as string | null) ?? null,
    rate: r.rate != null ? Number(r.rate) : null,
    bundleCount: Number(r.bundleCount) || 0,
    qty: Number(r.qty) || 0,
    totalPay: Number(r.totalPay) || 0,
  };
}
