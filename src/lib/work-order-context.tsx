"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useDepartment, type DepartmentKey } from "./department-context";

const storageKeyFor = (department: DepartmentKey) =>
  `indus-plus:active-work-order:${department}`;

interface WorkOrderContextValue {
  /** The most recently searched Work Order for the active department only. */
  workOrder: string;
  setWorkOrder: (workOrder: string) => void;
}

const WorkOrderContext = createContext<WorkOrderContextValue | undefined>(
  undefined,
);

/** Mounted once in the root layout so the value survives client-side
 * navigation between pages (the provider isn't remounted on route change).
 * Also mirrored to localStorage so it survives a hard refresh / new tab —
 * each page additionally syncs this against its own `?wo=` URL param via
 * `useWorkOrderParam`. */
export function WorkOrderProvider({ children }: { children: ReactNode }) {
  const { department } = useDepartment();
  // Lazy-initialize from localStorage (client only — guarded for SSR) so
  // hydrating this value doesn't require a setState-in-effect round trip;
  // nothing renders off this value directly, so there's nothing for a
  // server/client mismatch to affect.
  const [workOrders, setWorkOrders] = useState<
    Partial<Record<DepartmentKey, string>>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      return {
        sewing: window.localStorage.getItem(storageKeyFor("sewing")) || "",
        washing: window.localStorage.getItem(storageKeyFor("washing")) || "",
        finishing: window.localStorage.getItem(storageKeyFor("finishing")) || "",
        gdp: window.localStorage.getItem(storageKeyFor("gdp")) || "",
      };
    } catch {
      // localStorage unavailable (private browsing, etc.) — fall back to
      // in-memory-only state for this session.
      return {};
    }
  });

  const setWorkOrder = useCallback((next: string) => {
    setWorkOrders((previous) => ({ ...previous, [department]: next }));
    try {
      const key = storageKeyFor(department);
      if (next) window.localStorage.setItem(key, next);
      else window.localStorage.removeItem(key);
    } catch {
      // ignore — non-fatal if storage isn't available
    }
  }, [department]);

  return (
    <WorkOrderContext.Provider
      value={{ workOrder: workOrders[department] || "", setWorkOrder }}
    >
      {children}
    </WorkOrderContext.Provider>
  );
}

export function useWorkOrder(): WorkOrderContextValue {
  const ctx = useContext(WorkOrderContext);
  if (!ctx) {
    throw new Error("useWorkOrder must be used within a WorkOrderProvider");
  }
  return ctx;
}
