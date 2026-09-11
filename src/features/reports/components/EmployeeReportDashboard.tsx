"use client";

import { useState, useMemo, useCallback, useRef, Fragment } from "react";
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
  Users,
  Layers,
  Package,
  Coins,
  Trash2,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import {
  createWages,
  deleteWages,
  fetchWages,
  fetchEmployeeSearchSuggestions,
  fetchOperationSearchSuggestions,
  fetchSectionSearchSuggestions,
  fetchWorkOrderSearchSuggestions,
} from "../services/reports.service";
import { useReportSearch } from "../hooks/useReportSearch";
import type {
  ReportDateRange,
  ReportSearchMode,
  ReportSearchSuggestion,
  ReportSummary,
  WagesBatch,
} from "../types";

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function formatEmployeeLabel(
  code?: string | null,
  name?: string | null,
): string {
  if (!code && !name) return "—";
  if (name && name !== code) return `${name} (#${code ?? "—"})`;
  return code ? `#${code}` : name || "—";
}

const PRESETS: { label: string; range: () => ReportDateRange }[] = [
  {
    label: "Last 7 Days",
    range: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: "Last 30 Days",
    range: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
  {
    label: "This Month",
    range: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  { label: "All Time", range: () => ({}) },
];

const ITEMS_PER_PAGE = 15;

// Everything about the "search by" UI (which field to show, its label/
// placeholder, and where its autocomplete suggestions come from) is driven
// off the mode, so switching modes never needs its own bespoke JSX branch.
const MODE_CONFIG: Record<
  ReportSearchMode,
  {
    label: string;
    fieldLabel: string;
    placeholder: string;
    fetchSuggestions: (query: string) => Promise<ReportSearchSuggestion[]>;
  }
> = {
  employee: {
    label: "Employee",
    fieldLabel: "Employee Code / Name",
    placeholder: "Enter employee code or name",
    fetchSuggestions: fetchEmployeeSearchSuggestions,
  },
  workOrder: {
    label: "Work Order",
    fieldLabel: "Work Order #",
    placeholder: "Enter work order number",
    fetchSuggestions: fetchWorkOrderSearchSuggestions,
  },
  operation: {
    label: "Operation",
    fieldLabel: "Operation Code",
    placeholder: "Enter operation code or name",
    fetchSuggestions: fetchOperationSearchSuggestions,
  },
  section: {
    label: "Section",
    fieldLabel: "Section",
    placeholder: "Enter section name",
    fetchSuggestions: fetchSectionSearchSuggestions,
  },
};

type BreakdownDimension =
  | "operations"
  | "workOrders"
  | "employees"
  | "sections"
  | "bundles";

// Every report always carries every breakdown dimension. The own-dimension
// (e.g. "employees" tab in employee mode) is always shown first so the user
// can see grouped-breakdown data for both specific and All searches.
// Sections/bundles only make sense once you're already scoped to a single
// work order (or "all work orders"), so they're work-order-only.
const BREAKDOWN_DIMENSIONS: Record<ReportSearchMode, BreakdownDimension[]> = {
  employee: ["employees", "operations", "workOrders"],
  workOrder: ["workOrders", "employees", "operations", "sections", "bundles"],
  operation: ["operations", "employees", "workOrders"],
  section: ["sections", "employees", "workOrders", "operations", "bundles"],
};


const TAB_META: Record<
  BreakdownDimension,
  { label: string; icon: LucideIcon }
> = {
  operations: { label: "Operations Breakdown", icon: Scissors },
  workOrders: { label: "Work Orders", icon: ClipboardList },
  employees: { label: "Employees", icon: UserRound },
  sections: { label: "Sections", icon: Layers },
  bundles: { label: "Bundles", icon: Package },
};

type TabKey = BreakdownDimension | "coupons";

interface Card2Row {
  label: string;
  value: string;
}

interface Card2Config {
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  value: string;
  badge?: string | null;
  rows: Card2Row[];
}

// The middle summary card always shows "coverage" — whatever isn't the
// search subject itself. What that means differs per mode, so it's built
// here instead of three near-duplicate JSX blocks.
function getCard2Config(summary: ReportSummary): Card2Config {
  const { subject } = summary;
  const activeLineItem =
    summary.recentCutNo != null || summary.recentBundleNo != null
      ? `Cut ${summary.recentCutNo ?? "—"} | Bundle #${summary.recentBundleNo ?? "—"}`
      : "—";
  const currentOperation =
    summary.recentOperationName || summary.recentOperationCode || "—";

  if (subject.mode === "employee") {
    return {
      title: "Work Orders",
      icon: ClipboardList,
      iconClassName: "bg-cyan-50 text-cyan-600",
      value: `${summary.totalWorkOrders} ${summary.totalWorkOrders === 1 ? "Order" : "Orders"}`,
      badge: summary.recentWorkOrder,
      rows: [
        { label: "Recent W/O", value: summary.recentWorkOrder || "—" },
        { label: "Active Line Item", value: activeLineItem },
        { label: "Current Operation", value: currentOperation },
      ],
    };
  }

  if (subject.mode === "workOrder") {
    return {
      title: "Employees",
      icon: UserRound,
      iconClassName: "bg-cyan-50 text-cyan-600",
      value: `${summary.totalEmployees} ${summary.totalEmployees === 1 ? "Worker" : "Workers"}`,
      badge: formatEmployeeLabel(
        summary.recentEmployeeCode,
        summary.recentEmployeeName,
      ),
      rows: [
        {
          label: "Recent Employee",
          value: formatEmployeeLabel(
            summary.recentEmployeeCode,
            summary.recentEmployeeName,
          ),
        },
        { label: "Active Line Item", value: activeLineItem },
        { label: "Current Operation", value: currentOperation },
      ],
    };
  }

  if (subject.mode === "operation") {
    return {
      title: "Employees",
      icon: UserRound,
      iconClassName: "bg-cyan-50 text-cyan-600",
      value: `${summary.totalEmployees} ${summary.totalEmployees === 1 ? "Worker" : "Workers"}`,
      badge: `${summary.totalWorkOrders} ${summary.totalWorkOrders === 1 ? "Work Order" : "Work Orders"}`,
      rows: [
        {
          label: "Recent Employee",
          value: formatEmployeeLabel(
            summary.recentEmployeeCode,
            summary.recentEmployeeName,
          ),
        },
        {
          label: "Work Orders Used In",
          value: String(summary.totalWorkOrders),
        },
        { label: "Recent Work Order", value: summary.recentWorkOrder || "—" },
      ],
    };
  }

  // section
  return {
    title: "Employees",
    icon: UserRound,
    iconClassName: "bg-cyan-50 text-cyan-600",
    value: `${summary.totalEmployees} ${summary.totalEmployees === 1 ? "Worker" : "Workers"}`,
    badge: `${summary.totalOperations} ${summary.totalOperations === 1 ? "Operation" : "Operations"}`,
    rows: [
      {
        label: "Recent Employee",
        value: formatEmployeeLabel(
          summary.recentEmployeeCode,
          summary.recentEmployeeName,
        ),
      },
      {
        label: "Operations in Section",
        value: String(summary.totalOperations),
      },
      { label: "Recent Work Order", value: summary.recentWorkOrder || "—" },
    ],
  };
}

export function EmployeeReportDashboard() {
  const {
    mode,
    changeMode,
    searchValue,
    setSearchValue,
    dateRange,
    applyDateRange,
    summary,
    isLoading,
    error,
    search,
    searchAll,
    isAllMode,
  } = useReportSearch();

  // BREAKDOWN_DIMENSIONS now always includes the own-dimension tab first,
  // so availableTabs is simply BREAKDOWN_DIMENSIONS[mode] + "coupons".
  const isAllSummary = summary?.subject.all === true;
  const availableTabs = useMemo<TabKey[]>(() => {
    return [...BREAKDOWN_DIMENSIONS[mode], "coupons"];
  }, [mode]);
  const [activeTab, setActiveTab] = useState<TabKey>("employees");

  const [tabsForSummary, setTabsForSummary] = useState<ReportSummary | null>(
    null,
  );
  if (summary !== tabsForSummary) {
    setTabsForSummary(summary);
    setActiveTab(availableTabs[0]);
  }

  const effectiveTab = availableTabs.includes(activeTab)
    ? activeTab
    : availableTabs[0];

  const [couponSearch, setCouponSearch] = useState("");
  const [couponPage, setCouponPage] = useState(1);

  const rangePopoverActionsRef = useRef<{
    close: () => void;
    unmount: () => void;
  } | null>(null);

  // ── Wages panel state ────────────────────────────────────────────────────
  const [wagesVisible, setWagesVisible] = useState(false);
  const [wagesBatches, setWagesBatches] = useState<WagesBatch[]>([]);
  const [wagesLoading, setWagesLoading] = useState(false);
  const [isCreatingWages, setIsCreatingWages] = useState(false);
  const [isDeletingWages, setIsDeletingWages] = useState(false);
  const [wageMsg, setWageMsg] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const employeesList = summary?.employees;
  const couponsList = summary?.coupons;

  const employeeGroupedData = useMemo(() => {
    if (!employeesList) return [];
    const coupons = couponsList || [];

    return employeesList.map((emp) => {
      const empCoupons = coupons.filter(
        (c) => c.employeeCode === emp.employeeCode,
      );

      if (empCoupons.length === 0) {
        return {
          employeeCode: emp.employeeCode,
          employeeName: emp.employeeName,
          items: [
            {
              workOrder: "—",
              date: "—",
              operation: "—",
              rate: null as number | null,
              bundleCount: emp.couponCount || 0,
              qty: emp.totalQty || 0,
              totalPay: emp.totalAmount || 0,
            },
          ],
          totalBundles: emp.couponCount || 0,
          totalQty: emp.totalQty || 0,
          totalPay: emp.totalAmount || 0,
        };
      }

      // Group by workOrder, date (dd-MM-yy), operation, rate
      const groupMap = new Map<
        string,
        {
          workOrder: string;
          date: string;
          operation: string;
          rate: number | null;
          bundleCount: number;
          qty: number;
          totalPay: number;
        }
      >();

      for (const c of empCoupons) {
        const wo = c.workOrder || "—";
        const dateStr = c.scannedAt
          ? format(new Date(c.scannedAt), "dd-MM-yy")
          : "—";
        const op = c.operationName || c.operationCode || "—";
        const rate = c.rate != null ? Number(c.rate) : null;
        const key = `${wo}__${dateStr}__${op}__${rate}`;

        const existing = groupMap.get(key);
        const qty = c.qty || 0;
        const pay =
          c.value != null ? Number(c.value) : rate != null ? qty * rate : 0;

        if (!existing) {
          groupMap.set(key, {
            workOrder: wo,
            date: dateStr,
            operation: op,
            rate,
            bundleCount: 1,
            qty,
            totalPay: pay,
          });
        } else {
          existing.bundleCount += 1;
          existing.qty += qty;
          existing.totalPay += pay;
        }
      }

      // Sort items by date then workOrder
      const items = Array.from(groupMap.values()).sort((a, b) => {
        const cmpDate = a.date.localeCompare(b.date);
        if (cmpDate !== 0) return cmpDate;
        return a.workOrder.localeCompare(b.workOrder);
      });

      const totalBundles = items.reduce((acc, it) => acc + it.bundleCount, 0);
      const totalQty = items.reduce((acc, it) => acc + it.qty, 0);
      const totalPay = items.reduce((acc, it) => acc + it.totalPay, 0);

      return {
        employeeCode: emp.employeeCode,
        employeeName: emp.employeeName,
        items,
        totalBundles,
        totalQty,
        totalPay,
      };
    });
  }, [employeesList, couponsList]);

  const handleCreateWages = useCallback(async () => {
    if (employeeGroupedData.length === 0 || isCreatingWages) return;
    setIsCreatingWages(true);
    setWageMsg(null);
    try {
      const fromStr = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const toStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

      // Flatten employeeGroupedData into one WageRow per operation-group item
      const rows = employeeGroupedData.flatMap((eg) =>
        eg.items.map((item) => ({
          employeeCode: eg.employeeCode ?? "",
          employeeName: eg.employeeName ?? null,
          workOrder: item.workOrder !== "—" ? item.workOrder : null,
          workDate: item.date !== "—" ? item.date : null,
          operation: item.operation !== "—" ? item.operation : null,
          rate: item.rate,
          bundleCount: item.bundleCount,
          qty: item.qty,
          totalPay: item.totalPay,
        }))
      );

      const res = await createWages({ from: fromStr, to: toStr, rows });
      if (!res.ok) {
        setWageMsg({ type: "error", message: res.error });
      } else {
        setWageMsg({
          type: "success",
          message: `Wages created — ${res.totalRows} row(s), Rs. ${formatAmount(res.totalAmount)} total.`,
        });
        // Auto-load the wages table to show the new batch and refresh summary state
        const viewRes = await fetchWages({ wageId: res.wageId });
        if (viewRes.ok) {
          setWagesBatches(viewRes.wages);
          setWagesVisible(true);
        }
        search();
      }
    } catch (err: unknown) {
      setWageMsg({
        type: "error",
        message: err instanceof Error ? err.message : "Create wages failed.",
      });
    } finally {
      setIsCreatingWages(false);
    }
  }, [employeeGroupedData, isCreatingWages, dateRange]);

  const handleViewWages = useCallback(async () => {
    if (wagesLoading) return;
    if (wagesVisible && wagesBatches.length > 0) {
      setWagesVisible(false);
      return;
    }
    setWagesLoading(true);
    setWageMsg(null);
    try {
      const fromStr = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
      const toStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
      const empCode =
        summary?.subject.mode === "employee" && !summary.subject.all
          ? String(summary.subject.employee.EmployeeID)
          : undefined;

      const res = await fetchWages({ employeeCode: empCode, from: fromStr, to: toStr });
      if (!res.ok) {
        setWageMsg({ type: "error", message: res.error });
      } else if (res.wages.length === 0) {
        setWageMsg({ type: "error", message: "No saved wages found for this scope." });
      } else {
        setWagesBatches(res.wages);
        setWagesVisible(true);
      }
    } catch (err: unknown) {
      setWageMsg({
        type: "error",
        message: err instanceof Error ? err.message : "Fetch wages failed.",
      });
    } finally {
      setWagesLoading(false);
    }
  }, [wagesLoading, wagesVisible, wagesBatches, dateRange, summary]);

  const handleDeleteWages = useCallback(async (wageId: number) => {
    if (isDeletingWages) return;
    setIsDeletingWages(true);
    setWageMsg(null);
    try {
      const res = await deleteWages({ wageId });
      if (!res.ok) {
        setWageMsg({ type: "error", message: res.error });
      } else {
        setWageMsg({ type: "success", message: res.message });
        setWagesBatches((prev) => prev.filter((b) => b.WageId !== wageId));
        // Refresh report summary live so isWageCalculated flags are reset
        search();
      }
    } catch (err: unknown) {
      setWageMsg({
        type: "error",
        message: err instanceof Error ? err.message : "Delete wages failed.",
      });
    } finally {
      setIsDeletingWages(false);
    }
  }, [isDeletingWages, search]);

  const modeConfig = MODE_CONFIG[mode];

  const handleSelect = useCallback(
    (suggestion: ReportSearchSuggestion) => {
      setSearchValue(suggestion.value);
      search(suggestion.value);
    },
    [setSearchValue, search],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && searchValue.trim()) search();
    },
    [search, searchValue],
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
        c.section?.toLowerCase().includes(q) ||
        c.employeeCode?.toLowerCase().includes(q) ||
        c.employeeName?.toLowerCase().includes(q),
    );
  }, [coupons, couponSearch]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCoupons.length / ITEMS_PER_PAGE),
  );
  const paginatedCoupons = useMemo(() => {
    const start = (couponPage - 1) * ITEMS_PER_PAGE;
    return filteredCoupons.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCoupons, couponPage]);

  const showEmployeeColumn =
    summary?.subject.mode !== "employee" || isAllSummary;

  const grandTotalBundles = useMemo(
    () => employeeGroupedData.reduce((acc, eg) => acc + eg.totalBundles, 0),
    [employeeGroupedData],
  );
  const grandTotalQty = useMemo(
    () => employeeGroupedData.reduce((acc, eg) => acc + eg.totalQty, 0),
    [employeeGroupedData],
  );
  const grandTotalPay = useMemo(
    () => employeeGroupedData.reduce((acc, eg) => acc + eg.totalPay, 0),
    [employeeGroupedData],
  );

  const card2 = summary ? getCard2Config(summary) : null;

  // Exports whichever breakdown tab is currently open (not the whole
  // report) — that's the table the user is looking at when they click
  // Export, and matches the coupons tab's own search filter rather than
  // re-deriving a separate scope.
  const exportData = useMemo(() => {
    if (!summary) return null;

    let headers: string[];
    let rows: (string | number | null | undefined)[][];

    if (effectiveTab === "operations") {
      headers = [
        "Operation Code",
        "Operation Name",
        "Section",
        "Rate",
        "SMV",
        "Coupons",
        "Output (Pcs)",
        "SAM Earned",
        "Total Amount",
      ];
      rows = summary.operations.map((op) => [
        op.operationCode,
        op.operationName,
        op.section,
        op.rate,
        op.smv,
        op.couponCount,
        op.totalQty,
        Number(op.totalSam.toFixed(2)),
        Number(op.totalAmount.toFixed(2)),
      ]);
    } else if (effectiveTab === "workOrders") {
      headers = [
        "Work Order #",
        "Operations",
        "Coupons",
        "Output (Pcs)",
        "SAM Earned",
        "Total Amount",
      ];
      rows = summary.workOrders.map((wo) => [
        wo.workOrder,
        wo.operationsCount,
        wo.couponCount,
        wo.totalQty,
        Number(wo.totalSam.toFixed(2)),
        Number(wo.totalAmount.toFixed(2)),
      ]);
    } else if (effectiveTab === "sections") {
      headers = [
        "Section",
        "Operations",
        "Coupons",
        "Output (Pcs)",
        "SAM Earned",
        "Total Amount",
      ];
      rows = summary.sections.map((s) => [
        s.section,
        s.operationsCount,
        s.couponCount,
        s.totalQty,
        Number(s.totalSam.toFixed(2)),
        Number(s.totalAmount.toFixed(2)),
      ]);
    } else if (effectiveTab === "bundles") {
      headers = [
        "Bundle #",
        "Cut #",
        "Work Order",
        "Coupons",
        "Output (Pcs)",
        "SAM Earned",
        "Total Amount",
      ];
      rows = summary.bundles.map((b) => [
        b.bundleNo,
        b.cutNo,
        b.workOrder,
        b.couponCount,
        b.totalQty,
        Number(b.totalSam.toFixed(2)),
        Number(b.totalAmount.toFixed(2)),
      ]);
    } else if (effectiveTab === "employees") {
      headers = [
        "EmpCode",
        "Employee Name",
        "ANL #",
        "Date",
        "Operation",
        "Rate",
        "Bundle",
        "Quantity",
        "Total Pay",
        "Signature",
      ];
      rows = [];
      for (const eg of employeeGroupedData) {
        for (let i = 0; i < eg.items.length; i++) {
          const item = eg.items[i];
          rows.push([
            i === 0 ? eg.employeeCode : "",
            i === 0 ? eg.employeeName : "",
            item.workOrder,
            item.date,
            item.operation,
            item.rate != null ? Number(item.rate.toFixed(2)) : "",
            item.bundleCount,
            item.qty,
            Number(item.totalPay.toFixed(2)),
            "",
          ]);
        }
        rows.push([
          "",
          "",
          "",
          "",
          "",
          "Employee wise Total :",
          eg.totalBundles,
          eg.totalQty,
          Number(eg.totalPay.toFixed(2)),
          "",
        ]);
      }
      rows.push([
        "",
        "",
        "",
        "",
        "",
        "Grand Total :",
        grandTotalBundles,
        grandTotalQty,
        Number(grandTotalPay.toFixed(2)),
        "",
      ]);
    } else {
      headers = [
        "Coupon Code",
        "Work Order",
        "Cut #",
        "Bundle #",
        "Qty (Pcs)",
        "Operation",
        ...(showEmployeeColumn ? ["Employee"] : []),
        "Rate",
        "Value",
        "Scanned At",
      ];
      rows = filteredCoupons.map((c) => [
        c.couponCode,
        c.workOrder,
        c.cutNo,
        c.bundleNo,
        c.qty,
        c.operationName || c.operationCode,
        ...(showEmployeeColumn
          ? [formatEmployeeLabel(c.employeeCode, c.employeeName)]
          : []),
        c.rate,
        c.value,
        c.scannedAt
          ? format(new Date(c.scannedAt), "dd MMM yyyy, hh:mm a")
          : "",
      ]);
    }

    const subjectSlug =
      summary.subject.mode === "employee"
        ? summary.subject.all
          ? "all-employees"
          : `employee-${summary.subject.employee.EmployeeID}`
        : summary.subject.mode === "workOrder"
          ? summary.subject.all
            ? "all-work-orders"
            : summary.subject.workOrder
          : summary.subject.mode === "operation"
            ? summary.subject.all
              ? "all-operations"
              : summary.subject.operationCode
            : summary.subject.all
              ? "all-sections"
              : summary.subject.section;

    return {
      filename: `report-${subjectSlug}-${effectiveTab}-${format(new Date(), "yyyyMMdd-HHmm")}`,
      headers,
      rows,
    };
  }, [
    summary,
    effectiveTab,
    filteredCoupons,
    showEmployeeColumn,
    employeeGroupedData,
    grandTotalBundles,
    grandTotalQty,
    grandTotalPay,
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Wages Panel ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden no-print">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#4f46e5]" />
            <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
              Employee Wages
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
              const isAlreadyCalculated = summary?.allWagesCalculated === true;
              return (
                <button
                  type="button"
                  onClick={handleCreateWages}
                  disabled={isCreatingWages || employeeGroupedData.length === 0 || isAlreadyCalculated}
                  title={
                    isAlreadyCalculated
                      ? "Wages have already been calculated for all coupons in this scope."
                      : employeeGroupedData.length === 0
                      ? "Run a report first to load employee data"
                      : "Save current report employee data as wages"
                  }
                  className={`flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm ${
                    isAlreadyCalculated
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-not-allowed opacity-80"
                      : "bg-[#4f46e5] text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  }`}
                >
                  {isCreatingWages ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isAlreadyCalculated ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Coins className="w-3.5 h-3.5" />
                  )}
                  {isAlreadyCalculated ? "Wages Calculated" : "Create Wages"}
                </button>
              );
            })()}
            <button
              type="button"
              onClick={handleViewWages}
              disabled={wagesLoading}
              className={`flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                wagesVisible
                  ? "bg-indigo-100 text-[#4f46e5] border border-indigo-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
              }`}
            >
              {wagesLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {wagesVisible ? "Hide Wages" : "View Wages"}
            </button>
          </div>
        </div>

        {/* Feedback message */}
        {wageMsg && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              wageMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {wageMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{wageMsg.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setWageMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold text-sm px-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Wages table — visible when View Wages is active */}
        {wagesVisible && wagesBatches.length > 0 && (
          <div className="flex flex-col gap-5 p-4">
            {wagesBatches.map((batch) => {
              // Group rows by employee
              const empGroups = new Map<
                string,
                {
                  employeeCode: string;
                  employeeName: string | null | undefined;
                  items: typeof batch.rows;
                  totalBundles: number;
                  totalQty: number;
                  totalPay: number;
                }
              >();
              for (const row of batch.rows) {
                const r = row as any;
                const empCode = String(row.employeeCode || r.EmployeeCode || "");
                const empName = row.employeeName ?? r.EmployeeName ?? null;
                const bundleCount = Number(row.bundleCount ?? r.BundleCount) || 0;
                const qty = Number(row.qty ?? r.Qty) || 0;
                const totalPay = Number(row.totalPay ?? r.TotalPay) || 0;

                if (!empGroups.has(empCode)) {
                  empGroups.set(empCode, {
                    employeeCode: empCode,
                    employeeName: empName,
                    items: [],
                    totalBundles: 0,
                    totalQty: 0,
                    totalPay: 0,
                  });
                }
                const g = empGroups.get(empCode)!;
                g.items.push(row);
                g.totalBundles += bundleCount;
                g.totalQty += qty;
                g.totalPay += totalPay;
              }
              const groups = Array.from(empGroups.values());
              const batchGrandBundles = groups.reduce((s, g) => s + g.totalBundles, 0);
              const batchGrandQty = groups.reduce((s, g) => s + g.totalQty, 0);
              const batchGrandPay = groups.reduce((s, g) => s + g.totalPay, 0);

              return (
                <div
                  key={batch.WageId}
                  className="border border-slate-200 rounded-xl overflow-hidden"
                >
                  {/* Batch header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex-wrap gap-2">
                    <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                      <span className="font-bold text-slate-800">
                        Batch #{batch.WageId}
                      </span>
                      {batch.FromDate && (
                        <span className="text-slate-500">
                          {batch.FromDate.slice(0, 10)} →{" "}
                          {batch.ToDate?.slice(0, 10) ?? "—"}
                        </span>
                      )}
                      {batch.CreatedBy && (
                        <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          {batch.CreatedBy}
                        </span>
                      )}
                      <span className="font-bold text-emerald-700">
                        Rs. {formatAmount(Number(batch.TotalAmount))}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteWages(batch.WageId)}
                      disabled={isDeletingWages}
                      className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {isDeletingWages ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Delete
                    </button>
                  </div>

                  {/* Same table format as the Employees breakdown tab */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                          <th className="py-2.5 px-3 border-r border-slate-200">EmpCode</th>
                          <th className="py-2.5 px-3 border-r border-slate-200">Employee Name</th>
                          <th className="py-2.5 px-3 border-r border-slate-200">ANL #</th>
                          <th className="py-2.5 px-3 text-center border-r border-slate-200">Date</th>
                          <th className="py-2.5 px-3 border-r border-slate-200">Operation</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-200">Rate</th>
                          <th className="py-2.5 px-3 text-center border-r border-slate-200">Bundle</th>
                          <th className="py-2.5 px-3 text-center border-r border-slate-200">Quantity</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-200">Total Pay</th>
                          <th className="py-2.5 px-3 text-center w-20">Signature</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {groups.map((g) => (
                          <Fragment key={g.employeeCode}>
                            {g.items.map((item, rowIdx) => {
                              const r = item as any;
                              const wo = item.workOrder || r.WorkOrder || "—";
                              const wd = item.workDate || r.WorkDate || "—";
                              const op = item.operation || r.Operation || "—";
                              const rateVal = item.rate ?? r.Rate;
                              const bundleVal = Number(item.bundleCount ?? r.BundleCount) || 0;
                              const qtyVal = Number(item.qty ?? r.Qty) || 0;
                              const payVal = Number(item.totalPay ?? r.TotalPay) || 0;

                              return (
                                <tr
                                  key={rowIdx}
                                  className="hover:bg-slate-50/60 transition-colors"
                                >
                                  <td className="py-2 px-3 border-r border-slate-100 font-mono font-bold text-[#4f46e5] text-[11px]">
                                    {rowIdx === 0 ? g.employeeCode : ""}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 font-semibold text-slate-800">
                                    {rowIdx === 0 ? (g.employeeName || "—") : ""}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 font-mono text-slate-700">
                                    {wo}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-center text-slate-600">
                                    {wd}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-slate-700">
                                    {op}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-right font-mono text-slate-700">
                                    {rateVal != null ? `Rs. ${Number(rateVal).toFixed(2)}` : "—"}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-center font-bold text-slate-800">
                                    {bundleVal}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-center font-extrabold text-[#4f46e5]">
                                    {qtyVal.toLocaleString()}
                                  </td>
                                  <td className="py-2 px-3 border-r border-slate-100 text-right font-bold text-emerald-700">
                                    Rs. {formatAmount(payVal)}
                                  </td>
                                  <td className="py-2 px-3 text-center border-slate-100" />
                                </tr>
                              );
                            })}
                            {/* Employee sub-total */}
                            <tr className="bg-slate-50/80 border-t border-slate-200 text-[11px] font-bold text-slate-700">
                              <td className="py-1.5 px-3 border-r border-slate-200" colSpan={5}>
                                Employee wise Total :
                              </td>
                              <td className="py-1.5 px-3 border-r border-slate-200" />
                              <td className="py-1.5 px-3 border-r border-slate-200 text-center">
                                {g.totalBundles}
                              </td>
                              <td className="py-1.5 px-3 border-r border-slate-200 text-center text-[#4f46e5]">
                                {g.totalQty.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-3 border-r border-slate-200 text-right text-emerald-700">
                                Rs. {formatAmount(g.totalPay)}
                              </td>
                              <td className="py-1.5 px-3" />
                            </tr>
                          </Fragment>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-slate-800 text-xs">
                          <td className="py-2.5 px-3 border-r border-slate-200" colSpan={5}>
                            Grand Total :
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200" />
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                            {batchGrandBundles}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center text-[#4f46e5]">
                            {batchGrandQty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 text-right text-emerald-700">
                            Rs. {formatAmount(batchGrandPay)}
                          </td>
                          <td className="py-2.5 px-3" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-sm no-print">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <UserRound className="w-4 h-4 text-[#4f46e5]" />
            <h2 className="font-bold text-[#4f46e5] text-xs uppercase tracking-wider">
              Search Report
            </h2>
          </div>

          {/* Search-by mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {(Object.keys(MODE_CONFIG) as ReportSearchMode[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => changeMode(key)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  mode === key
                    ? "bg-white text-[#4f46e5] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {MODE_CONFIG[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* Search field + its "or All X" alternative, grouped as one unit */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="font-bold text-[#475569] text-[10px] uppercase">
              {modeConfig.fieldLabel} <span className="text-red-500">*</span>
            </span>
            <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
              <div className="flex-1 min-w-0">
                <Autocomplete<ReportSearchSuggestion>
                  key={mode}
                  value={searchValue}
                  onChange={setSearchValue}
                  onSelect={handleSelect}
                  fetchSuggestions={modeConfig.fetchSuggestions}
                  renderSuggestion={(item) => (
                    <>
                      <span className="text-[#4f46e5] font-bold">
                        {item.label}
                      </span>
                      {item.sublabel && (
                        <span className="text-[9px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                          {item.sublabel}
                        </span>
                      )}
                    </>
                  )}
                  getSuggestionValue={(item) => item.value}
                  placeholder={modeConfig.placeholder}
                  inputClassName="w-full h-9 px-3.5 rounded-xl border border-[#e2e8f0] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white"
                  onKeyDown={handleKeyDown}
                  minChars={1}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                  or
                </span>
                <button
                  type="button"
                  onClick={() => searchAll()}
                  disabled={isLoading}
                  title={`View a combined report across every ${modeConfig.label.toLowerCase()}, without picking one`}
                  className={`h-9 px-3.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                    isAllMode
                      ? "bg-[#4f46e5] border-[#4f46e5] text-white shadow-sm"
                      : "bg-indigo-50/60 border-indigo-200 text-[#4f46e5] hover:bg-indigo-100 hover:border-indigo-300"
                  }`}
                >
                  All {modeConfig.label}s
                </button>
              </div>
            </div>
          </div>

          {/* Divider — only visible once the row has room to sit side by side */}
          <div className="hidden lg:block w-px self-stretch bg-slate-200" />

          {/* Tenure / date range */}
          <div className="flex flex-col gap-1 w-full lg:w-64 shrink-0">
            <span className="font-bold text-[#475569] text-[10px] uppercase">
              Tenure / Scope
            </span>
            <Popover actionsRef={rangePopoverActionsRef}>
              <PopoverTrigger className="w-full h-9 flex items-center gap-2 px-3.5 rounded-xl border border-[#e2e8f0] text-xs font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white cursor-pointer">
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
                    selected={
                      dateRange.from || dateRange.to
                        ? { from: dateRange.from, to: dateRange.to }
                        : undefined
                    }
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
            disabled={isLoading || !searchValue.trim()}
            title={
              !searchValue.trim()
                ? `Enter a ${modeConfig.label.toLowerCase()} to search, or use "All ${modeConfig.label}s" instead`
                : undefined
            }
            className="flex items-center justify-center gap-2 h-9 px-5 rounded-xl bg-[#4f46e5] text-white text-xs font-bold hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm shrink-0 w-full lg:w-auto"
          >
            <Search className="w-3.5 h-3.5" />
            {isLoading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>
        )}
      </div>

      {/* Loading skeleton — shown while a search/searchAll request is in flight */}
      {isLoading && (
        <div className="flex flex-col gap-6 no-print animate-pulse">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 h-24" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 h-40" />
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 h-40" />
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 h-40" />
          </div>
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 h-72" />
        </div>
      )}

      {/* Idle empty state — nothing searched yet, no error, not loading */}
      {!isLoading && !summary && !error && (
        <div className="flex flex-col items-center justify-center gap-2.5 bg-white border border-dashed border-[#e2e8f0] rounded-2xl py-16 no-print text-center">
          <Search className="w-8 h-8 text-slate-300" />
          <p className="text-sm font-bold text-slate-500">
            Search for an employee, work order, operation, or section to view
            its report
          </p>
          <p className="text-xs text-slate-400">
            Or use &ldquo;All {modeConfig.label}s&rdquo; for a combined view
          </p>
        </div>
      )}

      {!isLoading && summary && card2 && (
        <>
          {/* Subject Header Banner */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
            {/* Left: Icon/Avatar + Details */}
            <div className="flex items-center gap-3.5">
              {summary.subject.mode === "employee" && !summary.subject.all ? (
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                  {getInitials(summary.subject.employee.FirstName)}
                </div>
              ) : summary.subject.all ? (
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                  <Users className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#4f46e5] to-[#6366f1] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                  {summary.subject.mode === "workOrder" ? (
                    <ClipboardList className="w-6 h-6" />
                  ) : summary.subject.mode === "section" ? (
                    <Layers className="w-6 h-6" />
                  ) : (
                    <Scissors className="w-6 h-6" />
                  )}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {summary.subject.mode === "employee" &&
                    !summary.subject.all && (
                      <>
                        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                          {summary.subject.employee.FirstName?.trim() ||
                            "Unknown Employee"}
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#4f46e5] font-black text-xs border border-indigo-100/80 font-mono">
                          #{summary.subject.employee.EmployeeID}
                        </span>
                      </>
                    )}
                  {summary.subject.mode === "employee" &&
                    summary.subject.all && (
                      <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                        All Employees
                      </h1>
                    )}
                  {summary.subject.mode === "workOrder" &&
                    !summary.subject.all && (
                      <>
                        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight font-mono">
                          Work Order #{summary.subject.workOrder}
                        </h1>
                        {summary.subject.saleOrderNo && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#4f46e5] font-black text-xs border border-indigo-100/80 font-mono">
                            SO #{summary.subject.saleOrderNo}
                          </span>
                        )}
                      </>
                    )}
                  {summary.subject.mode === "workOrder" &&
                    summary.subject.all && (
                      <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                        All Work Orders
                      </h1>
                    )}
                  {summary.subject.mode === "operation" &&
                    !summary.subject.all && (
                      <>
                        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                          {summary.subject.operationName ||
                            summary.subject.operationCode}
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#4f46e5] font-black text-xs border border-indigo-100/80 font-mono">
                          {summary.subject.operationCode}
                        </span>
                      </>
                    )}
                  {summary.subject.mode === "operation" &&
                    summary.subject.all && (
                      <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                        All Operations
                      </h1>
                    )}
                  {summary.subject.mode === "section" &&
                    !summary.subject.all && (
                      <>
                        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                          {summary.subject.section}
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-[#4f46e5] font-black text-xs border border-indigo-100/80 font-mono">
                          {summary.subject.operationsCount}{" "}
                          {summary.subject.operationsCount === 1
                            ? "Operation"
                            : "Operations"}
                        </span>
                      </>
                    )}
                  {summary.subject.mode === "section" &&
                    summary.subject.all && (
                      <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
                        All Sections
                      </h1>
                    )}
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 font-medium">
                  {summary.subject.mode === "employee" &&
                    !summary.subject.all && (
                      <>
                        {summary.subject.employee.DesignationName && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {summary.subject.employee.DesignationName}
                          </span>
                        )}
                        {summary.subject.employee.DepartmentName && (
                          <span className="text-slate-600 font-semibold">
                            {summary.subject.employee.DepartmentName}
                          </span>
                        )}
                        {summary.subject.employee.ParentDepartment && (
                          <span className="text-slate-400">
                            · {summary.subject.employee.ParentDepartment}
                          </span>
                        )}
                      </>
                    )}
                  {summary.subject.mode === "employee" &&
                    summary.subject.all && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {summary.totalEmployees.toLocaleString()}{" "}
                        {summary.totalEmployees === 1
                          ? "Employee"
                          : "Employees"}{" "}
                        in scope
                      </span>
                    )}
                  {summary.subject.mode === "workOrder" &&
                    !summary.subject.all && (
                      <>
                        {summary.subject.customerName && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {summary.subject.customerName}
                          </span>
                        )}
                        {summary.subject.orderQty != null && (
                          <span className="text-slate-600 font-semibold">
                            Order Qty:{" "}
                            {summary.subject.orderQty.toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                  {summary.subject.mode === "workOrder" &&
                    summary.subject.all && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {summary.totalWorkOrders.toLocaleString()}{" "}
                        {summary.totalWorkOrders === 1
                          ? "Work Order"
                          : "Work Orders"}{" "}
                        in scope
                      </span>
                    )}
                  {summary.subject.mode === "operation" &&
                    !summary.subject.all && (
                      <>
                        {summary.subject.department && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {summary.subject.department}
                          </span>
                        )}
                        {summary.subject.skillLevel && (
                          <span className="text-slate-600 font-semibold">
                            Skill: {summary.subject.skillLevel}
                          </span>
                        )}
                      </>
                    )}
                  {summary.subject.mode === "operation" &&
                    summary.subject.all && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {summary.totalOperations.toLocaleString()}{" "}
                        {summary.totalOperations === 1
                          ? "Operation"
                          : "Operations"}{" "}
                        in scope
                      </span>
                    )}
                  {summary.subject.mode === "section" &&
                    !summary.subject.all && (
                      <span className="text-slate-600 font-semibold">
                        {summary.totalWorkOrders.toLocaleString()}{" "}
                        {summary.totalWorkOrders === 1
                          ? "Work Order"
                          : "Work Orders"}{" "}
                        touched
                      </span>
                    )}
                  {summary.subject.mode === "section" &&
                    summary.subject.all && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {summary.sections.length.toLocaleString()}{" "}
                        {summary.sections.length === 1 ? "Section" : "Sections"}{" "}
                        in scope
                      </span>
                    )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
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
                  <span className="text-slate-500 font-medium text-[11px]">
                    Last Timestamp
                  </span>
                  <span
                    className="font-semibold text-slate-700 text-[11px] truncate max-w-[150px]"
                    title={
                      summary.lastScannedAt
                        ? new Date(summary.lastScannedAt).toLocaleString()
                        : undefined
                    }
                  >
                    {formatTimestamp(summary.lastScannedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">
                    Selected Scope
                  </span>
                  <span className="font-semibold text-[#4f46e5] text-[11px] truncate max-w-[150px]">
                    {formatRangeLabel(dateRange)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Coverage (dynamic per search mode) */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${card2.iconClassName}`}
                    >
                      <card2.icon className="w-4.5 h-4.5" />
                    </span>
                    <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      {card2.title}
                    </span>
                  </div>
                  {card2.badge && (
                    <span className="text-[10px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-md font-mono truncate max-w-[140px]">
                      {card2.badge}
                    </span>
                  )}
                </div>

                <div className="my-3.5">
                  <span className="text-3xl font-black text-[#0f172a] tracking-tight">
                    {card2.value}
                  </span>
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex flex-col gap-2.5 text-xs">
                {card2.rows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-500 font-medium text-[11px]">
                      {row.label}
                    </span>
                    <span
                      className="font-semibold text-slate-700 text-[11px] truncate max-w-[150px]"
                      title={row.value}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
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
                  <span className="text-slate-500 font-medium text-[11px]">
                    Total Output
                  </span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {summary.totalQty.toLocaleString()} Pcs
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">
                    Standard SAM
                  </span>
                  <span className="font-semibold text-slate-700 text-[11px]">
                    {summary.totalSam.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    min
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-medium text-[11px]">
                    Avg Rate / Pc
                  </span>
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
              <div className="flex items-center gap-2 overflow-x-auto min-w-0 pb-2 sm:pb-0">
                {availableTabs.map((tab) => {
                  const meta =
                    tab === "coupons"
                      ? {
                          label: "Scanned Coupons Trail",
                          icon: FileSpreadsheet,
                        }
                      : TAB_META[tab];
                  const count = summary[tab]?.length || 0;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        effectiveTab === tab
                          ? "bg-[#4f46e5] text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{meta.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                          effectiveTab === tab
                            ? "bg-white/20 text-white"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pb-2.5 sm:pb-2 w-full sm:w-auto shrink-0">
                {/* Tab contextual quick-search for coupons */}
                {effectiveTab === "coupons" && (
                  <div className="relative w-full sm:w-64">
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
                <CsvExportButton
                  filename={exportData?.filename ?? "report-export"}
                  headers={exportData?.headers ?? []}
                  rows={exportData?.rows ?? []}
                  disabled={!exportData}
                />
              </div>
            </div>

            {/* Tab: Operations Breakdown Table */}
            {effectiveTab === "operations" && (
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.operations.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-8 text-center text-slate-400 font-medium"
                        >
                          No operations recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      summary.operations.map((op, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
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
                            {op.rate != null
                              ? `Rs. ${op.rate.toFixed(2)}`
                              : "—"}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                  {summary.operations.length > 0 && (
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
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Tab: Sections Breakdown Table (Work Order mode only) */}
            {effectiveTab === "sections" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Section</th>
                      <th className="py-2.5 px-3 text-center">Operations</th>
                      <th className="py-2.5 px-3 text-center">Coupons</th>
                      <th className="py-2.5 px-3 text-center">Output (Pcs)</th>
                      <th className="py-2.5 px-3 text-right">SAM Earned</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.sections.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-400 font-medium"
                        >
                          No sections recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      summary.sections.map((s, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                              {s.section}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                            {s.operationsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                            {s.couponCount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center font-extrabold text-[#4f46e5]">
                            {s.totalQty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                            {s.totalSam.toFixed(2)} min
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            Rs. {formatAmount(s.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {summary.sections.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200 font-bold text-slate-800 text-xs">
                        <td className="py-2.5 px-3" colSpan={2}>
                          Total ({summary.sections.length} Sections)
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
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Tab: Bundles Breakdown Table (Work Order mode only) */}
            {effectiveTab === "bundles" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Bundle #</th>
                      <th className="py-2.5 px-3">Cut #</th>
                      {isAllSummary && (
                        <th className="py-2.5 px-3">Work Order</th>
                      )}
                      <th className="py-2.5 px-3 text-center">Coupons</th>
                      <th className="py-2.5 px-3 text-center">Output (Pcs)</th>
                      <th className="py-2.5 px-3 text-right">SAM Earned</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.bundles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAllSummary ? 7 : 6}
                          className="py-8 text-center text-slate-400 font-medium"
                        >
                          No bundles recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      summary.bundles.map((b, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-[#4f46e5] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                              {b.bundleNo}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {b.cutNo || "—"}
                          </td>
                          {isAllSummary && (
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {b.workOrder}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                            {b.couponCount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center font-extrabold text-[#4f46e5]">
                            {b.totalQty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                            {b.totalSam.toFixed(2)} min
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            Rs. {formatAmount(b.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {summary.bundles.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t-2 border-slate-200 font-bold text-slate-800 text-xs">
                        <td
                          className="py-2.5 px-3"
                          colSpan={isAllSummary ? 3 : 2}
                        >
                          Total ({summary.bundles.length} Bundles)
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
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Tab: Work Orders Breakdown Table */}
            {effectiveTab === "workOrders" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Work Order #</th>
                      <th className="py-2.5 px-3 text-center">Operations</th>
                      <th className="py-2.5 px-3 text-center">Coupons</th>
                      <th className="py-2.5 px-3 text-center">
                        Total Output (Pcs)
                      </th>
                      <th className="py-2.5 px-3 text-right">SAM Earned</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.workOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-400 font-medium"
                        >
                          No work orders recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      summary.workOrders.map((wo, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
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
                        </tr>
                      ))
                    )}
                  </tbody>
                  {summary.workOrders.length > 0 && (
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
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* Tab: Employees Breakdown Table (Payment Verification Format matching PDF) */}
            {effectiveTab === "employees" && (
              <div className="flex flex-col border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm">
                {/* PDF Subheader Bar */}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 border-r border-slate-200">
                          EmpCode
                        </th>
                        <th className="py-2.5 px-3 border-r border-slate-200">
                          Employee Name
                        </th>
                        <th className="py-2.5 px-3 border-r border-slate-200">
                          ANL #
                        </th>
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
                        <th className="py-2.5 px-3 text-center w-24">
                          Signature
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {employeeGroupedData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="py-8 text-center text-slate-400 font-medium"
                          >
                            No employees recorded for this period.
                          </td>
                        </tr>
                      ) : (
                        employeeGroupedData.map((eg) => (
                          <Fragment key={eg.employeeCode}>
                            {eg.items.map((item, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="py-2 px-3 font-mono font-bold text-slate-800 text-[11px] border-r border-slate-200 align-top">
                                  {idx === 0 ? eg.employeeCode : ""}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900 text-[11px] border-r border-slate-200 align-top">
                                  {idx === 0 ? eg.employeeName : ""}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-slate-700 text-[11px] border-r border-slate-200">
                                  {item.workOrder}
                                </td>
                                <td className="py-2 px-3 text-center text-[11px] text-slate-600 font-medium whitespace-nowrap border-r border-slate-200">
                                  {item.date}
                                </td>
                                <td className="py-2 px-3 text-[11px] font-semibold text-slate-800 border-r border-slate-200">
                                  {item.operation}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700 text-[11px] border-r border-slate-200">
                                  {item.rate != null
                                    ? item.rate.toFixed(2).replace(/\.00$/, "")
                                    : "—"}
                                </td>
                                <td className="py-2 px-3 text-center font-semibold text-slate-700 text-[11px] border-r border-slate-200">
                                  {item.bundleCount}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-slate-800 text-[11px] border-r border-slate-200">
                                  {item.qty.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono text-[11px] border-r border-slate-200">
                                  {formatAmount(item.totalPay)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <div className="border border-slate-300 w-16 h-5 mx-auto rounded-sm" />
                                </td>
                              </tr>
                            ))}
                            {/* Employee wise Total row */}
                            <tr className="bg-slate-50 border-t border-b-2 border-slate-300 font-bold text-[11px] text-slate-800">
                              <td
                                colSpan={6}
                                className="py-2 px-3 text-right border-r border-slate-200"
                              >
                                Employee wise Total :
                              </td>
                              <td className="py-2 px-3 text-center border-r border-slate-200">
                                {eg.totalBundles.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-center border-r border-slate-200">
                                {eg.totalQty.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right font-mono border-r border-slate-200 text-emerald-800">
                                {formatAmount(eg.totalPay)}
                              </td>
                              <td className="py-2 px-3"></td>
                            </tr>
                          </Fragment>
                        ))
                      )}
                    </tbody>
                    {employeeGroupedData.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 border-t-2 border-slate-400 font-black text-xs text-slate-900">
                          <td
                            colSpan={6}
                            className="py-2.5 px-3 text-right border-r border-slate-300"
                          >
                            Grand Total :
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-300">
                            {grandTotalBundles.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center border-r border-slate-300 text-[#4f46e5]">
                            {grandTotalQty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono border-r border-slate-300 text-emerald-700">
                            Rs. {formatAmount(grandTotalPay)}
                          </td>
                          <td className="py-2.5 px-3"></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Tab: Itemized Coupons Audit Trail */}
            {effectiveTab === "coupons" && (
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
                        {showEmployeeColumn && (
                          <th className="py-2.5 px-3">Employee</th>
                        )}
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Value</th>
                        <th className="py-2.5 px-3 text-right">Scanned At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedCoupons.length === 0 ? (
                        <tr>
                          <td
                            colSpan={showEmployeeColumn ? 10 : 9}
                            className="py-8 text-center text-slate-400 font-medium"
                          >
                            No matching coupons found.
                          </td>
                        </tr>
                      ) : (
                        paginatedCoupons.map((c, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
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
                            {showEmployeeColumn && (
                              <td className="py-2 px-3">
                                <span className="font-semibold text-slate-800 text-[11px]">
                                  {formatEmployeeLabel(
                                    c.employeeCode,
                                    c.employeeName,
                                  )}
                                </span>
                              </td>
                            )}
                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                              {c.rate != null
                                ? `Rs. ${c.rate.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700 font-mono">
                              {c.value != null
                                ? `Rs. ${c.value.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="py-2 px-3 text-right text-[11px] text-slate-500 font-medium whitespace-nowrap">
                              {c.scannedAt
                                ? format(
                                    new Date(c.scannedAt),
                                    "dd MMM, hh:mm a",
                                  )
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
                    {Math.min(
                      couponPage * ITEMS_PER_PAGE,
                      filteredCoupons.length,
                    )}{" "}
                    of {filteredCoupons.length} coupons
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
                      onClick={() =>
                        setCouponPage((p) => Math.min(totalPages, p + 1))
                      }
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
              Productivity & Scan Report for Indus Plus Pvt Limited
            </h2>

            {/* Header / Subject Info Table */}
            <table className="print-header-table">
              <tbody>
                <tr>
                  <td style={{ width: "35%" }}>
                    {summary.subject.mode === "employee" &&
                      !summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>EMPLOYEE:</strong>{" "}
                            {summary.subject.employee.FirstName?.trim() || "—"}
                          </div>
                          <div>
                            <strong>EMPLOYEE ID:</strong> #
                            {summary.subject.employee.EmployeeID}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "employee" &&
                      summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>SCOPE:</strong> All Employees
                          </div>
                          <div>
                            <strong>EMPLOYEES COVERED:</strong>{" "}
                            {summary.totalEmployees}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "workOrder" &&
                      !summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>WORK ORDER:</strong>{" "}
                            {summary.subject.workOrder}
                          </div>
                          <div>
                            <strong>SALE ORDER #:</strong>{" "}
                            {summary.subject.saleOrderNo || "—"}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "workOrder" &&
                      summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>SCOPE:</strong> All Work Orders
                          </div>
                          <div>
                            <strong>WORK ORDERS COVERED:</strong>{" "}
                            {summary.totalWorkOrders}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "operation" &&
                      !summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>OPERATION:</strong>{" "}
                            {summary.subject.operationName || "—"}
                          </div>
                          <div>
                            <strong>OPERATION CODE:</strong>{" "}
                            {summary.subject.operationCode}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "operation" &&
                      summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>SCOPE:</strong> All Operations
                          </div>
                          <div>
                            <strong>OPERATIONS COVERED:</strong>{" "}
                            {summary.totalOperations}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "section" &&
                      !summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>SECTION:</strong> {summary.subject.section}
                          </div>
                          <div>
                            <strong>OPERATIONS IN SECTION:</strong>{" "}
                            {summary.subject.operationsCount}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "section" &&
                      summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>SCOPE:</strong> All Sections
                          </div>
                          <div>
                            <strong>SECTIONS COVERED:</strong>{" "}
                            {summary.sections.length}
                          </div>
                        </div>
                      )}
                  </td>
                  <td style={{ width: "35%" }}>
                    {summary.subject.mode === "employee" &&
                      !summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>DESIGNATION:</strong>{" "}
                            {summary.subject.employee.DesignationName || "—"}
                          </div>
                          <div>
                            <strong>DEPARTMENT:</strong>{" "}
                            {summary.subject.employee.DepartmentName ||
                              summary.subject.employee.ParentDepartment ||
                              "—"}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "employee" &&
                      summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>WORK ORDERS COVERED:</strong>{" "}
                            {summary.totalWorkOrders}
                          </div>
                          <div>
                            <strong>OPERATIONS COVERED:</strong>{" "}
                            {summary.totalOperations}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "workOrder" &&
                      !summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>CUSTOMER:</strong>{" "}
                            {summary.subject.customerName || "—"}
                          </div>
                          <div>
                            <strong>ORDER QTY:</strong>{" "}
                            {summary.subject.orderQty != null
                              ? summary.subject.orderQty.toLocaleString()
                              : "—"}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "workOrder" &&
                      summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>EMPLOYEES COVERED:</strong>{" "}
                            {summary.totalEmployees}
                          </div>
                          <div>
                            <strong>OPERATIONS COVERED:</strong>{" "}
                            {summary.totalOperations}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "operation" &&
                      !summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>DEPARTMENT:</strong>{" "}
                            {summary.subject.department || "—"}
                          </div>
                          <div>
                            <strong>SKILL LEVEL:</strong>{" "}
                            {summary.subject.skillLevel || "—"}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "operation" &&
                      summary.subject.all && (
                        <div className="flex flex-col gap-1">
                          <div>
                            <strong>EMPLOYEES COVERED:</strong>{" "}
                            {summary.totalEmployees}
                          </div>
                          <div>
                            <strong>WORK ORDERS COVERED:</strong>{" "}
                            {summary.totalWorkOrders}
                          </div>
                        </div>
                      )}
                    {summary.subject.mode === "section" && (
                      <div className="flex flex-col gap-1">
                        <div>
                          <strong>EMPLOYEES COVERED:</strong>{" "}
                          {summary.totalEmployees}
                        </div>
                        <div>
                          <strong>WORK ORDERS COVERED:</strong>{" "}
                          {summary.totalWorkOrders}
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={{ width: "30%" }}>
                    <div className="flex flex-col gap-1">
                      <div>
                        <strong>REPORT TENURE:</strong>{" "}
                        {formatRangeLabel(dateRange)}
                      </div>
                      <div>
                        <strong>PRINTED AT:</strong>{" "}
                        {format(new Date(), "dd MMM yyyy, hh:mm a")}
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan={3}>
                    <div className="grid grid-cols-4 gap-2 text-[9.5px]">
                      <div>
                        <strong>COUPONS SCANNED:</strong>{" "}
                        {summary.totalCoupons.toLocaleString()}
                      </div>
                      <div>
                        <strong>{card2.title.toUpperCase()}:</strong>{" "}
                        {card2.value}
                      </div>
                      <div>
                        <strong>TOTAL OUTPUT (PCS):</strong>{" "}
                        {summary.totalQty.toLocaleString()}
                      </div>
                      <div>
                        <strong>TOTAL AMOUNT (RS.):</strong> Rs.{" "}
                        {formatAmount(summary.totalAmount)}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {effectiveTab === "coupons" ? (
              <div>
                <h3 className="font-bold text-xs uppercase mb-1.5 mt-2">
                  Scanned Coupons Trail
                </h3>
                <table className="print-ops-table">
                  <thead>
                    <tr>
                      <th className="text-center w-10">#</th>
                      <th>COUPON CODE</th>
                      <th>WORK ORDER</th>
                      <th className="text-center">CUT #</th>
                      <th className="text-center">BUNDLE #</th>
                      <th className="text-center">QTY (PCS)</th>
                      <th>OPERATION</th>
                      {showEmployeeColumn && <th>EMPLOYEE</th>}
                      <th className="text-right">RATE (RS.)</th>
                      <th className="text-right">VALUE (RS.)</th>
                      <th className="text-right">SCANNED AT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCoupons.length === 0 ? (
                      <tr>
                        <td
                          colSpan={showEmployeeColumn ? 10 : 9}
                          className="text-center"
                        >
                          No matching coupons found.
                        </td>
                      </tr>
                    ) : (
                      filteredCoupons.map((c, idx) => (
                        <tr key={idx}>
                          <td className="text-center">{idx + 1}</td>
                          <td className="font-mono font-bold">
                            #{c.couponCode}
                          </td>
                          <td className="font-mono">{c.workOrder}</td>
                          <td className="text-center">{c.cutNo || "—"}</td>
                          <td className="text-center">{c.bundleNo || "—"}</td>
                          <td className="text-center font-bold">
                            {c.qty ?? "—"}
                          </td>
                          <td>{c.operationName || c.operationCode || "—"}</td>
                          {showEmployeeColumn && (
                            <td>
                              {formatEmployeeLabel(
                                c.employeeCode,
                                c.employeeName,
                              )}
                            </td>
                          )}
                          <td className="text-right">
                            {c.rate != null ? `Rs. ${c.rate.toFixed(2)}` : "—"}
                          </td>
                          <td className="text-right font-bold">
                            {c.value != null
                              ? `Rs. ${c.value.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="text-right">
                            {c.scannedAt
                              ? format(
                                  new Date(c.scannedAt),
                                  "dd MMM yyyy, hh:mm a",
                                )
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              (() => {
                const dimension = effectiveTab as BreakdownDimension;
                const items = summary[dimension];
                if (!items || items.length === 0) return null;

                if (dimension === "operations") {
                  return (
                    <div key={dimension}>
                      <h3 className="font-bold text-xs uppercase mb-1.5 mt-2">
                        Operations Breakdown
                      </h3>
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
                          {summary.operations.map((op, idx) => (
                            <tr key={idx}>
                              <td className="text-center">{idx + 1}</td>
                              <td className="font-mono font-bold">
                                {op.operationCode}
                              </td>
                              <td>{op.operationName}</td>
                              <td>{op.section || "—"}</td>
                              <td className="text-right font-mono">
                                {op.rate != null
                                  ? `Rs. ${op.rate.toFixed(2)}`
                                  : "—"}
                              </td>
                              <td className="text-right font-mono">
                                {op.smv != null ? op.smv.toFixed(2) : "—"}
                              </td>
                              <td className="text-center font-bold">
                                {op.couponCount.toLocaleString()}
                              </td>
                              <td className="text-center font-bold">
                                {op.totalQty.toLocaleString()}
                              </td>
                              <td className="text-right">
                                {op.totalSam.toFixed(2)} min
                              </td>
                              <td className="text-right font-bold">
                                Rs. {formatAmount(op.totalAmount)}
                              </td>
                            </tr>
                          ))}
                          <tr className="print-totals-row">
                            <td colSpan={6} className="text-right uppercase">
                              Grand Total
                            </td>
                            <td className="text-center">
                              {summary.totalCoupons.toLocaleString()}
                            </td>
                            <td className="text-center">
                              {summary.totalQty.toLocaleString()}
                            </td>
                            <td className="text-right">
                              {summary.totalSam.toFixed(2)} min
                            </td>
                            <td className="text-right">
                              Rs. {formatAmount(summary.totalAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                }

                if (dimension === "workOrders") {
                  return (
                    <div key={dimension}>
                      <h3 className="font-bold text-xs uppercase mb-1.5 mt-2">
                        Work Orders Summary
                      </h3>
                      <table className="print-ops-table">
                        <thead>
                          <tr>
                            <th className="text-center w-10">#</th>
                            <th>WORK ORDER #</th>
                            <th className="text-center w-20">OPERATIONS</th>
                            <th className="text-center w-20">COUPONS</th>
                            <th className="text-center w-24">OUTPUT (PCS)</th>
                            <th className="text-right w-24">SAM EARNED</th>
                            <th className="text-right w-28">
                              TOTAL AMOUNT (RS.)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.workOrders.map((wo, idx) => (
                            <tr key={idx}>
                              <td className="text-center">{idx + 1}</td>
                              <td className="font-mono font-bold">
                                {wo.workOrder}
                              </td>
                              <td className="text-center">
                                {wo.operationsCount}
                              </td>
                              <td className="text-center">
                                {wo.couponCount.toLocaleString()}
                              </td>
                              <td className="text-center">
                                {wo.totalQty.toLocaleString()}
                              </td>
                              <td className="text-right">
                                {wo.totalSam.toFixed(2)} min
                              </td>
                              <td className="text-right font-bold">
                                Rs. {formatAmount(wo.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                if (dimension === "sections") {
                  return (
                    <div key={dimension}>
                      <h3 className="font-bold text-xs uppercase mb-1.5 mt-2">
                        Sections Breakdown
                      </h3>
                      <table className="print-ops-table">
                        <thead>
                          <tr>
                            <th className="text-center w-10">#</th>
                            <th>SECTION</th>
                            <th className="text-center w-20">OPERATIONS</th>
                            <th className="text-center w-20">COUPONS</th>
                            <th className="text-center w-24">OUTPUT (PCS)</th>
                            <th className="text-right w-24">SAM EARNED</th>
                            <th className="text-right w-28">
                              TOTAL AMOUNT (RS.)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.sections.map((s, idx) => (
                            <tr key={idx}>
                              <td className="text-center">{idx + 1}</td>
                              <td className="font-bold">{s.section}</td>
                              <td className="text-center">
                                {s.operationsCount}
                              </td>
                              <td className="text-center">
                                {s.couponCount.toLocaleString()}
                              </td>
                              <td className="text-center">
                                {s.totalQty.toLocaleString()}
                              </td>
                              <td className="text-right">
                                {s.totalSam.toFixed(2)} min
                              </td>
                              <td className="text-right font-bold">
                                Rs. {formatAmount(s.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                if (dimension === "bundles") {
                  return (
                    <div key={dimension}>
                      <h3 className="font-bold text-xs uppercase mb-1.5 mt-2">
                        Bundles Breakdown
                      </h3>
                      <table className="print-ops-table">
                        <thead>
                          <tr>
                            <th className="text-center w-10">#</th>
                            <th>BUNDLE #</th>
                            <th>CUT #</th>
                            {isAllSummary && <th>WORK ORDER</th>}
                            <th className="text-center w-20">COUPONS</th>
                            <th className="text-center w-24">OUTPUT (PCS)</th>
                            <th className="text-right w-24">SAM EARNED</th>
                            <th className="text-right w-28">
                              TOTAL AMOUNT (RS.)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.bundles.map((b, idx) => (
                            <tr key={idx}>
                              <td className="text-center">{idx + 1}</td>
                              <td className="font-mono font-bold">
                                {b.bundleNo}
                              </td>
                              <td>{b.cutNo || "—"}</td>
                              {isAllSummary && (
                                <td className="font-mono">{b.workOrder}</td>
                              )}
                              <td className="text-center">
                                {b.couponCount.toLocaleString()}
                              </td>
                              <td className="text-center">
                                {b.totalQty.toLocaleString()}
                              </td>
                              <td className="text-right">
                                {b.totalSam.toFixed(2)} min
                              </td>
                              <td className="text-right font-bold">
                                Rs. {formatAmount(b.totalAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                return (
                  <div key={dimension}>
                    <table className="print-ops-table">
                      <thead>
                        <tr>
                          <th>EMPCODE</th>
                          <th>EMPLOYEE NAME</th>
                          <th>ANL #</th>
                          <th className="text-center">DATE</th>
                          <th>OPERATION</th>
                          <th className="text-right">RATE</th>
                          <th className="text-center">BUNDLE</th>
                          <th className="text-center">QUANTITY</th>
                          <th className="text-right">TOTAL PAY</th>
                          <th className="text-center w-24">SIGNATURE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeGroupedData.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center">
                              No employees recorded for this period.
                            </td>
                          </tr>
                        ) : (
                          employeeGroupedData.map((eg) => (
                            <Fragment key={eg.employeeCode}>
                              {eg.items.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="font-mono font-bold align-top">
                                    {idx === 0 ? eg.employeeCode : ""}
                                  </td>
                                  <td className="font-bold align-top">
                                    {idx === 0 ? eg.employeeName : ""}
                                  </td>
                                  <td className="font-mono font-bold">
                                    {item.workOrder}
                                  </td>
                                  <td className="text-center whitespace-nowrap">
                                    {item.date}
                                  </td>
                                  <td>{item.operation}</td>
                                  <td className="text-right font-mono">
                                    {item.rate != null
                                      ? item.rate
                                          .toFixed(2)
                                          .replace(/\.00$/, "")
                                      : "—"}
                                  </td>
                                  <td className="text-center">
                                    {item.bundleCount}
                                  </td>
                                  <td className="text-center font-bold">
                                    {item.qty.toLocaleString()}
                                  </td>
                                  <td className="text-right font-bold font-mono">
                                    {formatAmount(item.totalPay)}
                                  </td>
                                  <td className="text-center"></td>
                                </tr>
                              ))}
                              <tr className="print-totals-row">
                                <td
                                  colSpan={6}
                                  className="text-right font-bold"
                                >
                                  Employee wise Total :
                                </td>
                                <td className="text-center font-bold">
                                  {eg.totalBundles.toLocaleString()}
                                </td>
                                <td className="text-center font-bold">
                                  {eg.totalQty.toLocaleString()}
                                </td>
                                <td className="text-right font-bold font-mono">
                                  {formatAmount(eg.totalPay)}
                                </td>
                                <td></td>
                              </tr>
                            </Fragment>
                          ))
                        )}
                      </tbody>
                      {employeeGroupedData.length > 0 && (
                        <tfoot>
                          <tr className="print-totals-row font-bold">
                            <td colSpan={6} className="text-right">
                              Grand Total :
                            </td>
                            <td className="text-center">
                              {grandTotalBundles.toLocaleString()}
                            </td>
                            <td className="text-center">
                              {grandTotalQty.toLocaleString()}
                            </td>
                            <td className="text-right font-mono">
                              {formatAmount(grandTotalPay)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                );
              })()
            )}

            {/* Signature Block */}
            <div className="flex justify-between items-end mt-12 pt-4 text-xs">
              <div className="text-center">
                <div className="border-t border-black w-36 pt-1 font-bold">
                  Prepared By
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-36 pt-1 font-bold">
                  Checked By (IE)
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-black w-36 pt-1 font-bold">
                  Approved By
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
