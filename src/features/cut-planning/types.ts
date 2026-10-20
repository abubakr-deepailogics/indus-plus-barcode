export type SizeQuantities = Record<string, number>;

export type CutPlanRow = {
  id?: number;
  sourceInseam: number | null;
  planDate: string;
  sizeQuantities: SizeQuantities;
  reCutQty: number;
  markerNo: string;
  cutNo: string;
  markerPlies: number;
  shrinkage: string;
  shade: string;
  calculatedRequired: number | null;
  markerWidthCm: number | null;
  markerLengthM: number | null;
};

export type CutPlanningMetadata = {
  workOrder: string;
  customerName: string;
  accessItems: Array<{
    accessCode: string;
    itemName: string;
  }>;
  workOrderDate: string;
  color: string;
  styleCode: string;
  styleName: string;
  styleNo: string;
};

export type CutPlanningInseamGroup = {
  inseam: number | null;
  sizeColumns: string[];
  orderQuantities: SizeQuantities;
  willCutQuantities: SizeQuantities;
};

export type CutPlanningData = {
  metadata: CutPlanningMetadata | null;
  inseamGroups: CutPlanningInseamGroup[];
  plans: CutPlanRow[];
};

export type SaveCutPlanningPayload = {
  workOrder: string;
  plans: CutPlanRow[];
};

export type GenerateBundlesPayload = {
  workOrder: string;
  cutNos: string[];
  bundleQty: number;
  mergeCuts: boolean;
  shadeAllocations?: Array<{ shade: string; quantity: number }>;
};

export type GeneratedBundle = {
  bundleId: string;
  bundleQty: number;
  cutNos: string[];
};
