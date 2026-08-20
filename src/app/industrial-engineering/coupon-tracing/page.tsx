"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo } from "react";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Autocomplete } from "@/components/ui/autocomplete";
import { PageSetupModal } from "@/features/qr-code-generation/components/PageSetupModal";
import type { PageSetupConfig } from "@/features/qr-code-generation/types";

interface CouponRow {
  Id: number;
  CouponCode: string;
  WorkOrder: string;
  BundleNo: string;
  OpNo: string;
  Section: string | null;
  IsScanned: boolean;
  CreatedAt: string;
  CutNo?: string | null;
  OpName?: string | null;
  EmployeeCode?: string | null;
  EmployeeName?: string | null;
  ScannedAt?: string | null;
}

const COUPON_PAGE_SIZE = 50;
const SCANNED_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Scanned" },
  { value: "false", label: "Not scanned" },
] as const;

export default function CouponTracingPage() {
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Individual coupons for the traced work order — always fetched one page
  // at a time (a work order can have thousands of coupons).
  const [tracedWorkOrder, setTracedWorkOrder] = useState("");
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [couponTotal, setCouponTotal] = useState(0);
  const [couponPage, setCouponPage] = useState(1);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [bundleFilter, setBundleFilter] = useState("");
  const [opFilter, setOpFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [fromCutFilter, setFromCutFilter] = useState("");
  const [toCutFilter, setToCutFilter] = useState("");
  const [sectionOptions, setSectionOptions] = useState<string[]>([]);
  const [scannedFilter, setScannedFilter] = useState<(typeof SCANNED_OPTIONS)[number]["value"]>("");
  const [unscanningCode, setUnscanningCode] = useState("");
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: { left: 0.166, right: 0.166, top: 0.53, bottom: 0.166 },
    gridFormat: "3x10",
    layout: "same-line",
  });

  const fetchWorkOrderSuggestions = async (query: string) => {
    try {
      const response = await fetch(`/api/open-order/suggestions?query=${encodeURIComponent(query)}&only_generated=true`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Suggestions fetch error:", err);
    }
    return [];
  };

  const fetchBundleSuggestions = async (query: string) => {
    if (!tracedWorkOrder) return [];
    try {
      const response = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(tracedWorkOrder)}&type=bundle&query=${encodeURIComponent(query)}&only_generated=true`
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Bundle suggestions fetch error:", err);
    }
    return [];
  };

  const fetchOpSuggestions = async (query: string) => {
    if (!tracedWorkOrder) return [];
    try {
      const response = await fetch(
        `/api/coupons/suggestions?wo=${encodeURIComponent(tracedWorkOrder)}&type=operation&query=${encodeURIComponent(query)}&only_generated=true`
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error("Op suggestions fetch error:", err);
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
        `/api/coupons/suggestions?wo=${encodeURIComponent(workOrder)}&type=section`
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
      });
      if (bundleFilter.trim()) params.set("bundle_no", bundleFilter.trim());
      if (opFilter.trim()) params.set("op_no", opFilter.trim());
      if (sectionFilter) params.set("section", sectionFilter);
      if (scannedFilter) params.set("is_scanned", scannedFilter);
      if (fromCutFilter.trim()) params.set("from_cut", fromCutFilter.trim());
      if (toCutFilter.trim()) params.set("to_cut", toCutFilter.trim());
      const res = await fetch(`/api/qr-code-generation/coupons?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load coupons.");
      setCoupons(data.coupons || []);
      setCouponTotal(data.total || 0);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred.");
      setCoupons([]);
      setCouponTotal(0);
    } finally {
      setCouponsLoading(false);
    }
  };

  const handleTrace = () => {
    const workOrder = code.trim();
    setTracedWorkOrder(workOrder);
    setCouponPage(1);
    setFromCutFilter("");
    setToCutFilter("");
    fetchSectionOptions(workOrder);
    if (workOrder) fetchCoupons(workOrder, 1);
    else {
      setCoupons([]);
      setCouponTotal(0);
    }
  };

  const handleUnscanCoupon = async (couponCode: string) => {
    if (!window.confirm(`Are you sure you want to unscan coupon: ${couponCode}?`)) {
      return;
    }
    setUnscanningCode(couponCode);
    try {
      const response = await fetch("/api/coupons/unscan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to unscan coupon.");
      } else {
        // Refresh current page of coupons
        await fetchCoupons(tracedWorkOrder, couponPage);
      }
    } catch (err) {
      console.error("Unscan error:", err);
      alert("An error occurred while unscanning the coupon.");
    } finally {
      setUnscanningCode("");
    }
  };

  const couponPageCount = Math.max(1, Math.ceil(couponTotal / COUPON_PAGE_SIZE));
  const goToCouponPage = (page: number) => {
    setCouponPage(page);
    fetchCoupons(tracedWorkOrder, page);
  };

  // Same filters as the table, sent straight to the PDF route — no filter
  // means "every coupon for this work order". Server renders and streams
  // the PDF on request; nothing is generated or stored ahead of the click.
  const couponPdfUrl = useMemo(() => {
    if (!tracedWorkOrder) return "";
    const params = new URLSearchParams({ work_order: tracedWorkOrder });
    if (bundleFilter.trim()) params.set("bundle_no", bundleFilter.trim());
    if (opFilter.trim()) params.set("op_no", opFilter.trim());
    if (sectionFilter) params.set("section", sectionFilter);
    if (scannedFilter) params.set("is_scanned", scannedFilter);
    if (fromCutFilter.trim()) params.set("from_cut", fromCutFilter.trim());
    if (toCutFilter.trim()) params.set("to_cut", toCutFilter.trim());
    params.set("layout", pageSetup.layout);
    return `/api/qr-code-generation/coupons/pdf?${params}`;
  }, [tracedWorkOrder, bundleFilter, opFilter, sectionFilter, scannedFilter, fromCutFilter, toCutFilter, pageSetup.layout]);

  // Any filter change re-queries from page 1 — old page N may no longer
  // exist once the row count shrinks.
  useEffect(() => {
    if (!tracedWorkOrder) return;
    setCouponPage(1);
    fetchCoupons(tracedWorkOrder, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleFilter, opFilter, sectionFilter, scannedFilter, fromCutFilter, toCutFilter]);

  return (
    <div className="flex flex-col gap-6 max-w-[900px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">

      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm">
        <div className="flex items-stretch gap-3">
          <Autocomplete<string>
            value={code}
            onChange={setCode}
            onSelect={(val) => {
              setCode(val);
              setTracedWorkOrder(val);
              setCouponPage(1);
              setFromCutFilter("");
              setToCutFilter("");
              fetchSectionOptions(val);
              fetchCoupons(val, 1);
            }}
            fetchSuggestions={fetchWorkOrderSuggestions}
            renderSuggestion={(item) => <span>{item}</span>}
            getSuggestionValue={(item) => item}
            placeholder="Coupon code, bundle ID, or work order"
            className="flex-grow"
            inputClassName="w-full px-3 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            onKeyDown={(e) => e.key === "Enter" && handleTrace()}
          />
          <button
            onClick={handleTrace}
            disabled={!code.trim() || couponsLoading}
            className="flex items-center justify-center gap-2 bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-[#4338ca] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{couponsLoading ? "Searching…" : "Trace"}</span>
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
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
          <div className="border-b border-[#e2e8f0] px-5 py-4 bg-[#fafafa] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f172a]">
              Coupons for {tracedWorkOrder}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-[#64748b]">
                {couponTotal.toLocaleString()} total
              </span>
              <button
                onClick={() => setShowPageSetupModal(true)}
                disabled={couponTotal === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  couponTotal === 0
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-sm"
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Filters — each change re-queries page 1 from the server. */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[#e2e8f0] bg-white">
            <Autocomplete<string>
              value={bundleFilter}
              onChange={setBundleFilter}
              onSelect={setBundleFilter}
              fetchSuggestions={fetchBundleSuggestions}
              renderSuggestion={(item) => <span>{item}</span>}
              getSuggestionValue={(item) => item}
              placeholder="Filter by Bundle No"
              className="w-40"
              inputClassName="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
            <Autocomplete<any>
              value={opFilter}
              onChange={setOpFilter}
              onSelect={(op) => setOpFilter(op.Operation_Code)}
              fetchSuggestions={fetchOpSuggestions}
              renderSuggestion={(op) => (
                <div className="flex flex-col">
                  <span className="text-[#4f46e5] font-bold text-[10px]">{op.Operation_Code}</span>
                  <span className="text-[10px] text-slate-500 truncate">{op.Operation_Name}</span>
                </div>
              )}
              getSuggestionValue={(op) => op.Operation_Code}
              placeholder="Filter by Op No"
              className="w-40"
              inputClassName="w-full px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
            <input
              type="text"
              placeholder="From Cut"
              value={fromCutFilter}
              onChange={(e) => setFromCutFilter(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
            <input
              type="text"
              placeholder="To Cut"
              value={toCutFilter}
              onChange={(e) => setToCutFilter(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            >
              <option value="">All Sections</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={scannedFilter}
              onChange={(e) => setScannedFilter(e.target.value as typeof scannedFilter)}
              className="px-3 py-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            >
              {SCANNED_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Cut No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Bundle No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">Section</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">Operation Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">Emp Code</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">Emp Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">Scanned</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">Scan Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-left">Created At</th>
              </tr>
            </thead>
            <tbody>
              {couponsLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[#94a3b8]">
                    Loading…
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[#94a3b8]">
                    No coupons match{bundleFilter || opFilter || sectionFilter || scannedFilter ? " these filters" : " this work order yet"}.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.Id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#f8fafc] transition-colors">
                    <td className="px-4 py-3 text-[#334155] text-center font-bold text-indigo-600">{c.CutNo || "—"}</td>
                    <td className="px-4 py-3 text-[#334155] text-center font-mono">{c.BundleNo}</td>
                    <td className="px-4 py-3 text-[#334155] text-left">{c.Section || "—"}</td>
                    <td className="px-4 py-3 text-[#334155] text-left font-medium">{c.OpName || c.OpNo}</td>
                    <td className="px-4 py-3 text-[#334155] text-left font-mono">{c.EmployeeCode || "—"}</td>
                    <td className="px-4 py-3 text-[#334155] text-left font-medium">{c.EmployeeName || "—"}</td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.IsScanned
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {c.IsScanned ? "Scanned" : "Not scanned"}
                        </span>
                        {c.IsScanned && (
                          <button
                            onClick={() => handleUnscanCoupon(c.CouponCode)}
                            disabled={unscanningCode === c.CouponCode}
                            className="text-[#ef4444] hover:text-[#dc2626] font-bold text-[10px] px-2 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-100 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {unscanningCode === c.CouponCode ? "Unscanning..." : "Unscan"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#334155] text-left">
                      {c.ScannedAt ? new Date(c.ScannedAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#334155] text-left">
                      {new Date(c.CreatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {couponTotal > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#e2e8f0] bg-[#fafafa]">
              <span className="text-[11px] font-semibold text-[#64748b]">
                Page {couponPage} of {couponPageCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToCouponPage(couponPage - 1)}
                  disabled={couponPage <= 1 || couponsLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[#475569] font-bold text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Prev
                </button>
                <button
                  onClick={() => goToCouponPage(couponPage + 1)}
                  disabled={couponPage >= couponPageCount || couponsLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#e2e8f0] text-[#475569] font-bold text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showPageSetupModal && (
        <PageSetupModal
          pageSetup={pageSetup}
          onPageSetupChange={setPageSetup}
          onClose={() => setShowPageSetupModal(false)}
          onGeneratePdf={() => {
            window.location.href = couponPdfUrl;
            setShowPageSetupModal(false);
          }}
          generatingPdf={false}
        />
      )}
    </div>
  );
}
