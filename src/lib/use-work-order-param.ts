"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkOrder } from "./work-order-context";

const PARAM = "wo";

/**
 * Keeps a page's Work Order search synced with both the global
 * WorkOrderContext and this page's own `?wo=` URL param, so that:
 *  - committing a search here carries the Work Order to Cut Report, Style
 *    Bulletin, Coupon Generation and Coupon Tracing, and
 *  - a direct link or refresh with `?wo=...` on any of those pages still
 *    auto-loads that Work Order.
 *
 * Reads `window.location.search` directly (rather than `useSearchParams`)
 * so this doesn't require a Suspense boundary around these pages.
 *
 * `onWorkOrder` receives the resolved Work Order on mount and browser
 * history navigation (the URL is authoritative). The page uses it to seed
 * and trigger its own search. Call the returned `setWorkOrder` from the page's own
 * "commit search" handler(s) to propagate a newly searched Work Order.
 */
export function useWorkOrderParam(onWorkOrder: (workOrder: string) => void) {
  const router = useRouter();
  const pathname = usePathname();
  const { workOrder: globalWorkOrder, setWorkOrder: setGlobalWorkOrder } =
    useWorkOrder();

  const onWorkOrderRef = useRef(onWorkOrder);
  const globalWorkOrderRef = useRef(globalWorkOrder);
  useEffect(() => {
    onWorkOrderRef.current = onWorkOrder;
  });
  useEffect(() => {
    globalWorkOrderRef.current = globalWorkOrder;
  }, [globalWorkOrder]);

  // Resolve on mount and browser history navigation. Page-owned searches
  // already update their local view and the URL; this listener covers
  // Back/Forward, where the page may remain mounted while `?wo=` changes.
  useEffect(() => {
    const syncFromUrl = () => {
      const resolved =
        new URLSearchParams(window.location.search).get(PARAM)?.trim() || "";

      // The URL is authoritative. An absent `wo` is an explicit clear,
      // never an invitation to restore an old department-local value.
      if (resolved !== globalWorkOrderRef.current) {
        setGlobalWorkOrder(resolved);
      }
      onWorkOrderRef.current(resolved);
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [setGlobalWorkOrder]);

  const setWorkOrder = useCallback(
    (workOrder: string) => {
      setGlobalWorkOrder(workOrder);
      router.replace(
        workOrder
          ? `${pathname}?${PARAM}=${encodeURIComponent(workOrder)}`
          : pathname,
        { scroll: false },
      );
    },
    [pathname, router, setGlobalWorkOrder],
  );

  return { setWorkOrder };
}
