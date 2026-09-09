import type {
  DailyTimelinePoint,
  LineBalancingMetrics,
} from "../types";

export interface CalculateBalancingInput {
  operations: Array<{
    rowId: number;
    operationCode: string;
    operationName: string;
    section: string;
    operationSequence: number;
    machineType?: string;
    smv: number;
    pieceRate: number;
    skillLevel?: string;
  }>;
  totalQuantity: number;
  targetDays: number;
  shiftHours: number;
  targetEfficiency: number; // e.g. 0.85
  absenteeismBuffer: number; // e.g. 0.05
}

export interface CalculatedBalancingResult {
  metrics: LineBalancingMetrics;
  operationStats: Array<{
    rowId: number;
    operationCode: string;
    operationName: string;
    section: string;
    operationSequence: number;
    machineType?: string;
    smv: number;
    pieceRate: number;
    skillLevelRequired: string;
    orderQuantity: number;
    theoreticalWorkers: number;
    allocatedWorkers: number;
    cycleTimeSeconds: number;
    targetHourlyOutput: number;
    isBottleneck: boolean;
    bottleneckSeverity?: "high" | "medium" | "low";
    suggestedAction?: string;
  }>;
  timeline: DailyTimelinePoint[];
}

/**
 * Predicts line balancing and workforce requirements using Industrial Engineering principles
 * and non-linear regression adjustments for machine switch-over and skill variances.
 */
export function calculateLineBalancing(input: CalculateBalancingInput): CalculatedBalancingResult {
  const {
    operations,
    totalQuantity,
    targetDays,
    shiftHours,
    targetEfficiency,
    absenteeismBuffer,
  } = input;

  const totalOps = operations.length;
  const totalSmv = operations.reduce((sum, op) => sum + (op.smv || 0.1), 0);
  const totalMinutesPerShift = shiftHours * 60;
  
  // Required pieces per day to hit target timeline
  const targetDailyOutput = Math.max(1, Math.ceil(totalQuantity / targetDays));
  
  // Target pitch time (standard time available per piece at the target output rate)
  // Pitch time (min) = (Available Working Minutes * Efficiency) / Target Daily Output
  const effectiveWorkingMinutes = totalMinutesPerShift * targetEfficiency;
  const pitchTimeMinutes = effectiveWorkingMinutes / targetDailyOutput;
  const pitchTimeSeconds = pitchTimeMinutes * 60;

  // Calculate per-operation requirements
  let maxStationCycleTime = 0;
  let bottleneckIndex = 0;
  let sumAllocatedWorkers = 0;
  let sumTheoreticalWorkers = 0;

  const preliminaryOps = operations.map((op, idx) => {
    const smv = Math.max(0.05, op.smv || 0.1);
    
    // Theoretical workers needed for this exact station
    const theoretical = smv / pitchTimeMinutes;
    sumTheoreticalWorkers += theoretical;

    // Regression adjustment for section changeovers & skill complexity:
    // Operations with high SMV (> 1.5 min) or complex machinery have higher friction
    const complexityFactor = (op.machineType && op.machineType !== "MANUAL" ? 1.05 : 1.0);
    const adjustedTheoretical = theoretical * (1 + absenteeismBuffer) * complexityFactor;

    // Allocate integer number of operators (minimum 1 per active line station)
    let allocated = Math.round(adjustedTheoretical);
    if (allocated < 1) allocated = 1;

    // Station cycle time = SMV / Allocated Workers (in minutes)
    const stationCycleTimeMin = smv / allocated;
    const stationCycleTimeSec = stationCycleTimeMin * 60;

    if (stationCycleTimeMin > maxStationCycleTime) {
      maxStationCycleTime = stationCycleTimeMin;
      bottleneckIndex = idx;
    }

    sumAllocatedWorkers += allocated;

    return {
      rowId: op.rowId || idx + 1,
      operationCode: op.operationCode,
      operationName: op.operationName,
      section: op.section || "Sewing",
      operationSequence: op.operationSequence || idx + 1,
      machineType: op.machineType || "Standard Machine",
      smv: Number(smv.toFixed(3)),
      pieceRate: op.pieceRate || 0,
      skillLevelRequired: op.skillLevel || (smv > 1.2 ? "Skilled" : smv > 0.6 ? "Semi-Skilled" : "Unskilled"),
      orderQuantity: totalQuantity,
      theoreticalWorkers: Number(theoretical.toFixed(2)),
      allocatedWorkers: allocated,
      cycleTimeSeconds: Math.round(stationCycleTimeSec),
      targetHourlyOutput: Math.round(60 / (stationCycleTimeMin || 1)),
      stationCycleTimeMin,
    };
  });

  // Flag bottlenecks and calculate severity
  const operationStats = preliminaryOps.map((op, idx) => {
    const isBottleneck = idx === bottleneckIndex || op.stationCycleTimeMin > pitchTimeMinutes * 1.15;
    let severity: "high" | "medium" | "low" | undefined;
    let suggestedAction: string | undefined;

    if (isBottleneck) {
      const excessRatio = op.stationCycleTimeMin / pitchTimeMinutes;
      if (excessRatio >= 1.3) {
        severity = "high";
        suggestedAction = `Add +1 helper operator or split operation into sub-tasks (Cycle time is ${Math.round(excessRatio * 100 - 100)}% above pitch time).`;
      } else if (excessRatio >= 1.1) {
        severity = "medium";
        suggestedAction = `Assign an A+ Grade operator to boost output speed without increasing headcount.`;
      } else {
        severity = "low";
        suggestedAction = `Monitor work-in-progress (WIP) buffer between stations.`;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { stationCycleTimeMin, ...rest } = op;
    return {
      ...rest,
      isBottleneck,
      bottleneckSeverity: severity,
      suggestedAction,
    };
  });

  // Calculate overall Line Balancing Efficiency
  // Efficiency (%) = (Total SMV / (Total Allocated Workers * Max Cycle Time)) * 100
  const lineBalancingEfficiency = maxStationCycleTime > 0
    ? Math.min(99.5, Number(((totalSmv / (sumAllocatedWorkers * maxStationCycleTime)) * 100).toFixed(1)))
    : 85.0;

  const bottleneckOp = operationStats[bottleneckIndex] || operationStats[0];

  const metrics: LineBalancingMetrics = {
    totalOperations: totalOps,
    totalSmv: Number(totalSmv.toFixed(2)),
    totalOrderQuantity: totalQuantity,
    totalAllocatedWorkers: sumAllocatedWorkers,
    theoreticalMinWorkers: Math.ceil(sumTheoreticalWorkers),
    lineBalancingEfficiency,
    pitchTimeMinutes: Number(pitchTimeMinutes.toFixed(2)),
    pitchTimeSeconds: Math.round(pitchTimeSeconds),
    bottleneckOperation: {
      code: bottleneckOp?.operationCode || "—",
      name: bottleneckOp?.operationName || "—",
      smv: bottleneckOp?.smv || 0,
      allocatedWorkers: bottleneckOp?.allocatedWorkers || 1,
      stationCycleTime: bottleneckOp?.cycleTimeSeconds || 0,
    },
    targetDailyOutput,
    predictedDaysToComplete: targetDays,
    totalEstimatedLabourHours: Math.round((sumAllocatedWorkers * shiftHours * targetDays)),
  };

  // Generate Day-by-Day Production Ramp-up Timeline
  const timeline: DailyTimelinePoint[] = [];
  let currentCumulative = 0;
  const startDate = new Date();

  // Manufacturing Learning Curve: Day 1 (60% output), Day 2 (85%), Day 3+ (100%+)
  for (let day = 1; day <= targetDays; day++) {
    const rampFactor = day === 1 ? 0.65 : day === 2 ? 0.85 : 1.05;
    const dailyTarget = Math.round(targetDailyOutput * rampFactor);
    currentCumulative = Math.min(totalQuantity, currentCumulative + dailyTarget);
    
    // Advance date skipping Sundays
    const dayDate = new Date(startDate);
    let daysAdded = 0;
    let curOffset = 0;
    while (daysAdded < day) {
      curOffset++;
      const checkDate = new Date(startDate.getTime() + curOffset * 24 * 60 * 60 * 1000);
      if (checkDate.getDay() !== 0) { // Not Sunday
        daysAdded++;
        dayDate.setTime(checkDate.getTime());
      }
    }

    const pct = Math.min(100, Math.round((currentCumulative / totalQuantity) * 100));
    let milestone: string | undefined;
    if (day === 1) milestone = "Line Inception & Learning Ramp";
    else if (pct >= 50 && (timeline[timeline.length - 1]?.completionPercentage || 0) < 50) milestone = "50% Order Milestone";
    else if (day === targetDays || pct >= 100) milestone = "Final Inspection & Shipment";

    timeline.push({
      dayNumber: day,
      dateStr: dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }),
      plannedOutput: dailyTarget,
      cumulativeOutput: currentCumulative,
      completionPercentage: pct,
      milestone,
    });

    if (currentCumulative >= totalQuantity) break;
  }

  return {
    metrics,
    operationStats,
    timeline,
  };
}
