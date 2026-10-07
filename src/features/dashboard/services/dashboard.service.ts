import { format } from "date-fns";
import type { DashboardInsights } from "../types";

const inFlightRequests = new Map<string, Promise<DashboardInsights>>();

export async function fetchDashboardInsights(from: Date, to: Date): Promise<DashboardInsights> {
  const params = new URLSearchParams({ from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") });
  const key = params.toString();
  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) return existingRequest;

  const request = fetch(`/api/dashboard/insights?${params}`, { cache: "no-store" })
    .then(async (response) => {
      const data: unknown = await response.json();
      if (!response.ok) {
        const message = typeof data === "object" && data && "error" in data && typeof data.error === "string"
          ? data.error
          : "Unable to load dashboard.";
        throw new Error(message);
      }
      return data as DashboardInsights;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
}
