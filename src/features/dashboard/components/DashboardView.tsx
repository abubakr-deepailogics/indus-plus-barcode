"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PackageCheck,
  QrCode,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchDashboardInsights } from "../services/dashboard.service";
import type { DashboardActivity, DashboardInsights, WorkOrderInsight } from "../types";

type Range = { from: Date; to: Date };

const number = new Intl.NumberFormat();
const brand = "#b11016";

function currentPayCycle(): Range {
  const today = new Date();
  const startMonth = today.getDate() >= 24 ? today.getMonth() : today.getMonth() - 1;

  return { from: new Date(today.getFullYear(), startMonth, 24), to: today };
}

function formatRange(range: Range) {
  return `${format(range.from, "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}`;
}

function percent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function chartDateLabel(value: string) {
  const dateOnly = value.slice(0, 10);
  const date = new Date(`${dateOnly}T00:00:00`);

  return Number.isNaN(date.getTime()) ? value : format(date, "d MMM");
}

function smoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function MetricCard({ label, value, detail, icon: Icon }: { label: string; value: number; detail: string; icon: typeof QrCode }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#211f20]">{number.format(value)}</p>
        </div>
        <span className="rounded-xl bg-[#fff1f2] p-2.5 text-[#b11016]"><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function RangePicker({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  const [draft, setDraft] = useState<DateRange | undefined>(value);

  function handleSelection(next: DateRange | undefined) {
    setDraft(next);
    if (next?.from && next.to) onChange({ from: next.from, to: next.to });
  }

  return (
    <Popover>
      <PopoverTrigger className="flex min-w-[208px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#efc3c6] bg-[#fff1f2] px-3 py-2.5 text-xs font-bold text-[#b11016] transition hover:bg-[#fee2e2]">
        <CalendarDays className="h-4 w-4" />
        {formatRange(value)}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto border-0 bg-transparent p-0 shadow-none">
        <Calendar
          mode="range"
          captionLayout="dropdown"
          defaultMonth={value.from}
          disabled={{ after: new Date() }}
          selected={draft}
          onSelect={handleSelection}
          classNames={{
            day: "h-8 w-8 text-center text-xs p-0 relative flex items-center justify-center rounded-lg cursor-pointer transition-all hover:bg-[#fff1f2] hover:text-[#b11016]",
            selected: "bg-[#b11016] text-white hover:bg-[#b11016] hover:text-white shadow-md font-bold rounded-lg scale-105 [&>button]:text-white",
            range_start: "bg-[#b11016] text-white rounded-l-lg [&>button]:text-white",
            range_end: "bg-[#b11016] text-white rounded-r-lg [&>button]:text-white",
            range_middle: "bg-[#fff1f2] text-[#b11016] rounded-none [&>button]:text-[#b11016]",
            today: "bg-[#fff1f2] text-[#b11016] border border-[#efc3c6] font-extrabold rounded-lg",
            dropdown: "px-2 py-0.5 rounded-md border border-[#efc3c6] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#b11016]/10 focus:border-[#b11016] cursor-pointer hover:bg-[#fff1f2] transition-all shadow-sm",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function DailyOutputChart({ data, range }: { data: DashboardInsights["dailyOutput"]; range: Range }) {
  const values = data.map((item) => item.sewing + item.washing + item.finishing);
  const hasOutput = values.some((value) => value > 0);
  const maximum = Math.max(1, ...values);
  const coordinates = values.map((value, index) => ({
    x: 8 + (index / Math.max(values.length - 1, 1)) * 88,
    y: 82 - (value / maximum) * 62,
  }));
  const line = smoothLinePath(coordinates);
  const area = coordinates.length ? `${line} L 96 82 L 8 82 Z` : "";
  const highlightedPoints = new Set([0, values.length - 1, values.indexOf(Math.max(...values))]);
  const labels = data.filter((_, index) => index === 0 || index === data.length - 1 || index % 7 === 0);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#211f20]">Daily scanned coupon output</h2>
          <p className="mt-1 text-xs text-slate-500">Scans completed each day in the selected range.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff1f2] px-2.5 py-1 text-[11px] font-semibold text-[#b11016]"><i className="h-2 w-2 rounded-full bg-[#b11016]" /> Daily scans</span>
      </div>
      {!hasOutput ? <EmptyChart range={range} /> : <div className="mt-5 grid grid-cols-[32px_1fr] gap-2">
        <div className="flex h-48 flex-col justify-between pb-5 text-right text-[10px] font-medium text-slate-400"><span>{number.format(maximum)}</span><span>{number.format(Math.ceil(maximum / 2))}</span><span>0</span></div>
        <div>
          <svg viewBox="0 0 104 90" preserveAspectRatio="none" className="h-48 w-full overflow-visible" aria-label="Daily scanned coupons line chart">
            <defs>
              <linearGradient id="daily-output-area" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#b11016" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#b11016" stopOpacity="0.01" />
              </linearGradient>
              <linearGradient id="daily-output-line" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#8f1117" />
                <stop offset="100%" stopColor="#d65a5e" />
              </linearGradient>
            </defs>
            {[20, 51, 82].map((y) => <line key={y} x1="8" x2="96" y1={y} y2={y} stroke="#f1f5f9" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />)}
            <path d={area} fill="url(#daily-output-area)" />
            <path d={line} fill="none" stroke="url(#daily-output-line)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            {coordinates.map((point, index) => {
              if (!highlightedPoints.has(index)) return null;
              return <g key={`${point.x}-${point.y}`}><circle cx={point.x} cy={point.y} r="3.1" fill="white" vectorEffect="non-scaling-stroke" /><circle cx={point.x} cy={point.y} r="1.65" fill={brand} vectorEffect="non-scaling-stroke" /></g>;
            })}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            {labels.map((item) => <span key={item.date}>{chartDateLabel(item.date)}</span>)}
          </div>
        </div>
      </div>}
    </article>
  );
}

function EmptyChart({ range }: { range: Range }) {
  return <div className="mt-5 flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#efc3c6] bg-[#fffafa] px-6 text-center"><Activity className="h-5 w-5 text-[#b11016]" /><p className="mt-2 text-sm font-semibold text-[#211f20]">No scanned coupons in this date range.</p><p className="mt-1 text-xs text-slate-500">No scan output was recorded from {formatRange(range)}. Select another range to view activity.</p></div>;
}

function DepartmentMix({ data }: { data: DashboardInsights["departments"] }) {
  const total = data.reduce((sum, item) => sum + item.scannedCoupons, 0);
  const colors = ["#b11016", "#d65a5e", "#f1c6c8"];
  let cursor = 0;
  const stops = data.map((item, index) => {
    const end = cursor + (total ? (item.scannedCoupons / total) * 100 : 0);
    const stop = `${colors[index]} ${cursor}% ${end}%`;
    cursor = end;
    return stop;
  }).join(", ");

  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="font-semibold text-[#211f20]">Department output mix</h2>
    <p className="mt-1 text-xs text-slate-500">Share of scanned active coupons by department.</p>
    <div className="mt-5 flex items-center gap-5">
      <div className="grid h-36 w-36 shrink-0 place-items-center rounded-full" style={{ background: total ? `conic-gradient(${stops})` : "#f1f5f9" }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center"><b className="text-xl text-[#211f20]">{number.format(total)}</b><span className="text-[10px] text-slate-500">scanned</span></div>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {data.map((item, index) => <div key={item.department} className="flex items-center justify-between gap-2 text-xs"><span className="flex items-center gap-2 capitalize text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index] }} />{item.department}</span><b className="text-[#211f20]">{percent(item.scannedCoupons, total)}%</b></div>)}
      </div>
    </div>
  </article>;
}

function Pipeline({ data }: { data: DashboardInsights }) {
  const scanCompletion = percent(data.scannedCoupons, data.generatedCoupons);
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[#211f20]">Coupon completion</h2><p className="mt-1 text-xs text-slate-500">Scan completion across active generated coupons.</p></div><PackageCheck className="h-5 w-5 text-[#b11016]" /></div>
    <div className="mt-7 flex h-4 overflow-hidden rounded-full bg-slate-100">
      <span className="bg-[#b11016]" style={{ width: `${scanCompletion}%` }} />
    </div>
    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
      {[['Generated', data.generatedCoupons, '#211f20'], ['Scanned', data.scannedCoupons, '#b11016'], ['Completed W/O', data.completedWorkOrders, '#d65a5e']].map(([label, value, color]) => <div key={String(label)}><p className="text-[11px] text-slate-500">{label}</p><b className="text-base" style={{ color: String(color) }}>{number.format(Number(value))}</b></div>)}
    </div>
  </article>;
}

function Backlog({ items, title = "Work-order scan output", description = "Coupons scanned by work order." }: { items: WorkOrderInsight[]; title?: string; description?: string }) {
  const max = Math.max(1, ...items.map((item) => item.scannedCoupons));
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[#211f20]">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div><ClipboardList className="h-5 w-5 text-[#b11016]" /></div>
    <div className="mt-5 space-y-4">
      {items.slice(0, 5).map((item) => <div key={`${item.department}-${item.workOrder}`}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-[#211f20]">{item.workOrder}</span><span className="text-slate-500">{number.format(item.scannedCoupons)} scanned</span></div><div className="h-2 overflow-hidden rounded-full bg-[#fff1f2]"><div className="h-full rounded-full bg-[#b11016]" style={{ width: `${(item.scannedCoupons / max) * 100}%` }} /></div></div>)}
      {items.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No work orders have scanned coupons yet.</p>}
    </div>
  </article>;
}

function ActivityFeed({ activities }: { activities: DashboardActivity[] }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#211f20]">Live coupon activity</h2><p className="mt-1 text-xs text-slate-500">Most recent generation and scan events.</p></div><Activity className="h-5 w-5 text-[#b11016]" /></div><div className="mt-4 divide-y divide-slate-100">{activities.slice(0, 6).map((item) => <div key={item.id} className="flex items-center gap-3 py-3"><span className="rounded-full bg-[#fff1f2] p-2 text-[#b11016]">{item.type === "scan" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}</span><p className="min-w-0 flex-1 truncate text-sm text-[#211f20]"><b className="capitalize">{item.department}</b> · {item.type === "scan" ? "Coupon scanned" : `${item.couponCount ?? 0} coupons generated`} · {item.workOrder}</p><time className="shrink-0 text-[11px] text-slate-400">{format(new Date(item.occurredAt), "d MMM, HH:mm")}</time></div>)}{activities.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No recent activity is available.</p>}</div></article>;
}

export function DashboardView() {
  const [range, setRange] = useState<Range>(currentPayCycle);
  const [data, setData] = useState<DashboardInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchDashboardInsights(range.from, range.to).then((result) => { if (active) { setData(result); setError(null); } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load dashboard insights."); });
    return () => { active = false; };
  }, [range]);

  const attentionItems = useMemo(() => data?.workOrders.filter((item) => item.scannedCoupons > 0).slice(0, 5) ?? [], [data]);

  function handleRangeChange(nextRange: Range) {
    setRange((currentRange) => (
      currentRange.from.getTime() === nextRange.from.getTime() && currentRange.to.getTime() === nextRange.to.getTime()
        ? currentRange
        : nextRange
    ));
  }

  if (!data && error) return <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-[#efc3c6] bg-white px-6 text-center"><AlertTriangle className="h-7 w-7 text-[#b11016]" /><p className="mt-3 font-semibold text-[#211f20]">Dashboard insights could not be loaded.</p><p className="mt-1 text-sm text-slate-500">{error}</p></div>;
  if (!data) return <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin text-[#b11016]" /> Loading production insights…</div>;

  return <main data-client-brand className="mx-auto max-w-[1440px] space-y-5 px-4 pb-8 pt-4 sm:px-6">
    <header className="flex flex-col gap-4 rounded-2xl border border-[#efc3c6] bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-wide text-[#b11016]">IndusPlus production dashboard</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-[#211f20]">Coupon performance</h1><p className="mt-1 text-sm text-slate-500">A live consolidated view of Sewing, Washing and Finishing.</p></div>
      <RangePicker value={range} onChange={handleRangeChange} />
    </header>
    {error && <div className="flex items-center gap-2 rounded-xl border border-[#efc3c6] bg-[#fff1f2] px-4 py-3 text-sm text-[#b11016]"><AlertTriangle className="h-4 w-4" />{error}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Generated" value={data.generatedCoupons} detail="Active coupons issued" icon={QrCode} />
      <MetricCard label="Scanned" value={data.scannedCoupons} detail={`${data.completionRate}% completion rate`} icon={CheckCircle2} />
      <MetricCard label="Completed W/O" value={data.completedWorkOrders} detail="All active coupons scanned" icon={PackageCheck} />
      <MetricCard label="Today’s scans" value={data.todayScans} detail={`${number.format(data.monthScans)} scans this month`} icon={Activity} />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.45fr_0.95fr]"><DailyOutputChart data={data.dailyOutput} range={range} /><DepartmentMix data={data.departments} /></section>
    <section className="grid gap-5 xl:grid-cols-2"><Pipeline data={data} /><Backlog items={data.workOrders} /></section>
    <section className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]"><ActivityFeed activities={data.recentActivities} /><Backlog items={attentionItems} title="Top work-order scan output" description="The five work orders with the most scanned coupons." /></section>
  </main>;
}
