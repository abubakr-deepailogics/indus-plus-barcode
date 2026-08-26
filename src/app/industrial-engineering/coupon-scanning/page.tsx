"use client";

import { useCouponScanning } from "@/features/coupon-scanning/hooks/useCouponScanning";
import { InformationPanel } from "@/features/coupon-scanning/components/InformationPanel";
import { ScanningDetailsTable } from "@/features/coupon-scanning/components/ScanningDetailsTable";
import { ScanModals } from "@/features/coupon-scanning/components/ScanModals";

export default function CouponScanningPage() {
  const couponScanning = useCouponScanning();

  return (
    <div className="flex flex-col gap-6 w-full text-xs text-[#334155] animate-fade-in pb-16 px-4 max-w-350 mx-auto">
      <InformationPanel {...couponScanning} />
      <ScanningDetailsTable {...couponScanning} />
      <ScanModals {...couponScanning} />
    </div>
  );
}
