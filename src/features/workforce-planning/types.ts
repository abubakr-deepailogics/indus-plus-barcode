export type SkillGrade = "A+" | "A" | "B" | "C";

export interface AvailableWorkOrder {
  workOrder: string;
  saleOrderNo?: string;
  customerName?: string;
  totalOperations: number;
  totalSmv: number;
  totalCutQuantity?: number;
  sections: string[];
}

export interface WorkerCandidate {
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  skillGrade: SkillGrade;
  matchScore: number; // 0 - 100%
  efficiencyRating: number; // e.g., 95%
  attendanceReliability: number; // 0 - 100%
  experienceInOperation: boolean;
  matchReasons: string[];
}

export interface OperationWorkforcePlan {
  rowId: number;
  operationCode: string;
  operationName: string;
  section: string;
  operationSequence: number;
  machineType?: string;
  smv: number;
  pieceRate: number;
  skillLevelRequired: string; // e.g. "Skilled", "Semi-Skilled"
  orderQuantity: number;
  
  // Industrial Engineering Calculations & Predictions
  theoreticalWorkers: number;
  allocatedWorkers: number;
  cycleTimeSeconds: number;
  targetHourlyOutput: number;
  isBottleneck: boolean;
  bottleneckSeverity?: "high" | "medium" | "low";
  suggestedAction?: string;

  // Assigned Workers
  primaryWorker: WorkerCandidate;
  backupWorker?: WorkerCandidate;

  // AI Skill Mismatch & Replacement
  isSkillMismatch?: boolean;
  mismatchReason?: string;
  isDummyWorker?: boolean;
  suggestedReplacement?: WorkerCandidate;
}

export interface LineBalancingMetrics {
  totalOperations: number;
  totalSmv: number;
  totalOrderQuantity: number;
  totalAllocatedWorkers: number;
  theoreticalMinWorkers: number;
  lineBalancingEfficiency: number; // e.g., 88.5%
  pitchTimeMinutes: number;
  pitchTimeSeconds: number;
  bottleneckOperation: {
    code: string;
    name: string;
    smv: number;
    allocatedWorkers: number;
    stationCycleTime: number;
  };
  targetDailyOutput: number;
  predictedDaysToComplete: number;
  totalEstimatedLabourHours: number;
  totalMismatches?: number;
}

export interface DailyTimelinePoint {
  dayNumber: number;
  dateStr: string;
  plannedOutput: number;
  cumulativeOutput: number;
  completionPercentage: number;
  milestone?: string;
}

export interface WorkforceSimulationParams {
  workOrder: string;
  targetDays?: number; // target completion days
  shiftHours?: number; // default 8 hours
  targetEfficiency?: number; // default 85%
  absenteeismBuffer?: number; // default 5%
  sectionFilter?: string; // "All" or specific section
  customQuantity?: number; // optional custom order quantity
}

export interface WorkforcePredictionResponse {
  workOrder: string;
  saleOrderNo?: string;
  customerName?: string;
  totalQuantity: number;
  isCustomQuantity?: boolean;
  parametersUsed: {
    targetDays: number;
    shiftHours: number;
    targetEfficiency: number;
    absenteeismBuffer: number;
    sectionFilter: string;
    orderQuantity: number;
  };
  metrics: LineBalancingMetrics;
  operations: OperationWorkforcePlan[];
  timeline: DailyTimelinePoint[];
  generatedAt: string;
}
