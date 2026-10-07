import type { DashboardInsights } from "../types";

export async function fetchDashboardInsights(cycleStart: string): Promise<DashboardInsights> {
  const response = await fetch(`/api/dashboard/insights?cycleStart=${encodeURIComponent(cycleStart)}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load production insights.");
  return data as DashboardInsights;
}
