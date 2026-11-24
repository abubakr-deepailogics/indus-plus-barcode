export type SizeQuantities = Record<string, number>;

// Where a sewing work order's bundles were read from (see /api/open-order):
// Cut Planning's generated bundles (SewingCutReport) or indusPlus's cut detail.
export type CutDetailSource = "cut-planning" | "indus-plus";

/** Ply type a new or legacy (NULL) cut-planning row gets. */
export const DEFAULT_PLY_TYPE = "SINGLE PLY";
/** Matches dbo.CutPlanning.PlyType NVARCHAR(50). */
export const PLY_TYPE_MAX_LENGTH = 50;

export type CutPlanRow = {
  id?: number;
  sourceInseam: number | null;
  planDate: string;
  sizeQuantities: SizeQuantities;
  reCutQty: number;
  markerNo: string;
  cutNo: string;
  markerPlies: number;
  plyType: string;
  shrinkage: string;
  shade: string;
  calculatedRequired: number | null;
  markerWidthCm: number | null;
  markerLengthM: number | null;
};

export type CutPlanningBomItem = {
  itemName: string;
  groupName: string;
  /** Per-piece consumption from the style card BOM; null when not set. */
  consumption: number | null;
  /** Unit of the consumption (MT, YDS, ...); empty when not set. */
  uom: string;
};

export type CutPlanningMetadata = {
  workOrder: string;
  customerName: string;
  accessItems: Array<{
    accessCode: string;
    itemName: string;
  }>;
  /** FABRIC BOM items (main body, pocketing, piping) for the print header. */
  fabricItems: CutPlanningBomItem[];
  /** Fusing items from the style card BOM. */
  fusingItems: CutPlanningBomItem[];
  /** Wash from the style card BOM; empty when the BOM has none. */
  wash: string;
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
  /** Bundle numbers displayed in the preview; prevents confirming a stale preview. */
  expectedSequences?: number[];
  /** Number of rows displayed in the preview; prevents an incomplete preview. */
  expectedBundleCount?: number;
  shadeAllocations?: Array<{
    shade: string;
    quantity: number;
    /** The visible Cut No. for this shade, such as 5A or 5B. */
    cutNo: string;
  }>;
};

export type GeneratedBundle = {
  bundleId: string;
  bundleQty: number;
  cutNos: string[];
};
