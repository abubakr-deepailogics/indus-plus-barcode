import { OrderWiseReportPage } from "@/features/reports/components/OrderWiseReportPage";
import { RequirePermission } from "@/features/auth/components/RequirePermission";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Wise Report",
  description: "Order Wise Finishing Payment (Audit) — current pay-cycle month",
};

export default function OrderWiseReportRoute() {
  return (
    <RequirePermission pageKey="reports">
      <OrderWiseReportPage />
    </RequirePermission>
  );
}
