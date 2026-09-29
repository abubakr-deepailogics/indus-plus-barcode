"use client";
// Washing Cut Report View - Indus Plus Limited

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  AlertCircle,
  Database,
  Printer,
  Trash2,
  CheckCircle2,
  Loader2,
  Barcode,
} from "lucide-react";
import {
  WorkOrderSearchModal,
  type WorkOrderSearchRow,
} from "@/components/work-order-search-modal";
import { useWorkOrderParam } from "@/lib/use-work-order-param";
import { CsvExportButton } from "@/components/ui/csv-export-button";
import type {
  WashingCutRow,
  WashingOrderMetadata,
  SavedWashingCutRecord,
} from "../types";

const cellInputClassName =
  "w-full h-full px-2.5 py-2 text-center bg-transparent text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:bg-white rounded-lg transition-all";

/**
 * Generates Bundle ID following the exact Sewing pattern:
 * [Clean Work Order Number] + [4-digit 0-padded sequence number]
 * e.g., W/O-006761 sequence 1 -> 0067610001
 * e.g., 006815 sequence 5    -> 0068150005
 */
function formatSewingBundleId(workOrder: string, sequenceNumber: number): string {
  const cleanWo = workOrder.replace(/^W\/?O-?/i, "").trim();
  return `${cleanWo}${String(sequenceNumber).padStart(4, "0")}`;
}

export function WashingCutReportView() {
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingRowIds, setDeletingRowIds] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Metadata for the top cards (fetched from ERP)
  const [metadata, setMetadata] = useState<WashingOrderMetadata>({
    workOrder: "",
    saleOrderNo: "",
    customerName: "",
    orderQty: null,
    fabricCode: "",
    wash: "",
  });

  // Manual cutting detail rows — purely user-entered, no ERP fetching for this table
  const nextRowId = useRef(2);

  const [rows, setRows] = useState<WashingCutRow[]>([
    {
      id: 1,
      bundleId: "", // Empty until user clicks Generate Coupon(s)
      cut: "",
      bundleQty: "",
      inseam: "",
      size: "",
    },
  ]);

  // Sync with global work order context and URL query parameter
  const { setWorkOrder: setGlobalWorkOrder } = useWorkOrderParam(
    useCallback((wo: string) => {
      setActiveSearchQuery(wo);
    }, []),
  );

  const commitSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      setActiveSearchQuery(trimmed);
      setGlobalWorkOrder(trimmed);
    },
    [setGlobalWorkOrder],
  );

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
      const res = await fetch(`/api/open-order/work-orders?${params.toString()}`);
      return res.ok ? res.json() : [];
    },
    [],
  );

  // Load order metadata for the top cards (and restore previously saved washing cuts if any)
  useEffect(() => {
    const trimmedWo = activeSearchQuery.trim();
    if (!trimmedWo) return;

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setErrorMsg("");
      setSuccessMsg("");

      try {
        const res = await fetch(
          `/api/washing/cut-report?work_order=${encodeURIComponent(trimmedWo)}&t=${Date.now()}`,
        );
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to load washing cut report.");
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.metadata) {
          setMetadata(data.metadata);
        } else {
          setMetadata({
            workOrder: trimmedWo,
            saleOrderNo: "",
            customerName: "",
            orderQty: null,
            fabricCode: "",
            wash: "",
          });
        }

        const savedCuts: SavedWashingCutRecord[] = data.cuts || [];

        if (savedCuts.length > 0) {
          // Restore previously saved washing cuts
          setRows(
            savedCuts.map((item) => ({
              id: nextRowId.current++,
              recordId: item.Id,
              bundleId: item.Bundle_Id || "",
              cut: item.Cut,
              bundleQty: String(item.Bundle_Qty || ""),
              inseam: item.Inseam || "",
              size: item.Size || "",
            })),
          );
        } else {
          // Purely manual: starts with 1 blank row (no fetching for cutting detail table)
          setRows([
            {
              id: nextRowId.current++,
              bundleId: "",
              cut: "",
              bundleQty: "",
              inseam: "",
              size: "",
            },
          ]);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          console.error("Washing load error:", err);
          setErrorMsg(err instanceof Error ? err.message : "Failed to load data for work order.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeSearchQuery]);

  const maxOrderQty =
    metadata.orderQty != null && metadata.orderQty > 0
      ? metadata.orderQty
      : null;

  // Row update helper
  const updateCell = (id: number, field: keyof WashingCutRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return { ...r, [field]: value };
      }),
    );

    // Auto-add next blank row when typing in the last row
    setRows((prev) => {
      const lastIndex = prev.length - 1;
      if (prev[lastIndex].id === id && value.trim() !== "") {
        return [
          ...prev,
          {
            id: nextRowId.current++,
            bundleId: "", // Empty until Generate Coupon(s) is clicked
            cut: "",
            bundleQty: "",
            inseam: "",
            size: "",
          },
        ];
      }
      return prev;
    });
  };


  const removeRowLocally = (id: number) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [
          {
            id: nextRowId.current++,
            bundleId: "",
            cut: "",
            bundleQty: "",
            inseam: "",
            size: "",
          },
        ];
      }
      return prev.filter((r) => r.id !== id);
    });
  };

  const removeRow = async (row: WashingCutRow) => {
    if (!row.recordId) {
      removeRowLocally(row.id);
      return;
    }

    const workOrder = (metadata.workOrder || activeSearchQuery).trim();
    if (!workOrder) {
      setErrorMsg("Work Order is required to delete a saved cut row.");
      return;
    }

    setDeletingRowIds((prev) => new Set(prev).add(row.id));
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const response = await fetch("/api/washing/cut-report", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.recordId, workOrder }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete washing cut row.");
      }

      removeRowLocally(row.id);
      setSuccessMsg("Washing cut row deleted successfully.");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete washing cut row.");
    } finally {
      setDeletingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const clearAllRows = () => {
    setRows([
      {
        id: nextRowId.current++,
        bundleId: "",
        cut: "",
        bundleQty: "",
        inseam: "",
        size: "",
      },
    ]);
  };

  // Calculations for summary & validation
  const populatedRows = useMemo(
    () => rows.filter((r) => r.cut.trim() !== "" || r.bundleQty.trim() !== ""),
    [rows],
  );

  const totalBundleQty = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const val = Number(r.bundleQty);
        return sum + (isNaN(val) || val < 0 ? 0 : val);
      }, 0),
    [rows],
  );

  const uniqueCutsCount = useMemo(() => {
    const cuts = new Set(
      rows.map((r) => r.cut.trim()).filter((c) => c !== ""),
    );
    return cuts.size;
  }, [rows]);

  const isTotalExceeding =
    maxOrderQty !== null && totalBundleQty > maxOrderQty;
  const totalBundleQtyError = isTotalExceeding
    ? `Total Bundle Qty (${totalBundleQty.toLocaleString()}) cannot be greater than Order Qty (${maxOrderQty.toLocaleString()}).`
    : "";

  // Generate Coupon(s) action:
  // 1. Validates required fields (Cut # and Bundle Qty > 0).
  // 2. Enforces Bundle Qty cannot be greater than Order Qty.
  // 3. Generates Bundle IDs matching the sewing pattern (e.g., 0067610001, 0067610002...).
  // 4. Immediately displays generated bundle IDs in the table.
  // 5. Saves cutting details to pitSystem.dbo.SaleOrderPOCutDetailViewV1 with Department = 'washing'.
  const handleGenerateCoupons = async () => {
    const currentWo = metadata.workOrder || activeSearchQuery;
    if (!currentWo.trim()) {
      setErrorMsg("Please select or enter a Work Order first.");
      return;
    }

    if (populatedRows.length === 0) {
      setErrorMsg("Please add at least one cut detail row.");
      return;
    }

    // Validate required fields for new (unsaved) rows only
    for (let i = 0; i < populatedRows.length; i++) {
      const row = populatedRows[i];
      if (!row.cut.trim()) {
        setErrorMsg(`Row ${i + 1}: Cut # is required.`);
        return;
      }
      const qty = Number(row.bundleQty);
      if (isNaN(qty) || qty <= 0) {
        setErrorMsg(`Row ${i + 1}: Bundle Qty must be a valid number greater than 0.`);
        return;
      }
    }

    // Total across ALL rows (saved + new) must not exceed Order Qty
    if (isTotalExceeding) {
      setErrorMsg(totalBundleQtyError);
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Split rows into already-saved (have bundleId) and new (no bundleId yet)
      const savedRows = populatedRows.filter((r) => r.bundleId.trim() !== "");
      const newRows = populatedRows.filter((r) => r.bundleId.trim() === "");

      if (newRows.length === 0) {
        setErrorMsg(
          "Cut report already generated for these rows. Clear rows or add new rows before generating again.",
        );
        setIsGenerating(false);
        return;
      }

      // Sequence new bundle IDs after the already-saved ones
      // e.g. if 3 saved rows exist, new rows start at sequence 4
      const cutsPayload = newRows.map((r, idx) => {
        const generatedBundleId = formatSewingBundleId(currentWo, savedRows.length + idx + 1);
        return {
          cut: r.cut.trim(),
          bundleId: generatedBundleId,
          bundleQty: Number(r.bundleQty),
          inseam: r.inseam.trim() || undefined,
          size: r.size.trim() || undefined,
        };
      });

      const payload = {
        workOrder: currentWo.trim(),
        saleOrderNo: metadata.saleOrderNo,
        customerName: metadata.customerName,
        orderQty: metadata.orderQty,
        fabricCode: metadata.fabricCode,
        wash: metadata.wash,
        cuts: cutsPayload,
      };

      const res = await fetch("/api/washing/cut-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to generate cut report.");
      }

      // Assign generated bundle IDs to the new rows in state
      setRows((prev) => {
        let newIdx = 0;
        const savedRecordIds = new Map<string, number>(
          (resData.insertedRows || []).map((item: { id: number; bundleId: string }) => [
            item.bundleId,
            item.id,
          ]),
        );
        return prev.map((r) => {
          // Only update rows that were in newRows (no bundleId and populated)
          const isNew =
            r.bundleId.trim() === "" &&
            (r.cut.trim() !== "" || r.bundleQty.trim() !== "");
          if (isNew) {
            const assignedBundleId = cutsPayload[newIdx]?.bundleId || "";
            newIdx++;
            return {
              ...r,
              bundleId: assignedBundleId,
              recordId: savedRecordIds.get(assignedBundleId),
            };
          }
          return r;
        });
      });

      setSuccessMsg(
        `Cut report saved successfully (${newRows.length} new bundle${newRows.length !== 1 ? "s" : ""} added).`,
      );
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: unknown) {
      console.error("Generate cut report failed:", err);
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate and save cut report.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // CSV Export configuration
  const csvHeaders = ["#", "Cut #", "Bundle ID", "Bundle Qty", "Inseam", "Size"];
  const csvRows = useMemo(() => {
    return populatedRows.map((r, idx) => [
      idx + 1,
      r.cut,
      r.bundleId || "—",
      r.bundleQty,
      r.inseam,
      r.size,
    ]);
  }, [populatedRows]);

  return (
    <>
      <div className="no-print flex flex-col gap-6 max-w-[1400px] mx-auto text-xs text-[#334155] animate-fade-in pb-16">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
            <span className="text-slate-500">Washing</span>
            <span className="text-[#94a3b8] font-light">/</span>
            <span className="text-[#4f46e5] font-bold">Cut Report</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
              Washing Department
            </span>
          </div>
        </div>

        {/* Dynamic Metadata Cards Row (Fetched from ERP) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          {/* Card 1: Order Info */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">
                Work Order
              </span>
              <button
                type="button"
                onClick={() => setShowWorkOrderModal(true)}
                className="relative mt-1.5 w-full text-left cursor-pointer"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
                <span className="block w-full pl-9 pr-3 py-2 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-800 hover:border-[#4f46e5] transition-all truncate">
                  {metadata.workOrder || activeSearchQuery || "Search W/O..."}
                </span>
              </button>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">
                Sale Order No
              </span>
              <input
                type="text"
                readOnly
                value={metadata.saleOrderNo || ""}
                placeholder="—"
                className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>

          {/* Card 2: Customer & Qty */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">
                Customer
              </span>
              <input
                type="text"
                readOnly
                value={metadata.customerName || ""}
                placeholder="—"
                className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">
                Order Qty
              </span>
              <input
                type="text"
                readOnly
                value={
                  metadata.orderQty != null ? metadata.orderQty.toLocaleString() : ""
                }
                placeholder="—"
                className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none font-bold text-indigo-600"
              />
            </div>
          </div>

          {/* Card 3: Specifications */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">
                Fabric Code
              </span>
              <input
                type="text"
                readOnly
                value={metadata.fabricCode || ""}
                placeholder="—"
                className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">
                Wash
              </span>
              <input
                type="text"
                readOnly
                value={metadata.wash || ""}
                placeholder="—"
                className="mt-1.5 w-full px-3 py-2 rounded-xl border border-[#e2e8f0] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Notifications / Alerts */}
        {(errorMsg || totalBundleQtyError) && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs">Error</h4>
              <p className="mt-0.5 text-xs text-red-700">{totalBundleQtyError || errorMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-xs">Success</h4>
              <p className="mt-0.5 text-xs text-emerald-700">{successMsg}</p>
            </div>
          </div>
        )}

        {/* Empty state when no Work Order is searched */}
        {!activeSearchQuery && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-4 shadow-xs animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              <Database className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h3 className="text-sm font-bold text-[#0f172a]">Ready to Search</h3>
              <p className="text-xs text-[#64748b] mt-1">
                Please select a Work Order number using the lookup above to enter washing cut details.
              </p>
            </div>
          </div>
        )}

        {/* Cutting Detail Table Block (Spreadsheet style, manual user entry, no ERP fetching) */}
        {activeSearchQuery && (
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-xs flex flex-col gap-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#f1f5f9] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#4f46e5] flex items-center gap-2">
                  <span>Washing Cutting Detail</span>
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4f46e5]" />}
                </h3>
                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                  Cut and Bundle Qty are required · Bundle Qty cannot exceed Order Qty ({maxOrderQty ? maxOrderQty.toLocaleString() : "—"}) · Start typing in the last row to add another below.
                </span>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={clearAllRows}
                  disabled={rows.length <= 1 && !rows[0].cut && !rows[0].bundleQty}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 text-xs font-semibold transition-all shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                >
                  Clear All
                </button>

                <CsvExportButton
                  filename={`washing-cut-report-${metadata.workOrder || activeSearchQuery || "export"}`}
                  headers={csvHeaders}
                  rows={csvRows}
                  disabled={populatedRows.length === 0}
                  className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-[#334155] disabled:opacity-50 py-1.5 px-3 rounded-xl font-bold transition-all shadow-2xs cursor-pointer text-xs flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                />

                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={populatedRows.length === 0}
                  className="bg-white border border-[#e2e8f0] hover:bg-slate-50 text-[#334155] disabled:opacity-50 py-1.5 px-3 rounded-xl font-bold transition-all shadow-2xs cursor-pointer text-xs flex items-center justify-center gap-1.5 disabled:cursor-not-allowed"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateCoupons}
                  disabled={isGenerating || populatedRows.length === 0 || isTotalExceeding}
                  className="px-4 py-1.5 rounded-xl bg-[#4f46e5] hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Barcode className="w-3.5 h-3.5" />
                  )}
                  <span>{isGenerating ? "Generating…" : "Generate Cut Report"}</span>
                </button>
              </div>
            </div>

            {/* Editable Spreadsheet Table */}
            <div className="overflow-x-auto border border-[#e2e8f0] rounded-xl">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[#475569] font-bold text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">Row ID</th>
                    <th className="py-2.5 px-3 text-center w-32">
                      Cut <span className="text-red-500 font-bold">*</span>
                    </th>
                    <th className="py-2.5 px-3 text-center w-40 text-indigo-700">
                      Bundle ID
                    </th>
                    <th className="py-2.5 px-3 text-center w-36">
                      Bundle Qty <span className="text-red-500 font-bold">*</span>
                    </th>
                    <th className="py-2.5 px-3 text-center w-28">Inseam</th>
                    <th className="py-2.5 px-3 text-center w-28">Size</th>
                    <th className="py-2.5 px-3 w-12 text-center" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const rowQty = Number(row.bundleQty);
                    const isExceeding = maxOrderQty !== null && !isNaN(rowQty) && rowQty > maxOrderQty;

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/70 transition-colors text-xs"
                      >
                        <td className="py-1 px-2 text-center font-mono text-[11px] text-slate-400">
                          {index + 1}
                        </td>
                        {/* Cut # — manual input, required */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.cut}
                            onChange={(e) => updateCell(row.id, "cut", e.target.value)}
                            placeholder="Cut #"
                            className={`${cellInputClassName} border border-transparent focus:border-slate-200 font-bold text-indigo-600`}
                          />
                        </td>
                        {/* Bundle ID — empty before generation, displayed after clicking Generate Coupon(s) */}
                        <td className="py-1 px-2 text-center font-mono font-bold text-[11px] bg-slate-50/60">
                          {row.bundleId ? (
                            <span className="text-slate-800">{row.bundleId}</span>
                          ) : (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </td>
                        {/* Bundle Qty — manual input, required (cannot exceed Order Qty) */}
                        <td className="p-1">
                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              min="1"
                              value={row.bundleQty}
                              onChange={(e) => updateCell(row.id, "bundleQty", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              placeholder="Bundle Qty"
                              className={`${cellInputClassName} border ${
                                isExceeding
                                  ? "border-red-400 bg-red-50/50 text-red-600 font-bold"
                                  : "border-transparent focus:border-slate-200 font-bold text-slate-900"
                              }`}
                            />
                            {isExceeding && (
                              <span className="text-[9px] text-red-500 font-semibold mt-0.5">
                                Exceeds {maxOrderQty.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Inseam — manual input, optional */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.inseam}
                            onChange={(e) => updateCell(row.id, "inseam", e.target.value)}
                            placeholder="Inseam"
                            className={cellInputClassName}
                          />
                        </td>
                        {/* Size — manual input, optional */}
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.size}
                            onChange={(e) => updateCell(row.id, "size", e.target.value)}
                            placeholder="Size"
                            className={`${cellInputClassName} font-bold`}
                          />
                        </td>
                        <td className="py-1 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(row)}
                            disabled={deletingRowIds.has(row.id)}
                            className="p-1 text-slate-300 hover:text-red-500 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 border-t-2 border-slate-300 font-bold text-slate-800 text-xs">
                    <td className="py-2.5 px-3 text-center" colSpan={3}>
                      Total Cuts: <span className="text-indigo-600 font-black">{uniqueCutsCount}</span>
                    </td>
                    <td className={`py-2.5 px-3 text-center font-black font-mono ${
                      isTotalExceeding ? "text-red-600" : "text-emerald-800"
                    }`}>
                      {totalBundleQty.toLocaleString()} Pcs
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-500 font-medium" colSpan={3}>
                      {populatedRows.length} active row(s) entered
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Shared Work Order Search Modal */}
      <WorkOrderSearchModal
        open={showWorkOrderModal}
        onClose={() => setShowWorkOrderModal(false)}
        onSelect={(row) => {
          commitSearch(row.workOrder);
          setShowWorkOrderModal(false);
        }}
        fetchRows={fetchWorkOrderRows}
      />

      {/* PRINT STYLES */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          @page {
            size: portrait;
            margin: 10mm;
          }
          body {
            background-color: white !important;
            color: black !important;
            font-size: 9px !important;
          }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          .print-header-table td {
            padding: 4px 6px;
            vertical-align: top;
            font-size: 9px;
            border: 1px solid #cbd5e1;
          }
          .print-ops-table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-ops-table th, .print-ops-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            font-size: 9px;
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
          Washing Cut Report — Indus Plus Limited
        </h2>

        <table className="print-header-table">
          <tbody>
            <tr>
              <td style={{ width: "35%" }}>
                <div className="flex flex-col gap-1">
                  <div><strong>WORK ORDER:</strong> {metadata.workOrder || activeSearchQuery || ""}</div>
                  <div><strong>SALE ORDER NO:</strong> {metadata.saleOrderNo || "—"}</div>
                </div>
              </td>
              <td style={{ width: "30%" }}>
                <div className="flex flex-col gap-1">
                  <div><strong>CUSTOMER:</strong> {metadata.customerName || "—"}</div>
                  <div><strong>ORDER QTY:</strong> {metadata.orderQty != null ? metadata.orderQty.toLocaleString() : "—"}</div>
                </div>
              </td>
              <td style={{ width: "35%" }}>
                <div className="flex flex-col gap-1">
                  <div><strong>FABRIC CODE:</strong> {metadata.fabricCode || "—"}</div>
                  <div><strong>WASH:</strong> {metadata.wash || "—"}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="print-ops-table">
          <thead>
            <tr>
              <th className="text-center w-8">#</th>
              <th className="text-center w-20">CUT</th>
              <th className="text-center w-28">BUNDLE ID</th>
              <th className="text-right w-24">BUNDLE QTY</th>
              <th className="text-center w-20">INSEAM</th>
              <th className="text-center w-20">SIZE</th>
            </tr>
          </thead>
          <tbody>
            {populatedRows.map((row, idx) => (
              <tr key={row.id}>
                <td className="text-center">{idx + 1}</td>
                <td className="text-center font-bold">{row.cut}</td>
                <td className="text-center font-mono font-bold">{row.bundleId || "—"}</td>
                <td className="text-right font-bold">{row.bundleQty}</td>
                <td className="text-center">{row.inseam || "—"}</td>
                <td className="text-center font-bold">{row.size || "—"}</td>
              </tr>
            ))}
            <tr className="print-totals-row">
              <td colSpan={3} className="text-right uppercase">
                Total Cuts: {uniqueCutsCount} | Total Qty
              </td>
              <td className="text-right">{totalBundleQty.toLocaleString()}</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
