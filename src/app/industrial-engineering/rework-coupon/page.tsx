"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Barcode, Loader2, Trash2, AlertTriangle, Printer } from "lucide-react";
import { useAuth } from "@/features/auth/context/auth-context";
import type {
  QrCodeStyleData,
  BundleDetailRow,
  OperationsDetailRow,
} from "@/features/qr-code-generation/types";
import { OperationsDetailTable } from "@/features/qr-code-generation/components/OperationsDetailTable";
import { GenerateCouponsModal } from "@/features/qr-code-generation/components/GenerateCouponsModal";
import { useGenerateCouponPdf } from "@/features/qr-code-generation/hooks/useGenerateCouponPdf";
import {
  WorkOrderSearchModal,
  type WorkOrderSearchRow,
} from "@/components/work-order-search-modal";
import { useWorkOrderParam } from "@/lib/use-work-order-param";

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
  Customer_Name?: string;
  Sale_Order_No?: string;
  Operation_Code?: string;
  Operation_Name?: string;
  Section?: string;
  Operation_Sequence?: number;
  Piece_Rate?: number;
  Smv_Sam?: number;
  Last_Operation_Section_Wise?: number;
}

// A fully manual Cutting Detail row for this page — unlike Coupon
// Generation's BundleDetailRow, nothing here is looked up from real cut
// data (no Char/Bundle #/Sel — a rework entry has no real bundle to point
// at). Every cell is typed in directly, click-and-type, like a
// spreadsheet — see the ReworkBundleTable render below.
interface ReworkBundleRow {
  id: number;
  cutNo: string;
  inseam: string;
  size: string;
  pcs: string;
}

const cellInputClassName =
  "w-full h-full px-2 py-2 text-center bg-transparent text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:bg-white rounded-lg";

export default function ReworkCouponPage() {
  const { user } = useAuth();

  // Modal states
  const [isOpenLookup, setIsOpenLookup] = useState(false);

  // Persisted loaded state fields
  const [workOrder, setWorkOrderState] = useState("");

  // Loaded data fields (real, read-only — used for Order Qty, customer
  // name, Sale Order No, and the Operations Detail table)
  const [cutDetails, setCutDetails] = useState<CutDetailRow[]>([]);
  const [styleBulletins, setStyleBulletins] = useState<StyleBulletinRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cutting Detail — fully manual, see ReworkBundleRow above. Always shows
  // at least one row; focusing the last row spawns a fresh blank row below
  // it (see handleRowFocus/handleRowBlur), so the user never has to click
  // a separate "Add Row" button.
  const nextRowId = useRef(1);
  const makeBlankRow = (): ReworkBundleRow => ({
    id: nextRowId.current++,
    cutNo: "",
    inseam: "",
    size: "",
    pcs: "",
  });
  const [bundles, setBundles] = useState<ReworkBundleRow[]>(() => [
    makeBlankRow(),
  ]);

  // Operations Detail — real data loaded from the style bulletin, same
  // shape/component as Coupon Generation (checkbox selection only, nothing
  // manual here).
  const [operations, setOperations] = useState<OperationsDetailRow[]>([]);
  const [savedBundles, setSavedBundles] = useState<BundleDetailRow[] | null>(
    null,
  );

  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [reworkQty, setReworkQty] = useState<number | "">("");
  const [hasCouponsGenerated, setHasCouponsGenerated] = useState<boolean>(true);

  const [generateResult, setGenerateResult] = useState<{
    generatedCount: number;
    alreadyExistedCount: number;
  } | null>(null);

  // Shared Work Order search: seeds this page's search from the
  // global/URL Work Order (set by Cut Report, Style Bulletin, Coupon
  // Generation or Coupon Tracing) on mount, and propagates a search
  // committed here to those other pages — same sync pattern used
  // everywhere else in Industrial Engineering.
  const { setWorkOrder: setGlobalWorkOrder } = useWorkOrderParam(
    useCallback((wo: string) => {
      loadWorkOrder(wo);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

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
      const res = await fetch(
        `/api/open-order/work-orders?${params.toString()}`,
      );
      return res.ok ? res.json() : [];
    },
    [],
  );

  async function loadWorkOrder(wo: string) {
    const trimmedWo = wo.trim();
    if (!trimmedWo || isLoading) return;
    setIsLoading(true);
    setErrorMsg("");
    setWorkOrderState(trimmedWo);
    setGlobalWorkOrder(trimmedWo);
    try {
      const response = await fetch(
        `/api/open-order?work_order=${encodeURIComponent(trimmedWo)}&t=${Date.now()}`,
      );
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || "Failed to fetch work order data.");
      }
      const data = await response.json();

      const loadedCuts: CutDetailRow[] = data.cutDetails || [];
      const loadedBulletins: StyleBulletinRow[] = data.styleBulletins || [];

      if (loadedBulletins.length === 0) {
        throw new Error(
          "No operations found in style bulletin for this work order.",
        );
      }

      setCutDetails(loadedCuts);
      setStyleBulletins(loadedBulletins);

      // Verify that production coupons were previously generated for this work order.
      // Rework coupons cannot be created if coupons were never generated for this work order.
      // Operations Detail is then limited to only the operations that
      // actually have generated (non-rework) coupons on record — not
      // every operation in the style bulletin.
      const countRes = await fetch(
        `/api/qr-code-generation/pdf?work_order=${encodeURIComponent(trimmedWo)}`,
      );
      let generatedOpCodes: string[] | null = null;
      if (countRes.ok) {
        const countData = await countRes.json();
        const origCount =
          countData.originalCouponCount ?? countData.couponCount ?? 0;
        if (origCount === 0) {
          setHasCouponsGenerated(false);
          setErrorMsg(
            "Coupons have not been generated for this Work Order yet. Rework coupons can only be created for work orders with generated coupons.",
          );
        } else {
          setHasCouponsGenerated(true);
        }
        generatedOpCodes = Array.isArray(countData.generatedOpCodes)
          ? countData.generatedOpCodes
          : [];
      } else {
        setHasCouponsGenerated(true);
      }

      const generatedOpCodeSet = new Set(generatedOpCodes ?? []);
      setOperations(
        loadedBulletins
          .filter(
            (row) =>
              !generatedOpCodes ||
              generatedOpCodeSet.has(row.Operation_Code ?? ""),
          )
          .slice()
          .sort(
            (a, b) => (a.Operation_Sequence ?? 0) - (b.Operation_Sequence ?? 0),
          )
          .map((row) => ({
            id: row.RowId,
            section: row.Section ?? "",
            seqNo: String(row.Operation_Sequence ?? ""),
            opNo: row.Operation_Code ?? "",
            operationName: row.Operation_Name ?? "",
            smv: String(row.Smv_Sam ?? ""),
            rate: String(row.Piece_Rate ?? ""),
            skills: "",
            lastOpSection: false,
          })),
      );

      // Cutting Detail is fully manual — reset to a single blank row for
      // the newly loaded work order rather than carrying over rows from a
      // previous one.
      setBundles([makeBlankRow()]);
      setSavedBundles(null);
      setReworkQty("");
      setValidationError(null);
      setIsOpenLookup(false);
    } catch (err: unknown) {
      console.error("Rework coupon fetch error:", err);
      setCutDetails([]);
      setStyleBulletins([]);
      setOperations([]);
      setBundles([makeBlankRow()]);
      setSavedBundles(null);
      setErrorMsg(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const totalSam = useMemo(() => {
    return styleBulletins.reduce((acc, curr) => acc + (curr.Smv_Sam ?? 0), 0);
  }, [styleBulletins]);

  const customerName =
    cutDetails[0]?.Customer_Name || styleBulletins[0]?.Customer_Name || "";
  const saleOrderNo =
    cutDetails[0]?.Sale_Order_No || styleBulletins[0]?.Sale_Order_No || "";

  // Order Qty — sum of Bundle_Qty across every cut loaded for this work
  // order (real ERP data), replacing the old per-bundle "Cut Qty" field.
  const orderQty = useMemo(
    () => cutDetails.reduce((acc, c) => acc + (c.Bundle_Qty ?? 0), 0),
    [cutDetails],
  );

  // Cutting Detail row mutation — click a cell, type into it, same idea as
  // a spreadsheet. No Sel checkbox: every row the user adds counts.
  const removeBundleRow = (id: number) => {
    setSavedBundles(null);
    setBundles((prev) => {
      if (prev.length <= 1) return [makeBlankRow()];
      return prev.filter((b) => b.id !== id);
    });
  };

  // Typing into the last row's cell spawns a fresh blank row right below
  // it, once that row actually has something in it — driven by content
  // changing, not by focus/blur timing, so it can't fire on a click that
  // never typed anything or land on the wrong row after a re-render.
  const updateBundleCell = (
    id: number,
    field: keyof Omit<ReworkBundleRow, "id">,
    value: string,
  ) => {
    setSavedBundles(null);
    setBundles((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const updatedRow = { ...prev[idx], [field]: value };
      const next = prev.slice();
      next[idx] = updatedRow;
      const isLastRow = idx === prev.length - 1;
      const hasContent =
        updatedRow.cutNo.trim() ||
        updatedRow.inseam.trim() ||
        updatedRow.size.trim() ||
        updatedRow.pcs.trim();
      if (isLastRow && hasContent) {
        next.push(makeBlankRow());
      }
      return next;
    });
  };

  const handleOperationChange = (id: number, field: string, value: boolean) => {
    setOperations((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)),
    );
  };
  const handleAllOperationsSelChange = (checked: boolean) => {
    setOperations((prev) =>
      prev.map((o) => ({ ...o, lastOpSection: checked })),
    );
  };

  // Total Pcs across every Cutting Detail row — checked live against
  // Re-Work Qty (see the effect below).
  const pcsTotal = useMemo(
    () => bundles.reduce((acc, b) => acc + (Number(b.pcs) || 0), 0),
    [bundles],
  );

  // Fires the moment the Pcs total crosses above Re-Work Qty (edge
  // triggered — not on every keystroke while it stays over, only when it
  // newly goes over), same "live validation modal" the user asked for.
  const wasExceedingRef = useRef(false);
  useEffect(() => {
    const limit = reworkQty === "" ? 0 : Number(reworkQty);
    const exceeding = limit > 0 && pcsTotal > limit;
    if (exceeding && !wasExceedingRef.current) {
      setValidationError(
        `Total Pcs (${pcsTotal}) exceeds Re-Work Qty (${limit}). Reduce Pcs or increase Re-Work Qty.`,
      );
    }
    wasExceedingRef.current = exceeding;
  }, [pcsTotal, reworkQty]);

  const reworkQtyExceedsOrder =
    orderQty > 0 && reworkQty !== "" && Number(reworkQty) > orderQty;

  // Cutting Detail mapped into the shape Coupon Generation's shared
  // pipeline expects (BundleDetailRow). If coupons were already saved/generated
  // for this session, use the sequentially assigned bundle numbers (e.g. RW001).
  const validBundles = useMemo(
    () => bundles.filter((b) => b.cutNo.trim() || b.pcs),
    [bundles],
  );

  const mappedBundles: BundleDetailRow[] = useMemo(() => {
    if (savedBundles && savedBundles.length === validBundles.length) {
      return savedBundles;
    }
    return validBundles.map((b) => ({
      id: b.id,
      cutNo: b.cutNo.trim(),
      char: "",
      line: "1",
      bundleNo: `RW${b.id}`,
      inseam: b.inseam,
      size: b.size,
      pcs: Number(b.pcs) || 0,
      sel: true,
      code: "",
    }));
  }, [validBundles, savedBundles]);

  const activeStyle: QrCodeStyleData | null = useMemo(() => {
    if (mappedBundles.length === 0 || operations.length === 0) return null;
    return {
      workOrder,
      saleOrderNo,
      customer: customerName,
      styleCode: "",
      generateBy: user?.email ?? "",
      generateDatetime: "",
      totalWash: "",
      generatedCoupons: "",
      balance: "",
      generatedBundle: "",
      notes: "",
      remarks: "",
      reworkQtyMain: String(reworkQty ?? ""),
      reworkQtyBundle: String(reworkQty ?? ""),
      subTotal: String(pcsTotal),
      total: String(pcsTotal),
      operations,
      bundles: mappedBundles,
    };
  }, [
    mappedBundles,
    operations,
    saleOrderNo,
    customerName,
    workOrder,
    reworkQty,
    pcsTotal,
    user,
  ]);

  const { handleDownloadPdf, generatingPdf, couponCount } =
    useGenerateCouponPdf(
      activeStyle ?? {
        workOrder: "",
        saleOrderNo: "",
        styleCode: "",
        bundles: [],
        operations: [],
      },
    );

  // Generate Coupon(s):
  // 1. Saves manual cut details into dbo.ReworkCouponEntry (pitSystem).
  // 2. Assigns sequential unique rework bundle numbers (RW001, RW002...).
  // 3. Registers coupon identities in dbo.QrCode_Coupon (shared batchId).
  // 4. Snapshots operations into dbo.StyleBullettinInt (shared batchId).
  // These coupons immediately appear in Coupon Tracing, scanning, and reports.
  const handleGenerateAndSave = async (): Promise<boolean> => {
    if (isSaving || generatingPdf) return false;
    if (!workOrder) {
      setValidationError("Search and select a Work Order first.");
      return false;
    }
    if (!hasCouponsGenerated) {
      setValidationError(
        "Coupons have not been generated for this Work Order yet. Rework coupons can only be created for work orders with generated coupons.",
      );
      return false;
    }
    if (validBundles.length === 0) {
      setValidationError("Add at least one Cutting Detail row.");
      return false;
    }
    if (validBundles.some((b) => !b.cutNo.trim())) {
      setValidationError("Enter a Cut # for every Cutting Detail row.");
      return false;
    }
    if (
      validBundles.some(
        (b) => !b.pcs || !Number.isInteger(Number(b.pcs)) || Number(b.pcs) <= 0,
      )
    ) {
      setValidationError(
        "Enter valid whole integer Pcs (greater than 0) for every Cutting Detail row.",
      );
      return false;
    }
    const selectedOperations = operations.filter((op) => op.lastOpSection);
    if (selectedOperations.length === 0) {
      setValidationError(
        "Select at least one operation under Operations Detail.",
      );
      return false;
    }
    if (reworkQty === "") {
      setValidationError("Please enter a Re-Work Qty.");
      return false;
    }
    if (orderQty > 0 && Number(reworkQty) > orderQty) {
      setValidationError(
        `Re-Work Qty (${reworkQty}) cannot exceed Order Qty (${orderQty}).`,
      );
      return false;
    }
    if (pcsTotal > Number(reworkQty)) {
      setValidationError(
        `Total Pcs (${pcsTotal}) exceeds Re-Work Qty (${reworkQty}). Reduce Pcs or increase Re-Work Qty.`,
      );
      return false;
    }

    setIsSaving(true);
    try {
      const saveResponse = await fetch("/api/coupons/rework/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrder,
          saleOrderNo,
          customerName,
          reworkQty: Number(reworkQty),
          remarks: "",
          insertedBy: user?.email || "",
          bundles: mappedBundles,
          operations,
        }),
      });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(saveData.error || "Failed to save rework entry.");
      }

      if (Array.isArray(saveData.bundles)) {
        setSavedBundles(saveData.bundles);
      }

      const generatedCount = Number(saveData.insertedCount) || 0;
      const cardCount = Number(saveData.cardCount) || 0;
      setGenerateResult({
        generatedCount,
        alreadyExistedCount: Math.max(0, cardCount - generatedCount),
      });
      return true;
    } catch (err: unknown) {
      setValidationError(
        err instanceof Error ? err.message : "Failed to save rework entry.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintClick = async () => {
    if (isSaving || generatingPdf) return;
    if (!savedBundles) {
      const ok = await handleGenerateAndSave();
      if (!ok) return;
    }
    await handleDownloadPdf();
  };

  const isBusy = isSaving || generatingPdf;

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
          <h2 className="text-sm font-bold text-[#4f46e5] mb-4">
            Style Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">
                W/O # & Customer
              </span>
              <input
                type="text"
                readOnly
                value={
                  workOrder
                    ? `${workOrder}${customerName ? " - " + customerName : ""}`
                    : ""
                }
                placeholder="Select from Lookup..."
                onClick={() => setIsOpenLookup(true)}
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">
                Order Qty
              </span>
              <input
                type="text"
                readOnly
                value={orderQty || ""}
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">
                Total SAM
              </span>
              <input
                type="text"
                readOnly
                value={totalSam !== 0 ? totalSam.toFixed(2) : ""}
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5 items-center justify-center border-t md:border-t-0 md:border-l border-slate-100 pl-0 md:pl-4 pt-4 md:pt-0">
              <span className="text-[11px] font-bold text-slate-600 mb-1">
                Re-Work Qty
              </span>
              <input
                type="number"
                value={reworkQty}
                onChange={(e) =>
                  setReworkQty(
                    e.target.value !== "" ? Number(e.target.value) : "",
                  )
                }
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="e.g. 10"
                className={`w-24 text-center px-3 py-3 rounded-xl border bg-white text-base font-extrabold text-indigo-600 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 transition-all ${
                  reworkQtyExceedsOrder
                    ? "border-red-300 focus:border-red-400"
                    : "border-[#e2e8f0] focus:border-[#4f46e5]"
                }`}
              />
              {reworkQtyExceedsOrder && (
                <span className="text-[10px] text-red-500 font-semibold text-center mt-0.5">
                  Cannot exceed Order Qty ({orderQty})
                </span>
              )}
              <div className="mt-3 w-full flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGenerateAndSave}
                  disabled={!activeStyle || isBusy || !hasCouponsGenerated}
                  className="w-full flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md cursor-pointer text-xs"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Barcode className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? "Generating…" : "Generate Coupon(s)"}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintClick}
                  disabled={!activeStyle || isBusy || !hasCouponsGenerated}
                  className="w-full flex items-center justify-center gap-2 bg-white border border-[#4f46e5] text-[#4f46e5] hover:bg-indigo-50/80 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
                >
                  {generatingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {generatingPdf ? "Rendering PDF…" : "Print / Download PDF"}
                  </span>
                </button>
                {couponCount != null && (
                  <span className="text-[10px] font-semibold text-slate-400 text-center">
                    {couponCount} total coupons on record
                  </span>
                )}
              </div>
            </div>
          </div>
          {errorMsg && (
            <p className="mt-3 text-[11px] text-red-500 font-semibold">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Cutting Detail / Operations Detail. Operations Detail reuses
        Coupon Generation's shared component (real data, checkbox select
        only). Cutting Detail is this page's own click-to-edit cell table
        — every row here is manually added, nothing looked up. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
              <h3 className="text-sm font-extrabold text-[#4f46e5]">
                Cutting Detail
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                Start typing in the last row to add another below it
              </span>
            </div>

            <div className="overflow-auto max-h-[420px] border border-[#f1f5f9] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0]">
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                      Cut # <span className="text-red-500">*</span>
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                      Inseam
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                      Size #
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                      Pcs <span className="text-red-500">*</span>
                    </th>
                    <th className="py-2 w-8 sticky top-0 z-10 bg-white" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {bundles.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-[#f8fafc] transition-colors text-[11px]"
                    >
                      <td className="p-0.5">
                        <input
                          type="text"
                          value={b.cutNo}
                          onChange={(e) =>
                            updateBundleCell(b.id, "cutNo", e.target.value)
                          }
                          placeholder="Cut #"
                          className={cellInputClassName}
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          type="text"
                          value={b.inseam}
                          onChange={(e) =>
                            updateBundleCell(b.id, "inseam", e.target.value)
                          }
                          placeholder="Inseam"
                          className={cellInputClassName}
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          type="text"
                          value={b.size}
                          onChange={(e) =>
                            updateBundleCell(b.id, "size", e.target.value)
                          }
                          placeholder="Size"
                          className={cellInputClassName}
                        />
                      </td>
                      <td className="p-0.5">
                        <input
                          type="number"
                          value={b.pcs}
                          onChange={(e) =>
                            updateBundleCell(b.id, "pcs", e.target.value)
                          }
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="Pcs"
                          className={cellInputClassName}
                        />
                      </td>
                      <td className="p-0.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeBundleRow(b.id)}
                          className="text-slate-300 hover:text-red-500 cursor-pointer p-1"
                          aria-label="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3 mt-2 pt-4 border-t border-[#f1f5f9] justify-end">
              <span className="font-bold text-[#64748b]">Total Pcs</span>
              <span
                className={`w-24 text-right px-3 py-2 border rounded-xl text-xs font-bold ${
                  reworkQty !== "" && pcsTotal > Number(reworkQty)
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "border-[#e2e8f0] bg-[#f8fafc] text-slate-700"
                }`}
              >
                {pcsTotal}
              </span>
            </div>
          </div>

          {operations.length > 0 && (
            <OperationsDetailTable
              operations={operations}
              onOperationChange={handleOperationChange}
              onAllOperationsSelChange={handleAllOperationsSelChange}
            />
          )}
        </div>
      </div>

      {/* Same shared Work Order search modal as Cut Report / Style
      Bulletin / Coupon Generation / Coupon Tracing */}
      <WorkOrderSearchModal
        open={isOpenLookup}
        onClose={() => setIsOpenLookup(false)}
        onSelect={(row) => loadWorkOrder(row.workOrder)}
        fetchRows={fetchWorkOrderRows}
      />

      {/* Validation error modal — covers both the Order Qty and the Total
      Pcs vs Re-Work Qty checks. */}
      {validationError && (
        <div
          className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onMouseDown={() => setValidationError(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-sm w-full p-6 animate-scale-up"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#0f172a] mb-1">
                  Can&apos;t continue
                </h3>
                <p className="text-xs text-slate-600 font-medium">
                  {validationError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {generateResult && (
        <GenerateCouponsModal
          state="success"
          selectedBundlesCount={mappedBundles.length}
          selectedOperationsCount={
            operations.filter((op) => op.lastOpSection).length
          }
          generatedCount={generateResult.generatedCount}
          alreadyExistedCount={generateResult.alreadyExistedCount}
          onClose={() => setGenerateResult(null)}
          onConfirm={() => setGenerateResult(null)}
        />
      )}
    </>
  );
}
