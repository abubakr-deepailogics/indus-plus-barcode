"use client";

import { useEffect, useState } from "react";
import { AiChatPageContent } from "@/features/ai-insights/components/AiChatPageContent";
import type { ReportSummary } from "@/features/reports/types";

/**
 * Dedicated AI Chat page — auto-fetches an "all employees" summary for the
 * last 30 days on mount so the AI has context to work with immediately.
 */
export default function AiChatPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const params = new URLSearchParams({
          by: "employee",
          all: "true",
        });
        const res = await fetch(`/api/reports/summary?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            (data as { error?: string }).error || `Failed (${res.status})`,
          );
        }
        const data: ReportSummary = await res.json();
        if (!cancelled) {
          setSummary(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load data.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AiChatPageContent
      summary={summary}
      isLoadingSummary={isLoading}
      summaryError={error}
    />
  );
}
