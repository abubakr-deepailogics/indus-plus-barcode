import type { EmployeeBreakdownItem } from "@/features/reports/types";

// ── Employee grouping ────────────────────────────────────────────────────────
// One grouped operation entry — per (workOrder, date, operation, rate) for a
// single employee. Shared by the report's Employees breakdown tab and by wage
// row building, which is why it lives here rather than in the dashboard.
export interface EmployeeGroupedItem {
  workOrder: string;
  date: string;
  operation: string;
  rate: number | null;
  bundleCount: number;
  qty: number;
  totalPay: number;
}

export interface EmployeeGrouped {
  employeeCode: EmployeeBreakdownItem["employeeCode"];
  employeeName: EmployeeBreakdownItem["employeeName"];
  items: EmployeeGroupedItem[];
  totalBundles: number;
  totalQty: number;
  totalPay: number;
}

// ── Wage rows / batches ──────────────────────────────────────────────────────
// One operation-grouped row as persisted in dbo.EmployeeWageRows.
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
  Title: string;
  FromDate: string;
  ToDate: string;
  TotalRows: number;
  TotalQty: number;
  TotalAmount: number;
  CreatedBy?: string | null;
  CreatedAt: string;
  rows: WageRow[];
}

// What the create-wages modal shows before locking a tenure. Both an order
// count and a coupon count — an order spans many coupons, and you want to see
// both before committing.
export interface WagePreview {
  orderCount: number;
  couponCount: number;
  employeeCount: number;
  totalQty: number;
  totalAmount: number;
}

// A tenure already covered by a wage — scanning is locked inside it.
export interface LockedRange {
  wageId: number;
  title: string;
  from: string; // yyyy-MM-dd
  to: string; // yyyy-MM-dd
}
