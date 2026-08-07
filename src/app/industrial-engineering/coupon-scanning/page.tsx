"use client";

import React, { useState } from "react";
import { ScanLine, Construction } from "lucide-react";

export default function CouponScanningPage() {
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-6 max-w-[700px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
          <span>Industrial Engineering</span>
          <span className="text-[#94a3b8] font-light">/</span>
          <span className="text-[#4f46e5] font-bold">Coupon Scanning</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
          Coupon Scanning
        </h1>
        <p className="text-[11px] text-[#64748b]">
          Scan or enter a coupon code to record that it passed an operation.
        </p>
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-[#475569]">Coupon Code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Scan or type a coupon code"
            autoFocus
            className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
          />
        </label>
        <button
          disabled
          className="flex items-center justify-center gap-2 bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm opacity-40 cursor-not-allowed"
        >
          <ScanLine className="w-3.5 h-3.5" />
          <span>Record Scan</span>
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 flex items-start gap-3">
        <Construction className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm">Not wired up yet</h4>
          <p className="mt-1 text-xs text-amber-700">
            There&apos;s no coupon-tracking table/API in the database yet, so
            scans aren&apos;t recorded anywhere. This page is a placeholder
            for that once the backend exists.
          </p>
        </div>
      </div>
    </div>
  );
}
