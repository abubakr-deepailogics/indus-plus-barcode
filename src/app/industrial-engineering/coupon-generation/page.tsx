"use client";

import { QrCodeGenerationView } from "@/features/qr-code-generation/components/QrCodeGenerationView";
import { RequirePermission } from "@/features/auth/components/RequirePermission";

export default function QrCodeGenerationFinishingPage() {
  return (
    <RequirePermission pageKey="coupon-generation">
      <QrCodeGenerationView />
    </RequirePermission>
  );
}
