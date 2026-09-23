"use client";

import { useCallback, useRef, useState } from "react";
import { format, subDays } from "date-fns";
import { AlertTriangle, CalendarIcon, Loader2, Lock } from "lucide-react";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  createdBy?: string | null;
  // Fired after a wage is written, so the caller can refresh its wage list.
  onCreated?: (wageId: number) => void;
}

// Local copy rather than importing from @/lib/db — that module opens MSSQL
// pools and must never reach the client bundle (same reason the reports
// dashboard keeps its own).
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

export function CreateWagesModal({ open, onOpenChange, createdBy, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [preview, setPreview] = useState<WagePreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only a complete range can be previewed; a half-picked range is still
  // mid-interaction, not an error.
  const from = range.from ? format(range.from, "yyyy-MM-dd") : "";
  const to = range.to ? format(range.to, "yyyy-MM-dd") : "";
  const rangeComplete = Boolean(from && to);

  // Guards against an out-of-order preview response overwriting a newer one
  // when the user changes the tenure while a request is still in flight.
  const previewSeq = useRef(0);

  // Previewing is driven by the range-picking event rather than an effect —
  // it's a response to user input, not state to synchronise.
  const pickRange = useCallback(
    (next: { from?: Date; to?: Date }) => {
      setRange(next);
      setError(null);

      const nextFrom = next.from ? format(next.from, "yyyy-MM-dd") : "";
      const nextTo = next.to ? format(next.to, "yyyy-MM-dd") : "";

      // Bump the sequence even for an incomplete range, so a pending
      // response for the previous tenure can't land on top of it.
      const seq = ++previewSeq.current;
      if (!nextFrom || !nextTo) {
        setPreview(null);
        setPreviewing(false);
        return;
      }

      setPreviewing(true);
      void previewWages({ from: nextFrom, to: nextTo }).then((res) => {
        if (seq !== previewSeq.current) return; // superseded
        setPreviewing(false);
        if (res.ok) {
          setPreview(res.preview);
        } else {
          setPreview(null);
          setError(res.error);
        }
      });
    },
    [],
  );

  // Reset on close so a reopen never shows a stale preview from the
  // previously-picked tenure. Done in the close handler rather than an
  // effect for the same reason as above.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        previewSeq.current++; // discard any in-flight preview
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

  const blocked =
    !rangeComplete ||
    !title.trim() ||
    previewing ||
    submitting ||
    !preview ||
    preview.couponCount === 0 ||
    preview.overlap != null;

  const handleCreate = useCallback(async () => {
    if (blocked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createWages({
        title: title.trim(),
        from,
        to,
        createdBy: createdBy ?? undefined,
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
  }, [blocked, title, from, to, createdBy, onCreated, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create Wages</DialogTitle>
          <DialogDescription>
            Pick a tenure and give it a title. The wage covers every scanned
            coupon in that range — scanning is locked for those dates once it
            is created.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="wage-title"
              className="text-[10px] font-bold uppercase text-[#475569]"
            >
              Wage Title
            </label>
            <input
              id="wage-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. September 2026 — 1st Half"
              className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs font-semibold text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/10 focus:border-[#4f46e5] transition-all"
            />
          </div>

          {/* Tenure */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase text-[#475569]">
              Tenure
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => pickRange(p.range())}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#4f46e5] bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              {rangeComplete ? (
                <span>
                  {format(range.from!, "dd MMM yyyy")} –{" "}
                  {format(range.to!, "dd MMM yyyy")}
                </span>
              ) : (
                <span className="text-slate-400">Select a start and end date</span>
              )}
            </div>
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
              className="w-full"
            />
          </div>

          {/* Preview / confirmation */}
          {previewing && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Checking this tenure…
            </div>
          )}

          {!previewing && preview && preview.overlap && (
            <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-800">
                This tenure overlaps wage &ldquo;{preview.overlap.title}&rdquo; (
                {preview.overlap.from} to {preview.overlap.to}). Delete that
                wage first or pick a different tenure.
              </p>
            </div>
          )}

          {!previewing && preview && !preview.overlap && preview.couponCount === 0 && (
            <div className="flex gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <AlertTriangle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-slate-600">
                No scanned coupons in this tenure — there is nothing to pay.
              </p>
            </div>
          )}

          {!previewing && preview && !preview.overlap && preview.couponCount > 0 && (
            <div className="flex gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
              <Lock className="w-4 h-4 text-[#4f46e5] shrink-0 mt-0.5" />
              <div className="text-xs font-semibold text-slate-700 leading-relaxed">
                <p>
                  This tenure has{" "}
                  <strong>{preview.orderCount.toLocaleString()} order(s)</strong>{" "}
                  across{" "}
                  <strong>{preview.couponCount.toLocaleString()} coupon(s)</strong>{" "}
                  for{" "}
                  <strong>{preview.employeeCount.toLocaleString()} employee(s)</strong>
                  , totalling{" "}
                  <strong>
                    Rs.{" "}
                    {preview.totalAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                  .
                </p>
                <p className="mt-1 text-[#4f46e5]">
                  Scanning will be locked for these dates. Do you want to proceed?
                </p>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={blocked}>
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Creating…" : "Create Wages"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
