export interface OperationsDetailRow {
  id: number;
  section: string;
  seqNo: string;
  opNo: string;
  operationName: string;
  smv: string;
  rate: string;
  skills: string;
  lastOpSection: boolean;
  inc?: string;
  sdl?: string;
}

export interface BundleDetailRow {
  id: number;
  transId?: string;
  cutNo: string;
  char?: string;
  line: string;
  bundleNo: string;
  inseam: string;
  size: string;
  pcs: number;
  sel: boolean;
  code: string;
  rPcs?: string;
}

export interface QrCodeStyleData {
  workOrder: string;
  saleOrderNo: string;
  customer: string;
  styleCode: string;
  generateBy: string;
  generateDatetime: string;
  totalWash: string;
  generatedCoupons: string;
  balance: string;
  generatedBundle: string;
  notes: string;
  remarks: string;
  reworkQtyMain: string;
  reworkQtyBundle: string;
  subTotal: string;
  total: string;
  operations: OperationsDetailRow[];
  bundles: BundleDetailRow[];
}

export interface PageSetupConfig {
  size: string;
  source: string;
  orientation: string;
  margins: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  gridFormat: string;
  layout: CouponLayout;
}

// How operation boundaries interact with the coupon grid's rows/pages:
// - "same-page": ops share pages, but each op always starts a fresh row.
// - "same-line": ops pack densely, an op can start mid-row right after
//   the previous op's last card (today's plain behavior).
// - "different-pages": every op starts on a fresh page.
export type CouponLayout = "same-page" | "same-line" | "different-pages";

export interface QrCodeCardProps {
  pageIndex: number;
  totalPages: number;
  styleCode: string;
  workOrder: string;
  bundle: BundleDetailRow;
  op: OperationsDetailRow;
}
