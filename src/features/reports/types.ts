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
  isWageCalculated?: boolean;
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

  // Wage calculation flag
  allWagesCalculated?: boolean;
  uncalculatedCouponsCount?: number;

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

// ── Wages ────────────────────────────────────────────────────────────────────
// One operation-grouped row — same columns as the Employees breakdown tab.
export interface WageRow {
  employeeCode: string;
  employeeName?: string | null;
  workOrder?: string | null;
  workDate?: string | null;
  operation?: string | null;
  rate?: number | null;
  bundleCount: number;
  qty: number;
  totalPay: number;
}

// A wage batch header plus its detail rows, returned by GET /api/wages.
export interface WagesBatch {
  WageId: number;
  FromDate?: string | null;
  ToDate?: string | null;
  TotalRows: number;
  TotalQty: number;
  TotalAmount: number;
  CreatedBy?: string | null;
  CreatedAt: string;
  rows: WageRow[];
}

// ── Finance reports (Order Wise / Operator Wise) ────────────────────────────
// Mirrors two legacy Azgard-9 finance printouts ("Order Wise Finishing
// Payment (Audit)" and "Operator Wise Final Payment"). Both are always
// scoped to the current pay-cycle month (24th → 23rd, see
// currentPayCycleStart in db.ts) — there is no date-range picker for these,
// unlike the rest of the Reports page.
//
// Order Wise is currently scoped to the Sewing department only (a
// deliberate first pass — see DEPARTMENT_FILTER in
// finance-report.service.ts). Op Inc is sourced from Indus Plus
// StyleBullettinInt.[UD_Commission]. Production-line assignment still has
// no source data here. Previous Paid / Current Claim are both scan-derived
// (not from the wage ledger) — see finance-report.service.ts for the exact
// per-column formulas.
export interface OrderWiseReportRow {
  workOrder: string; // ANL# in the legacy printout
  totalSam: number | null; // per-garment SMV summed across the order's Sewing operations (style bulletin, not scan-scoped)
  totalRate: number | null; // per-garment piece rate summed across the order's Sewing operations
  washQty: number | null; // the order's overall cut quantity (cut-detail snapshot) — legacy column name, NOT department-scoped
  plan: number | null; // totalRate * washQty — total price to finish the whole order
  previousPaid: number; // sum(qty * rate) for this WO's Sewing coupons scanned during LAST pay-cycle
  currentClaim: number; // sum(qty * rate) for this WO's Sewing coupons scanned during THIS pay-cycle
  totalClaim: number; // previousPaid + currentClaim
  balance: number | null; // plan - totalClaim (null when plan is null, i.e. no order quantity on record)
  opInc: number; // sum(qty * UD_Commission) for the report's scanned Sewing coupons
  total: number; // totalClaim + opInc
  minutesProduced: number; // totalSam (order-level) * qtyProduced — NOT sum(qty * smv) per scan
  qtyProduced: number; // sum(qty) for this WO's Sewing coupons scanned during THIS pay-cycle
}

// Also currently scoped to the Sewing department only — same first-pass
// reasoning as OrderWiseReportRow above.
export interface OperatorWiseReportRow {
  employeeCode: string;
  employeeName: string;
  section: string; // HRMS DepartmentName — closest available analogue to the legacy "Section :" grouping (see service for caveats)
  joiningDate: string | null; // HRMS JoiningDate
  pieceRateTotal: number; // sum of piece rates across every Sewing-operation coupon scanned
  opInc: number; // sum of UD_Commission across every Sewing-operation coupon scanned
  total: number; // pieceRateTotal + opInc
}

export interface FinanceReportPeriod {
  from: string; // yyyy-MM-dd, the 24th of this pay-cycle's start month
  to: string; // yyyy-MM-dd, today
}

export interface OrderWiseReportResult {
  period: FinanceReportPeriod;
  rows: OrderWiseReportRow[];
}

export interface OperatorWiseReportResult {
  period: FinanceReportPeriod;
  rows: OperatorWiseReportRow[];
}
