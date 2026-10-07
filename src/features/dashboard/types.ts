export type DashboardDepartment = "sewing" | "washing" | "finishing" | "gdp";

export interface DashboardActivity {
  id: string;
  type: "scan" | "generation";
  workOrder: string;
  couponCode?: string;
  couponCount?: number;
  occurredAt: string;
}

export interface DashboardInsights {
  department: DashboardDepartment;
  generatedCoupons: number;
  scannedCoupons: number;
  pendingCoupons: number;
  activeWorkOrders: number;
  todayScans: number;
  yesterdayScans: number;
  monthScans: number;
  completionRate: number;
  recentActivities: DashboardActivity[];
}
