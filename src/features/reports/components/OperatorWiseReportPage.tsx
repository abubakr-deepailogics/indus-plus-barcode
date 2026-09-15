"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Loader2, Printer, Users } from "lucide-react";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import { fetchOperatorWiseReport } from "../services/reports.service";
import type { OperatorWiseReportResult } from "../types";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Standalone page, same reasoning as OrderWiseReportPage — its own screen
// with a back arrow and a print button rather than a panel bolted onto the
// main Reports dashboard. Always scoped to the current pay-cycle month
// server-side.
export function OperatorWiseReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OperatorWiseReportResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await fetchOperatorWiseReport();
      if (cancelled) return;
      if (!res.ok) setError(res.error);
      else setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bySection = new Map<string, OperatorWiseReportResult["rows"]>();
  if (data) {
    for (const row of data.rows) {
      if (!bySection.has(row.section)) bySection.set(row.section, []);
      bySection.get(row.section)!.push(row);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-[1000px] mx-auto w-full">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] hover:bg-slate-50 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        {data && data.rows.length > 0 && (
          <div className="flex items-center gap-2">
            <CsvExportButton
              label="Export"
              filename={`operator-wise-report-${format(new Date(), "yyyyMMdd-HHmm")}`}
              headers={["Code", "Name", "Section", "D.O.J", "Total Amt. (Rs.)"]}
              rows={data.rows.map((r) => [
                r.employeeCode, r.employeeName, r.section, r.joiningDate, r.totalAmt,
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
            <Users className="w-4 h-4 text-[#4f46e5]" />
            <h1 className="font-bold text-[#4f46e5] text-sm uppercase tracking-wider">
              Operator Wise Final Payment
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
            Loading operator-wise report…
          </div>
        )}

        {error && (
          <div className="mx-4 my-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}

        {data && !loading && data.rows.length === 0 && (
          <div className="py-16 text-center text-sm font-semibold text-slate-400">
            No coupons scanned yet this pay-cycle month.
          </div>
        )}

        {data && data.rows.length > 0 && (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-[#475569] font-bold text-[9.5px] uppercase tracking-wider">
                  <th className="py-2 px-2 border-r border-slate-200">Code</th>
                  <th className="py-2 px-2 border-r border-slate-200">Name</th>
                  <th className="py-2 px-2 border-r border-slate-200">D.O.J</th>
                  <th className="py-2 px-2 text-right">Total Amt.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...bySection.entries()].map(([section, rows]) => {
                  const sectionTotal = rows.reduce((s, r) => s + r.totalAmt, 0);
                  return (
                    <Fragment key={section}>
                      <tr className="bg-indigo-50">
                        <td colSpan={4} className="py-1.5 px-2 font-bold text-[#4f46e5] text-[10px] uppercase tracking-wider">
                          Section: {section}
                        </td>
                      </tr>
                      {rows.map((r) => (
                        <tr key={r.employeeCode} className="hover:bg-slate-50/60">
                          <td className="py-1.5 px-2 border-r border-slate-100 font-mono font-bold text-[#4f46e5]">
                            {r.employeeCode}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-100 font-semibold text-slate-800">
                            {r.employeeName}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-100 text-slate-600">
                            {r.joiningDate ? r.joiningDate.slice(0, 10) : "—"}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-slate-800">
                            {formatAmount(r.totalAmt)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 border-t border-slate-200 font-bold text-slate-700">
                        <td colSpan={3} className="py-1.5 px-2 text-right border-r border-slate-200">
                          {section} Total :
                        </td>
                        <td className="py-1.5 px-2 text-right">{formatAmount(sectionTotal)}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
