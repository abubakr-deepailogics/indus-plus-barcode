"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { format, formatDistanceToNow, startOfMonth, subDays } from "date-fns";
import {
  Search,
  Ticket,
  Wallet,
  UserRound,
  Calendar as CalendarIcon,
  ClipboardList,
  Printer,
  ChevronLeft,
  ChevronRight,
  Scissors,
  FileSpreadsheet,
} from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { Worker } from "../services/reports.service";
import { useEmployeeReport } from "../hooks/useEmployeeReport";
import type { ReportDateRange } from "../types";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimestamp(timestamp?: string | null): string {
  if (!timestamp) return "—";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "—";
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "—";
  }
}

function formatRangeLabel(range: ReportDateRange): string {
  if (!range.from && !range.to) return "All time";
  if (range.from && range.to) {
    return `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`;
  }
  return format((range.from ?? range.to) as Date, "dd MMM yyyy");
}

function getInitials(name?: string): string {
  if (!name) return "EM";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PRESETS: { label: string; range: () => ReportDateRange }[] = [
  { label: "Last 7 Days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 Days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Month", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: "All Time", range: () => ({}) },
];

const ITEMS_PER_PAGE = 15;

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

  const [activeTab, setActiveTab] = useState<"operations" | "workOrders" | "coupons">("operations");
  const [couponSearch, setCouponSearch] = useState("");
  const [couponPage, setCouponPage] = useState(1);

  const rangePopoverActionsRef = useRef<{ close: () => void; unmount: () => void } | null>(null);

  // Selecting from the dropdown fills the code field; run search right away
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

  // Filtered coupons for itemized audit trail
  const coupons = summary?.coupons;
  const filteredCoupons = useMemo(() => {
    if (!coupons || coupons.length === 0) return [];
    if (!couponSearch.trim()) return coupons;
    const q = couponSearch.toLowerCase().trim();
    return coupons.filter(
      (c) =>
        c.couponCode?.toLowerCase().includes(q) ||
        c.workOrder?.toLowerCase().includes(q) ||
        c.bundleNo?.toLowerCase().includes(q) ||
        c.cutNo?.toLowerCase().includes(q) ||
        c.operationName?.toLowerCase().includes(q) ||
        c.operationCode?.toLowerCase().includes(q) ||
        c.section?.toLowerCase().includes(q),
    );
  }, [coupons, couponSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredCoupons.length / ITEMS_PER_PAGE));
  const paginatedCoupons = useMemo(() => {
    const start = (couponPage - 1) * ITEMS_PER_PAGE;
    return filteredCoupons.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCoupons, couponPage]);

  return (
    <div className="flex flex-col gap-6">
      {/* Search Bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm no-print">
        <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2">
          <UserRound className="w-4 h-4 text-[#4f46e5]" />
          <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
            Employee Search
          </h2>
        </div>

        <div className="flex flex-col md:flex-row items-end gap-3">
          <div className="flex flex-col gap-1 relative w-full md:w-80">
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
              inputClassName="w-full px-3.5 py-2 rounded-xl border border-[#e2e8f0] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
              onKeyDown={handleKeyDown}
              minChars={1}
            />
          </div>

          {/* Tenure / date range */}
          <div className="flex flex-col gap-1 relative w-full md:w-72">
            <span className="font-bold text-[#475569] text-[10px] uppercase">
              Tenure / Scope
            </span>
            <Popover actionsRef={rangePopoverActionsRef}>
              <PopoverTrigger className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#e2e8f0] text-xs font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white cursor-pointer">
                <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
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
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#4f46e5] bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
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
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#4f46e5] text-white text-xs font-bold hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm shrink-0 w-full md:w-auto"
          >
            <Search className="w-3.5 h-3.5" />
            {isLoading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>
        )}
      </div>

      {summary && (
        <>
          {/* Employee Profile Header Banner */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            {/* Left: Avatar + Details */}
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                {getInitials(summary.employee.FirstName)}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                    {summary.employee.FirstName?.trim() || "Unknown Employee"}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#4f46e5] font-black text-xs border border-indigo-100/80 font-mono">
                    #{summary.employee.EmployeeID}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                  {summary.employee.DesignationName && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                      {summary.employee.DesignationName}
                    </span>
                  )}
                  {summary.employee.DepartmentName && (
                    <span className="text-slate-600 font-semibold">{summary.employee.DepartmentName}</span>
                  )}
                  {summary.employee.ParentDepartment && (
                    <span className="text-slate-400">· {summary.employee.ParentDepartment}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Print Button */}
            <div className="flex items-center gap-2.5 flex-wrap no-print">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!summary}
                className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-[#334155] disabled:opacity-50 py-1.5 px-3 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs flex items-center justify-center gap-1.5"
                title="Print Report"
              >
                <Printer className="w-3.5 h-3.5 text-[#4f46e5]" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* 3-Card Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 no-print">
            {/* Card 1: Coupons Scanned */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                      <Ticket className="w-4.5 h-4.5" />
                    </span>
                    <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Coupons Scanned
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                    {formatRangeLabel(dateRange)}
                  </span>
                </div>

                <div className="my-3.5">
                  <span className="text-3xl font-black text-[#0f172a] tracking-tight">
                    {summary.totalCoupons.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Last Timestamp</span>
                  <span
                    className="font-semibold text-slate-700 text-[11px] truncate max-w-[150px]"
                    title={summary.lastScannedAt ? new Date(summary.lastScannedAt).toLocaleString() : undefined}
                  >
                    {formatTimestamp(summary.lastScannedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Selected Scope</span>
                  <span className="font-semibold text-[#4f46e5] text-[11px] truncate max-w-[150px]">
                    {formatRangeLabel(dateRange)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Work Orders */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4.5 h-4.5" />
                    </span>
                    <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Work Orders
                    </span>
                  </div>
                  {summary.recentWorkOrder && (
                    <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-md font-mono">
                      {summary.recentWorkOrder}
                    </span>
                  )}
                </div>

                <div className="my-3.5">
                  <span className="text-3xl font-black text-[#0f172a] tracking-tight">
                    {summary.totalWorkOrders} {summary.totalWorkOrders === 1 ? "Order" : "Orders"}
                  </span>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Recent W/O</span>
                  <span
                    className="font-bold text-slate-800 text-[11px] font-mono truncate max-w-[150px]"
                    title={summary.recentWorkOrder || undefined}
                  >
                    {summary.recentWorkOrder || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Active Line Item</span>
                  <span className="font-semibold text-slate-700 text-[11px] truncate max-w-[150px]">
                    {summary.recentCutNo != null || summary.recentBundleNo != null
                      ? `Cut ${summary.recentCutNo ?? "—"} | Bundle #${summary.recentBundleNo ?? "—"}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Current Operation</span>
                  <span
                    className="font-semibold text-slate-800 text-[11px] truncate max-w-[150px]"
                    title={summary.recentOperationName || summary.recentOperationCode || undefined}
                  >
                    {summary.recentOperationName || summary.recentOperationCode || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Total Amount */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Wallet className="w-4.5 h-4.5" />
                    </span>
                    <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Total Amount
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                    PKR
                  </span>
                </div>

                <div className="my-3.5">
                  <span className="text-3xl font-black text-[#0f172a] tracking-tight">
                    Rs. {formatAmount(summary.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Total Output</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {summary.totalQty.toLocaleString()} Pcs
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Standard SAM</span>
                  <span className="font-semibold text-slate-700 text-[11px]">
                    {summary.totalSam.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} min
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">Avg Rate / Pc</span>
                  <span className="font-semibold text-emerald-700 text-[11px]">
                    {summary.totalQty > 0
                      ? `Rs. ${formatAmount(summary.avgRatePerPiece)}`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Deep-Dive Detailed Breakdown Section */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden flex flex-col no-print">
            {/* Tab Header Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-4 pt-3 pb-0 gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("operations")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "operations"
                      ? "bg-[#4f46e5] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Operations Breakdown</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      activeTab === "operations"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {summary.operations?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("workOrders")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "workOrders"
                      ? "bg-[#4f46e5] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Work Orders</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      activeTab === "workOrders"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {summary.workOrders?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("coupons")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "coupons"
                      ? "bg-[#4f46e5] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Scanned Coupons Trail</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      activeTab === "coupons"
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {summary.coupons?.length || 0}
                  </span>
                </button>
              </div>

              {/* Tab contextual quick-search for coupons */}
              {activeTab === "coupons" && (
                <div className="relative pb-2.5 sm:pb-2 w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={couponSearch}
                    onChange={(e) => {
                      setCouponSearch(e.target.value);
                      setCouponPage(1);
                    }}
                    placeholder="Search coupons, orders, ops…"
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5]"
                  />
                </div>
              )}
            </div>

            {/* Tab 1: Operations Breakdown Table */}
            {activeTab === "operations" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Operation</th>
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">SMV</th>
                      <th className="py-2.5 px-3 text-center">Coupons</th>
                      <th className="py-2.5 px-3 text-center">Output (Pcs)</th>
                      <th className="py-2.5 px-3 text-right">SAM Earned</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                      <th className="py-2.5 px-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.operations?.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                          No operations recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      summary.operations?.map((op, idx) => {
                        const share =
                          summary.totalAmount > 0 ? (op.totalAmount / summary.totalAmount) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">
                                  {op.operationName}
                                </span>
                                <span className="text-[10px] font-mono text-indigo-600 font-bold">
                                  {op.operationCode}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                {op.section || "—"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              {op.rate != null ? `Rs. ${op.rate.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                              {op.smv != null ? op.smv.toFixed(2) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                              {op.couponCount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-center font-extrabold text-[#4f46e5]">
                              {op.totalQty.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                              {op.totalSam.toFixed(2)} min
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              Rs. {formatAmount(op.totalAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-600 h-full rounded-full"
                                    style={{ width: `${Math.min(100, share)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[10px] font-bold text-slate-600 w-8 text-right">
                                  {share.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {summary.operations?.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200 font-bold text-slate-800 text-xs">
                        <td className="py-2.5 px-3" colSpan={4}>
                          Total ({summary.operations.length} Operations)
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-900">
                          {summary.totalCoupons.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#4f46e5]">
                          {summary.totalQty.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {summary.totalSam.toFixed(2)} min
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-black">
                          Rs. {formatAmount(summary.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[10px]">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Tab 2: Work Orders Breakdown Table */}
            {activeTab === "workOrders" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Work Order #</th>
                      <th className="py-2.5 px-3 text-center">Operations</th>
                      <th className="py-2.5 px-3 text-center">Coupons</th>
                      <th className="py-2.5 px-3 text-center">Total Output (Pcs)</th>
                      <th className="py-2.5 px-3 text-right">SAM Earned</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                      <th className="py-2.5 px-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.workOrders?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                          No work orders recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      summary.workOrders?.map((wo, idx) => {
                        const share =
                          summary.totalAmount > 0 ? (wo.totalAmount / summary.totalAmount) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-[#4f46e5] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                {wo.workOrder}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                              {wo.operationsCount}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                              {wo.couponCount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-center font-extrabold text-[#4f46e5]">
                              {wo.totalQty.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                              {wo.totalSam.toFixed(2)} min
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                              Rs. {formatAmount(wo.totalAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-cyan-600 h-full rounded-full"
                                    style={{ width: `${Math.min(100, share)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[10px] font-bold text-slate-600 w-8 text-right">
                                  {share.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {summary.workOrders?.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200 font-bold text-slate-800 text-xs">
                        <td className="py-2.5 px-3" colSpan={2}>
                          Total ({summary.workOrders.length} Work Orders)
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-900">
                          {summary.totalCoupons.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#4f46e5]">
                          {summary.totalQty.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {summary.totalSam.toFixed(2)} min
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 font-black">
                          Rs. {formatAmount(summary.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[10px]">
                          100.0%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Tab 3: Itemized Coupons Audit Trail */}
            {activeTab === "coupons" && (
              <div className="flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-3">Coupon Code</th>
                        <th className="py-2.5 px-3">Work Order</th>
                        <th className="py-2.5 px-3 text-center">Cut #</th>
                        <th className="py-2.5 px-3 text-center">Bundle #</th>
                        <th className="py-2.5 px-3 text-center">Qty (Pcs)</th>
                        <th className="py-2.5 px-3">Operation</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Value</th>
                        <th className="py-2.5 px-3 text-right">Scanned At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedCoupons.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                            No matching coupons found.
                          </td>
                        </tr>
                      ) : (
                        paginatedCoupons.map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 font-mono font-bold text-slate-800 text-[11px]">
                              #{c.couponCode}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {c.workOrder}
                            </td>
                            <td className="py-2 px-3 text-center font-semibold text-slate-700">
                              {c.cutNo || "—"}
                            </td>
                            <td className="py-2 px-3 text-center font-semibold text-slate-700">
                              {c.bundleNo || "—"}
                            </td>
                            <td className="py-2 px-3 text-center font-black text-[#4f46e5]">
                              {c.qty ?? "—"}
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-800 text-[11px]">
                                {c.operationName || c.operationCode || "—"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {c.rate != null ? `Rs. ${c.rate.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">
                              {c.value != null ? `Rs. ${c.value.toFixed(2)}` : "—"}
                            </td>
                            <td className="py-2 px-3 text-right text-[11px] text-slate-500 font-medium whitespace-nowrap">
                              {c.scannedAt
                                ? format(new Date(c.scannedAt), "dd MMM, hh:mm a")
                                : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
                  <span className="font-medium">
                    Showing {(couponPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(couponPage * ITEMS_PER_PAGE, filteredCoupons.length)} of{" "}
                    {filteredCoupons.length} coupons
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={couponPage === 1}
                      onClick={() => setCouponPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-bold text-slate-800">
                      {couponPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={couponPage >= totalPages}
                      onClick={() => setCouponPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Print Styles (Matches Cut Report styling) */}
          <style>{`
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              .no-print {
                display: none !important;
              }
              .print-only {
                display: block !important;
              }
              @page {
                size: A4 portrait;
                margin: 1cm 1cm 1cm 1cm;
              }
              .print-container {
                width: 100%;
                font-family: Arial, sans-serif;
                color: black;
              }
              .print-header-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
                border: 1.5px solid #000;
              }
              .print-header-table td {
                padding: 4px 8px;
                border: 1px solid #000;
                vertical-align: top;
                font-size: 10px;
                line-height: 1.4;
              }
              .print-ops-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 10px;
                border: 1px solid #000;
              }
              .print-ops-table th, .print-ops-table td {
                border: 1px solid #000;
                padding: 3.5px 5px;
                font-size: 8.5px;
                text-align: left;
              }
              .print-ops-table th {
                background-color: #e2e8f0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                font-weight: bold;
                text-transform: uppercase;
                font-size: 8px;
              }
              .print-ops-table td.text-center, .print-ops-table th.text-center {
                text-align: center;
              }
              .print-ops-table td.text-right, .print-ops-table th.text-right {
                text-align: right;
              }
              .print-totals-row td {
                font-weight: bold;
                background-color: #f1f5f9 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            @media screen {
              .print-only {
                display: none !important;
              }
            }
          `}</style>

          {/* PRINT ONLY PREVIEW CONTAINER (Same format as Cut Report) */}
          <div className="print-only print-container">
            <h2 className="text-center font-extrabold text-sm uppercase tracking-wide mb-3 border-b-2 border-black pb-2">
              Employee Productivity & Scan Report for Indus Plus Pvt Limited
            </h2>

            {/* Header / Worker Info Table */}
            <table className="print-header-table">
              <tbody>
                <tr>
                  <td style={{ width: "35%" }}>
                    <div className="flex flex-col gap-1">
                      <div><strong>EMPLOYEE:</strong> {summary.employee.FirstName?.trim() || "—"}</div>
                      <div><strong>EMPLOYEE ID:</strong> #{summary.employee.EmployeeID}</div>
                    </div>
                  </td>
                  <td style={{ width: "35%" }}>
                    <div className="flex flex-col gap-1">
                      <div><strong>DESIGNATION:</strong> {summary.employee.DesignationName || "—"}</div>
                      <div><strong>DEPARTMENT:</strong> {summary.employee.DepartmentName || summary.employee.ParentDepartment || "—"}</div>
                    </div>
                  </td>
                  <td style={{ width: "30%" }}>
                    <div className="flex flex-col gap-1">
                      <div><strong>REPORT TENURE:</strong> {formatRangeLabel(dateRange)}</div>
                      <div><strong>PRINTED AT:</strong> {format(new Date(), "dd MMM yyyy, hh:mm a")}</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3}>
                    <div className="grid grid-cols-4 gap-2 text-[9.5px]">
                      <div><strong>COUPONS SCANNED:</strong> {summary.totalCoupons.toLocaleString()}</div>
                      <div><strong>WORK ORDERS:</strong> {summary.totalWorkOrders}</div>
                      <div><strong>TOTAL OUTPUT (PCS):</strong> {summary.totalQty.toLocaleString()}</div>
                      <div><strong>TOTAL AMOUNT (RS.):</strong> Rs. {formatAmount(summary.totalAmount)}</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Operations Breakdown Table */}
            <h3 className="font-bold text-xs uppercase mb-1.5">Operations Breakdown</h3>
            <table className="print-ops-table">
              <thead>
                <tr>
                  <th className="text-center w-10">#</th>
                  <th>OPERATION CODE</th>
                  <th>OPERATION NAME</th>
                  <th>SECTION</th>
                  <th className="text-right w-16">RATE (RS.)</th>
                  <th className="text-right w-14">SMV</th>
                  <th className="text-center w-16">COUPONS</th>
                  <th className="text-center w-18">OUTPUT (PCS)</th>
                  <th className="text-right w-20">SAM EARNED</th>
                  <th className="text-right w-22">TOTAL AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {summary.operations?.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-2">No operations recorded for this period.</td>
                  </tr>
                ) : (
                  summary.operations?.map((op, idx) => (
                    <tr key={idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td className="font-mono font-bold">{op.operationCode}</td>
                      <td>{op.operationName}</td>
                      <td>{op.section || "—"}</td>
                      <td className="text-right font-mono">{op.rate != null ? `Rs. ${op.rate.toFixed(2)}` : "—"}</td>
                      <td className="text-right font-mono">{op.smv != null ? op.smv.toFixed(2) : "—"}</td>
                      <td className="text-center font-bold">{op.couponCount.toLocaleString()}</td>
                      <td className="text-center font-bold">{op.totalQty.toLocaleString()}</td>
                      <td className="text-right">{op.totalSam.toFixed(2)} min</td>
                      <td className="text-right font-bold">Rs. {formatAmount(op.totalAmount)}</td>
                    </tr>
                  ))
                )}
                <tr className="print-totals-row">
                  <td colSpan={6} className="text-right uppercase">Grand Total</td>
                  <td className="text-center">{summary.totalCoupons.toLocaleString()}</td>
                  <td className="text-center">{summary.totalQty.toLocaleString()}</td>
                  <td className="text-right">{summary.totalSam.toFixed(2)} min</td>
                  <td className="text-right">Rs. {formatAmount(summary.totalAmount)}</td>
                </tr>
              </tbody>
            </table>

            {/* Work Orders Summary Table (if multiple work orders) */}
            {summary.workOrders?.length > 1 && (
              <>
                <h3 className="font-bold text-xs uppercase mb-1.5 mt-2">Work Orders Summary</h3>
                <table className="print-ops-table">
                  <thead>
                    <tr>
                      <th className="text-center w-10">#</th>
                      <th>WORK ORDER #</th>
                      <th className="text-center w-20">OPERATIONS</th>
                      <th className="text-center w-20">COUPONS</th>
                      <th className="text-center w-24">OUTPUT (PCS)</th>
                      <th className="text-right w-24">SAM EARNED</th>
                      <th className="text-right w-28">TOTAL AMOUNT (RS.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.workOrders.map((wo, idx) => (
                      <tr key={idx}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="font-mono font-bold">{wo.workOrder}</td>
                        <td className="text-center">{wo.operationsCount}</td>
                        <td className="text-center">{wo.couponCount.toLocaleString()}</td>
                        <td className="text-center">{wo.totalQty.toLocaleString()}</td>
                        <td className="text-right">{wo.totalSam.toFixed(2)} min</td>
                        <td className="text-right font-bold">Rs. {formatAmount(wo.totalAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Signature Block */}
            <div className="flex justify-between items-end mt-12 pt-4 text-xs">
              <div className="text-center">
                <div className="border-t border-black w-36 pt-1 font-bold">Prepared By</div>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-36 pt-1 font-bold">Checked By (IE)</div>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-36 pt-1 font-bold">Approved By</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
