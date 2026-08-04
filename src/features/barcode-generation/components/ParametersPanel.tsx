"use client";

import React from "react";
import { Printer, Layers } from "lucide-react";
import type { BarcodeStyleData } from "../types";

interface ParametersPanelProps {
  activeStyle: BarcodeStyleData;
  onAnlInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenSearchModal: () => void;
  onOpenPageSetupModal: () => void;
  onFieldChange: (field: keyof BarcodeStyleData, value: string) => void;
}

export function ParametersPanel({
  activeStyle,
  onAnlInputChange,
  onOpenSearchModal,
  onOpenPageSetupModal,
  onFieldChange,
}: ParametersPanelProps) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
      <div className="lg:col-span-10 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="font-bold text-[#475569] text-[11px]">
            ANL#
          </label>
          <div className="flex gap-1">
            <input
              type="text"
              value={activeStyle.anlNo}
              onChange={onAnlInputChange}
              className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold focus:outline-none"
            />
            <button
              onClick={onOpenSearchModal}
              className="px-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 font-bold"
            >
              ...
            </button>
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
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
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
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-bold text-[#475569] text-[11px]">
            Total Wash
          </label>
          <input
            type="text"
            value={activeStyle.totalWash}
            onChange={(e) => onFieldChange("totalWash", e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
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
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-bold text-[#475569] text-[11px]">
            Generate Datetime
          </label>
          <input
            type="text"
            value={activeStyle.generateDatetime}
            readOnly
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-bold text-[#475569] text-[11px]">
            Balance
          </label>
          <input
            type="text"
            value={activeStyle.balance}
            readOnly
            className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[10px] uppercase">
              Generated Coupons
            </label>
            <input
              type="text"
              value={activeStyle.generatedCoupons}
              readOnly
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[10px] uppercase">
              Generated Bundle
            </label>
            <input
              type="text"
              value={activeStyle.generatedBundle}
              readOnly
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
            />
          </div>
        </div>

        <div className="md:col-span-4 flex flex-col gap-1.5">
          <label className="font-bold text-[#475569] text-[11px]">
            Notes
          </label>
          <input
            type="text"
            value={activeStyle.notes}
            onChange={(e) => onFieldChange("notes", e.target.value)}
            placeholder="Enter notes (optional)"
            className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
          />
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-2.5 w-full">
        <button
          onClick={onOpenPageSetupModal}
          className="w-full flex items-center justify-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc] py-2.5 rounded-xl font-bold transition-all shadow-sm"
        >
          <Printer className="w-3.5 h-3.5" />
          Print
        </button>
        <button className="w-full flex items-center justify-center gap-1.5 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#7c3aed] border border-[#ddd6fe] py-2.5 rounded-xl font-bold transition-colors">
          <Layers className="w-3.5 h-3.5" />
          Manual Gen. Bundle
        </button>
      </div>
    </div>
  );
}
