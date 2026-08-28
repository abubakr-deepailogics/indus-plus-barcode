"use client";

import React from "react";
import { X } from "lucide-react";
import type { QrCodeStyleData } from "../types";

interface StyleSearchModalProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filteredStyles: QrCodeStyleData[];
  allStyles: QrCodeStyleData[];
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function StyleSearchModal({
  searchQuery,
  onSearchQueryChange,
  filteredStyles,
  allStyles,
  selectedIdx,
  onSelectIdx,
  onConfirm,
  onClose,
}: StyleSearchModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[500px] w-full p-6 animate-scale-up">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-4">
          <h3 className="text-sm font-extrabold text-[#0f172a]">
            Select ANL# Style
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="font-bold text-[#475569] text-xs min-w-[40px]">
            Find
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5]"
            placeholder="Search ANL# or Customer..."
          />
        </div>

        <div className="border border-[#e2e8f0] rounded-xl overflow-hidden mb-5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-24">
                  Work Order
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-28">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                  Style Code
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStyles.map((style) => (
                <tr
                  key={style.workOrder}
                  onClick={() => onSelectIdx(allStyles.indexOf(style))}
                  className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${
                    selectedIdx === allStyles.indexOf(style)
                      ? "bg-indigo-50/50"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#334155]">
                    <input
                      type="radio"
                      checked={selectedIdx === allStyles.indexOf(style)}
                      onChange={() => onSelectIdx(allStyles.indexOf(style))}
                      className="text-[#4f46e5]"
                    />
                    <span>{style.workOrder}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-[#64748b]">
                    {style.customer}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#334155]">
                    {style.styleCode}
                  </td>
                </tr>
              ))}
              {filteredStyles.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center py-4 text-[#94a3b8]"
                  >
                    No styles found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-4">
          <span className="text-[11px] text-[#94a3b8] font-semibold">
            {filteredStyles.length} results found
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
