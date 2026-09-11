"use client";

import React, { useMemo, useState } from "react";
import { MoreVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OperationsDetailRow } from "../types";

interface OperationsDetailTableProps {
  operations: OperationsDetailRow[];
  onOperationChange: (id: number, field: string, value: boolean) => void;
  onAllOperationsSelChange: (checked: boolean) => void;
}

type SortableColumn = "section" | "seqNo" | "operationName";
type SortDirection = "asc" | "desc";
interface SortState {
  column: SortableColumn;
  direction: SortDirection;
}

interface SortableHeaderProps {
  title: string;
  align?: "left" | "center";
  column: SortableColumn;
  sort: SortState | null;
  onSort: (column: SortableColumn, direction: SortDirection) => void;
}

function SortableHeader({
  title,
  align = "left",
  column,
  sort,
  onSort,
}: SortableHeaderProps) {
  return (
    <div
      className={`flex items-center gap-1 group/header min-h-[20px] ${
        align === "center" ? "justify-center w-full" : "justify-start"
      }`}
    >
      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider whitespace-normal break-words">
        {title}
        {sort?.column === column &&
          (sort.direction === "asc" ? (
            <ArrowUp className="inline h-2.5 w-2.5 ml-1 text-[#4f46e5]" />
          ) : (
            <ArrowDown className="inline h-2.5 w-2.5 ml-1 text-[#4f46e5]" />
          ))}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger className="h-5 w-5 opacity-0 group-hover/header:opacity-100 data-[state=open]:opacity-100 transition-opacity ml-1 p-0 cursor-pointer inline-flex items-center justify-center rounded-md hover:bg-slate-100 focus:bg-slate-100 focus:outline-none">
          <MoreVertical className="h-3 w-3 text-[#64748b]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-48 bg-white border border-[#e2e8f0] shadow-md rounded-xl p-1 z-50"
        >
          <DropdownMenuItem
            onClick={() => onSort(column, "asc")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors focus:bg-slate-50 focus:outline-none"
          >
            <ArrowUp className="h-3.5 w-3.5 text-[#64748b]" />
            Sort by ASC
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onSort(column, "desc")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors focus:bg-slate-50 focus:outline-none"
          >
            <ArrowDown className="h-3.5 w-3.5 text-[#64748b]" />
            Sort by DESC
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function OperationsDetailTable({
  operations,
  onOperationChange,
  onAllOperationsSelChange,
}: OperationsDetailTableProps) {
  const [isSectionWise, setIsSectionWise] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);

  const handleSort = (column: SortableColumn, direction: SortDirection) => {
    setSort({ column, direction });
  };

  const sortedOperations = useMemo(() => {
    if (!sort) return operations;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...operations].sort((a, b) => {
      if (sort.column === "seqNo") {
        return (Number(a.seqNo) - Number(b.seqNo)) * dir;
      }
      return a[sort.column].localeCompare(b[sort.column], undefined, {
        numeric: true,
      }) * dir;
    });
  }, [operations, sort]);

  return (
    <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
        <h3 className="text-sm font-extrabold text-[#4f46e5]">Operations Detail</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748b]">
              Complete selection
            </span>
            <input
              type="checkbox"
              onChange={(e) => {
                onAllOperationsSelChange(e.target.checked);
              }}
              className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#64748b]">
              Section Wise selection
            </span>
            <input
              type="checkbox"
              checked={isSectionWise}
              onChange={(e) => setIsSectionWise(e.target.checked)}
              className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
            />
          </div>
        </div>
      </div>

      <div className="overflow-auto max-h-[420px] border border-[#f1f5f9] rounded-xl">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-[#e2e8f0]">
              <th className="py-2 text-left sticky top-0 z-10 bg-white">
                <SortableHeader
                  title="Section"
                  column="section"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th className="py-2 text-center sticky top-0 z-10 bg-white">
                <SortableHeader
                  title="Seq #"
                  align="center"
                  column="seqNo"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                Op #
              </th>
              <th className="py-2 text-left sticky top-0 z-10 bg-white">
                <SortableHeader
                  title="Operation"
                  column="operationName"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                SMV
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                Rate
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                Inc.
              </th>
              <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center sticky top-0 z-10 bg-white">
                Sel
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {sortedOperations.map((op) => (
              <tr key={op.id} className="hover:bg-[#f8fafc] border-b border-[#f1f5f9] transition-colors text-[11px] font-semibold text-slate-700">
                <td className="py-2.5 text-left text-[#64748b] font-bold uppercase">
                  {op.section}
                </td>
                <td className="py-2.5 text-center text-[#4f46e5] font-bold">
                  {op.seqNo}
                </td>
                <td className="py-2.5 text-center text-purple-600 font-bold font-mono">
                  {op.opNo}
                </td>
                <td className="py-2.5 text-left text-slate-800 font-medium">
                  {op.operationName}
                </td>
                <td className="py-2.5 text-center font-bold text-slate-700">
                  {op.smv}
                </td>
                <td className="py-2.5 text-center font-bold text-slate-700">
                  {op.rate}
                </td>
                <td className="py-2.5 text-center text-slate-500 font-medium">
                  {op.inc || "-"}
                </td>
                <td className="py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={op.lastOpSection}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      if (isSectionWise) {
                        operations.forEach((opItem) => {
                          if (opItem.section === op.section) {
                            onOperationChange(opItem.id, "lastOpSection", isChecked);
                          }
                        });
                      } else {
                        onOperationChange(op.id, "lastOpSection", isChecked);
                      }
                    }}
                    className="rounded border-slate-300 text-[#4f46e5] focus:ring-[#4f46e5]/10 cursor-pointer w-3.5 h-3.5"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
