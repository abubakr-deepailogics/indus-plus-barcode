"use client";

import { X, FileText } from "lucide-react";
import type { PageSetupConfig } from "../types";

interface PageSetupModalProps {
  pageSetup: PageSetupConfig;
  onPageSetupChange: (config: PageSetupConfig) => void;
  onClose: () => void;
  onPrint: () => void;
}

export function PageSetupModal({
  pageSetup,
  onPageSetupChange,
  onClose,
  onPrint,
}: PageSetupModalProps) {
  return (
    <div className="no-print fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[500px] w-full p-6 animate-scale-up text-xs text-[#334155] font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
          <h3 className="text-sm font-extrabold text-[#0f172a]">Page Setup</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Document Preview Illustration */}
        <div className="flex justify-center mb-6">
          <div className="relative w-36 h-44 bg-white border border-gray-300 rounded-md shadow-md flex items-center justify-center p-2">
            <div
              className="w-full h-full border border-dashed border-[#4f46e5]/40 rounded bg-gray-50/50 flex flex-col justify-between p-2"
              style={{
                paddingLeft: `${Math.max(2, pageSetup.margins.left * 15)}px`,
                paddingRight: `${Math.max(2, pageSetup.margins.right * 15)}px`,
                paddingTop: `${Math.max(2, pageSetup.margins.top * 15)}px`,
                paddingBottom: `${Math.max(2, pageSetup.margins.bottom * 15)}px`,
                transform:
                  pageSetup.orientation === "Landscape"
                    ? "rotate(-90deg)"
                    : "none",
                transition: "all 0.2s ease",
              }}
            >
              <div className="flex flex-col gap-1 w-full">
                <div className="h-1.5 w-8/12 bg-gray-300 rounded" />
                <div className="h-1 bg-gray-200 rounded w-full" />
                <div className="h-1 bg-gray-200 rounded w-10/12" />
                <div className="h-1 bg-gray-200 rounded w-11/12" />
              </div>
              <div className="flex flex-col gap-1 w-full items-center">
                <div className="h-3 w-full bg-gray-300/60 rounded flex items-center justify-center text-[5px] text-gray-500 font-bold font-mono">
                  BARCODE
                </div>
              </div>
              <div className="h-1.5 w-4/12 bg-gray-300 rounded self-end" />
            </div>
            <div className="absolute top-0 right-0 w-3 h-3 bg-white border-l border-b border-gray-300 rounded-bl-sm" />
          </div>
        </div>

        {/* Paper Section */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-[#4f46e5]" />
            <span className="font-bold text-[#4f46e5] text-[11px] uppercase tracking-wider">
              Paper
            </span>
            <div className="flex-1 h-[1px] bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 gap-3 pl-6">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-500 w-20">Size</span>
              <select
                value={pageSetup.size}
                onChange={(e) =>
                  onPageSetupChange({ ...pageSetup, size: e.target.value })
                }
                className="flex-1 max-w-[280px] px-3 py-2 rounded-xl border border-[#e2e8f0] bg-white font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Legal">Legal</option>
                <option value="Letter">Letter</option>
                <option value="A4">A4</option>
                <option value="4x6 Label">4x6 Label (Thermal)</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-500 w-20">Source</span>
              <select
                value={pageSetup.source}
                onChange={(e) =>
                  onPageSetupChange({ ...pageSetup, source: e.target.value })
                }
                className="flex-1 max-w-[280px] px-3 py-2 rounded-xl border border-[#e2e8f0] bg-white font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Automatically Select">
                  Automatically Select
                </option>
                <option value="Manual Feed">Manual Feed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Orientation & Margins Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6">
          <div className="md:col-span-5 border border-gray-100 rounded-2xl p-4 bg-gray-50/30">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="font-bold text-[#4f46e5] text-[11px] uppercase tracking-wider">
                Orientation
              </span>
            </div>
            <div className="flex flex-col gap-2.5 pl-1">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                <input
                  type="radio"
                  name="orientation"
                  checked={pageSetup.orientation === "Portrait"}
                  onChange={() =>
                    onPageSetupChange({ ...pageSetup, orientation: "Portrait" })
                  }
                  className="text-[#4f46e5] focus:ring-indigo-500"
                />
                <span>Portrait</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                <input
                  type="radio"
                  name="orientation"
                  checked={pageSetup.orientation === "Landscape"}
                  onChange={() =>
                    onPageSetupChange({
                      ...pageSetup,
                      orientation: "Landscape",
                    })
                  }
                  className="text-[#4f46e5] focus:ring-indigo-500"
                />
                <span>Landscape</span>
              </label>
            </div>
          </div>

          <div className="md:col-span-7 border border-gray-100 rounded-2xl p-4 bg-gray-50/30">
            <div className="flex items-center gap-1.5 mb-3">
              <FileText className="w-3.5 h-3.5 text-[#4f46e5]" />
              <span className="font-bold text-[#4f46e5] text-[11px] uppercase tracking-wider">
                Margins (inches)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {(["left", "right", "top", "bottom"] as const).map((side) => (
                <div
                  key={side}
                  className="flex items-center justify-between gap-1"
                >
                  <span className="font-bold text-gray-500 text-[10px] capitalize">
                    {side}
                  </span>
                  <input
                    type="number"
                    step="0.001"
                    value={pageSetup.margins[side]}
                    onChange={(e) =>
                      onPageSetupChange({
                        ...pageSetup,
                        margins: {
                          ...pageSetup.margins,
                          [side]: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-16 px-1.5 py-1 text-center border border-[#e2e8f0] rounded-lg font-bold"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={onClose}
            className="bg-white border border-[#e2e8f0] text-gray-600 px-5 py-2.5 rounded-xl font-bold hover:bg-[#f8fafc] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onPrint}
            className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-7 py-2.5 rounded-xl font-bold transition-all shadow-md"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
