"use client";

import React from "react";
import Link from "next/link";
import {
  Search,
  Printer,
  X,
  RefreshCw,
  Clock,
  Calendar,
  Check,
  Shield,
  Eye,
  Paperclip,
  Plus,
  Monitor,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CornerDownRight,
} from "lucide-react";
import { useOrderStyleBulletinFacade } from "../hooks/useOrderStyleBulletinFacade";
import { BulletinSearchModal } from "./BulletinSearchModal";

export function OrderStyleBulletinView() {
  const facade = useOrderStyleBulletinFacade();
  const { activeData, allStyles } = facade;

  return (
    <div className="flex flex-col gap-6 max-w-[1380px] mx-auto text-xs text-[#334155] animate-fade-in relative pb-16">

      {/* Top Breadcrumb & Active Status */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
          <span>Industrial Engineering</span>
          <span className="text-[#94a3b8] font-light">/</span>
          <span className="text-[#4f46e5] font-bold">Order Style Bulletin Finishing</span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Active Bulletin
        </span>
      </div>

      {/* Main Title & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
            Order Style Bulletin Finishing
          </h1>
          <p className="text-[11px] text-[#64748b] mt-0.5">
            Create and manage order style bulletin finishing details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc] px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc] px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <Link href="/" className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
            <X className="w-3.5 h-3.5" />
            Close Order Bulletin
          </Link>
        </div>
      </div>

      {/* Grid containing Form Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left Form Panel: Basic Style Details */}
        <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">A.M. # & Customer</label>
            <div className="flex gap-1">
              <input type="text" value={activeData.amNo} onChange={facade.handleAMNumberChange} className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-100" />
              <button onClick={facade.openSearchModal} className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors">
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Style</label>
            <select value={activeData.styleCode} onChange={facade.handleStyleDropdownChange} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-100 font-semibold">
              {allStyles.map((style) => (
                <option key={style.styleCode} value={style.styleCode}>{style.styleCode} ({style.customer})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Plan Qty</label>
            <input type="text" value={activeData.planQty} onChange={(e) => facade.updateField("planQty", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Description</label>
            <input type="text" value={activeData.description} onChange={(e) => facade.updateField("description", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Style Description</label>
            <input type="text" value={activeData.styleDescription} onChange={(e) => facade.updateField("styleDescription", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Style Category</label>
            <select value={activeData.styleCategory} onChange={(e) => facade.updateField("styleCategory", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none">
              <option value="Denim / Jeans">Denim / Jeans</option>
              <option value="Outerwear">Outerwear</option>
              <option value="Sweater">Sweater</option>
              <option value="Shirt">Shirt</option>
            </select>
          </div>
        </div>

        {/* Middle Form Panel 1: SMD Details */}
        <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">SMD #</label>
            <input type="text" value={activeData.smdNo} onChange={(e) => facade.updateField("smdNo", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Final SMD #</label>
            <input type="text" value={activeData.finalSmdNo} onChange={(e) => facade.updateField("finalSmdNo", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
          </div>
        </div>

        {/* Middle Form Panel 2: Targets & Piece Rates */}
        <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">Target</label>
              <input type="text" value={activeData.target} onChange={(e) => facade.updateField("target", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">Target Unit/Min</label>
              <input type="text" value={activeData.targetUnitMin} onChange={(e) => facade.updateField("targetUnitMin", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Start Time</label>
            <div className="relative">
              <input type="text" value={activeData.startTime} onChange={(e) => facade.updateField("startTime", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
              <Clock className="w-3.5 h-3.5 text-[#94a3b8] absolute right-3 top-3" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">PQC %AM</label>
            <input type="text" value={activeData.pqcAm} onChange={(e) => facade.updateField("pqcAm", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">PQC Piece Rate</label>
            <input type="text" value={activeData.pqcPieceRate} onChange={(e) => facade.updateField("pqcPieceRate", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
          </div>
        </div>

        {/* Right Form Panel: SAM Summary & Approvals */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[#64748b] text-[10px] uppercase">Head/Reqd</span>
              <input type="text" value={activeData.headReqd} onChange={(e) => facade.updateField("headReqd", e.target.value)} className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[#64748b] text-[10px] uppercase">Total SAM</span>
              <input type="text" value={activeData.totalSam} onChange={(e) => facade.updateField("totalSam", e.target.value)} className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs focus:outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[#64748b] text-[10px] uppercase">Total Rate</span>
              <input type="text" value={activeData.totalRate} onChange={(e) => facade.updateField("totalRate", e.target.value)} className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs focus:outline-none" />
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#475569] text-[11px]">App Date</label>
                <div className="relative">
                  <input type="text" value={activeData.appDate} onChange={(e) => facade.updateField("appDate", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none" />
                  <Calendar className="w-3.5 h-3.5 text-[#94a3b8] absolute right-3 top-3" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#475569] text-[11px]">App By</label>
                <select value={activeData.appBy} onChange={(e) => facade.updateField("appBy", e.target.value)} className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none">
                  <option value={activeData.appBy}>{activeData.appBy}</option>
                  <option value="FR5159">FR5159</option>
                  <option value="FR9012">FR9012</option>
                  <option value="FR3312">FR3312</option>
                  <option value="FR7844">FR7844</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-3 mt-1">
              <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Status</span>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold border ${
                activeData.status === "Approved"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <Check className="w-3.5 h-3.5" />
                {activeData.status}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 bg-white border border-[#e0e7ff] text-[#4f46e5] px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
            <Shield className="w-3.5 h-3.5" />
            Operation Verification
          </button>
          <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
            <CornerDownRight className="w-3.5 h-3.5" />
            Forward For Approval
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#4f46e5] px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
            <Eye className="w-3.5 h-3.5" />
            View Inactive Operations
          </button>
          <button className="flex items-center gap-1.5 bg-white border-red-200 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-50 transition-all shadow-sm">
            <X className="w-3.5 h-3.5" />
            Close Pre Order Bulletin
          </button>
        </div>
      </div>

      {/* Operations Sequence Grid Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1450px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider min-w-[155px]">Section</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">Seq</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider min-w-[105px]">Seq #Op No</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider min-w-[170px]"><span className="inline-block w-2 h-2 rounded-full bg-[#6366f1] mr-1"></span>Op Name</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">SM</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">SAM</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">Rate</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-20">Incentive %</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider min-w-[145px]">MC Type</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider min-w-[110px]">Folder</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-24">Actions</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Attachment</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">M/Cs @ 100%</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">M/Cs @ Pin EFF%</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Sec. Wise Machine</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Head Plan Rec EFF %</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider min-w-[90px]">Last Op</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Ref./del.</th>
                <th className="px-2 py-3 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {activeData.operations.map((row) => (
                <tr key={row.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-2 py-2">
                    <select className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none">
                      <option value={row.section}>{row.section || "Select Section"}</option>
                      <option value="500 - PRE FINISHING">500 - PRE FINISHING</option>
                      <option value="501 - FINISHING">501 - FINISHING</option>
                      <option value="502 - PACKING">502 - PACKING</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center text-xs font-bold text-[#64748b]">{row.seq}</td>
                  <td className="px-2 py-2">
                    <select className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none">
                      <option value={row.opNo}>{row.opNo || "Select OpNo"}</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={row.opName} onChange={(e) => facade.updateOperationField(row.id, "opName", e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.sm} onChange={(e) => facade.updateOperationField(row.id, "sm", e.target.value)} className="w-10 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.sam} onChange={(e) => facade.updateOperationField(row.id, "sam", e.target.value)} className="w-10 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.rate} onChange={(e) => facade.updateOperationField(row.id, "rate", e.target.value)} className="w-10 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.incentive} onChange={(e) => facade.updateOperationField(row.id, "incentive", e.target.value)} className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="text" value={row.mcType} onChange={(e) => facade.updateOperationField(row.id, "mcType", e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-2 py-2">
                    <select className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none">
                      <option value={row.folder}>{row.folder || "Select Folder"}</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button className="inline-flex items-center gap-1 bg-white border border-[#e0e7ff] text-[#4f46e5] px-2 py-1 rounded-lg font-semibold hover:bg-indigo-50 transition-all text-[11px]">
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {"attachedFileName" in row && row.attachedFileName ? (
                      <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-semibold text-[10px] border border-emerald-200 max-w-[120px]">
                        <span className="truncate block max-w-[80px]">{row.attachedFileName}</span>
                        <button onClick={() => facade.handleRemoveAttachment(row.id)} className="hover:text-red-500 font-bold ml-1 text-xs" title="Remove attachment">×</button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1 bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] px-2 py-1 rounded-lg font-semibold hover:bg-white hover:text-[#0f172a] transition-all text-[11px] cursor-pointer">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachment
                        <input type="file" className="hidden" onChange={(e) => facade.handleAttachFile(e, row.id)} />
                      </label>
                    )}
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.mcs100} onChange={(e) => facade.updateOperationField(row.id, "mcs100", e.target.value)} className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.mcsPin} onChange={(e) => facade.updateOperationField(row.id, "mcsPin", e.target.value)} className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.secMc} onChange={(e) => facade.updateOperationField(row.id, "secMc", e.target.value)} className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-1 py-2">
                    <input type="text" value={row.headPlan} onChange={(e) => facade.updateOperationField(row.id, "headPlan", e.target.value)} className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none" />
                  </td>
                  <td className="px-2 py-2">
                    <select className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none">
                      <option value={row.lastOp}>{row.lastOp}</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={row.refDel} onChange={(e) => facade.updateOperationField(row.id, "refDel", e.target.checked)} className="rounded border-[#e2e8f0] text-[#4f46e5] focus:ring-indigo-100" />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button className="text-[#94a3b8] hover:text-[#334155] p-1">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buttons Under Table */}
      <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
            <Monitor className="w-3.5 h-3.5" />
            Show Machine Required
          </button>
          <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
            <Shield className="w-3.5 h-3.5" />
            Un-Approved Operations
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
            <RotateCcw className="w-3.5 h-3.5" />
            Re-Settle-Seq
          </button>
          <div className="flex border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
            <button className="p-2 bg-white hover:bg-[#f8fafc] border-r border-[#e2e8f0] text-[#64748b]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-2 bg-white hover:bg-[#f8fafc] text-[#64748b]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Remarks Section */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm mt-3 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        <div className="md:col-span-1 pt-1.5">
          <span className="font-bold text-[#475569] text-[11px]">Remarks</span>
        </div>
        <div className="md:col-span-9">
          <textarea value={activeData.remarks} onChange={(e) => facade.updateField("remarks", e.target.value)} placeholder="Enter remarks here..." className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[60px]" />
        </div>
        <div className="md:col-span-2 flex flex-col gap-2">
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#e0e7ff] text-[#4f46e5] py-2 rounded-xl font-bold transition-all text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
            <button className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#e2e8f0] text-[#475569] py-2 rounded-xl font-bold transition-all text-xs">
              <Eye className="w-3.5 h-3.5" />
              View
            </button>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#e0e7ff] text-[#4f46e5] py-2 rounded-xl font-bold transition-all text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
            <button className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#e2e8f0] text-[#475569] py-2 rounded-xl font-bold transition-all text-xs">
              <Eye className="w-3.5 h-3.5" />
              View
            </button>
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#f8fafc] border-t border-[#e2e8f0] px-6 py-2.5 flex items-center justify-between text-[11px] text-[#64748b] font-semibold z-30">
        <div>
          Choices in list: <span className="text-[#334155]">4</span> | Choices in full list: <span className="text-[#334155]">36863</span>
        </div>
        <div className="flex gap-8">
          <span>Record: <span className="text-[#334155]">1/1</span></span>
          <span>Enter-Query</span>
        </div>
        <div className="flex gap-4">
          <span className="font-bold text-[#475569]">&lt;OSC&gt;</span>
          <span className="font-bold text-[#475569]">&lt;DBG&gt;</span>
        </div>
      </footer>

      {/* Search Modal */}
      {facade.showSearchModal && (
        <BulletinSearchModal
          findQuery={facade.findQuery}
          onFindQueryChange={facade.setFindQuery}
          filteredStyles={facade.filteredModalStyles}
          allStyles={facade.allStyles}
          selectedIndex={facade.selectedModalIndex}
          onSelectIndex={facade.setSelectedModalIndex}
          onConfirm={facade.handleSelectRow}
          onClose={() => facade.setShowSearchModal(false)}
        />
      )}
    </div>
  );
}
