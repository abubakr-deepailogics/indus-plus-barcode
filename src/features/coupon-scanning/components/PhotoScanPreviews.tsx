"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { PhotoScan, PhotoScanPreview, ScanningRow } from "../types";

interface Props {
  previews: PhotoScanPreview[];
  rows: ScanningRow[];
  onDismiss: (url: string) => void;
}

const COLORS = {
  added: "#16a34a", // read and in the table
  rejected: "#f59e0b", // read, but the scan was refused (already scanned, unknown code…)
  unreadable: "#dc2626", // looks like a coupon QR, but could not be decoded
};

const toPoints = (corners: number[][]) => corners.map(([x, y]) => `${x},${y}`).join(" ");

// Read coupon-sheet photos with a box on every coupon QR, so the operator can
// see at a glance which coupons still need scanning with the gun.
export function PhotoScanPreviews({ previews, rows, onDismiss }: Props) {
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null);
  // Dismissed while open → the dialog just closes.
  const zoomed = previews.find((p) => p.url === zoomedUrl);
  if (previews.length === 0) return null;
  const inTable = new Set(rows.map((r) => r.barCode).filter(Boolean));

  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-2">
      {previews.map(({ url, fileName, scan }) => {
        const rejected = scan.found.filter((f) => !inTable.has(f.text));
        const added = scan.found.length - rejected.length;
        return (
          <figure key={url} className="flex w-min shrink-0 snap-start flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-700">
              <span className="truncate text-slate-500">{fileName}</span>
              <Legend color={COLORS.added} label={`${added} scanned`} />
              {rejected.length > 0 && <Legend color={COLORS.rejected} label={`${rejected.length} not added`} />}
              {scan.missed.length > 0 && (
                <Legend color={COLORS.unreadable} label={`${scan.missed.length} unreadable`} />
              )}
              <button
                type="button"
                onClick={() => onDismiss(url)}
                aria-label={`Close ${fileName}`}
                className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-3.5" />
              </button>
            </figcaption>

            {/* Click for a full-size view (boxes included) to zoom into small coupons. */}
            <button
              type="button"
              onClick={() => setZoomedUrl(url)}
              aria-label={`Enlarge ${fileName}`}
              className="self-start cursor-zoom-in"
            >
              <MarkedPhoto url={url} fileName={fileName} scan={scan} inTable={inTable} className="max-h-[420px]" />
            </button>
          </figure>
        );
      })}

      <Dialog open={!!zoomed} onOpenChange={(open) => !open && setZoomedUrl(null)}>
        <DialogContent className="w-fit sm:max-w-[95vw]">
          <DialogTitle className="text-xs">{zoomed?.fileName}</DialogTitle>
          {zoomed && (
            <MarkedPhoto
              url={zoomed.url}
              fileName={zoomed.fileName}
              scan={zoomed.scan}
              inTable={inTable}
              className="max-h-[80vh] max-w-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// The photo with a box over every read (green/amber) and unreadable (red) QR.
// The SVG shares the photo's pixel space, so boxes stay aligned at any size.
function MarkedPhoto({
  url,
  fileName,
  scan,
  inTable,
  className,
}: {
  url: string;
  fileName: string;
  scan: PhotoScan;
  inTable: Set<string>;
  className: string;
}) {
  return (
    <span className="relative block">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, nothing to optimize */}
      <img src={url} alt={`Coupon sheet ${fileName}`} className={`block w-auto rounded-lg ${className}`} />
      {scan.width > 0 && scan.height > 0 && (
        <svg
          viewBox={`0 0 ${scan.width} ${scan.height}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          fill="none"
          strokeWidth={2.5}
        >
          {scan.found.map((f, i) => (
            <polygon
              key={`f${i}`}
              points={toPoints(f.corners)}
              stroke={inTable.has(f.text) ? COLORS.added : COLORS.rejected}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {scan.missed.map((corners, i) => (
            <polygon
              key={`m${i}`}
              points={toPoints(corners)}
              stroke={COLORS.unreadable}
              strokeWidth={3.5}
              fill={`${COLORS.unreadable}33`}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="size-2.5 rounded-sm border-2" style={{ borderColor: color }} />
      {label}
    </span>
  );
}
