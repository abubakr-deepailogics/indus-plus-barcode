"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, FileText, Settings, ShieldCheck, Printer, ArrowUpRight } from "lucide-react";
import { mockStyleBulletins } from "@/lib/mockData";

export default function StyleBulletinDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const bulletin = mockStyleBulletins.find((b) => b.id === id);

  const [status, setStatus] = useState(bulletin?.status || "Pending");

  if (!bulletin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h2 className="text-lg font-bold text-[#0f172a]">Bulletin Not Found</h2>
        <p className="text-xs text-[#64748b]">The requested style bulletin ID does not exist in our mock dataset.</p>
        <Link
          href="/industrial-engineering/order-style-bulletin-finish"
          className="text-xs font-semibold text-[#4f46e5] bg-indigo-50 hover:bg-[#e0e7ff] px-4 py-2 rounded-xl transition-all"
        >
          Return to List
        </Link>
      </div>
    );
  }

  // Calculate sum of operators needed
  const totalOperators = bulletin.operations.reduce((sum, op) => sum + op.operatorsNeeded, 0);

  return (
    <div className="flex flex-col gap-6 max-w-[1300px] mx-auto animate-fade-in">
      
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Link
              href="/industrial-engineering/order-style-bulletin-finish"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] hover:bg-[#f8fafc] transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-xs font-semibold text-[#64748b]">Order Style Bulletin Finish</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="text-2xl font-extrabold text-[#0f172a] tracking-tight">
              {bulletin.styleNo}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                status === "Approved"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  : status === "Pending"
                  ? "bg-amber-50 text-amber-700 border border-amber-100"
                  : "bg-gray-50 text-gray-700 border border-gray-100"
              }`}
            >
              {status}
            </span>
          </div>
          <p className="text-xs text-[#64748b]">{bulletin.styleName}</p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {status !== "Approved" ? (
            <button
              onClick={() => setStatus("Approved")}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Bulletin
            </button>
          ) : (
            <button
              onClick={() => setStatus("Pending")}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              Mark Pending
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] hover:bg-[#f8fafc] px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Sequence
          </button>
        </div>
      </div>

      {/* Overview Card Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Style Information */}
        <div className="md:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-wider mb-4">Style Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-[#94a3b8] block">Buyer Partner</span>
                <span className="text-xs font-bold text-[#334155]">{bulletin.buyer}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#94a3b8] block">Season Code</span>
                <span className="text-xs font-bold text-[#334155]">{bulletin.season}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#94a3b8] block">Created Date</span>
                <span className="text-xs font-bold text-[#334155]">{bulletin.dateCreated}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#94a3b8] block">Style Number</span>
                <span className="text-xs font-bold text-[#334155]">{bulletin.styleNo}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Telemetry Metrics */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Total SAM</span>
            <div>
              <span className="text-[24px] font-extrabold text-[#0f172a] block">{bulletin.totalSam}</span>
              <span className="text-[10px] text-[#64748b]">Minutes per garment</span>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Daily Target</span>
            <div>
              <span className="text-[24px] font-extrabold text-[#0f172a] block">{bulletin.targetPerDay}</span>
              <span className="text-[10px] text-[#64748b]">Units (10 hour shift)</span>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Operations</span>
            <div>
              <span className="text-[24px] font-extrabold text-[#0f172a] block">{bulletin.totalOperations}</span>
              <span className="text-[10px] text-[#64748b]">Sequence steps</span>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider block">Operators Needed</span>
            <div>
              <span className="text-[24px] font-extrabold text-[#0f172a] block">{totalOperators}</span>
              <span className="text-[10px] text-[#64748b]">Estimated manpower</span>
            </div>
          </div>
        </div>

      </div>

      {/* Operations Sequence List */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#0f172a]">Sequence of Operations</h3>
          <span className="text-[10px] font-bold text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded-lg">
            Standard Balancing
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="px-6 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-16">Seq</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-24">Code</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Operation Name</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Machine Type</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-24">SAM</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-32">Target/Hour</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-28">Operators</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {bulletin.operations.map((op, idx) => (
                <tr key={op.code} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-6 py-3.5 text-center text-xs font-bold text-[#64748b]">
                    {idx + 1}
                  </td>
                  <td className="px-6 py-3.5 text-xs font-semibold text-[#4f46e5]">
                    {op.code}
                  </td>
                  <td className="px-6 py-3.5 text-xs font-semibold text-[#334155]">
                    {op.name}
                  </td>
                  <td className="px-6 py-3.5 text-xs text-[#64748b]">
                    {op.machine}
                  </td>
                  <td className="px-6 py-3.5 text-center text-xs font-bold text-[#0f172a]">
                    {op.sam.toFixed(2)}
                  </td>
                  <td className="px-6 py-3.5 text-center text-xs font-bold text-[#0f172a]">
                    {op.targetPerHour} pcs
                  </td>
                  <td className="px-6 py-3.5 text-center text-xs font-bold text-indigo-600 bg-indigo-50/10">
                    {op.operatorsNeeded}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
