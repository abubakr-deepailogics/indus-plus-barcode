import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Search } from "lucide-react";
import { FilterPanel } from "./filter-panel";
import { FilterItem, advancedFilterFn } from "./utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  toolbarChildren?: React.ReactNode;
  toolbarRightChildren?: React.ReactNode;
  maxHeight?: string;
  showColumnsDropdown?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  toolbarChildren,
  toolbarRightChildren,
  maxHeight = "max-h-[370px]",
  showColumnsDropdown = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");

  // Compute filterable columns automatically from column definitions
  const filterableColumns = useMemo(() => {
    return columns
      .filter((col: any) => col.accessorKey && typeof col.accessorKey === "string")
      .map((col: any) => ({
        id: col.accessorKey,
        label: col.headerTitle || col.accessorKey.replace(/_([a-z])/g, (_: any, c: string) => ` ${c.toUpperCase()}`).replace(/([A-Z])/g, " $1").trim(),
      }));
  }, [columns]);

  // Derived filter state to pass to the FilterPanel
  const filters = useMemo(() => {
    return columnFilters.map((cf) => ({
      id: cf.id,
      operator: (cf.value as any)?.operator || "contains",
      value: (cf.value as any)?.value || "",
    }));
  }, [columnFilters]);

  // Handler to add a filter row for a column
  const handleAddFilter = (columnId?: string) => {
    const targetCol = columnId || (filterableColumns[0]?.id ?? "");
    if (!targetCol) return;

    setColumnFilters((prev) => {
      // If a filter for this column already exists, just focus on it (or leave it as is)
      if (prev.some((f) => f.id === targetCol)) return prev;
      return [
        ...prev,
        {
          id: targetCol,
          value: {
            columnId: targetCol,
            operator: "contains",
            value: "",
          },
        },
      ];
    });
  };

  const handleUpdateFilter = (index: number, key: keyof FilterItem, val: string) => {
    setColumnFilters((prev) => {
      const updated = [...prev];
      if (index >= updated.length) return prev;
      const existing = updated[index];
      const currentVal = (existing.value as any) || { columnId: existing.id, operator: "contains", value: "" };
      
      const nextId = key === "id" ? val : existing.id;
      const nextVal = {
        ...currentVal,
        columnId: nextId,
        [key === "id" ? "columnId" : key]: val,
      };

      updated[index] = {
        id: nextId,
        value: nextVal,
      };
      return updated;
    });
  };

  const handleRemoveFilter = (index: number) => {
    setColumnFilters((prev) => prev.filter((_, i) => i !== index));
  };

  // Modify columns to inject our filter handler
  const columnsWithFilters = useMemo(() => {
    return columns.map((col: any) => {
      // Set the custom filter evaluator
      const updatedCol = {
        ...col,
        filterFn: col.filterFn || advancedFilterFn,
      };

      // Wrap the header function to inject the add filter handler
      if (typeof col.header === "function") {
        const originalHeader = col.header;
        updatedCol.header = (props: any) => {
          return originalHeader({
            ...props,
            onFilterClick: (columnId: string) => handleAddFilter(columnId),
          });
        };
      }

      return updatedCol;
    });
  }, [columns]);

  const table = useReactTable({
    data,
    columns: columnsWithFilters,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      globalFilter,
    },
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) {
    return (
      <div className="border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden animate-pulse bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0]">
              <tr>
                {Array.from({ length: columns.length }).map((_, i) => (
                  <th key={i} className="px-4 py-1.5">
                    <div className="h-3 bg-slate-200 rounded w-16"></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: columns.length }).map((_, colIndex) => (
                    <td key={colIndex} className="px-4 py-1">
                      <div className="h-3.5 bg-slate-100 rounded w-full"></div>
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

  return (
    <div className="w-full space-y-4">
      {/* Top Toolbar containing Search input and the "Columns" hide/show dropdown menu */}
      <div className="flex items-center justify-start gap-3 flex-wrap">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search from table..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#e2e8f0] bg-white text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
          />
        </div>
        {toolbarChildren}
        {showColumnsDropdown && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 bg-white hover:bg-[#f8fafc]/80 text-[#475569] border border-[#e2e8f0] px-4 py-2 rounded-xl font-bold transition-all shadow-sm cursor-pointer text-xs hover:text-[#0f172a] focus:outline-none">
              <span>Columns</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-white border border-[#e2e8f0] shadow-md rounded-xl p-1 z-50">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const label = filterableColumns.find((c) => c.id === column.id)?.label || column.id;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors focus:bg-slate-50 focus:outline-none"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {toolbarRightChildren && (
          <div className="ml-auto flex items-center gap-3">
            {toolbarRightChildren}
          </div>
        )}
      </div>

      {/* MUI-style filter panel built on Shadcn UI components */}
      <FilterPanel
        columns={filterableColumns}
        filters={filters}
        onUpdateFilter={handleUpdateFilter}
        onRemoveFilter={handleRemoveFilter}
        onClearAll={() => setColumnFilters([])}
        onAddFilter={() => handleAddFilter()}
      />

      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
        {/* Directly define the vertical scrollable viewport without wrapper divs that block sticky positioning */}
        <div className={`overflow-auto ${maxHeight}`}>
          <table 
            className="text-left border-collapse min-w-max text-xs text-[#334155]"
            style={{
              width: table.getCenterTotalSize(),
              minWidth: "100%",
              tableLayout: "fixed",
            }}
          >
            <thead className="bg-[#f8fafc] border-b border-[#e2e8f0] [&_tr]:border-b">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-[#e2e8f0]">
                  {headerGroup.headers.map((header) => {
                    const hasBorderRight = (header.column.columnDef.meta as any)?.borderRight;
                    return (
                      <th
                        key={header.id}
                        className={`px-4 py-1.5 h-auto font-bold text-[#64748b] bg-[#f8fafc] sticky top-0 z-10 border-b border-[#e2e8f0] shadow-[0_1px_0_0_#e2e8f0] text-left align-middle whitespace-nowrap relative group/header ${
                          hasBorderRight ? "border-r-3 border-r-[#e2e8f0]" : ""
                        }`}
                        style={{ width: header.column.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        
                        {/* Drag Resize Handler */}
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={`absolute right-1 top-2.5 bottom-2.5 w-1 rounded-full cursor-col-resize select-none touch-none hover:bg-blue-500 hover:w-1.5 transition-all z-20 ${
                              header.column.getIsResizing() ? "bg-blue-600 w-1.5" : "bg-transparent"
                            }`}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] [&_tr:last-child]:border-0">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 transition-colors border-b border-[#f1f5f9]"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const hasBorderRight = (cell.column.columnDef.meta as any)?.borderRight;
                      return (
                        <td 
                          key={cell.id} 
                          className={`px-4 py-1 align-middle whitespace-nowrap overflow-hidden text-ellipsis ${
                            hasBorderRight ? "border-r-3 border-r-[#e2e8f0]" : ""
                          }`}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="h-24 text-center text-slate-500 font-semibold text-xs whitespace-nowrap"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
            {table.getFooterGroups()[0]?.headers.some(header => header.column.columnDef.footer) && (
              <tfoot className="border-t border-[#e2e8f0] bg-[#f8fafc] font-bold text-slate-700 sticky bottom-0 z-10 shadow-[0_-1px_0_0_#e2e8f0]">
                {table.getFooterGroups().map((footerGroup) => (
                  <tr key={footerGroup.id}>
                    {footerGroup.headers.map((header) => {
                      const hasBorderRight = (header.column.columnDef.meta as any)?.borderRight;
                      return (
                        <td
                          key={header.id}
                          className={`px-4 py-1.5 align-middle whitespace-nowrap bg-[#f8fafc] ${
                            hasBorderRight ? "border-r-3 border-r-[#e2e8f0]" : ""
                          }`}
                          style={{ width: header.column.getSize() }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.footer,
                                header.getContext()
                              )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
