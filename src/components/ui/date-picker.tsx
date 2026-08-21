"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface DatePickerProps {
  value: string; // "yyyy-MM-dd" format
  onChange: (date: string) => void;
  placeholder?: string;
  disabledDays?: (date: Date) => boolean;
  className?: string;
  triggerClassName?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabledDays,
  className = "",
  triggerClassName = "",
}: DatePickerProps) {
  const selectedDate = value && !isNaN(Date.parse(value)) ? new Date(value) : undefined;

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger className={`px-3 py-1 rounded-lg border border-[#e2e8f0] text-xs font-semibold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all bg-white w-full text-left flex items-center justify-between cursor-pointer h-[26px] ${triggerClassName}`}>
          <span>
            {value && !isNaN(Date.parse(value))
              ? format(new Date(value), "yyyy-MM-dd")
              : placeholder}
          </span>
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
              } else {
                onChange("");
              }
            }}
            disabled={disabledDays}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
