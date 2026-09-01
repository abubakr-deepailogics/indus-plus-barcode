import { getPool, sql, ATTENDANCE_VIEW } from "@/lib/db";

export const dynamic = "force-dynamic";

// Was this employee present on the given date, per HRMS's attendance/punch
// view? Presence is "a row exists for this EmployeeID on this date" — the
// view has no present/absent flag, and a row's CheckInTime or CheckOutTime
// can individually be null (a missed punch) without the day being absent,
// so this deliberately doesn't require either column to be non-null.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";
  const date = searchParams.get("date") || "";

  const codeNum = parseInt(code, 10);
  if (!code || isNaN(codeNum)) {
    return Response.json(
      { error: "A valid employee code is required." },
      { status: 400 },
    );
  }
  if (!date) {
    return Response.json({ error: "A date is required." }, { status: 400 });
  }

  try {
    const pool = await getPool("hrms");
    const result = await pool
      .request()
      .input("code", sql.Int, codeNum)
      .input("date", sql.Date, date)
      .query(`
        SELECT TOP 1 EmployeeID
        FROM ${ATTENDANCE_VIEW}
        WHERE EmployeeID = @code
          AND (CAST(ShiftInDate AS DATE) = @date OR CAST(ShiftOutDate AS DATE) = @date)
      `);

    return Response.json({ present: result.recordset.length > 0 });
  } catch (err: unknown) {
    console.error("Attendance check error:", err);
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return Response.json({ error: msg }, { status: 500 });
  }
}