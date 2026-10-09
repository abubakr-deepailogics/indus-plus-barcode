export interface SavedReworkCuttingDetail {
  rowId: number;
  cutNo: string;
  inseam: string;
  size: string;
  pcs: number;
  bundleNo: string;
  reworkQty: number | null;
  insertedAt: string;
}

export interface ReworkEntriesResponse {
  rows: SavedReworkCuttingDetail[];
  latestReworkQty: number | null;
}
