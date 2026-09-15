import { OperatorWiseReportPage } from "@/features/reports/components/OperatorWiseReportPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operator Wise Report",
  description: "Operator Wise Final Payment — current pay-cycle month",
};

export default function OperatorWiseReportRoute() {
  return <OperatorWiseReportPage />;
}
