import React from "react";
import { Column } from "@tanstack/react-table";
import { MoreVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  onFilterClick: (columnId: string) => void;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  // Read the intended alignment from column meta (set per-column in the column definition).
  const align: "left" | "center" | "right" =
    ((column.columnDef.meta as Record<string, unknown> | undefined)?.align as
      | "left"
      | "center"
      | "right") ?? "left";

  const textAlignClass =
    align === "center"
      ? "text-center"
      : align === "right"
      ? "text-right"
      : "text-left";

  if (!column.getCanSort() && !column.getCanFilter()) {
    return (
      <span
        className={`text-[10px] font-bold text-[#64748b] uppercase tracking-wider whitespace-normal break-words block w-full ${textAlignClass}`}
      >
        {title}
      </span>
    );
  }

  return (
    // Use relative + absolute for the dropdown icon so it never shifts the title off-center.
    <div className="relative flex items-center w-full min-h-[28px] group/header">
      {/* Title takes full width; text-align controls its position */}
      <span
        className={`text-[10px] font-bold text-[#64748b] uppercase tracking-wider whitespace-normal break-words w-full ${textAlignClass}`}
      >
        {title}
      </span>

      {/* Dropdown icon: absolutely positioned at right edge, invisible until hover */}
      <DropdownMenu>
        <DropdownMenuTrigger className="absolute right-0 h-6 w-6 opacity-0 group-hover/header:opacity-100 data-[state=open]:opacity-100 transition-opacity p-0 cursor-pointer inline-flex items-center justify-center rounded-md hover:bg-slate-100 focus:bg-slate-100 focus:outline-none">
          <MoreVertical className="h-3 w-3 text-[#64748b]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-48 bg-white border border-[#e2e8f0] shadow-md rounded-xl p-1 z-50"
        >
          {column.getCanSort() && (
            <>
              <DropdownMenuItem
                onClick={() => column.toggleSorting(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors focus:bg-slate-50 focus:outline-none"
              >
                <ArrowUp className="h-3.5 w-3.5 text-[#64748b]" />
                Sort by ASC
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => column.toggleSorting(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors focus:bg-slate-50 focus:outline-none"
              >
                <ArrowDown className="h-3.5 w-3.5 text-[#64748b]" />
                Sort by DESC
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
