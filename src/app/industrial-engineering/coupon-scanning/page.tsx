import { CouponScanningDashboard } from "@/features/coupon-scanning/components/CouponScanningDashboard";
import { RequirePermission } from "@/features/auth/components/RequirePermission";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coupon Scanning",
  description: "Worker daily coupon ticket scanning panel",
};

export default function CouponScanningPage() {
  return (
    <RequirePermission pageKey="coupon-scanning">
      <CouponScanningDashboard />
    </RequirePermission>
  );
}
