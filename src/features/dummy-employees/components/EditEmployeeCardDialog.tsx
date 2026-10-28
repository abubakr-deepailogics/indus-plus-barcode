"use client";

import { useCallback, useState } from "react";
import { AlertCircle, Building2, Check, LoaderCircle, Pencil, Power, UserRound, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import type { DummyEmployee, ErpOperation } from "../types";

const departments = ["Sewing", "Washing", "Finishing"] as const;

export function EditEmployeeCardDialog({ employee, onSaved }: { employee: DummyEmployee; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(employee.employeeName);
  const [department, setDepartment] = useState(employee.department);
  const [operationCode, setOperationCode] = useState(employee.operationCode);
  const [operationQuery, setOperationQuery] = useState(`${employee.operationCode} — ${employee.operationName || "Unnamed operation"}`);
  const [active, setActive] = useState(employee.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchOperations = useCallback(async (query: string) => {
    const response = await fetch(`/api/dummy-employees/operations?department=${encodeURIComponent(department)}&query=${encodeURIComponent(query)}`);
    return response.ok ? response.json() as Promise<ErpOperation[]> : [];
  }, [department]);

  function close() { setOpen(false); setError(""); }
  function changeDepartment(nextDepartment: string) {
    setDepartment(nextDepartment);
    if (nextDepartment !== employee.department) { setOperationCode(""); setOperationQuery(""); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError("");
    if (!name.trim() || !department || !operationCode) { setError("Complete all card fields."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/dummy-employees", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeCode: employee.employeeCode, employeeName: name, department, operationCode, isActive: active }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update card.");
      close(); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update card."); }
    finally { setSaving(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"><Pencil className="size-3.5" />Edit</button>
    <Dialog open={open} onOpenChange={(next) => !saving && (next ? setOpen(true) : close())}>
      <DialogContent data-client-brand className="max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[540px]" showCloseButton={!saving}>
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5 sm:px-7"><DialogHeader className="flex-row items-start gap-3.5"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm"><Pencil className="size-5" /></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">Employee card</p><DialogTitle className="mt-1 text-lg font-semibold text-slate-950">Edit trace employee</DialogTitle><DialogDescription className="mt-1 text-xs leading-relaxed text-slate-500">Update the card identity, operation assignment, and availability.</DialogDescription></div></DialogHeader></div>
        <form onSubmit={save} className="flex flex-col gap-5 px-6 py-5 sm:px-7">
          <div className="flex flex-col gap-2"><Label htmlFor={`employee-name-${employee.employeeCode}`} className="text-xs font-semibold text-slate-700">Employee name</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input id={`employee-name-${employee.employeeCode}`} value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-lg border-slate-200 bg-white pl-10 text-sm text-slate-900 focus-visible:border-indigo-400 focus-visible:ring-indigo-100" /></div></div>
          <div className="flex flex-col gap-2"><Label className="text-xs font-semibold text-slate-700">Department</Label><div className="grid grid-cols-3 gap-2">{departments.map((item) => <button key={item} type="button" onClick={() => changeDepartment(item)} className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors ${department === item ? "border-indigo-300 bg-indigo-50 text-indigo-800" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40"}`}><Building2 className="size-3.5" />{item}</button>)}</div></div>
          <div className="flex flex-col gap-2"><Label className="text-xs font-semibold text-slate-700">Assigned ERP operation</Label><div className="relative"><Workflow className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" /><Autocomplete<ErpOperation> value={operationQuery} onChange={(value) => { setOperationQuery(value); setOperationCode(""); }} onSelect={(operation) => { setOperationCode(operation.operationCode); setOperationQuery(`${operation.operationCode} — ${operation.operationName || "Unnamed operation"}`); }} fetchSuggestions={fetchOperations} renderSuggestion={(operation) => <><span className="font-semibold text-indigo-700">{operation.operationCode}</span><span className="ml-2 truncate text-slate-600">{operation.operationName || "Unnamed operation"}</span></>} getSuggestionValue={(operation) => operation.operationCode} placeholder="Search ERP operation code or name" inputClassName="h-10 w-full rounded-lg border border-slate-200 bg-white py-1 pr-3 pl-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100" dropdownClassName="max-h-56 rounded-lg" /></div></div>
          <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"><span className="flex gap-3"><span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><Power className="size-4" /></span><span><span className="block text-xs font-semibold text-slate-800">Card is active</span><span className="mt-1 block text-[11px] leading-relaxed text-slate-500">Inactive cards are excluded from employee lookup and coupon scanning.</span></span></span><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="mt-1 size-4 shrink-0 accent-indigo-600" /></label>
          {error && <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-800"><AlertCircle className="mt-0.5 size-4 shrink-0" /><p>{error}</p></div>}
          <DialogFooter className="-mx-6 -mb-5 rounded-none border-t border-slate-200 bg-slate-50 px-6 py-4 sm:-mx-7 sm:flex-row sm:px-7"><Button type="button" variant="outline" disabled={saving} onClick={close} className="h-9 rounded-lg border-slate-200 bg-white px-4 text-xs font-semibold">Cancel</Button><Button type="submit" disabled={saving} className="h-9 gap-2 rounded-lg bg-indigo-700 px-4 text-xs font-semibold text-white hover:bg-indigo-800">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {saving ? "Saving…" : "Save changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
