"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef } from "react";
import { Search, FileText, Scissors, AlertCircle, Info, Database } from "lucide-react";

interface CutDetailRow {
  RowId: number;
  Sale_Order_No?: string;
  Customer_Name?: string;
  Work_Order?: string;
  Order_Qty_After_Add?: number;
  Inseam?: number;
  Size?: number;
  Color?: string;
  Fabric_Code_Main_Body?: string;
  Wash?: string;
  Cut?: number;
  Bundle_Id?: number;
  Bundle_Qty?: number;
  Shade?: string;
  Shrinkage?: string;
}

interface StyleBulletinRow {
  RowId: number;
  Sale_order_No?: string;
  Customer_Name?: string;
  Order_No?: string;
  Operation_Code?: string;
  Operation_Name?: string;
  Section?: string;
  Operation_Sequeance?: number;
  Machine_Type?: string;
  Piece_Rate?: number;
  Smv_Sam?: number;
  First_Operation_Section_Wise?: number;
  Last_Operation_Section_Wise?: number;
}

function TableSkeleton({ columnsCount }: { columnsCount: number }) {
  const rows = Array.from({ length: 5 });
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden animate-pulse">
      <div className="border-b border-[#e2e8f0] px-5 py-4 bg-[#fafafa]">
        <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-max">
          <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
            <tr>
              {Array.from({ length: columnsCount }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-3 bg-slate-200 rounded w-16"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {rows.map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columnsCount }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-4">
                    <div className="h-3 bg-slate-100 rounded w-full"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OpenOrderPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"cut_report" | "style_bulletin">("cut_report");
  const [cutDetails, setCutDetails] = useState<CutDetailRow[]>([]);
  const [styleBulletins, setStyleBulletins] = useState<StyleBulletinRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce logic for search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Fetch autocomplete suggestions as user types
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/open-order/suggestions?query=${encodeURIComponent(searchQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data || []);
        }
      } catch (err) {
        console.error("Suggestions fetch error:", err);
      }
    }, 200); // Shorter debounce for suggestion lists

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle click outside suggestions container to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  // Fetch data from API on debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setCutDetails([]);
      setStyleBulletins([]);
      setHasSearched(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setErrorMsg("");
      setHasSearched(true);
      try {
        const response = await fetch(
          `/api/open-order?work_order=${encodeURIComponent(debouncedQuery)}`
        );
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData?.error || "Failed to fetch data from the server.");
        }
        const data = await response.json();
        setCutDetails(data.cutDetails || []);
        setStyleBulletins(data.styleBulletins || []);
      } catch (err: unknown) {
        console.error("Fetch error:", err);
        const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [debouncedQuery]);

  // Handle Tab changes with simulated smooth skeleton transition
  const handleTabChange = (tab: "cut_report" | "style_bulletin") => {
    if (tab === activeTab) return;
    setIsTransitioning(true);
    // Brief transition period to show skeleton loader
    setTimeout(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
    }, 450);
  };

  const activeRecordsCount = activeTab === "cut_report" ? cutDetails.length : styleBulletins.length;
  const isSkeletonActive = isLoading || isTransitioning;

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
          <span>Industrial Engineering</span>
          <span className="text-[#94a3b8] font-light">/</span>
          <span className="text-[#4f46e5] font-bold">Open Order</span>
        </div>
      </div>

      {/* Title Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
          Open Order Inquiry
        </h1>
        <p className="text-[11px] text-[#64748b]">
          Inquire and search work orders from the database to view cut details and style bulletins.
        </p>
      </div>

      {/* Search Bar Panel */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm relative z-50">
        <div ref={containerRef} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search Work Order (e.g. W/O-003355)"
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
            {/* Autocomplete Suggestions Dropdown Overlay */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-[#f1f5f9] animate-fade-in">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setDebouncedQuery(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/50 text-slate-700 hover:text-[#4f46e5] font-semibold transition-all text-xs cursor-pointer block"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setDebouncedQuery(searchQuery);
              setShowSuggestions(false);
            }}
            className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer animate-fade-in"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={() => handleTabChange("cut_report")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
            activeTab === "cut_report"
              ? "bg-[#e0e7ff] text-[#4f46e5] border-[#c7d2fe]"
              : "bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8fafc]"
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Cut Report</span>
        </button>
        <button
          onClick={() => handleTabChange("style_bulletin")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
            activeTab === "style_bulletin"
              ? "bg-[#f5f3ff] text-[#7c3aed] border-[#ddd6fe]"
              : "bg-white text-[#475569] border-[#e2e8f0] hover:bg-[#f8fafc]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Style Bulletin</span>
        </button>
      </div>

      {/* Main Results / Table Block */}
      {errorMsg ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-5 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Database Error</h4>
            <p className="mt-1 text-xs text-red-700">{errorMsg}</p>
          </div>
        </div>
      ) : isSkeletonActive ? (
        <TableSkeleton columnsCount={activeTab === "cut_report" ? 15 : 13} />
      ) : !hasSearched ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-sm animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
            <Database className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h3 className="text-sm font-bold text-[#0f172a]">Ready to Search</h3>
            <p className="text-xs text-[#64748b] mt-1">
              Please enter a Work Order number above (for example, <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded font-mono text-[#4f46e5]">W/O-003355</code>) to retrieve details from the database.
            </p>
          </div>
        </div>
      ) : activeRecordsCount === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-sm animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
            <Info className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h3 className="text-sm font-bold text-[#0f172a]">No Records Found</h3>
            <p className="text-xs text-[#64748b] mt-1">
              We couldn&apos;t find any records for work order <strong className="text-slate-800">`{debouncedQuery}`</strong> in the {activeTab === "cut_report" ? "Cut Detail" : "Style Bulletin"} table.
            </p>
            {activeTab === "cut_report" && styleBulletins.length > 0 && (
              <p className="text-[11px] text-[#4f46e5] mt-3 font-semibold cursor-pointer" onClick={() => handleTabChange("style_bulletin")}>
                Tip: Data was found in the Style Bulletin tab. Click &quot;Style Bulletin&quot; above to view.
              </p>
            )}
            {activeTab === "style_bulletin" && cutDetails.length > 0 && (
              <p className="text-[11px] text-[#7c3aed] mt-3 font-semibold cursor-pointer" onClick={() => handleTabChange("cut_report")}>
                Tip: Data was found in the Cut Report tab. Click &quot;Cut Report&quot; above to view.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden animate-fade-in">
          <div className="border-b border-[#e2e8f0] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#fafafa]">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">
                {activeTab === "cut_report" ? "Order PO Cut Detail" : "Order Style Bulletin"}
              </h3>
              <p className="text-[10px] text-[#64748b] mt-0.5">
                Showing {activeRecordsCount} records matching Work Order <strong className="text-slate-700">`{debouncedQuery}`</strong>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <tr>
                  {activeTab === "cut_report" ? (
                    <>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Row ID</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Sale Order No</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Work Order</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-right">Order Qty</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Inseam</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Size</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Color</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Fabric Code</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Wash</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Cut</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Bundle ID</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-right">Bundle Qty</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Shade</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Shrinkage</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Row ID</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Sale Order No</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Order No</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Op Code</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Op Name</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Section</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Sequence</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Machine Type</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-right">Piece Rate</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-right">SMV / SAM</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">First Op (Sec)</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Last Op (Sec)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {activeTab === "cut_report"
                  ? cutDetails.map((row) => (
                      <tr key={row.RowId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.RowId}</td>
                        <td className="px-4 py-3 font-medium">{row.Sale_Order_No}</td>
                        <td className="px-4 py-3">{row.Customer_Name}</td>
                        <td className="px-4 py-3">{row.Work_Order}</td>
                        <td className="px-4 py-3 text-right font-semibold">{row.Order_Qty_After_Add}</td>
                        <td className="px-4 py-3 text-center">{row.Inseam}</td>
                        <td className="px-4 py-3 text-center font-bold">{row.Size}</td>
                        <td className="px-4 py-3">{row.Color}</td>
                        <td className="px-4 py-3 text-slate-500">{row.Fabric_Code_Main_Body}</td>
                        <td className="px-4 py-3">{row.Wash}</td>
                        <td className="px-4 py-3 text-center font-semibold text-indigo-600">{row.Cut}</td>
                        <td className="px-4 py-3 text-center font-mono">{row.Bundle_Id}</td>
                        <td className="px-4 py-3 text-right font-bold">{row.Bundle_Qty}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600">{row.Shade}</td>
                        <td className="px-4 py-3 text-center font-mono">{row.Shrinkage}</td>
                      </tr>
                    ))
                  : styleBulletins.map((row) => (
                      <tr key={row.RowId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.RowId}</td>
                        <td className="px-4 py-3 font-medium">{row.Sale_order_No}</td>
                        <td className="px-4 py-3">{row.Customer_Name}</td>
                        <td className="px-4 py-3">{row.Order_No}</td>
                        <td className="px-4 py-3 font-mono text-purple-600">{row.Operation_Code}</td>
                        <td className="px-4 py-3 font-medium text-slate-700">{row.Operation_Name}</td>
                        <td className="px-4 py-3 text-slate-500">{row.Section}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700">{row.Operation_Sequeance}</td>
                        <td className="px-4 py-3">{row.Machine_Type}</td>
                        <td className="px-4 py-3 text-right font-semibold">{row.Piece_Rate}</td>
                        <td className="px-4 py-3 text-right font-semibold text-purple-600">{row.Smv_Sam}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.First_Operation_Section_Wise === 1
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-slate-50 text-slate-400"
                          }`}>
                            {row.First_Operation_Section_Wise === 1 ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.Last_Operation_Section_Wise === 1
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : "bg-slate-50 text-slate-400"
                          }`}>
                            {row.Last_Operation_Section_Wise === 1 ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
