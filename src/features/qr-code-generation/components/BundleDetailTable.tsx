"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BundleDetailRow } from "../types";
import { getBundleDisplayNos } from "../services/bundle-display";

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
  const [openDropdown, setOpenDropdown] = useState<"cut" | "size" | null>(null);
  const cutDropdownRef = useRef<HTMLDivElement>(null);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);
  const bundleDisplayNos = useMemo(() => getBundleDisplayNos(bundles), [bundles]);

  const uniqueCuts = useMemo(
    () => Array.from(new Set(bundles.map((b) => b.cutNo))),
    [bundles],
  );
  const uniqueSizes = useMemo(
    () => Array.from(new Set(bundles.map((b) => b.size))),
    [bundles],
  );

  useEffect(() => {
    if (!openDropdown) return;
    const activeRef = openDropdown === "cut" ? cutDropdownRef : sizeDropdownRef;
    function handleClickOutside(event: MouseEvent) {
      if (activeRef.current && !activeRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdown]);

  function toggleGroupSelection(matching: BundleDetailRow[], checked: boolean) {
    matching.forEach((b) => onBundleSelChange(b.id, checked));
  }

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
          <div className="relative flex items-center gap-1.5" ref={cutDropdownRef}>
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
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === "cut" ? null : "cut"))}
              className="text-[#64748b] hover:text-[#4f46e5] cursor-pointer"
              aria-label="Select bundles by Cut #"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            {openDropdown === "cut" && (
              <div className="absolute right-0 top-full mt-1 min-w-[130px] max-h-56 overflow-y-auto bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5">
                {uniqueCuts.length === 0 ? (
                  <span className="px-2.5 py-1.5 text-[11px] text-slate-400">No cuts</span>
                ) : (
                  uniqueCuts.map((cutNo) => {
                    const matching = bundles.filter((b) => b.cutNo === cutNo);
                    const checked = matching.every((b) => b.sel);
                    return (
                      <label
                        key={cutNo}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-semibold text-slate-600 text-[11px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleGroupSelection(matching, e.target.checked)}
                          className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
                        />
                        <span>Cut {cutNo}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <div className="relative flex items-center gap-1.5" ref={sizeDropdownRef}>
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
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === "size" ? null : "size"))}
              className="text-[#64748b] hover:text-[#4f46e5] cursor-pointer"
              aria-label="Select bundles by Size #"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            {openDropdown === "size" && (
              <div className="absolute right-0 top-full mt-1 min-w-[130px] max-h-56 overflow-y-auto bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5">
                {uniqueSizes.length === 0 ? (
                  <span className="px-2.5 py-1.5 text-[11px] text-slate-400">No sizes</span>
                ) : (
                  uniqueSizes.map((size) => {
                    const matching = bundles.filter((b) => b.size === size);
                    const checked = matching.every((b) => b.sel);
                    return (
                      <label
                        key={size}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-semibold text-slate-600 text-[11px]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleGroupSelection(matching, e.target.checked)}
                          className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
                        />
                        <span>Size {size}</span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-[#e2e8f0]">
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Cut #
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                Char
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
                Sel
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {bundles.map((bd) => (
              <tr key={bd.id} className="hover:bg-[#f8fafc] border-b border-[#f1f5f9] transition-colors text-[11px] font-semibold text-slate-700">
                <td className="py-2.5 text-center text-[#4f46e5] font-bold">
                  {bd.cutNo}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-bold uppercase">
                  {bd.char}
                </td>
                <td className="py-2.5 text-center text-purple-600 font-bold font-mono">
                  {bundleDisplayNos.get(bd.id) ?? bd.bundleNo}
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
                <td className="py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={bd.sel}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      if (isCutWise) {
                        toggleGroupSelection(
                          bundles.filter((b) => b.cutNo === bd.cutNo),
                          isChecked,
                        );
                      } else if (isSizeWise) {
                        toggleGroupSelection(
                          bundles.filter((b) => b.size === bd.size),
                          isChecked,
                        );
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
