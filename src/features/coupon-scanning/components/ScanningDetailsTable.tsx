"use client";

import { useEffect, useRef, FocusEvent } from "react";
import { FileText, Printer } from "lucide-react";
import type { useCouponScanning } from "../hooks/useCouponScanning";

type Facade = ReturnType<typeof useCouponScanning>;

export function ScanningDetailsTable(props: Facade) {
  const {
    scanError,
    scannerInput,
    setScannerInput,
    handleScannerKeyDown,
    isScanning,
    rows,
    handleRemoveRow,
    totalQty,
    totalRecords,
    totalSam,
    totalValue,
    employeeCode,
    dated,
  } = props;

  const scannerDisabled = isScanning || !employeeCode.trim();

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!employeeCode.trim() || !dated) return;

    const target = e.relatedTarget as HTMLElement;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "BUTTON" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "A" ||
        target.getAttribute("tabIndex") !== null ||
        target.closest("[role='button']") ||
        target.closest(".radix-popover-content") ||
        target.closest("[data-slot='popover-content']"))
    ) {
      return;
    }

    setTimeout(() => {
      e.target.focus();
    }, 10);
  };

  // Auto-scroll the table to the bottom as rows fill in, so the row a
  // just-scanned coupon landed in stays in view during a fast scan burst.
  const tableContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = tableContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows]);

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl p-3.5 shadow-sm mt-1 flex flex-col gap-2.5">
      {scanError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2.5 font-bold text-xs animate-fade-in flex items-center gap-2 no-print">
          <span>⚠️</span>
          <span>{scanError}</span>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#4f46e5]" />
          <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
            Scanning Details
          </h2>
        </div>
        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={rows.filter((row) => row.barCode && row.scanned).length === 0}
            className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-slate-700 disabled:opacity-50 py-1 px-2.5 rounded-lg font-bold transition-all shadow-sm cursor-pointer text-[10px] flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3 h-3 text-[#4f46e5]" />
            <span>Print Scanned</span>
          </button>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            Rate Section
          </span>
        </div>
      </div>

      {/* Barcode scanner field — focus here, then scan; each scan appends a fetched row below */}
      <div className="flex flex-col gap-0.5 max-w-xs">
        <span className="font-bold text-[10px] uppercase text-[#4f46e5]">
          Scanner Input
        </span>
        <input
          id="scanner-input"
          type="text"
          autoComplete="off"
          placeholder={
            employeeCode.trim()
              ? "Focus here and scan a coupon barcode…"
              : "Select an Employee Code first"
          }
          value={scannerInput}
          onChange={(e) => setScannerInput(e.target.value)}
          onKeyDown={handleScannerKeyDown}
          onBlur={handleInputBlur}
          disabled={scannerDisabled}
          className="w-full px-3 py-1 rounded-lg border border-indigo-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all bg-indigo-50/30 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>

      {/* Scrollable table container */}
      <div
        ref={tableContainerRef}
        className="overflow-x-auto overflow-y-auto w-full border border-slate-100 rounded-xl max-h-[500px] shadow-inner bg-slate-50/40"
      >
        <table className="w-full border-collapse text-[11px] min-w-[1200px]">
          {/* Header groups */}
          <thead>
            {/* Category label row */}
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <th colSpan={12} className="py-1 px-3 border-r border-slate-200"></th>
              <th
                colSpan={3}
                className="py-0.5 px-3 text-center text-[9px] uppercase tracking-wider bg-slate-200/60 text-slate-800 border-b border-slate-300"
              >
                Rate
              </th>
            </tr>
            {/* Main table headers */}
            <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-left">
              <th className="py-1 px-2 border-r border-slate-200 text-center w-[60px] text-[#ef4444] uppercase tracking-wider text-[9px] font-bold">
                Remove
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-center w-[40px]">
                #
              </th>
              <th className="py-1 px-3 border-r border-slate-200 w-[140px]">
                Coupon Code
              </th>
              <th className="py-1 px-2 border-r border-slate-200 w-[100px]">
                W/0 #
              </th>
              <th className="py-1 px-2 border-r border-slate-200 w-[100px]">
                Cut #
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-center w-[80px]">
                Bundle #
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-center w-[70px]">
                Qty
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-center w-[80px]">
                Inseam
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-center w-[70px]">
                Size #
              </th>
              <th className="py-1 px-3 border-r border-slate-200 w-[130px]">
                Section Name
              </th>
              <th className="py-1 px-3 border-r border-slate-200 w-[180px]">
                Operation Name
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-center w-[60px]">
                Skill #
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-right w-[80px] bg-slate-100/30">
                SMV
              </th>
              <th className="py-1 px-2 border-r border-slate-200 text-right w-[90px] bg-slate-100/30">
                Rate
              </th>
              <th className="py-1 px-3 text-right w-[100px] bg-indigo-50/20 text-[#4f46e5]">
                Value
              </th>
            </tr>
          </thead>

          {/* Editable row inputs */}
          <tbody>
            {isScanning
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <tr
                    key={`skeleton-${idx}`}
                    className="animate-pulse bg-white border-b border-slate-100"
                  >
                    <td className="py-3 px-2 border-r border-slate-200 text-center">
                      <div className="h-3 w-10 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-center">
                      <div className="h-3 w-4 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3 border-r border-slate-200">
                      <div className="h-3 w-24 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200">
                      <div className="h-3 w-16 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200">
                      <div className="h-3 w-12 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-center">
                      <div className="h-3 w-16 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-center">
                      <div className="h-3 w-10 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-center">
                      <div className="h-3 w-12 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-center">
                      <div className="h-3 w-10 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-3 border-r border-slate-200">
                      <div className="h-3 w-28 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3 px-3 border-r border-slate-200">
                      <div className="h-3 w-36 bg-slate-200 rounded" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-center">
                      <div className="h-3 w-8 bg-slate-200 rounded mx-auto" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-right bg-slate-50/50">
                      <div className="h-3 w-12 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3 px-2 border-r border-slate-200 text-right bg-slate-50/50">
                      <div className="h-3 w-12 bg-slate-200 rounded ml-auto" />
                    </td>
                    <td className="py-3 px-3 text-right bg-indigo-50/10">
                      <div className="h-3 w-14 bg-indigo-200/50 rounded ml-auto" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.index}
                    className="bg-white hover:bg-slate-50/50 border-b border-slate-100 transition-colors"
                  >
                    {/* Remove row — unscans in DB first if already scanned */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center">
                      <button
                        onClick={() => handleRemoveRow(row.index)}
                        title={row.scanned ? "Unscan & remove row" : "Remove row"}
                        className="text-[#ef4444] hover:text-[#dc2626] font-bold text-[10px] px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100 border border-red-100 transition-all cursor-pointer"
                      >
                        ✕
                      </button>
                    </td>
                    {/* # */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center font-bold text-slate-400">
                      {row.index}
                    </td>
                    {/* Bar # + pending/scanned status */}
                    <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{row.barCode || "-"}</span>
                        {row.barCode && !row.scanned && (
                          <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 uppercase leading-none">
                            Pending
                          </span>
                        )}
                      </div>
                    </td>
                    {/* ANL # */}
                    <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-700">
                      {row.anlCode || "-"}
                    </td>
                    {/* Cut # */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                      {row.cutNo || "-"}
                    </td>
                    {/* Bundle # */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                      {row.bundleNo || "-"}
                    </td>
                    {/* Qty */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center font-bold text-[#4f46e5]">
                      {row.qty || "-"}
                    </td>
                    {/* Inseam */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                      {row.inseam || "-"}
                    </td>
                    {/* Size # */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                      {row.sizeCode || "-"}
                    </td>
                    {/* Section Name */}
                    <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-700">
                      {row.sectionName || "-"}
                    </td>
                    {/* Operation Name */}
                    <td className="py-1 px-3 border-r border-slate-200 font-semibold text-slate-700">
                      {row.operationName || "-"}
                    </td>
                    {/* Skill # */}
                    <td className="py-1 px-2 border-r border-slate-200 text-center font-semibold text-slate-700">
                      {row.skillCode || "-"}
                    </td>
                    {/* SMV */}
                    <td className="py-1 px-2 border-r border-slate-200 text-right bg-slate-50/30 font-semibold text-slate-700">
                      {row.smv || "-"}
                    </td>
                    {/* Rate */}
                    <td className="py-1 px-2 border-r border-slate-200 text-right bg-slate-50/30 font-semibold text-slate-700">
                      {row.rate || "-"}
                    </td>
                    {/* Value */}
                    <td className="py-1 px-3 text-right bg-indigo-50/10 text-indigo-700 font-bold">
                      {row.value || "-"}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>



      {/* Footer Summary Container */}
      <div className="flex flex-wrap items-center justify-start sm:justify-end gap-x-6 gap-y-2 bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 mt-2">
        {/* Total Qty */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
            Total Qty
          </span>
          <div className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 font-black text-xs text-center min-w-[60px] shadow-sm">
            {totalQty}
          </div>
        </div>

        {/* Total Records */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
            Total Records
          </span>
          <div className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 font-black text-xs text-center min-w-[60px] shadow-sm">
            {totalRecords}
          </div>
        </div>
        {/* Total SAM */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
            Total SAM
          </span>
          <div className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 font-black text-xs text-center min-w-[60px] shadow-sm">
            {totalSam.toFixed(2)}
          </div>
        </div>
        {/* Total Value */}
        <div className="flex items-center gap-2 font-semibold">
          <span className="font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
            Total Value
          </span>
          <div className="px-3 py-1 rounded-lg border border-indigo-100 bg-indigo-50/50 text-indigo-700 font-black text-sm text-right min-w-[100px] shadow-sm">
            {totalValue.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
