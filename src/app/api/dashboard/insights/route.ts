import { getPool, sql } from "@/lib/db";
import type {
  DashboardActivity,
  DashboardDepartment,
  DashboardInsights,
  DepartmentInsight,
  WorkOrderInsight,
} from "@/features/dashboard/types";

export const dynamic = "force-dynamic";

const DEPARTMENTS: DashboardDepartment[] = ["sewing", "washing", "finishing"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type DbRow = Record<string, unknown>;

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

function dateValue(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function isDepartment(value: unknown): value is DashboardDepartment {
  return typeof value === "string" && DEPARTMENTS.includes(value as DashboardDepartment);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const hasValidDates = DATE_PATTERN.test(from)
    && DATE_PATTERN.test(to)
    && !Number.isNaN(fromDate.getTime())
    && !Number.isNaN(toDate.getTime())
    && fromDate.toISOString().slice(0, 10) === from
    && toDate.toISOString().slice(0, 10) === to;

  if (!hasValidDates || from > to) {
    return Response.json({ error: "A valid date range is required." }, { status: 400 });
  }

  const rangeDays = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000);
  if (rangeDays > 365) {
    return Response.json({ error: "The dashboard date range cannot exceed 366 days." }, { status: 400 });
  }

  try {
    const pool = await getPool("pitSystem");
    const result = await pool
      .request()
      .input("from", sql.Date, from)
      .input("to", sql.Date, to)
      .query(`
        DECLARE @rangeEnd DATETIME2 = DATEADD(day, 1, CAST(@to AS DATETIME2));

        -- All cards, department output, pipeline, and work-order rows use
        -- exactly this coupon population: coupons generated in the chosen range.
        SELECT
          COUNT(*) AS GeneratedCoupons,
          SUM(CASE WHEN IsScanned = 1 THEN 1 ELSE 0 END) AS ScannedCoupons,
          SUM(CASE WHEN IsScanned = 0 THEN 1 ELSE 0 END) AS PendingCoupons,
          COUNT(DISTINCT WorkOrder) AS ActiveWorkOrders
        FROM dbo.QrCode_Coupon
        WHERE IsDeleted = 0
          AND Department IN ('sewing', 'washing', 'finishing')
          AND InsertedAt >= @from
          AND InsertedAt < @rangeEnd;

        SELECT
          Department,
          COUNT(*) AS GeneratedCoupons,
          SUM(CASE WHEN IsScanned = 1 THEN 1 ELSE 0 END) AS ScannedCoupons,
          SUM(CASE WHEN IsScanned = 0 THEN 1 ELSE 0 END) AS PendingCoupons,
          COUNT(DISTINCT WorkOrder) AS ActiveWorkOrders
        FROM dbo.QrCode_Coupon
        WHERE IsDeleted = 0
          AND Department IN ('sewing', 'washing', 'finishing')
          AND InsertedAt >= @from
          AND InsertedAt < @rangeEnd
        GROUP BY Department;

        SELECT COUNT(*) AS CompletedWorkOrders
        FROM (
          SELECT Department, WorkOrder
          FROM dbo.QrCode_Coupon
          WHERE IsDeleted = 0
            AND Department IN ('sewing', 'washing', 'finishing')
            AND InsertedAt >= @from
            AND InsertedAt < @rangeEnd
          GROUP BY Department, WorkOrder
          HAVING SUM(CASE WHEN IsScanned = 0 THEN 1 ELSE 0 END) = 0
        ) AS completed;

        -- The graph intentionally measures scan events, not current coupon state.
        WITH Dates AS (
          SELECT CAST(@from AS DATE) AS ScanDate
          UNION ALL
          SELECT DATEADD(day, 1, ScanDate)
          FROM Dates
          WHERE ScanDate < CAST(@to AS DATE)
        )
        SELECT
          Dates.ScanDate,
          SUM(CASE WHEN coupons.Department = 'sewing' THEN 1 ELSE 0 END) AS Sewing,
          SUM(CASE WHEN coupons.Department = 'washing' THEN 1 ELSE 0 END) AS Washing,
          SUM(CASE WHEN coupons.Department = 'finishing' THEN 1 ELSE 0 END) AS Finishing
        FROM Dates
        LEFT JOIN dbo.QrCode_Coupon AS coupons
          ON coupons.IsDeleted = 0
          AND coupons.IsScanned = 1
          AND coupons.Department IN ('sewing', 'washing', 'finishing')
          AND coupons.ScannedAt >= Dates.ScanDate
          AND coupons.ScannedAt < DATEADD(day, 1, Dates.ScanDate)
        GROUP BY Dates.ScanDate
        ORDER BY Dates.ScanDate
        OPTION (MAXRECURSION 366);

        SELECT TOP (6)
          Department,
          WorkOrder,
          COUNT(*) AS GeneratedCoupons,
          SUM(CASE WHEN IsScanned = 1 THEN 1 ELSE 0 END) AS ScannedCoupons,
          SUM(CASE WHEN IsScanned = 0 THEN 1 ELSE 0 END) AS PendingCoupons
        FROM dbo.QrCode_Coupon
        WHERE IsDeleted = 0
          AND Department IN ('sewing', 'washing', 'finishing')
          AND InsertedAt >= @from
          AND InsertedAt < @rangeEnd
        GROUP BY Department, WorkOrder
        ORDER BY SUM(CASE WHEN IsScanned = 1 THEN 1 ELSE 0 END) DESC, WorkOrder;

        -- Both kinds of activity are restricted to the selected range.
        WITH Activities AS (
          SELECT
            CONCAT('generation-', Department, '-', WorkOrder) AS Id,
            'generation' AS ActivityType,
            Department,
            WorkOrder,
            COUNT(*) AS CouponCount,
            MAX(InsertedAt) AS OccurredAt
          FROM dbo.QrCode_Coupon
          WHERE IsDeleted = 0
            AND Department IN ('sewing', 'washing', 'finishing')
            AND InsertedAt >= @from
            AND InsertedAt < @rangeEnd
          GROUP BY Department, WorkOrder

          UNION ALL

          SELECT
            CONCAT('scan-', Id) AS Id,
            'scan' AS ActivityType,
            Department,
            WorkOrder,
            NULL AS CouponCount,
            ScannedAt AS OccurredAt
          FROM dbo.QrCode_Coupon
          WHERE IsDeleted = 0
            AND IsScanned = 1
            AND Department IN ('sewing', 'washing', 'finishing')
            AND ScannedAt >= @from
            AND ScannedAt < @rangeEnd
        )
        SELECT TOP (6) Id, ActivityType, Department, WorkOrder, CouponCount, OccurredAt
        FROM Activities
        ORDER BY OccurredAt DESC;
      `);

    const [totals = [], departmentRows = [], completedRows = [], dailyRows = [], workOrderRows = [], activityRows = []] = result.recordsets as DbRow[][];
    const totalsRow = totals[0] ?? {};
    const generatedCoupons = numberValue(totalsRow.GeneratedCoupons);
    const scannedCoupons = numberValue(totalsRow.ScannedCoupons);

    const departments: DepartmentInsight[] = DEPARTMENTS.map((department) => {
      const row = departmentRows.find((item) => item.Department === department) ?? {};
      const generated = numberValue(row.GeneratedCoupons);
      const scanned = numberValue(row.ScannedCoupons);

      return {
        department,
        generatedCoupons: generated,
        scannedCoupons: scanned,
        pendingCoupons: numberValue(row.PendingCoupons),
        activeWorkOrders: numberValue(row.ActiveWorkOrders),
        completionRate: generated === 0 ? 0 : Math.round((scanned / generated) * 100),
      };
    });

    const workOrders: WorkOrderInsight[] = workOrderRows.flatMap((row) => {
      if (!isDepartment(row.Department)) return [];
      const generated = numberValue(row.GeneratedCoupons);
      const scanned = numberValue(row.ScannedCoupons);

      return [{
        department: row.Department,
        workOrder: String(row.WorkOrder ?? ""),
        generatedCoupons: generated,
        scannedCoupons: scanned,
        pendingCoupons: numberValue(row.PendingCoupons),
        completionRate: generated === 0 ? 0 : Math.round((scanned / generated) * 100),
      }];
    });

    const recentActivities: DashboardActivity[] = activityRows.flatMap((row) => {
      if (!isDepartment(row.Department) || (row.ActivityType !== "scan" && row.ActivityType !== "generation")) return [];

      return [{
        id: String(row.Id),
        type: row.ActivityType,
        department: row.Department,
        workOrder: String(row.WorkOrder ?? ""),
        couponCount: row.CouponCount == null ? undefined : numberValue(row.CouponCount),
        occurredAt: dateValue(row.OccurredAt),
      }];
    });

    const data: DashboardInsights = {
      generatedCoupons,
      scannedCoupons,
      pendingCoupons: numberValue(totalsRow.PendingCoupons),
      activeWorkOrders: numberValue(totalsRow.ActiveWorkOrders),
      completedWorkOrders: numberValue(completedRows[0]?.CompletedWorkOrders),
      // Kept for compatibility with consumers. These are scans in the selected tenure.
      todayScans: scannedCoupons,
      yesterdayScans: 0,
      monthScans: scannedCoupons,
      completionRate: generatedCoupons === 0 ? 0 : Math.round((scannedCoupons / generatedCoupons) * 100),
      departments,
      dailyOutput: dailyRows.map((row) => ({
        date: dateValue(row.ScanDate),
        sewing: numberValue(row.Sewing),
        washing: numberValue(row.Washing),
        finishing: numberValue(row.Finishing),
      })),
      workOrders,
      recentActivities,
    };

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to load dashboard insights." },
      { status: 500 },
    );
  }
}
