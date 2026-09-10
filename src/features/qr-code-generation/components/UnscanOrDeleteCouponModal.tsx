"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Eraser,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
} from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";

interface OperationSuggestion {
  Operation_Code: string;
  Operation_Name: string | null;
}

export interface UnscanOrDeleteResult {
  action: "unscanned" | "deleted";
  couponCode: string;
}

interface UnscanOrDeleteCouponModalProps {
  workOrder: string;
  onClose: () => void;
  onDone: () => void;
  submit: (fields: {
    workOrder: string;
    cutNo: string;
    bundleNo: string;
    opNo: string;
  }) => Promise<UnscanOrDeleteResult>;
}

type Step = "form" | "processing" | "success" | "error";
type CouponStatus = "idle" | "checking" | "scanned" | "unscanned" | "not_found";

const FIELD_LABEL =
  "text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block";
const FIELD_INPUT =
  "w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-400 transition-all";

// Manual lookup-and-act: user keys in the four fields printed on the
// physical coupon (Work Order, Cut, Bundle, Operation) rather than picking
// a row from the trace table — meant for a coupon slip in hand that hasn't
// necessarily been traced/searched on screen first. The outcome isn't
// chosen by the user: the server (see /api/coupons/unscan-or-delete) checks
// the coupon's current scan state and unscans it if it was scanned, or
// soft-deletes it (never a hard DELETE) if it wasn't — so a scanned coupon
// is never deleted outright, it's always unscanned first.
export function UnscanOrDeleteCouponModal({
  workOrder,
  onClose,
  onDone,
  submit,
}: UnscanOrDeleteCouponModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [cutNo, setCutNo] = useState("");
  const [bundleNo, setBundleNo] = useState("");
  const [opNo, setOpNo] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<UnscanOrDeleteResult | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [status, setStatus] = useState<CouponStatus>("idle");

  const fieldsFilled = !!(bundleNo.trim() && opNo.trim());
  const canSubmit =
    fieldsFilled &&
    step === "form" &&
    (status === "scanned" || status === "unscanned");

  const requestIdRef = useRef(0);
  useEffect(() => {
    if (step !== "form" || !fieldsFilled) {
      setStatus("idle");
      setCouponCode("");
      return;
    }
    const requestId = ++requestIdRef.current;
    setStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          workOrder,
          cutNo: cutNo.trim(),
          bundleNo: bundleNo.trim(),
          opNo: opNo.trim(),
        });
        const res = await fetch(`/api/coupons/unscan-or-delete?${params}`);
        if (requestIdRef.current !== requestId) return;
        if (!res.ok) {
          setStatus("not_found");
          setCouponCode("");
          return;
        }
        const data = await res.json();
        setCouponCode(data.couponCode);
        setStatus(data.isScanned ? "scanned" : "unscanned");
      } catch {
        if (requestIdRef.current !== requestId) return;
        setStatus("not_found");
        setCouponCode("");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [workOrder, cutNo, bundleNo, opNo, fieldsFilled, step]);

  // Suggestions are scoped to this coupon's work order and sourced straight
  // from dbo.QrCode_Coupon (only_generated=true / type=cut), the same
  // endpoints the trace table's own filters use — so a dropdown option is
  // guaranteed to match an actual (non-deleted) coupon, not just anything
  // in the style bulletin.
  const fetchCutSuggestions = async (query: string): Promise<string[]> => {
    try {
      const res = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=cut&query=${encodeURIComponent(query)}`,
      );
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  };

  const fetchBundleSuggestions = async (query: string): Promise<string[]> => {
    try {
      const res = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=bundle&query=${encodeURIComponent(query)}&only_generated=true`,
      );
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  };

  const fetchOpSuggestions = async (
    query: string,
  ): Promise<OperationSuggestion[]> => {
    try {
      const res = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=operation&query=${encodeURIComponent(query)}&only_generated=true`,
      );
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  };

  React.useEffect(() => {
    if (step === "processing") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStep("processing");
    setErrorMessage("");
    try {
      const res = await submit({
        workOrder,
        cutNo: cutNo.trim(),
        bundleNo: bundleNo.trim(),
        opNo: opNo.trim(),
      });
      setResult(res);
      setStep("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to process coupon.",
      );
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[420px] w-full p-6 animate-scale-up">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 text-amber-600">
              <Eraser className="w-3.5 h-3.5" />
            </span>
            <h3 className="text-sm font-extrabold text-[#0f172a]">
              {step === "success"
                ? result?.action === "unscanned"
                  ? "Coupon Unscanned"
                  : "Coupon Deleted"
                : step === "error"
                  ? "Action Failed"
                  : "Unscan / Delete Coupon"}
            </h3>
          </div>
          {step !== "processing" && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center py-1">
          {step === "form" && (
            <form onSubmit={handleSubmit} className="w-full">
              <p className="text-xs text-[#64748b] font-medium mb-4 text-left leading-relaxed">
                Enter the details printed on the coupon to locate it. If
                it&apos;s already scanned it will be{" "}
                <strong className="text-slate-700">unscanned</strong>; otherwise
                it will be <strong className="text-slate-700">deleted</strong>
              </p>

              <div className="mb-3 text-left">
                <span className={FIELD_LABEL}>Work Order</span>
                <div className="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-bold text-slate-600">
                  {workOrder}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2 text-left">
                <div>
                  <label className={FIELD_LABEL} htmlFor="uod-cut-no">
                    Cut No
                  </label>
                  <Autocomplete<string>
                    value={cutNo}
                    onChange={setCutNo}
                    onSelect={setCutNo}
                    fetchSuggestions={fetchCutSuggestions}
                    renderSuggestion={(item) => <span>{item}</span>}
                    getSuggestionValue={(item) => item}
                    placeholder="e.g. 5"
                    inputClassName={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL} htmlFor="uod-bundle-no">
                    Bundle No
                  </label>
                  <Autocomplete<string>
                    value={bundleNo}
                    onChange={setBundleNo}
                    onSelect={setBundleNo}
                    fetchSuggestions={fetchBundleSuggestions}
                    renderSuggestion={(item) => <span>{item}</span>}
                    getSuggestionValue={(item) => item}
                    placeholder="e.g. 0001"
                    inputClassName={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL} htmlFor="uod-op-no">
                    Operation
                  </label>
                  <Autocomplete<OperationSuggestion>
                    value={opNo}
                    onChange={setOpNo}
                    onSelect={(op) => setOpNo(op.Operation_Code)}
                    fetchSuggestions={fetchOpSuggestions}
                    renderSuggestion={(op) => (
                      <div className="flex flex-col">
                        <span className="text-[#4f46e5] font-bold text-[10px]">
                          {op.Operation_Code}
                        </span>
                        {op.Operation_Name && (
                          <span className="text-[10px] text-slate-500 truncate">
                            {op.Operation_Name}
                          </span>
                        )}
                      </div>
                    )}
                    getSuggestionValue={(op) => op.Operation_Code}
                    placeholder="e.g. OP1"
                    inputClassName={FIELD_INPUT}
                  />
                </div>
              </div>

              {fieldsFilled && (
                <div className="mt-3 text-left">
                  {status === "checking" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking coupon status...
                    </div>
                  )}
                  {status === "scanned" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                      <Search className="w-3 h-3" />
                      Coupon <span className="font-mono">{couponCode}</span> is
                      scanned.
                    </div>
                  )}
                  {status === "unscanned" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
                      <Search className="w-3 h-3" />
                      Coupon <span className="font-mono">{couponCode}</span> is
                      not scanned.
                    </div>
                  )}
                  {status === "not_found" && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                      <Search className="w-3 h-3" />
                      No matching coupon found.
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 w-full mt-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    status === "scanned"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : status === "unscanned"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-slate-300"
                  }`}
                >
                  {status === "scanned" && (
                    <>
                      <Eraser className="w-3.5 h-3.5" />
                      Unscan Coupon
                    </>
                  )}
                  {status === "unscanned" && (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Coupon
                    </>
                  )}
                  {(status === "idle" ||
                    status === "checking" ||
                    status === "not_found") &&
                    "Find Coupon"}
                </button>
              </div>
            </form>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center py-4 w-full">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Processing Coupon...
              </h4>
              <p className="text-[11px] text-[#94a3b8] font-medium mt-2">
                Looking up the coupon and applying the right action. Please
                wait.
              </p>
            </div>
          )}

          {step === "success" && result && (
            <div className="w-full flex flex-col items-center py-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                {result.action === "unscanned"
                  ? "Coupon Unscanned"
                  : "Coupon Deleted"}
              </h4>
              <p className="text-xs text-[#64748b] font-medium mb-5">
                Coupon{" "}
                <strong className="text-slate-700 font-mono">
                  {result.couponCode}
                </strong>{" "}
                {result.action === "unscanned"
                  ? "was already scanned, so it has been reset to not-scanned."
                  : "was not scanned, so it has been soft-deleted and removed from the trace list."}
              </p>
              <button
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
                Could Not Process Coupon
              </h4>
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-left w-full mb-5 max-h-[120px] overflow-y-auto">
                <p className="text-[11px] text-red-600 font-semibold leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
