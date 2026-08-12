import React from "react";
import { Column } from "@tanstack/react-table";
import { MoreVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onFilterClick,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanFilter()) {
    return <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{title}</div>;
  }

  return (
    <div className="flex items-center justify-between group/header w-full min-h-[28px]">
      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">{title}</span>
      
      <DropdownMenu>
        <DropdownMenuTrigger
          className="h-6 w-6 opacity-0 group-hover/header:opacity-100 data-[state=open]:opacity-100 transition-opacity ml-1 p-0 cursor-pointer inline-flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors focus:bg-slate-100 focus:outline-none"
        >
          <MoreVertical className="h-3 w-3 text-[#64748b]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 bg-white border border-[#e2e8f0] shadow-md rounded-xl p-1 z-50">
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
              {/* <DropdownMenuSeparator className="my-1 border-t border-[#f1f5f9]" /> */}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
