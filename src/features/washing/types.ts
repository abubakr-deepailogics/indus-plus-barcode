export interface WashingCutRow {
  id: number;
  /** Database primary key after the row has been saved. */
  recordId?: number;
  /** Generated on "Generate Coupon(s)" click matching sewing pattern (e.g. 0067610001); empty before generation */
  bundleId: string;
  /** Cut number — manually entered, required */
  cut: string;
  /** Bundle quantity — manually entered, required (cannot exceed Order Qty) */
  bundleQty: string;
  /** Inseam — manually entered, optional */
  inseam: string;
  /** Size — manually entered, optional */
  size: string;
}

export interface WashingOrderMetadata {
  workOrder: string;
  saleOrderNo: string;
  customerName: string;
  orderQty: number | null;
  fabricCode: string;
  wash: string;
}

export interface SavedWashingCutRecord {
  Id: number;
  Cut: string;
  Bundle_Id: string;
  Bundle_Qty: number;
  Inseam: string | null;
  Size: string | null;
  InsertedAt?: string;
}

export interface WashingCutReportResponse {
  metadata: WashingOrderMetadata | null;
  cuts: SavedWashingCutRecord[];
}

export interface SaveWashingCutReportPayload {
  workOrder: string;
  saleOrderNo?: string;
  customerName?: string;
  orderQty?: number | null;
  fabricCode?: string;
  wash?: string;
  cuts: Array<{
    cut: string;
    bundleId: string;
    bundleQty: number;
    inseam?: string;
    size?: string;
  }>;
}
