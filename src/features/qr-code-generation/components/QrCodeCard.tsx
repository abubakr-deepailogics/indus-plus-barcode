"use client";

import React, { useState } from "react";
import type { QrCodeCardProps } from "../types";
import { QRCodeSVG } from "./QRCodeSVG";

export function QrCodeCard({
  pageIndex,
  totalPages,
  anlNo,
  bundle,
  op,
}: QrCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const rateNum = parseFloat(op.rate || "0");
  const qtyNum = bundle.pcs || 0;
  const rsVal = Math.round(rateNum * qtyNum);

  const qrDisplayValue = `Order: ${anlNo}
Cut: ${bundle.transId}
Bundle: ${bundle.bundleNo}
Size: ${bundle.size || "/"}
Op No: ${op.opNo}
Op Name: ${op.operationName}
Coupon: ${pageIndex}/${totalPages}
Qty: ${qtyNum}
Rate: ${op.rate}
Inc: ${bundle.inseam || "-"}
Rs: ${rsVal}`;

  const qrValue = `${anlNo}|${bundle.transId}|${bundle.bundleNo}|${bundle.size || "/"}|${op.opNo}|${op.rate}|${qtyNum}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="qr-code-card flex flex-col justify-start bg-white text-black font-sans border border-dashed border-[#666666] py-0.5 px-1.5 relative select-none overflow-hidden"
      style={{ boxSizing: "border-box", height: "100%" }}
    >
      {/* Registration Marks */}
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

      {/* Header Banner */}
      <div className="bg-[#0f172a] text-white px-1.5 py-0.5 flex justify-between items-center font-bold text-[9px] uppercase tracking-wider rounded-sm mb-0.5">
        <span>Cut: {bundle.transId}</span>
        <span>B#: {bundle.bundleNo}</span>
        <span>Size: {bundle.size || "/"}</span>
      </div>

      {/* Body: 2-Column Grid */}
      <div className="grid grid-cols-12 gap-1.5 items-start">
        {/* Left Column */}
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
                <span className="text-gray-500 font-semibold">Coupon:</span>{" "}
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
          </div>
        </div>

        {/* Right Column: QR Code */}
        <div className="col-span-5 flex flex-col justify-start items-end">
          <div
            onClick={handleCopy}
            className="flex justify-center items-center bg-white p-0.5 rounded shadow-sm border border-gray-100 cursor-pointer hover:scale-105 transition-transform relative group"
            title="Click to copy raw QR code payload"
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
