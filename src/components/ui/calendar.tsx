"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const isDropdown = props.captionLayout === "dropdown";

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      startMonth={new Date(new Date().getFullYear() - 10, 0)}
      endMonth={new Date()}
      className={cn("p-4 bg-white relative rounded-2xl border border-slate-100 shadow-xl w-[280px]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1.5 pb-2 relative items-center h-9",
        caption_label: cn(
          "text-xs font-bold text-slate-700 uppercase tracking-wider",
          isDropdown && "sr-only"
        ),
        nav: "space-x-1 flex items-center",
        button_previous: "absolute left-4 top-4 h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 border border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 text-slate-600 transition-all hover:scale-105 active:scale-95 shadow-sm z-20",
        button_next: "absolute right-4 top-4 h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 border border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 text-slate-600 transition-all hover:scale-105 active:scale-95 shadow-sm z-20",
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-between border-b border-slate-50 pb-1.5 mb-1",
        weekday: "text-slate-400 rounded-md w-8 font-bold text-[9px] uppercase tracking-wider text-center",
        week: "flex w-full mt-1.5 justify-between",
        day: "h-8 w-8 text-center text-xs p-0 relative flex items-center justify-center rounded-lg cursor-pointer transition-all hover:bg-indigo-50 hover:text-[#4f46e5]",
        day_button: "w-full h-full flex items-center justify-center rounded-lg font-semibold text-slate-700",
        selected: "bg-[#4f46e5] text-white hover:bg-[#4f46e5] hover:text-white shadow-md font-bold rounded-lg scale-105",
        today: "bg-slate-50 text-[#4f46e5] border border-slate-100 font-extrabold rounded-lg",
        outside: "text-slate-300 opacity-40 cursor-default hover:bg-transparent hover:text-slate-300",
        disabled: "text-slate-300 opacity-20 cursor-not-allowed hover:bg-transparent hover:text-slate-300",
        dropdowns: "flex items-center gap-1.5 z-10",
        dropdown: "px-2 py-0.5 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] cursor-pointer hover:bg-slate-50 transition-all shadow-sm",
        ...classNames,
      }}
      components={{
        Chevron: ({ ...props }) => {
          if (props.orientation === "left") {
            return <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
          }
          if (props.orientation === "right") {
            return <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
          }
          // Return a hidden element for vertical orientations to avoid duplicate dropdown arrow elements
          return <span className="hidden" />
        }
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
