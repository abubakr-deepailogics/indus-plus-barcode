"use client";

import React from "react";
import { Printer, X } from "lucide-react";
import type { WorkforcePredictionResponse } from "../types";

interface PrintLinePlanModalProps {
  prediction: WorkforcePredictionResponse;
  onClose: () => void;
}

export function PrintLinePlanModal({ prediction, onClose }: PrintLinePlanModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="p-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-bold text-[#0f172a]">
              Line Layout & Operator Assignment Sheet — {prediction.workOrder}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 overflow-y-auto flex-1 text-black font-sans text-xs print:p-0">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                INDUS PLUS LIMITED
              </h1>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                Industrial Engineering — Line Layout & Workforce Assignment
              </h2>
              <span className="text-[10px] text-slate-500">
                Generated: {new Date(prediction.generatedAt).toLocaleString()}
              </span>
            </div>

            <div className="text-right text-xs">
              <div><span className="font-bold">Work Order:</span> {prediction.workOrder}</div>
              <div><span className="font-bold">Customer:</span> {prediction.customerName || "Export"}</div>
              <div><span className="font-bold">Total Quantity:</span> {prediction.totalQuantity.toLocaleString()} Pcs</div>
            </div>
          </div>

          {/* IE Summary Metrics */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-lg mb-4 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Workforce</span>
              <span className="text-sm font-black text-slate-900">{prediction.metrics.totalAllocatedWorkers} Operators</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Pitch Time</span>
              <span className="text-sm font-black text-slate-900">{prediction.metrics.pitchTimeSeconds}s ({prediction.metrics.pitchTimeMinutes}m)</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Line Efficiency</span>
              <span className="text-sm font-black text-slate-900">{prediction.metrics.lineBalancingEfficiency}%</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Target Timeline</span>
              <span className="text-sm font-black text-slate-900">{prediction.parametersUsed.targetDays} Days ({prediction.metrics.targetDailyOutput.toLocaleString()} pcs/day)</span>
            </div>
          </div>

          {/* Detailed Assignment Table */}
          <table className="w-full border-collapse border border-slate-300 text-left mb-6 text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                <th className="p-2 border border-slate-300 w-8 text-center">Seq</th>
                <th className="p-2 border border-slate-300">Operation Name</th>
                <th className="p-2 border border-slate-300 w-24">Section</th>
                <th className="p-2 border border-slate-300 w-16 text-right">SMV</th>
                <th className="p-2 border border-slate-300 w-16 text-center">Workers</th>
                <th className="p-2 border border-slate-300 w-20 text-right">Cycle Time</th>
                <th className="p-2 border border-slate-300">Primary Assigned Operator</th>
                <th className="p-2 border border-slate-300">Backup Operator</th>
              </tr>
            </thead>
            <tbody>
              {prediction.operations.map((op) => (
                <tr key={op.rowId} className="border-b border-slate-200">
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{op.operationSequence}</td>
                  <td className="p-1.5 border border-slate-300 font-medium">
                    {op.operationName}
                    <span className="block text-[9px] text-slate-500 font-mono">{op.operationCode} {op.machineType ? `(${op.machineType})` : ""}</span>
                  </td>
                  <td className="p-1.5 border border-slate-300">{op.section}</td>
                  <td className="p-1.5 border border-slate-300 text-right font-mono">{op.smv}m</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{op.allocatedWorkers}</td>
                  <td className="p-1.5 border border-slate-300 text-right font-mono">{op.cycleTimeSeconds}s</td>
                  <td className="p-1.5 border border-slate-300">
                    <span className="font-bold">{op.primaryWorker.employeeName}</span>
                    <span className="block text-[9px] text-slate-500">#{op.primaryWorker.employeeId} • Grade {op.primaryWorker.skillGrade} ({op.primaryWorker.matchScore}% Match)</span>
                  </td>
                  <td className="p-1.5 border border-slate-300 text-[10px]">
                    {op.backupWorker ? (
                      <>
                        <span className="font-semibold">{op.backupWorker.employeeName}</span>
                        <span className="block text-[9px] text-slate-500">#{op.backupWorker.employeeId}</span>
                      </>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-300 text-center text-xs font-semibold text-slate-700">
            <div>
              <div className="border-b border-slate-400 h-10 mb-1"></div>
              <span>IE Line Planner</span>
            </div>
            <div>
              <div className="border-b border-slate-400 h-10 mb-1"></div>
              <span>Floor Production Incharge</span>
            </div>
            <div>
              <div className="border-b border-slate-400 h-10 mb-1"></div>
              <span>Factory Manager</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
