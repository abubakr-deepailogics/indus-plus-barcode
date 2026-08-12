"use client";

import { HelpCircle } from "lucide-react";
import type { BundleDetailRow } from "../types";

interface BundleDetailTableProps {
  bundles: BundleDetailRow[];
  reworkQtyBundle: string;
  subTotal: string;
  total: string;
  onBundleSelChange: (id: number, checked: boolean) => void;
  onReworkQtyBundleChange: (value: string) => void;
}

export function BundleDetailTable({
  bundles,
  reworkQtyBundle,
  subTotal,
  total,
  onBundleSelChange,
  onReworkQtyBundleChange,
}: BundleDetailTableProps) {
  return (
    <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
        <h3 className="text-sm font-extrabold text-[#4f46e5]">Bundle Detail</h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-[#64748b]">
            Complete selection
          </span>
          <input
            type="checkbox"
            defaultChecked
            className="rounded border-[#e2e8f0] text-[#4f46e5]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 py-0.5">
        <span className="font-bold text-red-600 text-xs flex items-center gap-1">
          Rework Qty &rarr;
        </span>
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={reworkQtyBundle}
            onChange={(e) => onReworkQtyBundleChange(e.target.value)}
            className="w-14 px-2 py-1 rounded-lg border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
          />
          <HelpCircle className="w-3.5 h-3.5 text-[#94a3b8]" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-[#e2e8f0]">
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Trans Id
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Line
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Bundle #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Inseam
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Size
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Pcs
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Sel
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                Code
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {bundles.map((bd) => (
              <tr key={bd.id} className="hover:bg-[#f8fafc] transition-colors">
                <td className="py-2 font-semibold">
                  <input
                    type="text"
                    value={bd.cutNo}
                    readOnly
                    className="w-full px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="text"
                    value={bd.line}
                    readOnly
                    className="w-10 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    value={bd.bundleNo}
                    readOnly
                    className="w-20 px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2 font-semibold text-[#64748b]">
                  <input
                    type="text"
                    value={bd.inseam}
                    readOnly
                    className="w-16 px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2">
                  <select className="px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none font-semibold">
                    <option value={bd.size}>Size {bd.size}</option>
                    <option value="28">Size 28</option>
                    <option value="30">Size 30</option>
                    <option value="32">Size 32</option>
                    <option value="34">Size 34</option>
                    <option value="36">Size 36</option>
                  </select>
                </td>
                <td className="py-2 text-center font-bold text-[#0f172a]">
                  <input
                    type="number"
                    value={bd.pcs}
                    readOnly
                    className="w-14 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={bd.sel}
                    onChange={(e) => onBundleSelChange(bd.id, e.target.checked)}
                    className="rounded border-[#e2e8f0] text-[#4f46e5]"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="text"
                    value={bd.code}
                    readOnly
                    className="w-14 px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#f1f5f9] items-end">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#64748b]">Sub Total</span>
          <input
            type="text"
            value={subTotal}
            readOnly
            className="w-36 px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs font-bold text-right"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#64748b]">Total</span>
          <input
            type="text"
            value={total}
            readOnly
            className="w-36 px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs font-bold text-right text-indigo-700 bg-indigo-50/20 border-indigo-100"
          />
        </div>
      </div>
    </div>
  );
}
