"use client";

import React from "react";
import QRCode from "qrcode";

interface QRCodeSVGProps {
  value: string;
}

export function QRCodeSVG({ value }: QRCodeSVGProps) {
  const sizePx = 64;
  const paths: string[] = [];
  let hasError = false;

  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    const margin = 4;
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
