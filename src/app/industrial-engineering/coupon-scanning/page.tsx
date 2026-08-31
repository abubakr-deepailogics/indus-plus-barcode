import { CouponScanningDashboard } from "@/features/coupon-scanning/components/CouponScanningDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coupon Scanning",
  description: "Worker daily coupon ticket scanning panel",
};

export default function CouponScanningPage() {
  return <CouponScanningDashboard />;
}
