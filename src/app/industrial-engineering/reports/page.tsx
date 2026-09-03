import { EmployeeReportDashboard } from "@/features/reports/components/EmployeeReportDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Coupon scanning and earnings report — search by employee, work order, or operation",
};

export default function ReportsPage() {
  return <EmployeeReportDashboard />;
}
