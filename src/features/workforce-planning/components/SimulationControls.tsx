"use client";

import React from "react";
import { Sliders, RefreshCw, Clock, Calendar, Gauge, ShieldAlert, Filter, Package } from "lucide-react";

interface SimulationControlsProps {
  params: {
    targetDays: number;
    shiftHours: number;
    targetEfficiency: number;
    absenteeismBuffer: number;
    sectionFilter: string;
    customQuantity?: number;
  };
  availableSections: string[];
  defaultDbQuantity?: number;
  onChangeParam: <K extends keyof SimulationControlsProps["params"]>(
    key: K,
    value: SimulationControlsProps["params"][K]
  ) => void;
  onRecalculate: () => void;
  isPredicting: boolean;
}

export function SimulationControls({
  params,
  availableSections,
  defaultDbQuantity,
  onChangeParam,
  onRecalculate,
  isPredicting,
}: SimulationControlsProps) {
  const allSections = ["All", ...Array.from(new Set(availableSections.filter(Boolean)))];

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Sliders className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">
              IE Line Simulation Parameters
            </h3>
            <p className="text-[11px] text-[#64748b]">
              Adjust target constraints & batch size to dynamically recalculate manpower and pitch time
            </p>
          </div>
        </div>

        <button
          onClick={onRecalculate}
          disabled={isPredicting}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPredicting ? "animate-spin" : ""}`} />
          {isPredicting ? "Recalculating..." : "Run AI Prediction"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 pt-4">
        {/* Order Batch Quantity */}
        <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#f1f5f9] flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] mb-1.5">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-500" />
              Batch Quantity
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={1000000}
              step={50}
              placeholder={String(defaultDbQuantity || 1200)}
              value={params.customQuantity !== undefined ? params.customQuantity : (defaultDbQuantity || 1200)}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onChangeParam("customQuantity", val);
              }}
              className="w-full py-1.5 px-2.5 text-xs font-bold bg-white border border-[#cbd5e1] rounded-lg text-[#0f172a] focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#94a3b8] font-semibold">
              Pcs
            </span>
          </div>
          <div className="text-[10px] text-[#94a3b8] mt-1">
            {params.customQuantity ? "Custom Batch Size" : defaultDbQuantity ? "From Cut Report" : "Default Batch"}
          </div>
        </div>

        {/* Target Days */}
        <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#f1f5f9]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] mb-1.5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Target Timeline
            </span>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
              {params.targetDays} Days
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={params.targetDays}
            onChange={(e) => onChangeParam("targetDays", Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
            <span>1 Day</span>
            <span>15 Days</span>
            <span>30 Days</span>
          </div>
        </div>

        {/* Shift Hours */}
        <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#f1f5f9]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] mb-1.5">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Shift Duration
            </span>
            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              {params.shiftHours} Hours
            </span>
          </div>
          <input
            type="range"
            min={4}
            max={12}
            step={0.5}
            value={params.shiftHours}
            onChange={(e) => onChangeParam("shiftHours", Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
            <span>4 hrs</span>
            <span>8 hrs (Std)</span>
            <span>12 hrs</span>
          </div>
        </div>

        {/* Line Efficiency */}
        <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#f1f5f9]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] mb-1.5">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-500" />
              Target Efficiency
            </span>
            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              {params.targetEfficiency}%
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={params.targetEfficiency}
            onChange={(e) => onChangeParam("targetEfficiency", Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
            <span>50%</span>
            <span>85% (Std)</span>
            <span>100%</span>
          </div>
        </div>

        {/* Absenteeism Buffer */}
        <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#f1f5f9]">
          <div className="flex items-center justify-between text-xs font-semibold text-[#475569] mb-1.5">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              Absentee Buffer
            </span>
            <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              +{params.absenteeismBuffer}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={params.absenteeismBuffer}
            onChange={(e) => onChangeParam("absenteeismBuffer", Number(e.target.value))}
            className="w-full accent-amber-600 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#94a3b8] mt-1">
            <span>0%</span>
            <span>5% (Std)</span>
            <span>20%</span>
          </div>
        </div>

        {/* Section Filter */}
        <div className="bg-[#f8fafc] p-3 rounded-xl border border-[#f1f5f9] flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#475569] mb-1.5">
            <Filter className="w-3.5 h-3.5 text-purple-500" />
            <span>Floor Section</span>
          </div>
          <select
            value={params.sectionFilter}
            onChange={(e) => onChangeParam("sectionFilter", e.target.value)}
            className="w-full py-1.5 px-2.5 text-xs font-semibold bg-white border border-[#cbd5e1] rounded-lg text-[#0f172a] focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all cursor-pointer"
          >
            {allSections.map((sec) => (
              <option key={sec} value={sec}>
                {sec === "All" ? "All Sections (Full Garment)" : sec}
              </option>
            ))}
          </select>
          <div className="text-[10px] text-[#94a3b8] mt-1">
            Filter Line Operations
          </div>
        </div>
      </div>
    </div>
  );
}
