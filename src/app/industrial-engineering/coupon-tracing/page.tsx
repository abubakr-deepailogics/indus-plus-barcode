"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  Eraser,
  SlidersHorizontal,
} from "lucide-react";
import { format } from "date-fns";
import { printPdf } from "@/lib/print";
import { Autocomplete } from "@/components/ui/autocomplete";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import { downloadCsv } from "@/lib/csv-export";
import { fetchWorkerSuggestions } from "@/features/coupon-scanning/services/coupon-scanning.service";
import type { Worker } from "@/features/coupon-scanning/types";
import {
  WorkOrderSearchModal,
  type WorkOrderSearchRow,
} from "@/components/work-order-search-modal";
import { PageSetupModal } from "@/features/qr-code-generation/components/PageSetupModal";
import { CodeTypeSelectionModal } from "@/features/qr-code-generation/components/CodeTypeSelectionModal";
import {
  UnscanOrDeleteCouponModal,
  type CouponActionFilters,
} from "@/features/qr-code-generation/components/UnscanOrDeleteCouponModal";
import type { PageSetupConfig } from "@/features/qr-code-generation/types";
import { DEFAULT_MARGINS } from "@/features/qr-code-generation/types";
import { useWorkOrderParam } from "@/lib/use-work-order-param";
import { useAuth } from "@/features/auth/context/auth-context";
import { RequirePermission } from "@/features/auth/components/RequirePermission";
import { ModulePageHeader } from "@/components/ModulePageHeader";
import { useDepartment } from "@/lib/department-context";

interface CouponRow {
  Id: string | null;
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  Section: string | null;
  IsScanned: boolean;
  InsertedAt: string;
  CutNo?: string | null;
  OpName?: string | null;
  EmployeeCode?: string | null;
  EmployeeName?: string | null;
  ScanBy?: string | null;
  ScannedAt?: string | null;
  SystemScannedAt?: string | null;
}

interface OperationSuggestion {
  Operation_Code: string;
  Operation_Name: string | null;
}

const COUPON_PAGE_SIZE = 50;
const SCANNED_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Scanned" },
  { value: "false", label: "Not scanned" },
] as const;

export default function CouponTracingPage() {
  const { department } = useDepartment();
  const [errorMsg, setErrorMsg] = useState("");
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);

  // Individual coupons for the traced work order — always fetched one page
  // at a time (a work order can have thousands of coupons).
  const [tracedWorkOrder, setTracedWorkOrder] = useState("");
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [couponTotal, setCouponTotal] = useState(0);
  const [couponPage, setCouponPage] = useState(1);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [fromBundleFilter, setFromBundleFilter] = useState("");
  const [toBundleFilter, setToBundleFilter] = useState("");
  const [opFilter, setOpFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [fromCutFilter, setFromCutFilter] = useState("");
  const [toCutFilter, setToCutFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [employeeFilterName, setEmployeeFilterName] = useState("");
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
  const [scannedFilter, setScannedFilter] =
    useState<(typeof SCANNED_OPTIONS)[number]["value"]>("");
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [showCodeTypeModal, setShowCodeTypeModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // Draft copy of the filter fields, edited while the modal is open — the
  // real (applied) filters above only change when "Apply Filters" is
  // clicked, so typing/picking in the modal never re-queries the table.
  const [draftFilter, setDraftFilter] = useState({
    fromBundle: "",
    toBundle: "",
    opNo: "",
    section: "",
    scanned: "" as (typeof SCANNED_OPTIONS)[number]["value"],
    fromCut: "",
    toCut: "",
    employeeCode: "",
    employeeName: "",
  });
  const [selectedCoupons, setSelectedCoupons] = useState<Set<string>>(
    new Set(),
  );
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { user, can } = useAuth();
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: DEFAULT_MARGINS,
    gridFormat: "3x10",
    layout: "same-line",
    codeType: "qr",
  });

  const fetchWorkOrderRows = useCallback(
    async (filters: {
      workOrder: string;
      customer: string;
      saleOrderNo: string;
    }): Promise<WorkOrderSearchRow[]> => {
      const params = new URLSearchParams();
      if (filters.workOrder) params.set("work_order", filters.workOrder);
      if (filters.customer) params.set("customer", filters.customer);
      if (filters.saleOrderNo) params.set("sale_order_no", filters.saleOrderNo);
      params.set("department", department);
      const res = await fetch(`/api/coupons/work-orders?${params.toString()}`);
      return res.ok ? res.json() : [];
    },
    [department],
  );

  const fetchOpSuggestions = async (
    query: string,
  ): Promise<OperationSuggestion[]> => {
    if (!tracedWorkOrder) return [];
    try {
      const response = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(tracedWorkOrder)}&type=operation&query=${encodeURIComponent(query)}&only_generated=true&department=${encodeURIComponent(department)}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Op suggestions fetch error:", err);
    }
    return [];
  };

  const fetchBundleSuggestions = async (query: string): Promise<string[]> => {
    if (!tracedWorkOrder) return [];
    try {
      const response = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(tracedWorkOrder)}&type=bundle&query=${encodeURIComponent(query)}&only_generated=true&department=${encodeURIComponent(department)}`,
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Bundle suggestions fetch error:", err);
    }
    return [];
  };

  const fetchSectionOptions = async (workOrder: string) => {
    if (!workOrder) {
      setSectionOptions([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=section&department=${encodeURIComponent(department)}`,
      );
      setSectionOptions(response.ok ? await response.json() : []);
    } catch (err) {
      console.error("Section suggestions fetch error:", err);
      setSectionOptions([]);
    }
  };

  const fetchCoupons = async (workOrder: string, page: number) => {
    setCouponsLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams({
        work_order: workOrder,
        page: String(page),
        page_size: String(COUPON_PAGE_SIZE),
        department,
      });
      if (fromBundleFilter.trim())
        params.set("from_bundle", fromBundleFilter.trim());
      if (toBundleFilter.trim()) params.set("to_bundle", toBundleFilter.trim());
      if (opFilter.trim()) params.set("op_no", opFilter.trim());
      if (sectionFilter) params.set("section", sectionFilter);
      if (scannedFilter) params.set("is_scanned", scannedFilter);
      if (fromCutFilter.trim()) params.set("from_cut", fromCutFilter.trim());
      if (toCutFilter.trim()) params.set("to_cut", toCutFilter.trim());
      if (employeeFilter.trim())
        params.set("employee_code", employeeFilter.trim());
      const res = await fetch(`/api/qr-code-generation/coupons?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load coupons.");
      setCoupons(data.coupons || []);
      setCouponTotal(data.total || 0);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
      setCoupons([]);
      setCouponTotal(0);
    } finally {
      setCouponsLoading(false);
    }
  };

  const runTrace = (workOrder: string) => {
    setTracedWorkOrder(workOrder);
    setCouponPage(1);
    setFromCutFilter("");
    setToCutFilter("");
    setFromBundleFilter("");
    setToBundleFilter("");
    setEmployeeFilter("");
    setEmployeeFilterName("");
    setSelectedCoupons(new Set());
    fetchSectionOptions(workOrder);
    if (workOrder) fetchCoupons(workOrder, 1);
    else {
      setCoupons([]);
      setCouponTotal(0);
    }
  };

  // Shared Work Order search: seeds this page's trace from the global/URL
  // Work Order (set by Cut Report, Style Bulletin or Coupon Generation) on
  // mount, and propagates a trace committed here to the other pages.
  const { setWorkOrder } = useWorkOrderParam((wo) => {
    runTrace(wo);
  });

  const commitTrace = (workOrder: string) => {
    runTrace(workOrder);
    setWorkOrder(workOrder);
  };

  const toggleCouponSelection = (couponCode: string) => {
    setSelectedCoupons((prev) => {
      const next = new Set(prev);
      if (next.has(couponCode)) next.delete(couponCode);
      else next.add(couponCode);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const selectableCodes = coupons.map((c) => c.CouponCode);
    const allSelected = selectableCodes.every((code) =>
      selectedCoupons.has(code),
    );
    setSelectedCoupons((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        selectableCodes.forEach((code) => next.delete(code));
      } else {
        selectableCodes.forEach((code) => next.add(code));
      }
      return next;
    });
  };

  // Reads one of the unscan/delete routes' newline-delimited JSON progress
  // stream — same protocol as the coupon-generation route
  // (useQrCodeGenerationFacade's confirmGenerateCoupons): each line is
  // either a {done,total} progress tick, a final {status:"complete", ...}
  // carrying the route's result fields, or a {status:"error"} carrying a
  // message. onProgress fires per tick so the modal can show a live bar
  // instead of a single frozen spinner for a large batch.
  const readCouponActionStream = async (
    response: Response,
    onProgress: (done: number, total: number) => void,
  ): Promise<Record<string, unknown>> => {
    if (!response.body) throw new Error("No response body.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData: Record<string, unknown> | null = null;

    const handleLine = (line: string) => {
      if (!line.trim()) return;
      const parsed = JSON.parse(line);
      if (parsed.status === "error") {
        throw new Error(parsed.message || "Failed to process coupon(s).");
      }
      if (parsed.status === "complete") finalData = parsed;
      onProgress(parsed.done, parsed.total);
    };

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);

    if (!finalData) throw new Error("Failed to process coupon(s).");
    return finalData;
  };

  // Looks up coupons by the active tracing filters and lets the modal run
  // the matching unscan/delete action without asking for a second review.
  // Unscan and delete are separate routes/requests now (see
  // src/app/api/coupons/unscan-or-delete/{unscan,delete}/route.ts); the
  // modal decides which to call based on the current match's scanned/
  // unscanned split, and — when both apply — calls delete first so it only
  // ever touches coupons that were already unscanned before this action,
  // never ones this same action just unscanned.
  const submitUnscanCoupons = async (
    fields: CouponActionFilters,
    onProgress: (done: number, total: number) => void,
  ): Promise<{ unscannedCount: number }> => {
    const actedBy = user?.email || "";
    const response = await fetch("/api/coupons/unscan-or-delete/unscan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, actedBy, department }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to unscan coupon(s).");
    }
    const data = await readCouponActionStream(response, onProgress);
    return { unscannedCount: Number(data.unscannedCount) || 0 };
  };

  const submitDeleteCoupons = async (
    fields: CouponActionFilters,
    onProgress: (done: number, total: number) => void,
  ): Promise<{ deletedCount: number }> => {
    const actedBy = user?.email || "";
    const response = await fetch("/api/coupons/unscan-or-delete/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, actedBy, department }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to delete coupon(s).");
    }
    const data = await readCouponActionStream(response, onProgress);
    return { deletedCount: Number(data.deletedCount) || 0 };
  };

  // Coupons are always server-paginated (200/page cap), so a CSV export
  // has to walk every page matching the current filters rather than just
  // dumping whatever page is on screen.
  const handleExportCsv = useCallback(async () => {
    if (!tracedWorkOrder || couponTotal === 0) return;

    const pageSize = 200;
    const totalPages = Math.max(1, Math.ceil(couponTotal / pageSize));
    const allCoupons: CouponRow[] = [];

    try {
      for (let page = 1; page <= totalPages; page++) {
        const params = new URLSearchParams({
          work_order: tracedWorkOrder,
          page: String(page),
          page_size: String(pageSize),
          department,
        });
        if (fromBundleFilter.trim())
          params.set("from_bundle", fromBundleFilter.trim());
        if (toBundleFilter.trim())
          params.set("to_bundle", toBundleFilter.trim());
        if (opFilter.trim()) params.set("op_no", opFilter.trim());
        if (sectionFilter) params.set("section", sectionFilter);
        if (scannedFilter) params.set("is_scanned", scannedFilter);
        if (fromCutFilter.trim()) params.set("from_cut", fromCutFilter.trim());
        if (toCutFilter.trim()) params.set("to_cut", toCutFilter.trim());
        if (employeeFilter.trim())
          params.set("employee_code", employeeFilter.trim());
        const res = await fetch(`/api/qr-code-generation/coupons?${params}`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error || "Failed to load coupons for export.");
        allCoupons.push(...(data.coupons || []));
      }

      downloadCsv(
        `coupon-tracing-${tracedWorkOrder}`,
        [
          "Cut No",
          "Bundle No",
          "Section",
          "Operation Name",
          "Emp Code",
          "Emp Name",
          "Scanned",
          "Scan By",
          "Scan Date",
          "Created At",
        ],
        allCoupons.map((c) => [
          c.CutNo || "",
          c.BundleNo,
          c.Section || "",
          c.OpName || c.OpNo,
          c.EmployeeCode || "",
          c.EmployeeName || "",
          c.IsScanned ? "Scanned" : "Not scanned",
          c.ScanBy || "",
          c.ScannedAt ? format(new Date(c.ScannedAt), "dd/MM/yyyy") : "",
          format(new Date(c.InsertedAt), "dd/MM/yyyy"),
        ]),
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to export coupons.",
      );
    }
  }, [
    tracedWorkOrder,
    couponTotal,
    fromBundleFilter,
    toBundleFilter,
    opFilter,
    sectionFilter,
    scannedFilter,
    fromCutFilter,
    toCutFilter,
    employeeFilter,
    department,
  ]);

  const couponPageCount = Math.max(
    1,
    Math.ceil(couponTotal / COUPON_PAGE_SIZE),
  );

  const activeFilterCount = [
    fromBundleFilter.trim(),
    toBundleFilter.trim(),
    opFilter.trim(),
    sectionFilter,
    scannedFilter,
    fromCutFilter.trim(),
    toCutFilter.trim(),
    employeeFilter.trim(),
  ].filter(Boolean).length;

  const couponActionFilters: CouponActionFilters = useMemo(
    () => ({
      workOrder: tracedWorkOrder,
      fromBundle: fromBundleFilter,
      toBundle: toBundleFilter,
      opNo: opFilter,
      section: sectionFilter,
      isScanned: scannedFilter,
      fromCut: fromCutFilter,
      toCut: toCutFilter,
      employeeCode: employeeFilter,
      employeeName: employeeFilterName,
      couponCodes: [...selectedCoupons],
    }),
    [
      tracedWorkOrder,
      fromBundleFilter,
      toBundleFilter,
      opFilter,
      sectionFilter,
      scannedFilter,
      fromCutFilter,
      toCutFilter,
      employeeFilter,
      employeeFilterName,
      selectedCoupons,
    ],
  );

  const openFiltersModal = () => {
    setDraftFilter({
      fromBundle: fromBundleFilter,
      toBundle: toBundleFilter,
      opNo: opFilter,
      section: sectionFilter,
      scanned: scannedFilter,
      fromCut: fromCutFilter,
      toCut: toCutFilter,
      employeeCode: employeeFilter,
      employeeName: employeeFilterName,
    });
    setShowFilters(true);
  };

  const applyDraftFilters = () => {
    setFromBundleFilter(draftFilter.fromBundle);
    setToBundleFilter(draftFilter.toBundle);
    setOpFilter(draftFilter.opNo);
    setSectionFilter(draftFilter.section);
    setScannedFilter(draftFilter.scanned);
    setFromCutFilter(draftFilter.fromCut);
    setToCutFilter(draftFilter.toCut);
    setEmployeeFilter(draftFilter.employeeCode);
    setEmployeeFilterName(draftFilter.employeeName);
    setShowFilters(false);
  };

  const clearDraftFilters = () => {
    setDraftFilter({
      fromBundle: "",
      toBundle: "",
      opNo: "",
      section: "",
      scanned: "",
      fromCut: "",
      toCut: "",
      employeeCode: "",
      employeeName: "",
    });
  };

  const draftFilterCount = [
    draftFilter.fromBundle.trim(),
    draftFilter.toBundle.trim(),
    draftFilter.opNo.trim(),
    draftFilter.section,
    draftFilter.scanned,
    draftFilter.fromCut.trim(),
    draftFilter.toCut.trim(),
    draftFilter.employeeCode.trim(),
  ].filter(Boolean).length;

  const goToCouponPage = (page: number) => {
    setCouponPage(page);
    fetchCoupons(tracedWorkOrder, page);
  };

  // Same filters as the table, sent straight to the PDF route — no filter
  // means "every coupon for this work order". Server renders and streams
  // the PDF on request; nothing is generated or stored ahead of the click.
  const couponPdfUrl = useMemo(() => {
    if (!tracedWorkOrder) return "";
    const params = new URLSearchParams({
      work_order: tracedWorkOrder,
      department,
    });
    if (fromBundleFilter.trim())
      params.set("from_bundle", fromBundleFilter.trim());
    if (toBundleFilter.trim()) params.set("to_bundle", toBundleFilter.trim());
    if (opFilter.trim()) params.set("op_no", opFilter.trim());
    if (sectionFilter) params.set("section", sectionFilter);
    if (scannedFilter) params.set("is_scanned", scannedFilter);
    if (fromCutFilter.trim()) params.set("from_cut", fromCutFilter.trim());
    if (toCutFilter.trim()) params.set("to_cut", toCutFilter.trim());
    if (employeeFilter.trim())
      params.set("employee_code", employeeFilter.trim());
    params.set("layout", pageSetup.layout);
    if (pageSetup.codeType) params.set("code_type", pageSetup.codeType);
    return `/api/qr-code-generation/coupons/pdf?${params}`;
  }, [
    tracedWorkOrder,
    department,
    fromBundleFilter,
    toBundleFilter,
    opFilter,
    sectionFilter,
    scannedFilter,
    fromCutFilter,
    toCutFilter,
    employeeFilter,
    pageSetup.layout,
    pageSetup.codeType,
  ]);

  // Any filter change re-queries from page 1 — old page N may no longer
  // exist once the row count shrinks.
  useEffect(() => {
    if (!tracedWorkOrder) return;
    setCouponPage(1);
    setSelectedCoupons(new Set());
    fetchCoupons(tracedWorkOrder, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fromBundleFilter,
    toBundleFilter,
    opFilter,
    sectionFilter,
    scannedFilter,
    fromCutFilter,
    toCutFilter,
    employeeFilter,
  ]);

  return (
    <RequirePermission pageKey="coupon-tracing">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 text-xs text-slate-700 animate-fade-in pb-16">
        <ModulePageHeader
          eyebrow="Production Records / Lookup"
          title="Coupon Tracing"
          detail="Work-order history, scan status and coupon actions"
          icon={Search}
          accent="indigo"
        />
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-stretch gap-3">
            <button
              type="button"
              onClick={() => setShowWorkOrderModal(true)}
              className="relative flex-grow text-left cursor-pointer"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <span className="block w-full truncate rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs font-semibold text-slate-800 transition-colors hover:border-indigo-500">
                {tracedWorkOrder || "Search Work Order..."}
              </span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Individual coupons generated for the traced work order — server-
          paginated (page/page_size against IX_QrCode_Coupon_WorkOrder) so
          a work order with thousands of coupons never loads them all at
          once. */}
        {tracedWorkOrder && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 md:px-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Coupons for {tracedWorkOrder}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-slate-500">
                  {couponTotal.toLocaleString()} total
                </span>
                <button
                  onClick={() => setShowCodeTypeModal(true)}
                  disabled={couponTotal === 0}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold text-xs transition-all ${
                    couponTotal === 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-slate-900 text-white hover:bg-slate-800 shadow-xs"
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Print
                </button>
                <CsvExportButton
                  onExport={handleExportCsv}
                  disabled={couponTotal === 0}
                />
                <button
                  type="button"
                  onClick={openFiltersModal}
                  title="Show coupon filters"
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs border transition-all ${
                    activeFilterCount > 0
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filter
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                {can("coupon-tracing-unscan", "create") &&
                  can("coupon-tracing", "delete") && (
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      title={
                        selectedCoupons.size > 0
                          ? "Unscan or delete the selected coupons"
                          : "Unscan or delete coupons matching the active filters"
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-all"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      Unscan / Delete
                      {selectedCoupons.size > 0 && (
                        <span className="ml-0.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-black text-white">
                          {selectedCoupons.size}
                        </span>
                      )}
                    </button>
                  )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center w-8">
                      <input
                        type="checkbox"
                        checked={
                          coupons.length > 0 &&
                          coupons.every((c) =>
                            selectedCoupons.has(c.CouponCode),
                          )
                        }
                        onChange={toggleSelectAllOnPage}
                        aria-label="Select all coupons on this page"
                        className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">
                      Cut No
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">
                      Bundle No
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">
                      Section
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">
                      Operation Name
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">
                      Emp Code
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left">
                      Emp Name
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">
                      Scanned
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left w-28 min-w-[100px] max-w-[120px]">
                      Scan By
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">
                      Scan Date
                    </th>
                    <th className="px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {couponsLoading ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-slate-400 font-semibold"
                      >
                        Loading…
                      </td>
                    </tr>
                  ) : coupons.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-6 text-center text-slate-400 font-semibold"
                      >
                        No coupons match
                        {fromBundleFilter ||
                        toBundleFilter ||
                        opFilter ||
                        sectionFilter ||
                        scannedFilter ||
                        employeeFilter
                          ? " these filters"
                          : " this work order yet"}
                        .
                      </td>
                    </tr>
                  ) : (
                    coupons.map((c) => (
                      <tr
                        key={c.CouponCode}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCoupons.has(c.CouponCode)}
                            onChange={() => toggleCouponSelection(c.CouponCode)}
                            aria-label={`Select coupon ${c.CouponCode}`}
                            className="w-3.5 h-3.5 rounded border-slate-300 accent-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-center font-bold text-indigo-700 whitespace-nowrap">
                          {c.CutNo || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-center font-mono whitespace-nowrap">
                          {c.BundleNo}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-left">
                          {c.Section || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-left font-medium">
                          {c.OpName || c.OpNo}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-left font-mono whitespace-nowrap">
                          {c.EmployeeCode || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-left font-medium">
                          {c.EmployeeName || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {c.IsScanned ? (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700"
                              title="Scanned"
                            >
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400"
                              title="Not scanned"
                            >
                              <X className="w-4 h-4 stroke-[2.5]" />
                            </span>
                          )}
                        </td>
                        <td
                          className="px-3 py-2.5 text-slate-800 text-left font-medium w-28 min-w-[100px] max-w-[120px] break-all leading-tight text-[11px]"
                          title={c.ScanBy || undefined}
                        >
                          {c.ScanBy || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-left whitespace-nowrap">
                          {c.ScannedAt
                            ? format(new Date(c.ScannedAt), "dd/MM/yyyy")
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-800 text-left whitespace-nowrap">
                          {format(new Date(c.InsertedAt), "dd/MM/yyyy")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {couponTotal > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                <span className="text-[11px] font-semibold text-slate-500">
                  Page {couponPage} of {couponPageCount}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToCouponPage(couponPage - 1)}
                    disabled={couponPage <= 1 || couponsLoading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prev
                  </button>
                  <button
                    onClick={() => goToCouponPage(couponPage + 1)}
                    disabled={couponPage >= couponPageCount || couponsLoading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showFilters && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-up">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                    <SlidersHorizontal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      Coupon Filters
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      These filters also control Print, Export, and Unscan /
                      Delete.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Active Scope
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-600">
                      {draftFilterCount === 0
                        ? "All coupons for the traced work order"
                        : `${draftFilterCount} filter${
                            draftFilterCount === 1 ? "" : "s"
                          } selected`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearDraftFilters}
                    disabled={draftFilterCount === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#4f46e5] transition-all hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      From Cut
                    </span>
                    <input
                      type="text"
                      placeholder="From Cut"
                      value={draftFilter.fromCut}
                      onChange={(e) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          fromCut: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition-all placeholder-slate-400 focus:border-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      To Cut
                    </span>
                    <input
                      type="text"
                      placeholder="To Cut"
                      value={draftFilter.toCut}
                      onChange={(e) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          toCut: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition-all placeholder-slate-400 focus:border-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      From Bundle
                    </span>
                    <Autocomplete<string>
                      value={draftFilter.fromBundle}
                      onChange={(value) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          fromBundle: value,
                        }))
                      }
                      onSelect={(value) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          fromBundle: value,
                        }))
                      }
                      fetchSuggestions={fetchBundleSuggestions}
                      renderSuggestion={(item) => <span>{item}</span>}
                      getSuggestionValue={(item) => item}
                      minChars={0}
                      placeholder="From Bundle"
                      inputClassName="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition-all placeholder-slate-400 focus:border-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      To Bundle
                    </span>
                    <Autocomplete<string>
                      value={draftFilter.toBundle}
                      onChange={(value) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          toBundle: value,
                        }))
                      }
                      onSelect={(value) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          toBundle: value,
                        }))
                      }
                      fetchSuggestions={fetchBundleSuggestions}
                      renderSuggestion={(item) => <span>{item}</span>}
                      getSuggestionValue={(item) => item}
                      minChars={0}
                      placeholder="To Bundle"
                      inputClassName="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition-all placeholder-slate-400 focus:border-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Section
                    </span>
                    <select
                      value={draftFilter.section}
                      onChange={(e) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          section: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition-all focus:border-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10"
                    >
                      <option value="">All Sections</option>
                      {sectionOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Status
                    </span>
                    <select
                      value={draftFilter.scanned}
                      onChange={(e) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          scanned: e.target.value as typeof scannedFilter,
                        }))
                      }
                      className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition-all focus:border-[#4f46e5] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10"
                    >
                      {SCANNED_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Operation No
                    </span>
                    <Autocomplete<OperationSuggestion>
                      value={draftFilter.opNo}
                      onChange={(value) =>
                        setDraftFilter((prev) => ({ ...prev, opNo: value }))
                      }
                      onSelect={(op) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          opNo: op.Operation_Code,
                        }))
                      }
                      fetchSuggestions={fetchOpSuggestions}
                      renderSuggestion={(op) => (
                        <div className="flex flex-col">
                          <span className="text-[#4f46e5] font-bold text-[10px]">
                            {op.Operation_Code}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {op.Operation_Name}
                          </span>
                        </div>
                      )}
                      getSuggestionValue={(op) => op.Operation_Code}
                      placeholder="Filter by Op No"
                      inputClassName="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all shadow-sm"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Operator
                    </span>
                    <Autocomplete<Worker>
                      value={
                        draftFilter.employeeName || draftFilter.employeeCode
                      }
                      onChange={(value) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          employeeCode: value,
                          employeeName: "",
                        }))
                      }
                      onSelect={(worker) =>
                        setDraftFilter((prev) => ({
                          ...prev,
                          employeeCode: String(worker.EmployeeID),
                          employeeName:
                            worker.FirstName?.trim() ||
                            String(worker.EmployeeID),
                        }))
                      }
                      fetchSuggestions={fetchWorkerSuggestions}
                      renderSuggestion={(worker) => (
                        <div className="flex flex-col">
                          <span className="text-[#4f46e5] font-bold text-[10px]">
                            {worker.EmployeeID}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate">
                            {worker.FirstName}
                          </span>
                        </div>
                      )}
                      getSuggestionValue={(worker) => String(worker.EmployeeID)}
                      placeholder="Search Operator (name or code)"
                      inputClassName="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all shadow-sm"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-[#e2e8f0] bg-white px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyDraftFilters}
                  className="rounded-xl bg-[#4f46e5] px-4 py-2 text-xs font-black text-white shadow-sm transition-all hover:bg-[#4338ca]"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {showPageSetupModal && (
          <PageSetupModal
            pageSetup={pageSetup}
            onPageSetupChange={setPageSetup}
            onClose={() => setShowPageSetupModal(false)}
            onGeneratePdf={() => {
              setShowPageSetupModal(false);
              setGeneratingPdf(true);
              printPdf(couponPdfUrl, () => setGeneratingPdf(false));
            }}
            generatingPdf={generatingPdf}
          />
        )}

        <CodeTypeSelectionModal
          isOpen={showCodeTypeModal}
          onClose={() => setShowCodeTypeModal(false)}
          onSelect={(type) => {
            setPageSetup((prev) => ({ ...prev, codeType: type }));
            setShowCodeTypeModal(false);
            setShowPageSetupModal(true);
          }}
        />

        {showDeleteModal && (
          <UnscanOrDeleteCouponModal
            filters={couponActionFilters}
            department={department}
            submitUnscan={submitUnscanCoupons}
            submitDelete={submitDeleteCoupons}
            onClose={() => setShowDeleteModal(false)}
            onDone={() => {
              setShowDeleteModal(false);
              setSelectedCoupons(new Set());
              fetchCoupons(tracedWorkOrder, couponPage);
            }}
          />
        )}

        <WorkOrderSearchModal
          open={showWorkOrderModal}
          onClose={() => setShowWorkOrderModal(false)}
          onSelect={(row) => {
            commitTrace(row.workOrder);
            setShowWorkOrderModal(false);
          }}
          fetchRows={fetchWorkOrderRows}
        />

        {/* Generating PDF Loader Overlay */}
        {generatingPdf && (
          <div className="fixed inset-0 bg-[#0f172a]/30 backdrop-blur-sm flex flex-col items-center justify-center z-[9999] animate-fade-in no-print">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-[#e2e8f0] flex flex-col items-center max-w-[280px] text-center">
              <Loader2 className="w-8 h-8 text-[#4f46e5] animate-spin mb-3" />
              <h4 className="text-xs font-extrabold text-[#0f172a] uppercase tracking-wider mb-1">
                Generating PDF...
              </h4>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                Preparing coupon sheets. Please wait.
              </p>
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
