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

interface UnscanOrDeleteResult {
  unscannedCount: number;
  deletedCount: number;
}

type CouponFields = {
  workOrder: string;
  cutNo: string;
  bundleNo: string;
  opNo: string;
};

interface UnscanOrDeleteCouponModalProps {
  workOrder: string;
  onClose: () => void;
  onDone: () => void;
  // Unscan and delete are separate requests (separate API routes) now,
  // rather than one combined "submit" — the modal decides which to call
  // based on the current match's scanned/unscanned split.
  submitUnscan: (fields: CouponFields) => Promise<{ unscannedCount: number }>;
  submitDelete: (fields: CouponFields) => Promise<{ deletedCount: number }>;
}

type Step = "form" | "confirm" | "processing" | "success" | "error";
type MatchStatus = "idle" | "checking" | "matched" | "not_found";

interface MatchCounts {
  totalCount: number;
  scannedCount: number;
  unscannedCount: number;
}

const FIELD_LABEL =
  "text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1.5 block";
const FIELD_INPUT =
  "w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-400 transition-all";

// Manual lookup-and-act: user keys in whichever of the fields printed on the
// physical coupon(s) they have (Cut, Bundle, Operation) — none of the three
// is required, Work Order (already selected on the page) is the only fixed
// scope. Whatever subset is filled in narrows the match; leaving all three
// empty scopes the action to every coupon on the work order, so a match can
// be many coupons rather than one — the modal always shows the match count
// and requires an explicit confirm before acting on a set larger than one.
// The action per coupon isn't chosen by the user: the server (see
// /api/coupons/unscan-or-delete) unscans whichever matched coupons are
// currently scanned and soft-deletes the rest (never a hard DELETE) — so a
// coupon is never deleted while still scanned.
export function UnscanOrDeleteCouponModal({
  workOrder,
  onClose,
  onDone,
  submitUnscan,
  submitDelete,
}: UnscanOrDeleteCouponModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [cutNo, setCutNo] = useState("");
  const [bundleNo, setBundleNo] = useState("");
  const [opNo, setOpNo] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<UnscanOrDeleteResult | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("idle");
  const [matchCounts, setMatchCounts] = useState<MatchCounts | null>(null);

  const canReview = step === "form" && matchStatus === "matched";

  const requestIdRef = useRef(0);
  useEffect(() => {
    if (step !== "form") return;
    const requestId = ++requestIdRef.current;
    setMatchStatus("checking");
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
          setMatchStatus("not_found");
          setMatchCounts(null);
          return;
        }
        const data = await res.json();
        setMatchCounts({
          totalCount: data.totalCount,
          scannedCount: data.scannedCount,
          unscannedCount: data.unscannedCount,
        });
        setMatchStatus("matched");
      } catch {
        if (requestIdRef.current !== requestId) return;
        setMatchStatus("not_found");
        setMatchCounts(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [workOrder, cutNo, bundleNo, opNo, step]);

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

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canReview) return;
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!matchCounts) return;
    setStep("processing");
    setErrorMessage("");
    try {
      const fields = {
        workOrder,
        cutNo: cutNo.trim(),
        bundleNo: bundleNo.trim(),
        opNo: opNo.trim(),
      };
      let unscannedCount = 0;
      let deletedCount = 0;
      // Delete first, then unscan: delete only ever touches coupons that
      // are unscanned *before* this action runs, and unscan only touches
      // ones that are scanned *before* this action runs — each route
      // re-matches against current DB state at call time (see
      // src/app/api/coupons/unscan-or-delete/{delete,unscan}/route.ts), so
      // running delete first guarantees it can never catch a coupon this
      // same click is about to unscan.
      if (matchCounts.unscannedCount > 0) {
        const res = await submitDelete(fields);
        deletedCount = res.deletedCount;
      }
      if (matchCounts.scannedCount > 0) {
        const res = await submitUnscan(fields);
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

  // Drives both the confirm-step wording and its button label/icon — a
  // homogeneous match (all-scanned or all-unscanned) only mentions/performs
  // the one applicable action; a mixed match still does both, same as
  // before, just described accurately instead of behind a generic
  // "Confirm".
  const confirmAction: "unscan" | "delete" | "both" | null = matchCounts
    ? matchCounts.scannedCount > 0 && matchCounts.unscannedCount === 0
      ? "unscan"
      : matchCounts.unscannedCount > 0 && matchCounts.scannedCount === 0
        ? "delete"
        : matchCounts.scannedCount > 0 && matchCounts.unscannedCount > 0
          ? "both"
          : null
    : null;

  const hasFilter = !!(cutNo.trim() || bundleNo.trim() || opNo.trim());

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
                ? "Done"
                : step === "error"
                  ? "Action Failed"
                  : step === "confirm"
                    ? "Confirm Action"
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
            <form onSubmit={handleReview} className="w-full">
              <p className="text-sm text-slate-800 font-medium mb-4 text-left leading-relaxed">
                Enter as much of the coupon details as you have — leave any of
                Cut/Bundle/Operation blank to match more coupons. Leave all
                three blank to match every coupon on this work order. Matched
                coupons that are already scanned will be{" "}
                <strong className="text-slate-700">unscanned</strong>; the
                rest will be <strong className="text-slate-700">deleted</strong>
                .
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
                    placeholder="Any"
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
                    placeholder="Any"
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
                    placeholder="Any"
                    inputClassName={FIELD_INPUT}
                  />
                </div>
              </div>

              <div className="mt-3 text-left">
                {matchStatus === "checking" && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking matching coupons...
                  </div>
                )}
                {matchStatus === "matched" && matchCounts && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                    <Search className="w-3 h-3" />
                    {matchCounts.totalCount} coupon
                    {matchCounts.totalCount === 1 ? "" : "s"} match
                    {!hasFilter && " (entire work order)"} —{" "}
                    {matchCounts.scannedCount} scanned,{" "}
                    {matchCounts.unscannedCount} not scanned.
                  </div>
                )}
                {matchStatus === "not_found" && (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Search className="w-3 h-3" />
                    No matching coupons found.
                  </div>
                )}
              </div>

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
                  disabled={!canReview}
                  className="flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Review
                </button>
              </div>
            </form>
          )}

          {step === "confirm" && matchCounts && confirmAction && (
            <div className="w-full flex flex-col items-center py-2">
              <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Confirm this action
              </h4>
              <p className="text-sm text-slate-800 font-medium mb-5 text-left leading-relaxed">
                {confirmAction === "unscan" && (
                  <>
                    This will{" "}
                    <strong className="text-amber-700">
                      unscan {matchCounts.scannedCount} coupon
                      {matchCounts.scannedCount === 1 ? "" : "s"}
                    </strong>{" "}
                    on work order{" "}
                    <strong className="text-slate-700">{workOrder}</strong>
                    {!hasFilter && " — every coupon on this work order"}.
                  </>
                )}
                {confirmAction === "delete" && (
                  <>
                    This will{" "}
                    <strong className="text-red-600">
                      delete {matchCounts.unscannedCount} coupon
                      {matchCounts.unscannedCount === 1 ? "" : "s"}
                    </strong>{" "}
                    on work order{" "}
                    <strong className="text-slate-700">{workOrder}</strong>
                    {!hasFilter && " — every coupon on this work order"}. This
                    cannot be undone from this screen.
                  </>
                )}
                {confirmAction === "both" && (
                  <>
                    This will affect{" "}
                    <strong className="text-slate-700">
                      {matchCounts.totalCount} coupon
                      {matchCounts.totalCount === 1 ? "" : "s"}
                    </strong>{" "}
                    on work order{" "}
                    <strong className="text-slate-700">{workOrder}</strong>:{" "}
                    <strong className="text-amber-700">
                      {matchCounts.scannedCount} unscanned
                    </strong>{" "}
                    and{" "}
                    <strong className="text-red-600">
                      {matchCounts.unscannedCount} deleted
                    </strong>
                    . This cannot be undone from this screen.
                  </>
                )}
              </p>
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="flex-1 bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    confirmAction === "unscan"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {confirmAction === "unscan" && (
                    <>
                      <Eraser className="w-3.5 h-3.5" />
                      Unscan Coupon{matchCounts.scannedCount === 1 ? "" : "s"}
                    </>
                  )}
                  {confirmAction === "delete" && (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Coupon{matchCounts.unscannedCount === 1 ? "" : "s"}
                    </>
                  )}
                  {confirmAction === "both" && "Unscan & Delete"}
                </button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center py-4 w-full">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Processing Coupons...
              </h4>
              <p className="text-[11px] text-[#94a3b8] font-medium mt-2">
                Applying the right action to each matched coupon. Please wait.
              </p>
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
                    <strong className="text-slate-700">
                      {result.unscannedCount}
                    </strong>{" "}
                    unscanned
                    {result.deletedCount > 0 ? ", " : "."}
                  </>
                )}
                {result.deletedCount > 0 && (
                  <>
                    <strong className="text-slate-700">
                      {result.deletedCount}
                    </strong>{" "}
                    deleted.
                  </>
                )}
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
                Could Not Process Coupons
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
