"use client";

import { useEffect, useState } from "react";
import { printPdf } from "@/lib/print";
import type { CouponLayout, QrCodeStyleData } from "../types";

// Shared by every page that offers coupon generation (qr-code-generation,
// open-order, rework-coupon). Two separate actions:
// - handleGenerateCoupons: registers coupon rows in the DB only (dedup'd),
//   no PDF involved.
// - handleDownloadPdf: renders + stores + downloads the PDF for whatever
//   coupons exist (also registers any not yet in the DB, so printing never
//   skips a coupon that generate-coupons hasn't been run for).
export function useGenerateCouponPdf(activeStyle: Pick<QrCodeStyleData, "workOrder" | "saleOrderNo" | "styleCode" | "bundles" | "operations">) {
  const [generatingCoupons, setGeneratingCoupons] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [couponCount, setCouponCount] = useState<number | null>(null);

  const workOrder = activeStyle.workOrder;

  // Distinct coupons already generated for this work order (post-dedup),
  // shown next to the Generate button. Refetched after every generate.
  useEffect(() => {
    if (!workOrder) {
      setCouponCount(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/qr-code-generation/pdf?work_order=${encodeURIComponent(workOrder)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCouponCount(typeof data.couponCount === "number" ? data.couponCount : 0);
      })
      .catch(() => {
        if (!cancelled) setCouponCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workOrder]);

  const handleGenerateCoupons = async () => {
    setGeneratingCoupons(true);
    try {
      const res = await fetch("/api/qr-code-generation/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrder: activeStyle.workOrder,
          bundles: activeStyle.bundles,
          operations: activeStyle.operations,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate coupons.");
      }
      if (typeof data.couponCount === "number") setCouponCount(data.couponCount);
      alert(`Coupons generated: ${data.couponCount} total for this work order.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate coupons.");
    } finally {
      setGeneratingCoupons(false);
    }
  };

  const handleDownloadPdf = async (
    layout?: CouponLayout,
    margins?: { top: number; bottom: number; left: number; right: number },
    codeType?: "qr" | "barcode",
  ) => {
    setGeneratingPdf(true);
    try {
      const res = await fetch("/api/qr-code-generation/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workOrder: activeStyle.workOrder,
          saleOrderNo: activeStyle.saleOrderNo,
          styleCode: activeStyle.styleCode,
          bundles: activeStyle.bundles,
          operations: activeStyle.operations,
          layout,
          margins,
          codeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate PDF.");
      }
      if (typeof data.couponCount === "number") setCouponCount(data.couponCount);
      const pdfUrl = `/api/qr-code-generation/pdf/${data.id}`;
      printPdf(pdfUrl, () => setGeneratingPdf(false));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate PDF.");
      setGeneratingPdf(false);
    }
  };

  return { handleGenerateCoupons, generatingCoupons, handleDownloadPdf, generatingPdf, couponCount };
}
