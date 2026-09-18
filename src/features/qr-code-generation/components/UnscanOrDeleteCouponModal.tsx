"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eraser,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

export type CouponActionFilters = {
  workOrder: string;
  bundleNo: string;
  opNo: string;
  section: string;
  isScanned: "" | "true" | "false";
  fromCut: string;
  toCut: string;
};

interface UnscanOrDeleteResult {
  unscannedCount: number;
  deletedCount: number;
}

interface MatchCounts {
  totalCount: number;
  scannedCount: number;
  unscannedCount: number;
}

interface UnscanOrDeleteCouponModalProps {
  filters: CouponActionFilters;
  onClose: () => void;
  onDone: () => void;
  submitUnscan: (
    filters: CouponActionFilters,
    onProgress: (done: number, total: number) => void,
  ) => Promise<{ unscannedCount: number }>;
  submitDelete: (
    filters: CouponActionFilters,
    onProgress: (done: number, total: number) => void,
  ) => Promise<{ deletedCount: number }>;
}

type Step = "checking" | "confirm" | "processing" | "success" | "error";

function filterEntries(filters: CouponActionFilters) {
  const entries: { label: string; value: string }[] = [];
  if (filters.bundleNo.trim()) {
    entries.push({ label: "Bundle", value: filters.bundleNo.trim() });
  }
  if (filters.opNo.trim()) {
    entries.push({ label: "Operation", value: filters.opNo.trim() });
  }
  if (filters.fromCut.trim() || filters.toCut.trim()) {
    entries.push({
      label: "Cut",
      value: `${filters.fromCut.trim() || "Start"} - ${filters.toCut.trim() || "End"}`,
    });
  }
  if (filters.section) entries.push({ label: "Section", value: filters.section });
  if (filters.isScanned) {
    entries.push({
      label: "Status",
      value: filters.isScanned === "true" ? "Scanned" : "Not scanned",
    });
  }
  return entries;
}

export function UnscanOrDeleteCouponModal({
  filters,
  onClose,
  onDone,
  submitUnscan,
  submitDelete,
}: UnscanOrDeleteCouponModalProps) {
  const [step, setStep] = useState<Step>("checking");
  const [matchCounts, setMatchCounts] = useState<MatchCounts | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [result, setResult] = useState<UnscanOrDeleteResult | null>(null);

  const entries = useMemo(() => filterEntries(filters), [filters]);
  const hasFilters = entries.length > 0;

  useEffect(() => {
    if (step === "processing") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, onClose]);

  useEffect(() => {
    let cancelled = false;
    const loadMatchCounts = async () => {
      setStep("checking");
      setErrorMessage("");
      setMatchCounts(null);
      try {
        const params = new URLSearchParams({
          workOrder: filters.workOrder,
          bundleNo: filters.bundleNo.trim(),
          opNo: filters.opNo.trim(),
          section: filters.section,
          isScanned: filters.isScanned,
          fromCut: filters.fromCut.trim(),
          toCut: filters.toCut.trim(),
        });
        const res = await fetch(`/api/coupons/unscan-or-delete?${params}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(data.error || "No matching coupons found.");
        }
        setMatchCounts({
          totalCount: Number(data.totalCount) || 0,
          scannedCount: Number(data.scannedCount) || 0,
          unscannedCount: Number(data.unscannedCount) || 0,
        });
        setStep("confirm");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to check matching coupons.",
        );
        setStep("error");
      }
    };
    loadMatchCounts();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const confirmAction: "unscan" | "delete" | "unscan_then_delete" | null =
    matchCounts
      ? matchCounts.scannedCount > 0 && matchCounts.unscannedCount === 0
        ? "unscan"
        : matchCounts.unscannedCount > 0 && matchCounts.scannedCount === 0
          ? "delete"
          : matchCounts.scannedCount > 0 && matchCounts.unscannedCount > 0
            ? "unscan_then_delete"
            : null
      : null;

  const handleConfirm = async () => {
    if (!matchCounts || !confirmAction) return;
    setStep("processing");
    setProgress(null);
    setErrorMessage("");
    try {
      const onProgress = (done: number, total: number) => setProgress({ done, total });
      let unscannedCount = 0;
      let deletedCount = 0;
      if (confirmAction === "delete") {
        const res = await submitDelete(filters, onProgress);
        deletedCount = res.deletedCount;
      } else {
        const res = await submitUnscan(filters, onProgress);
        unscannedCount = res.unscannedCount;
      }
      setResult({ unscannedCount, deletedCount });
      setStep("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to process coupon(s).",
      );
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[460px] w-full p-6 animate-scale-up">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-amber-50 text-amber-600">
              <Eraser className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-extrabold text-[#0f172a]">
              {step === "success"
                ? "Done"
                : step === "error"
                  ? "Action Failed"
                  : "Confirm Unscan / Delete"}
            </h3>
          </div>
          {step !== "processing" && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center py-1">
          {step === "checking" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800">
                Checking matching coupons...
              </h4>
            </div>
          )}

          {step === "confirm" && matchCounts && confirmAction && (
            <div className="w-full flex flex-col items-center py-2">
              <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-2">
                Confirm this action
              </h4>

              <div className="w-full rounded-2xl border border-amber-100 bg-amber-50/60 p-3 mb-4 text-left">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-2">
                  Active Scope
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700">
                    W/O: {filters.workOrder}
                  </span>
                  {hasFilters ? (
                    entries.map((entry) => (
                      <span
                        key={`${entry.label}:${entry.value}`}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-bold text-amber-800"
                      >
                        {entry.label}: {entry.value}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-white px-2 py-1 text-[10px] font-bold text-red-700">
                      Entire work order
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-800 font-medium mb-5 text-left leading-relaxed">
                {confirmAction === "unscan" && (
                  <>
                    This will{" "}
                    <strong className="text-amber-700">
                      unscan {matchCounts.scannedCount} coupon
                      {matchCounts.scannedCount === 1 ? "" : "s"}
                    </strong>
                    .
                  </>
                )}
                {confirmAction === "delete" && (
                  <>
                    This will{" "}
                    <strong className="text-red-600">
                      delete {matchCounts.unscannedCount} coupon
                      {matchCounts.unscannedCount === 1 ? "" : "s"}
                    </strong>
                    . This cannot be undone from this screen.
                  </>
                )}
                {confirmAction === "unscan_then_delete" && (
                  <>
                    <strong className="text-slate-700">
                      {matchCounts.totalCount} coupons match
                    </strong>
                    :{" "}
                    <strong className="text-amber-700">
                      {matchCounts.scannedCount} scanned
                    </strong>
                    ,{" "}
                    <strong className="text-red-600">
                      {matchCounts.unscannedCount} not scanned
                    </strong>
                    . This click will only unscan the scanned coupons. Run it
                    again afterward to delete the remaining unscanned coupons.
                  </>
                )}
              </p>

              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    confirmAction === "delete"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-amber-600 hover:bg-amber-700"
                  }`}
                >
                  {confirmAction === "delete" ? (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </>
                  ) : (
                    <>
                      <Eraser className="w-3.5 h-3.5" />
                      Unscan
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center py-4 w-full">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Processing {progress?.total ?? matchCounts?.totalCount ?? 0} Coupons...
              </h4>
              {progress && progress.total > 0 && (
                <div className="w-full mt-3 mb-1">
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-600 transition-all duration-200"
                      style={{
                        width: `${Math.min(100, (progress.done / progress.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-[#64748b] font-semibold mt-1.5">
                    {progress.done} of {progress.total} coupons processed
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "success" && result && (
            <div className="w-full flex flex-col items-center py-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                {result.unscannedCount + result.deletedCount} Coupon
                {result.unscannedCount + result.deletedCount === 1 ? "" : "s"}{" "}
                Processed
              </h4>
              <p className="text-sm text-slate-800 font-medium mb-5">
                {result.unscannedCount > 0 && (
                  <>
                    <strong>{result.unscannedCount}</strong> unscanned
                    {result.deletedCount > 0 ? ", " : "."}
                  </>
                )}
                {result.deletedCount > 0 && (
                  <>
                    <strong>{result.deletedCount}</strong> deleted.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={onDone}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="w-full flex flex-col items-center py-2">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Could Not Process Coupons
              </h4>
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-left w-full mb-5 max-h-[120px] overflow-y-auto">
                <p className="text-[11px] text-red-600 font-semibold leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
