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
  Plus
} from "lucide-react";
import { mockDashboardData } from "@/lib/mockData";

export default function DashboardHome() {
  const data = mockDashboardData;

  // Function to render icon for stat card
  const renderStatIcon = (label: string) => {
    switch (label) {
      case "Orders":
        return (
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
            <ShoppingBag className="w-5 h-5" />
          </div>
        );
      case "Completed":
        return (
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case "In Progress":
        return (
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-sm">
            <Clock className="w-5 h-5" />
          </div>
        );
      case "Efficiency":
        return (
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5" />
          </div>
        );
      default:
        return null;
    }
  };

  // Function to render icon for recent activities
  const renderActivityIcon = (type: string) => {
    switch (type) {
      case "order":
        return (
          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
        );
      case "sample":
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center">
            <FlaskConical className="w-4 h-4" />
          </div>
        );
      case "report":
        return (
          <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center">
            <Scissors className="w-4 h-4" />
          </div>
        );
      case "ppc":
        return (
          <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
        );
      default:
        return null;
    }
  };

  // Function to render icon for quick actions
  const renderQuickActionIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case "FileText":
        return <FileText className="w-5 h-5 text-blue-600" />;
      case "Beaker":
        return <FlaskConical className="w-5 h-5 text-emerald-600" />;
      case "Scissors":
        return <Scissors className="w-5 h-5 text-orange-500" />;
      case "BarChart3":
        return <BarChart3 className="w-5 h-5 text-indigo-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1300px] mx-auto">
      {/* Top Welcome / Cards Grid Wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Welcome + Stats Card block (Spans 2 columns) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Welcome greeting */}
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold text-[#0f172a] tracking-tight flex items-center gap-2">
              Good morning, Admin! <span className="animate-bounce">👋</span>
            </h1>
            <p className="text-sm text-[#64748b]">Here&apos;s what&apos;s happening in your system today.</p>
          </div>

          {/* Core Telemetry Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data.stats.map((stat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex flex-col gap-3">
                  {renderStatIcon(stat.label)}
                  <div>
                    <span className="text-[28px] font-extrabold text-[#0f172a] tracking-tight block">
                      {stat.value}
                    </span>
                    <span className="text-xs font-semibold text-[#64748b]">{stat.label}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center gap-1">
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {stat.change}
                  </span>
                  <span className="text-[10px] text-[#94a3b8]">{stat.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Production Efficiency panel (Spans 1 column) */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0f172a]">Production Efficiency</h3>
            <button className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#0f172a] bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded-lg transition-colors">
              This Month
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Radial Donut Progress Chart */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* SVG Ring */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#f1f5f9]"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Active Colored Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="stroke-[#6366f1] transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * data.efficiencyPercentage) / 100}
                  strokeLinecap="round"
                />
              </svg>
              {/* Inner Text */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-[#0f172a]">{data.efficiencyPercentage}%</span>
              </div>
            </div>
          </div>

          {/* Subtext info */}
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50/50 py-1.5 rounded-xl border border-emerald-100/50">
            <TrendingUp className="w-4 h-4" />
            <span>{data.efficiencyChange}</span>
          </div>
        </div>

      </div>

      {/* Bottom Activities & Actions Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Activities (Spans 2 columns) */}
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
                {renderActivityIcon(act.type)}
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                  <span className="text-xs font-semibold text-[#334155]">{act.text}</span>
                  <span className="text-[10px] text-[#94a3b8]">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions (Spans 1 column) */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col justify-between gap-5">
          <h3 className="text-sm font-bold text-[#0f172a]">Quick Actions</h3>

          {/* 2x2 Grid of Actions */}
          <div className="grid grid-cols-2 gap-3">
            {data.quickActions.map((action, idx) => (
              <button
                key={idx}
                className="flex items-center gap-2.5 p-4 rounded-xl border border-[#f1f5f9] bg-[#f8fafc] hover:bg-white hover:border-[#e2e8f0] hover:shadow-sm transition-all group text-left"
              >
                {renderQuickActionIcon(action.icon, action.color)}
                <span className="text-[11px] font-bold text-[#475569] group-hover:text-[#0f172a]">
                  {action.label}
                </span>
              </button>
            ))}
          </div>

          {/* Bottom Call to action */}
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#7c3aed] rounded-xl border border-[#ddd6fe] text-xs font-bold transition-colors">
            <LayoutGrid className="w-4 h-4" />
            View All Modules
          </button>
        </div>

      </div>
    </div>
  );
}
