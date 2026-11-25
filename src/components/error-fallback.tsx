"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { clientLogger } from "@/lib/logger/client";

type ErrorFallbackProps = {
  error: Error & { digest?: string };
  retry: () => void;
  /** Which boundary caught it, for the log. */
  boundary: "route" | "global";
};

// Shared UI + logging for app/error.tsx and app/global-error.tsx. The digest
// matches the server log's err.digest for errors thrown during server render.
export function ErrorFallback({ error, retry, boundary }: ErrorFallbackProps) {
  useEffect(() => {
    clientLogger.error("Render error caught by error boundary", { boundary, err: error, digest: error.digest });
  }, [error, boundary]);

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-500">
          The error has been logged. Try again, and if it keeps happening, share the reference below with support.
        </p>
      </div>
      {error.digest && <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">Ref: {error.digest}</code>}
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
