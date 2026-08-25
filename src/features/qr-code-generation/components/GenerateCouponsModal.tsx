"use client";

import React from "react";
import { X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface GenerateCouponsModalProps {
  state: "confirm" | "generating" | "success" | "error";
  selectedBundlesCount: number;
  selectedOperationsCount: number;
  generatedCount?: number;
  progress?: { done: number; total: number } | null;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function GenerateCouponsModal({
  state,
  selectedBundlesCount,
  selectedOperationsCount,
  generatedCount = 0,
  progress = null,
  errorMessage = "",
  onClose,
  onConfirm,
}: GenerateCouponsModalProps) {
  const totalToGenerate = selectedBundlesCount * selectedOperationsCount;

  return (
    <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[420px] w-full p-6 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 mb-4">
          <h3 className="text-sm font-extrabold text-[#0f172a]">
            {state === "confirm" && "Confirm Generation"}
            {state === "generating" && "Generating Coupons"}
            {state === "success" && "Success"}
            {state === "error" && "Error"}
          </h3>
          {state !== "generating" && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center text-center py-2">
          {state === "confirm" && (
            <div className="w-full">
              <p className="text-xs text-[#64748b] font-medium mb-4">
                Are you sure you want to generate barcode coupons with the following selections?
              </p>

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                    Bundles
                  </span>
                  <span className="text-base font-extrabold text-slate-800">
                    {selectedBundlesCount}
                  </span>
                </div>
                <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-1">
                    Operations
                  </span>
                  <span className="text-base font-extrabold text-slate-800">
                    {selectedOperationsCount}
                  </span>
                </div>
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-[#4f46e5] uppercase tracking-wider mb-1">
                    Total Coupons
                  </span>
                  <span className="text-base font-extrabold text-[#4f46e5]">
                    {totalToGenerate}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full mt-2">
                <button
                  onClick={onClose}
                  className="flex-1 bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Yes, Generate
                </button>
              </div>
            </div>
          )}

          {state === "generating" && (
            <div className="flex flex-col items-center py-4 w-full">
              <Loader2 className="w-10 h-10 text-[#4f46e5] animate-spin mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Generating {totalToGenerate} Coupons...
              </h4>
              {progress && progress.total > 0 && (
                <div className="w-full mt-3 mb-1">
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-[#4f46e5] transition-all duration-200"
                      style={{ width: `${Math.min(100, (progress.done / progress.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#64748b] font-semibold mt-1.5">
                    {progress.done} of {progress.total} coupons registered
                  </p>
                </div>
              )}
              <p className="text-[11px] text-[#94a3b8] font-medium mt-2">
                Registering barcode identities in the database. Please do not close or refresh this page.
              </p>
            </div>
          )}

          {state === "success" && (
            <div className="w-full flex flex-col items-center py-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Coupons Generated Successfully!
              </h4>
              <p className="text-xs text-[#64748b] font-medium mb-5">
                Total coupon identities registered: <strong className="text-emerald-600">{generatedCount}</strong>
              </p>
              <button
                onClick={onClose}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {state === "error" && (
            <div className="w-full flex flex-col items-center py-2">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <h4 className="text-sm font-extrabold text-slate-800 mb-1">
                Failed to Generate Coupons
              </h4>
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-left w-full mb-5 max-h-[120px] overflow-y-auto">
                <p className="text-[11px] text-red-600 font-semibold leading-relaxed">
                  {errorMessage || "An unexpected error occurred during coupon generation."}
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
                  onClick={onConfirm}
                  className="flex-1 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
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
