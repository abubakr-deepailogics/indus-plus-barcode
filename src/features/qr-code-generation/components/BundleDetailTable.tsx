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
  // When provided, Cut # renders as an editable input instead of plain
  // text — used by the Rework Coupon page, where Cut is never looked up
  // from the DB and has to be typed in manually per row. Omitted (as on
  // the Coupon Generation page) keeps the original read-only display.
  onCutNoChange?: (id: number, value: string) => void;
}

export function BundleDetailTable({
  bundles,
  reworkQtyBundle: _reworkQtyBundle,
  subTotal,
  total,
  onBundleSelChange,
  onAllBundlesSelChange,
  onReworkQtyBundleChange: _onReworkQtyBundleChange,
  onCutNoChange,
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
    <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-sm font-extrabold text-indigo-700">Cutting Detail</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500">
              Complete selection
            </span>
            <input
              type="checkbox"
              onChange={(e) => {
                onAllBundlesSelChange(e.target.checked);
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-3.5 h-3.5"
            />
          </div>
          <div className="relative flex items-center gap-1.5" ref={cutDropdownRef}>
            <span className="text-[11px] font-bold text-slate-500">
              Cut Wise selection
            </span>
            <input
              type="checkbox"
              checked={isCutWise}
              onChange={(e) => {
                setIsCutWise(e.target.checked);
                if (e.target.checked) setIsSizeWise(false);
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-3.5 h-3.5"
            />
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === "cut" ? null : "cut"))}
              className="text-slate-500 hover:text-indigo-700 cursor-pointer"
              aria-label="Select bundles by Cut #"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            {openDropdown === "cut" && (
              <div className="absolute right-0 top-full mt-1 min-w-[130px] max-h-56 overflow-y-auto bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5">
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
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-3.5 h-3.5"
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
            <span className="text-[11px] font-bold text-slate-500">
              Size Wise selection
            </span>
            <input
              type="checkbox"
              checked={isSizeWise}
              onChange={(e) => {
                setIsSizeWise(e.target.checked);
                if (e.target.checked) setIsCutWise(false);
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-3.5 h-3.5"
            />
            <button
              type="button"
              onClick={() => setOpenDropdown((prev) => (prev === "size" ? null : "size"))}
              className="text-slate-500 hover:text-indigo-700 cursor-pointer"
              aria-label="Select bundles by Size #"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            {openDropdown === "size" && (
              <div className="absolute right-0 top-full mt-1 min-w-[130px] max-h-56 overflow-y-auto bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5">
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
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-3.5 h-3.5"
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

      <div className="overflow-auto max-h-[420px] border border-slate-200/80 rounded-xl">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center sticky top-0 z-10 bg-slate-50">
                Cut #
              </th>
              <th className="py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center sticky top-0 z-10 bg-slate-50">
                Char
              </th>
              <th className="py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center sticky top-0 z-10 bg-slate-50">
                Bundle #
              </th>
              <th className="py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center sticky top-0 z-10 bg-slate-50">
                Inseam
              </th>
              <th className="py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center sticky top-0 z-10 bg-slate-50">
                Size #
              </th>
              <th className="py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center sticky top-0 z-10 bg-slate-50">
                Pcs
              </th>
              <th className="py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center sticky top-0 z-10 bg-slate-50">
                Sel
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bundles.map((bd) => (
              <tr key={bd.id} className="hover:bg-slate-50/60 border-b border-slate-100 transition-colors text-[11px] font-semibold text-slate-700">
                <td className="py-2.5 text-center text-indigo-700 font-bold">
                  {onCutNoChange ? (
                    <input
                      type="text"
                      value={bd.cutNo}
                      onChange={(e) => onCutNoChange(bd.id, e.target.value)}
                      placeholder="Cut #"
                      className="w-16 px-1.5 py-1 rounded-lg border border-slate-200 bg-white text-center text-[11px] font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  ) : (
                    bd.cutNo
                  )}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-bold uppercase">
                  {bd.char}
                </td>
                <td className="py-2.5 text-center text-indigo-900 font-bold font-mono">
                  {bundleDisplayNos.get(bd.id) ?? bd.bundleNo}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-medium">
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
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer w-3.5 h-3.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100 items-end">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-500 text-xs">Sub Total</span>
          <input
            type="text"
            value={subTotal}
            readOnly
            className="w-36 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs font-bold text-right text-slate-800"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-500 text-xs">Total</span>
          <input
            type="text"
            value={total}
            readOnly
            className="w-36 px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-right text-slate-800"
          />
        </div>
      </div>
    </div>
  );
}
