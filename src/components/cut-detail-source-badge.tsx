import { Database, Scissors } from "lucide-react";
import type { CutDetailSource } from "@/features/cut-planning/types";

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

// Compact pill telling the user which system a work order's bundles came
// from. `title` overrides the hover text where the switch rule differs (e.g.
// Coupon Generation switches on approved, not merely generated, bundles).
export function CutDetailSourceBadge({
  source,
  title,
}: {
  source: CutDetailSource;
  title?: string;
}) {
  const display = SOURCE_DISPLAY[source];
  const { Icon } = display;
  return (
    <span
      title={title ?? display.title}
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-semibold ${display.className}`}
    >
      <Icon className="size-3.5" />
      <span className="font-medium opacity-70">Source:</span>
      {display.label}
    </span>
  );
}
