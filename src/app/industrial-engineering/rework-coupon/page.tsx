"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Barcode, ChevronDown } from "lucide-react";
import type { QrCodeStyleData, PageSetupConfig } from "@/features/qr-code-generation/types";
import { PageSetupModal } from "@/features/qr-code-generation/components/PageSetupModal";
import { useGenerateCouponPdf } from "@/features/qr-code-generation/hooks/useGenerateCouponPdf";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CutDetailRow {
  RowId: number;
  Sale_Order_No?: string;
  Customer_Name?: string;
  Work_Order?: string;
  Inseam?: number;
  Size?: number;
  Color?: string;
  Cut?: number;
  Bundle_Id?: number;
  Bundle_Qty?: number;
  Shade?: string;
  Shrinkage?: string;
}

interface StyleBulletinRow {
  RowId: number;
  Operation_Code?: string;
  Operation_Name?: string;
  Section?: string;
  Operation_Sequence?: number;
  Piece_Rate?: number;
  Smv_Sam?: number;
  Last_Operation_Section_Wise?: number;
}

export default function ReworkCouponPage() {
  // Modal states
  const [isOpenLookup, setIsOpenLookup] = useState(false);
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);

  // Search dialog fields
  const [searchWorkOrder, setSearchWorkOrder] = useState("");
  const [searchCut, setSearchCut] = useState("");
  const [searchBundleId, setSearchBundleId] = useState("");
  const [searchOperationCode, setSearchOperationCode] = useState("");

  // Persisted loaded state fields
  const [workOrder, setWorkOrder] = useState("");
  const [cut, setCut] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [operationCode, setOperationCode] = useState("");

  // Loaded data fields
  const [cutDetails, setCutDetails] = useState<CutDetailRow[]>([]);
  const [styleBulletins, setStyleBulletins] = useState<StyleBulletinRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // Suggestion autocomplete inside dialog
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ERP Form input states (user editable after bundle loading)
  const [styleVal, setStyleVal] = useState("");
  const [styleDescVal, setStyleDescVal] = useState("");
  const [styleCategoryVal, setStyleCategoryVal] = useState("");
  const [reworkQty, setReworkQty] = useState<number | "">("");
  const [remarksVal, setRemarksVal] = useState("");

  // Dropdown options fetched based on the selected work order
  const [lookupCutOptions, setLookupCutOptions] = useState<number[]>([]);
  const [lookupBundleOptions, setLookupBundleOptions] = useState<{ cut: number; id: number }[]>([]);
  const [lookupOperationOptions, setLookupOperationOptions] = useState<{ code: string; name: string }[]>([]);
  const [isFetchingOptions, setIsFetchingOptions] = useState(false);

  // Search dropdown suggestion visibility states
  const [showCutSuggestions, setShowCutSuggestions] = useState(false);
  const [showBundleSuggestions, setShowBundleSuggestions] = useState(false);
  const [showOpSuggestions, setShowOpSuggestions] = useState(false);
  const [operationSearchQuery, setOperationSearchQuery] = useState("");

  // Refs for click outside to close suggestions
  const cutRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<HTMLDivElement>(null);
  const opRef = useRef<HTMLDivElement>(null);

  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: { left: 0.166, right: 0.166, top: 0.53, bottom: 0.166 },
    gridFormat: "3x10",
  });

  // Suggestion fetching debounced
  useEffect(() => {
    if (searchWorkOrder.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(
          `/api/open-order/suggestions?query=${encodeURIComponent(searchWorkOrder)}`
        );
        if (res.ok) {
          const list = await res.json();
          setSuggestions(list);
        }
      } catch (err) {
        console.error("Suggestions fetch error:", err);
      }
    };
    const delayDebounce = setTimeout(fetchSuggestions, 350);
    return () => clearTimeout(delayDebounce);
  }, [searchWorkOrder]);

  // Click outside suggestions lists to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (cutRef.current && !cutRef.current.contains(e.target as Node)) {
        setShowCutSuggestions(false);
      }
      if (bundleRef.current && !bundleRef.current.contains(e.target as Node)) {
        setShowBundleSuggestions(false);
      }
      if (opRef.current && !opRef.current.contains(e.target as Node)) {
        setShowOpSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Helper to fetch Cuts, Bundle IDs, and Operations for a selected work order
  const fetchWorkOrderOptions = async (wo: string) => {
    if (!wo.trim()) {
      setLookupCutOptions([]);
      setLookupBundleOptions([]);
      setLookupOperationOptions([]);
      return;
    }
    setIsFetchingOptions(true);
    try {
      const res = await fetch(`/api/open-order?work_order=${encodeURIComponent(wo.trim())}`);
      if (res.ok) {
        const data = await res.json();
        
        // Extract unique Cut numbers
        const cuts = Array.from(
          new Set((data.cutDetails || []).map((row: any) => row.Cut).filter((c: any) => c !== undefined && c !== null))
        ) as number[];
        cuts.sort((a, b) => a - b);
        setLookupCutOptions(cuts);

        // Extract Bundle IDs mapped to their Cut number
        const bundles = (data.cutDetails || []).map((row: any) => ({
          cut: row.Cut,
          id: row.Bundle_Id,
        })).filter((b: any) => b.cut !== undefined && b.id !== undefined) as { cut: number; id: number }[];
        bundles.sort((a, b) => a.id - b.id);
        setLookupBundleOptions(bundles);

        // Extract Operations
        const ops = (data.styleBulletins || []).map((row: any) => ({
          code: (row.Operation_Code ?? "").trim(),
          name: (row.Operation_Name ?? "").trim(),
        })).filter((o: any) => o.code) as { code: string; name: string }[];
        
        // Deduplicate operations by code
        const uniqueOpsMap = new Map<string, string>();
        ops.forEach(o => uniqueOpsMap.set(o.code, o.name));
        const uniqueOps = Array.from(uniqueOpsMap.entries()).map(([code, name]) => ({ code, name }));
        setLookupOperationOptions(uniqueOps);
        // Clear previous selections if they aren't valid for the new work order
        setSearchCut("");
        setSearchBundleId("");
        setSearchOperationCode("");
        setOperationSearchQuery("");
      }
    } catch (err) {
      console.error("Error fetching work order options:", err);
    } finally {
      setIsFetchingOptions(false);
    }
  };

  // Trigger options fetch on searchWorkOrder debounce
  useEffect(() => {
    if (searchWorkOrder.trim().length >= 4) {
      const timer = setTimeout(() => {
        fetchWorkOrderOptions(searchWorkOrder);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setLookupCutOptions([]);
      setLookupBundleOptions([]);
      setLookupOperationOptions([]);
    }
  }, [searchWorkOrder]);

  // Fetch options immediately when Dialog is opened (if a Work Order is already typed)
  useEffect(() => {
    if (isOpenLookup && searchWorkOrder.trim()) {
      fetchWorkOrderOptions(searchWorkOrder);
    }
  }, [isOpenLookup]);

  // Filter bundle options list by selected cut #
  const filteredBundleOptions = useMemo(() => {
    if (!searchCut) return [];
    return lookupBundleOptions.filter((b) => String(b.cut) === String(searchCut));
  }, [lookupBundleOptions, searchCut]);

  // Search filtered cuts
  const filteredCutOptions = useMemo(() => {
    if (!searchCut.trim()) return lookupCutOptions;
    return lookupCutOptions.filter((c) => String(c).includes(searchCut.trim()));
  }, [lookupCutOptions, searchCut]);

  // Search filtered bundles
  const filteredBundleSuggestions = useMemo(() => {
    if (!searchBundleId.trim()) return filteredBundleOptions;
    return filteredBundleOptions.filter((b) => String(b.id).includes(searchBundleId.trim()));
  }, [filteredBundleOptions, searchBundleId]);

  // Search filtered operations
  const filteredOpSuggestions = useMemo(() => {
    if (!operationSearchQuery.trim()) return lookupOperationOptions;
    const q = operationSearchQuery.toLowerCase();
    return lookupOperationOptions.filter(
      (op) => op.code.toLowerCase().includes(q) || op.name.toLowerCase().includes(q)
    );
  }, [lookupOperationOptions, operationSearchQuery]);

  // Handle autocomplete suggestion select click
  const handleSelectSuggestion = (suggestion: string) => {
    setSearchWorkOrder(suggestion);
    setShowSuggestions(false);
    fetchWorkOrderOptions(suggestion);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchWorkOrder || !searchCut || !searchBundleId || isLoading) return;

    setIsLoading(true);
    setErrorMsg("");
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        work_order: searchWorkOrder.trim(),
        cut: searchCut.trim(),
        bundle_id: searchBundleId.trim(),
      });
      const response = await fetch(`/api/coupons/rework?${params}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || "Failed to fetch bundle data.");
      }
      const data = await response.json();
      
      const loadedCuts = data.cutDetails || [];
      const loadedBulletins = data.styleBulletins || [];

      if (loadedCuts.length === 0) {
        throw new Error("No bundle found matching the entered criteria.");
      }

      // Populate persisted load parameters
      setWorkOrder(searchWorkOrder.trim());
      setCut(searchCut.trim());
      setBundleId(searchBundleId.trim());
      setOperationCode(searchOperationCode.trim());

      setCutDetails(loadedCuts);
      setStyleBulletins(loadedBulletins);

      // Pre-fill editable input states
      const firstCut = loadedCuts[0];
      setReworkQty(firstCut?.Bundle_Qty ?? "");
      setStyleVal("");
      setStyleDescVal("");
      setStyleCategoryVal("");
      setRemarksVal("");
      setIsOpenLookup(false); // Close dialog on success
    } catch (err: unknown) {
      console.error("Rework coupon fetch error:", err);
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setCutDetails([]);
    setStyleBulletins([]);
    setWorkOrder("");
    setCut("");
    setBundleId("");
    setOperationCode("");
    setStyleVal("");
    setStyleDescVal("");
    setStyleCategoryVal("");
    setReworkQty("");
    setRemarksVal("");
    setHasSearched(false);
    setErrorMsg("");
    setOperationSearchQuery("");
  };

  // Calculations for totals
  // Filter style bulletins based on operation code (case-insensitive, trimmed)
  const filteredStyleBulletins = useMemo(() => {
    if (!operationCode.trim()) return styleBulletins;
    return styleBulletins.filter(
      (row) => (row.Operation_Code ?? "").trim().toUpperCase() === operationCode.trim().toUpperCase()
    );
  }, [styleBulletins, operationCode]);

  const totalSam = useMemo(() => {
    return filteredStyleBulletins.reduce((acc, curr) => acc + (curr.Smv_Sam ?? 0), 0);
  }, [filteredStyleBulletins]);

  const totalRate = useMemo(() => {
    return filteredStyleBulletins.reduce((acc, curr) => acc + (curr.Piece_Rate ?? 0), 0);
  }, [filteredStyleBulletins]);

  const totalPcs = useMemo(() => {
    return cutDetails.reduce((acc, curr) => acc + (curr.Bundle_Qty ?? 0), 0);
  }, [cutDetails]);

  const customerName = cutDetails[0]?.Customer_Name || "";
  const cutQty = cutDetails[0]?.Bundle_Qty;

  // Build printing config
  const activeStyle: QrCodeStyleData | null = useMemo(() => {
    if (cutDetails.length === 0) return null;

    const qtyToUse = reworkQty !== "" ? reworkQty : (cutDetails[0].Bundle_Qty ?? 0);

    const bundles = cutDetails.map((row) => ({
      id: row.RowId,
      cutNo: String(row.Cut ?? cut),
      line: "1",
      bundleNo: String(row.Bundle_Id ?? bundleId),
      inseam: String(row.Inseam ?? ""),
      size: String(row.Size ?? ""),
      pcs: Number(qtyToUse),
      sel: true,
      code: row.Color ?? "",
    }));

    const allOperations = styleBulletins
      .slice()
      .sort((a, b) => (a.Operation_Sequence ?? 0) - (b.Operation_Sequence ?? 0))
      .map((row) => ({
        id: row.RowId,
        section: row.Section ?? "",
        seqNo: String(row.Operation_Sequence ?? ""),
        opNo: row.Operation_Code ?? "",
        operationName: row.Operation_Name ?? "",
        smv: String(row.Smv_Sam ?? ""),
        rate: String(row.Piece_Rate ?? ""),
        skills: "",
        lastOpSection: row.Last_Operation_Section_Wise === 1,
      }));

    // Filter operations if a code was specified during lookup (trimmed, case-insensitive)
    const operations = operationCode.trim()
      ? allOperations.filter((op) => op.opNo.trim().toUpperCase() === operationCode.trim().toUpperCase())
      : allOperations;

    if (operations.length === 0) return null;

    return {
      workOrder: cutDetails[0].Work_Order ?? workOrder,
      saleOrderNo: cutDetails[0].Sale_Order_No ?? "",
      customer: cutDetails[0].Customer_Name ?? "",
      styleCode: "",
      generateBy: "",
      generateDatetime: "",
      totalWash: "",
      generatedCoupons: "",
      balance: "",
      generatedBundle: "",
      notes: remarksVal,
      remarks: remarksVal,
      reworkQtyMain: String(qtyToUse),
      reworkQtyBundle: String(qtyToUse),
      subTotal: "",
      total: "",
      operations,
      bundles,
    };
  }, [cutDetails, styleBulletins, operationCode, cut, bundleId, workOrder, styleVal, remarksVal, reworkQty, customerName]);

  const { handleGenerateCoupons, generatingCoupons, handleDownloadPdf: downloadPdf, generatingPdf, couponCount } = useGenerateCouponPdf(
    activeStyle ?? { workOrder: "", saleOrderNo: "", styleCode: "", bundles: [], operations: [] },
  );
  const handleGeneratePdf = async () => {
    await downloadPdf();
    setShowPageSetupModal(false);
  };

  return (
    <>
      <div className="no-print flex flex-col gap-6 max-w-[1450px] mx-auto text-xs text-[#334155] animate-fade-in pb-16 px-4">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
            <span>Industrial Engineering</span>
            <span className="text-[#94a3b8] font-light">/</span>
            <span className="text-[#4f46e5] font-bold">Rework Coupon</span>
          </div>
        </div>

        {/* 1. Barcode / Style Information */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs">
          <h2 className="text-sm font-bold text-[#4f46e5] mb-4">Barcode / Style Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            {/* Row 1 */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-[11px] font-bold text-slate-500">ANL # & Customer</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={workOrder ? `${workOrder}${customerName ? " - " + customerName : ""}` : ""}
                  placeholder="Select from Lookup..."
                  onClick={() => setIsOpenLookup(true)}
                  className="flex-grow px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setIsOpenLookup(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-[#e2e8f0] text-slate-700 font-bold transition-all shadow-xs flex items-center justify-center cursor-pointer"
                >
                  ...
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Cut Qty</span>
              <input
                type="text"
                readOnly
                value={cutQty !== undefined ? cutQty : ""}
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5 row-span-3 h-full items-center justify-center border-t md:border-t-0 md:border-l border-slate-100 pl-0 md:pl-4 pt-4 md:pt-0">
              <span className="text-[11px] font-bold text-slate-600 mb-2">Re-Work Qty</span>
              <input
                type="number"
                value={reworkQty}
                onChange={(e) => setReworkQty(e.target.value !== "" ? Number(e.target.value) : "")}
                placeholder="e.g. 10"
                className="w-24 text-center px-3 py-4 rounded-xl border border-[#e2e8f0] bg-white text-base font-extrabold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
            </div>

            {/* Row 2 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Style</span>
              <input
                type="text"
                value={styleVal}
                onChange={(e) => setStyleVal(e.target.value)}
                placeholder="e.g. Jeans Style"
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Style Category</span>
              <input
                type="text"
                value={styleCategoryVal}
                onChange={(e) => setStyleCategoryVal(e.target.value)}
                placeholder="e.g. Bottoms"
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Total SAM</span>
              <input
                type="text"
                readOnly
                value={totalSam !== 0 ? totalSam.toFixed(2) : ""}
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            {/* Row 3 */}
            <div className="flex flex-col gap-1.5 md:col-span-3">
              <span className="text-[11px] font-bold text-slate-500">Style Description</span>
              <input
                type="text"
                value={styleDescVal}
                onChange={(e) => setStyleDescVal(e.target.value)}
                placeholder="Enter style description..."
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Dynamic side-by-side grids */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* SAM Details Panel */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col h-full lg:col-span-7">
            <h2 className="text-sm font-bold text-[#4f46e5] mb-4">SAM Details</h2>
            <div className="overflow-x-auto flex-grow">
              <table className="w-full text-left border-collapse border border-slate-200 text-[11px] text-[#334155] table-layout:fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th rowSpan={2} className="p-2 border-r border-slate-200 font-bold text-center w-12">Seq #</th>
                    <th rowSpan={2} className="p-2 border-r border-slate-200 font-bold text-center w-16">Op #</th>
                    <th rowSpan={2} className="p-2 border-r border-slate-200 font-bold w-40">Op Name</th>
                    <th colSpan={2} className="p-1 border-r border-slate-200 font-bold text-center">SAM</th>
                    <th colSpan={2} className="p-1 border-r border-slate-200 font-bold text-center">Rate</th>
                    <th rowSpan={2} className="p-2 border-r border-slate-200 font-bold text-center w-14">Qty</th>
                    <th rowSpan={2} className="p-2 font-bold text-center w-14">No. of B</th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-1 border-r border-slate-200 font-semibold text-center w-12">Op</th>
                    <th className="p-1 border-r border-slate-200 font-semibold text-center w-12">Ord</th>
                    <th className="p-1 border-r border-slate-200 font-semibold text-center w-12">Op</th>
                    <th className="p-1 border-r border-slate-200 font-semibold text-center w-12">Ord</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStyleBulletins.length > 0 ? (
                    filteredStyleBulletins.map((row) => (
                      <tr key={row.RowId} className="border-b border-slate-200 hover:bg-slate-50/50">
                        <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-700">{row.Operation_Sequence}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono text-purple-600 font-semibold">{row.Operation_Code}</td>
                        <td className="p-2 border-r border-slate-200 font-medium truncate max-w-[160px]" title={row.Operation_Name}>{row.Operation_Name}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-semibold text-purple-600">{row.Smv_Sam?.toFixed(2)}</td>
                        <td className="p-2 border-r border-slate-200 text-right text-slate-500">{row.Smv_Sam?.toFixed(2)}</td>
                        <td className="p-2 border-r border-slate-200 text-right font-semibold text-slate-700">{row.Piece_Rate?.toFixed(4)}</td>
                        <td className="p-2 border-r border-slate-200 text-right text-slate-500">{row.Piece_Rate?.toFixed(4)}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold text-indigo-600">{reworkQty}</td>
                        <td className="p-2 text-center text-slate-500">1</td>
                      </tr>
                    ))
                  ) : (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-200 h-8">
                        <td className="p-2 border-r border-slate-200 text-center text-slate-300 font-bold">{i + 1}</td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2"></td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-indigo-50/50 font-bold border-t border-slate-300">
                    <td colSpan={3} className="p-2 border-r border-slate-200 text-right font-bold text-indigo-700">
                      Total --------&gt;
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right text-indigo-700">{totalSam.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-600">{totalSam.toFixed(2)}</td>
                    <td className="p-2 border-r border-slate-200 text-right text-indigo-700">{totalRate.toFixed(4)}</td>
                    <td className="p-2 border-r border-slate-200 text-right text-slate-600">{totalRate.toFixed(4)}</td>
                    <td colSpan={2} className="p-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex gap-3 items-center">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Remarks</span>
              <input
                type="text"
                value={remarksVal}
                onChange={(e) => setRemarksVal(e.target.value)}
                placeholder="Enter remarks..."
                className="flex-grow px-3 py-2 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
            </div>
          </div>

          {/* Bundle / Barcode Details Panel */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col h-full lg:col-span-5">
            <h2 className="text-sm font-bold text-[#4f46e5] mb-4">Bundle / Barcode Details</h2>
            <div className="overflow-x-auto flex-grow max-h-[300px] overflow-auto">
              <table className="w-full text-left border-collapse border border-slate-200 text-[11px] text-[#334155] table-layout:fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-28">ANL #</th>
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-12">Cut #</th>
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-16">Char</th>
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-14">Bndl #</th>
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-12">Shade</th>
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-16">Shrinkage</th>
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-12">Size #</th>
                    <th className="p-2 border-r border-slate-200 font-bold text-center w-12">Inseam</th>
                    <th className="p-2 font-bold text-center w-12">Pcs</th>
                  </tr>
                </thead>
                <tbody>
                  {cutDetails.length > 0 ? (
                    cutDetails.map((row) => (
                      <tr key={row.RowId} className="border-b border-slate-200 hover:bg-slate-50/50">
                        <td className="p-2 border-r border-slate-200 text-center font-medium">{row.Sale_Order_No}</td>
                        <td className="p-2 border-r border-slate-200 text-center">{row.Cut}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-semibold text-slate-700">{row.Color}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{row.Bundle_Id}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold text-indigo-600">{row.Shade || "A"}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{row.Shrinkage || "0%"}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-bold">{row.Size}</td>
                        <td className="p-2 border-r border-slate-200 text-center">{row.Inseam}</td>
                        <td className="p-2 text-right font-bold text-indigo-600">{row.Bundle_Qty}</td>
                      </tr>
                    ))
                  ) : (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-200 h-8">
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2 border-r border-slate-200"></td>
                        <td className="p-2"></td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-indigo-50/50 font-bold border-t border-slate-300">
                    <td colSpan={8} className="p-2 border-r border-slate-200 text-right font-bold text-indigo-700">
                      Total --------&gt;
                    </td>
                    <td className="p-2 text-right text-indigo-700 font-extrabold">{totalPcs}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Centered Actions Toolbar */}
        <div className="flex items-center justify-center gap-4 border-t border-slate-100 pt-6 mt-2">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center justify-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 px-5 py-2.5 rounded-xl font-bold transition-all shadow-xs cursor-pointer text-xs"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">🗑️</span>
            <span>Delete Barcode</span>
          </button>

          {activeStyle && (
            <div className="flex items-center gap-3">
              {couponCount !== null && (
                <span className="text-[10px] font-semibold text-[#64748b]">
                  {couponCount} coupon{couponCount === 1 ? "" : "s"} generated
                </span>
              )}
              <button
                type="button"
                onClick={handleGenerateCoupons}
                disabled={generatingCoupons}
                className="flex items-center justify-center gap-2 bg-white border border-[#4f46e5] text-[#4f46e5] hover:bg-[#eef2ff] px-5 py-2.5 rounded-xl font-bold transition-all shadow-xs cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>{generatingCoupons ? "Generating…" : `Generate Coupon${activeStyle.operations.length > 1 ? "s" : ""}`}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPageSetupModal(true)}
                className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md cursor-pointer text-xs"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rework Bundle Lookup Dialog */}
      <Dialog open={isOpenLookup} onOpenChange={setIsOpenLookup}>
        <DialogContent className="sm:max-w-md bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-2xl z-50">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-800">Rework Bundle Lookup</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-1">
              Search for a work order, cut number, and bundle ID to retrieve manufacturing details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-4 mt-2">
            {/* Work Order Input with suggestions */}
            <div className="relative flex flex-col gap-1.5" ref={suggestionsRef}>
              <span className="text-[11px] font-bold text-slate-600">Work Order *</span>
              <input
                type="text"
                required
                value={searchWorkOrder}
                onChange={(e) => {
                  setSearchWorkOrder(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="e.g. W/O-003355"
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-[100%] mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-semibold border-b border-[#f1f5f9] last:border-0 transition-colors cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative flex flex-col gap-1.5" ref={cutRef}>
                <span className="text-[11px] font-bold text-slate-600">Cut # *</span>
                {lookupCutOptions.length > 0 ? (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={searchCut}
                      onChange={(e) => {
                        setSearchCut(e.target.value);
                        setSearchBundleId(""); // Clear bundle ID on cut change
                        setShowCutSuggestions(true);
                      }}
                      onFocus={() => setShowCutSuggestions(true)}
                      placeholder="Select Cut"
                      className="w-full px-3 py-2 pr-8 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all h-9 cursor-pointer"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    {showCutSuggestions && filteredCutOptions.length > 0 && (
                      <div className="absolute left-0 right-0 top-[100%] mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                        {filteredCutOptions.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setSearchCut(String(c));
                              setSearchBundleId("");
                              setShowCutSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold border-b border-[#f1f5f9] last:border-0 transition-colors cursor-pointer"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={searchCut}
                    onChange={(e) => setSearchCut(e.target.value)}
                    placeholder="e.g. 1"
                    disabled={isFetchingOptions}
                    className="px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                )}
              </div>

              <div className="relative flex flex-col gap-1.5" ref={bundleRef}>
                <span className="text-[11px] font-bold text-slate-600">Bundle ID *</span>
                {lookupCutOptions.length > 0 ? (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={!searchCut}
                      value={searchBundleId}
                      onChange={(e) => {
                        setSearchBundleId(e.target.value);
                        setShowBundleSuggestions(true);
                      }}
                      onFocus={() => setShowBundleSuggestions(true)}
                      placeholder={searchCut ? "Select Bundle" : "Select Cut first"}
                      className="w-full px-3 py-2 pr-8 rounded-xl border border-[#e2e8f0] bg-white disabled:bg-slate-50 disabled:cursor-not-allowed text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all h-9 cursor-pointer"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    {showBundleSuggestions && filteredBundleSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-[100%] mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                        {filteredBundleSuggestions.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSearchBundleId(String(b.id));
                              setShowBundleSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-semibold border-b border-[#f1f5f9] last:border-0 transition-colors cursor-pointer"
                          >
                            {b.id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={searchBundleId}
                    onChange={(e) => setSearchBundleId(e.target.value)}
                    placeholder="e.g. 1"
                    disabled={isFetchingOptions}
                    className="px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                )}
              </div>
            </div>

            <div className="relative flex flex-col gap-1.5" ref={opRef}>
              <span className="text-[11px] font-bold text-slate-600">
                Operation <span className="text-slate-400 font-medium">(optional)</span>
              </span>
              {lookupOperationOptions.length > 0 ? (
                <div className="relative">
                  <input
                    type="text"
                    value={operationSearchQuery}
                    onChange={(e) => {
                      setOperationSearchQuery(e.target.value);
                      setSearchOperationCode(e.target.value);
                      setShowOpSuggestions(true);
                    }}
                    onFocus={() => setShowOpSuggestions(true)}
                    placeholder="All Operations (search code or name)"
                    className="w-full px-3 py-2 pr-8 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all h-9 cursor-pointer"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  {showOpSuggestions && (
                    <div className="absolute left-0 right-0 top-[100%] mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchOperationCode("");
                          setOperationSearchQuery("");
                          setShowOpSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-50 italic font-semibold border-b border-[#f1f5f9] transition-colors cursor-pointer"
                      >
                        All Operations (Clear Filter)
                      </button>
                      {filteredOpSuggestions.map((op) => (
                        <button
                          key={op.code}
                          type="button"
                          onClick={() => {
                            setSearchOperationCode(op.code);
                            setOperationSearchQuery(`${op.code} - ${op.name}`);
                            setShowOpSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-semibold border-b border-[#f1f5f9] last:border-0 transition-colors cursor-pointer"
                        >
                          <span className="text-purple-600 font-mono font-bold mr-2">{op.code}</span>
                          <span className="text-slate-600 font-medium">{op.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={searchOperationCode}
                  onChange={(e) => setSearchOperationCode(e.target.value)}
                  placeholder="e.g. 32523 (leave empty for all)"
                  disabled={isFetchingOptions}
                  className="px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                />
              )}
            </div>

            {errorMsg && (
              <p className="text-[11px] text-red-500 font-semibold">{errorMsg}</p>
            )}

            <DialogFooter className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setIsOpenLookup(false)}
                className="px-4 py-2 rounded-xl border border-[#e2e8f0] hover:bg-slate-50 text-slate-600 font-bold transition-all text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !searchWorkOrder || !searchCut || !searchBundleId}
                className="px-5 py-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoading ? "Loading..." : "Search & Load"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Page Setup modal */}
      {showPageSetupModal && activeStyle && (
        <PageSetupModal
          pageSetup={pageSetup}
          onPageSetupChange={setPageSetup}
          onClose={() => setShowPageSetupModal(false)}
          onGeneratePdf={handleGeneratePdf}
          generatingPdf={generatingPdf}
        />
      )}
    </>
  );
}
