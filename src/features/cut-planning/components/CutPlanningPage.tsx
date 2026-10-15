"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, LoaderCircle, Plus, Save, Scissors, Search, Trash2 } from "lucide-react";
import { ModulePageHeader } from "@/components/ModulePageHeader";
import { useWorkOrderParam } from "@/lib/use-work-order-param";
import type { CutPlanRow, CutPlanningData, CutPlanningInseamGroup } from "../types";

const today = () => new Date().toISOString().slice(0, 10);
const numeric = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const displayNumber = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
const preventWheelChange = (event: React.WheelEvent<HTMLInputElement>) => event.currentTarget.blur();

function makePlan(group: CutPlanningInseamGroup): CutPlanRow {
  return {
    sourceInseam: group.inseam, planDate: today(),
    sizeQuantities: Object.fromEntries(group.sizeColumns.map((size) => [size, 0])),
    reCutQty: 0, markerNo: "", cutNo: "", markerPlies: 0, shrinkage: "", shade: "",
    calculatedRequired: null, markerWidthCm: null, markerLengthM: null,
  };
}

export default function CutPlanningPage() {
  const [workOrder, setWorkOrder] = useState("");
  const [data, setData] = useState<CutPlanningData | null>(null);
  const [plans, setPlans] = useState<CutPlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (candidate: string) => {
    const wo = candidate.trim(); setWorkOrder(wo); setError(""); setNotice("");
    if (!wo) { setData(null); setPlans([]); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/cut-planning?work_order=${encodeURIComponent(wo)}`, { cache: "no-store" });
      const body = await response.json() as CutPlanningData & { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to load cut planning.");
      setData(body);
      // Every ERP Inseam gets a planning row, even if other Inseams already
      // have saved rows. This keeps the single grid complete and in order.
      const initialPlans = body.inseamGroups.flatMap((group) => {
        const saved = body.plans.filter((plan) => plan.sourceInseam === group.inseam);
        return saved.length ? saved : [makePlan(group)];
      });
      setPlans(initialPlans);
      if (!body.metadata) setNotice("No size-wise ERP rows were found for this Work Order.");
    } catch (caught) { setData(null); setPlans([]); setError(caught instanceof Error ? caught.message : "Failed to load cut planning."); }
    finally { setLoading(false); }
  }, []);

  const { setWorkOrder: setSharedWorkOrder } = useWorkOrderParam(load);
  const groups = useMemo(() => data?.inseamGroups ?? [], [data]);
  const sizeColumns = useMemo(() => [...new Set(groups.flatMap((group) => group.sizeColumns))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b, undefined, { numeric: true })), [groups]);
  const groupedPlans = useMemo(() => groups.map((group) => ({ group, rows: plans.map((plan, index) => ({ plan, index })).filter(({ plan }) => plan.sourceInseam === group.inseam) })), [groups, plans]);

  const update = (index: number, patch: Partial<CutPlanRow>) => setPlans((current) => current.map((plan, planIndex) => planIndex === index ? { ...plan, ...patch } : plan));
  const updateSize = (index: number, size: string, value: string) => update(index, { sizeQuantities: { ...plans[index].sizeQuantities, [size]: numeric(value) } });
  const add = (group: CutPlanningInseamGroup) => setPlans((current) => [...current, makePlan(group)]);
  const remove = (index: number, group: CutPlanningInseamGroup) => setPlans((current) => {
    const remaining = current.filter((_, planIndex) => planIndex !== index);
    return remaining.some((plan) => plan.sourceInseam === group.inseam) ? remaining : [...remaining, makePlan(group)];
  });

  const totals = useMemo(() => {
    const order: Record<string, number> = {}, willCut: Record<string, number> = {}, planned: Record<string, number> = {};
    for (const group of groups) for (const size of sizeColumns) {
      order[size] = (order[size] || 0) + (group.orderQuantities[size] || 0);
      willCut[size] = (willCut[size] || 0) + (group.willCutQuantities[size] || 0);
    }
    for (const plan of plans) for (const size of sizeColumns) planned[size] = (planned[size] || 0) + (plan.sizeQuantities[size] || 0);
    return { order, willCut, planned, less: Object.fromEntries(sizeColumns.map((size) => [size, Math.max((willCut[size] || 0) - (planned[size] || 0), 0)])), over: Object.fromEntries(sizeColumns.map((size) => [size, Math.max((planned[size] || 0) - (willCut[size] || 0), 0)])) };
  }, [groups, plans, sizeColumns]);
  const totalLength = plans.reduce((sum, plan) => sum + (plan.markerLengthM || 0), 0);

  async function save() {
    if (!workOrder) { setError("Enter a Work Order before saving."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/cut-planning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrder, plans }) });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Failed to save cut planning.");
      setNotice(body.message || "Cut planning saved successfully."); await load(workOrder);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to save cut planning."); }
    finally { setSaving(false); }
  }

  const cellClass = "cell-input";
  return <main className="mx-auto w-full max-w-[1800px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <ModulePageHeader eyebrow="Sewing / Cutting" title="Cut Planning" detail="One marker-planning grid, ordered by Inseam" icon={Scissors} />
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setSharedWorkOrder(workOrder.trim()); load(workOrder); }}><label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">Work Order<input value={workOrder} onChange={(event) => setWorkOrder(event.target.value)} placeholder="Enter work order" className="h-10 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label><button type="submit" disabled={loading} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"><Search className="size-4" /> Load planning</button></form>{data?.metadata && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">{[["Work order", data.metadata.workOrder], ["Customer", data.metadata.customerName], ["Work-order date", data.metadata.workOrderDate], ["Style", data.metadata.styleName], ["Style no.", data.metadata.styleNo], ["Style code", data.metadata.styleCode], ["Color", data.metadata.color]].map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="truncate font-medium text-slate-700">{value || "—"}</p></div>)}</div>}</section>
    {(error || notice) && <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><AlertCircle className="size-4" />{error || notice}</div>}
    {loading && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Loading Inseam groups…</div>}
    {!loading && data && <>{groups.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-900">Cutting Marker Planning Entry</h2><p className="text-xs text-slate-500">Each Inseam is separated by one break row. Numeric cells do not change on mouse-wheel scroll.</p></div><div className="max-h-[60vh] overflow-auto"><table className="min-w-max w-full border-collapse text-xs"><thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-600"><tr>{["Inseam", "Date", ...sizeColumns, "Re-cut", "Total", "Marker no.", "Cut no.", "Marker plies", "Transaction count", "Shrinkage", "Shade", "Calculated required", "Marker width (cm)", "Marker length (m)", ""].map((heading) => <th key={heading} className="border-b border-slate-300 px-2 py-3 font-semibold whitespace-nowrap">{heading}</th>)}</tr></thead><tbody>{groupedPlans.flatMap(({ group, rows }, groupIndex) => [groupIndex > 0 ? <tr key={`break-${group.inseam}`} className="bg-slate-100"><td colSpan={sizeColumns.length + 14} className="border-y border-slate-300 px-3 py-2"><div className="flex items-center justify-between gap-4"><span className="font-bold text-slate-700">Inseam {group.inseam ?? "Not specified"}</span><button type="button" onClick={() => add(group)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"><Plus className="size-3.5" /> Add marker row</button></div></td></tr> : null, ...rows.map(({ plan, index }, row) => { const total = sizeColumns.reduce((sum, size) => sum + (plan.sizeQuantities[size] || 0), 0); const transactions = total * plan.markerPlies; return <tr key={plan.id ?? `${group.inseam}-${row}`} className="border-b border-slate-200 hover:bg-slate-50/50"><td className="cell-label">{group.inseam ?? "—"}</td><td className="p-0"><input type="date" value={plan.planDate} onChange={(event) => update(index, { planDate: event.target.value })} className={`${cellClass} w-32`} /></td>{sizeColumns.map((size) => <td key={size} className="p-0"><input type="number" min="0" step="any" value={plan.sizeQuantities[size] || ""} onWheel={preventWheelChange} onChange={(event) => updateSize(index, size, event.target.value)} className={`${cellClass} w-16 text-right`} /></td>)}<td className="p-0"><input type="number" min="0" step="any" value={plan.reCutQty || ""} onWheel={preventWheelChange} onChange={(event) => update(index, { reCutQty: numeric(event.target.value) })} className={`${cellClass} w-16 text-right`} /></td><td className="cell-value">{displayNumber(total)}</td><td className="p-0"><input value={plan.markerNo} onChange={(event) => update(index, { markerNo: event.target.value })} className={`${cellClass} w-20`} /></td><td className="p-0"><input value={plan.cutNo} onChange={(event) => update(index, { cutNo: event.target.value })} className={`${cellClass} w-20`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.markerPlies || ""} onWheel={preventWheelChange} onChange={(event) => update(index, { markerPlies: numeric(event.target.value) })} className={`${cellClass} w-20 text-right`} /></td><td className="cell-value">{displayNumber(transactions)}</td><td className="p-0"><input value={plan.shrinkage} onChange={(event) => update(index, { shrinkage: event.target.value })} className={`${cellClass} w-24`} /></td><td className="p-0"><input value={plan.shade} onChange={(event) => update(index, { shade: event.target.value })} className={`${cellClass} w-24`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.calculatedRequired ?? ""} onWheel={preventWheelChange} onChange={(event) => update(index, { calculatedRequired: event.target.value === "" ? null : numeric(event.target.value) })} className={`${cellClass} w-24 text-right`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.markerWidthCm ?? ""} onWheel={preventWheelChange} onChange={(event) => update(index, { markerWidthCm: event.target.value === "" ? null : numeric(event.target.value) })} className={`${cellClass} w-24 text-right`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.markerLengthM ?? ""} onWheel={preventWheelChange} onChange={(event) => update(index, { markerLengthM: event.target.value === "" ? null : numeric(event.target.value) })} className={`${cellClass} w-24 text-right`} /></td><td className="p-0"><button type="button" aria-label={`Remove marker row ${row + 1}`} onClick={() => remove(index, group)} className="p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /></button></td></tr> })])}</tbody></table></div></section>}
      {groups.length > 0 && <section className="sticky bottom-3 z-20 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-xl"><div className="border-b border-slate-200 px-4 py-2"><h2 className="font-semibold text-slate-900">Overall quantities</h2></div><div className="overflow-x-auto"><table className="min-w-max w-full text-xs"><thead className="bg-slate-50"><tr><th className="px-4 py-2 text-left"> </th>{sizeColumns.map((size) => <th key={size} className="px-3 py-2 text-right">{size}</th>)}<th className="px-4 py-2 text-right">Total quantity</th></tr></thead><tbody>{[["Order", totals.order], ["Will be cut", totals.willCut], ["Planned", totals.planned], ["Less", totals.less], ["Over", totals.over]].map(([label, quantities]) => { const values = quantities as Record<string, number>; const total = sizeColumns.reduce((sum, size) => sum + (values[size] || 0), 0); return <tr key={label as string} className="border-t border-slate-100"><th className="px-4 py-2 text-left font-semibold">{label as string}</th>{sizeColumns.map((size) => <td key={size} className="px-3 py-2 text-right">{displayNumber(values[size] || 0)}</td>)}<td className="px-4 py-2 text-right font-bold">{displayNumber(total)}</td></tr> })}</tbody></table></div><div className="grid gap-3 border-t border-slate-200 p-3 text-sm sm:grid-cols-2"><p><span className="text-slate-500">Total marker length:</span> <b>{displayNumber(totalLength)} m</b></p><p><span className="text-slate-500">Average marker length:</span> <b>{displayNumber(plans.length ? totalLength / plans.length : 0)} m</b></p></div></section>}
      {groups.length > 0 && <div className="flex justify-end"><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save className="size-4" />{saving ? "Saving…" : "Save cut planning"}</button></div>}</>}
    <style jsx>{`.cell-input { height: 2.4rem; border: 0; border-right: 1px solid #e2e8f0; background: transparent; padding: 0 .5rem; outline: none; } .cell-input:focus { background: #eef2ff; box-shadow: inset 0 0 0 1px #6366f1; } .cell-label { border-right: 1px solid #e2e8f0; padding: 0 .6rem; font-weight: 600; color: #334155; } .cell-value { border-right: 1px solid #e2e8f0; padding: 0 .5rem; text-align: right; font-weight: 600; } input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { margin: 0; }`}</style>
  </main>;
}
