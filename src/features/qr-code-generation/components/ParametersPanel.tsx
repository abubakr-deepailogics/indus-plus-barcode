"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import type { QrCodeStyleData } from "../types";

interface WorkerItem {
  EmployeeID: number;
  FirstName: string;
}

interface ParametersPanelProps {
  activeStyle: QrCodeStyleData;
  onWorkOrderInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenSearchModal: () => void;
  onOpenPageSetupModal: () => void;
  onFieldChange: (field: keyof QrCodeStyleData, value: string) => void;
  onGenerateCoupons: () => void;
  generatingCoupons?: boolean;
  customersList: string[];
  workersList: WorkerItem[];
}

export function ParametersPanel({
  activeStyle,
  onWorkOrderInputChange,
  onOpenSearchModal,
  onOpenPageSetupModal,
  onFieldChange,
  onGenerateCoupons,
  generatingCoupons = false,
  customersList = [],
  workersList = [],
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
            <div className="relative w-full">
              <Autocomplete<string>
                value={activeStyle.workOrder}
                onChange={(val) => onFieldChange("workOrder", val)}
                onSelect={(val) => {
                  onWorkOrderInputChange({
                    target: { value: val }
                  } as React.ChangeEvent<HTMLInputElement>);
                }}
                fetchSuggestions={async (q) => {
                  const res = await fetch(`/api/open-order/suggestions?query=${encodeURIComponent(q)}`);
                  if (res.ok) {
                    return res.json();
                  }
                  return [];
                }}
                renderSuggestion={(item) => <span className="font-semibold text-slate-700">{item}</span>}
                getSuggestionValue={(item) => item}
                minChars={2}
                placeholder="Enter Work Order"
                className="w-full"
                inputClassName="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
            </div>
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
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onGenerateCoupons}
              disabled={generatingCoupons}
              className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 disabled:opacity-50 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center cursor-pointer"
            >
              {generatingCoupons ? "Generating..." : "Generate Coupons"}
            </button>
            <button
              onClick={onOpenPageSetupModal}
              className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center cursor-pointer"
            >
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
