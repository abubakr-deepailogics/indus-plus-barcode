"use client";

import React from "react";
import { X, QrCode, Barcode } from "lucide-react";

interface CodeTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: "qr" | "barcode") => void;
}

export function CodeTypeSelectionModal({
  isOpen,
  onClose,
  onSelect,
}: CodeTypeSelectionModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="no-print fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[640px] w-full p-6 animate-scale-up text-xs text-[#334155] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
          <h3 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-wider">
            Select Coupon Format
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Text */}
        <p className="text-gray-500 mb-6 font-semibold">
          Choose the barcode format for printing your coupons. This will automatically adjust the layouts and margins in the next step.
        </p>

        {/* Grid Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* QR Code Option */}
          <button
            onClick={() => onSelect("qr")}
            className="group flex flex-col items-center text-center p-5 rounded-2xl border-2 border-[#e2e8f0] hover:border-[#4f46e5] hover:bg-indigo-50/10 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-md"
          >
            {/* SVG Visual */}
            <div className="w-20 h-20 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#4f46e5]/10 group-hover:scale-110 transition-all duration-300">
              <QrCode className="w-10 h-10 text-[#4f46e5] group-hover:text-[#4338ca] transition-colors" />
            </div>
            <span className="font-extrabold text-slate-800 text-[13px] mb-1.5">
              QR Code Coupons
            </span>
            <span className="text-[10px] text-gray-400 font-semibold leading-relaxed">
              Standard layout featuring 2x4 fields on the left and a square QR Code on the right.
            </span>
          </button>

          {/* Barcode Option */}
          <button
            onClick={() => onSelect("barcode")}
            className="group flex flex-col items-center text-center p-5 rounded-2xl border-2 border-[#e2e8f0] hover:border-[#4f46e5] hover:bg-indigo-50/10 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-sm hover:shadow-md"
          >
            {/* SVG Visual */}
            <div className="w-20 h-20 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#4f46e5]/10 group-hover:scale-110 transition-all duration-300">
              <Barcode className="w-10 h-10 text-[#4f46e5] group-hover:text-[#4338ca] transition-colors" />
            </div>
            <span className="font-extrabold text-slate-800 text-[13px] mb-1.5">
              Barcode Coupons
            </span>
            <span className="text-[10px] text-gray-400 font-semibold leading-relaxed">
              Premium layout featuring a 3x3 text grid on top, a dynamic vector barcode in the center, and operation name below.
            </span>
          </button>
        </div>

        {/* Footer/Cancel */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-slate-50 border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
