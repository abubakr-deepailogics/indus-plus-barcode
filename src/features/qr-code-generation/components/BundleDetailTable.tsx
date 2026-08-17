"use client";

import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import type { BundleDetailRow } from "../types";

interface BundleDetailTableProps {
  bundles: BundleDetailRow[];
  reworkQtyBundle: string;
  subTotal: string;
  total: string;
  onBundleSelChange: (id: number, checked: boolean) => void;
  onAllBundlesSelChange: (checked: boolean) => void;
  onReworkQtyBundleChange: (value: string) => void;
}

export function BundleDetailTable({
  bundles,
  reworkQtyBundle,
  subTotal,
  total,
  onBundleSelChange,
  onAllBundlesSelChange,
  onReworkQtyBundleChange,
}: BundleDetailTableProps) {
  const [isCutWise, setIsCutWise] = useState(false);
  const [isSizeWise, setIsSizeWise] = useState(false);

  return (
    <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
        <h3 className="text-sm font-extrabold text-[#4f46e5]">Cutting Detail</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748b]">
              Complete selection
            </span>
            <input
              type="checkbox"
              onChange={(e) => {
                onAllBundlesSelChange(e.target.checked);
              }}
              className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748b]">
              Cut Wise selection
            </span>
            <input
              type="checkbox"
              checked={isCutWise}
              onChange={(e) => {
                setIsCutWise(e.target.checked);
                if (e.target.checked) setIsSizeWise(false);
              }}
              className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748b]">
              Size Wise selection
            </span>
            <input
              type="checkbox"
              checked={isSizeWise}
              onChange={(e) => {
                setIsSizeWise(e.target.checked);
                if (e.target.checked) setIsCutWise(false);
              }}
              className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-[#e2e8f0]">
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">
                Trans Id
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Cut #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Char
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Line
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Bundle #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Inseam
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Size #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Pcs
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                R.Pcs
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Sel
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {bundles.map((bd) => (
              <tr key={bd.id} className="hover:bg-[#f8fafc] border-b border-[#f1f5f9] transition-colors text-[11px] font-semibold text-slate-700">
                <td className="py-2.5 text-left text-slate-500 font-medium">
                  {bd.transId}
                </td>
                <td className="py-2.5 text-center text-[#4f46e5] font-bold">
                  {bd.cutNo}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-bold uppercase">
                  {bd.char}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-medium">
                  {bd.line}
                </td>
                <td className="py-2.5 text-center text-purple-600 font-bold font-mono">
                  {bd.bundleNo}
                </td>
                <td className="py-2.5 text-center text-[#64748b] font-medium">
                  {bd.inseam}
                </td>
                <td className="py-2.5 text-center text-slate-700 font-semibold">
                  {bd.size}
                </td>
                <td className="py-2.5 text-center text-slate-900 font-bold">
                  {bd.pcs}
                </td>
                <td className="py-2.5 text-center text-slate-400 font-medium">
                  {bd.rPcs || "-"}
                </td>
                <td className="py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={bd.sel}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      if (isCutWise) {
                        bundles.forEach((b) => {
                          if (b.cutNo === bd.cutNo) {
                            onBundleSelChange(b.id, isChecked);
                          }
                        });
                      } else if (isSizeWise) {
                        bundles.forEach((b) => {
                          if (b.size === bd.size) {
                            onBundleSelChange(b.id, isChecked);
                          }
                        });
                      } else {
                        onBundleSelChange(bd.id, isChecked);
                      }
                    }}
                    className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
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
