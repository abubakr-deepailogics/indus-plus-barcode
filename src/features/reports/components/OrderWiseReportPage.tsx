"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ClipboardList, Loader2, Printer } from "lucide-react";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import { fetchOrderWiseReport } from "../services/reports.service";
import { recentPayCycles } from "../utils/pay-cycle";
import type { OrderWiseReportResult } from "../types";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Standalone page (not a panel on the main Reports dashboard) — a
// finance-style printout reads better as its own page with just a back
// arrow and a print button, the same way the legacy paper report stood on
// its own. Defaults to the current pay-cycle month; the picker below lets
// the user step back to any earlier month instead.
export function OrderWiseReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrderWiseReportResult | null>(null);

  const cycleOptions = useMemo(() => recentPayCycles(12), []);
  const [cycleStart, setCycleStart] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await fetchOrderWiseReport(cycleStart || undefined);
      if (cancelled) return;
      if (!res.ok) setError(res.error);
      else setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cycleStart]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-[1400px] mx-auto w-full">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] hover:bg-slate-50 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <select
            value={cycleStart}
            onChange={(e) => setCycleStart(e.target.value)}
            className="h-9 px-3 rounded-xl text-xs font-bold text-slate-700 bg-white border border-[#e2e8f0] hover:bg-slate-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10"
            title="Pay-cycle month"
          >
            {cycleOptions.map((opt) => (
              <option key={opt.value} value={opt.isLive ? "" : opt.value}>
                {opt.isLive ? `${opt.label} (Current)` : opt.label}
              </option>
            ))}
          </select>
        </div>
        {data && data.rows.length > 0 && (
          <div className="flex items-center gap-2">
            <CsvExportButton
              label="Export"
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white border border-[#e2e8f0] text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              filename={`order-wise-report-${format(new Date(), "yyyyMMdd-HHmm")}`}
              headers={[
                "W/O",
                "Total SAM",
                "Total Rate",
                "Wash Qty",
                "Plan (Rs.)",
                "Previous Paid (Rs.)",
                "Current Claim (Rs.)",
                "Total Claim (Rs.)",
                "Balance (Rs.)",
                "Minutes Produced",
                "Qty Produced",
              ]}
              rows={data.rows.map((r) => [
                r.workOrder,
                r.totalSam,
                r.totalRate,
                r.washQty,
                r.plan,
                r.previousPaid,
                r.currentClaim,
                r.totalClaim,
                r.balance,
                r.minutesProduced,
                r.qtyProduced,
              ])}
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#4f46e5] text-white hover:bg-indigo-700 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#4f46e5]" />
            <h1 className="font-bold text-[#4f46e5] text-sm uppercase tracking-wider">
              Order Wise Report (Sewing Department)
            </h1>
          </div>
          {data && (
            <span className="text-[11px] font-semibold text-slate-500">
              {data.period.from} → {data.period.to}
            </span>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading order-wise report…
          </div>
        )}

        {error && (
          <div className="mx-4 my-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {data && !loading && data.rows.length === 0 && (
          <div className="py-16 text-center text-sm font-semibold text-slate-400">
            No Sewing coupons scanned in this pay-cycle month.
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-[#475569] font-bold text-[9.5px] uppercase tracking-wider">
                  <th className="py-2 px-2 border-r border-slate-200">W/O</th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Total SAM
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Total Rate
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Qty
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Plan (Rs.)
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Prev. Paid
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Curr. Claim
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Total Claim
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Balance
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Min. Produced
                  </th>
                  <th className="py-2 px-2 text-right">Qty Produced</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.workOrder} className="hover:bg-slate-50/60">
                    <td className="py-1.5 px-2 border-r border-slate-100 font-mono font-bold text-[#4f46e5]">
                      {r.workOrder}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100">
                      {r.totalSam != null ? r.totalSam.toFixed(3) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100">
                      {r.totalRate != null ? r.totalRate.toFixed(3) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100">
                      {r.washQty != null ? r.washQty.toLocaleString() : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100">
                      {r.plan != null ? formatAmount(r.plan) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100">
                      {formatAmount(r.previousPaid)}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100 font-semibold text-emerald-700">
                      {formatAmount(r.currentClaim)}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100 font-bold">
                      {formatAmount(r.totalClaim)}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100">
                      {r.balance != null ? formatAmount(r.balance) : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100">
                      {r.minutesProduced.toFixed(0)}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      {r.qtyProduced.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
