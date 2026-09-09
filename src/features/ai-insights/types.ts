import type { ReportSummary } from "@/features/reports/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/** Body sent to POST /api/ai/insights */
export interface AiInsightsRequest {
  question: string;
  summary: ReportSummary;
  /** Last few messages for multi-turn context (optional). */
  history?: Pick<ChatMessage, "role" | "content">[];
}

/** Non-streaming error response from the API. */
export interface AiInsightsErrorResponse {
  error: string;
}
