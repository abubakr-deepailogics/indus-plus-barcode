"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BundleDetailRow,
  OperationsDetailRow,
  QrCodeStyleData,
  PageSetupConfig,
} from "../types";
import { DEFAULT_MARGINS } from "../types";
import { useGenerateCouponPdf } from "./useGenerateCouponPdf";
import { useAuth } from "@/features/auth/context/auth-context";
import { useWorkOrderParam } from "@/lib/use-work-order-param";
import { useDepartment } from "@/lib/department-context";
import { usesManualCouponCutDetails } from "@/lib/department-classification";
import type { WorkOrderSearchRow } from "@/components/work-order-search-modal";

interface WorkerItem {
  EmployeeID: number;
  FirstName: string;
}

interface OpenOrderOperationRow {
  RowId?: number;
  Section?: string;
  Operation_Sequence?: number | string;
  Operation_Code?: string;
  Operation_Name?: string;
  Smv_Sam?: number | string;
  Piece_Rate?: number | string;
  SkillLevel?: string;
  Incentive?: number | string;
  Sdl_No?: string;
  Style_Code?: string;
}

interface OpenOrderCutRow {
  RowId?: number;
  Sale_Order_No?: string;
  Trans_Id?: string;
  Cut?: number | string;
  Char?: string;
  Color?: string;
  Line?: number | string;
  Bundle_Id?: number | string;
  BundleNo?: number | string;
  Inseam?: string;
  Size?: string;
  Bundle_Qty?: number | string;
  Pcs?: number | string;
  R_Pcs?: number | string;
  Customer_Name?: string;
}

interface OpenOrderResponse {
  cutDetails?: OpenOrderCutRow[];
  styleBulletins?: OpenOrderOperationRow[];
}

interface CouponGenerationStreamEvent {
  status?: "error" | "complete" | "progress";
  message?: string;
  done?: number;
  total?: number;
  insertedCount?: number;
  alreadyExistedCount?: number;
  couponCount?: number;
}

function isZeroRateOp(op: OperationsDetailRow): boolean {
  const rate = Number(op.rate);
  return !op.rate || Number.isNaN(rate) || rate === 0;
}

interface QrCodeGenerationFacade {
  activeStyle: QrCodeStyleData;
  isLoadingWorkOrder: boolean;
  showWorkOrderModal: boolean;
  setShowWorkOrderModal: (show: boolean) => void;
  fetchWorkOrderRows: (filters: {
    workOrder: string;
    customer: string;
    saleOrderNo: string;
  }) => Promise<WorkOrderSearchRow[]>;
  handleSelectWorkOrder: (row: WorkOrderSearchRow) => void;
  showPageSetupModal: boolean;
  pageSetup: PageSetupConfig;
  setShowPageSetupModal: (show: boolean) => void;
  showCodeTypeModal: boolean;
  setShowCodeTypeModal: (show: boolean) => void;
  setPageSetup: (config: PageSetupConfig) => void;
  handleOperationChange: (id: number, field: string, value: boolean) => void;
  handleBundleSelChange: (id: number, checked: boolean) => void;
  handleAllBundlesSelChange: (checked: boolean) => void;
  handleAllOperationsSelChange: (checked: boolean) => void;
  handleReworkQtyBundleChange: (value: string) => void;
  handleManualBundleChange: (
    id: number,
    field: "bundleNo" | "inseam" | "size" | "pcs",
    value: string,
  ) => void;
  handleAllManualBundlesSelChange: (checked: boolean) => void;
  handleRemoveManualBundle: (id: number) => void;
  handleAddManualBundle: () => void;
  handleGeneratePdf: () => Promise<void>;
  generatingPdf: boolean;
  handleGenerateCoupons: () => Promise<void>;
  generatingCoupons: boolean;
  canGenerate: boolean;
  customersList: string[];
  workersList: WorkerItem[];

  // Generation modal state
  showGenerateModal: boolean;
  setShowGenerateModal: (show: boolean) => void;
  generateModalState: "confirm" | "generating" | "success" | "error";
  couponModalError: string;
  generatedCount: number;
  alreadyExistedCount: number;
  generateProgress: { done: number; total: number } | null;
  confirmGenerateCoupons: () => Promise<void>;
  isSelectionGenerated: boolean;
  handleDirectPrint: (codeType: "qr" | "barcode") => Promise<void>;

  zeroRateOperations: OperationsDetailRow[];
  includeZeroRateOps: boolean;
  setIncludeZeroRateOps: (include: boolean) => void;
}

const emptyStyle: QrCodeStyleData = {
  workOrder: "",
  saleOrderNo: "",
  customer: "",
  styleCode: "",
  workOrderQty: "",
  generateBy: "",
  generateDatetime: "",
  totalWash: "",
  generatedCoupons: "0",
  balance: "0",
  generatedBundle: "0",
  notes: "",
  remarks: "",
  reworkQtyMain: "",
  reworkQtyBundle: "",
  subTotal: "0",
  total: "0",
  operations: [],
  bundles: [],
};

function getSelectedBundlePcs(bundles: BundleDetailRow[]): number {
  return bundles
    .filter((bundle) => bundle.sel)
    .reduce((sum, bundle) => sum + bundle.pcs, 0);
}

function getTotalBundleQty(cutDetails: OpenOrderCutRow[]): number {
  return cutDetails.reduce((total, cut) => {
    const quantity = Number(cut.Bundle_Qty ?? cut.Pcs ?? 0);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
}

function isCompleteManualBundle(bundle: BundleDetailRow): boolean {
  return Boolean(bundle.bundleNo.trim()) && Number.isInteger(bundle.pcs) && bundle.pcs > 0;
}

function createNextManualBundle(bundles: BundleDetailRow[]): BundleDetailRow {
  const numericBundleNos = bundles
    .map((bundle) => Number(bundle.bundleNo))
    .filter((bundleNo) => Number.isInteger(bundleNo) && bundleNo >= 0);

  return {
    id: Math.min(0, ...bundles.map((bundle) => bundle.id)) - 1,
    cutNo: "",
    line: "1",
    bundleNo: String(Math.max(0, ...numericBundleNos) + 1),
    inseam: "",
    size: "",
    pcs: 0,
    sel: false,
    code: "",
  };
}

export function useQrCodeGenerationFacade(): QrCodeGenerationFacade {
  const { department } = useDepartment();
  const { user, can } = useAuth();
  const canGenerate = can("coupon-generation", "create");
  const [activeStyle, setActiveStyle] = useState<QrCodeStyleData>(emptyStyle);
  const workOrderRequestId = useRef(0);
  const [isLoadingWorkOrder, setIsLoadingWorkOrder] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [showCodeTypeModal, setShowCodeTypeModal] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    // Margins (cm) for the real A4 sheet this prints on — not
    // auto-centered, since the sheet's printable area is offset, not
    // simply smaller than the page. Sourced from DEFAULT_MARGINS (types.ts)
    // instead of a hardcoded duplicate — a previous copy here drifted out
    // of sync with that constant, so a margin fix there silently never
    // reached this screen's actual PDF generation.
    margins: DEFAULT_MARGINS,
    gridFormat: "3x10",
    layout: "same-line",
    codeType: "qr",
  });

  const [generatingCoupons, setGeneratingCoupons] = useState(false);

  // Generation Modal States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateModalState, setGenerateModalState] = useState<
    "confirm" | "generating" | "success" | "error"
  >("confirm");
  const [couponModalError, setCouponModalError] = useState("");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [alreadyExistedCount, setAlreadyExistedCount] = useState(0);
  const [generateProgress, setGenerateProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const [lastGeneratedSelectionKey, setLastGeneratedSelectionKey] =
    useState<string>("");
  // Bundle/operation pairs already registered for the current work order —
  // "BundleNo|OpNo" keys, loaded from the DB so Print can enable for a
  // selection generated in an earlier session, not just this one.
  const [generatedPairs, setGeneratedPairs] = useState<Set<string>>(new Set());
  const [includeZeroRateOps, setIncludeZeroRateOps] = useState(false);

  // Deduped by opNo (keep first occurrence) — some work orders' style
  // bulletins genuinely list an Operation Code more than once (see
  // buildCouponCards' dedupeByKey), and this list's length is subtracted
  // from a distinct-opNo count in GenerateCouponsModal's "effective
  // operations" math; leaving duplicates in here would double-subtract a
  // duplicated zero-rate op and undercount effectiveOperationsCount.
  const zeroRateOperations = useMemo(() => {
    const seenOpNos = new Set<string>();
    return activeStyle.operations.filter((op) => {
      if (!(op.lastOpSection && isZeroRateOp(op))) return false;
      if (seenOpNos.has(op.opNo)) return false;
      seenOpNos.add(op.opNo);
      return true;
    });
  }, [activeStyle.operations]);

  const currentSelectionKey = useMemo(() => {
    const selBundles = activeStyle.bundles
      .filter((b) => b.sel)
      .map((b) => b.id)
      .sort()
      .join(",");
    const selOps = activeStyle.operations
      .filter((o) => o.lastOpSection)
      .map((o) => o.id)
      .sort()
      .join(",");
    return `${selBundles}|${selOps}`;
  }, [activeStyle.bundles, activeStyle.operations]);

  const isSelectionGenerated = useMemo(() => {
    if (!activeStyle.workOrder) return false;
    const selectedBundles = activeStyle.bundles.filter((b) => b.sel);
    const selectedOps = activeStyle.operations.filter((o) => o.lastOpSection);
    if (selectedBundles.length === 0 || selectedOps.length === 0) return false;
    // Fast path: exactly what was just generated this session.
    if (currentSelectionKey === lastGeneratedSelectionKey) return true;
    // Otherwise fall back to the DB-backed set — every selected bundle x
    // operation pair must already have a coupon registered.
    return selectedBundles.every((b) =>
      selectedOps.every((o) => generatedPairs.has(`${b.bundleNo}|${o.opNo}`)),
    );
  }, [
    activeStyle.workOrder,
    currentSelectionKey,
    lastGeneratedSelectionKey,
    activeStyle.bundles,
    activeStyle.operations,
    generatedPairs,
  ]);

  // Dynamic dropdown lists
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [workersList, setWorkersList] = useState<WorkerItem[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setActiveStyle((prev) => ({
        ...prev,
        generateDatetime: new Date()
          .toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(",", ""),
      }));
    });
  }, []);

  // Set default generateBy to logged in user email — same deferral reason
  // as above.
  useEffect(() => {
    if (!user) return;
    queueMicrotask(() => {
      const email = user.email || user.displayName || "";
      setActiveStyle((prev) => ({
        ...prev,
        generateBy: prev.generateBy || email,
      }));
    });
  }, [user]);

  // Fetch dropdown collections & initial suggestions on mount
  useEffect(() => {
    const loadInitialMetadata = async () => {
      try {
        // Fetch Customers
        const custRes = await fetch(
          "/api/open-order/suggestions?type=customer",
        );
        if (custRes.ok) {
          const customers = await custRes.json();
          setCustomersList(customers);
        }

        // Fetch Workers
        const workersRes = await fetch(
          "/api/open-order/suggestions?type=workers",
        );
        if (workersRes.ok) {
          const workers = await workersRes.json();
          setWorkersList(workers);
        }
      } catch (err) {
        console.error("Failed to load initial search metadata:", err);
      }
    };
    loadInitialMetadata();
  }, []);

  // Load details for a selected Work Order
  const fetchWorkOrderDetails = async (wo: string) => {
    const requestId = ++workOrderRequestId.current;
    if (!wo) {
      setActiveStyle(emptyStyle);
      setGeneratedPairs(new Set());
      setLastGeneratedSelectionKey("");
      setIsLoadingWorkOrder(false);
      return;
    }
    setIsLoadingWorkOrder(true);
    try {
      const response = await fetch(
        `/api/open-order?work_order=${encodeURIComponent(wo)}&department=${encodeURIComponent(department)}&t=${Date.now()}`,
      );
      if (!response.ok || requestId !== workOrderRequestId.current) return;
      const data = (await response.json()) as OpenOrderResponse;
      if (requestId !== workOrderRequestId.current) return;

      const sourceCutDetails = data.cutDetails || [];
      const workOrderQty = getTotalBundleQty(sourceCutDetails);
      let fetchedCuts: OpenOrderCutRow[] = sourceCutDetails;
      if (usesManualCouponCutDetails(department)) {
        const manualDetailsResponse = await fetch(
          `/api/manual-coupon-cut-details?work_order=${encodeURIComponent(wo)}&department=${department}`,
        );
        if (requestId !== workOrderRequestId.current) return;
        if (!manualDetailsResponse.ok) {
          throw new Error("Failed to load manual bundle details.");
        }
        const manualDetails = (await manualDetailsResponse.json()) as {
          rows?: OpenOrderCutRow[];
        };
        fetchedCuts = manualDetails.rows || [];
      }
      const fetchedOps = data.styleBulletins || [];

      // Map database operations to OperationsDetailRow
      const operations = fetchedOps.map((op, index: number) => ({
        id: op.RowId || index,
        section: op.Section || "",
        seqNo: String(op.Operation_Sequence || ""),
        opNo: op.Operation_Code || "",
        operationName: op.Operation_Name || "",
        smv: op.Smv_Sam !== undefined ? String(op.Smv_Sam) : "0",
        rate: op.Piece_Rate !== undefined ? String(op.Piece_Rate) : "0",
        skills:
          op.SkillLevel !== undefined ? String(op.SkillLevel) : "Un-Skilled",
        lastOpSection: false,
        inc: op.Incentive !== undefined ? String(op.Incentive) : "-",
        sdl: op.Sdl_No !== undefined ? String(op.Sdl_No) : "-",
      }));

      const sectionMinSeq = new Map<string, number>();
      for (const op of operations) {
        const seqNum = Number(op.seqNo) || 0;
        const current = sectionMinSeq.get(op.section);
        if (current === undefined || seqNum < current) {
          sectionMinSeq.set(op.section, seqNum);
        }
      }
      operations.sort((a: OperationsDetailRow, b: OperationsDetailRow) => {
        const sectionCompare =
          (sectionMinSeq.get(a.section) ?? 0) -
          (sectionMinSeq.get(b.section) ?? 0);
        if (sectionCompare !== 0) return sectionCompare;
        return (Number(a.seqNo) || 0) - (Number(b.seqNo) || 0);
      });

      // Map database cuts to BundleDetailRow
      const bundles: BundleDetailRow[] = fetchedCuts.map((cut, index: number) => ({
        id: cut.RowId || index,
        transId: cut.Sale_Order_No || cut.Trans_Id || wo,
        cutNo: cut.Cut !== undefined ? String(cut.Cut) : "",
        char: cut.Char || cut.Color || "",
        line: cut.Line !== undefined ? String(cut.Line) : "1",
        bundleNo: cut.Bundle_Id !== undefined ? String(cut.Bundle_Id) : String(cut.BundleNo ?? ""),
        inseam: cut.Inseam !== undefined ? String(cut.Inseam) : "",
        size: cut.Size !== undefined ? String(cut.Size) : "",
        pcs: Number(cut.Bundle_Qty ?? cut.Pcs ?? 0),
        // Selection is always explicit, matching Sewing. A user can fill
        // manual rows freely, then choose exactly which rows to generate.
        sel: false,
        code: cut.Color || "",
        rPcs: cut.R_Pcs !== undefined ? String(cut.R_Pcs) : "-",
      }));

      if (usesManualCouponCutDetails(department) && bundles.length === 0) {
        bundles.push({
          id: -1,
          cutNo: "",
          line: "1",
          bundleNo: "1",
          inseam: "",
          size: "",
          pcs: 0,
          sel: false,
          code: "",
        });
      }

      // // Sort bundles in sequence by Cut No and Bundle No
      bundles.sort((a, b) => {
        const cutCompare = a.cutNo.localeCompare(b.cutNo, undefined, {
          numeric: true,
        });
        if (cutCompare !== 0) return cutCompare;
        return a.bundleNo.localeCompare(b.bundleNo, undefined, {
          numeric: true,
        });
      });

      // Fetch coupon counts for the work order from registration count API
      let couponCount = "0";
      try {
        const countRes = await fetch(
          `/api/qr-code-generation/coupons?work_order=${encodeURIComponent(wo)}&page_size=1&department=${encodeURIComponent(department)}`,
        );
        if (requestId !== workOrderRequestId.current) return;
        if (countRes.ok) {
          const countData = await countRes.json();
          couponCount = String(countData.total || 0);
        }
      } catch (e) {
        console.error("Error fetching coupon count:", e);
      }

      // Fetch bundle/operation pairs already generated for this work order,
      // so Print can enable for a selection generated in an earlier session.
      let pairs = new Set<string>();
      try {
        const pairsRes = await fetch(
          `/api/qr-code-generation/coupons/pairs?work_order=${encodeURIComponent(wo)}&department=${encodeURIComponent(department)}`,
        );
        if (requestId !== workOrderRequestId.current) return;
        if (pairsRes.ok) {
          const pairsData = await pairsRes.json();
          pairs = new Set(
            (pairsData.pairs || []).map(
              (p: { bundleNo: string; opNo: string }) =>
                `${p.bundleNo}|${p.opNo}`,
            ),
          );
        }
      } catch (e) {
        console.error("Error fetching generated pairs:", e);
      }
      if (requestId !== workOrderRequestId.current) return;
      setGeneratedPairs(pairs);

      setActiveStyle((prev) => ({
        ...prev,
        workOrder: wo,
        saleOrderNo: wo,
        customer: fetchedCuts[0]?.Customer_Name || "",
        styleCode: fetchedOps[0]?.Style_Code || "",
        workOrderQty: usesManualCouponCutDetails(department)
          ? String(workOrderQty)
          : "",
        generatedCoupons: couponCount,
        generatedBundle: String(bundles.length),
        subTotal: "0",
        total: "0",
        operations,
        bundles,
      }));
      setLastGeneratedSelectionKey("");
    } catch (err) {
      if (requestId === workOrderRequestId.current) {
        console.error("Error fetching work order details:", err);
      }
    } finally {
      if (requestId === workOrderRequestId.current) {
        setIsLoadingWorkOrder(false);
      }
    }
  };

  // Shared Work Order search: seeds this page's search from the global/URL
  // Work Order (set by Cut Report, Style Bulletin or Coupon Tracing) on
  // mount. Searches committed on this page (below) propagate back out via
  // setSharedWorkOrder.
  const { setWorkOrder: setSharedWorkOrder } = useWorkOrderParam((wo) => {
    fetchWorkOrderDetails(wo);
  });

  // Backs the shared Work Order search modal — same indusPlus table Cut
  // Report reads from (see /api/open-order/work-orders), so both pages
  // share this route.
  const fetchWorkOrderRows = useCallback(
    async (filters: {
      workOrder: string;
      customer: string;
      saleOrderNo: string;
    }): Promise<WorkOrderSearchRow[]> => {
      const params = new URLSearchParams();
      if (filters.workOrder) params.set("work_order", filters.workOrder);
      if (filters.customer) params.set("customer", filters.customer);
      if (filters.saleOrderNo) params.set("sale_order_no", filters.saleOrderNo);
      params.set("department", department);
      const res = await fetch(
        `/api/open-order/work-orders?${params.toString()}`,
      );
      return res.ok ? res.json() : [];
    },
    [department],
  );

  const handleSelectWorkOrder = (row: WorkOrderSearchRow) => {
    fetchWorkOrderDetails(row.workOrder);
    setSharedWorkOrder(row.workOrder);
    setShowWorkOrderModal(false);
  };

  const handleOperationChange = (id: number, field: string, value: boolean) => {
    setActiveStyle((prev) => {
      const updated = prev.operations.map((o) =>
        o.id === id ? { ...o, [field]: value } : o,
      );
      return { ...prev, operations: updated };
    });
  };

  const handleBundleSelChange = (id: number, checked: boolean) => {
    setActiveStyle((prev) => {
      const updated = prev.bundles.map((b) =>
        b.id === id ? { ...b, sel: checked } : b,
      );
      const selectedPcs = updated
        .filter((b) => b.sel)
        .reduce((acc, b) => acc + b.pcs, 0);
      return {
        ...prev,
        bundles: updated,
        subTotal: String(selectedPcs),
        total: String(selectedPcs),
      };
    });
  };

  const handleAllBundlesSelChange = (checked: boolean) => {
    setActiveStyle((prev) => {
      const updated = prev.bundles.map((b) => ({ ...b, sel: checked }));
      const selectedPcs = updated
        .filter((b) => b.sel)
        .reduce((acc, b) => acc + b.pcs, 0);
      return {
        ...prev,
        bundles: updated,
        subTotal: String(selectedPcs),
        total: String(selectedPcs),
      };
    });
  };

  const handleAllOperationsSelChange = (checked: boolean) => {
    setActiveStyle((prev) => {
      const updated = prev.operations.map((o) => ({
        ...o,
        lastOpSection: checked,
      }));
      return {
        ...prev,
        operations: updated,
      };
    });
  };

  const handleReworkQtyBundleChange = (value: string) => {
    setActiveStyle((prev) => ({ ...prev, reworkQtyBundle: value }));
  };

  const handleManualBundleChange = (
    id: number,
    field: "bundleNo" | "inseam" | "size" | "pcs",
    value: string,
  ) => {
    setActiveStyle((prev) => {
      const index = prev.bundles.findIndex((bundle) => bundle.id === id);
      if (index === -1) return prev;
      const current = prev.bundles[index];
      const updated = {
        ...current,
        [field]: field === "pcs" ? Number(value) || 0 : value,
      };
      const hasContent = Boolean(
        updated.bundleNo.trim() ||
          updated.inseam.trim() ||
          updated.size.trim() ||
          updated.pcs,
      );
      const bundles = prev.bundles.slice();
      // Filling a row must not silently add it to generation. Selection is
      // controlled solely by the row checkbox or Complete selection.
      bundles[index] = { ...updated, sel: current.sel };
      if (index === prev.bundles.length - 1 && hasContent) {
        bundles.push(createNextManualBundle(bundles));
      }
      const selectedPcs = getSelectedBundlePcs(bundles);
      return { ...prev, bundles, subTotal: String(selectedPcs), total: String(selectedPcs) };
    });
  };

  const handleAddManualBundle = () => {
    setActiveStyle((prev) => {
      const bundles = [...prev.bundles, createNextManualBundle(prev.bundles)];
      return {
        ...prev,
        bundles,
        subTotal: String(getSelectedBundlePcs(bundles)),
        total: String(getSelectedBundlePcs(bundles)),
      };
    });
  };

  const handleAllManualBundlesSelChange = (checked: boolean) => {
    setActiveStyle((prev) => {
      const bundles = prev.bundles.map((bundle) => ({
        ...bundle,
        sel: checked && isCompleteManualBundle(bundle),
      }));
      const selectedPcs = getSelectedBundlePcs(bundles);
      return { ...prev, bundles, subTotal: String(selectedPcs), total: String(selectedPcs) };
    });
  };

  const handleRemoveManualBundle = (id: number) => {
    setActiveStyle((prev) => {
      if (prev.bundles.length > 1) {
        const bundles = prev.bundles.filter((bundle) => bundle.id !== id);
        const selectedPcs = getSelectedBundlePcs(bundles);
        return { ...prev, bundles, subTotal: String(selectedPcs), total: String(selectedPcs) };
      }
      return {
        ...prev,
        bundles: [createNextManualBundle([])],
        subTotal: "0",
        total: "0",
      };
    });
  };

  const handleGenerateCoupons = async () => {
    if (!activeStyle.workOrder) {
      alert("Please enter or search a Work Order.");
      return;
    }
    const selectedBundles = activeStyle.bundles.filter((b) => b.sel);
    if (selectedBundles.length === 0) {
      alert(
        "Please select at least one bundle check box under Cutting Detail.",
      );
      return;
    }
    if (usesManualCouponCutDetails(department)) {
      const invalidBundle = selectedBundles.find(
        (bundle) => !bundle.bundleNo.trim() || !Number.isInteger(bundle.pcs) || bundle.pcs <= 0,
      );
      if (invalidBundle) {
        alert("Every selected manual bundle needs a Bundle No. and Pcs greater than 0.");
        return;
      }
      const bundleNos = selectedBundles.map((bundle) =>
        bundle.bundleNo.trim().toLocaleLowerCase(),
      );
      if (new Set(bundleNos).size !== bundleNos.length) {
        alert("Manual Bundle No. values must be unique.");
        return;
      }
    }
    const selectedOperations = activeStyle.operations.filter(
      (op) => op.lastOpSection,
    );
    if (selectedOperations.length === 0) {
      alert(
        "Please select at least one operation checkbox under Operations Detail.",
      );
      return;
    }

    setIncludeZeroRateOps(false);
    setGenerateModalState("confirm");
    setCouponModalError("");
    setShowGenerateModal(true);
  };

  const confirmGenerateCoupons = async () => {
    const operationsToSend = includeZeroRateOps
      ? activeStyle.operations
      : activeStyle.operations.map((op) =>
          op.lastOpSection && isZeroRateOp(op)
            ? { ...op, lastOpSection: false }
            : op,
        );

    setGenerateModalState("generating");
    setGeneratingCoupons(true);
    setGenerateProgress(null);
    try {
      const response = await fetch("/api/qr-code-generation/coupons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workOrder: activeStyle.workOrder,
          department,
          manualCutDetails: usesManualCouponCutDetails(department),
          bundles: activeStyle.bundles,
          operations: operationsToSend,
          generatedBy: activeStyle.generateBy,
        }),
      });

      // Non-streaming failures (validation errors) still come back as a
      // plain JSON error body — the stream only starts once the route has
      // actual work to report progress on.
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate coupons.");
      }
      if (!response.body) {
        throw new Error("Failed to generate coupons.");
      }

      // Response body arrives as newline-delimited JSON progress lines —
      // read incrementally and buffer any partial line split across two
      // reader chunks (a line's bytes aren't guaranteed to land in one
      // read()) until a "\n" completes it.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData: {
        cardCount: number;
        insertedCount: number;
        alreadyExistedCount: number;
        couponCount: number;
      } | null = null;

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // last element: partial line (or "") — held back for the next read
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line) as CouponGenerationStreamEvent;
          if (parsed.status === "error") {
            throw new Error(parsed.message || "Failed to generate coupons.");
          }
          if (parsed.status === "complete") {
            finalData = {
              cardCount: 0,
              insertedCount: parsed.insertedCount ?? 0,
              alreadyExistedCount: parsed.alreadyExistedCount ?? 0,
              couponCount: parsed.couponCount ?? 0,
            };
          }
          setGenerateProgress({ done: parsed.done ?? 0, total: parsed.total ?? 0 });
        }
      }
      // Decoder may still hold a trailing partial multi-byte char with
      // nothing left to complete it once the stream ends — flush is a
      // no-op unless that happened, so this is safe either way.
      buffer += decoder.decode();
      if (buffer.trim()) {
        const parsed = JSON.parse(buffer) as CouponGenerationStreamEvent;
        if (parsed.status === "error")
          throw new Error(parsed.message || "Failed to generate coupons.");
        if (parsed.status === "complete") {
          finalData = {
            cardCount: 0,
            insertedCount: parsed.insertedCount ?? 0,
            alreadyExistedCount: parsed.alreadyExistedCount ?? 0,
            couponCount: parsed.couponCount ?? 0,
          };
        }
      }

      if (!finalData) {
        throw new Error("Failed to generate coupons.");
      }

      setGeneratedCount(finalData.insertedCount);
      setAlreadyExistedCount(finalData.alreadyExistedCount);
      setGenerateModalState("success");

      // Update coupons count in UI
      setActiveStyle((prev) => ({
        ...prev,
        generatedCoupons: String(finalData!.couponCount),
      }));
      setLastGeneratedSelectionKey(currentSelectionKey);
      setGeneratedPairs((prev) => {
        const next = new Set(prev);
        const selectedBundles = activeStyle.bundles.filter((b) => b.sel);
        const selectedOps = operationsToSend.filter((op) => op.lastOpSection);
        for (const b of selectedBundles) {
          for (const o of selectedOps) next.add(`${b.bundleNo}|${o.opNo}`);
        }
        return next;
      });
    } catch (err: unknown) {
      setCouponModalError(
        err instanceof Error
          ? err.message
          : "An error occurred while generating coupons.",
      );
      setGenerateModalState("error");
    } finally {
      setGeneratingCoupons(false);
    }
  };

  const { handleDownloadPdf: downloadPdf, generatingPdf } =
    useGenerateCouponPdf(activeStyle);
  const handleGeneratePdf = async () => {
    await downloadPdf(pageSetup.layout, pageSetup.margins, pageSetup.codeType);
    setShowPageSetupModal(false);
  };

  const handleDirectPrint = async (codeType: "qr" | "barcode") => {
    await downloadPdf(pageSetup.layout, pageSetup.margins, codeType);
  };

  return {
    activeStyle,
    isLoadingWorkOrder,
    showWorkOrderModal,
    setShowWorkOrderModal,
    fetchWorkOrderRows,
    handleSelectWorkOrder,
    showPageSetupModal,
    pageSetup,
    setShowPageSetupModal,
    showCodeTypeModal,
    setShowCodeTypeModal,
    setPageSetup,
    handleOperationChange,
    handleBundleSelChange,
    handleAllBundlesSelChange,
    handleAllOperationsSelChange,
    handleReworkQtyBundleChange,
    handleManualBundleChange,
    handleAllManualBundlesSelChange,
    handleRemoveManualBundle,
    handleAddManualBundle,
    handleGeneratePdf,
    generatingPdf,
    handleGenerateCoupons,
    generatingCoupons,
    canGenerate,
    customersList,
    workersList,

    // Generation modal state
    showGenerateModal,
    setShowGenerateModal,
    generateModalState,
    couponModalError,
    generatedCount,
    alreadyExistedCount,
    generateProgress,
    confirmGenerateCoupons,
    isSelectionGenerated,
    handleDirectPrint,

    zeroRateOperations,
    includeZeroRateOps,
    setIncludeZeroRateOps,
  };
}
