"use client";

import React from "react";
import { Search } from "lucide-react";
import type { QrCodeStyleData } from "../types";

interface WorkerItem {
  EmployeeID: number;
  FirstName: string;
}
interface ParametersPanelProps {
  activeStyle: QrCodeStyleData;
  onOpenWorkOrderSearch: () => void;
  onOpenPageSetupModal: () => void;
  onGenerateCoupons: () => void;
  generatingCoupons?: boolean;
  customersList: string[];
  workersList: WorkerItem[];
  isSelectionGenerated: boolean;
}
export function ParametersPanel({
  activeStyle,
  onOpenWorkOrderSearch,
  onOpenPageSetupModal,
  onGenerateCoupons,
  generatingCoupons = false,
  customersList = [],
  workersList = [],
  isSelectionGenerated,
}: ParametersPanelProps) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
      {/* Left Input Fields Column (9 cols) */}
      <div className="lg:col-span-9">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
           <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">
              Work Order
            </label>
            <button
              type="button"
              onClick={onOpenWorkOrderSearch}
              className="relative w-full text-left cursor-pointer"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
              <span className="block w-full pl-9 pr-3 py-2 rounded-xl border border-[#e2e8f0] bg-white text-xs text-slate-800 font-semibold hover:border-[#4f46e5] transition-all truncate">
                {activeStyle.workOrder || "Search Work Order..."}
              </span>
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">
              Customer
            </label>
            <input
              type="text"
              value={activeStyle.customer}
              readOnly
              placeholder="Customer Name"
              className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">
              Style Code
            </label>
            <input
              type="text"
              value={activeStyle.styleCode}
              readOnly
              placeholder="Style Code"
              className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">
              Generate By
            </label>
            <input
              type="text"
              value={activeStyle.generateBy}
              readOnly
              placeholder="Operator Name"
              className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
            />
          </div>

        </div>
      </div>

      {/* Right Buttons & Year Column (3 cols) */}
      <div className="lg:col-span-3 flex flex-col gap-3 border-l border-[#f1f5f9] pl-0 lg:pl-6 pt-4 lg:pt-0 justify-center">
        {/* Active Year */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#64748b]">
            <span>Active Year</span>
            <span className="text-[#4f46e5] font-extrabold text-sm">{new Date().getFullYear()}</span>
          </div>
        </div>

        {/* Buttons Grid */}
        {(() => {
          const isWorkOrderEntered = activeStyle.workOrder && activeStyle.workOrder.trim() !== "";
          const isGenerateDisabled = !isWorkOrderEntered || generatingCoupons;
          const isPrintDisabled = !isWorkOrderEntered || !isSelectionGenerated;

          return (
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onGenerateCoupons}
                  disabled={isGenerateDisabled}
                  className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center cursor-pointer"
                >
                  {generatingCoupons ? "Generating..." : "Generate Coupons"}
                </button>
                <button
                  onClick={onOpenPageSetupModal}
                  disabled={isPrintDisabled}
                  className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center cursor-pointer"
                >
                  Print
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
