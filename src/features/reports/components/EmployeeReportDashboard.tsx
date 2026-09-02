"use client";

import { useCallback, useRef } from "react";
import { format, startOfMonth, subDays } from "date-fns";
import { Search, Ticket, Wallet, UserRound, Calendar as CalendarIcon, ClipboardList } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { Worker } from "../services/reports.service";
import { useEmployeeReport } from "../hooks/useEmployeeReport";
import type { ReportDateRange } from "../types";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRangeLabel(range: ReportDateRange): string {
  if (!range.from && !range.to) return "All time";
  if (range.from && range.to) {
    return `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`;
  }
  return format((range.from ?? range.to) as Date, "dd MMM yyyy");
}

const PRESETS: { label: string; range: () => ReportDateRange }[] = [
  { label: "Last 7 Days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 Days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Month", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "All Time", range: () => ({}) },
];

export function EmployeeReportDashboard() {
  const {
    employeeCode,
    setEmployeeCode,
    dateRange,
    applyDateRange,
    summary,
    isLoading,
    error,
    handleSelectWorker,
    fetchWorkerSuggestions,
    search,
  } = useEmployeeReport();

  const rangePopoverActionsRef = useRef<{ close: () => void; unmount: () => void } | null>(null);

  // Selecting from the dropdown fills the code field; run the search right
  // away instead of making the user press Search again.
  const handleSelect = useCallback(
    (worker: Worker) => {
      handleSelectWorker(worker);
      search(String(worker.EmployeeID));
    },
    [handleSelectWorker, search],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") search();
    },
    [search],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Search bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2 mb-2.5 border-b border-slate-100 pb-1.5">
          <UserRound className="w-4 h-4 text-[#4f46e5]" />
          <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
            Employee Search
          </h2>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-3">
          <div className="flex flex-col gap-0.5 relative w-full md:w-72">
            <span className="font-bold text-[#475569] text-[10px] uppercase">
              Employee Code / Name <span className="text-red-500">*</span>
            </span>
            <Autocomplete<Worker>
              value={employeeCode}
              onChange={setEmployeeCode}
              onSelect={handleSelect}
              fetchSuggestions={fetchWorkerSuggestions}
              renderSuggestion={(worker) => (
                <>
                  <div>
                    <span className="text-[#4f46e5] font-bold mr-2">
                      {worker.EmployeeID}
                    </span>
                    <span>{worker.FirstName?.trim()}</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                    {worker.ParentDepartment || "Worker"}
                  </span>
                </>
              )}
              getSuggestionValue={(worker) => String(worker.EmployeeID)}
              placeholder="Enter employee code or name"
              inputClassName="w-full px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
              onKeyDown={handleKeyDown}
              minChars={1}
            />
          </div>

          {/* Tenure / date range */}
          <div className="flex flex-col gap-0.5 relative w-full md:w-64">
            <span className="font-bold text-[#475569] text-[10px] uppercase">
              Tenure
            </span>
            <Popover actionsRef={rangePopoverActionsRef}>
              <PopoverTrigger className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white cursor-pointer">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{formatRangeLabel(dateRange)}</span>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white" align="start">
                <div className="flex flex-col gap-2 p-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          applyDateRange(preset.range());
                          rangePopoverActionsRef.current?.close();
                        }}
                        className="px-2 py-1 rounded-md text-[10px] font-bold text-[#4f46e5] bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <Calendar
                    mode="range"
                    captionLayout="dropdown"
                    selected={dateRange.from || dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined}
                    onSelect={(range) => {
                      const next = { from: range?.from, to: range?.to };
                      applyDateRange(next);
                      // A complete range (both ends picked) is "done" —
                      // close immediately, same as the single-date picker
                      // in coupon-scanning's InformationPanel.
                      if (next.from && next.to) {
                        rangePopoverActionsRef.current?.close();
                      }
                    }}
                    disabled={(date) => date > new Date()}
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <button
            onClick={() => search()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#4f46e5] text-white text-xs font-bold hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            {isLoading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && (
          <p className="mt-2.5 text-xs font-semibold text-red-600">{error}</p>
        )}
      </div>

      {summary && (
        <>
          {/* Employee info */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
              Employee
            </span>
            <span className="text-sm font-bold text-[#0f172a]">
              {summary.employee.FirstName?.trim() || "—"}{" "}
              <span className="text-[#4f46e5]">#{summary.employee.EmployeeID}</span>
            </span>
            <span className="text-xs text-[#64748b]">
              {summary.employee.DesignationName || "—"}
              {summary.employee.ParentDepartment
                ? ` · ${summary.employee.ParentDepartment}`
                : ""}
            </span>
            <span className="text-[10px] text-[#94a3b8] mt-1">
              Tenure: {formatRangeLabel(dateRange)}
            </span>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-teal-50 text-teal-500 flex items-center justify-center shrink-0">
                <Ticket className="w-5 h-5" />
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                  Coupons Scanned
                </span>
                <span className="text-xl font-extrabold text-[#0f172a]">
                  {summary.totalCoupons}
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                  Work Orders
                </span>
                <span className="text-xl font-extrabold text-[#0f172a]">
                  {summary.totalWorkOrders}
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                  Total Amount
                </span>
                <span className="text-xl font-extrabold text-[#0f172a]">
                  {formatAmount(summary.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
