"use client";

import "./globals.css";
import { ErrorFallback } from "@/components/error-fallback";

// Replaces the root layout when the layout itself fails, so it must render
// its own <html>/<body>.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-full flex-col bg-[#f8fafc]">
        <ErrorFallback error={error} retry={unstable_retry} boundary="global" />
      </body>
    </html>
  );
}
