export interface ScanningRow {
  index: number;
  barCode: string;
  anlCode: string;
  cutNo: string;
  category: string; // [A,B,C]
  bundleNo: string;
  qty: string;
  inseam: string;
  sizeCode: string;
  sectionCode: string;
  sectionName: string;
  oprCode: string;
  operationName: string;
  skillCode: string;
  smv: string;
  rate: string;
  value: string;
  scanDate?: string;
  scanned?: boolean;
}

export interface Worker {
  EmployeeID: number | string;
  FirstName?: string;
  ParentDepartment?: string;
  DepartmentName?: string;
  DesignationName?: string;
  AlreadyDailyScan?: number;
  AlreadyMonthlyScan?: number;
}

export interface OperationSuggestion {
  Operation_Code: string;
  Operation_Name: string;
}

// Shape returned by /api/coupons/scan and /api/coupons/suggestions for a
// single coupon row (fetch/scan responses).
export interface CouponApiItem {
  CouponCode?: string;
  WorkOrder?: string;
  CutNo?: string | number;
  Category?: string;
  BundleNo?: string;
  Qty?: string | number;
  Inseam?: string | number;
  SizeCode?: string | number;
  SectionCode?: string;
  SectionName?: string;
  OprCode?: string;
  OperationName?: string;
  SkillCode?: string | number;
  Smv?: string | number;
  Rate?: string | number;
  Value?: string | number;
  ScannedAt?: string;
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function makeEmptyRow(index: number): ScanningRow {
  return {
    index,
    barCode: "",
    anlCode: "",
    cutNo: "",
    category: "",
    bundleNo: "",
    qty: "",
    inseam: "",
    sizeCode: "",
    sectionCode: "",
    sectionName: "",
    oprCode: "",
    operationName: "",
    skillCode: "",
    smv: "",
    rate: "",
    value: "",
    scanDate: "",
  };
}

// Maps a raw API coupon item onto row fields (everything except `index`,
// `scanDate` and `scanned`, which callers set based on context).
export function couponItemToRow(
  item: CouponApiItem,
): Omit<ScanningRow, "index" | "scanDate" | "scanned"> {
  return {
    barCode: item.CouponCode || "",
    anlCode: item.WorkOrder || "",
    cutNo: String(item.CutNo ?? ""),
    category: item.Category || "",
    bundleNo: item.BundleNo || "",
    qty: String(item.Qty ?? ""),
    inseam: String(item.Inseam ?? ""),
    sizeCode: String(item.SizeCode ?? ""),
    sectionCode: item.SectionCode || "",
    sectionName: item.SectionName || "",
    oprCode: item.OprCode || "",
    operationName: item.OperationName || "",
    skillCode: String(item.SkillCode ?? ""),
    smv: String(item.Smv ?? ""),
    rate: String(item.Rate ?? ""),
    value: String(item.Value ?? ""),
  };
}
