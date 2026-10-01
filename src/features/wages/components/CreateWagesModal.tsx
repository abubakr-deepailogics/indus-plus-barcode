"use client";

import { useCallback, useRef, useState } from "react";
import { format, subDays } from "date-fns";
import {
  AlertTriangle,
  CalendarIcon,
  CheckCircle2,
  Coins,
  FileText,
  Loader2,
  Lock,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createWages, previewWages, type WagePreviewResult } from "../services/wages.service";
import type { CouponDepartment } from "@/lib/department-classification";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createdBy?: string | null;
  onCreated?: (wageId: number) => void;
  department: CouponDepartment;
}

function currentPayCycleStart(): Date {
  const now = new Date();
  const day = now.getDate();
  const cycleMonth = day >= 24 ? now.getMonth() : now.getMonth() - 1;
  return new Date(now.getFullYear(), cycleMonth, 24);
}

const PRESETS: { label: string; range: () => { from: Date; to: Date } }[] = [
  { label: "Last 7 Days", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "Last 30 Days", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "This Pay Cycle", range: () => ({ from: currentPayCycleStart(), to: new Date() }) },
];

export function CreateWagesModal({ open, onOpenChange, createdBy, onCreated, department }: Props) {
  const [title, setTitle] = useState("");
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [preview, setPreview] = useState<WagePreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = range.from ? format(range.from, "yyyy-MM-dd") : "";
  const to = range.to ? format(range.to, "yyyy-MM-dd") : "";
  const rangeComplete = Boolean(from && to);

  const previewSeq = useRef(0);

  const pickRange = useCallback(
    (next: { from?: Date; to?: Date }) => {
      setRange(next);
      setError(null);

      const nextFrom = next.from ? format(next.from, "yyyy-MM-dd") : "";
      const nextTo = next.to ? format(next.to, "yyyy-MM-dd") : "";

      const seq = ++previewSeq.current;
      if (!nextFrom || !nextTo) {
        setPreview(null);
        setPreviewing(false);
        return;
      }

      setPreviewing(true);
      void previewWages({ from: nextFrom, to: nextTo, department }).then((res) => {
        if (seq !== previewSeq.current) return;
        setPreviewing(false);
        if (res.ok) {
          setPreview(res.preview);
        } else {
          setPreview(null);
          setError(res.error);
        }
      });
    },
    [department],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        previewSeq.current++;
        setTitle("");
        setRange({});
        setPreview(null);
        setError(null);
        setPreviewing(false);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const handleCreate = useCallback(async () => {
    if (submitting) return;
    setError(null);

    const hasTitle = Boolean(title.trim());
    if (!hasTitle && !rangeComplete) {
      setError("A wage title and a tenure (start and end date) are both required.");
      return;
    }
    if (!hasTitle) {
      setError("A wage title is required.");
      return;
    }
    if (!rangeComplete) {
      setError("A tenure (start and end date) is required.");
      return;
    }
    if (previewing) {
      setError("Still checking this tenure — try again in a moment.");
      return;
    }
    if (preview?.overlap) {
      setError(
        `This tenure overlaps wage "${preview.overlap.title}" (${preview.overlap.from} to ${preview.overlap.to}). Delete that wage first or pick a different tenure.`,
      );
      return;
    }
    if (!preview || preview.couponCount === 0) {
      setError("No scanned coupons in this tenure — there is nothing to pay.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createWages({
        title: title.trim(),
        from,
        to,
        createdBy: createdBy ?? undefined,
        department,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated?.(res.wageId);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wages.");
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    title,
    rangeComplete,
    previewing,
    preview,
    from,
    to,
    createdBy,
    onCreated,
    handleOpenChange,
    department,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-client-brand className="flex max-h-[85vh] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[580px]">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 sm:px-6">
          <DialogHeader className="flex-row items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <Coins className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-slate-950">
                Create Wage Record
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Select a pay tenure to calculate employee earnings and lock scanning.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4 sm:px-6">
          {/* Wage Title */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="wage-title"
              className="text-xs font-semibold text-slate-700"
            >
              Wage Title
            </label>
            <div className="relative">
              <FileText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                id="wage-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. September 2026 — 1st Half"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
            </div>
          </div>

          {/* Tenure Selection */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Tenure Period
              </span>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100/80 px-3 py-1 rounded-lg">
                <CalendarIcon className="size-3.5 text-slate-500" />
                {rangeComplete ? (
                  <span>
                    {format(range.from!, "dd MMM yyyy")} –{" "}
                    {format(range.to!, "dd MMM yyyy")}
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">Select start and end date</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const isSelected =
                  range.from &&
                  range.to &&
                  format(range.from, "yyyy-MM-dd") === format(p.range().from, "yyyy-MM-dd") &&
                  format(range.to, "yyyy-MM-dd") === format(p.range().to, "yyyy-MM-dd");
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => pickRange(p.range())}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Calendar */}
            <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50/50 p-2">
              <Calendar
                mode="range"
                captionLayout="dropdown"
                selected={range.from || range.to ? { from: range.from, to: range.to } : undefined}
                onSelect={(r) => pickRange({ from: r?.from, to: r?.to })}
                disabled={(date) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const comp = new Date(date);
                  comp.setHours(0, 0, 0, 0);
                  return comp > today;
                }}
              />
            </div>
          </div>

          {/* Live Preview Summary Card */}
          {previewing && (
            <div className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 py-4 text-xs font-semibold text-slate-500">
              <Loader2 className="size-4 animate-spin text-slate-600" />
              Calculating tenure payroll preview…
            </div>
          )}

          {!previewing && preview && preview.overlap && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-900">Tenure Overlap Conflict</p>
                <p className="mt-0.5 text-xs text-amber-800 leading-relaxed">
                  This tenure overlaps wage &ldquo;{preview.overlap.title}&rdquo; (
                  {preview.overlap.from} to {preview.overlap.to}). Delete that wage first or select a different date range.
                </p>
              </div>
            </div>
          )}

          {!previewing && preview && !preview.overlap && preview.couponCount === 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <ShieldAlert className="size-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-700">No Scanned Coupons Found</p>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                  There are no scanned production coupons recorded within this tenure.
                </p>
              </div>
            </div>
          )}

          {!previewing && preview && !preview.overlap && preview.couponCount > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60 mb-3">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Payroll Calculation Preview
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Ready to Lock
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-3">
                <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 shadow-2xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Orders</span>
                  <span className="block mt-0.5 text-sm font-extrabold text-slate-800">{preview.orderCount.toLocaleString()}</span>
                </div>
                <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 shadow-2xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Coupons</span>
                  <span className="block mt-0.5 text-sm font-extrabold text-slate-800">{preview.couponCount.toLocaleString()}</span>
                </div>
                <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 shadow-2xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Employees</span>
                  <span className="block mt-0.5 text-sm font-extrabold text-slate-800">{preview.employeeCount.toLocaleString()}</span>
                </div>
                <div className="bg-white/80 rounded-lg p-2.5 border border-emerald-100 shadow-2xs">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Total Payroll</span>
                  <span className="block mt-0.5 text-sm font-extrabold text-emerald-700">
                    Rs. {preview.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-800 bg-emerald-100/60 px-3 py-2 rounded-lg">
                <Lock className="size-3.5 shrink-0 text-emerald-700" />
                <span>Coupon scanning will be locked for all dates in this range upon creation.</span>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 font-semibold">
              <AlertTriangle className="size-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="h-9 rounded-xl border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={submitting}
            className="h-9 gap-2 rounded-xl bg-indigo-700 px-4 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800"
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Coins className="size-3.5" />
            )}
            {submitting ? "Creating Wage..." : "Create Wage Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
