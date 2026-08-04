"use client";

import React from "react";
import { BarcodeEncoderService } from "../services/barcode-encoder.service";

interface BarcodeSVGProps {
  value: string;
}

export function BarcodeSVG({ value }: BarcodeSVGProps) {
  const binary = BarcodeEncoderService.encodeCode128B(value);
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
