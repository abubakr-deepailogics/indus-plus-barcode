"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "indus-plus:active-work-order";

interface WorkOrderContextValue {
  /** The most recently searched Work Order, shared across every page that
   * searches by Work Order (Cut Report, Style Bulletin, Coupon Generation,
   * Coupon Tracing). */
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
  // Lazy-initialize from localStorage (client only — guarded for SSR) so
  // hydrating this value doesn't require a setState-in-effect round trip;
  // nothing renders off this value directly, so there's nothing for a
  // server/client mismatch to affect.
  const [workOrder, setWorkOrderState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      // localStorage unavailable (private browsing, etc.) — fall back to
      // in-memory-only state for this session.
      return "";
    }
  });

  const setWorkOrder = useCallback((next: string) => {
    setWorkOrderState(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore — non-fatal if storage isn't available
    }
  }, []);

  return (
    <WorkOrderContext.Provider value={{ workOrder, setWorkOrder }}>
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
