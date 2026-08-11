"use client";

import React, { useState, useMemo } from "react";
import { RotateCcw, AlertCircle, QrCode } from "lucide-react";
import type { QrCodeStyleData, PageSetupConfig } from "@/features/qr-code-generation/types";
import { PageSetupModal } from "@/features/qr-code-generation/components/PageSetupModal";
import { useGenerateCouponPdf } from "@/features/qr-code-generation/hooks/useGenerateCouponPdf";

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
  const [workOrder, setWorkOrder] = useState("");
  const [cut, setCut] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [operationCode, setOperationCode] = useState(""); // "" = all operations

  const [cutDetails, setCutDetails] = useState<CutDetailRow[]>([]);
  const [styleBulletins, setStyleBulletins] = useState<StyleBulletinRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: { left: 0.166, right: 0.166, top: 0.53, bottom: 0.166 },
    gridFormat: "3x10",
  });

  const canSubmit = workOrder.trim() !== "" && cut.trim() !== "" && bundleId.trim() !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isLoading) return;

    setIsLoading(true);
    setErrorMsg("");
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        work_order: workOrder.trim(),
        cut: cut.trim(),
        bundle_id: bundleId.trim(),
      });
      const response = await fetch(`/api/coupons/rework?${params}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData?.error || "Failed to fetch bundle data.");
      }
      const data = await response.json();
      setCutDetails(data.cutDetails || []);
      setStyleBulletins(data.styleBulletins || []);
    } catch (err: unknown) {
      console.error("Rework coupon fetch error:", err);
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
      setCutDetails([]);
      setStyleBulletins([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Build the coupon-printable style data for the found bundle. If an
  // operation was specified, only that operation gets coupons; otherwise
  // every operation of the bundle's order does (no top-2 cap, unlike Open
  // Order — a rework request explicitly wants full routing coverage).
  const activeStyle: QrCodeStyleData | null = useMemo(() => {
    if (cutDetails.length === 0) return null;

    const bundles = cutDetails.map((row) => ({
      id: row.RowId,
      transId: String(row.Cut ?? cut),
      line: "1",
      bundleNo: String(row.Bundle_Id ?? bundleId),
      inseam: String(row.Inseam ?? ""),
      size: String(row.Size ?? ""),
      pcs: row.Bundle_Qty ?? 0,
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

    const operations = operationCode.trim()
      ? allOperations.filter((op) => op.opNo === operationCode.trim())
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
      notes: "",
      remarks: "",
      reworkQtyMain: "",
      reworkQtyBundle: "",
      subTotal: "",
      total: "",
      operations,
      bundles,
    };
  }, [cutDetails, styleBulletins, operationCode, cut, bundleId, workOrder]);

  const { handleGeneratePdf: generatePdf, generatingPdf } = useGenerateCouponPdf(
    activeStyle ?? { workOrder: "", saleOrderNo: "", styleCode: "", bundles: [], operations: [] },
  );
  const handleGeneratePdf = async () => {
    await generatePdf();
    setShowPageSetupModal(false);
  };

  return (
    <>
    <div className="no-print flex flex-col gap-6 max-w-[900px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
          <span>Industrial Engineering</span>
          <span className="text-[#94a3b8] font-light">/</span>
          <span className="text-[#4f46e5] font-bold">Rework Coupon</span>
        </div>
      </div>

      {/* Title Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
          Rework Coupon
        </h1>
        <p className="text-[11px] text-[#64748b]">
          Generate a replacement coupon for a single cut/bundle. Leave Operation blank to generate one coupon per operation on that bundle.
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-[#475569]">
              Work Order <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={workOrder}
              onChange={(e) => setWorkOrder(e.target.value)}
              placeholder="e.g. W/O-003355"
              className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-[#475569]">
              Cut # <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={cut}
              onChange={(e) => setCut(e.target.value)}
              placeholder="e.g. 1"
              className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-[#475569]">
              Bundle ID <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              value={bundleId}
              onChange={(e) => setBundleId(e.target.value)}
              placeholder="e.g. 1"
              className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold text-[#475569]">
              Operation <span className="text-[#94a3b8] font-medium">(optional — blank = all operations)</span>
            </span>
            <input
              type="text"
              value={operationCode}
              onChange={(e) => setOperationCode(e.target.value)}
              placeholder="e.g. 32523 (op code)"
              className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isLoading ? "Looking up…" : "Find Bundle"}</span>
          </button>
        </div>
      </form>

      {/* Result */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-5 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Lookup Error</h4>
            <p className="mt-1 text-xs text-red-700">{errorMsg}</p>
          </div>
        </div>
      ) : hasSearched && !activeStyle ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2 shadow-sm animate-fade-in">
          <h3 className="text-sm font-bold text-[#0f172a]">No Matching Bundle</h3>
          <p className="text-xs text-[#64748b]">
            No bundle found for that Work Order / Cut / Bundle ID combination
            {operationCode.trim() && " with that operation code"}.
          </p>
        </div>
      ) : activeStyle ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div>
            <h3 className="text-sm font-bold text-[#0f172a]">Bundle Found</h3>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Cut {cut} · Bundle {bundleId} · {activeStyle.operations.length} operation
              {activeStyle.operations.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => setShowPageSetupModal(true)}
            className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Generate Coupon{activeStyle.operations.length > 1 ? "s" : ""}</span>
          </button>
        </div>
      ) : null}
    </div>

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
