import { Database, Scissors } from "lucide-react";
import type { CutDetailSource } from "../types";

const SOURCE_DISPLAY: Record<
  CutDetailSource,
  { label: string; title: string; className: string; Icon: typeof Database }
> = {
  "cut-planning": {
    label: "Cut Planning",
    title: "Bundles generated from Cut Planning for this work order.",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    Icon: Scissors,
  },
  "indus-plus": {
    label: "indus-plus",
    title:
      "No bundles generated from Cut Planning yet for this work order, so its cut detail is read from indus-plus.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    Icon: Database,
  },
};

// Compact pill telling the user which system a work order's bundles came from.
export function CutDetailSourceBadge({ source }: { source: CutDetailSource }) {
  const { label, title, className, Icon } = SOURCE_DISPLAY[source];
  return (
    <span
      title={title}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold ${className}`}
    >
      <Icon className="size-3.5" />
      <span className="font-medium opacity-70">Source:</span>
      {label}
    </span>
  );
}
