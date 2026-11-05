import React from "react";
import { MoreVertical, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ColumnSortMenuProps {
  title: string;
  onSortAsc: () => void;
  onSortDesc: () => void;
  // Merged over the default trigger classes (size, visibility). By default it
  // is revealed while hovering an ancestor with the `group/header` class.
  triggerClassName?: string;
}

const itemClassName =
  "flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors focus:bg-slate-50 focus:outline-none";

// Column "Sort by ASC / DESC" menu shared by DataTable headers and hand-built
// tables (e.g. the Cut Planning matrix) that sort their own rows.
export function ColumnSortMenu({
  title,
  onSortAsc,
  onSortDesc,
  triggerClassName = "opacity-0 group-hover/header:opacity-100",
}: ColumnSortMenuProps) {
  return (
    // Non-modal: a modal menu locks page scroll, which hides the scrollbar
    // and shifts the whole table sideways while the menu is open.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Column actions for ${title}`}
        className={cn(
          "h-6 w-6 data-[state=open]:opacity-100 transition-opacity p-0 cursor-pointer inline-flex items-center justify-center rounded-md hover:bg-slate-100 focus:bg-slate-100 focus:outline-none",
          triggerClassName,
        )}
      >
        <MoreVertical className="h-3 w-3 text-[#64748b]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-48 bg-white border border-[#e2e8f0] shadow-md rounded-xl p-1 z-50"
      >
        <DropdownMenuItem onClick={onSortAsc} className={itemClassName}>
          <ArrowUp className="h-3.5 w-3.5 text-[#64748b]" />
          Sort by ASC
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSortDesc} className={itemClassName}>
          <ArrowDown className="h-3.5 w-3.5 text-[#64748b]" />
          Sort by DESC
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
