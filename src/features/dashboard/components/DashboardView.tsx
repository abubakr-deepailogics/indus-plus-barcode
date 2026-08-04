"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  Clock,
  Zap,
  ShoppingBag,
  FlaskConical,
  Scissors,
  BarChart3,
  ChevronDown,
  LayoutGrid,
  TrendingUp,
} from "lucide-react";
import { MOCK_DASHBOARD_DATA } from "@/features/dashboard/data/mock-dashboard-data";

const STAT_ICON_MAP: Record<string, React.ReactNode> = {
  Orders: (
    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
      <ShoppingBag className="w-5 h-5" />
    </div>
  ),
  Completed: (
    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
      <CheckCircle2 className="w-5 h-5" />
    </div>
  ),
  "In Progress": (
    <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
      <Clock className="w-5 h-5" />
    </div>
  ),
  Efficiency: (
    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
      <Zap className="w-5 h-5" />
    </div>
  ),
};

const ACTIVITY_ICON_MAP: Record<string, React.ReactNode> = {
  order: (
    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
      <ShoppingBag className="w-4 h-4" />
    </div>
  ),
  sample: (
    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
      <FlaskConical className="w-4 h-4" />
    </div>
  ),
  report: (
    <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center">
      <Scissors className="w-4 h-4" />
    </div>
  ),
  ppc: (
    <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
      <BarChart3 className="w-4 h-4" />
    </div>
  ),
};

const QUICK_ACTION_ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-5 h-5 text-blue-600" />,
  Beaker: <FlaskConical className="w-5 h-5 text-emerald-600" />,
  Scissors: <Scissors className="w-5 h-5 text-orange-500" />,
  BarChart3: <BarChart3 className="w-5 h-5 text-indigo-600" />,
};

export function DashboardView() {
  const data = MOCK_DASHBOARD_DATA;

  return (
    <div className="flex flex-col gap-8 max-w-[1300px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold text-[#0f172a] tracking-tight flex items-center gap-2">
              Good morning, Admin! <span className="animate-bounce">👋</span>
            </h1>
            <p className="text-sm text-[#64748b]">Here&apos;s what&apos;s happening in your system today.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data.stats.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200">
                <div className="flex flex-col gap-3">
                  {STAT_ICON_MAP[stat.label]}
                  <div>
                    <span className="text-[28px] font-extrabold text-[#0f172a] tracking-tight block">{stat.value}</span>
                    <span className="text-xs font-semibold text-[#64748b]">{stat.label}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center gap-1">
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{stat.change}</span>
                  <span className="text-[10px] text-[#94a3b8]">{stat.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f172a]">Production Efficiency</h3>
            <button className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#0f172a] bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded-lg transition-colors">
              This Month
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" className="stroke-[#f1f5f9]" strokeWidth="8" fill="transparent" />
                <circle cx="50" cy="50" r="40" className="stroke-[#6366f1] transition-all duration-1000 ease-out" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * data.efficiencyPercentage) / 100} strokeLinecap="round" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-[#0f172a]">{data.efficiencyPercentage}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50/50 py-1.5 rounded-xl border border-emerald-100/50">
            <TrendingUp className="w-4 h-4" />
            <span>{data.efficiencyChange}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f172a]">Recent Activities</h3>
            <button className="text-xs font-semibold text-[#4f46e5] hover:text-[#4338ca] bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
              View all
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {data.recentActivities.map((act) => (
              <div key={act.id} className="flex items-center gap-3.5 py-1">
                {ACTIVITY_ICON_MAP[act.type]}
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                  <span className="text-xs font-semibold text-[#334155]">{act.text}</span>
                  <span className="text-[10px] text-[#94a3b8]">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col justify-between gap-5">
          <h3 className="text-sm font-bold text-[#0f172a]">Quick Actions</h3>

          <div className="grid grid-cols-2 gap-3">
            {data.quickActions.map((action, idx) => (
              <button key={idx} className="flex items-center gap-2.5 p-4 rounded-xl border border-[#f1f5f9] bg-[#f8fafc] hover:bg-white hover:border-[#e2e8f0] hover:shadow-sm transition-all group text-left">
                {QUICK_ACTION_ICON_MAP[action.icon]}
                <span className="text-[11px] font-bold text-[#475569] group-hover:text-[#0f172a]">{action.label}</span>
              </button>
            ))}
          </div>

          <button className="w-full flex items-center justify-center gap-2 py-3 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#7c3aed] rounded-xl border border-[#ddd6fe] text-xs font-bold transition-colors">
            <LayoutGrid className="w-4 h-4" />
            View All Modules
          </button>
        </div>
      </div>
    </div>
  );
}
