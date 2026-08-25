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

// Margins (cm) for real Legal stock. Callers that don't pass margins
// explicitly (e.g. the coupon-tracing reprint route) still need to land
// on the real printable area, not a theoretical centered guess.
// Shifted 2mm right (+left/-right) and 1mm up (-top/+bottom) from the
// theoretical centering to correct for print-driver drift observed on
// actual sheets — the grid math centers correctly, but the physical
// printout was landing 2mm left / 1mm low of centered.
export const DEFAULT_MARGINS = {
  top: 1.6,
  bottom: 0.8,
  left: 0.6,
  right: 0.65,
};

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
  codeType?: "qr" | "barcode";
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
