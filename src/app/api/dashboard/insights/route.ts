import { getPool, sql } from "@/lib/db";
import { isCouponDepartment } from "@/lib/department-classification";
import type { DashboardActivity, DashboardDepartment, DashboardInsights } from "@/features/dashboard/types";

export const dynamic = "force-dynamic";

type DashboardSummaryRow = {
  GeneratedCoupons: number;
  ScannedCoupons: number;
  PendingCoupons: number;
  ActiveWorkOrders: number;
  TodayScans: number;
  YesterdayScans: number;
  MonthScans: number;
};

type DashboardActivityRow = {
  Id: string;
  Type: DashboardActivity["type"];
  WorkOrder: string;
  CouponCode: string | null;
  CouponCount: number | null;
  OccurredAt: Date | string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const department = (searchParams.get("department") || "sewing").trim().toLowerCase();

  if (!isCouponDepartment(department) || department === "cutting") {
    return Response.json({ error: "Invalid department." }, { status: 400 });
  }

  try {
    const pool = await getPool("pitSystem");
    const result = await pool.request()
      .input("department", sql.NVarChar, department)
      .query(`
        DECLARE @today DATE = CAST(GETDATE() AS DATE);

        SELECT
          COUNT(*) AS GeneratedCoupons,
          COALESCE(SUM(CASE WHEN IsScanned = 1 THEN 1 ELSE 0 END), 0) AS ScannedCoupons,
          COALESCE(SUM(CASE WHEN IsScanned = 0 THEN 1 ELSE 0 END), 0) AS PendingCoupons,
          COUNT(DISTINCT WorkOrder) AS ActiveWorkOrders,
          COALESCE(SUM(CASE WHEN IsScanned = 1 AND ScannedAt >= @today THEN 1 ELSE 0 END), 0) AS TodayScans,
          COALESCE(SUM(CASE WHEN IsScanned = 1 AND ScannedAt >= DATEADD(day, -1, @today) AND ScannedAt < @today THEN 1 ELSE 0 END), 0) AS YesterdayScans,
          COALESCE(SUM(CASE WHEN IsScanned = 1 AND ScannedAt >= DATEFROMPARTS(YEAR(@today), MONTH(@today), 1) THEN 1 ELSE 0 END), 0) AS MonthScans
        FROM dbo.QrCode_Coupon
        WHERE Department = @department AND IsDeleted = 0;

        WITH Events AS (
          SELECT TOP (6)
            CONCAT('scan:', CouponCode) AS Id,
            'scan' AS Type,
            WorkOrder,
            CouponCode,
            CAST(NULL AS INT) AS CouponCount,
            COALESCE(SystemScannedAt, ScannedAt) AS OccurredAt
          FROM dbo.QrCode_Coupon
          WHERE Department = @department
            AND IsDeleted = 0
            AND IsScanned = 1
            AND COALESCE(SystemScannedAt, ScannedAt) IS NOT NULL
          ORDER BY COALESCE(SystemScannedAt, ScannedAt) DESC
        ),
        Generations AS (
          SELECT TOP (6)
            CONCAT('generation:', COALESCE(CONVERT(NVARCHAR(36), Id), CouponCode)) AS Id,
            'generation' AS Type,
            MAX(WorkOrder) AS WorkOrder,
            CAST(NULL AS NVARCHAR(200)) AS CouponCode,
            COUNT(*) AS CouponCount,
            MAX(InsertedAt) AS OccurredAt
          FROM dbo.QrCode_Coupon
          WHERE Department = @department AND IsDeleted = 0
          GROUP BY COALESCE(CONVERT(NVARCHAR(36), Id), CouponCode)
          ORDER BY MAX(InsertedAt) DESC
        )
        SELECT TOP (6) Id, Type, WorkOrder, CouponCode, CouponCount, OccurredAt
        FROM (
          SELECT * FROM Events
          UNION ALL
          SELECT * FROM Generations
        ) AS Recent
        ORDER BY OccurredAt DESC;
      `);

    // This SQL batch deliberately returns exactly two result sets. mssql's
    // general `recordsets` type also permits a keyed object, so narrow it
    // locally to the known tuple before indexing either result set.
    const [summaryRows, activityRows] = result.recordsets as unknown as [
      DashboardSummaryRow[],
      DashboardActivityRow[],
    ];
    const summary = summaryRows[0];
    const generatedCoupons = Number(summary?.GeneratedCoupons) || 0;
    const scannedCoupons = Number(summary?.ScannedCoupons) || 0;
    const insights: DashboardInsights = {
      department: department as DashboardDepartment,
      generatedCoupons,
      scannedCoupons,
      pendingCoupons: Number(summary?.PendingCoupons) || 0,
      activeWorkOrders: Number(summary?.ActiveWorkOrders) || 0,
      todayScans: Number(summary?.TodayScans) || 0,
      yesterdayScans: Number(summary?.YesterdayScans) || 0,
      monthScans: Number(summary?.MonthScans) || 0,
      completionRate: generatedCoupons === 0 ? 0 : Math.round((scannedCoupons / generatedCoupons) * 100),
      recentActivities: activityRows.map((activity) => ({
        id: activity.Id,
        type: activity.Type,
        workOrder: activity.WorkOrder,
        couponCode: activity.CouponCode || undefined,
        couponCount: activity.CouponCount ?? undefined,
        occurredAt: new Date(activity.OccurredAt).toISOString(),
      })),
    };
    return Response.json(insights);
  } catch (error: unknown) {
    console.error("Dashboard insights error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return Response.json({ error: message }, { status: 500 });
  }
}
