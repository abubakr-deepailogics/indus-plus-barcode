"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Check,
  ChevronDown,
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
import { ColumnSortMenu } from "@/components/ui/data-table/column-sort-menu";
import {
  WorkOrderSearchModal,
  type WorkOrderSearchRow,
} from "@/components/work-order-search-modal";
import { useWorkOrderParam } from "@/lib/use-work-order-param";
import { formatBundleId, lowestFreeSequences } from "@/features/cut-planning/services/bundle-sequence";
import { splitShadeCodes } from "@/features/cut-planning/services/shade-codes";
import {
  DEFAULT_PLY_TYPE,
  PLY_TYPE_MAX_LENGTH,
  type CutPlanRow,
  type CutPlanningData,
  type CutPlanningInseamGroup,
} from "../types";
import { calculateRequiredFabricMetres } from "../services/calculated-requirement";
import {
  chunkInseamGroupsForPrint,
  formatBomAverage,
  pickMainFabric,
  pickPocketingFabrics,
} from "../services/print-header";
import { summarizeShadeGroups } from "../services/shade-groups";
import { buildCutPlanningWorkbook } from "../services/cut-planning-excel";

// Reorders the matrix's marker rows by Cut no. A marker row is the n-th plan
// of every inseam, so whole rows move together and stay aligned across
// inseams. Numeric-aware (2 < 10, 5A < 5B), stable for equal Cut nos., and
// rows without a Cut no. (incl. the screen-filling blank rows) stay last.
function sortMarkerRowsByCutNo(
  plans: CutPlanRow[],
  inseams: Array<number | null>,
  direction: "asc" | "desc",
): CutPlanRow[] {
  const rowsByInseam = inseams.map((inseam) =>
    plans.filter((plan) => plan.sourceInseam === inseam),
  );
  const rowCount = Math.max(0, ...rowsByInseam.map((rows) => rows.length));
  const cutNoOf = (rowIndex: number) =>
    rowsByInseam.map((rows) => rows[rowIndex]?.cutNo.trim() ?? "").find(Boolean) ?? "";
  const order = Array.from({ length: rowCount }, (_, rowIndex) => rowIndex).sort((left, right) => {
    const leftCut = cutNoOf(left);
    const rightCut = cutNoOf(right);
    if (!leftCut || !rightCut) return (leftCut ? -1 : rightCut ? 1 : 0) || left - right;
    const compared = leftCut.localeCompare(rightCut, undefined, { numeric: true, sensitivity: "base" });
    return (direction === "asc" ? compared : -compared) || left - right;
  });
  const inseamSet = new Set(inseams);
  return [
    ...order.flatMap((rowIndex) =>
      rowsByInseam.flatMap((rows) => (rows[rowIndex] ? [rows[rowIndex]] : [])),
    ),
    ...plans.filter((plan) => !inseamSet.has(plan.sourceInseam)),
  ];
}

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
    plyType: DEFAULT_PLY_TYPE,
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
    usedSequences: number[];
  } | null>(null);
  const [selectedFabricItem, setSelectedFabricItem] = useState("");
  const [selectedFabricWorkOrder, setSelectedFabricWorkOrder] = useState("");
  const [fabricMenuOpen, setFabricMenuOpen] = useState(false);
  const [newMarkerRowIndex, setNewMarkerRowIndex] = useState<number | null>(
    null,
  );
  const matrixRef = useRef<HTMLElement>(null);
  const matrixScrollRef = useRef<HTMLDivElement>(null);
  const matrixFooterRef = useRef<HTMLDivElement>(null);
  const fabricMenuRef = useRef<HTMLDivElement>(null);
  const bundleCutButtonRef = useRef<HTMLButtonElement>(null);
  const bundleCutMenuRef = useRef<HTMLDivElement>(null);
  const newMarkerRowRef = useRef<HTMLTableRowElement>(null);
  const matrixFillerRowRef = useRef<HTMLTableRowElement>(null);
  const [matrixHeight, setMatrixHeight] = useState<number | null>(null);
  const [pinnedMatrixColumnIds, setPinnedMatrixColumnIds] = useState<string[]>(
    [],
  );
  useEffect(() => {
    const updateMatrixHeight = () => {
      const matrixTop = matrixRef.current?.getBoundingClientRect().top;
      if (matrixTop == null) return;
      const footerHeight = matrixFooterRef.current?.offsetHeight ?? 0;
      // Fill the viewport below the grid's top edge, reserving the Add marker
      // row footer and a bottom gap. Extra rows scroll inside the grid body.
      setMatrixHeight(
        Math.max(
          240,
          Math.floor(window.innerHeight - matrixTop - footerHeight - 20),
        ),
      );
    };

    updateMatrixHeight();
    const observer = new ResizeObserver(updateMatrixHeight);
    if (matrixRef.current) observer.observe(matrixRef.current);
    if (matrixFooterRef.current) observer.observe(matrixFooterRef.current);
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
  const matrixColumnOrder = useMemo(
    () => [
      "date",
      "marker-no",
      "cut-no",
      "marker-plies",
      "ply-type",
      ...groups.flatMap((group) =>
        group.sizeColumns.map((size) => matrixSizeColumnId(group, size)),
      ),
      "re-cut",
      "total",
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
  const bundleCutOptions = useMemo(() => {
    const cuts = new Map<string, { transactionQty: number; shades: Set<string> }>();
    for (const plan of plans) {
      const cutNo = plan.cutNo.trim();
      if (!cutNo) continue;
      const transactionQty = Object.values(plan.sizeQuantities).reduce((sum, qty) => sum + qty, 0) * plan.markerPlies;
      const cut = cuts.get(cutNo) ?? { transactionQty: 0, shades: new Set<string>() };
      cut.transactionQty += transactionQty;
      // Blank shades show as "—" in the Cut no. menu, not "UNSHADED".
      if (plan.shade.trim()) splitShadeCodes(plan.shade).forEach((shade) => cut.shades.add(shade));
      cuts.set(cutNo, cut);
    }
    return [...cuts.entries()]
      .map(([cutNo, { transactionQty, shades }]) => ({ cutNo, transactionQty, shades: [...shades] }))
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
    .flatMap((plan) => splitShadeCodes(plan.shade)))], [plans, selectedBundleCut]);
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
    // Lowest free numbers among the Work Order's active bundles — the same
    // numbers generateBundles will assign (see bundle-sequence.ts).
    const previewBundleIds = (count: number) =>
      bundlePreviewIdentity
        ? lowestFreeSequences(bundlePreviewIdentity.usedSequences, count).map(formatBundleId)
        : null;
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
      const previewIds = previewBundleIds(rows.length);
      return rows.map((row, index) => ({
        ...row,
        previewId: previewIds?.[index] ?? "Loading…",
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
    const previewIds = previewBundleIds(rows.length);
    return rows.map((row, index) => ({
      ...row,
      previewId: previewIds?.[index] ?? "Loading…",
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
    plan.markerWidthCm != null ||
    plan.markerLengthM != null ||
    // plyType is deliberately not checked: every new row starts as
    // DEFAULT_PLY_TYPE, so it would make blank filler rows look filled.
    Boolean(
      plan.markerNo.trim() ||
      plan.cutNo.trim() ||
      plan.shrinkage.trim() ||
      plan.shade.trim(),
    );
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

        const difference = Object.fromEntries(
          sizeColumns.map((size) => [size, planned[size] - willCut[size]]),
        ) as Record<string, number>;

        return {
          inseam: group.inseam,
          willCut,
          planned,
          difference,
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

  // Excel twin of the print: same header, rows and colours, built from the
  // same on-screen data (printHeader / printSheetRows / printShadeGroups).
  const exportCutPlanning = async () => {
    if (!workOrder || groupedPlans.length === 0) return;
    try {
      const workbook = buildCutPlanningWorkbook({
        header: {
          date: printHeader.date,
          workOrder: printHeader.workOrder.replace(/^W\/O-/i, ""),
          styleNo: printHeader.styleNo,
          styleName: printHeader.styleName,
          customer: printHeader.customer,
          average: printAverage,
          fabric: printHeader.fabric,
          pocketing: printHeader.pocketing.join(", "),
          pocketingBomAverage: printHeader.pocketingBomAverage,
          fusing: printHeader.fusing.join(", "),
          fusingAverage: printHeader.fusingAverage,
          wash: printHeader.wash,
        },
        groups: groupedPlans.map(({ group }) => group),
        rows: printSheetRows.map(({ basePlan, cells }) => ({
          markerWidthCm: basePlan.markerWidthCm,
          shrinkage: basePlan.shrinkage,
          markerPlies: basePlan.markerPlies,
          plyType: basePlan.plyType,
          cutNo: basePlan.cutNo,
          shade: basePlan.shade,
          markerLengthM: basePlan.markerLengthM,
          sizeQuantities: cells.map(({ plan }) => plan?.sizeQuantities),
        })),
        shadeGroups: printShadeGroups.rows.map((row) => row.shadeGroup),
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `cut-planning-${workOrder.replace(/[^A-Za-z0-9._-]+/g, "-")}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      console.error("Cut planning Excel export failed:", caught);
      setError("Failed to export the Excel file.");
    }
  };

  const cellClass = "cell-input";
  const markerRowCount = Math.max(
    0,
    ...groupedPlans.map(({ rows }) => rows.length),
  );
  // One-off reorder (not a live sort), so a row doesn't jump away while its
  // Cut no. is being typed. Order isn't saved: Cut Planning reloads by date.
  const sortMarkerRowsByCut = (direction: "asc" | "desc") =>
    setPlans((current) =>
      sortMarkerRowsByCutNo(current, groups.map((group) => group.inseam), direction),
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
          expectedSequences: bundlePreviewIdentity
            ? lowestFreeSequences(bundlePreviewIdentity.usedSequences, bundlePreview.length)
            : undefined,
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
        usedSequences?: unknown;
        error?: string;
      };
      if (
        !response.ok ||
        !Array.isArray(body.usedSequences) ||
        !body.usedSequences.every((n) => Number.isSafeInteger(n))
      ) {
        throw new Error(body.error || "Unable to prepare the bundle preview.");
      }
      setBundlePreviewIdentity({
        usedSequences: body.usedSequences as number[],
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

  // Pad the grid with blank marker rows until it fills the screen. Blank rows
  // are dropped on save (see hasRowData), so this does not mark the page dirty.
  useLayoutEffect(() => {
    const filler = matrixFillerRowRef.current;
    if (matrixHeight == null || groups.length === 0 || !filler) return;
    const sampleRow = filler.parentElement?.querySelector<HTMLTableRowElement>(
      "tr:not([aria-hidden])",
    );
    const rowHeight =
      sampleRow && sampleRow !== filler ? sampleRow.offsetHeight : 49;
    if (rowHeight <= 0) return;
    const missingRows = Math.floor(filler.offsetHeight / rowHeight);
    if (missingRows <= 0) return;
    setPlans((current) => [
      ...current,
      ...Array.from({ length: missingRows }, () => groups.map(makePlan)).flat(),
    ]);
  }, [groups, markerRowCount, matrixHeight]);
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
  const matrixLeadColumns = [
    ["date", "Date"],
    ["marker-no", "Marker no."],
    ["cut-no", "Cut no."],
    ["marker-plies", "Marker plies"],
    ["ply-type", "Ply type"],
  ] as const;
  const matrixDetailColumns = [
    ["re-cut", "Re-cut"],
    ["total", "Total"],
    ["transaction-count", "Transaction count"],
    ["shrinkage", "Shrinkage"],
    ["shade", "Shade"],
    ["calculated-required", "Calculated required"],
    ["marker-width", "Marker width (cm)"],
    ["marker-length", "Marker length (m)"],
    ["actions", "Actions"],
  ] as const;
  const inseamTotalsByInseam = new Map(
    inseamTotals.map((entry) => [entry.inseam, entry]),
  );
  // Footer sums for the matrix's Total, Marker plies, Transaction count,
  // Calculated required and Marker width/length columns, using the same
  // per-row values the matrix body displays (marker fields are shared per
  // row, so they are read from the first inseam's plan). Empty marker
  // width/length cells add nothing.
  const matrixFooterTotals = Array.from(
    { length: markerRowCount },
    (_, rowIndex) => rowIndex,
  ).reduce(
    (sums, rowIndex) => {
      const rowTotal = groupedPlans.reduce(
        (sum, { group, rows }) =>
          sum +
          group.sizeColumns.reduce(
            (groupTotal, size) =>
              groupTotal + (rows[rowIndex]?.plan.sizeQuantities[size] || 0),
            0,
          ),
        0,
      );
      const basePlan = groupedPlans[0]?.rows[rowIndex]?.plan;
      const markerPlies = basePlan?.markerPlies || 0;
      return {
        total: sums.total + rowTotal,
        markerPlies: sums.markerPlies + markerPlies,
        transactions: sums.transactions + rowTotal * markerPlies,
        calculatedRequired:
          sums.calculatedRequired +
          (calculateRequiredFabricMetres(basePlan?.markerLengthM ?? null, markerPlies) ?? 0),
        markerWidthCm: sums.markerWidthCm + (basePlan?.markerWidthCm ?? 0),
        markerLengthM: sums.markerLengthM + (basePlan?.markerLengthM ?? 0),
      };
    },
    {
      total: 0,
      markerPlies: 0,
      transactions: 0,
      calculatedRequired: 0,
      markerWidthCm: 0,
      markerLengthM: 0,
    },
  );
  const matrixDetailFooterTotals: Partial<Record<string, number>> = {
    total: matrixFooterTotals.total,
    "transaction-count": matrixFooterTotals.transactions,
    "calculated-required": matrixFooterTotals.calculatedRequired,
    "marker-width": matrixFooterTotals.markerWidthCm,
    "marker-length": matrixFooterTotals.markerLengthM,
  };
  // Print sheet rows: one per marker row (the n-th plan of every inseam, same
  // as the matrix). Marker fields are shared per row and read from the first
  // inseam that has a plan, matching the matrix body.
  const printSheetRows = Array.from({ length: markerRowCount }, (_, rowIndex) => {
    const cells = groupedPlans.map(({ group, rows }) => ({ group, plan: rows[rowIndex]?.plan }));
    if (!cells.some(({ plan }) => plan && hasRowData(plan))) return null;
    const basePlan = groupedPlans[0]?.rows[rowIndex]?.plan ?? cells.find(({ plan }) => plan)?.plan;
    if (!basePlan) return null;
    const ratioTotal = cells.reduce(
      (sum, { group, plan }) =>
        sum + group.sizeColumns.reduce((sizeSum, size) => sizeSum + (plan?.sizeQuantities[size] || 0), 0),
      0,
    );
    const totalPcs = ratioTotal * basePlan.markerPlies;
    const fabric = calculateRequiredFabricMetres(basePlan.markerLengthM, basePlan.markerPlies);
    return {
      key: basePlan.id ?? `print-row-${rowIndex}`,
      cells,
      basePlan,
      ratioTotal,
      totalPcs,
      fabric,
      markerAvg: fabric != null && totalPcs > 0 ? fabric / totalPcs : null,
    };
  }).filter((row): row is NonNullable<typeof row> => row !== null);
  const printTotalPcs = printSheetRows.reduce((sum, row) => sum + row.totalPcs, 0);
  const printTotalFabric = printSheetRows.reduce((sum, row) => sum + (row.fabric ?? 0), 0);
  const printTotalPlies = printSheetRows.reduce((sum, row) => sum + row.basePlan.markerPlies, 0);
  const printTotalQty = groups.reduce(
    (sum, group) => sum + group.sizeColumns.reduce((sizeSum, size) => sizeSum + (group.willCutQuantities[size] || 0), 0),
    0,
  );
  const printMaxPcs = Math.max(0, ...printSheetRows.map((row) => row.totalPcs));
  const printClosingAvg = printTotalPcs > 0 && printTotalFabric > 0 ? printTotalFabric / printTotalPcs : null;
  const fixed = (value: number | null | undefined, digits: number) =>
    value == null || !Number.isFinite(value) ? "-" : value.toFixed(digits);
  // "SIZE DETAIL & CHECK LIST" header, laid out like the Excel sheet. The
  // fabric picked in the toolbar wins over the BOM's main-body fabric; every
  // other FABRIC BOM item is shown as pocketing/piping.
  const printFabricItems = data?.metadata?.fabricItems ?? [];
  const printBomMainFabric = pickMainFabric(printFabricItems);
  const printMainFabric =
    activeFabricItem || printBomMainFabric?.itemName || materialSummaries[0]?.itemNames[0] || "";
  const printAverage =
    printFabricItems.find((item) => item.itemName === printMainFabric)?.consumption ??
    printBomMainFabric?.consumption ??
    null;
  const printPocketingNames = pickPocketingFabrics(printFabricItems, printMainFabric);
  const printFusingItems = data?.metadata?.fusingItems ?? [];
  const printHeader = {
    date: (data?.metadata?.workOrderDate ?? "").slice(0, 10),
    workOrder: data?.metadata?.workOrder ?? "",
    styleNo: data?.metadata?.styleNo || data?.metadata?.styleCode || "",
    styleName: data?.metadata?.styleName ?? "",
    customer: data?.metadata?.customerName ?? "",
    fabric: printMainFabric,
    pocketing: printPocketingNames,
    // Excel N118 (lining line) and its BOM AVG (H118).
    pocketingBomAverage: formatBomAverage(
      printFabricItems.filter((item) => printPocketingNames.includes(item.itemName)),
    ),
    fusing: [...new Set(printFusingItems.map((item) => item.itemName))],
    // Excel BH39 "FUSING AVG.": the fusing item's BOM consumption.
    fusingAverage: formatBomAverage(printFusingItems),
    wash: data?.metadata?.wash || data?.metadata?.color || "",
  };
  // Too many inseams to read on one sheet are continued on extra pages.
  // Every page repeats ALL marker rows (same SR order) so rows line up
  // across pages; only the inseam/size columns differ per page.
  const printPages = chunkInseamGroupsForPrint(groups);
  // Header GROUP table (calculated per shade) and the G37/G38 figures under
  // TOTAL PCS. Uses what is on screen, like the rest of the print.
  const printShadeGroups = summarizeShadeGroups(
    printSheetRows.map((row) => ({
      shade: row.basePlan.shade,
      fabricMetres: row.fabric,
      pcs: row.totalPcs,
    })),
  );
  const printPcsDifference = printTotalQty - printTotalPcs;
  const printSizeBorder = (group: CutPlanningInseamGroup, size: string) =>
    size === group.sizeColumns[0] ? "print-inseam-start" : "";
  // Light row tints for the matrix summary rows. `!` keeps them above the
  // slate background that pinned header cells get from matrixCellProps.
  const matrixSummaryTints = {
    lessOver: "bg-amber-50!",
    less: "bg-rose-100! text-rose-700",
    over: "bg-sky-100! text-sky-700",
    willCut: "bg-indigo-100! text-indigo-900",
    planned: "bg-fuchsia-50!",
  };
  // Per-size summary row (Less / Over, Will be cut, Planned) aligned with the
  // matrix columns. The label sits in the Date column; marker detail cells are
  // passed in because the header and footer rows lay them out differently.
  // `leadTotals` fills lead columns (e.g. Marker plies) with a footer sum.
  const matrixSummaryRow = (
    label: string,
    rowClass: string,
    cell: (
      group: CutPlanningInseamGroup,
      size: string,
    ) => { value: number; className: string },
    detailCells?: React.ReactNode,
    leadTotals?: Partial<Record<string, number>>,
  ) => (
    <tr className="text-slate-950">
      {matrixLeadColumns.map(([columnId], index) => {
        const leadTotal = leadTotals?.[columnId];
        return (
          <th
            key={columnId}
            {...matrixCellProps(
              columnId,
              `border-b border-r border-slate-300 px-2 py-2 font-semibold whitespace-nowrap text-left ${leadTotal == null ? "" : "font-bold"} ${rowClass}`,
              "header",
            )}
          >
            {index === 0 ? label : leadTotal == null ? null : displayNumber(leadTotal)}
          </th>
        );
      })}
      {groups.flatMap((group) =>
        group.sizeColumns.map((size) => {
          const { value, className } = cell(group, size);
          return (
            <td
              key={`${group.inseam}-${size}`}
              {...matrixCellProps(
                matrixSizeColumnId(group, size),
                `border-b border-r border-slate-300 px-2 py-2 text-right font-semibold ${className} ${matrixInseamBoundaryClass(group, size)}`,
              )}
            >
              {displayNumber(value)}
            </td>
          );
        }),
      )}
      {detailCells}
    </tr>
  );
  const inseamMatrix = groups.length > 0 && (
    <section
      ref={matrixRef}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:mx-[calc((min(2400px,calc(100vw-3rem))-100%)/-2)] xl:w-[min(2400px,calc(100vw-3rem))]"
    >
      <div ref={matrixScrollRef} className="overscroll-contain overflow-x-auto overflow-y-auto" style={matrixHeight == null ? undefined : { height: matrixHeight }}>
        <table className="h-full min-w-max w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-600">
            <tr>
              {matrixLeadColumns.map(([columnId]) => (
                <th
                  key={columnId}
                  {...matrixCellProps(
                    columnId,
                    "border-b border-r border-slate-300 px-2 py-2",
                    "header",
                  )}
                />
              ))}
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
                colSpan={matrixDetailColumns.length}
                className="border-b border-slate-300 px-2 py-2 text-center font-bold"
              >
                Marker details
              </th>
            </tr>
            {matrixSummaryRow(
              "Less / Over",
              matrixSummaryTints.lessOver,
              (group, size) => {
                const difference =
                  inseamTotalsByInseam.get(group.inseam)?.difference[size] ?? 0;
                return {
                  value: difference,
                  className:
                    difference < 0
                      ? matrixSummaryTints.less
                      : difference > 0
                        ? matrixSummaryTints.over
                        : matrixSummaryTints.lessOver,
                };
              },
              matrixDetailColumns.map(([columnId, heading]) => (
                <th
                  key={columnId}
                  rowSpan={3}
                  {...matrixCellProps(
                    columnId,
                    "border-b border-slate-300 px-2 py-2 align-middle font-semibold whitespace-nowrap text-slate-600",
                    "header",
                  )}
                >
                  <span className="flex items-center gap-1">{heading === "Actions" ? "" : heading} {matrixPinButton(columnId, heading.toLowerCase())}</span>
                </th>
              )),
            )}
            <tr>
              {matrixLeadColumns.map(([columnId, heading]) => (
                <th
                  key={columnId}
                  {...matrixCellProps(
                    columnId,
                    "border-b border-r border-slate-300 px-2 py-2 font-semibold whitespace-nowrap",
                    "header",
                  )}
                >
                  <span className="group/header flex items-center gap-1">
                    {heading} {matrixPinButton(columnId, heading)}
                    {/* Compact, always-visible trigger; the Cut no. inputs are
                        sized to this header's width so columns stay aligned. */}
                    {columnId === "cut-no" && (
                      <ColumnSortMenu
                        title={heading}
                        onSortAsc={() => sortMarkerRowsByCut("asc")}
                        onSortDesc={() => sortMarkerRowsByCut("desc")}
                        triggerClassName="h-4 w-3 opacity-100"
                      />
                    )}
                  </span>
                </th>
              ))}
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
                    {/* Pin sits before the size so the label right-aligns with the Less / Over and Will be cut values. */}
                    <span className="flex items-center justify-end gap-1">{matrixPinButton(matrixSizeColumnId(group, size), `size ${size}`)} {size}</span>
                  </th>
                )),
              )}
            </tr>
            {matrixSummaryRow("Will be cut", matrixSummaryTints.willCut, (group, size) => ({
              value: inseamTotalsByInseam.get(group.inseam)?.willCut[size] ?? 0,
              className: matrixSummaryTints.willCut,
            }))}
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
                      className={`${cellClass} w-24`}
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
                      className={`${cellClass} w-24`}
                    />
                  </td>
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
                      className={`${cellClass} w-28`}
                    />
                  </td>
                  <td {...matrixCellProps("ply-type", "p-0")}>
                    <input
                      value={base?.plan.plyType ?? DEFAULT_PLY_TYPE}
                      maxLength={PLY_TYPE_MAX_LENGTH}
                      onChange={(event) =>
                        updateSharedMarker(rowIndex, {
                          plyType: event.target.value,
                        })
                      }
                      className={`${cellClass} w-28`}
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
                      value={calculateRequiredFabricMetres(base?.plan.markerLengthM ?? null, markerPlies) ?? ""}
                      readOnly
                      aria-label="Calculated required fabric in metres"
                      title="Calculated as marker length × marker plies"
                      className={`${cellClass} w-24 cursor-default bg-slate-50 text-right text-slate-700`}
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
            {/* Absorbs leftover height so the grid fills the screen and the
                Planned footer sits at the bottom even with few marker rows. */}
            <tr ref={matrixFillerRowRef} aria-hidden="true" className="h-full">
              <td
                colSpan={
                  matrixLeadColumns.length +
                  groups.reduce((sum, group) => sum + group.sizeColumns.length, 0) +
                  matrixDetailColumns.length
                }
                className="p-0"
              />
            </tr>
          </tbody>
          <tfoot className="sticky bottom-0 z-10 bg-slate-100 text-slate-600">
            {matrixSummaryRow(
              "Planned",
              matrixSummaryTints.planned,
              (group, size) => ({
                value: inseamTotalsByInseam.get(group.inseam)?.planned[size] ?? 0,
                className: matrixSummaryTints.planned,
              }),
              matrixDetailColumns.map(([columnId]) => {
                const footerTotal = matrixDetailFooterTotals[columnId];
                return (
                  <td
                    key={columnId}
                    {...matrixCellProps(
                      columnId,
                      `border-b border-slate-300 px-2 py-2 text-right font-bold text-slate-950 ${matrixSummaryTints.planned}`,
                      "header",
                    )}
                  >
                    {footerTotal == null ? null : displayNumber(footerTotal)}
                  </td>
                );
              }),
              { "marker-plies": matrixFooterTotals.markerPlies },
            )}
          </tfoot>
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
                          value={calculateRequiredFabricMetres(plan.markerLengthM, plan.markerPlies) ?? ""}
                          readOnly
                          aria-label="Calculated required fabric in metres"
                          title="Calculated as marker length × marker plies"
                          className={`${cellClass} w-24 cursor-default bg-slate-50 text-right text-slate-700`}
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
      className="cut-planning-page -mt-4 w-full space-y-3 pb-4 sm:-mt-5"
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
          <div className="flex items-center justify-end gap-2">
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
                                value={calculateRequiredFabricMetres(plan.markerLengthM, plan.markerPlies) ?? ""}
                                readOnly
                                aria-label="Calculated required fabric in metres"
                                title="Calculated as marker length × marker plies"
                                className={`${cellClass} w-24 cursor-default bg-slate-50 text-right text-slate-700`}
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
        </>
      )}
      {data && groups.length > 0 && (
        <div className="cut-planning-print">
          {printPages.map((pageGroups, pageIndex) => {
            const pageInseams = new Set(pageGroups.map((group) => group.inseam));
            const isMultiPage = printPages.length > 1;
            return (
          <section key={pageIndex} className="cut-planning-print-page">
            <header className="cp-header">
              <div className="cp-header-title">
                <span className="cp-header-date">Date: {printHeader.date}</span>
                <h1>SIZE DETAIL &amp; CHECK LIST</h1>
                {isMultiPage && (
                  <span className="cp-header-page">
                    Page {pageIndex + 1} of {printPages.length} · Inseam{" "}
                    {pageGroups.map((group) => group.inseam ?? "-").join(", ")}
                  </span>
                )}
              </div>
              <table className="cp-header-grid">
                <colgroup>
                  <col className="cp-hcol-groups" />
                  <col className="cp-hcol-total" />
                  <col className="cp-hcol-average" />
                  <col className="cp-hcol-style" />
                  <col />
                  <col className="cp-hcol-fusing" />
                  <col className="cp-hcol-wash" />
                </colgroup>
                <tbody>
                  <tr>
                    <td className="cp-h-groups" rowSpan={4}>
                      {/* Per shade, calculated from the marker rows:
                          FABRIC = metres used (MK length x plys), PCS = pieces cut. */}
                      <table className="cp-shade-groups">
                        <thead>
                          <tr>
                            <th>GROUP</th>
                            <th>FABRIC</th>
                            <th>PCS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {printShadeGroups.rows.length > 0 ? (
                            printShadeGroups.rows.map((row) => (
                              <tr key={row.shadeGroup}>
                                <td className="cp-sg-name">{row.shadeGroup}</td>
                                <td>{displayPrintNumber(Math.round(row.fabricMetres)) || "-"}</td>
                                <td className="cp-sg-pcs">{displayPrintNumber(row.pcs) || "-"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3}>-</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>Total</td>
                            <td>{displayPrintNumber(Math.round(printShadeGroups.totals.fabricMetres)) || "-"}</td>
                            <td className="cp-sg-pcs">{displayPrintNumber(printShadeGroups.totals.pcs) || "-"}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </td>
                    <th className="cp-h-label" colSpan={2}>ORDER #</th>
                    <th className="cp-h-label">STYLE</th>
                    <th className="cp-h-label" colSpan={2}>CUSTOMER</th>
                    <th className="cp-h-label">PO</th>
                  </tr>
                  <tr>
                    <td className="cp-h-order" colSpan={2}>
                      {printHeader.workOrder.replace(/^W\/O-/i, "")}
                    </td>
                    <td className="cp-h-value">
                      {printHeader.styleNo}
                      {printHeader.styleName && printHeader.styleName !== printHeader.styleNo && (
                        <small>{printHeader.styleName}</small>
                      )}
                    </td>
                    <td className="cp-h-value cp-h-customer" colSpan={2}>{printHeader.customer.toUpperCase()}</td>
                    <td className="cp-h-value" />
                  </tr>
                  <tr>
                    <th className="cp-h-sublabel">TOTAL PCS</th>
                    <th className="cp-h-sublabel">AVERAGE</th>
                    <th className="cp-h-label">FABRIC</th>
                    <th className="cp-h-label">POCKETING/PIPING</th>
                    <th className="cp-h-label">FUSING</th>
                    <th className="cp-h-label">WASH</th>
                  </tr>
                  <tr>
                    {/* Excel G10 (QTY total), G37 (QTY - planned), G38 (fabric used). */}
                    <td className="cp-h-total">
                      {displayPrintNumber(printTotalQty) || "-"}
                      <small className="cp-h-diff">PCS (+,-) {displayNumber(printPcsDifference)}</small>
                      <small className="cp-h-used">
                        {printShadeGroups.totals.fabricMetres ? Math.round(printShadeGroups.totals.fabricMetres) : "-"}
                      </small>
                    </td>
                    <td className="cp-h-average">{fixed(printAverage, 2)}</td>
                    <td className="cp-h-detail">{printHeader.fabric || "-"}</td>
                    <td className="cp-h-detail">{printHeader.pocketing.join(", ") || "-"}</td>
                    <td className="cp-h-detail cp-h-small">{printHeader.fusing.join(", ") || "-"}</td>
                    <td className="cp-h-value">{printHeader.wash.toUpperCase() || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </header>
            <table className="cp-sheet">
              <colgroup>
                <col className="cp-col-width" />
                <col className="cp-col-sr" />
                <col className="cp-col-pcs" />
                <col className="cp-col-shrink" />
                <col className="cp-col-plys" />
                <col className="cp-col-plytype" />
                <col className="cp-col-cut" />
                <col className="cp-col-bundle" />
                {pageGroups.flatMap((group) => group.sizeColumns.map((size) => <col key={`${group.inseam}-${size}`} />))}
                <col className="cp-col-fabric" />
                <col className="cp-col-shade" />
                <col className="cp-col-mavg" />
                <col className="cp-col-mklength" />
              </colgroup>
              <thead>
                <tr>
                  <th className="cp-blank" />
                  <th className="cp-head cp-red cp-tiny">SR</th>
                  <th className="cp-head cp-tiny">TOTAL PCS</th>
                  <th className="cp-head cp-red">SHRINKAGE</th>
                  <th className="cp-head cp-red" colSpan={2}>PLYS</th>
                  <th className="cp-head cp-red">CUT #</th>
                  <th className="cp-head cp-red cp-tiny">BUNDLE</th>
                  {/* Same as the Excel sheet (row 39 = QTY − planned):
                      negative = planned more than will-cut, positive = still short. */}
                  {pageGroups.flatMap((group) =>
                    group.sizeColumns.map((size) => {
                      const totals = inseamTotalsByInseam.get(group.inseam);
                      const balance = (totals?.willCut[size] ?? 0) - (totals?.planned[size] ?? 0);
                      return (
                        <th key={`bal-${group.inseam}-${size}`} className={`cp-balance ${printSizeBorder(group, size)}`}>
                          {displayNumber(balance)}
                        </th>
                      );
                    }),
                  )}
                  <th className="cp-fusing" colSpan={4}>
                    FUSING AVG.{printHeader.fusingAverage ? ` ${printHeader.fusingAverage}` : ""}
                  </th>
                </tr>
                <tr>
                  <th className="cp-fabric-width" rowSpan={3}>
                    <span>FABRIC WIDTH</span>
                  </th>
                  <th className="cp-head cp-closing-label" colSpan={5}>
                    <span>CLOSING AVG</span>
                  </th>
                  <th className="cp-head cp-inseam-label" colSpan={2}>inseam</th>
                  {pageGroups.map((group) => (
                    <th
                      key={`inseam-${group.inseam ?? "none"}`}
                      className="cp-inseam print-inseam-start"
                      colSpan={group.sizeColumns.length}
                    >
                      {group.inseam ?? "-"}
                    </th>
                  ))}
                  <th className="cp-fusing-blank" colSpan={4} />
                </tr>
                <tr>
                  <th className="cp-closing-value" colSpan={5} rowSpan={2}>
                    {fixed(printClosingAvg, 2)}
                  </th>
                  <th className="cp-plain">{displayPrintNumber(printTotalPcs)}</th>
                  <th className="cp-plain cp-tiny">SIZE</th>
                  {pageGroups.flatMap((group) =>
                    group.sizeColumns.map((size) => (
                      <th key={`size-${group.inseam}-${size}`} className={`cp-plain ${printSizeBorder(group, size)}`}>{size}</th>
                    )),
                  )}
                  <th className="cp-parts" colSpan={4} />
                </tr>
                <tr>
                  <th className="cp-qty">{displayPrintNumber(printTotalQty)}</th>
                  <th className="cp-qty cp-tiny">QTY</th>
                  {pageGroups.flatMap((group) =>
                    group.sizeColumns.map((size) => (
                      <th key={`qty-${group.inseam}-${size}`} className={`cp-qty ${printSizeBorder(group, size)}`}>
                        {displayPrintNumber(group.willCutQuantities[size])}
                      </th>
                    )),
                  )}
                  <th className="cp-head cp-red">FABRIC</th>
                  <th className="cp-head cp-red">SHADE</th>
                  <th className="cp-head cp-red cp-yellow">M.AVG</th>
                  <th className="cp-head">MK LENGTH</th>
                </tr>
              </thead>
              <tbody>
                {printSheetRows.map((row, index) => {
                  const barPct = printMaxPcs > 0 ? Math.round((row.totalPcs / printMaxPcs) * 100) : 0;
                  return (
                    <tr key={row.key}>
                      <td className="cp-width-cell">
                        {row.basePlan.markerWidthCm == null ? "" : `${displayNumber(row.basePlan.markerWidthCm)} CM`}
                      </td>
                      <td className="cp-tiny">{index + 1}</td>
                      <td
                        className="cp-pcs"
                        style={{
                          background: barPct
                            ? `linear-gradient(to right, #4f81bd 0%, #dbe5f1 ${barPct}%, #ffffff ${barPct}%)`
                            : undefined,
                        }}
                      >
                        {displayPrintNumber(row.totalPcs)}
                      </td>
                      <td className="cp-bold">{row.basePlan.shrinkage}</td>
                      <td>{displayPrintNumber(row.basePlan.markerPlies)}</td>
                      <td className="cp-plytype">{row.basePlan.plyType}</td>
                      <td>{row.basePlan.cutNo}</td>
                      <td>{row.ratioTotal ? `1 - ${displayNumber(row.ratioTotal)}` : ""}</td>
                      {row.cells.filter(({ group }) => pageInseams.has(group.inseam)).flatMap(({ group, plan }) =>
                        group.sizeColumns.map((size) => (
                          <td key={`${group.inseam}-${size}`} className={`cp-bold ${printSizeBorder(group, size)}`}>
                            {displayPrintNumber(plan?.sizeQuantities[size])}
                          </td>
                        )),
                      )}
                      <td className="cp-fabric-cell">{row.fabric == null ? "-" : Math.round(row.fabric)}</td>
                      <td className="cp-bold">{row.basePlan.shade}</td>
                      <td className="cp-mavg-cell">{fixed(row.markerAvg, 2)}</td>
                      <td className="cp-bold">{fixed(row.basePlan.markerLengthM, 2)}</td>
                    </tr>
                  );
                })}
                <tr className="cp-total-row">
                  <td colSpan={2}>TOTAL</td>
                  <td>{displayPrintNumber(printTotalPcs)}</td>
                  <td />
                  <td>{displayPrintNumber(printTotalPlies)}</td>
                  <td colSpan={3} />
                  {pageGroups.flatMap((group) =>
                    group.sizeColumns.map((size) => (
                      <td key={`tot-${group.inseam}-${size}`} className={printSizeBorder(group, size)} />
                    )),
                  )}
                  <td className="cp-fabric-cell">{printTotalFabric ? Math.round(printTotalFabric) : "-"}</td>
                  <td />
                  <td className="cp-mavg-cell">{fixed(printClosingAvg, 2)}</td>
                  <td />
                </tr>
                {/* Excel rows 117-118: pocketing lining and its BOM average.
                    WIDTH, PC PLAN and PC C.AVG are written in by hand there too. */}
                <tr className="cp-lining-row">
                  <td className="cp-lining-label">LINING WIDTH</td>
                  <td className="cp-lining-label" colSpan={3}>PC PLAN</td>
                  <td className="cp-lining-label" colSpan={2}>BOM AVG</td>
                  <td className="cp-lining-value" colSpan={2}>{printHeader.pocketingBomAverage || "-"}</td>
                  <td
                    className="cp-lining-name"
                    colSpan={pageGroups.reduce((sum, group) => sum + group.sizeColumns.length, 0)}
                  >
                    {printHeader.pocketing.join(", ") || "-"}
                  </td>
                  <td className="cp-lining-label" colSpan={2}>PC C.AVG</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
            {isMultiPage && (
              <p className="cp-page-note">
                TOTAL PCS, FABRIC, M.AVG, CLOSING AVG and the TOTAL row cover the whole marker row (all inseams)
                and repeat on every page. Do not add them across pages.
              </p>
            )}
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
            <div className="sticky top-0 flex items-center justify-between bg-white px-2.5 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span>Cut no.</span>
              <span>Shade</span>
            </div>
            {bundleCutOptions.map(({ cutNo, shades }) => {
              const selected = selectedBundleCut === cutNo;
              return (
                <button
                  key={cutNo}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setSelectedBundleCut(cutNo);
                    setShadeQuantities({});
                    setShadeCutNos({});
                    setShowBundlePreview(false);
                    setBundleCutMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
                    selected
                      ? "bg-indigo-50 font-bold text-indigo-800"
                      : "font-semibold text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">Cut {cutNo}</span>
                  {shades.length > 0 ? (
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {shades.map((shade) => (
                        <span
                          key={shade}
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            selected
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {shade}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-medium text-slate-300">—</span>
                  )}
                </button>
              );
            })}
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
          /* SIZE DETAIL & CHECK LIST header — colours follow the Excel sheet:
             gold title band, blue label cells, green order #, red totals. */
          .cp-header {
            margin-bottom: 2.5mm;
            border: 1.25px solid #000;
          }
          .cp-header,
          .cp-header * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cp-header-title {
            position: relative;
            border-bottom: 1px solid #000;
            background: #ffe699;
          }
          .cp-header-title h1 {
            margin: 0;
            padding: 1.6mm 3mm;
            text-align: center;
            font-size: 12pt;
            font-weight: 800;
            letter-spacing: 0.06em;
          }
          .cp-header-date {
            position: absolute;
            left: 2mm;
            bottom: 0.8mm;
            font-size: 6.5pt;
            font-weight: 700;
          }
          .cp-header-page {
            position: absolute;
            right: 2mm;
            bottom: 0.8mm;
            font-size: 6.5pt;
            font-weight: 800;
            color: #c00000;
          }
          .cp-page-note {
            margin: 1.2mm 0 0;
            color: #c00000;
            font-size: 6pt;
            font-weight: 700;
          }
          .cp-header-grid {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .cp-hcol-groups { width: 46mm; }
          .cp-hcol-total { width: 18mm; }
          .cp-hcol-average { width: 18mm; }
          .cp-hcol-style { width: 46mm; }
          .cp-hcol-fusing { width: 28mm; }
          .cp-hcol-wash { width: 34mm; }
          .cp-header-grid .cp-h-diff,
          .cp-header-grid .cp-h-used {
            display: block;
            margin-top: 0.4mm;
            font-size: 5.5pt;
            font-weight: 700;
          }
          .cp-header-grid .cp-h-diff { color: #000; }
          .cp-header-grid .cp-h-used { color: #0000ff; }
          .cp-header-grid > tbody > tr > th,
          .cp-header-grid > tbody > tr > td {
            border: 1px solid #000;
            padding: 0.8mm 1.2mm;
            text-align: center;
            vertical-align: middle;
            overflow-wrap: anywhere;
            background: #fff;
            color: #000;
          }
          .cp-header-grid .cp-h-groups {
            padding: 0;
            vertical-align: top;
            background: #ddebf7;
          }
          .cp-header-grid .cp-h-label {
            background: #9bc2e6;
            font-size: 8pt;
            font-weight: 800;
          }
          .cp-header-grid .cp-h-sublabel {
            background: #fff;
            font-size: 6pt;
            font-weight: 800;
          }
          .cp-header-grid .cp-h-order {
            background: #92d050;
            font-size: 15pt;
            font-weight: 800;
          }
          .cp-header-grid .cp-h-value {
            font-size: 9pt;
            font-weight: 700;
          }
          .cp-header-grid .cp-h-value small {
            display: block;
            margin-top: 0.4mm;
            font-size: 5.8pt;
            font-weight: 500;
          }
          .cp-header-grid .cp-h-customer {
            font-size: 11pt;
          }
          .cp-header-grid .cp-h-total {
            color: #ff0000;
            font-size: 11pt;
            font-weight: 800;
          }
          .cp-header-grid .cp-h-average {
            font-size: 16pt;
            font-weight: 800;
          }
          .cp-header-grid .cp-h-detail {
            font-size: 7.5pt;
            font-weight: 700;
            line-height: 1.15;
          }
          .cp-header-grid .cp-h-small {
            font-size: 6pt;
          }
          .cp-shade-groups {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 6.2pt;
          }
          .cp-shade-groups th,
          .cp-shade-groups td {
            border: 0.5px solid #7f7f7f;
            padding: 0.35mm 0.6mm;
            text-align: center;
            font-weight: 700;
            background: #ddebf7;
          }
          .cp-shade-groups thead th {
            background: #bdd7ee;
            font-size: 5.8pt;
          }
          .cp-shade-groups .cp-sg-pcs {
            color: #ff0000;
            background: #fff;
          }
          .cp-shade-groups tfoot td {
            border-top: 1px solid #000;
            background: #bdd7ee;
          }
          .cp-shade-groups tfoot .cp-sg-pcs {
            background: #fff;
          }
          .cut-planning-print-marker-totals {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            border-top: 1px solid #000;
          }
          .cut-planning-print-marker-totals > div {
            display: grid;
            grid-template-columns: 1fr auto;
            min-width: 0;
            border-right: 1px solid #000;
            font-size: 6.8pt;
          }
          .cut-planning-print-marker-totals > div:last-child {
            border-right: 0;
          }
          .cut-planning-print-marker-totals span,
          .cut-planning-print-marker-totals strong {
            padding: 1.2mm 1.5mm;
          }
          .cut-planning-print-marker-totals span {
            border-right: 1px solid #000;
            font-size: 5.8pt;
            font-weight: 700;
          }
          .cut-planning-print-marker-totals strong {
            min-width: 18mm;
            text-align: right;
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
          .cp-sheet {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 6.5pt;
          }
          .cp-sheet,
          .cp-sheet * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cp-sheet th,
          .cp-sheet td {
            border: 1px solid #000;
            padding: .3mm;
            height: 5mm;
            text-align: center;
            vertical-align: middle;
            line-height: 1.05;
            overflow: hidden;
            background: #fff;
            color: #000;
          }
          .cp-sheet thead th { font-weight: 700; }
          .cp-col-width { width: 10mm; }
          .cp-col-sr { width: 4mm; }
          .cp-col-pcs { width: 9mm; }
          .cp-col-shrink { width: 9mm; }
          .cp-col-plys { width: 7mm; }
          .cp-col-plytype { width: 9mm; }
          .cp-col-cut { width: 8mm; }
          .cp-col-bundle { width: 9mm; }
          .cp-col-fabric { width: 9mm; }
          .cp-col-shade { width: 8mm; }
          .cp-col-mavg { width: 8mm; }
          .cp-col-mklength { width: 10mm; }
          .cp-sheet .cp-blank { border: 0; }
          .cp-sheet .cp-head { background: #dce6f1; }
          .cp-sheet .cp-red { color: #ff0000; }
          .cp-sheet .cp-tiny { font-size: 5pt; }
          .cp-sheet .cp-bold { font-weight: 700; }
          .cp-sheet .cp-yellow { background: #ffff00; }
          .cp-sheet .cp-balance {
            background: #c6efce;
            color: #006100;
            font-weight: 400;
          }
          .cp-sheet .cp-fusing {
            background: #fde9d9;
            color: #ff0000;
            font-size: 7pt;
            font-weight: 400;
          }
          .cp-sheet .cp-fusing-blank { background: #fde9d9; }
          .cp-sheet .cp-parts { color: #0000ff; font-size: 5pt; }
          .cp-sheet .cp-fabric-width {
            background: #dce6f1;
            color: #ff0000;
            font-size: 6pt;
            white-space: nowrap;
          }
          .cp-sheet .cp-fabric-width span {
            display: inline-block;
            writing-mode: vertical-rl;
            transform: rotate(180deg);
          }
          .cp-sheet .cp-closing-label span {
            display: inline-block;
            border: 1.5px solid #00b050;
            border-radius: 1.5mm;
            padding: .6mm 2.5mm;
            color: #ff0000;
            font-size: 8pt;
            font-weight: 400;
          }
          .cp-sheet .cp-closing-value {
            background: #ffff00;
            color: #ff0000;
            font-size: 16pt;
            font-weight: 700;
          }
          .cp-sheet .cp-inseam-label { font-size: 8pt; font-weight: 400; }
          .cp-sheet .cp-inseam {
            background: #ffff00;
            color: #ff0000;
            font-size: 11pt;
            font-weight: 400;
          }
          .cp-sheet .cp-qty { background: #dce6f1; }
          .cp-sheet .cp-width-cell {
            font-size: 5.5pt;
            font-weight: 700;
            white-space: nowrap;
          }
          .cp-sheet .cp-pcs {
            text-align: right;
            padding-right: .8mm;
            font-weight: 700;
          }
          .cp-sheet .cp-fabric-cell {
            background: #ffff00;
            color: #ff0000;
            font-size: 7pt;
          }
          .cp-sheet .cp-mavg-cell {
            background: #ffff00;
            font-weight: 700;
          }
          .cp-sheet .print-inseam-start { border-left: 2px solid #000; }
          .cp-sheet .cp-total-row td {
            background: #f2f2f2;
            font-weight: 700;
          }
          .cp-sheet .cp-plytype {
            font-size: 4.8pt;
            font-weight: 700;
            white-space: normal;
            overflow-wrap: anywhere;
          }
          .cp-sheet .cp-lining-row td { background: #f2f2f2; }
          .cp-sheet .cp-lining-label { font-size: 5.5pt; font-weight: 700; }
          .cp-sheet .cp-lining-value { font-weight: 700; }
          .cp-sheet .cp-lining-name {
            text-align: left;
            padding-left: 1.5mm;
            font-weight: 700;
          }
          .cp-sheet .cp-total-row .cp-fabric-cell,
          .cp-sheet .cp-total-row .cp-mavg-cell { background: #ffff00; }
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
