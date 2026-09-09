"use client";

import React from "react";
import { Calendar, Flag } from "lucide-react";
import type { DailyTimelinePoint } from "../types";

interface TimelineGanttChartProps {
  timeline: DailyTimelinePoint[];
  totalQuantity: number;
}

export function TimelineGanttChart({ timeline, totalQuantity }: TimelineGanttChartProps) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Calendar className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">
              Production Output & Timeline Forecast
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Day-by-day learning curve ramp and cumulative completion milestones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#475569]">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <span>Daily Output (Pcs)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#475569]">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Cumulative Completion</span>
          </div>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-4">
        {timeline.map((point) => {
          const isFinal = point.completionPercentage >= 100;
          return (
            <div
              key={point.dayNumber}
              className={`p-4 rounded-xl border transition-all ${
                isFinal
                  ? "bg-emerald-500/[0.04] border-emerald-200"
                  : "bg-[#f8fafc] border-[#e2e8f0]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                  Day {point.dayNumber}
                </span>
                <span className="text-[11px] font-semibold text-[#0f172a] bg-white px-2 py-0.5 rounded-md border border-[#e2e8f0] shadow-2xs">
                  {point.dateStr}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-[#94a3b8] block">Planned Day Output</span>
                  <span className="text-base font-extrabold text-indigo-700">
                    +{point.plannedOutput.toLocaleString()} <span className="text-xs font-semibold text-[#64748b]">pcs</span>
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#475569] mb-1">
                    <span>Cumulative Total:</span>
                    <span className="font-bold text-[#0f172a]">
                      {point.cumulativeOutput.toLocaleString()} / {totalQuantity.toLocaleString()}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFinal ? "bg-emerald-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${point.completionPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
                    <span>Progress</span>
                    <span className="font-bold text-[#0f172a]">{point.completionPercentage}%</span>
                  </div>
                </div>

                {point.milestone && (
                  <div className="pt-2 border-t border-[#e2e8f0]/60 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                    <Flag className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{point.milestone}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
