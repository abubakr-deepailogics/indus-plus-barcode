import { getPool, WORKERS_VIEW, ATTENDANCE_VIEW } from "@/lib/db";
import type { SkillGrade } from "../types";

export interface RawEmployee {
  EmployeeID: number | string;
  FirstName: string;
  DesignationName?: string;
  DepartmentName?: string;
  ParentDepartment?: string;
  isDummy?: boolean;
}

// Low-grade / Low-skill simulated workers for AI replacement demonstrations
export const DUMMY_LOW_SKILL_WORKERS: RawEmployee[] = [
  {
    EmployeeID: "DUMMY-901",
    FirstName: "TARIQ MEHMOOD (TRAINEE)",
    DesignationName: "HELPER / UNTRAINED",
    DepartmentName: "SEWING FLOOR",
    isDummy: true,
  },
  {
    EmployeeID: "DUMMY-902",
    FirstName: "ZAHID HUSSAIN (NOVICE)",
    DesignationName: "JUNIOR APPRENTICE",
    DepartmentName: "FINISHING",
    isDummy: true,
  },
  {
    EmployeeID: "DUMMY-903",
    FirstName: "KAMRAN SHAH (UNSKILLED)",
    DesignationName: "FLOOR HELPER",
    DepartmentName: "CUTTING",
    isDummy: true,
  },
];

// In-memory cache for fast interactive simulations
let cachedEmployees: RawEmployee[] | null = null;
let cachedAttendanceRates: Map<string, number> | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getActiveWorkerPool(): Promise<RawEmployee[]> {
  const now = Date.now();
  if (cachedEmployees && now - cacheTime < CACHE_TTL_MS) {
    return cachedEmployees;
  }

  try {
    const pool = await getPool("hrms");
    const result = await pool.request().query(`
      SELECT 
        EmployeeID,
        FirstName,
        DesignationName,
        DepartmentName,
        ParentDepartment
      FROM ${WORKERS_VIEW}
      WHERE EmpStatus = 'Active'
      ORDER BY FirstName ASC
    `);

    cachedEmployees = result.recordset || [];
    cacheTime = now;
    return cachedEmployees;
  } catch (error) {
    console.error("Failed to fetch active workers from HRMS pool:", error);
    // Return fallback pool if HRMS is unreachable
    return [];
  }
}

export async function getAttendanceReliabilityMap(): Promise<Map<string, number>> {
  if (cachedAttendanceRates) {
    return cachedAttendanceRates;
  }

  const map = new Map<string, number>();
  try {
    const pool = await getPool("hrms");
    // Count attendance days in the last 60 days
    const result = await pool.request().query(`
      SELECT 
        EmployeeID,
        COUNT(DISTINCT ShiftInDate) as PresentDays
      FROM ${ATTENDANCE_VIEW}
      WHERE ShiftInDate >= DATEADD(day, -60, GETDATE())
      GROUP BY EmployeeID
    `);

    const maxDays = Math.max(1, ...result.recordset.map((r: { PresentDays: number }) => r.PresentDays || 0));

    for (const row of result.recordset) {
      const rate = Math.min(100, Math.round(((row.PresentDays || 0) / maxDays) * 100));
      map.set(String(row.EmployeeID), Math.max(70, rate));
    }
  } catch (error) {
    console.warn("Could not query attendance records, using default reliability scores:", error);
  }

  cachedAttendanceRates = map;
  return map;
}

/**
 * Derives a realistic Skill Grade (A+, A, B, C) and base efficiency % from worker designation and ID
 */
export function deriveWorkerProfile(emp: RawEmployee): {
  skillGrade: SkillGrade;
  baseEfficiency: number;
  tags: string[];
} {
  if (emp.isDummy) {
    return {
      skillGrade: "C",
      baseEfficiency: 68,
      tags: ["Novice / Low Skill", "High Cycle Variance", "Bottleneck Risk"],
    };
  }

  const desig = (emp.DesignationName || "").toUpperCase();
  const idNum = Number(emp.EmployeeID) || 10000;
  
  // Deterministic pseudo-random variation based on worker ID
  const hashMod = (idNum * 17) % 25; // 0 to 24

  if (desig.includes("SPECIAL") || desig.includes("SENIOR") || desig.includes("MASTER") || desig.includes("SUPERVISOR")) {
    return {
      skillGrade: hashMod > 18 ? "A+" : "A",
      baseEfficiency: 98 + (hashMod % 18), // 98% - 115%
      tags: ["High Complexity Operator", "Master Quality", "Fast Setup"],
    };
  }

  if (desig.includes("OPERATOR") || desig.includes("TAILOR") || desig.includes("PRESSMAN") || desig.includes("CHECKER")) {
    if (hashMod > 16) {
      return {
        skillGrade: "A",
        baseEfficiency: 90 + (hashMod % 12), // 90% - 101%
        tags: ["Experienced Operator", "Consistent Pace"],
      };
    } else if (hashMod > 6) {
      return {
        skillGrade: "B",
        baseEfficiency: 82 + (hashMod % 10), // 82% - 91%
        tags: ["Standard Operator", "Good Attendance"],
      };
    } else {
      return {
        skillGrade: "C",
        baseEfficiency: 75 + (hashMod % 8), // 75% - 82%
        tags: ["Developing Operator", "Requires Supervision"],
      };
    }
  }

  // Default helper / semi-skilled
  return {
    skillGrade: hashMod > 15 ? "B" : "C",
    baseEfficiency: 78 + (hashMod % 10),
    tags: ["Versatile Floor Support"],
  };
}
