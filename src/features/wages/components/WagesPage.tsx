"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Coins,
  Loader2,
  Search,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  ArrowLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useAuth } from "@/features/auth/context/auth-context";
import { CreateWagesModal } from "./CreateWagesModal";
import {
  deleteWages,
  fetchWageTitleSuggestions,
  fetchWages,
} from "../services/wages.service";
import type { WagesBatch, WageRow } from "../types";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface EmployeeGroup {
  employeeCode: string;
  employeeName: string | null;
  items: WageRow[];
  totalBundles: number;
  totalQty: number;
  totalPay: number;
}

function groupByEmployee(rows: WageRow[]): EmployeeGroup[] {
  const map = new Map<string, EmployeeGroup>();
  for (const row of rows) {
    const code = row.employeeCode || "—";
    const existing = map.get(code);
    if (!existing) {
      map.set(code, {
        employeeCode: code,
        employeeName: row.employeeName ?? null,
        items: [row],
        totalBundles: row.bundleCount,
        totalQty: row.qty,
        totalPay: row.totalPay,
      });
    } else {
      existing.items.push(row);
      existing.totalBundles += row.bundleCount;
      existing.totalQty += row.qty;
      existing.totalPay += row.totalPay;
    }
  }
  return Array.from(map.values());
}

// Local copy rather than importing from @/lib/db — that module opens MSSQL
// pools and must never reach the client bundle. Same 24th-to-24th pay-cycle
// rule as CreateWagesModal's own copy and the Order Wise/Operator Wise
// reports, so "the current tenure" means the same thing everywhere in Wages.
function currentPayCycleStart(): Date {
  const now = new Date();
  const day = now.getDate();
  const cycleMonth = day >= 24 ? now.getMonth() : now.getMonth() - 1;
  return new Date(now.getFullYear(), cycleMonth, 24);
}

export function WagesPage() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  // Default tenure, before the user edits anything: the current pay cycle
  // (24th of last/this month → today) — same window Order Wise/Operator
  // Wise always report on, so opening Wages shows "this cycle" by default
  // instead of an empty, unfiltered everything-listing.
  const [from, setFrom] = useState(() =>
    format(currentPayCycleStart(), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [batches, setBatches] = useState<WagesBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [msg, setMsg] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  // Which of several matching wages the user picked to view in full — only
  // meaningful when a tenure search matches more than one wage (e.g. a
  // range spanning two separately-titled batches). Reset on every new
  // search so a stale selection never survives into a different result set.
  const [selectedWageId, setSelectedWageId] = useState<number | null>(null);
  // Whether the LAST executed search actually had a title/tenure filter —
  // captured at search time (not derived from the live input state) so it
  // can't drift if the fields change after the search already ran. The
  // picker step only makes sense once the user has narrowed things down;
  // the default "everything" listing (no filters at all) always shows every
  // batch stacked, same as before this feature existed, no matter how many
  // there are.
  const [lastSearchWasFiltered, setLastSearchWasFiltered] = useState(false);

  // Takes explicit overrides rather than only reading title/from/to from
  // state, because a date picker's onChange fires and reads this callback's
  // closure BEFORE the resulting re-render lands — calling runSearch()
  // right after setTo(val) in the same handler would still see the OLD
  // `to` value. Passing { to: val } directly sidesteps that stale-closure
  // gap entirely instead of working around it with an effect.
  const runSearch = useCallback(
    async (overrides?: { title?: string; from?: string; to?: string }) => {
      const searchTitle = overrides?.title ?? title;
      const searchFrom = overrides?.from ?? from;
      const searchTo = overrides?.to ?? to;

      setLoading(true);
      setHasSearched(true);
      setMsg(null);
      setSelectedWageId(null);
      const trimmedTitle = searchTitle.trim();
      setLastSearchWasFiltered(Boolean(trimmedTitle || searchFrom || searchTo));
      const res = await fetchWages({
        title: trimmedTitle || undefined,
        from: searchFrom || undefined,
        to: searchTo || undefined,
      });
      if (!res.ok) {
        setMsg({ type: "error", message: res.error });
        setBatches([]);
      } else {
        setBatches(res.wages);
      }
      setLoading(false);
    },
    [title, from, to],
  );

  // The picker only applies to a filtered search that's still ambiguous
  // (more than one match). An unfiltered "show everything" search, or a
  // filtered search that already narrowed to one result, needs no picking
  // step — activeBatch stays null in both of those cases and the "show
  // every batch stacked" branch renders instead.
  const showPicker = lastSearchWasFiltered && batches.length > 1;
  const activeBatch = useMemo(() => {
    if (!lastSearchWasFiltered) return null;
    if (batches.length === 1) return batches[0];
    return batches.find((b) => b.WageId === selectedWageId) ?? null;
  }, [lastSearchWasFiltered, batches, selectedWageId]);

  // Every wage batch, on first load — same as opening the page with no
  // filters applied, so the list isn't empty by default.
  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = useCallback(
    async (wageId: number) => {
      if (isDeleting) return;
      setIsDeleting(wageId);
      setMsg(null);
      const res = await deleteWages({ wageId });
      if (!res.ok) {
        setMsg({ type: "error", message: res.error });
      } else {
        setMsg({ type: "success", message: res.message });
        setBatches((prev) => prev.filter((b) => b.WageId !== wageId));
      }
      setIsDeleting(null);
    },
    [isDeleting],
  );

  return (
    <div data-client-brand className="flex flex-col gap-6 [&_thead_th]:border-b [&_thead_th]:border-slate-200 [&_thead_th]:bg-slate-50 [&_thead_th]:py-3 [&_thead_th]:text-[10px] [&_thead_th]:font-semibold [&_thead_th]:uppercase [&_thead_th]:tracking-wide [&_thead_th]:text-slate-500 [&_tbody_td]:py-2.5 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-emerald-50/30 [&_tfoot_tr]:border-t-2 [&_tfoot_tr]:border-slate-300 [&_tfoot_tr]:bg-slate-100 [&_tfoot_tr]:font-semibold [&_tfoot_tr]:text-slate-900">
      {/* Header */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 md:px-5">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
              <Coins className="size-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">
              Employee Wages
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-800"
            >
              <Coins className="w-3.5 h-3.5" />
              Create Wages
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-white p-4 sm:grid-cols-4 md:p-5">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[11px] font-semibold text-slate-700">
              Wage Title
            </span>
            <Autocomplete<string>
              value={title}
              onChange={setTitle}
              onSelect={(picked) => {
                setTitle(picked);
                void runSearch();
              }}
              fetchSuggestions={fetchWageTitleSuggestions}
              renderSuggestion={(t) => <span>{t}</span>}
              getSuggestionValue={(t) => t}
              minChars={0}
              placeholder="Search by title…"
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              inputClassName="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-700">
              From
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-700">To</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  const val = e.target.value;
                  setTo(val);
                  // Auto-search the moment "To" is picked — "From" (and any
                  // typed title) still apply via the current state, only
                  // "To" needs the fresh value passed explicitly.
                  void runSearch({ to: val });
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <Button
                onClick={() => runSearch()}
                disabled={loading}
                className="h-10 shrink-0 rounded-lg bg-indigo-700 px-3 text-white hover:bg-indigo-800"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <CreateWagesModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          createdBy={user?.email ?? null}
          onCreated={() => {
            setMsg({ type: "success", message: "Wages created successfully." });
            void runSearch();
          }}
        />

        {msg && (
          <div
            className={`mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium ${
              msg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {msg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{msg.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold text-sm px-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Results */}
        <div className="p-4 md:p-5">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm font-medium text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading wages…
            </div>
          ) : batches.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-center text-sm font-medium text-slate-500">
              {hasSearched
                ? "No wage batches match this search."
                : "No wage batches yet."}
            </div>
          ) : showPicker && !activeBatch ? (
            // Edge case: a title/tenure search matched more than one wage
            // (they can share a date range or overlap without sharing a
            // title) — ask which one to view instead of guessing or
            // dumping every table on screen at once. This never applies to
            // the default, unfiltered "every wage" view below.
            <div className="flex flex-col gap-2">
              <p className="px-1 text-sm font-medium text-slate-600">
                {batches.length} wages match this search — select one to view:
              </p>
              {batches.map((batch) => (
                <button
                  key={batch.WageId}
                  type="button"
                  onClick={() => setSelectedWageId(batch.WageId)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/30"
                >
                  <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                    <span className="font-bold text-slate-800">
                      {batch.Title || `Batch #${batch.WageId}`}
                    </span>
                    <span className="text-slate-500">
                      {batch.FromDate?.slice(0, 10)} →{" "}
                      {batch.ToDate?.slice(0, 10) ?? "—"}
                    </span>
                    {batch.CreatedBy && (
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                        {batch.CreatedBy}
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-emerald-700 text-xs shrink-0">
                    Rs. {formatAmount(Number(batch.TotalAmount))}
                  </span>
                </button>
              ))}
            </div>
          ) : activeBatch ? (
            // A filtered search that narrowed to exactly one wage (or the
            // user just picked one from the list above).
            <div className="flex flex-col gap-3">
              {showPicker && (
                <button
                  type="button"
                  onClick={() => setSelectedWageId(null)}
                  className="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to {batches.length} matches
                </button>
              )}
              {renderBatchCard(activeBatch)}
            </div>
          ) : (
            // Default, unfiltered view — every wage batch stacked, exactly
            // as it behaved before the picker existed.
            <div className="flex flex-col gap-5">
              {batches.map((batch) => (
                <Fragment key={batch.WageId}>{renderBatchCard(batch)}</Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderBatchCard(batch: WagesBatch) {
    const groups = groupByEmployee(batch.rows);
    const batchGrandBundles = groups.reduce((s, g) => s + g.totalBundles, 0);
    const batchGrandQty = groups.reduce((s, g) => s + g.totalQty, 0);
    const batchGrandPay = groups.reduce((s, g) => s + g.totalPay, 0);

    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
            <span className="font-semibold text-slate-900">
              {batch.Title || `Batch #${batch.WageId}`}
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] tabular-nums text-slate-600">
              {batch.FromDate?.slice(0, 10)} →{" "}
              {batch.ToDate?.slice(0, 10) ?? "—"}
            </span>
            {batch.CreatedBy && (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                {batch.CreatedBy}
              </span>
            )}
            <span className="font-semibold tabular-nums text-emerald-800">
              Rs. {formatAmount(Number(batch.TotalAmount))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleDelete(batch.WageId)}
            disabled={isDeleting === batch.WageId}
            className="flex h-8 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-[10px] font-semibold uppercase tracking-wider text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting === batch.WageId ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            Delete
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="py-2.5 px-3 border-r border-slate-200">
                  EmpCode
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200">
                  Employee Name
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200">W/O</th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200">
                  Date
                </th>
                <th className="py-2.5 px-3 border-r border-slate-200">
                  Operation
                </th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">
                  Rate
                </th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200">
                  Bundle
                </th>
                <th className="py-2.5 px-3 text-center border-r border-slate-200">
                  Quantity
                </th>
                <th className="py-2.5 px-3 text-right border-r border-slate-200">
                  Total Pay
                </th>
                <th className="py-2.5 px-3 text-center w-20">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {groups.map((g) => (
                <Fragment key={g.employeeCode}>
                  {g.items.map((item, idx) => (
                    <tr
                      key={idx}
                      className="transition-colors odd:bg-slate-50/30 hover:bg-emerald-50/40"
                    >
                      <td className="py-2 px-3 font-mono font-bold border-r border-slate-100 align-top">
                        {idx === 0 ? g.employeeCode : ""}
                      </td>
                      <td className="py-2 px-3 font-bold border-r border-slate-100 align-top">
                        {idx === 0 ? g.employeeName || "—" : ""}
                      </td>
                      <td className="py-2 px-3 font-mono border-r border-slate-100">
                        {item.workOrder || "—"}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-100 whitespace-nowrap">
                        {item.workDate || "—"}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-100">
                        {item.operation || "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono border-r border-slate-100">
                        {item.rate != null ? item.rate.toFixed(2) : "—"}
                      </td>
                      <td className="py-2 px-3 text-center border-r border-slate-100">
                        {item.bundleCount}
                      </td>
                      <td className="py-2 px-3 text-center font-bold border-r border-slate-100">
                        {item.qty.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right font-bold font-mono border-r border-slate-100">
                        {formatAmount(item.totalPay)}
                      </td>
                      <td className="py-2 px-3"></td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/60 font-bold text-slate-800">
                    <td
                      className="py-2 px-3 border-r border-slate-100"
                      colSpan={6}
                    >
                      Employee wise Total :
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-100">
                      {g.totalBundles}
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-100">
                      {g.totalQty.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono border-r border-slate-100">
                      {formatAmount(g.totalPay)}
                    </td>
                    <td></td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-900 font-semibold text-white">
                <td className="border-r border-white/10 px-3 py-3" colSpan={6}>
                  Grand Total :
                </td>
                <td className="py-2.5 px-3 text-center border-r border-slate-200">
                  {batchGrandBundles}
                </td>
                <td className="py-2.5 px-3 text-center border-r border-slate-200">
                  {batchGrandQty.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200">
                  {formatAmount(batchGrandPay)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }
}
