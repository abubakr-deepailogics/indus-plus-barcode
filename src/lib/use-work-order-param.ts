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
 * `onWorkOrder` fires once, on mount, with the resolved Work Order (URL
 * param wins over the global value) — the page uses it to seed and trigger
 * its own search. Call the returned `setWorkOrder` from the page's own
 * "commit search" handler(s) to propagate a newly searched Work Order.
 */
export function useWorkOrderParam(onWorkOrder: (workOrder: string) => void) {
  const router = useRouter();
  const pathname = usePathname();
  const { workOrder: globalWorkOrder, setWorkOrder: setGlobalWorkOrder } =
    useWorkOrder();

  const onWorkOrderRef = useRef(onWorkOrder);
  useEffect(() => {
    onWorkOrderRef.current = onWorkOrder;
  });

  // Resolve once per page mount. Deliberately not re-run when
  // globalWorkOrder changes afterwards — once the user is on this page,
  // their own searches here are the source of truth, not a search that
  // just happened to fire on another page while this one stayed mounted.
  useEffect(() => {
    const urlWorkOrder =
      new URLSearchParams(window.location.search).get(PARAM) || "";
    const resolved = urlWorkOrder || globalWorkOrder;
    if (!resolved) return;

    if (resolved !== globalWorkOrder) setGlobalWorkOrder(resolved);
    if (resolved !== urlWorkOrder) {
      router.replace(
        `${pathname}?${PARAM}=${encodeURIComponent(resolved)}`,
        { scroll: false },
      );
    }
    onWorkOrderRef.current(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
