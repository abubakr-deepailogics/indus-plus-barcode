"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export interface WorkOrderSearchRow {
  workOrder: string;
  customer?: string | null;
  saleOrderNo?: string | null;
}

interface WorkOrderSearchFilters {
  workOrder: string;
  customer: string;
  saleOrderNo: string;
}

interface WorkOrderSearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (row: WorkOrderSearchRow) => void;
  fetchRows: (filters: WorkOrderSearchFilters) => Promise<WorkOrderSearchRow[]>;
  showCustomerColumn?: boolean;
  showSaleOrderNoColumn?: boolean;
}

const EMPTY_FILTERS: WorkOrderSearchFilters = { workOrder: "", customer: "", saleOrderNo: "" };

// Shared across Cut Report, Style Bulletin, Coupon Generation and Coupon
// Tracing — each page supplies its own `fetchRows` hitting its own
// work-orders route (different DB table per page), and its own `onSelect`
// that feeds the picked Work Order into that page's existing
// commitSearch/setWorkOrder plumbing (useWorkOrderParam). This component
// owns none of that propagation, only the search UI.
export function WorkOrderSearchModal({
  open,
  onClose,
  onSelect,
  fetchRows,
  showCustomerColumn = true,
  showSaleOrderNoColumn = true,
}: WorkOrderSearchModalProps) {
  const [filters, setFilters] = useState<WorkOrderSearchFilters>(EMPTY_FILTERS);
  const [rows, setRows] = useState<WorkOrderSearchRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rowsRef = useRef<HTMLDivElement>(null);
  const workOrderInputRef = useRef<HTMLInputElement>(null);

  // Read via a ref instead of a dependency — callers can pass a new
  // fetchRows closure each render without that retriggering the fetch.
  const fetchRowsRef = useRef(fetchRows);
  useEffect(() => {
    fetchRowsRef.current = fetchRows;
  });

  // Reset the filters the moment `open` flips true — done during render
  // (React's documented pattern for "adjusting state when a prop changes")
  // rather than in an effect, so it commits before the reopened modal's
  // first paint instead of flashing the previous search's filters/results.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFilters(EMPTY_FILTERS);
      setActiveIndex(-1);
    }
  }

  // Autofocus is a real DOM side effect, so it stays in an effect (unlike
  // the state reset above).
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => workOrderInputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await fetchRowsRef.current(filters);
        if (cancelled) return;
        setRows(result || []);
        setActiveIndex(-1);
      } catch (err) {
        console.error("Work order search fetch error:", err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [open, filters]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (activeIndex >= 0 && rowsRef.current) {
      const el = rowsRef.current.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!open) return null;

  const handleFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < rows.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : rows.length - 1));
    } else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < rows.length) {
      e.preventDefault();
      onSelect(rows[activeIndex]);
    }
  };

  const columnCount = 1 + (showCustomerColumn ? 1 : 0) + (showSaleOrderNoColumn ? 1 : 0);
  // Tailwind's scanner needs literal class names, not a template-interpolated
  // `grid-cols-${columnCount}` — that string never appears verbatim in the
  // source, so it wouldn't get generated into the compiled CSS.
  const gridColsClass = columnCount === 3 ? "grid-cols-3" : columnCount === 2 ? "grid-cols-2" : "grid-cols-1";
  const inputClassName =
    "w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5]";

  return (
    <div
      className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[640px] w-full p-6 animate-scale-up"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-4">
          <h3 className="text-sm font-extrabold text-[#0f172a]">Find Work Order</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter row */}
        <div className={`grid gap-3 mb-4 ${gridColsClass}`}>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[10px] uppercase">Work Order</label>
            <input
              ref={workOrderInputRef}
              type="text"
              value={filters.workOrder}
              onChange={(e) => setFilters((prev) => ({ ...prev, workOrder: e.target.value }))}
              onKeyDown={handleFilterKeyDown}
              placeholder="e.g. W/O-002653"
              className={inputClassName}
            />
          </div>
          {showCustomerColumn && (
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[10px] uppercase">Customer</label>
              <input
                type="text"
                value={filters.customer}
                onChange={(e) => setFilters((prev) => ({ ...prev, customer: e.target.value }))}
                onKeyDown={handleFilterKeyDown}
                placeholder="Customer name"
                className={inputClassName}
              />
            </div>
          )}
          {showSaleOrderNoColumn && (
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[10px] uppercase">Sale Order No</label>
              <input
                type="text"
                value={filters.saleOrderNo}
                onChange={(e) => setFilters((prev) => ({ ...prev, saleOrderNo: e.target.value }))}
                onKeyDown={handleFilterKeyDown}
                placeholder="Sale order no"
                className={inputClassName}
              />
            </div>
          )}
        </div>

        {/* Results — a header + row grid (not a <table>) so both use the
            same equal-width columns and stay aligned regardless of content. */}
        <div className="border border-[#e2e8f0] rounded-xl overflow-hidden mb-5">
          <div className={`grid gap-3 ${gridColsClass} bg-[#f8fafc] border-b border-[#e2e8f0] px-4 py-2.5`}>
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Work Order</span>
            {showCustomerColumn && (
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Customer</span>
            )}
            {showSaleOrderNoColumn && (
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Sale Order No</span>
            )}
          </div>
          <div ref={rowsRef} className="max-h-[320px] overflow-y-auto divide-y divide-[#f1f5f9]">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-[#94a3b8]">
                <div className="h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">Searching...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-[#94a3b8]">
                <Search className="w-4 h-4" />
                <span className="text-xs font-semibold">No work orders found</span>
              </div>
            ) : (
              rows.map((row, idx) => (
                <button
                  key={row.workOrder}
                  type="button"
                  onClick={() => onSelect(row)}
                  className={`w-full grid gap-3 ${gridColsClass} text-left px-4 py-2.5 cursor-pointer transition-colors ${
                    idx === activeIndex ? "bg-indigo-50/60" : "hover:bg-indigo-50/30"
                  }`}
                >
                  <span className="text-xs font-semibold text-[#334155]">{row.workOrder}</span>
                  {showCustomerColumn && (
                    <span className="text-xs font-medium text-[#64748b] truncate">{row.customer || "-"}</span>
                  )}
                  {showSaleOrderNoColumn && (
                    <span className="text-xs font-medium text-[#64748b] truncate">{row.saleOrderNo || "-"}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-4">
          <span className="text-[11px] text-[#94a3b8] font-semibold">{rows.length} results found</span>
          <button
            onClick={onClose}
            className="bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
