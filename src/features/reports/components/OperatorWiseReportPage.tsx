"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Printer, Users } from "lucide-react";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import { fetchOperatorWiseReport } from "../services/reports.service";
import { recentPayCycles } from "../utils/pay-cycle";
import type { OperatorWiseReportResult } from "../types";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Standalone page, same reasoning as OrderWiseReportPage — its own screen
// with a back arrow and a print button rather than a panel bolted onto the
// main Reports dashboard. Defaults to the current pay-cycle month; the
// picker below lets the user step back to any earlier month instead.
export function OperatorWiseReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OperatorWiseReportResult | null>(null);

  const cycleOptions = useMemo(() => recentPayCycles(12), []);
  const [cycleStart, setCycleStart] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await fetchOperatorWiseReport(cycleStart || undefined);
      if (cancelled) return;
      if (!res.ok) setError(res.error);
      else setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [cycleStart]);

  const totals = useMemo(() => {
    if (!data?.rows?.length) return null;
    return {
      pieceRateTotal: data.rows.reduce(
        (sum, r) => sum + (r.pieceRateTotal ?? 0),
        0,
      ),
      opInc: data.rows.reduce((sum, r) => sum + (r.opInc ?? 0), 0),
      total: data.rows.reduce((sum, r) => sum + (r.total ?? 0), 0),
    };
  }, [data]);

  return (
    <div data-client-brand className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-5 md:px-7 md:py-7 [&_thead_th]:border-b [&_thead_th]:border-slate-200 [&_thead_th]:bg-slate-50 [&_thead_th]:py-3 [&_thead_th]:text-[10px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-slate-500 [&_tbody_td]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-emerald-50/30 [&_tfoot_tr]:border-t-2 [&_tfoot_tr]:border-slate-300 [&_tfoot_tr]:bg-slate-100 [&_tfoot_tr]:font-semibold [&_tfoot_tr]:text-slate-900">
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
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
              filename={`operator-wise-report-${format(new Date(), "yyyyMMdd-HHmm")}`}
              headers={[
                "Code",
                "Name",
                "D.O.J",
                "Section",
                "Piece Rate",
                "Op Inc",
                "Total",
              ]}
              rows={data.rows.map((r) => [
                r.employeeCode,
                r.employeeName,

                r.joiningDate ? r.joiningDate.slice(0, 10) : "",
                r.section,
                r.pieceRateTotal,
                r.opInc,
                r.total,
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
              <Users className="size-4" />
            </span>
            <h1 className="text-sm font-semibold text-slate-900 md:text-base">
              Operator Wise Final Payment
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
            Loading operator-wise report…
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
            No Sewing coupons scanned in this pay-cycle month.
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                  <th className="py-2 px-2 border-r border-slate-200">Code</th>
                  <th className="py-2 px-2 border-r border-slate-200">Name</th>
                  <th className="py-2 px-2 border-r border-slate-200">D.O.J</th>
                  <th className="py-2 px-2 border-r border-slate-200">
                    Section
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Piece Rate
                  </th>
                  <th className="py-2 px-2 text-right border-r border-slate-200">
                    Op Inc
                  </th>
                  <th className="py-2 px-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((r) => (
                  <tr key={r.employeeCode} className="hover:bg-slate-50/60">
                    <td className="py-1.5 px-2 border-r border-slate-100 font-mono font-bold text-indigo-700">
                      {r.employeeCode}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-100 font-semibold text-slate-800">
                      {r.employeeName}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-100 text-slate-600">
                      {r.joiningDate ? r.joiningDate.slice(0, 10) : "—"}
                    </td>
                    <td className="py-1.5 px-2 border-r border-slate-100 font-semibold text-slate-700">
                      {r.section}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100 font-bold text-slate-800">
                      {formatAmount(r.pieceRateTotal)}
                    </td>
                    <td className="py-1.5 px-2 text-right border-r border-slate-100 font-bold text-slate-800">
                      {formatAmount(r.opInc)}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-emerald-700">
                      {formatAmount(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-slate-900 text-[10px]">
                    <td
                      colSpan={4}
                      className="py-2 px-2 border-r border-slate-300"
                    >
                      Total ({data.rows.length} Operators)
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {formatAmount(totals.pieceRateTotal)}
                    </td>
                    <td className="py-2 px-2 text-right border-r border-slate-300">
                      {formatAmount(totals.opInc)}
                    </td>
                    <td className="py-2 px-2 text-right text-emerald-800">
                      {formatAmount(totals.total)}
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
          table { width: 100% !important; }
          @page { size: A4 portrait; margin: 0.8cm; }
        }
      `}</style>
    </div>
  );
}
