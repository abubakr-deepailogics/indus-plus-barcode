"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/features/auth/context/auth-context";
import { Button } from "@/components/ui/button";
import { CreateEmployeeCardDialog } from "./CreateEmployeeCardDialog";
import { DummyEmployeeReport } from "./DummyEmployeeReport";
import { EditEmployeeCardDialog } from "./EditEmployeeCardDialog";
import type { DummyEmployee } from "../types";

export function TraceEmployeesWorkspace() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "reports" ? "reports" : "cards";
  const [employees, setEmployees] = useState<DummyEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmployees = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/dummy-employees?all=true");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load employee cards.");
      setEmployees(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load employee cards.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEmployees(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const createdBy = user?.email || user?.displayName || "Administrator";

  return <div className="flex flex-1 flex-col gap-5">
    <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
      <div className="flex gap-3.5"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm"><ClipboardCheck className="size-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">Industrial engineering / Traceability</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Trace Employees</h1><p className="mt-1 text-sm text-slate-500">PIT-only employee cards for operation checks, with zero payable earnings.</p></div></div>
      {tab === "cards" && <CreateEmployeeCardDialog createdBy={createdBy} onCreated={loadEmployees} />}
    </header>

    {tab === "reports" ? <DummyEmployeeReport embedded /> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-900">Issued employee cards</h2><p className="mt-1 text-xs text-slate-500">Each card can scan only its assigned ERP operation and always has a zero rate.</p></div><Button variant="outline" size="sm" onClick={loadEmployees} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button></div>
      {error ? <p role="alert" className="m-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Employee card</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Assigned operation</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Loading employee cards…</td></tr> : employees.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400"><Plus className="mx-auto mb-2 size-5" />No employee cards have been issued.</td></tr> : employees.map((employee) => <tr key={employee.employeeCode}><td className="px-5 py-3"><p className="font-semibold text-slate-800">{employee.employeeName}</p><code className="text-xs text-indigo-700">{employee.employeeCode}</code></td><td className="px-5 py-3 text-slate-600">{employee.department}</td><td className="px-5 py-3"><span className="font-medium text-slate-800">{employee.operationCode}</span><span className="block text-xs text-slate-500">{employee.operationName || "—"}</span></td><td className="px-5 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${employee.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{employee.isActive ? "Active" : "Inactive"}</span></td><td className="px-5 py-3 text-right"><EditEmployeeCardDialog employee={employee} onSaved={loadEmployees} /></td></tr>)}</tbody></table></div>}
    </section>}
  </div>;
}
