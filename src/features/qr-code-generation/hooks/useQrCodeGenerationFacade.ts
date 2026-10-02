"use client";

import { useCallback, useState, useMemo, useEffect } from "react";
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
  handleRemoveManualBundle: (id: number) => void;
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

export function useQrCodeGenerationFacade(): QrCodeGenerationFacade {
  const { department } = useDepartment();
  const { user, can } = useAuth();
  const canGenerate = can("coupon-generation", "create");
  const [activeStyle, setActiveStyle] = useState<QrCodeStyleData>(emptyStyle);
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
    if (!wo) return;
    setIsLoadingWorkOrder(true);
    try {
      const response = await fetch(
        `/api/open-order?work_order=${encodeURIComponent(wo)}&department=${encodeURIComponent(department)}&t=${Date.now()}`,
      );
      if (!response.ok) return;
      const data = await response.json();

      let fetchedCuts = data.cutDetails || [];
      if (usesManualCouponCutDetails(department)) {
        const manualDetailsResponse = await fetch(
          `/api/manual-coupon-cut-details?work_order=${encodeURIComponent(wo)}&department=${department}`,
        );
        if (!manualDetailsResponse.ok) {
          throw new Error("Failed to load manual bundle details.");
        }
        const manualDetails = await manualDetailsResponse.json();
        fetchedCuts = manualDetails.rows || [];
      }
      const fetchedOps = data.styleBulletins || [];

      // Map database operations to OperationsDetailRow
      const operations = fetchedOps.map((op: any, index: number) => ({
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
      const bundles: BundleDetailRow[] = fetchedCuts.map((cut: any, index: number) => ({
        id: cut.RowId || index,
        transId: cut.Sale_Order_No || cut.Trans_Id || wo,
        cutNo: cut.Cut !== undefined ? String(cut.Cut) : "",
        char: cut.Char || cut.Color || "",
        line: cut.Line !== undefined ? String(cut.Line) : "1",
        bundleNo: cut.Bundle_Id !== undefined ? String(cut.Bundle_Id) : String(cut.BundleNo ?? ""),
        inseam: cut.Inseam !== undefined ? String(cut.Inseam) : "",
        size: cut.Size !== undefined ? String(cut.Size) : "",
        pcs: Number(cut.Bundle_Qty ?? cut.Pcs ?? 0),
        // Manual department rows follow the Rework model: populated rows are
        // included automatically, while the trailing blank row is not.
        sel: usesManualCouponCutDetails(department),
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
      bundles.sort((a: any, b: any) => {
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
      setGeneratedPairs(pairs);

      // Compute total/subtotal sum of loaded bundle pieces
      const totalPcs = bundles.reduce((acc: number, b: any) => acc + b.pcs, 0);

      setActiveStyle((prev) => ({
        ...prev,
        workOrder: wo,
        saleOrderNo: wo,
        customer: fetchedCuts[0]?.Customer_Name || "",
        styleCode: fetchedOps[0]?.Style_Code || "",
        generatedCoupons: couponCount,
        generatedBundle: String(bundles.length),
        subTotal: "0",
        total: "0",
        operations,
        bundles,
      }));
      setLastGeneratedSelectionKey("");
    } catch (err) {
      console.error("Error fetching work order details:", err);
    } finally {
      setIsLoadingWorkOrder(false);
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
      bundles[index] = { ...updated, sel: hasContent };
      if (index === prev.bundles.length - 1 && hasContent) {
        const numericBundleNos = bundles
          .map((bundle) => Number(bundle.bundleNo))
          .filter((bundleNo) => Number.isInteger(bundleNo) && bundleNo >= 0);
        const nextId = Math.min(0, ...bundles.map((bundle) => bundle.id)) - 1;
        bundles.push({
          id: nextId,
          cutNo: "",
          line: "1",
          bundleNo: String(Math.max(0, ...numericBundleNos) + 1),
          inseam: "",
          size: "",
          pcs: 0,
          sel: false,
          code: "",
        });
      }
      const selectedPcs = bundles
        .filter((bundle) => bundle.sel)
        .reduce((sum, bundle) => sum + bundle.pcs, 0);
      return { ...prev, bundles, subTotal: String(selectedPcs), total: String(selectedPcs) };
    });
  };

  const handleRemoveManualBundle = (id: number) => {
    setActiveStyle((prev) => {
      if (prev.bundles.length > 1) {
        const bundles = prev.bundles.filter((bundle) => bundle.id !== id);
        const selectedPcs = bundles
          .filter((bundle) => bundle.sel)
          .reduce((sum, bundle) => sum + bundle.pcs, 0);
        return { ...prev, bundles, subTotal: String(selectedPcs), total: String(selectedPcs) };
      }
      return {
        ...prev,
        bundles: [{ id: -1, cutNo: "", line: "1", bundleNo: "1", inseam: "", size: "", pcs: 0, sel: false, code: "" }],
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
          const parsed = JSON.parse(line);
          if (parsed.status === "error") {
            throw new Error(parsed.message || "Failed to generate coupons.");
          }
          if (parsed.status === "complete") {
            finalData = parsed;
          }
          setGenerateProgress({ done: parsed.done, total: parsed.total });
        }
      }
      // Decoder may still hold a trailing partial multi-byte char with
      // nothing left to complete it once the stream ends — flush is a
      // no-op unless that happened, so this is safe either way.
      buffer += decoder.decode();
      if (buffer.trim()) {
        const parsed = JSON.parse(buffer);
        if (parsed.status === "error")
          throw new Error(parsed.message || "Failed to generate coupons.");
        if (parsed.status === "complete") finalData = parsed;
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
    } catch (err: any) {
      setCouponModalError(
        err.message || "An error occurred while generating coupons.",
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
    handleRemoveManualBundle,
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
