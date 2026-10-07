export type DashboardDepartment = "sewing" | "washing" | "finishing";

export interface DepartmentInsight { department: DashboardDepartment; generatedCoupons: number; scannedCoupons: number; pendingCoupons: number; activeWorkOrders: number; completionRate: number; }
export interface DailyOutputInsight { date: string; sewing: number; washing: number; finishing: number; }
export interface WorkOrderInsight { department: DashboardDepartment; workOrder: string; generatedCoupons: number; scannedCoupons: number; pendingCoupons: number; completionRate: number; }
export interface DashboardActivity { id: string; type: "scan" | "generation"; department: DashboardDepartment; workOrder: string; couponCount?: number; occurredAt: string; }
export interface DashboardInsights {
  generatedCoupons: number; scannedCoupons: number; pendingCoupons: number; activeWorkOrders: number; todayScans: number; yesterdayScans: number; monthScans: number; completionRate: number;
  departments: DepartmentInsight[]; dailyOutput: DailyOutputInsight[]; workOrders: WorkOrderInsight[]; recentActivities: DashboardActivity[];
}
