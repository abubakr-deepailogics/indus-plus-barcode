"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDepartment } from "@/lib/department-context";

type Row = { employeeCode: string; employeeName: string; employeeDepartment: string; operationCode: string; operationName: string | null; couponCount: number; totalQty: number; lastScannedAt: string | null };

export function DummyEmployeeReport({ embedded = false }: { embedded?: boolean }) {
  const { department } = useDepartment();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/reports/dummy-employees?department=${encodeURIComponent(department)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load report.");
      setRows(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load report."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
    // `department` deliberately reloads the trace data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  const table = <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-900">Trace activity</h2><p className="mt-1 text-xs text-slate-500">Operational activity for the current department. Rates and earnings are always Rs. 0.</p></div><Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div>{error && <p role="alert" className="m-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Employee card</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Restricted ERP operation</th><th className="px-5 py-3 text-right">Coupons</th><th className="px-5 py-3 text-right">Output</th><th className="px-5 py-3 text-right">Rate</th><th className="px-5 py-3">Last activity</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">Loading trace records…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No trace activity found for this department.</td></tr> : rows.map((row) => <tr key={row.employeeCode}><td className="px-5 py-3"><p className="font-medium text-slate-900">{row.employeeName}</p><code className="text-xs text-indigo-600">{row.employeeCode}</code></td><td className="px-5 py-3 text-slate-600">{row.employeeDepartment}</td><td className="px-5 py-3"><span className="font-medium text-slate-800">{row.operationCode}</span><span className="block text-xs text-slate-500">{row.operationName || "—"}</span></td><td className="px-5 py-3 text-right tabular-nums">{row.couponCount}</td><td className="px-5 py-3 text-right tabular-nums">{Number(row.totalQty).toLocaleString()}</td><td className="px-5 py-3 text-right font-semibold text-slate-500">Rs. 0.00</td><td className="px-5 py-3 text-xs text-slate-500">{row.lastScannedAt ? new Date(row.lastScannedAt).toLocaleString() : "No scans yet"}</td></tr>)}</tbody></table></div></section>;
  if (embedded) return table;
  return <div className="flex flex-1 flex-col gap-5"><header className="flex items-start gap-3 border-b border-slate-200 pb-5"><span className="flex size-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><ClipboardCheck className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Reports / Trace only</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Trace employee report</h1><p className="mt-1 text-sm text-slate-500">Operational traceability only. Earnings, rates, and incentives are always Rs. 0.</p></div></header>{table}</div>;
}
