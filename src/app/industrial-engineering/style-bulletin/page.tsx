"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  AlertCircle,
  Info,
  Database,
  Paperclip,
  Plus,
  FileText,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/features/auth/context/auth-context";
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

interface StyleBulletinAttachment {
  Id: number;
  WorkOrder: string;
  FileName: string;
  ContentType: string;
  CreatedAt: string;
  CreatedBy: string | null;
}

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
  Bi_Hourly_Tgt?: number;
  Shift_Tgt?: number;
  No_Of_Operations?: number;
  DL?: number;
  No_Mc?: number;
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

  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [isWoFocused, setIsWoFocused] = useState(false);
  const activeTab = "style_bulletin";
  const [cutDetails, setCutDetails] = useState<CutDetailRow[]>([]);
  const [styleBulletins, setStyleBulletins] = useState<StyleBulletinRow[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<"all" | "cutting" | "washing" | "sewing" | "finishing">("all");
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedMachines, setSelectedMachines] = useState<string[]>([]);
  const [machineDropdownOpen, setMachineDropdownOpen] = useState(false);

  const machineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (machineRef.current && !machineRef.current.contains(event.target as Node)) {
        setMachineDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getDepartment = useCallback((row: StyleBulletinRow): "cutting" | "washing" | "sewing" | "finishing" => {
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
  }, []);

  const uniqueSections = useMemo(() => {
    let list = styleBulletins;
    if (selectedDeptFilter !== "all") {
      list = list.filter((row) => getDepartment(row) === selectedDeptFilter);
    }
    const sections = list.map((row) => row.Section).filter(Boolean) as string[];
    return Array.from(new Set(sections));
  }, [styleBulletins, selectedDeptFilter, getDepartment]);

  const uniqueMachines = useMemo(() => {
    const machines = styleBulletins.map((row) => row.Machine_Type).filter(Boolean) as string[];
    return Array.from(new Set(machines));
  }, [styleBulletins]);

  useEffect(() => {
    setSelectedSections([]);
  }, [selectedDeptFilter]);

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
  const [forwardForApproval, setForwardForApproval] = useState("");
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

  // Persisted style bulletin attachments (dbo.StyleBulletin_Attachment), keyed by work order.
  const [bulletinAttachments, setBulletinAttachments] = useState<StyleBulletinAttachment[]>([]);
  const [bulletinAttachmentsLoading, setBulletinAttachmentsLoading] = useState(false);
  const [bulletinAttachmentError, setBulletinAttachmentError] = useState("");

  const styleBulletinColumns = useMemo<ColumnDef<StyleBulletinRow>[]>(
    () => [
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
        size: 50,
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
        footer: () => (
          <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">
            Total
          </span>
        ),
        size: 70,
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
        size: 260,
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
        size: 70,
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
        size: 70,
      },
      {
        accessorKey: "Smv_Sam",
        meta: { borderRight: true },
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
        size: 70,
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
        size: 80,
      },
      {
        accessorKey: "Bi_Hourly_Tgt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Bi Hourly TGT"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-semibold text-slate-600">
            {row.original.Bi_Hourly_Tgt ?? "-"}
          </div>
        ),
        size: 70,
      },
      {
        accessorKey: "Shift_Tgt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Shift TGT"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-semibold text-slate-600">
            {row.original.Shift_Tgt ?? "-"}
          </div>
        ),
        size: 70,
      },
      {
        accessorKey: "No_Of_Operations",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="#of Operations"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-semibold text-slate-600">
            {row.original.No_Of_Operations ?? "-"}
          </div>
        ),
        size: 70,
      },
      {
        accessorKey: "DL",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="DL"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-semibold text-slate-600">
            {row.original.DL ?? "-"}
          </div>
        ),
        size: 70,
      },
      {
        accessorKey: "No_Mc",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="No M/C"
            onFilterClick={() => {}}
          />
        ),
        cell: ({ row }) => (
          <div className="text-center font-semibold text-slate-600">
            {row.original.No_Mc ?? "-"}
          </div>
        ),
        size: 80,
      },

    ],
    [rowAttachments, filteredStyleBulletins, getDepartment],
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
          forwardForApproval,
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

  const loadBulletinAttachments = useCallback(async (workOrder: string) => {
    if (!workOrder) {
      setBulletinAttachments([]);
      return;
    }
    setBulletinAttachmentsLoading(true);
    setBulletinAttachmentError("");
    try {
      const res = await fetch(`/api/style-bulletin/attachments?workOrder=${encodeURIComponent(workOrder)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load attachments.");
      setBulletinAttachments(data);
    } catch (err) {
      setBulletinAttachmentError(err instanceof Error ? err.message : "Failed to load attachments.");
    } finally {
      setBulletinAttachmentsLoading(false);
    }
  }, []);

  const handleUploadBulletinAttachment = async (file: File) => {
    const workOrder = cutDetails[0]?.Work_Order || activeSearchQuery;
    if (!workOrder) {
      setBulletinAttachmentError("No active Work Order to attach a file to.");
      return;
    }
    setBulletinAttachmentError("");
    const form = new FormData();
    form.append("workOrder", workOrder);
    form.append("file", file);
    form.append("createdBy", user?.email || "");

    try {
      const res = await fetch("/api/style-bulletin/attachments", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload attachment.");
      await loadBulletinAttachments(workOrder);
    } catch (err) {
      setBulletinAttachmentError(err instanceof Error ? err.message : "Failed to upload attachment.");
    }
  };

  const handleDeleteBulletinAttachment = async (id: number) => {
    setBulletinAttachmentError("");
    try {
      const res = await fetch(`/api/style-bulletin/attachments?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete attachment.");
      setBulletinAttachments((prev) => prev.filter((a) => a.Id !== id));
    } catch (err) {
      setBulletinAttachmentError(err instanceof Error ? err.message : "Failed to delete attachment.");
    }
  };

  useEffect(() => {
    const workOrder = cutDetails[0]?.Work_Order || activeSearchQuery;
    void Promise.resolve().then(() => loadBulletinAttachments(workOrder || ""));
  }, [cutDetails, activeSearchQuery, loadBulletinAttachments]);

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
        setIsWoFocused(false);
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
      setIsWoFocused(false);
    } else if (e.key === "Enter") {
      setActiveSearchQuery(searchQuery);
      setShowSuggestions(false);
      setIsWoFocused(false);
    }
  };

  // Fetch data from API only when the active (committed) search query
  // changes — typing alone must not refetch/replace the table.
  useEffect(() => {
    setSelectedDeptFilter("all");
    setSelectedSections([]);
    setSelectedMachines([]);

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
    setForwardForApproval("");
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
          setForwardForApproval(data.metadata.Forward_For_Approval || "No");
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

  const activeRecordsCount = styleBulletins.length;

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
  }, [activeSearchQuery, cutDetails, styleBulletins]);

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

        {/* Dynamic Metadata Cards Row */}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
              {/* Left Form Panel: Basic Style Details */}
              <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                {/* Row 1: W/O # & Customer */}
                <div className="flex flex-col gap-1.5 relative" ref={containerRef}>
                  <label className="font-bold text-[#475569] text-[10px] uppercase">W/O # &amp; Customer</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
                    <input
                      type="text"
                      value={
                        isWoFocused
                          ? searchQuery
                          : styleBulletinMetadata.amNo
                          ? `${styleBulletinMetadata.amNo}${
                              styleBulletinMetadata.customer
                                ? ` (${styleBulletinMetadata.customer})`
                                : ""
                            }`
                          : searchQuery
                      }
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
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-[#f1f5f9] animate-fade-in">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setSearchQuery(suggestion);
                            setActiveSearchQuery(suggestion);
                            setShowSuggestions(false);
                            setIsWoFocused(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-indigo-50/50 text-slate-700 hover:text-[#4f46e5] font-semibold transition-all text-xs cursor-pointer block"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Row 2: Sale Order No & Order Qty */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Sale Order No</label>
                    <input type="text" readOnly value={styleBulletinMetadata.styleCode} className="px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 font-semibold focus:outline-none w-full" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Order Qty</label>
                    <input type="text" readOnly value={styleBulletinMetadata.planQty} className="px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 focus:outline-none font-semibold w-full" />
                  </div>
                </div>
                {/* Row 3: Fabric Code & Wash */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Fabric Code</label>
                    <input type="text" readOnly value={cutDetails[0]?.Fabric_Code_Main_Body || ""} className="px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 focus:outline-none font-semibold w-full" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Wash</label>
                    <input type="text" readOnly value={cutDetails[0]?.Wash || ""} className="px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 focus:outline-none font-semibold w-full" />
                  </div>
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
                    className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Style Description</label>
                  <input
                    type="text"
                    value={styleDescription}
                    onChange={(e) => setStyleDescription(e.target.value)}
                    className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Style Category</label>
                  <input
                    type="text"
                    value={styleCategory}
                    onChange={(e) => setStyleCategory(e.target.value)}
                    className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
              
              </div>

              {/* Middle Form Panel 2: Targets & Piece Rates */}
              <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                {/* Row 1: Target & Target Unit/Min */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Target</label>
                    <input
                      type="text"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">Target Unit/Min</label>
                    <input
                      type="text"
                      value={targetUnitMin}
                      onChange={(e) => setTargetUnitMin(e.target.value)}
                      className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                    />
                  </div>
                </div>
                {/* Row 2: Start Time */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Start Time</label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
                {/* Row 3: Forward for Approval */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-[#475569] text-[10px] uppercase">Forward for Approval</label>
                  <input
                    type="text"
                    value={forwardForApproval}
                    onChange={(e) => setForwardForApproval(e.target.value)}
                    className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
                  />
                </div>
              </div>

              {/* Right Form Panel: SAM Summary & Approvals */}
              <div className="lg:col-span-4 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                {/* Row 1: Head/Reqd | Total SAM | Total Rate */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#64748b] text-[10px] uppercase">Head/Reqd</span>
                    <input
                      type="text"
                      value={headReqd}
                      onChange={(e) => setHeadReqd(e.target.value)}
                      className="w-full px-3 py-1 border border-[#e2e8f0] rounded-xl bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all font-semibold text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#64748b] text-[10px] uppercase">Total SAM</span>
                    <input
                      type="text"
                      readOnly
                      value={totalSam}
                      onChange={(e) => setTotalSam(e.target.value)}
                      className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-slate-50 font-semibold focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-[#64748b] text-[10px] uppercase">Total Rate</span>
                    <input
                      type="text"
                      readOnly
                      value={totalRate}
                      onChange={(e) => setTotalRate(e.target.value)}
                      className="w-full px-3 py-1 border border-[#e2e8f0] rounded-xl bg-slate-50 font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: App Date & App By */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">App Date</label>
                    <input
                      type="text"
                      value={appDate}
                      onChange={(e) => setAppDate(e.target.value)}
                      className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all font-semibold text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-bold text-[#475569] text-[10px] uppercase">App By</label>
                    <input
                      type="text"
                      value={appBy}
                      onChange={(e) => setAppBy(e.target.value)}
                      className="w-full px-3 py-1 rounded-xl border border-[#e2e8f0] text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all font-semibold text-center"
                    />
                  </div>
                </div>

                {/* Row 3: Status on Left, Save Button on Right */}
                <div className="flex items-center justify-between gap-4 pt-1.5 mt-1 border-t border-[#f1f5f9]">
                  <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={isSaving}
                    className="flex-grow max-w-[200px] bg-[#4f46e5] hover:bg-[#4338ca] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-1.5 px-4 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs flex items-center justify-center gap-1.5"
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
          <TableSkeleton columnsCount={12} />
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
                in the Style Bulletin table.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 animate-fade-in">

            {/* Section Panel + DataTable, side by side at equal height */}
            <div className="flex items-stretch gap-4">
              <div className="w-56 shrink-0 bg-white border border-[#e2e8f0] rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b border-[#e2e8f0] bg-[#f8fafc] font-bold text-[#64748b] text-[10px] uppercase tracking-wider">
                  Section
                </div>
                <div className="max-h-[370px] overflow-y-auto flex flex-col gap-0.5 p-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedSections([])}
                    className={`text-left px-2.5 py-1.5 rounded-lg cursor-pointer font-bold transition-colors ${
                      selectedSections.length === 0
                        ? "bg-slate-100 text-slate-800"
                        : "hover:bg-slate-50 text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {selectedDeptFilter === "all" ? "All Sections" : selectedDeptFilter}
                  </button>
                  <div className="h-[1px] bg-slate-100 my-1" />
                  {uniqueSections.map((section) => {
                    const isChecked = selectedSections.includes(section);
                    return (
                      <label
                        key={section}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setSelectedSections((prev) =>
                              isChecked ? prev.filter((s) => s !== section) : [...prev, section]
                            )
                          }
                          className="w-3 h-3 rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="truncate">{section}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* DataTable Component */}
              <div className="flex-1 min-w-0">
              <DataTable
                columns={styleBulletinColumns}
                data={filteredStyleBulletins}
                showColumnsDropdown={false}

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




                  </div>
                }
              />
              </div>
            </div>
          </div>
        )}

        {/* Style Bulletin Attachments */}
        {hasSearched && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#0f172a] text-sm">Attachments</h2>
              <label className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                Add Attachment
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadBulletinAttachment(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {bulletinAttachmentError && (
              <p className="text-red-600 text-[11px] font-semibold">{bulletinAttachmentError}</p>
            )}

            {bulletinAttachmentsLoading ? (
              <p className="text-[#64748b] text-[11px]">Loading attachments...</p>
            ) : bulletinAttachments.length === 0 ? (
              <p className="text-[#94a3b8] text-[11px]">No attachments yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {bulletinAttachments.map((a) => (
                  <div key={a.Id} className="flex items-center justify-between gap-2 border border-[#e2e8f0] rounded-xl px-3 py-2.5">
                    <a
                      href={`/api/style-bulletin/attachments/${a.Id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 min-w-0 hover:text-[#4f46e5]"
                    >
                      {a.ContentType === "application/pdf" ? (
                        <FileText className="w-4 h-4 text-[#4f46e5] shrink-0" />
                      ) : (
                        <Paperclip className="w-4 h-4 text-[#4f46e5] shrink-0" />
                      )}
                      <span className="flex flex-col min-w-0">
                        <span className="truncate font-semibold text-[#334155] text-[11px]">{a.FileName}</span>
                        <span className="text-[10px] text-[#94a3b8]">
                          {new Date(a.CreatedAt).toLocaleString()}{a.CreatedBy ? ` · ${a.CreatedBy}` : ""}
                        </span>
                      </span>
                    </a>
                    <button
                      onClick={() => handleDeleteBulletinAttachment(a.Id)}
                      className="text-[#94a3b8] hover:text-red-500 p-1 shrink-0"
                      title="Delete attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
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
