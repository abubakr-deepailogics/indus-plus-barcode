import { OperatorWiseReportPage } from "@/features/reports/components/OperatorWiseReportPage";
import { RequirePermission } from "@/features/auth/components/RequirePermission";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Operator Wise Report",
  description: "Operator Wise Final Payment — current pay-cycle month",
};

export default function OperatorWiseReportRoute() {
  return (
    <RequirePermission pageKey="reports">
      <OperatorWiseReportPage />
    </RequirePermission>
  );
}
