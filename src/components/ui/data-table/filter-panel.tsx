import React from "react";
import { X, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterItem, operators } from "./utils";

interface FilterPanelProps {
  columns: { id: string; label: string }[];
  filters: FilterItem[];
  onUpdateFilter: (index: number, key: keyof FilterItem, val: string) => void;
  onRemoveFilter: (index: number) => void;
  onClearAll: () => void;
  onAddFilter: () => void;
}

export function FilterPanel({
  columns,
  filters,
  onUpdateFilter,
  onRemoveFilter,
  onClearAll,
  onAddFilter,
}: FilterPanelProps) {
  if (filters.length === 0) return null;

  return (
    <div className="bg-slate-50 border border-[#e2e8f0] rounded-2xl p-4 shadow-sm flex flex-col gap-3 animate-fade-in my-3">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>Active Filters</span>
          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
            {filters.length}
          </span>
        </h4>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-[10px] font-bold text-[#4f46e5] border-[#c7d2fe] bg-indigo-50/30 hover:bg-indigo-50 transition-all cursor-pointer flex items-center gap-1"
            onClick={onAddFilter}
          >
            <Plus className="h-3 w-3" />
            <span>Add Filter</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1" 
            onClick={onClearAll}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear all</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filters.map((filter, index) => (
          <div key={index} className="flex items-center gap-3 animate-fade-in flex-wrap sm:flex-nowrap">
            {/* Delete button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer flex-shrink-0"
              onClick={() => onRemoveFilter(index)}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Column Selector */}
            <div className="relative flex-1 min-w-[140px] border border-[#e2e8f0] rounded-xl px-3 py-1 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-slate-500">
                Column
              </span>
              <select
                value={filter.id}
                onChange={(e) => onUpdateFilter(index, "id", e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-xs font-semibold text-slate-700 focus:ring-0 focus:outline-none h-7 cursor-pointer"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id} className="text-slate-700">
                    {col.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator Selector */}
            <div className="relative flex-1 min-w-[140px] border border-[#e2e8f0] rounded-xl px-3 py-1 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-slate-500">
                Operator
              </span>
              <select
                value={filter.operator}
                onChange={(e) => onUpdateFilter(index, "operator", e.target.value)}
                className="w-full bg-transparent border-0 p-0 text-xs font-semibold text-slate-700 focus:ring-0 focus:outline-none h-7 cursor-pointer"
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value} className="text-slate-700">
                    {op.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Value Input */}
            <div className="relative flex-[2] min-w-[180px] border border-[#e2e8f0] rounded-xl px-3 py-1 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <span className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-slate-500">
                Value
              </span>
              <Input
                type="text"
                value={filter.value}
                disabled={filter.operator === "isEmpty" || filter.operator === "isNotEmpty"}
                onChange={(e) => onUpdateFilter(index, "value", e.target.value)}
                placeholder="Filter value"
                className="w-full bg-transparent border-0 p-0 h-7 text-xs text-slate-700 placeholder-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
