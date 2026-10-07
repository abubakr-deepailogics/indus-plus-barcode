import type { DashboardInsights } from "../types";

export async function fetchDashboardInsights(month: string): Promise<DashboardInsights> {
  const response = await fetch(`/api/dashboard/insights?month=${encodeURIComponent(month)}`, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load production insights.");
  return data as DashboardInsights;
}
