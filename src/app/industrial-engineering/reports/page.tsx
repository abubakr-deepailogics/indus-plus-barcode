import { EmployeeReportDashboard } from "@/features/reports/components/EmployeeReportDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Employee coupon scanning and earnings report",
};

export default function ReportsPage() {
  return <EmployeeReportDashboard />;
}
