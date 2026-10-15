"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, LoaderCircle, Plus, Save, Scissors, Search, Trash2, X } from "lucide-react";
import { ModulePageHeader } from "@/components/ModulePageHeader";
import {
  WorkOrderSearchModal,
  type WorkOrderSearchRow,
} from "@/components/work-order-search-modal";
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
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ index: number; group: CutPlanningInseamGroup } | null>(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);

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
  const fetchWorkOrderRows = useCallback(async (filters: {
    workOrder: string;
    customer: string;
    saleOrderNo: string;
  }): Promise<WorkOrderSearchRow[]> => {
    const params = new URLSearchParams();
    if (filters.workOrder) params.set("work_order", filters.workOrder);
    if (filters.customer) params.set("customer", filters.customer);
    if (filters.saleOrderNo) params.set("sale_order_no", filters.saleOrderNo);
    const response = await fetch(`/api/cut-planning/work-orders?${params.toString()}`, { cache: "no-store" });
    const body = await response.json() as WorkOrderSearchRow[] & { error?: string };
    if (!response.ok) throw new Error(body.error || "Failed to search work orders.");
    return body;
  }, []);
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

  async function deleteRow(index: number, group: CutPlanningInseamGroup) {
    const plan = plans[index];
    if (!plan) return;
    if (!plan.id) {
      remove(index, group);
      setPendingDelete(null);
      return;
    }
    setDeletingRowId(plan.id);
    setError("");
    try {
      const response = await fetch(`/api/cut-planning?work_order=${encodeURIComponent(workOrder)}&id=${plan.id}`, { method: "DELETE" });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Failed to remove planning row.");
      remove(index, group);
      setPendingDelete(null);
      setNotice(body.message || "Planning row removed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to remove planning row.");
    } finally {
      setDeletingRowId(null);
    }
  }

  const hasRowData = (plan: CutPlanRow) =>
    Object.values(plan.sizeQuantities).some((value) => value > 0) ||
    plan.reCutQty > 0 || plan.markerPlies > 0 || plan.calculatedRequired != null ||
    plan.markerWidthCm != null || plan.markerLengthM != null ||
    Boolean(plan.markerNo.trim() || plan.cutNo.trim() || plan.shrinkage.trim() || plan.shade.trim());
  const requestRemove = (index: number, group: CutPlanningInseamGroup) => {
    if (hasRowData(plans[index])) setPendingDelete({ index, group });
    else void deleteRow(index, group);
  };
  const totals = useMemo(() => {
    const order: Record<string, number> = {};
    const willCut: Record<string, number> = {};
    const planned: Record<string, number> = {};
    for (const group of groups) {
      for (const size of sizeColumns) {
        order[size] = (order[size] || 0) + (group.orderQuantities[size] || 0);
        willCut[size] = (willCut[size] || 0) + (group.willCutQuantities[size] || 0);
      }
    }
    for (const plan of plans) {
      for (const size of sizeColumns) planned[size] = (planned[size] || 0) + (plan.sizeQuantities[size] || 0);
    }
    const plannedTotal = plans.reduce(
      (sum, plan) => sum + sizeColumns.reduce(
        (rowTotal, size) => rowTotal + (plan.sizeQuantities[size] || 0),
        0,
      ),
      0,
    );
    return {
      order,
      willCut,
      planned,
      plannedTotal,
      less: Object.fromEntries(sizeColumns.map((size) => [size, Math.max((willCut[size] || 0) - (planned[size] || 0), 0)])),
      over: Object.fromEntries(sizeColumns.map((size) => [size, Math.max((planned[size] || 0) - (willCut[size] || 0), 0)])),
    };
  }, [groups, plans, sizeColumns]);

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
  return <main className="-mt-4 w-full space-y-3 pb-56 sm:-mt-5">
    <ModulePageHeader eyebrow="Sewing / Cutting" title="Cut Planning" icon={Scissors} compact actions={<div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setShowWorkOrderModal(true)} className="inline-flex h-9 w-52 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50"><span className="truncate">{workOrder || "Find work order"}</span><Search className="size-4 shrink-0" /></button><button type="button" onClick={save} disabled={saving || !workOrder || groups.length === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"><Save className="size-4" />{saving ? "Saving..." : "Save cut planning"}</button></div>} />
    {(error || notice) && <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><AlertCircle className="size-4" /><span className="flex-1">{error || notice}</span><button type="button" aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }} className="rounded p-1 hover:bg-black/5"><X className="size-4" /></button></div>}
    {loading && <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Loading Inseam groups...</div>}
    {!loading && data && <>{groups.length > 0 && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="hide-horizontal-scrollbar max-h-[min(48vh,420px)] overflow-auto pb-8"><table className="min-w-max w-full border-collapse text-xs"><thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-600"><tr>{["Inseam", "Date", ...sizeColumns, "Re-cut", "Total", "Marker no.", "Cut no.", "Marker plies", "Transaction count", "Shrinkage", "Shade", "Calculated required", "Marker width (cm)", "Marker length (m)", ""].map((heading) => <th key={heading} className="border-b border-slate-300 px-2 py-3 font-semibold whitespace-nowrap">{heading}</th>)}</tr></thead><tbody>{groupedPlans.flatMap(({ group, rows }) => [<tr key={`break-${group.inseam}`} className="bg-slate-100"><td colSpan={sizeColumns.length + 14} className="border-y border-slate-300 px-3 py-2"><div className="flex justify-end"><button type="button" onClick={() => add(group)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"><Plus className="size-3.5" /> Add marker row</button></div></td></tr>, ...rows.map(({ plan, index }, row) => { const total = sizeColumns.reduce((sum, size) => sum + (plan.sizeQuantities[size] || 0), 0); const transactions = total * plan.markerPlies; return <tr key={plan.id ?? `${group.inseam}-${row}`} className="border-b border-slate-200 hover:bg-slate-50/50"><td className="cell-label">{group.inseam ?? "-"}</td><td className="p-0"><input type="date" value={plan.planDate} onChange={(event) => update(index, { planDate: event.target.value })} className={`${cellClass} w-32`} /></td>{sizeColumns.map((size) => <td key={size} className="p-0"><input type="number" min="0" step="any" value={plan.sizeQuantities[size] || ""} onWheel={preventWheelChange} onChange={(event) => updateSize(index, size, event.target.value)} className={`${cellClass} w-16 text-right`} /></td>)}<td className="p-0"><input type="number" min="0" step="any" value={plan.reCutQty || ""} onWheel={preventWheelChange} onChange={(event) => update(index, { reCutQty: numeric(event.target.value) })} className={`${cellClass} w-16 text-right`} /></td><td className="cell-value">{displayNumber(total)}</td><td className="p-0"><input value={plan.markerNo} onChange={(event) => update(index, { markerNo: event.target.value })} className={`${cellClass} w-20`} /></td><td className="p-0"><input value={plan.cutNo} onChange={(event) => update(index, { cutNo: event.target.value })} className={`${cellClass} w-20`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.markerPlies || ""} onWheel={preventWheelChange} onChange={(event) => update(index, { markerPlies: numeric(event.target.value) })} className={`${cellClass} w-20 text-right`} /></td><td className="cell-value">{displayNumber(transactions)}</td><td className="p-0"><input value={plan.shrinkage} onChange={(event) => update(index, { shrinkage: event.target.value })} className={`${cellClass} w-24`} /></td><td className="p-0"><input value={plan.shade} onChange={(event) => update(index, { shade: event.target.value })} className={`${cellClass} w-24`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.calculatedRequired ?? ""} onWheel={preventWheelChange} onChange={(event) => update(index, { calculatedRequired: event.target.value === "" ? null : numeric(event.target.value) })} className={`${cellClass} w-24 text-right`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.markerWidthCm ?? ""} onWheel={preventWheelChange} onChange={(event) => update(index, { markerWidthCm: event.target.value === "" ? null : numeric(event.target.value) })} className={`${cellClass} w-24 text-right`} /></td><td className="p-0"><input type="number" min="0" step="any" value={plan.markerLengthM ?? ""} onWheel={preventWheelChange} onChange={(event) => update(index, { markerLengthM: event.target.value === "" ? null : numeric(event.target.value) })} className={`${cellClass} w-24 text-right`} /></td><td className="p-0"><button type="button" aria-label={`Remove marker row ${row + 1}`} onClick={() => requestRemove(index, group)} className="p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /></button></td></tr> })])}</tbody></table></div></section>}
      {groups.length > 0 && (
        <section className="fixed inset-x-4 bottom-5 z-40 mx-auto max-w-[1336px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl sm:inset-x-6 md:inset-x-8 lg:bottom-6">
          <div className="hide-horizontal-scrollbar max-h-44 overflow-auto">
            <table className="min-w-max w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr><th className="px-3 py-1.5 text-left"> </th>{sizeColumns.map((size) => <th key={size} className="px-2 py-1.5 text-right">{size}</th>)}<th className="px-3 py-1.5 text-right">Total</th></tr>
              </thead>
              <tbody>
                {[["Order", totals.order], ["Will be cut", totals.willCut], ["Planned", totals.planned], ["Less", totals.less], ["Over", totals.over]].map(([label, quantities]) => {
                  const values = quantities as Record<string, number>;
                  const total = label === "Planned"
                    ? totals.plannedTotal
                    : sizeColumns.reduce((sum, size) => sum + (values[size] || 0), 0);
                  return <tr key={label as string} className="border-t border-slate-100"><th className="px-3 py-1.5 text-left font-semibold">{label as string}</th>{sizeColumns.map((size) => <td key={size} className="px-2 py-1.5 text-right">{displayNumber(values[size] || 0)}</td>)}<td className="px-3 py-1.5 text-right font-bold">{displayNumber(total)}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </>}
    <WorkOrderSearchModal open={showWorkOrderModal} onClose={() => setShowWorkOrderModal(false)} onSelect={(row) => { setShowWorkOrderModal(false); setSharedWorkOrder(row.workOrder); load(row.workOrder); }} fetchRows={fetchWorkOrderRows} />
    {pendingDelete && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="delete-row-title" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><h2 id="delete-row-title" className="text-base font-semibold text-slate-950">Remove planning row?</h2><p className="mt-2 text-sm text-slate-600">This row contains entered planning data. Remove it?</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deletingRowId !== null} onClick={() => setPendingDelete(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancel</button><button type="button" disabled={deletingRowId !== null} onClick={() => void deleteRow(pendingDelete.index, pendingDelete.group)} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{deletingRowId !== null ? "Removing..." : "Remove row"}</button></div></div></div>}
    <style jsx global>{`.cell-input { height: 2.4rem; border: 0; border-right: 1px solid #e2e8f0; background: transparent; padding: 0 .5rem; outline: none; } .cell-input:focus { background: #eef2ff; box-shadow: inset 0 0 0 1px #6366f1; } .cell-label { border-right: 1px solid #e2e8f0; padding: 0 .6rem; font-weight: 600; color: #334155; } .cell-value { border-right: 1px solid #e2e8f0; padding: 0 .5rem; text-align: right; font-weight: 600; } .hide-horizontal-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .hide-horizontal-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; } input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { margin: 0; }`}</style>
  </main>;
}
