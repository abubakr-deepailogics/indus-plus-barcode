import React from "react";
import { Column } from "@tanstack/react-table";
import { ColumnSortMenu } from "./column-sort-menu";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  onFilterClick?: (columnId: string) => void;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const meta = column.columnDef.meta as Record<string, unknown> | undefined;
  const align = (meta?.align as "left" | "center" | "right") ?? "left";

  const justifyClass =
    align === "center"
      ? "justify-center"
      : align === "right"
      ? "justify-end"
      : "justify-start";

  return (
    <div className={`relative flex items-center ${justifyClass} w-full min-h-[28px] group/header`}>
      <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider whitespace-normal break-words">
        {title}
      </span>

      {column.getCanSort() && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <ColumnSortMenu
            title={title}
            onSortAsc={() => column.toggleSorting(false)}
            onSortDesc={() => column.toggleSorting(true)}
          />
        </div>
      )}
    </div>
  );
}
