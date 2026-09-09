"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Users,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  Clock,
  ShieldCheck,
  UserCheck,
  ArrowRightLeft,
  UserX,
  Zap,
} from "lucide-react";
import type { OperationWorkforcePlan, SkillGrade } from "../types";

interface OperationWorkforceTableProps {
  operations: OperationWorkforcePlan[];
  onReplaceWorker?: (rowId: number) => void;
}

function SkillGradeBadge({ grade }: { grade: SkillGrade }) {
  const colors: Record<SkillGrade, string> = {
    "A+": "bg-purple-100 text-purple-700 border-purple-200",
    A: "bg-indigo-100 text-indigo-700 border-indigo-200",
    B: "bg-blue-100 text-blue-700 border-blue-200",
    C: "bg-rose-100 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-2xs ${
        colors[grade] || colors.B
      }`}
    >
      Grade {grade}
    </span>
  );
}

export function OperationWorkforceTable({
  operations,
  onReplaceWorker,
}: OperationWorkforceTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  const sections = useMemo(() => {
    return ["All", ...Array.from(new Set(operations.map((op) => op.section).filter(Boolean)))];
  }, [operations]);

  const filtered = useMemo(() => {
    return operations.filter((op) => {
      const matchesSearch =
        op.operationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        op.operationCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        op.primaryWorker.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(op.primaryWorker.employeeId).includes(searchQuery);

      const matchesSection = sectionFilter === "All" || op.section === sectionFilter;
      return matchesSearch && matchesSection;
    });
  }, [operations, searchQuery, sectionFilter]);

  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      {/* Table Header & Controls */}
      <div className="p-5 border-b border-[#f1f5f9] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">
              Operation Line Plan & Worker Assignments ({filtered.length} Operations)
            </h3>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">
            Real-time skill matching from HRMS active workforce mapped to style bulletin operations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search operation or worker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-[#94a3b8]"
            />
          </div>

          {/* Section Filter */}
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="py-1.5 px-3 text-xs font-semibold bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#0f172a] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
          >
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                {sec === "All" ? "All Sections" : sec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Operations Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
              <th className="py-3 px-4 w-12 text-center">Seq</th>
              <th className="py-3 px-4">Operation & Machine</th>
              <th className="py-3 px-3">Section</th>
              <th className="py-3 px-3 text-right">SMV</th>
              <th className="py-3 px-3 text-center">Theoretical / Allocated</th>
              <th className="py-3 px-3 text-right">Cycle Time</th>
              <th className="py-3 px-4">Primary Assigned Operator</th>
              <th className="py-3 px-4">AI Replacement / Backup</th>
              <th className="py-3 px-3 text-center w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9] text-xs">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-xs text-[#94a3b8]">
                  No operations match the selected criteria.
                </td>
              </tr>
            ) : (
              filtered.map((op) => {
                const isExpanded = expandedRowId === op.rowId;
                return (
                  <React.Fragment key={op.rowId}>
                    <tr
                      className={`hover:bg-[#f8fafc]/80 transition-colors cursor-pointer ${
                        op.isSkillMismatch
                          ? "bg-rose-500/[0.04] border-l-4 border-l-rose-500"
                          : op.isBottleneck
                          ? "bg-amber-500/[0.03]"
                          : ""
                      }`}
                      onClick={() => setExpandedRowId(isExpanded ? null : op.rowId)}
                    >
                      {/* Sequence */}
                      <td className="py-3 px-4 text-center font-bold text-[#64748b]">
                        {op.operationSequence}
                      </td>

                      {/* Operation & Machine */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#0f172a]">{op.operationName}</span>
                              {op.isSkillMismatch ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                                  <UserX className="w-3 h-3 text-rose-600" />
                                  Skill Deficit
                                </span>
                              ) : op.isBottleneck ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                  <AlertTriangle className="w-3 h-3" />
                                  Bottleneck
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#64748b] mt-0.5">
                              <span className="font-mono text-[#94a3b8]">{op.operationCode}</span>
                              {op.machineType && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-[#475569]">
                                    <Cpu className="w-3 h-3 text-[#94a3b8]" />
                                    {op.machineType}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Section */}
                      <td className="py-3 px-3">
                        <span className="text-[11px] font-semibold bg-[#f1f5f9] text-[#475569] px-2 py-1 rounded-md">
                          {op.section}
                        </span>
                      </td>

                      {/* SMV */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#0f172a]">
                        {op.smv}m
                      </td>

                      {/* Theoretical / Allocated */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="text-[11px] text-[#94a3b8] font-mono">
                            {op.theoreticalWorkers}
                          </span>
                          <span className="text-xs text-[#cbd5e1]">➔</span>
                          <span className="font-extrabold text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                            {op.allocatedWorkers} Op{op.allocatedWorkers > 1 ? "s" : ""}
                          </span>
                        </div>
                      </td>

                      {/* Cycle Time */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-[#0f172a]">
                          {op.cycleTimeSeconds}s
                        </div>
                        <div className="text-[10px] text-[#94a3b8]">
                          {op.targetHourlyOutput} pcs/hr
                        </div>
                      </td>

                      {/* Primary Assigned Worker */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                              op.isSkillMismatch
                                ? "bg-rose-100 text-rose-700"
                                : "bg-indigo-100 text-indigo-700"
                            }`}
                          >
                            {op.primaryWorker.employeeName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${
                                  op.isSkillMismatch ? "text-rose-950 font-extrabold" : "text-[#0f172a]"
                                }`}
                              >
                                {op.primaryWorker.employeeName}
                              </span>
                              <SkillGradeBadge grade={op.primaryWorker.skillGrade} />
                            </div>
                            <div className="text-[10px] text-[#64748b] flex items-center gap-2 mt-0.5">
                              <span>#{op.primaryWorker.employeeId}</span>
                              <span>•</span>
                              <span
                                className={`font-semibold ${
                                  op.isSkillMismatch ? "text-rose-600" : "text-emerald-600"
                                }`}
                              >
                                {op.primaryWorker.matchScore}% Match
                              </span>
                              <span>•</span>
                              <span className="text-indigo-600 font-semibold">
                                {op.primaryWorker.efficiencyRating}% Speed
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* AI Suggested Replacement / Backup Worker */}
                      <td className="py-3 px-4">
                        {op.isSkillMismatch && op.suggestedReplacement ? (
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  AI Suggested:
                                </span>
                                <span className="font-bold text-xs text-[#0f172a]">
                                  {op.suggestedReplacement.employeeName}
                                </span>
                                <SkillGradeBadge grade={op.suggestedReplacement.skillGrade} />
                              </div>
                              <span className="text-[10px] text-[#64748b] block mt-0.5">
                                #{op.suggestedReplacement.employeeId} • {op.suggestedReplacement.matchScore}% Match ({op.suggestedReplacement.efficiencyRating}% Speed)
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onReplaceWorker) onReplaceWorker(op.rowId);
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                              Replace
                            </button>
                          </div>
                        ) : op.backupWorker ? (
                          <div className="text-[11px]">
                            <div className="font-semibold text-[#475569] flex items-center gap-1.5">
                              <span>{op.backupWorker.employeeName}</span>
                              <SkillGradeBadge grade={op.backupWorker.skillGrade} />
                            </div>
                            <span className="text-[10px] text-[#94a3b8]">
                              #{op.backupWorker.employeeId} ({op.backupWorker.matchScore}% match)
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#94a3b8]">—</span>
                        )}
                      </td>

                      {/* Expand Toggle */}
                      <td className="py-3 px-3 text-center text-[#94a3b8]">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                        <td colSpan={9} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* AI Match Reasons & Replacement Details */}
                            <div
                              className={`p-3 rounded-xl border ${
                                op.isSkillMismatch
                                  ? "bg-rose-50/50 border-rose-200"
                                  : "bg-white border-[#e2e8f0]"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>AI Operator Allocation Evaluation</span>
                                </div>
                                {op.isSkillMismatch && (
                                  <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                    Deficit Detected
                                  </span>
                                )}
                              </div>

                              {op.isSkillMismatch && op.suggestedReplacement ? (
                                <div className="space-y-2">
                                  <div className="p-2 bg-rose-100/60 rounded-lg text-[11px] text-rose-900 leading-snug">
                                    <strong>Current Deficit:</strong> {op.mismatchReason}
                                  </div>
                                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-950">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold flex items-center gap-1">
                                        <Zap className="w-3.5 h-3.5 text-emerald-600" />
                                        Recommended Real DB Operator:
                                      </span>
                                      <SkillGradeBadge grade={op.suggestedReplacement.skillGrade} />
                                    </div>
                                    <div className="font-bold text-xs mt-1">
                                      {op.suggestedReplacement.employeeName} (#{op.suggestedReplacement.employeeId})
                                    </div>
                                    <div className="text-[10px] text-emerald-700 mt-0.5">
                                      {op.suggestedReplacement.efficiencyRating}% Speed • {op.suggestedReplacement.attendanceReliability}% Attendance • {op.suggestedReplacement.matchReasons.join(", ")}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => onReplaceWorker && onReplaceWorker(op.rowId)}
                                      className="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-98"
                                    >
                                      <ArrowRightLeft className="w-3.5 h-3.5" />
                                      Upgrade to {op.suggestedReplacement.employeeName} (Grade A+)
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <ul className="space-y-1 text-[11px] text-[#475569]">
                                  {op.primaryWorker.matchReasons.map((reason, idx) => (
                                    <li key={idx} className="flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                      <span>{reason}</span>
                                    </li>
                                  ))}
                                  <li className="flex items-center gap-1.5">
                                    <UserCheck className="w-3 h-3 text-blue-500 shrink-0" />
                                    <span>{op.primaryWorker.attendanceReliability}% 60-day attendance consistency</span>
                                  </li>
                                </ul>
                              )}
                            </div>

                            {/* Line Engineering Details */}
                            <div className="bg-white p-3 rounded-xl border border-[#e2e8f0]">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a] mb-2">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                <span>Station IE Diagnostics</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div>
                                  <span className="text-[#94a3b8] block">Required Skill:</span>
                                  <span className="font-semibold text-[#0f172a]">{op.skillLevelRequired}</span>
                                </div>
                                <div>
                                  <span className="text-[#94a3b8] block">Piece Rate:</span>
                                  <span className="font-semibold text-[#0f172a]">
                                    {op.pieceRate > 0 ? `PKR ${op.pieceRate}` : "Standard SMV"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[#94a3b8] block">Hourly Capacity:</span>
                                  <span className="font-semibold text-[#0f172a]">{op.targetHourlyOutput} pcs / station</span>
                                </div>
                                <div>
                                  <span className="text-[#94a3b8] block">Order Target:</span>
                                  <span className="font-semibold text-[#0f172a]">{op.orderQuantity.toLocaleString()} pcs</span>
                                </div>
                              </div>
                            </div>

                            {/* Bottleneck Recommendation */}
                            <div className="bg-white p-3 rounded-xl border border-[#e2e8f0]">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                <span>Line Balancing Action</span>
                              </div>
                              <p className="text-[11px] text-[#475569] leading-relaxed">
                                {op.suggestedAction ||
                                  "Station cycle time aligns with target pitch time. Maintain standard work-in-progress (WIP) flow."}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
