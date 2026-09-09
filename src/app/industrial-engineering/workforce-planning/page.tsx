import type { Metadata } from "next";
import { WorkforcePlanningDashboard } from "@/features/workforce-planning/components/WorkforcePlanningDashboard";

export const metadata: Metadata = {
  title: "Predictive Workforce Planning | Indus Plus",
  description:
    "AI-powered line balancing, operator skill matching, and production timeline forecasting for style bulletins.",
};

export default function WorkforcePlanningPage() {
  return <WorkforcePlanningDashboard />;
}
