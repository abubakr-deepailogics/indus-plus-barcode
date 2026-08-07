"use client";

import React, { useState } from "react";
import { Search, Construction } from "lucide-react";

export default function CouponTracingPage() {
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-6 max-w-[900px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
          <span>Industrial Engineering</span>
          <span className="text-[#94a3b8] font-light">/</span>
          <span className="text-[#4f46e5] font-bold">Coupon Tracing</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
          Coupon Tracing
        </h1>
        <p className="text-[11px] text-[#64748b]">
          Look up a coupon or bundle to see its scan history across operations.
        </p>
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
        <div className="flex items-stretch gap-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Coupon code, bundle ID, or work order"
            className="flex-grow px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
          />
          <button
            disabled
            className="flex items-center justify-center gap-2 bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm opacity-40 cursor-not-allowed"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Trace</span>
          </button>
        </div>
      </div>

      {/* Placeholder results table shape */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden opacity-60">
        <div className="border-b border-[#e2e8f0] px-5 py-4 bg-[#fafafa]">
          <h3 className="text-sm font-bold text-[#0f172a]">Scan History</h3>
        </div>
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
            <tr>
              <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Operation</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Scanned At</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Scanned By</th>
              <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-[#94a3b8]">
                No data — search above
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 flex items-start gap-3">
        <Construction className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm">Not wired up yet</h4>
          <p className="mt-1 text-xs text-amber-700">
            There&apos;s no coupon-tracking table/API in the database yet, so
            there&apos;s no scan history to trace. This page is a placeholder
            for that once the backend exists.
          </p>
        </div>
      </div>
    </div>
  );
}
