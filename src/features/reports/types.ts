export interface EmployeeReportInfo {
  EmployeeID: number | string;
  FirstName?: string;
  DesignationName?: string;
  ParentDepartment?: string;
  DepartmentName?: string;
}

export interface OperationReportItem {
  operationCode: string;
  operationName: string;
  section: string;
  rate: number | null;
  smv: number | null;
  couponCount: number;
  totalQty: number;
  totalSam: number;
  totalAmount: number;
}

export interface WorkOrderReportItem {
  workOrder: string;
  couponCount: number;
  totalQty: number;
  totalSam: number;
  totalAmount: number;
  operationsCount: number;
}

export interface CouponReportItem {
  couponCode: string;
  workOrder: string;
  bundleNo: string;
  cutNo?: string | null;
  qty?: number | null;
  size?: string | null;
  inseam?: string | null;
  section?: string | null;
  operationCode?: string | null;
  operationName?: string | null;
  smv?: number | null;
  rate?: number | null;
  value?: number | null;
  scannedAt?: string | null;
}

export interface EmployeeReportSummary {
  employee: EmployeeReportInfo;

  // Banner Quick Stats
  todayScans: number;
  monthScans: number;
  primarySection?: string | null;

  // Coupons Scanned Card
  totalCoupons: number;
  lastScannedCoupon?: string | null;
  lastScannedAt?: string | null;

  // Work Orders Card
  totalWorkOrders: number;
  recentWorkOrder?: string | null;
  recentCutNo?: string | null;
  recentBundleNo?: string | null;
  recentOperationName?: string | null;
  recentOperationCode?: string | null;

  // Total Amount Card
  totalAmount: number;
  totalQty: number;
  totalSam: number;
  avgRatePerPiece: number;

  // Detailed Breakdowns
  operations: OperationReportItem[];
  workOrders: WorkOrderReportItem[];
  coupons: CouponReportItem[];
}

// Inclusive on both ends; either end left undefined means "open" (all-time
// on that side).
export interface ReportDateRange {
  from?: Date;
  to?: Date;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
