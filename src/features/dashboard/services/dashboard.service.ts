import type { DashboardDepartment, DashboardInsights } from "../types";

export async function fetchDashboardInsights(
  department: DashboardDepartment,
): Promise<DashboardInsights> {
  const response = await fetch(`/api/dashboard/insights?department=${department}`, {
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Unable to load dashboard insights.");
  }
  return data as DashboardInsights;
}
