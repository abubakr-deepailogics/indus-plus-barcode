"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ClipboardList, Loader2, Printer } from "lucide-react";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import { fetchOrderWiseReport } from "../services/reports.service";
import { useDepartment } from "@/lib/department-context";
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
  const { department } = useDepartment();
  const departmentLabel = `${department.charAt(0).toUpperCase()}${department.slice(1)}`;
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
      const res = await fetchOrderWiseReport(cycleStart || undefined, department);
      if (cancelled) return;
      if (!res.ok) setError(res.error);
      else setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cycleStart, department]);

  const totals = useMemo(() => {
    if (!data?.rows?.length) return null;
    return {
      washQty: data.rows.reduce((sum, r) => sum + (r.washQty ?? 0), 0),
      plan: data.rows.reduce((sum, r) => sum + (r.plan ?? 0), 0),
      previousPaid: data.rows.reduce(
        (sum, r) => sum + (r.previousPaid ?? 0),
        0,
      ),
      currentClaim: data.rows.reduce(
        (sum, r) => sum + (r.currentClaim ?? 0),
        0,
      ),
      totalClaim: data.rows.reduce((sum, r) => sum + (r.totalClaim ?? 0), 0),
      balance: data.rows.reduce((sum, r) => sum + (r.balance ?? 0), 0),
      opInc: data.rows.reduce((sum, r) => sum + (r.opInc ?? 0), 0),
      total: data.rows.reduce((sum, r) => sum + (r.total ?? 0), 0),
      minutesProduced: data.rows.reduce(
        (sum, r) => sum + (r.minutesProduced ?? 0),
        0,
      ),
      qtyProduced: data.rows.reduce((sum, r) => sum + (r.qtyProduced ?? 0), 0),
    };
  }, [data]);

  return (
    <div
      data-client-brand
      className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 md:px-7 md:py-7 [&_thead_th]:border-b [&_thead_th]:border-slate-200 [&_thead_th]:bg-slate-50 [&_thead_th]:py-3 [&_thead_th]:text-[10px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-slate-500 [&_tbody_td]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-emerald-50/30 [&_tfoot_tr]:border-t-2 [&_tfoot_tr]:border-slate-300 [&_tfoot_tr]:bg-slate-100 [&_tfoot_tr]:font-semibold [&_tfoot_tr]:text-slate-900"
    >
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <select
            value={cycleStart}
            onChange={(e) => setCycleStart(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
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
              className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              filename={`${department}-order-wise-report-${format(new Date(), "yyyyMMdd-HHmm")}`}
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
                "Op Inc",
                "Total",
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
                r.opInc,
                r.total,
                r.minutesProduced,
                r.qtyProduced,
              ])}
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-800"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
              <ClipboardList className="size-4" />
            </span>
            <h1 className="text-sm font-semibold text-slate-900 md:text-base">
              Order Wise Report ({departmentLabel} Department)
            </h1>
          </div>
          {data && (
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium tabular-nums text-slate-600">
              {data.period.from} → {data.period.to}
            </span>
          )}
        </div>

        {loading && (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-medium text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading order-wise report…
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-4 my-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
          >
            {error}
          </div>
        )}

        {data && !loading && data.rows.length === 0 && (
          <div className="flex min-h-56 items-center justify-center px-5 text-center text-sm font-medium text-slate-500">
            No {departmentLabel} coupons scanned in this pay-cycle month.
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
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
                    Op Inc
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Total
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
                    <td className="py-1.5 px-2 border-r border-slate-100 font-mono font-bold text-indigo-700">
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
                      {formatAmount(r.opInc)}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100 font-bold text-emerald-700">
                      {formatAmount(r.total)}
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
              {totals && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-900 text-[10px]">
                    <td className="py-2 px-2 border-r border-slate-300 font-mono">
                      Total ({data.rows.length} W/O)
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      —
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      —
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {totals.washQty.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {formatAmount(totals.plan)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {formatAmount(totals.previousPaid)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300 text-emerald-800">
                      {formatAmount(totals.currentClaim)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {formatAmount(totals.totalClaim)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {formatAmount(totals.balance)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {formatAmount(totals.opInc)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300 text-emerald-800">
                      {formatAmount(totals.total)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {totals.minutesProduced.toFixed(0)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {totals.qtyProduced.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
          .overflow-x-auto { overflow: visible !important; padding: 0 !important; }
          table { width: 100% !important; font-size: 9px !important; }
          th, td { padding: 3px 4px !important; }
          @page { size: A4 landscape; margin: 0.8cm; }
        }
      `}</style>
    </div>
  );
}
