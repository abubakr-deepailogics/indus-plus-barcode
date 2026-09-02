export interface EmployeeReportInfo {
  EmployeeID: number | string;
  FirstName?: string;
  DesignationName?: string;
  ParentDepartment?: string;
  DepartmentName?: string;
}

export interface EmployeeReportSummary {
  employee: EmployeeReportInfo;
  totalCoupons: number;
  totalWorkOrders: number;
  totalAmount: number;
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
