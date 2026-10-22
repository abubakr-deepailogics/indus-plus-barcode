"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  LoaderCircle,
  Plus,
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
const preventWheelChange = (event: React.WheelEvent<HTMLInputElement>) =>
  event.currentTarget.blur();
const shortenFabricName = (value: string, limit = 30) =>
  value.length > limit ? `${value.slice(0, limit).trimEnd()}..` : value;
const shadeCodes = (value: string) => {
  const shade = value.trim().toUpperCase();
  return /^[A-Z]{2,}$/.test(shade) ? [...new Set(shade)] : [shade || "UNSHADED"];
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
  const matrixRef = useRef<HTMLElement>(null);
  const matrixScrollRef = useRef<HTMLDivElement>(null);
  const matrixFooterRef = useRef<HTMLDivElement>(null);
  const totalsRef = useRef<HTMLElement>(null);
  const fabricMenuRef = useRef<HTMLDivElement>(null);
  const bundleCutMenuRef = useRef<HTMLDivElement>(null);
  const newMarkerRowRef = useRef<HTMLTableRowElement>(null);
  const [matrixMaxHeight, setMatrixMaxHeight] = useState<number | null>(null);

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
      if (!bundleCutMenuRef.current?.contains(event.target as Node)) {
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
  const requestRemove = (index: number, group: CutPlanningInseamGroup) => {
    if (hasRowData(plans[index])) setPendingDelete({ type: "plan", index, group });
    else void deleteRow(index, group);
  };
  const totals = useMemo(() => {
    const order: Record<string, number> = {};
    const willCut: Record<string, number> = {};
    const planned: Record<string, number> = {};
    for (const group of groups) {
      for (const size of sizeColumns) {
        order[size] = (order[size] || 0) + (group.orderQuantities[size] || 0);
        willCut[size] =
          (willCut[size] || 0) + (group.willCutQuantities[size] || 0);
      }
    }
    for (const plan of plans) {
      for (const size of sizeColumns)
        planned[size] = (planned[size] || 0) + (plan.sizeQuantities[size] || 0);
    }
    // Planned's final Total is the sum of the main table's Transaction count
    // (combined marker-row quantity × its marker plies), not its size Total.
    const plannedTotal = Array.from(
      { length: Math.max(0, ...groupedPlans.map(({ rows }) => rows.length)) },
      (_, rowIndex) => {
        const markerRowTotal = groups.reduce(
          (sum, group) => {
            const entry = groupedPlans.find(
              ({ group: candidate }) => candidate.inseam === group.inseam,
            )?.rows[rowIndex];
            return (
              sum +
              group.sizeColumns.reduce(
                (groupTotal, size) =>
                  groupTotal + (entry?.plan.sizeQuantities[size] || 0),
                0,
              )
            );
          },
          0,
        );
        const markerPlies = groupedPlans[0]?.rows[rowIndex]?.plan.markerPlies || 0;
        return markerRowTotal * markerPlies;
      },
    ).reduce((sum, transactionCount) => sum + transactionCount, 0);
    return {
      order,
      willCut,
      planned,
      plannedTotal,
      less: Object.fromEntries(
        sizeColumns.map((size) => [
          size,
          Math.max((willCut[size] || 0) - (planned[size] || 0), 0),
        ]),
      ),
      over: Object.fromEntries(
        sizeColumns.map((size) => [
          size,
          Math.max((planned[size] || 0) - (willCut[size] || 0), 0),
        ]),
      ),
    };
  }, [groupedPlans, groups, plans, sizeColumns]);

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
    <section ref={matrixRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div ref={matrixScrollRef} className="overscroll-contain overflow-x-auto overflow-y-auto" style={matrixMaxHeight == null ? undefined : { maxHeight: matrixMaxHeight }}>
        <table className="min-w-max w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-left text-slate-600">
            <tr>
              <th
                rowSpan={2}
                className="border-b border-r border-slate-300 px-2 py-3 font-semibold"
              >
                Date
              </th>
              {groups.map((group) => (
                <th
                  key={group.inseam ?? "none"}
                  colSpan={group.sizeColumns.length}
                  className="border-b border-r border-slate-300 px-2 py-2 text-center font-bold text-indigo-800"
                >
                  Inseam {group.inseam ?? "—"}
                </th>
              ))}
              <th
                colSpan={12}
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
                    className="border-b border-r border-slate-300 px-2 py-2 font-semibold"
                  >
                    {size}
                  </th>
                )),
              )}
              {[
                "Re-cut",
                "Total",
                "Marker no.",
                "Cut no.",
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
                  className="border-b border-slate-300 px-2 py-2 font-semibold whitespace-nowrap"
                >
                  {heading}
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
                  className={`border-b border-slate-200 transition-colors hover:bg-slate-50/50 ${rowIndex === newMarkerRowIndex ? "bg-indigo-50" : ""}`}
                >
                  <td className="p-0">
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
                  {groups.flatMap((group) =>
                    group.sizeColumns.map((size) => {
                      const entry = groupedPlans.find(
                        ({ group: candidate }) =>
                          candidate.inseam === group.inseam,
                      )?.rows[rowIndex];
                      return (
                        <td key={`${group.inseam}-${size}`} className="p-0">
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
                  <td className="p-0">
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
                  <td className="cell-value">{displayNumber(total)}</td>
                  <td className="p-0">
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
                  <td className="p-0">
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
                  <td className="p-0">
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
                  <td className="cell-value">
                    {displayNumber(total * markerPlies)}
                  </td>
                  <td className="p-0">
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
                  <td className="p-0">
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
                  <td className="p-0">
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
                  <td className="p-0">
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
                  <td className="p-0">
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
                  <td className="p-0">
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
        <button type="button" onClick={() => { setSelectedBundleCut(""); setShadeQuantities({}); setBundleCutMenuOpen(false); setBundleQty(""); setShowBundlePreview(false); setShowBundleModal(true); }} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
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
                    ...group.sizeColumns,
                    "Re-cut",
                    "Total",
                    "Marker no.",
                    "Cut no.",
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
                      className="border-b border-slate-200 hover:bg-slate-50/50"
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
      onKeyDown={addMarkerSetOnEnter}
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
                        ...sizeColumns,
                        "Re-cut",
                        "Total",
                        "Marker no.",
                        "Cut no.",
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
                            className="border-b border-slate-200 hover:bg-slate-50/50"
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
                                  update(index, { cutNo: event.target.value })
                                }
                                className={`${cellClass} w-20`}
                              />
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
              <div className="hide-horizontal-scrollbar overflow-x-auto">
                <table className="min-w-max w-full text-xs">
                  <thead className="sticky top-0 border-b border-slate-200 bg-white text-slate-950 shadow-sm">
                    <tr>
                      <th className="px-3 py-2 text-left"> </th>
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
                    {[
                      ["Order", totals.order],
                      ["Will be cut", totals.willCut],
                      ["Planned", totals.planned],
                      ["Less", totals.less],
                      ["Over", totals.over],
                    ].map(([label, quantities]) => {
                      const values = quantities as Record<string, number>;
                      const total =
                        label === "Planned"
                          ? totals.plannedTotal
                          : sizeColumns.reduce(
                              (sum, size) => sum + (values[size] || 0),
                              0,
                            );
                      return (
                        <tr
                          key={label as string}
                          className="border-t border-slate-100 text-slate-950"
                        >
                          <th className="bg-white px-3 py-2 text-left font-semibold">
                            {label as string}
                          </th>
                          {sizeColumns.map((size) => (
                            <td
                              key={size}
                              className={`px-2 py-2 text-right font-medium ${totalCellBackgrounds[String(label)]}`}
                            >
                              {displayNumber(values[size] || 0)}
                            </td>
                          ))}
                          <td
                            className={`px-3 py-2 text-right text-sm font-bold ${totalCellBackgrounds[String(label)]}`}
                          >
                            {displayNumber(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">Generate bundles</h2><p className="mt-1 text-sm text-slate-500">Select one saved Cut no. and allocate its quantity by shade.</p></div><button type="button" onClick={() => setShowBundleModal(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button></div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Cut no.</label>
              <div ref={bundleCutMenuRef} className="relative mt-2"><button type="button" aria-haspopup="listbox" aria-expanded={bundleCutMenuOpen} onClick={() => setBundleCutMenuOpen((open) => !open)} className="flex h-11 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow focus:outline-none focus:ring-2 focus:ring-indigo-200"><span className="flex size-6 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-black text-indigo-700">#</span><span className="flex-1 text-sm font-semibold text-slate-700">{selectedBundleCut ? `Cut ${selectedBundleCut}` : "Select Cut no."}</span><ChevronDown className={`size-4 text-indigo-600 transition-transform ${bundleCutMenuOpen ? "rotate-180" : ""}`} /></button>{bundleCutMenuOpen && <div role="listbox" className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"><div className="sticky top-0 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white">Choose one cut</div>{bundleCutOptions.map(({ cutNo }) => <button key={cutNo} type="button" role="option" aria-selected={selectedBundleCut === cutNo} onClick={() => { setSelectedBundleCut(cutNo); setShadeQuantities({}); setShadeCutNos({}); setShowBundlePreview(false); setBundleCutMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm font-semibold transition ${selectedBundleCut === cutNo ? "bg-indigo-50 text-indigo-800" : "text-slate-700 hover:bg-slate-50"}`}><span className={`flex size-5 items-center justify-center rounded border text-[11px] ${selectedBundleCut === cutNo ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>✓</span>Cut {cutNo}</button>)}</div>}</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">{!hasShadeSplit && <label className="text-sm font-medium text-slate-700">Bundle qty<input type="number" min="1" max={selectedMarkerPlies || undefined} step="1" value={bundleQty} onWheel={preventWheelChange} onChange={(event) => { setBundleQty(event.target.value); setShowBundlePreview(false); }} className="bundle-modal-number mt-1 h-9 w-full rounded-lg border border-slate-300 px-2" /></label>}<div className="mt-5 flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3"><span className="text-xs font-semibold text-slate-500">Marker plies</span><span className="text-sm font-bold tabular-nums text-slate-800">{displayNumber(selectedMarkerPlies)}</span></div><div className="mt-5 flex h-9 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3"><span className="text-xs font-semibold text-slate-500">Cut total</span><span className="text-sm font-bold tabular-nums text-slate-800">{displayNumber(selectedBundleTotal)}</span></div></div>
            {!hasShadeSplit && Number(bundleQty) > 0 && !Number.isInteger(Number(bundleQty)) && <p className="mt-2 text-xs font-medium text-rose-700">Bundle qty must be a whole number.</p>}
            {selectedMarkerPlies > 0 && Number(bundleQty) > selectedMarkerPlies && <p className="mt-2 text-xs font-medium text-rose-700">Bundle qty cannot exceed Marker plies ({displayNumber(selectedMarkerPlies)}).</p>}
            {requiresShadeSplit && <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-slate-800">Shade split <span className="font-normal text-rose-700">(required)</span></p><p className={`text-xs font-semibold ${Math.abs(shadePlyTotal - selectedMarkerPlies) < 0.0001 && splitCutNamesAreValid ? "text-emerald-700" : "text-amber-700"}`}>Plies allocated {displayNumber(shadePlyTotal)} / {displayNumber(selectedMarkerPlies)}</p></div><p className="mt-1 text-xs text-slate-600">Each shade is generated under its own Cut No. Review the default names before generating.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{selectedShadeCodes.map((shade) => <div key={shade} className="space-y-2"><label className="block text-xs font-semibold text-slate-600">Shade {shade} · plies<input type="number" min="1" max={selectedMarkerPlies || undefined} step="1" value={shadeQuantities[shade] ?? ""} onWheel={preventWheelChange} onChange={(event) => { setShadeQuantities((current) => ({ ...current, [shade]: event.target.value })); setShowBundlePreview(false); }} className="bundle-modal-number mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" /></label><label className="block text-xs font-semibold text-slate-600">New Cut No.<input type="text" value={shadeCutNos[shade] ?? `${selectedBundleCut}${shade}`} onChange={(event) => { setShadeCutNos((current) => ({ ...current, [shade]: event.target.value })); setShowBundlePreview(false); }} className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm" /></label></div>)}</div>{Math.abs(shadePlyTotal - selectedMarkerPlies) >= 0.0001 && <p className="mt-2 text-xs text-amber-700">Shade plies must add up exactly to Marker plies.</p>}{!splitCutNamesAreValid && <p className="mt-2 text-xs text-rose-700">Every shade needs a different Cut No. and at least one ply.</p>}</div>}
            {showBundlePreview && <div className="mt-4 overflow-hidden rounded-xl border border-indigo-100"><div className="bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-900">Bundle preview · {bundlePreview.length} bundle(s)</div><div className="max-h-52 overflow-y-auto"><table className="w-full table-fixed text-xs"><colgroup><col className="w-[8%]" /><col className="w-[17%]" /><col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[25%]" /><col className="w-[10%]" /><col className="w-[13%]" /></colgroup><thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2 text-center">Cut</th><th className="px-2 py-2">Bundle ID</th><th className="px-2 py-2 text-right">Bundle qty</th><th className="px-2 py-2 text-center">Inseam</th><th className="px-2 py-2 text-center">Size</th><th className="px-2 py-2">Color</th><th className="px-2 py-2 text-center">Shade</th><th className="px-2 py-2 text-center">Shrinkage</th></tr></thead><tbody>{bundlePreview.map((row, index) => <tr key={`${row.cutNo}-${row.inseam ?? "none"}-${row.size}-${index}`} className="border-t border-slate-100 align-middle"><td className="px-2 py-2 text-center font-semibold text-indigo-700">{row.cutNo}</td><td className="break-all px-2 py-2 font-mono text-indigo-700">{row.previewId}</td><td className="px-2 py-2 text-right font-semibold">{displayNumber(row.qty)}</td><td className="px-2 py-2 text-center">{row.inseam ?? "—"}</td><td className="px-2 py-2 text-center font-semibold">{row.size}</td><td className="break-words px-2 py-2 leading-4" title={row.color}>{row.color}</td><td className="break-words px-2 py-2 text-center font-semibold">{row.shade || "—"}</td><td className="break-words px-2 py-2 text-center font-mono">{row.shrinkage || "—"}</td></tr>)}</tbody></table></div></div>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => showBundlePreview ? setShowBundlePreview(false) : setShowBundleModal(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">{showBundlePreview ? "Back" : "Cancel"}</button><button type="button" disabled={generatingBundles || !selectedBundleCut || isDirty || (!hasShadeSplit && (!Number.isInteger(Number(bundleQty)) || Number(bundleQty) <= 0)) || (!hasShadeSplit && selectedMarkerPlies > 0 && Number(bundleQty) > selectedMarkerPlies) || (hasShadeSplit && (Math.abs(shadePlyTotal - selectedMarkerPlies) >= 0.0001 || !splitCutNamesAreValid))} onClick={() => { if (showBundlePreview) { void generateBundlesFromSelection(); return; } void loadBundlePreview(); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{generatingBundles ? "Generating..." : showBundlePreview ? "Confirm & generate" : "Preview bundles"}</button></div>
          </div>
        </div>
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
