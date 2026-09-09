"use client";

import React, { useState } from "react";
import {
  Brain,
  Printer,
  AlertCircle,
  Download,
} from "lucide-react";
import { useWorkforcePlanning } from "../hooks/useWorkforcePlanning";
import { WorkOrderSelectorCard } from "./WorkOrderSelectorCard";
import { SimulationControls } from "./SimulationControls";
import { LineBalancingMetricsCard } from "./LineBalancingMetricsCard";
import { OperationWorkforceTable } from "./OperationWorkforceTable";
import { TimelineGanttChart } from "./TimelineGanttChart";
import { PrintLinePlanModal } from "./PrintLinePlanModal";

export function WorkforcePlanningDashboard() {
  const {
    availableOrders,
    selectedOrder,
    setSelectedOrder,
    activeOrderDetails,
    isLoadingOrders,
    params,
    updateParam,
    prediction,
    isPredicting,
    error,
    replaceWorker,
    optimizeAllWorkers,
    runPrediction,
  } = useWorkforcePlanning();

  const [showPrintModal, setShowPrintModal] = useState(false);

  // CSV Export for IE departments
  const exportCsv = () => {
    if (!prediction) return;
    const headers = [
      "Seq",
      "Operation Code",
      "Operation Name",
      "Section",
      "Machine Type",
      "SMV",
      "Theoretical Workers",
      "Allocated Workers",
      "Cycle Time (sec)",
      "Target Hourly Output",
      "Is Bottleneck",
      "Primary Operator Name",
      "Primary Operator ID",
      "Skill Grade",
      "Match Score %",
      "Backup Operator Name",
      "Backup Operator ID",
    ];

    const rows = prediction.operations.map((op) => [
      op.operationSequence,
      `"${op.operationCode}"`,
      `"${op.operationName.replace(/"/g, '""')}"`,
      `"${op.section}"`,
      `"${op.machineType || ""}"`,
      op.smv,
      op.theoreticalWorkers,
      op.allocatedWorkers,
      op.cycleTimeSeconds,
      op.targetHourlyOutput,
      op.isBottleneck ? "YES" : "NO",
      `"${op.primaryWorker.employeeName}"`,
      op.primaryWorker.employeeId,
      op.primaryWorker.skillGrade,
      op.primaryWorker.matchScore,
      `"${op.backupWorker?.employeeName || ""}"`,
      op.backupWorker?.employeeId || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Line_Plan_${prediction.workOrder}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-indigo-500/30 text-indigo-200 backdrop-blur-xs border border-indigo-400/20">
              <Brain className="w-5 h-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Industrial Engineering AI Engine
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Predictive Workforce & Line Balancing
          </h1>
          <p className="text-xs text-indigo-200/90 mt-1 max-w-2xl leading-relaxed">
            Automate production line planning: predict required operators per operation, balance pitch times, detect bottlenecks, and assign the best-matched active floor operators using machine learning and skill matrices.
          </p>
        </div>

        {prediction && (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10 backdrop-blur-xs shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-900/40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Line Plan
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Work Order Selection */}
      <WorkOrderSelectorCard
        orders={availableOrders}
        selectedOrder={selectedOrder}
        onSelectOrder={setSelectedOrder}
        isLoading={isLoadingOrders}
        plannedQuantity={prediction?.totalQuantity}
      />

      {/* 2. Simulation Constraints & Sliders */}
      <SimulationControls
        params={params}
        availableSections={activeOrderDetails?.sections || []}
        defaultDbQuantity={activeOrderDetails?.totalCutQuantity}
        onChangeParam={updateParam}
        onRecalculate={() => runPrediction(selectedOrder)}
        isPredicting={isPredicting}
      />

      {/* 3. Predictive Output Metrics & Analysis */}
      {prediction && (
        <>
          <LineBalancingMetricsCard
            metrics={prediction.metrics}
            onOptimizeAll={optimizeAllWorkers}
          />
          
          {/* Operations & Worker Matching Table */}
          <OperationWorkforceTable
            operations={prediction.operations}
            onReplaceWorker={replaceWorker}
          />

          {/* Day-by-day Timeline Output Forecast */}
          <TimelineGanttChart
            timeline={prediction.timeline}
            totalQuantity={prediction.totalQuantity}
          />
        </>
      )}

      {/* Print Line Plan Modal */}
      {showPrintModal && prediction && (
        <PrintLinePlanModal
          prediction={prediction}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
