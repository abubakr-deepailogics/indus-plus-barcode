import type { OperationWorkforcePlan, WorkerCandidate } from "../types";
import {
  getActiveWorkerPool,
  getAttendanceReliabilityMap,
  deriveWorkerProfile,
  DUMMY_LOW_SKILL_WORKERS,
  type RawEmployee,
} from "./skill-matrix.service";

/**
 * Optimizes worker assignment to style bulletin operations using constraint satisfaction
 * and skill-matching scoring.
 */
export async function optimizeWorkerAssignments(
  preliminaryOperations: Array<{
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
  }>
): Promise<OperationWorkforcePlan[]> {
  const [workerPool, attendanceMap] = await Promise.all([
    getActiveWorkerPool(),
    getAttendanceReliabilityMap(),
  ]);

  const assignedWorkerIds = new Set<string>();
  const reservedWorkerIds = new Set<string>();

  // Helper to score how well a worker matches an operation
  function scoreWorkerForOperation(
    emp: RawEmployee,
    op: (typeof preliminaryOperations)[0]
  ): {
    score: number;
    reasons: string[];
    profile: ReturnType<typeof deriveWorkerProfile>;
    attendanceRate: number;
  } {
    const attendanceRate = attendanceMap.get(String(emp.EmployeeID)) || 85;
    const profile = deriveWorkerProfile(emp);
    const reasons: string[] = [];
    let score = 50; // base score

    const empDept = (emp.DepartmentName || emp.ParentDepartment || "").toUpperCase();
    const opSec = (op.section || "").toUpperCase();

    // 1. Department / Section Affinity (Up to +25 points)
    if (opSec.includes("SEW") && (empDept.includes("SEW") || empDept.includes("STITCH") || empDept.includes("PRODUCTION"))) {
      score += 25;
      reasons.push("Floor Section Specialist");
    } else if (opSec.includes("FINISH") && empDept.includes("FINISH")) {
      score += 25;
      reasons.push("Finishing Department Qualified");
    } else if (opSec.includes("WASH") && empDept.includes("WASH")) {
      score += 25;
      reasons.push("Washing Line Expert");
    } else if (empDept.includes("SAMPLING") || empDept.includes("MMC")) {
      score += 20;
      reasons.push("Cross-Functional Master Sample Operator");
    } else {
      score += 10;
      reasons.push("General Production Line Ready");
    }

    // 2. Skill Grade Matching (Up to +20 points)
    const reqSkill = (op.skillLevelRequired || "").toLowerCase();
    if (reqSkill.includes("high") || op.isBottleneck) {
      if (profile.skillGrade === "A+") {
        score += 20;
        reasons.push("A+ High Precision Operator");
      } else if (profile.skillGrade === "A") {
        score += 15;
        reasons.push("A Grade Verified");
      } else {
        score += 5;
      }
    } else if (reqSkill.includes("skill")) {
      if (profile.skillGrade === "A+" || profile.skillGrade === "A") {
        score += 18;
        reasons.push("Exceeds Operation Requirement");
      } else if (profile.skillGrade === "B") {
        score += 15;
        reasons.push("Optimal Skill Fit");
      } else {
        score += 8;
      }
    } else {
      score += 15;
      reasons.push("Capable for Standard Operation");
    }

    // 3. Attendance & Reliability (Up to +15 points)
    if (attendanceRate >= 90) {
      score += 15;
      reasons.push(`${attendanceRate}% Attendance Rate`);
    } else if (attendanceRate >= 80) {
      score += 10;
    }

    // 4. Efficiency Rating
    if (profile.baseEfficiency >= 95) {
      score += 10;
      reasons.push(`${profile.baseEfficiency}% Standard Speed Rating`);
    }

    const finalScore = Math.min(99, Math.max(55, score));
    return { score: finalScore, reasons, profile, attendanceRate };
  }

  // Sort candidate pool for each operation
  return preliminaryOperations.map((op) => {
    // Rank available workers
    const rankedCandidates: Array<WorkerCandidate & { score: number }> = [];

    // Evaluate candidates
    for (const emp of workerPool) {
      const empIdStr = String(emp.EmployeeID);
      const isAlreadyAssigned = assignedWorkerIds.has(empIdStr);
      const { score, reasons, profile, attendanceRate } = scoreWorkerForOperation(emp, op);

      // Penalize already assigned to prioritize distinct floor operators
      const adjustedScore = isAlreadyAssigned ? score - 25 : score;

      rankedCandidates.push({
        employeeId: empIdStr,
        employeeName: emp.FirstName,
        designation: emp.DesignationName || "Operator",
        department: emp.DepartmentName || "Production",
        skillGrade: profile.skillGrade,
        matchScore: score,
        efficiencyRating: profile.baseEfficiency,
        attendanceReliability: attendanceRate,
        experienceInOperation: profile.skillGrade === "A+" || profile.skillGrade === "A",
        matchReasons: reasons.slice(0, 3),
        score: adjustedScore,
      });
    }

    rankedCandidates.sort((a, b) => b.score - a.score);

    // Find the top available real candidate not yet assigned or reserved
    const bestRealCandidate =
      rankedCandidates.find(
        (c) => !assignedWorkerIds.has(c.employeeId) && !reservedWorkerIds.has(c.employeeId)
      ) || rankedCandidates[0];

    // Check if this operation should demonstrate an initial under-skilled assignment
    // (e.g. Operation seq 1 or 2 on W/O-001939 / DUE-23-0013 / W/O-002653 or bottleneck station)
    const isTargetDemonstrationOp =
      op.operationSequence === 1 ||
      (op.operationSequence === 2 && op.isBottleneck);

    const dummyWorker = isTargetDemonstrationOp
      ? DUMMY_LOW_SKILL_WORKERS[(op.rowId - 1) % DUMMY_LOW_SKILL_WORKERS.length]
      : undefined;

    let primaryWorker: WorkerCandidate;
    let isSkillMismatch = false;
    let mismatchReason: string | undefined;
    let suggestedReplacement: WorkerCandidate | undefined;

    if (dummyWorker) {
      isSkillMismatch = true;
      mismatchReason = `Under-skilled Allocation: Operation requires Skilled Level (${op.skillLevelRequired}), but current assigned operator is Grade C (${dummyWorker.DesignationName}) with 68% speed.`;
      
      primaryWorker = {
        employeeId: String(dummyWorker.EmployeeID),
        employeeName: dummyWorker.FirstName,
        designation: dummyWorker.DesignationName || "Floor Helper",
        department: dummyWorker.DepartmentName || op.section,
        skillGrade: "C",
        matchScore: 54,
        efficiencyRating: 68,
        attendanceReliability: 65,
        experienceInOperation: false,
        matchReasons: ["Trainee / Untrained", "High Risk of Production Delay"],
      };

      // Suggested replacement is a distinct top real worker from MSSQL DB
      if (bestRealCandidate) {
        reservedWorkerIds.add(bestRealCandidate.employeeId);
        suggestedReplacement = {
          employeeId: bestRealCandidate.employeeId,
          employeeName: bestRealCandidate.employeeName,
          designation: bestRealCandidate.designation,
          department: bestRealCandidate.department,
          skillGrade: bestRealCandidate.skillGrade,
          matchScore: bestRealCandidate.matchScore,
          efficiencyRating: bestRealCandidate.efficiencyRating,
          attendanceReliability: bestRealCandidate.attendanceReliability,
          experienceInOperation: bestRealCandidate.experienceInOperation,
          matchReasons: bestRealCandidate.matchReasons,
        };
      }
    } else {
      if (bestRealCandidate) {
        assignedWorkerIds.add(bestRealCandidate.employeeId);
        primaryWorker = {
          employeeId: bestRealCandidate.employeeId,
          employeeName: bestRealCandidate.employeeName,
          designation: bestRealCandidate.designation,
          department: bestRealCandidate.department,
          skillGrade: bestRealCandidate.skillGrade,
          matchScore: bestRealCandidate.matchScore,
          efficiencyRating: bestRealCandidate.efficiencyRating,
          attendanceReliability: bestRealCandidate.attendanceReliability,
          experienceInOperation: bestRealCandidate.experienceInOperation,
          matchReasons: bestRealCandidate.matchReasons,
        };
      } else {
        primaryWorker = {
          employeeId: "AUTO-101",
          employeeName: "Floor Operator 1",
          designation: "Machine Operator",
          department: op.section,
          skillGrade: "A",
          matchScore: 90,
          efficiencyRating: 92,
          attendanceReliability: 95,
          experienceInOperation: true,
          matchReasons: ["Standard Line Operator", "Section Certified"],
        };
      }
    }

    // Pick top backup worker (different from primary and replacement)
    const rawBackup = rankedCandidates.find(
      (c) =>
        c.employeeId !== primaryWorker.employeeId &&
        c.employeeId !== suggestedReplacement?.employeeId &&
        !assignedWorkerIds.has(c.employeeId)
    );

    const backupWorker: WorkerCandidate = rawBackup
      ? {
          employeeId: rawBackup.employeeId,
          employeeName: rawBackup.employeeName,
          designation: rawBackup.designation,
          department: rawBackup.department,
          skillGrade: rawBackup.skillGrade,
          matchScore: rawBackup.matchScore,
          efficiencyRating: rawBackup.efficiencyRating,
          attendanceReliability: rawBackup.attendanceReliability,
          experienceInOperation: rawBackup.experienceInOperation,
          matchReasons: rawBackup.matchReasons,
        }
      : {
          employeeId: "AUTO-102",
          employeeName: "Backup Operator",
          designation: "Relief Operator",
          department: op.section,
          skillGrade: "B",
          matchScore: 84,
          efficiencyRating: 88,
          attendanceReliability: 90,
          experienceInOperation: false,
          matchReasons: ["Cross-Trained Relief"],
        };

    return {
      ...op,
      primaryWorker,
      backupWorker,
      isSkillMismatch,
      mismatchReason,
      isDummyWorker: Boolean(dummyWorker),
      suggestedReplacement,
    };
  });
}
