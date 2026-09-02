"use client";

import { useState, useMemo, useEffect } from "react";
import type { QrCodeStyleData, PageSetupConfig } from "../types";
import { useGenerateCouponPdf } from "./useGenerateCouponPdf";
import { useAuth } from "@/features/auth/context/auth-context";
import { useWorkOrderParam } from "@/lib/use-work-order-param";

interface WorkerItem {
  EmployeeID: number;
  FirstName: string;
}

interface QrCodeGenerationFacade {
  activeStyle: QrCodeStyleData;
  showSearchModal: boolean;
  searchQuery: string;
  selectedIdx: number;
  showPageSetupModal: boolean;
  pageSetup: PageSetupConfig;
  filteredStyles: QrCodeStyleData[];
  handleModalSearch: () => void;
  handleWorkOrderInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setSearchQuery: (value: string) => void;
  setSelectedIdx: (idx: number) => void;
  setShowSearchModal: (show: boolean) => void;
  setShowPageSetupModal: (show: boolean) => void;
  showCodeTypeModal: boolean;
  setShowCodeTypeModal: (show: boolean) => void;
  setPageSetup: (config: PageSetupConfig) => void;
  openSearchModal: () => void;
  handleFieldChange: (field: keyof QrCodeStyleData, value: string) => void;
  handleOperationChange: (id: number, field: string, value: boolean) => void;
  handleBundleSelChange: (id: number, checked: boolean) => void;
  handleAllBundlesSelChange: (checked: boolean) => void;
  handleAllOperationsSelChange: (checked: boolean) => void;
  handleReworkQtyBundleChange: (value: string) => void;
  handleGeneratePdf: () => Promise<void>;
  generatingPdf: boolean;
  handleGenerateCoupons: () => Promise<void>;
  generatingCoupons: boolean;
  customersList: string[];
  workersList: WorkerItem[];

  // Generation modal state
  showGenerateModal: boolean;
  setShowGenerateModal: (show: boolean) => void;
  generateModalState: "confirm" | "generating" | "success" | "error";
  couponModalError: string;
  generatedCount: number;
  generateProgress: { done: number; total: number } | null;
  confirmGenerateCoupons: () => Promise<void>;
  isSelectionGenerated: boolean;
  handleDirectPrint: (codeType: "qr" | "barcode") => Promise<void>;
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
  const { user } = useAuth();
  const [activeStyle, setActiveStyle] = useState<QrCodeStyleData>(emptyStyle);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [showCodeTypeModal, setShowCodeTypeModal] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    // Margins (cm) for the real A4 sheet this prints on — not
    // auto-centered, since the sheet's printable area is offset, not
    // simply smaller than the page. Must match DEFAULT_MARGINS in
    // pdf-generation.service.ts.
    margins: { left: 0.6, right: 0.65, top: 1.6, bottom: 0.8 },
    gridFormat: "3x10",
    layout: "same-line",
    codeType: "qr",
  });

  const [searchResults, setSearchResults] = useState<QrCodeStyleData[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [generatingCoupons, setGeneratingCoupons] = useState(false);

  // Generation Modal States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateModalState, setGenerateModalState] = useState<
    "confirm" | "generating" | "success" | "error"
  >("confirm");
  const [couponModalError, setCouponModalError] = useState("");
  const [generatedCount, setGeneratedCount] = useState(0);
  const [generateProgress, setGenerateProgress] = useState<{ done: number; total: number } | null>(null);

  const [lastGeneratedSelectionKey, setLastGeneratedSelectionKey] = useState<string>("");

  const currentSelectionKey = useMemo(() => {
    const selBundles = activeStyle.bundles.filter((b) => b.sel).map((b) => b.id).sort().join(",");
    const selOps = activeStyle.operations.filter((o) => o.lastOpSection).map((o) => o.id).sort().join(",");
    return `${selBundles}|${selOps}`;
  }, [activeStyle.bundles, activeStyle.operations]);

  const isSelectionGenerated = useMemo(() => {
    if (!activeStyle.workOrder) return false;
    const hasBundles = activeStyle.bundles.some((b) => b.sel);
    const hasOps = activeStyle.operations.some((o) => o.lastOpSection);
    if (!hasBundles || !hasOps) return false;
    return currentSelectionKey === lastGeneratedSelectionKey;
  }, [activeStyle.workOrder, currentSelectionKey, lastGeneratedSelectionKey, activeStyle.bundles, activeStyle.operations]);

  // Dynamic dropdown lists
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [workersList, setWorkersList] = useState<WorkerItem[]>([]);

  // Set default datetime client side
  useEffect(() => {
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
  }, []);

  // Set default generateBy to logged in user name
  useEffect(() => {
    if (user) {
      const name = user.displayName || user.email?.split("@")[0] || "";
      setActiveStyle((prev) => ({
        ...prev,
        generateBy: prev.generateBy || name,
      }));
    }
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

        // Fetch default work orders suggestions
        const defWoRes = await fetch("/api/open-order/suggestions?query=");
        if (defWoRes.ok) {
          const wos: string[] = await defWoRes.json();
          const mapped = wos.map((wo) => ({
            ...emptyStyle,
            workOrder: wo,
            customer: "Select to load...",
            styleCode: "Select to load...",
          }));
          setSearchResults(mapped);
        }
      } catch (err) {
        console.error("Failed to load initial search metadata:", err);
      }
    };
    loadInitialMetadata();
  }, []);

  // Fetch suggestions for Work Orders dynamically
  useEffect(() => {
    const fetchSuggestions = async () => {
      const trimmed = searchQuery.trim();
      try {
        const res = await fetch(
          `/api/open-order/suggestions?query=${encodeURIComponent(trimmed)}`,
        );
        if (res.ok) {
          const suggestions: string[] = await res.json();
          const mapped = suggestions.map((wo) => ({
            ...emptyStyle,
            workOrder: wo,
            customer: "Select to load...",
            styleCode: "Select to load...",
          }));
          setSearchResults(mapped);
        }
      } catch (err) {
        console.error("Suggestions fetch error:", err);
      }
    };

    const timeout = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Load details for a selected Work Order
  const fetchWorkOrderDetails = async (wo: string) => {
    if (!wo) return;
    try {
      const response = await fetch(
        `/api/open-order?work_order=${encodeURIComponent(wo)}&t=${Date.now()}`,
      );
      if (!response.ok) return;
      const data = await response.json();

      const fetchedCuts = data.cutDetails || [];
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

      // Map database cuts to BundleDetailRow
      const bundles = fetchedCuts.map((cut: any, index: number) => ({
        id: cut.RowId || index,
        transId: cut.Sale_Order_No || cut.Trans_Id || wo,
        cutNo: cut.Cut !== undefined ? String(cut.Cut) : "",
        char: cut.Char || cut.Color || "",
        line: cut.Line !== undefined ? String(cut.Line) : "1",
        bundleNo: cut.Bundle_Id !== undefined ? String(cut.Bundle_Id) : "",
        inseam: cut.Inseam !== undefined ? String(cut.Inseam) : "",
        size: cut.Size !== undefined ? String(cut.Size) : "",
        pcs: Number(cut.Bundle_Qty || cut.Pcs || 0),
        sel: false, // Default to false
        code: cut.Color || "",
        rPcs: cut.R_Pcs !== undefined ? String(cut.R_Pcs) : "-",
      }));

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
          `/api/qr-code-generation/coupons?work_order=${encodeURIComponent(wo)}&page_size=1`,
        );
        if (countRes.ok) {
          const countData = await countRes.json();
          couponCount = String(countData.total || 0);
        }
      } catch (e) {
        console.error("Error fetching coupon count:", e);
      }

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
    }
  };

  // Shared Work Order search: seeds this page's search from the global/URL
  // Work Order (set by Cut Report, Style Bulletin or Coupon Tracing) on
  // mount. Searches committed on this page (below) propagate back out via
  // setSharedWorkOrder.
  const { setWorkOrder: setSharedWorkOrder } = useWorkOrderParam((wo) => {
    fetchWorkOrderDetails(wo);
  });

  const handleModalSearch = async () => {
    const selected = searchResults[selectedIdx];
    if (selected) {
      await fetchWorkOrderDetails(selected.workOrder);
      setSharedWorkOrder(selected.workOrder);
    }
    setShowSearchModal(false);
  };

  const handleWorkOrderInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setActiveStyle((prev) => ({ ...prev, workOrder: value }));
    // Debounce/trigger fetch details if it matches completely
    if (value.trim().length >= 4) {
      fetchWorkOrderDetails(value.trim());
      setSharedWorkOrder(value.trim());
    }
  };

  const openSearchModal = async () => {
    setSearchQuery("");
    try {
      const res = await fetch("/api/open-order/suggestions?query=");
      if (res.ok) {
        const wos: string[] = await res.json();
        const mapped = wos.map((wo) => ({
          ...emptyStyle,
          workOrder: wo,
          customer: "Select to load...",
          styleCode: "Select to load...",
        }));
        setSearchResults(mapped);
      }
    } catch (e) {
      console.error("Error loading search suggestions:", e);
    }
    setShowSearchModal(true);
  };

  const handleFieldChange = (field: keyof QrCodeStyleData, value: string) => {
    setActiveStyle((prev) => ({ ...prev, [field]: value }));
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
    const selectedOperations = activeStyle.operations.filter(
      (op) => op.lastOpSection,
    );
    if (selectedOperations.length === 0) {
      alert(
        "Please select at least one operation checkbox under Operations Detail.",
      );
      return;
    }

    setGenerateModalState("confirm");
    setCouponModalError("");
    setShowGenerateModal(true);
  };

  const confirmGenerateCoupons = async () => {
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
          bundles: activeStyle.bundles,
          operations: activeStyle.operations,
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
      let finalData: { cardCount: number; couponCount: number } | null = null;

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
        if (parsed.status === "error") throw new Error(parsed.message || "Failed to generate coupons.");
        if (parsed.status === "complete") finalData = parsed;
      }

      if (!finalData) {
        throw new Error("Failed to generate coupons.");
      }

      setGeneratedCount(finalData.couponCount);
      setGenerateModalState("success");

      // Update coupons count in UI
      setActiveStyle((prev) => ({
        ...prev,
        generatedCoupons: String(finalData!.couponCount),
      }));
      setLastGeneratedSelectionKey(currentSelectionKey);
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
    showSearchModal,
    searchQuery,
    selectedIdx,
    showPageSetupModal,
    pageSetup,
    filteredStyles: searchResults,
    handleModalSearch,
    handleWorkOrderInputChange,
    setSearchQuery,
    setSelectedIdx,
    setShowSearchModal,
    setShowPageSetupModal,
    showCodeTypeModal,
    setShowCodeTypeModal,
    setPageSetup,
    openSearchModal,
    handleFieldChange,
    handleOperationChange,
    handleBundleSelChange,
    handleAllBundlesSelChange,
    handleAllOperationsSelChange,
    handleReworkQtyBundleChange,
    handleGeneratePdf,
    generatingPdf,
    handleGenerateCoupons,
    generatingCoupons,
    customersList,
    workersList,

    // Generation modal state
    showGenerateModal,
    setShowGenerateModal,
    generateModalState,
    couponModalError,
    generatedCount,
    generateProgress,
    confirmGenerateCoupons,
    isSelectionGenerated,
    handleDirectPrint,
  };
}
