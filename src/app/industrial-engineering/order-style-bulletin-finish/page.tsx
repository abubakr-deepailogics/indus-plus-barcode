"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  Printer,
  X,
  RefreshCw,
  Clock,
  Calendar,
  Check,
  CheckSquare,
  Shield,
  Send,
  Eye,
  Trash2,
  Paperclip,
  Plus,
  Monitor,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CornerDownRight
} from "lucide-react";

// Mock Database of Style Bulletin Data
interface StyleBulletinData {
  amNo: string;
  customer: string;
  styleCode: string;
  planQty: string;
  description: string;
  styleDescription: string;
  styleCategory: string;
  smdNo: string;
  finalSmdNo: string;
  target: string;
  targetUnitMin: string;
  startTime: string;
  pqcAm: string;
  pqcPieceRate: string;
  headReqd: string;
  totalSam: string;
  totalRate: string;
  appDate: string;
  appBy: string;
  status: string;
  remarks: string;
  operations: Array<{
    id: number;
    section: string;
    seq: number;
    opNo: string;
    opName: string;
    sm: string;
    sam: string;
    rate: string;
    incentive: string;
    mcType: string;
    folder: string;
    mcs100: string;
    mcsPin: string;
    secMc: string;
    headPlan: string;
    lastOp: string;
    refDel: boolean;
    attachedFileName?: string;
  }>;
}

const mockDetailedStyles: StyleBulletinData[] = [
  {
    amNo: "57156",
    customer: "REIND",
    styleCode: "R0713326",
    planQty: "2000",
    description: "BARCODE GENERATION FINISHING",
    styleDescription: "Azgard Nine Limited (Manga) Finishing",
    styleCategory: "Denim / Jeans",
    smdNo: "SMD-57156",
    finalSmdNo: "FSMD-57156",
    target: "1559",
    targetUnitMin: "2.6",
    startTime: "15:20:25",
    pqcAm: "92%",
    pqcPieceRate: "1.39",
    headReqd: "18",
    totalSam: "32.0",
    totalRate: "4.45",
    appDate: "03/03/2025",
    appBy: "FR5159",
    status: "Approved",
    remarks: "Loop cutting and reinforcement patch trimming operations updated.",
    operations: [
      { id: 1, section: "500 - PRE FINISHING", seq: 1, opNo: "1", opName: "LOOP CUTTING-6", sm: "3", sam: "3", rate: "0.35", incentive: "2", mcType: "Manual", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 2, section: "501 - FINISHING", seq: 2, opNo: "2", opName: "REINFORCEMENT PATCH TRIMMING - 08", sm: "3", sam: "3", rate: "0.42", incentive: "2", mcType: "Manual", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 3, section: "502 - PACKING", seq: 3, opNo: "3", opName: "(WATCH PKT EDGE TRIM)-01", sm: "3", sam: "3", rate: "0.12", incentive: "0.4", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 4, section: "", seq: 4, opNo: "32523", opName: "POCKET BAG WASHING SERVICE STITCH", sm: "3", sam: "3", rate: "0.35", incentive: "1.2", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 5, section: "", seq: 5, opNo: "29864", opName: "FRONT POCKET CLEAN WITH PRESSURE", sm: "3", sam: "3", rate: "0.18", incentive: "0.8", mcType: "Air Blow Gun", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 6, section: "", seq: 6, opNo: "32526", opName: "TAG PINS REMOVE-02", sm: "3", sam: "3", rate: "0.24", incentive: "0.5", mcType: "Manual", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 7, section: "", seq: 7, opNo: "29689", opName: "CARE LABEL ATTACH WITH FOLDING", sm: "2", sam: "2", rate: "0.30", incentive: "0.8", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 8, section: "", seq: 8, opNo: "15855", opName: "GARMENTS ASSEMBLED FOR. ACCESSORY", sm: "2", sam: "2", rate: "0.10", incentive: "0", mcType: "Manual", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 9, section: "", seq: 9, opNo: "18779", opName: "WASHER INSERT-01", sm: "2", sam: "2", rate: "0.05", incentive: "0.1", mcType: "Manual", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 10, section: "", seq: 10, opNo: "29888", opName: "SHANK BUTTON ATTACH (LOGO)- 01", sm: "1", sam: "1", rate: "0.13", incentive: "0.35", mcType: "Button Attacher", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 11, section: "", seq: 11, opNo: "29900", opName: "RIVET ATTACH (FLAT/NIPPLE)-02", sm: "1", sam: "1", rate: "0.18", incentive: "0.6", mcType: "Rivet Attacher", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 12, section: "", seq: 12, opNo: "35143", opName: "RIVET ATTACH (CRITICAL)-01", sm: "1", sam: "1", rate: "0.18", incentive: "0.4", mcType: "Rivet Attacher", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 13, section: "", seq: 13, opNo: "29909", opName: "THREAD TRIMMING WITH POLY BAG & SE", sm: "2", sam: "2", rate: "1.39", incentive: "2", mcType: "Manual", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false }
    ]
  },
  {
    amNo: "371569%",
    customer: "LEVI STRAUSS",
    styleCode: "20713236",
    planQty: "1248",
    description: "DENIM JACKET CLASSIC",
    styleDescription: "Azgard Nine Limited (Manga) Jacket",
    styleCategory: "Outerwear",
    smdNo: "SMD-371569",
    finalSmdNo: "FSMD-371569",
    target: "1000",
    targetUnitMin: "1.8",
    startTime: "08:30:00",
    pqcAm: "95%",
    pqcPieceRate: "2.10",
    headReqd: "24",
    totalSam: "24.15",
    totalRate: "5.80",
    appDate: "12/05/2025",
    appBy: "FR9012",
    status: "Approved",
    remarks: "Standard jacket layout sequence check complete.",
    operations: [
      { id: 1, section: "500 - PRE FINISHING", seq: 1, opNo: "1", opName: "POCKET ZIPPER JOIN", sm: "3", sam: "2.40", rate: "0.45", incentive: "1.5", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.1", secMc: "Yes", headPlan: "85%", lastOp: "No", refDel: false },
      { id: 2, section: "501 - FINISHING", seq: 2, opNo: "2", opName: "FRONT PANEL ASSEMBLY", sm: "2", sam: "1.80", rate: "0.35", incentive: "1.0", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.1", secMc: "Yes", headPlan: "85%", lastOp: "No", refDel: false },
      { id: 3, section: "502 - PACKING", seq: 3, opNo: "3", opName: "BACK MESH LINING JOIN", sm: "2", sam: "1.50", rate: "0.30", incentive: "0.8", mcType: "Overlock", folder: "Standard", mcs100: "1.0", mcsPin: "1.1", secMc: "Yes", headPlan: "85%", lastOp: "No", refDel: false },
      { id: 4, section: "", seq: 4, opNo: "4", opName: "MAIN ZIPPER ATTACHMENT", sm: "4", sam: "3.10", rate: "0.60", incentive: "2.0", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.1", secMc: "Yes", headPlan: "85%", lastOp: "No", refDel: false },
      { id: 5, section: "", seq: 5, opNo: "5", opName: "HOOD ATTACHMENT", sm: "2", sam: "2.05", rate: "0.40", incentive: "1.2", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.1", secMc: "Yes", headPlan: "85%", lastOp: "No", refDel: false }
    ]
  },
  {
    amNo: "84201",
    customer: "GAP SOURCING",
    styleCode: "M901245",
    planQty: "5000",
    description: "CREWNECK FLEECE SWEATER",
    styleDescription: "Standard Fleece Batch",
    styleCategory: "Sweater",
    smdNo: "SMD-84201",
    finalSmdNo: "FSMD-84201",
    target: "3000",
    targetUnitMin: "3.5",
    startTime: "06:00:00",
    pqcAm: "88%",
    pqcPieceRate: "0.95",
    headReqd: "15",
    totalSam: "12.5",
    totalRate: "3.10",
    appDate: "20/07/2026",
    appBy: "FR3312",
    status: "Pending",
    remarks: "Requires final wash quality signoff.",
    operations: [
      { id: 1, section: "500 - PRE FINISHING", seq: 1, opNo: "1", opName: "COLLAR RIB SEWING", sm: "2", sam: "1.10", rate: "0.20", incentive: "0.5", mcType: "Overlock", folder: "Standard", mcs100: "1.0", mcsPin: "1.0", secMc: "Yes", headPlan: "95%", lastOp: "No", refDel: false },
      { id: 2, section: "501 - FINISHING", seq: 2, opNo: "2", opName: "SLEEVE CUFF JOIN", sm: "2", sam: "0.95", rate: "0.18", incentive: "0.5", mcType: "Overlock", folder: "Standard", mcs100: "1.0", mcsPin: "1.0", secMc: "Yes", headPlan: "95%", lastOp: "No", refDel: false },
      { id: 3, section: "502 - PACKING", seq: 3, opNo: "3", opName: "WAISTBAND ATTACHMENT", sm: "2", sam: "1.25", rate: "0.25", incentive: "0.8", mcType: "Flatlock", folder: "Standard", mcs100: "1.0", mcsPin: "1.0", secMc: "Yes", headPlan: "95%", lastOp: "No", refDel: false }
    ]
  },
  {
    amNo: "91238",
    customer: "H&M GLOBAL",
    styleCode: "D309812",
    planQty: "3500",
    description: "STRETCH SLIM DENIM SHIRT",
    styleDescription: "Eco-stretch Soft Denim",
    styleCategory: "Shirt",
    smdNo: "SMD-91238",
    finalSmdNo: "FSMD-91238",
    target: "1800",
    targetUnitMin: "2.1",
    startTime: "11:15:00",
    pqcAm: "94%",
    pqcPieceRate: "1.85",
    headReqd: "20",
    totalSam: "18.40",
    totalRate: "4.20",
    appDate: "28/07/2026",
    appBy: "FR7844",
    status: "Approved",
    remarks: "First run approved, quality parameters checked.",
    operations: [
      { id: 1, section: "500 - PRE FINISHING", seq: 1, opNo: "1", opName: "FRONT BUTTON PLACKET", sm: "3", sam: "1.95", rate: "0.35", incentive: "1.0", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 2, section: "501 - FINISHING", seq: 2, opNo: "2", opName: "CUFF PREP & ATTACH", sm: "2", sam: "1.50", rate: "0.28", incentive: "0.8", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false },
      { id: 3, section: "502 - PACKING", seq: 3, opNo: "3", opName: "COLLAR ATTACHMENT", sm: "3", sam: "2.10", rate: "0.40", incentive: "1.2", mcType: "Lockstitch", folder: "Standard", mcs100: "1.0", mcsPin: "1.2", secMc: "Yes", headPlan: "90%", lastOp: "No", refDel: false }
    ]
  }
];

export default function OrderStyleBulletinFinishingPage() {
  // Current active Style Bulletin Data state
  const [activeData, setActiveData] = useState<StyleBulletinData>(mockDetailedStyles[0]);

  // Modal visibility state
  const [showSearchModal, setShowSearchModal] = useState(true);
  
  // Search query term in the modal
  const [findQuery, setFindQuery] = useState("");

  // Selected bulletin index inside modal
  const [selectedModalIndex, setSelectedModalIndex] = useState(0);

  const handleSelectRow = () => {
    setActiveData(mockDetailedStyles[selectedModalIndex]);
    setShowSearchModal(false);
  };

  const handleStyleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const matched = mockDetailedStyles.find((style) => style.styleCode === e.target.value);
    if (matched) {
      setActiveData(matched);
    }
  };

  const handleAMNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Set the text field
    const matched = mockDetailedStyles.find((style) => style.amNo === value);
    if (matched) {
      setActiveData(matched);
    } else {
      setActiveData(prev => ({ ...prev, amNo: value }));
    }
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>, rowId: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const updatedOps = activeData.operations.map((o) =>
        o.id === rowId ? { ...o, attachedFileName: file.name } : o
      );
      setActiveData({ ...activeData, operations: updatedOps });
    }
  };

  const handleRemoveAttachment = (rowId: number) => {
    const updatedOps = activeData.operations.map((o) =>
      o.id === rowId ? { ...o, attachedFileName: undefined } : o
    );
    setActiveData({ ...activeData, operations: updatedOps });
  };

  // Filtered bulletins for the search modal
  const filteredModalStyles = mockDetailedStyles.filter((style) =>
    style.amNo.toLowerCase().includes(findQuery.replace("%", "").toLowerCase()) ||
    style.styleCode.toLowerCase().includes(findQuery.replace("%", "").toLowerCase())
  );

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

        {/* Action buttons */}
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
        
        {/* Left Form Panel: Basic Style Details (Spans 3 cols) */}
        <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          {/* A.M. # & Customer */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">A.M. # & Customer</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={activeData.amNo}
                onChange={handleAMNumberChange}
                className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={() => {
                  setFindQuery("");
                  setShowSearchModal(true);
                }}
                className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Style dropdown / selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Style</label>
            <select
              value={activeData.styleCode}
              onChange={handleStyleDropdownChange}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-100 font-semibold"
            >
              {mockDetailedStyles.map((style) => (
                <option key={style.styleCode} value={style.styleCode}>
                  {style.styleCode} ({style.customer})
                </option>
              ))}
            </select>
          </div>

          {/* Plan Qty */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Plan Qty</label>
            <input
              type="text"
              value={activeData.planQty}
              onChange={(e) => setActiveData({ ...activeData, planQty: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Description</label>
            <input
              type="text"
              value={activeData.description}
              onChange={(e) => setActiveData({ ...activeData, description: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            />
          </div>

          {/* Style Description */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Style Description</label>
            <input
              type="text"
              value={activeData.styleDescription}
              onChange={(e) => setActiveData({ ...activeData, styleDescription: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            />
          </div>

          {/* Style Category */}
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Style Category</label>
            <select
              value={activeData.styleCategory}
              onChange={(e) => setActiveData({ ...activeData, styleCategory: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            >
              <option value="Denim / Jeans">Denim / Jeans</option>
              <option value="Outerwear">Outerwear</option>
              <option value="Sweater">Sweater</option>
              <option value="Shirt">Shirt</option>
            </select>
          </div>
        </div>

        {/* Middle Form Panel 1: SMD Details (Spans 2 cols) */}
        <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">SMD #</label>
            <input
              type="text"
              value={activeData.smdNo}
              onChange={(e) => setActiveData({ ...activeData, smdNo: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Final SMD #</label>
            <input
              type="text"
              value={activeData.finalSmdNo}
              onChange={(e) => setActiveData({ ...activeData, finalSmdNo: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            />
          </div>
        </div>

        {/* Middle Form Panel 2: Targets & Piece Rates (Spans 3 cols) */}
        <div className="lg:col-span-3 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">Target</label>
              <input
                type="text"
                value={activeData.target}
                onChange={(e) => setActiveData({ ...activeData, target: e.target.value })}
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">Target Unit/Min</label>
              <input
                type="text"
                value={activeData.targetUnitMin}
                onChange={(e) => setActiveData({ ...activeData, targetUnitMin: e.target.value })}
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">Start Time</label>
            <div className="relative">
              <input
                type="text"
                value={activeData.startTime}
                onChange={(e) => setActiveData({ ...activeData, startTime: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
              />
              <Clock className="w-3.5 h-3.5 text-[#94a3b8] absolute right-3 top-3" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">PQC %AM</label>
            <input
              type="text"
              value={activeData.pqcAm}
              onChange={(e) => setActiveData({ ...activeData, pqcAm: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-bold text-[#475569] text-[11px]">PQC Piece Rate</label>
            <input
              type="text"
              value={activeData.pqcPieceRate}
              onChange={(e) => setActiveData({ ...activeData, pqcPieceRate: e.target.value })}
              className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
            />
          </div>
        </div>

        {/* Right Form Panel: SAM Summary & Approvals (Spans 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* SAM Totals card */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[#64748b] text-[10px] uppercase">Head/Reqd</span>
              <input
                type="text"
                value={activeData.headReqd}
                onChange={(e) => setActiveData({ ...activeData, headReqd: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[#64748b] text-[10px] uppercase">Total SAM</span>
              <input
                type="text"
                value={activeData.totalSam}
                onChange={(e) => setActiveData({ ...activeData, totalSam: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-[#64748b] text-[10px] uppercase">Total Rate</span>
              <input
                type="text"
                value={activeData.totalRate}
                onChange={(e) => setActiveData({ ...activeData, totalRate: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Approver Detail Card */}
          <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#475569] text-[11px]">App Date</label>
                <div className="relative">
                  <input
                    type="text"
                    value={activeData.appDate}
                    onChange={(e) => setActiveData({ ...activeData, appDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
                  />
                  <Calendar className="w-3.5 h-3.5 text-[#94a3b8] absolute right-3 top-3" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#475569] text-[11px]">App By</label>
                <select
                  value={activeData.appBy}
                  onChange={(e) => setActiveData({ ...activeData, appBy: e.target.value })}
                  className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
                >
                  <option value={activeData.appBy}>{activeData.appBy}</option>
                  <option value="FR5159">FR5159</option>
                  <option value="FR9012">FR9012</option>
                  <option value="FR3312">FR3312</option>
                  <option value="FR7844">FR7844</option>
                </select>
              </div>
            </div>

            {/* Approved status badge */}
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

      {/* Row Buttons (Form options) */}
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

      {/* Operations sequence Grid Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Section</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">Seq</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-24">Seq #Op No</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6366f1]"></span>Op Name</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">SM</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">SAM</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-12">Rate</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-20">Incentive %</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-24">MC Type</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-20">Folder</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center w-24">Actions</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Attachment</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">M/Cs @ 100%</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">M/Cs @ Pin EFF%</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Sec. Wise Machine</th>
                <th className="px-2 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">Head Plan Rec EFF %</th>
                <th className="px-3 py-3 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Last Op</th>
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
                  <td className="px-2 py-2 text-center text-xs font-bold text-[#64748b]">
                    {row.seq}
                  </td>
                  <td className="px-2 py-2">
                    <select className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none">
                      <option value={row.opNo}>{row.opNo || "Select OpNo"}</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.opName}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, opName: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.sm}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, sm: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-10 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.sam}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, sam: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-10 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.rate}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, rate: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-10 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.incentive}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, incentive: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={row.mcType}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, mcType: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
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
                        <button
                          onClick={() => handleRemoveAttachment(row.id)}
                          className="hover:text-red-500 font-bold ml-1 text-xs"
                          title="Remove attachment"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1 bg-[#f8fafc] border border-[#e2e8f0] text-[#64748b] px-2 py-1 rounded-lg font-semibold hover:bg-white hover:text-[#0f172a] transition-all text-[11px] cursor-pointer">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachment
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleAttachFile(e, row.id)}
                        />
                      </label>
                    )}
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.mcs100}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, mcs100: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.mcsPin}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, mcsPin: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.secMc}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, secMc: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      type="text"
                      value={row.headPlan}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, headPlan: e.target.value } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="w-16 text-center px-1 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select className="w-full px-2 py-1.5 rounded-lg border border-[#e2e8f0] bg-white text-xs focus:outline-none">
                      <option value={row.lastOp}>{row.lastOp}</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.refDel}
                      onChange={(e) => {
                        const updatedOps = activeData.operations.map((o) => o.id === row.id ? { ...o, refDel: e.target.checked } : o);
                        setActiveData({ ...activeData, operations: updatedOps });
                      }}
                      className="rounded border-[#e2e8f0] text-[#4f46e5] focus:ring-indigo-100"
                    />
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
          <textarea
            value={activeData.remarks}
            onChange={(e) => setActiveData({ ...activeData, remarks: e.target.value })}
            placeholder="Enter remarks here..."
            className="w-full px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[60px]"
          />
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

      {/* Footer bar values */}
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

      {/* Select SMD & Style SEARCH MODAL overlay */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[500px] w-full p-6 animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-4">
              <h3 className="text-sm font-extrabold text-[#0f172a]">Select SMD & Style</h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Find Search Field */}
            <div className="flex items-center gap-3 mb-4">
              <span className="font-bold text-[#475569] text-xs min-w-[40px]">Find</span>
              <input
                type="text"
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5]"
                placeholder="Search A.M. or Style Code..."
              />
            </div>

            {/* Results Table */}
            <div className="border border-[#e2e8f0] rounded-xl overflow-hidden mb-5 max-h-[220px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-24">A.M. No</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-28">Order Status</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Style Code</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredModalStyles.map((style, idx) => (
                    <tr
                      key={style.styleCode}
                      onClick={() => setSelectedModalIndex(mockDetailedStyles.indexOf(style))}
                      className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${
                        selectedModalIndex === mockDetailedStyles.indexOf(style) ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#334155]">
                        <input
                          type="radio"
                          checked={selectedModalIndex === mockDetailedStyles.indexOf(style)}
                          onChange={() => setSelectedModalIndex(mockDetailedStyles.indexOf(style))}
                          className="text-[#4f46e5] focus:ring-indigo-100 h-3.5 w-3.5"
                        />
                        <span>{style.amNo}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[#64748b]">
                        Closed
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#334155]">
                        {style.styleCode} ({style.customer})
                      </td>
                    </tr>
                  ))}
                  {filteredModalStyles.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-4 text-[#94a3b8]">No matches found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-4">
              <span className="text-[11px] text-[#94a3b8] font-semibold">{filteredModalStyles.length} results found</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSelectRow}
                  className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
