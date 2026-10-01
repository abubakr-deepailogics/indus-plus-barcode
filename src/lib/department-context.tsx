"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type DepartmentKey = "sewing" | "washing" | "finishing" | "gdp";

export interface DepartmentConfig {
  id: DepartmentKey;
  label: string;
  badge: string;
  description: string;
}

export const DEPARTMENTS: readonly DepartmentConfig[] = [
  {
    id: "sewing",
    label: "Sewing",
    badge: "Active",
    description:
      "Production bulletins, cutting, coupon scanning, tracing & reports",
  },
  {
    id: "washing",
    label: "Washing",
    badge: "Planned",
    description: "Washing recipes, lots, scanning & wash cycle tracking",
  },
  {
    id: "finishing",
    label: "Finishing",
    badge: "Planned",
    description: "Pre-finishing, finishing bulletins, packing & final audit",
  },
] as const;

const STORAGE_KEY = "indus-plus:active-department";

interface DepartmentContextValue {
  department: DepartmentKey;
  setDepartment: (dept: DepartmentKey) => void;
  departments: readonly DepartmentConfig[];
}

const DepartmentContext = createContext<DepartmentContextValue | undefined>(
  undefined,
);

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const [department, setDepartmentState] = useState<DepartmentKey>(() => {
    if (typeof window === "undefined") return "sewing";
    try {
      const saved = window.localStorage.getItem(
        STORAGE_KEY,
      ) as DepartmentKey | null;
      if (saved && ["sewing", "washing", "finishing", "gdp"].includes(saved)) {
        return saved;
      }
      return "sewing";
    } catch {
      return "sewing";
    }
  });

  const setDepartment = useCallback((next: DepartmentKey) => {
    setDepartmentState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return (
    <DepartmentContext.Provider
      value={{ department, setDepartment, departments: DEPARTMENTS }}
    >
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment(): DepartmentContextValue {
  const ctx = useContext(DepartmentContext);
  if (!ctx) {
    throw new Error("useDepartment must be used within a DepartmentProvider");
  }
  return ctx;
}
