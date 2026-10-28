"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel from "embla-carousel-react";
import ExcelJS from "exceljs";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Pin,
  PinOff,
  Plus,
  Printer,
  Scissors,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ModulePageHeader } from "@/components/ModulePageHeader";
import {
  WorkOrderSearchModal,
  type WorkOrderSearchRow,
} from "@/components/work-order-search-modal";
import { useWorkOrderParam } from "@/lib/use-work-order-param";
import type {
  CutPlanRow,
  CutPlanningData,
  CutPlanningInseamGroup,
} from "../types";

const today = () => new Date().toISOString().slice(0, 10);
const numeric = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const displayNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
const displayPrintNumber = (value: number | null | undefined) =>
  value == null || value === 0 ? "" : displayNumber(value);
const preventWheelChange = (event: React.WheelEvent<HTMLInputElement>) =>
  event.currentTarget.blur();
const shortenFabricName = (value: string, limit = 30) =>
  value.length > limit ? `${value.slice(0, limit).trimEnd()}..` : value;
const shadeCodes = (value: string) => {
  const shade = value.trim().toUpperCase();
  return /^[A-Z]{2,}$/.test(shade) ? [...new Set(shade)] : [shade || "UNSHADED"];
};
const matrixSizeColumnId = (group: CutPlanningInseamGroup, size: string) =>
  `size-${group.inseam ?? "none"}-${size}`;
const matrixInseamBoundaryClass = (
  group: CutPlanningInseamGroup,
  size: string,
) => {
  if (size === group.sizeColumns[0]) {
    return "!border-l-[3px] !border-l-slate-400";
  }
  if (size === group.sizeColumns[group.sizeColumns.length - 1]) {
    return "!border-r-[3px] !border-r-slate-400";
  }
  return "";
};

function makePlan(group: CutPlanningInseamGroup): CutPlanRow {
  return {
    sourceInseam: group.inseam,
    planDate: today(),
    sizeQuantities: Object.fromEntries(
      group.sizeColumns.map((size) => [size, 0]),
    ),
    reCutQty: 0,
    markerNo: "",
    cutNo: "",
    markerPlies: 0,
    shrinkage: "",
    shade: "",
    calculatedRequired: null,
    markerWidthCm: null,
    markerLengthM: null,
  };
}

export default function CutPlanningPage() {
  const [workOrder, setWorkOrder] = useState("");
  const [data, setData] = useState<CutPlanningData | null>(null);
  const [plans, setPlans] = useState<CutPlanRow[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingRowId, setDeletingRowId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "plan"; index: number; group: CutPlanningInseamGroup }
    | { type: "marker-set"; rowIndex: number }
    | null
  >(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [selectedBundleCut, setSelectedBundleCut] = useState("");
  const [shadeQuantities, setShadeQuantities] = useState<Record<string, string>>({});
  const [shadeCutNos, setShadeCutNos] = useState<Record<string, string>>({});
  const [bundleCutMenuOpen, setBundleCutMenuOpen] = useState(false);
  const [bundleCutMenuPosition, setBundleCutMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 256,
  });
  const [bundleQty, setBundleQty] = useState("");
  const [generatingBundles, setGeneratingBundles] = useState(false);
  const [showBundlePreview, setShowBundlePreview] = useState(false);
  const [bundlePreviewIdentity, setBundlePreviewIdentity] = useState<{
    nextSequence: number;
    bundleIdPrefix: string;
  } | null>(null);
  const [selectedFabricItem, setSelectedFabricItem] = useState("");
  const [selectedFabricWorkOrder, setSelectedFabricWorkOrder] = useState("");
  const [fabricMenuOpen, setFabricMenuOpen] = useState(false);
  const [newMarkerRowIndex, setNewMarkerRowIndex] = useState<number | null>(
    null,
  );
  const [activeInseamTotalIndex, setActiveInseamTotalIndex] = useState(0);
  const matrixRef = useRef<HTMLElement>(null);
  const matrixScrollRef = useRef<HTMLDivElement>(null);
  const matrixFooterRef = useRef<HTMLDivElement>(null);
  const totalsRef = useRef<HTMLElement>(null);
  const totalsCarouselViewportRef = useRef<HTMLDivElement>(null);
  const totalsCarouselTransitioningRef = useRef(false);
  const fabricMenuRef = useRef<HTMLDivElement>(null);
  const bundleCutButtonRef = useRef<HTMLButtonElement>(null);
  const bundleCutMenuRef = useRef<HTMLDivElement>(null);
  const newMarkerRowRef = useRef<HTMLTableRowElement>(null);
  const [matrixMaxHeight, setMatrixMaxHeight] = useState<number | null>(null);
  const [pinnedMatrixColumnIds, setPinnedMatrixColumnIds] = useState<string[]>(
    [],
  );
  const [totalsCarouselRef, totalsCarouselApi] = useEmblaCarousel({
    align: "start",
    duration: 25,
    loop: true,
  });
  const setTotalsCarouselViewport = useCallback(
    (node: HTMLDivElement | null) => {
      totalsCarouselViewportRef.current = node;
      totalsCarouselRef(node);
    },
    [totalsCarouselRef],
  );

  useEffect(() => {
    const updateMatrixHeight = () => {
      const matrixTop = matrixRef.current?.getBoundingClientRect().top;
      const totalsTop = totalsRef.current?.getBoundingClientRect().top;
      if (matrixTop == null || totalsTop == null) return;
      const footerHeight = matrixFooterRef.current?.offsetHeight ?? 0;
      // Reserve both the Add marker row footer and a fixed gap above totals.
      // Only the grid body can grow; extra rows therefore scroll inside it.
      setMatrixMaxHeight(
        Math.max(0, Math.floor(totalsTop - matrixTop - footerHeight - 20)),
      );
    };

    updateMatrixHeight();
    const observer = new ResizeObserver(updateMatrixHeight);
    if (matrixRef.current) observer.observe(matrixRef.current);
    if (matrixFooterRef.current) observer.observe(matrixFooterRef.current);
    if (totalsRef.current) observer.observe(totalsRef.current);
    window.addEventListener("resize", updateMatrixHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMatrixHeight);
    };
  }, [data]);

  useEffect(() => {
    const closeFabricMenu = (event: PointerEvent) => {
      if (!fabricMenuRef.current?.contains(event.target as Node)) {
        setFabricMenuOpen(false);
      }
      if (
        !bundleCutButtonRef.current?.contains(event.target as Node) &&
        !bundleCutMenuRef.current?.contains(event.target as Node)
      ) {
        setBundleCutMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeFabricMenu);
    return () => window.removeEventListener("pointerdown", closeFabricMenu);
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const leaveMessage = "Leave Cut Planning? Any unsaved changes will be lost.";
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname) return;
      if (window.confirm(leaveMessage)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  const load = useCallback(async (candidate: string) => {
    const wo = candidate.trim();
    setWorkOrder(wo);
    setError("");
    setNotice("");
    if (!wo) {
      setData(null);
      setPlans([]);
      setIsDirty(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/cut-planning?work_order=${encodeURIComponent(wo)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as CutPlanningData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Failed to load cut planning.");
      setData(body);
      // Every ERP Inseam gets a planning row, even if other Inseams already
      // have saved rows. This keeps the single grid complete and in order.
      const initialPlans = body.inseamGroups.flatMap((group) => {
        const saved = body.plans.filter(
          (plan) => plan.sourceInseam === group.inseam,
        );
        return saved.length ? saved : [makePlan(group)];
      });
      setPlans(initialPlans);
      setIsDirty(false);
      if (!body.metadata)
        setNotice("No size-wise ERP rows were found for this Work Order.");
    } catch (caught) {
      setData(null);
      setPlans([]);
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to load cut planning.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const { setWorkOrder: setSharedWorkOrder } = useWorkOrderParam(load);
  const fetchWorkOrderRows = useCallback(
    async (filters: {
      workOrder: string;
      customer: string;
      saleOrderNo: string;
    }): Promise<WorkOrderSearchRow[]> => {
      const params = new URLSearchParams();
      if (filters.workOrder) params.set("work_order", filters.workOrder);
      if (filters.customer) params.set("customer", filters.customer);
      if (filters.saleOrderNo) params.set("sale_order_no", filters.saleOrderNo);
      const response = await fetch(
        `/api/cut-planning/work-orders?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as WorkOrderSearchRow[] & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Failed to search work orders.");
      return body;
    },
    [],
  );
  const sourceGroups = useMemo(() => data?.inseamGroups ?? [], [data]);
  const sizeColumns = useMemo(
    () =>
      [...new Set(sourceGroups.flatMap((group) => group.sizeColumns))].sort(
        (a, b) =>
          Number(a) - Number(b) ||
          a.localeCompare(b, undefined, { numeric: true }),
      ),
    [sourceGroups],
  );
  const groups = useMemo(
    () => sourceGroups.map((group) => ({ ...group, sizeColumns })),
    [sizeColumns, sourceGroups],
  );
  const groupedPlans = useMemo(
    () =>
      groups.map((group) => ({
        group,
        rows: plans
          .map((plan, index) => ({ plan, index }))
          .filter(({ plan }) => plan.sourceInseam === group.inseam),
      })),
    [groups, plans],
  );
  const printInseamPairs = useMemo(
    () =>
      Array.from({ length: Math.ceil(groupedPlans.length / 2) }, (_, index) =>
        groupedPlans.slice(index * 2, index * 2 + 2),
      ),
    [groupedPlans],
  );
  const matrixColumnOrder = useMemo(
    () => [
      "date",
      "marker-no",
      "cut-no",
      ...groups.flatMap((group) =>
        group.sizeColumns.map((size) => matrixSizeColumnId(group, size)),
      ),
      "re-cut",
      "total",
      "marker-plies",
      "transaction-count",
      "shrinkage",
      "shade",
      "calculated-required",
      "marker-width",
      "marker-length",
      "actions",
    ],
    [groups],
  );
  const isMatrixColumnPinned = (columnId: string) =>
    pinnedMatrixColumnIds.includes(columnId);
  const matrixPinSide = useCallback(
    (columnId: string) =>
      matrixColumnOrder.indexOf(columnId) >
      (matrixColumnOrder.length - 1) / 2
        ? "right"
        : "left",
    [matrixColumnOrder],
  );
  const toggleMatrixColumnPin = (columnId: string) => {
    setPinnedMatrixColumnIds((current) => {
      const next = current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId];
      return matrixColumnOrder.filter((id) => next.includes(id));
    });
  };
  const matrixCellProps = (
    columnId: string,
    className: string,
    type: "body" | "header" = "body",
  ) => ({
    "data-pin-column": columnId,
    "data-pin-side": matrixPinSide(columnId),
    className: `${className} ${
      isMatrixColumnPinned(columnId)
        ? type === "header"
          ? `sticky z-30 bg-slate-100 ${matrixPinSide(columnId) === "left" ? "shadow-[2px_0_3px_-3px_rgb(15_23_42)]" : "shadow-[-2px_0_3px_-3px_rgb(15_23_42)]"}`
          : `sticky z-20 ${matrixPinSide(columnId) === "left" ? "shadow-[2px_0_3px_-3px_rgb(15_23_42)]" : "shadow-[-2px_0_3px_-3px_rgb(15_23_42)]"}`
        : ""
    }`,
  });
  const matrixPinButton = (columnId: string, label: string) => {
    const pinned = isMatrixColumnPinned(columnId);
    return (
      <button
        type="button"
        onClick={() => toggleMatrixColumnPin(columnId)}
        className={`rounded p-0.5 transition hover:bg-slate-300/70 ${
          pinned ? "text-indigo-700" : "text-slate-400 hover:text-slate-700"
        }`}
        aria-label={`${pinned ? "Unpin" : "Pin"} ${label} column`}
        title={`${pinned ? "Unpin" : "Pin"} column`}
      >
        {pinned ? <PinOff className="size-3" /> : <Pin className="size-3" />}
      </button>
    );
  };

  useLayoutEffect(() => {
    const table = matrixScrollRef.current?.querySelector("table");
    if (!table) return;

    const updatePinnedOffsets = () => {
      const cells = Array.from(
        table.querySelectorAll<HTMLElement>("[data-pin-column]"),
      );
      cells.forEach((cell) => {
        cell.style.left = "";
        cell.style.right = "";
      });

      const setOffsets = (columnIds: string[], side: "left" | "right") => {
        let offset = 0;
        for (const columnId of columnIds) {
          const columnCells = cells.filter(
            (cell) => cell.dataset.pinColumn === columnId,
          );
          const width = columnCells[0]?.getBoundingClientRect().width ?? 0;
          columnCells.forEach((cell) => {
            cell.style[side] = `${offset}px`;
          });
          offset += width;
        }
      };

      const leftPinnedColumns = pinnedMatrixColumnIds.filter(
        (columnId) => matrixPinSide(columnId) === "left",
      );
      const rightPinnedColumns = pinnedMatrixColumnIds.filter(
        (columnId) => matrixPinSide(columnId) === "right",
      );
      setOffsets(leftPinnedColumns, "left");
      // Right offsets start with the outermost right column, then build inward.
      setOffsets([...rightPinnedColumns].reverse(), "right");
    };

    updatePinnedOffsets();
    const observer = new ResizeObserver(updatePinnedOffsets);
    observer.observe(table);
    return () => observer.disconnect();
  }, [matrixColumnOrder, matrixPinSide, pinnedMatrixColumnIds]);
  const materialSummaries = useMemo(() => {
    const byAccessCode = new Map<string, string[]>();
    for (const { accessCode, itemName } of data?.metadata?.accessItems ?? []) {
      const items = byAccessCode.get(accessCode) ?? [];
      if (!items.includes(itemName)) items.push(itemName);
      byAccessCode.set(accessCode, items);
    }
    return [...byAccessCode.entries()].map(([accessCode, itemNames]) => ({
      accessCode,
      itemNames,
    }));
  }, [data?.metadata?.accessItems]);
  const activeFabricItem =
    selectedFabricWorkOrder === data?.metadata?.workOrder
      ? selectedFabricItem
      : "";
  const printHeaderDetails = [
    { label: "DATE", value: data?.metadata?.workOrderDate ?? "" },
    { label: "GROUP", value: materialSummaries[0]?.accessCode ?? "" },
    { label: "ORDER #", value: data?.metadata?.workOrder ?? "" },
    {
      label: "STYLE",
      value: [
        data?.metadata?.styleNo,
        data?.metadata?.styleCode,
        data?.metadata?.styleName,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    { label: "CUSTOMER", value: data?.metadata?.customerName ?? "" },
    { label: "COLOR", value: data?.metadata?.color ?? "" },
    {
      label: "FABRIC",
      value: activeFabricItem || materialSummaries[0]?.itemNames[0] || "",
    },
  ];
  const bundleCutOptions = useMemo(() => {
    const cuts = new Map<string, number>();
    for (const plan of plans) {
      const cutNo = plan.cutNo.trim();
      if (!cutNo) continue;
      const transactionQty = Object.values(plan.sizeQuantities).reduce((sum, qty) => sum + qty, 0) * plan.markerPlies;
      cuts.set(cutNo, (cuts.get(cutNo) ?? 0) + transactionQty);
    }
    return [...cuts.entries()]
      .map(([cutNo, transactionQty]) => ({ cutNo, transactionQty }))
      .sort((a, b) =>
        a.cutNo.localeCompare(b.cutNo, undefined, { numeric: true }),
      );
  }, [plans]);
  const selectedBundleTotal = bundleCutOptions.find(({ cutNo }) => cutNo === selectedBundleCut)?.transactionQty ?? 0;
  const toggleBundleCutMenu = () => {
    if (bundleCutMenuOpen) {
      setBundleCutMenuOpen(false);
      return;
    }

    const buttonBounds = bundleCutButtonRef.current?.getBoundingClientRect();
    if (!buttonBounds) return;
    const viewportPadding = 8;
    const spaceBelow = window.innerHeight - buttonBounds.bottom - viewportPadding;
    const spaceAbove = buttonBounds.top - viewportPadding;
    const maxHeight = Math.min(256, Math.max(120, Math.max(spaceBelow, spaceAbove)));
    const opensUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
    const top = opensUpward
      ? Math.max(viewportPadding, buttonBounds.top - maxHeight - viewportPadding)
      : buttonBounds.bottom + viewportPadding;

    setBundleCutMenuPosition({
      top,
      left: Math.max(
        viewportPadding,
        Math.min(buttonBounds.left, window.innerWidth - buttonBounds.width - viewportPadding),
      ),
      width: buttonBounds.width,
      maxHeight,
    });
    setBundleCutMenuOpen(true);
  };
  const selectedMarkerPlies = Math.max(
    0,
    ...plans
      .filter((plan) => plan.cutNo.trim() === selectedBundleCut)
      .map((plan) => plan.markerPlies),
  );
  const selectedShadeCodes = useMemo(() => [...new Set(plans
    .filter((plan) => plan.cutNo.trim() === selectedBundleCut)
    .flatMap((plan) => shadeCodes(plan.shade)))], [plans, selectedBundleCut]);
  const requiresShadeSplit = selectedShadeCodes.length > 1;
  const effectiveShadeQuantities = useMemo(() =>
    selectedShadeCodes.map((shade) => ({
      shade,
      quantity: requiresShadeSplit
        ? numeric(shadeQuantities[shade] ?? "")
        : selectedBundleTotal,
      cutNo: requiresShadeSplit
        ? (shadeCutNos[shade] ?? `${selectedBundleCut}${shade}`).trim()
        : selectedBundleCut,
    })),
  [requiresShadeSplit, selectedBundleCut, selectedBundleTotal, selectedShadeCodes, shadeCutNos, shadeQuantities]);
  const shadePlyTotal = effectiveShadeQuantities.reduce((sum, allocation) => sum + allocation.quantity, 0);
  const hasShadeSplit = requiresShadeSplit;
  const splitCutNamesAreValid = !requiresShadeSplit || (
    effectiveShadeQuantities.every((allocation) => allocation.quantity > 0 && allocation.cutNo) &&
    new Set(effectiveShadeQuantities.map((allocation) => allocation.cutNo.toLocaleLowerCase())).size === effectiveShadeQuantities.length
  );
  const bundlePreview = useMemo(() => {
    const qty = Number(bundleQty);
    if (!hasShadeSplit && (!Number.isFinite(qty) || qty <= 0)) return [];
    const sourceRows = plans.flatMap((plan) => {
      const cutNo = plan.cutNo.trim();
      if (!cutNo || cutNo !== selectedBundleCut) return [];
      return Object.entries(plan.sizeQuantities).flatMap(([size, sizeQty]) => {
        const total = sizeQty * plan.markerPlies;
        if (total <= 0) return [];
        return [{
          cutNo,
          inseam: plan.sourceInseam,
          size,
          qty: total,
          shade: plan.shade,
          shrinkage: plan.shrinkage,
        }];
      });
    });
    if (!hasShadeSplit) {
      const rows = sourceRows.flatMap((source) => {
        const bundles: Array<typeof source> = [];
        let remaining = source.qty;
        while (remaining > 0) {
          const bundleAmount = Math.min(qty, remaining);
          bundles.push({ ...source, qty: bundleAmount });
          remaining -= bundleAmount;
        }
        return bundles;
      });
      return rows.map((row, index) => ({
        ...row,
        previewId: bundlePreviewIdentity
          ? `${bundlePreviewIdentity.bundleIdPrefix}-${String(bundlePreviewIdentity.nextSequence + index).padStart(4, "0")}`
          : "Loading…",
        color: data?.metadata?.color || "—",
      }));
    }
    const rows = sourceRows.flatMap((source) =>
      effectiveShadeQuantities
        .filter(({ quantity }) => quantity > 0)
        .map(({ shade, quantity, cutNo }) => ({
          ...source,
          shade,
          cutNo,
          qty: source.qty * (quantity / selectedMarkerPlies),
        })),
    );
    return rows.map((row, index) => ({
      ...row,
      previewId: bundlePreviewIdentity
        ? `${bundlePreviewIdentity.bundleIdPrefix}-${String(bundlePreviewIdentity.nextSequence + index).padStart(4, "0")}`
        : "Loading…",
      color: data?.metadata?.color || "—",
    }));
  }, [bundlePreviewIdentity, bundleQty, data?.metadata?.color, effectiveShadeQuantities, hasShadeSplit, plans, selectedBundleCut, selectedMarkerPlies]);
  const bundlePreviewTotal = bundlePreview.reduce((sum, row) => sum + row.qty, 0);
  const bundlePreviewByCut = useMemo(() => {
    const summaries = new Map<string, { bundleCount: number; quantity: number }>();
    for (const row of bundlePreview) {
      const summary = summaries.get(row.cutNo) ?? { bundleCount: 0, quantity: 0 };
      summary.bundleCount += 1;
      summary.quantity += row.qty;
      summaries.set(row.cutNo, summary);
    }
    return [...summaries.entries()].map(([cutNo, summary]) => ({
      cutNo,
      ...summary,
    }));
  }, [bundlePreview]);
  const bundlePreviewUniqueCounts = useMemo(
    () => ({
      inseams: new Set(bundlePreview.map((row) => row.inseam ?? "—")).size,
      sizes: new Set(bundlePreview.map((row) => row.size)).size,
      shades: new Set(bundlePreview.map((row) => row.shade || "UNSHADED")).size,
      shrinkages: new Set(bundlePreview.map((row) => row.shrinkage || "—")).size,
    }),
    [bundlePreview],
  );

  const update = (index: number, patch: Partial<CutPlanRow>) =>
    (setIsDirty(true), setPlans((current) =>
      current.map((plan, planIndex) =>
        planIndex === index ? { ...plan, ...patch } : plan,
      ),
    ));
  // Size cells in the combined inseam matrix can be edited in quick
  // succession. Build the new size map from React's current state rather
  // than the render that installed the event handler; otherwise a change in
  // another inseam can replace this row with an older size map.
  const updateSize = (index: number, size: string, value: string) =>
    (setIsDirty(true), setPlans((current) =>
      current.map((plan, planIndex) =>
        planIndex === index
          ? {
              ...plan,
              sizeQuantities: {
                ...plan.sizeQuantities,
                [size]: numeric(value),
              },
            }
          : plan,
      ),
    ));
  const updateMatrixSize = (
    group: CutPlanningInseamGroup,
    rowIndex: number,
    size: string,
    value: string,
  ) =>
    (setIsDirty(true), setPlans((current) => {
      const groupPlanIndexes = current
        .map((plan, index) => ({ plan, index }))
        .filter(({ plan }) => plan.sourceInseam === group.inseam)
        .map(({ index }) => index);
      const existingIndex = groupPlanIndexes[rowIndex];

      if (existingIndex !== undefined) {
        return current.map((plan, index) =>
          index === existingIndex
            ? {
                ...plan,
                sizeQuantities: {
                  ...plan.sizeQuantities,
                  [size]: numeric(value),
                },
              }
            : plan,
        );
      }

      // The combined matrix can have a row because another inseam has more
      // marker rows. Make that matching row for this inseam on first edit,
      // rather than leaving its cells as inert blanks.
      const additions = Array.from(
        { length: rowIndex - groupPlanIndexes.length + 1 },
        () => makePlan(group),
      );
      const lastAddition = additions.length - 1;
      additions[lastAddition] = {
        ...additions[lastAddition],
        sizeQuantities: {
          ...additions[lastAddition].sizeQuantities,
          [size]: numeric(value),
        },
      };
      return [...current, ...additions];
    }));
  const add = (group: CutPlanningInseamGroup) => {
    setIsDirty(true);
    setPlans((current) => [...current, makePlan(group)]);
  };
  const addOnEnter = (
    event: React.KeyboardEvent<HTMLInputElement>,
    group: CutPlanningInseamGroup,
  ) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add(group);
  };
  const remove = (index: number, group: CutPlanningInseamGroup) => {
    setIsDirty(true);
    setPlans((current) => {
      const remaining = current.filter((_, planIndex) => planIndex !== index);
      return remaining.some((plan) => plan.sourceInseam === group.inseam)
        ? remaining
        : [...remaining, makePlan(group)];
    });
  };

  async function deleteRow(index: number, group: CutPlanningInseamGroup) {
    const plan = plans[index];
    if (!plan) return;
    if (!plan.id) {
      remove(index, group);
      setPendingDelete(null);
      return;
    }
    setDeletingRowId(plan.id);
    setError("");
    try {
      const response = await fetch(
        `/api/cut-planning?work_order=${encodeURIComponent(workOrder)}&id=${plan.id}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Failed to remove planning row.");
      remove(index, group);
      setIsDirty(false);
      setPendingDelete(null);
      setNotice(body.message || "Planning row removed.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to remove planning row.",
      );
    } finally {
      setDeletingRowId(null);
    }
  }

  const hasRowData = (plan: CutPlanRow) =>
    Object.values(plan.sizeQuantities).some((value) => value > 0) ||
    plan.reCutQty > 0 ||
    plan.markerPlies > 0 ||
    plan.calculatedRequired != null ||
    plan.markerWidthCm != null ||
    plan.markerLengthM != null ||
    Boolean(
      plan.markerNo.trim() ||
      plan.cutNo.trim() ||
      plan.shrinkage.trim() ||
      plan.shade.trim(),
    );
  const renderPrintPlanningGrid = (
    entries: Array<{
      group: CutPlanningInseamGroup;
      rows: Array<{ plan: CutPlanRow; index: number }>;
    }>,
  ) => {
    const rowsByCut = new Map<
      string,
      { firstIndex: number; plansByInseam: Map<number, CutPlanRow[]> }
    >();
    entries.forEach(({ rows }, inseamIndex) => {
      rows.forEach(({ plan, index }) => {
        if (!hasRowData(plan)) return;
        const cutNo = plan.cutNo.trim();
        const key = cutNo ? `cut:${cutNo}` : `row:${inseamIndex}:${index}`;
        const row = rowsByCut.get(key) ?? {
          firstIndex: index,
          plansByInseam: new Map<number, CutPlanRow[]>(),
        };
        row.firstIndex = Math.min(row.firstIndex, index);
        const inseamPlans = row.plansByInseam.get(inseamIndex) ?? [];
        inseamPlans.push(plan);
        row.plansByInseam.set(inseamIndex, inseamPlans);
        rowsByCut.set(key, row);
      });
    });
    const printRows = [...rowsByCut.values()].sort(
      (left, right) => left.firstIndex - right.firstIndex,
    );
    return (
      <section className="cut-planning-print-sheet">
        <table className="cut-planning-print-table cut-planning-print-planning-grid">
          <thead>
            <tr>
              <th rowSpan={3}>SR</th>
              <th rowSpan={3}>TOTAL PCS</th>
              <th rowSpan={3}>SHRINKAGE</th>
              <th rowSpan={3}>PLYS</th>
              <th rowSpan={3}>CUT #</th>
              <th rowSpan={3}>BUNDLE</th>
              {entries.map(({ group }) => (
                <th key={group.inseam ?? "none"} className="print-inseam-label" colSpan={group.sizeColumns.length}>INSEAM</th>
              ))}
            </tr>
            <tr>
              {entries.map(({ group }) => (
                <th key={group.inseam ?? "none"} className="print-inseam-value" colSpan={group.sizeColumns.length}>{group.inseam ?? "-"}</th>
              ))}
            </tr>
            <tr>{entries.flatMap(({ group }) => group.sizeColumns.map((size) => <th key={`${group.inseam}-${size}`}>{size}</th>))}</tr>
          </thead>
          <tbody>
            {printRows.map((printRow, displayIndex) => {
              const plansForRow = entries.map(({ group }, inseamIndex) => ({
                group,
                plans: printRow.plansByInseam.get(inseamIndex) ?? [],
              }));
              const basePlan = plansForRow.find(({ plans }) => plans[0])?.plans[0];
              const total = plansForRow.reduce(
                (sum, { group, plans: inseamPlans }) => sum + group.sizeColumns.reduce(
                  (sizeSum, size) => sizeSum + inseamPlans.reduce(
                    (planSum, plan) => planSum + (plan.sizeQuantities[size] || 0),
                    0,
                  ),
                  0,
                ),
                0,
              );
              if (!basePlan) return null;
              // The printed block represents only its displayed inseams, so
              // its cut quantity and bundle range must use that same scope.
              const transactionTotal = total;
              return (
                <tr key={basePlan.id ?? `print-grid-row-${printRow.firstIndex}`}>
                  <td>{displayIndex + 1}</td>
                  <td>{displayPrintNumber(transactionTotal * basePlan.markerPlies)}</td>
                  <td>{basePlan.shrinkage || "-"}</td>
                  <td>{displayPrintNumber(basePlan.markerPlies)}</td>
                  <td>{basePlan.cutNo || "-"}</td>
                  <td>{transactionTotal ? `1 - ${displayNumber(transactionTotal)}` : ""}</td>
                  {plansForRow.flatMap(({ group, plans: inseamPlans }) => group.sizeColumns.map((size) => <td key={`${group.inseam}-${size}`}>{displayPrintNumber(inseamPlans.reduce((sum, plan) => sum + (plan.sizeQuantities[size] || 0), 0))}</td>))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  };

  const requestRemove = (index: number, group: CutPlanningInseamGroup) => {
    if (hasRowData(plans[index])) setPendingDelete({ type: "plan", index, group });
    else void deleteRow(index, group);
  };
  const inseamTotals = useMemo(
    () =>
      groups.map((group) => {
        const order = Object.fromEntries(
          sizeColumns.map((size) => [size, group.orderQuantities[size] || 0]),
        ) as Record<string, number>;
        const willCut = Object.fromEntries(
          sizeColumns.map((size) => [
            size,
            group.willCutQuantities[size] || 0,
          ]),
        ) as Record<string, number>;
        const planned: Record<string, number> = Object.fromEntries(
          sizeColumns.map((size) => [size, 0]),
        );

        for (const plan of plans) {
          if (plan.sourceInseam !== group.inseam) continue;
          for (const size of sizeColumns) {
            planned[size] +=
              (plan.sizeQuantities[size] || 0) * plan.markerPlies;
          }
        }

        const less = Object.fromEntries(
          sizeColumns.map((size) => {
            const difference = planned[size] - willCut[size];
            return [size, difference < 0 ? difference : 0];
          }),
        ) as Record<string, number>;
        const over = Object.fromEntries(
          sizeColumns.map((size) => {
            const difference = planned[size] - willCut[size];
            return [size, difference > 0 ? difference : 0];
          }),
        ) as Record<string, number>;

        return {
          inseam: group.inseam,
          rows: [
            { label: "Order", values: order },
            { label: "Will be cut", values: willCut },
            { label: "Planned", values: planned },
            { label: "Less", values: less },
            { label: "Over", values: over },
          ],
        };
      }),
    [groups, plans, sizeColumns],
  );
  useEffect(() => {
    if (!totalsCarouselApi) return;

    const updateActiveInseam = () =>
      setActiveInseamTotalIndex(totalsCarouselApi.selectedScrollSnap());
    updateActiveInseam();
    totalsCarouselApi.on("select", updateActiveInseam);
    totalsCarouselApi.on("reInit", updateActiveInseam);
    return () => {
      totalsCarouselApi.off("select", updateActiveInseam);
      totalsCarouselApi.off("reInit", updateActiveInseam);
    };
  }, [totalsCarouselApi]);

  useEffect(() => {
    const viewport = totalsCarouselViewportRef.current;
    if (!viewport || !totalsCarouselApi || inseamTotals.length < 2) return;

    const releaseTransition = () => {
      totalsCarouselTransitioningRef.current = false;
      totalsCarouselApi.off("settle", releaseTransition);
    };
    const handleWheel = (event: WheelEvent) => {
      const wheelDistance =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!wheelDistance) return;

      event.preventDefault();
      if (totalsCarouselTransitioningRef.current) return;

      totalsCarouselTransitioningRef.current = true;
      totalsCarouselApi.on("settle", releaseTransition);
      if (wheelDistance > 0) totalsCarouselApi.scrollNext();
      else totalsCarouselApi.scrollPrev();
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      totalsCarouselApi.off("settle", releaseTransition);
      totalsCarouselTransitioningRef.current = false;
    };
  }, [inseamTotals.length, totalsCarouselApi]);

  async function save() {
    if (!workOrder) {
      setError("Enter a Work Order before saving.");
      return;
    }
    const populatedPlans = plans
      .filter(hasRowData)
      .map((plan) => {
        const sourceGroup = sourceGroups.find(
          (group) => group.inseam === plan.sourceInseam,
        );
        const allowedSizes = new Set(sourceGroup?.sizeColumns ?? []);
        // The combined matrix renders a union of all inseam sizes. Remove
        // its zero-only display cells before persistence; Size 31 must not
        // be submitted as a real Size 31 value for Inseam 30.
        return {
          ...plan,
          sizeQuantities: Object.fromEntries(
            Object.entries(plan.sizeQuantities).filter(
              ([size]) => allowedSizes.has(size),
            ),
          ),
        };
      });
    if (populatedPlans.length === 0) {
      setError("Add at least one planning row before saving. A blank save is not allowed.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/cut-planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrder, plans: populatedPlans }),
      });
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Failed to save cut planning.");
      setPlans(populatedPlans);
      setIsDirty(false);
      setNotice(body.message || "Cut planning saved successfully.");
      await load(workOrder);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to save cut planning.",
      );
    } finally {
      setSaving(false);
    }
  }

  const exportCutPlanning = async () => {
    if (!workOrder || groupedPlans.length === 0) return;
    const workbook = new ExcelJS.Workbook();
    const border = { style: "thin" as const, color: { argb: "FF000000" } };
    const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2F2F2" } };
    const inseamFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE7E6E6" } };
    const cutGroups = new Map<string, CutPlanRow[]>();
    plans.filter(hasRowData).forEach((plan, index) => {
      const key = plan.cutNo.trim() ? `cut:${plan.cutNo.trim()}` : `row:${index}`;
      const list = cutGroups.get(key) ?? [];
      list.push(plan);
      cutGroups.set(key, list);
    });
    // Excel is intentionally not constrained to the two-inseam print layout.
    // Keep every inseam in one horizontal planning grid and one horizontal
    // totals grid, so their headers and row labels are not repeated.
    const exportInseams = groupedPlans;
    const sizeColumnCount = exportInseams.reduce(
      (sum, entry) => sum + entry.group.sizeColumns.length,
      0,
    );
    const planningColumnCount = 6 + sizeColumnCount;
    const totalsColumnCount = 1 + exportInseams.reduce(
      (sum, entry) => sum + entry.group.sizeColumns.length + 1,
      0,
    );
    const columnCount = Math.max(planningColumnCount, totalsColumnCount);
    const sheet = workbook.addWorksheet("Cut Planning");
    sheet.pageSetup.orientation = "landscape";
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 1;
    sheet.columns = [
      { width: 14 },
      { width: 20 },
      { width: 12 },
      { width: 18 },
      { width: 11 },
      { width: 14 },
      ...Array.from({ length: Math.max(0, columnCount - 6) }, () => ({ width: 8 })),
    ];
    sheet.mergeCells(1, 1, 1, columnCount);
    const title = sheet.getCell(1, 1);
    title.value = "SIZE DETAIL & CHECK LIST";
    title.font = { name: "Calibri", bold: true, size: 14 };
    title.alignment = { horizontal: "center" };
    const exportDate = String(data?.metadata?.workOrderDate ?? "").split(/[ T]/)[0];
    const metadata = [
      ["DATE", exportDate, "ORDER #", data?.metadata?.workOrder ?? ""],
      ["CUSTOMER", data?.metadata?.customerName ?? "", "STYLE", data?.metadata?.styleNo || data?.metadata?.styleCode || ""],
    ];
    metadata.forEach((row, rowIndex) => {
      sheet.getRow(rowIndex + 2).values = row;
      [1, 3].forEach((column) => { sheet.getCell(rowIndex + 2, column).font = { name: "Calibri", bold: true, size: 11 }; });
    });
    const exportFabric = activeFabricItem || materialSummaries[0]?.itemNames[0] || "";
    sheet.getCell(4, 1).value = "FABRIC";
    sheet.mergeCells(4, 2, 4, 4);
    sheet.getCell(4, 2).value = exportFabric;

    const startRow = 6;
    ["SR", "TOTAL PCS", "SHRINKAGE", "PLYS", "CUT #", "BUNDLE"].forEach((label, index) => {
      sheet.mergeCells(startRow, index + 1, startRow + 2, index + 1);
      sheet.getCell(startRow, index + 1).value = label;
    });
    let startColumn = 7;
    exportInseams.forEach(({ group }) => {
      const endColumn = startColumn + group.sizeColumns.length - 1;
      // Retain an individual header box for every inseam, even though all
      // inseams now live in one horizontal Excel table.
      sheet.mergeCells(startRow, startColumn, startRow, endColumn);
      sheet.getCell(startRow, startColumn).value = "INSEAM";
      sheet.mergeCells(startRow + 1, startColumn, startRow + 1, endColumn);
      sheet.getCell(startRow + 1, startColumn).value = group.inseam ?? "-";
      group.sizeColumns.forEach((size, index) => { sheet.getCell(startRow + 2, startColumn + index).value = size; });
      startColumn = endColumn + 1;
    });
    const exportCutGroups = [...cutGroups.values()];
    exportCutGroups.forEach((cutPlans, index) => {
      const base = cutPlans[0];
      const total = cutPlans.reduce((sum, plan) => sum + Object.values(plan.sizeQuantities).reduce((sizeSum, qty) => sizeSum + qty, 0), 0);
      const row = startRow + 3 + index;
      sheet.getRow(row).values = [index + 1, total * base.markerPlies || "", base.shrinkage || "", base.markerPlies || "", base.cutNo || "", total ? `1 - ${total}` : ""];
      let column = 7;
      exportInseams.forEach(({ group }) => {
        group.sizeColumns.forEach((size) => {
          const value = cutPlans.filter((plan) => plan.sourceInseam === group.inseam).reduce((sum, plan) => sum + (plan.sizeQuantities[size] || 0), 0);
          sheet.getCell(row, column++).value = value || "";
        });
      });
    });
    const totalsStartRow = startRow + 4 + exportCutGroups.length;
    sheet.getColumn(1).width = 18;
    let totalsColumn = 2;
    exportInseams.forEach(({ group }) => {
      const total = inseamTotals.find((entry) => entry.inseam === group.inseam);
      const endColumn = totalsColumn + group.sizeColumns.length;
      // The totals remain one table, but every inseam retains the same
      // separate boxed header used in the planning grid.
      sheet.mergeCells(totalsStartRow, totalsColumn, totalsStartRow, endColumn);
      sheet.getCell(totalsStartRow, totalsColumn).value = "INSEAM";
      sheet.mergeCells(totalsStartRow + 1, totalsColumn, totalsStartRow + 1, endColumn);
      sheet.getCell(totalsStartRow + 1, totalsColumn).value = group.inseam ?? "-";
      group.sizeColumns.forEach((size, index) => {
        sheet.getCell(totalsStartRow + 2, totalsColumn + index).value = size;
      });
      sheet.getCell(totalsStartRow + 2, endColumn).value = "TOTAL";
      total?.rows.filter(({ label }) => label !== "Order").forEach(({ label, values }, rowIndex) => {
        const row = totalsStartRow + 3 + rowIndex;
        group.sizeColumns.forEach((size, index) => {
          const value = label === "Less" ? Math.abs(values[size] || 0) : values[size] || 0;
          sheet.getCell(row, totalsColumn + index).value = value || "";
        });
        const totalValue = group.sizeColumns.reduce((sum, size) => sum + (values[size] || 0), 0);
        sheet.getCell(row, endColumn).value = label === "Less" ? Math.abs(totalValue) || "" : totalValue || "";
      });
      totalsColumn = endColumn + 1;
    });
    inseamTotals[0]?.rows.filter(({ label }) => label !== "Order").forEach(({ label }, rowIndex) => {
      sheet.getCell(totalsStartRow + 3 + rowIndex, 1).value = label;
    });
    for (let column = 1; column <= planningColumnCount; column += 1) {
      sheet.getCell(startRow, column).fill = column <= 6 ? headerFill : inseamFill;
      sheet.getCell(startRow + 1, column).fill = column <= 6 ? headerFill : inseamFill;
      sheet.getCell(startRow + 2, column).fill = headerFill;
      sheet.getCell(startRow, column).font = { name: "Calibri", bold: true, size: 11 };
    }
    for (let column = 1; column <= totalsColumnCount; column += 1) {
      sheet.getCell(totalsStartRow, column).fill = inseamFill;
      sheet.getCell(totalsStartRow + 1, column).fill = inseamFill;
      sheet.getCell(totalsStartRow + 2, column).fill = headerFill;
      [totalsStartRow, totalsStartRow + 1, totalsStartRow + 2].forEach((row) => {
        sheet.getCell(row, column).font = { name: "Calibri", bold: true, size: 11 };
      });
    }
    sheet.getRow(startRow).height = 18;
    sheet.eachRow((row) => row.eachCell((cell) => {
      cell.border = { top: border, left: border, bottom: border, right: border };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { name: "Calibri", size: 11 };
    }));
    title.font = { name: "Calibri", bold: true, size: 14 };
    metadata.forEach((_, rowIndex) => {
      [1, 3].forEach((column) => {
        sheet.getCell(rowIndex + 2, column).font = { name: "Calibri", bold: true, size: 11 };
      });
      [1, 2, 3, 4].forEach((column) => {
        sheet.getCell(rowIndex + 2, column).alignment = { horizontal: "left", vertical: "middle" };
      });
    });
    sheet.getCell(4, 1).font = { name: "Calibri", bold: true, size: 11 };
    [1, 2].forEach((column) => {
      sheet.getCell(4, column).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    });
    sheet.views = [{ showGridLines: false }];
    sheet.getRow(1).height = 28;
    sheet.getRow(2).height = 22;
    sheet.getRow(3).height = 22;
    sheet.getRow(4).height = exportFabric.length > 45 ? 38 : 22;
    sheet.properties.defaultRowHeight = 21;
    sheet.views = [{ showGridLines: true, zoomScale: 100 }];
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cut-planning-${workOrder.replace(/[^A-Za-z0-9._-]+/g, "-")}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const cellClass = "cell-input";
  const totalCellBackgrounds: Record<string, string> = {
    Order: "bg-[#fffbd5]",
    "Will be cut": "bg-[#f0efff]",
    Planned: "bg-[#f5e4f1]",
    Less: "bg-[#ffb7c0]",
    Over: "bg-[#59c9eb]",
  };
  const markerRowCount = Math.max(
    0,
    ...groupedPlans.map(({ rows }) => rows.length),
  );
  const addMarkerSet = () => {
    setNewMarkerRowIndex(markerRowCount);
    setIsDirty(true);
    setPlans((current) => [...current, ...groups.map(makePlan)]);
  };
  const generateBundlesFromSelection = async () => {
    if (!workOrder || !selectedBundleCut || (!hasShadeSplit && Number(bundleQty) <= 0)) return;
    if (isDirty) {
      setError("Save Cut Planning before generating bundles so the preview and generated quantities match.");
      return;
    }
    setGeneratingBundles(true);
    setError("");
    try {
      const response = await fetch("/api/cut-planning/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrder,
          cutNos: [selectedBundleCut],
          bundleQty: Number(bundleQty),
          mergeCuts: false,
          expectedNextSequence: bundlePreviewIdentity?.nextSequence,
          expectedBundleCount: bundlePreview.length,
          shadeAllocations: hasShadeSplit ? effectiveShadeQuantities : undefined,
        }),
      });
      const body = (await response.json()) as { error?: string; bundles?: Array<{ bundleId: string }> };
      if (!response.ok) throw new Error(body.error || "Failed to generate bundles.");
      setNotice(`${body.bundles?.length ?? 0} bundle(s) generated successfully.`);
      setShowBundlePreview(false);
      setBundlePreviewIdentity(null);
      setSelectedBundleCut("");
      setShadeQuantities({});
      setShadeCutNos({});
      setBundleQty("");
      setShowBundleModal(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to generate bundles.");
    } finally {
      setGeneratingBundles(false);
    }
  };

  const loadBundlePreview = async () => {
    if (!workOrder) return;
    setError("");
    try {
      const response = await fetch(
        `/api/cut-planning/bundles?work_order=${encodeURIComponent(workOrder)}`,
      );
      const body = (await response.json()) as {
        nextSequence?: number;
        bundleIdPrefix?: string;
        error?: string;
      };
      if (
        !response.ok ||
        typeof body.nextSequence !== "number" ||
        !Number.isSafeInteger(body.nextSequence) ||
        !body.bundleIdPrefix
      ) {
        throw new Error(body.error || "Unable to prepare the bundle preview.");
      }
      setBundlePreviewIdentity({
        nextSequence: body.nextSequence,
        bundleIdPrefix: body.bundleIdPrefix,
      });
      setShowBundlePreview(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to prepare the bundle preview.",
      );
    }
  };

  useEffect(() => {
    if (
      newMarkerRowIndex === null ||
      markerRowCount <= newMarkerRowIndex
    ) {
      return;
    }

    const scrollArea = matrixScrollRef.current;
    const newRow = newMarkerRowRef.current;
    if (scrollArea && newRow) {
      const rowTop = newRow.offsetTop;
      const rowBottom = rowTop + newRow.offsetHeight;
      const viewBottom = scrollArea.scrollTop + scrollArea.clientHeight;
      if (rowTop < scrollArea.scrollTop || rowBottom > viewBottom) {
        scrollArea.scrollTo({
          top: Math.max(0, rowBottom - scrollArea.clientHeight + 8),
          behavior: "smooth",
        });
      }
    }

    const timer = window.setTimeout(() => setNewMarkerRowIndex(null), 1800);
    return () => window.clearTimeout(timer);
  }, [markerRowCount, newMarkerRowIndex]);
  const addMarkerSetOnEnter = (event: React.KeyboardEvent<HTMLElement>) => {
    if (
      event.key !== "Enter" ||
      !(event.target instanceof HTMLInputElement) ||
      !event.target.classList.contains("cell-input")
    )
      return;
    event.preventDefault();
    addMarkerSet();
  };
  const navigateGridWithArrowKeys = (
    event: React.KeyboardEvent<HTMLElement>,
  ) => {
    if (
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        event.key,
      ) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !(event.target instanceof HTMLInputElement) ||
      !event.target.classList.contains("cell-input")
    ) {
      return;
    }

    const currentCell = event.target.closest("td");
    const currentRow = currentCell?.closest("tr");
    const table = currentCell?.closest("table");
    if (!currentCell || !currentRow || !table) return;

    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
    const rowIndex = rows.indexOf(currentRow);
    const cellIndex = Array.from(currentRow.cells).indexOf(currentCell);
    if (rowIndex < 0 || cellIndex < 0) return;

    let nextInput: HTMLInputElement | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const editableCells = Array.from(currentRow.cells).filter((cell) =>
        cell.querySelector<HTMLInputElement>("input.cell-input:not(:disabled)"),
      );
      const editableIndex = editableCells.indexOf(currentCell);
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      nextInput = editableCells[editableIndex + direction]?.querySelector(
        "input.cell-input:not(:disabled)",
      ) ?? null;
    } else {
      const direction = event.key === "ArrowUp" ? -1 : 1;
      for (
        let candidateIndex = rowIndex + direction;
        candidateIndex >= 0 && candidateIndex < rows.length;
        candidateIndex += direction
      ) {
        nextInput = rows[candidateIndex]?.cells[cellIndex]?.querySelector(
          "input.cell-input:not(:disabled)",
        ) ?? null;
        if (nextInput) break;
      }
    }

    // Always suppress a native numeric/date increment, even at the grid edge.
    event.preventDefault();
    if (!nextInput) return;
    nextInput.focus();
    nextInput.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const updateSharedMarker = (rowIndex: number, patch: Partial<CutPlanRow>) =>
    (setIsDirty(true), setPlans((current) => {
      const targets = new Set(
        groups
          .flatMap(
            (group) =>
              current
                .map((plan, index) => ({ plan, index }))
                .filter(({ plan }) => plan.sourceInseam === group.inseam)[
                rowIndex
              ]?.index,
          )
          .filter((index): index is number => index != null),
      );
      return current.map((plan, index) =>
        targets.has(index) ? { ...plan, ...patch } : plan,
      );
    }));
  const removeMarkerSet = (rowIndex: number) =>
    (setIsDirty(true), setPlans((current) => {
      const targets = new Set(
        groups
          .flatMap(
            (group) =>
              current
                .map((plan, index) => ({ plan, index }))
                .filter(({ plan }) => plan.sourceInseam === group.inseam)[
                rowIndex
              ]?.index,
          )
          .filter((index): index is number => index != null),
      );
      return current.filter((_, index) => !targets.has(index));
    }));
  const requestRemoveMarkerSet = (rowIndex: number) => {
    const containsData = groupedPlans.some(({ rows }) => {
      const row = rows[rowIndex];
      return row ? hasRowData(row.plan) : false;
    });
    if (containsData) {
      setPendingDelete({ type: "marker-set", rowIndex });
      return;
    }
    removeMarkerSet(rowIndex);
  };
  const inseamMatrix = groups.length > 0 && (
    <section
      ref={matrixRef}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:mx-[calc((min(2400px,calc(100vw-3rem))-100%)/-2)] xl:w-[min(2400px,calc(100vw-3rem))]"
    >
      <div ref={matrixScrollRef} className="overscroll-contain overflow-x-auto overflow-y-auto" style={matrixMaxHeight == null ? undefined : { maxHeight: matrixMaxHeight }}>
        <table className="min-w-max w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-600">
            <tr>
              <th
                rowSpan={2}
                {...matrixCellProps(
                  "date",
                  "border-b border-r border-slate-300 px-2 py-3 font-semibold",
                  "header",
                )}
              >
                <span className="flex items-center gap-1">Date {matrixPinButton("date", "Date")}</span>
              </th>
              <th
                rowSpan={2}
                {...matrixCellProps(
                  "marker-no",
                  "border-b border-r border-slate-300 px-2 py-3 font-semibold whitespace-nowrap",
                  "header",
                )}
              >
                <span className="flex items-center gap-1">Marker no. {matrixPinButton("marker-no", "Marker no.")}</span>
              </th>
              <th
                rowSpan={2}
                {...matrixCellProps(
                  "cut-no",
                  "border-b border-r border-slate-300 px-2 py-3 font-semibold whitespace-nowrap",
                  "header",
                )}
              >
                <span className="flex items-center gap-1">Cut no. {matrixPinButton("cut-no", "Cut no.")}</span>
              </th>
              {groups.map((group) => (
                <th
                  key={group.inseam ?? "none"}
                  colSpan={group.sizeColumns.length}
                  className="border-x-[3px] border-b border-slate-400 px-2 py-2 text-center font-bold text-indigo-800"
                >
                  Inseam {group.inseam ?? "—"}
                </th>
              ))}
              <th
                colSpan={10}
                className="border-b border-slate-300 px-2 py-2 text-center font-bold"
              >
                Marker details
              </th>
            </tr>
            <tr>
              {groups.flatMap((group) =>
                group.sizeColumns.map((size) => (
                  <th
                    key={`${group.inseam}-${size}`}
                    {...matrixCellProps(
                      matrixSizeColumnId(group, size),
                      `border-b border-r border-slate-300 px-2 py-2 font-semibold ${matrixInseamBoundaryClass(group, size)}`,
                      "header",
                    )}
                  >
                    <span className="flex items-center gap-1">{size} {matrixPinButton(matrixSizeColumnId(group, size), `size ${size}`)}</span>
                  </th>
                )),
              )}
              {[
                ["re-cut", "Re-cut"],
                ["total", "Total"],
                ["marker-plies", "Marker plies"],
                ["transaction-count", "Transaction count"],
                ["shrinkage", "Shrinkage"],
                ["shade", "Shade"],
                ["calculated-required", "Calculated required"],
                ["marker-width", "Marker width (cm)"],
                ["marker-length", "Marker length (m)"],
                ["actions", "Actions"],
              ].map(([columnId, heading]) => (
                <th
                  key={columnId}
                  {...matrixCellProps(
                    columnId,
                    "border-b border-slate-300 px-2 py-2 font-semibold whitespace-nowrap",
                    "header",
                  )}
                >
                  <span className="flex items-center gap-1">{heading === "Actions" ? "" : heading} {matrixPinButton(columnId, heading.toLowerCase())}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: markerRowCount }, (_, rowIndex) => {
              const base = groupedPlans[0]?.rows[rowIndex];
              const total = groups.reduce(
                (sum, group) =>
                  sum +
                  group.sizeColumns.reduce(
                    (groupTotal, size) =>
                      groupTotal +
                      (groupedPlans.find(
                        ({ group: candidate }) =>
                          candidate.inseam === group.inseam,
                      )?.rows[rowIndex]?.plan.sizeQuantities[size] || 0),
                    0,
                  ),
                0,
              );
              const markerPlies = base?.plan.markerPlies || 0;
              return (
                <tr
                  key={base?.plan.id ?? rowIndex}
                  ref={rowIndex === newMarkerRowIndex ? newMarkerRowRef : null}
                  className={`border-b border-slate-200 transition-colors hover:bg-slate-50/50 ${rowIndex % 2 === 0 ? "bg-white" : "bg-slate-100"} ${rowIndex === newMarkerRowIndex ? "bg-indigo-50" : ""}`}
                >
                  <td {...matrixCellProps("date", "p-0")}>
                    <input
                      type="date"
                      value={base?.plan.planDate || ""}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          planDate: event.target.value,
                        })
                      }
                      className={`${cellClass} w-32`}
                    />
                  </td>
                  <td {...matrixCellProps("marker-no", "p-0")}>
                    <input
                      value={base?.plan.markerNo || ""}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          markerNo: event.target.value,
                        })
                      }
                      className={`${cellClass} w-20`}
                    />
                  </td>
                  <td {...matrixCellProps("cut-no", "p-0")}>
                    <input
                      value={base?.plan.cutNo || ""}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          cutNo: event.target.value,
                        })
                      }
                      className={`${cellClass} w-20`}
                    />
                  </td>
                  {groups.flatMap((group) =>
                    group.sizeColumns.map((size) => {
                      const entry = groupedPlans.find(
                        ({ group: candidate }) =>
                          candidate.inseam === group.inseam,
                      )?.rows[rowIndex];
                      return (
                        <td
                          key={`${group.inseam}-${size}`}
                          {...matrixCellProps(
                            matrixSizeColumnId(group, size),
                            `p-0 ${matrixInseamBoundaryClass(group, size)}`,
                          )}
                        >
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={entry?.plan.sizeQuantities[size] || ""}
                            onWheel={preventWheelChange}
                            onChange={(event) =>
                              updateMatrixSize(
                                group,
                                rowIndex,
                                size,
                                event.target.value,
                              )
                            }
                            className={`${cellClass} w-16 text-right`}
                          />
                        </td>
                      );
                    }),
                  )}
                  <td {...matrixCellProps("re-cut", "p-0")}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={base?.plan.reCutQty || ""}
                      onWheel={preventWheelChange}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          reCutQty: numeric(event.target.value),
                        })
                      }
                      className={`${cellClass} w-16 text-right`}
                    />
                  </td>
                  <td {...matrixCellProps("total", "cell-value")}>{displayNumber(total)}</td>
                  <td {...matrixCellProps("marker-plies", "p-0")}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={markerPlies || ""}
                      onWheel={preventWheelChange}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          markerPlies: numeric(event.target.value),
                        })
                      }
                      className={`${cellClass} w-20 text-right`}
                    />
                  </td>
                  <td {...matrixCellProps("transaction-count", "cell-value")}>
                    {displayNumber(total * markerPlies)}
                  </td>
                  <td {...matrixCellProps("shrinkage", "p-0")}>
                    <input
                      value={base?.plan.shrinkage || ""}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          shrinkage: event.target.value,
                        })
                      }
                      className={`${cellClass} w-24`}
                    />
                  </td>
                  <td {...matrixCellProps("shade", "p-0")}>
                    <input
                      value={base?.plan.shade || ""}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          shade: event.target.value,
                        })
                      }
                      className={`${cellClass} w-24`}
                    />
                  </td>
                  <td {...matrixCellProps("calculated-required", "p-0")}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={base?.plan.calculatedRequired ?? ""}
                      onWheel={preventWheelChange}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          calculatedRequired:
                            event.target.value === ""
                              ? null
                              : numeric(event.target.value),
                        })
                      }
                      className={`${cellClass} w-24 text-right`}
                    />
                  </td>
                  <td {...matrixCellProps("marker-width", "p-0")}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={base?.plan.markerWidthCm ?? ""}
                      onWheel={preventWheelChange}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          markerWidthCm:
                            event.target.value === ""
                              ? null
                              : numeric(event.target.value),
                        })
                      }
                      className={`${cellClass} w-24 text-right`}
                    />
                  </td>
                  <td {...matrixCellProps("marker-length", "p-0")}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={base?.plan.markerLengthM ?? ""}
                      onWheel={preventWheelChange}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          markerLengthM:
                            event.target.value === ""
                              ? null
                              : numeric(event.target.value),
                        })
                      }
                      className={`${cellClass} w-24 text-right`}
                    />
                  </td>
                  <td {...matrixCellProps("actions", "p-0")}>
                    <button
                      type="button"
                      onClick={() => requestRemoveMarkerSet(rowIndex)}
                      className="p-2 text-rose-600 hover:bg-rose-50"
                      aria-label={`Remove marker row ${rowIndex + 1}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div
        ref={matrixFooterRef}
        className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2"
      >
        <button
          type="button"
          onClick={addMarkerSet}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"
        >
          <Plus className="size-3.5" /> Add marker row
        </button>
        {newMarkerRowIndex !== null && (
          <span className="ml-3 text-xs font-medium text-emerald-700">
            New marker row added
          </span>
        )}
        <button type="button" onClick={() => { setSelectedBundleCut(""); setShadeQuantities({}); setBundleQty(""); setShowBundlePreview(false); setShowBundleModal(true); }} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
          Generate bundle
        </button>
      </div>
    </section>
  );
  const inseamCards = groups.length > 0 && (
    <section className="flex gap-4 overflow-x-auto pb-3">
      {groupedPlans.map(({ group, rows }) => (
        <section
          key={group.inseam ?? "none"}
          className="min-w-max overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2">
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800">
              Inseam {group.inseam ?? "—"}
            </span>
            <button
              type="button"
              onClick={() => add(group)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"
            >
              <Plus className="size-3.5" /> Add marker row
            </button>
          </div>
          <div className="hide-horizontal-scrollbar max-h-[calc(100dvh-29rem)] overflow-auto">
            <table className="border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-600">
                <tr>
                  {[
                    "Date",
                    "Marker no.",
                    "Cut no.",
                    ...group.sizeColumns,
                    "Re-cut",
                    "Total",
                    "Marker plies",
                    "Transaction count",
                    "Shrinkage",
                    "Shade",
                    "Calculated required",
                    "Marker width (cm)",
                    "Marker length (m)",
                    "",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-slate-300 px-2 py-3 font-semibold whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ plan, index }, row) => {
                  const total = group.sizeColumns.reduce(
                    (sum, size) => sum + (plan.sizeQuantities[size] || 0),
                    0,
                  );
                  const transactions = total * plan.markerPlies;
                  return (
                    <tr
                      key={plan.id ?? `${group.inseam}-${row}`}
                      className={`border-b border-slate-200 hover:bg-slate-50/50 ${row % 2 === 0 ? "bg-white" : "bg-slate-100"}`}
                    >
                      <td className="p-0">
                        <input
                          type="date"
                          value={plan.planDate}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onChange={(event) =>
                            update(index, { planDate: event.target.value })
                          }
                          className={`${cellClass} w-32`}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          value={plan.markerNo}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onChange={(event) =>
                            update(index, { markerNo: event.target.value })
                          }
                          className={`${cellClass} w-20`}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          value={plan.cutNo}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onChange={(event) =>
                            update(index, { cutNo: event.target.value })
                          }
                          className={`${cellClass} w-20`}
                        />
                      </td>
                      {group.sizeColumns.map((size) => (
                        <td key={size} className="p-0">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={plan.sizeQuantities[size] || ""}
                            onKeyDown={(event) => addOnEnter(event, group)}
                            onWheel={preventWheelChange}
                            onChange={(event) =>
                              updateSize(index, size, event.target.value)
                            }
                            className={`${cellClass} w-16 text-right`}
                          />
                        </td>
                      ))}
                      <td className="p-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={plan.reCutQty || ""}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onWheel={preventWheelChange}
                          onChange={(event) =>
                            update(index, {
                              reCutQty: numeric(event.target.value),
                            })
                          }
                          className={`${cellClass} w-16 text-right`}
                        />
                      </td>
                      <td className="cell-value">{displayNumber(total)}</td>
                      <td className="p-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={plan.markerPlies || ""}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onWheel={preventWheelChange}
                          onChange={(event) =>
                            update(index, {
                              markerPlies: numeric(event.target.value),
                            })
                          }
                          className={`${cellClass} w-20 text-right`}
                        />
                      </td>
                      <td className="cell-value">
                        {displayNumber(transactions)}
                      </td>
                      <td className="p-0">
                        <input
                          value={plan.shrinkage}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onChange={(event) =>
                            update(index, { shrinkage: event.target.value })
                          }
                          className={`${cellClass} w-24`}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          value={plan.shade}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onChange={(event) =>
                            update(index, { shade: event.target.value })
                          }
                          className={`${cellClass} w-24`}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={plan.calculatedRequired ?? ""}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onWheel={preventWheelChange}
                          onChange={(event) =>
                            update(index, {
                              calculatedRequired:
                                event.target.value === ""
                                  ? null
                                  : numeric(event.target.value),
                            })
                          }
                          className={`${cellClass} w-24 text-right`}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={plan.markerWidthCm ?? ""}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onWheel={preventWheelChange}
                          onChange={(event) =>
                            update(index, {
                              markerWidthCm:
                                event.target.value === ""
                                  ? null
                                  : numeric(event.target.value),
                            })
                          }
                          className={`${cellClass} w-24 text-right`}
                        />
                      </td>
                      <td className="p-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={plan.markerLengthM ?? ""}
                          onKeyDown={(event) => addOnEnter(event, group)}
                          onWheel={preventWheelChange}
                          onChange={(event) =>
                            update(index, {
                              markerLengthM:
                                event.target.value === ""
                                  ? null
                                  : numeric(event.target.value),
                            })
                          }
                          className={`${cellClass} w-24 text-right`}
                        />
                      </td>
                      <td className="p-0">
                        <button
                          type="button"
                          aria-label={`Remove marker row ${row + 1}`}
                          onClick={() => requestRemove(index, group)}
                          className="p-2 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </section>
  );
  return (
    <main
      className="cut-planning-page -mt-4 w-full space-y-3 pb-56 sm:-mt-5"
      onKeyDown={(event) => {
        navigateGridWithArrowKeys(event);
        addMarkerSetOnEnter(event);
      }}
    >
      <ModulePageHeader
        eyebrow="Sewing / Cutting"
        title="Cut Planning"
        icon={Scissors}
        compact
        titleAccessory={
          data?.metadata ? (
            <div className="flex w-[min(760px,calc(100vw-13rem))] min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
              <span className="flex min-w-0 items-center gap-2">
                {materialSummaries.length > 0 ? (
                  materialSummaries.map(({ accessCode, itemNames }) => (
                    <span
                      key={accessCode}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        Fabric
                      </span>
                      <div ref={fabricMenuRef} className="relative w-52 shrink-0">
                        <button
                          type="button"
                          aria-haspopup="listbox"
                          aria-expanded={fabricMenuOpen}
                          onClick={() => setFabricMenuOpen((open) => !open)}
                          className="flex h-8 w-full items-center gap-2 rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-2.5 text-left text-xs font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {shortenFabricName(activeFabricItem || itemNames[0])}
                          </span>
                          <ChevronDown
                            className={`size-3.5 shrink-0 text-indigo-500 transition-transform ${fabricMenuOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {fabricMenuOpen && (
                          <div
                            role="listbox"
                            aria-label="Fabric items"
                            className="absolute left-0 top-[calc(100%+0.45rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15"
                          >
                            <div className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Fabric items
                            </div>
                            <div className="max-h-56 overflow-y-auto">
                              {itemNames.map((itemName) => {
                                const selected =
                                  (activeFabricItem || itemNames[0]) === itemName;
                                return (
                                  <button
                                    key={itemName}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => {
                                      setSelectedFabricItem(itemName);
                                      setSelectedFabricWorkOrder(
                                        data?.metadata?.workOrder ?? "",
                                      );
                                      setFabricMenuOpen(false);
                                    }}
                                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs leading-5 transition ${selected ? "bg-indigo-50 font-semibold text-indigo-800" : "text-slate-700 hover:bg-slate-50"}`}
                                  >
                                    <Check
                                      className={`mt-0.5 size-3.5 shrink-0 ${selected ? "text-indigo-600" : "invisible"}`}
                                    />
                                    <span>{itemName}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </span>
                  ))
                ) : (
                  <span className="font-semibold text-slate-700">—</span>
                )}
              </span>
              <span className="h-5 w-px shrink-0 bg-slate-200" />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Style
                </span>
                <span className="truncate font-semibold text-slate-700">
                  {[
                    data.metadata.styleNo,
                    data.metadata.styleCode,
                    data.metadata.styleName,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>
            </div>
          ) : undefined
        }
        actions={
          <div className="flex items-center justify-end gap-2 sm:translate-y-2">
            <button
              type="button"
              onClick={() => setShowWorkOrderModal(true)}
              className="inline-flex h-9 w-52 items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="truncate">{workOrder || "Find work order"}</span>
              <Search className="size-4 shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!workOrder || groups.length === 0}
              aria-label="Print cut planning"
              title="Print"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Printer className="size-4" />
            </button>
            <button
              type="button"
              onClick={exportCutPlanning}
              disabled={!workOrder || groups.length === 0}
              aria-label="Export cut planning to Excel"
              title="Export to Excel"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="size-4" />
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !workOrder || groups.length === 0}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        }
      />
      {(error || notice) && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
        >
          <AlertCircle className="size-4" />
          <span className="flex-1">{error || notice}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
            className="rounded p-1 hover:bg-black/5"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" /> Loading Inseam
          groups...
        </div>
      )}
      {!loading && data && (
        <>
          {groups.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="hide-horizontal-scrollbar max-h-[min(48vh,420px)] overflow-auto pb-8">
                <table className="min-w-max w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-600">
                    <tr>
                      {[
                        "Date",
                        "Marker no.",
                        "Cut no.",
                        ...sizeColumns,
                        "Re-cut",
                        "Total",
                        "Marker plies",
                        "Transaction count",
                        "Shrinkage",
                        "Shade",
                        "Calculated required",
                        "Marker width (cm)",
                        "Marker length (m)",
                        "",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="border-b border-slate-300 px-2 py-3 font-semibold whitespace-nowrap"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedPlans.flatMap(({ group, rows }) => [
                      <tr
                        key={`break-${group.inseam}`}
                        className="bg-slate-100"
                      >
                        <td
                          colSpan={sizeColumns.length + 13}
                          className="border-y border-slate-300 px-3 py-2"
                        >
                          <div className="relative flex min-h-6 items-center">
                            <button
                              type="button"
                              onClick={() => add(group)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"
                            >
                              <Plus className="size-3.5" /> Add marker row
                            </button>
                            <span className="sticky left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-200 px-3 py-1 text-[11px] font-bold text-slate-700">
                              Inseam {group.inseam ?? "—"}
                            </span>
                          </div>
                        </td>
                      </tr>,
                      ...rows.map(({ plan, index }, row) => {
                        const total = sizeColumns.reduce(
                          (sum, size) => sum + (plan.sizeQuantities[size] || 0),
                          0,
                        );
                        const transactions = total * plan.markerPlies;
                        return (
                          <tr
                            key={plan.id ?? `${group.inseam}-${row}`}
                            className={`border-b border-slate-200 hover:bg-slate-50/50 ${row % 2 === 0 ? "bg-white" : "bg-slate-100"}`}
                          >
                            <td className="p-0">
                              <input
                                type="date"
                                value={plan.planDate}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onChange={(event) =>
                                  update(index, {
                                    planDate: event.target.value,
                                  })
                                }
                                className={`${cellClass} w-32`}
                              />
                            </td>
                            <td className="p-0">
                              <input
                                value={plan.markerNo}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onChange={(event) =>
                                  update(index, {
                                    markerNo: event.target.value,
                                  })
                                }
                                className={`${cellClass} w-20`}
                              />
                            </td>
                            <td className="p-0">
                              <input
                                value={plan.cutNo}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onChange={(event) =>
                                  update(index, {
                                    cutNo: event.target.value,
                                  })
                                }
                                className={`${cellClass} w-20`}
                              />
                            </td>
                            {sizeColumns.map((size) => (
                              <td key={size} className="p-0">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={plan.sizeQuantities[size] || ""}
                                  onKeyDown={(event) =>
                                    addOnEnter(event, group)
                                  }
                                  onWheel={preventWheelChange}
                                  onChange={(event) =>
                                    updateSize(index, size, event.target.value)
                                  }
                                  className={`${cellClass} w-16 text-right`}
                                />
                              </td>
                            ))}
                            <td className="p-0">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={plan.reCutQty || ""}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onWheel={preventWheelChange}
                                onChange={(event) =>
                                  update(index, {
                                    reCutQty: numeric(event.target.value),
                                  })
                                }
                                className={`${cellClass} w-16 text-right`}
                              />
                            </td>
                            <td className="cell-value">
                              {displayNumber(total)}
                            </td>
                            <td className="p-0">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={plan.markerPlies || ""}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onWheel={preventWheelChange}
                                onChange={(event) =>
                                  update(index, {
                                    markerPlies: numeric(event.target.value),
                                  })
                                }
                                className={`${cellClass} w-20 text-right`}
                              />
                            </td>
                            <td className="cell-value">
                              {displayNumber(transactions)}
                            </td>
                            <td className="p-0">
                              <input
                                value={plan.shrinkage}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onChange={(event) =>
                                  update(index, {
                                    shrinkage: event.target.value,
                                  })
                                }
                                className={`${cellClass} w-24`}
                              />
                            </td>
                            <td className="p-0">
                              <input
                                value={plan.shade}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onChange={(event) =>
                                  update(index, { shade: event.target.value })
                                }
                                className={`${cellClass} w-24`}
                              />
                            </td>
                            <td className="p-0">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={plan.calculatedRequired ?? ""}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onWheel={preventWheelChange}
                                onChange={(event) =>
                                  update(index, {
                                    calculatedRequired:
                                      event.target.value === ""
                                        ? null
                                        : numeric(event.target.value),
                                  })
                                }
                                className={`${cellClass} w-24 text-right`}
                              />
                            </td>
                            <td className="p-0">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={plan.markerWidthCm ?? ""}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onWheel={preventWheelChange}
                                onChange={(event) =>
                                  update(index, {
                                    markerWidthCm:
                                      event.target.value === ""
                                        ? null
                                        : numeric(event.target.value),
                                  })
                                }
                                className={`${cellClass} w-24 text-right`}
                              />
                            </td>
                            <td className="p-0">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={plan.markerLengthM ?? ""}
                                onKeyDown={(event) => addOnEnter(event, group)}
                                onWheel={preventWheelChange}
                                onChange={(event) =>
                                  update(index, {
                                    markerLengthM:
                                      event.target.value === ""
                                        ? null
                                        : numeric(event.target.value),
                                  })
                                }
                                className={`${cellClass} w-24 text-right`}
                              />
                            </td>
                            <td className="p-0">
                              <button
                                type="button"
                                aria-label={`Remove marker row ${row + 1}`}
                                onClick={() => requestRemove(index, group)}
                                className="p-2 text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      }),
                    ])}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {inseamCards}
          {inseamMatrix}
          {groups.length > 0 && (
            <section ref={totalsRef} className="fixed inset-x-4 bottom-5 z-40 mx-auto max-w-[1336px] overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl shadow-slate-950/10 sm:inset-x-6 md:inset-x-8 lg:bottom-6">
              <div
                ref={setTotalsCarouselViewport}
                className="overflow-hidden"
              >
                <div className="flex touch-pan-y">
                  {inseamTotals.map(({ inseam, rows }, inseamIndex) => (
                    <div
                      key={inseam ?? `inseam-${inseamIndex}`}
                      className="min-w-0 flex-[0_0_100%]"
                    >
                  <table className="w-full table-fixed text-xs">
                  <colgroup>
                    <col className="w-36" />
                    <col className="w-12" />
                    {sizeColumns.map((size) => <col key={size} />)}
                    <col className="w-20" />
                  </colgroup>
                  <thead className="border-b border-slate-200 bg-white text-slate-950 shadow-sm">
                    <tr>
                      <th className="bg-white px-3 py-2 text-left"> </th>
                      <th className="px-1 py-2 text-center font-bold">Inseam</th>
                      {sizeColumns.map((size) => (
                        <th
                          key={size}
                          className="px-2 py-2 text-right font-bold"
                        >
                          {size}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ label, values }, rowIndex) => {
                        const total = sizeColumns.reduce(
                          (sum, size) => sum + (values[size] || 0),
                          0,
                        );
                        return (
                          <tr
                            key={`${inseam ?? "none"}-${label}`}
                            className="border-t border-slate-100 text-slate-950"
                          >
                            <th className="bg-white px-3 py-2 text-left font-semibold">
                              {label}
                            </th>
                            {rowIndex === 0 && (
                              <td
                                rowSpan={rows.length}
                                className="border-r border-slate-200 bg-slate-50 px-1 text-center align-middle font-bold text-indigo-800"
                              >
                                {inseam ?? "—"}
                              </td>
                            )}
                            {sizeColumns.map((size) => (
                              <td
                                key={size}
                                className={`px-2 py-2 text-right font-medium ${totalCellBackgrounds[label]}`}
                              >
                                {displayNumber(
                                  label === "Less"
                                    ? Math.abs(values[size] || 0)
                                    : values[size] || 0,
                                )}
                              </td>
                            ))}
                            <td
                              className={`px-3 py-2 text-right text-sm font-bold ${totalCellBackgrounds[label]}`}
                            >
                              {displayNumber(label === "Less" ? Math.abs(total) : total)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  {inseamTotals.length > 1 && (
                    <tfoot className="border-t border-slate-200 bg-slate-50 text-slate-500">
                      <tr>
                        <td
                          colSpan={sizeColumns.length + 3}
                          className="px-3 py-2"
                        >
                          <div className="flex items-center justify-center gap-2" aria-label="Inseam pages">
                            <button
                              type="button"
                              aria-label="Show previous inseam"
                              onClick={() => totalsCarouselApi?.scrollPrev()}
                              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                            >
                              <ChevronLeft className="size-3.5" />
                            </button>
                            {inseamTotals.map((total, index) => {
                              const isActive =
                                index === activeInseamTotalIndex;
                              return (
                                <button
                                  key={`${total.inseam ?? "none"}-${index}`}
                                  type="button"
                                  aria-label={`Show inseam ${total.inseam ?? "unspecified"}`}
                                  aria-current={isActive ? "true" : undefined}
                                  onClick={() => totalsCarouselApi?.scrollTo(index)}
                                  className={`size-2.5 rounded-full transition-colors ${isActive ? "bg-indigo-700" : "bg-slate-300 hover:bg-slate-400"}`}
                                />
                              );
                            })}
                            <button
                              type="button"
                              aria-label="Show next inseam"
                              onClick={() => totalsCarouselApi?.scrollNext()}
                              className="rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                            >
                              <ChevronRight className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                  </table>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
      {data && groups.length > 0 && (
        <div className="cut-planning-print">
          {printInseamPairs.map((pair) => {
            const [first, second] = pair;
            const { group, rows } = first;
            const totals = inseamTotals.find(
              (entry) => entry.inseam === group.inseam,
            );
            const printedRows = rows.filter(({ plan }) => hasRowData(plan));
            return (
              <section
                key={`print-${group.inseam ?? "none"}`}
                className="cut-planning-print-page"
              >
                <header className="cut-planning-print-header">
                  <h1>SIZE DETAIL &amp; CHECK LIST</h1>
                  <div className="cut-planning-print-details">
                    {printHeaderDetails.map(({ label, value }) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                    <div className="cut-planning-print-inseam-meta">
                      <span>INSEAM</span>
                      <strong>{group.inseam ?? "—"}</strong>
                    </div>
                  </div>
                </header>

                <div className="cut-planning-print-two-inseams">
                  {renderPrintPlanningGrid(second ? [first, second] : [first])}
                </div>
                <div className="cut-planning-print-total-pair">
                  {pair.map(({ group: totalGroup }) => {
                    const total = inseamTotals.find(
                      (entry) => entry.inseam === totalGroup.inseam,
                    );
                    if (!total) return null;
                    return (
                      <section
                        key={`print-total-${totalGroup.inseam ?? "none"}`}
                        className="cut-planning-print-total-panel"
                      >
                        <table className="cut-planning-print-table">
                          <thead>
                            <tr>
                              <th
                                className="print-inseam-label"
                                colSpan={totalGroup.sizeColumns.length + 2}
                              >
                                INSEAM
                              </th>
                            </tr>
                            <tr>
                              <th
                                className="print-inseam-value"
                                colSpan={totalGroup.sizeColumns.length + 2}
                              >
                                {totalGroup.inseam ?? "-"}
                              </th>
                            </tr>
                            <tr>
                              <th />
                              {totalGroup.sizeColumns.map((size) => <th key={size}>{size}</th>)}
                              <th>TOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {total.rows
                              .filter(({ label }) => label !== "Order")
                              .map(({ label, values }) => (
                              <tr key={label}>
                                <th>{label}</th>
                                {totalGroup.sizeColumns.map((size) => (
                                  <td key={size}>{displayPrintNumber(label === "Less" ? Math.abs(values[size] || 0) : values[size] || 0)}</td>
                                ))}
                                <td>{displayPrintNumber(label === "Less" ? Math.abs(totalGroup.sizeColumns.reduce((sum, size) => sum + (values[size] || 0), 0)) : totalGroup.sizeColumns.reduce((sum, size) => sum + (values[size] || 0), 0))}</td>
                              </tr>
                              ))}
                          </tbody>
                        </table>
                      </section>
                    );
                  })}
                </div>

                {totals && (
                  <section className="cut-planning-print-section cut-planning-print-summary-section">
                    <div className="cut-planning-print-section-title">
                      <span>SIZE DETAIL</span>
                      <span>INSEAM: {group.inseam ?? "-"}</span>
                    </div>
                  <table className="cut-planning-print-summary">
                    <thead>
                      <tr>
                        <th>SIZE</th>
                        {group.sizeColumns.map((size) => (
                          <th key={size}>{size}</th>
                        ))}
                        <th>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.rows.map(({ label, values }) => (
                        <tr key={label} className={`print-total-${label.toLowerCase().replaceAll(" ", "-")}`}>
                          <th>{label}</th>
                          {group.sizeColumns.map((size) => (
                            <td key={size}>{displayNumber(values[size] || 0)}</td>
                          ))}
                          <td>
                            {displayNumber(
                              group.sizeColumns.reduce(
                                (sum, size) => sum + (values[size] || 0),
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </section>
                )}

                <section className="cut-planning-print-sheet cut-planning-print-old">
                  <table className="cut-planning-print-table cut-planning-print-planning-grid">
                    <thead>
                      <tr>
                        <th rowSpan={3}>FABRIC WIDTH</th>
                        <th rowSpan={3}>SR</th>
                        <th rowSpan={3}>TOTAL PCS</th>
                        <th rowSpan={3}>SHRINKAGE</th>
                        <th rowSpan={3}>PLYS</th>
                        <th rowSpan={3}>CUT #</th>
                        <th rowSpan={3}>BUNDLE</th>
                        <th className="print-inseam-label" colSpan={group.sizeColumns.length}>INSEAM</th>
                        <th rowSpan={3}>FABRIC</th>
                        <th rowSpan={3}>SHADE</th>
                        <th rowSpan={3}>M.AVG</th>
                        <th rowSpan={3}>MK LENGTH</th>
                      </tr>
                      <tr>
                        <th className="print-inseam-value" colSpan={group.sizeColumns.length}>{group.inseam ?? "-"}</th>
                      </tr>
                      <tr>
                        {group.sizeColumns.map((size) => <th key={size}>{size}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="print-required-row">
                        <td colSpan={5} />
                        <th colSpan={2}>QTY</th>
                        {group.sizeColumns.map((size) => <td key={size}>{displayNumber(group.orderQuantities[size] || 0)}</td>)}
                        <td colSpan={4} />
                      </tr>
                      {printedRows.map(({ plan }, index) => {
                        const markerTotal = group.sizeColumns.reduce((sum, size) => sum + (plan.sizeQuantities[size] || 0), 0);
                        return (
                          <tr key={plan.id ?? `print-layout-row-${index}`}>
                            <td>{plan.markerWidthCm == null ? "-" : displayNumber(plan.markerWidthCm)}</td>
                            <td>{index + 1}</td>
                            <td>{displayNumber(markerTotal * plan.markerPlies)}</td>
                            <td>{plan.shrinkage || "-"}</td>
                            <td>{displayNumber(plan.markerPlies)}</td>
                            <td>{plan.cutNo || "-"}</td>
                            <td>{plan.markerNo || "-"}</td>
                            {group.sizeColumns.map((size) => <td key={size}>{displayNumber(plan.sizeQuantities[size] || 0)}</td>)}
                            {index === 0 && (
                              <td
                                className="print-fabric-cell"
                                rowSpan={printedRows.length}
                              >
                                {activeFabricItem || materialSummaries[0]?.itemNames[0] || "-"}
                              </td>
                            )}
                            <td>{plan.shade || "-"}</td>
                            <td>{markerTotal ? displayNumber(markerTotal / 100) : "-"}</td>
                            <td>{plan.markerLengthM == null ? "-" : displayNumber(plan.markerLengthM)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
                <section className="cut-planning-print-section cut-planning-print-legacy">
                  <div className="cut-planning-print-section-title">
                    <span>MARKER / CUTTING DETAIL</span>
                    <span>PLANNING SHEET</span>
                  </div>
                <table className="cut-planning-print-table">
                  <thead>
                    <tr>
                      <th>SR</th>
                      <th>DATE</th>
                      <th>MARKER NO.</th>
                      <th>CUT NO.</th>
                      <th>PLYS</th>
                      <th>SHRINKAGE</th>
                      <th>SHADE</th>
                      <th>WIDTH (CM)</th>
                      <th>MK LENGTH (M)</th>
                      {group.sizeColumns.map((size) => (
                        <th key={size}>{size}</th>
                      ))}
                      <th>TOTAL PCS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printedRows.map(({ plan }, index) => {
                      const markerTotal = group.sizeColumns.reduce(
                        (sum, size) => sum + (plan.sizeQuantities[size] || 0),
                        0,
                      );
                      return (
                        <tr key={plan.id ?? `print-row-${index}`}>
                          <td>{index + 1}</td>
                          <td>{plan.planDate || "—"}</td>
                          <td>{plan.markerNo || "—"}</td>
                          <td>{plan.cutNo || "—"}</td>
                          <td>{displayNumber(plan.markerPlies)}</td>
                          <td>{plan.shrinkage || "—"}</td>
                          <td>{plan.shade || "—"}</td>
                          <td>{plan.markerWidthCm == null ? "—" : displayNumber(plan.markerWidthCm)}</td>
                          <td>{plan.markerLengthM == null ? "—" : displayNumber(plan.markerLengthM)}</td>
                          {group.sizeColumns.map((size) => (
                            <td key={size}>{displayNumber(plan.sizeQuantities[size] || 0)}</td>
                          ))}
                          <td>{displayNumber(markerTotal * plan.markerPlies)}</td>
                        </tr>
                      );
                    })}
                    {printedRows.length === 0 && (
                      <tr>
                        <td colSpan={group.sizeColumns.length + 10}>No marker rows entered.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </section>
                <footer className="cut-planning-print-footer">
                  <span>Prepared by: ____________________</span>
                  <span>Checked by: ____________________</span>
                </footer>
              </section>
            );
          })}
        </div>
      )}
      <WorkOrderSearchModal
        open={showWorkOrderModal}
        onClose={() => setShowWorkOrderModal(false)}
        onSelect={(row) => {
          setShowWorkOrderModal(false);
          setSharedWorkOrder(row.workOrder);
          load(row.workOrder);
        }}
        fetchRows={fetchWorkOrderRows}
      />
      {showBundleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-4">
          <div role="dialog" aria-modal="true" className="max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6">
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">{showBundlePreview ? "Bundle preview" : "Generate bundles"}</h2><p className="mt-1 text-sm text-slate-500">{showBundlePreview ? "Review bundle quantities and totals before generating." : "Select one saved Cut no. and allocate its quantity by shade."}</p></div><button type="button" onClick={() => setShowBundleModal(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button></div>
            {!showBundlePreview && (
              <>
            <div className="mt-4 grid grid-cols-1 items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(15rem,1.7fr)_repeat(3,minmax(8rem,1fr))]">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Cut no.</label>
              <button
                ref={bundleCutButtonRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={bundleCutMenuOpen}
                onClick={toggleBundleCutMenu}
                className="mt-2 flex h-11 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-black text-indigo-700">#</span>
                <span className="flex-1 text-sm font-semibold text-slate-700">
                  {selectedBundleCut ? `Cut ${selectedBundleCut}` : "Select Cut no."}
                </span>
                <ChevronDown
                  className={`size-4 text-indigo-600 transition-transform ${
                    bundleCutMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
            <div className="contents">{!hasShadeSplit && <label className="text-sm font-medium text-slate-700">Bundle qty<input type="number" min="1" max={selectedMarkerPlies || undefined} step="1" value={bundleQty} onWheel={preventWheelChange} onChange={(event) => { setBundleQty(event.target.value); setShowBundlePreview(false); }} className="bundle-modal-number mt-1 h-9 w-full rounded-lg border border-slate-300 px-2" /></label>}<div className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3"><span className="text-xs font-semibold text-slate-500">Marker plies</span><span className="text-sm font-bold tabular-nums text-slate-800">{displayNumber(selectedMarkerPlies)}</span></div><div className="flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3"><span className="text-xs font-semibold text-slate-500">Cut total</span><span className="text-sm font-bold tabular-nums text-slate-800">{displayNumber(selectedBundleTotal)}</span></div></div></div>
            {!hasShadeSplit && Number(bundleQty) > 0 && !Number.isInteger(Number(bundleQty)) && <p className="mt-2 text-xs font-medium text-rose-700">Bundle qty must be a whole number.</p>}
            {selectedMarkerPlies > 0 && Number(bundleQty) > selectedMarkerPlies && <p className="mt-2 text-xs font-medium text-rose-700">Bundle qty cannot exceed Marker plies ({displayNumber(selectedMarkerPlies)}).</p>}
            {requiresShadeSplit && <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Shade split <span className="font-normal text-rose-700">(required)</span></p><p className={`text-xs font-semibold ${Math.abs(shadePlyTotal - selectedMarkerPlies) < 0.0001 && splitCutNamesAreValid ? "text-emerald-700" : "text-amber-700"}`}>Plies allocated {displayNumber(shadePlyTotal)} / {displayNumber(selectedMarkerPlies)}</p></div><p className="mt-1 text-xs text-slate-600">Each shade is generated under its own Cut No. Review the default names before generating.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectedShadeCodes.map((shade) => <div key={shade} className="space-y-2"><label className="block text-xs font-semibold text-slate-600">Shade {shade} · plies<input type="number" min="1" max={selectedMarkerPlies || undefined} step="1" value={shadeQuantities[shade] ?? ""} onWheel={preventWheelChange} onChange={(event) => { setShadeQuantities((current) => ({ ...current, [shade]: event.target.value })); setShowBundlePreview(false); }} className="bundle-modal-number mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" /></label><label className="block text-xs font-semibold text-slate-600">New Cut No.<input type="text" value={shadeCutNos[shade] ?? `${selectedBundleCut}${shade}`} onChange={(event) => { setShadeCutNos((current) => ({ ...current, [shade]: event.target.value })); setShowBundlePreview(false); }} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm" /></label></div>)}</div>{Math.abs(shadePlyTotal - selectedMarkerPlies) >= 0.0001 && <p className="mt-2 text-xs text-amber-700">Shade plies must add up exactly to Marker plies.</p>}{!splitCutNamesAreValid && <p className="mt-2 text-xs text-rose-700">Every shade needs a different Cut No. and at least one ply.</p>}</div>}
              </>
            )}
            {showBundlePreview && (
              <div className="mt-4 overflow-hidden rounded-xl border border-indigo-100">
                <div className="max-h-[min(55dvh,32rem)] overflow-auto">
                  <table className="w-full min-w-[760px] table-fixed text-xs">
                    <colgroup>
                      <col className="w-[8%]" />
                      <col className="w-[17%]" />
                      <col className="w-[10%]" />
                      <col className="w-[9%]" />
                      <col className="w-[8%]" />
                      <col className="w-[25%]" />
                      <col className="w-[10%]" />
                      <col className="w-[13%]" />
                    </colgroup>
                    <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-2 py-2 text-center">Cut</th>
                        <th className="px-2 py-2">Bundle ID</th>
                        <th className="px-2 py-2 text-right">Bundle qty</th>
                        <th className="px-2 py-2 text-center">Inseam</th>
                        <th className="px-2 py-2 text-center">Size</th>
                        <th className="px-2 py-2">Color</th>
                        <th className="px-2 py-2 text-center">Shade</th>
                        <th className="px-2 py-2 text-center">Shrinkage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundlePreview.map((row, index) => (
                        <tr
                          key={`${row.cutNo}-${row.inseam ?? "none"}-${row.size}-${index}`}
                          className="border-t border-slate-100 align-middle"
                        >
                          <td className="px-2 py-2 text-center font-semibold text-indigo-700">{row.cutNo}</td>
                          <td className="break-all px-2 py-2 font-mono text-indigo-700">{row.previewId}</td>
                          <td className="px-2 py-2 text-right font-semibold">{displayNumber(row.qty)}</td>
                          <td className="px-2 py-2 text-center">{row.inseam ?? "—"}</td>
                          <td className="px-2 py-2 text-center font-semibold">{row.size}</td>
                          <td className="break-words px-2 py-2 leading-4" title={row.color}>{row.color}</td>
                          <td className="break-words px-2 py-2 text-center font-semibold">{row.shade || "—"}</td>
                          <td className="break-words px-2 py-2 text-center font-mono">{row.shrinkage || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 z-10 border-t-2 border-indigo-200 bg-indigo-50 text-slate-800 shadow-[0_-2px_4px_-3px_rgb(15_23_42)]">
                      <tr>
                        <td className="px-2 py-2 text-center text-[10px] font-bold text-indigo-800">
                          Cut: {bundlePreviewByCut.length}
                        </td>
                        <td className="px-2 py-2 text-[10px] font-bold">Total: {bundlePreview.length}</td>
                        <td className="px-2 py-2 text-right font-bold text-indigo-800">{displayNumber(bundlePreviewTotal)}</td>
                        <td className="px-2 py-2 text-center text-[10px] font-bold text-indigo-800">{bundlePreviewUniqueCounts.inseams}</td>
                        <td className="px-2 py-2 text-center text-[10px] font-bold text-indigo-800">{bundlePreviewUniqueCounts.sizes}</td>
                        <td />
                        <td className="px-2 py-2 text-center text-[10px] font-bold text-indigo-800">{bundlePreviewUniqueCounts.shades}</td>
                        <td className="px-2 py-2 text-center text-[10px] font-bold text-indigo-800">{bundlePreviewUniqueCounts.shrinkages}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => showBundlePreview ? setShowBundlePreview(false) : setShowBundleModal(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">{showBundlePreview ? "Back" : "Cancel"}</button><button type="button" disabled={generatingBundles || !selectedBundleCut || isDirty || (!hasShadeSplit && (!Number.isInteger(Number(bundleQty)) || Number(bundleQty) <= 0)) || (!hasShadeSplit && selectedMarkerPlies > 0 && Number(bundleQty) > selectedMarkerPlies) || (hasShadeSplit && (Math.abs(shadePlyTotal - selectedMarkerPlies) >= 0.0001 || !splitCutNamesAreValid))} onClick={() => { if (showBundlePreview) { void generateBundlesFromSelection(); return; } void loadBundlePreview(); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{generatingBundles ? "Generating..." : showBundlePreview ? "Confirm & generate" : "Preview bundles"}</button></div>
          </div>
        </div>
      )}
      {showBundleModal &&
        !showBundlePreview &&
        bundleCutMenuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={bundleCutMenuRef}
            role="listbox"
            aria-label="Choose Cut no."
            className="fixed z-[60] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/20"
            style={{
              top: bundleCutMenuPosition.top,
              left: bundleCutMenuPosition.left,
              width: bundleCutMenuPosition.width,
              maxHeight: bundleCutMenuPosition.maxHeight,
            }}
          >
            <div className="sticky top-0 bg-white px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Choose one cut
            </div>
            {bundleCutOptions.map(({ cutNo }) => (
              <button
                key={cutNo}
                type="button"
                role="option"
                aria-selected={selectedBundleCut === cutNo}
                onClick={() => {
                  setSelectedBundleCut(cutNo);
                  setShadeQuantities({});
                  setShadeCutNos({});
                  setShowBundlePreview(false);
                  setBundleCutMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm font-semibold transition ${
                  selectedBundleCut === cutNo
                    ? "bg-indigo-50 text-indigo-800"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded border text-[11px] ${
                    selectedBundleCut === cutNo
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                Cut {cutNo}
              </button>
            ))}
          </div>,
          document.body,
        )}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-row-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <h2
              id="delete-row-title"
              className="text-base font-semibold text-slate-950"
            >
              Remove marker row?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This row contains entered planning data. Remove it?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deletingRowId !== null}
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingRowId !== null}
                onClick={() => {
                  if (pendingDelete.type === "marker-set") {
                    removeMarkerSet(pendingDelete.rowIndex);
                    setPendingDelete(null);
                    return;
                  }
                  void deleteRow(pendingDelete.index, pendingDelete.group);
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingRowId !== null ? "Removing..." : "Remove row"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .cell-input {
          height: 2.4rem;
          border: 0;
          border-right: 1px solid #e2e8f0;
          background: transparent;
          padding: 0 0.5rem;
          outline: none;
        }
        .cell-input:focus {
          background: #eef2ff;
          box-shadow: inset 0 0 0 1px #6366f1;
        }
        td[data-pin-column] {
          background: inherit;
        }
        .cell-label {
          border-right: 1px solid #e2e8f0;
          padding: 0 0.6rem;
          font-weight: 700;
          color: #0f172a;
        }
        .cell-value {
          border-right: 1px solid #e2e8f0;
          padding: 0 0.5rem;
          text-align: right;
          font-weight: 600;
        }
        .hide-horizontal-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-horizontal-scrollbar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .cell-input[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }
        .cell-input[type="number"]::-webkit-inner-spin-button,
        .cell-input[type="number"]::-webkit-outer-spin-button {
          appearance: none;
          margin: 0;
        }
        .bundle-modal-number[type="number"] {
          appearance: textfield;
          -moz-appearance: textfield;
        }
        .bundle-modal-number[type="number"]::-webkit-inner-spin-button,
        .bundle-modal-number[type="number"]::-webkit-outer-spin-button {
          appearance: none;
          margin: 0;
        }
        .cut-planning-page > section:nth-of-type(-n + 2) {
          display: none;
        }
        .cut-planning-print {
          display: none;
        }
        @media print {
          @page {
            size: landscape;
            margin: 5mm 6mm;
          }
          .cut-planning-page {
            margin: 0 !important;
            padding: 0 !important;
          }
          .cut-planning-page > :not(.cut-planning-print) {
            display: none !important;
          }
          .cut-planning-print {
            display: block !important;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
          }
          .cut-planning-print-page {
            min-height: 190mm;
            break-after: page;
            page-break-after: always;
          }
          .cut-planning-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .cut-planning-print-header {
            margin-bottom: 2.5mm;
            border: 1.25px solid #000;
          }
          .cut-planning-print-header h1 {
            margin: 0;
            border-bottom: 1px solid #000;
            padding: 1.8mm 3mm;
            text-align: center;
            font-size: 11pt;
            letter-spacing: 0.08em;
          }
          .cut-planning-print-details {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .cut-planning-print-details > div {
            display: grid;
            grid-template-columns: 19mm 1fr;
            min-width: 0;
            border-right: 1px solid #000;
            border-bottom: 1px solid #000;
            font-size: 6.8pt;
          }
          .cut-planning-print-details > div:nth-last-child(-n + 4) {
            border-bottom: 0;
          }
          .cut-planning-print-details > div:nth-child(4n) {
            border-right: 0;
          }
          .cut-planning-print-details span,
          .cut-planning-print-details strong {
            min-width: 0;
            padding: 1.2mm 1.5mm;
          }
          .cut-planning-print-details span {
            border-right: 1px solid #000;
            font-size: 5.8pt;
            font-weight: 700;
            text-transform: uppercase;
          }
          .cut-planning-print-details strong {
            overflow-wrap: anywhere;
          }
          .cut-planning-print-summary,
          .cut-planning-print-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 6.2pt;
          }
          .cut-planning-print-summary {
            margin-bottom: 2.5mm;
          }
          .cut-planning-print-summary th,
          .cut-planning-print-summary td,
          .cut-planning-print-table th,
          .cut-planning-print-table td {
            border: 1px solid #000;
            padding: 1.05mm .8mm;
            text-align: right;
            vertical-align: middle;
          }
          .cut-planning-print-summary th:first-child,
          .cut-planning-print-table th,
          .cut-planning-print-table td:nth-child(-n + 4) {
            text-align: center;
          }
          .cut-planning-print-summary thead,
          .cut-planning-print-table thead {
            background: #e8e8e8 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cut-planning-print-summary .print-order {
            background: #fffbd5 !important;
          }
          .cut-planning-print-summary .print-will-be-cut {
            background: #f0efff !important;
          }
          .cut-planning-print-summary .print-planned {
            background: #f5e4f1 !important;
          }
          .cut-planning-print-summary .print-less {
            background: #ffb7c0 !important;
          }
          .cut-planning-print-summary .print-over {
            background: #59c9eb !important;
          }
          .cut-planning-print-summary tr {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cut-planning-print-section {
            margin-bottom: 2.5mm;
            border: 1.25px solid #000;
          }
          .cut-planning-print-summary-section,
          .cut-planning-print-legacy,
          .cut-planning-print-old,
          .cut-planning-print-inseam-meta {
            display: none !important;
          }
          .cut-planning-print-two-inseams {
            display: block;
          }
          .cut-planning-print-total-pair {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 2.5mm;
            margin-top: 4mm;
          }
          .cut-planning-print-total-panel {
            border: 1.25px solid #000;
          }
          .cut-planning-print-total-panel .cut-planning-print-table {
            margin: 0;
            font-size: 5.5pt;
          }
          .cut-planning-print-total-panel th,
          .cut-planning-print-total-panel td {
            padding: .8mm .5mm;
            text-align: center;
          }
          .cut-planning-print-total-panel tbody th {
            text-align: left;
            white-space: nowrap;
          }
          .cut-planning-print-sheet {
            border: 1.25px solid #000;
            margin: 0;
          }
          .cut-planning-print-planning-grid {
            margin: 0;
            font-size: 5.7pt;
          }
          .cut-planning-print-planning-grid th,
          .cut-planning-print-planning-grid td {
            height: 3.2mm;
            padding: .28mm .4mm;
            line-height: 1.05;
            text-align: center;
          }
          .cut-planning-print-planning-grid thead th {
            font-size: 5pt;
            font-weight: 700;
            white-space: nowrap;
          }
          .cut-planning-print-planning-grid .print-inseam-label,
          .cut-planning-print-planning-grid .print-inseam-value {
            background: #fff2cc !important;
            font-size: 6.5pt;
            font-weight: 800;
            letter-spacing: .08em;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cut-planning-print-planning-grid .print-fixed-column-spacer {
            background: #fff !important;
          }
          .cut-planning-print-planning-grid .print-inseam-value {
            font-size: 7pt;
          }
          .cut-planning-print-planning-grid .print-required-row {
            background: #f2f2f2 !important;
            font-weight: 700;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cut-planning-print-planning-grid .print-fabric-cell {
            overflow-wrap: anywhere;
            padding: .8mm 1mm !important;
            text-align: left;
            font-size: 5pt;
            font-weight: 500;
            line-height: 1.12;
            vertical-align: middle;
          }
          .cut-planning-print-section .cut-planning-print-summary,
          .cut-planning-print-section .cut-planning-print-table {
            margin: 0;
          }
          .cut-planning-print-section-title {
            display: flex;
            justify-content: space-between;
            border-bottom: 1px solid #000;
            padding: 1.1mm 2mm;
            background: #d9e2f3 !important;
            font-size: 6.5pt;
            font-weight: 700;
            letter-spacing: .04em;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cut-planning-print-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 5mm;
            padding: 1.5mm 1mm;
            border-top: 1px solid #000;
            font-size: 6.5pt;
          }
        }
      `}</style>
      <style jsx global>{`
        .cut-planning-page
          > section:first-of-type
          > .hide-horizontal-scrollbar {
          height: auto;
          max-height: calc(100dvh - 29rem);
        }
      `}</style>
    </main>
  );
}
