"use client";

import React from "react";
import {
  Users,
  Timer,
  TrendingUp,
  Target,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";
import type { LineBalancingMetrics } from "../types";

interface LineBalancingMetricsCardProps {
  metrics: LineBalancingMetrics;
  onOptimizeAll?: () => void;
}

export function LineBalancingMetricsCard({
  metrics,
  onOptimizeAll,
}: LineBalancingMetricsCardProps) {
  const efficiencyColor =
    metrics.lineBalancingEfficiency >= 85
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : metrics.lineBalancingEfficiency >= 75
      ? "text-amber-600 bg-amber-50 border-amber-200"
      : "text-rose-600 bg-rose-50 border-rose-200";

  const mismatchCount = metrics.totalMismatches || 0;

  return (
    <div className="space-y-4">
      {/* AI Skill Mismatch Optimization Banner */}
      {mismatchCount > 0 && (
        <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10 border border-rose-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-rose-600 text-white shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-rose-900 uppercase tracking-wide">
                  AI Skill Deficit Alert:
                </span>
                <span className="text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                  {mismatchCount} Under-Skilled Operator{mismatchCount > 1 ? "s" : ""} Assigned
                </span>
              </div>
              <p className="text-[11px] text-[#475569] mt-0.5 leading-snug">
                The current plan has low-grade operators on complex operations. AI has verified top-grade real replacements from MSSQL DB. Upgrading will eliminate bottlenecks and boost line efficiency.
              </p>
            </div>
          </div>

          {onOptimizeAll && (
            <button
              type="button"
              onClick={onOptimizeAll}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Auto-Replace All with Real Operators
            </button>
          )}
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workers Needed */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Total Workforce Needed
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
              {metrics.totalAllocatedWorkers}
            </span>
            <span className="text-xs font-semibold text-[#64748b]">Operators</span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-1 flex items-center gap-1">
            <span className="font-semibold text-indigo-600">Min {metrics.theoreticalMinWorkers}</span> theoretical for line balance
          </p>
        </div>

        {/* Pitch Time */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Takt / Pitch Time
            </span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Timer className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
              {metrics.pitchTimeSeconds}
            </span>
            <span className="text-xs font-semibold text-[#64748b]">sec / piece</span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-1">
            ({metrics.pitchTimeMinutes} min/pc at target rate)
          </p>
        </div>

        {/* Line Balancing Efficiency */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Line Balancing Efficiency
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
              {metrics.lineBalancingEfficiency}%
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${efficiencyColor}`}>
              {metrics.lineBalancingEfficiency >= 85 ? "Optimal" : metrics.lineBalancingEfficiency >= 75 ? "Moderate" : "Suboptimal"}
            </span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-1">
            Target benchmark is ≥ 85%
          </p>
        </div>

        {/* Daily Target Output */}
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748b] uppercase tracking-wider">
              Target Daily Pace
            </span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Target className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-[#0f172a] tracking-tight">
              {metrics.targetDailyOutput.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-[#64748b]">Pcs / Day</span>
          </div>
          <p className="text-[11px] text-[#64748b] mt-1">
            Total {metrics.totalOrderQuantity.toLocaleString()} pcs in {metrics.predictedDaysToComplete} days
          </p>
        </div>
      </div>

    </div>
  );
}
