// The reports page can be searched by three different dimensions — an
// employee, a work order, or a (global, catalog-level) operation code — and
// every mode shows the same shape of dashboard (totals, breakdowns, coupon
// trail). `mode` discriminates which one is the search subject; the other
// two dimensions always show up as breakdown tables regardless of mode.
export type ReportSearchMode = "employee" | "workOrder" | "operation" | "section";

export interface EmployeeReportInfo {
  EmployeeID: number | string;
  FirstName?: string;
  DesignationName?: string;
  ParentDepartment?: string;
  DepartmentName?: string;
}

// What's being searched for, resolved against its canonical source (hrms for
// an employee, the cut detail view for a work order, the style bulletin for
// an operation) so a mistyped/nonexistent value 404s before any coupon data
// is queried.
// Each mode has an "all" sibling (mode kept the same, `all: true` instead of
// the resolved single subject) — everything downstream (coupon query,
// breakdowns, coupon trail) already keys off `mode`, so "all employees" /
// "all work orders" / "all operations" only need to flip this flag rather
// than becoming three more ReportSearchModes with their own branches
// everywhere.
export type ReportSubject =
  | { mode: "employee"; all?: false; employee: EmployeeReportInfo }
  | { mode: "employee"; all: true }
  | {
      mode: "workOrder";
      all?: false;
      workOrder: string;
      customerName?: string | null;
      saleOrderNo?: string | null;
      orderQty?: number | null;
    }
  | { mode: "workOrder"; all: true }
  | {
      mode: "operation";
      all?: false;
      operationCode: string;
      operationName?: string | null;
      department?: string | null;
      skillLevel?: string | null;
    }
  | { mode: "operation"; all: true }
  | { mode: "section"; all?: false; section: string; operationsCount: number }
  | { mode: "section"; all: true };

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

export interface SectionReportItem {
  section: string;
  couponCount: number;
  totalQty: number;
  totalSam: number;
  totalAmount: number;
  operationsCount: number;
}

export interface BundleReportItem {
  bundleNo: string;
  cutNo?: string | null;
  workOrder: string;
  couponCount: number;
  totalQty: number;
  totalSam: number;
  totalAmount: number;
}

export interface EmployeeBreakdownItem {
  employeeCode: string;
  employeeName: string;
  designation?: string | null;
  couponCount: number;
  totalQty: number;
  totalSam: number;
  totalAmount: number;
  operationsCount: number;
  workOrdersCount: number;
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
  employeeCode?: string | null;
  employeeName?: string | null;
  isWageCalculated?: boolean | null;
  wageId?: number | null;
}

export interface ReportSummary {
  subject: ReportSubject;

  // Banner Quick Stats
  todayScans: number;
  monthScans: number;
  primarySection?: string | null;

  // Coupons Scanned Card
  totalCoupons: number;
  lastScannedCoupon?: string | null;
  lastScannedAt?: string | null;

  // Wage status for current report scope
  isWageCalculated?: boolean;
  wageId?: number | null;
  wageCreatedAt?: string | null;

  // Coverage counts — whichever of these matches the search mode is always
  // 1 (searching a single employee/work order/operation); the other two are
  // the actually useful counts and drive the breakdown tabs.
  totalWorkOrders: number;
  totalEmployees: number;
  totalOperations: number;

  recentWorkOrder?: string | null;
  recentCutNo?: string | null;
  recentBundleNo?: string | null;
  recentOperationName?: string | null;
  recentOperationCode?: string | null;
  recentEmployeeCode?: string | null;
  recentEmployeeName?: string | null;

  // Total Amount Card
  totalAmount: number;
  totalQty: number;
  totalSam: number;
  avgRatePerPiece: number;

  // Detailed Breakdowns — always all three; the dashboard hides whichever
  // one is trivial (equal to the search subject itself).
  operations: OperationReportItem[];
  workOrders: WorkOrderReportItem[];
  employees: EmployeeBreakdownItem[];
  coupons: CouponReportItem[];

  // Extra breakdowns, only surfaced by the dashboard in Work Order mode
  // (per-section / per-bundle progress within the order) — always populated
  // here since they're free byproducts of the same aggregation pass.
  sections: SectionReportItem[];
  bundles: BundleReportItem[];
}

// Inclusive on both ends; either end left undefined means "open" (all-time
// on that side).
export interface ReportDateRange {
  from?: Date;
  to?: Date;
}

// Common shape the search Autocomplete renders regardless of mode — each
// mode's suggestion fetcher adapts its API's native shape into this.
export interface ReportSearchSuggestion {
  value: string;
  label: string;
  sublabel?: string;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
