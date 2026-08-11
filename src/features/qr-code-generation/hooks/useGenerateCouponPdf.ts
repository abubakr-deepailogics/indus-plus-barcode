"use client";

import { useState } from "react";
import type { QrCodeStyleData } from "../types";

// Shared by every page that offers "Generate PDF" (qr-code-generation,
// open-order, rework-coupon) — calls the server route once, which stores
// the PDF (dbo.QrCode_Pdf_Batch) so re-downloads don't regenerate.
export function useGenerateCouponPdf(activeStyle: Pick<QrCodeStyleData, "workOrder" | "saleOrderNo" | "styleCode" | "bundles" | "operations">) {
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleGeneratePdf = async () => {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate PDF.");
      }
      alert(`PDF generated: ${data.cardCount} coupon${data.cardCount === 1 ? "" : "s"}.`);
      window.location.href = `/api/qr-code-generation/pdf/${data.id}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate PDF.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return { handleGeneratePdf, generatingPdf };
}
