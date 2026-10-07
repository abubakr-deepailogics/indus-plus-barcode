"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Clock, FileText, LayoutGrid, Loader2, QrCode, ScanLine, ShoppingBag, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/features/auth/context/auth-context";
import { useDepartment } from "@/lib/department-context";
import { fetchDashboardInsights } from "../services/dashboard.service";
import type { DashboardInsights } from "../types";

const formatter = new Intl.NumberFormat();

function StatCard({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  return <div className="bg-white rounded-2xl p-5 border border-[#e2e8f0] shadow-sm flex flex-col justify-between"><div className="flex flex-col gap-3">{icon}<div><span className="text-[28px] font-extrabold text-[#0f172a] tracking-tight block">{formatter.format(value)}</span><span className="text-xs font-semibold text-[#64748b]">{label}</span></div></div><span className="mt-4 pt-3 border-t border-[#f1f5f9] text-[11px] text-[#64748b]">{detail}</span></div>;
}

export function DashboardView() {
  const { user } = useAuth();
  const { department } = useDepartment();
  const [data, setData] = useState<DashboardInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchDashboardInsights(department).then((insights) => { if (active) { setData(insights); setError(null); } }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load dashboard insights."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [department]);

  const routes = useMemo(() => {
    const root = department === "sewing" ? "/industrial-engineering" : `/${department}`;
    return { generate: `${root}/coupon-generation`, scan: `${root}/coupon-scanning`, reports: `${root}/reports`, modules: root };
  }, [department]);
  const displayName = user?.displayName?.trim() || user?.email?.split("@")[0] || "there";

  const loadingCurrentDepartment = loading || (!error && data?.department !== department);
  if (loadingCurrentDepartment) return <div className="min-h-[380px] flex items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading live insights…</div>;
  if (error && !data) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{error}</div>;
  if (!data) return null;

  return <div className="flex flex-col gap-8 max-w-[1300px] mx-auto">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="flex flex-col gap-1"><h1 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">Good morning, {displayName}! <span aria-hidden="true">👋</span></h1><p className="text-sm text-[#64748b]">Live {data.department} coupon activity, updated when this page loads.</p></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Generated" value={data.generatedCoupons} detail="Active coupons" icon={<div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><QrCode className="w-5 h-5" /></div>} />
          <StatCard label="Scanned" value={data.scannedCoupons} detail={`${formatter.format(data.monthScans)} this month`} icon={<div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>} />
          <StatCard label="Pending" value={data.pendingCoupons} detail="Awaiting scan" icon={<div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><Clock className="w-5 h-5" /></div>} />
          <StatCard label="Work Orders" value={data.activeWorkOrders} detail="With active coupons" icon={<div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><ShoppingBag className="w-5 h-5" /></div>} />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col justify-between"><div><h3 className="text-sm font-bold text-[#0f172a]">Coupon completion</h3><p className="mt-1 text-xs text-slate-500">Scanned out of active generated coupons</p></div><div className="flex flex-col items-center justify-center py-6"><div className="relative w-36 h-36 flex items-center justify-center"><svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-label={`${data.completionRate}% coupon completion`}><circle cx="50" cy="50" r="40" className="stroke-[#f1f5f9]" strokeWidth="8" fill="transparent" /><circle cx="50" cy="50" r="40" className="stroke-[#6366f1] transition-all duration-700" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * data.completionRate) / 100} strokeLinecap="round" /></svg><span className="absolute text-3xl font-extrabold text-[#0f172a]">{data.completionRate}%</span></div></div><div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 py-1.5 rounded-xl border border-slate-100"><TrendingUp className="w-4 h-4" />{formatter.format(data.todayScans)} scanned today · {formatter.format(data.yesterdayScans)} yesterday</div></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col gap-5"><h3 className="text-sm font-bold text-[#0f172a]">Recent activity</h3>{data.recentActivities.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">No coupon activity has been recorded for this department yet.</p> : <div className="flex flex-col gap-4">{data.recentActivities.map((activity) => <div key={activity.id} className="flex items-center gap-3.5 py-1"><div className={`w-8 h-8 rounded-full flex items-center justify-center ${activity.type === "scan" ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"}`}>{activity.type === "scan" ? <ScanLine className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}</div><div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5"><span className="text-xs font-semibold text-[#334155]">{activity.type === "scan" ? `Coupon ${activity.couponCode} scanned for ${activity.workOrder}` : `${formatter.format(activity.couponCount || 0)} coupon${activity.couponCount === 1 ? "" : "s"} generated for ${activity.workOrder}`}</span><span className="text-[10px] text-[#94a3b8]">{formatDistanceToNow(new Date(activity.occurredAt), { addSuffix: true })}</span></div></div>)}</div>}</div>
      <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-sm flex flex-col justify-between gap-5"><h3 className="text-sm font-bold text-[#0f172a]">Quick actions</h3><div className="grid grid-cols-2 gap-3"><Link href={routes.generate} className="flex items-center gap-2.5 p-4 rounded-xl border border-[#f1f5f9] bg-[#f8fafc] hover:bg-white hover:border-[#e2e8f0] hover:shadow-sm transition-all"><FileText className="w-5 h-5 text-blue-600" /><span className="text-[11px] font-bold text-[#475569]">Generate coupons</span></Link><Link href={routes.scan} className="flex items-center gap-2.5 p-4 rounded-xl border border-[#f1f5f9] bg-[#f8fafc] hover:bg-white hover:border-[#e2e8f0] hover:shadow-sm transition-all"><ScanLine className="w-5 h-5 text-emerald-600" /><span className="text-[11px] font-bold text-[#475569]">Scan coupons</span></Link><Link href={routes.reports} className="col-span-2 flex items-center justify-center gap-2.5 p-4 rounded-xl border border-[#f1f5f9] bg-[#f8fafc] hover:bg-white hover:border-[#e2e8f0] hover:shadow-sm transition-all"><BarChart3 className="w-5 h-5 text-indigo-600" /><span className="text-[11px] font-bold text-[#475569]">View reports</span></Link></div><Link href={routes.modules} className="w-full flex items-center justify-center gap-2 py-3 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#7c3aed] rounded-xl border border-[#ddd6fe] text-xs font-bold"><LayoutGrid className="w-4 h-4" />View department modules</Link></div>
    </div>
  </div>;
}
