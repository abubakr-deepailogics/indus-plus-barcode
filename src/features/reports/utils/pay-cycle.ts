import { format } from "date-fns";

function payCycleStartFor(date: Date): Date {
  const day = date.getDate();
  const month = day >= 24 ? date.getMonth() : date.getMonth() - 1;
  return new Date(date.getFullYear(), month, 24);
}

export interface PayCycleOption {
  value: string; // yyyy-MM-dd, the cycle's own 24th — what the server expects as ?cycleStart
  label: string; // "24 Aug 2026 – 23 Sep 2026"
  isLive: boolean; // true only for the actual current (still-open) cycle
}

export function recentPayCycles(
  count = 12,
  from: Date = new Date(),
): PayCycleOption[] {
  const liveCycleStart = payCycleStartFor(from);
  const options: PayCycleOption[] = [];
  let cursor = liveCycleStart;
  for (let i = 0; i < count; i++) {
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 23);
    options.push({
      value: format(cursor, "yyyy-MM-dd"),
      label: `${format(cursor, "d MMM yyyy")} – ${format(end, "d MMM yyyy")}`,
      isLive: cursor.getTime() === liveCycleStart.getTime(),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 24);
  }
  return options;
}
