"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  FileText,
  Scissors,
  AlertCircle,
  Info,
  Database,
  Paperclip,
  ChevronDown,
} from "lucide-react";
// import type { PageSetupConfig } from "@/features/barcode-generation/types";
// import { PageSetupModal } from "@/features/barcode-generation/components/PageSetupModal";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/column-header";
import { QrCode } from "lucide-react";
import type {
  PageSetupConfig,
  QrCodeStyleData,
} from "@/features/qr-code-generation/types";
import { useGenerateCouponPdf } from "@/features/qr-code-generation/hooks/useGenerateCouponPdf";
import { PageSetupModal } from "@/features/qr-code-generation/components/PageSetupModal";

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
  const [activeTab, setActiveTab] = useState<"cut_report" | "style_bulletin">(
    "cut_report",
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
      {
        accessorKey: "First_Operation_Section_Wise",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="First Op (Sec)"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                row.original.First_Operation_Section_Wise === 1
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : "bg-slate-50 text-slate-400"
              }`}
            >
              {row.original.First_Operation_Section_Wise === 1 ? "Yes" : "No"}
            </span>
          </div>
        ),
        size: 90,
      },
      {
        accessorKey: "Last_Operation_Section_Wise",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Last Op (Sec)"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                row.original.Last_Operation_Section_Wise === 1
                  ? "bg-amber-50 text-amber-700 border border-amber-100"
                  : "bg-slate-50 text-slate-400"
              }`}
            >
              {row.original.Last_Operation_Section_Wise === 1 ? "Yes" : "No"}
            </span>
          </div>
        ),
        size: 90,
      },
      {
        id: "Attachment",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Attachment"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => {
          const rowId = row.original.RowId;
          const attachment = rowAttachments[rowId];

          if (attachment) {
            return (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewFile({
                    ...attachment,
                    rowId,
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] shadow-sm transition-all cursor-pointer truncate max-w-[150px]"
                title={`Click to preview: ${attachment.name}`}
              >
                <Paperclip className="w-3 h-3 text-indigo-500 shrink-0" />
                <span className="truncate">{attachment.name}</span>
              </button>
            );
          }

          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveRowIdForUpload(rowId);
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e2e8f0] rounded-xl bg-white hover:bg-slate-50 hover:text-slate-800 text-slate-600 hover:border-slate-300 font-semibold text-[11px] shadow-sm transition-all cursor-pointer"
            >
              <Paperclip className="w-3 h-3 text-slate-400" />
              <span>Attachment</span>
            </button>
          );
        },
        size: 130,
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
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/open-order/suggestions?query=${encodeURIComponent(searchQuery)}`,
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
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
    } else if (e.key === "Enter") {
      setActiveSearchQuery(searchQuery);
      setShowSuggestions(false);
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
        // Default to every operation selected for coupon generation.
        setSelectedOpRowIds(new Set((data.styleBulletins || []).map((row: StyleBulletinRow) => row.RowId)));

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

  // Handle Tab changes with simulated smooth skeleton transition
  const handleTabChange = (tab: "cut_report" | "style_bulletin") => {
    if (tab === activeTab) return;
    setSelectedDeptFilter("all");
    setIsTransitioning(true);
    // Brief transition period to show skeleton loader
    setTimeout(() => {
      setActiveTab(tab);
      setIsTransitioning(false);
    }, 450);
  };

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
    await downloadPdf();
    setShowPageSetupModal(false);
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
            Inquire and search work orders from the database to view cut details
            and style bulletins.
          </p>
        </div>

        {/* Search Bar Panel */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm relative z-20">
          <div
            ref={containerRef}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
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
                        setActiveSearchQuery(suggestion);
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
                setActiveSearchQuery(searchQuery);
                setShowSuggestions(false);
              }}
              className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer animate-fade-in"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
            </button>
          </div>
        </div>

        {/* Dynamic Metadata Cards Row */}
        {hasSearched && cutDetails.length > 0 && (
          activeTab === "cut_report" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              {/* Card 1: Order Info */}
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Sale Order No</span>
                  <input
                    type="text"
                    readOnly
                    value={cutDetails[0]?.Sale_Order_No || ""}
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Work Order</span>
                  <input
                    type="text"
                    readOnly
                    value={cutDetails[0]?.Work_Order || ""}
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
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
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Order Qty</span>
                  <input
                    type="text"
                    readOnly
                    value={cutDetails[0]?.Order_Qty_After_Add || ""}
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
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
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Wash</span>
                  <input
                    type="text"
                    readOnly
                    value={cutDetails[0]?.Wash || ""}
                    className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
              {/* Left Form Panel: Basic Style Details */}
              <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">W/O # &amp; Customer</label>
                  <input type="text" readOnly value={`${styleBulletinMetadata.amNo} (${styleBulletinMetadata.customer})`} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 font-semibold focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Sale Order No</label>
                  <input type="text" readOnly value={styleBulletinMetadata.styleCode} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 font-semibold focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Order Qty</label>
                  <input type="text" readOnly value={styleBulletinMetadata.planQty} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 focus:outline-none font-semibold" />
                </div>
             <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Fabric Code</label>
                  <input type="text" readOnly value={cutDetails[0]?.Fabric_Code_Main_Body || ""} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 focus:outline-none font-semibold" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Wash</label>
                  <input type="text" readOnly value={cutDetails[0]?.Wash || ""} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 focus:outline-none font-semibold" />
                </div>
              </div>

              {/* Middle Form Panel 1: SMD Details */}
              <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Style Description</label>
                  <input
                    type="text"
                    value={styleDescription}
                    onChange={(e) => setStyleDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Style Category</label>
                  <input
                    type="text"
                    value={styleCategory}
                    onChange={(e) => setStyleCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">SMD #</label>
                  <input
                    type="text"
                    value={smdNo}
                    onChange={(e) => setSmdNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Final SMD #</label>
                  <input
                    type="text"
                    value={finalSmdNo}
                    onChange={(e) => setFinalSmdNo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
              </div>

              {/* Middle Form Panel 2: Targets & Piece Rates */}
              <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Target</label>
                    <input
                      type="text"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Target Unit/Min</label>
                    <input
                      type="text"
                      value={targetUnitMin}
                      onChange={(e) => setTargetUnitMin(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Start Time</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">POC SAM</label>
                  <input
                    type="text"
                    value={pocSam}
                    onChange={(e) => setPocSam(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">POC Piece Rate</label>
                  <input
                    type="text"
                    value={pocPieceRate}
                    onChange={(e) => setPocPieceRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
              </div>

              {/* Right Form Panel: SAM Summary & Approvals */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#64748b] text-[10px] uppercase">Head/Reqd</span>
                    <input
                      type="text"
                      value={headReqd}
                      onChange={(e) => setHeadReqd(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all font-semibold text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#64748b] text-[10px] uppercase">Total SAM</span>
                    <input
                      type="text"
                      readOnly
                      value={totalSam}
                      onChange={(e) => setTotalSam(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 font-semibold focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#64748b] text-[10px] uppercase">Total Rate</span>
                    <input
                      type="text"
                      readOnly
                      value={totalRate}
                      onChange={(e) => setTotalRate(e.target.value)}
                      className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-slate-50 font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-[#475569] text-[10px] uppercase">App Date</label>
                      <input
                        type="text"
                        value={appDate}
                        onChange={(e) => setAppDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all font-semibold text-center"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-bold text-[#475569] text-[10px] uppercase">App By</label>
                      <input
                        type="text"
                        value={appBy}
                        onChange={(e) => setAppBy(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all font-semibold text-center"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-3 mt-1">
                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Status</span>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className={`px-3 py-1.5 rounded-xl font-bold border text-xs focus:outline-none transition-all cursor-pointer ${
                        status === "Approved"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : status === "Pending"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </div>
                  {saveSuccessMsg && (
                    <div className="mt-2 text-[11px] text-center font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg py-1.5 px-3 animate-fade-in">
                      {saveSuccessMsg}
                    </div>
                  )}
                  {saveErrorMsg && (
                    <div className="mt-2 text-[11px] text-center font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg py-1.5 px-3 animate-fade-in">
                      {saveErrorMsg}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={isSaving}
                    className="w-full mt-3 bg-[#4f46e5] hover:bg-[#4338ca] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? (
                      <>
                        <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Bulletin Details</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        )}

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
              <h3 className="text-sm font-bold text-[#0f172a]">
                Ready to Search
              </h3>
              <p className="text-xs text-[#64748b] mt-1">
                Please enter a Work Order number above (for example,{" "}
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
                in the{" "}
                {activeTab === "cut_report" ? "Cut Detail" : "Style Bulletin"}{" "}
                table.
              </p>
              {activeTab === "cut_report" && styleBulletins.length > 0 && (
                <p
                  className="text-[11px] text-[#4f46e5] mt-3 font-semibold cursor-pointer"
                  onClick={() => handleTabChange("style_bulletin")}
                >
                  Tip: Data was found in the Style Bulletin tab. Click
                  &quot;Style Bulletin&quot; above to view.
                </p>
              )}
              {activeTab === "style_bulletin" && cutDetails.length > 0 && (
                <p
                  className="text-[11px] text-[#7c3aed] mt-3 font-semibold cursor-pointer"
                  onClick={() => handleTabChange("cut_report")}
                >
                  Tip: Data was found in the Cut Report tab. Click &quot;Cut
                  Report&quot; above to view.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">
            {/* Header Panel */}
            {activeTab === "style_bulletin" && (
              <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm bg-[#fafafa]">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">
                    Order Style Bulletin
                  </h3>
                  <p className="text-[10px] text-[#64748b] mt-0.5">
                    Showing {activeRecordsCount} records matching Work Order{" "}
                    <strong className="text-slate-700">`{activeSearchQuery}`</strong>
                  </p>
                </div>
                {activeStyle && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGenerateCoupons}
                      disabled={generatingCoupons}
                      className="flex items-center justify-center gap-2 bg-white border border-[#4f46e5] text-[#4f46e5] hover:bg-[#eef2ff] px-4 py-2 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{generatingCoupons ? "Generating…" : "Generate Coupons"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* DataTable Component */}
            {activeTab === "cut_report" ? (
              <DataTable columns={cutReportColumns} data={cutDetails} />
            ) : (
              <DataTable
                columns={styleBulletinColumns}
                data={filteredStyleBulletins}
                toolbarChildren={
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedDeptFilter(selectedDeptFilter === "cutting" ? "all" : "cutting")}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        selectedDeptFilter === "cutting"
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      cutting
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeptFilter(selectedDeptFilter === "washing" ? "all" : "washing")}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        selectedDeptFilter === "washing"
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      washing
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeptFilter(selectedDeptFilter === "sewing" ? "all" : "sewing")}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        selectedDeptFilter === "sewing"
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      sewing
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDeptFilter(selectedDeptFilter === "finishing" ? "all" : "finishing")}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                        selectedDeptFilter === "finishing"
                          ? "bg-purple-50 text-purple-600 border-purple-200"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      finishing
                    </button>

                    {/* Divider vertical bar */}
                    <div className="w-[1px] h-5 bg-[#e2e8f0] mx-1 self-center" />

                    {/* Section Multi-Select Dropdown */}
                    <div ref={sectionRef} className="relative z-30">
                      <button
                        type="button"
                        onClick={() => setSectionDropdownOpen(!sectionDropdownOpen)}
                        className={`flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer min-w-[130px] ${
                          selectedSections.length > 0
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="truncate max-w-[110px]">
                          {selectedSections.length === 0
                            ? "All Sections"
                            : selectedSections.length === 1
                            ? selectedSections[0]
                            : `${selectedSections.length} Sections`}
                        </span>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 shrink-0 ${sectionDropdownOpen ? "rotate-180 text-indigo-500" : "text-slate-400"}`} />
                      </button>
                      
                      {sectionDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-56 bg-white border border-[#e2e8f0] shadow-xl rounded-xl p-2 z-50 max-h-60 overflow-y-auto animate-fade-in flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSections([])}
                            className={`text-left px-2.5 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-colors ${
                              selectedSections.length === 0
                                ? "bg-slate-100 text-slate-800"
                                : "hover:bg-slate-50 text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            All Sections
                          </button>
                          <div className="h-[1px] bg-slate-100 my-1" />
                          {uniqueSections.map(section => {
                            const isChecked = selectedSections.includes(section);
                            return (
                              <label
                                key={section}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-[11px] font-semibold text-slate-600 hover:text-slate-800 transition-colors select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedSections(prev =>
                                      isChecked
                                        ? prev.filter(s => s !== section)
                                        : [...prev, section]
                                    );
                                  }}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="truncate">{section}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Machine Multi-Select Dropdown */}
                    <div ref={machineRef} className="relative z-30">
                      <button
                        type="button"
                        onClick={() => setMachineDropdownOpen(!machineDropdownOpen)}
                        className={`flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer min-w-[130px] ${
                          selectedMachines.length > 0
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="truncate max-w-[110px]">
                          {selectedMachines.length === 0
                            ? "All Machines"
                            : selectedMachines.length === 1
                            ? selectedMachines[0]
                            : `${selectedMachines.length} Machines`}
                        </span>
                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 shrink-0 ${machineDropdownOpen ? "rotate-180 text-indigo-500" : "text-slate-400"}`} />
                      </button>
                      
                      {machineDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-56 bg-white border border-[#e2e8f0] shadow-xl rounded-xl p-2 z-50 max-h-60 overflow-y-auto animate-fade-in flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => setSelectedMachines([])}
                            className={`text-left px-2.5 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-colors ${
                              selectedMachines.length === 0
                                ? "bg-slate-100 text-slate-800"
                                : "hover:bg-slate-50 text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            All Machines
                          </button>
                          <div className="h-[1px] bg-slate-100 my-1" />
                          {uniqueMachines.map(machine => {
                            const isChecked = selectedMachines.includes(machine);
                            return (
                              <label
                                key={machine}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-[11px] font-semibold text-slate-600 hover:text-slate-800 transition-colors select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedMachines(prev =>
                                      isChecked
                                        ? prev.filter(m => m !== machine)
                                        : [...prev, machine]
                                    );
                                  }}
                                  className="w-3.5 h-3.5 rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="truncate">{machine}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                }
              />
            )}
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
    </>
  );
}
