"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Search,
  Printer,
  X,
  Trash2,
  CheckCircle,
  FileText,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Layers,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

// Types for Barcode Finishing Data
interface OperationsDetailRow {
  id: number;
  section: string;
  seqNo: string;
  opNo: string;
  operationName: string;
  smv: string;
  rate: string;
  skills: string;
  lastOpSection: boolean;
}

interface BundleDetailRow {
  id: number;
  transId: string;
  line: string;
  bundleNo: string;
  inseam: string;
  size: string;
  pcs: number;
  sel: boolean;
  code: string;
}

interface BarcodeStyleData {
  anlNo: string;
  customer: string;
  styleCode: string;
  generateBy: string;
  generateDatetime: string;
  totalWash: string;
  generatedCoupons: string;
  balance: string;
  generatedBundle: string;
  notes: string;
  remarks: string;
  reworkQtyMain: string;
  reworkQtyBundle: string;
  subTotal: string;
  total: string;
  operations: OperationsDetailRow[];
  bundles: BundleDetailRow[];
}

const mockBarcodeStyles: BarcodeStyleData[] = [
  {
    anlNo: "57156",
    customer: "REIND",
    styleCode: "R0713326",
    generateBy: "FR5159",
    generateDatetime: "03/03/25 15:20:25",
    totalWash: "1559",
    generatedCoupons: "2000",
    balance: "0",
    generatedBundle: "2000",
    notes: "Regular finishing production batch.",
    remarks: "Washing and button attaching completed.",
    reworkQtyMain: "73",
    reworkQtyBundle: "0",
    subTotal: "170,000",
    total: "170,000",
    operations: [
      {
        id: 1,
        section: "500 - PRE FINISHING",
        seqNo: "1",
        opNo: "1",
        operationName: "LOOP CUTTING-6",
        smv: "3.00",
        rate: "0.35",
        skills: "Skilled",
        lastOpSection: false,
      },
      {
        id: 2,
        section: "501 - FINISHING",
        seqNo: "2",
        opNo: "2",
        operationName: "REINFORCEMENT PATCH TRIMMING - 08",
        smv: "3.00",
        rate: "0.42",
        skills: "Skilled",
        lastOpSection: false,
      },
      {
        id: 3,
        section: "502 - PACKING",
        seqNo: "3",
        opNo: "3",
        operationName: "(WATCH PKT EDGE TRIM)-01",
        smv: "3.00",
        rate: "0.12",
        skills: "Semi-Skilled",
        lastOpSection: false,
      },
      {
        id: 4,
        section: "",
        seqNo: "4",
        opNo: "32523",
        operationName: "POCKET BAG WASHING SERVICE STITCH",
        smv: "3.00",
        rate: "0.35",
        skills: "Skilled",
        lastOpSection: false,
      },
      {
        id: 5,
        section: "",
        seqNo: "5",
        opNo: "29864",
        operationName: "FRONT POCKET CLEAN WITH PRESSURE",
        smv: "3.00",
        rate: "0.18",
        skills: "Un-Skilled",
        lastOpSection: false,
      },
      {
        id: 6,
        section: "",
        seqNo: "6",
        opNo: "32526",
        operationName: "TAG PINS REMOVE-02",
        smv: "3.00",
        rate: "0.24",
        skills: "Un-Skilled",
        lastOpSection: false,
      },
    ],
    bundles: [
      {
        id: 1,
        transId: "T0002451",
        line: "1",
        bundleNo: "B0001",
        inseam: "32.29",
        size: "28",
        pcs: 85,
        sel: true,
        code: "A01",
      },
      {
        id: 2,
        transId: "T0002451",
        line: "2",
        bundleNo: "B0002",
        inseam: "32.29",
        size: "30",
        pcs: 85,
        sel: true,
        code: "A01",
      },
      {
        id: 3,
        transId: "T0002451",
        line: "3",
        bundleNo: "B0003",
        inseam: "32.29",
        size: "32",
        pcs: 85,
        sel: true,
        code: "A01",
      },
      {
        id: 4,
        transId: "T0002451",
        line: "4",
        bundleNo: "B0004",
        inseam: "32.29",
        size: "34",
        pcs: 85,
        sel: true,
        code: "A01",
      },
      {
        id: 5,
        transId: "T0002451",
        line: "5",
        bundleNo: "B0005",
        inseam: "32.29",
        size: "36",
        pcs: 85,
        sel: true,
        code: "A01",
      },
      {
        id: 6,
        transId: "T0002452",
        line: "1",
        bundleNo: "B0006",
        inseam: "34.29",
        size: "28",
        pcs: 85,
        sel: true,
        code: "A01",
      },
    ],
  },
  {
    anlNo: "38920",
    customer: "LEVI'S",
    styleCode: "L5012480",
    generateBy: "FR7844",
    generateDatetime: "04/03/25 10:15:30",
    totalWash: "1200",
    generatedCoupons: "1500",
    balance: "0",
    generatedBundle: "1500",
    notes: "Special vintage wash denim shirts.",
    remarks: "Hand scraping operations sequence checked.",
    reworkQtyMain: "45",
    reworkQtyBundle: "0",
    subTotal: "127,500",
    total: "127,500",
    operations: [
      {
        id: 1,
        section: "500 - PRE FINISHING",
        seqNo: "1",
        opNo: "101",
        operationName: "HAND SCRAPING FRONT",
        smv: "4.50",
        rate: "0.60",
        skills: "Skilled",
        lastOpSection: false,
      },
      {
        id: 2,
        section: "501 - FINISHING",
        seqNo: "2",
        opNo: "102",
        operationName: "WHISKERING EFFECT",
        smv: "5.00",
        rate: "0.85",
        skills: "Skilled",
        lastOpSection: false,
      },
    ],
    bundles: [
      {
        id: 1,
        transId: "T0008892",
        line: "3",
        bundleNo: "B0024",
        inseam: "30.00",
        size: "32",
        pcs: 50,
        sel: true,
        code: "C02",
      },
      {
        id: 2,
        transId: "T0008892",
        line: "4",
        bundleNo: "B0025",
        inseam: "30.00",
        size: "34",
        pcs: 50,
        sel: true,
        code: "C02",
      },
    ],
  },
  {
    anlNo: "90412",
    customer: "GAP SOURCING",
    styleCode: "G804599",
    generateBy: "FR3312",
    generateDatetime: "05/03/25 09:00:15",
    totalWash: "900",
    generatedCoupons: "1000",
    balance: "0",
    generatedBundle: "1000",
    notes: "Fleece hoodies layout bundle creation.",
    remarks: "Packaging label verification required.",
    reworkQtyMain: "22",
    reworkQtyBundle: "0",
    subTotal: "85,000",
    total: "85,000",
    operations: [
      {
        id: 1,
        section: "500 - PRE FINISHING",
        seqNo: "1",
        opNo: "201",
        operationName: "HOOD RIB ATTACH",
        smv: "2.10",
        rate: "0.30",
        skills: "Semi-Skilled",
        lastOpSection: false,
      },
      {
        id: 2,
        section: "502 - PACKING",
        seqNo: "2",
        opNo: "202",
        operationName: "FOLDING & POLY BAG",
        smv: "1.20",
        rate: "0.15",
        skills: "Un-Skilled",
        lastOpSection: false,
      },
    ],
    bundles: [
      {
        id: 1,
        transId: "T0009124",
        line: "1",
        bundleNo: "B0109",
        inseam: "0.00",
        size: "M",
        pcs: 100,
        sel: true,
        code: "F01",
      },
      {
        id: 2,
        transId: "T0009124",
        line: "2",
        bundleNo: "B0110",
        inseam: "0.00",
        size: "L",
        pcs: 100,
        sel: true,
        code: "F01",
      },
    ],
  },
];

// Helper to encode string data into Code 128 Mode B binary representation
function encodeCode128B(text: string): string {
  const widths = [
    "212222",
    "222122",
    "222221",
    "121223",
    "121322",
    "131222",
    "122213",
    "122312",
    "132212",
    "221213", // 0-9
    "221312",
    "231212",
    "112232",
    "122132",
    "122231",
    "113222",
    "123122",
    "123221",
    "223211",
    "221132", // 10-19
    "221231",
    "213212",
    "223112",
    "312131",
    "311222",
    "321122",
    "321221",
    "312212",
    "322112",
    "322211", // 20-29
    "212123",
    "212321",
    "232121",
    "111323",
    "131123",
    "131321",
    "112313",
    "132113",
    "132311",
    "211313", // 30-39
    "231113",
    "231311",
    "112133",
    "112331",
    "132131",
    "113123",
    "113321",
    "133121",
    "313121",
    "211331", // 40-49
    "231131",
    "213113",
    "213311",
    "213131",
    "311123",
    "311321",
    "331121",
    "312113",
    "312311",
    "332111", // 50-59
    "314111",
    "221411",
    "431111",
    "111224",
    "111422",
    "121124",
    "121421",
    "141122",
    "141221",
    "112214", // 60-69
    "112412",
    "122114",
    "122411",
    "142112",
    "142211",
    "241211",
    "221114",
    "413111",
    "241112",
    "134111", // 70-79
    "111242",
    "121142",
    "121241",
    "114212",
    "124112",
    "124211",
    "411212",
    "421112",
    "421211",
    "212141", // 80-89
    "214121",
    "412121",
    "111143",
    "111341",
    "113141",
    "111431",
    "113411",
    "114131",
    "114311",
    "411131", // 90-99
    "411311",
    "113114",
    "111413",
    "113113",
    "113311",
    "411113",
    "411311",
  ];
  const startB = 104;
  const stopPattern = "2331112";

  // Calculate checksum and values
  let checksum = startB;
  const resultPatterns = ["211214"]; // Start B

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const value = charCode - 32; // Code 128 B starts from space (ASCII 32)
    if (value < 0 || value > 95) continue;

    checksum += value * (i + 1);
    resultPatterns.push(widths[value]);
  }

  const checksumValue = checksum % 103;
  resultPatterns.push(widths[checksumValue]);
  resultPatterns.push(stopPattern);

  // Convert pattern to binary representation (1s for black bars, 0s for white spaces)
  let binary = "";
  resultPatterns.forEach((pat) => {
    let isBar = true;
    for (let j = 0; j < pat.length; j++) {
      const w = parseInt(pat[j], 10);
      binary += (isBar ? "1" : "0").repeat(w);
      isBar = !isBar;
    }
  });

  return binary;
}

// React Barcode SVG Generator Component
function Barcode({ value }: { value: string }) {
  const binary = encodeCode128B(value);
  const barWidth = 1.5;
  const height = 45;
  const width = binary.length * barWidth;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {binary.split("").map((char, index) => {
        if (char === "1") {
          return (
            <rect
              key={index}
              x={index * barWidth}
              y={0}
              width={barWidth}
              height={height}
              fill="black"
            />
          );
        }
        return null;
      })}
    </svg>
  );
}

// React QR Code SVG Component
function QRCodeSVG({ value }: { value: string }) {
  const sizePx = 64;
  const paths: string[] = [];
  let hasError = false;

  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const margin = 4; // Standard quiet zone (4 modules)
    const totalModules = size + margin * 2;
    const cellSize = sizePx / totalModules;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (qr.modules.get(r, c)) {
          const x = (c + margin) * cellSize;
          const y = (r + margin) * cellSize;
          paths.push(`M${x} ${y}h${cellSize}v${cellSize}h-${cellSize}z`);
        }
      }
    }
  } catch (error) {
    console.error("QR Generation error", error);
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="w-16 h-16 bg-red-100 flex items-center justify-center text-[7px] text-red-500 font-bold">
        Error
      </div>
    );
  }

  return (
    <svg
      viewBox={"0 0 " + sizePx + " " + sizePx}
      shapeRendering="crispEdges"
      className="w-16 h-16 bg-white"
    >
      <path fill="#ffffff" d={"M0 0h" + sizePx + "v" + sizePx + "H0z"} />
      <path fill="#000000" d={paths.join(" ")} />
    </svg>
  );
}

// Single Coupon/Label Component
interface BarcodeCardProps {
  pageIndex: number;
  totalPages: number;
  styleCode: string;
  anlNo: string;
  bundle: BundleDetailRow;
  op: OperationsDetailRow;
}

function BarcodeCard({
  pageIndex,
  totalPages,
  styleCode,
  anlNo,
  bundle,
  op,
}: BarcodeCardProps) {
  const [copied, setCopied] = useState(false);
  const rateNum = parseFloat(op.rate || "0");
  const qtyNum = bundle.pcs || 0;
  const rsVal = Math.round(rateNum * qtyNum);

  // 2D QR Code Payload: Strict piped syntax required by scanner parser
  const qrValue = `${anlNo}|${bundle.bundleNo}|${styleCode}|${bundle.size || "/"}|${op.opNo}|${op.rate}|${qtyNum}`;

  // User-friendly QR code string that displays all info from the ticket image
  const qrDisplayValue = `Order: ${anlNo}
Bundle: ${bundle.bundleNo}
Style: ${styleCode}
Size: ${bundle.size || "/"}
Op No: ${op.opNo}
Op Name: ${op.operationName}
Card: ${pageIndex}/${totalPages}
Qty: ${qtyNum}
Rate: ${op.rate}
Inc: ${bundle.inseam || "-"}
Rs: ${rsVal}`;

  // 1D Barcode Payload: {Order}-{Bundle}-{Op_Num}
  const barcodeValue = `${anlNo}-${bundle.bundleNo}-${op.opNo}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="barcode-card flex flex-col justify-start bg-white text-black font-sans border border-dashed border-[#666666] py-0.5 px-1.5 relative select-none overflow-hidden"
      style={{ boxSizing: "border-box", height: "100%" }}
    >
      {/* Registration Marks / Cut lines in corners */}
      <div className="absolute top-0 left-0 w-2 h-2 pointer-events-none translate-x-[-50%] translate-y-[-50%] flex items-center justify-center text-[10px] text-gray-400 font-normal font-mono">
        +
      </div>
      <div className="absolute top-0 right-0 w-2 h-2 pointer-events-none translate-x-[50%] translate-y-[-50%] flex items-center justify-center text-[10px] text-gray-400 font-normal font-mono">
        +
      </div>
      <div className="absolute bottom-0 left-0 w-2 h-2 pointer-events-none translate-x-[-50%] translate-y-[50%] flex items-center justify-center text-[10px] text-gray-400 font-normal font-mono">
        +
      </div>
      <div className="absolute bottom-0 right-0 w-2 h-2 pointer-events-none translate-x-[50%] translate-y-[50%] flex items-center justify-center text-[10px] text-gray-400 font-normal font-mono">
        +
      </div>

      {/* Header Banner: Solid high-contrast background block displaying B# and Size */}
      <div className="bg-[#0f172a] text-white px-1.5 py-0.5 flex justify-between items-center font-bold text-[9px] uppercase tracking-wider rounded-sm mb-0.5">
        <span>B#: {bundle.bundleNo}</span>
        <span>Size: {bundle.size || "/"}</span>
      </div>

      {/* Body: 2-Column Grid */}
      <div className="grid grid-cols-12 gap-1.5 items-start">
        {/* Left Column (Col span 7): Operational details, Metrics & Scan Note */}
        <div className="col-span-7 flex flex-col gap-0.5 text-[7.5px] leading-tight">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-start gap-1">
              <span className="bg-[#4f46e5] text-white font-extrabold px-1 rounded-[2px] text-[7px] shrink-0">
                Op {op.seqNo}
              </span>
              <span
                className="font-extrabold text-[7.5px] text-[#0f172a] uppercase break-words leading-tight line-clamp-1"
                title={op.operationName}
              >
                {op.operationName}
              </span>
            </div>
            <div className="mt-0.5 border-t border-gray-100 pt-0.5 flex flex-col gap-0.5">
              <div>
                <span className="text-gray-500 font-semibold">Order:</span>{" "}
                <span className="font-bold text-[#0f172a]">{anlNo}</span>
              </div>
              <div>
                <span className="text-gray-500 font-semibold">St:</span>{" "}
                <span className="font-bold text-[#0f172a]">{styleCode}</span>
              </div>
              <div>
                <span className="text-gray-500 font-semibold">Card:</span>{" "}
                <span className="text-gray-600 font-bold">
                  {pageIndex}/{totalPages}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            {/* Metrics */}
            <div className="w-full text-[7.5px] leading-none flex flex-col gap-0.5 border-t border-dashed border-gray-200 pt-1">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Qty:</span>
                <span className="font-bold text-[#0f172a]">{qtyNum}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Rate:</span>
                <span className="font-bold text-[#0f172a]">{op.rate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Inc:</span>
                <span className="font-bold text-[#0f172a]">
                  {bundle.inseam || "-"}
                </span>
              </div>
              <div className="flex justify-between text-indigo-700 font-extrabold">
                <span>Rs:</span>
                <span>{rsVal}</span>
              </div>
            </div>

            {/* Scan Note (Click to copy) - Commented out as requested
            <div 
              onClick={handleCopy}
              className="mt-1 border-t border-dashed border-gray-200 pt-1.5 flex flex-col cursor-pointer group"
              title="Click to copy raw barcode payload"
            >
              <span className="text-gray-400 font-bold text-[7px] uppercase tracking-wide group-hover:text-indigo-600 flex items-center gap-1 transition-colors">
                Scan Note {copied ? <span className="text-green-600 text-[6.5px] font-extrabold">(Copied!)</span> : <span className="text-[6.5px] text-gray-400">(Click to copy)</span>}
              </span>
              <span className="font-mono text-[7px] text-gray-600 bg-gray-50 px-1 py-0.5 rounded break-all border border-gray-100 mt-0.5 leading-none group-hover:bg-indigo-50 group-hover:text-indigo-900 group-hover:border-indigo-200 transition-colors">
                {qrValue}
              </span>
            </div>
            */}
          </div>
        </div>

        {/* Right Column (Col span 5): QR Code centered vertically */}
        <div className="col-span-5 flex flex-col justify-start items-end">
          <div
            onClick={handleCopy}
            className="flex justify-center items-center bg-white p-0.5 rounded shadow-sm border border-gray-100 cursor-pointer hover:scale-105 transition-transform relative group"
            title="Click to copy raw barcode payload"
          >
            <QRCodeSVG value={qrDisplayValue} />
            {copied && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded">
                <span className="text-white text-[7.5px] font-bold">
                  Copied!
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BarcodeGenerationFinishingPage() {
  const [activeStyle, setActiveStyle] = useState<BarcodeStyleData>(
    mockBarcodeStyles[0],
  );
  const [showSearchModal, setShowSearchModal] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showPageSetupModal, setShowPageSetupModal] = useState(false);
  const [pageSetup, setPageSetup] = useState({
    size: "Legal",
    source: "Automatically Select",
    orientation: "Portrait",
    margins: { left: 0.166, right: 0.166, top: 0.53, bottom: 0.166 },
    gridFormat: "3x10",
  });

  const handleModalSearch = () => {
    setActiveStyle(mockBarcodeStyles[selectedIdx]);
    setShowSearchModal(false);
  };

  const handleAnlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const found = mockBarcodeStyles.find((s) => s.anlNo === value);
    if (found) {
      setActiveStyle(found);
    } else {
      setActiveStyle((prev) => ({ ...prev, anlNo: value }));
    }
  };

  const filteredStyles = mockBarcodeStyles.filter(
    (s) =>
      s.anlNo.includes(searchQuery) ||
      s.styleCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.customer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <>
      <div className="no-print flex flex-col gap-6 max-w-[1380px] mx-auto text-xs text-[#334155] animate-fade-in relative pb-16">
        {/* Top Breadcrumb */}
        <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748b]">
            <span>Industrial Engineering</span>
            <span className="text-[#94a3b8] font-light">/</span>
            <span className="text-[#4f46e5] font-bold">
              Barcode Generation Finishing
            </span>
          </div>
        </div>

        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-[#0f172a] tracking-tight">
              Barcode Generation Finishing
            </h1>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Generate and manage barcode finishing bundles
            </p>
          </div>

          {/* Action Header Buttons */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-red-600 hover:bg-red-50 px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm">
              <Trash2 className="w-3.5 h-3.5" />
              Delete Coupons
            </button>
            <button className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc] px-3.5 py-2 rounded-xl font-bold transition-all shadow-sm">
              <X className="w-3.5 h-3.5" />
              Cancel Coupons
            </button>
            <button className="flex items-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm">
              <Layers className="w-3.5 h-3.5" />
              Generate Bundle
            </button>
          </div>
        </div>

        {/* Main Parameters Panel */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
          {/* Row 1 inputs (Spans 10 columns) */}
          <div className="lg:col-span-10 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ANL# field matching the secondary image requirement */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                ANL#
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={activeStyle.anlNo}
                  onChange={handleAnlInputChange}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold focus:outline-none"
                />
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearchModal(true);
                  }}
                  className="px-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 font-bold"
                >
                  ...
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                Customer
              </label>
              <input
                type="text"
                value={activeStyle.customer}
                readOnly
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                Style Code
              </label>
              <input
                type="text"
                value={activeStyle.styleCode}
                readOnly
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                Total Wash
              </label>
              <input
                type="text"
                value={activeStyle.totalWash}
                onChange={(e) =>
                  setActiveStyle({ ...activeStyle, totalWash: e.target.value })
                }
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                Generate By
              </label>
              <input
                type="text"
                value={activeStyle.generateBy}
                readOnly
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] font-semibold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                Generate Datetime
              </label>
              <input
                type="text"
                value={activeStyle.generateDatetime}
                readOnly
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                Balance
              </label>
              <input
                type="text"
                value={activeStyle.balance}
                readOnly
                className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc]"
              />
            </div>

            {/* Generated summary values */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#475569] text-[10px] uppercase">
                  Generated Coupons
                </label>
                <input
                  type="text"
                  value={activeStyle.generatedCoupons}
                  readOnly
                  className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#475569] text-[10px] uppercase">
                  Generated Bundle
                </label>
                <input
                  type="text"
                  value={activeStyle.generatedBundle}
                  readOnly
                  className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
                />
              </div>
            </div>

            {/* Notes (Spans full width of main form inputs) */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="font-bold text-[#475569] text-[11px]">
                Notes
              </label>
              <input
                type="text"
                value={activeStyle.notes}
                onChange={(e) =>
                  setActiveStyle({ ...activeStyle, notes: e.target.value })
                }
                placeholder="Enter notes (optional)"
                className="px-3 py-2.5 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
              />
            </div>
          </div>

          {/* Right action controls (Spans 2 columns) */}
          <div className="lg:col-span-2 flex flex-col gap-2.5 w-full">
            <button
              onClick={() => setShowPageSetupModal(true)}
              className="w-full flex items-center justify-center gap-1.5 bg-white border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc] py-2.5 rounded-xl font-bold transition-all shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button className="w-full flex items-center justify-center gap-1.5 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#7c3aed] border border-[#ddd6fe] py-2.5 rounded-xl font-bold transition-colors">
              <Layers className="w-3.5 h-3.5" />
              Manual Gen. Bundle
            </button>
          </div>
        </div>

        {/* Main Grid: Columns for Operations Detail and Bundle Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          {/* Left Side: Operations Detail (Spans 6 columns) */}
          <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <h3 className="text-sm font-extrabold text-[#4f46e5] border-b border-[#f1f5f9] pb-2">
              Operations Detail
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0]">
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Section
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      Seq #
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      Op #
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Operation
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      SMV
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      Rate
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Skills
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      Last Op Section
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {activeStyle.operations.map((op) => (
                    <tr
                      key={op.id}
                      className="hover:bg-[#f8fafc] transition-colors"
                    >
                      <td className="py-2">
                        <select className="px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none">
                          <option value={op.section}>
                            {op.section || "Select"}
                          </option>
                          <option value="500 - PRE FINISHING">
                            500 - PRE FINISHING
                          </option>
                          <option value="501 - FINISHING">
                            501 - FINISHING
                          </option>
                          <option value="502 - PACKING">502 - PACKING</option>
                        </select>
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="text"
                          value={op.seqNo}
                          className="w-10 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 text-center font-bold text-[#64748b]">
                        <input
                          type="text"
                          value={op.opNo}
                          className="w-14 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={op.operationName}
                          className="w-full px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 text-center font-semibold">
                        <input
                          type="text"
                          value={op.smv}
                          className="w-12 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 text-center font-semibold">
                        <input
                          type="text"
                          value={op.rate}
                          className="w-12 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2">
                        <select className="px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none font-semibold">
                          <option value={op.skills}>{op.skills}</option>
                          <option value="Skilled">Skilled</option>
                          <option value="Semi-Skilled">Semi-Skilled</option>
                          <option value="Un-Skilled">Un-Skilled</option>
                        </select>
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={op.lastOpSection}
                          onChange={(e) => {
                            const updated = activeStyle.operations.map((o) =>
                              o.id === op.id
                                ? { ...o, lastOpSection: e.target.checked }
                                : o,
                            );
                            setActiveStyle({
                              ...activeStyle,
                              operations: updated,
                            });
                          }}
                          className="rounded border-[#e2e8f0] text-[#4f46e5]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-[#f1f5f9] pt-4 mt-1">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#475569] text-[11px]">
                  Remarks
                </label>
                <input
                  type="text"
                  value={activeStyle.remarks}
                  onChange={(e) =>
                    setActiveStyle({ ...activeStyle, remarks: e.target.value })
                  }
                  placeholder="Enter remarks (optional)"
                  className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-32 self-end">
                <label className="font-bold text-[#475569] text-[11px]">
                  Rework Qty
                </label>
                <input
                  type="text"
                  value={activeStyle.reworkQtyMain}
                  onChange={(e) =>
                    setActiveStyle({
                      ...activeStyle,
                      reworkQtyMain: e.target.value,
                    })
                  }
                  className="px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
                />
              </div>
            </div>
          </div>

          {/* Right Side: Bundle Detail (Spans 6 columns) */}
          <div className="lg:col-span-6 bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
              <h3 className="text-sm font-extrabold text-[#4f46e5]">
                Bundle Detail
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#64748b]">
                  Complete selection
                </span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-[#e2e8f0] text-[#4f46e5]"
                />
              </div>
            </div>

            {/* Rework Qty input line */}
            <div className="flex items-center gap-3 py-0.5">
              <span className="font-bold text-red-600 text-xs flex items-center gap-1">
                Rework Qty &rarr;
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={activeStyle.reworkQtyBundle}
                  onChange={(e) =>
                    setActiveStyle({
                      ...activeStyle,
                      reworkQtyBundle: e.target.value,
                    })
                  }
                  className="w-14 px-2 py-1 rounded-lg border border-[#e2e8f0] text-xs bg-[#f8fafc] text-center"
                />
                <HelpCircle className="w-3.5 h-3.5 text-[#94a3b8]" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#e2e8f0]">
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Trans Id
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      Line
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Bundle #
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Inseam
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Size
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      Pcs
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider text-center">
                      Sel
                    </th>
                    <th className="py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                      Code
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {activeStyle.bundles.map((bd) => (
                    <tr
                      key={bd.id}
                      className="hover:bg-[#f8fafc] transition-colors"
                    >
                      <td className="py-2 font-semibold">
                        <input
                          type="text"
                          value={bd.transId}
                          className="w-full px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="text"
                          value={bd.line}
                          className="w-10 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={bd.bundleNo}
                          className="w-20 px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 font-semibold text-[#64748b]">
                        <input
                          type="text"
                          value={bd.inseam}
                          className="w-16 px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2">
                        <select className="px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none font-semibold">
                          <option value={bd.size}>Size {bd.size}</option>
                          <option value="28">Size 28</option>
                          <option value="30">Size 30</option>
                          <option value="32">Size 32</option>
                          <option value="34">Size 34</option>
                          <option value="36">Size 36</option>
                        </select>
                      </td>
                      <td className="py-2 text-center font-bold text-[#0f172a]">
                        <input
                          type="number"
                          value={bd.pcs}
                          className="w-14 text-center px-1 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={bd.sel}
                          onChange={(e) => {
                            const updated = activeStyle.bundles.map((b) =>
                              b.id === bd.id
                                ? { ...b, sel: e.target.checked }
                                : b,
                            );
                            setActiveStyle({
                              ...activeStyle,
                              bundles: updated,
                            });
                          }}
                          className="rounded border-[#e2e8f0] text-[#4f46e5]"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="text"
                          value={bd.code}
                          className="w-14 px-2 py-1 rounded-lg border border-[#e2e8f0] bg-white text-[11px] focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sub total / Total Summary bottom area */}
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#f1f5f9] items-end">
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#64748b]">Sub Total</span>
                <input
                  type="text"
                  value={activeStyle.subTotal}
                  readOnly
                  className="w-36 px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs font-bold text-right"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-[#64748b]">Total</span>
                <input
                  type="text"
                  value={activeStyle.total}
                  readOnly
                  className="w-36 px-3 py-2 border border-[#e2e8f0] rounded-xl bg-[#f8fafc] text-xs font-bold text-right text-indigo-700 bg-indigo-50/20 border-indigo-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer bar values */}
        <footer className="fixed bottom-0 left-0 right-0 bg-[#f8fafc] border-t border-[#e2e8f0] px-6 py-2.5 flex items-center justify-between text-[11px] text-[#64748b] font-semibold z-35">
          <div>
            Record: <span className="text-[#334155]">1/1</span> | Choices in
            list: <span className="text-[#334155]">1</span> | Choices in full
            list: <span className="text-[#334155]">36863</span>
          </div>
          <div>
            <span>Enter-Query</span>
          </div>
          <div className="flex gap-4">
            <span className="font-bold text-[#475569]">&lt;OSC&gt;</span>
            <span className="font-bold text-[#475569]">&lt;DBG&gt;</span>
          </div>
        </footer>

        {/* Search Modal for ANL# */}
        {showSearchModal && (
          <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[500px] w-full p-6 animate-scale-up">
              <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4 mb-4">
                <h3 className="text-sm font-extrabold text-[#0f172a]">
                  Select ANL# Style
                </h3>
                <button
                  onClick={() => setShowSearchModal(false)}
                  className="p-1.5 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#0f172a] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Find search field */}
              <div className="flex items-center gap-3 mb-4">
                <span className="font-bold text-[#475569] text-xs min-w-[40px]">
                  Find
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[#e2e8f0] text-xs bg-[#f8fafc] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5]"
                  placeholder="Search ANL# or Customer..."
                />
              </div>

              {/* Modal search result table */}
              <div className="border border-[#e2e8f0] rounded-xl overflow-hidden mb-5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                      <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-24">
                        ANL No
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider w-28">
                        Customer
                      </th>
                      <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
                        Style Code
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStyles.map((style) => (
                      <tr
                        key={style.anlNo}
                        onClick={() =>
                          setSelectedIdx(mockBarcodeStyles.indexOf(style))
                        }
                        className={`hover:bg-indigo-50/30 cursor-pointer transition-colors ${
                          selectedIdx === mockBarcodeStyles.indexOf(style)
                            ? "bg-indigo-50/50"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#334155]">
                          <input
                            type="radio"
                            checked={
                              selectedIdx === mockBarcodeStyles.indexOf(style)
                            }
                            onChange={() =>
                              setSelectedIdx(mockBarcodeStyles.indexOf(style))
                            }
                            className="text-[#4f46e5]"
                          />
                          <span>{style.anlNo}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-[#64748b]">
                          {style.customer}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#334155]">
                          {style.styleCode}
                        </td>
                      </tr>
                    ))}
                    {filteredStyles.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-center py-4 text-[#94a3b8]"
                        >
                          No styles found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal actions */}
              <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-4">
                <span className="text-[11px] text-[#94a3b8] font-semibold">
                  {filteredStyles.length} results found
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSearchModal(false)}
                    className="bg-white border border-[#e2e8f0] text-[#64748b] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#f8fafc] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleModalSearch}
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

      {/* Page Setup Modal */}
      {showPageSetupModal && (
        <div className="no-print fixed inset-0 bg-[#0f172a]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#e2e8f0] max-w-[500px] w-full p-6 animate-scale-up text-xs text-[#334155] font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <h3 className="text-sm font-extrabold text-[#0f172a]">
                Page Setup
              </h3>
              <button
                onClick={() => setShowPageSetupModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Preview Illustration */}
            <div className="flex justify-center mb-6">
              <div className="relative w-36 h-44 bg-white border border-gray-300 rounded-md shadow-md flex items-center justify-center p-2">
                <div
                  className="w-full h-full border border-dashed border-[#4f46e5]/40 rounded bg-gray-50/50 flex flex-col justify-between p-2"
                  style={{
                    paddingLeft: `${Math.max(2, pageSetup.margins.left * 15)}px`,
                    paddingRight: `${Math.max(2, pageSetup.margins.right * 15)}px`,
                    paddingTop: `${Math.max(2, pageSetup.margins.top * 15)}px`,
                    paddingBottom: `${Math.max(2, pageSetup.margins.bottom * 15)}px`,
                    transform:
                      pageSetup.orientation === "Landscape"
                        ? "rotate(-90deg)"
                        : "none",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Mock content lines inside the preview */}
                  <div className="flex flex-col gap-1 w-full">
                    <div className="h-1.5 w-8/12 bg-gray-300 rounded" />
                    <div className="h-1 bg-gray-200 rounded w-full" />
                    <div className="h-1 bg-gray-200 rounded w-10/12" />
                    <div className="h-1 bg-gray-200 rounded w-11/12" />
                  </div>
                  <div className="flex flex-col gap-1 w-full items-center">
                    <div className="h-3 w-full bg-gray-300/60 rounded flex items-center justify-center text-[5px] text-gray-500 font-bold font-mono">
                      BARCODE
                    </div>
                  </div>
                  <div className="h-1.5 w-4/12 bg-gray-300 rounded self-end" />
                </div>
                {/* Folded corner effect */}
                <div className="absolute top-0 right-0 w-3 h-3 bg-white border-l border-b border-gray-300 rounded-bl-sm" />
              </div>
            </div>

            {/* Paper Section */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-[#4f46e5]" />
                <span className="font-bold text-[#4f46e5] text-[11px] uppercase tracking-wider">
                  Paper
                </span>
                <div className="flex-1 h-[1px] bg-gray-100" />
              </div>
              <div className="grid grid-cols-1 gap-3 pl-6">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-500 w-20">Size</span>
                  <select
                    value={pageSetup.size}
                    onChange={(e) =>
                      setPageSetup({ ...pageSetup, size: e.target.value })
                    }
                    className="flex-1 max-w-[280px] px-3 py-2 rounded-xl border border-[#e2e8f0] bg-white font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Legal">Legal</option>
                    <option value="Letter">Letter</option>
                    <option value="A4">A4</option>
                    <option value="4x6 Label">4x6 Label (Thermal)</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-500 w-20">Source</span>
                  <select
                    value={pageSetup.source}
                    onChange={(e) =>
                      setPageSetup({ ...pageSetup, source: e.target.value })
                    }
                    className="flex-1 max-w-[280px] px-3 py-2 rounded-xl border border-[#e2e8f0] bg-white font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Automatically Select">
                      Automatically Select
                    </option>
                    <option value="Manual Feed">Manual Feed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Orientation & Margins Section */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6">
              {/* Orientation Left */}
              <div className="md:col-span-5 border border-gray-100 rounded-2xl p-4 bg-gray-50/30">
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="font-bold text-[#4f46e5] text-[11px] uppercase tracking-wider">
                    Orientation
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 pl-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                    <input
                      type="radio"
                      name="orientation"
                      checked={pageSetup.orientation === "Portrait"}
                      onChange={() =>
                        setPageSetup({ ...pageSetup, orientation: "Portrait" })
                      }
                      className="text-[#4f46e5] focus:ring-indigo-500"
                    />
                    <span>Portrait</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                    <input
                      type="radio"
                      name="orientation"
                      checked={pageSetup.orientation === "Landscape"}
                      onChange={() =>
                        setPageSetup({ ...pageSetup, orientation: "Landscape" })
                      }
                      className="text-[#4f46e5] focus:ring-indigo-500"
                    />
                    <span>Landscape</span>
                  </label>
                </div>
              </div>

              {/* Margins Right */}
              <div className="md:col-span-7 border border-gray-100 rounded-2xl p-4 bg-gray-50/30">
                <div className="flex items-center gap-1.5 mb-3">
                  <FileText className="w-3.5 h-3.5 text-[#4f46e5]" />
                  <span className="font-bold text-[#4f46e5] text-[11px] uppercase tracking-wider">
                    Margins (inches)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-gray-500 text-[10px]">
                      Left
                    </span>
                    <input
                      type="number"
                      step="0.001"
                      value={pageSetup.margins.left}
                      onChange={(e) =>
                        setPageSetup({
                          ...pageSetup,
                          margins: {
                            ...pageSetup.margins,
                            left: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-16 px-1.5 py-1 text-center border border-[#e2e8f0] rounded-lg font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-gray-500 text-[10px]">
                      Right
                    </span>
                    <input
                      type="number"
                      step="0.001"
                      value={pageSetup.margins.right}
                      onChange={(e) =>
                        setPageSetup({
                          ...pageSetup,
                          margins: {
                            ...pageSetup.margins,
                            right: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-16 px-1.5 py-1 text-center border border-[#e2e8f0] rounded-lg font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-gray-500 text-[10px]">
                      Top
                    </span>
                    <input
                      type="number"
                      step="0.001"
                      value={pageSetup.margins.top}
                      onChange={(e) =>
                        setPageSetup({
                          ...pageSetup,
                          margins: {
                            ...pageSetup.margins,
                            top: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-16 px-1.5 py-1 text-center border border-[#e2e8f0] rounded-lg font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-gray-500 text-[10px]">
                      Bottom
                    </span>
                    <input
                      type="number"
                      step="0.001"
                      value={pageSetup.margins.bottom}
                      onChange={(e) =>
                        setPageSetup({
                          ...pageSetup,
                          margins: {
                            ...pageSetup.margins,
                            bottom: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-16 px-1.5 py-1 text-center border border-[#e2e8f0] rounded-lg font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowPageSetupModal(false)}
                className="bg-white border border-[#e2e8f0] text-gray-600 px-5 py-2.5 rounded-xl font-bold hover:bg-[#f8fafc] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPageSetupModal(false);
                  setTimeout(() => {
                    window.print();
                  }, 300);
                }}
                className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-7 py-2.5 rounded-xl font-bold transition-all shadow-md"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Barcodes Area (Hidden on screen, shown on print) */}
      <div id="printable-barcode-area" className="hidden print:block">
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            #printable-barcode-area {
              display: block !important;
              width: 100% !important;
            }
            @page {
              size: ${pageSetup.size === "4x6 Label" ? "4in 6in" : pageSetup.size.toLowerCase()} ${pageSetup.orientation.toLowerCase()};
              margin: 5mm !important;
            }
            .print-page-container {
              width: 100% !important;
              page-break-after: always;
              break-after: page;
              box-sizing: border-box;
              padding: 2mm;
              overflow: hidden;
            }
            .print-page-container:last-child {
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .print-grid-dynamic {
              display: grid !important;
              width: 100% !important;
              height: 100% !important;
              gap: 0px !important;
            }
          }
        `,
          }}
        />

        {/* Generate dynamic coupon cards */}
        {activeStyle.bundles.filter((b) => b.sel).length > 0 &&
        activeStyle.operations.length > 0 ? (
          (() => {
            const selectedB = activeStyle.bundles.filter((b) => b.sel);
            const totalCardsList = selectedB.flatMap((bundle) =>
              activeStyle.operations.map((op) => ({ bundle, op })),
            );

            const [gridCols, gridRows] = pageSetup.gridFormat
              .split("x")
              .map(Number);
            const cardsPerPage = gridCols * gridRows;
            const pages: Array<
              Array<{
                bundle: BundleDetailRow;
                op: OperationsDetailRow;
                globalIndex: number;
              }>
            > = [];

            for (let i = 0; i < totalCardsList.length; i += cardsPerPage) {
              pages.push(
                totalCardsList
                  .slice(i, i + cardsPerPage)
                  .map((item, localIdx) => ({
                    ...item,
                    globalIndex: i + localIdx + 1,
                  })),
              );
            }

            const getPageHeight = () => {
              if (pageSetup.size === "Letter") return "9.8in";
              if (pageSetup.size === "A4") return "268mm";
              if (pageSetup.size === "Legal") return "12.8in";
              return "9.8in";
            };

            return pages.map((pageCards, pageIdx) => (
              <div
                key={pageIdx}
                className="print-page-container"
                style={{ height: getPageHeight(), maxHeight: getPageHeight() }}
              >
                <div
                  className="print-grid-dynamic"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                  }}
                >
                  {pageCards.map(({ bundle, op, globalIndex }) => (
                    <BarcodeCard
                      key={`${bundle.id}-${op.id}`}
                      pageIndex={globalIndex}
                      totalPages={totalCardsList.length}
                      styleCode={activeStyle.styleCode}
                      anlNo={activeStyle.anlNo}
                      bundle={bundle}
                      op={op}
                    />
                  ))}
                </div>
              </div>
            ));
          })()
        ) : (
          <div className="p-8 text-center text-gray-500 font-bold border border-gray-300 rounded">
            No bundles selected or no operations found to print barcodes.
          </div>
        )}
      </div>
    </>
  );
}
