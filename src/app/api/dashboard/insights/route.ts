import { getPool, sql } from "@/lib/db";
import type { DashboardInsights } from "@/features/dashboard/types";

export const dynamic = "force-dynamic";

type SummaryRow = { GeneratedCoupons: number; ScannedCoupons: number; PendingCoupons: number; ActiveWorkOrders: number; TodayScans: number; YesterdayScans: number; MonthScans: number };
type DepartmentRow = { Department: "sewing" | "washing" | "finishing"; GeneratedCoupons: number; ScannedCoupons: number; PendingCoupons: number; ActiveWorkOrders: number };
type DayRow = { ScanDate: Date | string; Sewing: number; Washing: number; Finishing: number };
type WorkOrderRow = Omit<DepartmentRow, "ActiveWorkOrders"> & { WorkOrder: string };
type ActivityRow = { Id: string; Type: "scan" | "generation"; Department: DepartmentRow["Department"]; WorkOrder: string; CouponCount: number | null; OccurredAt: Date | string };
const asNumber = (value: number | null | undefined) => Number(value) || 0;

export async function GET(request: Request) {
  const cycleStart = new URL(request.url).searchParams.get("cycleStart") || "";
  if (!/^\d{4}-(0[1-9]|1[0-2])-24$/.test(cycleStart)) {
    return Response.json({ error: "A valid pay-cycle start date (YYYY-MM-24) is required." }, { status: 400 });
  }
  const [year, monthNumber] = cycleStart.split("-").map(Number);
  const nextCycleStart = monthNumber === 12 ? `${year + 1}-01-24` : `${year}-${String(monthNumber + 1).padStart(2, "0")}-24`;
  try {
    const pool = await getPool("pitSystem");
    // One optimized round-trip for every dashboard panel; no per-card reads.
    const result = await pool.request().input("from", sql.Date, cycleStart).input("to", sql.Date, nextCycleStart).query(`
      DECLARE @today DATE = CAST(GETDATE() AS DATE); DECLARE @periodTo DATE = CASE WHEN @to > DATEADD(day,1,@today) THEN DATEADD(day,1,@today) ELSE @to END;
      SELECT COUNT(*) GeneratedCoupons,SUM(CASE WHEN IsScanned=1 THEN 1 ELSE 0 END) ScannedCoupons,SUM(CASE WHEN IsScanned=0 THEN 1 ELSE 0 END) PendingCoupons,COUNT(DISTINCT WorkOrder) ActiveWorkOrders,SUM(CASE WHEN IsScanned=1 AND ScannedAt>=@today THEN 1 ELSE 0 END) TodayScans,SUM(CASE WHEN IsScanned=1 AND ScannedAt>=DATEADD(day,-1,@today) AND ScannedAt<@today THEN 1 ELSE 0 END) YesterdayScans,SUM(CASE WHEN IsScanned=1 AND ScannedAt>=DATEFROMPARTS(YEAR(@today),MONTH(@today),1) THEN 1 ELSE 0 END) MonthScans FROM dbo.QrCode_Coupon WHERE Department IN ('sewing','washing','finishing') AND IsDeleted=0;
      SELECT Department,COUNT(*) GeneratedCoupons,SUM(CASE WHEN IsScanned=1 THEN 1 ELSE 0 END) ScannedCoupons,SUM(CASE WHEN IsScanned=0 THEN 1 ELSE 0 END) PendingCoupons,COUNT(DISTINCT WorkOrder) ActiveWorkOrders FROM dbo.QrCode_Coupon WHERE Department IN ('sewing','washing','finishing') AND IsDeleted=0 GROUP BY Department;
      WITH Days AS (SELECT @from ScanDate UNION ALL SELECT DATEADD(day,1,ScanDate) FROM Days WHERE ScanDate < DATEADD(day,-1,@periodTo)) SELECT d.ScanDate,SUM(CASE WHEN c.Department='sewing' THEN 1 ELSE 0 END) Sewing,SUM(CASE WHEN c.Department='washing' THEN 1 ELSE 0 END) Washing,SUM(CASE WHEN c.Department='finishing' THEN 1 ELSE 0 END) Finishing FROM Days d LEFT JOIN dbo.QrCode_Coupon c ON c.IsDeleted=0 AND c.IsScanned=1 AND c.Department IN ('sewing','washing','finishing') AND c.ScannedAt>=d.ScanDate AND c.ScannedAt<DATEADD(day,1,d.ScanDate) GROUP BY d.ScanDate ORDER BY d.ScanDate OPTION (MAXRECURSION 31);
      SELECT TOP(6) Department,WorkOrder,COUNT(*) GeneratedCoupons,SUM(CASE WHEN IsScanned=1 THEN 1 ELSE 0 END) ScannedCoupons,SUM(CASE WHEN IsScanned=0 THEN 1 ELSE 0 END) PendingCoupons FROM dbo.QrCode_Coupon WHERE Department IN ('sewing','washing','finishing') AND IsDeleted=0 GROUP BY Department,WorkOrder ORDER BY SUM(CASE WHEN IsScanned=0 THEN 1 ELSE 0 END) DESC,COUNT(*) DESC;
      WITH Scans AS (SELECT TOP(8) CONCAT('scan:',Department,':',CouponCode) Id,'scan' Type,Department,WorkOrder,CAST(NULL AS INT) CouponCount,COALESCE(SystemScannedAt,ScannedAt) OccurredAt FROM dbo.QrCode_Coupon WHERE Department IN ('sewing','washing','finishing') AND IsDeleted=0 AND IsScanned=1 AND COALESCE(SystemScannedAt,ScannedAt) IS NOT NULL ORDER BY COALESCE(SystemScannedAt,ScannedAt) DESC), Generations AS (SELECT TOP(8) CONCAT('generation:',Department,':',COALESCE(CONVERT(NVARCHAR(36),Id),CouponCode)) Id,'generation' Type,Department,MAX(WorkOrder) WorkOrder,COUNT(*) CouponCount,MAX(InsertedAt) OccurredAt FROM dbo.QrCode_Coupon WHERE Department IN ('sewing','washing','finishing') AND IsDeleted=0 GROUP BY Department,COALESCE(CONVERT(NVARCHAR(36),Id),CouponCode) ORDER BY MAX(InsertedAt) DESC) SELECT TOP(8) Id,Type,Department,WorkOrder,CouponCount,OccurredAt FROM (SELECT * FROM Scans UNION ALL SELECT * FROM Generations) Recent ORDER BY OccurredAt DESC;
    `);
    const [summaryRows, departmentRows, dayRows, workOrderRows, activityRows] = result.recordsets as unknown as [SummaryRow[], DepartmentRow[], DayRow[], WorkOrderRow[], ActivityRow[]];
    const summary = summaryRows[0]; const generatedCoupons = asNumber(summary?.GeneratedCoupons); const scannedCoupons = asNumber(summary?.ScannedCoupons);
    const departments = (["sewing","washing","finishing"] as const).map((department) => { const row = departmentRows.find((item) => item.Department === department); const generated = asNumber(row?.GeneratedCoupons); const scanned = asNumber(row?.ScannedCoupons); return { department, generatedCoupons: generated, scannedCoupons: scanned, pendingCoupons: asNumber(row?.PendingCoupons), activeWorkOrders: asNumber(row?.ActiveWorkOrders), completionRate: generated ? Math.round(scanned / generated * 100) : 0 }; });
    const data: DashboardInsights = { generatedCoupons, scannedCoupons, pendingCoupons: asNumber(summary?.PendingCoupons), activeWorkOrders: asNumber(summary?.ActiveWorkOrders), todayScans: asNumber(summary?.TodayScans), yesterdayScans: asNumber(summary?.YesterdayScans), monthScans: asNumber(summary?.MonthScans), completionRate: generatedCoupons ? Math.round(scannedCoupons / generatedCoupons * 100) : 0, departments, dailyOutput: dayRows.map((r) => ({ date: new Date(r.ScanDate).toISOString(), sewing: asNumber(r.Sewing), washing: asNumber(r.Washing), finishing: asNumber(r.Finishing) })), workOrders: workOrderRows.map((r) => ({ department: r.Department, workOrder: r.WorkOrder, generatedCoupons: asNumber(r.GeneratedCoupons), scannedCoupons: asNumber(r.ScannedCoupons), pendingCoupons: asNumber(r.PendingCoupons), completionRate: asNumber(r.GeneratedCoupons) ? Math.round(asNumber(r.ScannedCoupons) / asNumber(r.GeneratedCoupons) * 100) : 0 })), recentActivities: activityRows.map((r) => ({ id: r.Id, type: r.Type, department: r.Department, workOrder: r.WorkOrder, couponCount: r.CouponCount ?? undefined, occurredAt: new Date(r.OccurredAt).toISOString() })) };
    return Response.json(data);
  } catch (error: unknown) {
    console.error("Dashboard insights error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
