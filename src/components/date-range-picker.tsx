"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { currentPayCycleStart } from "@/lib/pay-cycle";
import { cn } from "@/lib/utils";

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

export function formatDateRangeLabel(range: DateRangeValue): string {
  if (!range.from && !range.to) return "All time";
  if (range.from && range.to) {
    return `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`;
  }
  return format((range.from ?? range.to) as Date, "dd MMM yyyy");
}

export const DATE_RANGE_PRESETS: { label: string; range: () => DateRangeValue }[] = [
  { label: "Last 7 Days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 Days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  // Pay cycle (24th → 23rd), not the calendar month.
  { label: "This Month", range: () => ({ from: currentPayCycleStart(), to: new Date() }) },
  { label: "All Time", range: () => ({}) },
];

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (range: DateRangeValue) => void;
  triggerClassName?: string;
}

// The reports' "Tenure / Scope" picker: preset pills plus a range calendar
// (future dates disabled). Closes after a preset or a complete range.
export function DateRangePicker({ value, onChange, triggerClassName }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100",
          triggerClassName,
        )}
      >
        <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
        <span className="truncate">{formatDateRangeLabel(value)}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white" align="start">
        <div className="flex flex-col gap-2 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onChange(preset.range());
                  setOpen(false);
                }}
                className="rounded-md bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-800 transition-colors hover:bg-rose-100"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Calendar
            mode="range"
            captionLayout="dropdown"
            classNames={{
              selected:
                "bg-rose-50 text-rose-800 hover:bg-rose-100 hover:text-rose-800 shadow-sm font-bold rounded-lg scale-105 [&>button]:text-rose-800",
            }}
            selected={value.from || value.to ? { from: value.from, to: value.to } : undefined}
            onSelect={(range) => {
              const next = { from: range?.from, to: range?.to };
              onChange(next);
              if (next.from && next.to) setOpen(false);
            }}
            disabled={(date) => date > new Date()}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
