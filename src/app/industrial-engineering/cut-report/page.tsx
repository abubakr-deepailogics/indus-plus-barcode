"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search, AlertCircle,
  Info,
  Database,
  Paperclip,
  Printer
} from "lucide-react";
// import type { PageSetupConfig } from "@/features/barcode-generation/types";
// import { PageSetupModal } from "@/features/barcode-generation/components/PageSetupModal";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/column-header";
import type {
  PageSetupConfig,
  QrCodeStyleData,
} from "@/features/qr-code-generation/types";
import { useGenerateCouponPdf } from "@/features/qr-code-generation/hooks/useGenerateCouponPdf";
import { PageSetupModal } from "@/features/qr-code-generation/components/PageSetupModal";
import { useWorkOrderParam } from "@/lib/use-work-order-param";

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
  Sale_Order_No?: string;
  Customer_Name?: string;
  Order_No?: string;
  Operation_Code?: string;
  Operation_Name?: string;
  Section?: string;
  Operation_Sequence?: number;
  Machine_Type?: string;
  SkillLevel?: string | number;
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
  const cutReportColumns = useMemo<ColumnDef<CutDetailRow>[]>(
    () => [
      {
        accessorKey: "RowId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Row ID"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900">
            {row.original.RowId}
          </span>
        ),
        size: 60,
      },
      {
        accessorKey: "Cut",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Cut"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-semibold text-indigo-600">
            {row.original.Cut}
          </div>
        ),
        size: 70,
      },
       {
        accessorKey: "Bundle_Id",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Bundle ID"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-mono">{row.original.Bundle_Id}</div>
        ),
        size: 100,
      },
      {
        accessorKey: "Bundle_Qty",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Bundle Qty"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-bold">{row.original.Bundle_Qty}</div>
        ),
        size: 90,
      },
      {
        accessorKey: "Inseam",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Inseam"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">{row.original.Inseam}</div>
        ),
        size: 70,
      },
      {
        accessorKey: "Size",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Size"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold">{row.original.Size}</div>
        ),
        size: 70,
      },
      {
        accessorKey: "Color",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Color"
            onFilterClick={() => {}}
          />
        ),
        size: 100,
      },
      {
        accessorKey: "Shade",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Shade"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-indigo-600">
            {row.original.Shade}
          </div>
        ),
        size: 70,
      },
      {
        accessorKey: "Shrinkage",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Shrinkage"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-mono">{row.original.Shrinkage}</div>
        ),
        size: 80,
      },
    ],
    [],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [isWoFocused, setIsWoFocused] = useState(false);
  const activeTab = "cut_report";

  // Shared Work Order search: seeds this page's search from the global/URL
  // Work Order (set by Style Bulletin, Coupon Generation or Coupon Tracing)
  // on mount, and propagates a search committed here to the other pages.
  const { setWorkOrder } = useWorkOrderParam(
    useCallback((wo: string) => {
      setSearchQuery(wo);
      setActiveSearchQuery(wo);
    }, []),
  );
  const commitSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setActiveSearchQuery(value);
      setWorkOrder(value);
    },
    [setWorkOrder],
  );
  const [cutDetails, setCutDetails] = useState<CutDetailRow[]>([]);
  const [styleBulletins, setStyleBulletins] = useState<StyleBulletinRow[]>([]);
  // Operations to include in coupon generation — defaults to "all" (set
  // whenever a fresh style bulletin loads, see the fetch effect below) so
  // existing behavior (generate for every operation) is unchanged unless
  // the user deliberately unchecks some.
  const [selectedOpRowIds, setSelectedOpRowIds] = useState<Set<number>>(new Set());
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<"all" | "cutting" | "washing" | "sewing" | "finishing">("all");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false);
  const [machineDropdownOpen, setMachineDropdownOpen] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);
  const machineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sectionRef.current && !sectionRef.current.contains(event.target as Node)) {
        setSectionDropdownOpen(false);
      }
      if (machineRef.current && !machineRef.current.contains(event.target as Node)) {
        setMachineDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getDepartment = (row: StyleBulletinRow): "cutting" | "washing" | "sewing" | "finishing" => {
    const section = (row.Section || "").toLowerCase();
    const opName = (row.Operation_Name || "").toLowerCase();
    
    if (section.includes("cut") || opName.includes("cut")) return "cutting";
    if (section.includes("wash") || opName.includes("wash")) return "washing";
    
    if (
      section.includes("finish") ||
      section.includes("pack") ||
      section.includes("press") ||
      section.includes("iron") ||
      section.includes("quality") ||
      section.includes("carton") ||
      opName.includes("finish") ||
      opName.includes("pack") ||
      opName.includes("press") ||
      opName.includes("iron") ||
      opName.includes("quality") ||
      opName.includes("carton")
    ) {
      return "finishing";
    }
    
    return "sewing";
  };

  const uniqueSections = useMemo(() => {
    const sections = styleBulletins.map((row) => row.Section).filter(Boolean) as string[];
    return Array.from(new Set(sections));
  }, [styleBulletins]);

  const uniqueMachines = useMemo(() => {
    const machines = styleBulletins.map((row) => row.Machine_Type).filter(Boolean) as string[];
    return Array.from(new Set(machines));
  }, [styleBulletins]);

  const filteredStyleBulletins = useMemo(() => {
    let result = styleBulletins;

    if (selectedDeptFilter !== "all") {
      result = result.filter((row) => getDepartment(row) === selectedDeptFilter);
    }

    if (selectedSections.length > 0) {
      result = result.filter((row) => row.Section && selectedSections.includes(row.Section));
    }

    if (selectedMachines.length > 0) {
      result = result.filter((row) => row.Machine_Type && selectedMachines.includes(row.Machine_Type));
    }

    return result;
  }, [styleBulletins, selectedDeptFilter, selectedSections, selectedMachines]);

  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [pageSetup, setPageSetup] = useState<PageSetupConfig>({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: { left: 0.166, right: 0.166, top: 0.53, bottom: 0.166 },
    gridFormat: "3x10",
    layout: "same-line",
  });

  // Dynamic Input States for Style Bulletin Metadata
  const [description, setDescription] = useState("");
  const [styleDescription, setStyleDescription] = useState("");
  const [styleCategory, setStyleCategory] = useState("");
  const [smdNo, setSmdNo] = useState("");
  const [finalSmdNo, setFinalSmdNo] = useState("");
  const [target, setTarget] = useState("");
  const [targetUnitMin, setTargetUnitMin] = useState("");
  const [startTime, setStartTime] = useState("");
  const [pocSam, setPocSam] = useState("");
  const [pocPieceRate, setPocPieceRate] = useState("");
  const [headReqd, setHeadReqd] = useState("");
  const [totalSam, setTotalSam] = useState("");
  const [totalRate, setTotalRate] = useState("");
  const [appDate, setAppDate] = useState("");
  const [appBy, setAppBy] = useState("");
  const [status, setStatus] = useState("Approved");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");

  // State and refs for Style Bulletin attachments
  const [rowAttachments, setRowAttachments] = useState<
    Record<number, { name: string; url: string; type: string }>
  >({});
  const [activeRowIdForUpload, setActiveRowIdForUpload] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url: string;
    type: string;
    rowId: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!previewFile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewFile(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewFile]);

  const styleBulletinColumns = useMemo<ColumnDef<StyleBulletinRow>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={
              filteredStyleBulletins.length > 0 &&
              filteredStyleBulletins.every((row) => selectedOpRowIds.has(row.RowId))
            }
            onChange={(e) => {
              setSelectedOpRowIds((prev) => {
                const next = new Set(prev);
                for (const row of filteredStyleBulletins) {
                  if (e.target.checked) next.add(row.RowId);
                  else next.delete(row.RowId);
                }
                return next;
              });
            }}
            className="w-3.5 h-3.5 rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 focus:ring-offset-0 cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selectedOpRowIds.has(row.original.RowId)}
            onChange={(e) => {
              setSelectedOpRowIds((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(row.original.RowId);
                else next.delete(row.original.RowId);
                return next;
              });
            }}
            className="w-3.5 h-3.5 rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 focus:ring-offset-0 cursor-pointer"
          />
        ),
        size: 40,
      },
      {
        accessorKey: "RowId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Row ID"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900">
            {row.original.RowId}
          </span>
        ),
        footer: () => (
          <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
            Total
          </span>
        ),
        size: 60,
      },
      {
        accessorKey: "Operation_Code",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Op Code"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-purple-600">
            {row.original.Operation_Code}
          </span>
        ),
        size: 85,
      },
      {
        accessorKey: "Operation_Name",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Op Name"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-slate-700">
            {row.original.Operation_Name}
          </span>
        ),
        size: 180,
      },
      {
        accessorKey: "Section",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Section"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <span className="text-slate-500">{row.original.Section}</span>
        ),
        size: 100,
      },
      {
        accessorKey: "Operation_Sequence",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Sequence"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-bold text-slate-700">
            {row.original.Operation_Sequence}
          </div>
        ),
        size: 80,
      },
      {
        accessorKey: "Machine_Type",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Machine Type"
            onFilterClick={() => {}}
          />
        ),
        size: 110,
      },
      {
        accessorKey: "SkillLevel",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Skill Level"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-semibold text-slate-600">
            {row.original.SkillLevel ?? "-"}
          </div>
        ),
        size: 90,
      },
      {
        accessorKey: "Piece_Rate",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Piece Rate"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold">
            {row.original.Piece_Rate}
          </div>
        ),
        footer: ({ table }) => {
          const total = table.getFilteredRowModel().rows.reduce((sum, row) => {
            const val = row.original.Piece_Rate;
            return sum + (val ?? 0);
          }, 0);
          return <div className="text-right font-bold text-slate-700">{total.toFixed(4)}</div>;
        },
        size: 90,
      },
      {
        accessorKey: "Smv_Sam",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="SMV / SAM"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-right font-semibold text-purple-600">
            {row.original.Smv_Sam}
          </div>
        ),
        footer: ({ table }) => {
          const total = table.getFilteredRowModel().rows.reduce((sum, row) => {
            const val = row.original.Smv_Sam;
            return sum + (val ?? 0);
          }, 0);
          return <div className="text-right font-bold text-purple-600">{total.toFixed(2)}</div>;
        },
        size: 90,
      },

    ],
    [rowAttachments, selectedOpRowIds, filteredStyleBulletins],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeRowIdForUpload !== null) {
      const url = URL.createObjectURL(file);
      setRowAttachments((prev) => ({
        ...prev,
        [activeRowIdForUpload]: {
          name: file.name,
          url: url,
          type: file.type,
        },
      }));
      if (previewFile && previewFile.rowId === activeRowIdForUpload) {
        setPreviewFile({
          name: file.name,
          url: url,
          type: file.type,
          rowId: activeRowIdForUpload,
        });
      }
    }
    e.target.value = "";
    setActiveRowIdForUpload(null);
  };

  const handleSaveMetadata = async () => {
    const workOrder = cutDetails[0]?.Work_Order || activeSearchQuery;
    if (!workOrder) {
      setSaveErrorMsg("No active Work Order to save.");
      return;
    }
    
    setIsSaving(true);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
    
    try {
      const response = await fetch("/api/open-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workOrder,
          description,
          styleDescription,
          styleCategory,
          smdNo,
          finalSmdNo,
          target,
          targetUnitMin,
          startTime,
          pocSam,
          pocPieceRate,
          headReqd,
          appDate,
          appBy,
          status,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save bulletin details.");
      }
      
      setSaveSuccessMsg("Bulletin details saved successfully.");
      setTimeout(() => setSaveSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveErrorMsg(err.message || "Failed to save details.");
      setTimeout(() => setSaveErrorMsg(""), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch autocomplete suggestions as user types
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/open-order/suggestions?query=${encodeURIComponent(searchQuery)}`,
        );
        setSuggestions(response.ok ? (await response.json()) || [] : []);
      } catch (err) {
        console.error("Suggestions fetch error:", err);
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 200); // Shorter debounce for suggestion lists

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Handle click outside suggestions container to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setIsWoFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [suggestions]);

  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const activeElement = dropdownRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          const selected = suggestions[activeIndex];
          commitSearch(selected);
          setShowSuggestions(false);
          setIsWoFocused(false);
          setActiveIndex(-1);
          return;
        }
      }
    }

    if (e.key === "Escape") {
      setShowSuggestions(false);
      setIsWoFocused(false);
      setActiveIndex(-1);
    } else if (e.key === "Enter") {
      const trimmed = searchQuery.trim();
      // Autocomplete-only: free text that doesn't match a real Work Order
      // must not trigger a search (an empty field is still allowed through,
      // to let the user clear the current results).
      const match = trimmed
        ? suggestions.find((s) => s.toLowerCase() === trimmed.toLowerCase())
        : "";
      if (trimmed && !match) {
        return;
      }
      const nextQuery = match || trimmed;
      commitSearch(nextQuery);
      setShowSuggestions(false);
      setIsWoFocused(false);
      setActiveIndex(-1);
    }
  };

  // Fetch data from API only when the active (committed) search query
  // changes — typing alone must not refetch/replace the table.
  useEffect(() => {
    setSelectedDeptFilter("all");
    setSelectedSections([]);
    setSelectedMachines([]);
    setSelectedOpRowIds(new Set());

    // Clear/reset all input fields when activeSearchQuery changes or is empty
    setDescription("");
    setStyleDescription("");
    setStyleCategory("");
    setSmdNo("");
    setFinalSmdNo("");
    setTarget("");
    setTargetUnitMin("");
    setStartTime("");
    setPocSam("");
    setPocPieceRate("");
    setHeadReqd("");
    setTotalSam("");
    setTotalRate("");
    setAppDate("");
    setAppBy("");
    setStatus("Approved");
    setRowAttachments({});
    setPreviewFile(null);

    if (!activeSearchQuery) {
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
          `/api/open-order?work_order=${encodeURIComponent(activeSearchQuery)}&t=${Date.now()}`,
        );
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(
            errData?.error || "Failed to fetch data from the server.",
          );
        }
        const data = await response.json();
        setCutDetails(data.cutDetails || []);
        setStyleBulletins(data.styleBulletins || []);
        // Do not pre-select any operations.
        setSelectedOpRowIds(new Set());

        // Compute and set totalSam & totalRate
        const computedSam = (data.styleBulletins || []).reduce((acc: number, curr: any) => acc + (curr.Smv_Sam ?? 0), 0);
        const computedRate = (data.styleBulletins || []).reduce((acc: number, curr: any) => acc + (curr.Piece_Rate ?? 0), 0);
        setTotalSam(computedSam.toFixed(2));
        setTotalRate(computedRate.toFixed(4));

        if (data.metadata) {
          setDescription(data.metadata.Description || "");
          setStyleDescription(data.metadata.Style_Description || "");
          setStyleCategory(data.metadata.Style_Category || "");
          setSmdNo(data.metadata.Smd_No || "");
          setFinalSmdNo(data.metadata.Final_Smd_No || "");
          setTarget(data.metadata.Target || "");
          setTargetUnitMin(data.metadata.Target_Unit_Min || "");
          setStartTime(data.metadata.Start_Time || "");
          setPocSam(data.metadata.Poc_Sam || "");
          setPocPieceRate(data.metadata.Poc_Piece_Rate || "");
          setHeadReqd(data.metadata.Head_Reqd || "");
          setAppDate(data.metadata.App_Date || "");
          setAppBy(data.metadata.App_By || "");
          setStatus(data.metadata.Status || "Approved");
        }
      } catch (err: unknown) {
        console.error("Fetch error:", err);
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setErrorMsg(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeSearchQuery]);



  const activeRecordsCount =
    activeTab === "cut_report" ? cutDetails.length : styleBulletins.length;

  // Dynamically derive style bulletin metadata from fetched style bulletins and cut details
  const styleBulletinMetadata = useMemo(() => {
    const planQty = cutDetails[0]?.Order_Qty_After_Add ?? cutDetails.reduce((acc, curr) => acc + (curr.Bundle_Qty ?? 0), 0);

    return {
      amNo: cutDetails[0]?.Work_Order || activeSearchQuery || "",
      customer: cutDetails[0]?.Customer_Name || "",
      styleCode: styleBulletins[0]?.Sale_Order_No || "",
      planQty: String(planQty || ""),
      totalOperations: styleBulletins.length,
    };
  }, [styleBulletins, cutDetails, activeSearchQuery]);

  const isSkeletonActive = isLoading || isTransitioning;

  // Build the coupon-printable style data for the searched work order from
  // the already-fetched cut detail (bundles) and style bulletin (operations).
  const activeStyle: QrCodeStyleData | null = useMemo(() => {
    if (!activeSearchQuery || cutDetails.length === 0) return null;
    const orderCuts = cutDetails;

    const bundles = orderCuts.map((row) => ({
      id: row.RowId,
      cutNo: String(row.Cut ?? "0"),
      line: "1",
      bundleNo: String(row.Bundle_Id ?? row.RowId),
      inseam: String(row.Inseam ?? ""),
      size: String(row.Size ?? ""),
      pcs: row.Bundle_Qty ?? 0,
      sel: true,
      code: row.Color ?? "",
    }));

    const operations = styleBulletins
      .filter((row) => selectedOpRowIds.has(row.RowId))
      .slice()
      .sort(
        (a, b) => (a.Operation_Sequence ?? 0) - (b.Operation_Sequence ?? 0),
      )
      .map((row) => ({
        id: row.RowId,
        section: row.Section ?? "",
        seqNo: String(row.Operation_Sequence ?? ""),
        opNo: row.Operation_Code ?? "",
        operationName: row.Operation_Name ?? "",
        smv: String(row.Smv_Sam ?? ""),
        rate: String(row.Piece_Rate ?? ""),
        skills: "",
        lastOpSection: row.Last_Operation_Section_Wise === 1,
      }));

    return {
      workOrder: orderCuts[0].Work_Order ?? activeSearchQuery,
      saleOrderNo: orderCuts[0].Sale_Order_No ?? "",
      customer: orderCuts[0].Customer_Name ?? "",
      // No real style code in this data source — leave blank rather than
      // mislabeling the work order as a style code (see QrCodeCard "St").
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
  }, [activeSearchQuery, cutDetails, styleBulletins, selectedOpRowIds]);

  const { handleGenerateCoupons, generatingCoupons, handleDownloadPdf: downloadPdf, generatingPdf, couponCount } =
    useGenerateCouponPdf(
      activeStyle ?? { workOrder: "", saleOrderNo: "", styleCode: "", bundles: [], operations: [] },
    );
  const handleGeneratePdf = async () => {
    await downloadPdf(pageSetup.layout);
    setShowPageSetupModal(false);
  };

  return (
    <>
      <div className="no-print flex flex-col gap-6 max-w-[1400px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">

        {/* Dynamic Metadata Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* Card 1: Order Info */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          
            <div className="relative" ref={containerRef}>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Work Order</span>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
                <input
                  type="text"
                  value={isWoFocused ? searchQuery : (cutDetails[0]?.Work_Order || activeSearchQuery || searchQuery)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    setIsWoFocused(true);
                    setShowSuggestions(true);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search W/O..."
                  className="w-full pl-9 pr-3 py-1 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                />
              </div>
              {/* Autocomplete Suggestions Dropdown Overlay */}
              {showSuggestions && searchQuery.trim().length >= 2 && !suggestionsLoading && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-[#f1f5f9] animate-fade-in"
                >
                  {suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-xs font-semibold text-slate-400 text-center">
                      No results found
                    </div>
                  ) : (
                    suggestions.map((suggestion, idx) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          commitSearch(suggestion);
                          setShowSuggestions(false);
                          setIsWoFocused(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-xs font-semibold transition-all cursor-pointer block ${
                          idx === activeIndex
                            ? "bg-indigo-50 text-[#4f46e5]"
                            : "hover:bg-indigo-50/50 text-slate-700 hover:text-[#4f46e5]"
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
              <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Sale Order No</span>
              <input
                type="text"
                readOnly
                value={cutDetails[0]?.Sale_Order_No || ""}
                className="mt-1.5 w-full px-3 py-1 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Card 2: Customer & Qty */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Customer</span>
              <input
                type="text"
                readOnly
                value={cutDetails[0]?.Customer_Name || ""}
                className="mt-1.5 w-full px-3 py-1 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Order Qty</span>
              <input
                type="text"
                readOnly
                value={cutDetails[0]?.Order_Qty_After_Add || ""}
                className="mt-1.5 w-full px-3 py-1 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Card 3: Specifications */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Fabric Code</span>
              <input
                type="text"
                readOnly
                value={cutDetails[0]?.Fabric_Code_Main_Body || ""}
                className="mt-1.5 w-full px-3 py-1 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Wash</span>
              <input
                type="text"
                readOnly
                value={cutDetails[0]?.Wash || ""}
                className="mt-1.5 w-full px-3 py-1 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>
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
          <TableSkeleton columnsCount={15} />
        ) : !hasSearched ? (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-sm animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-[#0f172a]">
                Ready to Search
              </h3>
              <p className="text-xs text-[#64748b] mt-1">
                Please enter a Work Order number in the W/O field above (for example,{" "}
                <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded font-mono text-[#4f46e5]">
                  W/O-003355
                </code>
                ) to retrieve details from the database.
              </p>
            </div>
          </div>
        ) : activeRecordsCount === 0 ? (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-sm animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
              <Info className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-[#0f172a]">
                No Records Found
              </h3>
              <p className="text-xs text-[#64748b] mt-1">
                We couldn&apos;t find any records for work order{" "}
                <strong className="text-slate-800">`{activeSearchQuery}`</strong>{" "}
                in the Cut Detail table.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* DataTable Component */}
            <DataTable
              columns={cutReportColumns}
              data={cutDetails}
              toolbarChildren={
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={cutDetails.length === 0}
                  className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-[#334155] disabled:opacity-50 py-1.5 px-3 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              }
            />
          </div>
        )}
      </div>

      {showPageSetupModal && activeStyle && (
        <PageSetupModal
          pageSetup={pageSetup}
          onPageSetupChange={setPageSetup}
          onClose={() => setShowPageSetupModal(false)}
          onGeneratePdf={handleGeneratePdf}
          generatingPdf={generatingPdf}
        />
      )}

      {/* Hidden file input for Attachment upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/*,application/pdf"
      />

      {/* Attachment Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4 bg-[#fafafa]">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[#4f46e5]" />
                <h3 className="font-bold text-slate-800 text-sm truncate max-w-sm sm:max-w-md">
                  {previewFile.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="text-slate-400 hover:text-slate-600 font-bold transition-all text-sm cursor-pointer p-1.5 hover:bg-slate-100 rounded-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Preview Content */}
            <div className="flex-grow p-6 overflow-y-auto flex items-center justify-center bg-slate-50 min-h-[300px]">
              {previewFile.type.startsWith("image/") ? (
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-sm"
                />
              ) : previewFile.type.startsWith("video/") ? (
                <video
                  src={previewFile.url}
                  controls
                  className="max-w-full max-h-[50vh] rounded-lg shadow-sm animate-fade-in"
                />
              ) : previewFile.type === "application/pdf" ? (
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="w-full h-[50vh] rounded-lg border border-[#e2e8f0]"
                />
              ) : (
                <div className="text-center p-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                    <Paperclip className="w-6 h-6 text-indigo-600" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">
                    No preview available for this file type
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {previewFile.type || "Unknown file type"}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="border-t border-[#e2e8f0] px-5 py-4 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                onClick={() => {
                  setRowAttachments((prev) => {
                    const next = { ...prev };
                    delete next[previewFile.rowId];
                    return next;
                  });
                  setPreviewFile(null);
                }}
                className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold text-xs transition-all cursor-pointer text-center"
              >
                Remove Attachment
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveRowIdForUpload(previewFile.rowId);
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 border border-[#e2e8f0] text-slate-700 hover:bg-[#f8fafc] rounded-xl font-bold text-xs transition-all cursor-pointer text-center"
                >
                  Replace File
                </button>
                <a
                  href={previewFile.url}
                  download={previewFile.name}
                  className="px-4 py-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl font-bold text-xs transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print styles */}
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
            margin-bottom: 5px;
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

      {/* PRINT ONLY PREVIEW CONTAINER */}
      <div className="print-only print-container">
        <h2 className="text-center font-extrabold text-sm uppercase tracking-wide mb-3 border-b-2 border-black pb-2">
          Cut Report Preview for Indus Plus Pvt Limited
        </h2>
        
        <table className="print-header-table">
          <tbody>
            <tr>
              <td style={{ width: "35%" }}>
                <div className="flex flex-col gap-1">
                  <div><strong>WORK ORDER:</strong> {cutDetails[0]?.Work_Order || activeSearchQuery || ""}</div>
                  <div><strong>SALE ORDER NO:</strong> {cutDetails[0]?.Sale_Order_No || ""}</div>
                </div>
              </td>
              <td style={{ width: "30%" }}>
                <div className="flex flex-col gap-1">
                  <div><strong>CUSTOMER:</strong> {cutDetails[0]?.Customer_Name || ""}</div>
                  <div><strong>ORDER QTY:</strong> {cutDetails[0]?.Order_Qty_After_Add || ""}</div>
                </div>
              </td>
              <td style={{ width: "35%" }}>
                <div className="flex flex-col gap-1">
                  <div><strong>FABRIC CODE:</strong> {cutDetails[0]?.Fabric_Code_Main_Body || ""}</div>
                  <div><strong>WASH:</strong> {cutDetails[0]?.Wash || ""}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="print-ops-table">
          <thead>
            <tr>
              <th className="text-center w-12">ROW ID</th>
              <th className="text-center w-12">CUT</th>
              <th>BUNDLE ID</th>
              <th className="text-right w-20">BUNDLE QTY</th>
              <th className="text-center w-16">INSEAM</th>
              <th className="text-center w-16">SIZE</th>
              <th>COLOR</th>
              <th className="text-center w-16">SHADE</th>
              <th className="text-center w-20">SHRINKAGE</th>
            </tr>
          </thead>
          <tbody>
            {cutDetails.map((row) => (
              <tr key={row.RowId}>
                <td className="text-center">{row.RowId}</td>
                <td className="text-center">{row.Cut}</td>
                <td className="font-mono">{row.Bundle_Id}</td>
                <td className="text-right font-bold">{row.Bundle_Qty}</td>
                <td className="text-center">{row.Inseam ?? "NULL"}</td>
                <td className="text-center font-bold">{row.Size}</td>
                <td>{row.Color}</td>
                <td className="text-center font-bold">{row.Shade}</td>
                <td className="text-center font-mono">{row.Shrinkage}</td>
              </tr>
            ))}
            <tr className="print-totals-row">
              <td colSpan={3} className="text-right uppercase">Total Qty</td>
              <td className="text-right">
                {cutDetails.reduce((sum, row) => sum + (row.Bundle_Qty ?? 0), 0)}
              </td>
              <td colSpan={5}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
