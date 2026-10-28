"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  CalendarIcon,
  ClipboardCheck,
  FileSpreadsheet,
  Printer,
  Search,
} from "lucide-react";
import { useDepartment } from "@/lib/department-context";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { downloadXlsx } from "@/lib/csv-export";
import type { DummyEmployee } from "../types";

type Scan = {
  employeeCode: string;
  employeeName: string;
  workOrder: string;
  scannedAt: string;
  operation: string;
  sam: number;
  bundleNo: string;
  quantity: number;
};

type Row = Omit<Scan, "bundleNo"> & { bundleCount: number };
type Range = { from?: Date; to?: Date };
type Totals = { sam: number; bundles: number; quantity: number };

const emptyTotals: Totals = { sam: 0, bundles: 0, quantity: 0 };

function payCycle(): Range {
  const today = new Date();
  const startMonth = today.getDate() >= 24 ? today.getMonth() : today.getMonth() - 1;
  return { from: new Date(today.getFullYear(), startMonth, 24), to: today };
}

function rangeLabel(range: Range) {
  return range.from && range.to
    ? `${format(range.from, "dd-MM-yy")} → ${format(range.to, "dd-MM-yy")}`
    : "All dates";
}

function sumRows(rows: Row[]): Totals {
  return rows.reduce(
    (sum, row) => ({
      sam: sum.sam + row.sam,
      bundles: sum.bundles + row.bundleCount,
      quantity: sum.quantity + row.quantity,
    }),
    emptyTotals,
  );
}

function TracePrintPreview({
  department,
  employee,
  range,
  groups,
  totals,
}: {
  department: string;
  employee: string;
  range: Range;
  groups: Row[][];
  totals: Totals;
}) {
  return (
    <div className="trace-print-only trace-print-container">
      <h2>Trace Employee Activity Report for Indus Plus Pvt Limited</h2>
      <table className="trace-print-header-table">
        <tbody>
          <tr>
            <td>
              <strong>DEPARTMENT:</strong> {department}
              <br />
              <strong>EMPLOYEE CARD:</strong> {employee || "All trace employee cards"}
            </td>
            <td>
              <strong>PERIOD:</strong> {rangeLabel(range)}
              <br />
              <strong>GENERATED:</strong> {format(new Date(), "dd-MM-yyyy hh:mm a")}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="trace-print-table">
        <thead>
          <tr>
            {[
              "EmpCode",
              "Employee Name",
              "W/O",
              "Date",
              "Operation",
              "Piece Rate",
              "Incentive",
              "SAM",
              "Bundle",
              "Quantity",
              "Total Pay",
              "Signature",
            ].map((heading) => <th key={heading}>{heading}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const total = sumRows(group);
            return (
              <Fragment key={group[0].employeeCode}>
                {group.map((row, index) => (
                  <tr key={`${row.employeeCode}-${row.workOrder}-${row.operation}-${row.scannedAt}`}>
                    <td>{index === 0 ? row.employeeCode : ""}</td>
                    <td>{index === 0 ? row.employeeName : ""}</td>
                    <td>{row.workOrder}</td>
                    <td>{format(new Date(row.scannedAt), "dd-MM-yy")}</td>
                    <td>{row.operation}</td>
                    <td className="right">0.00</td>
                    <td className="right">0.00</td>
                    <td className="center">{row.sam.toFixed(2)}</td>
                    <td className="center">{row.bundleCount}</td>
                    <td className="center">{row.quantity.toLocaleString()}</td>
                    <td className="right">0.00</td>
                    <td />
                  </tr>
                ))}
                <tr className="subtotal">
                  <td colSpan={7}>Employee wise Total :</td>
                  <td className="center">{total.sam.toFixed(2)}</td>
                  <td className="center">{total.bundles}</td>
                  <td className="center">{total.quantity.toLocaleString()}</td>
                  <td className="right">0.00</td>
                  <td />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7}>Grand Total :</td>
            <td className="center">{totals.sam.toFixed(2)}</td>
            <td className="center">{totals.bundles}</td>
            <td className="center">{totals.quantity.toLocaleString()}</td>
            <td className="right">Rs. 0.00</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function DummyEmployeeReport({ embedded = false }: { embedded?: boolean }) {
  const { department } = useDepartment();
  const [employee, setEmployee] = useState("");
  const [range, setRange] = useState<Range>(payCycle);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const actions = useRef<{ close: () => void; unmount: () => void } | null>(null);

  const fetchEmployees = useCallback(async (query: string) => {
    const response = await fetch(`/api/dummy-employees?query=${encodeURIComponent(query)}`);
    return response.ok ? response.json() as Promise<DummyEmployee[]> : [];
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const params = new URLSearchParams({ department });
      if (employee) params.set("employee", employee);
      if (range.from) params.set("from", format(range.from, "yyyy-MM-dd"));
      if (range.to) params.set("to", format(range.to, "yyyy-MM-dd"));
      const response = await fetch(`/api/reports/dummy-employees/details?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load trace activity.");
      setScans(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load trace activity.");
    } finally {
      setLoading(false);
    }
  }, [department, employee, range]);

  useEffect(() => {
    const timer = window.setTimeout(() => void search(), 0);
    return () => window.clearTimeout(timer);
    // Reload automatically only when the active department changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  const rows = useMemo(() => {
    const grouped = new Map<string, Row>();
    for (const scan of scans) {
      const key = [scan.employeeCode, scan.workOrder, format(new Date(scan.scannedAt), "yyyy-MM-dd"), scan.operation].join("::");
      const existing = grouped.get(key);
      if (existing) {
        existing.bundleCount += 1;
        existing.quantity += scan.quantity;
      } else {
        grouped.set(key, { ...scan, bundleCount: 1 });
      }
    }
    return [...grouped.values()];
  }, [scans]);

  const groups = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    for (const row of rows) grouped.set(row.employeeCode, [...(grouped.get(row.employeeCode) ?? []), row]);
    return [...grouped.values()];
  }, [rows]);

  const totals = useMemo(() => sumRows(rows), [rows]);

  const exportExcel = () => {
    downloadXlsx(
      "trace-employee-report",
      ["EmpCode", "Employee Name", "W/O", "Date", "Operation", "Piece Rate", "Incentive", "SAM", "Bundle", "Quantity", "Total Pay"],
      rows.map((row) => [
        row.employeeCode,
        row.employeeName,
        row.workOrder,
        format(new Date(row.scannedAt), "dd-MM-yy"),
        row.operation,
        0,
        0,
        row.sam.toFixed(2),
        row.bundleCount,
        row.quantity,
        0,
      ]),
      "Trace Report",
    );
  };

  const chooseRange = (next: Range) => {
    setRange(next);
    actions.current?.close();
  };

  const filters = (
    <div className="no-print overflow-visible rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-700">Employee card</span>
          <Autocomplete<DummyEmployee>
            value={employee}
            onChange={setEmployee}
            onSelect={(item) => setEmployee(item.employeeCode)}
            fetchSuggestions={fetchEmployees}
            renderSuggestion={(item) => (
              <><span className="font-bold text-indigo-700">{item.employeeCode}</span><span className="ml-2 text-slate-700">{item.employeeName}</span></>
            )}
            getSuggestionValue={(item) => item.employeeCode}
            placeholder="Search employee card or name"
            inputClassName="h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            minChars={0}
          />
        </div>
        <div className="hidden self-stretch bg-slate-200 xl:block xl:w-px" />
        <div className="flex w-full flex-col gap-1 xl:w-64">
          <span className="text-[11px] font-semibold text-slate-700">Tenure / Scope</span>
          <Popover actionsRef={actions}>
            <PopoverTrigger className="flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <CalendarIcon className="size-4 text-slate-400" />
              <span className="truncate">{rangeLabel(range)}</span>
            </PopoverTrigger>
            <PopoverContent className="w-auto bg-white p-2.5" align="start">
              <div className="flex max-w-[280px] flex-wrap gap-1.5 pb-2">
                <button type="button" onClick={() => chooseRange(payCycle())} className="rounded-md bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-800">Current tenure</button>
                <button type="button" onClick={() => { const to = new Date(); const from = new Date(to); from.setDate(to.getDate() - 6); chooseRange({ from, to }); }} className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Last 7 days</button>
                <button type="button" onClick={() => { const to = new Date(); const from = new Date(to); from.setDate(to.getDate() - 29); chooseRange({ from, to }); }} className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Last 30 days</button>
                <button type="button" onClick={() => chooseRange({})} className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">All dates</button>
              </div>
              <Calendar
                mode="range"
                captionLayout="dropdown"
                classNames={{
                  selected: "bg-rose-50 text-rose-800 hover:bg-rose-100 hover:text-rose-800 shadow-sm font-bold rounded-lg scale-105 [&>button]:text-rose-800",
                }}
                selected={range.from || range.to ? { from: range.from, to: range.to } : undefined}
                onSelect={(next) => {
                  const value = { from: next?.from, to: next?.to };
                  setRange(value);
                  if (value.from && value.to) actions.current?.close();
                }}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" onClick={search} disabled={loading} className="h-10 gap-2 bg-indigo-700 px-4 text-xs hover:bg-indigo-800"><Search className="size-3.5" />{loading ? "Searching…" : "Search"}</Button>
          <Button type="button" onClick={() => window.print()} className="h-10 gap-2 border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"><Printer className="size-3.5 text-slate-600" />Print</Button>
          <Button type="button" onClick={exportExcel} disabled={rows.length === 0} className="h-10 gap-2 border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"><FileSpreadsheet className="size-3.5" />Excel</Button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">{error}</p>}
    </div>
  );

  const screenTable = (
    <section className="trace-screen-report overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1220px] border-collapse text-left text-xs">
          <thead><tr className="border-b border-slate-200 bg-slate-100 text-[9px] font-semibold uppercase tracking-wide text-slate-600">{["EmpCode", "Employee Name", "W/O", "Date", "Operation", "Piece Rate", "Incentive", "SAM", "Bundle", "Quantity", "Total Pay", "Signature"].map((heading) => <th key={heading} className="border-r border-slate-200 px-3 py-2.5 last:border-0">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? <tr><td colSpan={12} className="px-5 py-12 text-center text-slate-400">Loading trace activity…</td></tr> : groups.length === 0 ? <tr><td colSpan={12} className="px-5 py-12 text-center text-slate-400">{searched ? "No trace activity matches this search." : "Choose a tenure or employee to view trace activity."}</td></tr> : groups.map((group) => {
              const total = sumRows(group);
              return <Fragment key={group[0].employeeCode}>{group.map((row, index) => <tr key={`${row.employeeCode}-${row.workOrder}-${row.operation}-${row.scannedAt}`} className="odd:bg-slate-50/30 hover:bg-indigo-50/30"><td className="border-r border-slate-100 px-3 py-2 font-mono font-bold">{index === 0 ? row.employeeCode : ""}</td><td className="border-r border-slate-100 px-3 py-2 font-bold">{index === 0 ? row.employeeName : ""}</td><td className="border-r border-slate-100 px-3 py-2 font-mono">{row.workOrder}</td><td className="border-r border-slate-100 px-3 py-2 text-center">{format(new Date(row.scannedAt), "dd-MM-yy")}</td><td className="border-r border-slate-100 px-3 py-2">{row.operation}</td><td className="border-r border-slate-100 px-3 py-2 text-right font-mono">0.00</td><td className="border-r border-slate-100 px-3 py-2 text-right font-mono">0.00</td><td className="border-r border-slate-100 px-3 py-2 text-center font-mono">{row.sam.toFixed(2)}</td><td className="border-r border-slate-100 px-3 py-2 text-center">{row.bundleCount}</td><td className="border-r border-slate-100 px-3 py-2 text-center font-bold">{row.quantity.toLocaleString()}</td><td className="border-r border-slate-100 px-3 py-2 text-right font-mono font-bold">0.00</td><td className="px-3 py-2"><span className="block h-6 rounded-md border border-slate-300" /></td></tr>)}<tr className="bg-slate-50/70 font-bold text-slate-800"><td colSpan={7} className="border-r border-slate-100 px-3 py-2 text-right">Employee wise Total :</td><td className="border-r border-slate-100 px-3 py-2 text-center font-mono">{total.sam.toFixed(2)}</td><td className="border-r border-slate-100 px-3 py-2 text-center">{total.bundles}</td><td className="border-r border-slate-100 px-3 py-2 text-center">{total.quantity.toLocaleString()}</td><td className="border-r border-slate-100 px-3 py-2 text-right font-mono">0.00</td><td /></tr></Fragment>;
            })}
          </tbody>
          <tfoot><tr className="border-t-2 border-indigo-200 bg-indigo-50 font-semibold text-slate-900"><td colSpan={7} className="border-r border-indigo-100 px-3 py-3 text-right">Grand Total :</td><td className="border-r border-indigo-100 px-3 py-3 text-center font-mono">{totals.sam.toFixed(2)}</td><td className="border-r border-indigo-100 px-3 py-3 text-center">{totals.bundles}</td><td className="border-r border-indigo-100 px-3 py-3 text-center">{totals.quantity.toLocaleString()}</td><td className="border-r border-indigo-100 px-3 py-3 text-right font-mono text-indigo-800">Rs. 0.00</td><td /></tr></tfoot>
        </table>
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-4">
      {!embedded && <header className="flex items-center gap-3 border-b border-slate-200 pb-5"><span className="flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white"><ClipboardCheck className="size-5" /></span><div><h1 className="text-2xl font-semibold text-slate-950">Trace Report</h1><p className="mt-1 text-sm text-slate-500">Trace employee activity with zero payable amounts.</p></div></header>}
      {filters}
      {screenTable}
      <TracePrintPreview department={department} employee={employee} range={range} groups={groups} totals={totals} />
      <style>{`
        @media screen { .trace-print-only { display: none !important; } }
        @media print {
          @page { size: A4 landscape; margin: 0.8cm; }
          body { background: white !important; color: black !important; }
          .no-print, .trace-screen-report, nav, header { display: none !important; }
          [data-trace-employees] { display: block !important; }
          .trace-print-only { display: block !important; }
          .trace-print-container { width: 100%; color: black; font-family: Arial, sans-serif; }
          .trace-print-container h2 { margin: 0 0 10px; border-bottom: 2px solid #000; padding-bottom: 7px; text-align: center; font-size: 13px; font-weight: 800; text-transform: uppercase; }
          .trace-print-header-table, .trace-print-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #000; }
          .trace-print-header-table td { padding: 4px 8px; border: 1px solid #000; vertical-align: top; font-size: 9px; line-height: 1.45; }
          .trace-print-table th, .trace-print-table td { border: 1px solid #000; padding: 3px 4px; font-size: 7.5px; text-align: left; }
          .trace-print-table th { background: #e2e8f0 !important; font-size: 7px; font-weight: 700; text-transform: uppercase; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .trace-print-table .center { text-align: center; }
          .trace-print-table .right { text-align: right; }
          .trace-print-table .subtotal td, .trace-print-table tfoot td { background: #f1f5f9 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .trace-print-table tfoot { display: table-row-group; break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
