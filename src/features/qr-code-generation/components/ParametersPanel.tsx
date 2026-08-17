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
  onResetSequence?: () => void;
  onPrintUnScan?: () => void;
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
  onResetSequence = () => alert("Sequence reset successful."),
  onPrintUnScan = () => alert("Printing un-scanned coupons."),
  generatingCoupons = false,
  customersList = [],
  workersList = [],
}: ParametersPanelProps) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Input Fields Column (9 cols) */}
      <div className="lg:col-span-9 flex flex-col gap-4">
        {/* Row 1: Customer, Work Order, Style Code */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">
              Customer
            </label>
            <select
              value={activeStyle.customer}
              onChange={(e) => onFieldChange("customer", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all cursor-pointer"
            >
              <option value="">Select Customer</option>
              {customersList.map((cust) => (
                <option key={cust} value={cust}>
                  {cust}
                </option>
              ))}
              {activeStyle.customer && !customersList.includes(activeStyle.customer) && (
                <option value={activeStyle.customer}>{activeStyle.customer}</option>
              )}
            </select>
          </div>

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
              Style Code
            </label>
            <input
              type="text"
              value={activeStyle.styleCode}
              onChange={(e) => onFieldChange("styleCode", e.target.value)}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
            />
          </div>
        </div>

        {/* Row 2: Generate By, Generate Datetime */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">
              Generate By
            </label>
            <div className="relative w-full">
              <Autocomplete<WorkerItem>
                value={activeStyle.generateBy}
                onChange={(val) => onFieldChange("generateBy", val)}
                onSelect={(worker) => onFieldChange("generateBy", String(worker.EmployeeID))}
                fetchSuggestions={async (q) => {
                  const res = await fetch(`/api/open-order/suggestions?type=workers&query=${encodeURIComponent(q)}`);
                  if (res.ok) {
                    return res.json();
                  }
                  return [];
                }}
                renderSuggestion={(item) => (
                  <span className="font-semibold text-slate-700">
                    {item.EmployeeID} - {item.FirstName}
                  </span>
                )}
                getSuggestionValue={(item) => String(item.EmployeeID)}
                minChars={1}
                placeholder="Enter Operator ID / Name"
                className="w-full"
                inputClassName="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">
              Generate Datetime
            </label>
            <div className="relative">
              <input
                type="text"
                value={activeStyle.generateDatetime || new Date().toLocaleString()}
                onChange={(e) => onFieldChange("generateDatetime", e.target.value)}
                className="w-full px-3 py-2 pr-9 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
              />
              <Calendar className="absolute right-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Buttons & Year Column (3 cols) */}
      <div className="lg:col-span-3 flex flex-col gap-4 border-l border-[#f1f5f9] pl-0 lg:pl-6 pt-4 lg:pt-0 justify-between">
        {/* Active Year & Current Year */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#64748b]">
            <span>Active Year</span>
            <span className="text-[#4f46e5] font-extrabold text-sm">2026</span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-[#64748b]">
            <span>Current Year</span>
            <span className="text-[#4f46e5] font-extrabold text-sm">2026</span>
          </div>
        </div>

        {/* Buttons Grid */}
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onGenerateCoupons}
              disabled={generatingCoupons}
              className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 disabled:opacity-50 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center"
            >
              {generatingCoupons ? "Generating..." : "Generate Coupons"}
            </button>
            <button
              onClick={onResetSequence}
              className="bg-white border border-red-200 hover:bg-red-50 text-red-600 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center"
            >
              Reset Sequence
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenPageSetupModal}
              className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center"
            >
              Print
            </button>
            <button
              onClick={onPrintUnScan}
              className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center justify-center text-center"
            >
              Print Un-Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
