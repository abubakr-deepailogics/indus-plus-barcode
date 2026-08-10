"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, FileText, Scissors, AlertCircle, Info, Database, Barcode } from "lucide-react";
import type { BarcodeStyleData, PageSetupConfig } from "@/features/barcode-generation/types";
import { PageSetupModal } from "@/features/barcode-generation/components/PageSetupModal";
import { PrintableBarcodesArea } from "@/features/barcode-generation/components/PrintableBarcodesArea";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/column-header";

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
  const cutReportColumns = useMemo<ColumnDef<CutDetailRow>[]>(() => [
    {
      accessorKey: "RowId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Row ID" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="font-semibold text-slate-900">{row.original.RowId}</span>,
      size: 60,
    },
    {
      accessorKey: "Sale_Order_No",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sale Order No" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="font-medium">{row.original.Sale_Order_No}</span>,
      size: 110,
    },
    {
      accessorKey: "Customer_Name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" onFilterClick={() => {}} />,
      size: 110,
    },
    {
      accessorKey: "Work_Order",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Work Order" onFilterClick={() => {}} />,
      size: 110,
    },
    {
      accessorKey: "Order_Qty_After_Add",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order Qty" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-right font-semibold">{row.original.Order_Qty_After_Add}</div>,
      size: 90,
    },
    {
      accessorKey: "Inseam",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Inseam" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-center">{row.original.Inseam}</div>,
      size: 70,
    },
    {
      accessorKey: "Size",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Size" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-center font-bold">{row.original.Size}</div>,
      size: 70,
    },
    {
      accessorKey: "Color",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Color" onFilterClick={() => {}} />,
      size: 100,
    },
    {
      accessorKey: "Fabric_Code_Main_Body",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fabric Code" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="text-slate-500">{row.original.Fabric_Code_Main_Body}</span>,
      size: 140,
    },
    {
      accessorKey: "Wash",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Wash" onFilterClick={() => {}} />,
      size: 100,
    },
    {
      accessorKey: "Cut",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cut" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-center font-semibold text-indigo-600">{row.original.Cut}</div>,
      size: 70,
    },
    {
      accessorKey: "Bundle_Id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bundle ID" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-center font-mono">{row.original.Bundle_Id}</div>,
      size: 100,
    },
    {
      accessorKey: "Bundle_Qty",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bundle Qty" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-right font-bold">{row.original.Bundle_Qty}</div>,
      size: 90,
    },
    {
      accessorKey: "Shade",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Shade" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-center font-bold text-indigo-600">{row.original.Shade}</div>,
      size: 70,
    },
    {
      accessorKey: "Shrinkage",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Shrinkage" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-center font-mono">{row.original.Shrinkage}</div>,
      size: 80,
    },
  ], []);

  const styleBulletinColumns = useMemo<ColumnDef<StyleBulletinRow>[]>(() => [
    {
      accessorKey: "RowId",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Row ID" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="font-semibold text-slate-900">{row.original.RowId}</span>,
      size: 60,
    },
    {
      accessorKey: "Sale_order_No",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sale Order No" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="font-medium">{row.original.Sale_order_No}</span>,
      size: 110,
    },
    {
      accessorKey: "Customer_Name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" onFilterClick={() => {}} />,
      size: 110,
    },
    {
      accessorKey: "Order_No",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order No" onFilterClick={() => {}} />,
      size: 110,
    },
    {
      accessorKey: "Operation_Code",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Op Code" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="font-mono text-purple-600">{row.original.Operation_Code}</span>,
      size: 85,
    },
    {
      accessorKey: "Operation_Name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Op Name" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="font-medium text-slate-700">{row.original.Operation_Name}</span>,
      size: 180,
    },
    {
      accessorKey: "Section",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Section" onFilterClick={() => {}} />,
      cell: ({ row }) => <span className="text-slate-500">{row.original.Section}</span>,
      size: 100,
    },
    {
      accessorKey: "Operation_Sequeance",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sequence" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-center font-bold text-slate-700">{row.original.Operation_Sequeance}</div>,
      size: 80,
    },
    {
      accessorKey: "Machine_Type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Machine Type" onFilterClick={() => {}} />,
      size: 110,
    },
    {
      accessorKey: "Piece_Rate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Piece Rate" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-right font-semibold">{row.original.Piece_Rate}</div>,
      size: 90,
    },
    {
      accessorKey: "Smv_Sam",
      header: ({ column }) => <DataTableColumnHeader column={column} title="SMV / SAM" onFilterClick={() => {}} />,
      cell: ({ row }) => <div className="text-right font-semibold text-purple-600">{row.original.Smv_Sam}</div>,
      size: 90,
    },
    {
      accessorKey: "First_Operation_Section_Wise",
      header: ({ column }) => <DataTableColumnHeader column={column} title="First Op (Sec)" onFilterClick={() => {}} />,
      cell: ({ row }) => (
        <div className="text-center">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            row.original.First_Operation_Section_Wise === 1
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-slate-50 text-slate-400"
          }`}>
            {row.original.First_Operation_Section_Wise === 1 ? "Yes" : "No"}
          </span>
        </div>
      ),
      size: 90,
    },
    {
      accessorKey: "Last_Operation_Section_Wise",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Op (Sec)" onFilterClick={() => {}} />,
      cell: ({ row }) => (
        <div className="text-center">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            row.original.Last_Operation_Section_Wise === 1
              ? "bg-amber-50 text-amber-700 border border-amber-100"
              : "bg-slate-50 text-slate-400"
          }`}>
            {row.original.Last_Operation_Section_Wise === 1 ? "Yes" : "No"}
          </span>
        </div>
      ),
      size: 90,
    },
  ], []);

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

  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: { left: 0.166, right: 0.166, top: 0.53, bottom: 0.166 },
    gridFormat: "3x10",
  });

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

  // Build the coupon-printable style data for the searched work order from
  // the already-fetched cut detail (bundles) and style bulletin (operations).
  const activeStyle: BarcodeStyleData | null = useMemo(() => {
    if (!debouncedQuery || cutDetails.length === 0) return null;
    const orderCuts = cutDetails;

    const bundles = orderCuts.map((row) => ({
      id: row.RowId,
      transId: String(row.Cut ?? "0"),
      line: "1",
      bundleNo: String(row.Bundle_Id ?? row.RowId),
      inseam: String(row.Inseam ?? ""),
      size: String(row.Size ?? ""),
      pcs: row.Bundle_Qty ?? 0,
      sel: true,
      code: row.Color ?? "",
    }));

    // Open Order coupons only cover the first 2 operations of the order,
    // not the full routing — matches how this shop tracks the initial cut/
    // bundle handoff. Rework Coupon (separate page) covers all operations.
    const COUPON_OPERATIONS_LIMIT = 2;
    const operations = styleBulletins
      .slice()
      .sort((a, b) => (a.Operation_Sequeance ?? 0) - (b.Operation_Sequeance ?? 0))
      .slice(0, COUPON_OPERATIONS_LIMIT)
      .map((row) => ({
        id: row.RowId,
        section: row.Section ?? "",
        seqNo: String(row.Operation_Sequeance ?? ""),
        opNo: row.Operation_Code ?? "",
        operationName: row.Operation_Name ?? "",
        smv: String(row.Smv_Sam ?? ""),
        rate: String(row.Piece_Rate ?? ""),
        skills: "",
        lastOpSection: row.Last_Operation_Section_Wise === 1,
      }));

    return {
      anlNo: orderCuts[0].Sale_Order_No ?? debouncedQuery,
      customer: orderCuts[0].Customer_Name ?? "",
      // No real style code in this data source — leave blank rather than
      // mislabeling the work order as a style code (see BarcodeCard "St").
      styleCode: "",
      generateBy: "",
      generateDatetime: "",
      totalWash: "",
      generatedCoupons: "",
      balance: "",
      generatedBundle: "",
      notes: "",
      remarks: "",
      reworkQtyMain: "",
      reworkQtyBundle: "",
      subTotal: "",
      total: "",
      operations,
      bundles,
    };
  }, [debouncedQuery, cutDetails, styleBulletins]);

  const handlePrint = () => {
    setShowPageSetupModal(false);
    setTimeout(() => window.print(), 300);
  };

  return (
    <>
    <div className="no-print flex flex-col gap-6 max-w-[1400px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">
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
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm relative z-20">
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
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Header Panel */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm bg-[#fafafa]">
            <div>
              <h3 className="text-sm font-bold text-[#0f172a]">
                {activeTab === "cut_report" ? "Order PO Cut Detail" : "Order Style Bulletin"}
              </h3>
              <p className="text-[10px] text-[#64748b] mt-0.5">
                Showing {activeRecordsCount} records matching Work Order <strong className="text-slate-700">`{debouncedQuery}`</strong>
              </p>
            </div>
            {activeStyle && (
              <button
                onClick={() => setShowPageSetupModal(true)}
                className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Generate Coupons for {debouncedQuery}</span>
              </button>
            )}
          </div>

          {/* DataTable Component */}
          {activeTab === "cut_report" ? (
            <DataTable columns={cutReportColumns} data={cutDetails} />
          ) : (
            <DataTable columns={styleBulletinColumns} data={styleBulletins} />
          )}
        </div>
      )}
    </div>

    {showPageSetupModal && activeStyle && (
      <PageSetupModal
        pageSetup={pageSetup}
        onPageSetupChange={setPageSetup}
        onClose={() => setShowPageSetupModal(false)}
        onPrint={handlePrint}
      />
    )}

    {activeStyle && (
      <PrintableBarcodesArea activeStyle={activeStyle} pageSetup={pageSetup} />
    )}
    </>
  );
}
