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
      // Non-streaming failures (validation errors) still come back as a
      // plain JSON error body — the stream only starts once there's work
      // to report progress on.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate coupons.");
      }
      if (!res.body) throw new Error("Failed to generate coupons.");

      // No progress UI here (this hook's callers use a plain alert(), not
      // the generate modal) — just drain the newline-delimited stream for
      // its final line. See useQrCodeGenerationFacade's confirmGenerateCoupons
      // for the version with a live progress bar.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData: { cardCount: number; couponCount: number } | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line);
          if (parsed.status === "error") throw new Error(parsed.message || "Failed to generate coupons.");
          if (parsed.status === "complete") finalData = parsed;
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) {
        const parsed = JSON.parse(buffer);
        if (parsed.status === "error") throw new Error(parsed.message || "Failed to generate coupons.");
        if (parsed.status === "complete") finalData = parsed;
      }
      if (!finalData) throw new Error("Failed to generate coupons.");

      setCouponCount(finalData.couponCount);
      alert(`Coupons generated: ${finalData.couponCount} total for this work order.`);
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
