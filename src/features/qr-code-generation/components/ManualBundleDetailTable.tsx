"use client";

import { Plus, Trash2 } from "lucide-react";
import type { BundleDetailRow } from "../types";

interface ManualBundleDetailTableProps {
  bundles: BundleDetailRow[];
  subTotal: string;
  total: string;
  onBundleChange: (
    id: number,
    field: "bundleNo" | "inseam" | "size" | "pcs",
    value: string,
  ) => void;
  onBundleSelChange: (id: number, checked: boolean) => void;
  onAllManualBundlesSelChange: (checked: boolean) => void;
  onAddBundle: () => void;
  onRemoveBundle: (id: number) => void;
}

export function ManualBundleDetailTable({
  bundles,
  subTotal,
  total,
  onBundleChange,
  onBundleSelChange,
  onAllManualBundlesSelChange,
  onAddBundle,
  onRemoveBundle,
}: ManualBundleDetailTableProps) {
  const completeBundles = bundles.filter(
    (bundle) =>
      Boolean(bundle.bundleNo.trim()) && Number.isInteger(bundle.pcs) && bundle.pcs > 0,
  );
  const areAllCompleteBundlesSelected =
    completeBundles.length > 0 && completeBundles.every((bundle) => bundle.sel);

  return (
    <div className="lg:col-span-6 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div>
          <h3 className="text-sm font-extrabold text-indigo-700">
            Bundle Detail
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            Complete selection
            <input
              type="checkbox"
              checked={areAllCompleteBundlesSelected}
              onChange={(event) => onAllManualBundlesSelChange(event.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
            />
          </label>
          <button
            type="button"
            onClick={onAddBundle}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[420px] border border-slate-200/80 rounded-xl">
        <table className="w-full text-left border-collapse min-w-[570px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Bundle # <span className="text-red-500">*</span>
              </th>
              <th className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Inseam
              </th>
              <th className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Size #
              </th>
              <th className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Pcs <span className="text-red-500">*</span>
              </th>
              <th className="py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Sel
              </th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bundles.map((bundle) => (
              <tr
                key={bundle.id}
                className="text-[11px] font-semibold text-slate-700"
              >
                <td className="p-2 text-center">
                  <input
                    value={bundle.bundleNo}
                    onChange={(event) =>
                      onBundleChange(bundle.id, "bundleNo", event.target.value)
                    }
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-center font-mono focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    value={bundle.inseam}
                    onChange={(event) =>
                      onBundleChange(bundle.id, "inseam", event.target.value)
                    }
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    value={bundle.size}
                    onChange={(event) =>
                      onBundleChange(bundle.id, "size", event.target.value)
                    }
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="number"
                    min="1"
                    value={bundle.pcs || ""}
                    onChange={(event) =>
                      onBundleChange(bundle.id, "pcs", event.target.value)
                    }
                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-center focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={bundle.sel}
                    onChange={(event) =>
                      onBundleSelChange(bundle.id, event.target.checked)
                    }
                    className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                    aria-label={`Select bundle ${bundle.bundleNo || "row"}`}
                  />
                </td>
                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveBundle(bundle.id)}
                    className="p-1 text-slate-300 hover:text-red-500"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ml-auto grid gap-2 text-xs font-bold text-slate-500">
        <span>
          Sub Total{" "}
          <output className="ml-3 inline-block w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-slate-800">
            {subTotal}
          </output>
        </span>
        <span>
          Total{" "}
          <output className="ml-8 inline-block w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-slate-800">
            {total}
          </output>
        </span>
      </div>
    </div>
  );
}
